import { SEO_PAGES, SITE_URL } from '@/lib/seoPages';
import { COMPETITORS } from './compare';
import { POSTS } from './posts';
import { INDUSTRIES, type HubKey } from './industries';
import { CASE_STUDIES } from './caseStudies';

export type PageType = 'landing' | 'compare' | 'alternatives' | 'guide' | 'tool' | 'industry' | 'case-study';

/** Free tools. The calculators themselves live in src/components/seo/tools. */
export const TOOLS = [
  {
    slug: 'chatbot-roi-calculator',
    title: 'Chatbot ROI calculator',
    description:
      'Estimate how many support hours and how much money an AI chatbot could save you each month, using your own chat volume and cost. Free, no sign-up.',
    h1: 'Chatbot ROI calculator',
    linkLabel: 'Chatbot ROI calculator',
    hub: 'website-chatbot' as HubKey,
    intro:
      'Enter how many chats you handle, how long each takes and what an hour of support costs you. Then choose how many of those chats a chatbot could answer on its own. The result is only as good as your assumptions, so try a cautious number first.',
    related: ['free-ai-chatbot-for-website', 'chatbot-for-small-business'],
  },
  {
    slug: 'event-ticket-revenue-calculator',
    title: 'Event ticket revenue calculator',
    description:
      'Work out gross and net ticket revenue for an event from price, seats, expected sell-through and payment fees. Free, no sign-up, runs in your browser.',
    h1: 'Event ticket revenue calculator',
    linkLabel: 'Event ticket revenue calculator',
    hub: 'event-booking' as HubKey,
    intro:
      'Set the ticket price, seats and how much of the venue you expect to fill, then add your payment gateway\'s fees. You get gross revenue, fees and what lands in your account. Use your gateway\'s current fee page for the percentages.',
    related: ['event-booking-chatbot', 'event-ticket-scanner'],
  },
  {
    slug: 'chatbot-plan-estimator',
    title: 'Chatbot plan estimator',
    description:
      'Estimate how many chatbot messages you will use each month and see which NochBot plan covers it, using the live plan limits. Free, no sign-up.',
    h1: 'Chatbot plan estimator',
    linkLabel: 'Chatbot plan estimator',
    hub: 'website-chatbot' as HubKey,
    intro:
      'Enter your monthly visitors, the share who open the chat and how many messages a chat usually has. The estimator compares the total with the current plan limits, which are loaded live so they are always up to date.',
    related: ['free-ai-chatbot-for-website', 'chatbot-for-small-business'],
  },
];

export type ToolPage = (typeof TOOLS)[number];

