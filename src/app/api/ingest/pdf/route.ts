import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedTexts } from '@/lib/embeddings';
import { deletePdfChunks, ensurePdfVectorStore, ensureTabularRowVectorIndex, insertPdfChunks } from '@/lib/vectorStore';
import { ensureLibraryIndexes } from '@/lib/tabularLibrary';
import { numericId } from '@/lib/pdfParser';
import { pdfToPoints } from '@/lib/pdfIngest';
import { additionLimitFor } from '@/lib/documentAdditions';
import { pdfLimitFor, resolvePlanKey } from '@/lib/plans';
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
  PDF_RETENTION_DAYS,
  softDeletePdf,
} from '@/lib/pdfRetention';
import {
  COUNTS_TOWARD_LIMIT,
  deriveStatus,
  markFailed,
  purgeFailedFile,
  safeFailureMessage,
} from '@/lib/pdfStatus';
import type { Db } from 'mongodb';
import { requireVerifiedEmail } from '@/lib/emailVerification';

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
    const plan = await resolvePlanKey(account);
    const limit = pdfLimitFor(plan);

    const statuses = files.map((f) => deriveStatus(f as never));
    return json({
      files: files.map((f, i) => ({
        status:      statuses[i].status,
        error:       statuses[i].error,
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
      canUpload: statuses.filter((s) => s.status !== 'failed').length < limit,
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
    const unverified = await requireVerifiedEmail(userId);
    if (unverified) return unverified;

    const formData   = await req.formData();
    const file       = formData.get('file');
    const labelValue = formData.get('label');
    // replaceFileId: swap the contents of a live PDF in place (links and fileId stay).
    // retryFileId:   re-upload for a failed document; the failed record is removed first.
    const replaceFileId = typeof formData.get('replaceFileId') === 'string' ? (formData.get('replaceFileId') as string) : '';
    const retryFileId   = typeof formData.get('retryFileId') === 'string' ? (formData.get('retryFileId') as string) : '';

    // ── Plan limit check ──────────────────────────────────────
    const account = await findAccountById(userId);
    const plan    = await resolvePlanKey(account);
    const limit   = pdfLimitFor(plan);

    const db = await getDb();
    if (retryFileId) {
      // Frees the failed document's slot (and anything it left behind) before the new upload counts.
      const purged = await purgeFailedFile(db, userId, retryFileId);
      if (!purged) return json({ error: 'Only a failed upload can be retried.' }, { status: 409 });
    }
    // Failed uploads never occupy a slot; a replacement does not add a document.
    const existingCount = await db
      .collection('pdf_files')
      .countDocuments({ userId, ...NOT_DELETED, ...COUNTS_TOWARD_LIMIT });

    if (!replaceFileId && existingCount >= limit) {
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

    if (replaceFileId) {
      if (kind !== 'pdf') return json({ error: 'A PDF can only be replaced with another PDF.' }, { status: 415 });
      return replacePdf({ db, userId, fileId: replaceFileId, buffer, filename: file.name || 'uploaded.pdf', label });
    }

    if (kind !== 'pdf') {
      const result = await ingestTabular({
        db, userId, kind, buffer, label,
        filename: file.name || `uploaded.${kind}`,
      });
      if ('error' in result) {
        return json({ error: result.error, fileId: result.fileId, status: 'failed' }, { status: result.status });
      }
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

    // The record exists from the start, so a failure leaves a visible, retryable entry instead of nothing.
    await db.collection('pdf_files').insertOne({
      userId, fileId, filename,
      label:   label || filename,
      docType: 'pdf',
      status:  'parsing',
      uploadedAt,
    });

    let ingested: Awaited<ReturnType<typeof pdfToPoints>>;
    try {
      ingested = await pdfToPoints({ buffer, userId, fileId, filename, label: label || filename, uploadedAt });
      if ('error' in ingested) {
        await markFailed(db, userId, fileId, ingested.error);
        return json({ error: ingested.error, fileId, status: 'failed' }, { status: 422 });
      }
      await insertPdfChunks(ingested.points);
    } catch (err) {
      console.error('[pdf-ingest:post] ingestion failed', err);
      await deletePdfChunks(userId, fileId).catch(() => {});
      const message = safeFailureMessage(err);
      await markFailed(db, userId, fileId, message);
      return json({ error: message, fileId, status: 'failed' }, { status: 500 });
    }
    const { points, pageCount, markdown, characters } = ingested;
    console.log(`[pdf-ingest] Upserted ${points.length} vectors`);

    await db.collection('pdf_files').updateOne(
      { userId, fileId },
      {
        $set: {
          chunkCount: points.length,
          pageCount,
          markdown:   markdown.slice(0, 5000),
          status:     'ready',
        },
      }
    );

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

/**
 * Swaps a live PDF's contents in place, keeping its fileId so share links and analytics keep pointing at it.
 * The new file is parsed and embedded before anything is touched: an unreadable replacement leaves the current
 * document exactly as it was. Only this document's passages are replaced; other documents and website
 * knowledge live in other records and collections.
 */
async function replacePdf(params: {
  db: Db;
  userId: string;
  fileId: string;
  buffer: Buffer;
  filename: string;
  label: string;
}) {
  const { db, userId, fileId, buffer, filename, label } = params;

  const doc = await db.collection('pdf_files').findOne({ userId, fileId, ...NOT_DELETED });
  if (!doc) return json({ error: 'Document not found.' }, { status: 404 });
  if (doc.docType === 'csv' || doc.docType === 'xlsx') {
    return json({ error: 'Spreadsheets cannot be replaced. Add data to them, or remove and upload again.' }, { status: 415 });
  }
  if (deriveStatus(doc as never).status === 'parsing') {
    return json({ error: 'This document is still being processed.' }, { status: 409 });
  }

  const uploadedAt = new Date().toISOString();
  const nextLabel  = label || doc.label || filename;
  let ingested: Awaited<ReturnType<typeof pdfToPoints>>;
  try {
    ingested = await pdfToPoints({ buffer, userId, fileId, filename, label: nextLabel, uploadedAt });
  } catch (err) {
    console.error('[pdf-ingest:replace] parse failed', err);
    return json({ error: safeFailureMessage(err), fileId }, { status: 500 });
  }
  if ('error' in ingested) return json({ error: ingested.error, fileId }, { status: 422 });

  try {
    await deletePdfChunks(userId, fileId);
    await insertPdfChunks(ingested.points);
  } catch (err) {
    // The old passages are already gone, so say so rather than leave a document that looks fine and answers nothing.
    console.error('[pdf-ingest:replace] swap failed', err);
    await deletePdfChunks(userId, fileId).catch(() => {});
    const message = 'The replacement could not be saved. Please upload the file again.';
    await markFailed(db, userId, fileId, message);
    return json({ error: message, fileId, status: 'failed' }, { status: 500 });
  }

  await db.collection('pdf_files').updateOne(
    { userId, fileId },
    {
      $set: {
        filename,
        label:      nextLabel,
        chunkCount: ingested.points.length,
        pageCount:  ingested.pageCount,
        markdown:   ingested.markdown.slice(0, 5000),
        additions:  [],
        status:     'ready',
        updatedAt:  uploadedAt,
      },
      $unset: { error: '', failedAt: '' },
    }
  );

  return json({
    success: true,
    replaced: true,
    fileId, filename,
    pageCount:  ingested.pageCount,
    chunkCount: ingested.points.length,
    characters: ingested.characters,
  });
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
  | { error: string; status: number; fileId: string }
> {
  const { db, userId, kind, buffer, filename, label } = params;

  const fileId     = `${userId}-${Date.now()}`;
  const uploadedAt = new Date().toISOString();
  // Visible (and retryable) from the start, like PDFs.
  await db.collection('pdf_files').insertOne({
    userId, fileId, filename,
    label: label || filename,
    docType: kind,
    status: 'parsing',
    uploadedAt,
  });

  let sheets: TabularSheet[];
  try {
    sheets = await parseTabular(buffer, kind);
  } catch (err) {
    if (err instanceof TabularParseError) {
      await markFailed(db, userId, fileId, err.message);
      return { error: err.message, status: err.status, fileId };
    }
    await markFailed(db, userId, fileId, safeFailureMessage(err));
    throw err;
  }

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
    // Answerable now (filters and totals work on the stored rows); becomes `ready` once every row is embedded.
    await db.collection('pdf_files').updateOne(
      { userId, fileId },
      {
        $set: {
          chunkCount: chunks.length,
          rowCount,
          sheets:     storedSheets,
          markdown:   storedSheets.map((s) => describeSheet(s, s.rowCount)).join('\n\n').slice(0, 5000),
          rowVectors: 'indexing',
          status:     'indexed',
        },
      }
    );

    return { fileId, filename, docType: kind, rowCount, chunkCount: chunks.length, sheetCount: sheets.length };
  } catch (err) {
    // Leave nothing half-ingested behind, but keep a failed record the organizer can retry.
    console.error('[tabular-ingest] failed', err);
    await rowsCollection.deleteMany({ userId, fileId }).catch(() => {});
    await deletePdfChunks(userId, fileId).catch(() => {});
    const message = safeFailureMessage(err);
    await markFailed(db, userId, fileId, message);
    return { error: message, status: 500, fileId };
  }
}
