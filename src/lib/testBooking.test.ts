import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { isOwnerTestRequest } from "@/lib/testBooking";

describe("isOwnerTestRequest", () => {
  it("is true only for the signed-in owner who asked for test mode", () => {
    expect(isOwnerTestRequest("org-1", "org-1", true)).toBe(true);
    expect(isOwnerTestRequest("org-1", "org-1", "1")).toBe(true);
    expect(isOwnerTestRequest("org-1", "org-1", "true")).toBe(true);
  });

  it("ignores the flag for everyone else", () => {
    expect(isOwnerTestRequest(null, "org-1", true)).toBe(false);
    expect(isOwnerTestRequest(undefined, "org-1", true)).toBe(false);
    expect(isOwnerTestRequest("org-2", "org-1", true)).toBe(false);
    expect(isOwnerTestRequest("org-1", null, true)).toBe(false);
    expect(isOwnerTestRequest("", "", true)).toBe(false);
  });

  it("needs the flag to be set", () => {
    expect(isOwnerTestRequest("org-1", "org-1", false)).toBe(false);
    expect(isOwnerTestRequest("org-1", "org-1", undefined)).toBe(false);
    expect(isOwnerTestRequest("org-1", "org-1", "0")).toBe(false);
    expect(isOwnerTestRequest("org-1", "org-1", "yes")).toBe(false);
  });
});

