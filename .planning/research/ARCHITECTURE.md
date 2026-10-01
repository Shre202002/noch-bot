# Architecture Patterns

**Domain:** Brownfield SaaS website crawling and RAG ingestion  
**Project:** NochBot  
**Researched:** 2026-10-01  
**Overall confidence:** MEDIUM

## Recommended Architecture

Keep Scrapling behind a private Python crawler service and let the current Next.js application remain the product and data boundary. The browser continues to call `POST /api/crawl` with `{ "url": string }`. The authenticated route validates the URL, checks the account and crawl quota, supplies server-owned bounds, and calls the crawler provider. Scrapling returns normalized page records; the existing application performs chunking, Gemini embedding, MongoDB writes, generation activation, and later Atlas Vector Search retrieval.

Use Scrapling's `SiteToMarkdownSpider` as the initial implementation candidate because its documented output is explicitly a per-page Markdown corpus for RAG (`url`, `title`, `markdown`) and it provides a `max_pages` cap. Pin the package release and verify the template's extension points against that version. Implement the required exact-origin and maximum-depth policy explicitly in the spider's request scheduling if the template rules do not provide the needed guarantees. The current documented `allowed_domains` behavior includes subdomains, so that setting alone does not implement NochBot's same-origin rule.

Scrapling documentation describes an async spider engine with a scheduler, request deduplication, callbacks, configurable concurrency and delay, robots.txt compliance, crawl statistics, and multiple sessions. This makes the spider system a better fit than issuing independent fetch calls for a multi-page website crawl. Keep the spider focused on bounded fetching and page extraction; do not let it access MongoDB, embeddings, account records, or Atlas.

### System Flow

```mermaid
flowchart LR
    UI[Dashboard Configure page] -->|POST /api/crawl {url}| API[Next.js crawl route]
    API --> AUTH[Auth, URL policy, quota, server-side bounds]
    AUTH -->|private authenticated request| PROV[Scrapling crawler service]
    PROV --> SPIDER[SiteToMarkdownSpider / bounded spider]
    SPIDER --> FETCH[Static HTTP session]
    SPIDER -. low-content pages only .-> BROWSER[Bounded Dynamic session]
    SPIDER -->|normalized page results and crawl stats| API
    API --> INGEST[Existing chunking and Gemini embeddings]
    INGEST --> STAGE[Insert user-scoped chunks under pending generation]
    STAGE -->|activate only after complete success| META[Knowledge active-generation metadata]
    META --> RETRIEVE[Atlas Vector Search: userId + active generation]
    RETRIEVE --> CHAT[Existing chatbot retrieval and answer path]
```

The dashed browser edge is an optional, budgeted fallback, not the default path. The operational browser session should have stricter page, time, memory, subrequest, and network-egress limits than the static fetch session.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Dashboard Configure page | Submit `{ url }`, show existing crawl result plus per-page status | `POST /api/crawl` |
| `src/app/api/crawl/route.ts` | Authenticate owner; validate URL; enforce plan quota and fixed crawl bounds; preserve response contract; orchestrate ingestion and failure status | Auth, crawl provider, embeddings, storage, vector-store helpers |
| Crawl provider contract in `src/lib/` | Normalize provider input/output and stable error categories; hide transport and service details from route logic | Next.js route, Scrapling HTTP client, temporary legacy adapter during rollout |
| Private Python service | Authenticate app-to-service calls; enforce crawl-level timeout/size bounds; run Scrapling; return page records and aggregate stats only | Next.js provider client, target public websites |
| Scrapling spider | Schedule and deduplicate page requests, respect robots rules, apply domain/depth/page limits, extract title and Markdown, report fetch outcomes | Static session; optional dynamic session; no product database |
| Existing ingestion helpers | Preserve page/source boundaries, chunk text, create current embedding dimensions, tag chunks with `userId` and generation ID | `src/lib/embeddings.ts`, `src/lib/vectorStore.ts`, MongoDB |
| Knowledge metadata and vector store | Stage corpus, atomically change the active-generation pointer after staging succeeds, scope reads/writes by user | `src/lib/storage.ts`, `src/lib/vectorStore.ts`, Atlas |
| Existing chat route | Query only the current user's active website generation and continue current answer behavior | `src/app/api/chat/route.ts`, embeddings, Atlas, chat provider |

