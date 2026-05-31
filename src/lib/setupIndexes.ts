// Optional: src/lib/setupIndexes.ts — run once
import { getDb } from './db';

export async function setupIndexes() {
  const db = await getDb();

  await db.collection('chat_sessions').createIndexes([
    { key: { sessionId: 1 }, unique: true },
    { key: { slug: 1 } },
    { key: { fileId: 1 } },
    { key: { userId: 1 } },
    { key: { createdAt: -1 } },
  ]);

  await db.collection('chat_messages').createIndexes([
    { key: { sessionId: 1 } },
    { key: { slug: 1 } },
    { key: { fileId: 1 } },
    { key: { ownerId: 1 } },
    { key: { createdAt: -1 } },
  ]);

  console.log('Indexes created');
}