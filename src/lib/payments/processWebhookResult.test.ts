import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

// No real email in tests: capture what would be sent.
const sendTicketEmail = vi.fn(async (_data: unknown) => {});
const sendOrganizerAlertEmail = vi.fn(async (_data: unknown) => {});
vi.mock("@/lib/mailer", () => ({ sendTicketEmail, sendOrganizerAlertEmail }));

const ORG = "org-1";
let db: Db;
let processPaymentWebhookResult: typeof import("@/lib/payments/processWebhookResult").processPaymentWebhookResult;
let eventId: ObjectId;
let seq = 0;

async function insertEvent(capacity = 10, sold = 0, held = 0) {
  const now = new Date();
  const res = await db.collection("events").insertOne({
    org_id: ORG, name: "Launch Night", start_at: new Date(now.getTime() + 86400_000), end_at: new Date(now.getTime() + 2 * 86400_000),
    venue: "Hall A", capacity, tickets_sold: sold, tickets_held: held, status: "published", is_paid: true, price: 500, currency: "INR",
  });
  return res.insertedId;
}

async function insertBooking(fields: Record<string, unknown>) {
  const res = await db.collection("bookings").insertOne({
    org_id: ORG, event_id: eventId, quantity: 2, visitor_id: "visitor-1", booking_code: "NBK-1",
    attendee: { answers: [{ label: "Email", validation_rule: "email_format", value: "guest@example.com" }] },
    created_at: new Date(), ...fields,
  });
  return res.insertedId;
}

const webhook = (bookingId: ObjectId, status: "paid" | "failed", eventIdOverride?: string) =>
  processPaymentWebhookResult({
    provider: "paypal",
    orgId: ORG,
    result: { providerEventId: eventIdOverride ?? `evt-${++seq}`, bookingId: bookingId.toString(), status, rawPayload: {}, providerPaymentId: "pay-1" },
  });

const event = () => db.collection("events").findOne({ _id: eventId });
const booking = (id: ObjectId) => db.collection("bookings").findOne({ _id: id });
const ticketCount = (id: ObjectId) => db.collection("tickets").countDocuments({ booking_id: id });

beforeAll(async () => {
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  db = await getDb();
  ({ processPaymentWebhookResult } = await import("@/lib/payments/processWebhookResult"));
  await db.collection("accounts").insertOne({ id: ORG, email: "organizer@example.com", name: "Org" });
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  for (const c of ["events", "bookings", "tickets", "payment_webhook_events", "payment_attempts"]) await db.collection(c).deleteMany({});
  sendTicketEmail.mockClear();
  sendOrganizerAlertEmail.mockClear();
  eventId = await insertEvent(10, 0, 2);
});

describe("paid webhooks", () => {
  it("confirms a widget booking, turns its held seats into sales, issues and emails tickets", async () => {
    const id = await insertBooking({ status: "pending_payment", payment_status: "pending", hold_placed: true });
    await webhook(id, "paid");

    const b = await booking(id);
    expect(b).toMatchObject({ status: "confirmed", payment_status: "paid" });
    expect(b!.ticket_codes).toHaveLength(2);
    expect(await ticketCount(id)).toBe(2);
    expect(await event()).toMatchObject({ tickets_sold: 2, tickets_held: 0 });
    expect(sendTicketEmail).toHaveBeenCalledTimes(1);
    expect(sendTicketEmail.mock.calls[0][0]).toMatchObject({ to: "guest@example.com", quantity: 2, ticketCodes: b!.ticket_codes });
  });

  it("confirms a chat-bot booking the same way, whichever provider calls", async () => {
    const id = await insertBooking({ status: "awaiting_payment", conversation_state: "awaiting_payment", attendee: undefined, form_responses: { email: "bot@example.com" } });
    await webhook(id, "paid");

    expect(await booking(id)).toMatchObject({ status: "confirmed", conversation_state: "confirmed" });
    expect(await ticketCount(id)).toBe(2);
    expect(await event()).toMatchObject({ tickets_sold: 2, tickets_held: 0 });
    expect(sendTicketEmail.mock.calls[0][0]).toMatchObject({ to: "bot@example.com" });
  });

  it("ignores a duplicate delivery: no extra tickets, no second email", async () => {
    const id = await insertBooking({ status: "pending_payment", payment_status: "pending", hold_placed: true });
    await webhook(id, "paid", "evt-dup");
    const second = await webhook(id, "paid", "evt-dup");

    expect(second.message).toBe("Already processed");
    expect(await ticketCount(id)).toBe(2);
    expect(sendTicketEmail).toHaveBeenCalledTimes(1);
  });

  it("records an older widget booking (no hold) as sold", async () => {
    await db.collection("events").updateOne({ _id: eventId }, { $set: { tickets_held: 0 } });
    const id = await insertBooking({ status: "pending_payment", payment_status: "pending" });
    await webhook(id, "paid");
    expect(await event()).toMatchObject({ tickets_sold: 2, tickets_held: 0 });
  });

  it("confirms a late payment when the seats are still free", async () => {
    await db.collection("events").updateOne({ _id: eventId }, { $set: { tickets_held: 0 } });
    const id = await insertBooking({ status: "expired", payment_status: "pending", hold_placed: true });
    await webhook(id, "paid");

    expect(await booking(id)).toMatchObject({ status: "confirmed", late_payment: true });
    expect(await ticketCount(id)).toBe(2);
    expect(await event()).toMatchObject({ tickets_sold: 2 });
    expect(sendOrganizerAlertEmail).not.toHaveBeenCalled();
  });

  it("marks a late payment for refund and alerts the organizer when the event is full", async () => {
    await db.collection("events").updateOne({ _id: eventId }, { $set: { tickets_held: 0, tickets_sold: 10 } });
    const id = await insertBooking({ status: "expired", payment_status: "pending", hold_placed: true });
    const res = await webhook(id, "paid");

    expect(res.message).toBe("needs_refund");
    expect(await booking(id)).toMatchObject({ status: "needs_refund", payment_status: "paid" });
    expect(await ticketCount(id)).toBe(0);
    expect(sendOrganizerAlertEmail).toHaveBeenCalledTimes(1);
    expect(sendOrganizerAlertEmail.mock.calls[0][0]).toMatchObject({ to: "organizer@example.com" });
  });

  it("does nothing for a booking of another organizer", async () => {
    const id = await insertBooking({ status: "pending_payment", hold_placed: true, org_id: "someone-else" });
    const res = await webhook(id, "paid");
    expect(res.message).toBe("Booking not found");
    expect((await booking(id))!.status).toBe("pending_payment");
  });
});

describe("failed webhooks", () => {
  it("fails a widget booking and releases its held seats", async () => {
    const id = await insertBooking({ status: "pending_payment", payment_status: "pending", hold_placed: true });
    await webhook(id, "failed");
    expect(await booking(id)).toMatchObject({ status: "failed", payment_status: "failed" });
    expect(await event()).toMatchObject({ tickets_held: 0, tickets_sold: 0 });
  });

  it("cancels a chat-bot booking and releases its held seats", async () => {
    const id = await insertBooking({ status: "awaiting_payment", conversation_state: "awaiting_payment" });
    await webhook(id, "failed");
    expect(await booking(id)).toMatchObject({ status: "cancelled", conversation_state: "cancelled" });
    expect(await event()).toMatchObject({ tickets_held: 0 });
  });
});
