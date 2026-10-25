import { getDb } from '@/lib/db';
import { loadPlans, planLimits } from '@/lib/plans';

// Plan limits are edited in the admin panel and live in src/lib/plans.ts.

// ── Get current month's message count from messages collection ────
export async function getMonthlyMessageCount(userId: string): Promise<number> {
  const db = await getDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await db.collection('messages').countDocuments({
    userId,
    role: 'user', // count only user messages (= 1 per conversation turn)
    createdAt: { $gte: monthStart },
  });

  return result;
}

// ── Get current month's crawl count from knowledge collection ─────
export async function getMonthlyCrawlCount(userId: string): Promise<number> {
  const db = await getDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Counted from crawl_logs. Re-crawls of the site the account already has don't count toward the limit.
  const result = await db.collection('crawl_logs').countDocuments({
    userId,
    createdAt: { $gte: monthStart },
    recrawl: { $ne: true },
  });

  return result;
}

// ── Log a crawl ───────────────────────────────────────────────────
/**
 * True when two URLs are the same website: same hostname, ignoring case and a leading "www.". A re-crawl of the
 * account's current site is not counted toward the monthly crawl limit.
 */
export function sameSite(a: string | null | undefined, b: string | null | undefined): boolean {
  const host = (value: string | null | undefined) => {
    try { return new URL(value ?? '').hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
  };
  const ha = host(a);
  return ha !== null && ha !== '' && ha === host(b);
}

export async function logCrawl(userId: string, url: string, options: { recrawl?: boolean } = {}): Promise<void> {
  const db = await getDb();
  await db.collection('crawl_logs').insertOne({
    userId,
    url,
    recrawl: options.recrawl === true,
    createdAt: new Date(),
  });
}

// ── Check if user can send a message ─────────────────────────────
export async function checkMessageLimit(
  userId: string,
  plan: string
): Promise<{ allowed: boolean; used: number; limit: number; resetDate: string }> {
  await loadPlans();
  const limit = planLimits(plan).messagesPerMonth;
  const used = await getMonthlyMessageCount(userId);

  // Reset date = 1st of next month
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString()
    .split('T')[0];

  return {
    allowed: used < limit,
    used,
    limit,
    resetDate,
  };
}

// ── Check if user can crawl ───────────────────────────────────────
export async function checkCrawlLimit(
  userId: string,
  plan: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  await loadPlans();
  const limit = planLimits(plan).crawlsPerMonth;
  const used = await getMonthlyCrawlCount(userId);

  return {
    allowed: used < limit,
    used,
    limit,
  };
}