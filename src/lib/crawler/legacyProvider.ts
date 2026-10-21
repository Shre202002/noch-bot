import { createHash } from 'node:crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { LookupOptions } from 'node:dns';
import { ALLOW_ALL, DISALLOW_ALL, parseRobots, type RobotsPolicy } from './robots';
import { extractSiteChrome } from './siteChrome';
import { CrawlSite, parseCrawlUrl, redactUrl, resolveLink, safeLookup } from './urlPolicy';
import type { CrawlBudget, CrawledPage, CrawlProvider, CrawlResult } from './types';

/**
 * Temporary Axios/Cheerio crawler, used only when the Scrapling service is
 * unavailable (phase decision D-10). It applies the same URL policy, page
 * order, robots handling and budgets as scraper/nochbot_crawler/crawler.py.
 * Remove it after the Scrapling rollout is accepted (D-12).
 */

const USER_AGENT = 'NochBot/1.0 (+https://nochbot.com/bot)';
const ROBOTS_AGENT = 'NochBot';
const PER_PAGE_TIMEOUT_MS = 10_000;
const MIN_CONTENT_CHARS = 100;
const MAX_TEXT_CHARS = 20_000;
const MAX_REDIRECTS = 5;
const MAX_SITEMAP_URLS = 200;
const MAX_SITEMAP_FILES = 3;
const MAX_RECORDED_SKIPS = 30;
const DEFAULT_DELAY_MS = 250;
const MAX_DELAY_MS = 2000;
// Only pages with usable content count toward maxPages, so skipped pages are
// replaced by the next candidate. This caps total fetches at maxPages * 2.
const MAX_ATTEMPTS_FACTOR = 2;

const TIER_SEED = 0;
const TIER_NAV = 1;
const TIER_SITEMAP = 2;
const TIER_LINK = 3;

const RELEVANT_TERMS = [
  'about', 'service', 'product', 'pricing', 'price', 'plan', 'faq', 'help', 'support', 'contact',
  'feature', 'solution', 'event', 'ticket', 'team', 'company', 'doc', 'guide', 'how-it-works',
  'menu', 'location', 'booking', 'policy', 'shipping', 'return',
];
const SKIPPED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.json', '.xml',
  '.zip', '.gz', '.rar', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.woff', '.woff2', '.ttf', '.eot',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.exe', '.dmg', '.csv',
]);
const SKIPPED_PATH_PARTS =
  /\/(wp-admin|wp-login|wp-json|cdn-cgi|login|signin|sign-in|logout|cart|checkout|my-account|feed|tag|author)(\/|$)/i;

interface Candidate {
  tier: number;
  relevance: number;
  depth: number;
  seq: number;
  /** Canonical URL used for dedup. */
  key: string;
  /** URL actually requested. */
  url: string;
}

interface HttpResult {
  status: number;
  contentType: string;
  location: string | null;
  body: string;
}

