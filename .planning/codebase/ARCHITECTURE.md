---
last_mapped_commit: e566539034890af2cc1da4196897f16e95975860
last_mapped_at: 2026-09-30
---
<!-- refreshed: 2026-09-30 -->

# Architecture

**Analysis Date:** 2026-09-30

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router UI                     │
├──────────────────┬──────────────────┬───────────────────────┤
│ Landing & auth   │ Dashboard pages  │ Embedded/public flows │
│ `src/app/page.tsx`│ `src/app/dashboard`│ `src/app/bot`       │
│ `src/app/login`  │ `src/app/booking`│ `public/embed.js`    │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Route Handler API Layer                      │
│ `src/app/api/**/route.ts`                                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│             Domain, Infrastructure, and AI Helpers           │
│ `src/lib`, `src/lib/payments`, `src/ai/flows`                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ MongoDB, Atlas Vector Search, LLMs, Payment Providers        │
│ `src/lib/db.ts`, `src/lib/vectorStore.ts`, `src/lib/payments`│
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root app shell | Global metadata, fonts, toaster, cookies banner, Vercel analytics, speed insights | `src/app/layout.tsx` |
| Landing page | Client-rendered marketing/product surface composed from landing components | `src/app/page.tsx`, `src/components/Hero.tsx`, `src/components/Features.tsx` |
| Dashboard shell | Auth-gated dashboard layout, safe user shaping, sidebar container | `src/app/dashboard/layout.tsx`, `src/components/ui/dashboard-with-collapsible-sidebar.tsx` |
| API routes | HTTP boundary for auth, events, booking, chat, PDFs, payments, scanner, images | `src/app/api/**/route.ts` |
| Auth helpers | JWT signing, verification, and cookie user lookup | `src/lib/auth.ts` |
| MongoDB connection | Environment-driven Mongo client and database access | `src/lib/db.ts` |
| Account, knowledge, analytics storage | Collection helper functions for accounts, knowledge, and analytics | `src/lib/storage.ts` |
| Event booking domain | Deterministic booking conversation, capacity holds, ticket issuance | `src/lib/bookingFlow.ts`, `src/lib/bookingStateMachine.ts`, `src/lib/eventCapacity.ts`, `src/lib/ticketIssuance.ts` |
| Payment gateway adapters | Shared payment gateway interface and provider-specific checkout/webhook behavior | `src/lib/payments/adapter.ts`, `src/lib/payments/stripe.ts`, `src/lib/payments/razorpay.ts`, `src/lib/payments/paypal.ts`, `src/lib/payments/cashfree.ts` |
| AI and RAG helpers | Embeddings, vector search, Genkit flows, Groq chat route support | `src/ai/genkit.ts`, `src/ai/flows/ai-response-generation.ts`, `src/lib/embeddings.ts`, `src/lib/vectorStore.ts` |
| Type models | Mongo document shapes and domain enums/interfaces | `src/models/*.ts` |

## Pattern Overview

**Overall:** Next.js App Router application with route-handler APIs, shared domain helpers, and MongoDB-backed data access.

**Key Characteristics:**
- Use file-based App Router entry points for pages and APIs: `src/app/**/page.tsx`, `src/app/**/layout.tsx`, and `src/app/api/**/route.ts`.
- Keep reusable domain logic in `src/lib` and keep Mongo document shapes in `src/models`.
- Prefer route handlers as orchestration boundaries: parse request, authenticate, validate, call `src/lib`, return `NextResponse`.
- Use MongoDB directly through `getDb()` rather than an ORM; collection names are passed inline in route handlers and helper modules.
- Use client components for interactive pages and widgets with `"use client"` at the top, as in `src/app/page.tsx`, `src/app/bot/page.tsx`, and dashboard pages.

## Layers

**App Pages:**
- Purpose: Render public pages, authentication screens, dashboard surfaces, booking status pages, and embedded chat experiences.
- Location: `src/app`
- Contains: `page.tsx`, `layout.tsx`, metadata routes, global CSS.
- Depends on: `src/components`, `src/hooks`, browser `fetch`, and selected server helpers in server layouts.
- Used by: Next.js App Router.

**API Route Handlers:**
- Purpose: Expose JSON and webhook endpoints for all application behavior.
- Location: `src/app/api`
- Contains: Auth routes, event CRUD routes, booking APIs, chat/PDF APIs, webhook receivers, image upload auth, scanner endpoints.
- Depends on: `src/lib`, `src/models`, `mongodb`, provider SDKs.
- Used by: Dashboard pages, embedded widget, payment providers, scanner clients, public booking flows.

