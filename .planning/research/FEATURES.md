# Feature Landscape

**Domain:** Multi-tenant website assistant with website/PDF knowledge chat and conversational event booking
**Researched:** 2026-10-01

## Scope and Evidence

NochBot already has three working product areas. The immediate roadmap priority is replacing the website fetch/extract layer with Scrapling while preserving the existing dashboard request shape, chunking, Gemini embedding path, `nochbot_chunks` Atlas Vector Search collection, tenant filter, and chatbot behavior. The repository brief and maps also identify two concrete crawl defects: a failed recrawl can disrupt the currently useful corpus, and the dashboard expects a per-page `pages` array while the API returns `pagesCrawled`.

**Evidence** below refers to capabilities documented by Scrapling, HTTP/Google documentation, Eventbrite's attendee workflow, or the NochBot project/codebase maps. **Recommendation** marks a product or sequencing judgment inferred from that evidence and NochBot's constraints. Scrapling and Eventbrite documentation pages did not display publication dates in the retrieved page; those are marked as accessed 2026-10-01. RFC 9110 is dated June 2022. Google Search Central pages were accessed 2026-10-01; the page did not show a publication date in the retrieved content. Confidence is MEDIUM for externally sourced ecosystem findings after cross-checking primary documentation; confidence is HIGH for current NochBot behavior when confirmed by the 2026-09-30 project brief and maps.

## Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Bounded website crawl with useful defaults** | A business owner needs to add a site without writing selectors or crawler code. | Medium | **Evidence:** Scrapling supports concurrent spiders, same-domain restrictions, crawl and sitemap templates, and configurable request limits. **Recommendation:** keep the initial dashboard action simple (`{ url }`); enforce server-side page, depth, byte, duration, concurrency, and redirect bounds. Start with same-origin discovery and an explicit canonical URL policy. |
| **Clear crawl state and per-page outcome** | A long operation that gives only a spinner or final error feels unreliable and hides partial results. | Medium | Return a stable crawl ID/status and counts for discovered, fetched, unchanged, indexed, skipped, and failed pages, with a safe reason category per page. Reconcile the current `pagesCrawled`/dashboard `pages` contract. **Recommendation:** retain the synchronous flow only for the bounded first release; durable background job progress and cancellation are a later dependency-driven improvement because crawling and sequential embeddings currently run in a request handler. |
| **Visible active knowledge state** | Users need to know what the chatbot currently knows and whether the latest crawl actually took effect. | Medium | Show active source URL, last successful crawl time, active page/chunk totals, and current/failed attempt status separately. Failed or empty recrawls must never replace the last successful corpus. **Recommendation:** publish a new generation only after crawl, extraction, chunking, embedding, and inserts succeed; then switch the active generation pointer and clean old data later. |
| **Safe manual recrawl and defined replacement semantics** | Websites change; users need an understandable way to refresh knowledge without risking a broken assistant. | High | Initially provide manual “recrawl” with all eligible pages refreshed and atomic replacement. Keep the previous generation active on any failed or below-minimum-content run; report partial success rather than silently presenting it as complete. Later add unchanged-page detection using ETag/Last-Modified validators or content fingerprints. HTTP conditional requests can avoid transferring unchanged representations; sitemap `lastmod` is a discovery hint, not proof that the content changed or a complete page inventory. |
| **Readable, relevant page extraction** | Navigation, scripts, cookie banners, and duplicate URLs degrade retrieval if embedded as knowledge. | Medium | **Evidence:** Scrapling offers Markdown conversion and main-content / CSS-selector extraction; its AI-targeted mode describes removing hidden and non-content markup. **Recommendation:** use clean Markdown as the normalized provider output; preserve title, canonical/final URL, fetch status, and page boundary. Require at least one non-empty page and non-empty chunks before publication. Make dynamic rendering a bounded fallback for pages whose static extraction is empty or below a quality threshold, not the default for every URL. |
| **Source provenance through retrieval and answers** | Grounded answers need inspectable origin so users can validate facts and open the relevant page or document. | Medium | Preserve source type, source/page URL, title, generation and (for PDFs) page number on chunks and through retrieval. Show citations in website chat and PDF chat, and an honest no-evidence response when retrieval yields no useful source. **Recommendation:** keep retrieval ranking, vector dimensions, and Gemini embedding generation unchanged during the crawler swap; source display is a product-facing metadata capability and can be delivered without replacing Atlas. |
| **Tenant isolation, URL/network safety, and polite crawling** | Crawl input is user-controlled and requests originate from NochBot infrastructure; cross-tenant exposure or internal network access is unacceptable. | High | Authenticate the dashboard action; scope every metadata/vector read and write to `userId`; allow only HTTP(S); validate DNS/IP and every redirect; reject private, loopback, link-local, and metadata-service addresses; cap response size; constrain browser subrequests and egress. Respect robots directives and configured crawl delay, use conservative per-domain concurrency, and expose skipped/denied outcomes. Scrapling documents robots support and concurrency controls; its defaults alone are not a product security policy. |
| **PDF ingest lifecycle and source management** | PDF chat is a separate knowledge source and must remain operable as website crawling changes. | Medium | Upload validation, parse/index status, clear file identity, retryable failures, replacement/removal behavior, and source/page citations are baseline expectations. Preserve the existing PDF parser, PDF vector collection and retrieval behavior while the website crawler milestone lands. **NochBot-specific note:** PDFs already have a distinct collection and route, so avoid folding them into the crawl generation migration. |
| **Event registration and order confirmation** | Attendees expect event date/location/details, available ticket choice, required buyer/attendee information, payment where applicable, and a durable confirmation/ticket. | High | **Evidence:** Eventbrite's documented purchase flow includes ticket choice, registration details, checkout, confirmation and access to tickets. **NochBot-specific recommendation:** preserve the deterministic booking state machine, form validation, capacity reservation, ticket issuance, and provider adapters; make failed/abandoned payment state and next steps explicit. |
| **Payment, capacity, and ticket integrity** | A ticketing flow must not oversell capacity, issue duplicate tickets, or report paid orders inaccurately. | High | Maintain capacity holds, verified/idempotent provider webhooks, explicit pending/paid/failed/refunded states, safe retry handling, and ticket issuance only after confirmed payment. Eventbrite supports attendee ticket access and check-in; NochBot's maps flag divergent webhook lifecycles and passive hold reconciliation, so reliability work outranks adding more providers or ticket features. |
| **Attendee lookup and check-in** | Event organizers need to validate admission and see whether an attendee has already entered. | Medium | **Evidence:** Eventbrite documents QR scanning and manual attendee search/check-in, duplicate/invalid ticket feedback, and real-time counts. **Recommendation:** retain and harden NochBot's scanner and ticket-code path; prioritize offline/resync capability only if organizer workflows demonstrate a need. |

## Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Incremental recrawl with explainable changes** | Faster refreshes and less re-embedding make the knowledge source feel maintained rather than repeatedly rebuilt. | High | After safe full-generation publishing works, persist validators/fingerprints per canonical URL, reuse unchanged page chunks, replace changed pages, and retire pages confirmed removed from the crawl inventory. Show changed/unchanged/removed counts. Do not infer deletion from a transient fetch failure or an incomplete sitemap. |
| **Crawl preview and content-quality feedback** | A quick sample lets the owner catch wrong domain scope, empty JavaScript shells, and boilerplate before it becomes chatbot knowledge. | Medium | Preview extracted title and a short Markdown excerpt, detect duplicate/near-empty pages, and warn about dynamic-render misses or high skip rates. Keep selector overrides and extraction tuning as an advanced option after evidence of recurring customer need. |
| **Sitemap-first discovery and simple include/exclude scope** | Documentation sites and larger websites can be covered more predictably than following arbitrary navigation links. | Medium | Scrapling provides a sitemap spider and Google describes sitemaps as URL discovery hints. Add sitemap-first discovery, include/exclude paths, and a visible page cap after the simple start-URL crawl. Always retain same-origin and resource limits. |
| **Scheduled recrawl and crawl history/restore** | Users can keep changing sites fresh and recover quickly from an unexpectedly poor update. | High | Requires durable background jobs, schedules/quotas, per-generation metrics and retention. Add after job state and manual atomic publishing are dependable; include one-click restore to a prior generation before supporting unattended schedules. |
| **Evidence-aware chat UX across sources** | Source badges/links, PDF page references, and “not found in your sources” responses make the assistant more trustworthy and easier to debug. | Medium | Keep website and PDF sources independently manageable, but let answers cite either source type when both are enabled. Do not claim a citation supports text it did not retrieve. |
| **Conversational ticket changes and attendee self-service** | Attendees can correct registration details or find a ticket through the same assistant they used to book. | Medium | Build on current bookings and ticket issuance; require clear authorization and audit of changes, and keep payment/refund decisions deterministic and explicit. |
| **Booking operations and reconciliation view** | Organizers can resolve the common edge cases without inspecting raw records or provider dashboards. | High | Surface pending/expired holds, webhook processing state, payment confirmation, duplicate scans and ticket resend. This is especially valuable given the current codebase's separate bot/embed booking statuses and webhook routes. |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Replace chunking, embedding model/dimensions, Atlas collection, or chatbot retrieval as part of Scrapling integration | Expands the migration blast radius and makes crawl regressions indistinguishable from retrieval regressions; the brief explicitly excludes this. | Treat Scrapling as a crawler/extraction provider behind a normalized boundary. Keep `src/lib/embeddings.ts`, `src/lib/vectorStore.ts`, tenant filters, and existing chat response contract. |
| Delete the currently active corpus before a new crawl is fully indexed | A timeout or provider/embedding failure can leave the chatbot with no working knowledge. | Stage and verify a new generation, atomically activate it, then asynchronously clean up the old generation. Preserve old data on every failed stage. |
| Report a successful crawl based only on pages fetched | HTTP success can still yield a blocked interstitial, shell, empty body, duplicate, or non-useful content. | Track fetched and indexed separately; require non-empty chunks and minimum success policy before publishing. Explain partial/empty outcomes. |
| Promise universal website coverage or default to stealth/proxy bypass | Dynamic rendering, anti-bot systems, and site policies vary; browser/proxy escalation adds cost, operational and policy exposure. | Start with ordinary HTTP fetching, bounded browser fallback, clear unsupported/blocked status, and documented authorization assumptions. Do not market bypass as a guarantee. |
| Unbounded crawl controls exposed directly to customers | Unlimited depth, concurrency, bytes, or browser rendering creates cost and SSRF/abuse risk. | Use server-side caps and plan quotas. Add only a small number of understandable controls (scope and max pages) once usage supports them. |
| Put sitemap `lastmod` or HTTP validators in charge of deleting content by themselves | Timestamps can be absent/stale and partial crawl failure is not evidence of deletion. | Use validators to skip fetches; use complete crawl inventory and successful generation semantics to remove content. Keep the prior generation until activation. |
| Merge website and PDF ingestion into one initial pipeline or vector migration | Their existing parsers, collections and routes differ; changing both raises regression risk and erases source-specific troubleshooting. | Keep separate source lifecycle and retrieval metadata while aligning shared citations and status vocabulary. |
| Expand event booking into a public event marketplace before booking integrity is reliable | Discovery is a large adjacent product with search, moderation, payouts and supply-side acquisition needs, while the current core value is booking through customer assistants. | Improve the existing organizer-configured event, registration, payment, ticket and check-in lifecycle first. |
| Add more payment providers or advanced ticket tiers before fixing state consistency | More adapters amplify existing webhook, hold and ticketing edge cases. | Consolidate lifecycle expectations, idempotency and reconciliation across existing adapters before provider expansion. |

