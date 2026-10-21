import Papa from 'papaparse';

/**
 * Parses CSV and XLSX uploads into typed sheets for tabular chat.
 * Rows are keyed by safe storage keys (c0..cN) so user-supplied column
 * names never become MongoDB field paths.
 */

export type ColumnType = 'number' | 'date' | 'boolean' | 'string';
export type CellValue = string | number | boolean | null;
export type TabularKind = 'csv' | 'xlsx';
export type DocumentKind = 'pdf' | TabularKind;

export interface TabularColumn {
  /** Storage key used in tabular_rows.data (c0, c1, ...). */
  key: string;
  /** Column name as it appears in the file (trimmed, de-duplicated). */
  name: string;
  type: ColumnType;
  nullCount: number;
  distinctCount: number;
  /** Up to 8 example values. */
  samples: CellValue[];
  /** Every distinct value, kept only for low-cardinality string columns. */
  values?: string[];
}

export interface TabularSheet {
  name: string;
  columns: TabularColumn[];
  rows: Record<string, CellValue>[];
}

export const TABULAR_LIMITS = {
  maxRows: 50_000,
  maxColumns: 200,
  maxCategoricalValues: 20,
  maxSamples: 8,
} as const;

/** Thrown for files that parse but exceed limits or contain no table. */
export class TabularParseError extends Error {
  constructor(message: string, readonly status: 413 | 422) {
    super(message);
    this.name = 'TabularParseError';
  }
}

// ── File type detection ───────────────────────────────────────────────────

/** Decide the document kind from magic bytes, falling back to the extension. */
export function detectDocumentKind(filename: string, buffer: Buffer): DocumentKind | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  // XLSX is a ZIP container ("PK\x03\x04").
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return ext === 'xlsx' ? 'xlsx' : null;
  }
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return 'csv';
  return null;
}

// ── Parsing ───────────────────────────────────────────────────────────────

export async function parseTabular(buffer: Buffer, kind: TabularKind): Promise<TabularSheet[]> {
  const sheets = kind === 'csv' ? parseCsv(buffer.toString('utf8')) : await parseXlsx(buffer);

  if (sheets.length === 0) {
    throw new TabularParseError('No table found. The file needs a header row and at least one data row.', 422);
  }
  const totalRows = sheets.reduce((n, s) => n + s.rows.length, 0);
  if (totalRows > TABULAR_LIMITS.maxRows) {
    throw new TabularParseError(
      `This file has ${totalRows.toLocaleString('en-US')} rows. The limit is ${TABULAR_LIMITS.maxRows.toLocaleString('en-US')} rows per file.`,
      413
    );
  }
  return sheets;
}

export function parseCsv(text: string): TabularSheet[] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });
  const [header, ...body] = result.data;
  if (!header) return [];
  const sheet = buildSheet('Sheet1', header, body);
  return sheet ? [sheet] : [];
}

async function parseXlsx(buffer: Buffer): Promise<TabularSheet[]> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new TabularParseError('Could not read this Excel file. Re-save it as .xlsx and try again.', 422);
  }

  const sheets: TabularSheet[] = [];
  workbook.eachSheet((worksheet) => {
    const grid: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      // row.values is 1-indexed; index 0 is always empty.
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      grid.push(values.map(excelCellValue));
    });
    const [header, ...body] = grid;
    if (!header) return;
    const sheet = buildSheet(worksheet.name, header, body);
    if (sheet) sheets.push(sheet);
  });
  return sheets;
}

/** Flatten exceljs cell values (formulas, rich text, hyperlinks, errors). */
function excelCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  const v = value as Record<string, unknown>;
  if ('result' in v) return excelCellValue(v.result);
  if ('formula' in v || 'sharedFormula' in v) return null;
  if (Array.isArray(v.richText)) return v.richText.map((r: { text?: string }) => r.text ?? '').join('');
  if (typeof v.text === 'string') return v.text;
  if ('error' in v) return null;
  return null;
}

// ── Sheet building and type inference ─────────────────────────────────────

const EMPTY_TOKENS = new Set(['', '-', '—', 'n/a', 'na', 'null', 'none', 'nil', '#n/a']);

function isEmptyCell(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return EMPTY_TOKENS.has(value.trim().toLowerCase());
  return false;
}

/**
 * Build a typed sheet from a header row and body rows of raw cell values.
 * Returns null when there is no data row.
 */
export function buildSheet(name: string, header: unknown[], body: unknown[][]): TabularSheet | null {
  const rows = body.filter((row) => row.some((cell) => !isEmptyCell(cell)));
  if (rows.length === 0) return null;

  const width = rows.reduce((max, r) => Math.max(max, r.length), header.length);
  // Keep columns that have a header or at least one value.
  const keep: number[] = [];
  for (let i = 0; i < width; i++) {
    if (!isEmptyCell(header[i]) || rows.some((r) => !isEmptyCell(r[i]))) keep.push(i);
  }
  if (keep.length > TABULAR_LIMITS.maxColumns) {
    throw new TabularParseError(
      `Sheet "${name}" has ${keep.length} columns. The limit is ${TABULAR_LIMITS.maxColumns}.`,
      413
    );
  }

  const names = uniqueNames(keep.map((i, n) => {
    const raw = header[i];
    const text = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? '').replace(/\s+/g, ' ').trim();
    return text || `Column ${n + 1}`;
  }));

  const columns: TabularColumn[] = [];
  const converted: CellValue[][] = rows.map(() => []);

  keep.forEach((sourceIndex, n) => {
    const raw = rows.map((r) => (isEmptyCell(r[sourceIndex]) ? null : r[sourceIndex]));
    const { type, values } = inferColumn(raw);
    values.forEach((v, rowIdx) => { converted[rowIdx][n] = v; });
    columns.push(summarizeColumn(`c${n}`, names[n], type, values));
  });

  return {
    name,
    columns,
    rows: converted.map((values) =>
      Object.fromEntries(columns.map((col, n) => [col.key, values[n] ?? null]))
    ),
  };
}

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const lower = name.toLowerCase();
    const count = (seen.get(lower) ?? 0) + 1;
    seen.set(lower, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}

