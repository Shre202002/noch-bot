import { embedTexts } from './embeddings';
import { chunkPages, numericId, parsePDF } from './pdfParser';
import { ensurePdfVectorStore, type VectorPayload } from './vectorStore';

export type PdfPoint = { id: string | number; vector: number[]; payload: VectorPayload };

/**
 * Turn a PDF into embedded passages for the PDF vector collection. Used for new uploads and for PDFs added to an
 * existing document: `chunkIndexOffset` continues the document's passage numbering, and `filename` is the file the
 * passages came from (so answers can cite it).
 */
export async function pdfToPoints(params: {
  buffer: Buffer;
  userId: string;
  fileId: string;
  filename: string;
  label: string;
  uploadedAt: string;
  chunkIndexOffset?: number;
}): Promise<{ points: PdfPoint[]; pageCount: number; markdown: string; characters: number } | { error: string }> {
  const { text, markdown, pages, pageCount } = await parsePDF(params.buffer);
  if (!text || text.trim().length < 50) {
    return { error: 'Could not extract text from this PDF. It may be scanned/image-only.' };
  }

  console.log(`[pdf-ingest] "${params.filename}" - ${pageCount} pages, ${text.length} chars`);
  const rawChunks = chunkPages(pages);
  if (rawChunks.length === 0) return { error: 'Could not create text chunks from this PDF.' };
  console.log(`[pdf-ingest] ${rawChunks.length} chunks`);

  await ensurePdfVectorStore();
  const vectors = await embedTexts(rawChunks.map((chunk) => chunk.text));
  const offset = params.chunkIndexOffset ?? 0;

  const points = rawChunks.map((chunk, i) => {
    const chunkIndex = chunk.chunkIndex + offset;
    return {
      id: numericId(`pdf-${params.fileId}-${chunkIndex}-${chunk.text.slice(0, 30)}`),
      vector: vectors[i],
      payload: {
        userId:      params.userId,
        fileId:      params.fileId,
        filename:    params.filename,
        label:       params.label,
        text:        chunk.text,
        markdown:    chunk.markdown,
        chunkIndex,
        totalChunks: chunk.totalChunks,
        pageStart:   chunk.pageStart,
        pageEnd:     chunk.pageEnd,
        docType:     'pdf',
        pageCount,
        uploadedAt:  params.uploadedAt,
      },
    };
  });
  return { points, pageCount, markdown, characters: text.length };
}
