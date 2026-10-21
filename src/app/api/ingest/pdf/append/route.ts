import { NextRequest, NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  additionKindError,
  additionLimitError,
  additionLimitFor,
  fileSizeError,
  sheetFormatError,
} from '@/lib/documentAdditions';
import { pdfToPoints } from '@/lib/pdfIngest';
import { NOT_DELETED } from '@/lib/pdfRetention';
import { deriveStatus } from '@/lib/pdfStatus';
import { findAccountById } from '@/lib/storage';
import { appendRows, backfillRowKeys, ensureLibraryIndexes, refreshColumnStats, type AppendSummary } from '@/lib/tabularLibrary';
import { describeSheet, detectDocumentKind, parseTabular, TabularParseError, type TabularSheet } from '@/lib/tabularParser';
import type { StoredSheet } from '@/lib/tabularQuery';
import { insertPdfChunks } from '@/lib/vectorStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Addition = {
  filename: string;
  kind: string;
  sizeBytes: number;
  addedAt: string;
  rowsAdded?: number;
  rowsUpdated?: number;
  chunks?: number;
  pages?: number;
};

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Record the addition only while the document is still under its limit, so two simultaneous requests cannot both
 * take the last slot. Returns false when the limit was reached in the meantime.
 */
async function recordAddition(db: Db, userId: string, fileId: string, limit: number, addition: Addition, set: Record<string, unknown> = {}) {
  const res = await db.collection('pdf_files').updateOne(
    { userId, fileId, ...NOT_DELETED, $expr: { $lt: [{ $size: { $ifNull: ['$additions', []] } }, limit] } },
    { $push: { additions: addition } as never, $set: set }
  );
  return res.matchedCount === 1;
}