The crawler service should receive only the validated URL, bounded crawl options, and a correlation ID. It does not need the NochBot `userId`; tenant ownership is enforced by the Next.js server at persistence and retrieval boundaries. Keep service credentials and the private service address server-side.

### Data Flow

1. Dashboard sends the existing `{ url }` request. The route authenticates with the existing cookie helper and validates HTTP/HTTPS, URL syntax, plan limits, and crawl policy before any outbound request.
2. The route creates a crawl/generation ID and invokes the server-only provider with limits fixed by server configuration. A client must not be able to raise `max_pages`, depth, response size, timeout, or dynamic-render budget.
3. The crawler normalizes and deduplicates page URLs, rejects links outside the explicitly allowed origin (scheme, host, and effective port), and returns one result per attempted page with final URL, title, Markdown, status/category, plus aggregate counters. Enforce the existing first-release ceiling of 10 indexable pages. Apply an explicit depth guard in NochBot's spider scheduling; do not infer a depth limit from `allowed_domains` or `max_pages`.
4. The route applies the established text/Markdown chunking and Gemini embedding code, preserving source URL, `userId`, `chunkIndex`, text fields, and embedding dimensions. The crawler must not return vectors or write application data.
5. Insert all new chunks under the pending generation ID. Only after crawl output, chunking, embedding, and vector insertion meet the minimum-success policy should the knowledge record's active-generation pointer be changed. Make that pointer change a single atomic metadata update; retrieval filters by both `userId` and that active generation.
6. After activation, clean older generations asynchronously or as a follow-up step. Cleanup failure is observable but does not unset the new active generation. Any failure before activation records the attempt separately and leaves prior knowledge metadata and chunks searchable.
7. Return the existing success fields (`success`, `pagesCrawled`, `chunks`, `characters`, `crawlUsage`) and the per-page `pages` list used by the dashboard. Report fetched, indexed, and skipped counts consistently. Preserve the `{ url }` request shape.

For accounts whose existing chunks predate generation metadata, define and test a deliberate migration fallback in retrieval. Avoid a broad query that can mix legacy chunks with a newly activated generation or weaken the `userId` filter.

## Patterns to Follow

### Provider Adapter Around the Crawl Service

**Evidence:** The codebase uses route handlers to orchestrate work, reusable domain helpers under `src/lib`, and provider adapters for payments. The active website path is the dashboard API route; the similarly named Genkit flow has mock persistence helpers and is not the active persistence boundary.

**Recommendation:** Define a small `WebsiteCrawlerProvider` contract returning normalized pages and crawl stats. Implement `ScraplingCrawlerProvider` as an authenticated private-service client. Keep the current Axios/Cheerio implementation behind a temporary adapter during rollout, selected only by server-side configuration. This keeps the route independent of Python transport and allows a bounded rollback while preserving the current request contract.

The normalized page contract should include at minimum `requestedUrl`, `finalUrl`, `title`, `markdown`, and a stable outcome/status. Do not leak Python exceptions, raw response bodies, or sensitive query parameters in public API errors.

### Static-First Spider With an Explicit Dynamic Budget

**Evidence:** Scrapling documents `FetcherSession` for ordinary HTTP, `AsyncDynamicSession` for JavaScript/browser rendering, and multiple spider sessions selected using a request `sid`. Dynamic fetching exposes browser controls including timeout, resource blocking, blocked domains, wait conditions, and tab limits. It is heavier than HTTP fetching in the official fetcher comparison.

**Recommendation:** Use the spider's static HTTP session for normal pages. Route only pages below a defined useful-content threshold to one bounded dynamic session, and cap the number of browser-rendered pages and total browser time per crawl. Configure navigation and subrequest controls explicitly. Do not enable a stealth/anti-bot path by default; it increases cost and operational complexity without being required for ordinary indexing.

### Treat Crawl Policy as Application-Owned

**Evidence:** Scrapling documents `robots_txt_obey`, request counters, concurrency limits, `download_delay`, and `allowed_domains`. Its domain filter explicitly matches subdomains. The service is fetching arbitrary user-supplied URLs, while the project brief identifies SSRF as a system security constraint.

**Recommendation:** Validate initial URLs in the Next.js boundary and enforce network safety again in the crawler service/network layer. Reject credentials, unsupported schemes, private/reserved/metadata destinations, and unsafe redirects; re-check DNS and redirect targets. Restrict browser subrequests and service egress so a page cannot use JavaScript navigation or resource loading to reach private infrastructure. Use `allowed_domains` as an additional crawl filter, then apply a normalized exact-origin check before scheduling links. Enable `robots_txt_obey`; set conservative global and per-domain concurrency and a minimum delay. Surface Scrapling's offsite and robots-disallowed counts rather than treating silently dropped links as pages crawled.

