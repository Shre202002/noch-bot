import type { Document } from 'mongodb';
import { getDb } from '@/lib/db';
import { coerceDate, coerceNumber, describeSheet, type CellValue, type TabularColumn } from '@/lib/tabularParser';

/**
 * Structured question answering over uploaded CSV/XLSX files.
 *
 * The LLM proposes a small JSON query plan; validatePlan() checks it against
 * the file's real columns and an operator allowlist, and only the validated
 * plan is turned into a MongoDB aggregation. Raw LLM output never reaches Mongo.
 */

export const TABULAR_ROWS_COLLECTION = 'tabular_rows';

export interface StoredSheet {
  name: string;
  rowCount: number;
  columns: TabularColumn[];
  /** Column whose value identifies a row across batches (e.g. SKU); see tabularLibrary.ts. */
  idColumnKey?: string;
}

const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'in', 'isEmpty', 'notEmpty'] as const;
const AGG_OPS = ['count', 'sum', 'avg', 'min', 'max', 'distinctCount'] as const;
type FilterOp = (typeof FILTER_OPS)[number];
type AggOp = (typeof AGG_OPS)[number];

const MAX_LIMIT = 100;
const MAX_FILTERS = 10;
const MAX_IN_VALUES = 50;

export interface ValidFilter {
  column: TabularColumn;
  op: FilterOp;
  value?: string | number | boolean | Array<string | number | boolean>;
}

export interface ValidAggregation {
  op: AggOp;
  column?: TabularColumn;
  label: string;
}

export interface ValidPlan {
  sheet: StoredSheet;
  filters: ValidFilter[];
  groupBy: TabularColumn[];
  aggregations: ValidAggregation[];
  /** Output field to sort by (a groupBy column name, aggregation label, or row column name). */
  sort?: { field: string; dir: 1 | -1 };
  limit: number;
  /**
   * What the user wants that no column can express ("best for beach trips"). Only on row-listing plans; the rows
   * matching the filters are ranked by meaning (row embeddings) instead of returned in file order.
   */
  semantic?: string;
}

const MAX_SEMANTIC_CHARS = 200;
/** Rows returned for a meaning-ranked plan unless the question asks for a count. */
const SEMANTIC_DEFAULT_LIMIT = 10;

export type PlanDecision = { mode: 'lookup' } | { mode: 'query'; plan: ValidPlan };

// ── Planner prompt ────────────────────────────────────────────────────────

export function plannerPrompt(sheets: StoredSheet[], options: { semantic?: boolean } = {}): string {
  const semanticRules = options.semantic
    ? `
- Add "semantic":"<short phrase>" when the question asks for rows that are best for, suitable for, similar to, or about
  something no column states exactly (e.g. "best for beach trips", "good gift for a runner"). Keep hard limits
  (price, category, stock, dates) as filters; put only the descriptive need in "semantic". Never use semantic with
  groupBy or aggregations.`
    : '';
  return `You translate questions about a spreadsheet into a JSON query plan. Reply with JSON only.

${sheets.map((s) => describeSheet(s, s.rowCount)).join('\n\n')}

Reply with ONE of:
{"mode":"lookup"}
  - only for vague or descriptive questions that no column filter can express (e.g. "which notes mention delays?" when unsure of wording).
{"mode":"query","sheet":"<sheet name>","filters":[{"column":"<name or key>","op":"<op>","value":<value>}],"groupBy":["<column>"],"aggregations":[{"op":"<agg>","column":"<column>"}],"sort":{"by":"<column name or aggregation label>","dir":"desc"},"limit":10}
  - for counting, totals, averages, min/max, rankings, distributions, filtered lists,
    and for finding specific records by a value (an ID, name, email, product): filter with eq or contains, no aggregations.

Rules:
- filter ops: eq, neq, gt, gte, lt, lte, contains, startsWith, in (value is an array), isEmpty, notEmpty.
- aggregation ops: count (no column), sum, avg (number columns), min, max, distinctCount.
- Aggregation labels are "count" or "<op> of <column name>", e.g. "sum of Revenue". Use them in sort.by.
- Dates are ISO strings "YYYY-MM-DD". For a month use startsWith "2026-03"; for ranges use gte/lt.
- For string columns that list their values, use those exact values.
- To list matching rows, omit groupBy and aggregations; set sort and limit as needed.
- "How many rows match" is aggregations [{"op":"count"}] with no groupBy.
- limit is at most ${MAX_LIMIT}.
- Only use columns listed above. If the question needs a column that does not exist, reply {"mode":"lookup"}.${semanticRules}`;
}

