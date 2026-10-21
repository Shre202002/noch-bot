import { LegacyCrawlerProvider } from './legacyProvider';
import { ScraplingCrawlerProvider } from './scraplingProvider';
import { CrawlServiceUnavailableError, type CrawlBudget, type CrawlProvider, type CrawlResult } from './types';

export interface CrawlRun {
  result: CrawlResult;
  /** True when Scrapling was unavailable and the legacy crawler handled the crawl (D-10). */
  fallbackUsed: boolean;
}

export interface CrawlProviders {
  primary: CrawlProvider;
  fallback: CrawlProvider | null;
}

/**
 * Provider selection from server-only configuration:
 * - CRAWLER_PROVIDER=legacy forces the legacy crawler.
 * - CRAWLER_PROVIDER=scrapling requires CRAWLER_SERVICE_URL and CRAWLER_SERVICE_TOKEN.
 * - Unset: Scrapling when the service is configured, otherwise legacy (local development).
 */
export function getCrawlProviders(env: NodeJS.ProcessEnv = process.env): CrawlProviders {
  const mode = (env.CRAWLER_PROVIDER || '').toLowerCase();
  const serviceUrl = env.CRAWLER_SERVICE_URL;
  const token = env.CRAWLER_SERVICE_TOKEN;
  const legacy = new LegacyCrawlerProvider();

  if (mode === 'legacy') return { primary: legacy, fallback: null };

  if (serviceUrl && token) {
    return { primary: new ScraplingCrawlerProvider({ serviceUrl, token }), fallback: legacy };
  }
  if (mode === 'scrapling') {
    throw new Error('CRAWLER_PROVIDER=scrapling requires CRAWLER_SERVICE_URL and CRAWLER_SERVICE_TOKEN');
  }
  console.warn('[crawl] CRAWLER_SERVICE_URL/CRAWLER_SERVICE_TOKEN not set; using the legacy crawler');
  return { primary: legacy, fallback: null };
}

/**
 * Run the crawl. Only service-level failures fall back to the legacy crawler;
 * policy refusals and every crawl outcome the service returns are final (D-11).
 */
export async function runCrawl(
  url: string,
  budget: CrawlBudget,
  correlationId: string,
  providers: CrawlProviders = getCrawlProviders(),
): Promise<CrawlRun> {
  try {
    return { result: await providers.primary.crawl(url, budget, correlationId), fallbackUsed: false };
  } catch (err) {
    if (!(err instanceof CrawlServiceUnavailableError) || !providers.fallback) throw err;
    console.warn(`[crawl] cid=${correlationId} ${providers.primary.name} unavailable (${err.reason}); using ${providers.fallback.name}`);
    return { result: await providers.fallback.crawl(url, budget, correlationId), fallbackUsed: true };
  }
}

export * from './types';
