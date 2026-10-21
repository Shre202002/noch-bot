import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { NOT_DELETED } from '@/lib/pdfRetention';
import { embedPendingRows } from '@/lib/tabularLibrary';
import { ensureTabularRowVectorIndex } from '@/lib/vectorStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/ingest/pdf/index  Body: { fileId }
// Embeds the next slice of rows waiting for meaning search. The dashboard calls this until `remaining` is 0.
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    if (!fileId) return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });

    const db = await getDb();
    const doc = await db.collection('pdf_files').findOne({ userId, fileId, ...NOT_DELETED });
    if (!doc || (doc.docType !== 'csv' && doc.docType !== 'xlsx')) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    await ensureTabularRowVectorIndex();
    // Older uploads predate per-row embeddings: queue their rows once.
    if (!doc.rowVectors) {
      await db.collection('tabular_rows').updateMany(
        { userId, fileId, embedding: { $exists: false } },
        { $set: { needsEmbedding: new Date() } }
      );
      await db.collection('pdf_files').updateOne({ userId, fileId }, { $set: { rowVectors: 'indexing' } });
      doc.rowVectors = 'indexing';
    }

    const result = await embedPendingRows(db, {
      userId,
      fileId,
      sheets: doc.sheets ?? [],
      deadline: Date.now() + 25_000,
    });

    const rowVectors = result.remaining === 0 ? 'ready' : 'indexing';
    if (doc.rowVectors !== rowVectors) {
      await db.collection('pdf_files').updateOne({ userId, fileId }, { $set: { rowVectors } });
    }
    return NextResponse.json({ ...result, rowVectors, total: doc.rowCount ?? 0 });
  } catch (err) {
    console.error('[pdf-ingest:index]', err);
    return NextResponse.json({ error: 'Indexing paused because of an error. It will resume when you retry.' }, { status: 500 });
  }
}
