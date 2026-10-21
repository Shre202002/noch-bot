/**
 * The short message in the bubble beside the chat icon.
 *
 * With nothing to book it just offers help; with an event that visitors can book right now it announces that event.
 * The rule lives here, on the server, so it is tested; the widget only shows what it is given.
 */

export const DEFAULT_TEASER = "I'm here to help you.";

const MAX_NAME_CHARS = 40;

export type TeaserEvent = {
  id?: string;
  name: string;
  date?: Date | string | null;
  /** Seats a visitor can still book. */
  available_seats: number;
  /** When the event ends; one that has ended is never announced. */
  end_at?: Date | string | null;
};

const time = (value: Date | string | null | undefined): number => {
  if (!value) return Number.NaN;
  const t = (value instanceof Date ? value : new Date(value)).getTime();
  return t;
};

/** "A very long event name that keeps going" trimmed so the bubble stays one or two lines. */
function shortName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_NAME_CHARS ? `${clean.slice(0, MAX_NAME_CHARS - 1).trimEnd()}…` : clean;
}

/** The event the bubble announces: the soonest one that has not ended and still has seats. */
export function liveEventForTeaser<T extends TeaserEvent>(events: T[], now: Date = new Date()): T | null {
  const open = events.filter((e) => {
    if (!e.name?.trim() || !(e.available_seats > 0)) return false;
    const end = time(e.end_at);
    return Number.isNaN(end) || end > now.getTime();
  });
  if (open.length === 0) return null;
  // Soonest first; events without a usable date go last, in the order given.
  return [...open].sort((a, b) => {
    const ta = time(a.date);
    const tb = time(b.date);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  })[0];
}

export function buildTeaser(events: TeaserEvent[], now: Date = new Date()): { teaser: string; eventId: string | null } {
  const event = liveEventForTeaser(events, now);
  if (!event) return { teaser: DEFAULT_TEASER, eventId: null };
  return { teaser: `${shortName(event.name)} is live. Book your tickets now!`, eventId: event.id ?? null };
}
