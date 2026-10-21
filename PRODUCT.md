# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: event organizers.** People running events, workshops, and conferences who sign up, connect their website, and configure the assistant themselves. Their job: let website visitors get answers about the event and register, buy tickets, and pay without leaving the conversation, then manage bookings and check attendees in at the door.

Secondary audiences that exist in the product but are not the design priority:
- **Website visitors** who talk to the embedded assistant (the organizer's audience, not NochBot's customer).
- **Scanner staff** assigned per event to validate QR tickets on entry.
- **General businesses** using the assistant only for content Q&A, without events.

## Product Purpose

NochBot adds a configurable AI assistant to an organization's website. The assistant answers from the organization's own website content and uploaded PDFs, and guides visitors through event registration, ticketing, and payment in the same chat.

Success: visitors get correct, grounded answers and complete the next step (a booking) inside the assistant. No baseline metric is established yet; answer quality and completed bookings are the intended measures.

## Positioning

**Answer and book in one chat.** A generic website chatbot answers questions; NochBot also runs the event funnel end to end inside the conversation: collect custom registration fields, hold capacity, take payment through the organizer's own gateway, and issue QR tickets that staff scan at the door.

## Operating Context

- **Organizer setup (dashboard, `/dashboard`)**: Configure flow in five steps (Crawl website → Vectorize → Theme → Preview → Embed). The theme can be extracted from the organizer's site. Embedding is a single script tag (`public/embed.js`) or the `/bot` page.
- **Events**: create events, design registration form fields (drag-and-drop ordering), set ticket design and logo, connect a payment gateway per event, publish, view bookings, assign scanner staff.
- **PDF RAG**: upload PDFs, chat with them, create public share links, view per-session PDF analytics.
- **Monitoring**: analytics and conversation history for the website assistant.
- **Door check-in**: scanner staff scan QR tickets, with offline sync support.

## Capabilities and Constraints

- Plans: **free**, **starter**, **pro** with monthly limits (free: 100 messages, 1 website crawl, up to 15 pages per crawl, 1 PDF). Pricing and conversion model are not validated.
- Payment gateways: Stripe, Razorpay, PayPal, Cashfree; credentials belong to the organizer and are stored encrypted.
- Answers must stay grounded in the organization's own content; when the content has no answer the assistant says so rather than inventing one.
- When the AI provider is unavailable, visitors get a plain "contact the website owner" reply, not an error.
- Every knowledge search and write is scoped to the owning account (tenant isolation).
- Terminology in the product: *Bot Config*, *Crawl*, *Vectorize*, *Embed*, *PDF RAG*, *scanner staff*.
- Undecided: success metric baseline, pricing.

## Brand Commitments

- Name: **NochBot**. Live at nochbot.space.
- Audience: **global**, English.
- Voice: **professional**: crisp, direct, business-appropriate. Avoid hype and casual filler in product and marketing copy.
- Existing logo assets: `public/Noch-bot-logo.svg`, `public/nohbot.png`.

## Evidence on Hand

- Product demo video: `public/Final_Video.mp4`.
- A working live deployment (nochbot.space).
- **No** customer testimonials, logos, case studies, usage numbers, or press exist in the repository. Future work must not fabricate any of these.

## Product Principles

1. **Event funnel first.** Prioritize what helps an organizer turn a visitor's question into a confirmed, paid booking.
2. **Grounded or silent.** The assistant answers from the organizer's content or says it does not know; never a confident guess.
3. **Organizer self-serve.** A non-developer organizer must be able to go from website URL to embedded, booking-capable assistant without help.
4. **Fail safe for visitors.** Outages, quota limits, and failed crawls degrade to a clear, polite state and never remove working knowledge or show raw errors to visitors.
5. **Professional trust.** Payments and personal data pass through this product; copy and flows should read as dependable, not playful.
