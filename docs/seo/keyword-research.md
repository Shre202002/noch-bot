# NochBot keyword research

Date: 2026-10-25. Product: embeddable AI chatbot trained on a website, plus chat with PDF/CSV/Excel, plus event booking with payments, tickets and QR scanning. Live site: https://nochbot.space

## How to read the numbers
- **Keyword density** was measured on the live homepage (initial HTML plus the copy in the landing components). It is a real count, but the homepage is client-rendered, so treat it as approximate.
- **Search volume and keyword difficulty** need a keyword data provider. None is connected to this session, so no monthly figures are given here and none were invented. Demand and competition are shown as tiers inferred from who ranks on the live results (large vendors with huge domains = hard; thin vendor template pages = easier). Replace the tiers with real numbers using Google Keyword Planner (free with a Google Ads account) or the DataForSEO extension that the SEO skill installed (needs your DataForSEO login).
- **Location** is covered twice: where each keyword belongs on the page, and which countries to target.

## 1. Current on-page state (what search engines see today)
| Item | Finding |
|---|---|
| Title | `NochBot \| AI Chatbot Platform` (brand plus one generic phrase) |
| Meta description | "Deploy your own branded AI chatbot, trained on your data. Multi-tenant. Instant. Powered by Groq LLaMA." |
| Headings in server HTML | **None** (no H1, H2 or H3). The page is rendered in the browser, so crawlers get a thin shell |
| Words in initial HTML | about 256 |
| `keywords` meta tag | Present, but Google ignores it, so it does nothing |
| Sitemap | `/`, `/docs`, `/privacy`, `/terms` only. No pages for PDF chat or event booking |

### Keyword density (homepage, about 256 words)
| Keyword | Count | Density | Verdict |
|---|---|---|---|
| nochbot | 7 | 2.7% | Brand, fine |
| ai chatbot platform | 3 | 3.5% | Fine, do not add more |
| ai chatbot | 3 | 2.3% | OK |
| chatbot | 6 | 2.3% | OK |
| website | 1 | 0.4% | Too low |
| ai assistant, website chatbot, custom chatbot, rag chatbot | 0 | 0% | Missing |
| pdf chatbot, chat with pdf | 0 | 0% | Missing |
| event booking, ticketing, ticket, payment | 0 | 0% | Missing |
| customer support, knowledge base, your data, train, embed, no-code, lead generation | 0 | 0% | Missing |

The page repeats the generic term and says almost nothing about what makes NochBot different. Every differentiator (PDF and spreadsheet chat, event booking, payments, QR tickets) is at zero.

Target density: one primary keyword per page at 1-2% of the words, supporting phrases at 0.3-1% each. Above about 3% reads as stuffing.

## 2. Keyword clusters
Demand and difficulty are tiers: VH very high, H high, M medium, L low.

| Cluster | Example keywords | Intent | Demand | Difficulty | Who ranks | Priority |
|---|---|---|---|---|---|---|
| A. Head terms | ai chatbot, chatbot for website, ai chatbot platform | Mixed | VH | VH | Intercom, Tidio, Botpress and other big vendors | Support only |
| B. Train on your data | train chatbot on your website data, chatbot trained on your data, custom chatgpt for website, rag chatbot for website, no-code ai chatbot builder | Commercial | H | H | Chatbase, SiteGPT, CustomGPT.ai, DocsBot, Wonderchat | Secondary |
| C. Chat with documents | chat with pdf, pdf chatbot, chat with excel, chat with csv, share pdf chatbot link | Tool | VH (chat with pdf) | VH for "chat with pdf", M for the long forms | ChatPDF, ChatPDF.so, Jotform, ChatMaxima | Long forms only |
| D. Event booking (best opportunity) | event registration chatbot, event ticket booking chatbot, chatbot ticket booking with payment, ai event registration assistant, qr code ticket scanner for events | Commercial | M | L-M | Template pages from AiSensy, Tars, Jotform, Robofy, TicketSignup | **Primary** |
| E. India and local | ai chatbot for small business india, chatbot with razorpay payment, event registration chatbot india, college fest registration chatbot | Commercial | L-M | L | Hyperleap, Cyfuture, Haptik blogs | **Primary** |
| F. Brand | nochbot, nochbot ai chatbot | Navigational | L | None | Only you | Protect |

