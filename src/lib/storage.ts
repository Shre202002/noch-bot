
import { getDb } from './db';
import { Collection } from 'mongodb';

export type Account = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  crawlCount: number;
  googleId?: string;
  name?: string;
  avatar?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
  subscription?: {
    provider: 'razorpay' | 'stripe';
    subscriptionId: string;
    status: 'active' | 'cancelled' | 'expired';
    currentPeriodEnd: string;
  };
};

export type KnowledgeData = {
  userId: string;
  url: string;
  content: string;
  crawledAt: string;
  systemPrompt?: string;
  botName?: string;
  botIcon?: string;
  botColor?: string;
  theme?: {
    bubbleColor: string;
    headerColor: string;
    userMsgColor: string;
    sendBtnColor: string;
    accentColor: string;
  };
};

export type ChatLog = {
  userId: string;
  messageCount: number;
  lastActive: string;
  monthlyCount: { [month: string]: number };
};

async function getUsersCollection(): Promise<Collection<Account>> {
  const db = await getDb();
  return db.collection<Account>('users');
}

async function getKnowledgeCollection(): Promise<Collection<KnowledgeData>> {
  const db = await getDb();
  return db.collection<KnowledgeData>('knowledge');
}

async function getChatLogsCollection(): Promise<Collection<ChatLog>> {
  const db = await getDb();
  return db.collection<ChatLog>('chatlogs');
}

// ACCOUNTS
export async function findAccountByEmail(email: string): Promise<Account | null> {
  const coll = await getUsersCollection();
  return coll.findOne({ email });
}

export async function findAccountById(id: string): Promise<Account | null> {
  const coll = await getUsersCollection();
  return coll.findOne({ id });
}

export async function findAccountByGoogleId(googleId: string): Promise<Account | null> {
  const coll = await getUsersCollection();
  return coll.findOne({ googleId });
}

export async function writeAccount(account: Account): Promise<void> {
  const coll = await getUsersCollection();
  await coll.updateOne({ id: account.id }, { $set: account }, { upsert: true });
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  const coll = await getUsersCollection();
  await coll.updateOne({ id }, { $set: updates });
}

export async function deleteAccount(id: string): Promise<void> {
  const coll = await getUsersCollection();
  await coll.deleteOne({ id });
}

export async function getAllAccounts(): Promise<Account[]> {
  const coll = await getUsersCollection();
  return coll.find({}).sort({ createdAt: -1 }).toArray();
}

// KNOWLEDGE
export async function readKnowledge(userId: string): Promise<KnowledgeData | null> {
  const coll = await getKnowledgeCollection();
  return coll.findOne({ userId });
}

export async function writeKnowledge(userId: string, data: Partial<KnowledgeData>): Promise<void> {
  const coll = await getKnowledgeCollection();
  await coll.updateOne({ userId }, { $set: data }, { upsert: true });
}

export async function deleteKnowledge(userId: string): Promise<void> {
  const coll = await getKnowledgeCollection();
  await coll.deleteOne({ userId });
}

// CHATLOGS
export async function getChatLog(userId: string): Promise<ChatLog | null> {
  const coll = await getChatLogsCollection();
  return coll.findOne({ userId });
}

export async function incrementMessageCount(userId: string): Promise<void> {
  const coll = await getChatLogsCollection();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  
  await coll.updateOne(
    { userId },
    {
      $inc: { messageCount: 1, [`monthlyCount.${monthKey}`]: 1 },
      $set: { lastActive: now.toISOString() }
    },
    { upsert: true }
  );
}

export async function getMonthlyCount(userId: string): Promise<number> {
  const log = await getChatLog(userId);
  if (!log) return 0;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  return log.monthlyCount?.[monthKey] || 0;
}

export async function getAllChatLogs(): Promise<ChatLog[]> {
  const coll = await getChatLogsCollection();
  return coll.find({}).toArray();
}