Scrapling is the page-fetching engine, not the tenant policy authority. Never accept service credentials, crawl limits, or user identity from the browser request.

### Publish Knowledge by Generation

**Evidence:** The project brief records that the current path writes knowledge metadata before vector generation finishes and deletes old chunks before inserting replacements. Chat uses the existing Atlas collection and a `userId` filter.

**Recommendation:** Stage a complete new generation before changing the active pointer. Insert chunks with both `userId` and a generation ID; after successful insertion, update the knowledge metadata's active generation atomically. Retrieval filters on owner and active generation in the Atlas pipeline. Keep the prior generation until activation succeeds, then clean it up. This preserves the existing collection, embedding model/dimensions, and chat path while closing the failed-recrawl data-loss window.

### Keep the Synchronous Contract Bounded

**Evidence:** Crawl requests currently run from a dashboard route, with a first-release page limit of 10 in the existing integration proposal. The codebase map reports no durable background job system for long data work.

**Recommendation:** For the first release, enforce strict service and application deadlines that fit the hosting request window and keep the result bounded to the indexed-page cap. Return per-page outcomes in the established response. Treat a durable job queue, cancellation, and progress polling as a later architecture step if observed crawl latency exceeds that synchronous budget; do not introduce it as a prerequisite for provider replacement.

## Scrapling Capability Fit

| Scrapling capability | Evidence from current docs/repository | Recommendation for NochBot |
|----------------------|--------------------------------------|-----------------------------|
| Spider system | Async scheduling, deduplication, callbacks, stats, concurrency, per-domain delay, and follow-up requests are documented. | Use for the bounded site crawl rather than coordinating independent one-shot fetches. |
| `SiteToMarkdownSpider` | v0.4.15 release notes describe page items with URL/title/Markdown, `max_pages`, and overridable crawl rules for RAG corpora. | Start from this template if the pinned release supports the required page normalization and policy hooks; otherwise use a small custom `Spider` with the same result contract. |
| Fetchers and sessions | Static HTTP and dynamic browser sessions are distinct; spider requests select sessions by `sid`. | Static session by default; browser session only as a content-threshold fallback with explicit budgets. |
| Robots and throttling | `robots_txt_obey` checks disallow rules, counts blocked requests, and honors `Crawl-delay`/`Request-rate`; spider supports bounded concurrency and AutoThrottle. | Turn robots compliance on; set conservative per-domain concurrency and a minimum delay, and report denied/skipped counts. |
| Adaptive parsing | Opt-in selector learning stores element properties in SQLite by domain/identifier, then tries to relocate similar elements after page structure changes. | Defer for generic website-to-Markdown ingestion. Consider only for a future site-specific selector feature with tenant-aware storage and explicit false-match handling. |
| Markdown conversion | `Response.markdown(main_content_only=True)` is documented as clean Markdown conversion; it requires Scrapling's `rag` extra. The dedicated spider template emits Markdown. | Use the RAG extra/template and preserve its page boundaries and source URLs into the existing chunker. Compare resulting Markdown quality with current ingestion fixtures before rollout. |

The Scrapling documentation and repository were checked on 2026-10-01. The official GitHub releases page marked v0.4.15 as latest and dates it 2026-08-23. Because the docs use a moving `latest` path, pin a release and validate the installed API, especially `SiteToMarkdownSpider`, session configuration, and rules behavior, before implementation.

## Anti-Patterns to Avoid

### Calling Scrapling Directly From the Next.js Route

**What:** Run Python or launch a browser as part of the Node route handler.

**Why bad:** Couples the Next.js deployment/runtime to Python and browser binaries, complicates timeouts and memory sizing, and mixes crawl concerns into the ingestion path.

**Instead:** Call a private Python service through the provider adapter; keep all Atlas and embedding work in the existing application layer.

### Treating `allowed_domains` as Exact-Origin or SSRF Protection

**What:** Assume Scrapling's domain option limits to only the submitted hostname or protects the service from private-network access.

**Why bad:** Official docs state that subdomains are included. URL redirects and browser subrequests add network edges that a discovered-link filter does not by itself govern.

