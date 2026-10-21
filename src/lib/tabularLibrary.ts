import { Binary, type AnyBulkWriteOperation, type Db, type Document, type ObjectId } from 'mongodb';
import { embedTexts, EmbeddingRateLimitError, type EmbedOptions } from './embeddings';
import {
  coerceDate,
  coerceNumber,
  summarizeColumn,
  TABULAR_LIMITS,
  TabularParseError,
  type CellValue,
  type TabularColumn,
  type TabularSheet,
} from './tabularParser';
import { TABULAR_ROWS_COLLECTION, type StoredSheet } from './tabularQuery';
import { ROW_VECTOR_DIMENSIONS } from './vectorStore';

/**
 * Growing CSV/XLSX libraries (e.g. a product catalog).
 *
 * A tabular document can receive more batches after upload. Columns are matched by header; new headers become new
 * columns. When the sheet has an ID column (e.g. SKU), rows with a known ID update that product and unknown IDs are
 * added, so re-uploading a whole catalog creates no duplicates.
 *
 * Every row also gets its own embedding for meaning search ("best for the beach"), stored on the row as float32.
 * Rows waiting for one carry `needsEmbedding` (the time they changed); embedPendingRows() works through them in
 * small batches so indexing fits serverless time limits and resumes after rate limits. A row edited while its
 * embedding is in flight keeps its newer `needsEmbedding` value and is embedded again.
 */

const ROW_TEXT_MAX_CHARS = 1_500;
const WRITE_BATCH = 1_000;

export interface AppendSummary {
  added: number;
  updated: number;
  unchanged: number;
  /** Values that did not fit their column's type and were left empty. */
  uncastable: number;
  newColumns: string[];
  rowCount: number;
}

/** Header normalization shared by column merging and the format check in documentAdditions.ts. */
export const headerKey = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();

/** Normalized product ID used for matching ("SKU-001 " and "sku-001" are the same product). */
export function normalizeRowKey(value: CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const key = String(value).trim().toLowerCase();
  return key ? key : null;
}

/**
 * Map an incoming sheet's columns onto the library's columns by header. Unknown headers become new columns with the
 * next free storage key and the type inferred for the incoming file.
 */
export function mergeColumns(existing: TabularColumn[], incoming: TabularColumn[]) {
  const byHeader = new Map(existing.map((c) => [headerKey(c.name), c]));
  let nextKey = existing.reduce((max, c) => Math.max(max, Number(c.key.slice(1)) + 1), 0);
  const columns = [...existing];
  const mapping = new Map<string, TabularColumn>(); // incoming key -> library column
  const newColumns: string[] = [];

  for (const col of incoming) {
    let target = byHeader.get(headerKey(col.name));
    if (!target) {
      if (columns.length >= TABULAR_LIMITS.maxColumns) {
        throw new TabularParseError(`The library would exceed ${TABULAR_LIMITS.maxColumns} columns.`, 413);
      }
      target = { ...col, key: `c${nextKey++}` };
      columns.push(target);
      byHeader.set(headerKey(col.name), target);
      newColumns.push(col.name);
    }
    mapping.set(col.key, target);
  }
  return { columns, mapping, newColumns };
}

/** Convert one value to the library column's type; `undefined` when it cannot be (counted, stored empty). */
export function castToColumn(column: TabularColumn, value: CellValue): CellValue | undefined {
  if (value === null) return null;
  switch (column.type) {
    case 'number':
      return coerceNumber(value) ?? undefined;
    case 'date':
      return coerceDate(value) ?? undefined;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return /^(true|yes)$/i.test(String(value)) ? true : /^(false|no)$/i.test(String(value)) ? false : undefined;
    default:
      return String(value).trim();
  }
}

/** "Name: Trail Shoe; Category: Footwear; Price: 2499" — the text a row is embedded from. */
export function rowEmbeddingText(columns: TabularColumn[], data: Record<string, CellValue>): string {
  return columns
    .filter((c) => data[c.key] !== null && data[c.key] !== undefined && data[c.key] !== '')
    .map((c) => `${c.name}: ${data[c.key]}`)
    .join('; ')
    .slice(0, ROW_TEXT_MAX_CHARS);
}

