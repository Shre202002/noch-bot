import { describe, expect, it } from "vitest";
import { pageSizeFor, ticketPdfFileName, ticketPngFileName } from "@/lib/ticketCapture";
import { ticketDownloadPageUrl, ticketPageUrl } from "@/lib/ticketLinks";

describe("pageSizeFor", () => {
  it("is the card at its natural size, with no margin", () => {
    expect(pageSizeFor(520, 400)).toEqual({ width: 390, height: 300 });
  });

  it("copes with an empty measurement", () => {
    expect(pageSizeFor(0, 0)).toEqual({ width: 1, height: 1 });
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

describe("ticketPngFileName", () => {
  it("has one file for one ticket and numbers several", () => {
    expect(ticketPngFileName("NBK-2026-3E0493", 0, 1)).toBe("ticket-NBK-2026-3E0493.png");
    expect(ticketPngFileName("NBK-2026-3E0493", 1, 3)).toBe("ticket-NBK-2026-3E0493-2.png");
    expect(ticketPngFileName(null, 0, 1)).toBe("ticket-booking.png");
  });
});

describe("ticketDownloadPageUrl", () => {
  it("is the ticket page with the download flag", () => {
    expect(ticketDownloadPageUrl("b1", "org", "vis")).toBe(`${ticketPageUrl("b1", "org", "vis")}&download=1`);
  });
});
