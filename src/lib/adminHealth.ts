import { getDb } from '@/lib/db';
import { deriveStatus } from '@/lib/pdfStatus';
import { PDF_FILES_COLLECTION } from '@/lib/pdfRetention';
import { TABULAR_ROWS_COLLECTION } from '@/lib/tabularQuery';
import { KNOWLEDGE_VECTOR_COLLECTION, PDF_VECTOR_COLLECTION } from '@/lib/vectorStore';

export type ServiceCheck = {
  name: string;
  state: 'ok' | 'degraded' | 'down' | 'not_configured';
  detail?: string;
  latencyMs?: number;
};

const CRAWLER_TIMEOUT_MS = 4000;

/** Pings the Scrapling service. Never reports the URL or token; only whether it answers. */
export async function checkCrawler(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<ServiceCheck> {
  const mode = (env.CRAWLER_PROVIDER || '').toLowerCase();
  const url = env.CRAWLER_SERVICE_URL;
  if (mode === 'legacy') return { name: 'Crawler service', state: 'not_configured', detail: 'CRAWLER_PROVIDER=legacy' };
  if (!url || !env.CRAWLER_SERVICE_TOKEN) {
    return { name: 'Crawler service', state: 'not_configured', detail: 'Using the legacy crawler' };
  }

  const started = Date.now();
  try {
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}/healthz`, { signal: AbortSignal.timeout(CRAWLER_TIMEOUT_MS) });
    const latencyMs = Date.now() - started;
    if (!res.ok) return { name: 'Crawler service', state: 'degraded', detail: `HTTP ${res.status}`, latencyMs };
    return { name: 'Crawler service', state: latencyMs > 2000 ? 'degraded' : 'ok', latencyMs, detail: latencyMs > 2000 ? 'Slow response' : undefined };
  } catch {
    return { name: 'Crawler service', state: 'down', detail: 'No response; crawls fall back to the legacy crawler' };
  }
}

export async function checkDatabase(): Promise<ServiceCheck> {
  const started = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { name: 'MongoDB', state: 'ok', latencyMs: Date.now() - started };
  } catch {
    return { name: 'MongoDB', state: 'down', detail: 'Ping failed' };
  }
}

const VECTOR_INDEXES: Array<{ collection: string; index: string }> = [
  { collection: KNOWLEDGE_VECTOR_COLLECTION, index: 'nochbot_chunks_vector_index' },
  { collection: PDF_VECTOR_COLLECTION, index: 'nochbot_pdf_chunks_vector_index' },
  { collection: TABULAR_ROWS_COLLECTION, index: 'tabular_rows_vector_index' },
];

/** Atlas Search index status. Self-hosted MongoDB has no search indexes and reports as unsupported. */
export async function checkVectorIndexes(): Promise<ServiceCheck[]> {
  const db = await getDb();
  return Promise.all(
    VECTOR_INDEXES.map(async ({ collection, index }): Promise<ServiceCheck> => {
      const name = `Vector index: ${index}`;
      try {
        const found = await db.collection(collection).listSearchIndexes(index).toArray();
        if (found.length === 0) return { name, state: 'down', detail: 'Index missing' };
        const info = found[0] as { queryable?: boolean; status?: string };
        if (info.queryable) return { name, state: 'ok' };
        return { name, state: 'degraded', detail: info.status ? `Status ${info.status}` : 'Not queryable yet' };
      } catch {
        return { name, state: 'not_configured', detail: 'Atlas Search is not available on this database' };
      }
    }),
  );
}

export type Owner = { id: string; name: string | null; email: string | null; disabled: boolean };

export type FailedDocument = {
  fileId: string;
  userId: string;
  owner: Owner;
  name?: string;
  docType?: string;
  error?: string;
  uploadedAt?: string;
};

export type HealthQueues = {
  failedDocuments: { count: number; recent: FailedDocument[] };
  pendingRowEmbeddings: number;
  needsRefund: {
    count: number;
    recent: Array<{ id: string; orgId?: string; owner?: Owner; eventId?: string; amount?: number | null; currency?: string; updatedAt?: string }>;
  };
  lateOrStuckPayments: number;
};

const STUCK_MS = 60 * 60 * 1000;

/** Account ids to name/email, in one query. Ids with no account come back as an unknown owner. */
export async function lookupOwners(ids: Array<string | undefined>): Promise<Map<string, Owner>> {
  const unique = [...new Set(ids.filter((i): i is string => !!i))];
  const owners = new Map<string, Owner>();
  if (unique.length === 0) return owners;
  const db = await getDb();
  const rows = await db
    .collection('accounts')
    .find({ id: { $in: unique } }, { projection: { _id: 0, id: 1, name: 1, email: 1, disabled: 1 } })
    .toArray();
  for (const r of rows) owners.set(r.id, { id: r.id, name: r.name ?? null, email: r.email ?? null, disabled: !!r.disabled });
  for (const id of unique) if (!owners.has(id)) owners.set(id, { id, name: null, email: null, disabled: false });
  return owners;
}

export async function loadQueues(now: Date = new Date()): Promise<HealthQueues> {
  const db = await getDb();
  const files = db.collection(PDF_FILES_COLLECTION);
  const bookings = db.collection('bookings');
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  // `parsing` records past the stale window are shown as failed everywhere else (deriveStatus), so count them here too.
  const failedFilter = {
    deletedAt: { $exists: false },
    $or: [{ status: 'failed' }, { status: 'parsing', uploadedAt: { $lt: staleBefore } }],
  };

  const [failedCount, failedRecent, pendingRows, refundCount, refundRecent, stuck] = await Promise.all([
    files.countDocuments(failedFilter),
    files.find(failedFilter).sort({ uploadedAt: -1 }).limit(10).toArray(),
    db.collection(TABULAR_ROWS_COLLECTION).countDocuments({ needsEmbedding: { $exists: true } }),
    bookings.countDocuments({ status: 'needs_refund' }),
    bookings.find({ status: 'needs_refund' }).sort({ updated_at: -1 }).limit(10).toArray(),
    bookings.countDocuments({
      status: 'processing_late_payment',
      updated_at: { $lt: new Date(now.getTime() - STUCK_MS) },
    }),
  ]);

  const owners = await lookupOwners([...failedRecent.map((f) => f.userId), ...refundRecent.map((b) => b.org_id)]);

  return {
    failedDocuments: {
      count: failedCount,
      recent: failedRecent.map((f) => ({
        fileId: String(f.fileId),
        userId: String(f.userId),
        owner: owners.get(String(f.userId))!,
        docType: f.docType,
        name: f.filename ?? f.fileName,
        error: deriveStatus(f as any, now).error,
        uploadedAt: f.uploadedAt ? new Date(f.uploadedAt).toISOString() : undefined,
      })),
    },
    pendingRowEmbeddings: pendingRows,
    needsRefund: {
      count: refundCount,
      recent: refundRecent.map((b) => ({
        id: String(b._id),
        orgId: b.org_id,
        owner: b.org_id ? owners.get(String(b.org_id)) : undefined,
        eventId: b.event_id ? String(b.event_id) : undefined,
        amount: b.amount_total ?? b.amount_charged ?? null,
        currency: b.currency,
        updatedAt: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
      })),
    },
    lateOrStuckPayments: stuck,
  };
}