// ── Validation ────────────────────────────────────────────────────────────

function findSheet(sheets: StoredSheet[], name: unknown): StoredSheet | undefined {
  if (typeof name === 'string') {
    const match = sheets.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    if (match) return match;
  }
  return sheets.length === 1 ? sheets[0] : undefined;
}

function findColumn(sheet: StoredSheet, ref: unknown): TabularColumn | undefined {
  if (typeof ref !== 'string') return undefined;
  const r = ref.trim().toLowerCase();
  return sheet.columns.find((c) => c.key === r || c.name.toLowerCase() === r);
}

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** Cast a filter value to the column's stored type; undefined when it cannot be. */
function castValue(column: TabularColumn, value: unknown, op: FilterOp): string | number | boolean | undefined {
  if (!isPrimitive(value)) return undefined;
  if (op === 'contains' || op === 'startsWith') return String(value).slice(0, 200);
  switch (column.type) {
    case 'number':
      return coerceNumber(value) ?? undefined;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return /^(true|yes)$/i.test(String(value)) ? true : /^(false|no)$/i.test(String(value)) ? false : undefined;
    case 'date':
      return coerceDate(value) ?? undefined;
    default:
      return String(value).slice(0, 200);
  }
}

function aggLabel(op: AggOp, column?: TabularColumn): string {
  return op === 'count' ? 'count' : `${op} of ${column!.name}`;
}

