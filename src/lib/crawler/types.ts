/**
 * Shared crawler contract. Both crawler providers (the Scrapling service and the
 * temporary legacy crawler) return this shape, and the publisher consumes it.
 */

/** Outcome of one page as returned by a crawler provider. */
export type CrawledPageStatus = 'fetched' | 'skipped' | 'blocked' | 'failed';

/** Outcome shown to the dashboard after publication. */
export type CrawlPageOutcome = CrawledPageStatus | 'indexed';

export type CrawlProviderName = 'scrapling' | 'legacy';

/** Server-owned limits. Users can never raise these. */
export interface CrawlBudget {
  maxPages: number;
  maxDepth: number;
  timeoutSeconds: number;
  maxResponseBytes: number;
}

export interface CrawledPage {
  /** Redacted URL (no query string or fragment). */
  url: string;
  title: string;
  markdown: string;
  status: CrawledPageStatus;
  /** Safe, stable reason code for non-fetched pages. */
  reason: string | null;
  depth: number;
}

export interface CrawlResult {
  provider: CrawlProviderName;
  pages: CrawledPage[];
  /** Candidates found but not attempted because of the page cap or time budget. */
  deferredCount: number;
  capReached: boolean;
  timeBudgetReached: boolean;
  /**
   * The site's header, top bar and footer text plus its phone/email/social links, taken once from the first usable
   * page. Published as its own chunk and never counted as a page.
   */
  siteChrome?: string;
}

export interface CrawlProvider {
  name: CrawlProviderName;
  crawl(url: string, budget: CrawlBudget, correlationId: string): Promise<CrawlResult>;
}

/** The submitted URL or its destination is not allowed. Never triggers a fallback. */
export class CrawlPolicyError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CrawlPolicyError';
  }
}

/** The crawler service could not be reached or failed server-side. Triggers the legacy fallback. */
export class CrawlServiceUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CrawlServiceUnavailableError';
  }
}
