# Technology Stack

**Project:** NochBot  
**Researched:** 2026-10-01  
**Confidence:** MEDIUM

## Recommended Stack

Keep the existing application stack. Add Scrapling as a separately deployed, private Python service behind a small server-side provider adapter; do not port ingestion, embeddings, or retrieval to Python.

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js App Router | Existing `^15.5.24` | Product UI, authenticated `POST /api/crawl`, orchestration | Preserves the current dashboard contract and existing server-side auth/account/quota boundaries. |
| TypeScript | Existing `^5` | Crawl provider contract and route orchestration | Gives the active route a stable normalized page result independent of crawler implementation. |
| Python | Pin to a Scrapling-supported version during phase planning | Isolated crawler runtime | Scrapling is a Python library and browser-backed fetching has distinct runtime/resource needs from the Next server. |

### Database and Retrieval

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| MongoDB Atlas | Existing deployment | Knowledge metadata and chunk storage | Preserve the current collection/schema, vector dimensions, embedding provider, user isolation, and `$vectorSearch` retrieval. |
| Atlas Vector Search | Existing index definition | Semantic retrieval | Keep downstream RAG unchanged while replacing only page fetching/extraction. Atlas Search indexes are eventually consistent, so generation activation needs a readiness policy. |

### Crawler

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Scrapling | Pin an exact verified PyPI release and commit lockfile | Bounded multi-page crawl and per-page Markdown extraction | Use `SiteToMarkdownSpider` as the initial candidate after validating its API and extension points against the pinned version. |
| Scrapling static fetch session | Same pinned release | Default HTTP retrieval | Use for the normal crawl path; lowest operational cost and simplest resource profile. |
| Scrapling dynamic session | Same pinned release plus browser runtime requirements | JavaScript-rendered fallback | Enable only for a small, explicit per-crawl budget when static extraction yields insufficient useful content. |

## Integration Shape

```text
Dashboard -> existing Next.js POST /api/crawl -> auth/policy/quota
  -> private authenticated crawler provider -> Scrapling service
  -> normalized page results -> existing chunk/embed/Atlas pipeline
  -> stage generation -> activate on success -> existing chat retrieval
```

The Python service should return page-level URL/title/Markdown/outcome data and aggregate crawl statistics only. It should not receive database credentials, embed content, or persist tenant data. The application must retain responsibility for URL validation, ownership, crawl limits, chunking, Gemini embedding, MongoDB persistence, generation activation, and retrieval filtering.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Scrapling runtime | Private Python crawler service | Run Python subprocesses inside Next.js request handlers | Couples deployments, complicates process lifecycle and browser dependencies, and weakens resource isolation. |
| Crawler integration | Provider boundary with legacy adapter for rollout | Replace route and scraper in one step | Provider boundary preserves request/response compatibility and allows bounded rollback. |
| Dynamic pages | Static-first with a constrained dynamic fallback | Browser-render every URL or use stealth fetching by default | Higher latency/resource cost and expanded abuse surface without a demonstrated need for every page. |
| RAG/storage | Existing MongoDB Atlas Vector Search and embedding pipeline | Move ingestion or retrieval into the Python crawler | Expands scope and risks schema, tenant isolation, embedding, and chatbot behavior. |

## Operational Requirements

- Pin Scrapling and Python runtime versions; confirm `SiteToMarkdownSpider` signatures and scheduler extension points during phase research.
- Expose the crawler only on a private network or authenticated service channel. Keep service credentials and target-URL policy on the server.
- Use explicit connection/read/overall timeouts, concurrency, page/depth/byte budgets, redirect validation, and request throttling.
- Keep dynamic rendering disabled by default and cap browser pages, total browser time, memory, and subresource access.
- Return structured per-page outcomes so partial, blocked, and failed results remain distinguishable from successful indexed content.
- Stage vectors in MongoDB with a generation identifier and activate only after the new corpus is persisted and meets the searchable/readiness policy; keep the old active generation intact until then.
- Add service health/readiness checks, crawl correlation IDs, bounded retries, and metrics without logging full page bodies or sensitive URL query strings.

## Sources

- Scrapling official generic crawler templates: [SiteToMarkdownSpider](https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html) (accessed 2026-10-01).
- Scrapling repository and documentation: [D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling) (API/version must be pinned and revalidated before implementation).
- Next.js official docs: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (accessed 2026-10-01).
- MongoDB official docs: [Vector Search](https://www.mongodb.com/docs/vector-search/) and [Search index performance and consistency](https://www.mongodb.com/docs/search/performance/index-performance/) (accessed 2026-10-01).
- Existing NochBot stack map: `.planning/codebase/STACK.md` (mapped 2026-09-30).
