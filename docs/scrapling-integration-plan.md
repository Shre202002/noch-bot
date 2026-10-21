# Scrapling Integration Implementation Plan

## Goal

Replace NochBot's Axios/Cheerio website crawler with Scrapling while preserving the dashboard request contract and the existing Markdown/text chunking, Gemini embedding, MongoDB Atlas Vector Search, user isolation, and chat retrieval behavior.

The crawler runs as a private Python service on Cloud Run. The Next.js application remains responsible for authentication, crawl quotas, ingestion, vector persistence, and publishing the active knowledge generation.

## Locked Decisions

- Keep `POST /api/crawl` and its request body `{ "url": string }`.
- Keep the current maximum of 10 indexed pages for the first release; limit the crawl to the submitted origin and set an explicit maximum link depth.
- Use Scrapling's static spider and Markdown conversion by default. Enable robots.txt rules, bounded concurrency, per-domain delay, timeout, retries, page count, response size, and total crawl duration.
- Add a limited dynamic-render fallback when a normal fetch returns too little usable content. Do not run a browser for every page.
- Run Scrapling in a private Python Cloud Run service called only by the authenticated Next.js backend.
- Keep existing chunking, Gemini embeddings, Atlas collection/index, and chat retrieval. Add a crawl-generation marker to vector metadata and an active-generation pointer to knowledge metadata so a failed crawl cannot replace the prior working corpus.
- Keep the current crawler behind the provider interface for the migration period; remove it after production acceptance passes.
- Return per-page details in the API success body. Preserve existing fields (`success`, `pagesCrawled`, `chunks`, `characters`, `crawlUsage`) and add `pages`. The dashboard currently reads `pages`, while the active route only returns `pagesCrawled`.

## Plan 1: Build the Private Scrapling Crawler Service

### Scope

Create a Python service that accepts a bounded crawl request, safely crawls the submitted site, and returns one structured result per page. It must not access MongoDB, generate embeddings, or know about NochBot user records.

### Tasks

1. Add a dedicated service directory, for example `scraper/`, with a pinned Python version, `scrapling[rag,fetchers]` dependency, and Cloud Run container definition.
2. Implement a private HTTP endpoint with a versioned request and response schema. Request fields: `url`, `max_pages`, `max_depth`, `timeout_seconds`, and a correlation ID. The caller supplies bounds from server configuration; clients cannot raise them.
3. Implement a `SiteToMarkdownSpider` provider using the current Scrapling API. Set `allowed_domains` to the validated target host, enable `robots_txt_obey`, and configure conservative global/per-domain concurrency and download delay.
4. Extract final URL, page title, Markdown body, status, and safe diagnostic category for each response. Deduplicate canonicalized URLs and avoid fragments, non-HTTP links, and known non-page extensions.
5. Add a conditional dynamic-render attempt for pages whose static result is empty or below a defined content threshold. Apply a strict per-page and whole-crawl budget to browser work.
6. Add URL and network safeguards: allow only HTTP/HTTPS; reject credentials and malformed ports; resolve and reject loopback, private, link-local, multicast, and metadata-service IP ranges; revalidate redirects and DNS resolutions; cap response bytes; restrict browser subrequests and service egress.
7. Authenticate app-to-service requests using a server-side secret or platform identity. Do not expose service credentials or worker address in client code.
8. Normalize failures into stable categories such as invalid URL, robots denied, timeout, blocked, response too large, unsupported content, and no extractable content. Never return raw exception traces or sensitive query values.

### Acceptance Gate

- A static multi-page public fixture returns unique same-origin pages with usable Markdown and normalized absolute URLs.
- A JavaScript-rendered fixture is recovered by the limited dynamic fallback.
- Robots-denied URLs are skipped and counted; throttling and configured bounds are observable in crawl stats.
- Invalid schemes, localhost/private IPs, metadata IPs, redirect-to-private cases, excessive responses, and cross-origin links are rejected or excluded.
- Service requests without valid app authentication are denied.

## Plan 2: Integrate the Provider and Make Ingestion Non-Destructive

### Scope

Connect the current Next.js crawl route to Scrapling while preserving the existing frontend request and downstream ingestion/RAG behavior. Ensure all new content is ready before it becomes active.

### Tasks

