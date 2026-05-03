
import { getDb } from './db';
import { Collection } from 'mongodb';

export type Account = {
  id: string; // uuid v4
  email: string;
  passwordHash: string; // bcrypt, empty string for OAuth users
  createdAt: string; // ISO 8601
  plan: 'free' | 'starter' | 'pro';
  crawlCount: number;
  googleId?: string;
  name?: string;
  avatar?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
};

async function getAccountsCollection(): Promise<Collection<Account>> {
  const db = await getDb();
  return db.collection<Account>('accounts');
}

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

export async function writeAccount(account: Account): Promise<void> {
  const coll = await getAccountsCollection();
  await coll.updateOne({ id: account.id }, { $set: account }, { upsert: true });
}

export async function writeAccounts(accounts: Account[]): Promise<void> {
  const coll = await getAccountsCollection();
  const operations = accounts.map((account) => ({
    updateOne: {
      filter: { id: account.id },
      update: { $set: account },
      upsert: true,
    },
  }));
  if (operations.length > 0) {
    await coll.bulkWrite(operations);
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const coll = await getAccountsCollection();
  await coll.deleteOne({ id });
}
