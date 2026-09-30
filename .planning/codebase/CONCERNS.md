---
last_mapped_commit: e566539034890af2cc1da4196897f16e95975860
last_mapped_at: 2026-09-30
---
# Codebase Concerns

**Analysis Date:** 2026-09-30

## Tech Debt

**Duplicate and divergent payment webhook paths:**
- Issue: The codebase has both provider-specific webhook routes and a centralized provider route, with different status transitions and side-effect handling.
- Files: `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`, `src/app/api/payments/webhook/stripe/[orgId]/route.ts`, `src/app/api/payments/webhook/razorpay/[orgId]/route.ts`, `src/lib/payments/processWebhookResult.ts`
- Impact: A provider webhook sent to one URL can confirm `awaiting_payment` bot bookings, while the provider-specific routes call `processPaymentWebhookResult` and only confirm `pending_payment` embed bookings. This creates behavior that depends on which webhook URL is configured.
- Fix approach: Keep one canonical webhook processor that accepts both booking lifecycles. Route all provider endpoints through it, and add tests covering bot `awaiting_payment` and embed `pending_payment` transitions.

**Large page components mix UI, data loading, mutation orchestration, and local state:**
- Issue: Several route components exceed 300 lines and combine rendering with API orchestration, form state, animations, and inline Markdown renderers.
- Files: `src/app/dashboard/pdf/page.tsx`, `src/app/dashboard/configure/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/pdf-analytics/page.tsx`, `src/app/dashboard/events/[id]/page.tsx`
- Impact: Small dashboard changes have high regression risk because state transitions, network calls, and layout are tightly coupled in single files.
- Fix approach: Extract typed feature components and hooks under the relevant route folder or `src/components/`, keeping route pages responsible for composition only.

**Dead code and mock implementation remain in production source:**
- Issue: `src/app/api/crawl/route.ts` contains a full commented-out earlier implementation, and `src/ai/flows/bot-knowledge-base-creation-flow.ts` still contains mock vector-store and MongoDB persistence helpers.
- Files: `src/app/api/crawl/route.ts`, `src/ai/flows/bot-knowledge-base-creation-flow.ts`
- Impact: Future changes can patch the wrong implementation or assume the Genkit flow persists data when its helper functions only log and delay.
- Fix approach: Delete obsolete commented route code, or move historical notes to docs. Replace mock Genkit helpers with calls to `src/lib/vectorStore.ts` and `src/lib/storage.ts`, or mark the flow as non-production.

**Frequent `any` weakens strict TypeScript guarantees:**
- Issue: Critical paths cast provider adapters, webhook payloads, Markdown renderers, booking responses, analytics metadata, and MongoDB documents to `any`.
- Files: `src/app/api/bot/booking/[sessionId]/message/route.ts`, `src/lib/payments/processWebhookResult.ts`, `src/models/Booking.ts`, `src/models/BookingSession.ts`, `src/app/dashboard/pdf/page.tsx`, `src/app/dashboard/pdf-analytics/page.tsx`
- Impact: Status mismatches, missing properties, malformed payment payloads, and invalid form answers are caught late at runtime instead of by `tsc`.
- Fix approach: Introduce discriminated types for booking flow variants, payment adapters, webhook results, and form answers. Avoid `Record<string, any>` on persisted data that drives payment and ticket issuance.

## Known Bugs

**Bot paid bookings may never be confirmed by provider-specific webhooks:**
- Symptoms: The bot booking message route sets paid bookings to `status: 'awaiting_payment'`, while `processPaymentWebhookResult` confirms only bookings with `status: 'pending_payment'` and `payment_status: 'pending'`.
- Files: `src/app/api/bot/booking/[sessionId]/message/route.ts`, `src/lib/payments/processWebhookResult.ts`, `src/models/Booking.ts`
- Trigger: Complete payment for a bot-created booking through a Stripe or Razorpay webhook URL under `src/app/api/payments/webhook/stripe/[orgId]/route.ts` or `src/app/api/payments/webhook/razorpay/[orgId]/route.ts`.
- Workaround: Configure bot payments to use the centralized `/api/payments/webhook/[provider]/[orgId]` route, or update `processPaymentWebhookResult` to handle `awaiting_payment` bot bookings.

**Free bot bookings issue tickets from stale booking state:**
- Symptoms: The bot message route calls `issueTicketsForBooking(booking)` before persisting the updated `status: 'confirmed'`, `quantity`, and `form_responses`.
- Files: `src/app/api/bot/booking/[sessionId]/message/route.ts`, `src/lib/ticketIssuance.ts`
- Trigger: Confirm a free bot booking after collecting form data.
- Workaround: Persist the final booking state first, then issue tickets using the updated booking document returned from MongoDB.

