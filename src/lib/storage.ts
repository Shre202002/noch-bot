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
  otpHash?: string;        // bcrypt hash of the 6-digit OTP
  otpExpiry?: string;      // ISO string — 5 minutes from generation
  otpEmail?: string;       // email this OTP was sent to (safety check)
};

async function getUsersCollection(): Promise<Collection<Account>> {
  const db = await getDb();
  return db.collection<Account>('users');
}

export async function readAccounts(): Promise<Account[]> {
  const coll = await getUsersCollection();
  return coll.find({}).toArray();
}

export async function findAccount(email: string): Promise<Account | undefined> {
  const coll = await getUsersCollection();
  const account = await coll.findOne({ email });
  return account || undefined;
}

export const findAccountByEmail = findAccount;

export async function findAccountById(id: string): Promise<Account | undefined> {
  const coll = await getUsersCollection();
  const account = await coll.findOne({ id });
  return account || undefined;
}

export async function findAccountByResetToken(token: string): Promise<Account | undefined> {
  const coll = await getUsersCollection();
  const account = await coll.findOne({ resetToken: token });
  return account || undefined;
}

export async function writeAccount(account: Account): Promise<void> {
  const coll = await getUsersCollection();
  await coll.updateOne({ id: account.id }, { $set: account }, { upsert: true });
}

// Save hashed OTP against user
export async function saveOtp(
  email: string,
  otpHash: string,
  expiry: string
): Promise<void> {
  const coll = await getUsersCollection();
  await coll.updateOne(
    { email },
    { $set: { otpHash, otpExpiry: expiry, otpEmail: email } }
  );
}

// Clear OTP fields after successful use
export async function clearOtp(email: string): Promise<void> {
  const coll = await getUsersCollection();
  await coll.updateOne(
    { email },
    { $unset: { otpHash: '', otpExpiry: '', otpEmail: '' } }
  );
}

// Update password hash
export async function updatePassword(
  email: string,
  newPasswordHash: string
): Promise<void> {
  const coll = await getUsersCollection();
  await coll.updateOne(
    { email },
    { $set: { passwordHash: newPasswordHash } }
  );
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  const coll = await getUsersCollection();
  await coll.updateOne({ id }, { $set: updates });
}

export async function deleteAccount(id: string): Promise<void> {
  const coll = await getUsersCollection();
  await coll.deleteOne({ id });
}
