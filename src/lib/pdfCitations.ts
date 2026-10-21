export type PdfCitation = { filename: string; pages: string | null };

type Passage = { filename?: unknown; pageStart?: unknown; pageEnd?: unknown };

const pageLabel = (start: number, end: number) => (start === end ? `${start}` : `${start}-${end}`);

/**
 * Where an answer came from: one entry per source document, with the pages of the passages used (when the passages
 * carry page numbers; spreadsheets and older uploads do not). Pages are sorted and de-duplicated.
 */
export function buildCitations(passages: Passage[]): PdfCitation[] {
  const byFile = new Map<string, Map<string, number>>();

  for (const p of passages) {
    const filename = typeof p.filename === 'string' && p.filename ? p.filename : 'Unknown file';
    const pages = byFile.get(filename) ?? new Map<string, number>();
    byFile.set(filename, pages);
    if (typeof p.pageStart === 'number') {
      const end = typeof p.pageEnd === 'number' ? p.pageEnd : p.pageStart;
      pages.set(pageLabel(p.pageStart, end), p.pageStart);
    }
  }

  return [...byFile].map(([filename, pages]) => ({
    filename,
    pages: pages.size ? [...pages].sort((a, b) => a[1] - b[1]).map(([label]) => label).join(', ') : null,
  }));
}

/** One line for display under an answer, e.g. `Sources: guide.pdf (p. 3, 5-6)`. Empty when there is nothing to cite. */
export function formatCitations(citations: PdfCitation[]): string {
  if (citations.length === 0) return '';
  const parts = citations.map((c) => (c.pages ? `${c.filename} (p. ${c.pages})` : c.filename));
  return `Sources: ${parts.join('; ')}`;
}
