import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { processBookingMessage } from "@/lib/bookingFlow";
import { reserveCapacity } from "@/lib/eventCapacity";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const db = await getDb();

    // 1. Fetch booking and validate status
    const booking = await db.collection("bookings").findOne({ session_id: sessionId });
    if (!booking) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (['confirmed', 'cancelled', 'expired'].includes(booking.status)) {
      return NextResponse.json({ 
        error: "Session inactive",
        message: "This booking session is no longer accepting input."
      }, { status: 403 });
    }

    // 2. Fetch event and re-verify status
    const event = await db.collection("events").findOne({ _id: booking.event_id });
    if (!event || event.status !== 'published') {
      return NextResponse.json({ error: "Event no longer available" }, { status: 410 });
    }

    // 3. Fetch form fields
    const fields = await db.collection("event_form_fields")
      .find({ event_id: event._id })
      .sort({ order_index: 1 })
      .toArray();

    // 4. Process Message
    const update = processBookingMessage(message, booking as any, event as any, fields as any);

    // ── Phase 3 Checkpoint 3: Atomic Capacity Reservation ──
    let statusUpdate = booking.status;
    
    // Check if the conversation is transitioning from Review to the final booking steps
    if (
      booking.conversation_state === 'reviewing' && 
      ['awaiting_payment', 'confirmed'].includes(update.conversation_state)
    ) {
      // Reserve seats atomically
      const reservation = await reserveCapacity(event._id, booking.quantity);
      
      if (!reservation) {
        // Sold out during the review process
        update.conversation_state = 'reviewing';
        update.bot_reply = "I'm so sorry, but it looks like the event just sold out while we were talking! We can't complete your booking at this time.";
      } else {
        // Reservation successful - update the record's lifecycle status
        statusUpdate = update.conversation_state === 'awaiting_payment' ? 'awaiting_payment' : 'confirmed';
      }
    }

    // 5. Persist Updates
    await db.collection("bookings").updateOne(
      { _id: booking._id },
      {
        $set: {
          status: statusUpdate,
          conversation_state: update.conversation_state,
          session_context: update.session_context,
          quantity: update.quantity,
          form_responses: update.form_responses,
          updated_at: new Date()
        }
      }
    );

    // 6. Return response to widget
    return NextResponse.json({
      success: true,
      conversation_state: update.conversation_state,
      bot_reply: update.bot_reply,
      status: statusUpdate,
      // Pass back context for widget UI state synchronization if needed
      context: update.session_context 
    });

  } catch (error) {
    console.error("[bot_booking_message]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