export interface LegacyCrawlerOptions {
  /** Validates the seed URL; defaults to the production URL policy. */
  validate?: (url: string) => void;
  lookup?: (hostname: string, options: LookupOptions, callback: (...args: any[]) => void) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function relevanceScore(url: string, anchor = ''): number {
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {}
  const haystack = `${path} ${anchor}`.toLowerCase();
  return RELEVANT_TERMS.filter((term) => haystack.includes(term)).length;
}

function isCrawlablePath(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  const dot = path.lastIndexOf('.');
  if (dot > path.lastIndexOf('/') && SKIPPED_EXTENSIONS.has(path.slice(dot))) return false;
  return !SKIPPED_PATH_PARTS.test(path);
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return a.tier - b.tier || b.relevance - a.relevance || a.depth - b.depth || a.seq - b.seq;
}

// Regions tried in order for page content; navigation and footers are left out when one exists.
const MAIN_CONTENT_SELECTORS = ['main', '[role=main]', 'article'];

/** Text with Markdown-style headings, so page structure survives chunking. */
export function extractPage(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim().slice(0, 300);
  $('script, style, noscript, svg, iframe, template, head, [hidden], [aria-hidden="true"]').remove();

  const mainSelector = MAIN_CONTENT_SELECTORS.find((sel) => $(sel).length > 0);
  const root = mainSelector ? $(mainSelector).first() : $('body');
  if (!mainSelector) $('nav, footer').remove();

  const blocks: string[] = [];
  const selector = 'h1, h2, h3, h4, h5, h6, p, li, pre, blockquote, td, th, dt, dd';
  root.find(selector).each((_, el) => {
    if ($(el).parents(selector).length > 0) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    const tag = el.tagName?.toLowerCase() ?? '';
    const level = /^h([1-6])$/.exec(tag);
    blocks.push(level ? `${'#'.repeat(Number(level[1]))} ${text}` : tag === 'li' ? `- ${text}` : text);
  });

  let text = blocks.join('\n\n');
  if (text.length < MIN_CONTENT_CHARS) {
    text = root.text().replace(/\s+/g, ' ').trim();
  }
  return { title, text: text.slice(0, MAX_TEXT_CHARS) };
}

export class LegacyCrawlerProvider implements CrawlProvider {
  readonly name = 'legacy' as const;
  private readonly validate: (url: string) => void;
  private readonly lookup: NonNullable<LegacyCrawlerOptions['lookup']>;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: LegacyCrawlerOptions = {}) {
    this.validate = options.validate ?? ((url) => void parseCrawlUrl(url));
    this.lookup = options.lookup ?? safeLookup;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async crawl(url: string, budget: CrawlBudget, _correlationId?: string): Promise<CrawlResult> {
    this.validate(url);
    const deadline = this.now() + budget.timeoutSeconds * 1000;

    const robotsLoad = await this.loadRobots(CrawlSite.forUrl(url), budget);
    const robots = robotsLoad.robots;
    let site = robotsLoad.site;
    const delayMs = robots.crawlDelaySeconds === null
      ? DEFAULT_DELAY_MS
      : Math.min(Math.max(robots.crawlDelaySeconds * 1000, DEFAULT_DELAY_MS), MAX_DELAY_MS);

    const queue: Candidate[] = [];
    const queued = new Set<string>();
    const visited = new Set<string>();
    const contentHashes = new Set<string>();
    const pages: CrawledPage[] = [];
    let seq = 0;
    let fetched = 0;
    let attempts = 0;
    const maxAttempts = budget.maxPages * MAX_ATTEMPTS_FACTOR;
    let recordedSkips = 0;
    let timeBudgetReached = false;
    let sitemapLoaded = false;
    let siteChrome = '';

    const push = (candidateUrl: string, tier: number, depth: number, anchor = '') => {
      if (depth > budget.maxDepth || !site.contains(candidateUrl) || !isCrawlablePath(candidateUrl)) return;
      const key = site.key(candidateUrl);
      if (queued.has(key) || visited.has(key)) return;
      queued.add(key);
      queue.push({ tier, relevance: relevanceScore(candidateUrl, anchor), depth, seq: seq++, key, url: site.rebase(candidateUrl) });
    };

    push(url, TIER_SEED, 0);

    while (queue.length > 0 && fetched < budget.maxPages && attempts < maxAttempts) {
      if (this.now() >= deadline) {
        timeBudgetReached = true;
        break;
      }
      queue.sort(compareCandidates);
      const candidate = queue.shift()!;
      queued.delete(candidate.key);
      if (visited.has(candidate.key)) continue;
      visited.add(candidate.key);

      if (!robots.canFetch(candidate.url)) {
        if (recordedSkips < MAX_RECORDED_SKIPS) {
          pages.push(this.page(candidate.url, candidate.depth, 'skipped', 'robots_denied'));
          recordedSkips++;
        }
        continue;
      }

      if (attempts > 0) await this.sleep(delayMs);
      attempts++;

      const { page, html, finalUrl } = await this.fetchPage(candidate, site, robots, visited, budget);
      if (page.status === 'fetched') {
        // The same content served under different URLs would only add duplicate chunks.
        const digest = createHash('sha256').update(page.markdown).digest('hex');
        if (contentHashes.has(digest)) {
          Object.assign(page, { status: 'skipped', reason: 'duplicate', markdown: '' });
        } else {
          contentHashes.add(digest);
        }
      }
      pages.push(page);
      if (page.status === 'fetched') {
        fetched++;
        // Taken from the first usable page (normally the homepage); it is not a page of its own.
        if (!siteChrome && html !== null) siteChrome = extractSiteChrome(html);
      }

      if (candidate.tier === TIER_SEED && finalUrl) {
        // The seed may redirect to the site's real origin (https or www); later URLs use it.
        site = site.withPrimary(finalUrl);
        visited.add(site.key(finalUrl));
      }

      if (html !== null && candidate.depth < budget.maxDepth) {
        this.enqueueLinks(html, finalUrl ?? candidate.url, candidate, push);
      }

      if (!sitemapLoaded) {
        sitemapLoaded = true;
        for (const sitemapUrl of await this.sitemapUrls(site, robots, budget, deadline)) {
          push(sitemapUrl, relevanceScore(sitemapUrl) > 0 ? TIER_SITEMAP : TIER_LINK, 1);
        }
      }
    }

    const deferredCount = new Set(queue.map((c) => c.key).filter((k) => !visited.has(k))).size;
    return {
      provider: 'legacy',
      pages,
      deferredCount,
      capReached: fetched >= budget.maxPages && deferredCount > 0,
      timeBudgetReached,
      siteChrome,
    };
  }

  private page(url: string, depth: number, status: CrawledPage['status'], reason: string | null, extra: Partial<CrawledPage> = {}): CrawledPage {
    return { url: redactUrl(url), title: '', markdown: '', status, reason, depth, ...extra };
  }

  private enqueueLinks(html: string, baseUrl: string, candidate: Candidate, push: (u: string, tier: number, depth: number, anchor?: string) => void) {
    const $ = cheerio.load(html);
    const navLinks = new Set<string>();
    if (candidate.tier === TIER_SEED) {
      $('nav a[href], header a[href]').each((_, el) => {
        const link = resolveLink(baseUrl, $(el).attr('href'));
        if (!link) return;
        navLinks.add(link);
        push(link, TIER_NAV, candidate.depth + 1, $(el).text().trim());
      });
    }
    $('a[href]').each((_, el) => {
      const link = resolveLink(baseUrl, $(el).attr('href'));
      if (link && !navLinks.has(link)) push(link, TIER_LINK, candidate.depth + 1, $(el).text().trim());
    });
  }

  private async fetchPage(candidate: Candidate, site: CrawlSite, robots: RobotsPolicy, visited: Set<string>, budget: CrawlBudget) {
    const skip = (status: CrawledPage['status'], reason: string, url = candidate.url) =>
      ({ page: this.page(url, candidate.depth, status, reason), html: null, finalUrl: null });

    let url = candidate.url;
    let result: HttpResult;
    try {
      let hops = 0;
      for (;;) {
        result = await this.get(url, budget);
        if (result.location === null) break;
        if (++hops > MAX_REDIRECTS) return skip('failed', 'too_many_redirects');
        // Follow exactly where the site points, as long as it stays on the site.
        const target = resolveLink(url, result.location);
        if (!target || !site.contains(target)) return skip('skipped', 'redirect_outside_origin');
        if (!robots.canFetch(target)) return skip('skipped', 'robots_denied');
        const targetKey = site.key(target);
        if (targetKey !== candidate.key && visited.has(targetKey)) return skip('skipped', 'duplicate');
        visited.add(targetKey);
        url = target;
      }
    } catch (err) {
      return skip(...classifyFetchError(err));
    }

    if (result.status === 429 || result.status >= 500) return skip('failed', 'http_error', url);
    if (result.status >= 400) {
      // Broken or forbidden links are not usable content; they do not block publication.
      return skip('skipped', result.status === 401 || result.status === 403 ? 'blocked_by_site' : 'http_error', url);
    }
    if (result.contentType && !result.contentType.includes('html')) return skip('skipped', 'unsupported_content', url);

    const { title, text } = extractPage(result.body);
    if (text.length < MIN_CONTENT_CHARS) {
      return { page: this.page(url, candidate.depth, 'skipped', 'no_content', { title }), html: result.body, finalUrl: url };
    }
    return { page: this.page(url, candidate.depth, 'fetched', null, { title, markdown: text }), html: result.body, finalUrl: url };
  }

  private async get(url: string, budget: CrawlBudget): Promise<HttpResult> {
    const response = await axios.get<string>(url, {
      timeout: PER_PAGE_TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: budget.maxResponseBytes,
      responseType: 'text',
      transformResponse: (data) => data,
      validateStatus: () => true,
      lookup: this.lookup as any,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
    });
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    return {
      status: response.status,
      contentType: String(response.headers['content-type'] ?? '').toLowerCase(),
      location: isRedirect ? String(response.headers['location'] ?? '') : null,
      body: typeof response.data === 'string' ? response.data : '',
    };
  }

  /**
   * RFC 9309: 4xx means no restrictions; 5xx or unreachable means disallow everything.
   * Where robots.txt redirects within the site (to https or www) is also where
   * the site serves from, so the final URL becomes the site's primary origin.
   */
  private async loadRobots(site: CrawlSite, budget: CrawlBudget): Promise<{ robots: RobotsPolicy; site: CrawlSite }> {
    let url = `${site.origin}/robots.txt`;
    try {
      for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
        const result = await this.get(url, budget);
        if (result.location !== null) {
          const target = resolveLink(url, result.location);
          if (!target || !site.contains(target)) return { robots: ALLOW_ALL, site };
          url = target;
          continue;
        }
        if (result.status >= 500) return { robots: DISALLOW_ALL, site };
        if (result.status >= 400) return { robots: ALLOW_ALL, site };
        return { robots: parseRobots(result.body.slice(0, 500_000), ROBOTS_AGENT), site: site.withPrimary(url) };
      }
      return { robots: ALLOW_ALL, site };
    } catch {
      return { robots: DISALLOW_ALL, site };
    }
  }

