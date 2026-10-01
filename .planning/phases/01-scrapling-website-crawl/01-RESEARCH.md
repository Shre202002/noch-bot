<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Crawl Selection and Publication
- **D-01:** The entry-plan crawl limit is 15 pages. Higher subscription plans may have higher finite limits; limits must be enforced server-side and remain under an overall hard maximum. The exact paid-tier values and global maximum are implementation/planning details to validate against the existing entitlement system and deployment budget.
- **D-02:** Select pages deterministically: submitted URL first, primary navigation links next, relevant sitemap entries, then breadth-first same-origin links. Favor likely core knowledge content such as services, products, FAQs/help, and about pages. Relevance may outrank shallow depth within the enforced depth bound.
- **D-03:** Deduplicate obvious URL variants before counting pages against the applicable plan limit. Do not use LLM ranking for page selection.
- **D-04:** URLs not selected because the plan limit is reached are deferred/not attempted, not failures. Empty pages with no usable text are ignored. At least one page with usable data must be indexed, and every selected page with usable content must index successfully before activating a new corpus. Any selected usable page that fails the required crawl/index pipeline keeps the previous active corpus unchanged.
- **D-05:** The existing website knowledge remains active on any failed/empty/insufficient attempt. Publication is generation-safe: do not replace or clean up the active corpus before the new selected corpus meets its publication criteria.

### Dashboard Crawl Feedback
- **D-06:** Reaching the page limit is a successful crawl with a small, non-blocking warning when the selected content indexes successfully; do not label the crawl as failed just because more candidates were deferred.
- **D-07:** Show the actual crawled page list. Each page row includes title, URL, outcome/status, a safe short reason when it was not indexed, and the number of chunks extracted for that page.
- **D-08:** For an entry-plan limit, use upgrade copy like “Crawled 15 pages. For more, upgrade your plan.” and link to the existing plans/upgrade flow.
- **D-09:** When a recrawl fails and the prior corpus stays active, tell the user that the previous indexed version remains available.

### Scrapling Rollback
- **D-10:** If Scrapling has a service-level failure (for example unavailable service, timeout, or server error), automatically fall back to the legacy crawler and tell the user that Scrapling was unavailable and the legacy crawler handled the crawl.
- **D-11:** Do not invoke legacy fallback for URL-policy rejection, robots outcomes, or content-quality outcomes. Fallback must preserve the same security policy, plan limits, page-selection behavior, indexing threshold, and failure-safe publication rules.
- **D-12:** Keep the legacy provider only through end-to-end acceptance and a short stable-production window; remove it after that window if the new path is verified.

### the agent's Discretion
- Determine exact finite page limits for paid tiers and the overall hard maximum after inspecting existing plan entitlements and safe operational budgets; do not silently make limits unlimited.
- Verify how the pinned Scrapling API supports discovery ordering, sitemap candidates, robots behavior, per-page outcomes, and bounded static/dynamic fetching. Implement the agreed ordering without adding an LLM ranking pass.
- Choose the narrowest safe mechanism for detecting service-level failures and retrying before legacy fallback; never treat policy/content rejection as service unavailability.
- Define stable public status labels and safe error categories consistent with the user's requested meaning and current dashboard conventions.
- Determine generation identifiers, Atlas searchable-readiness checks, and cleanup timing while preserving the current schema and owner isolation.

### Deferred Ideas (OUT OF SCOPE)
- Scheduled crawling, durable progress/cancellation, crawl history/restore, and incremental recrawl remain deferred per v2 scope.
- Advanced user-configurable sitemap/path rules, adaptive selectors, stealth/proxy crawling, and LLM-based page ranking remain out of scope for this phase.
- Further subscription packaging/pricing work beyond honoring existing plan entitlements belongs to a separate product/pricing decision.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRAWL-01 | An authenticated user can submit a website URL through the existing dashboard request contract `{ url }` and receive a crawl result without a frontend API migration. | Retain current route authentication, request body, quota check, and legacy response keys; adapt provider output to the Configure page's `pages` input. |
| CRAWL-02 | Website pages are fetched and converted to normalized page content through a Scrapling-backed crawler provider. | Use a pinned Scrapling spider behind a normalized provider response; custom scheduling implements the locked candidate order. |
| CRAWL-03 | Crawl requests enforce server-owned page, depth, time, response-size, concurrency, redirect, and same-origin bounds that users cannot raise. | Derive per-plan limits in the authenticated app; enforce page/depth budgets before scheduling and time/byte/concurrency/redirect bounds at the service/network boundary. |
| CRAWL-04 | The crawler blocks requests to loopback, private, link-local, and other prohibited addresses, including after DNS resolution and redirects. | Apply parsed URL and A/AAAA policy, manual redirect validation, and egress controls to every fetch, including robots, sitemap, and browser subrequests. |
| CRAWL-05 | Crawl outcomes distinguish fetched, skipped, blocked, failed, and indexed pages and remain compatible with dashboard result rendering. | Return stable page status, sanitized reason, URL/title, chars and chunk count; keep existing client fields. |
| CRAWL-06 | Successful page content enters the existing chunking, embedding, metadata, and Atlas Vector Search pipeline without changing vector dimensions or weakening per-user filters. | Preserve collection, embedding helper, vector size and owner filter; add only generation metadata/filtering after updating the Atlas index definition. |
| CRAWL-07 | A failed, empty, or insufficient-quality crawl leaves the last active website knowledge available to chatbot retrieval. | Stage a complete candidate generation, confirm readiness, then switch the active pointer; clean old generations only after activation. |
| CRAWL-08 | A chatbot query, including through the embedded chatbot, can retrieve and answer from content indexed by the Scrapling crawler. | Both regular bot UI and embed call `/api/chat`; make its shared retrieval use the same active generation while preserving user filter, then prove with a unique-fact test. Verbatim call paths: `fetch('/api/chat',` and `fetch('/api/chat',`. [VERIFIED: src/app/bot/page.tsx:97; public/embed.js:148] |
| CRAWL-09 | Website crawling and extraction failures are observable without exposing secrets, raw page bodies, or sensitive URL parameters to users or logs. | Use correlation IDs, stage counters and safe error categories; redact query strings and do not log raw page content or credentials. |
</phase_requirements>

