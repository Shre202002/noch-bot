import type { Db } from 'mongodb';

/**
 * The organizer's upcoming published events as a chat source, so the website assistant can answer "when is it?",
 * "how much?", "are seats left?" from real event data and offer to book.
 */

export interface ChatEvent {
  name: string;
  description?: string | null;
  start_at: Date | string;
  end_at?: Date | string | null;
  venue?: string | null;
  is_paid?: boolean;
  price?: number | null;
  currency?: string | null;
  capacity: number;
  tickets_sold?: number;
  tickets_held?: number;
}

const MAX_EVENTS = 5;
const MAX_DESCRIPTION_CHARS = 300;

/** Seats a visitor can still book: held seats (checkouts in progress) are not available. */
export function availableSeats(event: Pick<ChatEvent, 'capacity' | 'tickets_sold' | 'tickets_held'>): number {
  return Math.max(0, event.capacity - (event.tickets_sold ?? 0) - (event.tickets_held ?? 0));
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'date to be announced';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? 'date to be announced'
    : `${d.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

function formatPrice(e: ChatEvent): string {
  if (!e.is_paid || !e.price) return 'Free';
  return `${e.price} ${e.currency ?? ''}`.trim() + ' per ticket';
}

/** Plain-text source describing up to five events (soonest first). */
export function formatEventsSource(events: ChatEvent[]): string {
  return events
    .slice(0, MAX_EVENTS)
    .map((e) => {
      const seats = availableSeats(e);
      const lines = [
        `Event: ${e.name}`,
        `When: ${formatDate(e.start_at)}${e.end_at ? ` until ${formatDate(e.end_at)}` : ''}`,
        `Where: ${e.venue || 'see event details'}`,
        `Price: ${formatPrice(e)}`,
        `Availability: ${seats > 0 ? `${seats} seat${seats === 1 ? '' : 's'} left` : 'Sold out'}`,
      ];
      if (e.description) lines.push(`About: ${String(e.description).slice(0, MAX_DESCRIPTION_CHARS)}`);
      lines.push('Booking: visitors can book tickets for this event right here in the chat.');
      return lines.join('\n');
    })
    .join('\n\n');
}

/** The organizer's published events that have not ended, soonest first. */
export async function loadUpcomingEvents(db: Db, orgId: string, now: Date = new Date()): Promise<ChatEvent[]> {
  return (await db
    .collection('events')
    .find(
      { org_id: orgId, status: 'published', end_at: { $gt: now } },
      {
        projection: {
          _id: 0, name: 1, description: 1, start_at: 1, end_at: 1, venue: 1, is_paid: 1, price: 1, currency: 1,
          capacity: 1, tickets_sold: 1, tickets_held: 1,
        },
      }
    )
    .sort({ start_at: 1 })
    .limit(MAX_EVENTS)
    .toArray()) as unknown as ChatEvent[];
}