**Shared UI Components:**
- Purpose: Reusable UI primitives, landing sections, dashboard shell, ticket preview, navigation, modals.
- Location: `src/components`, `src/components/ui`
- Contains: Shadcn/Radix-style primitives, composed marketing sections, dashboard layout container, shared UX pieces.
- Depends on: `src/lib/utils.ts`, `src/hooks`, Radix, lucide-react, framer-motion, Tailwind classes.
- Used by: `src/app/**/*.tsx`.

**Domain Logic:**
- Purpose: Keep deterministic business logic outside route handlers when logic must be reused or tested.
- Location: `src/lib`
- Contains: Booking flow, state machine, capacity management, ticket issuance, rate limiting, scanner auth, conversations, storage.
- Depends on: `src/lib/db.ts`, `src/models`, `mongodb`, crypto, provider adapters.
- Used by: `src/app/api/**/route.ts` and tests in `src/lib/*.test.ts`.

**Payment Integration Layer:**
- Purpose: Normalize payment checkout and webhook handling across providers.
- Location: `src/lib/payments`
- Contains: `PaymentGatewayAdapter` contract and Stripe, Razorpay, PayPal, Cashfree adapters.
- Depends on: provider SDKs or HTTP APIs, decrypted tenant credentials from `src/lib/credentialCrypto.ts`.
- Used by: `src/app/api/bot/booking/[sessionId]/message/route.ts`, `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`.

**AI and Vector Layer:**
- Purpose: Build chatbot responses from embeddings, vector search, and LLM generation.
- Location: `src/ai`, `src/lib/embeddings.ts`, `src/lib/vectorStore.ts`
- Contains: Genkit initialization, Genkit flows, Gemini embedding REST client, MongoDB Atlas vector store helpers.
- Depends on: Genkit, Google GenAI, Groq SDK in `src/app/api/chat/route.ts`, MongoDB Atlas vector search.
- Used by: `src/app/api/chat/route.ts`, `src/ai/flows/ai-response-generation.ts`, PDF and knowledge ingestion routes.

**Models:**
- Purpose: Type MongoDB documents and domain state.
- Location: `src/models`
- Contains: TypeScript interfaces for bookings, sessions, conversations, events, fields, payment configs, tickets.
- Depends on: `mongodb` `ObjectId`.
- Used by: API routes, `src/lib`, and tests.

## Data Flow

### Authenticated Dashboard Event Management

1. `src/app/dashboard/layout.tsx` calls `getUserIdFromCookie()` from `src/lib/auth.ts` and redirects unauthenticated requests.
2. Dashboard pages such as `src/app/dashboard/events/page.tsx` fetch `/api/events` from the browser.
3. `src/app/api/events/route.ts` authenticates again with `getUserIdFromCookie()`.
4. `src/app/api/events/route.ts` validates request bodies, uses `getDb()` from `src/lib/db.ts`, and reads/writes the `events` collection.
5. Dynamic event endpoints such as `src/app/api/events/[id]/route.ts` validate `ObjectId`, enforce `org_id`, and return JSON.

### Embedded Chat and RAG

1. The embedded/public chat UI in `src/app/bot/page.tsx` sends messages to `/api/chat`.
2. `src/app/api/chat/route.ts` extracts `userId`, session identifiers, and the latest user message.
3. `src/app/api/chat/route.ts` checks the tenant plan with `findAccountById()` from `src/lib/storage.ts` and enforces limits with `checkMessageLimit()` from `src/lib/ratelimit.ts`.
4. `embedText()` in `src/lib/embeddings.ts` generates a Gemini embedding for the user message.
5. `searchKnowledgeChunks()` in `src/lib/vectorStore.ts` runs Atlas vector search against `nochbot_chunks`.
6. `src/app/api/chat/route.ts` calls Groq chat completions, stores messages through `src/lib/conversations.ts`, and returns response text plus optional booking action.

### Conversational Booking Flow

1. Public or bot booking endpoints create or locate booking/session records under `src/app/api/embed/bookings/session/route.ts` or `src/app/api/bot/booking/**/route.ts`.
2. `src/app/api/bot/booking/[sessionId]/message/route.ts` loads booking, event, and form fields from MongoDB.
3. `processBookingMessage()` in `src/lib/bookingFlow.ts` applies deterministic conversation rules and validation.
4. `getNextState()` in `src/lib/bookingStateMachine.ts` computes state transitions.
5. Free events use `reserveCapacity()` from `src/lib/eventCapacity.ts` and `issueTicketsForBooking()` from `src/lib/ticketIssuance.ts`.
6. Paid events use `placeHold()` from `src/lib/eventCapacity.ts`, then provider adapters in `src/lib/payments`.
7. Webhooks enter through `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`, dedupe with `processed_webhooks`, confirm or release capacity, and issue tickets.

