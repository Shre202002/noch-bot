import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkInTicket, reconcileBooking, undoCheckIn } from "@/lib/organizerBookings";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string, bookingId: string }> }
) {
  const routeParams = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(routeParams.id) || !ObjectId.isValid(routeParams.bookingId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(routeParams.id);
    const bookingId = new ObjectId(routeParams.bookingId);

    // 1. Verify event ownership
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // 2. Fetch booking (full)
    const booking = await db.collection("bookings").findOne({
      _id: bookingId,
      event_id: eventId
    });

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    // 3. Fetch linked tickets
    const tickets = await db.collection("tickets")
      .find({ booking_id: bookingId })
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        ...booking,
        tickets
      }
    });
  } catch (error) {
    console.error("[booking_get_detail]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


const CHECK_IN_MESSAGES = {
  checked_in: "Checked in.",
  already_checked_in: "This ticket was already checked in.",
  booking_not_confirmed: "This booking is not confirmed, so its tickets cannot be checked in.",
  ticket_void: "This ticket is no longer valid.",
  test_ticket: "This is a test ticket, so it cannot be checked in.",
  not_found: "Ticket not found for this event.",
} as const;

// PATCH /api/events/[id]/bookings/[bookingId]
// Body: { action: "check_in" | "undo_check_in", ticket_code } or { action: "mark_refunded" | "cancel" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  const routeParams = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(routeParams.id) || !ObjectId.isValid(routeParams.bookingId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    const ticketCode = typeof body.ticket_code === "string" ? body.ticket_code.trim().toUpperCase() : "";

    const db = await getDb();
    const eventId = new ObjectId(routeParams.id);
    const bookingId = new ObjectId(routeParams.bookingId);

    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (action === "mark_refunded" || action === "cancel") {
      const result = await reconcileBooking(db, eventId, bookingId, action, userId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.code === "not_found" ? 404 : 409 });
      }
      return NextResponse.json({ success: true, status: result.status });
    }

    if (action === "check_in" || action === "undo_check_in") {
      if (!ticketCode) return NextResponse.json({ error: "ticket_code is required." }, { status: 400 });
      // The ticket must belong to this booking, not just this event.
      const ticket = await db.collection("tickets").findOne({ ticket_code: ticketCode, event_id: eventId, booking_id: bookingId });
      if (!ticket) return NextResponse.json({ error: CHECK_IN_MESSAGES.not_found }, { status: 404 });

      if (action === "undo_check_in") {
        const undone = await undoCheckIn(db, eventId, ticketCode);
        return undone
          ? NextResponse.json({ success: true })
          : NextResponse.json({ error: "This ticket is not checked in." }, { status: 409 });
      }

      const result = await checkInTicket(db, eventId, ticketCode, userId);
      const ok = result.outcome === "checked_in";
      return NextResponse.json(
        ok ? { success: true, outcome: result.outcome } : { error: CHECK_IN_MESSAGES[result.outcome], outcome: result.outcome },
        { status: ok ? 200 : result.outcome === "not_found" ? 404 : 409 }
      );
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("[booking_patch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
