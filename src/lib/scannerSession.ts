import { NextRequest, NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { getDb } from './db';
import {
  ensureScannerIndexes,
  findActiveScannerLink,
  scannerCookieName,
  SCANNER_AUTH_MESSAGES,
  SCANNER_THROTTLE_COLLECTION,
  verifyScannerSession,
  type ScannerLink,
} from './scannerLinkAuth';
import type { BaseLinkUser } from './linkAuthCore';

export const SCANNER_LINK_UNAVAILABLE = "This scanner link isn't available.";

/** The active link for a slug, or the 404 to return. */
export async function requireScannerLink(slug: string): Promise<{ db: Db; link: ScannerLink } | NextResponse> {
  const db = await getDb();
  await ensureScannerIndexes(db);
  const link = await findActiveScannerLink(db, slug);
  if (!link) return NextResponse.json({ error: SCANNER_LINK_UNAVAILABLE }, { status: 404 });
  return { db, link };
}

/** The signed-in, approved scanner account for a request, or the 401/403 to return. */
export async function requireScannerSession(
  req: NextRequest,
  slug: string
): Promise<{ db: Db; link: ScannerLink; user: BaseLinkUser } | NextResponse> {
  // The link and the account are looked up together: one wait for the database instead of two.
  const db = await getDb();
  await ensureScannerIndexes(db);
  const [link, session] = await Promise.all([
    findActiveScannerLink(db, slug),
    verifyScannerSession(db, slug, req.cookies.get(scannerCookieName(slug))?.value),
  ]);
  if (!link) return NextResponse.json({ error: SCANNER_LINK_UNAVAILABLE }, { status: 404 });
  const found = { db, link };
  if ('error' in session) {
    return NextResponse.json(
      { signedIn: false, code: session.error, error: SCANNER_AUTH_MESSAGES[session.error] },
      { status: session.error === 'none' || session.error === 'replaced' ? 401 : 403 }
    );
  }
  return { ...found, user: session.user };
}

/** The caller's address as the hosting platform reports it, or "unknown". Used only to count attempts, never to trust anyone. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

/**
 * Counts one attempt against `key` in a fixed time window and says whether it is still allowed. Counters live in the
 * database (so every server instance shares them) and expire on their own.
 */
export async function allowAttempt(db: Db, key: string, limit: number, windowMs: number, now: Date = new Date()): Promise<boolean> {
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
  const id = `${key}:${windowStart}`;
  const update = { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date(windowStart + windowMs * 2) } };
  const collection = db.collection<{ _id: string; count: number; expireAt: Date }>(SCANNER_THROTTLE_COLLECTION);
  try {
    const doc = await collection.findOneAndUpdate({ _id: id }, update, { upsert: true, returnDocument: 'after' });
    return (doc?.count ?? 1) <= limit;
  } catch (err) {
    // Two first attempts at the same instant can both try to create the counter: the loser just counts on the winner's.
    if ((err as { code?: number }).code === 11000) {
      const doc = await collection.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { returnDocument: 'after' });
      return (doc?.count ?? 1) <= limit;
    }
    throw err;
  }
}

/** Whether `key` has already used up its `limit` in the current window. Reads only; nothing is counted. */
export async function isThrottled(db: Db, key: string, limit: number, windowMs: number, now: Date = new Date()): Promise<boolean> {
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
  const doc = await db.collection<{ _id: string; count: number }>(SCANNER_THROTTLE_COLLECTION).findOne({ _id: `${key}:${windowStart}` });
  return (doc?.count ?? 0) >= limit;
}

/** Sign-in and sign-up limits: per address on one link, and per account, over ten minutes. */
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS_PER_ADDRESS = 30;
export const MAX_ATTEMPTS_PER_ACCOUNT = 8;
