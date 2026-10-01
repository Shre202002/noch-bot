# Requirements: NochBot

**Defined:** 2026-10-01  
**Core Value:** Help website visitors get useful answers grounded in the organization's content and complete the next step, including event booking, in the same assistant experience.

## v1 Requirements

### Website Crawling

- [ ] **CRAWL-01**: An authenticated user can submit a website URL through the existing dashboard request contract `{ url }` and receive a crawl result without a frontend API migration.
- [ ] **CRAWL-02**: Website pages are fetched and converted to normalized page content through a Scrapling-backed crawler provider.
- [ ] **CRAWL-03**: Crawl requests enforce server-owned page, depth, time, response-size, concurrency, redirect, and same-origin bounds that users cannot raise.
- [ ] **CRAWL-04**: The crawler blocks requests to loopback, private, link-local, and other prohibited addresses, including after DNS resolution and redirects.
- [ ] **CRAWL-05**: Crawl outcomes distinguish fetched, skipped, blocked, failed, and indexed pages and remain compatible with dashboard result rendering.
- [ ] **CRAWL-06**: Successful page content enters the existing chunking, embedding, metadata, and Atlas Vector Search pipeline without changing vector dimensions or weakening per-user filters.
- [ ] **CRAWL-07**: A failed, empty, or insufficient-quality crawl leaves the last active website knowledge available to chatbot retrieval.
- [ ] **CRAWL-08**: A chatbot query, including through the embedded chatbot, can retrieve and answer from content indexed by the Scrapling crawler.
- [ ] **CRAWL-09**: Website crawling and extraction failures are observable without exposing secrets, raw page bodies, or sensitive URL parameters to users or logs.

### PDF Knowledge Chat

- [ ] **PDF-01**: A user can determine whether an uploaded PDF is parsing, indexed, failed, or ready for retrieval.
- [ ] **PDF-02**: A user can retry, replace, and remove a PDF source without corrupting unrelated website or PDF knowledge.
- [ ] **PDF-03**: Answers retrieved from PDFs identify source documents and page-level evidence when available.
- [ ] **PDF-04**: PDF chatbot retrieval remains scoped to the owning user and continues to use its existing ingestion and vector-search path.

### Event Booking

- [ ] **BOOK-01**: Available event capacity remains consistent across chatbot, embedded chatbot, and dashboard booking workflows.
- [ ] **BOOK-02**: Payment state changes are driven by verified, idempotent provider events and cannot issue duplicate tickets.
- [ ] **BOOK-03**: Attendees receive accurate booking confirmation and ticket details only after the applicable payment/booking state is confirmed.
- [ ] **BOOK-04**: Organizers can find attendee bookings and record check-in outcomes reliably.
- [ ] **BOOK-05**: Pending, failed, or expired booking/payment states can be reconciled without conflating distinct booking flows or statuses.

## v2 Requirements

### Crawl Automation

- **AUTO-01**: Users can schedule recurring crawls and review crawl history.
- **AUTO-02**: Users can cancel long-running crawls and inspect durable progress.
- **AUTO-03**: The crawler can incrementally reuse unchanged page content after reliable validators and generation publication are established.

### Advanced Crawl Controls

- **CRAWL-10**: Users can configure sitemap, path inclusion/exclusion, and advanced recrawl policies within server-enforced safety limits.
- **CRAWL-11**: Users can configure adaptive selectors or anti-bot/stealth crawling.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replace MongoDB Atlas Vector Search or change embedding dimensions during Scrapling integration | The crawler update should preserve current downstream ingestion and retrieval behavior. |
| Give the crawler direct access to tenant records, MongoDB, or embedding credentials | Authentication, isolation, persistence, and RAG remain owned by the NochBot application. |
| Rewrite PDF ingestion as part of the website crawler migration | PDF knowledge has a separate existing pipeline and roadmap area. |
| Rewrite booking/payment flows as part of the website crawler migration | Booking has separate domain state and payment risks; it must be handled independently. |
| Stealth/proxy-based circumvention of website access controls | Not required for a safe initial crawler and expands legal, operational, and abuse risk. |
| Crawl the public internet without bounded scope | Crawls are restricted to explicit user-submitted sites and fixed server-owned budgets. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRAWL-01 | Phase 1 | Pending |
| CRAWL-02 | Phase 1 | Pending |
| CRAWL-03 | Phase 1 | Pending |
| CRAWL-04 | Phase 1 | Pending |
| CRAWL-05 | Phase 1 | Pending |
| CRAWL-06 | Phase 1 | Pending |
| CRAWL-07 | Phase 1 | Pending |
| CRAWL-08 | Phase 1 | Pending |
| CRAWL-09 | Phase 1 | Pending |
| PDF-01 | Phase 2 | Pending |
| PDF-02 | Phase 2 | Pending |
| PDF-03 | Phase 2 | Pending |
| PDF-04 | Phase 2 | Pending |
| BOOK-01 | Phase 3 | Pending |
| BOOK-02 | Phase 3 | Pending |
| BOOK-03 | Phase 3 | Pending |
| BOOK-04 | Phase 3 | Pending |
| BOOK-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-10-01*  
*Last updated: 2026-10-01 after research and user approval*
