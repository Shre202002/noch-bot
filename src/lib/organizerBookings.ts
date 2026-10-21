import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { bookingHoldsSeats, releaseExpiredHolds, releaseHold } from './eventCapacity';

/**
 * Organizer-side view of an event's bookings: finding them, checking attendees in, and resolving states that need
 * a human (a payment that arrived after the seats were released, a checkout nobody finished).
 *
 * Every function takes the event id and only touches that event's bookings and tickets. Routes verify that the
 * signed-in organizer owns the event before calling in.
 */

/** Statuses are grouped by what the organizer can do about them, so distinct meanings stay distinct. */
export const BOOKING_GROUPS = {
  confirmed: ['confirmed'],
  awaiting_payment: ['pending_payment', 'awaiting_payment'],
  needs_attention: ['needs_refund', 'processing_late_payment'],
  closed: ['expired', 'failed', 'cancelled', 'refunded'],
  in_progress: ['draft', 'in_progress', 'processing_confirmation'],
} as const;

export type BookingGroup = keyof typeof BOOKING_GROUPS;

export const GROUP_LABELS: Record<BookingGroup, string> = {
  confirmed: 'Confirmed',
  awaiting_payment: 'Awaiting payment',
  needs_attention: 'Needs attention',
  closed: 'Closed',
  in_progress: 'In progress',
};

export const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  pending_payment: 'Awaiting payment',
  awaiting_payment: 'Awaiting payment',
  needs_refund: 'Paid after seats were released: refund needed',
  processing_late_payment: 'Processing a late payment',
  expired: 'Expired',
  failed: 'Payment failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  draft: 'In progress',
  in_progress: 'In progress',
  processing_confirmation: 'In progress',
};

export function groupOfStatus(status: string): BookingGroup | null {
  for (const [group, statuses] of Object.entries(BOOKING_GROUPS)) {
    if ((statuses as readonly string[]).includes(status)) return group as BookingGroup;
  }
  return null;
}

// ── Attendee details ──────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AttendeeSummary = { name: string | null; email: string | null; phone: string | null };

/** Name, email and phone from either booking flow: widget answers or chat-bot form responses (possibly per attendee). */
export function attendeeSummary(booking: Record<string, any>): AttendeeSummary {
  const pairs: Array<{ key: string; value: unknown }> = [];
  for (const a of Array.isArray(booking.attendee?.answers) ? booking.attendee.answers : []) {
    pairs.push({ key: `${a?.label ?? ''} ${a?.field_type ?? ''}`, value: a?.value });
  }
  const responses = booking.form_responses;
  for (const group of Array.isArray(responses) ? responses : responses ? [responses] : []) {
    if (group && typeof group === 'object') {
      for (const [key, value] of Object.entries(group)) pairs.push({ key, value });
    }
  }
  const strings = pairs.filter((p): p is { key: string; value: string } => typeof p.value === 'string' && p.value.trim() !== '');

  const email = strings.find((p) => EMAIL_RE.test(p.value.trim()))?.value.trim() ?? null;
  const name = strings.find((p) => /name/i.test(p.key) && !EMAIL_RE.test(p.value.trim()))?.value.trim() ?? null;
  const phone = strings.find((p) => /phone|mobile|contact/i.test(p.key))?.value.trim() ?? null;
  return { name, email, phone };
}

/** Everything searchable about a booking, lower-cased: reference, attendee answers, and the given ticket codes. */
export function searchText(booking: Record<string, any>, ticketCodes: string[] = []): string {
  const parts: string[] = [String(booking.booking_code ?? ''), String(booking._id ?? ''), ...ticketCodes];
  for (const a of Array.isArray(booking.attendee?.answers) ? booking.attendee.answers : []) {
    if (a?.value != null) parts.push(String(a.value));
  }
  const responses = booking.form_responses;
  for (const group of Array.isArray(responses) ? responses : responses ? [responses] : []) {
    if (group && typeof group === 'object') {
      for (const value of Object.values(group)) if (value != null && typeof value !== 'object') parts.push(String(value));
    }
  }
  return parts.join(' ').toLowerCase();
}