function inferColumn(raw: unknown[]): { type: ColumnType; values: CellValue[] } {
  const present = raw.filter((v) => v !== null);
  if (present.length === 0) return { type: 'string', values: raw.map(() => null) };

  // Leading zeros ("00123") or long digit runs (phone numbers, IDs) stay text.
  const looksLikeCode = present.some(
    (v) => typeof v === 'string' && /^(0\d+|\+?\d{12,})$/.test(v.trim().replace(/[\s-]/g, ''))
  );
  if (!looksLikeCode) {
    const numbers = present.map(coerceNumber);
    if (numbers.every((n) => n !== null)) {
      return { type: 'number', values: raw.map((v) => (v === null ? null : coerceNumber(v))) };
    }
  }

  if (present.every((v) => coerceBoolean(v) !== null)) {
    return { type: 'boolean', values: raw.map((v) => (v === null ? null : coerceBoolean(v))) };
  }

  const dayFirst = slashDatesAreDayFirst(present);
  if (present.every((v) => coerceDate(v, dayFirst) !== null)) {
    return { type: 'date', values: raw.map((v) => (v === null ? null : coerceDate(v, dayFirst))) };
  }

  return { type: 'string', values: raw.map((v) => (v === null ? null : stringify(v))) };
}

export function summarizeColumn(key: string, name: string, type: ColumnType, values: CellValue[]): TabularColumn {
  const present = values.filter((v): v is Exclude<CellValue, null> => v !== null);
  const distinct = Array.from(new Set(present.map((v) => String(v))));
  const column: TabularColumn = {
    key,
    name,
    type,
    nullCount: values.length - present.length,
    distinctCount: distinct.length,
    samples: Array.from(new Set(present)).slice(0, TABULAR_LIMITS.maxSamples),
  };
  if (type === 'string' && distinct.length <= TABULAR_LIMITS.maxCategoricalValues) {
    column.values = distinct.sort();
  }
  return column;
}

function stringify(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** "₹1,200.50" → 1200.5, "(500)" → -500, "12%" → 12. Returns null for non-numbers. */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim();
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^[₹$€£¥]|^(rs\.?|inr|usd|eur)\s*/i, '').replace(/[₹$€£¥%]$/, '').replace(/,/g, '').trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  if (t === 'true' || t === 'yes') return true;
  if (t === 'false' || t === 'no') return false;
  return null;
}

const SLASH_DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const MONTH_NAME_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/** Decide d/m/y vs m/d/y for a whole column from the values that disambiguate it. */
function slashDatesAreDayFirst(values: unknown[]): boolean {
  for (const v of values) {
    const m = typeof v === 'string' ? v.trim().match(SLASH_DATE_RE) : null;
    if (!m) continue;
    if (Number(m[1]) > 12) return true;
    if (Number(m[2]) > 12) return false;
  }
  return true; // Ambiguous columns are read day-first (dd/mm/yyyy).
}

/** Normalize a date to ISO "YYYY-MM-DD" (with "THH:mm:ss" when a time is present). */
export function coerceDate(value: unknown, dayFirst = true): string | null {
  if (value instanceof Date) return isoDate(value);
  if (typeof value !== 'string') return null;
  const text = value.trim();

  const iso = text.match(ISO_DATE_RE);
  if (iso) {
    const date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0)));
    return validDate(date, +iso[2]) ? isoDate(date) : null;
  }

  const slash = text.match(SLASH_DATE_RE);
  if (slash) {
    const [day, month] = dayFirst ? [+slash[1], +slash[2]] : [+slash[2], +slash[1]];
    const date = new Date(Date.UTC(+slash[3], month - 1, day));
    return validDate(date, month) ? isoDate(date) : null;
  }

  // "5 March 2026", "Mar 5, 2026"
  if (MONTH_NAME_RE.test(text) && /\d{4}/.test(text)) {
    const parsed = Date.parse(`${text} UTC`);
    return Number.isNaN(parsed) ? null : isoDate(new Date(parsed));
  }
  return null;
}

function validDate(date: Date, month: number): boolean {
  return !Number.isNaN(date.getTime()) && date.getUTCMonth() === month - 1;
}

function isoDate(date: Date): string {
  const iso = date.toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 19);
}

// ── Text rendering for embeddings and prompts ─────────────────────────────

/** "Row 12: Name: Priya; Region: North; Revenue: 1200" */
export function renderRow(columns: TabularColumn[], row: Record<string, CellValue>, rowNumber: number): string {
  const cells = columns
    .filter((c) => row[c.key] !== null && row[c.key] !== undefined)
    .map((c) => `${c.name}: ${row[c.key]}`);
  return `Row ${rowNumber}: ${cells.join('; ')}`;
}

/** Column overview used as the schema chunk and in the query planner prompt. */
export function describeSheet(sheet: { name: string; columns: TabularColumn[] }, rowCount: number): string {
  const lines = sheet.columns.map((c) => {
    const examples = c.values
      ? `values: ${c.values.join(' | ')}`
      : `examples: ${c.samples.slice(0, 5).join(' | ')}`;
    return `- ${c.name} [key ${c.key}, ${c.type}] ${examples}`;
  });
  return `Sheet "${sheet.name}" — ${rowCount} rows, ${sheet.columns.length} columns:\n${lines.join('\n')}`;
}
