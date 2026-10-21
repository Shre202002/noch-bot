import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { getDb } from "@/lib/db";
import {
  reserveCapacity,
  placeHold,
  confirmHold,
  releaseHold,
  reconcileExpiredHold,
  releaseExpiredHolds,
} from "@/lib/eventCapacity";
import { Event } from "@/models/Event";

let eventId: ObjectId;

async function getEvent(): Promise<Event> {
  const db = await getDb();
  return (await db.collection("events").findOne({ _id: eventId })) as unknown as Event;
}

async function insertEvent(overrides: Partial<Event> = {}): Promise<ObjectId> {
  const db = await getDb();
  const now = new Date();
  const event: Event = {
    _id: undefined,
    org_id: "org-1",
    name: "Capacity Test Event",
    description: "",
    start_at: now,
    end_at: new Date(now.getTime() + 86400_000),
    venue: null,
    capacity: 10,
    tickets_sold: 0,
    tickets_held: 0,
    status: "published",
    is_paid: false,
    price: null,
    currency: "INR",
    allow_group_booking: true,
    max_tickets_per_booking: null,
    ticket_template_id: "dark",
    logo_url: null,
    banner_url: null,
    chatbot_widget_id: new ObjectId(),
    created_at: now,
    updated_at: now,
    ...overrides,
  };
  const res = await db.collection("events").insertOne(event as any);
  return res.insertedId;
}

beforeAll(async () => {
  await startTestMongo();
  eventId = await insertEvent();
});

afterAll(async () => {
  await stopTestMongo();
});

describe("reserveCapacity (free events)", () => {
  it("increments tickets_sold when capacity allows", async () => {
    const result = await reserveCapacity(eventId, 3);
    expect(result).not.toBeNull();
    const event = await getEvent();
    expect(event.tickets_sold).toBe(3);
  });

  it("refuses to oversell: rejected calls leave tickets_sold untouched", async () => {
    // capacity 10, 3 already sold -> 7 left; asking for 8 must fail
    const result = await reserveCapacity(eventId, 8);
    expect(result).toBeNull();

    const event = await getEvent();
    expect(event.tickets_sold).toBe(3); // unchanged
  });

  it("sells the exact remaining capacity", async () => {
    const result = await reserveCapacity(eventId, 7);
    expect(result).not.toBeNull();
    const event = await getEvent();
    expect(event.tickets_sold).toBe(10);
  });
});

describe("placeHold / confirmHold / releaseHold (paid events)", () => {
  let holdEventId: ObjectId;

  beforeAll(async () => {
    holdEventId = await insertEvent({ is_paid: true, price: 100 });
  });

  it("places a hold and returns an expiry in the future", async () => {
    const result = await placeHold(holdEventId, 4);
    expect(result).not.toBeNull();
    expect(result!.hold_expires_at.getTime()).toBeGreaterThan(Date.now());

    const event = await getHoldEvent(holdEventId);
    expect(event.tickets_held).toBe(4);
    expect(event.tickets_sold).toBe(0);
  });

  it("refuses a hold larger than remaining capacity", async () => {
    // capacity 10, 4 held -> asking for 7 must fail
    const result = await placeHold(holdEventId, 7);
    expect(result).toBeNull();
    expect((await getHoldEvent(holdEventId)).tickets_held).toBe(4);
  });

  it("confirmHold converts held seats into sales", async () => {
    await confirmHold(holdEventId, 4);
    const event = await getHoldEvent(holdEventId);
    expect(event.tickets_sold).toBe(4);
    expect(event.tickets_held).toBe(0);
  });

  it("releaseHold decrements held seats but never below zero", async () => {
    await placeHold(holdEventId, 2);
    await releaseHold(holdEventId, 2);
    expect((await getHoldEvent(holdEventId)).tickets_held).toBe(0);

    // Releasing 5 when 0 held: guard should make this a no-op (document not matched)
    await releaseHold(holdEventId, 5);
    expect((await getHoldEvent(holdEventId)).tickets_held).toBe(0);
  });

  async function getHoldEvent(id: ObjectId): Promise<Event> {
    const db = await getDb();
    return (await db.collection("events").findOne({ _id: id })) as unknown as Event;
  }
});

describe("reconcileExpiredHold", () => {
  it("expires a stale awaiting_payment booking and releases its hold", async () => {
    const db = await getDb();
    const holdEventId = await insertEvent({ is_paid: true, price: 50 });
    await placeHold(holdEventId, 2);

    const now = new Date();
    const booking = {
      event_id: holdEventId,
      session_id: "sess-expired",
      status: "awaiting_payment" as const,
      quantity: 2,
      conversation_state: "awaiting_payment" as const,
      hold_expires_at: new Date(now.getTime() - 60_000), // already expired
      created_at: now,
      updated_at: now,
    };
    const { insertedId } = await db.collection("bookings").insertOne(booking as any);

    const expired = await reconcileExpiredHold(insertedId);
    expect(expired).toBe(true);

    const updated = await db.collection("bookings").findOne({ _id: insertedId });
    expect(updated!.status).toBe("expired");
    expect(updated!.conversation_state).toBe("expired");

    const event = await db.collection("events").findOne({ _id: holdEventId });
    expect(event!.tickets_held).toBe(0);
  });

  it("leaves a still-active hold alone", async () => {
    const db = await getDb();
    const holdEventId = await insertEvent({ is_paid: true, price: 50 });
    await placeHold(holdEventId, 1);

    const now = new Date();
    const { insertedId } = await db.collection("bookings").insertOne({
      event_id: holdEventId,
      session_id: "sess-active",
      status: "awaiting_payment",
      quantity: 1,
      conversation_state: "awaiting_payment",
      hold_expires_at: new Date(now.getTime() + 300_000), // still valid
      created_at: now,
      updated_at: now,
    } as any);

    const expired = await reconcileExpiredHold(insertedId);
    expect(expired).toBe(false);

    const booking = await db.collection("bookings").findOne({ _id: insertedId });
    expect(booking!.status).toBe("awaiting_payment");
  });
});

describe("releaseExpiredHolds", () => {
  it("releases expired holds from both booking flows and leaves active or hold-less bookings alone", async () => {
    const db = await getDb();
    const id = await insertEvent({ is_paid: true, price: 50, capacity: 20 });
    await placeHold(id, 2); // chat-bot hold (expired)
    await placeHold(id, 3); // widget hold (expired)
    await placeHold(id, 4); // widget hold (still active)
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 600_000);
    await db.collection("bookings").insertMany([
      { event_id: id, status: "awaiting_payment", quantity: 2, hold_expires_at: past },
      { event_id: id, status: "pending_payment", hold_placed: true, quantity: 3, expires_at: past },
      { event_id: id, status: "pending_payment", hold_placed: true, quantity: 4, expires_at: future },
      // Older widget booking that never held seats on the counters: must not be "released".
      { event_id: id, status: "pending_payment", quantity: 5, expires_at: past },
    ] as any[]);

    expect(await releaseExpiredHolds(id)).toBe(5);
    expect((await db.collection("events").findOne({ _id: id }))!.tickets_held).toBe(4);
    const statuses = (await db.collection("bookings").find({ event_id: id }).sort({ quantity: 1 }).toArray()).map((b) => b.status);
    expect(statuses).toEqual(["expired", "expired", "pending_payment", "pending_payment"]);

    // Running again releases nothing more.
    expect(await releaseExpiredHolds(id)).toBe(0);
    expect((await db.collection("events").findOne({ _id: id }))!.tickets_held).toBe(4);
  });
});
