import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedTexts } from '@/lib/embeddings';
import { deletePdfChunks, ensurePdfVectorStore, ensureTabularRowVectorIndex, insertPdfChunks } from '@/lib/vectorStore';
import { ensureLibraryIndexes } from '@/lib/tabularLibrary';
import { numericId } from '@/lib/pdfParser';
import { pdfToPoints } from '@/lib/pdfIngest';
import { additionLimitFor } from '@/lib/documentAdditions';
import { getDb } from '@/lib/db';
import { findAccountById } from '@/lib/storage';
import {
  describeSheet,
  detectDocumentKind,
  parseTabular,
  TabularParseError,
  type TabularKind,
  type TabularSheet,
} from '@/lib/tabularParser';
import { TABULAR_ROWS_COLLECTION, type StoredSheet } from '@/lib/tabularQuery';
import {
  ensurePdfRetentionIndexes,
  NOT_DELETED,
  PDF_LIMITS,
  PDF_RETENTION_DAYS,
  softDeletePdf,
} from '@/lib/pdfRetention';
import type { Db } from 'mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const [files, deleted, pending] = await Promise.all([
      db.collection('pdf_files').find({ userId, ...NOT_DELETED }).sort({ uploadedAt: -1 }).toArray(),
      // Soft-deleted documents still inside their restore window.
      db.collection('pdf_files')
        .find({ userId, deletedAt: { $exists: true }, purgeAt: { $gt: new Date() } })
        .sort({ deletedAt: -1 })
        .toArray(),
      // Rows still waiting for their meaning-search embedding, per document.
      db.collection(TABULAR_ROWS_COLLECTION)
        .aggregate<{ _id: string; count: number }>([
          { $match: { userId, needsEmbedding: { $exists: true } } },
          { $group: { _id: '$fileId', count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
    const pendingByFile = new Map(pending.map((p) => [p._id, p.count]));

    // Also return plan info so frontend can show upgrade prompt
    const account = await findAccountById(userId);
    const plan = account?.plan || 'free';
    const limit = PDF_LIMITS[plan] ?? 1;

    return json({
      files: files.map((f) => ({
        fileId:      f.fileId,
        label:       f.label,
        fileName:    f.filename,
        docType:     f.docType ?? 'pdf',
        chunkCount:  f.chunkCount,
        rowCount:    f.rowCount,
        columnCount: Array.isArray(f.sheets)
          ? Math.max(0, ...f.sheets.map((s: StoredSheet) => s.columns.length))
          : undefined,
        uploadedAt:  f.uploadedAt,
        rowVectors:  f.rowVectors ?? null,
        additionsUsed:  Array.isArray(f.additions) ? f.additions.length : 0,
        additionsLimit: additionLimitFor(plan),
        pendingRows: pendingByFile.get(f.fileId) ?? 0,
        ...(Array.isArray(f.sheets) && f.sheets.length === 1
          ? {
              idColumn: f.sheets[0].columns.find((c: StoredSheet['columns'][number]) => c.key === f.sheets[0].idColumnKey)?.name ?? null,
              columns: f.sheets[0].columns.map((c: StoredSheet['columns'][number]) => ({ key: c.key, name: c.name, type: c.type })),
            }
          : {}),
      })),
      deletedFiles: deleted.map((f) => ({
        fileId:    f.fileId,
        label:     f.label,
        fileName:  f.filename,
        docType:   f.docType ?? 'pdf',
        deletedAt: f.deletedAt,
        purgeAt:   f.purgeAt,
      })),
      retentionDays: PDF_RETENTION_DAYS,
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
      .countDocuments({ userId, ...NOT_DELETED });

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
      return json({ error: 'No file uploaded. Send a PDF, CSV or XLSX file as form field "file".' }, { status: 400 });
    }

    const label = typeof labelValue === 'string' ? labelValue.trim() : '';

    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      return json({ error: `File too large. Max ${MAX_MB} MB.` }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = detectDocumentKind(file.name || '', buffer);
    if (!kind) {
      return json({ error: 'Only PDF, CSV and Excel (.xlsx) files are supported.' }, { status: 415 });
    }

    if (kind !== 'pdf') {
      const result = await ingestTabular({
        db, userId, kind, buffer, label,
        filename: file.name || `uploaded.${kind}`,
      });
      if ('error' in result) return json({ error: result.error }, { status: result.status });
      return json({
        success: true,
        ...result,
        remaining: limit === Infinity ? Infinity : limit - (existingCount + 1),
        plan,
        limit,
      });
    }

    const filename   = file.name || 'uploaded.pdf';
    const fileId     = `${userId}-${Date.now()}`;
    const uploadedAt = new Date().toISOString();
    const ingested   = await pdfToPoints({ buffer, userId, fileId, filename, label: label || filename, uploadedAt });
    if ('error' in ingested) return json({ error: ingested.error }, { status: 422 });
    const { points, pageCount, markdown, characters } = ingested;

    await insertPdfChunks(points);
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
      characters,
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

    // Soft delete: hidden and unshared now, restorable until purgeAt, then removed by the TTL index.
    const db = await getDb();
    await ensurePdfRetentionIndexes(db);
    const result = await softDeletePdf(db, userId, fileId);
    if (!result) return json({ error: 'Document not found.' }, { status: 404 });

    return json({ success: true, deleted: fileId, purgeAt: result.purgeAt.toISOString() });
  } catch (err: unknown) {
    console.error('[pdf-ingest:delete]', err);
    return json({ error: 'Delete failed. Please try again.' }, { status: 500 });
  }
}

// ── CSV / XLSX ingestion ──────────────────────────────────────────────────────

const ROW_INSERT_BATCH = 5_000;

async function ingestTabular(params: {
  db: Db;
  userId: string;
  kind: TabularKind;
  buffer: Buffer;
  filename: string;
  label: string;
}): Promise<
  | { fileId: string; filename: string; docType: TabularKind; rowCount: number; chunkCount: number; sheetCount: number }
  | { error: string; status: number }
> {
  const { db, userId, kind, buffer, filename, label } = params;

  let sheets: TabularSheet[];
  try {
    sheets = await parseTabular(buffer, kind);
  } catch (err) {
    if (err instanceof TabularParseError) return { error: err.message, status: err.status };
    throw err;
  }

  const fileId     = `${userId}-${Date.now()}`;
  const uploadedAt = new Date().toISOString();
  const rowCount   = sheets.reduce((n, s) => n + s.rows.length, 0);
  const rowsCollection = db.collection(TABULAR_ROWS_COLLECTION);

  console.log(`[tabular-ingest] "${filename}" - ${sheets.length} sheet(s), ${rowCount} rows`);

  try {
    await rowsCollection.createIndex({ userId: 1, fileId: 1, sheet: 1, rowIndex: 1 });
    await ensureLibraryIndexes(db);
    await ensureTabularRowVectorIndex();
    // Every row is queued for its own embedding (POST /api/ingest/pdf/index works through the queue), so meaning
    // search covers the whole file. Filter/aggregate questions work right away.
    const queuedAt = new Date();
    for (const sheet of sheets) {
      for (let start = 0; start < sheet.rows.length; start += ROW_INSERT_BATCH) {
        await rowsCollection.insertMany(
          sheet.rows.slice(start, start + ROW_INSERT_BATCH).map((data, i) => ({
            userId, fileId, sheet: sheet.name, rowIndex: start + i, data, needsEmbedding: queuedAt,
          }))
        );
      }
    }

    // One schema chunk per sheet; rows are embedded individually on the rows themselves.
    const chunks: Array<{ text: string; sheet: string; rowStart?: number; rowEnd?: number }> = sheets.map((sheet) => ({
      text: describeSheet(sheet, sheet.rows.length),
      sheet: sheet.name,
    }));

    await ensurePdfVectorStore();
    const vectors = await embedTexts(chunks.map((c) => c.text));
    await insertPdfChunks(chunks.map((chunk, i) => ({
      id: numericId(`${kind}-${fileId}-${i}`),
      vector: vectors[i],
      payload: {
        userId, fileId, filename,
        label:       label || filename,
        text:        chunk.text,
        markdown:    chunk.text,
        chunkIndex:  i,
        totalChunks: chunks.length,
        docType:     kind,
        sheet:       chunk.sheet,
        rowStart:    chunk.rowStart,
        rowEnd:      chunk.rowEnd,
        uploadedAt,
      },
    })));

    const storedSheets: StoredSheet[] = sheets.map((s) => ({ name: s.name, rowCount: s.rows.length, columns: s.columns }));
    await db.collection('pdf_files').insertOne({
      userId, fileId, filename,
      label:      label || filename,
      docType:    kind,
      chunkCount: chunks.length,
      rowCount,
      sheets:     storedSheets,
      markdown:   storedSheets.map((s) => describeSheet(s, s.rowCount)).join('\n\n').slice(0, 5000),
      rowVectors: 'indexing',
      uploadedAt,
    });

    return { fileId, filename, docType: kind, rowCount, chunkCount: chunks.length, sheetCount: sheets.length };
  } catch (err) {
    // Leave nothing half-ingested behind.
    await rowsCollection.deleteMany({ userId, fileId }).catch(() => {});
    await deletePdfChunks(userId, fileId).catch(() => {});
    throw err;
  }
}
