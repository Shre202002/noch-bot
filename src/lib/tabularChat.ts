import { embedText } from '@/lib/embeddings';
import { groqChat, GroqUnavailableError, GROQ_UNAVAILABLE_REPLY } from '@/lib/groq';
import { answerWithGuards, groundedRules, selectRelevant, wrapSources } from '@/lib/llmGuard';
import { describeSheet } from '@/lib/tabularParser';
import {
  describePlan,
  plannerPrompt,
  resultToMarkdown,
  runPlan,
  semanticRowsToResult,
  splitFilters,
  validatePlan,
  type PlanResult,
  type StoredSheet,
  type ValidPlan,
} from '@/lib/tabularQuery';
import {
  ROW_FILTER_KEY_LIMIT,
  ROW_VECTOR_DIMENSIONS,
  searchPdfChunks,
  searchTabularRows,
} from '@/lib/vectorStore';

/** Exact reply when the file does not contain the answer. */
const TABLE_NO_ANSWER = "I couldn't find that in this file.";

const ANSWER_PROMPT = `You answer questions about a spreadsheet the user uploaded.

Rules:
- Lead with the direct answer in one sentence, with exact numbers as they appear in the sources.
- When the result has several rows, include them as a Markdown table.
- Do not calculate new figures (differences, percentages, totals) that are not in the sources.
- Professional, concise tone. No emojis. Never describe your reasoning or mention query plans, keys like c0, or JSON.

${groundedRules(TABLE_NO_ANSWER)}`;

/**
 * Context budget per answer call (~3k tokens). Groq's free tier caps a single
 * request (prompt + max_tokens) at 8k tokens per minute.
 */
const MAX_CONTEXT_CHARS = 12_000;
/** Below this much room, another source is not worth adding. */
const MIN_SOURCE_CHARS = 500;
/** Reply when even a trimmed context is too large for the model (very wide sheets). */
const TOO_LARGE_REPLY =
  'That question needs more of this file than I can read at once. Try narrowing it, for example to one department, a date range, or specific columns.';

/** Groq rejects a request that exceeds the model's per-request token limit with 413. */
function isRequestTooLarge(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 413;
}

/** Cut text to at most `max` characters at a line boundary, so rows are never split mid-way. */
export function trimToLines(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf('\n', max);
  return `${text.slice(0, cut > 0 ? cut : max)}\n(more rows not shown)`;
}

/** Atlas cosine score below which a row chunk is treated as unrelated. */
const MIN_RELEVANCE_SCORE = 0.74;

export interface TabularAnswer {
  answer: string;
  mode: 'query' | 'lookup';
}

/**
 * Answer a question about one tabular file: aggregate and exact-match questions
 * run as a validated MongoDB query over every row; everything else uses vector
 * search over the file's row chunks. Callers check the question for prompt
 * injection first (see src/app/api/chat/pdf/route.ts).
 */
