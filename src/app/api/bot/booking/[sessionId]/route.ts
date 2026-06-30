import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const db = await getDb();

    // 1. Fetch the booking session
    const booking = await db.collection("bookings").findOne({ session_id: sessionId });

    if (!booking) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 2. Fetch associated event to check current status
    const event = await db.collection("events").findOne({ _id: booking.event_id });

    if (!event || event.status !== 'published') {
      return NextResponse.json({ 
        status: 'cancelled',
        message: "The event is no longer available for booking."
      });
    }

    // 3. Return current state for hydration
    return NextResponse.json({
      success: true,
      data: {
        session_id: booking.session_id,
        conversation_state: booking.conversation_state,
        quantity: booking.quantity,
        form_responses: booking.form_responses,
        session_context: booking.session_context,
        event_metadata: {
          name: event.name,
          is_paid: event.is_paid,
          currency: event.currency,
          price: event.price
        }
      }
    });

  } catch (error) {
    console.error("[bot_booking_resume]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
