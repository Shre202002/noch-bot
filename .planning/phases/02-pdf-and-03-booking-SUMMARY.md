# Phases 2 and 3 - Implementation Summary

**Date:** 2026-10-21. Built and unit-tested locally; live acceptance pending. Implemented directly at the user's request (no GSD plan artifacts).

## Phase 2: PDF Knowledge Chat (PDF-01..04)

- **Status lifecycle (PDF-01):** `pdf_files.status` is `parsing`, `indexed`, `ready` or `failed` (`src/lib/pdfStatus.ts`). A record is written before parsing starts, so a failed upload leaves a visible entry with a safe `error`. Records without a status are inferred (PDFs ready; spreadsheets indexed until `rowVectors` is `ready`). A `parsing` record older than 10 minutes is shown as failed. Failed uploads never count toward the plan limit.
- **Retry / replace / remove (PDF-02):** `POST /api/ingest/pdf` accepts `retryFileId` (purges the failed record, then ingests as new) and `replaceFileId` (PDF only; parses and embeds first, then swaps only that document's passages in place, so fileId and share links survive and an unreadable replacement changes nothing). Replace resets the document's additions. Remove is the existing 7-day soft delete. None of these touch other documents or website knowledge (`nochbot_chunks`).
- **Retrieval gating:** chat, share-link creation and "add data" refuse documents that are parsing or failed.
- **Citations (PDF-03):** `/api/chat/pdf` returns `citations` (document + pages, `src/lib/pdfCitations.ts`); the dashboard and shared chat append a "Sources: file (p. 3, 5-6)" line. Refusals cite nothing.
- **Scoping (PDF-04):** unchanged; every query still filters by `userId` and `fileId`.
- **UI:** status line, Retry upload and Replace PDF buttons in `dashboard/pdf/page.tsx`.

## Phase 3: Event Booking Integrity (BOOK-01..05)

Already present before this work and kept: atomic capacity holds with expiry release, one verified/idempotent webhook processor for all providers and both flows, idempotent ticket issuance and emails, late-payment handling.

Added:
- **Organizer bookings (BOOK-04):** `src/lib/organizerBookings.ts`. Search across reference, attendee answers of both flows (widget answers and chat-bot form responses) and ticket codes; filter by group; pagination; counts. There was previously no organizer UI at all; the new **Bookings** tab (`dashboard/events/[id]/bookings-panel.tsx`) lists bookings with ticket-level check-in and undo.
- **Check-in:** `PATCH /api/events/[id]/bookings/[bookingId]` (`check_in`, `undo_check_in`). Atomic `active -> scanned`, outcomes `checked_in | already_checked_in | booking_not_confirmed | ticket_void | not_found`. The scanner route now also refuses tickets whose booking is not confirmed (BOOK-03).
- **Reconciliation (BOOK-05):** statuses are grouped by meaning (confirmed, awaiting payment, needs attention, closed, in progress). `mark_refunded` resolves `needs_refund`; `cancel` closes a pending checkout and releases held seats once. Both are conditional updates, so a racing webhook cannot be overwritten. Listing first releases seats of expired holds (BOOK-01). `Booking` status type now includes `processing_late_payment`, `needs_refund`, `refunded`.
- `bookingHoldsSeats` moved to `eventCapacity.ts`, shared by webhook and organizer paths.

## Known limits

- Replacing a PDF deletes the old passages just before inserting new ones (embedding is done first); a failure in between marks the document failed rather than leaving stale content.
- Booking search reads up to 5,000 bookings of one event in memory; the UI says when truncated.
- `cancel` does not update the widget `booking_sessions` record.
- Paying after a cancel is handled by the existing late-payment path (re-confirm if seats remain, else `needs_refund`).
