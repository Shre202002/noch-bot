// src/app/api/ingest/pdf/route.ts
// POST multipart/form-data with field "file" (PDF) + optional "label"
// Parses → chunks → embeds (Gemini) → upserts to nochbot_pdf_chunks

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedText } from '@/lib/embeddings';
import { qdrant } from '@/lib/qdrant';
import { ensurePdfCollection, PDF_COLLECTION } from '@/lib/qdrantPdf';
import { parsePDF, chunkText, numericId } from '@/lib/pdfParser';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // ── Parse multipart form ──────────────────────────────────
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const label = (formData.get('label') as string | null) || '';

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded. Send a PDF as form field "file".' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported.' },
        { status: 415, headers: corsHeaders }
      );
    }

    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_MB} MB.` },
        { status: 413, headers: corsHeaders }
      );
    }

    // ── Parse PDF ─────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, pages, filename } = await parsePDF(buffer, file.name);

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract text from this PDF. It may be scanned/image-only.' },
        { status: 422, headers: corsHeaders }
      );
    }

    console.log(`[pdf-ingest] "${filename}" — ${pages} pages, ${text.length} chars`);

    // ── Chunk ─────────────────────────────────────────────────
    const chunks = chunkText(text);
    console.log(`[pdf-ingest] ${chunks.length} chunks`);

    // ── Ensure Qdrant collection exists ───────────────────────
    await ensurePdfCollection();

    // Stable file ID derived from userId + filename + upload time
    const fileId = `${userId}-${filename}-${Date.now()}`;

    // ── Embed + Upsert ────────────────────────────────────────
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await embedText(chunk);
      points.push({
        id: numericId(`pdf-${fileId}-${i}-${chunk.slice(0, 30)}`),
        vector,
        payload: {
          userId,
          fileId,
          filename,
          label: label || filename,
          text: chunk,
          chunkIndex: i,
          docType: 'pdf',
          pages,
          uploadedAt: new Date().toISOString(),
        },
      });
      console.log(`[pdf-ingest] Embedded chunk ${i + 1}/${chunks.length}`);
      // Respect Gemini rate limits — same pattern as crawl/route.ts
      await new Promise((r) => setTimeout(r, 300));
    }

    await qdrant.upsert(PDF_COLLECTION, { wait: true, points });
    console.log(`[pdf-ingest] Upserted ${points.length} vectors`);

    return NextResponse.json(
      {
        success: true,
        fileId,
        filename,
        pages,
        chunks: points.length,
        characters: text.length,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[pdf-ingest] Fatal error:', err?.message);
    return NextResponse.json(
      { error: err?.message || 'PDF ingestion failed.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE /api/ingest/pdf?fileId=xxx  — remove a PDF's vectors
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'fileId query param required.' }, { status: 400, headers: corsHeaders });
    }

    await qdrant.delete(PDF_COLLECTION, {
      filter: {
        must: [
          { key: 'userId', match: { value: userId } },
          { key: 'fileId', match: { value: fileId } },
        ],
      },
    });

    return NextResponse.json({ success: true, deleted: fileId }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Delete failed.' }, { status: 500, headers: corsHeaders });
  }
}