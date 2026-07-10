import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { Booking } from "@/models/Booking";
import { stripeAdapter } from "@/lib/payments/stripe";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { paypalAdapter } from "@/lib/payments/paypal";
import { cashfreeAdapter } from "@/lib/payments/cashfree";
import { decryptCredentials } from "@/lib/credentialCrypto";
import crypto from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const adapters: Record<string, any> = {
  stripe: stripeAdapter,
  razorpay: razorpayAdapter,
  paypal: paypalAdapter,
  cashfree: cashfreeAdapter
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, visitorId } = body;

    if (!userId || !visitorId) {
      return NextResponse.json({ error: "Missing identity" }, { status: 400, headers: corsHeaders });
    }

    const db = await getDb();

    const session = await db.collection("booking_sessions").findOne({
      _id: new ObjectId(sessionId),
      org_id: userId,
      visitor_id: visitorId,
      expires_at: { $gt: new Date() }
    });

    if (!session || !session.event_id) {
      return NextResponse.json({ error: "Invalid or expired booking session" }, { status: 404, headers: corsHeaders });
    }

    // 1. HARDEN EVENT LOOKUP: Check ownership, published status and expiration
    const event = await db.collection("events").findOne({ 
      _id: session.event_id,
      org_id: userId,
      status: "published"
    });

    if (!event) {
      return NextResponse.json({ error: "Event is no longer available" }, { status: 410, headers: corsHeaders });
    }

    if (new Date(event.end_at) < new Date()) {
      return NextResponse.json({ error: "Event has already ended" }, { status: 410, headers: corsHeaders });
    }

    // Capacity Check using Aggregation
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
      }, { status: 409, headers: corsHeaders });
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
        { $set: { status: "confirmed", current_step: "complete", booking_id: bookingId, updated_at: new Date() } }
      );
      return NextResponse.json({
        status: "confirmed",
        booking_id: bookingId.toString(),
        booking_code: bookingCode,
        download_url: `/api/embed/bookings/${bookingId}/ticket?userId=${userId}&visitorId=${visitorId}`
      }, { headers: corsHeaders });
    }

    // Paid Event - Initiate Checkout
    const gateway = await db.collection("payment_gateway_configs").findOne({ 
      org_id: userId, 
      is_active: true 
    });

    if (!gateway || !adapters[gateway.provider]) {
      // HANDLE CHECKOUT FAILURE
      await db.collection("bookings").updateOne({ _id: bookingId }, { $set: { status: "failed", payment_status: "failed" } });
      await db.collection("booking_sessions").updateOne({ _id: session._id }, { $set: { status: "failed", current_step: "payment", updated_at: new Date() } });
      return NextResponse.json({ error: "Payment gateway not configured or unsupported" }, { status: 500, headers: corsHeaders });
    }

    const credentials = await decryptCredentials(gateway.credentials);
    const adapter = adapters[gateway.provider];

    try {
      const checkout = await adapter.createCheckoutSession({
        bookingId: bookingId.toString(),
        orgId: userId,
        amount: amountTotal,
        currency: event.currency,
        eventName: event.name,
        quantity: session.quantity,
        successUrl: `${process.env.NEXTAUTH_URL}/booking/success?bid=${bookingId}`,
        cancelUrl: `${process.env.NEXTAUTH_URL}/booking/cancel?bid=${bookingId}`,
        customerEmail: session.answers.find((a: any) => a.validation_rule === 'email_format')?.value
      }, credentials);

      // SAVE COMPLETE PAYMENT OBJECT ON BOOKING
      const paymentObj = {
        provider: gateway.provider,
        checkout_url: checkout.checkoutUrl,
        provider_order_id: checkout.providerOrderId, 
        provider_reference: checkout.providerReference
      };

      await db.collection("bookings").updateOne(
        { _id: bookingId },
        { $set: { payment: paymentObj } }
      );

      await db.collection("booking_sessions").updateOne(
        { _id: session._id },
        { 
          $set: { 
            status: "checkout_pending", 
            current_step: "payment", 
            booking_id: bookingId, 
            checkout_url: checkout.checkoutUrl,
            updated_at: new Date() 
          } 
        }
      );

      // SAVE COMPLETE PAYMENT ATTEMPT DATA
      await db.collection("payment_attempts").insertOne({
        org_id: userId,
        event_id: event._id,
        booking_id: bookingId,
        provider: gateway.provider,
        mode: gateway.mode,
        amount: amountTotal,
        currency: event.currency,
        provider_order_id: checkout.providerOrderId,
        provider_reference: checkout.providerReference,
        checkout_url: checkout.checkoutUrl,
        status: "checkout_pending",
        raw_create_response: checkout.rawResponse,
        created_at: new Date(),
        updated_at: new Date()
      });

      return NextResponse.json({
        status: "checkout_pending",
        booking_id: bookingId.toString(),
        booking_code: bookingCode,
        checkoutUrl: checkout.checkoutUrl
      }, { headers: corsHeaders });
    } catch (paymentErr: any) {
      console.error("[checkout_error]", paymentErr);
      await db.collection("bookings").updateOne({ _id: bookingId }, { $set: { status: "failed", payment_status: "failed" } });
      await db.collection("booking_sessions").updateOne({ _id: session._id }, { $set: { status: "failed", current_step: "payment", updated_at: new Date() } });
      return NextResponse.json({ error: "Failed to initiate payment session." }, { status: 500, headers: corsHeaders });
    }

  } catch (error: any) {
    console.error("[confirm_api_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
