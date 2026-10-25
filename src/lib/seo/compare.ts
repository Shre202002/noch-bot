/**
 * Comparison and alternatives content.
 *
 * Rule: say nothing specific about a competitor that we have not verified. Competitor entries hold only their
 * well-known category and who they suit; the table's right-hand column tells the reader what to check on the
 * competitor's own site, with a link. Everything said about NochBot is true of the product as shipped. No prices
 * are quoted for anyone (NochBot plans are edited at runtime), and no statistics are invented.
 */

export type Competitor = {
  slug: string;
  name: string;
  site: string;
  /** What the product is, in neutral category terms. */
  category: string;
  /** Short, conservative statements of who it suits. */
  suits: string[];
  /** Related slugs of other competitors. */
  related: string[];
};

export const COMPETITORS: Competitor[] = [
  {
    slug: 'chatbase',
    name: 'Chatbase',
    site: 'https://www.chatbase.co',
    category: 'an AI chatbot builder that answers from your own content',
    suits: [
      'Your main need is a support-style chatbot trained on your content',
      'You do not need ticketed event booking or QR ticket scanning',
    ],
    related: ['tidio', 'botpress', 'intercom'],
  },
  {
    slug: 'tidio',
    name: 'Tidio',
    site: 'https://www.tidio.com',
    category: 'a customer-chat platform that combines live chat with chatbots',
    suits: [
      'You want human live chat and a chatbot working in one inbox',
      'Your team will answer visitors in real time during working hours',
    ],
    related: ['intercom', 'chatbase', 'botpress'],
  },
  {
    slug: 'intercom',
    name: 'Intercom',
    site: 'https://www.intercom.com',
    category: 'a full customer-service platform with an AI agent',
    suits: [
      'You run a larger support team and want a complete helpdesk, not only a chatbot',
      'You need ticketing, inbox and reporting in one customer-service suite',
    ],
    related: ['tidio', 'chatbase', 'botpress'],
  },
  {
    slug: 'botpress',
    name: 'Botpress',
    site: 'https://botpress.com',
    category: 'a platform for building custom AI agents and conversation flows',
    suits: [
      'You have developers and want to build custom agent logic and workflows yourself',
      'You want to design the conversation flow in detail rather than use a ready-made widget',
    ],
    related: ['chatbase', 'intercom', 'tidio'],
  },
];

export type CompareRow = { criterion: string; nochbot: string; check: string };

/** Rows are the questions worth asking of any chatbot. `nochbot` is fact; `check` is what to look up elsewhere. */
export const COMPARE_ROWS: CompareRow[] = [
  {
    criterion: 'What it answers from',
    nochbot: 'Your crawled website pages, plus PDF, CSV and Excel files you upload.',
    check: 'Which sources it can learn from, and whether spreadsheets are supported.',
  },
  {
    criterion: 'Event booking and tickets',
    nochbot:
      'Takes registrations in the widget, collects payment (Stripe, Razorpay, PayPal or Cashfree), emails QR tickets and scans them at the door from a browser.',
    check: 'Whether booking, ticket issuing and door scanning are built in or need another tool.',
  },
  {
    criterion: 'Group bookings',
    nochbot: 'Asks for each attendee\'s name and email, and emails every attendee their own ticket.',
    check: 'Whether one booking can carry several named attendees.',
  },
  {
    criterion: 'Free plan',
    nochbot: 'There is a free plan. Limits are shown on the pricing section and can change.',
    check: 'Whether a free plan exists, what it limits, and what happens at the limit.',
  },
  {
    criterion: 'Pricing currency',
    nochbot: 'Plans are priced in Indian rupees.',
    check: 'The billing currency and whether taxes are added at checkout.',
  },
  {
    criterion: 'Answers grounded in your content',
    nochbot:
      'Replies are limited to your sources, planted instructions in retrieved text are defused, and answers with numbers, emails, links or phone numbers that are not in the sources are retried or refused.',
    check: 'How it prevents made-up answers and what it does when it does not know.',
  },
  {
    criterion: 'Adding it to your site',
    nochbot: 'One script tag on your website.',
    check: 'The embed method and whether your site builder is supported.',
  },
  {
    criterion: 'Channels it does not cover',
    nochbot: 'NochBot does not offer WhatsApp delivery and does not live-sync a Google Sheet; data updates when you upload or re-crawl.',
    check: 'Whether the channels and live data sync you need are included.',
  },
];

export function getCompetitor(slug: string): Competitor {
  const c = COMPETITORS.find((x) => x.slug === slug);
  if (!c) throw new Error(`Unknown competitor: ${slug}`);
  return c;
}

export function compareTitle(c: Competitor): string {
  return `NochBot vs ${c.name}`;
}
export function compareDescription(c: Competitor): string {
  return `NochBot vs ${c.name}: where each AI chatbot fits, what to check before choosing, and why event booking with QR tickets sets NochBot apart.`;
}
export function alternativesTitle(c: Competitor): string {
  return `${c.name} alternatives`;
}
export function alternativesDescription(c: Competitor): string {
  return `Looking for a ${c.name} alternative? What to compare before you switch, and when NochBot, with booking and QR tickets, is the better fit.`;
}

export const compareFaqs = (c: Competitor) => [
  {
    q: `Is NochBot a replacement for ${c.name}?`,
    a: `It depends on what you need. ${c.name} is ${c.category}. NochBot covers website and document chat and adds event booking with payments and QR tickets. If you need something ${c.name} does that is not in the table above, check it before switching.`,
  },
  {
    q: `Can I try NochBot without paying?`,
    a: 'Yes. There is a free plan, so you can crawl your site, ask it questions and see the answers before you decide.',
  },
  {
    q: `Does NochBot work with WhatsApp or live-sync a Google Sheet?`,
    a: 'No. NochBot does not offer WhatsApp delivery or live syncing of a Google Sheet. Data updates when you upload a file or re-crawl your site.',
  },
  {
    q: `How do I check ${c.name} details?`,
    a: `Use the right-hand column of the table as a checklist and confirm each point on ${c.name}'s own website (${c.site}). Features and prices change, so rely on their current pages.`,
  },
];

export const alternativesFaqs = (c: Competitor) => [
  {
    q: `Why do people look for a ${c.name} alternative?`,
    a: 'Common reasons are a different feature set, a pricing model that does not fit the size of the business, or needing a tool that does something extra such as event booking. Decide which of these applies to you first.',
  },
  {
    q: `What should I compare first?`,
    a: 'Start with the sources the chatbot can learn from, how it avoids made-up answers, what the free plan allows, and whether it covers the channel you need. The checklist above turns these into questions you can answer in an afternoon.',
  },
  {
    q: `Is NochBot a good ${c.name} alternative for events?`,
    a: 'If you take registrations or sell tickets, yes: booking, payment, QR tickets and door scanning are part of NochBot. If you only need a chatbot that answers support questions, compare both on the checklist.',
  },
  {
    q: 'Can I move my content across?',
    a: 'You do not export anything from the other tool. Point NochBot at your website to crawl it, and upload any PDF, CSV or Excel files again.',
  },
];
