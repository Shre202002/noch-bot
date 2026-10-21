import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/db';
import { WebhookResult } from './adapter';
import { issueTicketsForBooking } from '@/lib/ticketIssuance';
import { bookingHoldsSeats as holdsSeats, confirmHold, releaseHold, reserveCapacity } from '@/lib/eventCapacity';
import { notifyBookingConfirmed, notifyOrganizerRefundNeeded } from '@/lib/bookingNotifications';
import { Booking } from '@/models/Booking';

interface ProcessParams {
  provider: 'stripe' | 'razorpay' | 'paypal' | 'cashfree';
  orgId: string;
  result: WebhookResult;
}

/** Statuses of a booking that is waiting for its payment: widget flow and chat-bot flow. */
const PENDING_STATUSES = ['pending_payment', 'awaiting_payment'] as const;
/** Statuses whose seats were already given back (hold expired, payment failed, or cancelled). */
const RELEASED_STATUSES = ['expired', 'failed', 'cancelled'] as const;

let webhookIndexReady: Promise<unknown> | null = null;
/** The unique index that makes duplicate deliveries detectable (see the insert below). */
function ensureWebhookIndex(db: Db) {
  webhookIndexReady ??= db
    .collection('payment_webhook_events')
    .createIndex({ provider: 1, org_id: 1, provider_event_id: 1 }, { unique: true })
    .catch((err) => {
      webhookIndexReady = null;
      throw err;
    });
  return webhookIndexReady;
}

/**
 * Handles a verified payment webhook for any provider and either booking flow: idempotency, the booking's status
 * change, seat accounting, ticket issuance and emails.
 *
 * Paid:
 * - pending booking → confirmed; its held seats become sold; tickets issued and emailed.
 * - already confirmed → make sure tickets exist and were emailed (recovery for retried webhooks).
 * - seats already released (hold expired, failed, cancelled) → late payment: confirm if seats are still free,
 *   otherwise mark "needs_refund" and alert the organizer.
 * Failed: pending booking → failed (widget) / cancelled (chat bot), held seats released.
 */
export async function processPaymentWebhookResult({ provider, orgId, result }: ProcessParams) {
  const db = await getDb();
  await ensureWebhookIndex(db);

  // 1. Idempotency (atomic dedup with in-flight protection)
  try {
    await db.collection('payment_webhook_events').insertOne({
      provider,
      org_id: orgId,
      provider_event_id: result.providerEventId,
      booking_id: result.bookingId && ObjectId.isValid(result.bookingId) ? new ObjectId(result.bookingId) : null,
      status: result.status,
      processed: false,
      raw_payload: result.rawPayload,
      created_at: new Date(),
    });
  } catch (err: any) {
    if (err.code !== 11000) throw err;
    const existing = await db.collection('payment_webhook_events').findOne({
      provider, org_id: orgId, provider_event_id: result.providerEventId,
    });
    if (!existing) return { success: true };
    if (existing.processed) return { success: true, message: 'Already processed' };
    // Created very recently: another request is processing it right now.
    if (Date.now() - new Date(existing.created_at).getTime() < 60_000) {
      return { success: true, message: 'Webhook already being processed' };
    }
    await db.collection('payment_webhook_events').updateOne(
      { _id: existing._id },
      { $set: { processing_status: 'retry_received', updated_at: new Date() } }
    );
  }

  const markWebhook = (processing_status: string) =>
    db.collection('payment_webhook_events').updateOne(
      { provider, org_id: orgId, provider_event_id: result.providerEventId },
      { $set: { processed: true, processing_status, processed_at: new Date() } }
    );

  // 2. Find the booking (scoped to the organizer the webhook URL belongs to)
  let booking: (Booking & Record<string, any>) | null = null;
  if (result.bookingId && ObjectId.isValid(result.bookingId)) {
    booking = (await db.collection('bookings').findOne({ _id: new ObjectId(result.bookingId), org_id: orgId })) as any;
  }
  if (!booking && result.providerOrderId) {
    booking = (await db.collection('bookings').findOne({
      org_id: orgId,
      $or: [{ 'payment.provider_order_id': result.providerOrderId }, { payment_reference_id: result.providerOrderId }],
    })) as any;
  }
  if (!booking || !booking._id) {
    await markWebhook('unmatched');
    return { success: true, message: 'Booking not found' };
  }
  const bookingId = booking._id;

  if (result.status === 'paid') {
    const outcome = await handlePaid(db, booking, provider, result);
    await updatePaymentAttempt(db, bookingId, provider, result, outcome === 'needs_refund' ? 'paid_after_expiry' : 'paid');
    await markWebhook(outcome);
    return { success: true, message: outcome };
  }

  if (result.status === 'failed') {
    const claimed = await db.collection('bookings').findOneAndUpdate(
      { _id: bookingId, status: { $in: [...PENDING_STATUSES] } },
      [
        {
          $set: {
            status: { $cond: [{ $eq: ['$status', 'awaiting_payment'] }, 'cancelled', 'failed'] },
            conversation_state: { $cond: [{ $eq: ['$status', 'awaiting_payment'] }, 'cancelled', '$conversation_state'] },
            payment_status: 'failed',
            hold_expires_at: null,
            updated_at: new Date(),
          },
        },
      ],
      { returnDocument: 'before' }
    );
    if (claimed && holdsSeats(claimed)) await releaseHold(claimed.event_id, claimed.quantity);
    await updatePaymentAttempt(db, bookingId, provider, result, 'failed');
    await markWebhook(claimed ? 'failed' : 'ignored');
    return { success: true };
  }

  await markWebhook('ignored');
  return { success: true };
}

