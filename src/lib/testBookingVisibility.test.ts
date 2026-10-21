import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { allowedActions } from "@/lib/organizerBookings";
import { buildTicketPdf } from "@/lib/ticketPdf";

describe("allowedActions for test bookings", () => {
  it("offers nothing on a test booking, whatever its status", () => {
    for (const status of ["needs_refund", "pending_payment", "awaiting_payment", "confirmed"]) {
      expect(allowedActions(status, true)).toEqual([]);
    }
  });

  it("still offers the real actions on a real booking", () => {
    expect(allowedActions("needs_refund", false)).toEqual(["mark_refunded"]);
    expect(allowedActions("pending_payment")).toEqual(["cancel"]);
  });
});

describe("test tickets in PDFs", () => {
  const base = {
    eventName: "Summit",
    startAt: new Date("2026-10-21T10:00:00Z"),
    venue: "Hall",
    bookingCode: "NBK-1",
    attendeeName: "Asha Rao",
    ticketCodes: ["EVT-AAAA2222"],
    accentColor: "#36f4a4",
  };

  it("still produces a valid PDF for a test ticket", async () => {
    const pdf = await buildTicketPdf({ ...base, isTest: true });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("draws extra marks on a test ticket, so it differs from a real one", async () => {
    const real = await buildTicketPdf(base);
    const test = await buildTicketPdf({ ...base, isTest: true });
    expect(test.length).not.toBe(real.length);
  });
});

describe("test bookings among real ones, in Mongo", () => {
  const ORG = "org-1";
  let db: Db;
  let lib: typeof import("@/lib/organizerBookings");
  let overview: typeof import("@/lib/bookingOverview");
  let eventId: ObjectId;

  beforeAll(async () => {
    await startTestMongo();
    const { getDb } = await import("@/lib/db");
    lib = await import("@/lib/organizerBookings");
    overview = await import("@/lib/bookingOverview");
    db = await getDb();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    for (const name of ["events", "bookings", "tickets", "event_form_fields"]) await db.collection(name).deleteMany({});
    eventId = (await db.collection("events").insertOne({ org_id: ORG, name: "E", status: "draft", capacity: 10, tickets_sold: 0, tickets_held: 0, start_at: new Date() })).insertedId;
  });

  const booking = async (fields: Record<string, unknown>) =>
    (await db.collection("bookings").insertOne({ event_id: eventId, quantity: 1, created_at: new Date(), updated_at: new Date(), ...fields })).insertedId;
  const ticket = (bookingId: ObjectId, code: string, fields: Record<string, unknown> = {}) =>
    db.collection("tickets").insertOne({ booking_id: bookingId, event_id: eventId, ticket_code: code, ticket_index: 0, status: "active", scanned_at: null, ...fields });

  it("tags test rows and counts them apart from real bookings", async () => {
    await booking({ status: "confirmed", booking_code: "REAL" });
    await booking({ status: "confirmed", booking_code: "TEST", is_test: true });
    await booking({ status: "confirmed", booking_code: "TEST2", is_test: true });

    const all = await lib.listEventBookings(db, eventId);
    expect(all.counts.confirmed).toBe(1);
    expect(all.testCount).toBe(2);
    expect(all.rows.map((r) => [r.booking_code, r.is_test]).sort()).toEqual([["REAL", false], ["TEST", true], ["TEST2", true]]);
  });

  it("the Test filter shows only tests, and status filters show only real bookings", async () => {
    await booking({ status: "confirmed", booking_code: "REAL" });
    await booking({ status: "confirmed", booking_code: "TEST", is_test: true });

    const tests = await lib.listEventBookings(db, eventId, { group: "test" });
    expect(tests.rows.map((r) => r.booking_code)).toEqual(["TEST"]);

    const confirmed = await lib.listEventBookings(db, eventId, { group: "confirmed" });
    expect(confirmed.rows.map((r) => r.booking_code)).toEqual(["REAL"]);
  });

  it("search finds test bookings too", async () => {
    await booking({ status: "confirmed", booking_code: "TEST", is_test: true, form_responses: { name: "Asha Tester" } });
    const found = await lib.listEventBookings(db, eventId, { q: "tester" });
    expect(found.rows).toHaveLength(1);
    expect(found.rows[0].is_test).toBe(true);
  });

  it("keeps tests out of the overview numbers", async () => {
    const real = await booking({ status: "confirmed", quantity: 2 });
    const test = await booking({ status: "confirmed", quantity: 5, is_test: true });
    await ticket(real, "REALTKT1", { status: "scanned" });
    await ticket(test, "TESTTKT1", { status: "scanned", is_test: true });

    const [row] = await overview.bookingOverview(db, ORG);
    expect(row.counts.confirmed).toBe(1);
    expect(row.confirmed_tickets).toBe(2);
    expect(row.checked_in).toBe(1);
    expect(row.tests).toBe(1);
  });

  it("refuses to check in a test ticket", async () => {
    const test = await booking({ status: "confirmed", is_test: true });
    await ticket(test, "TESTTKT2", { is_test: true });
    expect(await lib.checkInTicket(db, eventId, "TESTTKT2", ORG)).toEqual({ outcome: "test_ticket" });
    expect((await db.collection("tickets").findOne({ ticket_code: "TESTTKT2" }))?.status).toBe("active");
  });

  it("refuses to cancel or refund a test booking", async () => {
    const test = await booking({ status: "pending_payment", is_test: true });
    expect(await lib.reconcileBooking(db, eventId, test, "cancel", ORG)).toMatchObject({ ok: false, code: "not_allowed" });
    expect((await db.collection("bookings").findOne({ _id: test }))?.status).toBe("pending_payment");
  });

  it("never lets a test booking be listed for a different event", async () => {
    const other = (await db.collection("events").insertOne({ org_id: ORG, name: "Other", status: "draft", capacity: 5, start_at: new Date() })).insertedId;
    await db.collection("bookings").insertOne({ event_id: other, status: "confirmed", is_test: true, quantity: 1, created_at: new Date() });
    expect((await lib.listEventBookings(db, eventId)).testCount).toBe(0);
  });
});
