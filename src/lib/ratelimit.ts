import { getDb } from '@/lib/db';

// ── Plan limits ───────────────────────────────────────────────────
// crawlPagesPerCrawl is capped again by CRAWL_PAGE_HARD_MAX in src/lib/crawler/budget.ts.
export const PLAN_LIMITS = {
  free:    { messagesPerMonth: 100,   crawlsPerMonth: 1,   crawlPagesPerCrawl: 15 },
  starter: { messagesPerMonth: 5000,  crawlsPerMonth: 10,  crawlPagesPerCrawl: 30 },
  pro:     { messagesPerMonth: 50000, crawlsPerMonth: 999, crawlPagesPerCrawl: 50 },
} as const;

type Plan = keyof typeof PLAN_LIMITS;

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
  const userPlan = (plan as Plan) in PLAN_LIMITS ? (plan as Plan) : 'free';
  const limit = PLAN_LIMITS[userPlan].messagesPerMonth;
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
  const userPlan = (plan as Plan) in PLAN_LIMITS ? (plan as Plan) : 'free';
  const limit = PLAN_LIMITS[userPlan].crawlsPerMonth;
  const used = await getMonthlyCrawlCount(userId);

  return {
    allowed: used < limit,
    used,
    limit,
  };
}