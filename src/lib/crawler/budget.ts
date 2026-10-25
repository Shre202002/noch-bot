import { FREE_PLAN_KEY, hasHigherPlan, planExists, planLimits } from '@/lib/plans';
import type { CrawlBudget } from './types';

/** Absolute ceiling for any plan; the crawler service enforces the same value. */
export const CRAWL_PAGE_HARD_MAX = 50;
export const CRAWL_MAX_DEPTH = 3;
/** Slow sites get up to 35 s of crawling; see maxDuration in src/app/api/crawl/route.ts. */
export const CRAWL_TIMEOUT_SECONDS = 35;
export const CRAWL_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function normalizePlan(plan: string | undefined): string {
  return plan && planExists(plan) ? plan : FREE_PLAN_KEY;
}

/** Server-owned crawl budget for a plan. Callers should `await loadPlans()` first. */
export function getCrawlBudget(plan: string | undefined): CrawlBudget {
  const pages = planLimits(normalizePlan(plan)).crawlPagesPerCrawl;
  return {
    maxPages: Math.min(pages, CRAWL_PAGE_HARD_MAX),
    maxDepth: CRAWL_MAX_DEPTH,
    timeoutSeconds: CRAWL_TIMEOUT_SECONDS,
    maxResponseBytes: CRAWL_MAX_RESPONSE_BYTES,
  };
}

/** Plans for which a page-cap notice should suggest upgrading. */
export function canUpgradeCrawlPages(plan: string | undefined): boolean {
  return hasHigherPlan(normalizePlan(plan));
}
