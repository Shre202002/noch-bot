# Phase 1 — Implementation Summary

**Date:** 2026-10-08
**Status:** Built and verified locally. Not yet accepted end to end: Atlas, Gemini and deployment checks are still outstanding (listed below).
**Workflow note:** This was implemented directly at the user's request. GSD commands are installed for Codex only, not for Claude Code, so this summary stands in for the PLAN/SUMMARY artifacts.

## What was built

### Scrapling crawler service (`scraper/`, Python 3.12, `scrapling[fetchers]==0.4.15`)

The `checkpoint:human-verify` was done before install. Scrapling 0.4.15 on PyPI is published by Karim Shoair, owner of the official github.com/D4Vinci/Scrapling repository (about 86k stars, BSD-3 licence). Dependencies are pinned in `requirements.txt`.

- **`nochbot_crawler/url_policy.py`** (URL safety rules):
  - Allows http/https only, ports 80/443/8080/8443, and no credentials in the URL.
  - Every resolved address must be public. IPv4-mapped, NAT64, 6to4 and Teredo forms of blocked addresses are blocked too.
  - The crawl may touch only the submitted host and its www/apex counterpart. Obvious URL variants are merged, and logged URLs carry no query strings.
- **`nochbot_crawler/crawler.py`** (the crawler):
  - Scrapling's static session is used with a pinned curl handle:
    - `CURLOPT_RESOLVE` locks requests to the validated IPs, which blocks DNS rebinding.
    - `MAXFILESIZE_LARGE` caps response size.
    - The session uses http/https only and follows redirects manually, staying on the site.
  - Pages are picked in the D-02 order (seed, navigation, relevant sitemap entries, then breadth-first), with knowledge-page relevance ranking. URL variants and identical content are merged (D-03).
  - robots.txt follows RFC 9309, and crawl-delay is honoured up to 2 s. Page, depth, time and size budgets are enforced.
  - Each page's Markdown comes from Scrapling, taken from the `main`/`article` region when the page has one.
- **`nochbot_crawler/app.py`** (the HTTP API):
  - `POST /v1/crawl` requires a bearer token, checked before the request body is validated.
  - The service enforces its own hard ceilings (50 pages, depth 4, 60 s, 5 MB) and runs at most 2 crawls at once.
  - Errors come back as safe categories (`policy` with a reason, `busy`, `internal`).
- **`Dockerfile`**: non-root user, no browser binaries.

### Next.js integration (`src/lib/crawler/`)

- **Shared pieces:**
  - `types.ts` holds the provider contract and error classes. `urlPolicy.ts` mirrors the Python rules, with a connect-time `safeLookup`. `robots.ts` is an RFC 9309 parser.
  - `budget.ts` sets page limits by plan: free 15, starter 30, pro 50, with a hard maximum of 50 (D-01). These come from `PLAN_LIMITS.crawlPagesPerCrawl`.
- **Providers** (in `scraplingProvider.ts`, `legacyProvider.ts`, `index.ts`):
  - The Scrapling client re-checks the service response: pages must be on the site, and the page cap and sizes are enforced again.
  - The legacy Axios/Cheerio provider applies the same policy, page order, robots rules and budgets (D-11).
  - Provider choice: `CRAWLER_PROVIDER`, or automatic when `CRAWLER_SERVICE_URL`/`TOKEN` are set.
  - The legacy fallback runs only on `CrawlServiceUnavailableError` (D-10). Policy refusals never fall back.
- **`publish.ts`** (generation-safe publication, D-04 and D-05):
  1. Any selected page that **failed** blocks publication, and at least one page needs content.
  2. Every chunk is embedded before anything is written.
  3. New chunks are staged under a `generationId`.
  4. It polls Atlas until the staged chunks are searchable (20 s budget).
  5. `activeGenerationId` is switched in one update.
  6. Only then are older generations deleted.
  - On any failure the staged generation is removed and the previous one stays live.
- **`lock.ts`**: one crawl per user at a time, enforced with a lock document that expires after 3 minutes.
- **Chunking** keeps the original 300-word split and the `--- Page: url ---` header. It is now applied per page, so each chunk keeps its own source URL and title.
- **`src/lib/embeddings.ts`**: added `embedTexts`, which uses the Gemini batch endpoint with the same model and vector size, and retries 429/5xx with backoff. This replaces one call per chunk with a 300 ms sleep between calls.

### Storage and retrieval

- **`vectorStore.ts`:**
  - The Atlas index definition adds a `generationId` filter. An existing index is updated in place, and Atlas keeps serving the old one while it rebuilds.
  - New helpers handle staged inserts, deleting generations and the readiness probe.
  - `searchKnowledgeChunks` now searches only the active generation. Users with no pointer yet only search untagged legacy chunks, so a crawl in progress never leaks into answers.
  - Both chat paths, `/api/chat` and the Genkit flow, go through this function.
  - Collection, model, dimensions and the `userId` filter are unchanged.