### AI Flow Development

1. `npm run genkit:dev` starts `genkit start -- tsx src/ai/dev.ts`.
2. `src/ai/dev.ts` loads environment configuration and imports flow definitions from `src/ai/flows`.
3. `src/ai/genkit.ts` configures Genkit with Google GenAI.
4. `src/ai/flows/ai-response-generation.ts` embeds the question, searches vector chunks, and streams a Genkit response.

**State Management:**
- Server-side persistence is MongoDB collections reached through `src/lib/db.ts`.
- Client-side page state uses React hooks inside client components such as `src/app/page.tsx`, `src/app/bot/page.tsx`, and `src/app/dashboard/events/page.tsx`.
- Auth state is an HTTP-only `token` cookie created by auth routes and read through `getUserIdFromCookie()` in `src/lib/auth.ts`.
- Booking conversation state is persisted in Mongo documents and modeled with `ConversationState` in `src/models/Booking.ts`.

## Key Abstractions

**Route Handler Boundary:**
- Purpose: Each `route.ts` is the HTTP adapter for one resource/action.
- Examples: `src/app/api/events/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/chat/route.ts`.
- Pattern: Export HTTP verb functions such as `GET`, `POST`, `PATCH`, `DELETE`, and return `NextResponse`.

**Mongo Connection Helper:**
- Purpose: Centralize Mongo client creation and database selection.
- Examples: `src/lib/db.ts`.
- Pattern: Call `getDb()` in server-only code; do not create ad hoc `MongoClient` instances elsewhere.

**Document Models:**
- Purpose: Type persisted domain records without adding runtime ORM behavior.
- Examples: `src/models/Event.ts`, `src/models/Booking.ts`, `src/models/Ticket.ts`.
- Pattern: Import model types into route handlers and `src/lib` helpers for explicit document shapes.

**Deterministic Booking State Machine:**
- Purpose: Keep booking transitions testable and independent of HTTP.
- Examples: `src/lib/bookingStateMachine.ts`, `src/lib/bookingFlow.ts`, tests in `src/lib/bookingStateMachine.test.ts` and `src/lib/bookingFlow.test.ts`.
- Pattern: Pure state transition helpers return next state/update objects; route handlers persist the result.

**PaymentGatewayAdapter:**
- Purpose: Give all payment providers the same checkout and webhook interface.
- Examples: `src/lib/payments/adapter.ts`, `src/lib/payments/stripe.ts`, `src/lib/payments/razorpay.ts`.
- Pattern: Add providers by implementing the adapter and registering it in route-level provider maps.

**Vector Store Helpers:**
- Purpose: Manage MongoDB Atlas vector collections and vector search.
- Examples: `src/lib/vectorStore.ts`.
- Pattern: Use `replaceKnowledgeChunks()`, `insertPdfChunks()`, `searchKnowledgeChunks()`, and `searchPdfChunks()` rather than duplicating `$vectorSearch` pipelines.

## Entry Points

**Application root:**
- Location: `src/app/layout.tsx`
- Triggers: All App Router requests.
- Responsibilities: Metadata, fonts, global providers/widgets, analytics.

**Public landing page:**
- Location: `src/app/page.tsx`
- Triggers: Browser request to `/`.
- Responsibilities: Product landing composition, reset success toast, newsletter modal.

**Dashboard:**
- Location: `src/app/dashboard/layout.tsx`
- Triggers: Browser requests under `/dashboard`.
- Responsibilities: Server-side auth gate, user lookup, dashboard shell rendering.

**API routes:**
- Location: `src/app/api/**/route.ts`
- Triggers: Browser fetches, embedded widget requests, payment webhooks, scanner clients.
- Responsibilities: Validation, auth, domain orchestration, JSON/webhook responses.

**Embedded chatbot:**
- Location: `src/app/bot/page.tsx`, `public/embed.js`
- Triggers: Iframe/script embedding or direct `/bot` visits.
- Responsibilities: Chat UI, bot customization fetch, `/api/chat` calls.

**Genkit dev server:**
- Location: `src/ai/dev.ts`
- Triggers: `npm run genkit:dev` or `npm run genkit:watch`.
- Responsibilities: Load AI flow definitions for local Genkit development.

**Metadata routes:**
- Location: `src/app/robots.ts`, `src/app/sitemap.ts`
- Triggers: Requests for robots and sitemap metadata.
- Responsibilities: Search engine metadata generation.