**Reset-token clearing writes `undefined` through `$set`:**
- Symptoms: Expired and used password reset tokens are cleared with `updateAccount(account.id, { resetToken: undefined, resetTokenExpiry: undefined })`, but `updateAccount` always uses `$set`.
- Files: `src/app/api/auth/reset-password/route.ts`, `src/lib/storage.ts`
- Trigger: Reset a password or submit an expired reset token.
- Workaround: Add a dedicated `clearResetToken` helper that uses `$unset`, matching `clearOtp` in `src/lib/storage.ts`.

## Security Considerations

**Server-side URL fetching lacks private-network and scheme protections:**
- Risk: Authenticated users can make the server fetch arbitrary URLs for crawling and theme extraction, including internal metadata or private-network endpoints if reachable from the deployment environment.
- Files: `src/app/api/crawl/route.ts`, `src/app/api/extract-theme/route.ts`, `src/ai/flows/bot-knowledge-base-creation-flow.ts`
- Current mitigation: Basic URL parsing, request timeouts, page limits in `src/app/api/crawl/route.ts`, and an authenticated cookie check for crawl.
- Recommendations: Allow only `http` and `https`, reject localhost/private/link-local IPs after DNS resolution, cap response size, limit redirects, and require authentication for `src/app/api/extract-theme/route.ts`.

**JWT signing falls back to a hard-coded secret:**
- Risk: If `JWT_SECRET` is missing in production, issued cookies are signed with a predictable value.
- Files: `src/lib/auth.ts`
- Current mitigation: Cookie is `httpOnly`, production cookies are `secure`, and expiration is seven days.
- Recommendations: Fail startup or request handling when `JWT_SECRET` is absent outside tests/development. Add a config validation module used by auth routes.

**OAuth callback logs sensitive provider data:**
- Risk: Google OAuth token responses and user profile payloads are printed to application logs.
- Files: `src/app/api/auth/google/callback/route.ts`
- Current mitigation: None detected.
- Recommendations: Remove token/user logging, or replace with redacted structured events that never include access tokens, refresh tokens, or personal profile payloads.

**Reset tokens are returned to the browser and stored in sessionStorage:**
- Risk: Password reset authority is exposed to frontend JavaScript and persists in `sessionStorage`, increasing impact from XSS or shared-device browser state.
- Files: `src/app/api/auth/verify-otp/route.ts`, `src/app/verify-otp/page.tsx`, `src/app/reset-password/page.tsx`
- Current mitigation: Tokens are random, expire after 10 minutes, and OTP hashes are cleared after use.
- Recommendations: Prefer an `HttpOnly`, short-lived reset cookie or single server-side reset session. Store only hashed reset tokens in MongoDB.

**Wide CORS on authenticated and tenant-scoped routes:**
- Risk: Several routes return `Access-Control-Allow-Origin: *`, including chat, crawl, PDF ingestion, theme, analytics, and embed booking routes. This broadens browser-call surfaces and makes token/cookie expectations harder to reason about.
- Files: `src/app/api/crawl/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/chat/pdf/route.ts`, `src/app/api/ingest/pdf/route.ts`, `src/app/api/theme/route.ts`, `src/app/api/analytics/track/route.ts`, `src/app/api/embed/bookings/session/route.ts`
- Current mitigation: Some routes require cookies or explicit tenant/visitor IDs.
- Recommendations: Restrict CORS by endpoint purpose. Keep `*` only for public embed APIs that are designed for third-party sites, and use an allowlist for authenticated dashboard APIs.

**Local secret/config files are present in the repository root:**
- Risk: Secret-bearing files can be accidentally read, copied, or committed.
- Files: `.env`, `env.txt`
- Current mitigation: `.env` appears in the root and was not read. `env.txt` exists and should be treated as potentially sensitive.
- Recommendations: Ensure `.env` and `env.txt` are ignored, remove any committed secret material, and document required variables in a non-secret example file.

## Performance Bottlenecks

**Crawl and embedding run synchronously inside an API request:**
- Problem: The crawl endpoint fetches up to 10 pages, chunks all text, embeds each chunk sequentially, and waits 300 ms between chunks before responding.
- Files: `src/app/api/crawl/route.ts`, `src/lib/embeddings.ts`, `src/lib/vectorStore.ts`
- Cause: Long-running external network calls and AI embedding calls are performed directly in the Next route handler.
- Improvement path: Move crawl and embedding to a background job with progress polling. Batch embeddings where supported, cap total extracted bytes, and persist intermediate job state.

**MongoDB client is recreated per production call:**
- Problem: Production calls create and connect a new `MongoClient` in `getClient`.
- Files: `src/lib/db.ts`
- Cause: Client reuse is limited to development and test environments.
- Improvement path: Reuse a module-level or global MongoDB client in production too, with a connection promise to avoid connection storms in serverless warm instances.

