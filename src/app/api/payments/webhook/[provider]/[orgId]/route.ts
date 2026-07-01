import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { stripeAdapter } from "@/lib/payments/stripe";
import { razorpayAdapter } from "@/lib/payments/razorpay";
import { paypalAdapter } from "@/lib/payments/paypal";
import { cashfreeAdapter } from "@/lib/payments/cashfree";
import { PaymentGatewayAdapter } from "@/lib/payments/adapter";
import { decryptCredentials } from "@/lib/credentialCrypto";
import { ObjectId } from "mongodb";
import { confirmHold, releaseHold } from "@/lib/eventCapacity";
import { issueTicketsForBooking } from "@/lib/ticketIssuance";

/**
 * @fileOverview Centralized webhook receiver for payment providers.
 * Path: /api/payments/webhook/[provider]/[orgId]
 */

const providerAdapters: Record<string, PaymentGatewayAdapter> = {
  stripe: stripeAdapter,
  razorpay: razorpayAdapter,
  paypal: paypalAdapter,
  cashfree: cashfreeAdapter,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; orgId: string }> }
) {
  const { provider, orgId } = await params;
  const adapter = providerAdapters[provider.toLowerCase()];

  try {
    // 1. Validate Provider
    if (!adapter) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    // 2. Fetch Config for the specific tenant
    const db = await getDb();
    const config = await db.collection("payment_gateway_configs").findOne({ 
      org_id: orgId, 
      provider: provider.toLowerCase(),
      is_active: true 
    });

    if (!config) {
      console.warn(`[webhook_${provider}] Active config not found for org: ${orgId}`);
      return NextResponse.json({ error: "Configuration not found" }, { status: 400 });
    }

    // 3. Read RAW body for signature verification
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // 4. Decrypt Secrets
    const credentials = await decryptCredentials(config.credentials);
    const webhookSecret = config.webhook_secret ? (await decryptCredentials(config.webhook_secret)).secret : null;

    // 5. Verify & Parse (Atomic handoff)
    const result = await adapter.verifyAndParseWebhook(
      rawBody,
      headers,
      credentials,
      webhookSecret
    );

    if (!result) {
      console.error(`[webhook_${provider}] Signature verification failed for org: ${orgId}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // 6. Idempotency Gate (INSERT FIRST)
    try {
      await db.collection('processed_webhooks').insertOne({
        provider,
        provider_event_id: result.providerEventId,
        booking_id: result.bookingId ? new ObjectId(result.bookingId) : null,
        status: result.status,
        raw_payload: result.rawPayload,
        processed_at: new Date()
      });
    } catch (err: any) {
      if (err.code === 11000) {
        console.log(`[webhook_${provider}] Duplicate event ignored: ${result.providerEventId}`);
        return new NextResponse("Processed", { status: 200 });
      }
      throw err;
    }

    // 7. Atomic Claim & Process Side Effects
    try {
      if (!result.bookingId || !ObjectId.isValid(result.bookingId)) {
        return new NextResponse("No valid booking ID in payload", { status: 200 });
      }

      const bookingId = new ObjectId(result.bookingId);

      if (result.status === 'paid') {
        // ATOMIC CLAIM: Only transition if currently awaiting_payment
        const booking = await db.collection("bookings").findOneAndUpdate(
          { _id: bookingId, status: 'awaiting_payment' },
          {
            $set: {
              status: 'confirmed',
              conversation_state: 'confirmed',
              hold_expires_at: null,
              updated_at: new Date()
            }
          },
          { returnDocument: 'before' }
        );

        if (booking) {
          await confirmHold(booking.event_id, booking.quantity);
          await issueTicketsForBooking(booking as any);
          console.log(`[webhook_${provider}] Booking confirmed: ${bookingId}`);
        }
      } else if (result.status === 'failed') {
        // ATOMIC CLAIM: Mark as cancelled
        const booking = await db.collection("bookings").findOneAndUpdate(
          { _id: bookingId, status: 'awaiting_payment' },
          { 
            $set: { 
              status: 'cancelled', 
              conversation_state: 'cancelled', 
              hold_expires_at: null, 
              updated_at: new Date() 
            } 
          },
          { returnDocument: 'before' }
        );

        if (booking) {
          await releaseHold(booking.event_id, booking.quantity);
          console.log(`[webhook_${provider}] Payment failed, hold released: ${bookingId}`);
        }
      }
    } catch (mutationError) {
      console.error(`[CRITICAL_WEBHOOK_FAILURE] Manual reconciliation required.
        Booking ID: ${result.bookingId}
        Status: ${result.status}
        Error: ${mutationError instanceof Error ? mutationError.message : 'Unknown'}`);
      return new NextResponse("Internal error recorded", { status: 200 });
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error(`[webhook_${provider}] Global router error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
