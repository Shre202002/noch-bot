// import { getDb } from './db';
// import { Collection } from 'mongodb';

// export type Account = {
//   id: string; // uuid v4
//   email: string;
//   passwordHash: string; // bcrypt, empty string for OAuth users
//   createdAt: string; // ISO 8601
//   plan: 'free' | 'starter' | 'pro';
//   crawlCount: number;
//   googleId?: string;
//   name?: string;
//   avatar?: string;
//   resetToken?: string;
//   resetTokenExpiry?: string;
//   otpHash?: string;        // bcrypt hash of the 6-digit OTP
//   otpExpiry?: string;      // ISO string — 5 minutes from generation
//   otpEmail?: string;       // email this OTP was sent to (safety check)
// };

// export type Knowledge = {
//   userId: string;
//   url?: string;
//   crawledAt?: string;
//   systemPrompt?: string;
//   botName?: string;
//   botIcon?: string;
//   botColor?: string;
//   theme?: string;
//   content?: string; // first 3000 chars fallback
//   chunkCount?: number;
// };

// async function getUsersCollection(): Promise<Collection<Account>> {
//   const db = await getDb();
//   return db.collection<Account>('users');
// }

// async function getKnowledgeCollection(): Promise<Collection<Knowledge>> {
//   const db = await getDb();
//   return db.collection<Knowledge>('knowledge');
// }

// export async function readAccounts(): Promise<Account[]> {
//   const coll = await getUsersCollection();
//   return coll.find({}).toArray();
// }

// export async function findAccount(email: string): Promise<Account | undefined> {
//   const coll = await getUsersCollection();
//   const account = await coll.findOne({ email });
//   return account || undefined;
// }

// export const findAccountByEmail = findAccount;

// export async function findAccountById(id: string): Promise<Account | undefined> {
//   const coll = await getUsersCollection();
//   const account = await coll.findOne({ id });
//   return account || undefined;
// }

// export async function findAccountByResetToken(token: string): Promise<Account | undefined> {
//   const coll = await getUsersCollection();
//   const account = await coll.findOne({ resetToken: token });
//   return account || undefined;
// }

// export async function writeAccount(account: Account): Promise<void> {
//   const coll = await getUsersCollection();
//   await coll.updateOne({ id: account.id }, { $set: account }, { upsert: true });
// }

// // Save hashed OTP against user
// export async function saveOtp(
//   email: string,
//   otpHash: string,
//   expiry: string
// ): Promise<void> {
//   const coll = await getUsersCollection();
//   await coll.updateOne(
//     { email },
//     { $set: { otpHash, otpExpiry: expiry, otpEmail: email } }
//   );
// }

// // Clear OTP fields after successful use
// export async function clearOtp(email: string): Promise<void> {
//   const coll = await getUsersCollection();
//   await coll.updateOne(
//     { email },
//     { $unset: { otpHash: '', otpExpiry: '', otpEmail: '' } }
//   );
// }

// // Update password hash
// export async function updatePassword(
//   email: string,
//   newPasswordHash: string
// ): Promise<void> {
//   const coll = await getUsersCollection();
//   await coll.updateOne(
//     { email },
//     { $set: { passwordHash: newPasswordHash } }
//   );
// }

// export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
//   const coll = await getUsersCollection();
//   await coll.updateOne({ id }, { $set: updates });
// }

// export async function deleteAccount(id: string): Promise<void> {
//   const coll = await getUsersCollection();
//   await coll.deleteOne({ id });
// }

// // --- Knowledge Base Functions ---

// export async function readKnowledge(userId: string): Promise<Knowledge | null> {
//   const coll = await getKnowledgeCollection();
//   return coll.findOne({ userId });
// }

// export async function writeKnowledge(userId: string, updates: Partial<Knowledge>): Promise<void> {
//   const coll = await getKnowledgeCollection();
//   await coll.updateOne(
//     { userId },
//     { $set: { ...updates, userId } },
//     { upsert: true }
//   );
// }








import { getDb } from "./db";
import { Collection } from "mongodb";

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

    status:
      | "active"
      | "cancelled"
      | "expired";

    currentPeriodEnd: string;
  };
};

export type ChatLog = {
  userId: string;

  messageCount: number;

  lastActive: string;
};

// ─────────────────────────────────────────────
// COLLECTION HELPERS
// ─────────────────────────────────────────────

async function getAccountsCollection(): Promise<
  Collection<Account>
> {
  const db = await getDb();

  return db.collection<Account>(
    "accounts"
  );
}

async function getKnowledgeCollection(): Promise<
  Collection<KnowledgeData>
> {
  const db = await getDb();

  return db.collection<KnowledgeData>(
    "knowledge"
  );
}

async function getChatLogsCollection(): Promise<
  Collection<ChatLog>