export async function answerTabularQuestion(params: {
  question: string;
  userId: string;
  fileId: string;
  fileLabel: string;
  sheets: StoredSheet[];
  /** Every row has its own embedding (catalog libraries); enables meaning-ranked results. */
  rowVectorsReady?: boolean;
}): Promise<TabularAnswer> {
  const { question, userId, fileId, fileLabel, sheets, rowVectorsReady = false } = params;
  const schema = sheets.map((s) => describeSheet(s, s.rowCount)).join('\n\n');

  try {
    const decision = await planQuestion(question, sheets, { semantic: rowVectorsReady });

    if (decision.mode === 'query') {
      try {
        const result = decision.plan.semantic && rowVectorsReady
          ? await runSemanticPlan(decision.plan, userId, fileId)
          : await runPlan(decision.plan, userId, fileId);
        const answer = await writeAnswer(question, [
          {
            label: `${fileLabel}: query result`,
            text: [
              `Query that was run: ${describePlan(decision.plan)}`,
              `Rows matching the filters: ${result.totalMatched}`,
              `Result (${result.rows.length} row${result.rows.length === 1 ? '' : 's'}):`,
              resultToMarkdown(result, MAX_CONTEXT_CHARS),
            ].join('\n'),
          },
        ]);
        return { answer, mode: 'query' };
      } catch (err) {
        if (err instanceof GroqUnavailableError) throw err;
        console.warn('[tabular-chat] query failed, falling back to lookup:', (err as Error)?.message);
      }
    }

    if (rowVectorsReady && sheets.length === 1) {
      const plan: ValidPlan = { sheet: sheets[0], filters: [], groupBy: [], aggregations: [], limit: 10, semantic: question };
      const result = await runSemanticPlan(plan, userId, fileId);
      const answer = await writeAnswer(question, [
        { label: `${fileLabel}: columns`, text: schema },
        { label: `${fileLabel}: most relevant rows`, text: resultToMarkdown(result, MAX_CONTEXT_CHARS) },
      ]);
      return { answer, mode: 'lookup' };
    }

    const hits = selectRelevant(
      await searchPdfChunks(userId, await embedText(question), 6, fileId),
      { minScore: MIN_RELEVANCE_SCORE }
    );
    const sources = [{ label: `${fileLabel}: columns`, text: schema }];
    let used = schema.length;
    for (const hit of hits) {
      const room = MAX_CONTEXT_CHARS - used;
      if (room < MIN_SOURCE_CHARS) break;
      const text = trimToLines(hit.text, room);
      sources.push({ label: `${fileLabel}: rows`, text });
      used += text.length;
    }
    return { answer: await writeAnswer(question, sources), mode: 'lookup' };
  } catch (err) {
    if (err instanceof GroqUnavailableError) return { answer: GROQ_UNAVAILABLE_REPLY, mode: 'lookup' };
    if (isRequestTooLarge(err)) return { answer: TOO_LARGE_REPLY, mode: 'lookup' };
    throw err;
  }
}

/**
 * Hard filters run inside (or right after) the vector search, so every returned row satisfies them; the rows are
 * ranked by how well they match the plan's semantic phrase.
 */
async function runSemanticPlan(plan: ValidPlan, userId: string, fileId: string): Promise<PlanResult> {
  const queryVector = await embedText(plan.semantic!, { dimensions: ROW_VECTOR_DIMENSIONS, taskType: 'RETRIEVAL_QUERY' });
  const { prefilter, post } = splitFilters(plan, ROW_FILTER_KEY_LIMIT);
  const hits = await searchTabularRows({
    userId,
    fileId,
    sheet: plan.sheet.name,
    queryVector,
    prefilter,
    postMatch: post,
    limit: plan.limit,
  });
  return semanticRowsToResult(plan, hits);
}

export async function planQuestion(question: string, sheets: StoredSheet[], options: { semantic?: boolean } = {}) {
  const completion = await groqChat({
    temperature: 0,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: plannerPrompt(sheets, options) },
      { role: 'user', content: question },
    ],
  });
  let raw: unknown;
  try {
    raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
  } catch {
    return { mode: 'lookup' as const };
  }
  return validatePlan(raw, sheets);
}

/** Grounded answer over wrapped sources, fact-checked against them. */
export async function writeAnswer(question: string, sources: Array<{ label?: string; text: string }>): Promise<string> {
  try {
    return await answerOnce(question, sources);
  } catch (err) {
    if (!isRequestTooLarge(err)) throw err;
    const total = sources.reduce((n, s) => n + s.text.length, 0);
    const scale = Math.max(0.2, 0.5 * (MAX_CONTEXT_CHARS / Math.max(total, 1)));
    console.warn(`[tabular-chat] request too large (${total} chars of sources), retrying with less context`);
    return answerOnce(question, sources.map((s) => ({ ...s, text: trimToLines(s.text, Math.max(MIN_SOURCE_CHARS, Math.floor(s.text.length * scale))) })));
  }
}

async function answerOnce(question: string, sources: Array<{ label?: string; text: string }>): Promise<string> {
  const sourcesText = wrapSources(sources);
  const { answer } = await answerWithGuards({
    messages: [
      { role: 'system', content: ANSWER_PROMPT },
      { role: 'user', content: `${sourcesText}\n\nQuestion: ${question}` },
    ],
    sourcesText,
    question,
    refusal: TABLE_NO_ANSWER,
    temperature: 0.1,
    maxTokens: 1000,
  });
  return answer;
}
