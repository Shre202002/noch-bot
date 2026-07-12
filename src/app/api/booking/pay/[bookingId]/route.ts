import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Access token required" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
      "payment.access_token": token
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found or invalid token" }, { status: 404 });
    }

    // 1. Check Expiry
    if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
      if (booking.status === "pending_payment") {
        await db.collection("bookings").updateOne(
          { _id: booking._id },
          { $set: { status: "expired", payment_status: "failed", updated_at: new Date() } }
        );
      }
      return NextResponse.json({ error: "Payment session has expired" }, { status: 410 });
    }

    if (booking.status !== "pending_payment") {
      return NextResponse.json({ error: "Booking is not in a payable state" }, { status: 400 });
    }

    // Load gateway config
    const gateway = await db.collection("payment_gateway_configs").findOne({
      org_id: booking.org_id,
      provider: booking.payment?.provider,
      is_active: true
    });

    if (!gateway) {
      return NextResponse.json({ error: "Payment configuration lost" }, { status: 500 });
    }

    const { decryptCredentials } = await import("@/lib/credentialCrypto");
    const credentials = await decryptCredentials(gateway.credentials);

    const safeData = {
      provider: gateway.provider,
      key_id: credentials.key_id || credentials.app_id || credentials.client_id || credentials.publishable_key,
      order_id: booking.payment?.provider_order_id || booking.payment?.provider_reference,
      amount: booking.amount_total,
      currency: booking.currency,
      name: booking.event_snapshot.name,
      description: `Tickets for ${booking.event_snapshot.name}`,
      booking_code: booking.booking_code,
      prefill: {
        name: booking.attendee.answers.find((a: any) => a.label.toLowerCase().includes("name"))?.value,
        email: booking.attendee.answers.find((a: any) => a.label.toLowerCase().includes("email"))?.value,
        contact: booking.attendee.answers.find((a: any) => a.label.toLowerCase().includes("phone"))?.value,
      }
    };

    return NextResponse.json(safeData);
  } catch (error) {
    console.error("[safe_pay_data_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
