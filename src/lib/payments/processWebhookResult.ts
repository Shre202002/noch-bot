import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { WebhookResult } from './adapter';
import { issueTicketsForBooking } from '@/lib/ticketIssuance';
import { ensureBookingIndexes } from '@/lib/bookingDb';

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
  // Ensure DB indexes are set up before processing
  await ensureBookingIndexes();
  const db = await getDb();

  // 1. Idempotency Check (Atomic deduplication)
  try {
    await db.collection('payment_webhook_events').insertOne({
      provider,
      org_id: orgId,
      provider_event_id: result.providerEventId,
      booking_id: result.bookingId && ObjectId.isValid(result.bookingId) ? new ObjectId(result.bookingId) : null,
      status: result.status,
      processed: false,
      raw_payload: result.rawPayload,
      created_at: new Date()
    });
  } catch (err: any) {
    if (err.code === 11000) {
      // DUPLICATE DETECTED
      const existing = await db.collection('payment_webhook_events').findOne({
        provider,
        org_id: orgId,
        provider_event_id: result.providerEventId
      });

      if (existing?.processed) {
        return { success: true, message: 'Already processed' };
      }
      
      // If it exists but NOT processed, we continue (likely recovered from a mid-flight crash)
      await db.collection('payment_webhook_events').updateOne(
        { _id: existing?._id },
        { $set: { processing_status: 'retry_received' } }
      );
    } else {
      throw err;
    }
  }

  // 2. Identify Booking
  let booking: any = null;
  
  if (result.bookingId && ObjectId.isValid(result.bookingId)) {
    booking = await db.collection('bookings').findOne({
      _id: new ObjectId(result.bookingId),
      org_id: orgId
    });
  }

  // Fallback: match by provider order ID if direct bookingId failed
  if (!booking && result.providerOrderId) {
    booking = await db.collection('bookings').findOne({
      org_id: orgId,
      "payment.provider_order_id": result.providerOrderId
    });
  }

  if (!booking) {
    await db.collection('payment_webhook_events').updateOne(
      { provider, org_id: orgId, provider_event_id: result.providerEventId },
      { $set: { processed: true, processing_status: 'unmatched', processed_at: new Date() } }
    );
    return { success: true, message: 'Booking not found' };
  }

  const bookingId = booking._id;

  // 3. Process Status Transition
  if (result.status === 'paid') {
    const now = new Date();
    
    // RECOVERY PATH: If already confirmed, ensure tickets are issued and finalize webhook
    if (booking.status === 'confirmed' && booking.payment_status === 'paid') {
      const tickets = await issueTicketsForBooking(booking);
      await db.collection('bookings').updateOne(
        { _id: bookingId },
        { $set: { ticket_codes: tickets.map(t => t.ticket_code), updated_at: now } }
      );
      await db.collection('payment_webhook_events').updateOne(
        { provider, org_id: orgId, provider_event_id: result.providerEventId },
        { $set: { processed: true, processed_at: now, processing_status: 'recovered' } }
      );
      return { success: true, message: 'Recovery successful' };
    }

    const isExpired = booking.expires_at && booking.expires_at < now;

    if (isExpired) {
      // Paid but late - log for manual reconciliation
      await db.collection('payment_webhook_events').updateOne(
        { provider, org_id: orgId, provider_event_id: result.providerEventId },
        { $set: { processed: true, processing_status: 'late_payment', processed_at: now } }
      );

      // Audit the late payment in payment_attempts
      const attemptFilter: any = { booking_id: bookingId, provider, status: 'checkout_pending' };
      if (result.providerOrderId) attemptFilter.provider_order_id = result.providerOrderId;

      await db.collection('payment_attempts').updateOne(
        attemptFilter,
        { 
          $set: { 
            status: 'paid_after_expiry', 
            provider_payment_id: result.providerPaymentId,
            provider_order_id: result.providerOrderId || booking.payment?.provider_order_id,
            raw_webhook_response: result.rawPayload,
            updated_at: now 
          } 
        }
      );
      return { success: true, message: 'Payment after expiry' };
    }

    // ATOMIC UPDATE: Only confirm if currently pending
    const updateResult = await db.collection('bookings').findOneAndUpdate(
      {
        _id: bookingId,
        org_id: orgId,
        status: 'pending_payment',
        payment_status: 'pending'
      },
      {
        $set: {
          status: 'confirmed',
          payment_status: 'paid',
          confirmed_at: now,
          updated_at: now,
          "payment.provider_payment_id": result.providerPaymentId,
          "payment.provider_order_id": result.providerOrderId || booking.payment?.provider_order_id,
          "payment.raw_webhook_event_id": result.providerEventId
        }
      },
      { returnDocument: 'after' }
    );

    if (updateResult) {
      const updatedBooking = updateResult as any;
      
      // IDEMPOTENT: Generate tickets (helper now handles partial issuance safely)
      const tickets = await issueTicketsForBooking(updatedBooking);
      const ticketCodes = tickets.map(t => t.ticket_code);
      
      await db.collection('bookings').updateOne(
        { _id: bookingId },
        { $set: { ticket_codes: ticketCodes } }
      );

      // Update related sessions
      await db.collection('booking_sessions').updateOne(
        { booking_id: bookingId },
        { $set: { status: 'confirmed', current_step: 'complete', updated_at: now } }
      );

      // Update payment attempt record robustly
      const baseFilter = { booking_id: bookingId, provider, status: 'checkout_pending' };
      let attemptMatch = false;

      if (result.providerOrderId) {
        const res = await db.collection('payment_attempts').updateOne(
          { ...baseFilter, provider_order_id: result.providerOrderId },
          { $set: { status: 'paid', provider_payment_id: result.providerPaymentId, raw_webhook_response: result.rawPayload, updated_at: now } }
        );
        if (res.matchedCount > 0) attemptMatch = true;
      }

      if (!attemptMatch) {
        await db.collection('payment_attempts').updateOne(
          baseFilter,
          { $set: { status: 'paid', provider_payment_id: result.providerPaymentId, raw_webhook_response: result.rawPayload, updated_at: now } }
        );
      }
    }
  } else if (result.status === 'failed') {
    await db.collection('bookings').updateOne(
      { _id: bookingId, status: 'pending_payment' },
      { $set: { status: 'failed', payment_status: 'failed', updated_at: new Date() } }
    );

    const baseFilter = { booking_id: bookingId, provider, status: 'checkout_pending' };
    let attemptMatch = false;

    if (result.providerOrderId) {
      const res = await db.collection('payment_attempts').updateOne(
        { ...baseFilter, provider_order_id: result.providerOrderId },
        { $set: { status: 'failed', raw_webhook_response: result.rawPayload, updated_at: new Date() } }
      );
      if (res.matchedCount > 0) attemptMatch = true;
    }

    if (!attemptMatch) {
      await db.collection('payment_attempts').updateOne(
        baseFilter,
        { $set: { status: 'failed', raw_webhook_response: result.rawPayload, updated_at: new Date() } }
      );
    }
  }

  // Mark webhook as processed
  await db.collection('payment_webhook_events').updateOne(
    { provider, org_id: orgId, provider_event_id: result.providerEventId },
    { $set: { processed: true, processed_at: new Date(), processing_status: 'completed' } }
  );

  return { success: true };
}
