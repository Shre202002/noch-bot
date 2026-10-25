/**
 * Content for the public search landing pages (one route per entry under src/app/<slug>/page.tsx).
 *
 * Keep every claim true of the product as shipped: no invented numbers, customers or reviews, no live Google Sheets
 * sync, no WhatsApp delivery. Plan limits are edited by admins at runtime, so pages never quote them.
 */

export const SITE_URL = 'https://nochbot.space';

export type SeoPage = {
  slug: string;
  /** Page title without the brand; the root layout appends " | NochBot". Keep it under 50 characters. */
  title: string;
  /** Meta description, at most 160 characters. */
  description: string;
  primaryKeyword: string;
  keywords: string[];
  h1: string;
  intro: string;
  /** Short label for links to this page from other pages and the footer. */
  linkLabel: string;
  features: Array<{ title: string; body: string }>;
  /** Longer prose sections for pages that target competitive searches. */
  guide?: Array<{ title: string; paragraphs: string[] }>;
  steps: Array<{ title: string; body: string }>;
  useCases: Array<{ title: string; body: string }>;
  /** What the product does not do, stated plainly. */
  limits: string[];
  faqs: Array<{ q: string; a: string }>;
  related: string[];
};

export const SEO_PAGES: SeoPage[] = [
  {
    slug: 'free-ai-chatbot-for-website',
    title: 'Free AI Chatbot for Your Website',
    description:
      'Add an AI chatbot to your website for free. NochBot reads your pages and answers visitors from your content. One script tag, no coding. Start on the free plan.',
    primaryKeyword: 'free ai chatbot for website',
    keywords: ['free ai chatbot for website', 'ai chatbot for website', 'chatbot for website free', 'ai chatbot for website india'],
    h1: 'A free AI chatbot for your website, trained on your own content',
    linkLabel: 'Free AI chatbot for your website',
    intro:
      'NochBot reads the pages of your website and answers your visitors from them, day and night. You start on the free plan, paste one script tag, and the chat widget appears on your site. Built for small businesses, creators and event organizers in India and everywhere else.',
    features: [
      {
        title: 'Answers from your website, not from guesses',
        body: 'Enter your website address and NochBot reads your pages. Visitors get answers based on what your site actually says, and the assistant checks replies for numbers, emails, links and phone numbers that are not in your content.',
      },
      {
        title: 'One script tag',
        body: 'Copy a single line of code and paste it into your site before the closing body tag. It works on any website that lets you add a script.',
      },
      {
        title: 'Matches your brand',
        body: 'Set the colours and greeting so the widget looks like part of your site.',
      },
      {
        title: 'See what visitors ask',
        body: 'Every conversation is saved in your dashboard, with simple analytics, so you learn what people want and what your site is missing.',
      },
      {
        title: 'Grows with you',
        body: 'The free plan is for trying NochBot on a real site. Paid plans raise the monthly message, crawl and document limits when you need more.',
      },
    ],
    guide: [
      {
        title: 'What a free chatbot plan can and cannot do',
        paragraphs: [
          'The free plan is meant for trying NochBot on a real website, not for running a busy support desk. It has monthly limits on how many visitor messages the assistant answers, how many times you can crawl a site, and how many pages each crawl reads. Paid plans raise those limits. The exact numbers are shown in the pricing section of the homepage and can change, so check there rather than relying on a figure copied into a blog post.',
          'When the monthly message limit is reached, visitors are told the assistant is unavailable until the limit resets at the start of the next month, or until you move to a paid plan. Nothing is lost: your content and conversation history stay in your dashboard.',
        ],
      },
      {
        title: 'An illustrative example',
        paragraphs: [
          'Imagine a dental clinic whose website has three pages: opening hours, treatments and a fee list. After NochBot reads those pages, a visitor can ask whether the clinic is open on Sunday and get the answer from the hours page, or ask what a cleaning costs and get the figure from the fee list. If the fee list does not mention root canal treatment, the assistant is built to say it does not have that information rather than make up a price.',
          'This example is only an illustration of how the tool behaves. The quality of your answers depends on what your own pages say.',
        ],
      },
      {
        title: 'Free chatbot options compared',
        paragraphs: [
          'Free website chatbots generally fall into three groups. Hosted builders offer a free tier with a small monthly allowance and ask you to upgrade for more. Open-source projects cost nothing to download but you pay for hosting and for the language model, and you need a developer to set them up. Live-chat tools sometimes add a basic bot, but it usually follows scripted flows instead of reading your pages.',
          'NochBot sits in the first group. It reads your website, PDFs and spreadsheets, answers from them, and also handles event bookings with payments, which most chatbot builders do not. Compare the monthly limits of each free plan against how many questions your visitors actually ask before deciding.',
        ],
      },
      {
        title: 'Getting better answers from a free plan',
        paragraphs: [
          'Put important facts in plain text on your pages. Hours, prices and policies shown only inside images cannot be read. After you change a page, run the crawl again so the assistant sees the update. Test it with the real questions your customers send, and use the conversation history in your dashboard to find questions it could not answer. Those gaps usually point to missing information on your site.',
        ],
      },
    ],
    steps: [
      { title: 'Create a free account', body: 'Sign up with Google, or with your email and confirm it with a one-time code.' },
      { title: 'Enter your website address', body: 'NochBot crawls your pages and prepares them for questions.' },
      { title: 'Style the widget', body: 'Pick colours and a welcome message.' },
      { title: 'Paste the script', body: 'Add the one-line script to your site and the chat button appears.' },
    ],
    useCases: [
      { title: 'Local businesses', body: 'Opening hours, services, prices and directions answered without a phone call.' },
      { title: 'Course and coaching sites', body: 'Syllabus, fees, batch dates and eligibility questions answered instantly.' },
      { title: 'Portfolios and agencies', body: 'Let visitors ask about services, process and past work before they contact you.' },
    ],
    limits: [
      'The free plan has monthly limits on messages, crawls and pages per crawl. Check the pricing section for current limits.',
      'NochBot answers from the content it has read. If your site does not say something, the assistant will not invent it.',
      'After you change your website, run the crawl again so the assistant sees the new pages.',
    ],
    faqs: [
      {
        q: 'Is the AI chatbot really free?',
        a: 'Yes. You can start on the free plan and try NochBot on a real site. It has monthly limits, and paid plans raise them.',
      },
      {
        q: 'Do I need to know how to code?',
        a: 'No. You paste one script tag where your site lets you add custom code. Most website builders and CMS tools have a place for it.',
      },
      {
        q: 'Will it work on my website?',
        a: 'It works on any website where you can add a script before the closing body tag, including WordPress and custom sites.',
      },
      {
        q: 'Can it answer in India-specific contexts like INR prices?',
        a: 'It answers from your own content, so whatever your site says about prices, currencies and locations is what visitors hear.',
      },
      {
        q: 'What happens when I reach the free limit?',
        a: 'Visitors see that the assistant is unavailable until the limit resets next month or you move to a paid plan.',
      },
    ],
    related: ['how-to-add-chatbot-to-website', 'chatbot-for-small-business', 'event-booking-chatbot'],
  },
  {
    slug: 'chatbot-for-small-business',
    title: 'AI Chatbot for Small Business',
    description:
      'Answer customer questions around the clock with an AI chatbot trained on your website and documents. Simple setup for small businesses. Start free with NochBot.',
    primaryKeyword: 'ai chatbot for small business',
    keywords: ['ai chatbot for small business', 'customer support chatbot', 'ai assistant for small business website'],
    h1: 'An AI chatbot for small business that answers customers from your own information',
    linkLabel: 'AI chatbot for small business',
    intro:
      'Most small teams answer the same questions every day: prices, timings, availability, how to book. NochBot reads your website, price lists and brochures, and answers those questions for you at any hour, in your own words and branding.',
    features: [
      {
        title: 'Trained on what you already have',
        body: 'Use your website, PDF brochures and price lists. There is nothing to rewrite and no flow charts to draw.',
      },
      {
        title: 'Share a catalog or price list by link',
        body: 'Upload a spreadsheet or PDF and send customers a link where they can ask about products and prices.',
      },
      {
        title: 'Take bookings in the same chat',
        body: 'If you run events, classes or workshops, visitors can register and pay without leaving the conversation.',
      },
      {
        title: 'Your data stays yours',
        body: 'Each account only searches its own content. Your documents are never mixed with another business.',
      },
    ],
    guide: [
      {
        title: 'The questions it takes off your plate',
        paragraphs: [
          'Small teams answer the same handful of questions again and again: what do you charge, when are you open, where are you, do you have this in stock, how do I book. These questions arrive at night and on weekends, when nobody is there to reply, and a visitor who does not get an answer often moves on to a competitor.',
          'NochBot answers those questions from your own website, brochures and price lists, so the answers match what you already publish. It does not need scripted flows or decision trees.',
        ],
      },
      {
        title: 'A realistic first week',
        paragraphs: [
          'Day one: create an account, enter your website address and let NochBot read it. Day two: ask it twenty real questions your customers have sent you and note any it gets wrong. Day three: upload your price list or brochure as a PDF or spreadsheet to fill the gaps. Day four: style the widget and paste the script on your site. Day five: read the conversation history to see what visitors actually ask, and fix the pages that caused confusion.',
        ],
      },
      {
        title: 'What it will not replace',
        paragraphs: [
          'A chatbot is a first responder, not a replacement for you. Complaints, special requests, refunds and anything that needs judgement should reach a person. Put your phone number, email or booking link in your website content so the assistant can point customers to it when they need more than an answer.',
        ],
      },
      {
        title: 'Choosing a plan as a small business',
        paragraphs: [
          'Start on the free plan and watch how many messages you use in a month. If visitors regularly hit the limit, or you want to keep more documents or crawl more pages, move to a paid plan. Because limits apply per month, you can upgrade when your traffic grows instead of paying for capacity you do not use, and you can move back down if a busy season ends.',
        ],
      },
    ],
    steps: [
      { title: 'Add your website or files', body: 'Enter your web address, upload a PDF, or upload a spreadsheet.' },
      { title: 'Check the answers', body: 'Ask a few real customer questions in the dashboard.' },
      { title: 'Go live', body: 'Paste the script on your site or share the document link.' },
    ],
    useCases: [
      { title: 'Shops and distributors', body: 'Customers ask about items and prices from your catalog.' },
      { title: 'Clinics, salons and studios', body: 'Services, timings and policies answered without staff on the phone.' },
      { title: 'Schools and training institutes', body: 'Fees, courses and admission questions handled automatically.' },
    ],
    limits: [
      'It answers from the content you provide, so keep your website and files up to date.',
      'It is not a live human handover tool. For complex cases, show your contact details in your content.',
      'Monthly limits depend on your plan.',
    ],
    faqs: [
      {
        q: 'How is this different from a generic chatbot?',
        a: 'It only uses the content you give it, so answers are about your business and not about the internet in general.',
      },
      {
        q: 'Can I use it without a website?',
        a: 'Yes. Upload a PDF or spreadsheet and share the link with customers.',
      },
      {
        q: 'How long does setup take?',
        a: 'Most sites take a few minutes: add the address, check a few answers, paste the script.',
      },
      {
        q: 'What does it cost?',
        a: 'There is a free plan to try it on a real site, and paid plans with higher limits. See the pricing section on the homepage.',
      },
    ],
    related: ['free-ai-chatbot-for-website', 'catalog-chatbot', 'event-booking-chatbot'],
  },
  {
    slug: 'how-to-add-chatbot-to-website',
    title: 'How to Add a Chatbot to Your Website',
    description:
      'Step by step: add an AI chatbot to any website with one script tag. Train it on your pages, style it, and go live in minutes with NochBot. No coding needed.',
    primaryKeyword: 'how to add a chatbot to a website',
    keywords: ['how to add a chatbot to a website', 'embed ai chatbot on website', 'embed chatbot in website free', 'add chatbot to website'],
    h1: 'How to add an AI chatbot to your website, step by step',
    linkLabel: 'How to add a chatbot to your website',
    intro:
      'You can put an AI chatbot on your website in about five minutes without writing code. This guide uses NochBot: you point it at your site, it learns your pages, and you paste a single script tag.',
    features: [
      {
        title: 'Why one script tag is enough',
        body: 'The script loads the chat button and the conversation window. All the work of searching your content and writing the answer happens on NochBot servers, so your website stays fast and simple.',
      },
      {
        title: 'Where the script goes',
        body: 'Paste it just before the closing body tag of your pages, or into the "custom code" or "footer scripts" box of your website builder or theme.',
      },
      {
        title: 'The same script adds bookings',
        body: 'If you create events in NochBot, the same script lets visitors register and pay from your page.',
      },
    ],
    guide: [
      {
        title: 'Before you start',
        paragraphs: [
          'You need three things: a NochBot account, a website whose pages contain the information visitors ask about, and a place on your site where you can paste a script. If your pages show hours or prices only as images, add the same details as text first, because the assistant can only answer from text it can read.',
        ],
      },
      {
        title: 'Where to paste the script on common platforms',
        paragraphs: [
          'WordPress: add the script to your theme footer file, or use a header and footer plugin so it survives theme updates. Shopify: edit the theme layout file and paste the script just before the closing body tag. Website builders such as Wix, Squarespace and Webflow: look for a custom code or embed area in the site settings. Some builders only allow custom scripts on paid plans, so check yours. Plain HTML sites: paste the line before the closing body tag of every page where the chat should appear.',
        ],
      },
      {
        title: 'If the chat button does not appear',
        paragraphs: [
          'First clear your browser cache and reload, because many hosts and plugins cache pages. Check that the script was saved on the page and that your user id is correct. If your site sends a Content Security Policy header, it must allow scripts from nochbot.space. Some ad blockers hide chat widgets, so test in a private window. Open the browser console: a blocked or failed script usually leaves a clear error message.',
        ],
      },
      {
        title: 'After it is live',
        paragraphs: [
          'Watch the conversation history for a week. Questions the assistant could not answer show you which information is missing from your site. Add it to a page and run the crawl again. If you change prices or opening hours, re-crawl so the assistant stays accurate.',
        ],
      },
    ],
    steps: [
      { title: 'Create an account', body: 'Sign up with Google, or with your email and confirm it with a one-time code.' },
      { title: 'Let NochBot read your site', body: 'Enter your website address on the dashboard. NochBot crawls your pages and prepares them for questions.' },
      { title: 'Test the answers', body: 'Ask questions your customers ask. If an answer is wrong, the page is usually missing the information.' },
      { title: 'Style the widget', body: 'Choose colours and the opening message.' },
      {
        title: 'Copy the embed code',
        body: 'On the Embed page, copy the script. It looks like a script tag with your account id: <script src="https://nochbot.space/embed.js" data-user-id="YOUR_ID" defer></script>.',
      },
      { title: 'Paste it on your site and publish', body: 'Reload your site. The chat button should appear in the corner.' },
    ],
    useCases: [
      { title: 'WordPress and custom themes', body: 'Add the script in your theme footer or a header and footer plugin.' },
      { title: 'Website builders', body: 'Use the custom code or embed area if your plan allows custom scripts.' },
      { title: 'Hand-coded sites', body: 'Paste the line before the closing body tag.' },
    ],
    limits: [
      'Your website builder must allow custom scripts. Some free builder plans block them.',
      'The chat button needs the script to load, so ad blockers that block unknown scripts may hide it for some visitors.',
      'Re-run the crawl after big content changes so answers stay current.',
    ],
    faqs: [
      {
        q: 'Can I add a chatbot to my website for free?',
        a: 'Yes, NochBot has a free plan. You can try it on a real site before choosing a paid plan.',
      },
      {
        q: 'Do I need a developer?',
        a: 'Not for most sites. If you can paste text into a custom code box, you can add the chatbot.',
      },
      {
        q: 'Will the chatbot slow down my website?',
        a: 'The script is loaded with defer so it does not block the page from showing.',
      },
      {
        q: 'Can I remove the chatbot later?',
        a: 'Yes. Delete the script tag from your site and the chat button disappears.',
      },
      {
        q: 'Does it work on mobile?',
        a: 'Yes. The widget is built for phones and desktops.',
      },
    ],
    related: ['free-ai-chatbot-for-website', 'chatbot-for-small-business', 'event-booking-chatbot'],
  },
  {
    slug: 'event-booking-chatbot',
    title: 'Event Registration Chatbot with Payments',
    description:
      'Let visitors register, pay and receive QR tickets in a chat on your website. Works with Stripe, Razorpay, PayPal and Cashfree. Free or paid events.',
    primaryKeyword: 'event registration chatbot',
    keywords: ['event registration chatbot', 'event registration software', 'ticket booking chatbot', 'event registration bot', 'event ticketing with payments'],
    h1: 'An event registration chatbot that takes bookings, payments and issues QR tickets',
    linkLabel: 'Event registration chatbot',
    intro:
      'Visitors ask about your event, register, pay and receive a QR ticket in the same conversation on your website. You see every booking in your dashboard, check people in at the door, and handle late payments in one place.',
    features: [
      {
        title: 'Booking inside the chat',
        body: 'When a visitor says they want to attend, the assistant walks them through your registration form step by step.',
      },
      {
        title: 'Your own registration form',
        body: 'Choose the questions you need, in the order you want, for each event.',
      },
      {
        title: 'Free and paid events',
        body: 'Run free events or take payments with Stripe, Razorpay, PayPal or Cashfree, using your own payment account.',
      },
      {
        title: 'Seats are protected',
        body: 'Seats are held while someone pays and released if they do not, so you do not oversell.',
      },
      {
        title: 'QR tickets by email',
        body: 'Confirmed bookings get a ticket with a QR code, sent to the attendee by email.',
      },
      {
        title: 'Late payments handled',
        body: 'If a payment arrives after the held seat expired, it is confirmed when seats remain and flagged for refund when they do not, so nothing is lost silently.',
      },
    ],
    guide: [
      {
        title: 'What a booking looks like for the visitor',
        paragraphs: [
          'A visitor opens the chat on your event page and asks whether there is a workshop on Saturday. The assistant answers from your content. When the visitor says they want to attend, the assistant starts the registration: it asks how many tickets, then the questions you chose for the form, one at a time. For a paid event the visitor is sent to pay with your payment provider. When the payment clears, a QR ticket arrives by email. A free event skips the payment step.',
        ],
      },
      {
        title: 'Before you go live',
        paragraphs: [
          'Create the event with its date, venue, capacity and price. Choose your registration questions and connect your payment provider with your own keys. Use test mode to run through the whole flow, including a payment, before real attendees arrive. Then add the one-line script to the page where the event is advertised.',
        ],
      },
      {
        title: 'Running the door',
        paragraphs: [
          'Open the Scanning tab to get a scanner link for the event and send it to your door staff. Each person creates a Login ID and you approve them. At the entrance they scan ticket QR codes with a phone camera, or type the code if a screen will not scan. Your dashboard shows each scan as it happens, and a ticket that has already been used is flagged.',
        ],
      },
      {
        title: 'When a payment arrives late',
        paragraphs: [
          'Seats are held while someone pays and released if they do not finish in time. If a payment still arrives after the hold expired, NochBot confirms the booking when a seat is still free. If the event has sold out in the meantime, the booking is marked as needing a refund and you are alerted, so the attendee is not left paying for a seat that does not exist. You make the refund in your payment provider and then mark the booking as refunded.',
        ],
      },
      {
        title: 'Chatbot booking or a plain registration form?',
        paragraphs: [
          'A form is simple and works well when visitors already know they want to register. A chat is better when visitors have questions first: dates, venue, fees, who the event is for. They can ask and register in the same place, so fewer people leave to look for the answer. NochBot gives you both on one script, so you do not have to choose between answering questions and taking bookings.',
        ],
      },
    ],
    steps: [
      { title: 'Create the event', body: 'Add the date, venue, capacity, ticket price and registration questions.' },
      { title: 'Connect payments', body: 'Add your payment provider keys, or keep the event free.' },
      { title: 'Add the script to your site', body: 'The same script that shows the chatbot also offers booking.' },
      { title: 'Check in guests', body: 'Share a scanner link with your door staff to scan tickets.' },
    ],
    useCases: [
      { title: 'College fests and workshops', body: 'Registrations, fees and entry passes in one place.' },
      { title: 'Conferences and meetups', body: 'Limited seats, QR tickets and quick check-in.' },
      { title: 'Classes and training batches', body: 'Collect details and fees from visitors who already asked a question.' },
    ],
    limits: [
      'You connect your own payment provider. NochBot does not hold your money.',
      'Test mode is available so you can try the full flow before going live.',
      'Refunds are made in your payment provider. NochBot marks the booking as refunded afterwards.',
    ],
    faqs: [
      {
        q: 'What is an event registration chatbot?',
        a: 'It is a chat assistant on your website that answers questions about your event and also registers visitors, takes payment and issues tickets.',
      },
      {
        q: 'Which payment providers are supported?',
        a: 'Stripe, Razorpay, PayPal and Cashfree.',
      },
      {
        q: 'Can I run a free event?',
        a: 'Yes. Free events skip payment and still issue a ticket.',
      },
      {
        q: 'How do tickets work?',
        a: 'Each confirmed booking gets a QR ticket by email. Your door staff scan it with the scanner link.',
      },
      {
        q: 'What if two people book the last seat?',
        a: 'Seats are reserved one at a time, so only one booking gets the last seat.',
      },
    ],
    related: ['event-ticket-scanner', 'free-ai-chatbot-for-website', 'chatbot-for-small-business'],
  },
  {
    slug: 'event-ticket-scanner',
    title: 'QR Ticket Scanner for Events, No App',
    description:
      'Scan event QR tickets from a phone browser. No app to install. Share one link with door staff, approve who can scan, and watch check-ins live. Part of NochBot.',
    primaryKeyword: 'qr code ticket scanner for events',
    keywords: ['qr code ticket scanner', 'event check-in', 'ticket scanner no app', 'event ticket scanning'],
    h1: 'A QR ticket scanner for events that runs in the browser',
    linkLabel: 'QR ticket scanner for events',
    intro:
      'Share one link with your door staff. They create a login, you approve them, and they scan attendee QR tickets with a phone camera. There is no app to install.',
    features: [
      {
        title: 'No app',
        body: 'The scanner runs in the phone browser. The camera needs a secure (https) connection.',
      },
      {
        title: 'One link per event',
        body: 'Each event has its own scanner link. Staff sign in with a Login ID and you approve them from your dashboard.',
      },
      {
        title: 'Scan or type',
        body: 'Use the camera for QR codes, or type the ticket code if a screen is cracked or a code will not scan.',
      },
      {
        title: 'Live feed',
        body: 'Your dashboard shows each scan as it happens, so you can see the entry rate and spot duplicate scans.',
      },
      {
        title: 'Duplicate protection',
        body: 'A ticket that was already used is flagged, so the same QR code cannot get two people in.',
      },
    ],
    steps: [
      { title: 'Sell tickets with NochBot', body: 'Bookings issue QR tickets by email.' },
      { title: 'Share the scanner link', body: 'Open the Scanning tab and send the link to your door staff.' },
      { title: 'Approve staff', body: 'Staff create a Login ID. You approve each one.' },
      { title: 'Scan at the door', body: 'Point the camera at the QR code. The result shows at once.' },
    ],
    useCases: [
      { title: 'Concerts and festivals', body: 'Several staff scan in parallel at multiple gates.' },
      { title: 'Colleges and workshops', body: 'Volunteers check in students from their own phones.' },
      { title: 'Conferences', body: 'Fast check-in for pre-registered attendees, with the booking details one tap away so staff can answer questions at the desk.' },
    ],
    limits: [
      'Tickets are the ones issued by NochBot bookings, so tickets sold on another platform cannot be scanned here.',
      'A staff session works on one device at a time: signing in on a new device signs out the old one.',
      'Rotating the scanner link signs every scanner out.',
    ],
    faqs: [
      { q: 'Do my staff need to install an app?', a: 'No. The scanner runs in a normal phone browser.' },
      { q: 'Can I limit who can scan?', a: 'Yes. Each staff member creates a Login ID and you approve it before they can scan.' },
      { q: 'What if a QR code will not scan?', a: 'Type the ticket code instead.' },
      { q: 'Can one ticket be used twice?', a: 'No. A ticket already used is flagged at the next scan.' },
    ],
    related: ['event-booking-chatbot', 'free-ai-chatbot-for-website', 'chatbot-for-small-business'],
  },
  {
    slug: 'chat-with-excel-csv',
    title: 'CSV and Excel Chatbot: Chat With Spreadsheets',
    description:
      'Upload a CSV or Excel file and share a chatbot link. Customers ask in plain language and get answers from your rows, with filters for price and category.',
    primaryKeyword: 'csv to chatbot',
    keywords: ['csv to chatbot', 'excel chatbot', 'chat with csv', 'spreadsheet chatbot', 'excel to chatbot'],
    h1: 'Turn a CSV or Excel file into a chatbot you can share',
    linkLabel: 'CSV and Excel chatbot',
    intro:
      'Upload a spreadsheet and NochBot gives you a link. Anyone with the link can ask questions in plain language: "which items are under 500?" or "best for the beach". Answers come from your rows.',
    features: [
      {
        title: 'Real answers from rows',
        body: 'Questions like counts, filters and totals are run against your data, not guessed from text.',
      },
      {
        title: 'Search by meaning',
        body: 'Describe what you want in your own words and NochBot ranks rows by meaning, while hard filters such as price and category still apply.',
      },
      {
        title: 'Keep it current',
        body: 'Add more rows or a new version of the sheet. Rows are matched by an ID column you choose, so existing rows update instead of duplicating.',
      },
      {
        title: 'Share or restrict',
        body: 'Send a public link, or require visitors to sign in with an account you approve.',
      },
    ],
    steps: [
      { title: 'Upload your file', body: 'CSV or Excel, up to 10 MB per file.' },
      { title: 'Pick an ID column', body: 'Optional, and recommended for sheets you plan to update.' },
      { title: 'Create a share link', body: 'Copy the link or embed it.' },
      { title: 'Add rows later', body: 'Upload again to add or update rows.' },
    ],
    useCases: [
      { title: 'Price lists and inventory', body: 'Customers check items and prices without calling you.' },
      { title: 'Directories and schedules', body: 'Members find a person, a room or a time.' },
      { title: 'Internal sheets', body: 'Staff ask questions of a sheet without filters or pivot tables.' },
    ],
    limits: [
      'Data updates when you upload or add a new file. It does not live-sync from Google Sheets or Excel online.',
      'Each plan limits how many documents and extra files you can keep.',
      'Files over 10 MB are rejected.',
    ],
    faqs: [
      { q: 'Does it work with Google Sheets?', a: 'Export the sheet to CSV or Excel and upload it. Live syncing is not available.' },
      { q: 'Can customers edit my data?', a: 'No. The link only lets them ask questions.' },
      { q: 'How do I update prices?', a: 'Upload the new file or add rows. Rows with the same ID are updated.' },
      { q: 'Is it free?', a: 'There is a free plan with a small document limit. Paid plans raise it.' },
    ],
    related: ['catalog-chatbot', 'private-knowledge-chatbot', 'pdf-chatbot'],
  },
  {
    slug: 'catalog-chatbot',
    title: 'Catalog Chatbot: Share Your Product Catalog',
    description:
      'Turn your product catalog or price list into a chatbot with a share link. Customers and dealers ask about items and prices. Upload a PDF or spreadsheet.',
    primaryKeyword: 'catalog chatbot',
    keywords: ['catalog chatbot', 'product catalog chatbot', 'product catalogue chatbot', 'price list chatbot', 'wholesale catalog chatbot'],
    h1: 'A catalog chatbot your customers can open from a link',
    linkLabel: 'Catalog chatbot',
    intro:
      'Upload your product catalog or price list as a PDF or spreadsheet and send customers one link. They ask about items, prices and availability in plain language, and get answers from your own file.',
    features: [
      { title: 'PDF or spreadsheet', body: 'Use the catalog you already have. A spreadsheet gives the best answers for filtering by price or category.' },
      { title: 'One source of truth', body: 'Update the file once and every shared link answers from the latest version.' },
      { title: 'Private when you need it', body: 'Require a sign-in that you approve, so only your dealers or members can open the link.' },
      { title: 'Cites its source', body: 'PDF answers point to the document and page they came from.' },
    ],
    steps: [
      { title: 'Upload the catalog', body: 'PDF, CSV or Excel.' },
      { title: 'Create the link', body: 'Optionally require sign-in.' },
      { title: 'Send it to customers', body: 'By email, message or on your website.' },
      { title: 'Update when prices change', body: 'Add the new file. The link stays the same.' },
    ],
    useCases: [
      { title: 'Wholesalers and distributors', body: 'Dealers check prices and stock details themselves.' },
      { title: 'Retail shops', body: 'Customers ask about items before they visit.' },
      { title: 'Service providers', body: 'Packages and rates explained from your rate card.' },
    ],
    limits: [
      'It answers from the file you upload, so out-of-date files give out-of-date answers.',
      'It does not take orders by itself. Add your contact details or ordering steps in the catalog.',
      'It is a web link, not a WhatsApp catalog.',
    ],
    faqs: [
      { q: 'What is a catalog chatbot?', a: 'A chat assistant that answers questions from your product catalog or price list.' },
      { q: 'Can I restrict who sees it?', a: 'Yes. Require visitors to sign in and approve each account.' },
      { q: 'Do I need a website?', a: 'No. You share the link directly, by email, message or on a QR code you print yourself.' },
      { q: 'Can I update the catalog?', a: 'Yes. Upload a new version or add more rows. If your sheet has an ID column, rows with the same ID are updated instead of duplicated, so the link always reflects your latest prices.' },
      { q: 'Which is better, a PDF or a spreadsheet?', a: 'A spreadsheet is better when customers filter by price, size or category, because rows can be searched and filtered exactly. A PDF is better when the layout and photos matter, and answers point back to the page.' },
    ],
    related: ['chat-with-excel-csv', 'private-knowledge-chatbot', 'chatbot-for-small-business'],
  },
  {
    slug: 'private-knowledge-chatbot',
    title: 'Private Knowledge Base Chatbot with Share Links',
    description:
      'Keep your documents and data in one place and give your team, dealers or members a chatbot link with sign-in you control. Centralised, private, simple. NochBot.',
    primaryKeyword: 'centralized knowledge base chatbot',
    keywords: ['centralized knowledge base chatbot', 'private chatbot link', 'password protected chatbot', 'ai knowledge base chatbot', 'single source of truth chatbot'],
    h1: 'One knowledge base, one chatbot link, with access you control',
    linkLabel: 'Private knowledge base chatbot',
    intro:
      'Keep your handbook, price list or data sheet in one place. NochBot turns it into a chatbot, and you decide who gets the link and who must sign in.',
    features: [
      { title: 'One place for your data', body: 'Upload PDFs and spreadsheets once. Add more files to the same document as it grows.' },
      { title: 'Sign-in you approve', body: 'People request an account for the link and you approve or block them.' },
      { title: 'One device per person', body: 'A new sign-in replaces the old session, which discourages sharing a login.' },
      { title: 'Deleted by mistake? Restore', body: 'Deleted documents can be restored for seven days.' },
    ],
    steps: [
      { title: 'Upload your documents', body: 'PDF, CSV or Excel.' },
      { title: 'Turn on sign-in', body: 'Create the link with login required.' },
      { title: 'Approve people', body: 'Review requests from your dashboard.' },
      { title: 'Keep it current', body: 'Add files or update rows when your data changes.' },
    ],
    useCases: [
      { title: 'Dealers and distributors', body: 'Partner-only price lists and product details.' },
      { title: 'Teams and clubs', body: 'Policies, schedules and FAQs in one place.' },
      { title: 'Members-only information', body: 'Content shared with approved people only.' },
    ],
    limits: [
      'Access control applies to share links. It is not a full enterprise identity system.',
      'Each plan limits documents and extra files.',
      'Data updates when you upload, not by live sync.',
    ],
    faqs: [
      { q: 'Can only approved people open the link?', a: 'Yes, when you create the link with login required.' },
      { q: 'Can someone share their login?', a: 'Each account works on one device at a time, and repeated sign-ins can lock the account until you unblock it.' },
      { q: 'Does it mix my data with others?', a: 'No. Searches are scoped to your account, so your documents are never searched when someone asks another business\'s chatbot a question.' },
      { q: 'Can I add more files later?', a: 'Yes, within your plan limits. Add extra PDFs to a document, or add rows and new sheets to a spreadsheet, and the same link keeps working.' },
      { q: 'What is the difference between this and a public chatbot link?', a: 'A public link can be opened by anyone who has it. With sign-in required, each person needs an account that you approve first, which suits partner price lists and internal information.' },
    ],
    related: ['catalog-chatbot', 'chat-with-excel-csv', 'pdf-chatbot'],
  },
  {
    slug: 'pdf-chatbot',
    title: 'PDF Chatbot for Business with a Share Link',
    description:
      'Upload brochures, manuals or policies as PDFs and share a chatbot link. Answers point to the document and page. Add more files as you grow. Try NochBot free.',
    primaryKeyword: 'pdf chatbot for business',
    keywords: ['pdf chatbot for business', 'chat with pdf', 'pdf chatbot share link', 'pdf question answering for customers'],
    h1: 'A PDF chatbot for your business, shared with a link',
    linkLabel: 'PDF chatbot with share link',
    intro:
      'Upload your PDFs and share a link. Customers, students or staff ask questions and get answers with the document and page they came from.',
    features: [
      { title: 'Answers with sources', body: 'Replies point to the document and page when the page is known.' },
      { title: 'Share by link', body: 'Send the link or put it on your website. Optionally require sign-in.' },
      { title: 'Add more files', body: 'Add extra PDFs to the same document within your plan.' },
      { title: 'See what is asked', body: 'Chats and basic analytics appear in your dashboard.' },
    ],
    steps: [
      { title: 'Upload a PDF', body: 'Text-based PDFs work best.' },
      { title: 'Check the status', body: 'Parsing, indexed, ready, or failed with a reason. Retry failed ones.' },
      { title: 'Create the share link', body: 'Choose public or sign-in required.' },
      { title: 'Send it', body: 'Customers start asking right away.' },
    ],
    useCases: [
      { title: 'Brochures and prospectuses', body: 'Prospective students or buyers ask the document directly.' },
      { title: 'Manuals and policies', body: 'Staff find answers without reading 80 pages.' },
      { title: 'Terms and guidelines', body: 'Customers check conditions on their own.' },
    ],
    limits: [
      'Scanned PDFs without selectable text may fail to parse.',
      'Files are limited to 10 MB each, and each plan limits how many documents you keep.',
      'Answers are only as good as the PDF, so keep your documents current and clearly written.',
    ],
    faqs: [
      { q: 'Does it show where the answer came from?', a: 'Yes. Answers can point to the document and page.' },
      { q: 'Can I share it publicly?', a: 'Yes, or require sign-in with accounts you approve.' },
      { q: 'What if a PDF fails?', a: 'It shows a reason in your dashboard. Retry the upload, or upload a text-based version if the original is a scan.' },
      { q: 'Can I use CSV or Excel too?', a: 'Yes. Spreadsheets get their own share links and can answer questions about counts, filters and totals. See the CSV and Excel chatbot page.' },
      { q: 'Can I delete a document and get it back?', a: 'Yes. A deleted document and its link are hidden at once and can be restored for seven days, after which they are removed.' },
    ],
    related: ['catalog-chatbot', 'chat-with-excel-csv', 'private-knowledge-chatbot'],
  },
];

export function getSeoPage(slug: string): SeoPage {
  const page = SEO_PAGES.find((p) => p.slug === slug);
  if (!page) throw new Error(`Unknown SEO page: ${slug}`);
  return page;
}
