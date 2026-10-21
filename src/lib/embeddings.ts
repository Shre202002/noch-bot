// Uses Gemini REST API directly — bypasses Genkit entirely.
// This is more reliable and avoids any Genkit config issues.
// Reads GEMINI_API_KEY from .env.local

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
// const EMBED_MODEL = 'gemini-embedding-001';
// const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

const EMBED_MODEL = 'gemini-embedding-001';  // change from text-embedding-004
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;


/**
 * Optional request settings. Omitted, requests are exactly as before (full 3072-dimension vectors), which the
 * website and PDF indexes depend on. Catalog rows use smaller vectors (see src/lib/tabularLibrary.ts).
 */
export interface EmbedOptions {
  /** Gemini outputDimensionality, e.g. 768. */
  dimensions?: number;
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
  /** Retries for 429/5xx per batch; defaults to EMBED_MAX_RETRIES. */
  maxRetries?: number;
}

/** Gemini kept rate-limiting after the allowed retries; callers can resume later. */
export class EmbeddingRateLimitError extends Error {
  constructor() {
    super('Gemini embedding rate limit reached');
    this.name = 'EmbeddingRateLimitError';
  }
}

function requestFields(options?: EmbedOptions) {
  return {
    ...(options?.dimensions ? { outputDimensionality: options.dimensions } : {}),
    ...(options?.taskType ? { taskType: options.taskType } : {}),
  };
}

export async function embedText(text: string, options?: EmbedOptions): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      ...requestFields(options),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini embedding failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const vector = data?.embedding?.values;

  if (!vector || !Array.isArray(vector)) {
    throw new Error('Invalid embedding response from Gemini');
  }

  return vector;
}

// Alias for compatibility
export const embedContent = embedText;

const BATCH_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`;
const EMBED_BATCH_SIZE = 50;
/**
 * Character budget per batch request (~6k tokens). Gemini's free tier limits
 * embedding tokens per minute, and a single oversized batch is rejected
 * outright with 429 no matter how long we wait.
 */
const EMBED_BATCH_MAX_CHARS = 24_000;
const EMBED_MAX_RETRIES = 6;
/** 429 means the per-minute window is full; wait long enough for it to roll over. */
const RATE_LIMIT_DELAYS_MS = [5_000, 10_000, 20_000, 30_000, 60_000, 60_000];

/**
 * Embed many texts with the same model as embedText, in batches bounded by
 * count and size. Retries rate-limit (429) and transient 5xx responses with
 * backoff. Results are returned in input order; any failure rejects the whole call.
 */
export async function embedTexts(texts: string[], options?: EmbedOptions): Promise<number[][]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const vectors: number[][] = [];
  let batch: string[] = [];
  let batchChars = 0;
  for (const text of texts) {
    if (batch.length > 0 && (batch.length >= EMBED_BATCH_SIZE || batchChars + text.length > EMBED_BATCH_MAX_CHARS)) {
      vectors.push(...(await embedBatch(batch, options)));
      batch = [];
      batchChars = 0;
    }
    batch.push(text);
    batchChars += text.length;
  }
  if (batch.length > 0) vectors.push(...(await embedBatch(batch, options)));
  return vectors;
}

async function embedBatch(texts: string[], options?: EmbedOptions): Promise<number[][]> {
  const maxRetries = options?.maxRetries ?? EMBED_MAX_RETRIES;
  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      ...requestFields(options),
    })),
  });

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(BATCH_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (response.ok) {
      const data = await response.json();
      const embeddings = data?.embeddings;
      if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
        throw new Error('Invalid batch embedding response from Gemini');
      }
      return embeddings.map((e: { values?: number[] }) => {
        if (!Array.isArray(e?.values)) throw new Error('Invalid batch embedding response from Gemini');
        return e.values;
      });
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= maxRetries) {
      if (response.status === 429) throw new EmbeddingRateLimitError();
      // Status only: the body can echo request details.
      throw new Error(`Gemini batch embedding failed (${response.status})`);
    }
    const delay = response.status === 429 ? RATE_LIMIT_DELAYS_MS[attempt] : 1000 * 2 ** attempt;
    console.warn(`[embeddings] Gemini ${response.status}, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}