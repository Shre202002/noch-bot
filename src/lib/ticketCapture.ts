import { PDFDocument } from 'pdf-lib';

/**
 * The ticket PDF is a capture of the tickets as the visitor sees them (one per page), so it can never differ from the
 * chosen design. Browser only: it reads the drawn elements.
 */

const MARGIN = 24; // points
const MAX_PAGE_WIDTH = 595; // A4 width in points; wider cards are scaled down

/** Page size in points for a card of the given on-screen size: the card plus an even margin, never wider than A4. */
export function pageSizeFor(cardWidth: number, cardHeight: number): { width: number; height: number; scale: number } {
  const w = Math.max(1, cardWidth);
  const h = Math.max(1, cardHeight);
  const scale = Math.min(1, (MAX_PAGE_WIDTH - MARGIN * 2) / w);
  return { width: Math.round(w * scale + MARGIN * 2), height: Math.round(h * scale + MARGIN * 2), scale };
}

/** File name for the download, from the booking code (letters, digits and dashes only). */
export function ticketPdfFileName(bookingCode: string | null | undefined): string {
  const clean = String(bookingCode ?? '').replace(/[^A-Za-z0-9-]/g, '');
  return `tickets-${clean || 'booking'}.pdf`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Capture each element as an image and put one per page. Throws if a card cannot be captured (the caller falls back). */
export async function ticketPdfFromElements(elements: HTMLElement[], title: string): Promise<Uint8Array> {
  if (elements.length === 0) throw new Error('No tickets to capture');
  // Loaded here so the capture code is only downloaded when a visitor asks for the PDF.
  const { toPng } = await import('html-to-image');
  if (document.fonts?.ready) await document.fonts.ready;

  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const png = await toPng(el, { pixelRatio: 3, cacheBust: true });
    const image = await pdf.embedPng(dataUrlToBytes(png));
    const size = pageSizeFor(rect.width, rect.height);
    const page = pdf.addPage([size.width, size.height]);
    page.drawImage(image, { x: MARGIN, y: MARGIN, width: size.width - MARGIN * 2, height: size.height - MARGIN * 2 });
  }
  return pdf.save();
}

/** Hand the PDF bytes to the browser as a download. */
export function savePdf(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
