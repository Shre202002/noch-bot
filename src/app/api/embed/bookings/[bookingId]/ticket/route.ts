import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;

  if (!ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId)
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const isConfirmed = booking.status === "confirmed";
    const isPaidIfRequired = booking.payment_status === "not_required" || booking.payment_status === "paid";

    if (!isConfirmed || !isPaidIfRequired) {
      return NextResponse.json({ 
        error: "Ticket is not available until booking is confirmed and paid." 
      }, { status: 409 });
    }

    // In a real implementation, this would generate a PDF or dynamic image.
    // For now, we return the booking data which the client can use to render a ticket view.
    return NextResponse.json({
      success: true,
      ticket_data: {
        booking_code: booking.booking_code,
        event_name: booking.event_snapshot.name,
        date: booking.event_snapshot.start_at,
        venue: booking.event_snapshot.venue,
        attendee: booking.attendee,
        quantity: booking.quantity,
        ticket_codes: booking.ticket_codes,
        template_id: booking.event_snapshot.ticket_template_id
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
