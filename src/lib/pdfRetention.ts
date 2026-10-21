import type { Db } from 'mongodb';
import { PDF_VECTOR_COLLECTION } from './vectorStore';
import { TABULAR_ROWS_COLLECTION } from './tabularQuery';

/**
 * Soft delete for PDF RAG documents (PDF, CSV, XLSX).
 *
 * Deleting a document stamps `deletedAt` and `purgeAt` on every record that belongs to it. From that moment
 * the document is hidden from the dashboard, its shared links stop resolving and its chunks are excluded from
 * retrieval, but the organizer can restore it until `purgeAt`. A MongoDB TTL index on `purgeAt` then removes the
 * records for good, so no scheduled job is needed. Records without `purgeAt` are never touched by the TTL monitor.
 *
 * Shared-link analytics (`chat_sessions`, `chat_messages`) are deliberately not part of this: they are kept as
 * history after the document is gone.
 */

export const PDF_RETENTION_DAYS = 7;

/** Documents a plan may hold at once. Soft-deleted documents do not count. */
export const PDF_LIMITS: Record<string, number> = {
  free:    1,
  starter: 10,
  pro:     Infinity,
};

export const PDF_FILES_COLLECTION = 'pdf_files';
export const PDF_LINKS_COLLECTION = 'pdf_links';
/** Accounts of sign-in protected share links (see linkUserAuth.ts); keyed by the link owner as `userId`. */
export const PDF_LINK_USERS_COLLECTION = 'pdf_link_users';

/** Every collection holding a document's data, all keyed by `{ userId, fileId }`. */
const RETENTION_COLLECTIONS = [
  PDF_FILES_COLLECTION,
  PDF_VECTOR_COLLECTION,
  TABULAR_ROWS_COLLECTION,
  PDF_LINKS_COLLECTION,
  PDF_LINK_USERS_COLLECTION,
] as const;

/** Query fragment that keeps only live (not soft-deleted) records. */
export const NOT_DELETED = { deletedAt: { $exists: false } } as const;

let indexesReady: Promise<void> | null = null;

/** Creates the `purgeAt` TTL index on each document collection once per process. */
export function ensurePdfRetentionIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = Promise.all(
      RETENTION_COLLECTIONS.map((name) =>
        db.collection(name).createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0, name: 'purgeAt_ttl' })
      )
    )
      .then(() => undefined)
      .catch((err) => {
        // Let the next call retry instead of caching a failure for the life of the process.
        indexesReady = null;
        throw err;
      });
  }
  return indexesReady;
}

/**
 * Soft-deletes a live document for `userId`. Returns `null` when the user has no live document with that id.
 * The file record is marked first, so the document disappears from the dashboard before anything else changes.
 */
export async function softDeletePdf(
  db: Db,
  userId: string,
  fileId: string,
  now: Date = new Date()
): Promise<{ purgeAt: Date } | null> {
  const deletedAt = now;
  const purgeAt = new Date(now.getTime() + PDF_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const marks = { $set: { deletedAt, purgeAt } };

  const file = await db
    .collection(PDF_FILES_COLLECTION)
    .updateOne({ userId, fileId, ...NOT_DELETED }, marks);
  if (file.matchedCount === 0) return null;

  for (const name of RETENTION_COLLECTIONS) {
    if (name === PDF_FILES_COLLECTION) continue;
    await db.collection(name).updateMany({ userId, fileId }, marks);
  }
  return { purgeAt };
}

/**
 * Restores a soft-deleted document that has not reached `purgeAt`. Returns `null` when there is nothing to
 * restore. Data is unmarked before the file record, so the document only reappears once its chunks, rows and
 * links are live again.
 */
export async function restorePdf(
  db: Db,
  userId: string,
  fileId: string,
  now: Date = new Date()
): Promise<{ restored: true } | null> {
  const file = await db
    .collection(PDF_FILES_COLLECTION)
    .findOne({ userId, fileId, deletedAt: { $exists: true }, purgeAt: { $gt: now } });
  if (!file) return null;

  const unmark = { $unset: { deletedAt: '', purgeAt: '' } };
  for (const name of RETENTION_COLLECTIONS) {
    if (name === PDF_FILES_COLLECTION) continue;
    await db.collection(name).updateMany({ userId, fileId }, unmark);
  }
  await db.collection(PDF_FILES_COLLECTION).updateOne({ userId, fileId }, unmark);
  return { restored: true };
}