/** Validate an untrusted plan from the LLM. Returns lookup for anything invalid. */
export function validatePlan(raw: unknown, sheets: StoredSheet[]): PlanDecision {
  if (!raw || typeof raw !== 'object') return { mode: 'lookup' };
  const p = raw as Record<string, unknown>;
  if (p.mode !== 'query') return { mode: 'lookup' };

  const sheet = findSheet(sheets, p.sheet);
  if (!sheet) return { mode: 'lookup' };

  const filters: ValidFilter[] = [];
  for (const f of (Array.isArray(p.filters) ? p.filters : []).slice(0, MAX_FILTERS)) {
    if (!f || typeof f !== 'object') return { mode: 'lookup' };
    const { column: ref, op, value } = f as Record<string, unknown>;
    const column = findColumn(sheet, ref);
    if (!column || !FILTER_OPS.includes(op as FilterOp)) return { mode: 'lookup' };
    const filterOp = op as FilterOp;

    if (filterOp === 'isEmpty' || filterOp === 'notEmpty') {
      filters.push({ column, op: filterOp });
    } else if (filterOp === 'in') {
      if (!Array.isArray(value) || value.length === 0) return { mode: 'lookup' };
      const cast = value.slice(0, MAX_IN_VALUES).map((v) => castValue(column, v, 'eq'));
      if (cast.some((v) => v === undefined)) return { mode: 'lookup' };
      filters.push({ column, op: filterOp, value: cast as Array<string | number | boolean> });
    } else {
      // Pattern matching only makes sense on stored strings (text and ISO dates).
      if ((filterOp === 'contains' || filterOp === 'startsWith') && column.type !== 'string' && column.type !== 'date') {
        return { mode: 'lookup' };
      }
      const cast = castValue(column, value, filterOp);
      if (cast === undefined) return { mode: 'lookup' };
      filters.push({ column, op: filterOp, value: cast });
    }
  }

  const groupBy: TabularColumn[] = [];
  for (const ref of (Array.isArray(p.groupBy) ? p.groupBy : []).slice(0, 3)) {
    const column = findColumn(sheet, ref);
    if (!column) return { mode: 'lookup' };
    if (!groupBy.includes(column)) groupBy.push(column);
  }

  const aggregations: ValidAggregation[] = [];
  for (const a of (Array.isArray(p.aggregations) ? p.aggregations : []).slice(0, 6)) {
    if (!a || typeof a !== 'object') return { mode: 'lookup' };
    const { op, column: ref } = a as Record<string, unknown>;
    if (!AGG_OPS.includes(op as AggOp)) return { mode: 'lookup' };
    const aggOp = op as AggOp;
    if (aggOp === 'count') {
      if (!aggregations.some((x) => x.op === 'count')) aggregations.push({ op: aggOp, label: 'count' });
      continue;
    }
    const column = findColumn(sheet, ref);
    if (!column) return { mode: 'lookup' };
    if ((aggOp === 'sum' || aggOp === 'avg') && column.type !== 'number') return { mode: 'lookup' };
    aggregations.push({ op: aggOp, column, label: aggLabel(aggOp, column) });
  }
  // Grouping without an aggregation means "how many per group".
  if (groupBy.length > 0 && aggregations.length === 0) aggregations.push({ op: 'count', label: 'count' });

  const grouped = groupBy.length > 0 || aggregations.length > 0;
  const outputFields = grouped
    ? [...groupBy.map((c) => c.name), ...aggregations.map((a) => a.label)]
    : sheet.columns.map((c) => c.name);

  let sort: ValidPlan['sort'];
  if (p.sort && typeof p.sort === 'object') {
    const { by, dir } = p.sort as Record<string, unknown>;
    const wanted = typeof by === 'string' ? by.trim().toLowerCase() : '';
    const field =
      outputFields.find((f) => f.toLowerCase() === wanted) ??
      // "sum" / "Revenue" shorthand for an aggregation label
      aggregations.find((a) => a.op === wanted || a.column?.name.toLowerCase() === wanted)?.label ??
      (grouped ? undefined : findColumn(sheet, by)?.name);
    if (field) sort = { field, dir: dir === 'asc' ? 1 : -1 };
  }
  if (!sort && groupBy.length > 0) sort = { field: aggregations[0].label, dir: -1 };

  const semantic =
    !grouped && typeof p.semantic === 'string' && p.semantic.trim()
      ? p.semantic.trim().slice(0, MAX_SEMANTIC_CHARS)
      : undefined;

  const requested = typeof p.limit === 'number' && Number.isFinite(p.limit)
    ? Math.floor(p.limit)
    : grouped ? 50 : semantic ? SEMANTIC_DEFAULT_LIMIT : 20;
  const limit = Math.min(Math.max(requested, 1), MAX_LIMIT);

  return { mode: 'query', plan: { sheet, filters, groupBy, aggregations, sort, limit, ...(semantic ? { semantic } : {}) } };
}

// ── Execution ─────────────────────────────────────────────────────────────

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterToMatch(filter: ValidFilter): Document {
  const path = `data.${filter.column.key}`;
  const v = filter.value;
  const textCompare = filter.column.type === 'string' && typeof v === 'string';
  const exact = (x: string | number | boolean) =>
    typeof x === 'string' && filter.column.type === 'string' ? new RegExp(`^${escapeRegExp(x)}$`, 'i') : x;

  switch (filter.op) {
    case 'eq':
      return { [path]: exact(v as string | number | boolean) };
    case 'neq':
      return textCompare
        ? { [path]: { $not: new RegExp(`^${escapeRegExp(v as string)}$`, 'i') } }
        : { [path]: { $ne: v } };
    case 'gt': return { [path]: { $gt: v } };
    case 'gte': return { [path]: { $gte: v } };
    case 'lt': return { [path]: { $lt: v } };
    case 'lte': return { [path]: { $lte: v } };
    case 'contains':
      return { [path]: { $regex: escapeRegExp(String(v)), $options: 'i' } };
    case 'startsWith':
      return { [path]: { $regex: `^${escapeRegExp(String(v))}`, $options: 'i' } };
    case 'in':
      return { [path]: { $in: (v as Array<string | number | boolean>).map(exact) } };
    case 'isEmpty':
      return { [path]: null };
    case 'notEmpty':
      return { [path]: { $ne: null } };
  }
}

