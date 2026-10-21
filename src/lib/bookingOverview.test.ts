import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { bookingAnswers, bookingSource } from "@/lib/organizerBookings";

describe("bookingAnswers", () => {
  it("lists widget answers with their own labels", () => {
    expect(
      bookingAnswers({ attendee: { answers: [{ label: "Full name", value: "Asha Rao" }, { label: "Age", value: 31 }, { label: "Skipped", value: "" }] } })
    ).toEqual([
      { label: "Full name", value: "Asha Rao" },
      { label: "Age", value: "31" },
    ]);
  });

  it("names chat-bot answers from the event's form field labels, falling back to the key", () => {
    const labels = new Map([["full_name", "Full name"]]);
    expect(bookingAnswers({ form_responses: { full_name: "Ben Ito", dietary_needs: "Vegan" } }, labels)).toEqual([
      { label: "Full name", value: "Ben Ito" },
      { label: "Dietary needs", value: "Vegan" },
    ]);
  });

  it("numbers the attendees of a group booking, but not a single one", () => {
    expect(bookingAnswers({ form_responses: [{ name: "A" }, { name: "B" }] })).toEqual([
      { label: "Name", value: "A", attendee: 1 },
      { label: "Name", value: "B", attendee: 2 },
    ]);
    expect(bookingAnswers({ form_responses: [{ name: "Solo" }] })).toEqual([{ label: "Name", value: "Solo" }]);
  });

  it("is empty when there is nothing to show", () => {
    expect(bookingAnswers({})).toEqual([]);
  });
});

describe("bookingSource", () => {
  it("tells the website widget from the chat bot", () => {
    expect(bookingSource({ source: "chat_widget" })).toBe("widget");
    expect(bookingSource({ booking_session_id: new ObjectId() })).toBe("widget");
    expect(bookingSource({ session_id: "abc", conversation_state: "confirmed" })).toBe("chatbot");
    expect(bookingSource({})).toBeNull();
  });
});

describe("bookingOverview and details in Mongo", () => {
  let db: Db;
  let overview: typeof import("@/lib/bookingOverview");
  let organizer: typeof import("@/lib/organizerBookings");
  const ORG = "org-1";
  const OTHER = "org-2";

  beforeAll(async () => {
    await startTestMongo();
    const { getDb } = await import("@/lib/db");
    overview = await import("@/lib/bookingOverview");
    organizer = await import("@/lib/organizerBookings");
    db = await getDb();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    for (const name of ["events", "bookings", "tickets", "event_form_fields"]) await db.collection(name).deleteMany({});
  });

  const event = async (org: string, name: string, start: Date) =>
    (await db.collection("events").insertOne({ org_id: org, name, status: "published", start_at: start, venue: "Hall", capacity: 10, tickets_sold: 0, tickets_held: 0 })).insertedId;
  const booking = async (eventId: ObjectId, status: string, quantity = 1, extra: Record<string, unknown> = {}) =>
    (await db.collection("bookings").insertOne({ event_id: eventId, status, quantity, created_at: new Date(), updated_at: new Date(), ...extra })).insertedId;

  it("counts bookings per event and group, newest event first", async () => {
    const older = await event(ORG, "Older", new Date("2026-01-01"));
    const newer = await event(ORG, "Newer", new Date("2026-06-01"));
    await booking(newer, "confirmed", 2);
    await booking(newer, "confirmed", 1);
    await booking(newer, "pending_payment");
    await booking(newer, "needs_refund");
    await booking(newer, "expired");
    await booking(older, "confirmed");

    const rows = await overview.bookingOverview(db, ORG);
    expect(rows.map((r) => r.name)).toEqual(["Newer", "Older"]);
    expect(rows[0].counts).toMatchObject({ confirmed: 2, awaiting_payment: 1, needs_attention: 1, closed: 1, in_progress: 0 });
    expect(rows[0].confirmed_tickets).toBe(3);
    expect(rows[1].counts.confirmed).toBe(1);
  });

  it("counts checked-in tickets per event", async () => {
    const e = await event(ORG, "E", new Date());
    const b = await booking(e, "confirmed", 2);
    await db.collection("tickets").insertMany([
      { event_id: e, booking_id: b, ticket_code: "AAAA2222", status: "scanned" },
      { event_id: e, booking_id: b, ticket_code: "BBBB3333", status: "active" },
    ]);
    expect((await overview.bookingOverview(db, ORG))[0].checked_in).toBe(1);
  });

  it("never includes another organizer's events or bookings", async () => {
    const mine = await event(ORG, "Mine", new Date());
    const theirs = await event(OTHER, "Theirs", new Date());
    await booking(mine, "confirmed");
    await booking(theirs, "confirmed");
    await booking(theirs, "confirmed");

    const rows = await overview.bookingOverview(db, ORG);
    expect(rows.map((r) => r.name)).toEqual(["Mine"]);
    expect(rows[0].counts.confirmed).toBe(1);
    expect(await overview.bookingOverview(db, "nobody")).toEqual([]);
  });

  it("gives every event a row even with no bookings", async () => {
    await event(ORG, "Empty", new Date());
    const [row] = await overview.bookingOverview(db, ORG);
    expect(row.counts).toEqual({ confirmed: 0, awaiting_payment: 0, needs_attention: 0, closed: 0, in_progress: 0 });
    expect(row.confirmed_tickets).toBe(0);
    expect(row.checked_in).toBe(0);
  });

  it("returns labelled answers, source, payment and times in the booking list", async () => {
    const e = await event(ORG, "E", new Date());
    await db.collection("event_form_fields").insertOne({ event_id: e, field_key: "full_name", label: "Full name" });
    const confirmedAt = new Date("2026-10-01T10:00:00Z");
    await booking(e, "confirmed", 1, {
      session_id: "s1",
      conversation_state: "confirmed",
      form_responses: { full_name: "Ben Ito", email: "ben@example.com" },
      payment_provider: "stripe",
      confirmed_at: confirmedAt,
    });

    const list = await organizer.listEventBookings(db, e);
    const row = list.rows[0];
    expect(row.answers).toEqual([
      { label: "Full name", value: "Ben Ito" },
      { label: "Email", value: "ben@example.com" },
    ]);
    expect(row.source).toBe("chatbot");
    expect(row.payment_provider).toBe("stripe");
    expect(row.confirmed_at).toEqual(confirmedAt);
  });

  it("does not use another event's form labels", async () => {
    const mine = await event(ORG, "Mine", new Date());
    const other = await event(OTHER, "Other", new Date());
    await db.collection("event_form_fields").insertOne({ event_id: other, field_key: "city", label: "SECRET LABEL" });
    await booking(mine, "confirmed", 1, { form_responses: { city: "Pune" } });
    const row = (await organizer.listEventBookings(db, mine)).rows[0];
    expect(row.answers).toEqual([{ label: "City", value: "Pune" }]);
  });
});
