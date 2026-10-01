---
phase: "01"
slug: "scrapling-website-crawl"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-02"
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x for TypeScript; Python standard-library `unittest` for crawler service tests unless implementation research selects and verifies another dependency |
| **Config file** | `vitest.config.ts`; Python test configuration not yet present |
| **Quick run command** | `npm test -- --run src/app/api/crawl/route.test.ts` and `python -m unittest discover scraper/tests -v` |
| **Full suite command** | `npm test -- --run`, `npm run typecheck`, and `python -m unittest discover scraper/tests -v` |
| **Estimated runtime** | Target under 60 seconds for focused suites; measure the actual full suite during Wave 0 |

## Sampling Rate

- **After every task commit:** Run the focused TypeScript or Python test for the changed policy/provider/publisher behavior.
- **After every plan wave:** Run the full application test suite, typecheck, and Python crawler suite.
- **Before `$gsd-verify-work`:** Full suite must be green; complete an authorized non-production crawl-to-Atlas-to-regular-and-embedded-chat check.
- **Max feedback latency:** 60 seconds for focused automated tests.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CRAWL-01 | - | Preserve authenticated `{ url }` contract and quota checks | API integration | `npm test -- --run src/app/api/crawl/route.test.ts` | No / W0 | pending |
| 01-01-02 | 01 | 1 | CRAWL-02 | - | Normalize provider output; no secrets or persistence in crawler | Python fixture integration | `python -m unittest discover scraper/tests -v` | No / W0 | pending |
| 01-01-03 | 01 | 1 | CRAWL-03 | T-01-01 | Enforce page/depth/time/bytes/concurrency/redirect limits before work expands | Python policy tests | `python -m unittest discover scraper/tests -v` | No / W0 | pending |
| 01-01-04 | 01 | 1 | CRAWL-04 | T-01-01 | Block private destinations after DNS resolution and redirects, including secondary requests | Python network-policy tests | `python -m unittest discover scraper/tests -v` | No / W0 | pending |
| 01-01-05 | 01 | 1 | CRAWL-05 | T-01-04 | Return safe per-page status/reason/chunk counts and cap status | API/UI integration | `npm test -- --run src/app/api/crawl/route.test.ts` | No / W0 | pending |
| 01-01-06 | 01 | 1 | CRAWL-06 | T-01-02 | Preserve vector size/model and require owner filter plus active-generation filter | Vector-store integration | `npm test -- --run src/lib/vectorStore.test.ts` | No / W0 | pending |
| 01-01-07 | 01 | 1 | CRAWL-07 | T-01-03 | Keep old generation active on crawl, chunk, embed, insert, or readiness failure | Fault-injection integration | `npm test -- --run src/lib/crawler/publish.test.ts` | No / W0 | pending |
| 01-01-08 | 01 | 1 | CRAWL-08 | T-01-02 | Retrieve only active generation for owner through both chat surfaces | Non-production E2E | Crawl fixture site and ask a site-specific question in regular and embedded chat | No / manual E2E | pending |
| 01-01-09 | 01 | 1 | CRAWL-09 | T-01-04 | Redact sensitive URLs, bodies, credentials, and raw exceptions from logs/responses | Unit + log capture | `npm test -- --run src/app/api/crawl/route.test.ts`; `python -m unittest discover scraper/tests -v` | No / W0 | pending |

## Wave 0 Requirements

- [ ] `scraper/tests/` - Python unit and deterministic HTTP fixture tests for URL scope, selection ordering, robots, redirects, limits, response size, and dynamic subrequests.
- [ ] `src/app/api/crawl/route.test.ts` - API contract, plan limit, service failure classification, legacy fallback, and sanitized page-result tests.
- [ ] `src/lib/vectorStore.test.ts` - Owner and active-generation filter tests, including pre-generation compatibility behavior.
- [ ] `src/lib/crawler/publish.test.ts` - Staging, readiness, activation, failure preservation, and cleanup ordering tests.
- [ ] Controlled DNS/network fixtures - IPv4/IPv6 special ranges, rebinding, redirect-to-private, exact-origin, robots, sitemap, and browser subrequest cases.
- [ ] Atlas non-production verification - confirm current index definition and whether candidate-generation data is searchable before activation.
- [ ] Python service launch/test command and runtime pin - choose only after validating actual Scrapling package installation and deployment support.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Authorized live-site crawl reaches Atlas and answers through regular and embedded chat | CRAWL-08 | Requires a deployed crawler, non-production Atlas credentials, and an operator-authorized real site | Crawl an authorized public site in staging; verify selected URLs, chunks, owner/generation metadata, then ask the same fact-specific question in regular and embedded chatbot surfaces. |
| Production-host to crawler-service connectivity and rollback window | CRAWL-02, CRAWL-09 | Depends on real hosting/network identity and deployment configuration | Verify private/authenticated service reachability, simulate service-level failure and confirm the legacy notice, then confirm policy/robots failures do not trigger fallback. |
| Old corpus survives an actual failed recrawl | CRAWL-07 | Requires staging Atlas state and end-to-end chat retrieval | First index a working corpus; induce a service or indexing failure; verify the prior version remains searchable and the UI explains that it remains active. |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification
- [ ] Wave 0 covers all missing test references
- [ ] No watch-mode flags
- [ ] Feedback latency under 60 seconds for focused tests
- [ ] `nyquist_compliant: true` set after Wave 0 gaps are closed and verified

**Approval:** pending
