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
  const { extractText } = await import('unpdf');

  const uint8 = new Uint8Array(buffer);
  const { text, totalPages } = await extractText(uint8, { mergePages: true });

  return {
    text: typeof text === 'string' ? text : text.join('\n'),
    pageCount: totalPages,
    info: {},
  };
}

/** Split text into ~300-word overlapping chunks */
export function chunkText(text: string, wordsPerChunk = 300, overlapWords = 30): PDFChunk[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

  if (words.length === 0) return [];

  const chunks: PDFChunk[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push({
      text: words.slice(start, end).join(' '),
      chunkIndex: chunks.length,
      totalChunks: 0,
    });
    if (end >= words.length) break;
    start += wordsPerChunk - overlapWords;
  }

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