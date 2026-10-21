import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from 'pdf-lib';
import QRCode from 'qrcode';

/**
 * Printable tickets as a PDF: one page per ticket with the event details and a QR code of the ticket code (the value
 * the door scanner reads; it is verified server-side against the ticket's signature).
 */

export interface TicketPdfInput {
  eventName: string;
  startAt: Date | string | null;
  venue: string | null;
  bookingCode: string | null;
  attendeeName: string | null;
  ticketCodes: string[];
  /** Hex colour from the event's ticket palette, used for the header band. */
  accentColor?: string | null;
}

const PAGE = { width: 420, height: 595 }; // A5 portrait, points
const MARGIN = 36;

function hexToRgb(hex: string | null | undefined, fallback: RGB): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Pick black or white text for a background colour. */
function onColor(c: RGB): RGB {
  const l = 0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue;
  return l > 0.55 ? rgb(0.05, 0.05, 0.05) : rgb(1, 1, 1);
}

function formatWhen(value: Date | string | null): string {
  if (!value) return 'See event details';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? 'See event details'
    : `${d.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** Keep text drawable with the standard (WinAnsi) font: unsupported characters become "?". */
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

/** Wrap text into lines that fit `maxWidth`. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 3): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export async function buildTicketPdf(input: TicketPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Tickets - ${safe(input.eventName)}`);
  doc.setProducer('NochBot');
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const accent = hexToRgb(input.accentColor, rgb(0.21, 0.96, 0.64));
  const ink = rgb(0.07, 0.07, 0.09);
  const muted = rgb(0.38, 0.4, 0.44);
  const width = PAGE.width - MARGIN * 2;
  const total = input.ticketCodes.length;

  for (const [index, code] of input.ticketCodes.entries()) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    let y = PAGE.height;

    // Header band
    const bandHeight = 120;
    page.drawRectangle({ x: 0, y: y - bandHeight, width: PAGE.width, height: bandHeight, color: accent });
    const headerInk = onColor(accent);
    page.drawText('ADMIT ONE', { x: MARGIN, y: y - 34, size: 10, font: bold, color: headerInk });
    page.drawText(`Ticket ${index + 1} of ${total}`, {
      x: PAGE.width - MARGIN - regular.widthOfTextAtSize(`Ticket ${index + 1} of ${total}`, 10),
      y: y - 34, size: 10, font: regular, color: headerInk,
    });
    let ty = y - 62;
    for (const line of wrap(input.eventName, bold, 20, width, 2)) {
      page.drawText(line, { x: MARGIN, y: ty, size: 20, font: bold, color: headerInk });
      ty -= 24;
    }
    y -= bandHeight + 28;

    // Details
    const detail = (label: string, value: string) => {
      page.drawText(label.toUpperCase(), { x: MARGIN, y, size: 8, font: bold, color: muted });
      y -= 14;
      for (const line of wrap(value, regular, 12, width, 2)) {
        page.drawText(line, { x: MARGIN, y, size: 12, font: regular, color: ink });
        y -= 16;
      }
      y -= 8;
    };
    detail('When', formatWhen(input.startAt));
    if (input.venue) detail('Where', input.venue);
    if (input.attendeeName) detail('Attendee', input.attendeeName);

    // QR code + code
    const qrSize = 170;
    const qrPng = await QRCode.toBuffer(code, { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: qrSize * 3 });
    const qr = await doc.embedPng(qrPng);
    const qrY = Math.max(y - qrSize - 6, 110);
    page.drawImage(qr, { x: (PAGE.width - qrSize) / 2, y: qrY, width: qrSize, height: qrSize });
    const codeText = safe(code);
    page.drawText(codeText, {
      x: (PAGE.width - mono.widthOfTextAtSize(codeText, 16)) / 2,
      y: qrY - 24, size: 16, font: mono, color: ink,
    });

    // Footer
    page.drawLine({ start: { x: MARGIN, y: 66 }, end: { x: PAGE.width - MARGIN, y: 66 }, thickness: 0.5, color: muted });
    if (input.bookingCode) {
      page.drawText(`Booking ${safe(input.bookingCode)}`, { x: MARGIN, y: 48, size: 9, font: regular, color: muted });
    }
    const note = 'Show this QR code at the entrance. Each ticket can be scanned once.';
    page.drawText(note, { x: MARGIN, y: 34, size: 8, font: regular, color: muted });
  }

  return doc.save();
}
