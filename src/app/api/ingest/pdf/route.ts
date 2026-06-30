import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedText } from '@/lib/embeddings';
import { qdrant } from '@/lib/qdrant';
import { ensurePdfCollection, PDF_COLLECTION } from '@/lib/qdrantPdf';
import { parsePDF, chunkText, numericId } from '@/lib/pdfParser';
import { getDb } from '@/lib/db';
import { findAccountById } from '@/lib/storage';   // ← ADD

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Plan limits ───────────────────────────────────────────────────────────────
const PDF_LIMITS: Record<string, number> = {
  free:    1,
  starter: 10,
  pro:     Infinity,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(
  body: Record<string, unknown>,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: { ...corsHeaders, ...(init?.headers || {}) },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/ingest/pdf
export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return json({ error: 'Not authenticated.' }, { status: 401 });

    const db = await getDb();
    const files = await db
      .collection('pdf_files')
      .find({ userId })
      .sort({ uploadedAt: -1 })
      .toArray();

    // Also return plan info so frontend can show upgrade prompt
    const account = await findAccountById(userId);
    const plan = account?.plan || 'free';
    const limit = PDF_LIMITS[plan] ?? 1;

    return json({
      files: files.map((f) => ({
        fileId:     f.fileId,
        label:      f.label,
        fileName:   f.filename,
        chunkCount: f.chunkCount,
        uploadedAt: f.uploadedAt,
      })),
      plan,
      limit,
      canUpload: files.length < limit,
    });
  } catch (err: unknown) {
    console.error('[pdf-ingest:get]', err);
    return json({ error: err instanceof Error ? err.message : 'Failed to load PDFs.' }, { status: 500 });
  }
}

// POST /api/ingest/pdf
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return json({ error: 'Not authenticated.' }, { status: 401 });

    // ── Plan limit check ──────────────────────────────────────
    const account = await findAccountById(userId);
    const plan    = account?.plan || 'free';
    const limit   = PDF_LIMITS[plan] ?? 1;

    const db = await getDb();
    const existingCount = await db
      .collection('pdf_files')
      .countDocuments({ userId });

    if (existingCount >= limit) {
      return json(
        {
          error:       plan === 'free'
            ? `Free plan allows only ${limit} PDF. Please upgrade to upload more.`
            : `You have reached your plan limit of ${limit} PDFs.`,
          limitReached: true,
          plan,
          limit,
          current:     existingCount,
        },
        { status: 403 }
      );
    }
    // ─────────────────────────────────────────────────────────

    const formData  = await req.formData();
    const file      = formData.get('file');
    const labelValue = formData.get('label');

    if (!(file instanceof File)) {
      return json({ error: 'No file uploaded. Send a PDF as form field "file".' }, { status: 400 });
    }

    const label = typeof labelValue === 'string' ? labelValue.trim() : '';

    if (file.type && file.type !== 'application/pdf') {
      return json({ error: 'Only PDF files are supported.' }, { status: 415 });
    }

    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      return json({ error: `File too large. Max ${MAX_MB} MB.` }, { status: 413 });
    }

    const buffer           = Buffer.from(await file.arrayBuffer());
    const { text, pageCount } = await parsePDF(buffer);
    const filename         = file.name || 'uploaded.pdf';

    if (!text || text.trim().length < 50) {
      return json({ error: 'Could not extract text from this PDF. It may be scanned/image-only.' }, { status: 422 });
    }

    console.log(`[pdf-ingest] "${filename}" - ${pageCount} pages, ${text.length} chars`);

    const markdown  = textToMarkdown(text);
    const rawChunks = chunkText(markdown).filter((chunk) => chunk.text.trim());

    if (rawChunks.length === 0) {
      return json({ error: 'Could not create text chunks from this PDF.' }, { status: 422 });
    }

    console.log(`[pdf-ingest] ${rawChunks.length} chunks`);

    await ensurePdfCollection();

    const fileId     = `${userId}-${Date.now()}`;
    const uploadedAt = new Date().toISOString();
    const points     = [];

    for (const chunk of rawChunks) {
      const chunkTextValue = chunk.text.trim();
      const vector         = await embedText(chunkTextValue);

      points.push({
        id: numericId(`pdf-${fileId}-${chunk.chunkIndex}-${chunkTextValue.slice(0, 30)}`),
        vector,
        payload: {
          userId, fileId, filename,
          label:      label || filename,
          text:       chunkTextValue,
          markdown:   chunk.markdown || chunkTextValue,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          docType:    'pdf',
          pageCount,
          uploadedAt,
        },
      });

      console.log(`[pdf-ingest] Embedded chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await qdrant.upsert(PDF_COLLECTION, { wait: true, points });
    console.log(`[pdf-ingest] Upserted ${points.length} vectors`);

    await db.collection('pdf_files').insertOne({
      userId, fileId, filename,
      label:      label || filename,
      chunkCount: points.length,
      pageCount,
      markdown:   markdown.slice(0, 5000),
      uploadedAt,
    });

    return json({
      success:    true,
      fileId, filename, pageCount,
      chunkCount: points.length,
      characters: text.length,
      // Return updated counts so frontend can update UI
      remaining:  limit === Infinity ? Infinity : limit - (existingCount + 1),
      plan,
      limit,
    });
  } catch (err: unknown) {
    console.error('[pdf-ingest:post]', err);
    return json({ error: err instanceof Error ? err.message : 'PDF ingestion failed.' }, { status: 500 });
  }
}

// DELETE /api/ingest/pdf?fileId=xxx
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return json({ error: 'Not authenticated.' }, { status: 401 });

    const fileId = new URL(req.url).searchParams.get('fileId');
    if (!fileId) return json({ error: 'fileId query param required.' }, { status: 400 });

    await qdrant.delete(PDF_COLLECTION, {
      filter: {
        must: [
          { key: 'userId', match: { value: userId } },
          { key: 'fileId', match: { value: fileId } },
        ],
      },
    });

    const db = await getDb();
    await db.collection('pdf_files').deleteOne({ fileId, userId });

    return json({ success: true, deleted: fileId });
  } catch (err: unknown) {
    console.error('[pdf-ingest:delete]', err);
    return json({ error: err instanceof Error ? err.message : 'Delete failed.' }, { status: 500 });
  }
}

function textToMarkdown(raw: string): string {
  return raw
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t) return '';
      if (t === t.toUpperCase() && t.length > 3 && t.length < 80 && /[A-Z]/.test(t)) {
        return `## ${t}`;
      }
      if (/^[•·▪▸\-–]\s/.test(t)) return `- ${t.slice(2).trim()}`;
      if (/^\d+\.\s/.test(t)) return t;
      return t;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}