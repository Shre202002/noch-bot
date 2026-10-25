import type { HubKey } from './industries';

/**
 * Blog posts as typed content. Same rules as the landing pages: only describe what the product does today, invent no
 * statistics, customers or quotes.
 */

export type PostSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export type Post = {
  slug: string;
  /** Without the brand; the root layout appends " | NochBot". */
  title: string;
  description: string;
  h1: string;
  /** ISO date, shown on the page and used for lastModified. */
  published: string;
  readMinutes: number;
  hub: HubKey;
  intro: string;
  sections: PostSection[];
  /** Slugs of landing pages to link to at the end. */
  related: string[];
};

export const POSTS: Post[] = [
  {
    slug: 'how-to-embed-a-chatbot-on-any-website',
    title: 'How to embed a chatbot on any website',
    description:
      'Embed an AI chatbot on any website with one script tag: what to prepare, where the code goes for common site builders, and how to test it before going live.',
    h1: 'How to embed a chatbot on any website',
    published: '2026-10-26',
    readMinutes: 4,
    hub: 'website-chatbot',
    intro:
      'Adding a chatbot to a site should take minutes, not a developer sprint. The pattern is the same everywhere: prepare the content the bot will answer from, copy one script tag, and paste it where your site lets you add custom code.',
    sections: [
      {
        heading: 'Step 1: decide what the bot should know',
        paragraphs: [
          'A chatbot is only as good as its sources. Start with your own website pages, then add the documents people ask about: a brochure, a price list, a rulebook. Keep to material you are happy for visitors to see.',
          'With NochBot you crawl the website from the dashboard and upload PDF, CSV or Excel files. The chatbot answers from those sources and nothing else.',
        ],
      },
      {
        heading: 'Step 2: copy the script tag',
        paragraphs: [
          'The dashboard gives you a single script tag for your account. It loads the chat widget on whichever page it appears.',
        ],
      },
      {
        heading: 'Step 3: paste it where your site allows custom code',
        paragraphs: ['Where the tag goes depends on how your site is built:'],
        bullets: [
          'Plain HTML: paste it just before the closing body tag on each page, or in a shared footer file.',
          'WordPress: use a header and footer scripts plugin, or your theme\'s footer file.',
          'Website builders: look for "custom code", "embed" or "footer scripts" in the site settings.',
          'React or Next.js: add it once in the root layout so it loads on every page.',
        ],
      },
      {
        heading: 'Step 4: test before telling anyone',
        paragraphs: [
          'Open the page in a private window, ask five questions your visitors really ask, and check each answer against your source. If an answer is wrong, the fix is almost always in the source: add the missing page or document and re-crawl.',
          'Check it on a phone too. The widget should open without covering the content you need to read.',
        ],
      },
    ],
    related: ['how-to-add-chatbot-to-website', 'free-ai-chatbot-for-website', 'chatbot-for-small-business'],
  },
  {
    slug: 'sell-event-tickets-online-with-qr-codes',
    title: 'Sell event tickets online with QR codes',
    description:
      'How to take registrations, get paid, email each attendee a QR ticket and check people in at the door, without stitching together four separate tools.',
    h1: 'How to sell event tickets online with QR codes',
    published: '2026-10-26',
    readMinutes: 5,
    hub: 'event-booking',
    intro:
      'Selling tickets needs four things to agree with each other: who registered, who paid, who holds a ticket, and who has already entered. Here is a simple setup that keeps all four in one place.',
    sections: [
      {
        heading: 'Start with capacity and the form',
        paragraphs: [
          'Decide the seat count, the price (or free), and what you need to know about each attendee. Ask for as little as you need: a name and an email is enough for most events.',
          'Counting seats matters most. Seats should be held while someone pays and released if they do not, so two people cannot buy the last seat.',
        ],
      },
      {
        heading: 'Collect every attendee, not just the buyer',
        paragraphs: [
          'When one person books four tickets, you want four names. Otherwise three people turn up with a ticket in someone else\'s name, and you cannot tell who is who at the gate.',
          'NochBot asks for all the names first, then all the emails, and emails each attendee their own ticket with their own name on it.',
        ],
      },
      {
        heading: 'Take payment through your own account',
        paragraphs: [
          'Connect a payment gateway you already use. NochBot supports Stripe, Razorpay, PayPal and Cashfree, so the money goes to your account. Plan for the case where a payment arrives after the seat hold expired: you either confirm it if seats remain or refund it.',
        ],
      },
      {
        heading: 'Check people in with a browser',
        paragraphs: ['On the day, door staff should not need an app. A scanner link that opens in a phone browser is enough:'],
        bullets: [
          'Staff create a login that you approve.',
          'They scan the QR code with the camera, or type the ticket code if the screen is cracked.',
          'A ticket that was already used is rejected, so a forwarded screenshot only works once.',
        ],
      },
    ],
    related: ['event-booking-chatbot', 'event-ticket-scanner'],
  },
  {
    slug: 'stop-a-chatbot-from-making-things-up',
    title: 'How to stop a chatbot making things up',
    description:
      'Why website chatbots invent fees, dates and links, and the practical steps that keep answers grounded in your own content, from sources to refusals.',
    h1: 'How to stop a chatbot from making things up',
    published: '2026-10-26',
    readMinutes: 4,
    hub: 'website-chatbot',
    intro:
      'A chatbot that confidently quotes a wrong fee is worse than no chatbot. The cure is not a cleverer model; it is limiting what the bot may say and checking what it says.',
    sections: [
      {
        heading: 'Why it happens',
        paragraphs: [
          'Language models complete text. If the answer is not in front of them, they will often produce something that sounds right. Fees, dates, emails and phone numbers are the most damaging things to get wrong.',
        ],
      },
      {
        heading: 'Four habits that keep answers honest',
        paragraphs: ['These apply to any chatbot you run, whichever tool you use:'],
        bullets: [
          'Answer only from your own sources. Give the bot your pages and documents and tell it to use nothing else.',
          'Prefer "I do not know" to a guess. A refusal that points to your contact page is better than a confident error.',
          'Check specifics. Numbers, links, emails and phone numbers in an answer should appear in the source text.',
          'Treat retrieved text as data, not instructions. A web page can contain text that tries to steer the bot.',
        ],
      },
      {
        heading: 'What NochBot does about it',
        paragraphs: [
          'Replies are limited to your sources. Retrieved text is wrapped as data and planted instructions are defused. If an answer contains a number, email, link or phone number that is not in the sources, it is retried or refused, and attempts to make the bot reveal its instructions are blocked.',
          'No system is perfect, so test with real questions and fix gaps by improving the source.',
        ],
      },
      {
        heading: 'Keep the sources fresh',
        paragraphs: [
          'Most wrong answers are stale answers. When fees, dates or products change, re-crawl the site or upload the new file. NochBot updates when you do that; it does not live-sync with other tools.',
        ],
      },
    ],
    related: ['free-ai-chatbot-for-website', 'private-knowledge-chatbot', 'chatbot-for-small-business'],
  },
  {
    slug: 'turn-a-price-list-into-a-chatbot',
    title: 'Turn a price list into a chatbot',
    description:
      'How to turn a CSV or Excel price list into a chatbot customers can ask, with clean columns, an ID column and a simple way to update prices later.',
    h1: 'How to turn a price list into a chatbot',
    published: '2026-10-26',
    readMinutes: 4,
    hub: 'documents',
    intro:
      'If your prices live in a spreadsheet and your staff keep reading them out over the phone, a catalog chatbot can take that load. Preparing the sheet well makes the difference between useful answers and confusing ones.',
    sections: [
      {
        heading: 'Clean the sheet first',
        paragraphs: ['A chatbot reads your columns, so make them easy to read:'],
        bullets: [
          'One header row, with clear names such as "Product", "Category", "Price" and "Stock".',
          'One item per row, with no merged cells and no notes squeezed into price cells.',
          'Numbers as plain numbers, so questions like "under 500" can be answered correctly.',
          'A column that identifies each item, such as a SKU or product code.',
        ],
      },
      {
        heading: 'Upload and choose the ID column',
        paragraphs: [
          'Upload the CSV or Excel file and pick the ID column. NochBot answers by running structured lookups on your columns, including filters on price and category, and falls back to meaning-based search when a question does not map to a column.',
        ],
      },
      {
        heading: 'Update without starting over',
        paragraphs: [
          'When prices change, append the new batch. Rows with an ID that already exists are updated instead of duplicated, and new columns can be added. The data refreshes when you upload; it does not live-sync a Google Sheet, so schedule a weekly upload if prices move often.',
        ],
      },
      {
        heading: 'Share it with the right people',
        paragraphs: [
          'You can embed the chatbot on your website, or share a link. For dealer-only prices, make the link require a sign-in that you approve.',
        ],
      },
    ],
    related: ['catalog-chatbot', 'chat-with-excel-csv', 'private-knowledge-chatbot'],
  },
];

export function getPost(slug: string): Post {
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`Unknown post: ${slug}`);
  return p;
}
