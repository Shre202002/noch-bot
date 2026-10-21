export interface ParsedPDF {
  /** Plain text of the whole document, pages separated by blank lines. */
  text: string;
  /** Lightly structured Markdown of the whole document (headings, bullets, paragraphs). */
  markdown: string;
  /** Text of each page, as extracted (index 0 = page 1). */
  pages: string[];
  pageCount: number;
  info: Record<string, unknown>;
}

export interface PDFChunk {
  /** Plain text used for embedding. */
  text: string;
  /** Markdown version shown to the LLM as context. */
  markdown: string;
  chunkIndex: number;
  totalChunks: number;
  /** 1-based page range the chunk was taken from. */
  pageStart: number;
  pageEnd: number;
}

export interface ChunkOptions {
  wordsPerChunk?: number;
  overlapWords?: number;
}

const DEFAULT_WORDS_PER_CHUNK = 220;
const DEFAULT_OVERLAP_WORDS = 40;

// ── 1. Parse PDF ────────────────────────────────────────────────────────────

/**
 * Extract text page by page. unpdf's mergePages mode drops every line break,
 * which leaves nothing to split on; per-page mode keeps one line per visual line.
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const { extractText } = await import('unpdf');
  const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: false });

  const pages = (Array.isArray(text) ? text : [text]).map((page) => page ?? '');
  const segmentsByPage = pages.map((page, i) => pageToSegments(page, i + 1));

  return {
    text: segmentsByPage
      .map((segments) => segments.map((s) => s.text).join(' '))
      .filter(Boolean)
      .join('\n\n'),
    markdown: segmentsToMarkdown(segmentsByPage.flat()),
    pages,
    pageCount: totalPages,
    info: {},
  };
}

// ── 2. Page text → structured segments ─────────────────────────────────────

type SegmentKind = 'heading' | 'bullet' | 'sentence';

interface Segment {
  kind: SegmentKind;
  text: string;
  page: number;
  /** Paragraph counter, used to put blank lines between paragraphs in Markdown. */
  paragraph: number;
}

