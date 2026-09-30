---
last_mapped_commit: e566539034890af2cc1da4196897f16e95975860
last_mapped_at: 2026-09-30
---
# Testing Patterns

**Analysis Date:** 2026-09-30

## Test Framework

**Runner:**
- Vitest `^3.2.7`
- Config: `vitest.config.ts`
- Test include pattern: `src/**/*.test.ts`
- Environment: `node`
- Globals: disabled (`globals: false`), so import `describe`, `it`, `expect`, and hooks from `vitest`.
- Parallelism: disabled at file level (`fileParallelism: false`) to support shared MongoMemoryServer state and fixed-port database tests.

**Assertion Library:**
- Vitest `expect`

**Run Commands:**

```bash
npm test              # Run all tests via vitest run
npx vitest            # Watch/interactive mode when needed
npx vitest run --coverage  # Coverage if a coverage provider is installed/configured
```

## Test File Organization

**Location:**
- Tests are co-located with implementation under `src/lib`.
- Current project tests: `src/lib/bookingFlow.test.ts`, `src/lib/bookingStateMachine.test.ts`, `src/lib/eventCapacity.test.ts`, `src/lib/ticketIssuance.test.ts`.
- Shared test infrastructure lives under `src/test`, currently `src/test/mongo-setup.ts`.

**Naming:**
- Use `[module].test.ts` for TypeScript tests.
- Match the implementation file basename: `src/lib/bookingFlow.ts` has `src/lib/bookingFlow.test.ts`.

**Structure:**

```text
src/
├── lib/
│   ├── bookingFlow.ts
│   ├── bookingFlow.test.ts
│   ├── eventCapacity.ts
│   └── eventCapacity.test.ts
└── test/
    └── mongo-setup.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect } from "vitest";
import { processBookingMessage } from "@/lib/bookingFlow";

describe("processBookingMessage: collecting_quantity", () => {
  it("rejects non-numeric input", () => {
    const update = processBookingMessage("abc", makeBooking(), makeEvent(), fields);
    expect(update.conversation_state).toBe("collecting_quantity");
    expect(update.bot_reply).toMatch(/valid number/i);
  });
});
```

**Patterns:**
- Group tests by public function and state/behavior branch, as in `src/lib/bookingFlow.test.ts`.
- Use nested `describe` blocks for state-machine source states, as in `src/lib/bookingStateMachine.test.ts`.
- Use table tests with `it.each` for equivalent inputs, such as affirmative and negative review words in `src/lib/bookingFlow.test.ts`.
- Assert both return values and persisted side effects for database-backed helpers, as in `src/lib/eventCapacity.test.ts` and `src/lib/ticketIssuance.test.ts`.
- Use `rejects.toThrow()` for expected thrown errors, as in the defensive booking `_id` case in `src/lib/ticketIssuance.test.ts`.

## Mocking

**Framework:** Vitest mocking APIs are available, but current tests primarily use real pure functions and MongoMemoryServer instead of `vi.mock`.

**Patterns:**

```typescript
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

beforeAll(async () => {
  await startTestMongo();
});

afterAll(async () => {
  await stopTestMongo();
});
```

**What to Mock:**
- Prefer fixture objects for domain data instead of mocking pure helpers. Examples: `makeEvent`, `makeField`, and `makeBooking` in `src/lib/bookingFlow.test.ts`.
- Use MongoMemoryServer for code that depends on MongoDB through `src/lib/db.ts`, as in `src/lib/eventCapacity.test.ts` and `src/lib/ticketIssuance.test.ts`.
- Mock external network/payment/AI clients when adding tests for modules under `src/lib/payments`, `src/lib/embeddings.ts`, `src/ai/flows`, or API routes that call external services.

**What NOT to Mock:**
- Do not mock the state machine when testing `src/lib/bookingFlow.ts`; tests should verify the integrated deterministic transition behavior.
- Do not mock `src/lib/db.ts` for integration coverage of atomic MongoDB update logic in `src/lib/eventCapacity.ts` and ticket persistence in `src/lib/ticketIssuance.ts`.
- Do not mock simple validation branches; exercise them directly with input strings and fixture fields.

## Fixtures and Factories

**Test Data:**

```typescript
function ctx(partial: Partial<BookingContext>): BookingContext {
  return {
    field_count: 0,
    current_field_index: 0,
    current_attendee_index: 0,
    quantity: 1,
    ...partial,
  };
}
```

**Location:**
- Keep small, module-specific fixture factories in the test file that uses them, as in `src/lib/bookingFlow.test.ts` and `src/lib/bookingStateMachine.test.ts`.
- Keep cross-test infrastructure in `src/test`, as with `src/test/mongo-setup.ts`.
- For Mongo integration tests, create records through helpers inside the test file, such as `insertEvent` and `getEvent` in `src/lib/eventCapacity.test.ts`.
- Use `Partial<T>` overrides to keep fixture defaults clear and targeted.

## Coverage

**Requirements:** None enforced in `package.json` or `vitest.config.ts`.

**View Coverage:**

```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Pure deterministic logic is covered with direct function calls and fixture data.
- Examples: `src/lib/bookingStateMachine.test.ts` for `getNextState` and `src/lib/bookingFlow.test.ts` for `processBookingMessage`.

**Integration Tests:**
- MongoDB integration tests use `mongodb-memory-server` through `src/test/mongo-setup.ts`.
- Examples: `src/lib/eventCapacity.test.ts` verifies atomic capacity updates, and `src/lib/ticketIssuance.test.ts` verifies persisted ticket creation and idempotency.
- `vitest.config.ts` sets `hookTimeout: 120_000`, `testTimeout: 30_000`, and `fileParallelism: false` for these tests.

**E2E Tests:**
- Not used. No Playwright, Cypress, or browser E2E config is detected.

## Common Patterns

**Async Testing:**

```typescript
it("expires a stale awaiting_payment booking and releases its hold", async () => {
  const db = await getDb();
  const expired = await reconcileExpiredHold(insertedId);
  expect(expired).toBe(true);

  const updated = await db.collection("bookings").findOne({ _id: insertedId });
  expect(updated!.status).toBe("expired");
});
```

**Error Testing:**

```typescript
it("rejects bookings with no _id (defensive)", async () => {
  const booking: IssuableBooking = { event_id: new ObjectId(), quantity: 1, _id: undefined };
  await expect(issueTicketsForBooking(booking)).rejects.toThrow();
});
```

---

*Testing analysis: 2026-09-30*
