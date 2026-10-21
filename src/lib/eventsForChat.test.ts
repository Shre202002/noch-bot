import { describe, it, expect } from "vitest";
import { availableSeats, formatEventsSource, type ChatEvent } from "@/lib/eventsForChat";

const event = (overrides: Partial<ChatEvent> = {}): ChatEvent => ({
  name: "Launch Night",
  start_at: new Date("2026-11-05T18:00:00Z"),
  venue: "Hall A",
  is_paid: true,
  price: 499,
  currency: "INR",
  capacity: 100,
  tickets_sold: 60,
  tickets_held: 5,
  ...overrides,
});

describe("availableSeats", () => {
  it("excludes sold and held seats and never goes negative", () => {
    expect(availableSeats(event())).toBe(35);
    expect(availableSeats(event({ tickets_sold: 100, tickets_held: 3 }))).toBe(0);
    expect(availableSeats({ capacity: 10 })).toBe(10);
  });
});

describe("formatEventsSource", () => {
  it("lists date, venue, price and seats left, and says booking happens in the chat", () => {
    const text = formatEventsSource([event()]);
    expect(text).toContain("Event: Launch Night");
    expect(text).toContain("2026");
    expect(text).toContain("Where: Hall A");
    expect(text).toContain("Price: 499 INR per ticket");
    expect(text).toContain("35 seats left");
    expect(text).toContain("book tickets for this event right here in the chat");
  });

  it("marks free and sold-out events", () => {
    const text = formatEventsSource([event({ is_paid: false, price: null, tickets_sold: 100, tickets_held: 0 })]);
    expect(text).toContain("Price: Free");
    expect(text).toContain("Availability: Sold out");
  });

  it("includes at most five events", () => {
    const text = formatEventsSource(Array.from({ length: 7 }, (_, i) => event({ name: `Event ${i}` })));
    expect(text.match(/^Event: /gm)).toHaveLength(5);
  });
});
