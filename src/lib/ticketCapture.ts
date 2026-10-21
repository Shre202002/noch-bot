import { PDFDocument, rgb } from 'pdf-lib';

/**
 * The ticket PDF is a capture of the tickets as the visitor sees them (one per page), so it can never differ from the
 * chosen design. Browser only: it reads the drawn elements. Each page is exactly the ticket, with nothing around it.
 */

const PIXEL_RATIO = 3; // capture sharpness; keeps the QR code scannable
const PT_PER_PX = 0.75; // 96 px per inch on screen, 72 points per inch in a PDF

/** Page size in points for a card of the given on-screen size: the card at its natural size. */
export function pageSizeFor(cardWidth: number, cardHeight: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(cardWidth * PT_PER_PX)),
    height: Math.max(1, Math.round(cardHeight * PT_PER_PX)),
  };
}

type Box = { left: number; top: number; width: number; height: number };

/** Where the card sits inside the captured wrapper image, in image pixels (the capture is scaled by `pixelRatio`). */
export function cropRect(wrapper: Box, card: Box, pixelRatio: number): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.max(0, Math.round((card.left - wrapper.left) * pixelRatio)),
    y: Math.max(0, Math.round((card.top - wrapper.top) * pixelRatio)),
    width: Math.max(1, Math.round(card.width * pixelRatio)),
    height: Math.max(1, Math.round(card.height * pixelRatio)),
  };
}

/** File name for the download, from the booking code (letters, digits and dashes only). */
export function ticketPdfFileName(bookingCode: string | null | undefined): string {
  const clean = String(bookingCode ?? '').replace(/[^A-Za-z0-9-]/g, '');
  return `tickets-${clean || 'booking'}.pdf`;
}

/** File name for one ticket image: `ticket-<code>.png`, numbered when the booking has several tickets. */
export function ticketPngFileName(bookingCode: string | null | undefined, index: number, count: number): string {
  const clean = String(bookingCode ?? '').replace(/[^A-Za-z0-9-]/g, '') || 'booking';
  return count > 1 ? `ticket-${clean}-${index + 1}.png` : `ticket-${clean}.png`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the captured ticket'));
    image.src = src;
  });
}

/** The red "Test ticket" stamp, in the card's top-right corner, as on the page. */
function drawTestStamp(context: CanvasRenderingContext2D, cardWidth: number): void {
  const k = PIXEL_RATIO;
  context.save();
  context.font = `900 ${12 * k}px system-ui, sans-serif`;
  context.textBaseline = 'middle';
  const text = 'TEST TICKET';
  const spacing = 1.8 * k;
  const textWidth = [...text].reduce((sum, ch) => sum + context.measureText(ch).width + spacing, 0) - spacing;
  const w = textWidth + 24 * k;
  const h = 28 * k;
  context.translate(cardWidth - 12 * k - w / 2, 12 * k + h / 2 + 6 * k);
  context.rotate((6 * Math.PI) / 180);
  context.shadowColor = 'rgba(0,0,0,0.35)';
  context.shadowBlur = 8 * k;
  context.fillStyle = 'rgba(239,68,68,0.9)';
  context.strokeStyle = '#ef4444';
  context.lineWidth = 2 * k;
  context.beginPath();
  context.roundRect(-w / 2, -h / 2, w, h, 6 * k);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();
  context.fillStyle = '#ffffff';
  let x = -textWidth / 2;
  for (const ch of text) {
    context.fillText(ch, x, 0);
    x += context.measureText(ch).width + spacing;
  }
  context.restore();
}

/** The captured wrapper cut down to the card inside it, so the page has no empty space or shadow around the ticket. */
async function cropToCard(png: string, wrapper: HTMLElement): Promise<string> {
  const card = wrapper.firstElementChild;
  if (!card) return png;
  const crop = cropRect(wrapper.getBoundingClientRect(), card.getBoundingClientRect(), PIXEL_RATIO);
  const image = await loadImage(png);
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext('2d');
  if (!context) return png;
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  // On the page the stamp sits at the wrapper's edge, which is outside a narrower card, so it is drawn on the card here.
  if (wrapper.querySelector('[data-test-stamp]')) drawTestStamp(context, crop.width);
  return canvas.toDataURL('image/png');
}

/** One ticket exactly as shown, as a PNG (data URL), cut down to the card itself. */
export async function ticketPngFromElement(el: HTMLElement): Promise<string> {
  // Loaded here so the capture code is only downloaded when a visitor asks for a file.
  const { toPng } = await import('html-to-image');
  if (document.fonts?.ready) await document.fonts.ready;
  // The wrapper is captured (not just the card) so the "Test ticket" stamp that sits over a test ticket is included.
  const wrapperPng = await toPng(el, { pixelRatio: PIXEL_RATIO, cacheBust: true });
  return cropToCard(wrapperPng, el);
}

/** Capture each element as an image and put one per page. Throws if a card cannot be captured (the caller falls back). */
export async function ticketPdfFromElements(elements: HTMLElement[], title: string): Promise<Uint8Array> {
  if (elements.length === 0) throw new Error('No tickets to capture');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  for (const el of elements) {
    const image = await pdf.embedPng(dataUrlToBytes(await ticketPngFromElement(el)));
    const card = (el.firstElementChild ?? el).getBoundingClientRect();
    const size = pageSizeFor(card.width, card.height);
    const page = pdf.addPage([size.width, size.height]);
    // The card's rounded corners are transparent; paper white behind them.
    page.drawRectangle({ x: 0, y: 0, width: size.width, height: size.height, color: rgb(1, 1, 1) });
    page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
  }
  return pdf.save();
}

/** Hand a PNG (data URL) to the browser as a download. */
export function savePng(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
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