## Feature Dependencies

```text
Authenticated crawl request + SSRF/egress policy + server-side bounds
  -> Scrapling provider and normalized page result
  -> per-page crawl status + quality/empty-content checks
  -> preserve page/source metadata through existing chunker
  -> existing Gemini embeddings + Atlas insert (new generation)
  -> atomic active-generation switch
  -> existing user-scoped retrieval reads active generation
  -> cited chatbot answer and visible source status

Durable job state
  -> live progress, cancel/retry, background crawl/embedding
  -> scheduled recrawl and crawl history
  -> incremental page reuse and generation restore

PDF parsing/status + page metadata -> existing PDF embeddings/retrieval -> PDF page citations

Event configuration + capacity reservation + registration state machine
  -> provider checkout + verified/idempotent payment webhook
  -> booking confirmation + ticket issuance
  -> attendee ticket access + scan/check-in + reconciliation
```

## MVP Recommendation

For the first roadmap slice, prioritize:

1. **Safe, bounded Scrapling crawl behind the existing `/api/crawl` contract.** Return normalized per-page outcome/status fields and preserve current plan quota checks, tenant scoping, and same-origin crawl behavior.
2. **Good-enough content and observable ingestion.** Extract clean main-content Markdown; track fetched, skipped, failed, and indexed pages; preserve source URL/title/page boundaries through existing chunking and embedding.
3. **Failure-safe publication with retrieval continuity.** Stage and embed a new corpus, activate it only after minimum-quality success, then clean old vectors. Keep existing Atlas collection, vector dimensions, embedding generation and chatbot retrieval; repair the active-generation filter compatibility path deliberately.

