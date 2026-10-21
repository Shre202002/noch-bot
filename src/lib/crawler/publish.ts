import { randomUUID } from 'node:crypto';
import { embedTexts } from '@/lib/embeddings';
import { writeKnowledge, type KnowledgeData } from '@/lib/storage';
import {
  countSearchableGenerationChunks,
  deleteInactiveKnowledgeGenerations,
  deleteKnowledgeGeneration,
  insertKnowledgeGeneration,
  type VectorPayload,
} from '@/lib/vectorStore';
import type { CrawlPageOutcome, CrawlResult } from './types';

/**
 * Generation-safe publication of a crawl (phase decisions D-04/D-05).
 *
 * 1. Every selected page must be usable or harmlessly skipped. Any page that
 *    failed to fetch blocks publication, and at least one page needs content.
 * 2. Chunk and embed everything up front; any failure stops before a write.
 * 3. Stage the chunks under a new generationId (invisible to chat).
 * 4. Wait until Atlas vector search can return the staged chunks.
 * 5. Switch knowledge.activeGenerationId in a single update.
 * 6. Only then delete older generations; cleanup failures are logged, not fatal.
 *
 * On any failure in steps 3-5 the staged generation is removed and the previous
 * generation stays active.
 */

const WORDS_PER_CHUNK = 300;
const MAX_PAGE_CHARS = 12_000;
const MAX_TOTAL_CHUNKS = 400;
const READINESS_PROBE_LIMIT = 100;
const READINESS_TIMEOUT_MS = 20_000;
const READINESS_POLL_MS = 1_000;
const KNOWLEDGE_PREVIEW_CHARS = 3000;
/** Owner index of the site header/footer chunks, which belong to no page. */
const SITE_CHROME_OWNER = -1;

export type PublishFailureReason =
  | 'no_content'
  | 'pages_failed'
  | 'embedding_failed'
  | 'storage_failed'
  | 'index_not_ready';

export interface PublishedPage {
  url: string;
  title: string;
  status: CrawlPageOutcome;
  reason: string | null;
  chunks: number;
  chars: number;
}

export type PublishResult =
  | { ok: true; generationId: string; pages: PublishedPage[]; chunks: number; characters: number; pagesIndexed: number }
  | { ok: false; reason: PublishFailureReason; pages: PublishedPage[] };

export interface PublishInput {
  userId: string;
  /** Canonical submitted URL. */
  siteUrl: string;
  /** Redacted submitted URL for persisted metadata. */
  siteUrlRedacted: string;
  crawl: CrawlResult;
  correlationId: string;
  fallbackUsed: boolean;
}

type ChunkInput = { id: string; vector: number[]; payload: VectorPayload };

export interface PublishDeps {
  embedTexts(texts: string[]): Promise<number[][]>;
  insertGeneration(userId: string, generationId: string, chunks: ChunkInput[]): Promise<void>;
  countSearchable(userId: string, generationId: string, probeVector: number[], limit: number): Promise<number>;
  deleteGeneration(userId: string, generationId: string): Promise<void>;
  deleteInactive(userId: string, activeGenerationId: string): Promise<void>;
  activate(userId: string, updates: Partial<KnowledgeData>): Promise<void>;
  sleep(ms: number): Promise<void>;
  now(): number;
  newGenerationId(): string;
}

export const defaultPublishDeps: PublishDeps = {
  embedTexts,
  insertGeneration: insertKnowledgeGeneration,
  countSearchable: countSearchableGenerationChunks,
  deleteGeneration: deleteKnowledgeGeneration,
  deleteInactive: deleteInactiveKnowledgeGenerations,
  activate: writeKnowledge,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: Date.now,
  newGenerationId: randomUUID,
};

/** Same 300-word split as the original crawler, applied per page so chunks keep their source URL. */
export function chunkText(text: string, wordsPerChunk = WORDS_PER_CHUNK): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks;
}

