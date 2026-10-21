import type { Db } from 'mongodb';
import { BOOKING_GROUPS, groupOfStatus, type BookingGroup } from './organizerBookings';

export type EventBookingSummary = {
  id: string;
  name: string;
  status: string;
  start_at: Date | null;
  venue: string | null;
  capacity: number;
  tickets_sold: number;
  /** Bookings per group, plus the tickets on confirmed bookings and how many were checked in. */
  counts: Record<BookingGroup, number>;
  confirmed_tickets: number;
  checked_in: number;
};

const emptyCounts = () =>
  Object.fromEntries((Object.keys(BOOKING_GROUPS) as BookingGroup[]).map((g) => [g, 0])) as Record<BookingGroup, number>;

/**
 * One row per event the organizer owns, with what is happening to its bookings. Events are selected by `org_id`
 * first, and bookings and tickets are then read only for those event ids, so one organizer never sees another's.
 */
export async function bookingOverview(db: Db, orgId: string): Promise<EventBookingSummary[]> {
  const events = await db.collection('events').find({ org_id: orgId }).sort({ start_at: -1 }).toArray();
  if (events.length === 0) return [];
  const ids = events.map((e) => e._id);

  const [byStatus, scanned] = await Promise.all([
    db
      .collection('bookings')
      .aggregate<{ _id: { event: unknown; status: string }; count: number; quantity: number }>([
        { $match: { event_id: { $in: ids } } },
        { $group: { _id: { event: '$event_id', status: '$status' }, count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
      ])
      .toArray(),
    db
      .collection('tickets')
      .aggregate<{ _id: unknown; count: number }>([
        { $match: { event_id: { $in: ids }, status: 'scanned' } },
        { $group: { _id: '$event_id', count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const counts = new Map<string, Record<BookingGroup, number>>();
  const confirmedTickets = new Map<string, number>();
  for (const row of byStatus) {
    const key = String(row._id.event);
    const group = groupOfStatus(row._id.status);
    if (!group) continue;
    const c = counts.get(key) ?? emptyCounts();
    c[group] += row.count;
    counts.set(key, c);
    if (row._id.status === 'confirmed') confirmedTickets.set(key, (confirmedTickets.get(key) ?? 0) + (row.quantity ?? 0));
  }
  const checkedIn = new Map(scanned.map((r) => [String(r._id), r.count]));

  return events.map((e) => {
    const key = String(e._id);
    return {
      id: key,
      name: e.name,
      status: e.status,
      start_at: e.start_at ?? null,
      venue: e.venue ?? null,
      capacity: e.capacity,
      tickets_sold: e.tickets_sold ?? 0,
      counts: counts.get(key) ?? emptyCounts(),
      confirmed_tickets: confirmedTickets.get(key) ?? 0,
      checked_in: checkedIn.get(key) ?? 0,
    };
  });
}
