import { ObjectId } from 'mongodb';
import { getDb } from './db';
import { findAccountById } from './storage';
import { ticketPageUrl } from './ticketLinks';

/**
 * Emails sent around a booking: the attendee's tickets once a booking is confirmed, and an alert to the organizer
 * when a payment needs manual follow-up. Sending never throws into the booking flow; a failed email is logged and
 * can be retried, because the "sent" marker is cleared again.
 */

type Mailer = typeof import('./mailer');
type Deps = { mailer?: Pick<Mailer, 'sendTicketEmail' | 'sendOrganizerAlertEmail'> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loadMailer = async (deps?: Deps) => deps?.mailer ?? (await import('./mailer'));

/**
 * The attendee's email from either booking flow: widget answers (`attendee.answers`, with `validation_rule`) or
 * chat-bot `form_responses` (keyed by field, possibly one object per attendee). The email-validated answer wins;
 * otherwise the first value that looks like an email.
 */
export function findAttendeeEmail(booking: Record<string, any>): string | null {
  const answers: Array<{ validation_rule?: string; value?: unknown }> = Array.isArray(booking.attendee?.answers)
    ? booking.attendee.answers
    : [];
  const tagged = answers.find((a) => a?.validation_rule === 'email_format' && typeof a.value === 'string');
  if (tagged && EMAIL_RE.test(String(tagged.value).trim())) return String(tagged.value).trim();

  const values: unknown[] = answers.map((a) => a?.value);
  const responses = booking.form_responses;
  for (const group of Array.isArray(responses) ? responses : responses ? [responses] : []) {
    if (group && typeof group === 'object') values.push(...Object.values(group));
  }
  const found = values.find((v) => typeof v === 'string' && EMAIL_RE.test(v.trim()));
  return typeof found === 'string' ? found.trim() : null;
}

function formatWhen(start: unknown): string {
  const date = start instanceof Date ? start : new Date(String(start ?? ''));
  return Number.isNaN(date.getTime())
    ? 'See event details'
    : date.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

/** Email the attendee their tickets, once per booking. Returns whether an email was sent. */
export async function notifyBookingConfirmed(bookingId: ObjectId, deps?: Deps): Promise<boolean> {
  const db = await getDb();
  const bookings = db.collection('bookings');
  const booking = await bookings.findOne({ _id: bookingId });
  if (!booking || booking.status !== 'confirmed' || booking.ticket_email_sent_at) return false;

  const to = findAttendeeEmail(booking);
  if (!to) {
    console.warn(`[booking-email] booking ${bookingId} has no attendee email; tickets not emailed`);
    return false;
  }

  // Claim the send so concurrent confirmations (webhook retry + page) email only once.
  const claimed = await bookings.findOneAndUpdate(
    { _id: bookingId, ticket_email_sent_at: { $exists: false } },
    { $set: { ticket_email_sent_at: new Date() } }
  );
  if (!claimed) return false;

  try {
    const event = await db.collection('events').findOne({ _id: booking.event_id });
    const tickets = await db.collection('tickets').find({ booking_id: bookingId }).sort({ ticket_index: 1 }).toArray();
    const codes = tickets.length ? tickets.map((t) => t.ticket_code) : (booking.ticket_codes ?? []);
    const base = process.env.NEXTAUTH_URL;
    const ticketUrl =
      base && booking.visitor_id && booking.org_id
        ? `${base}${ticketPageUrl(bookingId.toString(), booking.org_id, booking.visitor_id)}`
        : null;

    const mailer = await loadMailer(deps);
    await mailer.sendTicketEmail({
      to,
      eventName: event?.name ?? booking.event_snapshot?.name ?? 'Your event',
      when: formatWhen(event?.start_at ?? booking.event_snapshot?.start_at),
      venue: event?.venue ?? booking.event_snapshot?.venue ?? null,
      quantity: booking.quantity ?? codes.length,
      bookingCode: booking.booking_code ?? null,
      ticketCodes: codes,
      ticketUrl,
    });
    return true;
  } catch (err) {
    console.error(`[booking-email] could not email tickets for booking ${bookingId}:`, err);
    await bookings.updateOne({ _id: bookingId }, { $unset: { ticket_email_sent_at: '' } });
    return false;
  }
}

/** Tell the organizer a visitor paid but no seats were left, so the payment must be refunded. */
export async function notifyOrganizerRefundNeeded(bookingId: ObjectId, deps?: Deps): Promise<boolean> {
  try {
    const db = await getDb();
    const booking = await db.collection('bookings').findOne({ _id: bookingId });
    if (!booking) return false;
    const event = await db.collection('events').findOne({ _id: booking.event_id });
    const ownerId = booking.org_id ?? event?.org_id;
    const owner = ownerId ? await findAccountById(ownerId) : undefined;
    if (!owner?.email) {
      console.warn(`[booking-email] no organizer email for booking ${bookingId}; refund alert not sent`);
      return false;
    }
    const mailer = await loadMailer(deps);
    await mailer.sendOrganizerAlertEmail({
      to: owner.email,
      subject: `Refund needed: late payment for ${event?.name ?? 'your event'}`,
      lines: [
        `A visitor completed payment after their reservation expired, and the event no longer had ${booking.quantity} seat${booking.quantity === 1 ? '' : 's'} available, so no tickets were issued.`,
        `Booking: ${booking.booking_code ?? bookingId.toString()}. Amount: ${booking.amount_total ?? ''} ${booking.currency ?? ''}.`,
        `Payment reference: ${booking.payment?.provider_payment_id ?? booking.payment_reference_id ?? 'see your payment provider dashboard'}.`,
        'Please refund this payment from your payment provider dashboard. The booking is marked "needs refund" in NochBot.',
      ],
    });
    return true;
  } catch (err) {
    console.error(`[booking-email] could not send refund alert for booking ${bookingId}:`, err);
    return false;
  }
}
