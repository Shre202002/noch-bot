/**
 * Test bookings through the real route handlers, in the order the widget calls them. The organizer tries their own
 * event before going live: it must work on a complete draft, take no real seats, send no email, never call a payment
 * gateway, and be impossible for anyone but the signed-in organizer to start.
 */
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { NextRequest } from "next/server";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

const sendTicketEmail = vi.fn(async (_data: unknown) => {});
vi.mock("@/lib/mailer", () => ({ sendTicketEmail, sendOrganizerAlertEmail: vi.fn() }));

// Who is signed in to the dashboard for the request being made.
let signedInAs: string | null = null;
vi.mock("@/lib/auth", () => ({ getUserIdFromCookie: vi.fn(async () => signedInAs) }));

vi.setConfig({ testTimeout: 120_000 });

const ORG = "org-test-1";
const OTHER = "org-test-2";
const VISITOR = "test-visitor";
const BASE = "http://localhost:9002";
let db: Db;

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

const makeEvent = async (fields: Record<string, unknown> = {}) => {
  const now = Date.now();
  const eventId = (
    await db.collection("events").insertOne({
      org_id: ORG,
      name: "Launch Party",
      description: "Come celebrate",
      status: "draft",
      start_at: new Date(now + 7 * 86400_000),
      end_at: new Date(now + 7 * 86400_000 + 3 * 3600_000),
      venue: "Hall B",
      capacity: 5,
      tickets_sold: 0,
      tickets_held: 0,
      is_paid: false,
      price: null,
      currency: "INR",
      allow_group_booking: true,
      max_tickets_per_booking: null,
      ticket_template_id: "dark",
      ticket_design_confirmed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      ...fields,
    })
  ).insertedId;
  const inserted = await db.collection("event_form_fields").insertMany([
    { event_id: eventId, label: "Full name", field_key: "name", field_type: "text", is_required: true, validation_rule: "name_format", order_index: 0 },
    { event_id: eventId, label: "Email", field_key: "email", field_type: "email", is_required: true, validation_rule: "email_format", order_index: 1 },
  ]);
  return { eventId, nameFieldId: inserted.insertedIds[0].toString(), emailFieldId: inserted.insertedIds[1].toString() };
};

/** The widget's steps up to the summary, as the signed-in organizer. */
async function runBooking(eventId: ObjectId, ids: { nameFieldId: string; emailFieldId: string }, test: boolean) {
  const { POST: start } = await import("@/app/api/embed/bookings/session/route");
  const { PATCH: step } = await import("@/app/api/embed/bookings/session/[sessionId]/route");
  const session = await (await start(req("/api/embed/bookings/session", "POST", { userId: ORG, visitorId: VISITOR, eventId: eventId.toString(), test }))).json();
  const sessionId = session.session_id as string;
  const patch = (body: Record<string, unknown>) =>
    step(req(`/api/embed/bookings/session/${sessionId}`, "PATCH", { userId: ORG, visitorId: VISITOR, ...body }), params({ sessionId }));
  await patch({ action: "set_quantity", quantity: 2 });
  await patch({ action: "answer_field", fieldId: ids.nameFieldId, value: "Asha Rao" });
  await patch({ action: "answer_field", fieldId: ids.emailFieldId, value: "asha@example.com" });
  return { sessionId, session };
}

const confirm = async (sessionId: string) => {
  const { POST } = await import("@/app/api/embed/bookings/session/[sessionId]/confirm/route");
  return POST(req(`/api/embed/bookings/session/${sessionId}/confirm`, "POST", { userId: ORG, visitorId: VISITOR }), params({ sessionId }));
};

beforeAll(async () => {
  process.env.NEXTAUTH_URL = BASE;
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  db = await getDb();
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  for (const name of ["events", "event_form_fields", "bookings", "tickets", "booking_sessions", "payment_gateway_configs", "payment_attempts"]) {
    await db.collection(name).deleteMany({});
  }
  sendTicketEmail.mockClear();
  signedInAs = ORG;
});

