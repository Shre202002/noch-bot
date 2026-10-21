import type { Db } from 'mongodb';
import { PDF_FILES_COLLECTION } from './pdfRetention';
import { TABULAR_ROWS_COLLECTION } from './tabularQuery';
import { deletePdfChunks } from './vectorStore';

/**
 * Lifecycle of a PDF RAG document, shown to the organizer and used to decide what chat may retrieve.
 *
 *  parsing  - the upload is being parsed and embedded; nothing is retrievable yet
 *  indexed  - passages are stored and answerable; spreadsheet rows are still being embedded for meaning search
 *  ready    - fully indexed
 *  failed   - ingestion stopped; `error` says why and nothing from this upload is retrievable
 *
 * Records written before statuses existed carry none; {@link deriveStatus} infers theirs.
 */
export type PdfStatus = 'parsing' | 'indexed' | 'ready' | 'failed';

/** A `parsing` record this old belongs to a request that died (timeout, crash) and is shown as failed. */
export const PARSING_STALE_MS = 10 * 60 * 1000;

export const INTERRUPTED_MESSAGE = 'Processing was interrupted. Please retry the upload.';
const GENERIC_FAILURE = 'We could not process this file. Please retry the upload.';

type StatusFields = {
  status?: PdfStatus;
  error?: string;
  docType?: string;
  rowVectors?: 'indexing' | 'ready' | null;
  uploadedAt?: string | Date;
};

/** The status to show for a stored file record, inferring it for legacy records and stale `parsing` ones. */
export function deriveStatus(file: StatusFields, now: Date = new Date()): { status: PdfStatus; error?: string } {
  const tabular = file.docType === 'csv' || file.docType === 'xlsx';

  if (file.status === 'failed') return { status: 'failed', error: file.error ?? GENERIC_FAILURE };

  if (file.status === 'parsing') {
    const started = file.uploadedAt ? new Date(file.uploadedAt).getTime() : NaN;
    if (Number.isFinite(started) && now.getTime() - started > PARSING_STALE_MS) {
      return { status: 'failed', error: INTERRUPTED_MESSAGE };
    }
    return { status: 'parsing' };
  }

  if (tabular) return { status: file.rowVectors === 'ready' ? 'ready' : 'indexed' };
  return { status: 'ready' };
}

/** Only documents with stored passages or rows can answer questions. */
export function isRetrievable(status: PdfStatus): boolean {
  return status === 'indexed' || status === 'ready';
}

/** Query fragment for documents that occupy a plan slot: failed uploads never do. */
export const COUNTS_TOWARD_LIMIT = { status: { $ne: 'failed' } } as const;

/** A message safe to show the organizer: known parse problems pass through, everything else is generic. */
export function safeFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (/scanned|image-only|extract text|create text chunks|no (data )?rows|empty|password|encrypted|corrupt|invalid pdf/i.test(message)) {
    return message.slice(0, 200);
  }
  return GENERIC_FAILURE;
}

export async function markFailed(db: Db, userId: string, fileId: string, error: string): Promise<void> {
  await db
    .collection(PDF_FILES_COLLECTION)
    .updateOne({ userId, fileId }, { $set: { status: 'failed', error, failedAt: new Date() } });
}

/**
 * Permanently removes one failed document and anything it left behind (passages, rows). Scoped to the owner and
 * to `failed` records only, so a retry can never remove a live document.
 */
export async function purgeFailedFile(
  db: Db,
  userId: string,
  fileId: string,
  now: Date = new Date()
): Promise<boolean> {
  // A stale `parsing` record is shown as failed (see deriveStatus), so it can be retried too.
  const staleBefore = new Date(now.getTime() - PARSING_STALE_MS).toISOString();
  const removed = await db.collection(PDF_FILES_COLLECTION).deleteOne({
    userId,
    fileId,
    $or: [{ status: 'failed' }, { status: 'parsing', uploadedAt: { $lt: staleBefore } }],
  });
  if (removed.deletedCount === 0) return false;
  await deletePdfChunks(userId, fileId).catch(() => {});
  await db.collection(TABULAR_ROWS_COLLECTION).deleteMany({ userId, fileId }).catch(() => {});
  return true;
}
