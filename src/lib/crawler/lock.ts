import { getDb } from '@/lib/db';

/**
 * One crawl at a time per user. Without this, two concurrent recrawls could each
 * activate a generation and the second's cleanup would delete the first's
 * staged chunks mid-publication. Locks expire so a crashed request cannot block
 * the user forever.
 */

const LOCK_TTL_MS = 3 * 60_000;
const DUPLICATE_KEY = 11000;

type CrawlLock = { _id: string; correlationId: string; expiresAt: Date };

async function locks() {
  const db = await getDb();
  return db.collection<CrawlLock>('crawl_locks');
}

export async function acquireCrawlLock(userId: string, correlationId: string, now = new Date()): Promise<boolean> {
  const coll = await locks();
  try {
    // Matches only a missing or expired lock; an active lock makes the upsert collide on _id.
    await coll.updateOne(
      { _id: userId, expiresAt: { $lte: now } },
      { $set: { correlationId, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if ((err as { code?: number })?.code === DUPLICATE_KEY) return false;
    throw err;
  }
}

export async function releaseCrawlLock(userId: string, correlationId: string): Promise<void> {
  const coll = await locks();
  await coll.deleteOne({ _id: userId, correlationId });
}
