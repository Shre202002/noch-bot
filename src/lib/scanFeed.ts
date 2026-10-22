import type { Db, ObjectId } from 'mongodb';
import { attendeeSummary } from './organizerBookings';
import { getScannerLinkForEvent, listScannersForEvent } from './scannerLinkAuth';

/**
 * What the organizer's Scanning tab polls once a second: door counts, the scanner accounts, the scans since the last poll,
 * and (on request) every attendee. Cheap on purpose: counts come from two indexed queries and the incremental part only
 * touches tickets scanned since the cursor. Only tickets of confirmed, non-test bookings count.
 */

const MAX_SCANS_PER_POLL = 500;
const MAX_ATTENDEES = 5000;

export type FeedAttendee = {
  code: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  bookingCode: string | null;
  /** "Ticket 1 of 2". */
  label: string;
  status: string;
  scannedAt: string | null;
  /** Login ID of the scanner account, "Organizer" for a dashboard check-in, or null. */
  scannedBy: string | null;
};

export type ScanFeed = {
  counts: { total: number; scanned: number; remaining: number };
  link: { slug: string; active: boolean } | null;
  scanners: Awaited<ReturnType<typeof listScannersForEvent>>;
  pendingScanners: number;
  /** Latest scan time seen; send it back as `since` on the next poll. */
  cursor: string | null;
  /** Tickets scanned at or after `since` (the same ticket can come again: merge by code). */
  scans: FeedAttendee[];
  /** Every ticket of the event; only sent when asked for. */
  attendees: FeedAttendee[] | null;
};

function rowOf(ticket: Record<string, any>, booking: Record<string, any> | undefined): FeedAttendee {
  const who = booking ? attendeeSummary(booking) : { name: null, email: null, phone: null };
  return {
    code: ticket.ticket_code,
    name: who.name,
    email: who.email,
    phone: who.phone,
    bookingCode: booking?.booking_code ?? null,
    label: `Ticket ${(ticket.ticket_index ?? 0) + 1} of ${booking?.quantity ?? 1}`,
    status: ticket.status,
    scannedAt: ticket.scanned_at instanceof Date ? ticket.scanned_at.toISOString() : null,
    scannedBy: ticket.scanned_by_name ?? (ticket.checked_in_by_organizer_id ? 'Organizer' : null),
  };
}

async function rowsFor(db: Db, tickets: Array<Record<string, any>>): Promise<FeedAttendee[]> {
  const ids = [...new Set(tickets.map((t) => String(t.booking_id)))].map((id) => tickets.find((t) => String(t.booking_id) === id)!.booking_id);
  const bookings = ids.length
    ? await db
        .collection('bookings')
        .find({ _id: { $in: ids }, status: 'confirmed' })
        .project({ booking_code: 1, quantity: 1, attendee: 1, form_responses: 1 })
        .toArray()
    : [];
  const byId = new Map(bookings.map((b) => [String(b._id), b]));
  // A ticket whose booking is not confirmed (e.g. refunded after a late payment) is not an attendee.
  return tickets.filter((t) => byId.has(String(t.booking_id))).map((t) => rowOf(t, byId.get(String(t.booking_id))));
}

/** Tickets issued for confirmed real bookings, and how many of them have been scanned. */
export async function doorCounts(db: Db, orgId: string, eventId: ObjectId): Promise<ScanFeed['counts']> {
  const [totalAgg, scanned] = await Promise.all([
    db
      .collection('bookings')
      .aggregate([
        { $match: { org_id: orgId, event_id: eventId, status: 'confirmed', is_test: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ])
      .toArray(),
    db.collection('tickets').countDocuments({ event_id: eventId, is_test: { $ne: true }, status: 'scanned' }),
  ]);
  const total = totalAgg[0]?.total ?? 0;
  return { total, scanned, remaining: Math.max(0, total - scanned) };
}

export async function buildScanFeed(
  db: Db,
  orgId: string,
  eventId: ObjectId,
  options: { since?: string | null; full?: boolean } = {}
): Promise<ScanFeed> {
  const tickets = db.collection('tickets');
  const realTickets = { event_id: eventId, is_test: { $ne: true } };

  const sinceDate = options.since ? new Date(options.since) : new Date(0);
  const validSince = Number.isNaN(sinceDate.getTime()) ? new Date(0) : sinceDate;

  // Everything that does not depend on something else is asked at the same time, so a poll costs one database wait in a
  // row (two when it needs booking details for new scans) instead of one wait per question.
  const [counts, latest, link, scanners, scans, attendees] = await Promise.all([
    doorCounts(db, orgId, eventId),
    tickets.find({ ...realTickets, status: 'scanned' }).sort({ scanned_at: -1 }).limit(1).project({ scanned_at: 1 }).toArray(),
    getScannerLinkForEvent(db, orgId, eventId),
    listScannersForEvent(db, orgId, eventId),
    options.full
      ? Promise.resolve([] as FeedAttendee[])
      : tickets
          .find({ ...realTickets, status: 'scanned', scanned_at: { $gte: validSince } })
          .sort({ scanned_at: 1 })
          .limit(MAX_SCANS_PER_POLL)
          .toArray()
          .then((recent) => rowsFor(db, recent)),
    options.full
      ? tickets
          .find(realTickets)
          .sort({ booking_id: 1, ticket_index: 1 })
          .limit(MAX_ATTENDEES)
          .toArray()
          .then((all) => rowsFor(db, all))
      : Promise.resolve(null),
  ]);

  return {
    counts,
    link: link ? { slug: link.slug, active: link.active } : null,
    scanners,
    pendingScanners: scanners.filter((s) => s.status === 'pending').length,
    cursor: latest[0]?.scanned_at instanceof Date ? latest[0].scanned_at.toISOString() : null,
    scans,
    attendees,
  };
}
