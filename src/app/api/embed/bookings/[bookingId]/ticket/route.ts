import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const visitorId = searchParams.get('visitorId');

  if (!userId || !visitorId) {
    return NextResponse.json({ error: "Missing identity parameters" }, { status: 400, headers: corsHeaders });
  }

  if (!ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400, headers: corsHeaders });
  }

  try {
    const db = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
      org_id: userId,
      visitor_id: visitorId
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404, headers: corsHeaders });
    }

    const isConfirmed = booking.status === "confirmed";
    const isPaidIfRequired = booking.payment_status === "not_required" || booking.payment_status === "paid";

    if (!isConfirmed || !isPaidIfRequired) {
      return NextResponse.json({ 
        error: "Ticket is not available until booking is confirmed and paid." 
      }, { status: 409, headers: corsHeaders });
    }

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
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("[ticket_api_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