type PaidOutcome = 'confirmed' | 'recovered' | 'late_confirmed' | 'needs_refund' | 'ignored';

async function handlePaid(
  db: Db,
  booking: Booking & Record<string, any>,
  provider: string,
  result: WebhookResult
): Promise<PaidOutcome> {
  const bookingId = booking._id!;
  const now = new Date();
  const paymentFields = {
    payment_status: 'paid',
    payment_provider: provider,
    'payment.provider_payment_id': result.providerPaymentId ?? null,
    'payment.provider_order_id': result.providerOrderId || booking.payment?.provider_order_id || null,
    'payment.raw_webhook_event_id': result.providerEventId,
  };
  const confirmedFields = {
    status: 'confirmed',
    conversation_state: 'confirmed',
    confirmed_at: now,
    hold_expires_at: null,
    updated_at: now,
    ...paymentFields,
  };

  // Retried webhook for a booking that is already confirmed: make sure tickets exist and went out.
  if (booking.status === 'confirmed') {
    await finalizeConfirmed(db, bookingId);
    return 'recovered';
  }

  // Normal case: the booking is still waiting. Its held seats (if any) become sold.
  if ((PENDING_STATUSES as readonly string[]).includes(booking.status)) {
    const claimed = await db.collection('bookings').findOneAndUpdate(
      { _id: bookingId, status: booking.status },
      { $set: confirmedFields },
      { returnDocument: 'before' }
    );
    if (!claimed) return 'ignored'; // another request changed it first
    if (holdsSeats(claimed)) {
      await confirmHold(claimed.event_id, claimed.quantity);
    } else {
      // Older widget booking counted by query, not by the event counters: record the sale.
      await db.collection('events').updateOne({ _id: claimed.event_id }, { $inc: { tickets_sold: claimed.quantity } });
    }
    await finalizeConfirmed(db, bookingId);
    return 'confirmed';
  }

  // Late payment: the seats were already released. Confirm only if they can still be sold.
  if ((RELEASED_STATUSES as readonly string[]).includes(booking.status)) {
    const claimed = await db.collection('bookings').findOneAndUpdate(
      { _id: bookingId, status: booking.status },
      { $set: { status: 'processing_late_payment', updated_at: now, ...paymentFields } },
      { returnDocument: 'before' }
    );
    if (!claimed) return 'ignored';

    const sold = await reserveCapacity(claimed.event_id, claimed.quantity);
    if (sold) {
      await db.collection('bookings').updateOne({ _id: bookingId }, { $set: { ...confirmedFields, late_payment: true } });
      await finalizeConfirmed(db, bookingId);
      return 'late_confirmed';
    }
    await db.collection('bookings').updateOne(
      { _id: bookingId },
      { $set: { status: 'needs_refund', conversation_state: 'cancelled', late_payment: true, updated_at: new Date() } }
    );
    await notifyOrganizerRefundNeeded(bookingId);
    return 'needs_refund';
  }

  return 'ignored';
}

/** Issue tickets (idempotent), store their codes, close the widget session and email the attendee. */
async function finalizeConfirmed(db: Db, bookingId: ObjectId) {
  const booking = await db.collection('bookings').findOne({ _id: bookingId });
  if (!booking) return;
  const tickets = await issueTicketsForBooking(booking as any);
  await db.collection('bookings').updateOne(
    { _id: bookingId },
    { $set: { ticket_codes: tickets.map((t) => t.ticket_code), updated_at: new Date() } }
  );
  await db.collection('booking_sessions').updateOne(
    { booking_id: bookingId },
    { $set: { status: 'confirmed', current_step: 'complete', updated_at: new Date() } }
  );
  await notifyBookingConfirmed(bookingId);
}

async function updatePaymentAttempt(
  db: Db,
  bookingId: ObjectId,
  provider: string,
  result: WebhookResult,
  status: 'paid' | 'paid_after_expiry' | 'failed'
) {
  const update = {
    $set: {
      status,
      provider_payment_id: result.providerPaymentId,
      raw_webhook_response: result.rawPayload,
      updated_at: new Date(),
    },
  };
  const base = { booking_id: bookingId, provider, status: 'checkout_pending' };
  if (result.providerOrderId) {
    const res = await db.collection('payment_attempts').updateOne({ ...base, provider_order_id: result.providerOrderId }, update);
    if (res.matchedCount > 0) return;
  }
  await db.collection('payment_attempts').updateOne(base, update);
}