describe("test mode: who may use it", () => {
  it("lists a complete draft for the signed-in organizer, and nothing for the public", async () => {
    await makeEvent();
    const { GET } = await import("@/app/api/embed/events/route");

    const owner = await (await GET(req(`/api/embed/events?userId=${ORG}&test=1`))).json();
    expect(owner.test).toBe(true);
    expect(owner.events.map((e: { name: string }) => e.name)).toEqual(["Launch Party"]);

    signedInAs = null;
    const publicVisitor = await (await GET(req(`/api/embed/events?userId=${ORG}&test=1`))).json();
    expect(publicVisitor.test).toBe(false);
    expect(publicVisitor.events).toEqual([]);

    signedInAs = OTHER;
    const otherOrganizer = await (await GET(req(`/api/embed/events?userId=${ORG}&test=1`))).json();
    expect(otherOrganizer.events).toEqual([]);
  });

  it("refuses a test session for the public, another organizer, and an incomplete event", async () => {
    const { eventId } = await makeEvent();
    const { POST: start } = await import("@/app/api/embed/bookings/session/route");
    const attempt = () => start(req("/api/embed/bookings/session", "POST", { userId: ORG, visitorId: VISITOR, eventId: eventId.toString(), test: true }));

    signedInAs = null;
    expect((await attempt()).status).toBe(400);
    signedInAs = OTHER;
    expect((await attempt()).status).toBe(400);

    signedInAs = ORG;
    const incomplete = await makeEvent({ ticket_design_confirmed_at: undefined, ticket_template_id: "default" });
    const res = await start(req("/api/embed/bookings/session", "POST", { userId: ORG, visitorId: VISITOR, eventId: incomplete.eventId.toString(), test: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).missing.map((m: { id: string }) => m.id)).toEqual(["design"]);
  });

  it("does not show a draft to a normal visitor", async () => {
    const { eventId } = await makeEvent();
    signedInAs = null;
    const { POST: start } = await import("@/app/api/embed/bookings/session/route");
    const res = await start(req("/api/embed/bookings/session", "POST", { userId: ORG, visitorId: VISITOR, eventId: eventId.toString() }));
    expect(res.status).toBe(400);
  });
});

describe("a free test booking", () => {
  it("confirms, issues test tickets, takes no real seats and sends no email", async () => {
    const { eventId, ...ids } = await makeEvent();
    const { sessionId, session } = await runBooking(eventId, ids, true);
    expect(session.is_test).toBe(true);

    const res = await confirm(sessionId);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ status: "confirmed", is_test: true, emailed_to: null });

    const booking = (await db.collection("bookings").findOne({ _id: new ObjectId(data.booking_id) }))!;
    expect(booking).toMatchObject({ is_test: true, status: "confirmed", payment_status: "not_required" });
    const tickets = await db.collection("tickets").find({ booking_id: booking._id }).toArray();
    expect(tickets).toHaveLength(2);
    expect(tickets.every((t) => t.is_test === true)).toBe(true);

    expect(await db.collection("events").findOne({ _id: eventId })).toMatchObject({ tickets_sold: 0, tickets_held: 0 });
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("marks the ticket data and the PDF as a test", async () => {
    const { eventId, ...ids } = await makeEvent();
    const { sessionId } = await runBooking(eventId, ids, true);
    const data = await (await confirm(sessionId)).json();

    const { GET: ticket } = await import("@/app/api/embed/bookings/[bookingId]/ticket/route");
    const ticketRes = await ticket(req(`/api/embed/bookings/${data.booking_id}/ticket?userId=${ORG}&visitorId=${VISITOR}`), params({ bookingId: data.booking_id }));
    expect((await ticketRes.json()).ticket_data.is_test).toBe(true);

    const { GET: pdf } = await import("@/app/api/embed/bookings/[bookingId]/ticket/pdf/route");
    const pdfRes = await pdf(req(`/api/embed/bookings/${data.booking_id}/ticket/pdf?userId=${ORG}&visitorId=${VISITOR}`), params({ bookingId: data.booking_id }));
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("does not disturb real bookings: a normal booking on a published event still takes seats and emails", async () => {
    const { eventId, ...ids } = await makeEvent({ status: "published" });
    const { sessionId, session } = await runBooking(eventId, ids, false);
    expect(session.is_test).toBe(false);
    const data = await (await confirm(sessionId)).json();
    expect(data.status).toBe("confirmed");
    expect((await db.collection("bookings").findOne({ _id: new ObjectId(data.booking_id) }))?.is_test).toBeUndefined();
    expect(await db.collection("events").findOne({ _id: eventId })).toMatchObject({ tickets_sold: 2 });
    expect(sendTicketEmail).toHaveBeenCalledTimes(1);
  });

  it("checks that the seats would exist without taking them", async () => {
    const { eventId, ...ids } = await makeEvent({ capacity: 1 });
    const { sessionId } = await runBooking(eventId, ids, true);
    const res = await confirm(sessionId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/seats/i);
    expect(await db.collection("bookings").countDocuments({})).toBe(0);
  });
});

describe("a paid test booking", () => {
  const paid = () => makeEvent({ is_paid: true, price: 500 });

  it("goes to the simulated payment page, calls no gateway and holds no seats", async () => {
    await db.collection("payment_gateway_configs").insertOne({ org_id: ORG, is_active: true, provider: "stripe" });
    const { eventId, ...ids } = await paid();
    const { sessionId } = await runBooking(eventId, ids, true);

    const data = await (await confirm(sessionId)).json();
    expect(data).toMatchObject({ status: "checkout_pending", is_test: true });
    expect(data.checkoutUrl).toContain(`/booking/test-pay/${data.booking_id}`);
    expect(await db.collection("payment_attempts").countDocuments({})).toBe(0);
    expect(await db.collection("events").findOne({ _id: eventId })).toMatchObject({ tickets_sold: 0, tickets_held: 0 });
    expect((await db.collection("bookings").findOne({ _id: new ObjectId(data.booking_id) }))).toMatchObject({ is_test: true, status: "pending_payment" });
  });

  it("confirms through the test payment, and the attendee can then download the ticket", async () => {
    await db.collection("payment_gateway_configs").insertOne({ org_id: ORG, is_active: true, provider: "stripe" });
    const { eventId, ...ids } = await paid();
    const { sessionId } = await runBooking(eventId, ids, true);
    const data = await (await confirm(sessionId)).json();

    const { POST: pay } = await import("@/app/api/embed/bookings/[bookingId]/test-pay/route");
    const payRes = await pay(
      req(`/api/embed/bookings/${data.booking_id}/test-pay`, "POST", { userId: ORG, visitorId: VISITOR, outcome: "paid" }),
      params({ bookingId: data.booking_id })
    );
    const paid_ = await payRes.json();
    expect(payRes.status).toBe(200);
    expect(paid_).toMatchObject({ result: "confirmed", status: "confirmed" });
    expect(paid_.ticket_pdf_url).toContain(data.booking_id);

    const { GET: status } = await import("@/app/api/embed/bookings/[bookingId]/status/route");
    const s = await (await status(req(`/api/embed/bookings/${data.booking_id}/status?userId=${ORG}&visitorId=${VISITOR}`), params({ bookingId: data.booking_id }))).json();
    expect(s.can_download_ticket).toBe(true);
    expect(await db.collection("tickets").countDocuments({ booking_id: new ObjectId(data.booking_id), is_test: true })).toBe(2);
    expect(sendTicketEmail).not.toHaveBeenCalled();
  });

  it("a failed test payment issues no tickets", async () => {
    await db.collection("payment_gateway_configs").insertOne({ org_id: ORG, is_active: true, provider: "stripe" });
    const { eventId, ...ids } = await paid();
    const { sessionId } = await runBooking(eventId, ids, true);
    const data = await (await confirm(sessionId)).json();

    const { POST: pay } = await import("@/app/api/embed/bookings/[bookingId]/test-pay/route");
    const res = await pay(
      req(`/api/embed/bookings/${data.booking_id}/test-pay`, "POST", { userId: ORG, visitorId: VISITOR, outcome: "failed" }),
      params({ bookingId: data.booking_id })
    );
    expect((await res.json()).status).toBe("failed");
    expect(await db.collection("tickets").countDocuments({})).toBe(0);
  });

  it("only the signed-in organizer can finish a test payment, and never a real booking", async () => {
    await db.collection("payment_gateway_configs").insertOne({ org_id: ORG, is_active: true, provider: "stripe" });
    const { eventId, ...ids } = await paid();
    const { sessionId } = await runBooking(eventId, ids, true);
    const data = await (await confirm(sessionId)).json();
    const { POST: pay } = await import("@/app/api/embed/bookings/[bookingId]/test-pay/route");
    const attempt = (userId: string, id = data.booking_id) =>
      pay(req(`/api/embed/bookings/${id}/test-pay`, "POST", { userId, visitorId: VISITOR, outcome: "paid" }), params({ bookingId: id }));

    signedInAs = null;
    expect((await attempt(ORG)).status).toBe(401);
    signedInAs = OTHER;
    expect((await attempt(ORG)).status).toBe(403);

    signedInAs = ORG;
    const real = (
      await db.collection("bookings").insertOne({ org_id: ORG, visitor_id: VISITOR, event_id: eventId, status: "pending_payment", payment_status: "pending", quantity: 1 })
    ).insertedId.toString();
    expect((await attempt(ORG, real)).status).toBe(404);
    expect((await db.collection("bookings").findOne({ _id: new ObjectId(real) }))?.status).toBe("pending_payment");
  });
});