# Phase 1: Scrapling Website Crawl - Research

**Researched:** 2026-10-02  
**Domain:** Bounded website crawling, SSRF defense, and generation-safe RAG ingestion  
**Confidence:** MEDIUM

## Summary

Keep the authenticated Next.js route as the policy, quota, ingestion and persistence boundary. Put Scrapling behind a server-only provider call and return normalized per-page results; keep chunking, Gemini embeddings, Atlas Vector Search and chatbot retrieval in the application. The active route currently uses Axios/Cheerio, performs a fixed 10-page breadth-first crawl, and calls `replaceKnowledgeChunks`; that helper deletes a user's current vectors before inserting the next set. The current implementation therefore does not satisfy safe publication and must be replaced with staging. [VERIFIED: src/app/api/crawl/route.ts:167-172,228-263,309-322; src/lib/vectorStore.ts:86-107]

Verbatim current page ceiling from `src/app/api/crawl/route.ts:261`: `const MAX_PAGES = 10;` This is an existing implementation value, not the new plan-specific cap. [VERIFIED: src/app/api/crawl/route.ts:261]

Build a custom Scrapling `Spider` (or subclass the Markdown template only after confirming its extension points) to implement the locked candidate order. Official docs show async callbacks, prioritized requests, request fingerprint deduplication, optional robots enforcement, concurrency settings and crawl statistics. The generic Markdown template documents per-page Markdown output but not `max_pages` or `max_depth`; do not assume either limit is supplied by that template. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/requests-responses.html] [CITED: https://scrapling.readthedocs.io/en/latest/api-reference/spiders.html] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html]

**Primary recommendation:** Pin Scrapling `0.4.15` in an isolated Python service, implement ordering and hard budgets in the custom spider/service, and keep providers behind the same URL policy and generation publication pipeline. PyPI lists `0.4.15` as released 2026-08-23 and declares Python `>=3.10`; the package legitimacy seam returned `SUS` for unknown download data, so add `checkpoint:human-verify` before installing it. [CITED: https://pypi.org/project/scrapling/] [VERIFIED: GSD package-legitimacy check, ecosystem pypi, scrapling: SUS]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard crawl submit and result rendering | Browser / Client | API / Backend | Configure posts `{ url }` and currently reads `data.pages`; render per-page outcomes and publication messages from the result. [VERIFIED: src/app/dashboard/configure/page.tsx:78-108] |
| Identity, plan quotas, URL policy and provider dispatch | API / Backend | — | Crawl route owns cookie auth, account lookup and `checkCrawlLimit`; page ceilings must be computed here. [VERIFIED: src/app/api/crawl/route.ts:214-242] |
| HTML fetch, robots and crawl discovery | Isolated crawler service | API / Backend | Scrapling owns fetching and normalized extraction; the app retains authorization, policy and all writes. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/architecture.html] |
| Chunking, embedding, generation staging and activation | API / Backend + Database / Storage | — | Existing helpers write application-generated vectors to Atlas; the crawler must not receive MongoDB or embedding credentials. [VERIFIED: src/lib/embeddings.ts:6-20; src/lib/vectorStore.ts:86-107] |
| Chat retrieval from published website generation | API / Backend + Database / Storage | Browser / Client | Regular and embedded bot callers both post to `/api/chat`; its handler retrieves with `searchKnowledgeChunks`, so apply the generation filter in that shared contract. [VERIFIED: src/app/api/chat/route.ts:60-65; src/lib/vectorStore.ts:133-143; src/app/bot/page.tsx:97; public/embed.js:148] |

## Project Constraints (from AGENTS.md)

- Preserve `POST /api/crawl` with body `{ url }`; do not require a frontend request migration. [VERIFIED: AGENTS.md:13]
- Failed, empty or insufficient recrawls leave the active website corpus available. Every knowledge write and retrieval stays scoped to owning `userId`. [VERIFIED: AGENTS.md:14-16]
- Keep the website Atlas collection, embedding generation/model, vector size and retrieval behavior; add only metadata/filter changes needed for generation publication. [VERIFIED: AGENTS.md:17]
- Treat submitted URLs as SSRF-sensitive. Validate destinations, redirects and limits, keep service credentials server-side, and do not give the crawler direct database, embedding or tenant-record access. [VERIFIED: AGENTS.md:18; .planning/REQUIREMENTS.md:12-13]
- Use Next App Router handlers as HTTP orchestration boundaries and place reusable business logic in `src/lib`; use existing vector-store helpers instead of cloning `$vectorSearch` pipelines. [VERIFIED: AGENTS.md:197-205,287-291]
- Match local TypeScript style, use `@/` aliases for `src/*`, keep strict types and co-locate tests. Keep models independent of route/lib imports. [VERIFIED: AGENTS.md:74-111,120-136,167-180,257-269]
- Wrap I/O in `try/catch`, return generic client-safe errors, and log contextual stages without credentials, raw pages or sensitive URL query values. [VERIFIED: AGENTS.md:141-165; .planning/REQUIREMENTS.md:18]
- Never read or quote `.env` or `env.txt`; refer to secret names only. Use the GSD workflow for repository artifact changes. [VERIFIED: AGENTS.md:54-65,355-364]
- Keep PDF ingestion/retrieval and event booking/payment out of this phase. Do not add scheduled/incremental crawling, user-configurable sitemap/path rules, stealth/proxy behavior or LLM ranking. [VERIFIED: .planning/REQUIREMENTS.md:28-49; 01-CONTEXT.md, Deferred Ideas]

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Next.js App Router + TypeScript | Existing `^15.5.24` / `^5` | Authenticated route, provider adapter, quota, ingestion, UI | Preserves the current application and `{ url }` boundary. Verbatim `package.json`: `"next": "^15.5.24",` and `"typescript": "^5",`. [VERIFIED: package.json:64,96] |
| Python | Container-pinned CPython `>=3.10` | Isolated Scrapling runtime | PyPI metadata declares Python `>=3.10`; the repo does not define a Python runtime. Pin and validate a target container. [CITED: https://pypi.org/project/scrapling/] |
| Scrapling | `0.4.15` candidate; released 2026-08-23 | Static spider, robots, scheduling and extraction | Official docs expose custom Spider and `SiteToMarkdownSpider`; package check is `SUS` (unknown downloads), so gate installation behind human verification. [CITED: https://pypi.org/project/scrapling/] [WARNING: SUS; planner must add `checkpoint:human-verify` before install.] |
| MongoDB Atlas Vector Search | Existing deployment/index | Staged website chunks and retrieval | Preserve existing collection, vector size, embedding model and owner filter; add indexed generation filtering. [VERIFIED: src/lib/vectorStore.ts:3-7,44-57,133-143] [CITED: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/] |
| Existing Gemini embedding helper | Existing `gemini-embedding-001` | Embed crawled page chunks | Reuse `embedText` for website and chat query embeddings; do not add a Python embedding path. [VERIFIED: src/lib/embeddings.ts:6-20; src/app/api/chat/route.ts:63-65] |

### Supporting

| Library / Service | Version | Purpose | When to Use |
|-------------------|---------|---------|-------------|
| Scrapling `fetchers` extra | Same pinned release | Spider HTTP sessions | Install only the extras needed by the chosen static spider. PyPI docs say spider/fetcher classes require `scrapling[fetchers]`; browser installation downloads browser dependencies, so include only if required by the selected session. [CITED: https://pypi.org/project/scrapling/] |
| Scrapling browser runtime | Pin with service image if enabled | JavaScript fallback | Keep disabled by default; if enabled under a small budget, restrict subrequests using the same egress policy. A browser blocked-domain list alone is not IP-range/SSRF enforcement. [CITED: https://scrapling.readthedocs.io/en/latest/fetching/dynamic.html] |
| MongoDB Node driver | Existing `mongodb` `^6.3.0` | Stage/update vectors and inspect search index status | Keep database operations in the app; `listSearchIndexes` exposes index status/queryability. Verbatim `package.json`: `"mongodb": "^6.3.0",`. [VERIFIED: package.json:60] [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.getSearchIndexes/] |
| Docker | Installed locally, `29.1.2` | Build and test crawler container | Use for local service/fixture integration. Cloud SDK is absent locally; use configured deployment CI or set up the SDK before Cloud Run rollout. [VERIFIED: local runtime probe, 2026-10-02] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Generic `SiteToMarkdownSpider` unchanged | Custom Scrapling `Spider` using documented request/callback APIs | Custom spider is needed for exact-origin checks, locked ordering and server-owned budgets; the public template page does not document page/depth caps. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/requests-responses.html] |
| Remove legacy path at once | Temporary legacy provider behind a shared adapter | Keep it through end-to-end acceptance and a short stability window; it must obey identical policy and publication code. [VERIFIED: 01-CONTEXT.md, D-10 to D-12] |
| Run Python in a Next.js subprocess | Separate crawler service | Separates browser/runtime dependencies and resource ceilings. Existing integration proposal recommends this; actual service routing still needs validation against the production app host. [CITED: docs/scrapling-integration-plan.md, Plans 1-3] |

**Installation:**

```bash
pip install "scrapling[fetchers]==0.4.15"
```

Install browser binaries only if dynamic rendering is enabled; do not install Scrapling RAG extras because NochBot retains its own chunking/embedding pipeline. [CITED: https://pypi.org/project/scrapling/]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `scrapling` | PyPI | 40 days at research date; released 2026-08-23 | Unknown (`weeklyDownloads: null`) | `github.com/D4Vinci/Scrapling` | SUS (`unknown-downloads`) | Keep with `checkpoint:human-verify` before install. [CITED: https://pypi.org/project/scrapling/] [VERIFIED: GSD package-legitimacy check, ecosystem pypi, scrapling] |

**Packages removed due to SLOP verdict:** none.  
**Packages flagged as suspicious SUS:** `scrapling`; planner inserts `checkpoint:human-verify` before installing.

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart LR
  UI[Configure page: {url}] --> API[Authenticated crawl route]
  API --> AUTH[URL policy + account plan + server-owned budgets]
  AUTH -->|private authenticated request| PROVIDER[Scrapling provider adapter]
  PROVIDER --> SPIDER[Custom ordered spider]
  SPIDER --> POLICY[Origin + DNS/IP + redirect + robots + byte/time controls]
  POLICY --> SITE[Submitted public site]
  SPIDER --> RESULT[Normalized page outcomes]
  RESULT --> INGEST[Quality gate + page chunks + existing embeddings]
  INGEST --> STAGE[Atlas staged generation]
  STAGE --> READY[Queryability/readiness check]
  READY -->|ready and complete| ACTIVATE[Switch active generation pointer]
  READY -->|failure or empty| OLD[Keep prior generation active]
  ACTIVATE --> CHAT[Regular and embedded chat retrieval]
  OLD --> CHAT
```

The authenticated app route is the user/tenant policy boundary; the crawler receives only a bounded crawl job and returns page results. The project proposal assigns fetching to a private Python service while MongoDB/embeddings remain in Next.js. [CITED: docs/scrapling-integration-plan.md] Project guidance reports Vercel deployment and also Firebase App Hosting configuration; Google Cloud documents that Cloud Run `internal` ingress expects VPC-routed callers. Verify which host actually serves this route and whether it has an appropriate private path before selecting ingress. [VERIFIED: AGENTS.md:111-113] [CITED: https://docs.cloud.google.com/run/docs/securing/private-networking] [ASSUMED: actual deployment and its path to Cloud Run are not established]

### Recommended Project Structure

```text
scraper/
  app.py                 # bounded authenticated crawl endpoint
  spider.py              # ordering, depth, page cap, robots and outcomes
  url_policy.py           # parse/canonicalize, DNS/IP and redirect policy
  tests/                  # deterministic local HTTP fixture tests
  Dockerfile
src/lib/
  crawler/types.ts        # normalized provider request/results
  crawler/scrapling.ts    # server-only service client
  crawler/legacy.ts       # temporary legacy provider, same policy contract
  crawler/publish.ts      # chunk/embed/stage/readiness/activate orchestration
```

This is a planning recommendation, not existing filesystem state. Keep Python focused on fetch/extract and TypeScript responsible for entitlements, tenant ownership and Atlas writes. [CITED: docs/scrapling-integration-plan.md, Plans 1-2]

### Pattern 1: Deterministic Candidate Scheduling

**What:** Start with the submitted URL, then primary navigation links, bounded same-origin sitemap candidates, and breadth-first same-origin links. Before scheduling, canonicalize obvious variants, deduplicate and classify likely knowledge pages with deterministic URL/anchor/title rules; use stable priority. [VERIFIED: 01-CONTEXT.md, D-02 and D-03]

**When to use:** Every crawl, before selected pages count against the server-computed plan ceiling.

**Implementation guidance:** Scrapling request priority can process important requests first; its engine fingerprint includes URL/method/body/session. Maintain a separate canonical URL set because the default fingerprint is not documented as product-specific handling for trailing slashes, tracking parameters, fragments or encoding. Avoid rewriting path case or removing arbitrary query keys because they can select different content. Keep fragments and tracking-only variants from consuming page quota; preserve meaningful query data but redact it in logs. `allowed_domains` includes subdomains, so independently enforce exact scheme/host/port origin. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/requests-responses.html] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html]

**Implementation skeleton adapted from official docs:**

```python
from scrapling.spiders import Spider, Response

class SiteSpider(Spider):
    name = "site"

    async def parse(self, response: Response):
        for link in response.css("a::attr(href)").getall():
            yield response.follow(link, callback=self.parse, priority=10)
```

Source: [Scrapling request priority docs](https://scrapling.readthedocs.io/en/latest/spiders/requests-responses.html). Collect/classify candidates before yielding; carry depth in request metadata or an explicit queue wrapper and stop before enqueue at the depth/page ceiling. The public docs reviewed do not establish a built-in depth cap or `max_pages` setting. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/requests-responses.html] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html]

### Pattern 2: Provider Failure Boundary

Compute user plan and server-owned budgets once in the route, invoke Scrapling, then normalize the result. Allow legacy fallback only when the service is unreachable, its bounded call times out, or it returns a server-side failure. Do not fallback on URL-policy rejection, robots denial, blocked destination, empty/unsupported content, plan cap, or any crawl result already returned; never fallback after chunk/embed/Atlas failure. Both providers use the same origin/SSRF policy, ordering, page cap, quality gate and generation publication operation. [VERIFIED: 01-CONTEXT.md, D-01 through D-12] [ASSUMED: exact service error codes and retry count need implementation confirmation]

### Pattern 3: Stage Then Publish

Verbatim source values:

```typescript
export const KNOWLEDGE_VECTOR_COLLECTION = 'nochbot_chunks';
const VECTOR_SIZE = 3072;
const KNOWLEDGE_VECTOR_INDEX = 'nochbot_chunks_vector_index';
```

[`src/lib/vectorStore.ts:3-7`]. The current retrieval and destructive replacement also contain:

```typescript
await collection.deleteMany({ userId });
filter: { userId },
```

[`src/lib/vectorStore.ts:94,141`]. Embedding model:

```typescript
const EMBED_MODEL = 'gemini-embedding-001';
```

[`src/lib/embeddings.ts:9`]. Preserve these values and the existing owner filter; add the generation filter only after Atlas index support is ready. [VERIFIED: src/lib/vectorStore.ts:3-7,94,141; src/lib/embeddings.ts:9]

Use a server-generated `generationId` for candidate chunks. Extend the Atlas vector index with a filter definition for it and update regular and embedded chat searches to filter on both owner and active generation. MongoDB requires prefilter fields to be declared in the vector index; `listSearchIndexes` reports status/queryability, and index operations are asynchronous. Keep old vectors/pointer intact while staging. After all selected usable pages are chunked, embedded and written, perform a bounded candidate-readiness query, atomically update the knowledge pointer, then clean prior generations after activation. Do not treat a successful Mongo insert as proof of search readiness. [CITED: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/] [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.getSearchIndexes/] [CITED: https://www.mongodb.com/docs/languages/python/pymongo-driver/current/indexes/geospatial-index/] [ASSUMED: polling interval, timeout, pointer field name and cleanup retention require a decision]

Preserve compatibility for old vector documents without generation metadata: if no pointer exists, use a deliberate legacy-read path so existing users do not retrieve zero results. Current `replaceKnowledgeChunks` calls `deleteMany({ userId })`, so it cannot stage a crawl safely without changing that deletion behavior. [VERIFIED: src/lib/vectorStore.ts:86-107,133-143]

### Pattern 4: API/UI Compatibility

Verbatim route response excerpt from `src/app/api/crawl/route.ts:332-341`:

```typescript
success: true,
pagesCrawled: visited.size,
chunks: points.length,
characters: fullText.length,
crawlUsage: {
  used: crawlCheck.used + 1,
  limit: crawlCheck.limit,
  plan,
},
```

The dashboard sends `body: JSON.stringify({ url: crawlUrl.trim() })` and reads `const pages = data.pages || []`, iterating `p.url`/`p.chars` (`src/app/dashboard/configure/page.tsx:78-82,92-108`). Preserve those fields, add `pages` entries with title, safe URL, outcome/status, sanitized reason and per-page chunk count, and include cap/fallback/prior-version indicators. Reconcile the route/client mismatch: the active route response excerpt above has no `pages` field. Verbatim caller contract: `body: JSON.stringify({ url: crawlUrl.trim() })` and `const pages = data.pages || [];`. [VERIFIED: src/app/api/crawl/route.ts:330-343; src/app/dashboard/configure/page.tsx:78-82,92-108]

Requirement quote from `.planning/REQUIREMENTS.md:14`: “Crawl outcomes distinguish fetched, skipped, blocked, failed, and indexed pages and remain compatible with dashboard result rendering.” Use these labels or a stable documented equivalent; cap-deferred candidates are not failures. Page-cap warning is non-blocking on successful indexing; failed recrawl feedback says the previous indexed version is still available. [VERIFIED: .planning/REQUIREMENTS.md:14; 01-CONTEXT.md, D-04, D-06 to D-09]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async crawl scheduling, robots, priorities and crawl stats | New generic scheduler or ad hoc HTTP loop | Scrapling `Spider`/request engine | Existing docs provide callbacks, scheduler, dedup, robots mode and stats; add product-specific exact-origin/page/depth policy. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/architecture.html] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html] |
| SSRF, redirects, DNS rebinding and browser egress | URL string checks or trusting `allowed_domains` | Shared URL/IP policy, redirect-aware transport and enforced egress firewall/proxy | OWASP documents redirect and DNS-pinning bypasses; Scrapling's domain setting permits subdomains. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html] |
| Chunk embeddings and vector search | Crawler-side embeddings, dimensions, collection or Mongo client | Existing `embedText`, staged vector helper and `searchKnowledgeChunks` | Keeps one embedding/retrieval contract and owner scope. [VERIFIED: src/lib/embeddings.ts:9-20; src/lib/vectorStore.ts:3-7,86-143] |
| Atlas candidate readiness | Assume Mongo insert means indexed/queryable | `listSearchIndexes` plus a candidate-generation query probe | Index operations are asynchronous; queryability is inspectable and a filtered candidate lookup verifies retrieval. The latter is the recommended readiness check. [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.getSearchIndexes/] [ASSUMED: bounded readiness settings need an operations decision] |
| Per-user monthly quota reservation | Another route-local crawl-log count | Existing entitlement boundary, made atomic if concurrent requests can race | Current check counts log entries and route logs after indexing; concurrent requests may pass together. [VERIFIED: src/lib/ratelimit.ts:35-47,78-91; src/app/api/crawl/route.ts:232-242,322-343] |

**Key insight:** Scrapling is the fetch/extraction engine, not the tenant security, quota, data-publication or RAG boundary. Application and network policy must govern every Scrapling session and every legacy retry. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/architecture.html] [VERIFIED: .planning/REQUIREMENTS.md:28-49]

## Common Pitfalls

### 1. Page Limit Applied After Scheduling

**What goes wrong:** Worker fetches more than a plan cap because only returned items are truncated. **How to avoid:** Deduplicate and count before enqueue; also enforce total request counter for sitemap/robots/redirect requests. Depth and global time/bytes/concurrency are separate server ceilings. **Warning signs:** fetched count exceeds selected cap or requests continue after cap. [VERIFIED: .planning/REQUIREMENTS.md:12; CITED: https://scrapling.readthedocs.io/en/latest/spiders/requests-responses.html]

### 2. “Same Domain” Leaks to Subdomains or Redirect Targets

**What goes wrong:** `allowed_domains` admits subdomains, and redirects/browser subrequests can reach a private IP or other origin. **How to avoid:** Require exact origin (scheme, host, effective port); validate every resolved A/AAAA address and redirect target; disable automatic redirects where possible and follow manually through the same policy; apply egress controls to browser requests and robots/sitemaps too. DNS validation before a client independently re-resolves remains vulnerable to rebinding, so enforce destination policy at connect/egress. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]

### 3. Robots, Sitemap or Browser Requests Escape the Policy

**What goes wrong:** Main page URLs are checked but robots.txt, sitemap URLs, redirects, scripts, XHR or media use separate fetch paths. **How to avoid:** Route every request through one destination gate; keep dynamic rendering disabled unless subrequests are covered by egress policy. Scrapling robots support observes disallow/delay and records denied counts, but app-specific address rules remain necessary. [CITED: https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html] [CITED: https://scrapling.readthedocs.io/en/latest/fetching/dynamic.html]

### 4. Sitemap or Priority Ordering Becomes Unbounded

**What goes wrong:** A large sitemap consumes budget before useful navigation candidates, or priority starves BFS. **How to avoid:** Process locked source tiers; cap sitemap fetch/parse bytes and candidate count; classify core knowledge types deterministically; enforce depth/page ceilings before enqueue; keep stable order inside each priority class. [VERIFIED: 01-CONTEXT.md, D-01 to D-03] [ASSUMED: exact sitemap candidate cap and category rules need planning]

### 5. URL Canonicalization Merges Different Content or Leaks Secrets

**What goes wrong:** Removing all query parameters merges distinct pages, while retaining tracking values consumes slots and leaks identifiers. **How to avoid:** Remove fragments and known tracking-only keys, normalize host/default port and a conservative trailing slash rule, preserve semantic query keys and submitted origin, and use a separate redacted display/log URL. Avoid raw URL logs. [ASSUMED: canonicalization rules must be validated by fixtures]

### 6. Legacy Fallback Weakens Security or Publication

**What goes wrong:** Scrapling failure triggers current Axios path without matching SSRF/robots policy or through another publish path. **How to avoid:** Fallback only for timeout/unavailable/5xx; policy and robots outcomes are terminal. Reuse same origin/IP/redirect/egress, ordering, per-plan/quality rules and generation publisher. Never fallback on embedding/database failures. [VERIFIED: 01-CONTEXT.md, D-10 to D-12] [VERIFIED: src/app/api/crawl/route.ts:252-302]

### 7. Atlas Pointer Changes Before Search Is Ready

**What goes wrong:** Generation filter is queried before the index recognizes its new field or staged vectors, producing empty chat retrieval. **How to avoid:** Update/verify filter definition before deploying generation-filter queries; stage and run a filtered readiness probe before atomic pointer switch; preserve a legacy-read branch until migration is covered. [CITED: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/] [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.getSearchIndexes/] [ASSUMED: pointer schema and probe schedule are implementation choices]

### 8. Diagnostics Expose Sensitive URL Data

**What goes wrong:** Current crawl logs include raw URL, and `logCrawl` stores URL in `crawl_logs`; query values may contain tokens or personal identifiers. **How to avoid:** Keep correlation ID, safe host/path, status/category and counts; redact query/fragment before persistence, response and logs. Never return exception text or page body. [VERIFIED: src/app/api/crawl/route.ts:257,345-350; src/lib/ratelimit.ts:46-51] [VERIFIED: .planning/REQUIREMENTS.md:18]

### 9. Concurrent Crawls Oversubscribe Monthly or Runtime Quotas

**What goes wrong:** Quota check and later crawl-log insert are separate; concurrent requests can both pass. Monthly crawl count and per-crawl page count are different units. **How to avoid:** Keep entitlement checks, add atomic reservation or per-user in-flight limit, settle/release by explicit result, and cap global/per-tenant service work. Decide whether service failure with successful fallback counts once. [VERIFIED: src/lib/ratelimit.ts:35-47,78-91] [ASSUMED: quota settlement semantics need a product decision]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct Axios/Cheerio breadth-first fetch in Next route with fixed cap | Pinned Scrapling spider behind provider adapter and independently controlled Python runtime | This phase | Enables deliberate scheduling/robots/stats while preserving app auth and ingestion. [VERIFIED: src/app/api/crawl/route.ts:167-172,261-322] [CITED: https://scrapling.readthedocs.io/en/latest/spiders/architecture.html] |
| Delete old user vectors before next write | Stage candidate generation, verify readiness, switch active metadata, then clean old chunks | This phase | Prevents empty knowledge after failed or unindexed recrawl. [VERIFIED: src/lib/vectorStore.ts:95-107] [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.getSearchIndexes/] |
| Vector filter only on `userId` | `userId` plus active generation filter | This phase | Selects active data while maintaining tenant isolation; generation must be an indexed filter field. [VERIFIED: src/lib/vectorStore.ts:133-143] [CITED: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/] |

**Deprecated/outdated:** Current destructive `replaceKnowledgeChunks` behavior cannot safely publish recrawls as-is. Preserve its behavior for other callers or replace it with a staged helper after checking all call sites. [VERIFIED: src/lib/vectorStore.ts:86-107]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Next.js app, Vitest, provider client | Yes | Node `v22.19.0`; npm `11.6.0` | — [VERIFIED: local runtime probe, 2026-10-02] |
| Python | Scrapling service | Yes | `python`: `3.12.10`; `py` launcher default: `3.13.1` | Pin service container explicitly; Scrapling declares `>=3.10`. [VERIFIED: local runtime probe, 2026-10-02] [CITED: https://pypi.org/project/scrapling/] |
| Scrapling package | Spider | No | Not installed in local `python` interpreter | Install pinned version after human verification checkpoint. [VERIFIED: local import probe, 2026-10-02] |
| Playwright Python package | Possible dynamic fallback | Yes in `python` interpreter | Version not probed | Keep dynamic path disabled until pinned Scrapling/browser combination is tested. [VERIFIED: local import probe, 2026-10-02] |
| Docker | Build/test service container | Yes | `29.1.2` | — [VERIFIED: local runtime probe, 2026-10-02] |
| Google Cloud CLI (`gcloud`) | Cloud Run deployment | No | — | Use configured CI/deployment identity or provision Cloud SDK. [VERIFIED: local command probe, 2026-10-02] |
| MongoDB Atlas connection | Index and end-to-end verification | Not determined | — | `.env` was not read; use non-production credentials when authorized. [VERIFIED: AGENTS.md:54-65] |
| Scrapling browser binaries/system libraries | Dynamic rendering only | Not determined | — | Not required if static-only; otherwise bake into pinned image. [CITED: https://pypi.org/project/scrapling/] |

**Missing dependencies with no fallback:** Cloud Run deployment tooling is absent locally; deploy through configured CI or provision the SDK before rollout.  
**Missing dependencies with fallback:** Scrapling is not installed; install after the required package checkpoint. Atlas availability was not probed because credentials are in the unread secret environment file.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.7` for TypeScript; Python standard-library `unittest` recommended until a service test framework is chosen |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run src/lib/crawler/*.test.ts` (adjust to actual test paths) |
| Full suite command | `npm test` |

Vitest includes `src/**/*.test.ts`; current tests found cover booking/ticketing, with no crawler or vector-store test file. [VERIFIED: package.json `test` script; vitest.config.ts:1-18; local test-file scan, 2026-10-02]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRAWL-01 | Authenticated `{ url }` request and compatible response keys | API integration | `npm test -- --run src/app/api/crawl/route.test.ts` | No; Wave 0 |
| CRAWL-02 | Normalized page/title/text/URL outcomes from Scrapling | Python unit + fixture integration | `python -m unittest discover scraper/tests` | No; Wave 0 |
| CRAWL-03 | Plan cap, depth, total requests/time/bytes/concurrency, redirect, same-origin | Python policy/scheduler tests | `python -m unittest discover scraper/tests` | No; Wave 0 |
| CRAWL-04 | Public DNS, private/loopback/link-local, IPv4/IPv6, rebinding and redirect-to-private blocked | Python unit + controlled DNS/HTTP fixture | `python -m unittest discover scraper/tests` | No; Wave 0 |
| CRAWL-05 | Fetched/skipped/blocked/failed/indexed and cap-deferred outcomes render safely | TypeScript unit + dashboard/API integration | `npm test -- --run src/app/api/crawl/route.test.ts` | No; Wave 0 |
| CRAWL-06 | Existing collection, embedding size/model and owner filter preserved; generation filter used | Vector-store integration | `npm test -- --run src/lib/vectorStore.test.ts` | No; Wave 0 |
| CRAWL-07 | Fetch/chunk/embed/insert/readiness failures leave old generation active | Fault-injection integration | `npm test -- --run src/lib/crawler/publish.test.ts` | No; Wave 0 |
| CRAWL-08 | Active generation answers same fact through regular and embedded chatbot | Non-production E2E/manual | Crawl fixture site, then ask a fact-specific question via regular and embedded chat | No; E2E |
| CRAWL-09 | Safe categories/correlation logs, no body/secret/query values | Unit + log-capture integration | `npm test -- --run src/app/api/crawl/route.test.ts` and Python suite | No; Wave 0 |

### Sampling Rate

- Per task: run the focused Python or Vitest test for touched policy/provider/publisher.
- Per integration wave: run `npm test` and the Python crawler suite.
- Phase gate: build worker, verify security fixtures, typecheck and run full app suite; then do one authorized non-production dashboard-to-Atlas-to-regular-and-embedded-chat acceptance and failed-recrawl preservation check. Live-site E2E does not replace deterministic fixtures. [CITED: docs/scrapling-integration-plan.md, Plan 3 Acceptance Gate]

### Wave 0 Gaps

- [ ] Add Python service tests and deterministic local HTTP fixture for relative links, URL variants, redirects, robots, depth, response size and JS-only content.
- [ ] Add TypeScript tests for route compatibility, service failure classification, quota reservation, page response and generation activation/failure preservation.
- [ ] Add controlled DNS/egress fixtures for IPv4/IPv6 special ranges, rebinding, redirect-to-private, exact origin and browser requests.
- [ ] Decide Python HTTP framework and local launch command; verify any external package before adding it.
- [ ] Verify Atlas generation filter index definition and candidate-readiness behavior in non-production Atlas.

## Security Domain

Security enforcement is enabled in `.planning/config.json` (`security_enforcement: true`, ASVS level 1). [VERIFIED: .planning/config.json:48-49]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Require authenticated user for the route and authenticated app-to-crawler calls; do not expose service credentials to browser code. [CITED: https://devguide.owasp.org/en/03-requirements/05-asvs/] |
| V3 Session Management | Yes | Preserve existing authenticated cookie/session checks at Next.js route; service identity is separate. [VERIFIED: AGENTS.md:142-145] |
| V4 Access Control | Yes | Scope staged writes, readiness query, activation and retrieval to owning `userId`; do not trust user-supplied owner/generation fields. [VERIFIED: AGENTS.md:15; src/lib/vectorStore.ts:133-143] |
| V5 Validation, Sanitization and Encoding | Yes | Parse URL structurally; allow only HTTP(S), exact origin, safe ports and public resolved destinations; validate redirects and sanitize output. [CITED: https://devguide.owasp.org/en/03-requirements/05-asvs/] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| V6 Stored Cryptography | Limited | Use platform TLS/service identity or established credential mechanism; do not invent signing or log service secrets. [CITED: https://devguide.owasp.org/en/03-requirements/05-asvs/] |
| V7 Error Handling and Logging | Yes | Emit correlation ID, stage, safe category and counters; redact query/fragment, provider payload and raw HTML. [VERIFIED: .planning/REQUIREMENTS.md:18] [CITED: https://devguide.owasp.org/en/03-requirements/05-asvs/] |
| V9 Communications | Yes | Use TLS for app-to-service and control crawler egress through a policy-enforcing network path. [CITED: https://devguide.owasp.org/en/03-requirements/05-asvs/] |
| V13 API and Web Service | Yes | Validate request/provider schemas, authenticate service calls, enforce server-side limits and map errors safely. [CITED: https://devguide.owasp.org/en/03-requirements/05-asvs/] |
| V14 Configuration | Yes | Keep service credentials in server secrets; set bounded resources, restrictive ingress and explicit egress. [CITED: https://devguide.owasp.org/en/03-requirements/05-asvs/] [CITED: https://docs.cloud.google.com/run/docs/securing/private-networking] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via URL, DNS rebinding, redirect, robots, sitemap or subresource | Spoofing / Information disclosure | Validate every target and A/AAAA result, manually validate redirects, require exact origin, and enforce blocked ranges at egress/connect time. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| Cross-tenant vector visibility | Information disclosure | Preserve mandatory user filter on every write/query; add generation filter and test two users with overlapping content. [VERIFIED: AGENTS.md:15; src/lib/vectorStore.ts:133-143] |
| Crawled prompt injection or malicious extracted text | Tampering / Elevation of privilege | Treat fetched text as untrusted RAG evidence; it must not modify system instructions or authorize tools. [ASSUMED: include only if prompt/tool behavior is in this phase's acceptance scope] |
| Sensitive values in URL or exception | Information disclosure | Redact before storage, response and log; use safe categories and correlation IDs. [VERIFIED: .planning/REQUIREMENTS.md:18; src/lib/ratelimit.ts:35-47] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Paid per-crawl limits could provisionally be finite values above 15 (for example starter 30, pro 50, hard max 50); current monthly quotas and no service measurements do not justify final numbers. | Standard Stack / Open Questions | High caps can exceed request/cost budget; low caps can under-serve tiers. Confirm before locking. |
| A2 | The production Next.js host can reach the Python service using the intended private Cloud Run/network arrangement. | Architecture / Open Questions | Internal Cloud Run ingress requires VPC-routed access; Vercel connectivity and actual deployment are unestablished. |
| A3 | Generation metadata uses a server-generated `generationId` and active pointer in knowledge metadata. | Stage Then Publish | Existing records may need a different compatibility/migration path. |
| A4 | A bounded filtered Atlas query is suitable as final readiness probe before pointer activation. | Stage Then Publish | Probe must prove staged generation visibility without mixing it into active reads. |
| A5 | Canonicalization removes fragments/tracking-only query values while preserving content-selecting keys. | Common Pitfalls | Aggressive normalization may merge distinct pages; weak normalization consumes quota. |
| A6 | Standard-library `unittest` is enough until a Python test framework is selected. | Validation Architecture | Async HTTP testing may need a verified extra package. |
| A7 | Crawled text should be handled as untrusted prompt/context material. | Security Domain | If LLM prompt/tool policy is outside scope, keep this as a retrieval security note only. |
| A8 | Exact crawler-service failure codes, retry count and quota settlement behavior follow the narrow policy described in the patterns. | Provider Failure Boundary / Open Questions | A broad retry/fallback classification could bypass URL/content decisions or double-count monthly quota. |
| A9 | Sitemap candidate cap and deterministic content-type scoring rules will be selected during planning. | Deterministic Candidate Scheduling | Unbounded sitemap parsing can consume time/bytes/page budget or starve useful candidates. |
| A10 | The live Atlas deployment permits index inspection/update and the recommended candidate query can confirm staged visibility. | Stage Then Publish / Open Questions | Without access/readiness, generation activation could cause temporary empty retrieval or over-retain old vectors. |

## Open Questions

1. **What production host/network path will call the Python service?** Repo guidance names Vercel and also has Firebase App Hosting config; existing proposal suggests Cloud Run. Cloud Run `internal` ingress expects VPC-routed requests. Confirm private connectivity or define authenticated externally reachable ingress with strict service identity before implementation. [VERIFIED: AGENTS.md:65-72] [CITED: https://docs.cloud.google.com/run/docs/securing/private-networking]
2. **What are paid page limits and the global maximum?** Current source defines monthly crawl counts, not per-crawl page counts. Verbatim `src/lib/ratelimit.ts:4-8`:

   ```typescript
   export const PLAN_LIMITS = {
     free:    { messagesPerMonth: 100,   crawlsPerMonth: 1   },
     starter: { messagesPerMonth: 5000,  crawlsPerMonth: 10  },
     pro:     { messagesPerMonth: 50000, crawlsPerMonth: 999 },
   } as const;
   ```

   Entry page cap is locked at 15. Choose finite paid caps/global ceiling after measuring duration, bytes and embedding cost; determine if 999 monthly crawls needs an operational clamp. [VERIFIED: src/lib/ratelimit.ts:4-8] [VERIFIED: 01-CONTEXT.md, D-01]
3. **Which service failure codes and retry count qualify for fallback?** Recommend timeout/unavailable/5xx only; never fallback after policy/content result or application ingestion starts. Exact retry count remains open. [VERIFIED: 01-CONTEXT.md, D-10 to D-11]
4. **Which existing plans/upgrade flow should receive the entry-cap link?** D-08 requires linking to the established plans/upgrade flow. Inspect current account/billing navigation and reuse that destination rather than inventing a route. [VERIFIED: 01-CONTEXT.md, D-08]
5. **Which Atlas readiness/cleanup policy is safe on the deployed cluster?** Confirm current vector index definition, generation filter update, `listSearchIndexes` permission, staged-write visibility, poll timeout and old-generation cleanup timing. `.env` and live Atlas were not inspected. [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.getSearchIndexes/] [ASSUMED: live cluster readiness/permissions unverified]
6. **Does synchronous crawling fit host timeouts at the chosen cap?** Background jobs are deferred; measure fixture and authorized production-scale sites before locking paid/global limits. [VERIFIED: 01-CONTEXT.md, Deferred Ideas]

## Sources

### Primary Project Sources (HIGH confidence)

- Project source of truth: `.planning/phases/01-scrapling-website-crawl/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, and `AGENTS.md` (read this session).
- NochBot implementation: `src/app/api/crawl/route.ts`, `src/app/dashboard/configure/page.tsx`, `src/lib/ratelimit.ts`, `src/lib/embeddings.ts`, `src/lib/vectorStore.ts`, `src/app/api/chat/route.ts`, `package.json`, and `vitest.config.ts` (read this session; `.env` and `env.txt` were not read).
### Primary Documentation (MEDIUM confidence)

- Scrapling official docs: [Spider getting started](https://scrapling.readthedocs.io/en/latest/spiders/getting-started.html), [architecture](https://scrapling.readthedocs.io/en/latest/spiders/architecture.html), [request/response API](https://scrapling.readthedocs.io/en/latest/spiders/requests-responses.html), [Spider API](https://scrapling.readthedocs.io/en/latest/api-reference/spiders.html), [generic templates](https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html), [dynamic fetching](https://scrapling.readthedocs.io/en/latest/fetching/dynamic.html) (reviewed 2026-10-02).
- [PyPI Scrapling project and 0.4.15 release metadata](https://pypi.org/project/scrapling/) (release 2026-08-23; `pip index versions scrapling` returned `0.4.15`; package verdict SUS).
- MongoDB docs: [Vector Search filtering](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/), [index queryability/status](https://www.mongodb.com/docs/manual/reference/method/db.collection.getSearchIndexes/), [index management](https://www.mongodb.com/docs/search/indexes/manage-indexes/).
- OWASP [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) and [ASVS overview](https://devguide.owasp.org/en/03-requirements/05-asvs/).
- Google Cloud [Cloud Run private networking](https://docs.cloud.google.com/run/docs/securing/private-networking) and [network egress best practices](https://docs.cloud.google.com/run/docs/configuring/networking-best-practices).

### Tool-Checked Findings (MEDIUM confidence)

- `pip index versions scrapling` reported `0.4.15`; the GSD package legitimacy check returned `SUS`, reason `unknown-downloads`; GSD confidence seam classified official websearch with verification as MEDIUM.
- Local read-only availability probes found Node, npm, two Python interpreters, Docker, and Playwright in the `python` interpreter; Scrapling and `gcloud` were unavailable. No secret environment files were read.
- Project proposal `docs/scrapling-integration-plan.md`; treated as recommendation background, not an override for newer locked CONTEXT decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — existing TypeScript/Atlas contracts and current Scrapling docs/registry checked; package gate returned SUS and service runtime is unpinned.
- Architecture: MEDIUM — provider/data boundaries are clear, but private connectivity and deployed Atlas readiness remain unresolved.
- Pitfalls: HIGH — grounded in active destructive write behavior, raw URL logging, Scrapling docs, OWASP SSRF guidance and MongoDB index docs.

**Research date:** 2026-10-02  
**Valid until:** 2026-10-09 for Scrapling/package and Cloud Run details; 2026-11-01 for stable source contracts, or sooner if crawl/deployment code changes.
