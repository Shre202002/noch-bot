import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { getDb } from "@/lib/db";
import { issueTicketsForBooking, IssuableBooking } from "@/lib/ticketIssuance";
import { Ticket } from "@/models/Ticket";

const QR_SECRET = "vitest-qr-secret"; // set in vitest.config.ts (module-level check)

beforeAll(async () => {
  await startTestMongo();
});

afterAll(async () => {
  await stopTestMongo();
});

function makeBooking(quantity: number, eventId?: ObjectId): IssuableBooking {
  return {
    _id: new ObjectId(),
    event_id: eventId ?? new ObjectId(),
    quantity,
  };
}

async function ticketsFor(bookingId: ObjectId): Promise<Ticket[]> {
  const db = await getDb();
  return (await db
    .collection("tickets")
    .find({ booking_id: bookingId })
    .sort({ ticket_index: 1 })
    .toArray()) as unknown as Ticket[];
}

describe("issueTicketsForBooking", () => {
  it("issues exactly `quantity` tickets with correct indices", async () => {
    const booking = makeBooking(3);
    const tickets = await issueTicketsForBooking(booking);

    expect(tickets).toHaveLength(3);
    expect(tickets.map((t) => t.ticket_index)).toEqual([0, 1, 2]);

    const stored = await ticketsFor(booking._id!);
    expect(stored).toHaveLength(3);
  });

  it("creates codes from the unambiguous charset with the EVT- prefix", async () => {
    const booking = makeBooking(5);
    const tickets = await issueTicketsForBooking(booking);

    const ambiguous = /[0O1IL]/;
    for (const t of tickets) {
      expect(t.ticket_code).toMatch(/^EVT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
      expect(t.ticket_code).not.toMatch(ambiguous);
      expect(t.status).toBe("active");
    }
  });

  it("computes the QR payload hash as HMAC-SHA256 of code:booking:event", async () => {
    const crypto = await import("crypto");
    const booking = makeBooking(1);
    const [ticket] = await issueTicketsForBooking(booking);

    const expected = crypto
      .createHmac("sha256", QR_SECRET)
      .update(`${ticket.ticket_code}:${booking._id}:${booking.event_id}`)
      .digest("hex");

    expect(ticket.qr_payload_hash).toBe(expected);
    expect(ticket.qr_payload_hash).toHaveLength(64);
  });

  it("is idempotent: calling twice does not duplicate tickets", async () => {
    const booking = makeBooking(2);
    const first = await issueTicketsForBooking(booking);
    const second = await issueTicketsForBooking(booking);

    expect(second).toHaveLength(2);
    // Same documents returned (same _ids), not freshly issued ones
    expect(second.map((t) => t._id!.toString()).sort()).toEqual(
      first.map((t) => t._id!.toString()).sort()
    );

    const stored = await ticketsFor(booking._id!);
    expect(stored).toHaveLength(2);
  });

  it("tops up missing indices when called after a partial issuance", async () => {
    const booking = makeBooking(3);
    const db = await getDb();

    // Simulate a crash after only ticket_index 0 was written
    const [first] = await issueTicketsForBooking({ ...booking, quantity: 1 });
    expect(first.ticket_index).toBe(0);

    // Re-run for the full quantity: should keep index 0 and add 1, 2
    const all = await issueTicketsForBooking(booking);
    expect(all).toHaveLength(3);
    expect(all.map((t) => t.ticket_index).sort()).toEqual([0, 1, 2]);
    expect(all.find((t) => t.ticket_index === 0)!._id!.toString()).toBe(
      first._id!.toString()
    );

    const stored = await db.collection("tickets").countDocuments({ booking_id: booking._id });
    expect(stored).toBe(3);
  });

  it("rejects bookings with no _id (defensive)", async () => {
    // _id is optional on the interface but required for issuance; ensure we fail loudly
    const booking: IssuableBooking = { event_id: new ObjectId(), quantity: 1, _id: undefined };
    await expect(issueTicketsForBooking(booking)).rejects.toThrow();
  });
});
