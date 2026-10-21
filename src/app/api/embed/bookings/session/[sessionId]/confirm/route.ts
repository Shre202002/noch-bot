import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { Booking } from "@/models/Booking";
import { stripeAdapter } from "@/lib/payments/stripe";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { paypalAdapter } from "@/lib/payments/paypal";
import { cashfreeAdapter } from "@/lib/payments/cashfree";
import { decryptCredentials } from "@/lib/credentialCrypto";
import { placeHold, releaseExpiredHolds, releaseHold, reserveCapacity } from "@/lib/eventCapacity";
import { issueTicketsForBooking } from "@/lib/ticketIssuance";
import { notifyBookingConfirmed } from "@/lib/bookingNotifications";
import { ticketPageUrl, ticketPdfUrl } from "@/lib/ticketLinks";
import crypto from "crypto";

/** Minutes a paid booking's seats stay held while the visitor pays. */
const PAYMENT_HOLD_MINUTES = 15;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const adapters: Record<string, any> = {
  stripe: stripeAdapter,
  razorpay: razorpayAdapter,
  paypal: paypalAdapter,
  cashfree: cashfreeAdapter,
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

    // Free bookings issue signed tickets right away; refuse before taking seats if signing is not configured.
    if (!event.is_paid && !process.env.TICKET_QR_SECRET) {
      console.error("[confirm_api_error] TICKET_QR_SECRET is not set; cannot issue tickets");
      return NextResponse.json({ error: "Ticketing is temporarily unavailable. Please try again later." }, { status: 503, headers: corsHeaders });
    }

    // Capacity: give back seats from abandoned checkouts, then take seats atomically on the event counters
    // (sold for free events, held for paid ones), so two visitors can never both get the last seats.
    await releaseExpiredHolds(event._id);
    const holdExpiresAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60000);
    const taken = event.is_paid
      ? await placeHold(event._id, session.quantity, PAYMENT_HOLD_MINUTES)
      : await reserveCapacity(event._id, session.quantity);

    if (!taken) {
      const latest = await db.collection("events").findOne({ _id: event._id });
      const available = latest ? latest.capacity - (latest.tickets_sold ?? 0) - (latest.tickets_held ?? 0) : 0;
      return NextResponse.json({
        error: "Not enough seats available",
        available_seats: Math.max(0, available)
      }, { status: 409, headers: corsHeaders });
    }
    /** Give the seats back if this booking cannot go ahead. */
    const returnSeats = () => event.is_paid
      ? releaseHold(event._id, session.quantity)
      : db.collection("events").updateOne({ _id: event._id, tickets_sold: { $gte: session.quantity } }, { $inc: { tickets_sold: -session.quantity } });

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
      // Real, scannable codes are issued into `tickets` once the booking is confirmed.
      ticket_codes: [],
      source: "chat_widget",
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_at: event.is_paid ? undefined : new Date(),
      expires_at: event.is_paid ? holdExpiresAt : undefined,
      hold_placed: event.is_paid ? true : undefined
    };

    let bookingId: ObjectId;
    try {
      const result = await db.collection("bookings").insertOne(newBooking);
      bookingId = result.insertedId;
    } catch (insertError) {
      await returnSeats();
      throw insertError;
    }

    /** Mark a paid booking failed and give its held seats back (only once, and only while still pending). */
    const failPendingBooking = async () => {
      const claimed = await db.collection("bookings").findOneAndUpdate(
        { _id: bookingId, status: "pending_payment" },
        { $set: { status: "failed", payment_status: "failed", updated_at: new Date() } }
      );
      if (claimed) await releaseHold(event._id, session.quantity);
    };

    if (!event.is_paid) {
      // Issue the tickets the door scanner checks, and store their codes on the booking.
      const tickets = await issueTicketsForBooking({ _id: bookingId, event_id: event._id, quantity: session.quantity });
      await db.collection("bookings").updateOne(
        { _id: bookingId },
        { $set: { ticket_codes: tickets.map((t) => t.ticket_code) } }
      );
      await db.collection("booking_sessions").updateOne(
        { _id: session._id },
        { $set: { status: "confirmed", current_step: "complete", booking_id: bookingId, updated_at: new Date() } }
      );
      await notifyBookingConfirmed(bookingId);
      return NextResponse.json({
        status: "confirmed",
        booking_id: bookingId.toString(),
        booking_code: bookingCode,
        download_url: `/api/embed/bookings/${bookingId}/ticket?userId=${userId}&visitorId=${visitorId}`,
        ticket_page_url: ticketPageUrl(bookingId.toString(), userId, visitorId),
        ticket_pdf_url: ticketPdfUrl(bookingId.toString(), userId, visitorId),
        emailed_to: session.answers.find((a: any) => a.validation_rule === 'email_format')?.value ?? null
      }, { headers: corsHeaders });
    }

    // Paid Event - Initiate Checkout
    const gateway = await db.collection("payment_gateway_configs").findOne({ 
      org_id: userId, 
      is_active: true 
    });

    if (!gateway || !adapters[gateway.provider]) {
      await failPendingBooking();
      await db.collection("booking_sessions").updateOne({ _id: session._id }, { $set: { status: "failed", current_step: "payment", updated_at: new Date() } });
      return NextResponse.json({ error: "Payment gateway not configured or unsupported for conversational booking" }, { status: 501, headers: corsHeaders });
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
        customerEmail: session.answers.find((a: any) => a.validation_rule === 'email_format')?.value,
        customerPhone: session.answers.find((a: any) => a.validation_rule === 'phone_format')?.value
      }, credentials);

      // SECURITY: Generate a one-time access token for the payment bridge
      const paymentAccessToken = crypto.randomBytes(32).toString('hex');
      
      const paymentObj = {
        provider: gateway.provider,
        checkout_url: checkout.checkoutUrl,
        provider_order_id: checkout.providerOrderId, 
        provider_reference: checkout.providerReference,
        access_token: paymentAccessToken
      };

      await db.collection("bookings").updateOne(
        { _id: bookingId },
        { $set: { payment: paymentObj } }
      );

      // Construct final checkout URL with token for internal bridges
      let finalCheckoutUrl = checkout.checkoutUrl;
      if (gateway.provider === 'razorpay') {
        const url = new URL(checkout.checkoutUrl, process.env.NEXTAUTH_URL);
        url.searchParams.set('token', paymentAccessToken);
        finalCheckoutUrl = url.toString();
      }

      await db.collection("booking_sessions").updateOne(
        { _id: session._id },
        { 
          $set: { 
            status: "checkout_pending", 
            current_step: "payment", 
            booking_id: bookingId, 
            checkout_url: finalCheckoutUrl,
            updated_at: new Date() 
          } 
        }
      );

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
        checkout_url: finalCheckoutUrl,
        status: "checkout_pending",
        raw_create_response: checkout.rawResponse,
        created_at: new Date(),
        updated_at: new Date()
      });

      return NextResponse.json({
        status: "checkout_pending",
        booking_id: bookingId.toString(),
        booking_code: bookingCode,
        checkoutUrl: finalCheckoutUrl
      }, { headers: corsHeaders });
    } catch (paymentErr: any) {
      console.error("[checkout_error]", paymentErr);
      await failPendingBooking();
      await db.collection("booking_sessions").updateOne({ _id: session._id }, { $set: { status: "failed", current_step: "payment", updated_at: new Date() } });
      return NextResponse.json({ error: "Failed to initiate payment session." }, { status: 500, headers: corsHeaders });
    }

  } catch (error: any) {
    console.error("[confirm_api_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
