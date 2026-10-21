import { describe, it, expect } from "vitest";
import { buildTeaser, DEFAULT_TEASER, liveEventForTeaser } from "@/lib/widgetTeaser";

const NOW = new Date("2026-10-21T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86400_000).toISOString();

describe("buildTeaser", () => {
  it("offers help when there is no event", () => {
    expect(buildTeaser([], NOW)).toEqual({ teaser: DEFAULT_TEASER, eventId: null });
    expect(DEFAULT_TEASER).toBe("I'm here to help you.");
  });

  it("announces a live event by name", () => {
    expect(buildTeaser([{ id: "e1", name: "Launch Party", date: day(3), available_seats: 20 }], NOW)).toEqual({
      teaser: "Launch Party is live. Book your tickets now!",
      eventId: "e1",
    });
  });

  it("announces the soonest of several events", () => {
    const events = [
      { id: "late", name: "Later", date: day(30), available_seats: 5 },
      { id: "soon", name: "Sooner", date: day(2), available_seats: 5 },
      { id: "mid", name: "Middle", date: day(10), available_seats: 5 },
    ];
    expect(buildTeaser(events, NOW).eventId).toBe("soon");
  });

  it("skips a sold-out event and announces the next one", () => {
    const events = [
      { id: "full", name: "Sold Out", date: day(1), available_seats: 0 },
      { id: "open", name: "Open", date: day(5), available_seats: 3 },
    ];
    expect(buildTeaser(events, NOW).eventId).toBe("open");
  });

  it("falls back to the help message when every event is sold out", () => {
    expect(buildTeaser([{ id: "full", name: "Sold Out", date: day(1), available_seats: 0 }], NOW)).toEqual({
      teaser: DEFAULT_TEASER,
      eventId: null,
    });
  });

  it("never announces an event that has ended", () => {
    const events = [{ id: "over", name: "Over", date: day(-2), end_at: day(-1), available_seats: 10 }];
    expect(buildTeaser(events, NOW).eventId).toBeNull();
  });

  it("announces an event that is happening now", () => {
    const events = [{ id: "now", name: "Now", date: day(-0.1), end_at: day(0.2), available_seats: 10 }];
    expect(buildTeaser(events, NOW).eventId).toBe("now");
  });

  it("trims a very long name", () => {
    const name = "The International Conference on Everything You Always Wanted to Know";
    const { teaser } = buildTeaser([{ id: "x", name, date: day(1), available_seats: 1 }], NOW);
    expect(teaser).toMatch(/^.{1,40}… is live\. Book your tickets now!$/);
    expect(teaser).not.toContain("Wanted to Know");
  });

  it("keeps a name of exactly the limit whole", () => {
    const name = "A".repeat(40);
    expect(buildTeaser([{ name, date: day(1), available_seats: 1 }], NOW).teaser).toBe(`${name} is live. Book your tickets now!`);
  });

  it("collapses stray whitespace in the name", () => {
    expect(buildTeaser([{ name: "  Big   Night\n Out ", date: day(1), available_seats: 1 }], NOW).teaser).toBe("Big Night Out is live. Book your tickets now!");
  });

  it("copes with missing or invalid dates and empty names", () => {
    const events = [
      { id: "nodate", name: "No Date", date: null, available_seats: 2 },
      { id: "bad", name: "Bad Date", date: "not a date", available_seats: 2 },
      { id: "blank", name: "   ", date: day(1), available_seats: 2 },
      { id: "dated", name: "Dated", date: day(4), available_seats: 2 },
    ];
    expect(buildTeaser(events, NOW).eventId).toBe("dated");
    expect(buildTeaser(events.slice(0, 2), NOW).eventId).toBe("nodate");
  });

  it("returns a null event id when the event has none", () => {
    expect(buildTeaser([{ name: "Anon", date: day(1), available_seats: 1 }], NOW).eventId).toBeNull();
  });
});

describe("liveEventForTeaser", () => {
  it("does not change the order of the list it is given", () => {
    const events = [
      { name: "B", date: day(9), available_seats: 1 },
      { name: "A", date: day(1), available_seats: 1 },
    ];
    liveEventForTeaser(events, NOW);
    expect(events.map((e) => e.name)).toEqual(["B", "A"]);
  });
});