/** Mongo-safe output field name for a label. */
const fieldId = (i: number) => `f${i}`;

export function buildPipeline(plan: ValidPlan, userId: string, fileId: string): Document[] {
  const match: Document = { userId, fileId, sheet: plan.sheet.name };
  const filterClauses = plan.filters.map(filterToMatch);
  const pipeline: Document[] = [{ $match: filterClauses.length ? { ...match, $and: filterClauses } : match }];

  const grouped = plan.groupBy.length > 0 || plan.aggregations.length > 0;
  if (!grouped) {
    const outputs = plan.sheet.columns;
    const project: Document = { _id: 0 };
    outputs.forEach((c, i) => { project[fieldId(i)] = `$data.${c.key}`; });
    if (plan.sort) {
      const col = plan.sheet.columns.find((c) => c.name === plan.sort!.field)!;
      pipeline.push({ $sort: { [`data.${col.key}`]: plan.sort.dir, rowIndex: 1 } });
    } else {
      pipeline.push({ $sort: { rowIndex: 1 } });
    }
    pipeline.push({ $limit: plan.limit }, { $project: project });
    return pipeline;
  }

  const group: Document = {
    _id: plan.groupBy.length ? Object.fromEntries(plan.groupBy.map((c, i) => [`g${i}`, `$data.${c.key}`])) : null,
  };
  plan.aggregations.forEach((a, i) => {
    const path = a.column ? `$data.${a.column.key}` : undefined;
    group[`a${i}`] =
      a.op === 'count' ? { $sum: 1 }
        : a.op === 'distinctCount' ? { $addToSet: path }
          : { [`$${a.op}`]: path };
  });
  pipeline.push({ $group: group });

  const project: Document = { _id: 0 };
  const labels = outputLabels(plan);
  plan.groupBy.forEach((_, i) => { project[fieldId(i)] = `$_id.g${i}`; });
  plan.aggregations.forEach((a, i) => {
    project[fieldId(plan.groupBy.length + i)] = a.op === 'distinctCount' ? { $size: `$a${i}` } : `$a${i}`;
  });
  pipeline.push({ $project: project });

  if (plan.sort) {
    const idx = labels.indexOf(plan.sort.field);
    if (idx >= 0) pipeline.push({ $sort: { [fieldId(idx)]: plan.sort.dir } });
  }
  pipeline.push({ $limit: plan.limit });
  return pipeline;
}

/** Column headers of the result table, in output field order (f0, f1, ...). */
export function outputLabels(plan: ValidPlan): string[] {
  const grouped = plan.groupBy.length > 0 || plan.aggregations.length > 0;
  return grouped
    ? [...plan.groupBy.map((c) => c.name), ...plan.aggregations.map((a) => a.label)]
    : plan.sheet.columns.map((c) => c.name);
}

export interface PlanResult {
  labels: string[];
  rows: CellValue[][];
  /** Rows in the sheet that matched the filters (before grouping/limit). */
  totalMatched: number;
}

export async function runPlan(plan: ValidPlan, userId: string, fileId: string): Promise<PlanResult> {
  const db = await getDb();
  const collection = db.collection(TABULAR_ROWS_COLLECTION);
  const pipeline = buildPipeline(plan, userId, fileId);

  const [docs, totalMatched] = await Promise.all([
    collection.aggregate(pipeline, { maxTimeMS: 10_000 }).toArray(),
    collection.countDocuments(pipeline[0].$match, { maxTimeMS: 10_000 }),
  ]);
  const labels = outputLabels(plan);
  return {
    labels,
    rows: docs.map((d) => labels.map((_, i) => roundValue(d[fieldId(i)]))),
    totalMatched,
  };
}

