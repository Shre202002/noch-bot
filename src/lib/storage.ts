import { getDb } from "./db";
import { Collection, Db, ObjectId } from "mongodb";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type Theme = {
  bubbleColor: string;
  headerColor: string;
  userMsgColor: string;
  sendBtnColor: string;
  accentColor: string;
  /** Id of the chat icon (see lib/launcherIcons.ts); missing means the built-in robot. */
  launcherIcon?: string;
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
  /** Website crawl generation that chat retrieval searches. Set only after the generation is searchable. */
  activeGenerationId?: string;
  pagesIndexed?: number;
  lastCrawl?: CrawlAttemptSummary;
};

/** Most recent crawl attempt, successful or not. Failures never change the active knowledge fields. */
export type CrawlAttemptSummary = {
  status: "succeeded" | "failed";
  at: string;
  correlationId: string;
  /** Redacted (no query string) submitted URL. */
  url: string;
  provider: "scrapling" | "legacy" | null;
  fallbackUsed: boolean;
  pagesIndexed: number;
  chunks: number;
  reason?: string;
};

export type Account = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  /** Key of a plan in the `plans` collection (src/lib/plans.ts). */
  plan: string;
  crawlCount: number;
  googleId?: string;
  name?: string;
  avatar?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
  otpHash?: string;
  otpExpiry?: string;
  otpEmail?: string;
  notificationsSeenAt?: string;
  /**
   * Email/password signups start as `false` and must confirm a code before they can set up a bot.
   * Absent on accounts that predate verification (allowed); Google sign-ins are stored as `true`.
   */
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  emailOtpHash?: string;
  emailOtpExpiry?: string;
  emailOtpSentAt?: string;
  emailOtpAttempts?: number;
  /** Platform operator role. Granted in the DB or by SUPER_ADMIN_EMAILS (src/lib/superAdmin.ts). */
  role?: "superadmin";
  /** Deactivated accounts cannot sign in and their existing sessions stop working. */
  disabled?: boolean;
  disabledReason?: string;
  disabledAt?: string;
  /** When set and in the past, the account falls back to the free plan. */
  planExpiresAt?: string;
  planSource?: "admin" | "payment" | "default";
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
  await ensureCoreIndexes(db);
  return db.collection<Account>("accounts");
}

async function getKnowledgeCollection(): Promise<Collection<KnowledgeData>> {
  const db = await getDb();
  return db.collection<KnowledgeData>("knowledge");
}

// Index creation is a round trip each; run once per process per DB, not per request.
let indexesReady: Promise<void> | null = null;
let indexesDbKey = "";

async function ensureCoreIndexes(db: Db): Promise<void> {
  if (indexesDbKey !== db.databaseName) {
    indexesDbKey = db.databaseName;
    indexesReady = null;
  }
  indexesReady ??= (async () => {
    const analytics = db.collection("analytics_events");
    await Promise.all([
      analytics.createIndex({ userId: 1 }),
      analytics.createIndex({ event: 1 }),
      analytics.createIndex({ createdAt: 1 }),
      analytics.createIndex({ sessionId: 1 }),
      analytics.createIndex({ visitorId: 1 }),
      db.collection("accounts").createIndex({ id: 1 }),
      db.collection("accounts").createIndex({ email: 1 }),
      db.collection("knowledge").createIndex({ userId: 1 }),
      db.collection("messages").createIndex({ userId: 1, role: 1, createdAt: -1 }),
    ]);
  })().catch((err) => {
    indexesReady = null; // retry on next call
    console.error("[storage] ensureCoreIndexes failed", err);
  });
  return indexesReady;
}

async function getAnalyticsCollection(): Promise<Collection<AnalyticsEvent>> {
  const db = await getDb();
  await ensureCoreIndexes(db);
  return db.collection<AnalyticsEvent>("analytics_events");
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
