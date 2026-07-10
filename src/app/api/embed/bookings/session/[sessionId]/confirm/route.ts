import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { Booking } from "@/models/Booking";
import { stripeAdapter } from "@/lib/payments/stripe";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { decryptCredentials } from "@/lib/credentialCrypto";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const body = await req.json();
    const { userId, visitorId } = body;
    const db = await getDb();

    const session = await db.collection("booking_sessions").findOne({
      _id: new ObjectId(sessionId),
      org_id: userId,
      visitor_id: visitorId,
      expires_at: { $gt: new Date() }
    });

    if (!session || !session.event_id) {
      return NextResponse.json({ error: "Invalid or expired booking session" }, { status: 404 });
    }

    const event = await db.collection("events").findOne({ _id: session.event_id });
    if (!event || event.status !== "published") {
      return NextResponse.json({ error: "Event is no longer available" }, { status: 410 });
    }

    // Capacity Check - Summing quantities correctly
    const activeBookingsResult = await db.collection("bookings").aggregate([
      {
        $match: {
          event_id: event._id,
          status: { $in: ["confirmed", "pending_payment"] },
          $or: [
            { expires_at: { $gt: new Date() } },
            { expires_at: { $exists: false } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" }
        }
      }
    ]).toArray();

    const reservedSeats = activeBookingsResult.length > 0 ? activeBookingsResult[0].totalQuantity : 0;

    if (event.capacity - reservedSeats < session.quantity) {
      return NextResponse.json({ 
        error: "Not enough seats available", 
        available_seats: Math.max(0, event.capacity - reservedSeats) 
      }, { status: 409 });
    }

    const bookingCode = `NBK-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const amountTotal = event.is_paid ? (event.price || 0) * session.quantity : 0;

    const newBooking: Booking = {
      org_id: userId,
      event_id: event._id,
      visitor_id: visitorId,
      booking_session_id: session._id,
      booking_code: bookingCode,
      status: event.is_paid ? "pending_payment" : "confirmed",
      payment_status: event.is_paid ? "pending" : "not_required",
      event_snapshot: {
        name: event.name,
        start_at: event.start_at,
        end_at: event.end_at,
        venue: event.venue,
        price: event.price,
        currency: event.currency,
        ticket_template_id: event.ticket_template_id
      },
      attendee: {
        answers: session.answers
      },
      quantity: session.quantity,
      amount_total: amountTotal,
      currency: event.currency,
      ticket_codes: Array.from({ length: session.quantity }).map(() => `EVT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`),
      source: "chat_widget",
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: event.is_paid ? undefined : new Date(),
      expires_at: event.is_paid ? new Date(Date.now() + 15 * 60000) : undefined
    };

    const result = await db.collection("bookings").insertOne(newBooking);
    const bookingId = result.insertedId;

    if (!event.is_paid) {
      await db.collection("booking_sessions").updateOne(
        { _id: session._id },
        { $set: { status: "confirmed", current_step: "complete" } }
      );
      return NextResponse.json({
        status: "confirmed",
        booking_id: bookingId.toString(),
        booking_code: bookingCode,
        download_url: `/api/embed/bookings/${bookingId}/ticket`
      });
    }

    // Paid Event - Initiate Checkout
    const gateway = await db.collection("payment_gateway_configs").findOne({ 
      org_id: userId, 
      is_active: true 
    });

    if (!gateway) {
      return NextResponse.json({ error: "Payment gateway not configured for this organizer." }, { status: 500 });
    }

    const credentials = await decryptCredentials(gateway.credentials);
    const adapter = gateway.provider === "stripe" ? stripeAdapter : razorpayAdapter;

    try {
      const checkout = await adapter.createCheckoutSession({
        bookingId: bookingId.toString(),
        orgId: userId,
        amount: amountTotal,
        currency: event.currency,
        eventName: event.name,
        quantity: session.quantity,
        successUrl: `${process.env.NEXTAUTH_URL}/booking/success?bid=${bookingId}`,
        cancelUrl: `${process.env.NEXTAUTH_URL}/booking/cancel?bid=${bookingId}`
      }, credentials);

      await db.collection("bookings").updateOne(
        { _id: bookingId },
        { 
          $set: { 
            "payment.checkout_url": checkout.checkoutUrl, 
            "payment.provider": gateway.provider,
            "payment.provider_reference": checkout.providerReference 
          } 
        }
      );

      // Log payment attempt
      await db.collection("payment_attempts").insertOne({
        org_id: userId,
        event_id: event._id,
        booking_id: bookingId,
        provider: gateway.provider,
        amount: amountTotal,
        currency: event.currency,
        checkout_url: checkout.checkoutUrl,
        status: "checkout_pending",
        created_at: new Date(),
        updated_at: new Date()
      });

      return NextResponse.json({
        status: "checkout_pending",
        booking_id: bookingId.toString(),
        booking_code: bookingCode,
        checkoutUrl: checkout.checkoutUrl
      });
    } catch (paymentErr: any) {
      console.error("[checkout_init_failed]", paymentErr);
      return NextResponse.json({ error: "Failed to initiate payment session." }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[confirm_booking_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