export type BookingAnswer = { label: string; value: string; /** 1-based attendee number in a group booking. */ attendee?: number };

const humanize = (key: string) => {
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
};

const show = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * Every answer the attendee gave, labelled. Widget bookings store labels with their answers; chat-bot bookings
 * store answers by `field_key`, so `labels` (field_key -> label, from the event's form fields) names them. Group
 * bookings keep one set of answers per attendee, numbered from 1.
 */
export function bookingAnswers(booking: Record<string, any>, labels: Map<string, string> = new Map()): BookingAnswer[] {
  const out: BookingAnswer[] = [];

  for (const a of Array.isArray(booking.attendee?.answers) ? booking.attendee.answers : []) {
    const value = show(a?.value);
    if (value != null) out.push({ label: String(a?.label ?? humanize(String(a?.field_id ?? 'Answer'))), value });
  }

  const responses = booking.form_responses;
  const groups: Array<Record<string, unknown>> = Array.isArray(responses) ? responses : responses ? [responses] : [];
  groups.forEach((group, index) => {
    if (!group || typeof group !== 'object') return;
    for (const [key, raw] of Object.entries(group)) {
      const value = show(raw);
      if (value == null) continue;
      out.push({
        label: labels.get(key) ?? humanize(key),
        value,
        ...(Array.isArray(responses) && responses.length > 1 ? { attendee: index + 1 } : {}),
      });
    }
  });
  return out;
}

export type BookingSource = 'widget' | 'chatbot' | null;

/** Which surface the booking came from: the website widget or the chat bot. */
export function bookingSource(booking: Record<string, any>): BookingSource {
  if (booking.source === 'chat_widget' || booking.booking_session_id || booking.visitor_id) return 'widget';
  if (booking.session_id || booking.conversation_state) return 'chatbot';
  return null;
}

// ── Listing ───────────────────────────────────────────────────────────────────

export const BOOKINGS_PAGE_SIZE = 25;
/** Most bookings read for one search; beyond this the list says it was truncated. */
const SEARCH_SCAN_LIMIT = 5000;

export type TicketSummary = { ticket_code: string; status: string; scanned_at: Date | null };

export type BookingRow = {
  id: string;
  booking_code?: string;
  attendee: AttendeeSummary;
  quantity: number;
  amount_total: number | null;
  currency?: string;
  status: string;
  status_label: string;
  group: BookingGroup | null;
  payment_status?: string;
  created_at: Date;
  confirmed_at: Date | null;
  source: BookingSource;
  payment_provider: string | null;
  answers: BookingAnswer[];
  tickets: TicketSummary[];
  checked_in: number;
};

export type BookingList = {
  rows: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<BookingGroup, number>;
  truncated: boolean;
};

export async function listEventBookings(
  db: Db,
  eventId: ObjectId,
  opts: { q?: string; group?: BookingGroup | 'all'; page?: number; now?: Date } = {}
): Promise<BookingList> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const query = (opts.q ?? '').trim().toLowerCase();
  const bookings = db.collection('bookings');

  // Seats of checkouts nobody finished go back first, so the list and the event's capacity agree.
  await releaseExpiredHolds(eventId, opts.now);

  const countRows = await bookings
    .aggregate<{ _id: string; count: number }>([{ $match: { event_id: eventId } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
    .toArray();
  const counts = Object.fromEntries((Object.keys(BOOKING_GROUPS) as BookingGroup[]).map((g) => [g, 0])) as Record<BookingGroup, number>;
  for (const row of countRows) {
    const group = groupOfStatus(row._id);
    if (group) counts[group] += row.count;
  }

  const filter: Record<string, unknown> = { event_id: eventId };
  if (opts.group && opts.group !== 'all') filter.status = { $in: [...BOOKING_GROUPS[opts.group]] };

  let matched: Array<Record<string, any>>;
  let total: number;
  let truncated = false;
  let ticketsByBooking = new Map<string, TicketSummary[]>();

  if (query) {
    // Search spans the reference, attendee answers of both flows and ticket codes, so it runs over this event's
    // bookings rather than a fixed set of fields.
    const all = await bookings.find(filter).sort({ created_at: -1 }).limit(SEARCH_SCAN_LIMIT + 1).toArray();
    truncated = all.length > SEARCH_SCAN_LIMIT;
    const scanned = all.slice(0, SEARCH_SCAN_LIMIT);
    ticketsByBooking = await loadTickets(db, eventId, scanned.map((b) => b._id));
    const hits = scanned.filter((b) =>
      searchText(b, (ticketsByBooking.get(String(b._id)) ?? []).map((t) => t.ticket_code)).includes(query)
    );
    total = hits.length;
    matched = hits.slice((page - 1) * BOOKINGS_PAGE_SIZE, page * BOOKINGS_PAGE_SIZE);
  } else {
    total = await bookings.countDocuments(filter);
    matched = await bookings
      .find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * BOOKINGS_PAGE_SIZE)
      .limit(BOOKINGS_PAGE_SIZE)
      .toArray();
    ticketsByBooking = await loadTickets(db, eventId, matched.map((b) => b._id));
  }

  const fieldLabels = new Map<string, string>(
    (await db.collection('event_form_fields').find({ event_id: eventId }, { projection: { field_key: 1, label: 1 } }).toArray()).map(
      (f) => [String(f.field_key), String(f.label)] as [string, string]
    )
  );

  const rows: BookingRow[] = matched.map((b) => {
    const tickets = ticketsByBooking.get(String(b._id)) ?? [];
    return {
      id: String(b._id),
      booking_code: b.booking_code,
      attendee: attendeeSummary(b),
      quantity: b.quantity,
      amount_total: b.amount_total ?? b.amount_charged ?? null,
      currency: b.currency ?? b.event_snapshot?.currency,
      status: b.status,
      status_label: STATUS_LABELS[b.status] ?? b.status,
      group: groupOfStatus(b.status),
      payment_status: b.payment_status,
      created_at: b.created_at,
      confirmed_at: b.confirmed_at ?? null,
      source: bookingSource(b),
      payment_provider: b.payment_provider && b.payment_provider !== 'none' ? String(b.payment_provider) : b.payment?.provider ?? null,
      answers: bookingAnswers(b, fieldLabels),
      tickets,
      checked_in: tickets.filter((t) => t.status === 'scanned').length,
    };
  });

  return { rows, total, page, pageSize: BOOKINGS_PAGE_SIZE, counts, truncated };
}

async function loadTickets(db: Db, eventId: ObjectId, bookingIds: ObjectId[]) {
  const byBooking = new Map<string, TicketSummary[]>();
  if (bookingIds.length === 0) return byBooking;
  const tickets = await db
    .collection('tickets')
    .find({ event_id: eventId, booking_id: { $in: bookingIds } })
    .sort({ ticket_index: 1 })
    .toArray();
  for (const t of tickets) {
    const key = String(t.booking_id);
    const list = byBooking.get(key) ?? [];
    list.push({ ticket_code: t.ticket_code, status: t.status, scanned_at: t.scanned_at ?? null });
    byBooking.set(key, list);
  }
  return byBooking;
}

// ── Check-in ──────────────────────────────────────────────────────────────────

export type CheckInOutcome =
  | { outcome: 'checked_in'; scanned_at: Date }
  | { outcome: 'already_checked_in'; scanned_at: Date | null }
  | { outcome: 'booking_not_confirmed'; booking_status: string }
  | { outcome: 'ticket_void'; ticket_status: string }
  | { outcome: 'not_found' };

/**
 * Checks a ticket in from the dashboard. The ticket flips `active → scanned` in one atomic update, so two people
 * checking in the same ticket cannot both succeed. A ticket whose booking is not confirmed is refused.
 */
export async function checkInTicket(
  db: Db,
  eventId: ObjectId,
  ticketCode: string,
  organizerId: string,
  now: Date = new Date()
): Promise<CheckInOutcome> {
  const tickets = db.collection('tickets');
  const ticket = await tickets.findOne({ ticket_code: ticketCode, event_id: eventId });
  if (!ticket) return { outcome: 'not_found' };

  const booking = await db.collection('bookings').findOne({ _id: ticket.booking_id, event_id: eventId });
  if (!booking) return { outcome: 'not_found' };
  if (booking.status !== 'confirmed') return { outcome: 'booking_not_confirmed', booking_status: booking.status };

  const claimed = await tickets.findOneAndUpdate(
    { ticket_code: ticketCode, event_id: eventId, status: 'active' },
    {
      $set: {
        status: 'scanned',
        scanned_at: now,
        checked_in_by_organizer_id: organizerId,
        scan_device_info: { source: 'dashboard' },
      },
    },
    { returnDocument: 'after' }
  );
  if (claimed) return { outcome: 'checked_in', scanned_at: now };

  const current = await tickets.findOne({ ticket_code: ticketCode, event_id: eventId });
  if (current?.status === 'scanned') return { outcome: 'already_checked_in', scanned_at: current.scanned_at ?? null };
  return { outcome: 'ticket_void', ticket_status: current?.status ?? 'unknown' };
}

/** Reverses a check-in made by mistake: `scanned → active`. Returns false when the ticket was not checked in. */
export async function undoCheckIn(db: Db, eventId: ObjectId, ticketCode: string, now: Date = new Date()): Promise<boolean> {
  const res = await db.collection('tickets').updateOne(
    { ticket_code: ticketCode, event_id: eventId, status: 'scanned' },
    {
      $set: { status: 'active', scanned_at: null, scanned_by_staff_id: null, scan_device_info: null, check_in_undone_at: now },
      $unset: { checked_in_by_organizer_id: '' },
    }
  );
  return res.modifiedCount === 1;
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export type ReconcileAction = 'mark_refunded' | 'cancel';
export type ReconcileResult = { ok: true; status: string } | { ok: false; error: string; code: 'not_found' | 'not_allowed' };

/**
 * Resolves a booking that needs a person:
 * - `mark_refunded`: the organizer refunded a `needs_refund` payment in the payment provider. The booking becomes
 *   `refunded`; no seats change because none were ever taken.
 * - `cancel`: closes a checkout that is still awaiting payment and gives its held seats back. If the attendee pays
 *   afterwards, the payment webhook confirms the booking again when seats are free, otherwise flags it for refund.
 * Each transition is a conditional update on the current status, so a webhook arriving at the same moment wins or
 * loses cleanly rather than being overwritten.
 */
export async function reconcileBooking(
  db: Db,
  eventId: ObjectId,
  bookingId: ObjectId,
  action: ReconcileAction,
  organizerId: string,
  now: Date = new Date()
): Promise<ReconcileResult> {
  const bookings = db.collection('bookings');
  const existing = await bookings.findOne({ _id: bookingId, event_id: eventId });
  if (!existing) return { ok: false, error: 'Booking not found.', code: 'not_found' };

  if (action === 'mark_refunded') {
    const res = await bookings.findOneAndUpdate(
      { _id: bookingId, event_id: eventId, status: 'needs_refund' },
      { $set: { status: 'refunded', payment_status: 'refunded', refunded_at: now, refunded_by: organizerId, updated_at: now } }
    );
    return res
      ? { ok: true, status: 'refunded' }
      : { ok: false, error: 'Only a booking that needs a refund can be marked refunded.', code: 'not_allowed' };
  }

  const claimed = await bookings.findOneAndUpdate(
    { _id: bookingId, event_id: eventId, status: { $in: [...BOOKING_GROUPS.awaiting_payment] } },
    {
      $set: {
        status: 'cancelled',
        conversation_state: 'cancelled',
        hold_expires_at: null,
        cancelled_by: organizerId,
        cancelled_at: now,
        updated_at: now,
      },
    },
    { returnDocument: 'before' }
  );
  if (!claimed) return { ok: false, error: 'Only a booking awaiting payment can be cancelled.', code: 'not_allowed' };
  if (bookingHoldsSeats(claimed)) await releaseHold(claimed.event_id, claimed.quantity);
  return { ok: true, status: 'cancelled' };
}

/** Which actions the organizer may take on a booking in this status; the UI shows exactly these. */
export function allowedActions(status: string): ReconcileAction[] {
  if (status === 'needs_refund') return ['mark_refunded'];
  if ((BOOKING_GROUPS.awaiting_payment as readonly string[]).includes(status)) return ['cancel'];
  return [];
}