**Analytics helper creates indexes during normal request paths:**
- Problem: `getAnalyticsCollection` calls `createIndex` every time analytics storage is accessed.
- Files: `src/lib/storage.ts`
- Cause: Index setup is embedded in the helper rather than a migration or startup script.
- Improvement path: Move index creation to `src/lib/setupIndexes.ts` or a deployment-time migration. Keep request handlers focused on reads/writes.

**Dashboard history and analytics perform broad aggregations without visible pagination contracts:**
- Problem: Conversation and analytics helpers run counts, aggregations, and recent lookups from request paths.
- Files: `src/lib/conversations.ts`, `src/lib/storage.ts`, `src/app/api/analytics/route.ts`, `src/app/api/history/route.ts`
- Cause: API endpoints depend directly on collection scans/aggregations with limited explicit indexing and no documented data-retention limits.
- Improvement path: Add compound indexes for common filters, enforce pagination on history endpoints, and pre-aggregate dashboard metrics if data volume grows.

## Fragile Areas

**Booking and payment lifecycle spans two partially overlapping models:**
- Files: `src/models/Booking.ts`, `src/models/BookingSession.ts`, `src/app/api/embed/bookings/session/[sessionId]/confirm/route.ts`, `src/app/api/bot/booking/[sessionId]/message/route.ts`, `src/lib/payments/processWebhookResult.ts`
- Why fragile: Bot flow uses `awaiting_payment`, top-level payment fields, and held inventory; embed flow uses `pending_payment`, nested `payment`, `payment_status`, `booking_sessions`, and `payment_attempts`.
- Safe modification: Treat bot and embed booking as separate variants in the type system, then centralize shared payment confirmation behavior behind functions that explicitly accept the variant.
- Test coverage: Unit tests cover `src/lib/bookingFlow.ts`, `src/lib/bookingStateMachine.ts`, `src/lib/eventCapacity.ts`, and `src/lib/ticketIssuance.ts`, but endpoint/webhook integration tests are not detected.

**Inventory holds rely on passive reconciliation:**
- Files: `src/lib/eventCapacity.ts`, `src/app/api/bot/booking/[sessionId]/message/route.ts`, `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`
- Why fragile: Expired holds release only when a related route calls `reconcileExpiredHold`; no scheduled cleanup is detected.
- Safe modification: Keep atomic `$expr` capacity guards, and add a scheduled reconciler for stale `awaiting_payment` bookings before changing hold durations or payment flows.
- Test coverage: `src/lib/eventCapacity.test.ts` covers hold placement, confirmation, release, and lazy expiration; route-level payment/expiry behavior is not covered.

**Custom regex validation can execute tenant-provided patterns directly:**
- Files: `src/lib/bookingFlow.ts`, `src/app/api/events/[id]/form-fields/route.ts`, `src/app/api/events/[id]/form-fields/[fieldId]/route.ts`
- Why fragile: `new RegExp(field.custom_regex).test(input)` is run during booking without detected safeguards against invalid or catastrophic patterns.
- Safe modification: Validate custom regex at form-field creation/update time, limit pattern length, reject risky constructs where practical, and catch regex errors in `validateInput`.
- Test coverage: `src/lib/bookingFlow.test.ts` covers common email/phone/name validation but not invalid or pathological custom regex behavior.

**Scanner ticket endpoints trust shared secrets and ticket codes across public routes:**
- Files: `src/app/api/scanner/tickets/[ticketCode]/scan/route.ts`, `src/app/api/scanner/sync/route.ts`, `src/lib/scannerAuth.ts`, `src/lib/ticketIssuance.ts`
- Why fragile: Scanner access is security-sensitive and depends on route-level token validation, ticket-code lookup, and idempotent scan state updates.
- Safe modification: Preserve HMAC verification and event ownership checks when editing scanner flows. Add integration tests for unauthorized scanner, wrong event, duplicate scan, and batch sync cases.
- Test coverage: Ticket issuance is covered in `src/lib/ticketIssuance.test.ts`; scanner API route tests are not detected.

## Scaling Limits

**Plan usage limits are counted live from event collections:**
- Current capacity: `free` users get 100 messages and 1 crawl per month; `starter` gets 5000 messages and 10 crawls; `pro` gets 50000 messages and 999 crawls.
- Limit: `checkMessageLimit` and `checkCrawlLimit` count documents in `messages` and `crawl_logs` each request, so cost grows with monthly usage.
- Scaling path: Maintain monthly usage counters per account or tenant, indexed by `{ userId, month }`, and update counters transactionally with message/crawl writes.

