/**
 * End-to-end check of a free event booked through the website widget, using the real route handlers in the order
 * the widget calls them: start session → choose quantity → answer the form → confirm → view ticket → scan at the door.
 * Only email is replaced (captured instead of sent).
 */
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { ObjectId, type Db } from "mongodb";
import { NextRequest } from "next/server";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

const sendTicketEmail = vi.fn(async (_data: unknown) => {});
vi.mock("@/lib/mailer", () => ({ sendTicketEmail, sendOrganizerAlertEmail: vi.fn() }));

// The first import of each route compiles a lot of server code; allow for slow machines.
vi.setConfig({ testTimeout: 120_000 });

const ORG = "org-free-1";
const VISITOR = "visitor-abc";
const BASE = "http://localhost:9002";
let db: Db;
let eventId: ObjectId;
let emailFieldId: string;
let nameFieldId: string;

const json = (url: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

beforeAll(async () => {
  process.env.NEXTAUTH_URL = BASE; // used to build the ticket link in the email
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  db = await getDb();
  const now = Date.now();
  eventId = (await db.collection("events").insertOne({
    org_id: ORG, name: "Community Meetup", description: "", status: "published",
    start_at: new Date(now + 7 * 86400_000), end_at: new Date(now + 7 * 86400_000 + 3 * 3600_000),
    venue: "Hall B", capacity: 3, tickets_sold: 0, tickets_held: 0,
    is_paid: false, price: null, currency: "INR", allow_group_booking: true, max_tickets_per_booking: null,
    ticket_template_id: "dark", created_at: new Date(), updated_at: new Date(),
  })).insertedId;
  const fields = await db.collection("event_form_fields").insertMany([
    { event_id: eventId, label: "Full name", field_key: "name", field_type: "text", is_required: true, validation_rule: "name_format", order_index: 0 },
    { event_id: eventId, label: "Email", field_key: "email", field_type: "email", is_required: true, validation_rule: "email_format", order_index: 1 },
  ]);
  nameFieldId = fields.insertedIds[0].toString();
  emailFieldId = fields.insertedIds[1].toString();
});

afterAll(async () => {
  await stopTestMongo();
});

describe("free event booking through the website widget", () => {
  let sessionId: string;
  let bookingId: string;
  let ticketCodes: string[];

  it("starts a booking session for the event", async () => {
    const { POST } = await import("@/app/api/embed/bookings/session/route");
    const res = await POST(json("/api/embed/bookings/session", "POST", { userId: ORG, visitorId: VISITOR, eventId: eventId.toString() }));
    const data = await res.json();
    expect(res.status).toBe(200);
    sessionId = data.session_id;
    expect(data.current_step).toBe("quantity");
  });

  it("collects quantity and the registration form, rejecting an invalid email", async () => {
    const { PATCH } = await import("@/app/api/embed/bookings/session/[sessionId]/route");
    const step = (body: Record<string, unknown>) =>
      PATCH(json(`/api/embed/bookings/session/${sessionId}`, "PATCH", { userId: ORG, visitorId: VISITOR, ...body }), params({ sessionId }));

    expect((await step({ action: "set_quantity", quantity: 2 })).status).toBe(200);
    // Two tickets: both names come first, then both emails.
    expect((await step({ action: "answer_field", fieldId: nameFieldId, value: "Asha Rao" })).status).toBe(200);
    const secondName = await (await step({ action: "answer_field", fieldId: nameFieldId, value: "Ravi Rao" })).json();
    expect(secondName).toMatchObject({ current_field_index: 1, current_attendee_index: 0 });
    expect((await step({ action: "answer_field", fieldId: emailFieldId, value: "not-an-email" })).status).toBe(400);
    expect((await step({ action: "answer_field", fieldId: emailFieldId, value: "asha@example.com" })).status).toBe(200);
    const done = await step({ action: "answer_field", fieldId: emailFieldId, value: "ravi@example.com" });
    const session = await done.json();
    expect(session.current_step).toBe("summary");
    expect(session.answers.filter((a: any) => a.attendee === 2).map((a: any) => a.value)).toEqual(["Ravi Rao", "ravi@example.com"]);
  });

  it("confirms immediately, issues 2 signed tickets, counts the seats and emails the attendee", async () => {
    const { POST } = await import("@/app/api/embed/bookings/session/[sessionId]/confirm/route");
    const res = await POST(json(`/api/embed/bookings/session/${sessionId}/confirm`, "POST", { userId: ORG, visitorId: VISITOR }), params({ sessionId }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("confirmed");
    bookingId = data.booking_id;
    expect(data.ticket_page_url).toBe(`/booking/ticket/${bookingId}?userId=${ORG}&visitorId=${VISITOR}`);
    expect(data.ticket_pdf_url).toBe(`/booking/ticket/${bookingId}?userId=${ORG}&visitorId=${VISITOR}&download=1`);
    expect(data.emailed_to).toBe("asha@example.com");

    const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
    ticketCodes = booking!.ticket_codes;
    expect(ticketCodes).toHaveLength(2);
    expect(await db.collection("tickets").countDocuments({ booking_id: booking!._id })).toBe(2);
    expect(await db.collection("events").findOne({ _id: eventId })).toMatchObject({ tickets_sold: 2, tickets_held: 0 });

    // Each attendee is emailed their own ticket; only the booker gets the link to the whole booking.
    expect(sendTicketEmail).toHaveBeenCalledTimes(2);
    const [first, second] = sendTicketEmail.mock.calls.map((c) => c[0] as Record<string, any>);
    expect(first).toMatchObject({ to: "asha@example.com", eventName: "Community Meetup", quantity: 1, ticketCodes: [ticketCodes[0]] });
    expect(first.ticketUrl).toContain(`/booking/ticket/${bookingId}`);
    expect(second).toMatchObject({ to: "ravi@example.com", quantity: 1, ticketCodes: [ticketCodes[1]], ticketUrl: null });
  });

  it("shows the tickets on the ticket page API", async () => {
    const { GET } = await import("@/app/api/embed/bookings/[bookingId]/ticket/route");
    const res = await GET(json(`/api/embed/bookings/${bookingId}/ticket?userId=${ORG}&visitorId=${VISITOR}`, "GET"), params({ bookingId }));
    expect(res.status).toBe(200);
    expect((await res.json()).ticket_data.ticket_codes).toEqual(ticketCodes);
  });

  it("refuses to oversell: only 1 seat is left for a second visitor asking for 2", async () => {
    const { POST: start } = await import("@/app/api/embed/bookings/session/route");
    const { PATCH } = await import("@/app/api/embed/bookings/session/[sessionId]/route");
    const { POST: confirm } = await import("@/app/api/embed/bookings/session/[sessionId]/confirm/route");
    const other = "visitor-xyz";
    const s = await (await start(json("/api/embed/bookings/session", "POST", { userId: ORG, visitorId: other, eventId: eventId.toString() }))).json();
    const step = (body: Record<string, unknown>) =>
      PATCH(json(`/api/embed/bookings/session/${s.session_id}`, "PATCH", { userId: ORG, visitorId: other, ...body }), params({ sessionId: s.session_id }));
    await step({ action: "set_quantity", quantity: 2 });
    for (const [fieldId, value] of [[nameFieldId, "Ben Lee"], [nameFieldId, "Amy Lee"], [emailFieldId, "ben@example.com"], [emailFieldId, "amy@example.com"]]) {
      await step({ action: "answer_field", fieldId, value });
    }

    const res = await confirm(json(`/api/embed/bookings/session/${s.session_id}/confirm`, "POST", { userId: ORG, visitorId: other }), params({ sessionId: s.session_id }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ available_seats: 1 });
  });

  it("scans each ticket once at the door and rejects a second scan", async () => {
    const token = "staff-token-123";
    await db.collection("scanner_staff").insertOne({
      event_id: eventId, name: "Door 1", access_token: crypto.createHash("sha256").update(token).digest("hex"),
    });
    const { POST } = await import("@/app/api/scanner/tickets/[ticketCode]/scan/route");
    const scan = (code: string) =>
      POST(json(`/api/scanner/tickets/${code}/scan`, "POST", { client_scan_id: `scan-${code}` }, { Authorization: `Bearer ${token}` }), params({ ticketCode: code }));

    expect((await scan(ticketCodes[0])).status).toBe(200);
    expect((await scan(ticketCodes[1])).status).toBe(200);
    const again = await POST(
      json(`/api/scanner/tickets/${ticketCodes[0]}/scan`, "POST", { client_scan_id: "different-device" }, { Authorization: `Bearer ${token}` }),
      params({ ticketCode: ticketCodes[0] })
    );
    expect(again.status).toBe(409);
    expect((await again.json()).reason).toBe("scanned");
  });

  it("downloads the tickets as a 2-page PDF, only for the visitor who booked", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const { GET } = await import("@/app/api/embed/bookings/[bookingId]/ticket/pdf/route");
    const res = await GET(json(`/booking/ticket/${bookingId}?userId=${ORG}&visitorId=${VISITOR}&download=1`, "GET"), params({ bookingId }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="tickets-NBK-/);
    const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
    expect(doc.getPageCount()).toBe(2);

    const stranger = await GET(json(`/api/embed/bookings/${bookingId}/ticket/pdf?userId=${ORG}&visitorId=someone-else`, "GET"), params({ bookingId }));
    expect(stranger.status).toBe(404);
  });

  it("status check on an overdue paid checkout expires it and gives its held seats back", async () => {
    const paidEventId = (await db.collection("events").insertOne({
      org_id: ORG, name: "Paid Workshop", status: "published", start_at: new Date(Date.now() + 86400_000),
      end_at: new Date(Date.now() + 2 * 86400_000), capacity: 5, tickets_sold: 0, tickets_held: 2, is_paid: true, price: 300, currency: "INR",
    })).insertedId;
    const overdueId = (await db.collection("bookings").insertOne({
      org_id: ORG, visitor_id: VISITOR, event_id: paidEventId, quantity: 2, status: "pending_payment",
      payment_status: "pending", hold_placed: true, expires_at: new Date(Date.now() - 60_000),
    })).insertedId.toString();

    const { GET } = await import("@/app/api/embed/bookings/[bookingId]/status/route");
    const res = await GET(json(`/api/embed/bookings/${overdueId}/status?userId=${ORG}&visitorId=${VISITOR}`, "GET"), params({ bookingId: overdueId }));
    expect((await res.json()).status).toBe("expired");
    expect((await db.collection("events").findOne({ _id: paidEventId }))!.tickets_held).toBe(0);
  });
});

