import { getDb } from '@/lib/db';

/**
 * Plans live in the `plans` collection and are edited from the admin panel. This module is the single source of
 * truth for what a plan allows.
 *
 * Limit lookups used by synchronous helpers (additionLimitFor, getCrawlBudget, pdfLimitFor) read an in-memory
 * snapshot. Request handlers call `await loadPlans()` first so the snapshot is fresh; if the database cannot be
 * reached the built-in defaults below keep the product working with the original limits.
 */

export const PLANS_COLLECTION = 'plans';
export const FREE_PLAN_KEY = 'free';

export type PlanLimits = {
  messagesPerMonth: number;
  crawlsPerMonth: number;
  /** Capped again by CRAWL_PAGE_HARD_MAX in src/lib/crawler/budget.ts. */
  crawlPagesPerCrawl: number;
  /** Documents held at once. null means unlimited. */
  pdfDocuments: number | null;
  /** Extra files per document ("Add more data"). */
  additionalFiles: number;
};

export type Plan = {
  key: string;
  name: string;
  /** Prices in the smallest display unit of `currency` (rupees, not paise). */
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  active: boolean;
  highlight: boolean;
  sortOrder: number;
  features: string[];
  limits: PlanLimits;
};

export const DEFAULT_PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'INR',
    active: true,
    highlight: false,
    sortOrder: 0,
    features: ['100 messages / month', '1 website crawl', '15 pages per crawl', '1 document'],
    limits: { messagesPerMonth: 100, crawlsPerMonth: 1, crawlPagesPerCrawl: 15, pdfDocuments: 1, additionalFiles: 1 },
  },
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 499,
    priceYearly: 4990,
    currency: 'INR',
    active: true,
    highlight: false,
    sortOrder: 1,
    features: ['5,000 messages / month', '10 website crawls', '30 pages per crawl', '10 documents'],
    limits: { messagesPerMonth: 5000, crawlsPerMonth: 10, crawlPagesPerCrawl: 30, pdfDocuments: 10, additionalFiles: 3 },
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 1499,
    priceYearly: 14990,
    currency: 'INR',
    active: true,
    highlight: true,
    sortOrder: 2,
    features: ['50,000 messages / month', 'Unlimited website crawls', '50 pages per crawl', 'Unlimited documents'],
    limits: { messagesPerMonth: 50000, crawlsPerMonth: 999, crawlPagesPerCrawl: 50, pdfDocuments: null, additionalFiles: 5 },
  },
];

const CACHE_TTL_MS = 30_000;

let snapshot = new Map<string, Plan>(DEFAULT_PLANS.map((p) => [p.key, p]));
let loadedAt = 0;
let inflight: Promise<void> | null = null;

function setSnapshot(plans: Plan[]) {
  snapshot = new Map(plans.map((p) => [p.key, p]));
  loadedAt = Date.now();
}

/** Forget the snapshot so the next loadPlans() reads the database. Call after any plan write. */
export function invalidatePlans() {
  loadedAt = 0;
}

async function seedAndRead(): Promise<Plan[]> {
  const db = await getDb();
  const coll = db.collection<Plan>(PLANS_COLLECTION);
  // Insert only the plans that are missing, so admin edits are never overwritten.
  await Promise.all(
    DEFAULT_PLANS.map((p) => coll.updateOne({ key: p.key }, { $setOnInsert: p }, { upsert: true })),
  );
  return coll.find({}, { projection: { _id: 0 } }).sort({ sortOrder: 1 }).toArray() as Promise<Plan[]>;
}

/** Refreshes the plan snapshot when it is older than 30 seconds. Never throws. */
export async function loadPlans(): Promise<void> {
  if (Date.now() - loadedAt < CACHE_TTL_MS) return;
  if (!inflight) {
    inflight = seedAndRead()
      .then((plans) => setSnapshot(plans.length ? plans : DEFAULT_PLANS))
      .catch((error) => {
        console.error('[plans] load failed, keeping previous plans', error);
        // Back off briefly so a database outage is not retried on every request.
        loadedAt = Date.now() - CACHE_TTL_MS + 5_000;
      })
      .finally(() => {
        inflight = null;
      });
  }
  await inflight;
}

