/**
 * Decides whether a website-chat message asks to start booking, as opposed to asking about an event.
 *
 * "Book 2 tickets", "I want to register", "sign me up" start the booking flow. Questions that merely mention
 * tickets ("Is the ticket price refundable?", "How much are tickets?", "When does registration close?") are
 * answered from the site's content instead.
 */

/** Phrases that are a clear request to book, whatever else the message says. */
const EXPLICIT_REQUEST = [
  /\b(book|reserve|register|enrol|enroll)\s+(me|us|my|our|a|an|one|two|three|four|five|\d+)\b/,
  /\bsign\s+(me|us)\s+up\b/,
  /\b(i|we)\s*('d| would)\s+like\s+to\s+(book|reserve|register|enrol|enroll|attend|buy|purchase|get)\b/,
  /\b(i|we)\s+(want|wanna|need)\s+(to\s+)?(book|reserve|register|enrol|enroll|attend|buy|purchase|get|join)\b/,
  /\b(i|we)\s+(want|need)\s+(\d+|a|an|one|two|three|four|five|some)?\s*(ticket|tickets|seat|seats|pass|passes|spot|spots)\b/,
  /\b(buy|purchase|get|grab)\s+(\d+|a|an|one|two|three|four|five|some|my|the)?\s*(ticket|tickets|seat|seats|pass|passes|spot|spots)\b/,
  /^(book|reserve|register|enrol|enroll)( now| tickets?| a ticket| for)?[.!]?$/,
  /\b(how|where)\s+(do|can)\s+(i|we)\s+(book|reserve|register|enrol|enroll|buy|purchase)\b/,
  /\b(can|could|may)\s+(i|we)\s+(book|reserve|register|enrol|enroll|buy|purchase)\b/,
];

/** Words that make a message a question about tickets rather than a request to book. */
const INFO_QUESTION = /\b(price|prices|cost|costs|how much|fee|fees|refund|refundable|cancel|cancellation|policy|deadline|close|closes|open|opens|when|available|availability|left|sold out|discount|transfer|change|upgrade|include|includes|included)\b/;

export function isBookingIntent(message: string): boolean {
  const text = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (EXPLICIT_REQUEST.some((re) => re.test(text))) return true;
  // A bare booking verb with no question about details ("Booking for Saturday", "registration please").
  const mentionsBooking = /\b(book|booking|reserve|register|registration|enrol|enroll|rsvp)\b/.test(text);
  return mentionsBooking && !INFO_QUESTION.test(text);
}
