import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildTicketPdf } from "@/lib/ticketPdf";

describe("buildTicketPdf", () => {
  it("renders one page per ticket as a valid PDF", async () => {
    const bytes = await buildTicketPdf({
      eventName: "Community Meetup: Building with AI in 2026",
      startAt: new Date("2026-10-20T18:30:00Z"),
      venue: "Hall B, Tech Park",
      bookingCode: "NBK-2026-ABC123",
      attendeeName: "Asha Rao",
      ticketCodes: ["K7Q2M9XP", "R4T8W2ZD"],
      accentColor: "#36f4a4",
    });

    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toContain("Community Meetup");
  });

  it("copes with missing details and characters the standard font cannot draw", async () => {
    const bytes = await buildTicketPdf({
      eventName: "Diwali Mela 🎉 दिवाली",
      startAt: null,
      venue: null,
      bookingCode: null,
      attendeeName: null,
      ticketCodes: ["ABCD2345"],
      accentColor: "not-a-colour",
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
