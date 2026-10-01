# Phase 1: Scrapling Website Crawl - Context

**Gathered:** 2026-10-02  
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the active website fetch/extraction path with a Scrapling-backed crawl while preserving the existing dashboard request contract, user-scoped Atlas Vector Search, embedding/chunking pipeline, and chatbot retrieval. The crawl is bounded and plan-aware; successful data must be safely published without removing the last working corpus when the selected crawl fails. This phase does not redesign PDF ingestion or booking, and does not add scheduled or incremental crawling.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

### Scope and User Requirements
- `.planning/PROJECT.md` - Existing API, tenant isolation, Atlas/RAG, and failure-safety constraints.
- `.planning/ROADMAP.md` - Phase 1 goal and success criteria.
- `.planning/REQUIREMENTS.md` - CRAWL-01 through CRAWL-09, especially bounded crawling, user-visible outcomes, and non-destructive publication.
- `.planning/features/website-crawling/README.md` - Planning area for the crawler-first feature.

### Architecture and Risk Research
- `docs/scrapling-integration-plan.md` - Existing Scrapling service proposal, provider migration, security checks, and end-to-end acceptance approach.
- `.planning/research/ARCHITECTURE.md` - Provider boundary, data flow, selection/security responsibilities, and generation publication recommendations.
- `.planning/research/PITFALLS.md` - SSRF, budgets, robots, partial results, and Atlas visibility pitfalls.
- `.planning/research/STACK.md` - Existing Next.js/MongoDB stack and Scrapling runtime recommendation.
- `.planning/research/SUMMARY.md` - Synthesized project research and roadmap implications.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - Current service/data boundaries and crawl/RAG architecture.
- `.planning/codebase/INTEGRATIONS.md` - Existing provider and external service integration patterns.
- `.planning/codebase/CONCERNS.md` - Known crawler, data-safety, and security concerns.
- `.planning/codebase/STACK.md` - Current runtime and relevant package versions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/crawl/route.ts`: Active authenticated crawl route; preserve the `{ url }` request and existing quota/auth boundaries while adding the provider and safe publication orchestration.
- `src/app/dashboard/configure/page.tsx`: Existing crawl submission and result surface; reconcile its per-page list with the route response and add plan-limit/outcome information.
- `src/lib/embeddings.ts` and `src/lib/vectorStore.ts`: Existing embedding and Atlas Vector Search path to retain for website chunks.
- `src/lib/storage.ts`: Existing knowledge metadata boundary for active source state and crawl metadata.
- `src/ai/flows/bot-knowledge-base-creation-flow.ts`: Separate flow contains crawler-related code, but its persistence helpers are mocks; verify callers before changing or removing it.

### Established Patterns
- API route handlers authenticate server-side, enforce ownership, and orchestrate domain helpers.
- Knowledge retrieval uses the shared Atlas vector store and user-scoped filters; never weaken `userId` isolation.
- Payment integrations use provider boundaries and idempotent handling; the crawler should follow a similarly narrow adapter pattern.
- The codebase is Next.js 15/TypeScript with MongoDB Atlas Vector Search; Scrapling requires an isolated Python runtime rather than browser-visible credentials.

### Integration Points
- Dashboard Configure page -> `POST /api/crawl` -> active crawl route -> crawler provider -> existing chunk/embed/storage/vector helpers -> regular and embedded chatbot retrieval.
- The current route returns `pagesCrawled`, while the dashboard expects per-page `pages`; define one compatible response that exposes selected pages, outcomes, chunk counts, cap status, and fallback provider without leaking internals.
- Atlas generation metadata and chat filters must change together so only the active generation for the owning user is retrievable.

</code_context>

<specifics>
## Specific Ideas

- Entry-plan cap and upgrade message: “Crawled 15 pages. For more, upgrade your plan.”
- The dashboard should show pages actually crawled, their statuses/reasons, and chunks extracted per page.
- The candidate set should favor useful business/support pages, not simply the first URLs encountered on a large site.
- If legacy fallback is used, tell the user plainly that Scrapling was unavailable and the legacy crawler handled the crawl.
</specifics>

<deferred>
## Deferred Ideas

- Scheduled crawling, durable progress/cancellation, crawl history/restore, and incremental recrawl remain deferred per v2 scope.
- Advanced user-configurable sitemap/path rules, adaptive selectors, stealth/proxy crawling, and LLM-based page ranking remain out of scope for this phase.
- Further subscription packaging/pricing work beyond honoring existing plan entitlements belongs to a separate product/pricing decision.
</deferred>

---

*Phase: 1-Scrapling Website Crawl*  
*Context gathered: 2026-10-02*