- **`storage.ts`:** added `activeGenerationId`, `pagesIndexed` and a `lastCrawl` attempt summary to `KnowledgeData`. A failed crawl only writes `lastCrawl`.

### API and dashboard

- **`POST /api/crawl`:**
  - The `{ url }` request is unchanged (CRAWL-01). The URL is validated, including DNS, before quota and lock checks.
  - The response keeps `success`, `pagesCrawled`, `chunks`, `characters` and `crawlUsage`. It adds `pages[]` (title, URL, status, reason, chunk count), `pagesIndexed`, `pageLimit`, `capReached`, `deferredCount`, `upgradeSuggested`, `provider`, `fallbackUsed` and `correlationId`.
  - Failures return 422 with `previousKnowledgeActive`.
  - Quota is still counted only for published crawls, and `crawl_logs` stores the redacted URL.
- **Configure → Crawl tab:** follows the UI spec copy and states.
  - The labelled form shows "Start Website Crawl", "Crawling Website…" or "Re-crawl Website".
  - The page list shows status, reason and chunk count, with the summary line, the cap warning plus upgrade link, the fallback notice, and the failure message that keeps the previous knowledge active.
  - The made-up live log was removed.
- **`/api/knowledge`:** now returns `chunkCount` and `pagesIndexed`. The dashboard already read `chunkCount`, but the field was never sent.

## Decisions made during implementation

- **Page outcomes against D-04:** fetch failures (timeout, 5xx, 429, network errors) block publication. Pages that are not usable content (robots-denied, 4xx, off-site redirect, too large, not HTML, empty, duplicate) are skipped and do not block it. Otherwise one broken link would stop every recrawl.
- **Pages cut off by the time budget** count as deferred, like pages cut off by the page cap.
- **Page limit counts content pages only (user decision, 2026-10-08):**
  - Only pages with usable content count toward the plan limit. Empty, duplicate, broken and robots-blocked pages are replaced by the next candidate.
  - Total fetches are capped at 2× the limit.
  - The crawl budget went from 25 s to 35 s, the per-page timeout from 8 s to 10 s, and `/api/crawl` `maxDuration` from 60 to 90 s.
- **Site scope:** www/apex and http→https redirects are allowed. Both hosts are DNS-validated and pinned. Without this, sites that redirect `http://example.com` to `https://www.example.com` returned no pages; this was found by live testing.
- **Crawler identity:** honest `NochBot/1.0` user agent, no browser impersonation, no stealth or proxies (still out of scope).
- **Dynamic (browser) rendering** is not enabled. The service is static-only, as research recommended starting with.

## Verification

- **Python:** 40 unit and fixture tests (`scraper/tests`) pass. They cover URL/IP policy, page order, robots, redirects (including to www), the size cap, depth, page cap, time budget, dedup, Markdown extraction, API auth and budget ceilings.
- **TypeScript:** 148 Vitest tests pass, existing suites included. Coverage includes URL policy, robots, the legacy crawler against a local fixture site, the Scrapling client and its fallback rules, every publish failure path, the crawl lock (in-memory MongoDB) and the vector-search filters.
- `npm run typecheck` passes.
- **Live smoke test** of the service:
  - `https://books.toscrape.com/` returned 5 distinct pages, with 84 more deferred by the cap.
  - `http://python.org` followed the redirect to `https://www.python.org/` and picked the About and Help pages first.
  - `169.254.169.254` was refused as `blocked_destination`.
  - An unauthenticated request returned 401.
  - The TS client and live service contract test passed with no fallback.

## Not done yet (needed for acceptance)

1. **Atlas index rebuild:** the first crawl after deploy updates the index to add the `generationId` filter. Until Atlas finishes rebuilding, recrawls fail safely with `index_not_ready` and the old knowledge stays live. Confirm the rebuild in the Atlas UI, or trigger it early with one crawl.
2. **End-to-end test with real credentials:** dashboard crawl → Atlas chunks with a `generationId` → a unique-fact answer through both `/bot` and the embed script (CRAWL-08). Then run a failing recrawl and confirm the previous answer still works (CRAWL-07).
3. **Deploy the crawler service:** Cloud Run, Render or a similar host reachable over HTTPS. Set `CRAWLER_SERVICE_URL` and `CRAWLER_SERVICE_TOKEN` in the app and the service, and add egress controls where the platform supports them. The local Docker build was not run because Docker Desktop wasn't running.
4. **Remove the legacy provider** after a stable production window (D-12).
5. **`maxDuration = 90`** on `/api/crawl` requires a Vercel plan or configuration that allows 90 s functions. Fluid compute allows this; the old Hobby limit of 60 s does not.