// POST /api/ingest/pdf/append  multipart: file, fileId, idColumn? (sheet column key, e.g. "c0")
// Adds a file to an existing document of the same kind: PDFs to PDFs, CSV/Excel to spreadsheets.
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return fail('Not authenticated.', 401);

    const form = await req.formData();
    const file = form.get('file');
    const fileId = form.get('fileId');
    const idColumnValue = form.get('idColumn');
    if (!(file instanceof File) || typeof fileId !== 'string' || !fileId) return fail('Choose a file to add.', 400);

    const db = await getDb();
    const doc = await db.collection('pdf_files').findOne({ userId, fileId, ...NOT_DELETED });
    if (!doc) return fail('Document not found.', 404);
    const { status } = deriveStatus(doc as never);
    if (status === 'failed' || status === 'parsing') {
      return fail('This document is not ready. Retry or wait for it to finish before adding data.', 409);
    }

    // Cheap checks first: plan limit, size, kind. Nothing is parsed or embedded for a file that will be refused.
    const plan = (await findAccountById(userId))?.plan || 'free';
    const limit = additionLimitFor(plan);
    const used = Array.isArray(doc.additions) ? doc.additions.length : 0;
    const limitError = additionLimitError(plan, used);
    if (limitError) return fail(limitError, 403);

    const sizeError = fileSizeError(file.size);
    if (sizeError) return fail(sizeError, 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = detectDocumentKind(file.name, buffer);
    const kindError = additionKindError(doc.docType, kind);
    if (kindError) return fail(kindError, 415);

    const filename = file.name || `added.${kind}`;
    const addedAt = new Date().toISOString();

    // ── PDF → PDF: more passages under the same document ──────────────────
    if (kind === 'pdf') {
      const ingested = await pdfToPoints({
        buffer, userId, fileId, filename,
        label: doc.label || doc.filename,
        uploadedAt: addedAt,
        chunkIndexOffset: doc.chunkCount ?? 0,
      });
      if ('error' in ingested) return fail(ingested.error, 422);

      const addition: Addition = { filename, kind, sizeBytes: file.size, addedAt, chunks: ingested.points.length, pages: ingested.pageCount };
      // Reserve the slot before writing vectors; release it if the write fails.
      if (!(await recordAddition(db, userId, fileId, limit, addition))) {
        return fail(additionLimitError(plan, limit) ?? 'Limit reached.', 403);
      }
      try {
        await insertPdfChunks(ingested.points);
      } catch (err) {
        await db.collection('pdf_files').updateOne({ userId, fileId }, { $pull: { additions: { addedAt, filename } } as never });
        throw err;
      }
      await db.collection('pdf_files').updateOne(
        { userId, fileId },
        { $inc: { chunkCount: ingested.points.length, pageCount: ingested.pageCount }, $set: { updatedAt: addedAt } }
      );
      return NextResponse.json({
        success: true, kind: 'pdf', filename,
        pages: ingested.pageCount, chunks: ingested.points.length,
        additionsUsed: used + 1, additionsLimit: limit,
      });
    }

    // ── CSV/Excel → spreadsheet: merge rows into the same table ───────────
    let incomingSheets: TabularSheet[];
    try {
      incomingSheets = await parseTabular(buffer, kind as 'csv' | 'xlsx');
    } catch (err) {
      if (err instanceof TabularParseError) return fail(err.message, err.status);
      throw err;
    }

    const sheets: StoredSheet[] = doc.sheets ?? [];
    const targetIndexFor = (incoming: TabularSheet) =>
      sheets.length === 1 ? 0 : sheets.findIndex((s) => s.name.toLowerCase() === incoming.name.toLowerCase());
    const idColumn = typeof idColumnValue === 'string' && /^c\d+$/.test(idColumnValue) ? idColumnValue : undefined;

    // Format check for every sheet that will be merged, before any row is written.
    const matched = incomingSheets.filter((s) => targetIndexFor(s) >= 0);
    if (matched.length === 0) {
      return fail(`None of the sheets (${incomingSheets.map((s) => s.name).join(', ')}) match this document's sheets.`, 422);
    }
    for (const incoming of matched) {
      const target = sheets[targetIndexFor(incoming)];
      const idKey = target.idColumnKey ?? (sheets.length === 1 ? idColumn : undefined);
      const formatError = sheetFormatError(target.columns, incoming.columns, idKey);
      if (formatError) return fail(formatError, 422);
    }

    await ensureLibraryIndexes(db);
    // Reserve the slot before merging; the counts are filled in afterwards, and the slot is released on failure.
    const reservation: Addition = { filename, kind: kind as string, sizeBytes: file.size, addedAt };
    if (!(await recordAddition(db, userId, fileId, limit, reservation))) {
      return fail(additionLimitError(plan, limit) ?? 'Limit reached.', 403);
    }

    const totals: AppendSummary = { added: 0, updated: 0, unchanged: 0, uncastable: 0, newColumns: [], rowCount: 0 };
    const unmatchedSheets = incomingSheets.filter((s) => targetIndexFor(s) < 0).map((s) => s.name);
    const nextSheets = [...sheets];

    try {
      for (const incoming of matched) {
        const index = targetIndexFor(incoming);
        const target = nextSheets[index];

        // The ID column is chosen once; existing rows get their keys so the first batch can update them.
        let idColumnKey = target.idColumnKey;
        if (!idColumnKey && idColumn && sheets.length === 1 && target.columns.some((c) => c.key === idColumn)) {
          idColumnKey = idColumn;
          await backfillRowKeys(db, { userId, fileId, sheet: target.name, idColumnKey });
        }

        const { summary, columns } = await appendRows(db, { userId, fileId, target, idColumnKey, incoming });
        const refreshed = await refreshColumnStats(db, { userId, fileId, sheetName: target.name, columns });
        nextSheets[index] = { ...refreshed, ...(idColumnKey ? { idColumnKey } : {}) };

        totals.added += summary.added;
        totals.updated += summary.updated;
        totals.unchanged += summary.unchanged;
        totals.uncastable += summary.uncastable;
        totals.newColumns.push(...summary.newColumns);
      }
    } catch (err) {
      await db.collection('pdf_files').updateOne({ userId, fileId }, { $pull: { additions: { addedAt, filename } } as never });
      throw err;
    }

    const rowCount = nextSheets.reduce((n, s) => n + s.rowCount, 0);
    const changed = totals.added + totals.updated > 0;
    await db.collection('pdf_files').updateOne(
      { userId, fileId },
      {
        $set: {
          sheets: nextSheets,
          rowCount,
          markdown: nextSheets.map((s) => describeSheet(s, s.rowCount)).join('\n\n').slice(0, 5000),
          ...(changed ? { rowVectors: 'indexing' } : {}),
          updatedAt: addedAt,
          'additions.$[a].rowsAdded': totals.added,
          'additions.$[a].rowsUpdated': totals.updated,
        },
      },
      { arrayFilters: [{ 'a.addedAt': addedAt, 'a.filename': filename }] }
    );

    return NextResponse.json({
      success: true, kind, filename, ...totals, rowCount, unmatchedSheets,
      additionsUsed: used + 1, additionsLimit: limit,
    });
  } catch (err) {
    if (err instanceof TabularParseError) return fail(err.message, err.status);
    console.error('[pdf-ingest:append]', err);
    return fail('Could not add this file. Please try again.', 500);
  }
}
