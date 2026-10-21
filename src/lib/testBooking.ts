import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { describeMissing, eventReadiness } from './eventReadiness';
import { issueTicketsForBooking } from './ticketIssuance';

/**
 * Test bookings: the organizer tries their own event as an attendee before going live.
 *
 * A test booking goes through every step a real one does (event, tickets, form, summary, payment, ticket page, PDF),
 * but nothing real happens: it never takes seats, never sends email, never calls a payment gateway, and its tickets
 * cannot be scanned. It is stored with `is_test: true` and shown in Bookings with a "TESTED TICKET" tag.
 */

/** Only the signed-in organizer can ask for test mode, for their own events; for anyone else the flag is ignored. */
export function isOwnerTestRequest(
  cookieUserId: string | null | undefined,
  userId: string | null | undefined,
  flag: unknown
): boolean {
  const wanted = flag === true || flag === 'true' || flag === '1' || flag === 1;
  return wanted && !!cookieUserId && !!userId && cookieUserId === userId;
}

export type MissingItem = { id: string; label: string; tab: string };

export type TestGate =
  | { ok: true; event: Record<string, any> }
  | { ok: false; status: 404 | 409; error: string; missing?: MissingItem[] };

/** A test is allowed once everything needed to publish is in place (the same rules as going live). */
export async function testGate(db: Db, userId: string, eventId: ObjectId): Promise<TestGate> {
  const event = await db.collection('events').findOne({ _id: eventId, org_id: userId, status: { $in: ['draft', 'published'] } });
  if (!event) return { ok: false, status: 404, error: 'Event not found' };

  const [fieldCount, gateway] = await Promise.all([
    db.collection('event_form_fields').countDocuments({ event_id: eventId }),
    event.is_paid ? db.collection('payment_gateway_configs').findOne({ org_id: userId, is_active: true }) : Promise.resolve(null),
  ]);
  const readiness = eventReadiness(event as never, { fieldCount, gatewayActive: !!gateway });
  if (!readiness.complete) {
    return {
      ok: false,
      status: 409,
      error: `Finish before testing: ${describeMissing(readiness.missing)}.`,
      missing: readiness.missing.map((m) => ({ id: m.id, label: m.label, tab: m.tab })),
    };
  }
  return { ok: true, event };
}

/** The organizer's upcoming events (draft or live) that are complete enough to test. */
export async function readyEventsForTest(db: Db, userId: string, now: Date = new Date()) {
  const events = await db
    .collection('events')
    .find({ org_id: userId, status: { $in: ['draft', 'published'] }, end_at: { $gt: now } })
    .sort({ start_at: 1 })
    .toArray();
  if (events.length === 0) return [];

  const ids = events.map((e) => e._id);
  const [counts, gateway] = await Promise.all([
    db
      .collection('event_form_fields')
      .aggregate<{ _id: ObjectId; count: number }>([{ $match: { event_id: { $in: ids } } }, { $group: { _id: '$event_id', count: { $sum: 1 } } }])
      .toArray(),
    db.collection('payment_gateway_configs').findOne({ org_id: userId, is_active: true }),
  ]);
  const fieldCount = new Map(counts.map((c) => [String(c._id), c.count]));

  return events.filter(
    (e) => eventReadiness(e as never, { fieldCount: fieldCount.get(String(e._id)) ?? 0, gatewayActive: !!gateway }).complete
  );
}

/** What the dashboard shows for an event's test: whether it can start, what is missing, and how many tests exist. */
export async function testSummary(db: Db, userId: string, eventId: ObjectId) {
  const gate = await testGate(db, userId, eventId);
  if (!gate.ok && gate.status === 404) return { found: false as const };
  const testCount = await db.collection('bookings').countDocuments({ org_id: userId, event_id: eventId, is_test: true });
  return gate.ok
    ? { found: true as const, ready: true, missing: [] as MissingItem[], testCount }
    : { found: true as const, ready: false, missing: gate.missing ?? [], testCount };
}

export type TestOutcome = 'paid' | 'failed';
export type TestConfirmResult = 'confirmed' | 'failed' | 'unchanged' | 'not_test';

/**
 * Finishes the simulated payment of a test booking. Each change is a conditional update on `pending_payment`, so a
 * double click or a retry cannot issue tickets twice. No seats move and no email is sent.
 */
export async function confirmTestBooking(db: Db, booking: Record<string, any>, outcome: TestOutcome): Promise<TestConfirmResult> {
  if (!booking.is_test) return 'not_test';
  const now = new Date();
  const bookings = db.collection('bookings');
  const sessions = db.collection('booking_sessions');

  if (outcome === 'failed') {
    const failed = await bookings.findOneAndUpdate(
      { _id: booking._id, is_test: true, status: 'pending_payment' },
      { $set: { status: 'failed', payment_status: 'failed', payment_provider: 'test', updated_at: now } }
    );
    if (!failed) return 'unchanged';
    await sessions.updateOne({ booking_id: booking._id }, { $set: { status: 'failed', updated_at: now } });
    return 'failed';
  }

  const claimed = await bookings.findOneAndUpdate(
    { _id: booking._id, is_test: true, status: 'pending_payment' },
    { $set: { status: 'confirmed', payment_status: 'paid', payment_provider: 'test', confirmed_at: now, updated_at: now } },
    { returnDocument: 'after' }
  );
  if (!claimed) return 'unchanged';

  const tickets = await issueTicketsForBooking({ _id: claimed._id, event_id: claimed.event_id, quantity: claimed.quantity, is_test: true });
  await bookings.updateOne({ _id: claimed._id }, { $set: { ticket_codes: tickets.map((t) => t.ticket_code) } });
  await sessions.updateOne({ booking_id: claimed._id }, { $set: { status: 'confirmed', current_step: 'complete', updated_at: now } });
  return 'confirmed';
}

/** Removes an organizer's test bookings for one event, with their tickets and sessions. Real data is never touched. */
export async function clearTestBookings(db: Db, userId: string, eventId: ObjectId) {
  const tests = await db
    .collection('bookings')
    .find({ org_id: userId, event_id: eventId, is_test: true }, { projection: { _id: 1 } })
    .toArray();
  const ids = tests.map((b) => b._id);

  const [tickets, sessions] = await Promise.all([
    ids.length ? db.collection('tickets').deleteMany({ booking_id: { $in: ids }, is_test: true }) : Promise.resolve({ deletedCount: 0 }),
    db.collection('booking_sessions').deleteMany({ org_id: userId, event_id: eventId, is_test: true }),
  ]);
  const bookings = ids.length ? await db.collection('bookings').deleteMany({ _id: { $in: ids }, is_test: true }) : { deletedCount: 0 };
  return { bookings: bookings.deletedCount, tickets: tickets.deletedCount, sessions: sessions.deletedCount };
}