function sameData(a: Record<string, CellValue>, b: Record<string, CellValue>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? null) !== (b[k] ?? null)) return false;
  return true;
}

export async function ensureLibraryIndexes(db: Db): Promise<void> {
  const rows = db.collection(TABULAR_ROWS_COLLECTION);
  await rows.createIndex({ userId: 1, fileId: 1, sheet: 1, rowKey: 1 });
  await rows.createIndex({ userId: 1, fileId: 1, needsEmbedding: 1 });
}

/** Set `rowKey` on existing rows once an ID column is chosen for a sheet uploaded before it had one. */
export async function backfillRowKeys(
  db: Db,
  params: { userId: string; fileId: string; sheet: string; idColumnKey: string }
): Promise<void> {
  const path = `$data.${params.idColumnKey}`;
  await db.collection(TABULAR_ROWS_COLLECTION).updateMany(
    { userId: params.userId, fileId: params.fileId, sheet: params.sheet },
    [
      {
        $set: {
          rowKey: {
            $let: {
              vars: { k: { $toLower: { $trim: { input: { $toString: path } } } } },
              in: { $cond: [{ $in: [{ $ifNull: [path, ''] }, ['', null]] }, null, '$$k'] },
            },
          },
        },
      },
    ]
  );
}

/**
 * Merge an incoming sheet into a library sheet: update rows whose ID already exists (only when something changed),
 * add the rest. Values for columns the incoming file doesn't have are kept.
 */
