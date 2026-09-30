---
last_mapped_commit: e566539034890af2cc1da4196897f16e95975860
last_mapped_at: 2026-09-30
---
# Coding Conventions

**Analysis Date:** 2026-09-30

## Naming Patterns

**Files:**
- Use Next.js App Router filenames for routes and pages: `src/app/api/auth/login/route.ts`, `src/app/dashboard/events/[id]/page.tsx`.
- Use camelCase for business logic and helper modules: `src/lib/bookingFlow.ts`, `src/lib/bookingStateMachine.ts`, `src/lib/eventCapacity.ts`, `src/lib/ticketIssuance.ts`.
- Use PascalCase for model interface files that export domain types: `src/models/Booking.ts`, `src/models/Event.ts`, `src/models/EventFormField.ts`, `src/models/Ticket.ts`.
- Use lowercase kebab-case for shared UI component files: `src/components/ui/alert-dialog.tsx`, `src/components/ui/color-picker.tsx`, `src/components/ui/contact-card.tsx`.
- Co-locate tests beside the implementation with `.test.ts`: `src/lib/bookingFlow.test.ts`, `src/lib/eventCapacity.test.ts`.

**Functions:**
- Use camelCase for exported functions and helpers: `processBookingMessage` in `src/lib/bookingFlow.ts`, `getNextState` in `src/lib/bookingStateMachine.ts`, `reserveCapacity` and `reconcileExpiredHold` in `src/lib/eventCapacity.ts`.
- Use uppercase HTTP method exports for Next API handlers: `POST` in `src/app/api/auth/login/route.ts`, `GET`/`POST` patterns in `src/app/api/events/route.ts`.
- Use small local factory/helper names in tests: `makeEvent`, `makeField`, `makeBooking` in `src/lib/bookingFlow.test.ts`, `ctx` in `src/lib/bookingStateMachine.test.ts`.

**Variables:**
- Use camelCase for local variables and request data: `current_field_index` is destructured from persisted state, while locals like `nextFieldIndex`, `nextAttendeeIndex`, and `updatedResponses` are camelCase in `src/lib/bookingFlow.ts`.
- Preserve snake_case for persisted MongoDB/domain fields that mirror document shape: `conversation_state`, `session_context`, `form_responses`, `tickets_sold`, and `tickets_held` in `src/models/Booking.ts` and `src/lib/eventCapacity.ts`.
- Use `UPPER_CASE` for module constants that represent environment-backed secrets or fixed config: `QR_SECRET` in `src/lib/ticketIssuance.test.ts`.

**Types:**
- Use PascalCase for interfaces and exported type aliases: `Booking`, `BookingStatus`, `BookingSessionContext`, and `BookingFormResponses` in `src/models/Booking.ts`.
- Prefer explicit return types on exported async/test-support functions where state matters: `startTestMongo(): Promise<void>` and `mongoUri(): string` in `src/test/mongo-setup.ts`.
- Use `Partial<T>` for test fixture overrides: `makeEvent(overrides: Partial<Event> = {})` in `src/lib/bookingFlow.test.ts`.

## Code Style

**Formatting:**
- No Prettier config is detected; use the existing local style in the edited file.
- Indent with two spaces in TypeScript and TSX files, as shown in `src/lib/bookingFlow.ts`, `src/components/ui/button.tsx`, and `src/lib/eventCapacity.test.ts`.
- The repo contains both single-quote/semicolon style (`src/lib/db.ts`, `src/app/api/auth/login/route.ts`) and double-quote/trailing-comma style (`src/components/ui/button.tsx`, `src/lib/bookingFlow.test.ts`). Match the surrounding file style when editing.
- Keep object literals and Mongo update documents multiline once they contain nested structures, as in `src/lib/eventCapacity.ts` and `src/app/api/events/route.ts`.

**Linting:**
- `package.json` exposes `npm run lint`, which maps to `next lint`.
- No standalone `.eslintrc*`, `eslint.config.*`, `biome.json`, or `.prettierrc*` file is detected.
- TypeScript strict mode is enabled in `tsconfig.json`; treat `npm run typecheck` as the reliable static quality gate.
- `src/lib/db.ts` uses targeted eslint comments for global declarations; keep lint suppressions narrow and next to the line they justify.

## Import Organization

