# Roadmap: NochBot

## Overview

NochBot's v1 work proceeds through three separately scoped product slices: first deliver a bounded Scrapling website crawl through the existing dashboard and chatbot path, then improve PDF knowledge chat on its existing ingestion path, and then improve booking integrity across attendee and organizer workflows. Each slice preserves its domain's current contracts and isolation boundaries. Crawl scheduling, durable progress/cancellation, and incremental recrawl are deferred until the bounded manual crawl is reliable and measured.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scrapling Website Crawl** - Replace website fetch and extraction end-to-end while preserving the current API, Atlas/RAG behavior, and active knowledge on failure.
- [ ] **Phase 2: PDF Knowledge Chat** - Make PDF source lifecycle and evidence-grounded answers understandable and reliable on the existing PDF pipeline.
- [ ] **Phase 3: Event Booking Integrity** - Keep capacity, payment, ticket confirmation, attendee operations, and recovery states consistent.

## Phase Details

### Phase 1: Scrapling Website Crawl
**Goal**: An authenticated organization can crawl its submitted site through Scrapling and have useful pages available to the existing chatbot, while unsafe requests are blocked and failed recrawls preserve the last working corpus.
**Depends on**: Nothing (first phase)
**Requirements**: CRAWL-01, CRAWL-02, CRAWL-03, CRAWL-04, CRAWL-05, CRAWL-06, CRAWL-07, CRAWL-08, CRAWL-09
**Success Criteria** (what must be TRUE):
  1. A user can submit `{ url }` from the existing dashboard; Scrapling returns normalized page content and compatible crawl results, including per-page outcomes that the dashboard can render.
  2. The crawl stays within server-owned page, depth, time, size, concurrency, redirect, and same-origin bounds; loopback, private, link-local, and other prohibited destinations are blocked after DNS resolution and at every redirect or secondary request.
  3. Fetched content is chunked and embedded by the existing application pipeline, stored in the existing Atlas vector collection with unchanged dimensions and owner filtering, and can answer a question through both regular and embedded chatbot retrieval.
  4. Empty, low-quality, or failed attempts leave the previously active website corpus searchable; a new generation becomes active only after it is ready for retrieval.
  5. Users can distinguish fetched, skipped, blocked, failed, and indexed pages, while operational failure details do not expose secrets, raw page bodies, or sensitive URL parameters.
**Plans**: TBD
**Research flag**: Deeper research required. Verify the pinned Scrapling API and Python/browser runtime, scheduler/depth/robots/request-budget hooks, private deployment and egress controls, and Atlas generation-filter/index visibility behavior before implementation.
**UI hint**: yes

### Phase 2: PDF Knowledge Chat
**Goal**: Users can understand and manage PDF indexing independently from website knowledge, and receive answers grounded in identifiable document and page evidence.
**Depends on**: Phase 1 (delivery order; the PDF pipeline remains technically separate)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04
**Success Criteria** (what must be TRUE):
  1. A user can tell whether each uploaded PDF is parsing, indexed, failed, or ready for retrieval.
  2. A user can retry, replace, or remove a PDF without changing unrelated PDF sources or website knowledge.
  3. PDF answers identify the source document and page-level evidence when available, and PDF retrieval remains scoped to the owning user on the existing PDF ingestion and vector-search path.
**Plans**: TBD
**Research flag**: Standard patterns. During planning, verify NochBot's current parser, source identity, PDF collection, and retrieval contracts; no separate research phase is indicated.
**UI hint**: yes

### Phase 3: Event Booking Integrity
**Goal**: Attendees can complete bookings with accurate capacity and payment outcomes, while organizers can reliably find bookings, check in attendees, and resolve incomplete states.
**Depends on**: Phase 2 (roadmap delivery order; booking is otherwise an independent domain)
**Requirements**: BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05
**Success Criteria** (what must be TRUE):
  1. Available event capacity is consistent across chatbot, embedded chatbot, and dashboard booking flows, including concurrent reservations.
  2. Only verified, idempotently processed provider events can confirm payment; confirmed bookings issue no duplicate tickets, and attendees receive accurate confirmation and ticket details only after the booking/payment state allows it.
  3. Organizers can find attendee bookings and record check-in outcomes reliably.
  4. Pending, failed, or expired booking and payment states can be reconciled without mixing distinct booking flows or status meanings.
**Plans**: TBD
**Research flag**: Deeper research required. Trace existing booking state transitions, payment webhook handlers, capacity holds/expiry, idempotency, ticket issuance, and reconciliation across dashboard, chatbot, and embedded flows.
**UI hint**: yes

## Deferred Scope

- Crawl scheduling, durable job progress/cancellation, history/restore, and incremental content reuse are deferred beyond v1 until the bounded synchronous crawl and generation publication are dependable and usage justifies automation (AUTO-01, AUTO-02, AUTO-03).
- Advanced sitemap/path controls and adaptive selectors or stealth crawling remain outside this roadmap's v1 phases (CRAWL-10, CRAWL-11).

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3. PDF and booking remain separate product capabilities; their ordering follows the user's selected sequence rather than a shared storage or implementation dependency.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scrapling Website Crawl | 1/1 | Implemented; live acceptance pending | - |
| 2. PDF Knowledge Chat | 1/1 | Implemented; live acceptance pending | - |
| 3. Event Booking Integrity | 1/1 | Implemented; live acceptance pending | - |
