import { getDb } from './db';

export interface ChatSession {
  sessionId: string;
  slug: string;
  fileId: string;
  userId: string;        // owner of the PDF
  label: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  // Basic visitor info for analytics
  userAgent?: string;
  ip?: string;
}

export interface ChatMessage {
  sessionId: string;
  slug: string;
  fileId: string;
  ownerId: string;       // PDF owner's userId
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  // For analytics
  tokenEstimate: number; // rough estimate of tokens
}

/** Get or create a session */
export async function getOrCreateSession(
  sessionId: string,
  slug: string,
  fileId: string,
  userId: string,
  label: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.collection('chat_sessions').updateOne(
    { sessionId },
    {
      $setOnInsert: {
        sessionId,
        slug,
        fileId,
        userId,
        label,
        createdAt: now,
        userAgent: meta?.userAgent || '',
        ip: meta?.ip || '',
        messageCount: 0,
      },
      $set: { lastActiveAt: now },
    },
    { upsert: true }
  );
}

/** Save a single message + increment session counter */
export async function saveMessage(msg: Omit<ChatMessage, 'tokenEstimate'> & { tokenEstimate?: number }): Promise<void> {
  const db = await getDb();

  // Rough token estimate: ~4 chars per token
  const tokenEstimate = msg.tokenEstimate ?? Math.ceil(msg.content.length / 4);

  await db.collection('chat_messages').insertOne({
    ...msg,
    tokenEstimate,
  });

  // Increment message count on session
  await db.collection('chat_sessions').updateOne(
    { sessionId: msg.sessionId },
    {
      $inc: { messageCount: 1 },
      $set: { lastActiveAt: msg.createdAt },
    }
  );
}