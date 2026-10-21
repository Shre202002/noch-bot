import { MAX_SITE_CHROME_CHARS } from './siteChrome';
import { CrawlSite } from './urlPolicy';
import {
  CrawlPolicyError,
  CrawlServiceUnavailableError,
  type CrawlBudget,
  type CrawledPage,
  type CrawlProvider,
  type CrawlResult,
} from './types';

/**
 * Server-only client for the private Scrapling crawler service (scraper/).
 * Never import this from client components: it reads CRAWLER_SERVICE_TOKEN.
 */

const PAGE_STATUSES = new Set(['fetched', 'skipped', 'blocked', 'failed']);
const MAX_MARKDOWN_CHARS = 20_000;
/** Extra time over the crawl budget for the service to finish and respond. */
const RESPONSE_GRACE_MS = 10_000;

export interface ScraplingProviderConfig {
  serviceUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

interface ServicePage {
  url: string;
  title?: string;
  markdown?: string;
  status: string;
  reason?: string | null;
  depth?: number;
}

interface ServiceResponse {
  version: number;
  pages: ServicePage[];
  deferred_count: number;
  cap_reached: boolean;
  time_budget_reached: boolean;
  /** Header/footer text and contact links; older service versions leave it out. */
  site_chrome?: string;
}

export class ScraplingCrawlerProvider implements CrawlProvider {
  readonly name = 'scrapling' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: ScraplingProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async crawl(url: string, budget: CrawlBudget, correlationId: string): Promise<CrawlResult> {
    const response = await this.post(url, budget, correlationId);

    if (response.status === 422) {
      const body = (await response.json().catch(() => null)) as { error?: string; reason?: string } | null;
      // 422 is either a policy refusal or a request the service considers invalid (our bug, not the user's URL).
      if (body?.error === 'policy') throw new CrawlPolicyError(body.reason || 'blocked_destination');
      throw new CrawlServiceUnavailableError('service_rejected_request');
    }
    if (!response.ok) {
      throw new CrawlServiceUnavailableError(`service_http_${response.status}`);
    }

    let body: ServiceResponse;
    try {
      body = (await response.json()) as ServiceResponse;
    } catch {
      throw new CrawlServiceUnavailableError('service_bad_response');
    }
    if (body?.version !== 1 || !Array.isArray(body.pages)) {
      throw new CrawlServiceUnavailableError('service_bad_response');
    }
    return normalizeServiceResponse(body, url, budget);
  }

  private async post(url: string, budget: CrawlBudget, correlationId: string): Promise<Response> {
    const endpoint = new URL('/v1/crawl', this.config.serviceUrl).href;
    const payload = JSON.stringify({
      url,
      max_pages: budget.maxPages,
      max_depth: budget.maxDepth,
      timeout_seconds: budget.timeoutSeconds,
      max_response_bytes: budget.maxResponseBytes,
      correlation_id: correlationId,
    });

    // One quick retry for connection-level failures; timeouts are not retried
    // because the crawl budget is already spent.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.token}` },
          body: payload,
          signal: AbortSignal.timeout(budget.timeoutSeconds * 1000 + RESPONSE_GRACE_MS),
          cache: 'no-store',
        });
      } catch (err) {
        const name = (err as Error)?.name;
        if (name === 'TimeoutError' || name === 'AbortError') {
          throw new CrawlServiceUnavailableError('service_timeout');
        }
        if (attempt === 1) throw new CrawlServiceUnavailableError('service_unreachable');
      }
    }
    throw new CrawlServiceUnavailableError('service_unreachable');
  }
}

/** Trust nothing from the service: re-check the site, cap counts and sizes, and drop unknown fields. */
export function normalizeServiceResponse(body: ServiceResponse, url: string, budget: CrawlBudget): CrawlResult {
  const site = CrawlSite.forUrl(url);
  const pages: CrawledPage[] = [];
  // Same rule as the service: only fetched pages count toward maxPages; total fetches are capped at 2x.
  let fetched = 0;
  let attempted = 0;

  for (const raw of body.pages) {
    if (!raw || typeof raw.url !== 'string' || !PAGE_STATUSES.has(raw.status)) continue;
    if (!site.contains(raw.url)) continue;

    const isRobotsSkip = raw.status === 'skipped' && raw.reason === 'robots_denied';
    if (!isRobotsSkip) {
      if (attempted >= budget.maxPages * 2) continue;
      if (raw.status === 'fetched') {
        if (fetched >= budget.maxPages) continue;
        fetched++;
      }
      attempted++;
    }

    pages.push({
      url: raw.url,
      title: String(raw.title ?? '').slice(0, 300),
      markdown: raw.status === 'fetched' ? String(raw.markdown ?? '').slice(0, MAX_MARKDOWN_CHARS) : '',
      status: raw.status as CrawledPage['status'],
      reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 64) : null,
      depth: Number.isFinite(raw.depth) ? Number(raw.depth) : 0,
    });
  }

  return {
    provider: 'scrapling',
    pages,
    deferredCount: Math.max(0, Number(body.deferred_count) || 0),
    capReached: Boolean(body.cap_reached),
    timeBudgetReached: Boolean(body.time_budget_reached),
    siteChrome: typeof body.site_chrome === 'string' ? body.site_chrome.slice(0, MAX_SITE_CHROME_CHARS) : '',
  };
}