export async function getPlans(options: { includeInactive?: boolean } = {}): Promise<Plan[]> {
  await loadPlans();
  const all = [...snapshot.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  return options.includeInactive ? all : all.filter((p) => p.active);
}

export function getPlanSync(key: string | undefined): Plan {
  return (key && snapshot.get(key)) || snapshot.get(FREE_PLAN_KEY) || DEFAULT_PLANS[0];
}

export function planExists(key: string | undefined): boolean {
  return !!key && snapshot.has(key);
}

export function planLimits(key: string | undefined): PlanLimits {
  return getPlanSync(key).limits;
}

/** Documents a plan may hold at once; Infinity when unlimited. */
export function pdfLimitFor(key: string | undefined): number {
  return planLimits(key).pdfDocuments ?? Infinity;
}

/** True when an active plan ranks above `key`, i.e. the upgrade prompt still makes sense. */
export function hasHigherPlan(key: string | undefined): boolean {
  const current = getPlanSync(key);
  return [...snapshot.values()].some((p) => p.active && p.sortOrder > current.sortOrder);
}

type PlanHolder = { plan?: string; planExpiresAt?: string } | null | undefined;

/** The plan an account is on right now: an expired or unknown plan falls back to free. */
export function effectivePlanKey(account: PlanHolder, now: number = Date.now()): string {
  if (!account?.plan || !snapshot.has(account.plan)) return FREE_PLAN_KEY;
  if (account.planExpiresAt) {
    const expires = Date.parse(account.planExpiresAt);
    if (!Number.isNaN(expires) && expires <= now) return FREE_PLAN_KEY;
  }
  return account.plan;
}

/** Loads the plan snapshot, then returns the account's effective plan key. Use this in request handlers. */
export async function resolvePlanKey(account: PlanHolder): Promise<string> {
  await loadPlans();
  return effectivePlanKey(account);
}

/** Validates admin input and returns the cleaned plan, or an error message. */
export function validatePlanInput(input: any, existingKey?: string): { plan: Plan } | { error: string } {
  const key = (existingKey ?? String(input?.key ?? '')).trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(key)) {
    return { error: 'Plan key must be 2-32 characters: lowercase letters, numbers, - or _' };
  }
  const name = String(input?.name ?? '').trim().slice(0, 60);
  if (!name) return { error: 'Plan name is required' };

  const num = (value: unknown, label: string, min = 0): number | string => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min) return `${label} must be a number of at least ${min}`;
    return Math.floor(n);
  };

  const lim = input?.limits ?? {};
  const checks = {
    priceMonthly: num(input?.priceMonthly ?? 0, 'Monthly price'),
    priceYearly: num(input?.priceYearly ?? 0, 'Yearly price'),
    messagesPerMonth: num(lim.messagesPerMonth, 'Messages per month'),
    crawlsPerMonth: num(lim.crawlsPerMonth, 'Crawls per month'),
    crawlPagesPerCrawl: num(lim.crawlPagesPerCrawl, 'Pages per crawl', 1),
    additionalFiles: num(lim.additionalFiles, 'Additional files'),
  };
  for (const value of Object.values(checks)) if (typeof value === 'string') return { error: value };

  let pdfDocuments: number | null = null;
  if (lim.pdfDocuments !== null && lim.pdfDocuments !== undefined && lim.pdfDocuments !== '') {
    const n = num(lim.pdfDocuments, 'Documents');
    if (typeof n === 'string') return { error: n };
    pdfDocuments = n;
  }

  const features = Array.isArray(input?.features)
    ? input.features.map((f: unknown) => String(f).trim().slice(0, 120)).filter(Boolean).slice(0, 20)
    : [];

  return {
    plan: {
      key,
      name,
      priceMonthly: checks.priceMonthly as number,
      priceYearly: checks.priceYearly as number,
      currency: String(input?.currency ?? 'INR').trim().toUpperCase().slice(0, 3) || 'INR',
      active: input?.active !== false,
      highlight: input?.highlight === true,
      sortOrder: Number.isFinite(Number(input?.sortOrder)) ? Math.floor(Number(input.sortOrder)) : 0,
      features,
      limits: {
        messagesPerMonth: checks.messagesPerMonth as number,
        crawlsPerMonth: checks.crawlsPerMonth as number,
        crawlPagesPerCrawl: checks.crawlPagesPerCrawl as number,
        pdfDocuments,
        additionalFiles: checks.additionalFiles as number,
      },
    },
  };
}
