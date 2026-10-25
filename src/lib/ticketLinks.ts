/**
 * Visitor-facing ticket links for widget bookings. Access is scoped by the organizer id and the visitor id the
 * booking was made with (the same pair the ticket APIs check).
 */
function query(orgId: string, visitorId: string) {
  return `userId=${encodeURIComponent(orgId)}&visitorId=${encodeURIComponent(visitorId)}`;
}

/** The ticket page with QR codes (print / save). */
export function ticketPageUrl(bookingId: string, orgId: string, visitorId: string): string {
  return `/booking/ticket/${encodeURIComponent(bookingId)}?${query(orgId, visitorId)}`;
}

/**
 * The ticket page set to save its PDF as soon as it has drawn the tickets. The PDF is a capture of the tickets as shown,
 * so it always matches the chosen design.
 */
export function ticketDownloadPageUrl(bookingId: string, orgId: string, visitorId: string): string {
  return `${ticketPageUrl(bookingId, orgId, visitorId)}&download=1`;
}

/** Server-drawn PDF (generic layout), kept as the fallback when the page cannot capture the tickets. */
export function ticketPdfUrl(bookingId: string, orgId: string, visitorId: string): string {
  return `/api/embed/bookings/${encodeURIComponent(bookingId)}/ticket/pdf?${query(orgId, visitorId)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TicketAttendee = { name: string | null; email: string | null };

/**
 * One entry per attendee, in ticket order, from either booking flow: widget answers (tagged `attendee`, 1-based, in
 * group bookings) or chat-bot `form_responses` (one object per attendee). Attendees with no data are `null` fields.
 */
export function attendeesOf(booking: Record<string, any>): TicketAttendee[] {
  const found = new Map<number, TicketAttendee>();
  const slot = (i: number) => {
    let a = found.get(i);
    if (!a) found.set(i, (a = { name: null, email: null }));
    return a;
  };

  const groups = new Map<number, unknown[]>();
  for (const a of Array.isArray(booking?.attendee?.answers) ? booking.attendee.answers : []) {
    const i = (typeof a?.attendee === 'number' ? a.attendee : 1) - 1;
    groups.set(i, [...(groups.get(i) ?? []), a]);
  }
  for (const [i, answers] of groups) {
    const list = answers as Array<{ validation_rule?: string; value?: unknown }>;
    const email = (list.find((a) => a.validation_rule === 'email_format') ?? list.find((a) => typeof a.value === 'string' && EMAIL_RE.test(a.value.trim())))?.value;
    slot(i).name = attendeeNameFrom(list);
    slot(i).email = typeof email === 'string' && EMAIL_RE.test(email.trim()) ? email.trim() : null;
  }

  const responses = booking?.form_responses;
  (Array.isArray(responses) ? responses : responses ? [responses] : []).forEach((group: unknown, i: number) => {
    if (!group || typeof group !== 'object') return;
    const entries = Object.entries(group).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim() !== '');
    const email = entries.find(([, v]) => EMAIL_RE.test(v.trim()))?.[1];
    const name = entries.find(([k, v]) => /name/i.test(k) && !EMAIL_RE.test(v.trim()))?.[1];
    const a = slot(i);
    a.email ??= email?.trim() ?? null;
    a.name ??= name?.trim() ?? null;
  });

  const length = found.size ? Math.max(...found.keys()) + 1 : 0;
  return Array.from({ length }, (_, i) => found.get(i) ?? { name: null, email: null });
}

/** Name for ticket `ticketIndex` (0-based). A single-attendee booking names every ticket; a group never borrows another attendee's name. */
export function ticketAttendeeName(attendees: TicketAttendee[], ticketIndex: number): string | null {
  return attendees.length <= 1 ? attendees[0]?.name ?? null : attendees[ticketIndex]?.name ?? null;
}

/** Name to print on the ticket: the answer to a name-type field, if the form had one. */
export function attendeeNameFrom(answers: unknown): string | null {
  if (!Array.isArray(answers)) return null;
  const byRule = answers.find((a) => a?.validation_rule === 'name_format' && typeof a.value === 'string');
  const byLabel = answers.find((a) => /\bname\b/i.test(String(a?.label ?? '')) && typeof a?.value === 'string');
  const value = (byRule ?? byLabel)?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