  private async sitemapUrls(site: CrawlSite, robots: RobotsPolicy, budget: CrawlBudget, deadline: number): Promise<string[]> {
    const declared = robots.sitemaps.filter((u) => site.contains(u));
    const pending = [...new Set((declared.length ? declared : [`${site.origin}/sitemap.xml`]).map((u) => site.rebase(u)))];
    const seenFiles = new Set<string>();
    const urls: string[] = [];

    while (pending.length && seenFiles.size < MAX_SITEMAP_FILES && urls.length < MAX_SITEMAP_URLS) {
      if (this.now() >= deadline) break;
      const sitemapUrl = pending.shift()!;
      if (seenFiles.has(sitemapUrl) || !robots.canFetch(sitemapUrl)) continue;
      seenFiles.add(sitemapUrl);

      let result: HttpResult;
      try {
        result = await this.get(sitemapUrl, budget);
      } catch {
        continue;
      }
      // Sitemaps never need a DTD; refusing one blocks entity-expansion attacks.
      if (result.location !== null || result.status !== 200 || /<!DOCTYPE/i.test(result.body)) continue;

      const $ = cheerio.load(result.body, { xml: true });
      $('sitemap > loc').each((_, el) => {
        const link = resolveLink(sitemapUrl, $(el).text());
        if (link && site.contains(link)) pending.push(site.rebase(link));
      });
      $('url > loc').each((_, el) => {
        const link = resolveLink(sitemapUrl, $(el).text());
        if (link && site.contains(link) && urls.length < MAX_SITEMAP_URLS) urls.push(link);
      });
    }
    return urls;
  }
}

function classifyFetchError(err: unknown): [CrawledPage['status'], string] {
  const e = err as { code?: string; message?: string };
  if (e?.code === 'EBLOCKED' || e?.message === 'blocked_destination') return ['blocked', 'blocked_destination'];
  if (e?.message?.includes('maxContentLength')) return ['skipped', 'too_large'];
  if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') return ['failed', 'timeout'];
  return ['failed', 'fetch_failed'];
}
