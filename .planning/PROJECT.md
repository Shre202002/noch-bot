# NochBot

## What This Is

NochBot is a platform for businesses and event organizers to add a configurable AI assistant to their websites. The assistant can answer from website content and uploaded PDFs, and it can guide visitors through event registration, ticketing, and payment.

## Core Value

Help website visitors get useful answers grounded in the organization's content and complete the next step, including event booking, in the same assistant experience.

## Business Context

- **Customer**: Businesses and event organizers that want an embedded website assistant.
- **Revenue model**: The application contains free, starter, and pro account plans; the current pricing and conversion model needs validation.
- **Success metric**: Not established. Set a baseline for successful knowledge-grounded answers and completed bookings before defining a target.
- **Strategy notes**: No separate strategy document is currently recorded.

## Requirements

### Validated

- ✓ Users can configure a website knowledge source and index text for chatbot retrieval — existing implementation.
- ✓ Users can upload PDFs and query indexed PDF content — existing implementation.
- ✓ Organizations can configure events, registration fields, ticket issuance, and payment providers — existing implementation.
- ✓ A chatbot can be embedded on an external website — existing implementation.

### Active

- [ ] Replace the active website crawler with Scrapling while preserving the existing chunking, embedding, Atlas Vector Search, tenant isolation, and chatbot retrieval behavior.
- [ ] Make website recrawls failure-safe so an unsuccessful crawl cannot remove the last working knowledge corpus.
- [ ] Improve and maintain PDF knowledge chat as a distinct product capability.
- [ ] Improve and maintain event booking, ticketing, and payment flows as a distinct product capability.
- [ ] Keep the three feature areas separately organized in project planning: website crawling, PDF knowledge chat, and event booking.

### Out of Scope

- Replacing MongoDB Atlas Vector Search as part of the Scrapling crawler update — the requested change is to the scraping layer, and changing vector storage would expand risk across ingestion and retrieval.
- Rewriting the booking or PDF pipelines as part of the first crawler phase — those remain separate roadmap areas.

## Context

- This is a brownfield Next.js App Router application using TypeScript, MongoDB, and MongoDB Atlas Vector Search.
- Website crawl requests currently enter through `POST /api/crawl` from the dashboard Configure page. The active implementation uses Axios and Cheerio, fetches at most 10 pages, and then chunks, embeds, and stores them.
- Website chat embeds questions and retrieves chunks from the Atlas `nochbot_chunks` collection, filtering by `userId`.
- The current crawl route writes new knowledge metadata before vector generation finishes, and vector replacement deletes old chunks before inserting the new set. A failed recrawl can therefore disrupt previously working knowledge.
- The active crawl endpoint returns `pagesCrawled`, while the dashboard currently reads a `pages` array for per-page progress.
- `src/ai/flows/bot-knowledge-base-creation-flow.ts` contains a separate crawler path whose vector/database persistence helpers are mocks; the dashboard API route is the active website crawl path.
- The initial Scrapling architecture proposal is documented in `docs/scrapling-integration-plan.md`.
- The three planning areas are documented in `.planning/features/website-crawling/`, `.planning/features/pdf-knowledge-chat/`, and `.planning/features/event-booking/`.

## Constraints

- **Compatibility**: Preserve the dashboard's `POST /api/crawl` request shape `{ url }` unless an actual limitation requires a change.
- **Data safety**: Failed crawls must leave the currently active website knowledge available for chat retrieval.
- **Tenant isolation**: Every knowledge search and write must remain scoped to the owning `userId`.
- **RAG behavior**: Preserve the existing Atlas collection, vector dimensions, embedding generation, and retrieval behavior during the crawler replacement, except for minimal metadata/filter changes needed for safe generation publishing.
- **Security**: Crawling arbitrary user-provided URLs requires SSRF protections, redirect validation, crawl limits, and server-side service credentials.
- **Scope order**: Website crawling is the first improvement; PDF knowledge chat and event booking remain part of the overall product roadmap.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Plan website crawling, PDF knowledge chat, and event booking as separate feature areas | The user wants all three capabilities represented independently | ✓ Good |
| Put feature organization under `.planning/features/`, not source-code folders | The user selected planning-document folders; implementation remains in the existing application structure | ✓ Good |
| Prioritize the Scrapling crawler update before broader work on PDF chat and event booking | The user wants to fix website crawling first, then continue across all three product areas | ✓ Good |
| Keep Atlas Vector Search and downstream RAG behavior during the crawler update | Limits scope and preserves existing retrieval behavior | — Pending |
| Put Scrapling behind a provider boundary and run it as a private Python service | Keeps the Next.js ingestion/RAG pipeline stable while accommodating Scrapling's Python runtime | — Pending |
| Publish crawls by active generation so failures preserve prior knowledge | Prevents a failed recrawl from destroying the currently working corpus | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. Update "What This Is" if the product description no longer matches reality.

**After each milestone** (via `$gsd-complete-milestone`):
1. Review all sections.
2. Check whether Core Value is still the right priority.
3. Review Out of Scope reasons.
4. Update Context with current state, user feedback, and metrics.

---
*Last updated: 2026-10-01 after project initialization*
