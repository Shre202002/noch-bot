import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { processBookingMessage } from "@/lib/bookingFlow";
import { reserveCapacity, placeHold, reconcileExpiredHold } from "@/lib/eventCapacity";
import { issueTicketsForBooking } from "@/lib/ticketIssuance";

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

    // 1. Fetch booking
    let booking = await db.collection("bookings").findOne({ session_id: sessionId });
    if (!booking) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 2. Passive Hold Reconciliation
    if (booking.status === 'awaiting_payment') {
      const expired = await reconcileExpiredHold(booking._id);
      if (expired) {
        return NextResponse.json({ 
          error: "Session expired",
          message: "Your booking hold has expired. Please restart the process."
        }, { status: 403 });
      }
    }

    if (['confirmed', 'cancelled', 'expired'].includes(booking.status)) {
      return NextResponse.json({ 
        error: "Session inactive",
        message: "This booking session is no longer accepting input."
      }, { status: 403 });
    }

    // 3. Fetch event
    const event = await db.collection("events").findOne({ _id: booking.event_id });
    if (!event || event.status !== 'published') {
      return NextResponse.json({ error: "Event no longer available" }, { status: 410 });
    }

    // 4. Fetch form fields
    const fields = await db.collection("event_form_fields")
      .find({ event_id: event._id })
      .sort({ order_index: 1 })
      .toArray();

    // 5. Process Message (Deterministic Logic)
    const update = processBookingMessage(message, booking as any, event as any, fields as any);

    // 6. Handle Confirmation Phase (with Locking)
    let statusUpdate = booking.status;
    let holdExpiresAt = booking.hold_expires_at;
    let reservationPlaced = false;

    try {
      if (booking.conversation_state === 'reviewing' && update.conversation_state !== 'reviewing') {
        // ATOMIC LOCK: Try to move out of reviewing
        const lockResult = await db.collection("bookings").findOneAndUpdate(
          { _id: booking._id, conversation_state: 'reviewing' },
          { $set: { conversation_state: 'processing_confirmation' } }
        );

        if (!lockResult) {
          return NextResponse.json({ error: "Request already being processed" }, { status: 409 });
        }

        if (event.is_paid) {
          // BMS Hold path
          const holdResult = await placeHold(event._id, booking.quantity);
          if (!holdResult) {
            // Sold out - revert
            await db.collection("bookings").updateOne(
              { _id: booking._id },
              { $set: { conversation_state: 'reviewing' } }
            );
            return NextResponse.json({
              success: true,
              conversation_state: 'reviewing',
              bot_reply: "I'm so sorry, but it looks like the event just sold out while we were talking! We can't complete your booking at this time."
            });
          }
          reservationPlaced = true;
          statusUpdate = 'awaiting_payment';
          update.conversation_state = 'awaiting_payment';
          holdExpiresAt = holdResult.hold_expires_at;
          update.bot_reply = "Great! I've reserved your tickets. Please complete the payment within 5 minutes to confirm your booking.";
        } else {
          // Free event path - immediate sale
          const saleResult = await reserveCapacity(event._id, booking.quantity);
          if (!saleResult) {
            await db.collection("bookings").updateOne(
              { _id: booking._id },
              { $set: { conversation_state: 'reviewing' } }
            );
            return NextResponse.json({
              success: true,
              conversation_state: 'reviewing',
              bot_reply: "I'm so sorry, but it looks like the event just sold out!"
            });
          }
          reservationPlaced = true;
          statusUpdate = 'confirmed';
          update.conversation_state = 'confirmed';
          await issueTicketsForBooking(booking as any);
          update.bot_reply = "Perfect! Your booking is confirmed. Your tickets have been issued.";
        }
      }

      // 7. Persist Updates
      // STOPGAP SAFETY: If this write fails, the catch block below handles the inconsistent state.
      // Phase 4 will replace this with a proper idempotent outbox pattern.
      await db.collection("bookings").updateOne(
        { _id: booking._id },
        {
          $set: {
            status: statusUpdate,
            conversation_state: update.conversation_state,
            session_context: update.session_context,
            quantity: update.quantity,
            form_responses: update.form_responses,
            hold_expires_at: holdExpiresAt,
            updated_at: new Date()
          }
        }
      );
    } catch (persistenceError) {
      if (reservationPlaced) {
        console.error(`[CRASH_STOPGAP] Capacity reserved but booking persistence failed. Manual reconciliation required.
          Booking ID: ${booking._id}
          Event ID: ${event._id}
          Quantity: ${booking.quantity}
          Type: ${event.is_paid ? 'Hold' : 'Direct Sale'}
          Error: ${persistenceError instanceof Error ? persistenceError.message : 'Unknown'}`);
        
        // Best-effort revert of UI state
        try {
          await db.collection("bookings").updateOne(
            { _id: booking._id },
            { $set: { conversation_state: 'reviewing', updated_at: new Date() } }
          );
        } catch (revertError) {
          console.error("[CRASH_STOPGAP] Failed to revert state after crash:", revertError);
        }
      }
      throw persistenceError;
    }

    return NextResponse.json({
      success: true,
      conversation_state: update.conversation_state,
      bot_reply: update.bot_reply,
      status: statusUpdate,
      context: update.session_context 
    });

  } catch (error) {
    console.error("[bot_booking_message]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