1. Add a provider interface under `src/lib/` with a normalized page type and crawl result type. Implement `ScraplingCrawlerProvider` as the production provider and wrap the current Axios/Cheerio implementation as a temporary legacy provider.
2. Configure the private crawler endpoint and service authentication through server-only environment configuration. Validate missing configuration with an explicit server error.
3. Update `src/app/api/crawl/route.ts` to validate the user URL before calling the provider, retain authentication and plan quota checks, and enforce server-side crawl bounds. Keep the existing `{ url }` input.
4. Update ingestion to preserve page boundaries and source URLs in chunk metadata while maintaining `userId`, text/Markdown fields, `chunkIndex`, and existing embedding dimensions. Reuse `src/lib/embeddings.ts` and `src/lib/vectorStore.ts`.
5. Stage a new crawl generation: crawl, parse, chunk, embed all chunks, and insert them with a generation ID before updating the knowledge record's active generation. Only after publication succeeds should old generations be cleaned up.
6. Update `searchKnowledgeChunks()` to filter by both `userId` and the active generation. Keep user isolation mandatory in every query. If an account has no generation pointer during migration, use a deliberate compatibility path for its existing vectors.
7. Update `src/lib/storage.ts` knowledge metadata with active generation, crawl status, and per-crawl metadata needed by the dashboard. Write successful crawl metadata only after activation; record failed attempts separately without changing the active URL/content/count.
8. Preserve the existing success fields and add `pages` details. On partial crawl, report fetched/indexed/skipped counts accurately and only activate if the minimum-success policy is met. The initial policy should require at least one page with non-empty chunks.
9. Keep crawl quota accounting tied to completed crawl attempts according to current product behavior; ensure failed pre-ingestion requests cannot silently consume or bypass quota. Confirm the chosen counting rule in code comments and tests.
10. Update `src/app/dashboard/configure/page.tsx` to consume the returned page list, display skipped/failed pages without marking the crawl complete incorrectly, and keep current progress and error handling.

### Acceptance Gate

- Existing dashboard clients can still POST `{ url }` and receive the established success/error fields.
- A successful crawl creates embeddings in the existing Atlas knowledge collection and retrieval returns only the active generation for that user.
- A crawl failure during fetching, Markdown parsing, chunking, embedding, or Mongo insertion leaves the previous active generation searchable and leaves its URL/chunk count intact.
- A successful new crawl becomes active before old data is removed; cleanup failures do not roll back the active generation.
- Cross-user retrieval tests prove that matching vectors for another user are never returned.
- Existing PDF vector documents and retrieval are unaffected.

## Plan 3: Verify End to End, Roll Out, and Remove the Legacy Crawler

### Scope

Prove that a real website's content reaches both chatbot surfaces through the existing Atlas RAG pipeline, then switch the production provider and remove obsolete scraping code.

### Tasks

1. Add focused tests for URL validation/SSRF policy, origin and depth boundaries, URL deduplication, robots outcomes, provider normalization, generation activation, rollback-on-failure, and backward-compatible response fields.
2. Add a deterministic local crawler fixture site with static, relative-link, duplicate-link, redirect, oversized, and JavaScript-rendered pages. Keep live-site verification separate from repeatable CI tests.
3. Run the service and application validation commands: Python unit/integration checks, `npm run typecheck`, and `npm test`. Resolve failures caused by this integration without rewriting unrelated working-tree changes.
4. Deploy the private Python service to a non-production Cloud Run service with restricted ingress, configured egress controls, bounded CPU/memory/time, and server-only credentials.
5. Perform a real end-to-end crawl from the dashboard against a public test website that the operator is authorized to crawl. Confirm the page count, crawl metadata, and Atlas vectors for the expected owner and generation.
6. Ask a chatbot question that requires a specific fact present only in the crawled site. Verify the answer through the regular chatbot and the embedded chatbot; confirm retrieval uses the same active generation and user filter.
7. Exercise a failed recrawl after a successful crawl and verify the prior answer still works. Confirm logs contain crawl IDs and stage outcomes without secrets or full sensitive URLs.
8. Enable Scrapling for production, monitor crawl success, duration, dynamic-fallback rate, blocked/robots-denied counts, and Atlas writes. Keep the legacy provider available for a short rollback window.
9. After the acceptance window, remove the Axios/Cheerio crawl implementation and dependencies only if they are not used by other routes (for example, theme extraction). Remove obsolete mock crawl code only after confirming it has no callers.

### Acceptance Gate

- One real end-to-end dashboard crawl indexes a public authorized website into Atlas.
- A regular chatbot query and an embedded chatbot query both answer from that crawled content.
- A failed recrawl preserves the previously working chatbot answer.
- User isolation, robots policy, SSRF protections, rate limits, and crawl bounds pass targeted checks.
- TypeScript validation and the existing test suite pass.
- No crawler API secret or private service credential appears in frontend bundles, `public/embed.js`, or tracked source defaults.
- The legacy implementation is removed only after the production acceptance and rollback window are complete.

## Dependencies and Rollout Order

Plan 1 must pass its security and crawl-boundary acceptance gate before Plan 2 calls the service. Plan 2 must pass the non-destructive publishing and retrieval gate before Plan 3 enables the provider in production. Plan 3 owns end-to-end acceptance and legacy removal.

For rollout, deploy the worker first, deploy the app with the provider selectable through server-side configuration, verify on a test account, then switch production traffic. Keep the previous active generation and legacy provider available through the rollback window.

## Deferred Work

- Background crawl jobs with progress polling for sites that exceed the synchronous request window.
- Sitemap-first crawling and optional user-configurable path include/exclude rules.
- Per-site custom CSS selectors and persisted adaptive selectors.
- Scheduled recrawls, crawl history UI, and manual generation restore.
- Broader anti-bot or proxy strategy. Any such work needs a separate policy and operational review.