Why D and E are the best bet: the big vendors above fight over A, B and C. Almost nobody combines a website chatbot with booking, payment, tickets and door scanning, and the results for event chatbots are mostly generic vendor templates. Indian pricing context from the results: Haptik sells SMB agents at about ₹10,000 for 2,000 conversations, about ₹3-5 per conversation (their own figure). Entry plans elsewhere start free.

## 3. Where each keyword goes (placement map)
| Page | Primary keyword | Supporting keywords | Title | H1 |
|---|---|---|---|---|
| `/` homepage | ai chatbot for your website | train on your data, embeddable widget, no-code | `AI Chatbot for Your Website, Trained on Your Data \| NochBot` | "An AI chatbot that answers from your website and books events" |
| `/event-booking-chatbot` (new) | event registration chatbot | ticket booking chatbot, payments, qr tickets, razorpay | `Event Registration Chatbot with Payments and QR Tickets \| NochBot` | "Let visitors register, pay and get tickets in chat" |
| `/pdf-chatbot` (new) | pdf chatbot | chat with pdf, chat with excel, share link | `PDF Chatbot: Chat With PDFs, CSV and Excel \| NochBot` | "Turn your documents into a shareable chatbot" |
| `/chatbot-for-small-business` (new) | ai chatbot for small business | customer support, india pricing | `AI Chatbot for Small Business, From ₹0 \| NochBot` | "Answer customer questions around the clock" |
| `/docs` | nochbot embed script | install chatbot, script tag | Keep as is, add keywords to headings | Existing |

Placement rules for every page:
1. Primary keyword in the title (first 60 characters), the H1, the first 100 words, one H2, the URL slug and the image alt text.
2. Supporting keywords in H2s and the opening sentence of sections, not scattered.
3. Meta description about 150 characters with the primary keyword and one benefit.
4. Server-render the headings and body copy (Next.js server components), so crawlers see about 600-1,000 words per page instead of about 256.
5. Add FAQ content with `FAQPage` schema and `SoftwareApplication` schema on the homepage.

## 4. Target locations
| Priority | Location | Why |
|---|---|---|
| 1 | India | The app prices in INR, supports Razorpay and Cashfree, and the Gmail-only signup points to an Indian SMB audience. Competition is lowest here |
| 2 | United States, United Kingdom | Largest English-language demand for chatbot terms, but competition is highest. Target cluster D long-tail phrases rather than head terms |
| 3 | UAE, Singapore, Australia | English-speaking markets with event and SMB demand. Add later if bookings come from there |

Set the country in Google Search Console and use `en-IN` on India-focused pages.

## 5. Catalog and centralised-data chatbot (the share-link feature)

What the feature is, in search terms: a business uploads a PDF, CSV or Excel catalog or price list once, gets a share link, and customers, dealers or staff chat with it. The sheet is the single source of truth: add or update rows (matched by an ID column) and every shared link answers from the latest data. Rows are searchable by meaning ("best for the beach") with hard filters such as price or category, and a link can require a login that the owner approves.

