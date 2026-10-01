# Project Research Summary

**Project:** NochBot  
**Domain:** Multi-tenant business assistant with website and PDF knowledge chat plus conversational event booking  
**Researched:** 2026-10-01  
**Confidence:** MEDIUM

## Executive Summary

NochBot is an existing multi-tenant product with working website knowledge chat, PDF chat, and event booking areas. The highest-priority roadmap work is replacing the website fetch and extraction layer with Scrapling while preserving current Atlas/RAG behavior. The research recommends a private Python crawler service behind a small provider adapter in the existing Next.js application. Keep URL authorization, tenant and quota enforcement, chunking, Gemini embeddings, Atlas persistence and retrieval, and chatbot behavior in the existing application.

The first crawler release should be bounded and static-first, return normalized per-page outcomes, and stage a new knowledge generation before activation. Preserve the last useful corpus on failed or low-quality recrawls; explicitly defend against SSRF through URL resolution, redirects, DNS, robots requests, and browser subrequests. Do not treat Scrapling page caps or domain settings as the complete security policy. Keep PDF knowledge chat and event booking as separate roadmap areas after the crawler work, preserving their existing data paths and lifecycle rules. Add crawler scheduling, incremental updates, and other automation only after the bounded flow is reliable and measured.

## Key Findings

### Recommended Stack

The recommendation is to retain the existing Next.js App Router and TypeScript application, MongoDB Atlas Vector Search, current embedding model and dimensions, and existing chat retrieval. Add a separately deployed, private Python service using a pinned Scrapling release. Scrapling should fetch pages and return Markdown and crawl outcomes; it should not own tenant data, embeddings, or database writes. Use a static HTTP spider by default and only a tightly budgeted browser-rendering fallback for pages with insufficient static content. See [STACK.md](.planning/research/STACK.md).

**Core technologies:**
- Next.js App Router and TypeScript: keep the existing authenticated `/api/crawl` boundary and orchestration.
- Python and Scrapling: isolate the crawler and its browser/runtime dependencies; pin versions and verify the selected spider API before implementation.
- MongoDB Atlas Vector Search and existing Gemini embeddings: preserve the current collection, dimensions, tenant filters, and RAG path.

**Evidence and confidence:** STACK.md was completed by the orchestrator after the assigned stack researcher timed out. It cites Scrapling, Next.js, and MongoDB official documentation and NochBot's existing stack map, but it is not an independently completed researcher artifact. Its stated confidence is MEDIUM; the Scrapling release, Python version, and `SiteToMarkdownSpider` extension points still need verification before implementation.

### Expected Features

The highest-value crawler requirements are safe bounded discovery, useful Markdown extraction, visible per-page outcomes, accurate fetched-versus-indexed status, and failure-safe publication. Keep the current `{ url }` request shape and reconcile the dashboard's expected `pages` array with the API's `pagesCrawled` response. The MVP is not a new RAG stack: reuse current chunking, embeddings, Atlas collection, and retrieval. See [FEATURES.md](.planning/research/FEATURES.md).

**Must have (table stakes):**
- Server-enforced crawl limits, exact-origin and redirect policy, SSRF defenses, robots compliance, tenant isolation, and crawl outcome reporting.
- Staged generation publication that leaves the previous active corpus available on failed or empty recrawls.
- Separate, operable PDF source lifecycle and reliable event registration, payment, capacity, ticket, and check-in workflows.

**Should have (competitive):**
- Crawl preview and content-quality feedback, sitemap/path controls, explainable incremental recrawls, history and restore.
- Clear source citations and evidence-aware answers across website and PDF knowledge.
- Event booking reconciliation for pending payments, holds, webhook state, ticket resend, and scan outcomes.

**Defer (v2+):**
- Durable crawl jobs, cancellation, schedules, and incremental reuse until a bounded synchronous flow is dependable and observed latency justifies the added job system.
- Adaptive selectors, universal site coverage, stealth or proxy bypass, and a public event marketplace.
- More payment providers or advanced ticket features until booking and webhook state consistency is reliable.

### Architecture Approach

The Next.js route remains the authenticated policy and data boundary and calls a private Python crawler through a provider contract. Scrapling applies bounded discovery and returns normalized page records and aggregate statistics. Existing application helpers chunk and embed the result, stage user-scoped Atlas vectors under a generation ID, and switch the active generation only after a searchable readiness policy passes. Existing chat continues to retrieve with both tenant and active-generation filters. Keep PDF ingestion and its distinct vector collection independent from the website generation migration. See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md).

