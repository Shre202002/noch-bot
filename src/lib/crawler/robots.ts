/**
 * Minimal robots.txt (RFC 9309) evaluator for the legacy crawler.
 * Picks the most specific matching user-agent group, then the longest matching
 * rule; Allow wins ties. Supports `*` and `$` in paths.
 */

interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

export interface RobotsPolicy {
  canFetch(url: string): boolean;
  crawlDelaySeconds: number | null;
  sitemaps: string[];
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export const ALLOW_ALL: RobotsPolicy = { canFetch: () => true, crawlDelaySeconds: null, sitemaps: [] };
export const DISALLOW_ALL: RobotsPolicy = { canFetch: () => false, crawlDelaySeconds: null, sitemaps: [] };

export function parseRobots(text: string, agent: string): RobotsPolicy {
  const groups: { agents: string[]; rules: Rule[]; delay: number | null }[] = [];
  const sitemaps: string[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;

    if (key === 'sitemap') {
      sitemaps.push(value);
    } else if (current && (key === 'allow' || key === 'disallow')) {
      if (value) current.rules.push({ allow: key === 'allow', pattern: value, regex: toRegex(value) });
    } else if (current && key === 'crawl-delay') {
      const delay = Number(value);
      if (Number.isFinite(delay)) current.delay = delay;
    }
  }

  const agentLower = agent.toLowerCase();
  const group =
    groups.find((g) => g.agents.some((a) => a !== '*' && agentLower.includes(a))) ??
    groups.find((g) => g.agents.includes('*'));

  return {
    sitemaps,
    crawlDelaySeconds: group?.delay ?? null,
    canFetch(url: string) {
      if (!group) return true;
      let path: string;
      try {
        const parsed = new URL(url);
        path = `${parsed.pathname}${parsed.search}`;
      } catch {
        return false;
      }
      if (path === '/robots.txt') return true;

      let best: Rule | null = null;
      for (const rule of group.rules) {
        if (!rule.regex.test(path)) continue;
        if (
          !best ||
          rule.pattern.length > best.pattern.length ||
          (rule.pattern.length === best.pattern.length && rule.allow)
        ) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}