## Architectural Constraints

- **Threading:** Runtime code is asynchronous JavaScript in Next.js route handlers and React components. MongoDB operations and provider calls use promises; no worker threads are present.
- **Global state:** `src/lib/db.ts` uses `global._mongoClient` and `global._mongoClientUri` in development/test to reuse the Mongo client. `src/app/api/chat/route.ts` has module-level constants for CORS headers and booking intent keywords.
- **Server/client split:** Files using browser state or effects must include `"use client"` and cannot import server-only helpers such as `src/lib/db.ts` or `next/headers`.
- **Dynamic route params:** Next 15 route handlers in this codebase type `params` as promises, as in `src/app/api/events/[id]/route.ts` and `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`.
- **Environment:** `.env` is present and must not be read or quoted. Runtime secrets are accessed through `process.env` in files such as `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/embeddings.ts`, and `src/lib/ticketIssuance.ts`.
- **Circular imports:** No circular dependency chain was detected in the inspected architecture. Keep `src/models` free of imports from `src/lib` and `src/app` to preserve this.

## Anti-Patterns

### Client Components Importing Server Helpers

**What happens:** A page marked `"use client"` imports `src/lib/db.ts`, `src/lib/auth.ts`, or other server-only helpers.
**Why it's wrong:** Server helpers depend on `next/headers`, secrets, or database drivers and cannot safely run in the browser bundle.
**Do this instead:** Client pages should call route handlers such as `src/app/api/events/route.ts`; server layouts like `src/app/dashboard/layout.tsx` may call `src/lib/auth.ts` directly.

### Duplicating Business Rules Inside Pages

**What happens:** Booking, capacity, ticket, or payment state rules are implemented directly in UI components.
**Why it's wrong:** The same flow is used by embedded chat, dashboard, and webhooks; duplicating rules risks inconsistent inventory and ticket state.
**Do this instead:** Put deterministic booking rules in `src/lib/bookingFlow.ts`, state transitions in `src/lib/bookingStateMachine.ts`, capacity changes in `src/lib/eventCapacity.ts`, and ticket issuance in `src/lib/ticketIssuance.ts`.

### Creating Provider-Specific Payment Logic In Routes Without Adapter Support

**What happens:** A payment route calls a provider SDK directly and bypasses `PaymentGatewayAdapter`.
**Why it's wrong:** Webhook verification, checkout creation, and tenant credential handling need consistent behavior across providers.
**Do this instead:** Implement or extend an adapter in `src/lib/payments/*.ts`, update the provider map in `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`, and reuse it from booking routes.

## Error Handling

**Strategy:** Route handlers validate early, return structured JSON errors with HTTP status codes, log server failures with route-specific prefixes, and use atomic MongoDB updates for critical booking/payment transitions.

**Patterns:**
- Return `NextResponse.json({ error: "..." }, { status })` from API routes such as `src/app/api/auth/login/route.ts` and `src/app/api/events/route.ts`.
- Guard unauthenticated dashboard/API access with `getUserIdFromCookie()` and 401/redirect behavior in `src/app/dashboard/layout.tsx` and protected API routes.
- Use `try/catch` around provider calls and database mutations in webhook and booking routes.
- Use idempotency for payment webhook events through `processed_webhooks` in `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`.
- Use atomic `findOneAndUpdate` calls for capacity and booking state in `src/lib/eventCapacity.ts` and booking/payment routes.

## Cross-Cutting Concerns

**Logging:** Server errors use `console.error` and `console.warn` with route/module prefixes such as `[events_post]`, `[chat_api]`, `[webhook_${provider}]`, and `[vector-store]`.

**Validation:** Validation is mostly inline in route handlers and domain helpers. Examples include event field validation in `src/app/api/events/route.ts`, `ObjectId.isValid()` checks in dynamic routes, and booking answer validation in `src/lib/bookingFlow.ts`.

**Authentication:** JWT cookie authentication is implemented in `src/lib/auth.ts`. Protected pages use `src/app/dashboard/layout.tsx`; protected API routes call `getUserIdFromCookie()`.

**Authorization:** Tenant ownership is enforced by querying with `org_id` or `userId` in routes such as `src/app/api/events/[id]/route.ts` and vector search filters in `src/lib/vectorStore.ts`.

**Secrets:** Secrets are read from environment variables only. `.env` exists at repository root and must be treated as secret material. Encrypted tenant credentials are decrypted through `src/lib/credentialCrypto.ts`.

---

*Architecture analysis: 2026-09-30*
