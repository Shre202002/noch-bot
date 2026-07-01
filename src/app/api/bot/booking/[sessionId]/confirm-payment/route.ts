import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { confirmHold, reconcileExpiredHold } from "@/lib/eventCapacity";
import { issueTicketsForBooking } from "@/lib/ticketIssuance";

/**
 * TEMPORARY SIMULATION ENDPOINT
 * 
 * This endpoint simulates a successful payment confirmation.
 * TODO: Phase 4 - Replace this with real payment-gateway webhook verification (Stripe, Razorpay, etc).
 * This endpoint currently trusts the caller and MUST be removed/disabled before production.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const db = await getDb();

    // 1. Fetch booking
    const booking = await db.collection("bookings").findOne({ session_id: sessionId });
    if (!booking) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 2. Validate current state
    if (booking.status !== 'awaiting_payment') {
      return NextResponse.json({ 
        error: "Invalid status",
        message: `Current status is ${booking.status}. Payment can only be confirmed for bookings awaiting payment.`
      }, { status: 409 });
    }

    // 3. Reconcile Hold Expiry
    const expired = await reconcileExpiredHold(booking._id);
    if (expired) {
      return NextResponse.json({ 
        error: "Expired",
        message: "The booking hold has expired. Payment came in too late."
      }, { status: 410 });
    }

    // 4. Finalize Booking (Simulation)
    const now = new Date();
    
    // a. Convert hold to sale on event
    await confirmHold(booking.event_id, booking.quantity);

    // b. Update booking record
    await db.collection("bookings").updateOne(
      { _id: booking._id },
      {
        $set: {
          status: 'confirmed',
          conversation_state: 'confirmed',
          hold_expires_at: null,
          updated_at: now
        }
      }
    );

    // c. Issue Tickets
    const tickets = await issueTicketsForBooking(booking as any);

    return NextResponse.json({
      success: true,
      message: "Payment confirmed (Simulation)",
      tickets: tickets.map(t => ({
        ticket_code: t.ticket_code
      }))
    });

  } catch (error) {
    console.error("[confirm_payment_simulation]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