**Major components:**
1. Dashboard and Next.js `/api/crawl`: preserve the request contract; authenticate, validate URL, enforce quotas and fixed bounds, orchestrate ingestion.
2. Provider adapter and private Scrapling service: normalize transport and outcomes; enforce crawl, network, and browser limits; do not access Atlas or tenant records.
3. Existing ingestion, knowledge metadata, and vector store: preserve chunk/embed behavior; stage and activate generations without weakening owner filters.
4. Existing website chat, PDF chat, and booking subsystems: retain their separate retrieval and transactional boundaries while adding roadmap work in those feature areas.

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for evidence and detection details.

1. **SSRF through submitted URLs and secondary requests**: validate scheme, resolved IPs, redirects, robots fetches, and browser subrequests; pair application checks with private service ingress and restricted egress.
2. **Failed recrawl destroys usable knowledge**: stage a complete candidate generation and activate only after minimum-quality ingestion and Atlas search visibility; retain the previous generation until then.
3. **Configured page limits do not bound all work**: independently cap scheduled requests, depth, bytes, time, redirects, browser work, and concurrency before enqueue and after redirect resolution.
4. **Robots, blocked pages, and partial results are misreported**: respect RFC 9309 outcomes, honor retry guidance, expose skipped and failed pages, and distinguish fetched from indexed counts.
5. **Integration changes silently break RAG or dashboard behavior**: preserve embeddings, dimensions, metadata, response fields, and tenant filters; validate retrieval end to end, including the embedded chat path and PDF non-regression.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Scrapling Website Crawl With RAG Continuity
**Rationale:** This is the stated priority and the critical prerequisite for future website knowledge improvements. It replaces only fetching and extraction while closing the current recrawl data-loss and response-shape risks.  
**Delivers:** Private pinned Scrapling service, provider adapter, bounded static-first crawling, normalized per-page outcomes, compatible dashboard/API response, staged generation publication, and Atlas readiness/legacy-generation policy.  
**Addresses:** Bounded crawl, readable extraction, crawl status, active knowledge visibility, safe recrawl, tenant safety, and source provenance.  
**Avoids:** SSRF, crawl expansion, robots invisibility, partial-success confusion, premature deletion/activation, vector drift, and `pages`/`pagesCrawled` mismatch.

### Phase 2: PDF Knowledge Chat and Source Lifecycle
**Rationale:** Keep PDF work distinct from the website crawler migration because NochBot already has separate PDF parsing, routes, and vector storage. This lets PDF requirements advance without expanding crawler blast radius.  
**Delivers:** Clear upload/parse/index status, retry and replacement/removal semantics, reliable PDF source identity, page-level citations, and honest no-evidence behavior while retaining current PDF retrieval.  
**Uses:** Existing PDF parser, PDF vector collection, and retrieval path; shared source/citation vocabulary where appropriate.  
**Avoids:** Merging PDF and website ingestion prematurely or mixing their vectors and lifecycle failures.

### Phase 3: Event Booking Integrity and Operations
**Rationale:** Treat booking as a separate feature area. The research and codebase maps call out payment/webhook divergence and passive hold reconciliation, so state correctness should precede provider or marketplace expansion.  
**Delivers:** Consistent capacity holds, verified idempotent payment transitions, accurate confirmation and ticket issuance, attendee lookup/check-in, and operational reconciliation for pending or failed states.  
**Addresses:** Registration, payment/capacity/ticket integrity, and organizer check-in expectations.  
**Avoids:** Overselling, duplicate tickets, false paid status, inconsistent bot/embed booking state, and hidden webhook failures.

### Phase 4: Website Crawl Automation and Scale
**Rationale:** Schedule and incremental features depend on durable job state, reliable publication, and observed usage; they are not prerequisites for the first Scrapling rollout.  
**Delivers:** Durable progress/cancellation, crawl history and restore, incremental change detection, and then scheduled recrawls or richer sitemap/path controls as validated by customer use.  
**Uses:** The provider boundary, normalized outcomes, generation model, and operational metrics from Phase 1.  
**Avoids:** Unbounded synchronous work, deleting content based on transient failures or stale validators, and building automation without measured demand.

### Phase Ordering Rationale

