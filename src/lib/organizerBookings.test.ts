import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { allowedActions, attendeeSummary, groupOfStatus, searchText } from "@/lib/organizerBookings";

describe("pure helpers", () => {
  it("groups each status by what the organizer can do about it", () => {
    expect(groupOfStatus("confirmed")).toBe("confirmed");
    expect(groupOfStatus("pending_payment")).toBe("awaiting_payment");
    expect(groupOfStatus("awaiting_payment")).toBe("awaiting_payment");
    expect(groupOfStatus("needs_refund")).toBe("needs_attention");
    expect(groupOfStatus("refunded")).toBe("closed");
    expect(groupOfStatus("in_progress")).toBe("in_progress");
    expect(groupOfStatus("mystery")).toBeNull();
  });

  it("offers only the actions that fit a status", () => {
    expect(allowedActions("needs_refund")).toEqual(["mark_refunded"]);
    expect(allowedActions("pending_payment")).toEqual(["cancel"]);
    expect(allowedActions("awaiting_payment")).toEqual(["cancel"]);
    expect(allowedActions("confirmed")).toEqual([]);
    expect(allowedActions("refunded")).toEqual([]);
  });

  it("reads the attendee from widget answers", () => {
    expect(
      attendeeSummary({
        attendee: {
          answers: [
            { label: "Full name", field_type: "text", value: "Asha Rao" },
            { label: "Email", field_type: "email", value: "asha@example.com" },
            { label: "Phone", field_type: "tel", value: "+91 98765 43210" },
          ],
        },
      })
    ).toEqual({ name: "Asha Rao", email: "asha@example.com", phone: "+91 98765 43210" });
  });

  it("reads the attendee from chat-bot form responses, single or per attendee", () => {
    expect(attendeeSummary({ form_responses: { full_name: "Ben Ito", email: "ben@example.com" } })).toMatchObject({
      name: "Ben Ito",
      email: "ben@example.com",
    });
    expect(attendeeSummary({ form_responses: [{ name: "First", email: "f@example.com" }, { name: "Second" }] })).toMatchObject({
      name: "First",
      email: "f@example.com",
    });
    expect(attendeeSummary({})).toEqual({ name: null, email: null, phone: null });
  });

  it("builds search text from the reference, answers, responses and ticket codes", () => {
    const text = searchText(
      { booking_code: "NBK-2026-A1B2", attendee: { answers: [{ value: "Asha Rao" }] }, form_responses: { city: "Pune" } },
      ["K7M2PQ9X"]
    );
    for (const part of ["nbk-2026-a1b2", "asha rao", "pune", "k7m2pq9x"]) expect(text).toContain(part);
  });
});

