import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { WebhookResult } from './adapter';
import { issueTicketsForBooking } from '@/lib/ticketIssuance';

interface ProcessParams {
  provider: 'stripe' | 'razorpay' | 'paypal' | 'cashfree';
  orgId: string;
  result: WebhookResult;
}

/**
 * Handles the business logic for a verified payment webhook.
 * Manages idempotency, booking status transitions, and ticket issuance.
 */
export async function processPaymentWebhookResult({
  provider,
  orgId,
  result
}: ProcessParams) {
  const db = await getDb();

  // 1. Idempotency Check
  const existingEvent = await db.collection('payment_webhook_events').findOne({
    provider,
    org_id: orgId,
    provider_event_id: result.providerEventId
  });

  if (existingEvent && existingEvent.processed) {
    return { success: true, message: 'Already processed' };
  }

  // Record the event if it doesn't exist
  if (!existingEvent) {
    await db.collection('payment_webhook_events').insertOne({
      provider,
      org_id: orgId,
      provider_event_id: result.providerEventId,
      booking_id: result.bookingId ? new ObjectId(result.bookingId) : null,
      status: result.status,
      processed: false,
      raw_payload: result.rawPayload,
      created_at: new Date()
    });
  }

  // 2. Identify Booking
  let bookingId: ObjectId | null = null;
  if (result.bookingId && ObjectId.isValid(result.bookingId)) {
    bookingId = new ObjectId(result.bookingId);
  }

  // If no direct bookingId, try to match by provider order ID
  if (!bookingId && result.rawPayload) {
    const providerOrderId = result.rawPayload.payload?.order?.entity?.id || 
                            result.rawPayload.payload?.payment?.entity?.order_id ||
                            result.rawPayload.id; // Stripe session ID
    
    const matchedBooking = await db.collection('bookings').findOne({
      org_id: orgId,
      "payment.provider_order_id": providerOrderId
    });
    if (matchedBooking) bookingId = matchedBooking._id!;
  }

  if (!bookingId) {
    console.warn(`[webhook_${provider}] Could not identify booking for event: ${result.providerEventId}`);
    return { success: false, message: 'Booking not found' };
  }

  // 3. Process Status Transition
  if (result.status === 'paid') {
    // ATOMIC UPDATE: Only confirm if currently pending and not expired
    const now = new Date();
    const updateResult = await db.collection('bookings').findOneAndUpdate(
      {
        _id: bookingId,
        org_id: orgId,
        status: 'pending_payment',
        $or: [
          { expires_at: { $gt: now } },
          { expires_at: { $exists: false } }
        ]
      },
      {
        $set: {
          status: 'confirmed',
          payment_status: 'paid',
          confirmed_at: now,
          updated_at: now,
          "payment.provider_payment_id": result.providerEventId,
          "payment.raw_webhook_event_id": result.providerEventId
        }
      },
      { returnDocument: 'after' }
    );

    if (updateResult) {
      const booking = updateResult as any;
      
      // Generate tickets and populate the codes array on the booking
      const tickets = await issueTicketsForBooking(booking);
      const ticketCodes = tickets.map(t => t.ticket_code);
      
      await db.collection('bookings').updateOne(
        { _id: bookingId },
        { $set: { ticket_codes: ticketCodes } }
      );

      // Update related records
      await db.collection('booking_sessions').updateOne(
        { booking_id: bookingId },
        { $set: { status: 'confirmed', current_step: 'complete', updated_at: now } }
      );

      await db.collection('payment_attempts').updateOne(
        { booking_id: bookingId, provider },
        { 
          $set: { 
            status: 'paid', 
            raw_webhook_response: result.rawPayload,
            updated_at: now 
          } 
        }
      );

      console.log(`[webhook_${provider}] Booking ${bookingId} confirmed successfully.`);
    } else {
      console.warn(`[webhook_${provider}] Booking ${bookingId} was not in a confirmable state (possibly expired or already processed).`);
    }
  } else if (result.status === 'failed') {
    await db.collection('bookings').updateOne(
      { _id: bookingId, status: 'pending_payment' },
      { $set: { status: 'failed', payment_status: 'failed', updated_at: new Date() } }
    );

    await db.collection('payment_attempts').updateOne(
      { booking_id: bookingId, provider },
      { $set: { status: 'failed', raw_webhook_response: result.rawPayload, updated_at: new Date() } }
    );
  }

  // Mark webhook as processed
  await db.collection('payment_webhook_events').updateOne(
    { provider, org_id: orgId, provider_event_id: result.providerEventId },
    { $set: { processed: true, processed_at: new Date() } }
  );

  return { success: true };
}
