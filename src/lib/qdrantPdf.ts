// src/lib/qdrantPdf.ts
// Separate Qdrant collection for PDF chunks.
// Web crawl stays in "nochbot_chunks"; PDFs live in "nochbot_pdf_chunks".

import { qdrant } from '@/lib/qdrant';

export const PDF_COLLECTION = 'nochbot_pdf_chunks';
const VECTOR_SIZE = 3072; // Gemini gemini-embedding-001 output size

export async function ensurePdfCollection() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === PDF_COLLECTION);

  if (!exists) {
    await qdrant.createCollection(PDF_COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });

    await qdrant.createPayloadIndex(PDF_COLLECTION, {
      field_name: 'userId',
      field_schema: 'keyword',
    });

    await qdrant.createPayloadIndex(PDF_COLLECTION, {
      field_name: 'fileId',
      field_schema: 'keyword',
    });

    console.log('✅ PDF Qdrant collection created:', PDF_COLLECTION);
  }
}