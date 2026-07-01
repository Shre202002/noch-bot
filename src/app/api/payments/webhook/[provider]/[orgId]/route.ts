import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { stripeAdapter } from "@/lib/payments/stripe";
import { decryptCredentials } from "@/lib/credentialCrypto";
import { ObjectId } from "mongodb";
import { confirmHold, releaseHold } from "@/lib/eventCapacity";
import { issueTicketsForBooking } from "@/lib/ticketIssuance";

/**
 * @fileOverview Centralized webhook receiver for payment providers.
 * Path: /api/payments/webhook/[provider]/[orgId]
 * 
 * This route is unauthenticated and public. It relies on cryptographic signature
 * verification via per-org secrets to ensure authenticity.
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; orgId: string }> }
) {
  const { provider, orgId } = await params;

  try {
    // 1. Validate Provider
    if (provider !== 'stripe') {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    // 2. Fetch Config for the specific tenant
    const db = await getDb();
    const config = await db.collection("payment_gateway_configs").findOne({ 
      org_id: orgId, 
      provider,
      is_active: true 
    });

    if (!config || !config.webhook_secret) {
      console.warn(`[webhook_${provider}] Config not found for org: ${orgId}`);
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
    const secretObj = await decryptCredentials(config.webhook_secret);
    const webhookSecret = secretObj.secret;

    // 5. Verify & Parse (Atomic handoff)
    const result = await stripeAdapter.verifyAndParseWebhook(
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

    // 7. Handle Result with atomic status claim and crash-safety
    try {
      if (!result.bookingId) {
        return new NextResponse("No booking ID in payload", { status: 200 });
      }

      if (!ObjectId.isValid(result.bookingId)) {
        console.error(`[webhook_${provider}] Invalid booking ID: ${result.bookingId}`);
        return new NextResponse("Invalid booking ID", { status: 200 });
      }

      const bookingId = new ObjectId(result.bookingId);

      if (result.status === 'paid') {
        // ATOMIC CLAIM: Try to mark as confirmed only if currently awaiting_payment
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

        if (!booking) {
          console.warn(`[webhook_${provider}] Booking ${bookingId} already resolved or not awaiting payment`);
          return new NextResponse("Already resolved", { status: 200 });
        }

        // Successfully claimed - perform side effects
        await confirmHold(booking.event_id, booking.quantity);
        await issueTicketsForBooking(booking as any);
        
        console.log(`[webhook_${provider}] Booking confirmed and tickets issued: ${bookingId}`);
      } else if (result.status === 'failed') {
        // ATOMIC CLAIM: Try to mark as cancelled
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
      // WEBHOOK_FAILURE: Webhook already marked processed, but side effects failed.
      // This requires manual reconciliation based on logs.
      console.error(`[CRITICAL_WEBHOOK_FAILURE] Payment processed but side-effect persistence failed.
        Booking ID: ${result.bookingId}
        Provider ID: ${result.providerEventId}
        Status: ${result.status}
        Error: ${mutationError instanceof Error ? mutationError.message : 'Unknown'}`);
      
      // Still return 200 because retrying would hit the idempotency gate.
      return new NextResponse("Internal error recorded for reconciliation", { status: 200 });
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error(`[webhook_${provider}] Global router error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