describe("organizer bookings in Mongo", () => {
  const ORGANIZER = "org-1";
  let db: Db;
  let lib: typeof import("@/lib/organizerBookings");
  let eventId: ObjectId;
  let otherEventId: ObjectId;

  beforeAll(async () => {
    await startTestMongo();
    const { getDb } = await import("@/lib/db");
    lib = await import("@/lib/organizerBookings");
    db = await getDb();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    for (const name of ["events", "bookings", "tickets"]) await db.collection(name).deleteMany({});
    eventId = new ObjectId();
    otherEventId = new ObjectId();
    await db.collection("events").insertMany([
      { _id: eventId, org_id: ORGANIZER, capacity: 10, tickets_sold: 0, tickets_held: 0 },
      { _id: otherEventId, org_id: "org-2", capacity: 10, tickets_sold: 0, tickets_held: 0 },
    ]);
  });

  const booking = async (fields: Record<string, unknown>, event = eventId) => {
    const res = await db.collection("bookings").insertOne({
      event_id: event,
      quantity: 1,
      created_at: new Date(),
      updated_at: new Date(),
      ...fields,
    });
    return res.insertedId;
  };
  const ticket = async (bookingId: ObjectId, code: string, fields: Record<string, unknown> = {}, event = eventId) =>
    db.collection("tickets").insertOne({
      booking_id: bookingId,
      event_id: event,
      ticket_code: code,
      ticket_index: 0,
      status: "active",
      scanned_at: null,
      ...fields,
    });

  describe("listEventBookings", () => {
    it("lists only this event's bookings, with counts per group", async () => {
      await booking({ status: "confirmed", booking_code: "NBK-1" });
      await booking({ status: "needs_refund", booking_code: "NBK-2" });
      await booking({ status: "pending_payment", booking_code: "NBK-3", hold_placed: false });
      await booking({ status: "confirmed", booking_code: "OTHER" }, otherEventId);

      const list = await lib.listEventBookings(db, eventId);
      expect(list.rows.map((r) => r.booking_code).sort()).toEqual(["NBK-1", "NBK-2", "NBK-3"]);
      expect(list.counts).toMatchObject({ confirmed: 1, needs_attention: 1, awaiting_payment: 1, closed: 0 });
    });

    it("filters by group", async () => {
      await booking({ status: "confirmed", booking_code: "NBK-1" });
      await booking({ status: "expired", booking_code: "NBK-2" });
      const list = await lib.listEventBookings(db, eventId, { group: "closed" });
      expect(list.rows.map((r) => r.booking_code)).toEqual(["NBK-2"]);
      expect(list.total).toBe(1);
    });

    it("finds a booking by attendee name, email, reference or ticket code across both flows", async () => {
      const widget = await booking({
        status: "confirmed",
        booking_code: "NBK-W",
        attendee: { answers: [{ label: "Name", field_type: "text", value: "Asha Rao" }, { label: "Email", field_type: "email", value: "asha@example.com" }] },
      });
      const bot = await booking({ status: "confirmed", booking_code: "NBK-B", form_responses: { full_name: "Ben Ito", email: "ben@example.com" } });
      await ticket(widget, "WIDGET22");
      await ticket(bot, "BOTCODE3");

      const ids = async (q: string) => (await lib.listEventBookings(db, eventId, { q })).rows.map((r) => r.booking_code);
      expect(await ids("asha")).toEqual(["NBK-W"]);
      expect(await ids("BEN@EXAMPLE")).toEqual(["NBK-B"]);
      expect(await ids("nbk-b")).toEqual(["NBK-B"]);
      expect(await ids("botcode3")).toEqual(["NBK-B"]);
      expect(await ids("nobody")).toEqual([]);
    });

    it("never searches into another event's bookings", async () => {
      await booking({ status: "confirmed", booking_code: "SECRET-1", form_responses: { name: "Hidden Person" } }, otherEventId);
      expect((await lib.listEventBookings(db, eventId, { q: "hidden" })).rows).toEqual([]);
    });

    it("paginates and reports tickets and check-in progress", async () => {
      for (let i = 0; i < 30; i++) await booking({ status: "confirmed", booking_code: `NBK-${i}`, created_at: new Date(Date.now() - i * 1000) });
      const first = await lib.listEventBookings(db, eventId, { page: 1 });
      const second = await lib.listEventBookings(db, eventId, { page: 2 });
      expect(first.rows).toHaveLength(25);
      expect(second.rows).toHaveLength(5);
      expect(first.total).toBe(30);

      const id = await booking({ status: "confirmed", booking_code: "TICKETED", quantity: 2 });
      await ticket(id, "AAAA2222", { ticket_index: 0, status: "scanned", scanned_at: new Date() });
      await ticket(id, "BBBB3333", { ticket_index: 1 });
      const row = (await lib.listEventBookings(db, eventId, { q: "ticketed" })).rows[0];
      expect(row.tickets.map((t) => t.status)).toEqual(["scanned", "active"]);
      expect(row.checked_in).toBe(1);
    });

    it("gives back seats held by an abandoned checkout before listing", async () => {
      await db.collection("events").updateOne({ _id: eventId }, { $set: { tickets_held: 2 } });
      await booking({
        status: "awaiting_payment",
        quantity: 2,
        hold_expires_at: new Date(Date.now() - 60_000),
        booking_code: "ABANDONED",
      });
      const list = await lib.listEventBookings(db, eventId);
      expect(list.rows[0].status).toBe("expired");
      expect((await db.collection("events").findOne({ _id: eventId }))?.tickets_held).toBe(0);
    });
  });

  describe("checkInTicket", () => {
    it("checks a ticket in once, then reports it as already checked in", async () => {
      const id = await booking({ status: "confirmed" });
      await ticket(id, "CHECK222");

      const first = await lib.checkInTicket(db, eventId, "CHECK222", ORGANIZER);
      expect(first.outcome).toBe("checked_in");
      const second = await lib.checkInTicket(db, eventId, "CHECK222", ORGANIZER);
      expect(second.outcome).toBe("already_checked_in");
    });

    it("lets only one of two simultaneous check-ins win", async () => {
      const id = await booking({ status: "confirmed" });
      await ticket(id, "RACE2222");
      const results = await Promise.all([
        lib.checkInTicket(db, eventId, "RACE2222", ORGANIZER),
        lib.checkInTicket(db, eventId, "RACE2222", ORGANIZER),
      ]);
      expect(results.filter((r) => r.outcome === "checked_in")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "already_checked_in")).toHaveLength(1);
    });

    it("refuses tickets of a booking that is not confirmed", async () => {
      const id = await booking({ status: "needs_refund" });
      await ticket(id, "REFUND22");
      expect(await lib.checkInTicket(db, eventId, "REFUND22", ORGANIZER)).toEqual({
        outcome: "booking_not_confirmed",
        booking_status: "needs_refund",
      });
    });

    it("does not find a ticket of another event", async () => {
      const id = await booking({ status: "confirmed" }, otherEventId);
      await ticket(id, "OTHER222", {}, otherEventId);
      expect((await lib.checkInTicket(db, eventId, "OTHER222", ORGANIZER)).outcome).toBe("not_found");
      expect((await lib.checkInTicket(db, eventId, "NOSUCH22", ORGANIZER)).outcome).toBe("not_found");
    });

    it("reports a void ticket and can undo a mistaken check-in", async () => {
      const id = await booking({ status: "confirmed" });
      await ticket(id, "VOID2222", { status: "void" });
      expect(await lib.checkInTicket(db, eventId, "VOID2222", ORGANIZER)).toEqual({ outcome: "ticket_void", ticket_status: "void" });

      await ticket(id, "UNDO2222", { ticket_index: 1 });
      await lib.checkInTicket(db, eventId, "UNDO2222", ORGANIZER);
      expect(await lib.undoCheckIn(db, eventId, "UNDO2222")).toBe(true);
      expect(await lib.undoCheckIn(db, eventId, "UNDO2222")).toBe(false);
      expect((await lib.checkInTicket(db, eventId, "UNDO2222", ORGANIZER)).outcome).toBe("checked_in");
    });
  });

  describe("reconcileBooking", () => {
    it("marks a needs_refund booking refunded without touching seats", async () => {
      const id = await booking({ status: "needs_refund", payment_status: "paid" });
      const res = await lib.reconcileBooking(db, eventId, id, "mark_refunded", ORGANIZER);
      expect(res).toEqual({ ok: true, status: "refunded" });
      expect(await db.collection("bookings").findOne({ _id: id })).toMatchObject({ status: "refunded", payment_status: "refunded", refunded_by: ORGANIZER });
      expect(await db.collection("events").findOne({ _id: eventId })).toMatchObject({ tickets_sold: 0, tickets_held: 0 });
    });

    it("refuses to mark any other status refunded", async () => {
      const id = await booking({ status: "confirmed" });
      const res = await lib.reconcileBooking(db, eventId, id, "mark_refunded", ORGANIZER);
      expect(res).toMatchObject({ ok: false, code: "not_allowed" });
      expect((await db.collection("bookings").findOne({ _id: id }))?.status).toBe("confirmed");
    });

    it("cancels a held checkout and releases its seats exactly once", async () => {
      await db.collection("events").updateOne({ _id: eventId }, { $set: { tickets_held: 3 } });
      const id = await booking({ status: "awaiting_payment", quantity: 3, hold_expires_at: new Date(Date.now() + 60_000) });

      const first = await lib.reconcileBooking(db, eventId, id, "cancel", ORGANIZER);
      const second = await lib.reconcileBooking(db, eventId, id, "cancel", ORGANIZER);
      expect(first).toEqual({ ok: true, status: "cancelled" });
      expect(second).toMatchObject({ ok: false, code: "not_allowed" });
      expect((await db.collection("events").findOne({ _id: eventId }))?.tickets_held).toBe(0);
    });

    it("releases seats for a widget booking only when it placed a hold", async () => {
      await db.collection("events").updateOne({ _id: eventId }, { $set: { tickets_held: 2 } });
      const held = await booking({ status: "pending_payment", quantity: 2, hold_placed: true });
      const legacy = await booking({ status: "pending_payment", quantity: 5 });
      await lib.reconcileBooking(db, eventId, legacy, "cancel", ORGANIZER);
      expect((await db.collection("events").findOne({ _id: eventId }))?.tickets_held).toBe(2);
      await lib.reconcileBooking(db, eventId, held, "cancel", ORGANIZER);
      expect((await db.collection("events").findOne({ _id: eventId }))?.tickets_held).toBe(0);
    });

    it("cannot cancel a confirmed booking or one from another event", async () => {
      const confirmed = await booking({ status: "confirmed" });
      expect(await lib.reconcileBooking(db, eventId, confirmed, "cancel", ORGANIZER)).toMatchObject({ ok: false, code: "not_allowed" });

      const foreign = await booking({ status: "pending_payment" }, otherEventId);
      expect(await lib.reconcileBooking(db, eventId, foreign, "cancel", ORGANIZER)).toMatchObject({ ok: false, code: "not_found" });
      expect((await db.collection("bookings").findOne({ _id: foreign }))?.status).toBe("pending_payment");
    });
  });
});
