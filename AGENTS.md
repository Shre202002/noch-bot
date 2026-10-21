<!-- GSD:project-start source:PROJECT.md -->

## Project

**NochBot**

NochBot is a platform for businesses and event organizers to add a configurable AI assistant to their websites. The assistant can answer from website content and uploaded PDFs, and it can guide visitors through event registration, ticketing, and payment.

**Core Value:** Help website visitors get useful answers grounded in the organization's content and complete the next step, including event booking, in the same assistant experience.

### Constraints

- **Compatibility**: Preserve the dashboard's `POST /api/crawl` request shape `{ url }` unless an actual limitation requires a change.
- **Data safety**: Failed crawls must leave the currently active website knowledge available for chat retrieval.
- **Tenant isolation**: Every knowledge search and write must remain scoped to the owning `userId`.
- **RAG behavior**: Preserve the existing Atlas collection, vector dimensions, embedding generation, and retrieval behavior during the crawler replacement, except for minimal metadata/filter changes needed for safe generation publishing.
- **Security**: Crawling arbitrary user-provided URLs requires SSRF protections, redirect validation, crawl limits, and server-side service credentials.
- **Scope order**: Website crawling is the first improvement; PDF knowledge chat and event booking remain part of the overall product roadmap.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.x - Application code, Next.js routes, React components, AI flows, models, and tests in `src/`.
- TSX / React 19.2.x - App Router pages and UI components in `src/app/` and `src/components/`.
- JavaScript - Allowed by `tsconfig.json` via `allowJs`; no primary application JavaScript entry point detected.
- CSS - Global styling in `src/app/globals.css`, Tailwind theme tokens in `tailwind.config.ts`.
- YAML - Firebase App Hosting backend configuration in `apphosting.yaml`.

## Runtime

- Node.js - Required for Next.js 15, server route handlers, Genkit, MongoDB driver, Stripe SDK, Nodemailer, and Vitest. No explicit Node version file or `package.json` `engines` field detected.
- Next.js runtime - API routes use App Router route handlers under `src/app/api/**/route.ts`.
- npm - `package-lock.json` is present.
- Lockfile: present (`package-lock.json`).

## Frameworks

- Next.js `^15.5.24` - Full-stack React framework, App Router pages in `src/app/`, API routes in `src/app/api/`, image configuration in `next.config.ts`.
- React `^19.2.1` / React DOM `^19.2.1` - Client and server component UI layer in `src/app/` and `src/components/`.
- TypeScript `^5` - Static typing with strict mode in `tsconfig.json`.
- Tailwind CSS `^4.0.0` - Utility styling, theme extension, and content scanning configured in `tailwind.config.ts`; PostCSS integration via `postcss.config.mjs`.
- Genkit `^1.28.0` with `@genkit-ai/google-genai` `^1.28.0` - AI flow framework and Google Gemini provider in `src/ai/genkit.ts` and `src/ai/flows/*.ts`.
- Vitest `^3.2.7` - Unit/integration runner configured in `vitest.config.ts`.
- mongodb-memory-server `^11.2.0` - In-memory MongoDB test backend in `src/test/mongo-setup.ts`.
- Next CLI - `npm run dev` starts `next dev --turbopack -p 9002`; `npm run build` runs `NODE_ENV=production next build`; `npm run start` runs `next start`.
- Turbopack - Used by the dev server script in `package.json`.
- Genkit CLI `^0.0.2` - `npm run genkit:dev` and `npm run genkit:watch` start flows from `src/ai/dev.ts`.
- TypeScript compiler - `npm run typecheck` runs `tsc --noEmit`.
- patch-package `^8.0.0` - Installed for dependency patching; no patch files detected in the explored root.

## Key Dependencies