What the live results show (vendor pages, so treat claims with care): [Voiceflow](https://docs.voiceflow.com/changelog/csv-upload-for-knowledge-base) takes CSV and XLSX into a knowledge base; [aichat](https://help.aichat.com/productcatalog) imports a product catalog from CSV; [Wonderchat](https://wonderchat.io/tools/csv-to-chatbot-generator) offers a CSV-to-chatbot generator; [Aurora Inbox](https://www.aurorainbox.com/en/2026/03/07/how-to-upload-pdf-catalogs-chatbot-whatsapp/) covers PDF catalogs on WhatsApp; [QuickSell](https://learn.quicksell.co/en/articles/6349813-catalogue-sharing) sells shareable catalogue links; [Taskade](https://www.taskade.com/convert/spreadsheet/excel-to-chatbot) shares a spreadsheet agent by link. Most are help-centre or tool pages, not focused landing pages. One source also notes that stale prices and stock make catalog bots give poor answers, which is the problem a single updatable source of truth solves.

### Keyword groups
| Group | Example keywords | Intent | Demand | Difficulty | Priority |
|---|---|---|---|---|---|
| G1. Catalog chatbot | catalog chatbot, product catalog chatbot, product catalogue chatbot, chatbot for product catalog, price list chatbot, wholesale catalog chatbot, catalog chatbot with share link | Commercial | M | M | **Primary** |
| G2. Spreadsheet to chatbot | csv to chatbot, excel to chatbot, spreadsheet chatbot, chat with csv, inventory chatbot | Tool | H | M for "csv to chatbot", VH for "chat with excel" | Secondary (long forms) |
| G3. Centralised data | centralized knowledge base chatbot, single source of truth chatbot, company data chatbot, ai chatbot for internal documents, chatbot for dealers and distributors | Commercial | L-M | L-M | **Primary** |
| G4. Private sharing | password protected chatbot link, private chatbot link with login, share chatbot with customers, shareable ai chatbot | Commercial | L | L | **Primary** (low competition) |
| G5. Attribute search | search catalog by price and category chatbot, ai product finder from spreadsheet | Commercial | L | L | Support copy |

Spell both "catalog" and "catalogue" on the page: the second is common in India and the UK.

Avoid "whatsapp catalog chatbot" for now. That search is about the WhatsApp Business catalog, and NochBot shares a web link, so visitors would bounce. Target it only if you add WhatsApp delivery.

### Where these go
| Page | Primary keyword | Supporting keywords | Title | H1 |
|---|---|---|---|---|
| `/catalog-chatbot` (new) | catalog chatbot | product catalogue chatbot, price list chatbot, share link, wholesale | `Catalog Chatbot: Share Your Product Catalog as a Chat Link \| NochBot` | "Turn your catalog into a chatbot customers can open from a link" |
| `/chat-with-excel-csv` (new) | csv to chatbot | excel to chatbot, spreadsheet chatbot, upload spreadsheet | `CSV and Excel to Chatbot: Chat With Your Spreadsheet \| NochBot` | "Upload a spreadsheet, share a chatbot" |
| `/private-knowledge-chatbot` (new) | centralized knowledge base chatbot | single source of truth, login protected link, dealers and distributors | `Centralised Knowledge Base Chatbot With Private Links \| NochBot` | "One source of truth, a chatbot for everyone who needs it" |

These replace the idea of a single `/pdf-chatbot` page: keep `/pdf-chatbot` for "chat with PDF" and let these three carry the catalog and database angle.

### Copy points that match what searchers want
1. One file, one link: update the sheet and everyone sees current prices (addresses the "stale data" problem seen in the results).
2. Real answers from rows, with filters on price and category, not just keyword matching.
3. Private by default option: the owner approves who can open the link.
4. Be honest about freshness: data updates when you upload or append, not by live-syncing a Google Sheet. Do not claim live sync.

### Target locations for this feature
India first (price lists, wholesale and dealer catalogs are a strong small-business use case, and the results show demand for low-cost INR tools such as Botsify from ₹999/month and Haptik at about ₹3-5 per conversation by their own figures), then UAE and UK for wholesale and distributor catalogs.

## 6. Quick-win keywords: high demand, low to medium difficulty
Method (2026-10-25): I pulled Google's live autocomplete for 35 seed phrases (India, English) and checked who ranks on the results page for the best candidates. Autocomplete shows what real people type, so a phrase with many variants has real demand, but it gives no monthly count. "High" below means many autocomplete variants plus a broad topic; I could not confirm "very high" for any phrase without a volume tool. Difficulty is judged by who ranks: big brands and app stores = hard, small vendor blogs and directories = medium, thin or off-topic pages = easy.

### Go after these (ranked)
| # | Keyword | Demand evidence | Who ranks (difficulty) | Intent | Page |
|---|---|---|---|---|---|
| 1 | free ai chatbot for website (and "chatbot for website free", "ai chatbot for my website free") | Variants: free, wordpress, github, india, price, reddit | Make Tech Easier, Dante AI, FastBots, Userdesk, Embeddable: mid-size blogs, no giants. **Medium** | Commercial, people want a free plan | `/` plus `/free-ai-chatbot-for-website` |
| 2 | ai chatbot for small business | Variants: best, setup, customer service, free | Whisperchat, FastBots, Chatbase blog, Bluehost, plus low-quality pages. **Medium** | Commercial | `/chatbot-for-small-business` |
| 3 | event registration software free / india / for nonprofits | Autocomplete: nonprofits, free, india, conference, event management | India page is directories (SourceForge, G2, Capterra) and niche vendors. **Medium** for the "free/india" forms, harder for the plain head term | Commercial | `/event-booking-chatbot` |
| 4 | how to add a chatbot to a website (and "embed ai chatbot on website", "embed chatbot in website free") | Autocomplete shows how-to and free variants | How-to guides. **Medium**, and you can win with a real copy-paste script and screenshots | Informational, converts | Blog or `/docs/embed-chatbot` |
| 5 | no code ai chatbot builder (best / free) | Autocomplete: best, free, bot builder | Vendor and listicle pages. **Medium** | Commercial | `/` and blog |
| 6 | ai chat widget for website (free) | Variants: free, widget, chatbot | Widget directories and vendors. **Low-medium** | Commercial | `/` |
| 7 | qr code ticket scanner for events (no app) | Autocomplete: app, barcode, online, apk | App-store listings and organizer-tied apps. **Medium**; you win on "scan in the browser, no app" | Commercial | `/event-ticket-scanner` (new) |
| 8 | excel chatbot / csv chatbot (for customers) | Autocomplete: excel chatbot, ai, github | Boei, Formula Bot, SDK pages. **Medium** (avoid "chat with excel": Microsoft Copilot dominates) | Tool | `/chat-with-excel-csv` |
| 9 | ai chatbot for website india | Variant of the top phrase | Fewer India-specific pages. **Low-medium** | Commercial | `/` with `en-IN` |
| 10 | ai knowledge base chatbot | Autocomplete: bot, custom knowledge base | HubSpot and vendors. **Medium-high**, use as support | Commercial | `/private-knowledge-chatbot` |
| 11 | ticket booking chatbot | Autocomplete: bot, system, github | Thin vendor templates (Robofy and others). **Low**, but demand is also low-medium | Commercial | `/event-booking-chatbot` |
| 12 | event registration bot | Autocomplete variant | Very few focused pages. **Low** | Commercial | `/event-booking-chatbot` |

Best first three to build for traffic: #1, #2 and #4. Best for buyers who convert: #3 and #7, because few chatbot sites cover events.

### Do not target (high demand, wrong fight or wrong audience)
| Keyword | Why not |
|---|---|
| chat with pdf, pdf chatbot (head terms) | Very high demand but dominated by ChatPDF-style tools. The related searches are developers ("github", "langchain", "python", "project") |
| chat with excel | Microsoft Copilot fills the results |
| rag chatbot, chatbot project github | High demand from students and developers, not buyers. Fine for a blog post, not for the homepage |
| ticket booking bot | Results are about scalper bots and ticket-buying scripts. Wrong intent, possible policy risk |
| ai chatbot, chatbot for website (head) | Intercom, Tidio, Botpress and the like. Not winnable yet |
| whatsapp catalog chatbot | Needs WhatsApp delivery, which NochBot does not offer |

### How to confirm before you invest
1. Put the top 12 into Google Keyword Planner (free with a Google Ads account) and read the monthly range for India and the US. Keep those showing at least 1K monthly searches.
2. For the same phrases, search in a private window and check whether the top 5 results are small or large sites. Pages from sites with low authority in the top 5 mean a new site can compete.
3. Send me the export and I will replace these tiers with the numbers.

## 7. Next steps
1. Server-render the homepage headings and copy, and rewrite the title, description and H1 as in section 3 (largest single gain).
2. Publish `/event-booking-chatbot` first, then `/pdf-chatbot`.
3. Remove the ineffective `keywords` meta tag or leave it, but do not rely on it.
4. Pull real volume and difficulty from Keyword Planner or DataForSEO and replace the tiers in section 2.
5. Re-measure density after the rewrite.
