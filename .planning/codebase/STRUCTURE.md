---
last_mapped_commit: e566539034890af2cc1da4196897f16e95975860
last_mapped_at: 2026-09-30
---
# Codebase Structure

**Analysis Date:** 2026-09-30

## Directory Layout

```text
Noch_bot/
├── .planning/              # GSD planning artifacts and generated codebase maps
├── docs/                   # Project documentation and review documents
├── public/                 # Static assets and embeddable browser script
├── src/
│   ├── ai/                 # Genkit setup and AI flow definitions
│   ├── app/                # Next.js App Router pages, layouts, API routes, metadata
│   ├── components/         # Shared React components and UI primitives
│   ├── hooks/              # Shared client React hooks
│   ├── lib/                # Server/domain/infrastructure helpers and focused tests
│   ├── models/             # TypeScript document and domain models
│   └── test/               # Test infrastructure helpers
├── apphosting.yaml         # Firebase/App Hosting configuration
├── components.json         # Shadcn-style UI component configuration
├── next.config.ts          # Next.js build and image configuration
├── package.json            # npm scripts and dependencies
├── tailwind.config.ts      # Tailwind theme/configuration
├── tsconfig.json           # TypeScript compiler options and `@/*` alias
└── vitest.config.ts        # Vitest configuration
```

## Directory Purposes

**`src/app`:**
- Purpose: Own all Next.js route segments, pages, layouts, route handlers, metadata, and global CSS.
- Contains: Public pages, auth pages, dashboard routes, booking routes, PDF chat routes, API route handlers.
- Key files: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/dashboard/layout.tsx`, `src/app/api/**/route.ts`.

**`src/app/api`:**
- Purpose: HTTP API boundary for browser clients, embedded widgets, scanner clients, AI chat, uploads, and payment providers.
- Contains: Resource/action directories with `route.ts` handlers.
- Key files: `src/app/api/chat/route.ts`, `src/app/api/events/route.ts`, `src/app/api/events/[id]/route.ts`, `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`.

**`src/app/dashboard`:**
- Purpose: Authenticated organization/user dashboard.
- Contains: Account, analytics, configuration, embed, event, history, PDF, and PDF analytics pages.
- Key files: `src/app/dashboard/layout.tsx`, `src/app/dashboard/events/page.tsx`, `src/app/dashboard/events/[id]/page.tsx`, `src/app/dashboard/configure/page.tsx`.

**`src/app/booking`:**
- Purpose: Public booking follow-up screens after booking/payment actions.
- Contains: Cancel, success, pay, and ticket pages.
- Key files: `src/app/booking/success/page.tsx`, `src/app/booking/cancel/page.tsx`, `src/app/booking/pay/[bookingId]/page.tsx`, `src/app/booking/ticket/[bookingId]/page.tsx`.

**`src/app/bot`:**
- Purpose: Standalone embedded chatbot page.
- Contains: Client chat UI and `/api/chat` integration.
- Key files: `src/app/bot/page.tsx`.

**`src/app/pdf-chat`:**
- Purpose: Public PDF chat experience by slug.
- Contains: Dynamic route page for PDF chatbot links.
- Key files: `src/app/pdf-chat/[slug]/page.tsx`.

**`src/ai`:**
- Purpose: Genkit configuration and AI flow declarations.
- Contains: Genkit runtime setup, dev loader, flow modules.
- Key files: `src/ai/genkit.ts`, `src/ai/dev.ts`, `src/ai/flows/ai-response-generation.ts`, `src/ai/flows/bot-knowledge-base-creation-flow.ts`, `src/ai/flows/bot-persona-customization.ts`.

**`src/components`:**
- Purpose: Shared app and landing React components.
- Contains: Landing sections, navigation, footer, ticket preview, cookie components.
- Key files: `src/components/Hero.tsx`, `src/components/Features.tsx`, `src/components/ContactSection.tsx`, `src/components/TicketPreview.tsx`, `src/components/Nav.tsx`.

**`src/components/ui`:**
- Purpose: Reusable UI primitives and composed UI widgets.
- Contains: Radix/shadcn-style primitives, dashboard shell, modals, chart/table controls, visual sections.
- Key files: `src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/form.tsx`, `src/components/ui/dashboard-with-collapsible-sidebar.tsx`, `src/components/ui/toaster.tsx`.

**`src/hooks`:**
- Purpose: Client-side reusable React hooks.
- Contains: Device, motion, theme, and toast state helpers.
- Key files: `src/hooks/use-mobile.tsx`, `src/hooks/use-reduced-motion.ts`, `src/hooks/use-theme.ts`, `src/hooks/use-toast.ts`.

**`src/lib`:**
- Purpose: Shared business logic, infrastructure, integrations, data access helpers, and focused tests.
- Contains: MongoDB connection, storage helpers, auth helpers, booking state logic, ticket issuance, AI/vector helpers, PDF parsing, rate limits, scanner auth, tests.
- Key files: `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/storage.ts`, `src/lib/bookingFlow.ts`, `src/lib/eventCapacity.ts`, `src/lib/ticketIssuance.ts`, `src/lib/vectorStore.ts`.

**`src/lib/payments`:**
- Purpose: Provider-independent payment integration layer.
- Contains: Payment adapter contract and provider implementations.
- Key files: `src/lib/payments/adapter.ts`, `src/lib/payments/stripe.ts`, `src/lib/payments/razorpay.ts`, `src/lib/payments/paypal.ts`, `src/lib/payments/cashfree.ts`, `src/lib/payments/processWebhookResult.ts`.

**`src/models`:**
- Purpose: TypeScript types for persisted MongoDB documents and domain states.
- Contains: Booking, event, conversation, payment gateway, ticket, staff, and webhook models.
- Key files: `src/models/Booking.ts`, `src/models/Event.ts`, `src/models/EventFormField.ts`, `src/models/Ticket.ts`, `src/models/PaymentGatewayConfig.ts`.

**`src/test`:**
- Purpose: Test support code.
- Contains: MongoDB memory server setup for Vitest.
- Key files: `src/test/mongo-setup.ts`.

**`public`:**
- Purpose: Static files served from the web root.
- Contains: Embeddable widget script, images, video, SVG assets.
- Key files: `public/embed.js`, `public/nohbot.png`, `public/Noch-bot-logo.svg`, `public/Final_Video.mp4`.

**`docs`:**
- Purpose: Human-readable project documentation.
- Contains: Blueprint/review artifacts.
- Key files: `docs/blueprint.md`, `docs/NochBot_Atlas_Migration_Review.docx`.

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root App Router layout and metadata.
- `src/app/page.tsx`: Public landing page.
- `src/app/dashboard/layout.tsx`: Authenticated dashboard shell.
- `src/app/bot/page.tsx`: Standalone embeddable bot page.
- `src/ai/dev.ts`: Genkit dev entry point.
- `public/embed.js`: Static embed script entry point for external sites.

**Configuration:**
- `package.json`: npm scripts and dependency declarations.
- `tsconfig.json`: TypeScript settings and `@/*` alias to `src/*`.
- `next.config.ts`: Next.js config, build tolerance settings, remote image patterns.
- `tailwind.config.ts`: Tailwind theme setup.
- `components.json`: UI primitive generation/config source.
- `vitest.config.ts`: Test runner configuration.
- `apphosting.yaml`: Hosting configuration.
- `.env`: Environment configuration file present; do not read or quote contents.
- `env.txt`: Environment-related file present; treat as sensitive configuration material unless reviewed by the project owner.

**Core Logic:**
- `src/lib/db.ts`: MongoDB client/database access.
- `src/lib/auth.ts`: JWT cookie auth helpers.
- `src/lib/storage.ts`: Account, knowledge, and analytics persistence helpers.
- `src/lib/bookingFlow.ts`: Conversational booking message processing.
- `src/lib/bookingStateMachine.ts`: Pure booking state transitions.
- `src/lib/eventCapacity.ts`: Atomic capacity reservations, holds, confirmations, releases, and hold reconciliation.
- `src/lib/ticketIssuance.ts`: Idempotent ticket generation and QR payload hashing.
- `src/lib/vectorStore.ts`: MongoDB Atlas vector store setup and search.
- `src/lib/embeddings.ts`: Gemini embedding client.
- `src/lib/conversations.ts`: Chat conversation persistence.
- `src/lib/ratelimit.ts`: Plan-based chat rate limiting.
- `src/lib/credentialCrypto.ts`: Credential encryption/decryption helpers.

**API Resources:**
- `src/app/api/auth/**/route.ts`: Register, login, logout, user lookup, password reset, OTP, Google auth.
- `src/app/api/account/**/route.ts`: Account update and password change.
- `src/app/api/events/**/route.ts`: Event CRUD, publishing, form fields, booking lists, ticket design, scanner staff, payment gateway config.
- `src/app/api/embed/**/route.ts`: Public embed booking/event endpoints.
- `src/app/api/bot/booking/**/route.ts`: Bot-driven booking sessions and messages.
- `src/app/api/chat/route.ts`: Main RAG chatbot endpoint.
- `src/app/api/ingest/pdf/route.ts`: PDF ingestion endpoint.
- `src/app/api/pdf-analytics/**/route.ts`: PDF analytics endpoints.
- `src/app/api/payments/webhook/**/route.ts`: Payment provider webhook endpoints.
- `src/app/api/scanner/**/route.ts`: Ticket scanner sync and scan endpoints.
- `src/app/api/imagekit/**/route.ts` and `src/app/api/images/auth/route.ts`: Image upload/auth endpoints.

**Testing:**
- `src/lib/bookingFlow.test.ts`: Booking flow behavior tests.
- `src/lib/bookingStateMachine.test.ts`: Booking state machine tests.
- `src/lib/eventCapacity.test.ts`: Capacity mutation tests with Mongo memory server.
- `src/lib/ticketIssuance.test.ts`: Ticket issuance tests.
- `src/test/mongo-setup.ts`: Mongo memory server lifecycle helper.

## Naming Conventions

**Files:**
- App Router pages use `page.tsx`: `src/app/dashboard/events/page.tsx`.
- App Router layouts use `layout.tsx`: `src/app/dashboard/layout.tsx`.
- API handlers use `route.ts`: `src/app/api/events/route.ts`.
- Dynamic route folders use bracket names: `src/app/api/events/[id]/route.ts`, `src/app/booking/pay/[bookingId]/page.tsx`.
- React components outside `ui` mostly use PascalCase filenames: `src/components/Hero.tsx`, `src/components/TicketPreview.tsx`.
- UI primitive files use kebab-case or lower-case names: `src/components/ui/alert-dialog.tsx`, `src/components/ui/button.tsx`.
- Hooks use `use-*` filenames and exported hook names: `src/hooks/use-toast.ts`, `src/hooks/use-reduced-motion.ts`.
- Domain helpers use camelCase filenames: `src/lib/bookingFlow.ts`, `src/lib/eventCapacity.ts`, `src/lib/ticketIssuance.ts`.
- Tests are colocated beside library code with `.test.ts`: `src/lib/eventCapacity.test.ts`.
- Models use PascalCase singular domain names: `src/models/Event.ts`, `src/models/Booking.ts`.

**Directories:**
- Feature route directories use lowercase kebab-case: `src/app/forgot-password`, `src/app/pdf-chat`, `src/app/reset-password`.
- Resource API directories use resource/action names: `src/app/api/events`, `src/app/api/auth/login`, `src/app/api/payments/webhook`.
- Shared components live flat in `src/components` unless they are primitive/composed UI building blocks under `src/components/ui`.

## Where to Add New Code

**New Public Page:**
- Primary code: `src/app/<route>/page.tsx`
- Shared UI: `src/components/<ComponentName>.tsx` or `src/components/ui/<component-name>.tsx`
- Server API support: `src/app/api/<resource>/route.ts`

**New Dashboard Feature:**
- Primary page: `src/app/dashboard/<feature>/page.tsx`
- Protected API: `src/app/api/<resource>/route.ts` and dynamic subroutes as needed.
- Shared domain logic: `src/lib/<feature>.ts`
- Types: `src/models/<DomainName>.ts`
- Tests: `src/lib/<feature>.test.ts` when logic is deterministic or mutates persistence.

**New API Resource:**
- Collection route: `src/app/api/<resource>/route.ts`
- Item route: `src/app/api/<resource>/[id]/route.ts`
- Auth: call `getUserIdFromCookie()` from `src/lib/auth.ts` for tenant/user-owned resources.
- Data access: call `getDb()` from `src/lib/db.ts`; place reusable collection logic in `src/lib/<resource>.ts` when used by multiple routes.
- Types: add or extend `src/models/<DomainName>.ts`.

**New Booking Behavior:**
- Conversation rules: `src/lib/bookingFlow.ts`
- State transitions: `src/lib/bookingStateMachine.ts`
- Capacity/ticket side effects: `src/lib/eventCapacity.ts`, `src/lib/ticketIssuance.ts`
- Bot route orchestration: `src/app/api/bot/booking/[sessionId]/message/route.ts`
- Tests: `src/lib/bookingFlow.test.ts`, `src/lib/bookingStateMachine.test.ts`, or a new focused test in `src/lib`.

**New Payment Provider:**
- Adapter implementation: `src/lib/payments/<provider>.ts`
- Shared contract: `src/lib/payments/adapter.ts`
- Provider registration: `src/app/api/payments/webhook/[provider]/[orgId]/route.ts` and booking payment initiation routes that use `providerAdapters`.
- Tenant config model: `src/models/PaymentGatewayConfig.ts`.

**New AI/RAG Capability:**
- Genkit flow: `src/ai/flows/<flow-name>.ts`
- Flow registration for local dev: `src/ai/dev.ts`
- Embedding/vector persistence: reuse `src/lib/embeddings.ts` and `src/lib/vectorStore.ts`.
- API endpoint: `src/app/api/<feature>/route.ts`.

**New UI Primitive:**
- Implementation: `src/components/ui/<primitive-name>.tsx`
- Use `cn()` from `src/lib/utils.ts` for class merging.
- Compose primitives in pages/components rather than duplicating Radix/Tailwind boilerplate.

**New Landing Section:**
- Component: `src/components/<SectionName>.tsx`
- Page composition: `src/app/page.tsx`
- Shared visual primitive only if reused: `src/components/ui/<component-name>.tsx`

**Utilities:**
- Shared server/domain helpers: `src/lib/<helper>.ts`
- Shared client hooks: `src/hooks/use-<name>.ts`
- Cross-cutting UI helpers: `src/lib/utils.ts`
- Test infrastructure: `src/test/<helper>.ts`

## Special Directories

**`.planning`:**
- Purpose: GSD planning and codebase mapping output.
- Generated: Yes
- Committed: Project-dependent; mapper writes requested docs to `src`-external planning files.

**`.next`:**
- Purpose: Next.js build/cache output.
- Generated: Yes
- Committed: No

**`node_modules`:**
- Purpose: npm dependency install directory.
- Generated: Yes
- Committed: No

**`.dist`:**
- Purpose: Build/distribution artifact directory.
- Generated: Yes
- Committed: Project-dependent; inspect before modifying.

**`.idx`:**
- Purpose: IDX/dev environment configuration and assets.
- Generated: No
- Committed: Project-dependent.

**`public`:**
- Purpose: Static runtime assets and embed script.
- Generated: Mixed; assets are runtime inputs.
- Committed: Yes

**`src/app/api`:**
- Purpose: Server-only route handlers.
- Generated: No
- Committed: Yes

**`src/components/ui`:**
- Purpose: Shared UI primitives and composed widgets.
- Generated: Mixed; `components.json` suggests shadcn-style generated primitives that are then edited locally.
- Committed: Yes

---

*Structure analysis: 2026-09-30*