- Complete the crawler replacement first because it is the explicit roadmap priority and must preserve the existing Atlas/RAG contract.
- Keep PDF ingestion out of the website generation change; its parser, collection, and route are already separate and can be improved as their own feature area.
- Address booking lifecycle correctness as a separate area after the crawler and PDF priorities; avoid adjacent marketplace or provider expansion until its state transitions are reliable.
- Defer crawl schedules and incremental reuse until the synchronous path, security policy, publication gate, and per-page accounting are proven.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Verify the exact pinned Scrapling API, Python/browser runtime, request scheduling and depth hooks, robots accounting, hard request budgets, private deployment/egress controls, and Atlas generation visibility. Validate against fixtures before relying on library options as security controls.
- **Phase 3:** Map existing booking/payment state transitions and webhook handlers; settle idempotency, hold expiry, reconciliation, and ticket issuance behavior across the bot and embedded flows.
- **Phase 4:** Research durable job/queue options and operational costs only when usage or latency justifies this phase.

Phases with standard patterns (skip research-phase):
- **Phase 2:** PDF upload, parse status, source management, and page citations follow established patterns, provided planning verifies NochBot's current parser and vector contracts from the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Official framework/database/crawler references and the codebase stack map support the direction. The artifact was completed by the orchestrator after the assigned researcher timed out; exact Scrapling release/API and Python runtime remain unpinned. |
| Features | MEDIUM | Strong alignment between project maps and established source workflows; ecosystem docs show available mechanisms, not NochBot demand, targets, or conversion baselines. |
| Architecture | MEDIUM | Fits mapped Next.js routes, helper boundaries, and Atlas retrieval. Scrapling docs move, and generation/index-readiness semantics need verification against the deployed Atlas setup. |
| Pitfalls | HIGH | Strong coverage from OWASP, RFC, MongoDB, Playwright, and Scrapling documentation; implementation-specific protections still need pinned-version and deployment verification. |

**Overall confidence:** MEDIUM

### Gaps to Address

- Pin Scrapling and Python/browser versions; verify `SiteToMarkdownSpider`, extension hooks, URL scope, robots behavior, and page/request caps against that exact release.
- Confirm hosting environment supports private service-to-service calls, restricted egress, browser process limits, and request deadlines.
- Inspect actual Atlas index definitions and current legacy chunks before choosing the generation filter migration and searchable activation gate.
- Define crawl quotas, minimum publishable-content policy, retry/idempotency semantics, and success baselines from current usage; research documents mechanisms but not NochBot-specific targets.
- Validate PDF and booking roadmap scope against their current code and customer workflows; the research describes separate needs but does not establish demand or priority beyond the sequence supplied for this roadmap.

## Sources

### Primary (HIGH confidence)
- OWASP, [Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) and [Google Cloud private networking for Cloud Run](https://docs.cloud.google.com/run/docs/securing/private-networking) — URL/network threat controls and service isolation.
- IETF [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) — robots exclusion protocol semantics.
- MongoDB [Vector Search operator and pre-filtering](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorsearch/) and [index performance and consistency](https://www.mongodb.com/docs/search/performance/index-performance/) — dimensions, filters, and index visibility considerations.
- Official [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) documentation — existing application boundary.

### Secondary (MEDIUM confidence)
- Scrapling [generic spider templates](https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html), [spider architecture](https://scrapling.readthedocs.io/en/latest/spiders/architecture.html), [RAG guide](https://scrapling.readthedocs.io/en/latest/ai/building-rag-systems.html), and [v0.4.15 release](https://github.com/D4Vinci/Scrapling/releases/tag/v0.4.15) — spider capabilities, Markdown flow, and version candidate; verify against the pinned package.
- Playwright [BrowserContext](https://playwright.dev/python/docs/api/class-browsercontext) and [Page](https://playwright.dev/python/docs/api/class-page) APIs — browser request controls and finite timeouts.
- Google AI for Developers [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — embedding constraints and quota considerations.
- Eventbrite [Checkout](https://www.eventbrite.com/help/en-us/articles/333111/) — attendee checkout and ticket workflow reference, not evidence of NochBot-specific demand.

### Project Evidence
- `.planning/PROJECT.md` and the current codebase maps: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, and `.planning/codebase/TESTING.md` (2026-09-30).
- `docs/scrapling-integration-plan.md` — existing project proposal and constraints.
- Detailed research: [STACK.md](.planning/research/STACK.md), [FEATURES.md](.planning/research/FEATURES.md), [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md), and [PITFALLS.md](.planning/research/PITFALLS.md), all dated 2026-10-01.

---
*Research completed: 2026-10-01*  
*Ready for roadmap: yes*
