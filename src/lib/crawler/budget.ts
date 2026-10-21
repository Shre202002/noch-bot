import { PLAN_LIMITS } from '@/lib/ratelimit';
import type { CrawlBudget } from './types';

/** Absolute ceiling for any plan; the crawler service enforces the same value. */
export const CRAWL_PAGE_HARD_MAX = 50;
export const CRAWL_MAX_DEPTH = 3;
/** Slow sites get up to 35 s of crawling; see maxDuration in src/app/api/crawl/route.ts. */
export const CRAWL_TIMEOUT_SECONDS = 35;
export const CRAWL_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type Plan = keyof typeof PLAN_LIMITS;

export function normalizePlan(plan: string | undefined): Plan {
  return plan && plan in PLAN_LIMITS ? (plan as Plan) : 'free';
}

/** Server-owned crawl budget for a plan. */
export function getCrawlBudget(plan: string | undefined): CrawlBudget {
  const pages = PLAN_LIMITS[normalizePlan(plan)].crawlPagesPerCrawl;
  return {
    maxPages: Math.min(pages, CRAWL_PAGE_HARD_MAX),
    maxDepth: CRAWL_MAX_DEPTH,
    timeoutSeconds: CRAWL_TIMEOUT_SECONDS,
    maxResponseBytes: CRAWL_MAX_RESPONSE_BYTES,
  };
}

/** Plans for which a page-cap notice should suggest upgrading. */
export function canUpgradeCrawlPages(plan: string | undefined): boolean {
  return normalizePlan(plan) !== 'pro';
}