export async function publishCrawl(input: PublishInput, deps: PublishDeps = defaultPublishDeps): Promise<PublishResult> {
  const { userId, crawl, correlationId } = input;
  const log = (stage: string, detail = '') => console.log(`[crawl_publish] cid=${correlationId} ${stage} ${detail}`.trim());

  const pages: PublishedPage[] = crawl.pages.map((p) => ({
    url: p.url,
    title: p.title,
    status: p.status,
    reason: p.reason,
    chunks: 0,
    chars: p.markdown.length,
  }));

  if (crawl.pages.some((p) => p.status === 'failed')) {
    return { ok: false, reason: 'pages_failed', pages };
  }

  // Build chunks per usable page, keeping the original "--- Page: url ---" header.
  const texts: string[] = [];
  const owners: number[] = [];
  const pageTexts: string[] = [];

  // The site-wide header/footer (contact details, address, hours) goes first so the chunk cap never drops it.
  // Its chunks have no owning page, so it is not counted in pagesIndexed.
  const siteChrome = crawl.siteChrome?.trim();
  if (siteChrome) {
    const chromeText = `--- Site header and footer (shown on every page of ${input.siteUrlRedacted}) ---\n${siteChrome}`;
    for (const chunk of chunkText(chromeText)) {
      texts.push(chunk);
      owners.push(SITE_CHROME_OWNER);
    }
  }

  crawl.pages.forEach((page, index) => {
    if (page.status !== 'fetched' || !page.markdown.trim()) return;
    const pageText = `--- Page: ${page.url} ---\n${page.markdown.slice(0, MAX_PAGE_CHARS)}`;
    pageTexts.push(pageText);
    for (const chunk of chunkText(pageText)) {
      if (texts.length >= MAX_TOTAL_CHUNKS) break;
      texts.push(chunk);
      owners.push(index);
    }
  });

  if (!owners.some((owner) => owner !== SITE_CHROME_OWNER)) {
    return { ok: false, reason: 'no_content', pages };
  }

  let vectors: number[][];
  try {
    vectors = await deps.embedTexts(texts);
    if (vectors.length !== texts.length) throw new Error('embedding count mismatch');
  } catch (err) {
    console.error(`[crawl_publish] cid=${correlationId} embedding failed:`, (err as Error)?.message);
    return { ok: false, reason: 'embedding_failed', pages };
  }

  const generationId = deps.newGenerationId();
  const chunks: ChunkInput[] = texts.map((text, i) => {
    const page = owners[i] === SITE_CHROME_OWNER ? null : crawl.pages[owners[i]];
    return {
      id: `${generationId}:${i}`,
      vector: vectors[i],
      payload: {
        userId,
        url: page ? page.url : input.siteUrlRedacted,
        title: page ? page.title : 'Site header and footer',
        siteUrl: input.siteUrlRedacted,
        text,
        chunkIndex: i,
        totalChunks: texts.length,
        generationId,
      },
    };
  });

  const discardStaged = async () => {
    try {
      await deps.deleteGeneration(userId, generationId);
    } catch (err) {
      console.warn(`[crawl_publish] cid=${correlationId} could not remove staged generation:`, (err as Error)?.message);
    }
  };

  try {
    await deps.insertGeneration(userId, generationId, chunks);
    log('staged', `chunks=${chunks.length}`);
  } catch (err) {
    console.error(`[crawl_publish] cid=${correlationId} staging failed:`, (err as Error)?.message);
    await discardStaged();
    return { ok: false, reason: 'storage_failed', pages };
  }

  if (!(await waitUntilSearchable(userId, generationId, vectors[0], chunks.length, deps))) {
    console.error(`[crawl_publish] cid=${correlationId} staged generation not searchable in time`);
    await discardStaged();
    return { ok: false, reason: 'index_not_ready', pages };
  }

  const pagesIndexed = new Set(owners.filter((owner) => owner !== SITE_CHROME_OWNER)).size;
  const characters = pageTexts.reduce((sum, text) => sum + text.length, 0);
  const now = new Date(deps.now()).toISOString();

  try {
    await deps.activate(userId, {
      url: input.siteUrl,
      content: pageTexts.join('\n\n').slice(0, KNOWLEDGE_PREVIEW_CHARS),
      crawledAt: now,
      chunkCount: chunks.length,
      pagesIndexed,
      activeGenerationId: generationId,
      lastCrawl: {
        status: 'succeeded',
        at: now,
        correlationId,
        url: input.siteUrlRedacted,
        provider: crawl.provider,
        fallbackUsed: input.fallbackUsed,
        pagesIndexed,
        chunks: chunks.length,
      },
    });
    log('activated', `generation=${generationId}`);
  } catch (err) {
    console.error(`[crawl_publish] cid=${correlationId} activation failed:`, (err as Error)?.message);
    await discardStaged();
    return { ok: false, reason: 'storage_failed', pages };
  }

  try {
    await deps.deleteInactive(userId, generationId);
  } catch (err) {
    // The new generation is already active; leftovers are removed on the next successful crawl.
    console.warn(`[crawl_publish] cid=${correlationId} cleanup of old generations failed:`, (err as Error)?.message);
  }

  const chunkCounts = new Map<number, number>();
  owners.forEach((owner) => chunkCounts.set(owner, (chunkCounts.get(owner) ?? 0) + 1));
  const publishedPages = pages.map((page, index) =>
    chunkCounts.has(index) ? { ...page, status: 'indexed' as const, chunks: chunkCounts.get(index)! } : page
  );

  return { ok: true, generationId, pages: publishedPages, chunks: chunks.length, characters, pagesIndexed };
}

async function waitUntilSearchable(
  userId: string,
  generationId: string,
  probeVector: number[],
  chunkCount: number,
  deps: PublishDeps
): Promise<boolean> {
  const expected = Math.min(chunkCount, READINESS_PROBE_LIMIT);
  const deadline = deps.now() + READINESS_TIMEOUT_MS;

  for (;;) {
    try {
      const found = await deps.countSearchable(userId, generationId, probeVector, expected);
      if (found >= expected) return true;
    } catch (err) {
      // e.g. the index definition is still being updated to include generationId.
      console.warn('[crawl_publish] readiness probe error:', (err as Error)?.message);
    }
    if (deps.now() + READINESS_POLL_MS > deadline) return false;
    await deps.sleep(READINESS_POLL_MS);
  }
}
