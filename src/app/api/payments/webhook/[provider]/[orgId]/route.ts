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
  const startTime = Date.now();

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
    // Do NOT use req.json() - exact bytes are required.
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
    // We only act on the 'result' if the signature is cryptographically valid.
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
    // The unique index on {provider, provider_event_id} prevents double-processing.
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

    // 7. Handle Result
    if (!result.bookingId) {
      return new NextResponse("No booking ID in payload", { status: 200 });
    }

    const bookingId = new ObjectId(result.bookingId);
    const booking = await db.collection("bookings").findOne({ _id: bookingId });

    if (!booking) {
      console.warn(`[webhook_${provider}] Booking ${result.bookingId} not found`);
      return new NextResponse("Booking not found", { status: 200 });
    }

    // CRASH SAFETY WRAPPER for mutations
    try {
      if (result.status === 'paid') {
        // Success Path
        if (booking.status !== 'awaiting_payment') {
          console.warn(`[webhook_${provider}] Booking ${bookingId} in invalid state: ${booking.status}`);
          return new NextResponse("Invalid state", { status: 200 });
        }

        // a. Convert hold to sale
        await confirmHold(booking.event_id, booking.quantity);

        // b. Update booking
        await db.collection("bookings").updateOne(
          { _id: bookingId },
          {
            $set: {
              status: 'confirmed',
              conversation_state: 'confirmed',
              hold_expires_at: null,
              updated_at: new Date()
            }
          }
        );

        // c. Issue Tickets
        await issueTicketsForBooking(booking as any);
        
        console.log(`[webhook_${provider}] Booking confirmed and tickets issued: ${bookingId}`);
      } else if (result.status === 'failed') {
        // Failure Path
        await releaseHold(booking.event_id, booking.quantity);
        await db.collection("bookings").updateOne(
          { _id: bookingId },
          { $set: { status: 'cancelled', conversation_state: 'cancelled', updated_at: new Date() } }
        );
        console.log(`[webhook_${provider}] Payment failed, hold released: ${bookingId}`);
      }
    } catch (mutationError) {
      // KNOWN LIMITATION: Partial failure after idempotency key is already stored.
      // This webhook will NOT be retried. Manual reconciliation is required.
      console.error(`[CRITICAL_WEBHOOK_FAILURE] Payment processed but internal state update failed.
        Booking ID: ${bookingId}
        Provider ID: ${result.providerEventId}
        Event ID: ${booking.event_id}
        Quantity: ${booking.quantity}
        Error: ${mutationError instanceof Error ? mutationError.message : 'Unknown'}`);
      
      // We still return 200 because retrying would fail the idempotency check anyway.
      return new NextResponse("Internal error recorded for reconciliation", { status: 200 });
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error(`[webhook_${provider}] Global error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