/**
 * Split a plan's filters for $vectorSearch: Atlas can pre-filter numbers and booleans on the indexed keys
 * (c0..c{prefilterKeyLimit-1}) exactly as filterToMatch would; text matching is case-insensitive here and dates are
 * stored as ISO strings, so those (and later columns) are applied to the candidates afterwards.
 */
export function splitFilters(plan: ValidPlan, prefilterKeyLimit: number): { prefilter: Document; post: Document } {
  const prefilter: Document = {};
  const post: Document[] = [];
  for (const f of plan.filters) {
    const keyIndex = Number(f.column.key.slice(1));
    const typed = f.column.type === 'number' || f.column.type === 'boolean';
    const op = { eq: '$eq', neq: '$ne', gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', in: '$in' }[f.op as string];
    const path = `data.${f.column.key}`;
    if (typed && op && keyIndex < prefilterKeyLimit && !(f.column.type === 'boolean' && op.startsWith('$g'))) {
      prefilter[path] = { ...(prefilter[path] ?? {}), [op]: f.value };
    } else {
      post.push(filterToMatch(f));
    }
  }
  return { prefilter, post: post.length ? { $and: post } : {} };
}

/** Rows of a meaning-ranked plan, in relevance order (re-sorted when the plan asks, e.g. "cheapest first"). */
export function semanticRowsToResult(
  plan: ValidPlan,
  hits: Array<{ data: Record<string, CellValue> }>
): PlanResult {
  const labels = outputLabels(plan);
  let rows = hits.map((h) => plan.sheet.columns.map((c) => roundValue(h.data?.[c.key])));
  if (plan.sort) {
    const idx = labels.indexOf(plan.sort.field);
    if (idx >= 0) {
      const dir = plan.sort.dir;
      rows = [...rows].sort((a, b) => {
        const x = a[idx];
        const y = b[idx];
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (x < y ? -1 : 1) * dir;
      });
    }
  }
  return { labels, rows, totalMatched: rows.length };
}

function roundValue(v: unknown): CellValue {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  if (v === undefined) return null;
  return v as CellValue;
}

// ── Formatting for the answer prompt ──────────────────────────────────────

export function describePlan(plan: ValidPlan): string {
  const parts: string[] = [`Sheet "${plan.sheet.name}"`];
  if (plan.filters.length) {
    parts.push(
      'filtered where ' +
        plan.filters
          .map((f) => `${f.column.name} ${f.op}${f.value !== undefined ? ` ${JSON.stringify(f.value)}` : ''}`)
          .join(' AND ')
    );
  }
  if (plan.groupBy.length) parts.push(`grouped by ${plan.groupBy.map((c) => c.name).join(', ')}`);
  if (plan.aggregations.length) parts.push(`computed ${plan.aggregations.map((a) => a.label).join(', ')}`);
  if (plan.semantic) parts.push(`ranked by relevance to "${plan.semantic}"`);
  if (plan.sort) parts.push(`sorted by ${plan.sort.field} ${plan.sort.dir === 1 ? 'ascending' : 'descending'}`);
  parts.push(`limit ${plan.limit}`);
  return parts.join('; ');
}

/** Markdown table of the result; rows past maxChars are counted, not sent. */
export function resultToMarkdown(result: PlanResult, maxChars = Infinity): string {
  if (result.rows.length === 0) return '(no matching rows)';
  const cell = (v: CellValue) => (v === null ? '' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '));
  const lines = [
    `| ${result.labels.map((l) => cell(l)).join(' | ')} |`,
    `| ${result.labels.map(() => '---').join(' | ')} |`,
  ];
  let size = lines.join('\n').length;
  let shown = 0;
  for (const row of result.rows) {
    const line = `| ${row.map(cell).join(' | ')} |`;
    if (shown > 0 && size + line.length + 1 > maxChars) break;
    lines.push(line);
    size += line.length + 1;
    shown++;
  }
  if (shown < result.rows.length) lines.push(`(${result.rows.length - shown} more rows not shown)`);
  return lines.join('\n');
}