**Instead:** Apply explicit scheme/host/port, redirect, DNS/IP, browser-request, and egress policy at the service boundary, with limits enforced independently of user input.

### Activating or Deleting While a Crawl Is Still Being Built

**What:** Update active website metadata before embeddings and vector inserts finish, or delete the old vectors before the new generation is ready.

**Why bad:** A partial crawl, model outage, or database error can remove the last working chatbot corpus.

**Instead:** Stage under a new generation, publish with one active-pointer update after the minimum-success gate, and clean old generations only after activation.

### Enabling Adaptive Selectors for General RAG Pages

**What:** Treat adaptive element matching as automatic website understanding or enable a shared default adaptive store for all tenants.

**Why bad:** The feature learns and relocates saved elements by structural/text properties and identifier; a wrong match can silently turn into irrelevant or misleading knowledge, and shared persistence needs isolation design.

**Instead:** Use generic Markdown conversion for the initial crawl. If custom selectors become a product capability, isolate adaptive data by tenant/site, use meaningful stable identifiers, and validate extraction quality before indexing.

## Scalability Considerations

| Concern | Current / first release | Growth path |
|---------|-------------------------|-------------|
| Crawl duration | Synchronous route; at most 10 indexable pages with hard fetch and total-request deadlines | Move to durable jobs with polling/cancellation only when measured latency requires it |
| Fetch pressure | Low global and per-domain concurrency, download delay, robots directives | Tune from success, latency, block, and robots metrics; keep tenant quotas reserved atomically if concurrent calls can exceed limits |
| Dynamic browser resources | Small conditional fallback budget; explicit tab count and timeout | Separate worker resources/queue if browser fallbacks become a material fraction of crawls |
| Vector replacement | Small per-generation insert and active pointer update; old generation cleanup after publish | Batch inserts and run bounded cleanup jobs; retain generation metadata for rollback/diagnostics |
| Multi-tenant isolation | App writes all chunks with `userId`; retrieval requires `userId` plus active generation | Add indexes and migration checks around `{ userId, generationId }`; never rely on URL/domain uniqueness for tenant ownership |
| Service isolation | Private ingress and app-to-service identity/secret; crawler has no Atlas access | Restrict egress and resource budgets; add service-level concurrency limits and sanitized structured logs keyed by crawl ID |

## Sources

- [Scrapling spiders architecture](https://scrapling.readthedocs.io/en/latest/spiders/architecture.html) — spider scheduler, deduplication, sessions, robots, callbacks, checkpointing; current docs read 2026-10-01. Confidence: MEDIUM.
- [Scrapling spider getting started](https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html) — `allowed_domains` behavior, robots compliance, crawl counters; current docs read 2026-10-01. Confidence: MEDIUM.
- [Scrapling spider advanced features](https://scrapling.readthedocs.io/en/latest/spiders/advanced.html) — concurrency, delay, AutoThrottle, streaming and stats; current docs read 2026-10-01. Confidence: MEDIUM.
- [Scrapling spider sessions](https://scrapling.readthedocs.io/en/latest/spiders/sessions.html) — HTTP and dynamic sessions in one spider, request routing by session ID; current docs read 2026-10-01. Confidence: MEDIUM.
- [Scrapling fetcher basics](https://scrapling.readthedocs.io/en/latest/fetching/choosing.html) and [dynamic fetching](https://scrapling.readthedocs.io/en/latest/fetching/dynamic.html) — static/browser tradeoffs, session reuse, browser controls, Markdown API; current docs read 2026-10-01. Confidence: MEDIUM.
- [Scrapling adaptive parsing](https://scrapling.readthedocs.io/en/latest/parsing/adaptive.html) — element-property storage and relocation behavior; current docs read 2026-10-01. Confidence: MEDIUM.
- [Scrapling v0.4.15 release](https://github.com/D4Vinci/Scrapling/releases/tag/v0.4.15) — dated 2026-08-23; introduces RAG-oriented `SiteToMarkdownSpider` and notes an MCP breaking change; checked 2026-10-01. Confidence: MEDIUM.
- Project context: `.planning/PROJECT.md` (required brief) and `.planning/codebase/{ARCHITECTURE,INTEGRATIONS,STACK,STRUCTURE,CONCERNS}.md` (maps dated 2026-09-30); `docs/scrapling-integration-plan.md` (existing project proposal). These describe the codebase and its planned constraints, not independent verification of Scrapling capabilities.
