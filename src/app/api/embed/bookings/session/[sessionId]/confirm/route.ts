import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { Booking } from "@/models/Booking";
import { stripeAdapter } from "@/lib/payments/stripe";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { decryptCredentials } from "@/lib/credentialCrypto";

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
      return NextResponse.json({ error: "Invalid booking session" }, { status: 404 });
    }

    const event = await db.collection("events").findOne({ _id: session.event_id });
    if (!event || event.status !== "published") {
      return NextResponse.json({ error: "Event is no longer available" }, { status: 410 });
    }

    // Capacity Check
    const activeBookings = await db.collection("bookings").countDocuments({
      event_id: event._id,
      status: { $in: ["confirmed", "pending_payment"] },
      $or: [
        { expires_at: { $gt: new Date() } },
        { expires_at: { $exists: false } }
      ]
    });

    if (event.capacity - activeBookings < session.quantity) {
      return NextResponse.json({ 
        error: "Not enough seats available", 
        available_seats: Math.max(0, event.capacity - activeBookings) 
      }, { status: 409 });
    }

    const bookingCode = `NBK-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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
      ticket_codes: event.is_paid ? [] : [Math.random().toString(36).substring(2, 10).toUpperCase()],
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

    if (!gateway) throw new Error("Payment gateway not configured");

    const credentials = await decryptCredentials(gateway.credentials);
    const adapter = gateway.provider === "stripe" ? stripeAdapter : razorpayAdapter;

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
      { $set: { "payment.checkout_url": checkout.checkoutUrl, "payment.provider": gateway.provider } }
    );

    return NextResponse.json({
      status: "checkout_pending",
      booking_id: bookingId.toString(),
      booking_code: bookingCode,
      checkoutUrl: checkout.checkoutUrl
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
