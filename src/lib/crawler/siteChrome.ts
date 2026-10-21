import * as cheerio from 'cheerio';

/**
 * Site-wide header, top bar and footer. Contact details, addresses and opening hours often appear only there, and
 * main-content extraction leaves them out, so each crawl captures them once from its first usable page and publishes
 * them as one chunk that does not count as a page. Mirrors extract_site_chrome() in scraper/nochbot_crawler/crawler.py.
 */

export const MAX_SITE_CHROME_CHARS = 4_000;
const MAX_LINKS = 20;

const HEADER_SELECTORS = ['body > header', 'header', '[role=banner]', '#header', '#masthead', '.site-header'];
const TOPBAR_SELECTORS = ['[class*=topbar]', '[class*=top-bar]', '[class*=announcement]'];
const FOOTER_SELECTORS = ['footer', '[role=contentinfo]', '#footer', '.site-footer', '.footer'];
const SOCIAL_HOSTS: Record<string, string> = {
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn',
  'twitter.com': 'Twitter',
  'x.com': 'X',
  'youtube.com': 'YouTube',
  'pinterest.com': 'Pinterest',
  't.me': 'Telegram',
};
const WHATSAPP_HOSTS = new Set(['wa.me', 'api.whatsapp.com', 'whatsapp.com', 'chat.whatsapp.com']);
const BLOCK_TAGS = 'p, li, h1, h2, h3, h4, h5, h6, div, address, section, ul, ol, tr, td, dt, dd, a, span';

/** ["Phone", "+918439977111"] for tel:, mailto:, WhatsApp and social-profile links; null for any other link. */
export function contactLink(href: string): [string, string] | null {
  const value = (href ?? '').trim();
  const lower = value.toLowerCase();
  if (lower.startsWith('tel:')) {
    const number = value.slice(4).replace(/[^\d+]/g, '');
    return number.replace(/\D/g, '').length >= 6 ? ['Phone', number] : null;
  }
  if (lower.startsWith('mailto:')) {
    const email = value.slice(7).split('?')[0].trim();
    return email.includes('@') ? ['Email', email] : null;
  }
  if (!/^https?:\/\//.test(lower)) return null;
  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  if (WHATSAPP_HOSTS.has(host)) return ['WhatsApp', value];
  for (const [social, label] of Object.entries(SOCIAL_HOSTS)) {
    if (host === social || host.endsWith(`.${social}`)) return [label, value];
  }
  return null;
}

export function extractSiteChrome(html: string): string {
  try {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe, template, head, [hidden], [aria-hidden="true"]').remove();

    const pick = (selectors: string[], last: boolean) => {
      for (const selector of selectors) {
        const found = $(selector);
        if (found.length) return last ? found.last() : found.first();
      }
      return null;
    };
    const regionText = (region: ReturnType<typeof $>) => {
      const copy = region.clone();
      copy.find('br').replaceWith('\n');
      // Line breaks after block-level and inline link/span runs, so "Call us" and the number stay readable.
      copy.find(BLOCK_TAGS).each((_, el) => {
        $(el).append('\n');
      });
      const lines: string[] = [];
      for (const raw of copy.text().split('\n')) {
        const line = raw.replace(/\s+/g, ' ').trim();
        if (line && lines[lines.length - 1] !== line) lines.push(line);
      }
      return lines.join('\n');
    };

    const sections: string[] = [];
    const seen = new Set<string>();
    const regions: Array<[string, string[], boolean]> = [
      ['Header', HEADER_SELECTORS, false],
      ['Top bar', TOPBAR_SELECTORS, false],
      ['Footer', FOOTER_SELECTORS, true],
    ];
    for (const [label, selectors, last] of regions) {
      const region = pick(selectors, last);
      const text = region ? regionText(region) : '';
      if (text && !seen.has(text)) {
        seen.add(text);
        sections.push(`${label}:\n${text}`);
      }
    }

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      if (links.length >= MAX_LINKS) return false;
      const found = contactLink($(el).attr('href') ?? '');
      const line = found ? `- ${found[0]}: ${found[1]}` : null;
      if (line && !links.includes(line)) links.push(line);
      return undefined;
    });
    if (links.length) sections.push(`Contact and social links:\n${links.join('\n')}`);

    return sections.join('\n\n').slice(0, MAX_SITE_CHROME_CHARS);
  } catch {
    // Site-wide details are a bonus; a crawl must never fail because of them.
    return '';
  }
}
