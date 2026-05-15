import { getDb } from "./db";
import { Collection, ObjectId } from "mongodb";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type Theme = {
  bubbleColor: string;
  headerColor: string;
  userMsgColor: string;
  sendBtnColor: string;
  accentColor: string;
};

export type KnowledgeData = {
  userId?: string;
  url?: string;
  content?: string;
  crawledAt?: string;
  systemPrompt?: string;
  theme?: Theme;
  botName?: string;
  botIcon?: string;
  botColor?: string;
  chunkCount?: number;
};

export type Account = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  plan: "free" | "starter" | "pro";
  crawlCount: number;
  googleId?: string;
  name?: string;
  avatar?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
  otpHash?: string;
  otpExpiry?: string;
  otpEmail?: string;
  subscription?: {
    provider: "razorpay" | "stripe";
    subscriptionId: string;
    status: "active" | "cancelled" | "expired";
    currentPeriodEnd: string;
  };
};

export interface AnalyticsEvent {
  _id?: ObjectId;
  userId: string | null;
  visitorId: string | null;
  sessionId: string | null;
  event: string;
  page: string | null;
  sourceUrl: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// COLLECTION HELPERS
// ─────────────────────────────────────────────

async function getAccountsCollection(): Promise<Collection<Account>> {
  const db = await getDb();
  return db.collection<Account>("accounts");
}

async function getKnowledgeCollection(): Promise<Collection<KnowledgeData>> {
  const db = await getDb();
  return db.collection<KnowledgeData>("knowledge");
}

async function getAnalyticsCollection(): Promise<Collection<AnalyticsEvent>> {
  const db = await getDb();
  const coll = db.collection<AnalyticsEvent>("analytics_events");
  // Ensure indexes
  await coll.createIndex({ userId: 1 });
  await coll.createIndex({ event: 1 });
  await coll.createIndex({ createdAt: 1 });
  await coll.createIndex({ sessionId: 1 });
  await coll.createIndex({ visitorId: 1 });
  return coll;
}

// ─────────────────────────────────────────────
// ANALYTICS FUNCTIONS
// ─────────────────────────────────────────────

export async function trackAnalyticsEvent(data: Omit<AnalyticsEvent, "createdAt">): Promise<void> {
  const coll = await getAnalyticsCollection();
  await coll.insertOne({
    ...data,
    createdAt: new Date(),
  });
}

export async function getAnalyticsOverview(userId: string) {
  const coll = await getAnalyticsCollection();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalEvents, topEvents, recentEvents, funnel] = await Promise.all([
    coll.countDocuments({ userId }),
    coll.aggregate([
      { $match: { userId } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray(),
    coll.find({ userId }).sort({ createdAt: -1 }).limit(20).toArray(),
    coll.aggregate([
      { $match: { userId, event: { $in: ["signup_started", "signup_completed", "crawl_started", "crawl_completed"] } } },
      { $group: { _id: "$event", count: { $sum: 1 } } }
    ]).toArray()
  ]);

  return {
    totalEvents,
    topEvents: topEvents.map(e => ({ name: e._id, count: e.count })),
    recentEvents,
    funnel: funnel.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {} as Record<string, number>)
  };
}

// ─────────────────────────────────────────────
// ACCOUNT FUNCTIONS
// ─────────────────────────────────────────────

export async function readAccounts(): Promise<Account[]> {
  const coll = await getAccountsCollection();
  return coll.find({}).toArray();
}

export async function findAccount(email: string): Promise<Account | undefined> {
  const coll = await getAccountsCollection();
  const account = await coll.findOne({ email });
  return account || undefined;
}

export async function findAccountById(id: string): Promise<Account | undefined> {
  const coll = await getAccountsCollection();
  const account = await coll.findOne({ id });
  return account || undefined;
}

export async function findAccountByResetToken(token: string): Promise<Account | undefined> {
  const coll = await getAccountsCollection();
  return (await coll.findOne({ resetToken: token })) || undefined;
}

export async function writeAccount(account: Account): Promise<void> {
  const coll = await getAccountsCollection();
  await coll.updateOne({ id: account.id }, { $set: account }, { upsert: true });
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  const coll = await getAccountsCollection();
  await coll.updateOne({ id }, { $set: updates });
}

export async function saveOtp(email: string, otpHash: string, expiry: string): Promise<void> {
  const coll = await getAccountsCollection();
  await coll.updateOne({ email }, { $set: { otpHash, otpExpiry: expiry, otpEmail: email } });
}

export async function clearOtp(email: string): Promise<void> {
  const coll = await getAccountsCollection();
  await coll.updateOne({ email }, { $unset: { otpHash: "", otpExpiry: "", otpEmail: "" } });
}

export async function updatePassword(email: string, newPasswordHash: string): Promise<void> {
  const coll = await getAccountsCollection();
  await coll.updateOne({ email }, { $set: { passwordHash: newPasswordHash } });
}

// ─────────────────────────────────────────────
// KNOWLEDGE FUNCTIONS
// ─────────────────────────────────────────────

export async function readKnowledge(userId: string): Promise<KnowledgeData> {
  const coll = await getKnowledgeCollection();
  const doc = await coll.findOne({ userId });
  if (!doc) return {};
  const { _id, ...rest } = doc as any;
  return rest;
}

export async function writeKnowledge(userId: string, updates: Partial<KnowledgeData>): Promise<void> {
  const coll = await getKnowledgeCollection();
  await coll.updateOne({ userId }, { $set: { ...updates, userId } }, { upsert: true });
}
