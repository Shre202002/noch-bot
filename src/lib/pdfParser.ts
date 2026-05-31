// export interface ParsedPDF {
//   text: string;
//   pageCount: number;
//   info: Record<string, unknown>;
// }

// export interface PDFChunk {
//   text: string;
//   chunkIndex: number;
//   totalChunks: number;
// }

// /** Parse a PDF Buffer into raw text + metadata */
// export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
//   const { extractText } = await import('unpdf');

//   const uint8 = new Uint8Array(buffer);
//   const { text, totalPages } = await extractText(uint8, { mergePages: true });

//   return {
//     text: typeof text === 'string' ? text : text.join('\n'),
//     pageCount: totalPages,
//     info: {},
//   };
// }

// /** Split text into ~300-word overlapping chunks */
// export function chunkText(text: string, wordsPerChunk = 300, overlapWords = 30): PDFChunk[] {
//   const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

//   if (words.length === 0) return [];

//   const chunks: PDFChunk[] = [];
//   let start = 0;

//   while (start < words.length) {
//     const end = Math.min(start + wordsPerChunk, words.length);
//     chunks.push({
//       text: words.slice(start, end).join(' '),
//       chunkIndex: chunks.length,
//       totalChunks: 0,
//     });
//     if (end >= words.length) break;
//     start += wordsPerChunk - overlapWords;
//   }

//   const total = chunks.length;
//   chunks.forEach(c => { c.totalChunks = total; });

//   return chunks;
// }

// /** Generate a stable numeric ID for Qdrant points */
// export function numericId(str: string): number {
//   let hash = 0;
//   for (let i = 0; i < str.length; i++) {
//     const char = str.charCodeAt(i);
//     hash = ((hash << 5) - hash) + char;
//     hash = (hash & hash);
//   }
//   return Math.abs(hash) || 1;
// }

import { unified } from 'unified';

export interface ParsedPDF {
  text: string;
  markdown: string;
  pageCount: number;
  info: Record<string, unknown>;
}

export interface PDFChunk {
  text: string;
  markdown: string;
  chunkIndex: number;
  totalChunks: number;
}

// ── 1. Parse PDF ─────────────────────────────────────────────────────────────

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const { extractText } = await import('unpdf');
  const uint8 = new Uint8Array(buffer);
  const { text, totalPages } = await extractText(uint8, { mergePages: true });

  const raw = typeof text === 'string' ? text : text.join('\n');
  const markdown = textToMarkdown(raw);

  return {
    text: raw,
    markdown,
    pageCount: totalPages,
    info: {},
  };
}

// ── 2. Convert raw text → clean Markdown ─────────────────────────────────────

export function textToMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines (we'll re-add paragraph breaks)
    if (!line) {
      output.push('');
      continue;
    }

    // ALL CAPS short line → Heading (e.g. "INTRODUCTION", "CHAPTER 1")
    if (
      line === line.toUpperCase() &&
      line.length > 2 &&
      line.length < 80 &&
      /[A-Z]/.test(line) &&
      !/^\d+$/.test(line) // not just a page number
    ) {
      output.push(`## ${toTitleCase(line)}`);
      continue;
    }

    // Numbered section like "1. Introduction" or "3.2 Methods"
    if (/^\d+(\.\d+)*\s+[A-Z]/.test(line) && line.length < 80) {
      output.push(`### ${line}`);
      continue;
    }

    // Bullet points (various unicode bullets)
    if (/^[•·▪▸▶\-–*]\s+/.test(line)) {
      const content = line.replace(/^[•·▪▸▶\-–*]\s+/, '').trim();
      output.push(`- ${content}`);
      continue;
    }

    // Numbered list item  "1. something"
    if (/^\d+\.\s+/.test(line)) {
      output.push(line);
      continue;
    }

    // Key-value pairs (common in PDFs): "Author: John Doe"
    if (/^[A-Za-z ]{2,30}:\s+\S/.test(line) && line.length < 120) {
      const colonIdx = line.indexOf(':');
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      output.push(`**${key}:** ${value}`);
      continue;
    }

    // Regular paragraph text
    output.push(line);
  }

  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')  // max 1 blank line between blocks
    .trim();
}

// ── 3. Chunk the Markdown (not raw text) ─────────────────────────────────────
//    Chunks on Markdown = fewer tokens, cleaner semantic boundaries

export function chunkText(
  markdown: string,
  wordsPerChunk = 250,   // reduced from 300 — Markdown is denser
  overlapWords = 25
): PDFChunk[] {
  // Split on paragraph/heading boundaries first for cleaner chunks
  const blocks = markdown
    .split(/\n\n+/)
    .map(b => b.trim())
    .filter(Boolean);

  // Re-merge blocks into word-limited chunks
  const chunks: PDFChunk[] = [];
  let currentWords: string[] = [];
  let currentBlocks: string[] = [];

  const flush = () => {
    if (currentBlocks.length === 0) return;
    const chunkMarkdown = currentBlocks.join('\n\n');
    chunks.push({
      text: chunkMarkdown.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim(), // plain text for embedding
      markdown: chunkMarkdown,
      chunkIndex: chunks.length,
      totalChunks: 0,
    });
  };

  for (const block of blocks) {
    const blockWords = block.split(/\s+/).filter(Boolean);

    // If adding this block exceeds limit, flush and start new chunk with overlap
    if (currentWords.length + blockWords.length > wordsPerChunk && currentWords.length > 0) {
      flush();
      // Overlap: carry last N words into next chunk
      const overlapText = currentWords.slice(-overlapWords).join(' ');
      currentWords = overlapText ? overlapText.split(' ') : [];
      currentBlocks = overlapText ? [overlapText] : [];
    }

    currentWords.push(...blockWords);
    currentBlocks.push(block);
  }

  flush(); // last chunk

  // Back-fill totalChunks
  const total = chunks.length;
  chunks.forEach(c => { c.totalChunks = total; });

  return chunks;
}

// ── 4. Helpers ────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  const minorWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of']);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i === 0 || !minorWords.has(word)) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ');
}

export function numericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = (hash & hash);
  }
  return Math.abs(hash) || 1;
}