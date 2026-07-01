import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reconcileExpiredHold } from "@/lib/eventCapacity";

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

    // 2. Passive reconciliation for paid holds
    if (booking.status === 'awaiting_payment') {
      const expired = await reconcileExpiredHold(booking._id);
      if (expired) {
        return NextResponse.json({
          status: 'expired',
          message: "This booking hold has expired."
        }, { status: 200 });
      }
    }

    // 3. Check booking's lifecycle status
    if (['confirmed', 'cancelled', 'expired'].includes(booking.status)) {
      return NextResponse.json({
        status: booking.status,
        message: booking.status === 'confirmed'
          ? "This booking is already confirmed."
          : "This booking session is no longer active."
      }, { status: 200 });
    }

    // 4. Fetch associated event to check current status
    const event = await db.collection("events").findOne({ _id: booking.event_id });

    if (!event || event.status !== 'published') {
      return NextResponse.json({ 
        status: 'cancelled',
        message: "The event is no longer available for booking."
      }, { status: 200 });
    }

    // 5. Return current state for hydration
    return NextResponse.json({
      success: true,
      data: {
        session_id: booking.session_id,
        conversation_state: booking.conversation_state,
        quantity: booking.quantity,
        form_responses: booking.form_responses,
        session_context: booking.session_context,
        hold_expires_at: booking.hold_expires_at,
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
