import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { buildTicketPdf } from "@/lib/ticketPdf";
import { attendeeNameFrom } from "@/lib/ticketLinks";

export const runtime = "nodejs";

// GET /api/embed/bookings/[bookingId]/ticket/pdf?userId&visitorId
// The booking's tickets as a PDF download (one page per ticket, QR included). Same access rule as the ticket page:
// the organizer id and the visitor id the booking was made with, and only once it is confirmed (and paid if due).
export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const visitorId = searchParams.get("visitorId");
  if (!userId || !visitorId || !ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  try {
    const db = await getDb();
    const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId), org_id: userId, visitor_id: visitorId });
    if (!booking) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const paidIfRequired = booking.payment_status === "not_required" || booking.payment_status === "paid";
    if (booking.status !== "confirmed" || !paidIfRequired) {
      return NextResponse.json({ error: "Tickets are available once the booking is confirmed." }, { status: 409 });
    }

    const [event, tickets] = await Promise.all([
      db.collection("events").findOne({ _id: booking.event_id, org_id: userId }),
      db.collection("tickets").find({ booking_id: booking._id }).sort({ ticket_index: 1 }).toArray(),
    ]);
    const codes: string[] = tickets.length ? tickets.map((t) => t.ticket_code) : booking.ticket_codes ?? [];
    if (codes.length === 0) {
      return NextResponse.json({ error: "Tickets are still being issued. Please try again in a moment." }, { status: 409 });
    }

    const pdf = await buildTicketPdf({
      eventName: event?.name ?? booking.event_snapshot?.name ?? "Event ticket",
      startAt: event?.start_at ?? booking.event_snapshot?.start_at ?? null,
      venue: event?.venue ?? booking.event_snapshot?.venue ?? null,
      bookingCode: booking.booking_code ?? null,
      attendeeName: attendeeNameFrom(booking.attendee?.answers),
      ticketCodes: codes,
      accentColor: event?.ticket_color_palette?.accent_color ?? null,
    });

    const fileName = `tickets-${String(booking.booking_code ?? bookingId).replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[ticket_pdf_error]", error);
    return NextResponse.json({ error: "Could not create the ticket PDF." }, { status: 500 });
  }
}
