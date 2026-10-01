# Phase 1: Scrapling Website Crawl - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves alternatives considered.

**Date:** 2026-10-02  
**Phase:** 1-Scrapling Website Crawl  
**Areas discussed:** Partial crawl results, dashboard crawl feedback, Scrapling rollback

---

## Partial Crawl Results

| Option | Description | Selected |
|--------|-------------|----------|
| Publish useful subset | Publish selected pages that succeeded; retain prior corpus only if no usable content | |
| Require complete selected set | Every selected eligible page with usable content must index before publication | Yes |
| Success threshold | Use a configurable count/share threshold | |

**User's choice:** Require all selected usable pages to index. Empty pages are ignored; at least one page containing data is required. Pages omitted because a cap is reached are deferred, not failures. Any qualifying page failure keeps the previous corpus active.

**Additional choices:** Entry-plan cap is 15 pages. Higher plans may have higher finite server-side caps under a global hard maximum. Page priority: submitted URL, primary navigation, relevant sitemap candidates, then breadth-first same-origin links. Prefer services/products/FAQ/help/about content, prioritize relevance over shallow depth within the depth limit, deduplicate obvious URL variants, and do not use LLM ranking.

## Dashboard Crawl Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking cap warning | Crawl can succeed while a small warning says the limit was reached | Yes |
| Fail on cap | Mark the crawl failed whenever candidate discovery exceeds the limit | |
| Other | User-defined behavior | |

**User's choice:** Show a successful result with a small cap warning. Show the crawled pages with title, URL, status, safe reason, and chunk count. Link “Crawled 15 pages. For more, upgrade your plan.” to the existing plans/upgrade flow. When a recrawl fails, explicitly say the previous indexed version remains active.

## Scrapling Rollback

| Option | Description | Selected |
|--------|-------------|----------|
| Fail and retain prior knowledge | No crawler fallback; report failure and keep active corpus | |
| Service-failure fallback | Use legacy crawler only for service-level Scrapling failures and tell the user | Yes |
| Other | User-defined behavior | |

**User's choice:** Automatically fall back only for service-level failures such as unavailable service, timeout, or server error. Do not fall back on URL-policy, robots, or content outcomes. Show that the legacy crawler handled the request. Apply identical plan limits, page selection, indexing, and publication rules. Remove the legacy provider after end-to-end acceptance and a short stable-production window.

## the agent's Discretion

- Determine exact finite paid-plan limits and the global ceiling from existing entitlements and operational budgets.
- Verify the selected Scrapling APIs and implement the stated page selection and fallback behavior without weakening URL/robots/network safety.
- Choose safe public error categories, provider health detection, retry bounds, and Atlas generation readiness mechanics.

## Deferred Ideas

- Scheduled and incremental crawling, durable crawl jobs, adaptive selectors, stealth/proxy use, and LLM page ranking remain deferred/out of scope.
- Subscription pricing and packaging beyond existing plan entitlements is not decided here.