export async function appendRows(
  db: Db,
  params: {
    userId: string;
    fileId: string;
    target: StoredSheet;
    idColumnKey?: string;
    incoming: TabularSheet;
    now?: Date;
  }
): Promise<{ summary: AppendSummary; columns: TabularColumn[] }> {
  const { userId, fileId, target, idColumnKey, incoming } = params;
  const now = params.now ?? new Date();
  const rowsCol = db.collection(TABULAR_ROWS_COLLECTION);
  const { columns, mapping, newColumns } = mergeColumns(target.columns, incoming.columns);

  let uncastable = 0;
  const converted = incoming.rows.map((row) => {
    const data: Record<string, CellValue> = {};
    for (const [incomingKey, column] of mapping) {
      const value = castToColumn(column, row[incomingKey] ?? null);
      if (value === undefined) uncastable++;
      data[column.key] = value ?? null;
    }
    return data;
  });

  // Last occurrence wins when a batch repeats an ID.
  const byKey = new Map<string, Record<string, CellValue>>();
  const withoutKey: Record<string, CellValue>[] = [];
  for (const data of converted) {
    const key = idColumnKey ? normalizeRowKey(data[idColumnKey]) : null;
    if (key) byKey.set(key, data);
    else withoutKey.push(data);
  }

  const base = { userId, fileId, sheet: target.name };
  const existing = new Map<string, { _id: ObjectId; data: Record<string, CellValue> }>();
  const keys = [...byKey.keys()];
  for (let i = 0; i < keys.length; i += WRITE_BATCH) {
    const docs = await rowsCol
      .find({ ...base, rowKey: { $in: keys.slice(i, i + WRITE_BATCH) } }, { projection: { rowKey: 1, data: 1 } })
      .toArray();
    for (const d of docs) existing.set(d.rowKey as string, { _id: d._id, data: d.data });
  }

  const currentCount = await rowsCol.countDocuments(base);
  const inserts = withoutKey.length + keys.filter((k) => !existing.has(k)).length;
  if (currentCount + inserts > TABULAR_LIMITS.maxRows) {
    throw new TabularParseError(
      `This would make ${(currentCount + inserts).toLocaleString('en-US')} rows. The limit is ${TABULAR_LIMITS.maxRows.toLocaleString('en-US')} rows per document.`,
      413
    );
  }

  const last = await rowsCol.find(base, { projection: { rowIndex: 1 } }).sort({ rowIndex: -1 }).limit(1).next();
  let nextRowIndex = typeof last?.rowIndex === 'number' ? last.rowIndex + 1 : 0;

  const ops: AnyBulkWriteOperation<Document>[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const insert = (data: Record<string, CellValue>, rowKey: string | null) => {
    ops.push({ insertOne: { document: { ...base, rowIndex: nextRowIndex++, rowKey, data, needsEmbedding: now } } });
    added++;
  };

  for (const [key, data] of byKey) {
    const found = existing.get(key);
    if (!found) {
      insert(data, key);
      continue;
    }
    const merged = { ...found.data, ...data };
    if (sameData(found.data, merged)) {
      unchanged++;
      continue;
    }
    ops.push({ updateOne: { filter: { _id: found._id }, update: { $set: { data: merged, needsEmbedding: now } } } });
    updated++;
  }
  for (const data of withoutKey) insert(data, null);

  for (let i = 0; i < ops.length; i += WRITE_BATCH) {
    await rowsCol.bulkWrite(ops.slice(i, i + WRITE_BATCH), { ordered: false });
  }

  return {
    summary: { added, updated, unchanged, uncastable, newColumns, rowCount: currentCount + added },
    columns,
  };
}

/** Recompute per-column statistics (examples, category values, counts) from the stored rows. */
export async function refreshColumnStats(
  db: Db,
  params: { userId: string; fileId: string; sheetName: string; columns: TabularColumn[] }
): Promise<StoredSheet> {
  const values: CellValue[][] = params.columns.map(() => []);
  const cursor = db
    .collection(TABULAR_ROWS_COLLECTION)
    .find({ userId: params.userId, fileId: params.fileId, sheet: params.sheetName }, { projection: { _id: 0, data: 1 } });
  let rowCount = 0;
  for await (const doc of cursor) {
    rowCount++;
    params.columns.forEach((c, i) => values[i].push((doc.data?.[c.key] ?? null) as CellValue));
  }
  return {
    name: params.sheetName,
    rowCount,
    columns: params.columns.map((c, i) => summarizeColumn(c.key, c.name, c.type, values[i])),
  };
}

export type Embedder = (texts: string[], options?: EmbedOptions) => Promise<number[][]>;

/**
 * Embed rows that changed since their last embedding, a slice at a time. Stops at `maxRows` or `deadline` and
 * reports what is left; a Gemini rate limit ends the slice early with `retryAfterMs`.
 */
export async function embedPendingRows(
  db: Db,
  params: {
    userId: string;
    fileId: string;
    sheets: StoredSheet[];
    maxRows?: number;
    deadline?: number;
    embed?: Embedder;
  }
): Promise<{ embedded: number; remaining: number; retryAfterMs?: number }> {
  const rowsCol = db.collection(TABULAR_ROWS_COLLECTION);
  const embed = params.embed ?? embedTexts;
  const pendingFilter = { userId: params.userId, fileId: params.fileId, needsEmbedding: { $exists: true } };
  const columnsBySheet = new Map(params.sheets.map((s) => [s.name, s.columns]));
  const deadline = params.deadline ?? Date.now() + 20_000;

  const docs = await rowsCol
    .find(pendingFilter, { projection: { sheet: 1, data: 1, needsEmbedding: 1 } })
    .limit(params.maxRows ?? 400)
    .toArray();

  let embedded = 0;
  let retryAfterMs: number | undefined;
  for (let i = 0; i < docs.length && Date.now() < deadline; i += 100) {
    const slice = docs.slice(i, i + 100);
    const texts = slice.map((d) => rowEmbeddingText(columnsBySheet.get(d.sheet) ?? [], d.data ?? {}) || '(empty row)');
    let vectors: number[][];
    try {
      vectors = await embed(texts, { dimensions: ROW_VECTOR_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT', maxRetries: 1 });
    } catch (err) {
      if (err instanceof EmbeddingRateLimitError) {
        retryAfterMs = 30_000;
        break;
      }
      throw err;
    }
    await rowsCol.bulkWrite(
      slice.map((d, j) => ({
        updateOne: {
          // Only clear the flag if the row did not change again while it was being embedded.
          filter: { _id: d._id, needsEmbedding: d.needsEmbedding },
          update: {
            $set: { embedding: Binary.fromFloat32Array(new Float32Array(vectors[j])) },
            $unset: { needsEmbedding: '' },
          },
        },
      })),
      { ordered: false }
    );
    embedded += slice.length;
  }

  const remaining = await rowsCol.countDocuments(pendingFilter);
  return { embedded, remaining, ...(retryAfterMs ? { retryAfterMs } : {}) };
}
