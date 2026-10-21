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

/** Name to print on the ticket: the answer to a name-type field, if the form had one. */
export function attendeeNameFrom(answers: unknown): string | null {
  if (!Array.isArray(answers)) return null;
  const byRule = answers.find((a) => a?.validation_rule === 'name_format' && typeof a.value === 'string');
  const byLabel = answers.find((a) => /\bname\b/i.test(String(a?.label ?? '')) && typeof a?.value === 'string');
  const value = (byRule ?? byLabel)?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