const BULLET_RE = /^[•·▪▸▶►◦‣○●■□✓✔\-–—*]\s*/;
const SENTENCE_SPLIT_RE = /(?<=[.!?:;])\s+(?=["'“‘(\[]?[A-Z0-9•])/;

function isHeading(line: string): boolean {
  if (line.length < 3 || line.length > 80 || /[.,;]$/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length > 10) return false;
  // "INTRODUCTION", "CHAPTER 3"
  if (line === line.toUpperCase() && /[A-Z]{2}/.test(line)) return true;
  // "1. Introduction", "3.2 Methods"
  return /^\d+(\.\d+)*\.?\s+[A-Z]/.test(line);
}

let paragraphCounter = 0;

function pageToSegments(pageText: string, page: number): Segment[] {
  const lines = pageText.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const segments: Segment[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    // Re-join hyphenated words broken across lines: "auto-" + "matic".
    const joined = paragraph.join('\n').replace(/([a-z])-\n([a-z])/g, '$1$2').replace(/\n/g, ' ');
    const id = ++paragraphCounter;
    for (const sentence of joined.split(SENTENCE_SPLIT_RE)) {
      const text = sentence.trim();
      if (text) segments.push({ kind: 'sentence', text, page, paragraph: id });
    }
    paragraph = [];
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      continue;
    }
    // Bare page numbers ("3", "Page 3 of 10") add noise to every chunk.
    if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(line)) continue;

    if (BULLET_RE.test(line) && line.replace(BULLET_RE, '').length > 0 && !/^[-–—]\d/.test(line)) {
      flushParagraph();
      segments.push({ kind: 'bullet', text: line.replace(BULLET_RE, ''), page, paragraph: ++paragraphCounter });
    } else if (isHeading(line)) {
      flushParagraph();
      segments.push({ kind: 'heading', text: line, page, paragraph: ++paragraphCounter });
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  return segments;
}

function segmentsToMarkdown(segments: Segment[]): string {
  const out: string[] = [];
  let prev: Segment | undefined;
  for (const s of segments) {
    const sameParagraph = prev && prev.kind === 'sentence' && s.kind === 'sentence' && prev.paragraph === s.paragraph;
    const sameList = prev && prev.kind === 'bullet' && s.kind === 'bullet';
    const separator = !prev ? '' : sameParagraph ? ' ' : sameList ? '\n' : '\n\n';
    const body = s.kind === 'heading' ? `## ${s.text}` : s.kind === 'bullet' ? `- ${s.text}` : s.text;
    out.push(separator + body);
    prev = s;
  }
  return out.join('').trim();
}

// ── 3. Chunk ────────────────────────────────────────────────────────────────

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Split a segment that alone exceeds the chunk budget (e.g. a table with no punctuation). */
function splitOversized(segment: Segment, maxWords: number): Segment[] {
  const words = segment.text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [segment];
  const parts: Segment[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    parts.push({ ...segment, text: words.slice(i, i + maxWords).join(' ') });
  }
  return parts;
}

/**
 * Chunk page texts into ~wordsPerChunk-word chunks on sentence boundaries,
 * carrying ~overlapWords of trailing sentences into the next chunk and
 * recording the page range of every chunk.
 */
export function chunkPages(pages: string[], options: ChunkOptions = {}): PDFChunk[] {
  const wordsPerChunk = options.wordsPerChunk ?? DEFAULT_WORDS_PER_CHUNK;
  const overlapWords = options.overlapWords ?? DEFAULT_OVERLAP_WORDS;

  const segments = pages
    .flatMap((page, i) => pageToSegments(page, i + 1))
    .flatMap((s) => splitOversized(s, wordsPerChunk));

  const chunks: PDFChunk[] = [];
  let current: Segment[] = [];
  let currentWords = 0;
  // Segments carried over as overlap; a chunk made only of these is not emitted.
  let carried = 0;

  const flush = () => {
    if (current.length <= carried) return;
    const markdown = segmentsToMarkdown(current);
    chunks.push({
      text: current.map((s) => s.text).join(' '),
      markdown,
      chunkIndex: chunks.length,
      totalChunks: 0,
      pageStart: current[0].page,
      pageEnd: current[current.length - 1].page,
    });
  };

  for (const segment of segments) {
    const words = wordCount(segment.text);
    const full = currentWords + words > wordsPerChunk;
    // Start a new chunk at a heading once the current one is reasonably filled.
    const headingBreak = segment.kind === 'heading' && currentWords >= wordsPerChunk * 0.5;

    if ((full || headingBreak) && current.length > carried) {
      // A heading at the very end of a chunk belongs with the section it introduces.
      const trailingHeadings: Segment[] = [];
      while (current.length > carried + 1 && current[current.length - 1].kind === 'heading') {
        trailingHeadings.unshift(current.pop()!);
      }
      flush();
      if (trailingHeadings.length > 0) {
        current = trailingHeadings;
        currentWords = trailingHeadings.reduce((n, s) => n + wordCount(s.text), 0);
        carried = 0;
        current.push(segment);
        currentWords += words;
        continue;
      }
      // Overlap: trailing sentences/bullets (never headings) up to overlapWords.
      const overlap: Segment[] = [];
      let overlapCount = 0;
      for (let i = current.length - 1; i >= 0 && !headingBreak; i--) {
        const w = wordCount(current[i].text);
        if (current[i].kind === 'heading' || overlapCount + w > overlapWords) break;
        overlap.unshift(current[i]);
        overlapCount += w;
      }
      current = overlap;
      currentWords = overlapCount;
      carried = overlap.length;
    }

    current.push(segment);
    currentWords += words;
  }
  flush();

  chunks.forEach((c) => { c.totalChunks = chunks.length; });
  return chunks;
}

// ── 4. Helpers ──────────────────────────────────────────────────────────────

export function numericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = (hash & hash);
  }
  return Math.abs(hash) || 1;
}
