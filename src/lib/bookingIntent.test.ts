import { describe, it, expect } from "vitest";
import { isBookingIntent } from "@/lib/bookingIntent";

describe("isBookingIntent", () => {
  it.each([
    "Book 2 tickets",
    "book me a seat for the workshop",
    "I want to register",
    "I'd like to buy tickets",
    "We need 3 tickets",
    "sign me up",
    "Can I book for Saturday?",
    "How do I register?",
    "get 2 passes please",
    "Book now",
    "RSVP for the event",
  ])("starts booking for %j", (msg) => {
    expect(isBookingIntent(msg)).toBe(true);
  });

  it.each([
    "Is the ticket price refundable?",
    "How much are tickets?",
    "When does registration close?",
    "Are there seats left?",
    "What does the ticket include?",
    "Tell me about the event",
    "Who is speaking at the conference?",
    "",
  ])("answers instead of booking for %j", (msg) => {
    expect(isBookingIntent(msg)).toBe(false);
  });
});