> {
  const db = await getDb();

  return db.collection<ChatLog>(
    "chatlogs"
  );
}

// ─────────────────────────────────────────────
// ACCOUNT FUNCTIONS
// ─────────────────────────────────────────────

export async function readAccounts(): Promise<
  Account[]
> {

  const coll =
    await getAccountsCollection();

  return coll.find({}).toArray();

}

export async function findAccount(
  email: string
): Promise<Account | undefined> {

  const coll =
    await getAccountsCollection();

  const account =
    await coll.findOne({ email });

  return account || undefined;

}

export const findAccountByEmail =
  findAccount;

export async function findAccountById(
  id: string
): Promise<Account | undefined> {

  const coll =
    await getAccountsCollection();

  const account =
    await coll.findOne({ id });

  return account || undefined;

}

export async function findAccountByResetToken(
  token: string
): Promise<Account | undefined> {

  const coll =
    await getAccountsCollection();

  const account =
    await coll.findOne({
      resetToken: token,
    });

  return account || undefined;

}

export async function writeAccount(
  account: Account
): Promise<void> {

  const coll =
    await getAccountsCollection();

  await coll.updateOne(
    { id: account.id },
    { $set: account },
    { upsert: true }
  );

}

export async function updateAccount(
  id: string,
  updates: Partial<Account>
): Promise<void> {

  const coll =
    await getAccountsCollection();

  await coll.updateOne(
    { id },
    { $set: updates }
  );

}

export async function deleteAccount(
  id: string
): Promise<void> {

  const coll =
    await getAccountsCollection();

  await coll.deleteOne({ id });

}

// ─────────────────────────────────────────────
// OTP + PASSWORD HELPERS
// ─────────────────────────────────────────────

export async function saveOtp(
  email: string,
  otpHash: string,
  expiry: string
): Promise<void> {

  const coll =
    await getAccountsCollection();

  await coll.updateOne(
    { email },
    {
      $set: {
        otpHash,
        otpExpiry: expiry,
        otpEmail: email,
      },
    }
  );

}

export async function clearOtp(
  email: string
): Promise<void> {

  const coll =
    await getAccountsCollection();

  await coll.updateOne(
    { email },
    {
      $unset: {
        otpHash: "",
        otpExpiry: "",
        otpEmail: "",
      },
    }
  );

}

export async function updatePassword(
  email: string,
  newPasswordHash: string
): Promise<void> {

  const coll =
    await getAccountsCollection();

  await coll.updateOne(
    { email },
    {
      $set: {
        passwordHash:
          newPasswordHash,
      },
    }
  );

}

// ─────────────────────────────────────────────
// PLAN LIMITS
// ─────────────────────────────────────────────

export const PLAN_LIMITS = {

  free: {
    messagesPerMonth: 100,
    websites: 1,
    removeBranding: false,
  },

  starter: {
    messagesPerMonth: 1000,
    websites: 1,
    removeBranding: true,
  },

  pro: {
    messagesPerMonth: 10000,
    websites: 5,
    removeBranding: true,
  },

};

// ─────────────────────────────────────────────
// KNOWLEDGE FUNCTIONS
// ─────────────────────────────────────────────

export async function readKnowledge(
  userId: string
): Promise<KnowledgeData> {

  const coll =
    await getKnowledgeCollection();

  const doc =
    await coll.findOne({ userId });

  if (!doc) {
    return {};
  }

  const {
    _id,
    ...rest
  } = doc as any;

  return rest;

}

export async function writeKnowledge(
  userId: string,
  updates: Partial<KnowledgeData>
): Promise<void> {

  const coll =
    await getKnowledgeCollection();

  await coll.updateOne(

    { userId },

    {
      $set: {
        ...updates,
        userId,
      },
    },

    { upsert: true }

  );

}

export async function deleteKnowledge(
  userId: string
): Promise<void> {

  const coll =
    await getKnowledgeCollection();

  await coll.deleteOne({ userId });

}

// ─────────────────────────────────────────────
// CHAT LOGS
// ─────────────────────────────────────────────

export async function readChatLogs(): Promise<
  Record<string, ChatLog>
> {

  const coll =
    await getChatLogsCollection();

  const logs =
    await coll.find({}).toArray();

  const result:
    Record<string, ChatLog> = {};

  logs.forEach((log) => {

    result[log.userId] = log;

  });

  return result;

}

export async function incrementMessageCount(
  userId: string
): Promise<void> {

  const coll =
    await getChatLogsCollection();

  await coll.updateOne(

    { userId },

    {
      $inc: {
        messageCount: 1,
      },

      $set: {
        lastActive:
          new Date().toISOString(),
      },

      $setOnInsert: {
        userId,
      },
    },

    { upsert: true }

  );

}