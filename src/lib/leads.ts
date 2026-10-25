import { getDb } from '@/lib/db';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let indexReady: Promise<unknown> | null = null;

/** Stores a lead once per email; a repeat sign-up is a no-op. Returns true when it was new. */
export async function saveLead(input: { email: string; source: string }): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  const db = await getDb();
  const col = db.collection('leads');
  indexReady ??= col.createIndex({ email: 1 }, { unique: true }).catch((err) => {
    indexReady = null;
    throw err;
  });
  await indexReady;
  const res = await col.updateOne(
    { email },
    { $setOnInsert: { email, source: input.source.slice(0, 200), created_at: new Date() } },
    { upsert: true },
  );
  return res.upsertedCount === 1;
}
