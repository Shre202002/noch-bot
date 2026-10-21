import { describe, expect, it } from "vitest";
import { pageSizeFor, ticketPdfFileName } from "@/lib/ticketCapture";
import { ticketDownloadPageUrl, ticketPageUrl } from "@/lib/ticketLinks";

describe("pageSizeFor", () => {
  it("adds an even margin around a card that fits on the page", () => {
    expect(pageSizeFor(400, 200)).toEqual({ width: 448, height: 248, scale: 1 });
  });

  it("scales a wide card down so the page is never wider than A4", () => {
    const size = pageSizeFor(1000, 500);
    expect(size.width).toBe(595);
    expect(size.scale).toBeCloseTo(0.547, 2);
    // The card keeps its proportions.
    expect((size.width - 48) / (size.height - 48)).toBeCloseTo(2, 1);
  });

  it("copes with an empty measurement", () => {
    expect(pageSizeFor(0, 0).width).toBeGreaterThan(0);
  });
});

describe("ticketPdfFileName", () => {
  it("uses the booking code, keeping letters, digits and dashes", () => {
    expect(ticketPdfFileName("NBK-2026-3E0493")).toBe("tickets-NBK-2026-3E0493.pdf");
    expect(ticketPdfFileName('a/b"c d')).toBe("tickets-abcd.pdf");
  });

  it("has a name when there is no code", () => {
    expect(ticketPdfFileName(null)).toBe("tickets-booking.pdf");
  });
});

describe("ticketDownloadPageUrl", () => {
  it("is the ticket page with the download flag", () => {
    expect(ticketDownloadPageUrl("b1", "org", "vis")).toBe(`${ticketPageUrl("b1", "org", "vis")}&download=1`);
  });
});