**Order:**
1. External packages first: `vitest`, `mongodb`, `next/server`, `bcryptjs`, `@radix-ui/react-slot`.
2. Internal alias imports from `@/`: `@/lib/db`, `@/models/Booking`, `@/lib/utils`.
3. Relative imports for same-layer helpers: `./db` in `src/lib/eventCapacity.ts`, `./bookingStateMachine` in `src/lib/bookingFlow.ts`.

**Path Aliases:**
- Use `@/*` for files under `src/*`; the alias is configured in `tsconfig.json` and `vitest.config.ts`.
- Use `@/lib/...` for shared helpers, `@/models/...` for domain types, and `@/test/...` for test infrastructure such as `src/test/mongo-setup.ts`.
- Use relative imports when the imported module is a sibling in the same folder and the file already follows that style, such as `src/lib/eventCapacity.ts`.

## Error Handling

**Patterns:**
- API routes use early validation returns with `NextResponse.json({ error: "..." }, { status })`, as in `src/app/api/auth/login/route.ts` and `src/app/api/events/route.ts`.
- Wrap route bodies that touch I/O in `try`/`catch`; log the server-side detail and return a generic client-safe error for 500 responses, as in `src/app/api/auth/login/route.ts`.
- Throw `Error` for missing critical environment/configuration state in lower-level helpers: `src/lib/db.ts`, `src/lib/embeddings.ts`, `src/lib/credentialCrypto.ts`, and `src/lib/ticketIssuance.ts`.
- Domain helpers return `null` for expected business-rule denials such as unavailable capacity in `src/lib/eventCapacity.ts`; reserve thrown errors for invalid invariants and configuration failures.
- Conversational flow helpers return typed state-update objects rather than throwing for user input validation failures in `src/lib/bookingFlow.ts`.

## Logging

**Framework:** console

**Patterns:**
- Use contextual log prefixes for API/server errors: `[scanner_scan_single]`, `[events_post]`, `[analytics]`, and `[mailer]` patterns appear across `src/app/api/**/route.ts` and `src/lib/mailer.ts`.
- Use `console.error` in `catch` blocks before returning generic API errors, as in `src/app/api/auth/login/route.ts`.
- Use `console.warn` for recoverable or suspicious conditions, as in payment webhook and scanner sync routes under `src/app/api/payments/**` and `src/app/api/scanner/**`.
- Avoid logging secrets or credential values. `.env` is present and must only be referenced by variable name, never read or quoted.

## Comments

**When to Comment:**
- Add comments for non-obvious state-machine transitions, idempotency behavior, atomic MongoDB operations, and test setup constraints.
- Keep comments close to the code they explain, such as the fixed MongoMemoryServer port note in `src/test/mongo-setup.ts` and the no-op helper comment in `src/lib/bookingFlow.ts`.
- Do not comment straightforward assignments or obvious JSX structure.

**JSDoc/TSDoc:**
- Use file-level or exported-symbol JSDoc for business flows and domain helpers: `src/lib/bookingFlow.ts`, `src/lib/eventCapacity.ts`, and `src/models/Booking.ts`.
- Use JSDoc when an exported function has lifecycle requirements, such as calling `startTestMongo` before importing DB consumers in `src/test/mongo-setup.ts`.

## Function Design

**Size:** Keep pure business helpers focused around one transition or operation. `src/lib/bookingFlow.ts` splits `processBookingMessage` into `handleQuantityInput`, `handleFieldInput`, `handleReviewInput`, `noChange`, `validateInput`, and `getNextQuestion`.

**Parameters:** Pass explicit domain objects and primitive context rather than reaching into global state for pure logic. `processBookingMessage(message, booking, event, fields)` in `src/lib/bookingFlow.ts` is the model for deterministic logic.

**Return Values:** Return typed objects for state transitions, `null` for expected no-match outcomes, and booleans for reconciliation success. Examples: `BookingFlowUpdate` in `src/lib/bookingFlow.ts`, `null` from `placeHold` in `src/lib/eventCapacity.ts`, and `Promise<boolean>` from `reconcileExpiredHold` in `src/lib/eventCapacity.ts`.

## Module Design

**Exports:** Prefer named exports for reusable functions and types. Examples include `Button` and `buttonVariants` in `src/components/ui/button.tsx`, `getDb` in `src/lib/db.ts`, and `Booking` types in `src/models/Booking.ts`.

**Barrel Files:** No broad barrel export pattern is detected. Import concrete modules directly by path, such as `@/lib/bookingFlow` or `@/models/Event`.

---

*Convention analysis: 2026-09-30*