export function getTool(slug: string): ToolPage {
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown tool: ${slug}`);
  return t;
}

/** Top-level sections, shown in the footer. Customers appears only once a real, permitted story is published. */
export const SECTIONS: Array<{ path: string; label: string }> = [
  { path: '/blog', label: 'Blog' },
  { path: '/compare', label: 'Compare' },
  { path: '/alternatives', label: 'Alternatives' },
  { path: '/tools', label: 'Free tools' },
  { path: '/industries', label: 'Industries' },
  ...(CASE_STUDIES.length ? [{ path: '/customers', label: 'Customers' }] : []),
];

export type SiteEntry = { path: string; type: PageType; hub: HubKey | null; lastModified?: string; priority: number };

/** Every public content page, in one list: this drives the sitemap and the integrity tests. */
export function allEntries(): SiteEntry[] {
  return [
    ...SEO_PAGES.map((p) => ({ path: `/${p.slug}`, type: 'landing' as const, hub: hubOfLanding(p.slug), priority: 0.9 })),
    { path: '/compare', type: 'compare' as const, hub: null, priority: 0.7 },
    ...COMPETITORS.map((c) => ({ path: `/compare/${c.slug}`, type: 'compare' as const, hub: 'website-chatbot' as HubKey, priority: 0.8 })),
    { path: '/alternatives', type: 'alternatives' as const, hub: null, priority: 0.7 },
    ...COMPETITORS.map((c) => ({ path: `/alternatives/${c.slug}`, type: 'alternatives' as const, hub: 'website-chatbot' as HubKey, priority: 0.8 })),
    { path: '/blog', type: 'guide' as const, hub: null, priority: 0.7 },
    ...POSTS.map((p) => ({ path: `/blog/${p.slug}`, type: 'guide' as const, hub: p.hub, lastModified: p.published, priority: 0.7 })),
    { path: '/tools', type: 'tool' as const, hub: null, priority: 0.7 },
    ...TOOLS.map((t) => ({ path: `/tools/${t.slug}`, type: 'tool' as const, hub: t.hub, priority: 0.8 })),
    { path: '/industries', type: 'industry' as const, hub: null, priority: 0.7 },
    ...INDUSTRIES.map((p) => ({ path: `/industries/${p.slug}`, type: 'industry' as const, hub: p.hub, priority: 0.8 })),
    ...(CASE_STUDIES.length
      ? [
          { path: '/customers', type: 'case-study' as const, hub: null, priority: 0.7 },
          ...CASE_STUDIES.map((c) => ({ path: `/customers/${c.slug}`, type: 'case-study' as const, hub: c.hub, lastModified: c.published, priority: 0.7 })),
        ]
      : []),
  ];
}

/**
 * Hubs for topical authority. The hub landing page is the pillar; every post, comparison, tool and industry page in
 * the cluster links up to it, and it links down to each of them.
 */
export const HUBS: Record<HubKey, { landing: string; label: string }> = {
  'website-chatbot': { landing: 'free-ai-chatbot-for-website', label: 'AI chatbot for your website' },
  'event-booking': { landing: 'event-booking-chatbot', label: 'Event registration chatbot' },
  documents: { landing: 'chat-with-excel-csv', label: 'CSV and Excel chatbot' },
};

function hubOfLanding(slug: string): HubKey | null {
  const map: Record<string, HubKey> = {
    'free-ai-chatbot-for-website': 'website-chatbot',
    'chatbot-for-small-business': 'website-chatbot',
    'how-to-add-chatbot-to-website': 'website-chatbot',
    'best-free-ai-chatbot-for-websites': 'website-chatbot',
    'event-booking-chatbot': 'event-booking',
    'event-ticket-scanner': 'event-booking',
    'chat-with-excel-csv': 'documents',
    'catalog-chatbot': 'documents',
    'private-knowledge-chatbot': 'documents',
    'pdf-chatbot': 'documents',
  };
  return map[slug] ?? null;
}

/** Spoke pages of a hub, for the "More on this topic" block on the pillar. */
export function spokesOf(hub: HubKey): Array<{ path: string; label: string }> {
  return [
    ...POSTS.filter((p) => p.hub === hub).map((p) => ({ path: `/blog/${p.slug}`, label: p.h1 })),
    ...TOOLS.filter((t) => t.hub === hub).map((t) => ({ path: `/tools/${t.slug}`, label: t.linkLabel })),
    ...INDUSTRIES.filter((p) => p.hub === hub).map((p) => ({ path: `/industries/${p.slug}`, label: p.linkLabel })),
  ];
}

/**
 * Keyword to page-type map. A keyword's shape decides which kind of page should target it, and each row names the
 * page that does. Seeded from docs/seo/keyword-research.md; add a row before writing a new page.
 */
export const KEYWORD_MAP: Array<{ keyword: string; type: PageType; path: string }> = [
  { keyword: 'free ai chatbot for website', type: 'landing', path: '/free-ai-chatbot-for-website' },
  { keyword: 'ai chatbot for small business', type: 'landing', path: '/chatbot-for-small-business' },
  { keyword: 'how to add a chatbot to a website', type: 'landing', path: '/how-to-add-chatbot-to-website' },
  { keyword: 'embed chatbot on website', type: 'guide', path: '/blog/how-to-embed-a-chatbot-on-any-website' },
  { keyword: 'event registration software', type: 'landing', path: '/event-booking-chatbot' },
  { keyword: 'sell event tickets online qr code', type: 'guide', path: '/blog/sell-event-tickets-online-with-qr-codes' },
  { keyword: 'qr code ticket scanner for events', type: 'landing', path: '/event-ticket-scanner' },
  { keyword: 'chatbot hallucination prevent', type: 'guide', path: '/blog/stop-a-chatbot-from-making-things-up' },
  { keyword: 'excel chatbot', type: 'landing', path: '/chat-with-excel-csv' },
  { keyword: 'price list chatbot', type: 'guide', path: '/blog/turn-a-price-list-into-a-chatbot' },
  { keyword: 'chatbase alternative', type: 'alternatives', path: '/alternatives/chatbase' },
  { keyword: 'tidio alternative', type: 'alternatives', path: '/alternatives/tidio' },
  { keyword: 'intercom alternative', type: 'alternatives', path: '/alternatives/intercom' },
  { keyword: 'botpress alternative', type: 'alternatives', path: '/alternatives/botpress' },
  { keyword: 'nochbot vs chatbase', type: 'compare', path: '/compare/chatbase' },
  { keyword: 'nochbot vs tidio', type: 'compare', path: '/compare/tidio' },
  { keyword: 'nochbot vs intercom', type: 'compare', path: '/compare/intercom' },
  { keyword: 'nochbot vs botpress', type: 'compare', path: '/compare/botpress' },
  { keyword: 'chatbot roi calculator', type: 'tool', path: '/tools/chatbot-roi-calculator' },
  { keyword: 'event ticket revenue calculator', type: 'tool', path: '/tools/event-ticket-revenue-calculator' },
  { keyword: 'chatbot pricing estimator', type: 'tool', path: '/tools/chatbot-plan-estimator' },
  { keyword: 'chatbot for college fest', type: 'industry', path: '/industries/college-fests-and-events' },
  { keyword: 'chatbot for coaching institute', type: 'industry', path: '/industries/coaching-institutes' },
  { keyword: 'catalog chatbot for small shop', type: 'industry', path: '/industries/small-retail-catalogs' },
  { keyword: 'conference registration chatbot', type: 'industry', path: '/industries/conference-and-workshop-organizers' },
];

export const absoluteUrl = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;
