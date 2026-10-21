import dns from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { CrawlPolicyError } from './types';

/**
 * URL and destination policy for website crawling (SSRF protection).
 * Mirrors scraper/nochbot_crawler/url_policy.py; keep the two in sync.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);
const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 };
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];
const MAX_URL_LENGTH = 2048;
// "/docs/index.html" serves the same page as "/docs/".
const DIRECTORY_INDEX_FILES = new Set(['index.html', 'index.htm', 'index.php']);
const TRACKING_PARAMS = new Set([
  'gclid', 'fbclid', 'msclkid', 'dclid', 'yclid', 'mc_cid', 'mc_eid', '_ga', '_gl', 'igshid', 'ref_src',
]);

const blockedV4 = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blockedV4.addSubnet(net, prefix, 'ipv4');
}

// Only 2000::/3 is global unicast; these are carve-outs inside it or tunnelling forms.
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [net, prefix] of [
  ['2001:db8::', 32], ['2002::', 16], ['2001::', 32], ['2001:10::', 28], ['2001:20::', 28],
] as const) {
  blockedV6.addSubnet(net, prefix, 'ipv6');
}

function embeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const hexMapped = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
  }
  const nat64 = lower.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/);
  return nat64 ? nat64[1] : null;
}

/** True only for globally routable unicast addresses. */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !blockedV4.check(ip, 'ipv4');
  if (version !== 6) return false;

  const v4 = embeddedIpv4(ip);
  if (v4) return isPublicAddress(v4);
  return globalV6.check(ip, 'ipv6') && !blockedV6.check(ip, 'ipv6');
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function effectivePort(url: URL): number {
  return url.port ? Number(url.port) : DEFAULT_PORTS[url.protocol];
}

/** Validate syntax and return the parsed URL. Throws CrawlPolicyError with a safe reason. */
export function parseCrawlUrl(raw: unknown): URL {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_URL_LENGTH) {
    throw new CrawlPolicyError('invalid_url');
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CrawlPolicyError('invalid_url');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol) || url.username || url.password) {
    throw new CrawlPolicyError('invalid_url');
  }

  const host = hostOf(url);
  if (!host) throw new CrawlPolicyError('invalid_url');
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new CrawlPolicyError('blocked_destination');
  }
  if (!ALLOWED_PORTS.has(effectivePort(url))) {
    throw new CrawlPolicyError('blocked_destination');
  }
  if (isIP(host) && !isPublicAddress(host)) {
    throw new CrawlPolicyError('blocked_destination');
  }
  return url;
}

export type HostResolver = (host: string) => Promise<string[]>;

export const systemResolver: HostResolver = async (host) => {
  const records = await dns.promises.lookup(host, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

/**
 * Validate a submitted crawl URL, including DNS: every resolved address must be public.
 * Returns the URL without its fragment (the path is kept exactly as submitted).
 */
export async function validateCrawlTarget(
  raw: unknown,
  resolve: HostResolver = systemResolver,
): Promise<string> {
  const url = parseCrawlUrl(raw);
  const host = hostOf(url);
  if (!isIP(host)) {
    let addresses: string[];
    try {
      addresses = await resolve(host);
    } catch {
      throw new CrawlPolicyError('dns_failed');
    }
    if (addresses.length === 0) throw new CrawlPolicyError('dns_failed');
    if (!addresses.every(isPublicAddress)) throw new CrawlPolicyError('blocked_destination');
  }
  url.hash = '';
  return url.href;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/**
 * DNS lookup for outgoing crawl requests. It validates at connect time, so a
 * hostname that re-resolves to a private address (DNS rebinding) is refused.
 */
export function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || !list.every((a) => isPublicAddress(a.address))) {
      const blocked = Object.assign(new Error('blocked_destination'), { code: 'EBLOCKED' });
      return callback(blocked, '');
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/**
 * Normalize obvious URL variants so they count as one page: drops fragments,
 * default ports, tracking-only params, directory index file names and
 * trailing slashes (except root).
 * Path case and meaningful query params are kept.
 */
export function canonicalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = '';
  url.hostname = url.hostname.replace(/\.$/, '').toLowerCase();
  if (url.port && Number(url.port) === DEFAULT_PORTS[url.protocol]) url.port = '';

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) url.searchParams.delete(key);
  }
  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1).toLowerCase();
  if (DIRECTORY_INDEX_FILES.has(lastSegment)) {
    url.pathname = url.pathname.slice(0, -lastSegment.length) || '/';
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  }
  return url.href;
}

/** The www/apex counterpart of a hostname, or null for IP literals and single-label hosts. */
export function alternateHost(host: string): string | null {
  if (isIP(host)) return null;
  if (host.startsWith('www.')) {
    const apex = host.slice(4);
    return apex.includes('.') ? apex : null;
  }
  return host.includes('.') ? `www.${host}` : null;
}

/**
 * The set of URLs one crawl may touch: the submitted host and its www/apex
 * counterpart, over http/https on default ports (or the exact scheme and port
 * when a custom port was submitted). `primary` is where the site actually
 * serves from, learned from robots.txt and seed redirects.
 * Mirrors Site in scraper/nochbot_crawler/url_policy.py.
 */
export class CrawlSite {
  private constructor(
    readonly hosts: ReadonlySet<string>,
    readonly primary: { protocol: string; host: string; port: number },
  ) {}

  static forUrl(raw: string): CrawlSite {
    const url = new URL(raw);
    const host = hostOf(url);
    const alt = alternateHost(host);
    return new CrawlSite(new Set(alt ? [host, alt] : [host]), { protocol: url.protocol, host, port: effectivePort(url) });
  }

  private get usesDefaultPort(): boolean {
    return this.primary.port === DEFAULT_PORTS[this.primary.protocol];
  }

  contains(raw: string): boolean {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return false;
    }
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || !this.hosts.has(hostOf(url))) return false;
    if (this.usesDefaultPort) return effectivePort(url) === DEFAULT_PORTS[url.protocol];
    return url.protocol === this.primary.protocol && effectivePort(url) === this.primary.port;
  }

  withPrimary(raw: string): CrawlSite {
    if (!this.contains(raw)) return this;
    const url = new URL(raw);
    return new CrawlSite(this.hosts, { protocol: url.protocol, host: hostOf(url), port: effectivePort(url) });
  }

  /** Base URL of the primary origin, e.g. "https://www.example.com". */
  get origin(): string {
    const host = this.primary.host.includes(':') ? `[${this.primary.host}]` : this.primary.host;
    return `${this.primary.protocol}//${host}${this.usesDefaultPort ? '' : `:${this.primary.port}`}`;
  }

  /** Same path and query on the primary origin, without the fragment. */
  rebase(raw: string): string {
    const url = new URL(raw);
    return `${this.origin}${url.pathname || '/'}${url.search}`;
  }

  /** Dedup key: the canonical URL on the primary origin. */
  key(raw: string): string {
    return canonicalizeUrl(this.rebase(raw));
  }
}

/** Join a link against its page; returns the absolute URL without fragment, or null for non-HTTP links. */
export function resolveLink(baseUrl: string, href: string | undefined): string | null {
  const value = (href ?? '').trim();
  if (!value || /^(#|mailto:|tel:|javascript:|data:)/i.test(value)) return null;
  try {
    const url = new URL(value, baseUrl);
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || url.href.length > MAX_URL_LENGTH) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/** Scheme, host and path only. Safe for logs, responses and persisted metadata. */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname || '/'}`;
  } catch {
    return '[invalid-url]';
  }
}
