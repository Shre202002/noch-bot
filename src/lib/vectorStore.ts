import { getDb } from '@/lib/db';
import { readKnowledge } from '@/lib/storage';
import { TABULAR_ROWS_COLLECTION } from '@/lib/tabularQuery';

export const KNOWLEDGE_VECTOR_COLLECTION = 'nochbot_chunks';
export const PDF_VECTOR_COLLECTION = 'nochbot_pdf_chunks';

const VECTOR_SIZE = 3072;
const KNOWLEDGE_VECTOR_INDEX = 'nochbot_chunks_vector_index';
const PDF_VECTOR_INDEX = 'nochbot_pdf_chunks_vector_index';

export type VectorPayload = {
  userId: string;
  url?: string;
  fileId?: string;
  filename?: string;
  label?: string;
  text: string;
  markdown?: string;
  chunkIndex: number;
  totalChunks?: number;
  docType?: string;
  pageCount?: number;
  /** 1-based page range of a PDF chunk. */
  pageStart?: number;
  pageEnd?: number;
  /** CSV/XLSX chunks: sheet name and 1-based row range. */
  sheet?: string;
  rowStart?: number;
  rowEnd?: number;
  uploadedAt?: string;
  /** Website crawl generation; only the knowledge record's active generation is searched. */
  generationId?: string;
  title?: string;
  /** Submitted website URL for the crawl that produced this chunk. */
  siteUrl?: string;
};

export type VectorDocument = VectorPayload & {
  pointId: string | number;
  embedding: number[];
  createdAt: Date;
};

export type VectorSearchResult = VectorPayload & {
  score?: number;
};

