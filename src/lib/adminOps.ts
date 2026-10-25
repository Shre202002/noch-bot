import { getDb } from '@/lib/db';
import { loadPlans, planExists } from '@/lib/plans';
import { guardAdminChange } from '@/lib/superAdmin';
import { PDF_FILES_COLLECTION } from '@/lib/pdfRetention';
import { TABULAR_ROWS_COLLECTION } from '@/lib/tabularQuery';

export const BULK_MAX = 100;

export type BulkRequest = {
  ids: string[];
  action: 'plan' | 'deactivate' | 'reactivate';
  plan?: string;
  expiresAt?: string | null;
  reason?: string;
};

export type BulkResult = { id: string; ok: boolean; error?: string };

/** Validates the request shape. Returns an error message, or the cleaned request. */
export async function parseBulkRequest(body: any): Promise<{ error: string } | { request: BulkRequest; expiry?: string }> {
  if (!Array.isArray(body?.ids) || body.ids.length === 0) return { error: 'Select at least one user' };
  const ids = [...new Set(body.ids.filter((i: unknown) => typeof i === 'string' && i))] as string[];
  if (ids.length === 0) return { error: 'Select at least one user' };
  if (ids.length > BULK_MAX) return { error: `At most ${BULK_MAX} users per bulk action` };
  if (!['plan', 'deactivate', 'reactivate'].includes(body.action)) return { error: 'Unknown action' };

  let expiry: string | undefined;
  if (body.action === 'plan') {
    await loadPlans();
    if (typeof body.plan !== 'string' || !planExists(body.plan)) return { error: 'Unknown plan' };
    if (body.expiresAt) {
      const date = new Date(body.expiresAt);
      if (Number.isNaN(date.getTime())) return { error: 'Invalid expiry date' };
      if (date.getTime() <= Date.now()) return { error: 'Expiry must be in the future' };
      expiry = date.toISOString();
    }
  }
  return {
    request: {
      ids,
      action: body.action,
      plan: body.plan,
      expiresAt: expiry ?? null,
      reason: typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : undefined,
    },
    expiry,
  };
}

/**
 * Applies one action to many accounts. Each account is handled on its own so one refusal (for example the
 * last active admin) does not block the rest; the caller gets a per-account result.
 */
export async function applyBulkAction(actingAdminId: string, request: BulkRequest): Promise<BulkResult[]> {
  const db = await getDb();
  const accounts = db.collection('accounts');
  const results: BulkResult[] = [];

  for (const id of request.ids) {
    try {
      const target = await accounts.findOne({ id }, { projection: { id: 1, disabled: 1 } });
      if (!target) {
        results.push({ id, ok: false, error: 'User not found' });
        continue;
      }

      if (request.action === 'plan') {
        await accounts.updateOne(
          { id },
          {
            $set: { plan: request.plan, planSource: 'admin', ...(request.expiresAt ? { planExpiresAt: request.expiresAt } : {}) },
            ...(request.expiresAt ? {} : { $unset: { planExpiresAt: '' } }),
          },
        );
      } else if (request.action === 'deactivate') {
        const blocked = await guardAdminChange(actingAdminId, id, 'disable');
        if (blocked) {
          results.push({ id, ok: false, error: blocked });
          continue;
        }
        await accounts.updateOne(
          { id },
          { $set: { disabled: true, disabledReason: request.reason ?? '', disabledAt: new Date().toISOString() } },
        );
      } else {
        await accounts.updateOne({ id }, { $unset: { disabled: '', disabledReason: '', disabledAt: '' } });
      }
      results.push({ id, ok: true });
    } catch (error) {
      console.error('[admin_bulk]', id, error);
      results.push({ id, ok: false, error: 'Failed' });
    }
  }
  return results;
}

/**
 * Marks every spreadsheet row of the user's live documents that has no embedding as pending, so the
 * dashboard-driven index loop (POST /api/ingest/pdf/index) embeds it again. Returns how many rows were queued.
 */
export async function requeueRowEmbeddings(userId: string): Promise<{ documents: number; rows: number }> {
  const db = await getDb();
  const files = await db
    .collection(PDF_FILES_COLLECTION)
    .find(
      { userId, docType: { $in: ['csv', 'xlsx'] }, deletedAt: { $exists: false }, status: { $ne: 'failed' } },
      { projection: { fileId: 1 } },
    )
    .toArray();
  if (files.length === 0) return { documents: 0, rows: 0 };

  const fileIds = files.map((f) => f.fileId);
  const queued = await db.collection(TABULAR_ROWS_COLLECTION).updateMany(
    { userId, fileId: { $in: fileIds }, embedding: { $exists: false }, needsEmbedding: { $exists: false } },
    { $set: { needsEmbedding: new Date() } },
  );
  if (queued.modifiedCount > 0) {
    await db
      .collection(PDF_FILES_COLLECTION)
      .updateMany({ userId, fileId: { $in: fileIds } }, { $set: { rowVectors: 'indexing' } });
  }
  return { documents: files.length, rows: queued.modifiedCount };
}

/** User messages per calendar month for the last `months` months, oldest first. */
export async function monthlyMessageHistory(userId: string, months = 6): Promise<Array<{ month: string; messages: number }>> {
  const db = await getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const rows = await db
    .collection('messages')
    .aggregate([
      { $match: { userId, role: 'user', createdAt: { $gte: start } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
    ])
    .toArray();

  const counts = new Map(rows.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r.count as number]));
  const out: Array<{ month: string; messages: number }> = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month: key, messages: counts.get(key) ?? 0 });
  }
  return out;
}

/** Booking counts per status for the organizer, for the user detail view. */
export async function bookingStatusCounts(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .collection('bookings')
    .aggregate([{ $match: { org_id: userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
    .toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id), r.count as number]));
}