- `mongodb` `^6.3.0` - Primary database driver in `src/lib/db.ts`; used across models, booking, analytics, storage, vector search, and payments.
- `stripe` `^17.7.0` - Stripe Checkout and webhook verification in `src/lib/payments/stripe.ts`.
- `groq-sdk` `^1.1.2` - Groq chat completions in `src/app/api/chat/route.ts`; direct Groq REST calls in `src/app/api/chat/pdf/route.ts`.
- `genkit` `^1.28.0` and `@genkit-ai/google-genai` `^1.28.0` - Gemini-backed AI generation in `src/ai/genkit.ts` and `src/ai/flows/`.
- `jsonwebtoken` `^9.0.2` - Cookie token signing and verification in `src/lib/auth.ts`.
- `bcryptjs` `^2.4.3` - Password and OTP hashing in auth/account API routes under `src/app/api/auth/` and `src/app/api/account/`.
- `nodemailer` `^9.0.6` - Gmail SMTP email sending in `src/lib/mailer.ts`.
- `zod` `^3.24.2` - Validation/schema support for Genkit flows in `src/ai/flows/*.ts`.
- `unpdf` `^1.6.2` - PDF parsing dependency used by PDF chat/ingestion support; related local parser code is in `src/lib/pdfParser.ts`.
- `@vercel/analytics` `^1.6.1` and `@vercel/speed-insights` `^1.1.0` - Client telemetry mounted in `src/app/layout.tsx`.
- `firebase` `^11.9.1` - Firebase package installed; hosting backend settings live in `apphosting.yaml`. Direct Firebase client usage was not detected in `src/`.
- `axios` `^1.7.9` - HTTP crawling/theme extraction in `src/ai/flows/bot-knowledge-base-creation-flow.ts`, `src/app/api/crawl/route.ts`, and `src/app/api/extract-theme/route.ts`.
- `cheerio` `^1.0.0` - HTML parsing for crawling/knowledge extraction.
- `html2canvas` `^1.4.1` - Browser-side canvas capture support for UI/export flows.
- `papaparse` `^5.5.3` - CSV parsing dependency.
- `qrcode.react` `^4.2.0` - QR rendering for tickets/scanner flows.
- `date-fns` `^3.6.0` - Date formatting and manipulation.
- `uuid` `^9.0.1` - Account IDs and generated identifiers, including Google OAuth account creation in `src/app/api/auth/google/callback/route.ts`.
- `@radix-ui/react-*`, `@ark-ui/react`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` - UI primitive, icon, variant, and utility stack used by `src/components/ui/`.
- `framer-motion` `^11.2.12`, `gsap` `^3.12.5`, `cobe` `^0.6.3`, `embla-carousel-react` `^8.6.0`, `recharts` `^2.15.1` - Motion, globe/visual, carousel, and charting libraries used by app UI and dashboards.
- `@dnd-kit/*` - Drag-and-drop/sortable interactions for configurable UI such as event form fields.

## Configuration

- Environment variables are read directly through `process.env` in server code. Keep required runtime values in `.env`/deployment secrets, but never commit secret values.
- `.env` file present - contains environment configuration and was not read.
- `env.txt` file present - possible environment documentation/config file and was not read because it may contain secret-like values.
- Database variables: `MONGODB_URI`, `MONGODB_DB` in `src/lib/db.ts`.
- Auth/session variables: `JWT_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `src/lib/auth.ts` and `src/app/api/auth/google/*.ts`.
- AI variables: `GOOGLE_GENAI_API_KEY` for Genkit in `src/ai/genkit.ts`; `GEMINI_API_KEY` for direct embeddings in `src/lib/embeddings.ts`; `GROQ_API_KEY_1..N` (legacy single `GROQ_API_KEY` as fallback) and optional `GROQ_MODEL`, used through `groqChat()` in `src/lib/groq.ts`, which rotates keys on quota/auth/server errors and returns a contact-the-owner reply when all keys fail.
- Email variables: `GMAIL_USER`, `GMAIL_APP_PASSWORD` in `src/lib/mailer.ts`.
- Upload variables: `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` in `src/app/api/imagekit/auth/route.ts`, `src/app/api/imagekit/upload-auth/route.ts`, and `src/app/api/images/auth/route.ts`.
- Payments/config security variables: `CREDENTIAL_ENCRYPTION_KEY`, `PAYPAL_MODE`, `CASHFREE_MODE`, tenant-stored Stripe/Razorpay/PayPal/Cashfree credentials in MongoDB via `src/app/api/events/[id]/payment-gateway/route.ts`.
- Ticket/scanner variables: `TICKET_QR_SECRET` in `src/lib/ticketIssuance.ts`, `src/app/api/scanner/sync/route.ts`, and `src/app/api/scanner/tickets/[ticketCode]/scan/route.ts`.
- GitHub integration variable: optional `GITHUB_TOKEN` in `src/app/api/github-commits/route.ts`.
- Document chat (PDF RAG) accepts PDF, CSV and XLSX through `POST /api/ingest/pdf`. Spreadsheet rows live in the `tabular_rows` collection (keyed `c0..cN`; column schema on the `pdf_files` record); questions run as validated structured queries (`src/lib/tabularQuery.ts`) with vector lookup as fallback (`src/lib/tabularChat.ts`). CSV/XLSX documents are growable libraries (`src/lib/tabularLibrary.ts`): `POST /api/ingest/pdf/append` merges batches by header (new columns allowed) and upserts by an optional ID column (`idColumnKey`, rows keyed by `rowKey`); every row carries its own 768-dimension float32 embedding in `tabular_rows`, queued via `needsEmbedding` and filled in slices by `POST /api/ingest/pdf/index` (dashboard-driven loop), searched through the `tabular_rows_vector_index` (filters on `data.c0..c49`). Planner plans may carry `semantic` for meaning-ranked rows with hard filters applied inside the vector search (`splitFilters`), only when `pdf_files.rowVectors === 'ready'`. Additions follow `src/lib/documentAdditions.ts`: same kind only (PDF→PDF passages under the same `fileId`; CSV/XLSX→spreadsheets), 10 MB per file, Free 1 / Starter 3 / Pro 5 additional files per document (tracked in `pdf_files.additions`, slot reserved with a conditional `$push`), and added sheets must match at least half of the document's headers plus its ID column. Shared-link chat resolves owner and file from the `pdf_links` slug, never from the request body. Deleting a document is a soft delete (`src/lib/pdfRetention.ts`): `deletedAt`/`purgeAt` are stamped on `pdf_files`, PDF chunks, `tabular_rows` and `pdf_links`, reads filter with `NOT_DELETED`, the organizer can restore via `POST /api/ingest/pdf/restore` for 7 days, and a `purgeAt` TTL index removes the data afterwards. Shared-link analytics (`chat_sessions`, `chat_messages`) are kept. Share links can be created with `requireLogin`: visitors then need a link-only account (`pdf_link_users`, `src/lib/linkUserAuth.ts`) approved by the link owner from the PDF RAG dashboard; accounts are single-device (a new sign-in replaces `currentSessionId`), sessions last 90 days with no inactivity timeout, and a third sign-in attempt within 48 hours blocks the account until the owner unblocks it. The public resolver never returns `fileId`/owner for a protected link without a valid `nbl_<slug>` session cookie.
- All chat answers go through `src/lib/llmGuard.ts`: client history is sanitized, user input is checked by patterns plus Groq Prompt Guard 2 (fails open), retrieved text is wrapped as `<source>` data with planted instructions defused, prompts append `groundedRules()`, and `answerWithGuards()` blocks prompt leaks and retries/refuses answers containing numbers, emails, URLs or phones absent from the sources.
- Event booking: the live path is the website widget (`/api/embed/bookings/*`, `data-user-id` snippet); the chat-bot path (`/api/bot/booking/*`, `data-widget-id`) is kept. Both take seats atomically on `events.tickets_sold`/`tickets_held` (`src/lib/eventCapacity.ts`), and `releaseExpiredHolds()` returns abandoned holds before any new reservation. Every provider's webhook goes through `processPaymentWebhookResult()` (`src/lib/payments/processWebhookResult.ts`), which confirms either flow, issues tickets, emails them (`src/lib/bookingNotifications.ts`), and resolves late payments (confirm if seats remain, else `needs_refund` + organizer alert). `TICKET_QR_SECRET` is required to issue tickets. Website chat starts booking via `isBookingIntent()` (`src/lib/bookingIntent.ts`), not keyword matching.
- Website crawler variables: `CRAWLER_SERVICE_URL`, `CRAWLER_SERVICE_TOKEN` (32+ chars, shared with the `scraper/` Flask service, started with `python -m nochbot_crawler` from `scraper/`, which reads `scraper/.env`) and optional `CRAWLER_PROVIDER` (`scrapling` | `legacy`) in `src/lib/crawler/index.ts`. Without the service variables the app uses the legacy crawler.
- `package.json` - scripts and dependencies.
- `package-lock.json` - npm dependency lockfile.
- `next.config.ts` - Next config; currently ignores TypeScript and ESLint build errors and allows remote images from `placehold.co`, `images.unsplash.com`, and `picsum.photos`.
- `tsconfig.json` - strict TypeScript, `@/*` alias to `./src/*`, Next plugin, bundler module resolution.
- `tailwind.config.ts` - Tailwind content paths, theme tokens, container settings, and animation plugin.
- `postcss.config.mjs` - PostCSS/Tailwind processing.
- `components.json` - shadcn-style component aliases and Lucide icon library configuration.
- `vitest.config.ts` - test alias, node environment, serialized file execution, Mongo-related timeouts, and `TICKET_QR_SECRET` test env.
- `apphosting.yaml` - Firebase App Hosting backend settings with `runConfig.maxInstances: 1`.

## Platform Requirements

- Install dependencies with `npm install`.
- Run app with `npm run dev`; the dev server uses port `9002`.
- Run Genkit local tooling with `npm run genkit:dev` or `npm run genkit:watch`.
- Run type checking with `npm run typecheck`.
- Run tests with `npm test`.
- Provide required env vars before hitting server routes that access MongoDB, AI providers, email, payment gateways, ImageKit, Google OAuth, or ticket scanning.
- Deployment target is Vercel according to `README.md` badges and Vercel telemetry in `src/app/layout.tsx`.
- Firebase App Hosting configuration also exists in `apphosting.yaml` and caps backend instances at `1`.
- MongoDB Atlas is expected for production database and vector search because `src/lib/vectorStore.ts` uses MongoDB Atlas `$vectorSearch` and `createSearchIndex`.
- Payment webhooks must be reachable at Next.js API routes under `src/app/api/payments/webhook/**/route.ts`.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Use Next.js App Router filenames for routes and pages: `src/app/api/auth/login/route.ts`, `src/app/dashboard/events/[id]/page.tsx`.
- Use camelCase for business logic and helper modules: `src/lib/bookingFlow.ts`, `src/lib/bookingStateMachine.ts`, `src/lib/eventCapacity.ts`, `src/lib/ticketIssuance.ts`.
- Use PascalCase for model interface files that export domain types: `src/models/Booking.ts`, `src/models/Event.ts`, `src/models/EventFormField.ts`, `src/models/Ticket.ts`.
- Use lowercase kebab-case for shared UI component files: `src/components/ui/alert-dialog.tsx`, `src/components/ui/color-picker.tsx`, `src/components/ui/contact-card.tsx`.
- Co-locate tests beside the implementation with `.test.ts`: `src/lib/bookingFlow.test.ts`, `src/lib/eventCapacity.test.ts`.
- Use camelCase for exported functions and helpers: `processBookingMessage` in `src/lib/bookingFlow.ts`, `getNextState` in `src/lib/bookingStateMachine.ts`, `reserveCapacity` and `reconcileExpiredHold` in `src/lib/eventCapacity.ts`.
- Use uppercase HTTP method exports for Next API handlers: `POST` in `src/app/api/auth/login/route.ts`, `GET`/`POST` patterns in `src/app/api/events/route.ts`.
- Use small local factory/helper names in tests: `makeEvent`, `makeField`, `makeBooking` in `src/lib/bookingFlow.test.ts`, `ctx` in `src/lib/bookingStateMachine.test.ts`.
- Use camelCase for local variables and request data: `current_field_index` is destructured from persisted state, while locals like `nextFieldIndex`, `nextAttendeeIndex`, and `updatedResponses` are camelCase in `src/lib/bookingFlow.ts`.
- Preserve snake_case for persisted MongoDB/domain fields that mirror document shape: `conversation_state`, `session_context`, `form_responses`, `tickets_sold`, and `tickets_held` in `src/models/Booking.ts` and `src/lib/eventCapacity.ts`.
- Use `UPPER_CASE` for module constants that represent environment-backed secrets or fixed config: `QR_SECRET` in `src/lib/ticketIssuance.test.ts`.
- Use PascalCase for interfaces and exported type aliases: `Booking`, `BookingStatus`, `BookingSessionContext`, and `BookingFormResponses` in `src/models/Booking.ts`.
- Prefer explicit return types on exported async/test-support functions where state matters: `startTestMongo(): Promise<void>` and `mongoUri(): string` in `src/test/mongo-setup.ts`.
- Use `Partial<T>` for test fixture overrides: `makeEvent(overrides: Partial<Event> = {})` in `src/lib/bookingFlow.test.ts`.

## Code Style

- No Prettier config is detected; use the existing local style in the edited file.
- Indent with two spaces in TypeScript and TSX files, as shown in `src/lib/bookingFlow.ts`, `src/components/ui/button.tsx`, and `src/lib/eventCapacity.test.ts`.
- The repo contains both single-quote/semicolon style (`src/lib/db.ts`, `src/app/api/auth/login/route.ts`) and double-quote/trailing-comma style (`src/components/ui/button.tsx`, `src/lib/bookingFlow.test.ts`). Match the surrounding file style when editing.
- Keep object literals and Mongo update documents multiline once they contain nested structures, as in `src/lib/eventCapacity.ts` and `src/app/api/events/route.ts`.
- `package.json` exposes `npm run lint`, which maps to `next lint`.
- No standalone `.eslintrc*`, `eslint.config.*`, `biome.json`, or `.prettierrc*` file is detected.
- TypeScript strict mode is enabled in `tsconfig.json`; treat `npm run typecheck` as the reliable static quality gate.
- `src/lib/db.ts` uses targeted eslint comments for global declarations; keep lint suppressions narrow and next to the line they justify.

## Import Organization

- Use `@/*` for files under `src/*`; the alias is configured in `tsconfig.json` and `vitest.config.ts`.
- Use `@/lib/...` for shared helpers, `@/models/...` for domain types, and `@/test/...` for test infrastructure such as `src/test/mongo-setup.ts`.
- Use relative imports when the imported module is a sibling in the same folder and the file already follows that style, such as `src/lib/eventCapacity.ts`.

## Error Handling

- API routes use early validation returns with `NextResponse.json({ error: "..." }, { status })`, as in `src/app/api/auth/login/route.ts` and `src/app/api/events/route.ts`.
- Wrap route bodies that touch I/O in `try`/`catch`; log the server-side detail and return a generic client-safe error for 500 responses, as in `src/app/api/auth/login/route.ts`.
- Throw `Error` for missing critical environment/configuration state in lower-level helpers: `src/lib/db.ts`, `src/lib/embeddings.ts`, `src/lib/credentialCrypto.ts`, and `src/lib/ticketIssuance.ts`.
- Domain helpers return `null` for expected business-rule denials such as unavailable capacity in `src/lib/eventCapacity.ts`; reserve thrown errors for invalid invariants and configuration failures.
- Conversational flow helpers return typed state-update objects rather than throwing for user input validation failures in `src/lib/bookingFlow.ts`.

## Logging

- Use contextual log prefixes for API/server errors: `[scanner_scan_single]`, `[events_post]`, `[analytics]`, and `[mailer]` patterns appear across `src/app/api/**/route.ts` and `src/lib/mailer.ts`.
- Use `console.error` in `catch` blocks before returning generic API errors, as in `src/app/api/auth/login/route.ts`.
- Use `console.warn` for recoverable or suspicious conditions, as in payment webhook and scanner sync routes under `src/app/api/payments/**` and `src/app/api/scanner/**`.
- Avoid logging secrets or credential values. `.env` is present and must only be referenced by variable name, never read or quoted.

## Comments

- Add comments for non-obvious state-machine transitions, idempotency behavior, atomic MongoDB operations, and test setup constraints.
- Keep comments close to the code they explain, such as the fixed MongoMemoryServer port note in `src/test/mongo-setup.ts` and the no-op helper comment in `src/lib/bookingFlow.ts`.
- Do not comment straightforward assignments or obvious JSX structure.
- Use file-level or exported-symbol JSDoc for business flows and domain helpers: `src/lib/bookingFlow.ts`, `src/lib/eventCapacity.ts`, and `src/models/Booking.ts`.
- Use JSDoc when an exported function has lifecycle requirements, such as calling `startTestMongo` before importing DB consumers in `src/test/mongo-setup.ts`.

## Function Design

## Module Design

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- Use file-based App Router entry points for pages and APIs: `src/app/**/page.tsx`, `src/app/**/layout.tsx`, and `src/app/api/**/route.ts`.
- Keep reusable domain logic in `src/lib` and keep Mongo document shapes in `src/models`.
- Prefer route handlers as orchestration boundaries: parse request, authenticate, validate, call `src/lib`, return `NextResponse`.
- Use MongoDB directly through `getDb()` rather than an ORM; collection names are passed inline in route handlers and helper modules.
- Use client components for interactive pages and widgets with `"use client"` at the top, as in `src/app/page.tsx`, `src/app/bot/page.tsx`, and dashboard pages.

## Layers

- Purpose: Render public pages, authentication screens, dashboard surfaces, booking status pages, and embedded chat experiences.
- Location: `src/app`
- Contains: `page.tsx`, `layout.tsx`, metadata routes, global CSS.
- Depends on: `src/components`, `src/hooks`, browser `fetch`, and selected server helpers in server layouts.
- Used by: Next.js App Router.
- Purpose: Expose JSON and webhook endpoints for all application behavior.
- Location: `src/app/api`
- Contains: Auth routes, event CRUD routes, booking APIs, chat/PDF APIs, webhook receivers, image upload auth, scanner endpoints.
- Depends on: `src/lib`, `src/models`, `mongodb`, provider SDKs.
- Used by: Dashboard pages, embedded widget, payment providers, scanner clients, public booking flows.
- Purpose: Reusable UI primitives, landing sections, dashboard shell, ticket preview, navigation, modals.
- Location: `src/components`, `src/components/ui`
- Contains: Shadcn/Radix-style primitives, composed marketing sections, dashboard layout container, shared UX pieces.
- Depends on: `src/lib/utils.ts`, `src/hooks`, Radix, lucide-react, framer-motion, Tailwind classes.
- Used by: `src/app/**/*.tsx`.
- Purpose: Keep deterministic business logic outside route handlers when logic must be reused or tested.
- Location: `src/lib`
- Contains: Booking flow, state machine, capacity management, ticket issuance, rate limiting, scanner auth, conversations, storage.
- Depends on: `src/lib/db.ts`, `src/models`, `mongodb`, crypto, provider adapters.
- Used by: `src/app/api/**/route.ts` and tests in `src/lib/*.test.ts`.
- Purpose: Normalize payment checkout and webhook handling across providers.
- Location: `src/lib/payments`
- Contains: `PaymentGatewayAdapter` contract and Stripe, Razorpay, PayPal, Cashfree adapters.
- Depends on: provider SDKs or HTTP APIs, decrypted tenant credentials from `src/lib/credentialCrypto.ts`.
- Used by: `src/app/api/bot/booking/[sessionId]/message/route.ts`, `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`.
- Purpose: Build chatbot responses from embeddings, vector search, and LLM generation.
- Location: `src/ai`, `src/lib/embeddings.ts`, `src/lib/vectorStore.ts`
- Contains: Genkit initialization, Genkit flows, Gemini embedding REST client, MongoDB Atlas vector store helpers.
- Depends on: Genkit, Google GenAI, Groq SDK in `src/app/api/chat/route.ts`, MongoDB Atlas vector search.
- Used by: `src/app/api/chat/route.ts`, `src/ai/flows/ai-response-generation.ts`, PDF and knowledge ingestion routes.
- Purpose: Type MongoDB documents and domain state.
- Location: `src/models`
- Contains: TypeScript interfaces for bookings, sessions, conversations, events, fields, payment configs, tickets.
- Depends on: `mongodb` `ObjectId`.
- Used by: API routes, `src/lib`, and tests.

## Data Flow

### Authenticated Dashboard Event Management

### Embedded Chat and RAG

### Conversational Booking Flow

### AI Flow Development

- Server-side persistence is MongoDB collections reached through `src/lib/db.ts`.
- Client-side page state uses React hooks inside client components such as `src/app/page.tsx`, `src/app/bot/page.tsx`, and `src/app/dashboard/events/page.tsx`.
- Auth state is an HTTP-only `token` cookie created by auth routes and read through `getUserIdFromCookie()` in `src/lib/auth.ts`.
- Booking conversation state is persisted in Mongo documents and modeled with `ConversationState` in `src/models/Booking.ts`.

## Key Abstractions

- Purpose: Each `route.ts` is the HTTP adapter for one resource/action.
- Examples: `src/app/api/events/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/chat/route.ts`.
- Pattern: Export HTTP verb functions such as `GET`, `POST`, `PATCH`, `DELETE`, and return `NextResponse`.
- Purpose: Centralize Mongo client creation and database selection.
- Examples: `src/lib/db.ts`.
- Pattern: Call `getDb()` in server-only code; do not create ad hoc `MongoClient` instances elsewhere.
- Purpose: Type persisted domain records without adding runtime ORM behavior.
- Examples: `src/models/Event.ts`, `src/models/Booking.ts`, `src/models/Ticket.ts`.
- Pattern: Import model types into route handlers and `src/lib` helpers for explicit document shapes.
- Purpose: Keep booking transitions testable and independent of HTTP.
- Examples: `src/lib/bookingStateMachine.ts`, `src/lib/bookingFlow.ts`, tests in `src/lib/bookingStateMachine.test.ts` and `src/lib/bookingFlow.test.ts`.
- Pattern: Pure state transition helpers return next state/update objects; route handlers persist the result.
- Purpose: Give all payment providers the same checkout and webhook interface.
- Examples: `src/lib/payments/adapter.ts`, `src/lib/payments/stripe.ts`, `src/lib/payments/razorpay.ts`.
- Pattern: Add providers by implementing the adapter and registering it in route-level provider maps.
- Purpose: Manage MongoDB Atlas vector collections and vector search.
- Examples: `src/lib/vectorStore.ts`.
- Pattern: Use `replaceKnowledgeChunks()`, `insertPdfChunks()`, `searchKnowledgeChunks()`, and `searchPdfChunks()` rather than duplicating `$vectorSearch` pipelines.

## Entry Points

- Location: `src/app/layout.tsx`
- Triggers: All App Router requests.
- Responsibilities: Metadata, fonts, global providers/widgets, analytics.
- Location: `src/app/page.tsx`
- Triggers: Browser request to `/`.
- Responsibilities: Product landing composition, reset success toast, newsletter modal.
- Location: `src/app/dashboard/layout.tsx`
- Triggers: Browser requests under `/dashboard`.
- Responsibilities: Server-side auth gate, user lookup, dashboard shell rendering.
- Location: `src/app/api/**/route.ts`
- Triggers: Browser fetches, embedded widget requests, payment webhooks, scanner clients.
- Responsibilities: Validation, auth, domain orchestration, JSON/webhook responses.
- Location: `src/app/bot/page.tsx`, `public/embed.js`
- Triggers: Iframe/script embedding or direct `/bot` visits.
- Responsibilities: Chat UI, bot customization fetch, `/api/chat` calls.
- Location: `src/ai/dev.ts`
- Triggers: `npm run genkit:dev` or `npm run genkit:watch`.
- Responsibilities: Load AI flow definitions for local Genkit development.
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

### Duplicating Business Rules Inside Pages

### Creating Provider-Specific Payment Logic In Routes Without Adapter Support

## Error Handling

- Return `NextResponse.json({ error: "..." }, { status })` from API routes such as `src/app/api/auth/login/route.ts` and `src/app/api/events/route.ts`.
- Guard unauthenticated dashboard/API access with `getUserIdFromCookie()` and 401/redirect behavior in `src/app/dashboard/layout.tsx` and protected API routes.
- Use `try/catch` around provider calls and database mutations in webhook and booking routes.
- Use idempotency for payment webhook events through `processed_webhooks` in `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`.
- Use atomic `findOneAndUpdate` calls for capacity and booking state in `src/lib/eventCapacity.ts` and booking/payment routes.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `$gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `$gsd-debug` for investigation and bug fixing
- `$gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `$gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