async function ensureAtlasVectorIndex(
  collectionName: string,
  indexName: string,
  filterFields: string[],
  options: { numDimensions?: number; createFieldIndexes?: boolean } = {}
) {
  const db = await getDb();
  const collection = db.collection(collectionName);

  if (options.createFieldIndexes !== false) {
    await collection.createIndex({ userId: 1 });
    for (const field of filterFields) {
      await collection.createIndex({ [field]: 1 });
    }
  }

  const definition = {
    fields: [
      {
        type: 'vector',
        path: 'embedding',
        numDimensions: options.numDimensions ?? VECTOR_SIZE,
        similarity: 'cosine',
      },
      { type: 'filter', path: 'userId' },
      ...filterFields.map((field) => ({ type: 'filter', path: field })),
    ],
  };

  try {
    const existingIndexes = await collection.listSearchIndexes(indexName).toArray();
    if (existingIndexes.length === 0) {
      await collection.createSearchIndex({
        name: indexName,
        type: 'vectorSearch',
        definition,
      });
    } else if (!hasFilterFields(existingIndexes[0], ['userId', ...filterFields])) {
      // Atlas keeps serving the old index while the updated definition builds.
      await collection.updateSearchIndex(indexName, definition);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[vector-store] Atlas vector index "${indexName}" was not created automatically: ${message}`
    );
  }
}

function hasFilterFields(index: Record<string, any>, fields: string[]): boolean {
  const definition = index.latestDefinition ?? index.definition;
  const paths = new Set(
    (definition?.fields ?? [])
      .filter((field: { type?: string }) => field.type === 'filter')
      .map((field: { path?: string }) => field.path)
  );
  return fields.every((field) => paths.has(field));
}

let knowledgeStoreReady: Promise<void> | null = null;

export async function ensureKnowledgeVectorStore() {
  knowledgeStoreReady ??= ensureAtlasVectorIndex(
    KNOWLEDGE_VECTOR_COLLECTION,
    KNOWLEDGE_VECTOR_INDEX,
    ['generationId']
  ).catch((error) => {
    knowledgeStoreReady = null;
    throw error;
  });
  await knowledgeStoreReady;
}

export async function ensurePdfVectorStore() {
  await ensureAtlasVectorIndex(PDF_VECTOR_COLLECTION, PDF_VECTOR_INDEX, ['fileId']);
}

/**
 * @deprecated Deletes the user's chunks before inserting new ones, so a failed
 * insert leaves no knowledge. Website crawls use insertKnowledgeGeneration +
 * activation instead (src/lib/crawler/publish.ts).
 */
export async function replaceKnowledgeChunks(
  userId: string,
  chunks: Array<{ id: string | number; vector: number[]; payload: VectorPayload }>
) {
  const db = await getDb();
  const collection = db.collection<VectorDocument>(KNOWLEDGE_VECTOR_COLLECTION);

  await ensureKnowledgeVectorStore();
  await collection.deleteMany({ userId });

  if (chunks.length === 0) return;

  await collection.insertMany(
    chunks.map((chunk) => ({
      ...chunk.payload,
      pointId: chunk.id,
      embedding: chunk.vector,
      createdAt: new Date(),
    }))
  );
}

/**
 * Stage a crawl generation. Chunks are invisible to chat until the knowledge
 * record's activeGenerationId points at this generation.
 */
export async function insertKnowledgeGeneration(
  userId: string,
  generationId: string,
  chunks: Array<{ id: string | number; vector: number[]; payload: VectorPayload }>
) {
  const db = await getDb();
  const collection = db.collection<VectorDocument>(KNOWLEDGE_VECTOR_COLLECTION);

  await ensureKnowledgeVectorStore();
  if (chunks.length === 0) return;

  await collection.insertMany(
    chunks.map((chunk) => ({
      ...chunk.payload,
      userId,
      generationId,
      pointId: chunk.id,
      embedding: chunk.vector,
      createdAt: new Date(),
    }))
  );
}

/** Remove one staged or retired generation. */
export async function deleteKnowledgeGeneration(userId: string, generationId: string) {
  const db = await getDb();
  await db.collection<VectorDocument>(KNOWLEDGE_VECTOR_COLLECTION).deleteMany({ userId, generationId });
}

/** Remove every chunk for the user except the active generation, including pre-generation chunks. */
export async function deleteInactiveKnowledgeGenerations(userId: string, activeGenerationId: string) {
  const db = await getDb();
  await db
    .collection<VectorDocument>(KNOWLEDGE_VECTOR_COLLECTION)
    .deleteMany({ userId, generationId: { $ne: activeGenerationId } });
}

/**
 * Readiness probe: how many chunks of a staged generation Atlas vector search
 * can already return. Inserts are not immediately searchable.
 */
export async function countSearchableGenerationChunks(
  userId: string,
  generationId: string,
  probeVector: number[],
  limit: number
) {
  const results = await searchVectorCollection(KNOWLEDGE_VECTOR_COLLECTION, KNOWLEDGE_VECTOR_INDEX, {
    queryVector: probeVector,
    limit,
    filter: { userId, generationId },
  });
  return results.length;
}

export async function insertPdfChunks(
  chunks: Array<{ id: string | number; vector: number[]; payload: VectorPayload }>
) {
  const db = await getDb();
  const collection = db.collection<VectorDocument>(PDF_VECTOR_COLLECTION);

  await ensurePdfVectorStore();

  if (chunks.length === 0) return;

  await collection.insertMany(
    chunks.map((chunk) => ({
      ...chunk.payload,
      pointId: chunk.id,
      embedding: chunk.vector,
      createdAt: new Date(),
    }))
  );
}

export async function deletePdfChunks(userId: string, fileId: string) {
  const db = await getDb();
  await db.collection<VectorDocument>(PDF_VECTOR_COLLECTION).deleteMany({ userId, fileId });
}

/**
 * Search the user's website knowledge. Only the active crawl generation is
 * searched. Users who have not recrawled since generations were introduced
 * have no pointer; for them only untagged (pre-generation) chunks are searched,
 * so a crawl that is still staging never leaks into answers.
 */
export async function searchKnowledgeChunks(
  userId: string,
  queryVector: number[],
  limit = 5
) {
  const { activeGenerationId } = await readKnowledge(userId);

  if (activeGenerationId) {
    return searchVectorCollection(KNOWLEDGE_VECTOR_COLLECTION, KNOWLEDGE_VECTOR_INDEX, {
      queryVector,
      limit,
      filter: { userId, generationId: activeGenerationId },
    });
  }

  return searchVectorCollection(KNOWLEDGE_VECTOR_COLLECTION, KNOWLEDGE_VECTOR_INDEX, {
    queryVector,
    limit: limit * 4,
    filter: { userId },
    postFilter: { generationId: { $exists: false } },
    finalLimit: limit,
  });
}

export async function searchPdfChunks(
  userId: string,
  queryVector: number[],
  limit = 6,
  fileId?: string
) {
  // Soft-deleted documents (see pdfRetention.ts) keep their chunks until purged; drop them after the search,
  // over-fetching so they cannot crowd live chunks out of the top results.
  return searchVectorCollection(PDF_VECTOR_COLLECTION, PDF_VECTOR_INDEX, {
    queryVector,
    limit: limit * 3,
    filter: fileId ? { userId, fileId } : { userId },
    postFilter: { deletedAt: { $exists: false } },
    finalLimit: limit,
  });
}

async function searchVectorCollection(
  collectionName: string,
  indexName: string,
  options: {
    queryVector: number[];
    limit: number;
    filter: Record<string, string>;
    /** Applied after the vector search, for conditions the index cannot pre-filter. */
    postFilter?: Record<string, unknown>;
    finalLimit?: number;
  }
): Promise<VectorSearchResult[]> {
  const db = await getDb();
  const collection = db.collection<VectorDocument>(collectionName);

  const pipeline: Record<string, unknown>[] = [
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: options.queryVector,
        numCandidates: Math.max(options.limit * 20, 100),
        limit: options.limit,
        filter: options.filter,
      },
    },
    ...(options.postFilter ? [{ $match: options.postFilter }] : []),
    ...(options.finalLimit ? [{ $limit: options.finalLimit }] : []),
    {
      $project: {
        _id: 0,
        embedding: 0,
        pointId: 0,
        createdAt: 0,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  return collection.aggregate<VectorSearchResult>(pipeline).toArray();
}

// ── Catalog rows (CSV/XLSX) ─────────────────────────────────────────────────
// One vector per row, stored on the tabular_rows document itself (see src/lib/tabularLibrary.ts).

export const TABULAR_ROW_VECTOR_INDEX = 'tabular_rows_vector_index';
/** Smaller Gemini vectors (stored as float32) keep a 10k-product catalog around 30 MB. */
export const ROW_VECTOR_DIMENSIONS = 768;
/** Columns c0..c49 can be filtered inside $vectorSearch; later columns are matched afterwards. */
export const ROW_FILTER_KEY_LIMIT = 50;

let tabularRowIndexReady: Promise<void> | null = null;

export function ensureTabularRowVectorIndex(): Promise<void> {
  tabularRowIndexReady ??= ensureAtlasVectorIndex(
    TABULAR_ROWS_COLLECTION,
    TABULAR_ROW_VECTOR_INDEX,
    ['fileId', 'sheet', ...Array.from({ length: ROW_FILTER_KEY_LIMIT }, (_, i) => `data.c${i}`)],
    // The rows collection already has its own compound indexes; don't add one per filter column.
    { numDimensions: ROW_VECTOR_DIMENSIONS, createFieldIndexes: false }
  ).catch((error) => {
    tabularRowIndexReady = null;
    throw error;
  });
  return tabularRowIndexReady;
}

export interface TabularRowHit {
  rowIndex: number;
  data: Record<string, string | number | boolean | null>;
  score: number;
}

/**
 * Meaning search over one sheet's rows. `prefilter` must only use filter-indexed paths (data.c0..c49 with
 * equality/range/$in); everything else goes in `postMatch`, applied to the candidates afterwards.
 */
export async function searchTabularRows(params: {
  userId: string;
  fileId: string;
  sheet: string;
  queryVector: number[];
  prefilter?: Record<string, unknown>;
  postMatch?: Record<string, unknown>;
  limit: number;
}): Promise<TabularRowHit[]> {
  const db = await getDb();
  const hasPost = params.postMatch && Object.keys(params.postMatch).length > 0;
  // Post-filters discard candidates, so ask Atlas for more of them.
  const searchLimit = hasPost ? Math.min(params.limit * 10, 500) : params.limit;

  const pipeline: Record<string, unknown>[] = [
    {
      $vectorSearch: {
        index: TABULAR_ROW_VECTOR_INDEX,
        path: 'embedding',
        queryVector: params.queryVector,
        numCandidates: Math.max(searchLimit * 10, 200),
        limit: searchLimit,
        filter: { userId: params.userId, fileId: params.fileId, sheet: params.sheet, ...(params.prefilter ?? {}) },
      },
    },
    ...(hasPost ? [{ $match: params.postMatch }] : []),
    { $limit: params.limit },
    { $project: { _id: 0, rowIndex: 1, data: 1, score: { $meta: 'vectorSearchScore' } } },
  ];

  return db.collection(TABULAR_ROWS_COLLECTION).aggregate<TabularRowHit>(pipeline).toArray();
}