describe("test bookings in Mongo", () => {
  const ORG = "org-1";
  const OTHER = "org-2";
  let db: Db;
  let lib: typeof import("@/lib/testBooking");
  const future = () => new Date(Date.now() + 7 * 86400_000);

  beforeAll(async () => {
    await startTestMongo();
    const { getDb } = await import("@/lib/db");
    lib = await import("@/lib/testBooking");
    db = await getDb();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    for (const name of ["events", "event_form_fields", "bookings", "tickets", "booking_sessions", "payment_gateway_configs"]) {
      await db.collection(name).deleteMany({});
    }
  });

  const event = async (fields: Record<string, unknown> = {}, org = ORG) =>
    (
      await db.collection("events").insertOne({
        org_id: org,
        name: "Summit",
        description: "A day of talks",
        status: "draft",
        start_at: future(),
        end_at: new Date(future().getTime() + 3600_000),
        venue: "Hall",
        capacity: 10,
        tickets_sold: 0,
        tickets_held: 0,
        is_paid: false,
        price: null,
        currency: "INR",
        ticket_template_id: "dark",
        ticket_design_confirmed_at: new Date(),
        ...fields,
      })
    ).insertedId;
  const field = (eventId: ObjectId) =>
    db.collection("event_form_fields").insertOne({ event_id: eventId, label: "Name", field_key: "name", field_type: "text", order_index: 0 });
  const testBooking = async (eventId: ObjectId, fields: Record<string, unknown> = {}) =>
    (
      await db.collection("bookings").insertOne({
        org_id: ORG,
        event_id: eventId,
        visitor_id: "v1",
        is_test: true,
        status: "pending_payment",
        payment_status: "pending",
        quantity: 2,
        booking_code: "NBK-TEST",
        created_at: new Date(),
        updated_at: new Date(),
        ...fields,
      })
    ).insertedId;

  describe("testGate", () => {
    it("lets a complete draft be tested", async () => {
      const id = await event();
      await field(id);
      const gate = await lib.testGate(db, ORG, id);
      expect(gate.ok).toBe(true);
    });

    it("lets a published event be tested too", async () => {
      const id = await event({ status: "published" });
      await field(id);
      expect((await lib.testGate(db, ORG, id)).ok).toBe(true);
    });

    it("refuses an incomplete event and says what is missing", async () => {
      const id = await event({ ticket_design_confirmed_at: undefined, ticket_template_id: "default" });
      const gate = await lib.testGate(db, ORG, id);
      expect(gate.ok).toBe(false);
      if (gate.ok) return;
      expect(gate.status).toBe(409);
      expect(gate.missing?.map((m) => m.id)).toEqual(["fields", "design"]);
      expect(gate.error).toMatch(/Attendee form and Ticket design/);
    });

    it("needs an active payment gateway for a paid event", async () => {
      const id = await event({ is_paid: true, price: 500 });
      await field(id);
      const without = await lib.testGate(db, ORG, id);
      expect(without.ok).toBe(false);
      if (!without.ok) expect(without.missing?.map((m) => m.id)).toEqual(["payments"]);

      await db.collection("payment_gateway_configs").insertOne({ org_id: ORG, is_active: true, provider: "stripe" });
      expect((await lib.testGate(db, ORG, id)).ok).toBe(true);
    });

    it("does not find another organizer's event, or a closed one", async () => {
      const theirs = await event({}, OTHER);
      await field(theirs);
      expect(await lib.testGate(db, ORG, theirs)).toMatchObject({ ok: false, status: 404 });

      const closed = await event({ status: "closed" });
      await field(closed);
      expect(await lib.testGate(db, ORG, closed)).toMatchObject({ ok: false, status: 404 });
    });
  });

  describe("readyEventsForTest", () => {
    it("lists only this organizer's complete, upcoming events", async () => {
      const ready = await event({ name: "Ready" });
      await field(ready);
      await event({ name: "No form" });
      const theirs = await event({ name: "Theirs" }, OTHER);
      await field(theirs);
      const past = await event({ name: "Past", end_at: new Date(Date.now() - 1000) });
      await field(past);
      const closed = await event({ name: "Closed", status: "closed" });
      await field(closed);

      const names = (await lib.readyEventsForTest(db, ORG)).map((e) => e.name);
      expect(names).toEqual(["Ready"]);
    });

    it("is empty when there are no events", async () => {
      expect(await lib.readyEventsForTest(db, ORG)).toEqual([]);
    });
  });

  describe("testSummary", () => {
    it("reports readiness and how many test bookings exist", async () => {
      const id = await event();
      await field(id);
      await testBooking(id);
      await testBooking(id);
      expect(await lib.testSummary(db, ORG, id)).toEqual({ found: true, ready: true, missing: [], testCount: 2 });
    });

    it("reports what is missing, and not-found for someone else's event", async () => {
      const id = await event();
      const summary = await lib.testSummary(db, ORG, id);
      expect(summary).toMatchObject({ found: true, ready: false });
      expect(await lib.testSummary(db, OTHER, id)).toEqual({ found: false });
    });
  });

  describe("confirmTestBooking", () => {
    const setup = async () => {
      const eventId = await event({ is_paid: true, price: 500, tickets_sold: 3, tickets_held: 1 });
      const bookingId = await testBooking(eventId);
      await db.collection("booking_sessions").insertOne({ org_id: ORG, event_id: eventId, booking_id: bookingId, is_test: true, status: "checkout_pending" });
      const booking = (await db.collection("bookings").findOne({ _id: bookingId }))!;
      return { eventId, bookingId, booking };
    };

    it("confirms a paid test booking, issuing test tickets and leaving seat counts alone", async () => {
      const { eventId, bookingId, booking } = await setup();
      expect(await lib.confirmTestBooking(db, booking, "paid")).toBe("confirmed");

      const after = (await db.collection("bookings").findOne({ _id: bookingId }))!;
      expect(after).toMatchObject({ status: "confirmed", payment_status: "paid", payment_provider: "test" });
      expect(after.ticket_codes).toHaveLength(2);

      const tickets = await db.collection("tickets").find({ booking_id: bookingId }).toArray();
      expect(tickets).toHaveLength(2);
      expect(tickets.every((t) => t.is_test === true && t.status === "active")).toBe(true);

      expect(await db.collection("events").findOne({ _id: eventId })).toMatchObject({ tickets_sold: 3, tickets_held: 1 });
      expect(await db.collection("booking_sessions").findOne({ booking_id: bookingId })).toMatchObject({ status: "confirmed", current_step: "complete" });
    });

    it("is idempotent: a second confirmation issues nothing more", async () => {
      const { bookingId, booking } = await setup();
      await lib.confirmTestBooking(db, booking, "paid");
      expect(await lib.confirmTestBooking(db, booking, "paid")).toBe("unchanged");
      expect(await db.collection("tickets").countDocuments({ booking_id: bookingId })).toBe(2);
    });

    it("fails a test payment without issuing tickets", async () => {
      const { eventId, bookingId, booking } = await setup();
      expect(await lib.confirmTestBooking(db, booking, "failed")).toBe("failed");
      expect(await db.collection("bookings").findOne({ _id: bookingId })).toMatchObject({ status: "failed", payment_status: "failed" });
      expect(await db.collection("tickets").countDocuments({ booking_id: bookingId })).toBe(0);
      expect(await db.collection("events").findOne({ _id: eventId })).toMatchObject({ tickets_sold: 3, tickets_held: 1 });
      expect(await lib.confirmTestBooking(db, booking, "paid")).toBe("unchanged");
    });

    it("never touches a real booking", async () => {
      const eventId = await event();
      const real = await db.collection("bookings").insertOne({ org_id: ORG, event_id: eventId, status: "pending_payment", quantity: 1 });
      const booking = (await db.collection("bookings").findOne({ _id: real.insertedId }))!;
      expect(await lib.confirmTestBooking(db, booking, "paid")).toBe("not_test");
      expect(await db.collection("bookings").findOne({ _id: real.insertedId })).toMatchObject({ status: "pending_payment" });
      expect(await db.collection("tickets").countDocuments({})).toBe(0);
    });
  });

  describe("clearTestBookings", () => {
    it("removes this event's test bookings, tickets and sessions only", async () => {
      const mine = await event();
      const other = await event();
      const t1 = await testBooking(mine);
      const t2 = await testBooking(mine);
      const otherTest = await testBooking(other);
      const real = (await db.collection("bookings").insertOne({ org_id: ORG, event_id: mine, status: "confirmed", quantity: 1 })).insertedId;

      await db.collection("tickets").insertMany([
        { booking_id: t1, event_id: mine, ticket_code: "T1", is_test: true },
        { booking_id: t2, event_id: mine, ticket_code: "T2", is_test: true },
        { booking_id: otherTest, event_id: other, ticket_code: "T3", is_test: true },
        { booking_id: real, event_id: mine, ticket_code: "REAL" },
      ]);
      await db.collection("booking_sessions").insertMany([
        { org_id: ORG, event_id: mine, is_test: true },
        { org_id: ORG, event_id: mine },
        { org_id: ORG, event_id: other, is_test: true },
      ]);

      expect(await lib.clearTestBookings(db, ORG, mine)).toEqual({ bookings: 2, tickets: 2, sessions: 1 });
      expect(await db.collection("bookings").countDocuments({ event_id: mine })).toBe(1);
      expect(await db.collection("bookings").findOne({ _id: real })).toBeTruthy();
      expect(await db.collection("tickets").find({}).toArray().then((t) => t.map((x) => x.ticket_code).sort())).toEqual(["REAL", "T3"]);
      expect(await db.collection("booking_sessions").countDocuments({})).toBe(2);
      expect(await db.collection("bookings").findOne({ _id: otherTest })).toBeTruthy();
    });

    it("does not clear another organizer's tests", async () => {
      const mine = await event();
      const id = await testBooking(mine);
      expect(await lib.clearTestBookings(db, OTHER, mine)).toEqual({ bookings: 0, tickets: 0, sessions: 0 });
      expect(await db.collection("bookings").findOne({ _id: id })).toBeTruthy();
    });

    it("is a no-op when there are no tests", async () => {
      const mine = await event();
      expect(await lib.clearTestBookings(db, ORG, mine)).toEqual({ bookings: 0, tickets: 0, sessions: 0 });
    });
  });
});
