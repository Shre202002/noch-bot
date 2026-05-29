/**
 * @fileOverview PDF parsing utility using pdf-parse.
 */

// pdf-parse is CommonJS and has no ESM default export.
// Using require() avoids the "Export default doesn't exist" Turbopack error.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export interface ParsedPDF {
  text: string;
  pageCount: number;
  info: Record<string, unknown>;
}

export interface PDFChunk {
  text: string;
  chunkIndex: number;
  totalChunks: number;
}

/** Parse a PDF Buffer into raw text + metadata */
export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const result = await pdfParse(buffer, { max: 0 }); // max:0 = parse all pages
  return {
    text: result.text,
    pageCount: result.numpages,
    info: result.info ?? {},
  };
}

/** Split text into ~300-word overlapping chunks */
export function chunkText(text: string, wordsPerChunk = 300, overlapWords = 30): PDFChunk[] {
  // Normalise whitespace
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

  if (words.length === 0) return [];

  const chunks: PDFChunk[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push({
      text: chunkWords.join(' '),
      chunkIndex: chunks.length,
      totalChunks: 0, // filled in below
    });
    if (end >= words.length) break;
    start += wordsPerChunk - overlapWords;
  }

  // Back-fill totalChunks
  const total = chunks.length;
  chunks.forEach(c => { c.totalChunks = total; });

  return chunks;
}

/** Generate a stable numeric ID for Qdrant points */
export function numericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = (hash & hash);
  }
  return Math.abs(hash) || 1;
}
