# Domain Pitfalls

**Domain:** User-submitted website crawling and RAG ingestion for NochBot  
**Researched:** 2026-10-01  
**Overall confidence:** HIGH for the cited standards and platform behavior; MEDIUM for Scrapling-specific behavior until its production version is pinned and verified.

Evidence below is distinguished from recommendations. Official documentation and standards establish the cited behavior; recommendations apply it to this codebase, whose active path is `POST /api/crawl` -> chunking -> Gemini embeddings -> Atlas Vector Search. The project map records that knowledge metadata is currently written before vector creation completes and old chunks are deleted before replacements are inserted, so failed recrawls can already interrupt answers.

## Critical Pitfalls

### 1. SSRF through submitted URLs, redirects, DNS changes, and browser requests
**What goes wrong:** A user submits a URL that reaches localhost, private/link-local networks, cloud metadata, or an internal service. A benign hostname can resolve differently after validation (DNS rebinding); an allowed URL can redirect to a forbidden address. A JavaScript page can also make the browser fetch private addresses through scripts, frames, images, or other subresources.

**Why it happens:** URL-string checks and hostname allowlists do not constrain the address a socket ultimately reaches. Automatic redirects and browser subrequests create additional network destinations after validating the original URL.

**Evidence:** OWASP advises strict protocol/IP validation, checking all DNS A and AAAA answers, and disabling automatic redirects or validating each redirect. Google Cloud documents routing all Cloud Run egress through a VPC so firewall rules can control outbound traffic. [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) (accessed 2026-10-01); [Cloud Run private networking](https://docs.cloud.google.com/run/docs/securing/private-networking) (accessed 2026-10-01). Playwright supports browser-context request routing and recommends blocking service workers when interception is required. [Playwright BrowserContext](https://playwright.dev/python/docs/api/class-browsercontext) (accessed 2026-10-01).

**Consequences:** Internal data exposure, cloud credential theft, access to the private Scrapling service or MongoDB network, and abuse via browser-created requests. A service secret alone does not mitigate SSRF from the worker.

**Prevention:** Treat this as a release blocker before the Next.js route calls the worker. Parse with a standards-compliant URL parser; allow only HTTP/HTTPS; reject credentials, malformed ports, unsupported schemes, and IP literals outside public unicast space. Resolve every A/AAAA answer and reject a hostname if any answer is non-public. Prevent DNS re-resolution between validation and connection (or enforce destination policy in an egress proxy/firewall). Revalidate every redirect hop and every browser subrequest, including robots.txt redirects. Deny loopback, private, link-local, multicast, unspecified, IPv4-mapped IPv6, and metadata ranges. Run the worker with no unnecessary credentials or access to internal networks; route all worker egress through restrictive network controls. Keep service authentication server-only and limit the service to authenticated app calls.

**Detection:** Security fixtures for IPv4/IPv6 literals, alternate IP encodings, mixed public/private DNS answers, rebinding, redirects, robots redirects, and browser subresources. Verify VPC/firewall egress rules in the deployed service, not only in unit tests.

**Confidence:** HIGH for OWASP and Cloud Run guidance; MEDIUM for the exact Scrapling/Playwright request interception hooks until tested on the pinned versions.

### 2. A failed or incomplete recrawl replaces usable knowledge
**What goes wrong:** Fetching, extraction, chunking, embedding, or MongoDB insertion fails after metadata has been changed or old chunks deleted. A crawl that returns a few pages after widespread failures can also be mistaken for a complete replacement and discard a richer corpus.

**Why it happens:** Crawl acquisition and indexing are separate fallible stages. The current implementation performs destructive replacement before the new corpus is fully usable. Concurrent recrawls can publish out of order, and cleanup can fail independently after publication.

**Evidence:** The project brief and `CONCERNS.md` describe the existing metadata-before-vector-write and delete-before-insert behavior. MongoDB documents Atlas Vector Search as eventually consistent: inserted collection documents may not immediately be available to vector search. [MongoDB Search index performance and consistency](https://www.mongodb.com/docs/search/performance/index-performance/) (accessed 2026-10-01). Atlas Vector Search requires fields used in pre-filters to be indexed. [MongoDB Vector Search pre-filtering](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorsearch/) (accessed 2026-10-01).

**Consequences:** Chat can lose its last working source, temporarily return no results after "success," or mix chunks from old and new crawls. Failed cleanup can leak storage; overlapping runs can restore stale content.

**Prevention:** Treat atomic corpus publication as a core crawler requirement, not deferred cleanup. Keep crawl status/attempt metadata separate from the active source metadata. Stage each crawl under a unique generation ID; fetch, normalize, chunk, embed, and insert all eligible chunks before switching the active-generation pointer. Require a documented minimum-success policy (at least one non-empty indexed page for initial release, plus a stricter partial-failure threshold if needed). Verify staged chunks are visible to Atlas vector retrieval before publication because search indexing is asynchronous. Filter every retrieval by both `userId` and active generation; ensure both filter fields are configured in the Atlas Vector Search index. Atomically compare-and-set the active pointer against the generation that was active when this run began, so a slow older crawl cannot overwrite a newer one. Retain the former generation until publication is verified; clean it asynchronously and make cleanup retryable. Keep URL/chunk-count metadata unchanged on failed attempts.

**Detection:** Inject failures at crawl, Markdown parsing, chunking, each embedding batch, Mongo insert, visibility check, activation, and cleanup. After every failure before activation, query through the ordinary chat retrieval path and prove the prior generation remains available. Test concurrent runs completing in reverse order.

**Confidence:** HIGH for the present failure mode (project brief/map) and Atlas eventual consistency; HIGH for staged-generation recommendation as a mitigation, with activation semantics requiring application-level implementation.

### 3. Limits that appear configured do not actually bound crawler work
**What goes wrong:** A page cap bounds returned documents but not all network requests. Broad domain matching or unbounded link following crosses the intended site area. Redirects and dynamically discovered links bypass scope. Concurrent tenants can multiply worker load and target-site request rates.

**Why it happens:** Crawler-library options are not interchangeable with a full resource/security policy. Scrapling documents `SiteToMarkdownSpider.max_pages` as a conversion cap; requests already queued when the cap is hit may still be fetched. Its spider engine has built-in URL deduplication, `allowed_domains`, concurrency and per-domain delays, but the docs do not establish a hard total-request/time budget or a maximum link depth for this integration. [Scrapling RAG guide](https://scrapling.readthedocs.io/en/latest/ai/building-rag-systems.html) (documentation accessed 2026-10-01; copyright 2025); [Scrapling spider architecture](https://scrapling.readthedocs.io/en/latest/spiders/architecture.html) (accessed 2026-10-01).

**Consequences:** Unbounded cost, long-running synchronous requests, noisy or harmful traffic to target sites, crawl expansion across subdomains, and worker resource exhaustion.

**Prevention:** Define independent server-side caps for scheduled requests, successfully fetched pages, depth, total bytes, per-response bytes, crawl wall-clock time, redirects, and concurrent jobs. Do not accept caller-supplied increases. Enforce depth and same-host/origin policy before scheduling each link and after redirect resolution; use an explicit allow rule rather than assuming `allowed_domains` equals exact-origin policy. Bound global and per-domain concurrency, set conservative delay, and reserve per-tenant crawl quota atomically so parallel requests cannot all pass the same pre-check. Scrapling's `max_pages` should be one defense only; add a request budget before scheduler enqueue. Check how the pinned version interprets domain suffixes and limit settings.

**Detection:** Instrument attempted, scheduled, fetched, rendered, and indexed counts separately. Test deep trees, loops, sibling subdomains, cross-origin links, redirect chains, many queued requests at the page cap, and simultaneous tenant crawls.

**Confidence:** HIGH for documented `max_pages` behavior and built-in spider features; MEDIUM for application-specific boundary behavior until pinned-version fixtures pass.

### 4. Robots policy, rate limits, and blocked pages are invisible or mishandled
**What goes wrong:** The crawler ignores a site's robots rules, treats a failed robots fetch as permission, over-requests a host, retries 429/blocked responses aggressively, or misreports silently skipped URLs as a successful complete crawl.

**Why it happens:** Robots outcomes have distinct protocol semantics. Scrapling's spider architecture says disallowed requests are dropped silently; callers may not get a page-level result unless they add accounting. Blocked requests may be retried by the crawler. [Scrapling spider architecture](https://scrapling.readthedocs.io/en/latest/spiders/architecture.html) (accessed 2026-10-01).

**Evidence:** RFC 9309 (September 2022) requires following parseable rules; recommends following at least five robots redirects; says a 4xx "unavailable" response may permit crawling, while a 5xx or network-unreachable robots file requires assuming complete disallow. Cached robots rules generally should not be used for more than 24 hours except when unreachable. [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html).

**Prevention:** Enable Scrapling `robots_txt_obey`, identify the crawler with a stable user-agent, and report robots-denied counts explicitly. Preserve RFC status distinctions and fail closed on unreachable robots.txt; apply SSRF and redirect checks to robots fetches too, including cross-authority redirects, before following them. Apply per-host request spacing and bounded concurrency. On 429, honor `Retry-After`; use bounded exponential backoff with jitter for transient 5xx/network failures only. Do not retry robots-denied or permanently blocked pages as if they were transient. Treat access controls, CAPTCHA, and anti-bot blocks as a visible skip/failure; do not enable stealth, proxy rotation, or challenge bypass for this knowledge crawl. The product should not turn a block into permission to evade the site's controls.

**Detection:** Fixtures for allow/disallow, robots 404, robots 5xx, redirect chains, malformed directives, 429 with `Retry-After`, and blocked response. Confirm all are represented in result counts and that retry/request budgets hold.

**Confidence:** HIGH for RFC requirements and the documented Scrapling silent-drop behavior. The exact behavior and exposed statistics depend on the pinned Scrapling release.

### 5. Dynamic rendering becomes a resource and network escape hatch
**What goes wrong:** Many pages trigger Chromium, pages load indefinitely, scripts spawn popups or request large media, or browser subrequests reach unrelated/private hosts. Multiple browser contexts exhaust CPU, memory, file descriptors, or worker time.

**Why it happens:** Browser rendering executes untrusted code and creates many requests beyond the top-level navigation. Scrapling's RAG docs say browser dependencies are installed for browser-based fetchers; Playwright provides finite action/navigation timeouts and request routing, but these mechanisms do not replace process/container resource limits. [Scrapling RAG guide](https://scrapling.readthedocs.io/en/latest/ai/building-rag-systems.html); [Playwright BrowserContext](https://playwright.dev/python/docs/api/class-browsercontext); [Playwright Page](https://playwright.dev/python/docs/api/class-page) (all accessed 2026-10-01).

**Prevention:** Keep static fetching as default and render only pages below a defined usable-content threshold. Cap browser attempts per crawl and total browser time. Use isolated, non-persistent contexts; block service workers when relying on routing; allow only safe HTTP(S) requests that pass the same destination policy; reject unsafe subrequests and downloads. Set finite navigation/action timeouts, disable unnecessary media/fonts/images where compatible with extraction, cap response bytes, pages, concurrency, CPU, memory and process lifetime, and kill the browser process when the crawl deadline expires. No cookies, credentials, or shared browser profile should be sent to submitted sites.

**Detection:** Use local JS fixtures with infinite navigation, huge assets, popups, redirects, private-network subrequests, service workers, and pages that never reach network idle. Assert hard time/resource budgets and verify each request disposition.

**Confidence:** HIGH that browser routing/timeouts are available in Playwright; MEDIUM on resource savings from selectively disabling resources, which must be validated against target-page extraction quality.

## Moderate Pitfalls

### 6. URL normalization either misses duplicates or merges distinct content
**What goes wrong:** Fragment variants, relative links, trailing slash/default-port variants, tracking parameters, redirects, and canonical links create duplicate chunks or unbounded crawl variants. Over-aggressive query removal can merge pages with different content. A cross-origin canonical tag can silently change scope.

**Prevention:** Resolve relative links against the final response URL; normalize scheme/host case, default ports and fragments; maintain a per-run visited set using a documented canonicalization policy. Preserve meaningful query parameters and strip only a deliberate allowlist of known tracking parameters. Validate canonical links against crawl scope before using them. Persist the final normalized page URL with every page and chunk. Scrapling's scheduler fingerprints requests and `LinkExtractor` supports canonicalization/extension filtering, but application semantics still need tests. [Scrapling spider architecture](https://scrapling.readthedocs.io/en/latest/spiders/architecture.html); [Scrapling RAG guide](https://scrapling.readthedocs.io/en/latest/ai/building-rag-systems.html) (accessed 2026-10-01).

### 7. Partial fetches and block responses are presented as full success
**What goes wrong:** A crawl returns some content alongside timeouts, unsupported MIME types, robots denials, or blocks; the UI reports only `pagesCrawled`, or the endpoint's result shape does not match the dashboard's expectation for `pages`.

**Prevention:** Return normalized per-page states and aggregate attempted/fetched/indexed/skipped/failed counts; distinguish "partial but publishable" from "not publishable." Preserve the existing `{ url }` request and success fields while adding compatible page diagnostics. Avoid raw exception traces and query secrets. Align `pagesCrawled` with documented semantics (fetched vs indexed) and explicitly identify which count drives quotas and activation. The project map already flags this response mismatch.

### 8. Chunking/embedding behavior drifts while replacing only the scraper
**What goes wrong:** Markdown changes page boundaries, chunk sizes, metadata, or token volume; chunks lose their source URL; embedding dimension/model differs from the Atlas index; sequential embedding and per-chunk sleeps exceed API timeouts or quotas.

**Evidence:** MongoDB requires query vectors to use the same model as stored vectors and the configured vector dimensions must match. [MongoDB vectorSearch operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorsearch/) (accessed 2026-10-01). The Gemini embedding API currently documents model input limits and multiple embedding/batch options, which are subject to the active project quota. [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) and [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) (accessed 2026-10-01).

**Prevention:** Keep the crawler response as a transport/provider boundary; reuse current `src/lib/embeddings.ts`, chunking, Atlas collection/index, and `src/lib/vectorStore.ts`. Preserve `userId`, page/source URL, page identity, `chunkIndex`, text fields, embedding model and dimensions. Cap extracted text per page and total corpus before embedding. Batch where supported, with bounded concurrency and retry on retryable rate-limit/server failures only. Treat malformed/short embeddings, partial batch results, dimension mismatch, and Atlas insert errors as pre-publication failures.

### 9. Indexing visibility and generation filters cause false empty retrieval
**What goes wrong:** The generation pointer changes after Mongo writes but before Atlas Vector Search has indexed those writes, or the new generation field is not configured as an index filter. Chat temporarily finds no active-generation chunks.

**Evidence:** Atlas Search/Vector Search indexing is eventually consistent, and filter fields must be declared in the vector index definition. [MongoDB index latency](https://www.mongodb.com/docs/search/performance/index-performance/); [Vector Search pre-filtering](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorsearch/) (accessed 2026-10-01).

**Prevention:** Include `generationId` as an indexed filter field before application queries use it. Gate activation on an index-visible readiness check (or another verified mechanism that preserves old results until candidate results are searchable); do not equate successful Mongo insert with searchable publication. Keep legacy records on an explicit compatibility path and test it without weakening tenant filters.

### 10. Retry, quota, and observability semantics create duplicate work or hidden spend
**What goes wrong:** A client retries after a timeout while the original request is still crawling; both runs consume quota, duplicate embeddings, or race to publish. Failure details are lost because logs only show a generic 500.

**Prevention:** Assign a crawl/run ID and idempotency key, bound active jobs per tenant, atomically reserve quota, and make worker/app retries stage-aware. Record durations and counts for fetch, render, parsing, chunk, embedding, Atlas insert, activation and cleanup. Redact credentials, raw exception details, and sensitive query strings. The current synchronous request path and race-prone pre-check/post-log quota flow are documented concerns; decide in the first crawler phase which failures count against a crawl allowance.

## Minor Pitfalls

### 11. End-to-end confidence is inferred from isolated crawler success
**What goes wrong:** Scrapling returns Markdown, but route compatibility, ownership filters, chunk metadata, active-generation retrieval, or the embedded chat path fails in production.

**Prevention:** Keep repeatable local fixtures for relative and duplicate links, redirects, depth/domain boundaries, robots, 429, timeouts, oversized bodies, JS rendering, unsupported content, and partial failures. Test that every vector write and query is scoped to `userId`, that PDF vectors/retrieval remain unchanged, and that a specific fact from the fixture is returned through both regular and embedded chatbot paths. Separately run one authorized public-site acceptance crawl in a non-production environment. Include failure injection across every ingestion stage and a failed recrawl after a successful one. The existing map identifies crawler-security and dashboard behavior as high-priority test gaps.

### 12. Library features are assumed from moving documentation
**What goes wrong:** Current online Scrapling examples differ from the selected package release, so robots accounting, retries, URL scope, page caps, or browser hooks behave differently from the research assumptions.

**Prevention:** Pin Scrapling and browser dependencies. At phase start, verify the exact installed release's `SiteToMarkdownSpider`, `CrawlRule`/`LinkExtractor`, robots, retry, scheduler, and `max_pages` semantics with small fixtures. Do not promote a feature described in upstream docs to a security control until its behavior is covered by tests.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Private Scrapling service | SSRF through DNS, redirects, robots, and browser subrequests | Complete URL/IP policy plus VPC egress controls and adversarial fixtures before app integration |
| Crawl boundaries and policy | `max_pages` still fetches queued requests; depth and scope can leak | Enforce request budget before enqueue, same-host policy after every redirect, finite depth/time/byte limits |
| Ingestion and RAG integration | Early deletion, premature metadata writes, eventual Atlas indexing, race between recrawls | Stage by generation; preserve active pointer until index-visible; tenant+generation filter; compare-and-set publish |
| Dashboard/API compatibility | Partial results and `pages`/`pagesCrawled` mismatch conceal failure | Preserve `{ url }` and legacy fields; add stable per-page outcomes and clear fetched/indexed counts |
| Rollout and acceptance | Unit-level crawler success misses actual chat regressions | Exercise dashboard -> API -> worker -> chunk/embed -> Atlas -> both chatbot surfaces; verify failed recrawl preservation and PDF non-regression |

## Sources

- OWASP Foundation, [Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), accessed 2026-10-01.
- Google Cloud, [Private networking and Cloud Run](https://docs.cloud.google.com/run/docs/securing/private-networking), accessed 2026-10-01.
- RFC Editor, [RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html), September 2022.
- Scrapling maintainers, [Building RAG systems](https://scrapling.readthedocs.io/en/latest/ai/building-rag-systems.html) and [Spiders architecture](https://scrapling.readthedocs.io/en/latest/spiders/architecture.html), accessed 2026-10-01; docs carry 2025 copyright. Version-specific behavior remains to be validated.
- Playwright maintainers, [BrowserContext API](https://playwright.dev/python/docs/api/class-browsercontext) and [Page API](https://playwright.dev/python/docs/api/class-page), accessed 2026-10-01.
- MongoDB, [Vector Search operator and pre-filtering](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorsearch/) and [Search index performance and consistency](https://www.mongodb.com/docs/search/performance/index-performance/), accessed 2026-10-01.
- Google AI for Developers, [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) and [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), accessed 2026-10-01.
- NochBot project sources: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/TESTING.md`, and `docs/scrapling-integration-plan.md` (project map dated 2026-09-30; integration proposal read 2026-10-01).