For follow-on website scope, add a durable job/progress model before introducing scheduled recrawls, cancellation, incremental page reuse, and restore history. Add sitemap/path controls and richer preview once bounded crawl usage shows that owners need them. This ordering addresses the current destructive replacement risk first and avoids mixing scraper, embedding, retrieval, and database changes in a single rollout.

For the other feature areas, keep separate roadmap tracks. PDF chat should focus on reliable upload/parse/index/delete status and page-level citations without entering the website corpus migration. Event booking should prioritize payment/webhook lifecycle correctness, capacity-hold expiry, ticket confirmation, attendee lookup, and check-in before broader marketplace or provider expansion.

**Suggested initial success measures (recommendation, not established baseline):** successful crawl generation publication rate; crawls with at least one useful indexed page; failed recrawls that preserve prior searchable content; indexed/fetched page ratio and median crawl duration; citation click/use rate or source-open events; PDF ingestion success; booking completion rate; paid booking-to-ticket confirmation rate; duplicate/invalid scan rate. Establish current baselines before setting targets, as the project brief notes that success metrics are not yet established.

Defer claims about ideal crawl size, dynamic fallback rate, booking conversion targets, and recrawl cadence until representative customer sites and usage are measured. The retrieved public sources describe available mechanisms and established user workflows, not NochBot-specific demand or target values.

## Sources

### Primary external sources

- Scrapling, [Generic Spider Templates](https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html), accessed 2026-10-01; publication date not shown. Documents crawl-link and sitemap spider patterns.
- Scrapling, [Spider Getting Started](https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html), accessed 2026-10-01; publication date not shown. Documents domain bounds, robots handling, crawl-delay and crawl statistics.
- Scrapling, [Advanced Spider Features](https://scrapling.readthedocs.io/en/latest/spiders/advanced.html), accessed 2026-10-01; publication date not shown. Documents concurrency, delay, autothrottle, pause/resume and cache behavior.
- Scrapling, [Building RAG Systems](https://scrapling.readthedocs.io/en/latest/ai/building-rag-systems.html), accessed 2026-10-01; publication date not shown. Documents Markdown extraction, main-content selection and vector-pipeline handoff.
- Scrapling, [Fetchers Basics](https://scrapling.readthedocs.io/en/latest/fetching/choosing.html), accessed 2026-10-01; publication date not shown. Documents fetcher capability tradeoffs including JavaScript rendering.
- IETF, [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html), published June 2022. Defines conditional GET behavior for `If-None-Match` and `If-Modified-Since`.
- Google Search Central, [Build and Submit a Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), accessed 2026-10-01; publication date not shown in retrieved page. Describes sitemap submission as a crawl hint rather than a guarantee.
- Eventbrite Help Center, [Checkout on Eventbrite](https://www.eventbrite.com/help/en-us/articles/333111/), accessed 2026-10-01; publication date not shown. Documents attendee ticket selection, checkout details, order confirmation and ticket access.
- Eventbrite Help Center, [Check in attendees with the Organizer app](https://www.eventbrite.com/help/en-gb/articles/741083/how-to-check-in-attendees-at-the-event-with-eventbrite-organizer/), accessed 2026-10-01; publication date not shown. Documents QR check-in, manual lookup and duplicate/invalid ticket feedback.
- Eventbrite Help Center, [Request a refund and manage tickets](https://www.eventbrite.com/help/en-us/articles/783059/how-to-use-the-eventbrite-iphone-app/), accessed 2026-10-01; publication date not shown. Documents ticket access, cancellation/refund request, organizer contact and event updates.

### NochBot project evidence

- `.planning/PROJECT.md`, last updated 2026-10-01: product scope, active requirements, constraints and known crawl/RAG behavior.
- `.planning/codebase/ARCHITECTURE.md`, analysis 2026-09-30: route-handler, embedding, vector-store, PDF and booking component boundaries.
- `.planning/codebase/CONCERNS.md`, analysis 2026-09-30: synchronous crawl/embedding, non-destructive generation gap, SSRF concerns, webhook divergence and missing durable background jobs.
- `.planning/codebase/INTEGRATIONS.md` and `.planning/codebase/STACK.md`, analysis 2026-09-30: Gemini embeddings, MongoDB Atlas Vector Search, PDF parser, payment adapters and current crawler dependencies.
- `docs/scrapling-integration-plan.md` and `.planning/features/{website-crawling,pdf-knowledge-chat,event-booking}/README.md`: existing integration decisions, acceptance expectations and per-area boundaries.