**Crawl limits are checked before work and logged after work:**
- Current capacity: One crawl log is written after the crawl and vector upsert complete.
- Limit: Concurrent crawl requests can pass the same pre-check before either writes `crawl_logs`, allowing users to exceed monthly crawl limits.
- Scaling path: Reserve a crawl quota atomically before starting the crawl, mark the reservation as completed/failed afterward, and clean abandoned reservations.

## Dependencies at Risk

**Next lint script may not work with Next 15:**
- Risk: `package.json` uses `next lint`, while modern Next.js versions remove or discourage that command path.
- Impact: `npm run lint` may fail or become unavailable even though linting remains expected by workflow scripts.
- Migration plan: Add an explicit ESLint setup and update `package.json` to call `eslint` directly, or remove the lint script until a supported linter config exists.

**Genkit embedding flow uses an untyped private escape hatch:**
- Risk: `src/ai/flows/bot-knowledge-base-creation-flow.ts` calls `(ai as any).embed`, which can break silently across Genkit API changes.
- Impact: Knowledge-base creation can fail at runtime even when TypeScript passes.
- Migration plan: Use the supported embedding helper already present in `src/lib/embeddings.ts` or a typed Genkit embedding API.

## Missing Critical Features

**No durable background job system for long AI/data work:**
- Problem: Crawling, PDF ingestion, embeddings, and analytics run directly in API handlers.
- Blocks: Reliable retries, progress reporting, cancellation, and safe handling of deployment timeouts.

**No detected migration/index lifecycle for MongoDB collections:**
- Problem: Indexes are created opportunistically in helpers and route paths, while unique indexes required for webhook idempotency are assumed by code.
- Blocks: Predictable production rollout and confidence that idempotency gates are actually enforced.

**No explicit configuration validation layer:**
- Problem: Missing environment variables are discovered deep inside request handlers such as `src/lib/auth.ts`, `src/lib/db.ts`, `src/lib/credentialCrypto.ts`, and payment routes.
- Blocks: Early deployment failure for broken auth, database, payment, email, and AI configuration.

## Test Coverage Gaps

**Payment webhook integration paths:**
- What's not tested: Stripe/Razorpay/provider-agnostic webhook signature verification handoff, idempotency gates, bot `awaiting_payment` confirmation, embed `pending_payment` confirmation, failure release, and late-payment behavior.
- Files: `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`, `src/app/api/payments/webhook/stripe/[orgId]/route.ts`, `src/app/api/payments/webhook/razorpay/[orgId]/route.ts`, `src/lib/payments/processWebhookResult.ts`
- Risk: Paid bookings can remain unconfirmed, duplicate tickets can be issued, or holds can remain stuck.
- Priority: High

**Authentication and password reset routes:**
- What's not tested: Login throttling, OTP brute-force limits, reset token expiry/clearing, Google OAuth callback failures, and missing `JWT_SECRET` behavior.
- Files: `src/app/api/auth/login/route.ts`, `src/app/api/auth/verify-otp/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/app/api/auth/google/callback/route.ts`, `src/lib/auth.ts`
- Risk: Security regressions can ship unnoticed.
- Priority: High

**Crawler and theme extraction security boundaries:**
- What's not tested: Private IP rejection, non-HTTP schemes, redirect handling, response-size caps, CSS fetch behavior, and unauthenticated theme extraction.
- Files: `src/app/api/crawl/route.ts`, `src/app/api/extract-theme/route.ts`, `src/ai/flows/bot-knowledge-base-creation-flow.ts`
- Risk: SSRF, timeout, or excessive-cost regressions can ship unnoticed.
- Priority: High

**Dashboard route behavior:**
- What's not tested: Data-loading error states, mutation flows, and UI state for large dashboard pages.
- Files: `src/app/dashboard/pdf/page.tsx`, `src/app/dashboard/configure/page.tsx`, `src/app/dashboard/events/[id]/page.tsx`, `src/app/dashboard/analytics/page.tsx`
- Risk: Refactors in large pages can break important user workflows without unit or integration feedback.
- Priority: Medium

**Embed booking public APIs:**
- What's not tested: Session creation/resume, quantity updates, form answer updates, confirmation race conditions, payment bridge token checks, and ticket/status endpoints.
- Files: `src/app/api/embed/bookings/session/route.ts`, `src/app/api/embed/bookings/session/[sessionId]/route.ts`, `src/app/api/embed/bookings/session/[sessionId]/confirm/route.ts`, `src/app/api/booking/pay/[bookingId]/route.ts`, `src/app/api/embed/bookings/[bookingId]/status/route.ts`, `src/app/api/embed/bookings/[bookingId]/ticket/route.ts`
- Risk: Public booking widgets can oversell, leak booking status, or fail payment handoff after changes.
- Priority: High

---

*Concerns audit: 2026-09-30*
