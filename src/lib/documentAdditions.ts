import type { DocumentKind, TabularColumn } from './tabularParser';
import { headerKey } from './tabularLibrary';
import { planLimits } from './plans';

/**
 * Rules for adding files to an existing PDF RAG document ("Add more data").
 *
 * A document stays one kind: PDFs grow with more PDFs (text passages), spreadsheets with CSV or Excel (rows in one
 * table). Each plan allows a number of additional files per document, every file is capped at MAX_ADDITION_MB, and
 * an added spreadsheet must look like the document it joins, so an unrelated sheet cannot be merged by mistake.
 */

export const MAX_ADDITION_MB = 10;

/** Share of the incoming file's headers that must already exist in the document. */
const MIN_HEADER_MATCH = 0.5;

/** Per-plan allowance from src/lib/plans.ts. Callers should `await loadPlans()` first. */
export function additionLimitFor(plan: string | undefined): number {
  return planLimits(plan).additionalFiles;
}

const isSheet = (kind: string | undefined) => kind === 'csv' || kind === 'xlsx';

/** Null when `incoming` may join a document of `docType`, else the message to show. */
export function additionKindError(docType: string | undefined, incoming: DocumentKind | null): string | null {
  const documentKind = docType ?? 'pdf';
  if (!incoming) return 'Only PDF, CSV and Excel (.xlsx) files are supported.';
  if (documentKind === 'pdf' && incoming === 'pdf') return null;
  if (isSheet(documentKind) && isSheet(incoming)) return null;
  return documentKind === 'pdf'
    ? 'This document holds PDF text, so only PDF files can be added to it. Upload the spreadsheet as its own document.'
    : 'This document is a spreadsheet, so only CSV or Excel files can be added to it. Upload the PDF as its own document.';
}

/** Null when another file may be added, else the message to show. */
export function additionLimitError(plan: string | undefined, used: number): string | null {
  const limit = additionLimitFor(plan);
  if (used < limit) return null;
  const planName = (plan ?? 'free').charAt(0).toUpperCase() + (plan ?? 'free').slice(1);
  return `Your ${planName} plan allows ${limit} additional file${limit === 1 ? '' : 's'} per document, and this document has used ${used === limit ? 'them all' : `${used}`}. Upgrade your plan to add more.`;
}

export function fileSizeError(sizeBytes: number): string | null {
  return sizeBytes > MAX_ADDITION_MB * 1024 * 1024 ? `This file is larger than ${MAX_ADDITION_MB} MB.` : null;
}

/**
 * Null when an incoming sheet matches the document's sheet, else the message to show. At least half of its headers
 * must already be columns of the document, and when the document has an ID column the file must include it.
 */
export function sheetFormatError(
  existing: TabularColumn[],
  incoming: TabularColumn[],
  idColumnKey?: string
): string | null {
  const known = new Set(existing.map((c) => headerKey(c.name)));
  const incomingHeaders = incoming.map((c) => c.name);
  const unmatched = incomingHeaders.filter((h) => !known.has(headerKey(h)));
  const matched = incomingHeaders.length - unmatched.length;

  if (incomingHeaders.length === 0 || matched / incomingHeaders.length < MIN_HEADER_MATCH) {
    const sample = unmatched.slice(0, 5).join(', ');
    return `This file's columns don't match the document (only ${matched} of ${incomingHeaders.length} headers match; for example ${sample}). Check that it is the same kind of sheet, or upload it as its own document.`;
  }

  if (idColumnKey) {
    const idColumn = existing.find((c) => c.key === idColumnKey);
    if (idColumn && !incoming.some((c) => headerKey(c.name) === headerKey(idColumn.name))) {
      return `This file has no "${idColumn.name}" column, which this document uses to match rows. Add that column and try again.`;
    }
  }
  return null;
}
