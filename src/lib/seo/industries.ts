/**
 * Industry pages. Each one describes how a kind of organisation would use features that exist today. No customers,
 * numbers or results are claimed; real customer stories belong in caseStudies.ts once there is permission.
 */

export type IndustryPage = {
  slug: string;
  /** Without the brand; the root layout appends " | NochBot". */
  title: string;
  description: string;
  h1: string;
  intro: string;
  linkLabel: string;
  hub: HubKey;
  problems: Array<{ title: string; body: string }>;
  solutions: Array<{ title: string; body: string }>;
  steps: string[];
  faqs: Array<{ q: string; a: string }>;
  /** Slugs of landing pages (src/lib/seoPages.ts) to link to. */
  related: string[];
};

export type HubKey = 'website-chatbot' | 'event-booking' | 'documents';

export const INDUSTRIES: IndustryPage[] = [
  {
    slug: 'college-fests-and-events',
    title: 'Chatbot for college fests and events',
    description:
      'Take registrations, collect each attendee\'s details, issue QR tickets and scan entry at the gate for a college fest, with a chatbot that answers questions too.',
    h1: 'A registration and ticket chatbot for college fests and events',
    intro:
      'Fest season means the same questions again and again, and registrations that arrive in chat, forms and spreadsheets. NochBot puts questions, registration, payment and entry in one place on your event site.',
    linkLabel: 'College fests and events',
    hub: 'event-booking',
    problems: [
      { title: 'The same questions all day', body: 'Dates, venues, fees, rules and eligibility are repeated in every message and comment.' },
      { title: 'Registrations spread across tools', body: 'Forms, chats and payment screenshots are hard to reconcile before the gate opens.' },
      { title: 'Group registrations are messy', body: 'A team of four sends one name and one email, and the other three never get a ticket.' },
      { title: 'Entry queues', body: 'Checking names against a list at the gate is slow and easy to get wrong.' },
    ],
    solutions: [
      { title: 'Answers from your event page', body: 'Crawl your event website and upload the rulebook PDF. The chatbot answers from those sources only.' },
      { title: 'Booking in the chat widget', body: 'Visitors pick a quantity and fill the form you designed. Paid events take payment through your own gateway account.' },
      { title: 'Every attendee named', body: 'For a group of four, the bot asks for all four names, then all four emails, and each person is emailed their own QR ticket.' },
      { title: 'Browser-based scanning', body: 'Volunteers open a scanner link on a phone, get approved by you, and scan tickets at the gate. A used ticket is rejected on the second scan.' },
    ],
    steps: [
      'Create your event and registration form in the dashboard.',
      'Crawl the event website and upload the rulebook so the chatbot can answer questions.',
      'Add the one-line script to your event site.',
      'Share the scanner link with approved volunteers on the day.',
    ],
    faqs: [
      { q: 'Can we run a free event?', a: 'Yes. Free events skip payment and confirm the booking straight away, and tickets are still emailed and scannable.' },
      { q: 'Do volunteers need to install an app?', a: 'No. Scanning runs in the phone browser. The camera needs a secure (https) page.' },
      { q: 'Can one person book for a team?', a: 'Yes. The bot collects every attendee\'s details, and each attendee with an email address receives their own ticket.' },
      { q: 'Does it work on WhatsApp?', a: 'No. NochBot does not offer WhatsApp delivery. The chatbot runs on your website.' },
    ],
    related: ['event-booking-chatbot', 'event-ticket-scanner', 'free-ai-chatbot-for-website'],
  },
  {
    slug: 'coaching-institutes',
    title: 'AI chatbot for coaching institutes',
    description:
      'Answer admission, fee and batch questions from your own brochure and website, around the clock, with a chatbot that only says what your documents say.',
    h1: 'An AI chatbot for coaching institutes and training centres',
    intro:
      'Parents and students ask about batches, fees, timings and results before they ever call. NochBot answers from your brochure and website so your staff can focus on counselling.',
    linkLabel: 'Coaching institutes',
    hub: 'documents',
    problems: [
      { title: 'Repeated admission questions', body: 'Fees, batch timings and eligibility are asked by every enquiry, often after office hours.' },
      { title: 'Information lives in PDFs', body: 'The brochure and fee structure are files that visitors rarely open.' },
      { title: 'Wrong numbers cost trust', body: 'A chatbot that guesses a fee or a date is worse than no chatbot.' },
    ],
    solutions: [
      { title: 'Chat over your brochure', body: 'Upload the brochure and fee PDF, crawl the website, and visitors get answers from those documents.' },
      { title: 'Grounded answers', body: 'Replies stay within your sources. Numbers, emails, links and phone numbers that are not in the sources are retried or refused.' },
      { title: 'A share link for staff', body: 'Share a private link to the same documents so counsellors can look things up in plain language.' },
    ],
    steps: [
      'Upload the brochure, fee structure and batch list.',
      'Crawl your website so the latest pages are included.',
      'Add the script tag to your site, and re-crawl or re-upload when fees or batches change.',
    ],
    faqs: [
      { q: 'What if the fees change?', a: 'Upload the new file or re-crawl the website. The chatbot answers from the latest data you provide. It does not sync live from other tools.' },
      { q: 'Can it take enquiries or bookings?', a: 'It can take event-style registrations, such as a demo class or open day, through the booking widget.' },
      { q: 'Can I keep documents private?', a: 'Yes. Share links can require a sign-in that you approve.' },
    ],
    related: ['pdf-chatbot', 'private-knowledge-chatbot', 'chatbot-for-small-business'],
  },
  {
    slug: 'small-retail-catalogs',
    title: 'Catalog chatbot for small retailers',
    description:
      'Turn your price list spreadsheet into a chatbot customers can ask about products and prices, with answers read from your rows instead of guessed.',
    h1: 'A catalog chatbot for small shops and wholesalers',
    intro:
      'Customers ask "do you have this" and "how much is that". NochBot reads your CSV or Excel price list and answers from the rows, with filters on price and category.',
    linkLabel: 'Small retail and wholesale',
    hub: 'documents',
    problems: [
      { title: 'Price list questions all day', body: 'Staff repeat prices from a spreadsheet by phone and chat.' },
      { title: 'Big catalogs are hard to search', body: 'Customers do not scroll through hundreds of rows to find one item.' },
      { title: 'Stale prices', body: 'A PDF sent last month is wrong today, and customers still quote it.' },
    ],
    solutions: [
      { title: 'Answers from spreadsheet rows', body: 'Upload a CSV or Excel file. Questions are run as structured lookups on your columns, with meaning-based search as a fallback.' },
      { title: 'Grow the sheet', body: 'Add more rows or new columns later; items with the same ID column are updated rather than duplicated.' },
      { title: 'One link for everyone', body: 'Share a link to the catalog, optionally behind an approved sign-in for dealers.' },
    ],
    steps: [
      'Upload your price list as CSV or Excel and pick the ID column.',
      'Share the link or embed the chatbot on your site.',
      'When prices change, upload the new rows. Data updates when you upload, not by live-syncing a Google Sheet.',
    ],
    faqs: [
      { q: 'Does it sync with my Google Sheet?', a: 'No. NochBot does not live-sync a Google Sheet. Export and upload the file, or append new rows.' },
      { q: 'How big can the file be?', a: 'File size and the number of files you can add depend on your plan; the upload screen shows the current limits.' },
      { q: 'Can it take orders?', a: 'No. It answers questions about the catalog. It does not process orders.' },
    ],
    related: ['catalog-chatbot', 'chat-with-excel-csv', 'private-knowledge-chatbot'],
  },
  {
    slug: 'conference-and-workshop-organizers',
    title: 'Registration chatbot for organizers',
    description:
      'Sell tickets for conferences and workshops from your own site: a booking chatbot, payment through your gateway, QR tickets and a browser scanner for entry.',
    h1: 'A booking chatbot for conference and workshop organizers',
    intro:
      'Run registration, payment, tickets and entry without stitching four tools together. Visitors book in the chat widget on your site, and you scan them in at the door.',
    linkLabel: 'Conference and workshop organizers',
    hub: 'event-booking',
    problems: [
      { title: 'Several tools for one event', body: 'A form tool, a payment page, an email tool and a check-in list all need to agree.' },
      { title: 'Overselling', body: 'Two people paying for the last seat is a refund and an apology.' },
      { title: 'Late payments', body: 'A visitor pays after their reservation expired and the seat is gone.' },
    ],
    solutions: [
      { title: 'Seats counted atomically', body: 'Seats are held while a visitor pays and released if they do not, so you cannot sell more than your capacity.' },
      { title: 'Your own payment account', body: 'Connect Stripe, Razorpay, PayPal or Cashfree. Payments go through your account.' },
      { title: 'Late payments handled', body: 'If a payment arrives after the hold expired, the booking is confirmed when seats remain; otherwise you are alerted to refund it.' },
      { title: 'Entry from a browser', body: 'Share a scanner link with approved door staff and track scans live in the dashboard.' },
    ],
    steps: [
      'Create the event, capacity, price and form fields.',
      'Connect your payment gateway.',
      'Embed the widget and share the scanner link for the day.',
    ],
    faqs: [
      { q: 'Can I limit tickets per booking?', a: 'Yes. You can allow group bookings with a maximum number of tickets per booking.' },
      { q: 'What do attendees receive?', a: 'Each attendee with an email address gets their own QR ticket by email, with their own name on it.' },
      { q: 'Is there an app for scanning?', a: 'No app is needed. Scanning works in the browser, using the camera or a typed ticket code.' },
    ],
    related: ['event-booking-chatbot', 'event-ticket-scanner', 'how-to-add-chatbot-to-website'],
  },
];

export function getIndustry(slug: string): IndustryPage {
  const p = INDUSTRIES.find((x) => x.slug === slug);
  if (!p) throw new Error(`Unknown industry page: ${slug}`);
  return p;
}
