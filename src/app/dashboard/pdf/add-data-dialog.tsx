'use client';
// "Add more data": add another file of the same kind to a document. PDFs take more PDFs (more passages);
// spreadsheets take CSV or Excel (rows merged into one table). Plan limits and the format check run on the server.

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type LibraryFile = {
  fileId: string;
  label: string;
  fileName: string;
  docType: 'pdf' | 'csv' | 'xlsx';
  rowCount?: number;
  idColumn?: string | null;
  columns?: Array<{ key: string; name: string; type: string }>;
  additionsUsed: number;
  additionsLimit: number;
};

type SheetSummary = {
  kind: 'csv' | 'xlsx';
  added: number;
  updated: number;
  unchanged: number;
  uncastable: number;
  newColumns: string[];
  rowCount: number;
  unmatchedSheets: string[];
};
type PdfSummary = { kind: 'pdf'; filename: string; pages: number; chunks: number };
type Summary = (SheetSummary | PdfSummary) & { additionsUsed: number; additionsLimit: number };

const ID_HINT = /^(id|sku|code|product[ _-]?id|item[ _-]?id|product[ _-]?code|article)$/i;
const fmt = (n: number) => n.toLocaleString('en-US');
const MAX_MB = 10;

type Props = {
  file: LibraryFile | null;
  onClose: () => void;
  /** Called after a successful addition so the page can refresh (and start indexing spreadsheets). */
  onAdded: (fileId: string) => void;
};

export function AddDataDialog({ file, onClose, onAdded }: Props) {
  const [picked, setPicked] = useState<File | null>(null);
  const [idColumn, setIdColumn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);

  const isPdf = file?.docType === 'pdf';
  const idCandidates = useMemo(
    () => (file?.columns ?? []).filter((c) => c.type === 'string' || c.type === 'number'),
    [file]
  );

  useEffect(() => {
    setPicked(null);
    setError('');
    setSummary(null);
    setIdColumn(idCandidates.find((c) => ID_HINT.test(c.name.trim()))?.key ?? '');
  }, [file, idCandidates]);

  const choose = (f: File | null) => {
    setError('');
    if (f && f.size > MAX_MB * 1024 * 1024) {
      setPicked(null);
      setError(`This file is larger than ${MAX_MB} MB.`);
      return;
    }
    setPicked(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !picked || busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', picked);
      form.append('fileId', file.fileId);
      if (!isPdf && !file.idColumn && idColumn) form.append('idColumn', idColumn);
      const res = await fetch('/api/ingest/pdf/append', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not add this file. Please try again.');
        return;
      }
      setSummary(data);
      onAdded(file.fileId);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const name = file ? file.label || file.fileName : '';
  const remaining = file ? Math.max(0, file.additionsLimit - file.additionsUsed) : 0;

  return (
    <Dialog open={file !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-md border-[#2a2d35] bg-[#1f2228] text-white">
        <DialogHeader>
          <DialogTitle>Add more data</DialogTitle>
          <DialogDescription style={{ color: 'var(--nb-text-secondary)' }}>
            Add another {isPdf ? 'PDF' : 'CSV or Excel file'} to “{name}”{!isPdf && file?.rowCount ? ` (${fmt(file.rowCount)} rows)` : ''}. The same chat and share links answer over everything.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, lineHeight: 1.6 }}>
            {summary.kind === 'pdf' ? (
              <p style={{ margin: 0, color: '#fff' }}>
                Added {summary.filename}: {fmt(summary.pages)} page{summary.pages === 1 ? '' : 's'}, {fmt(summary.chunks)} passages. It is searchable now.
              </p>
            ) : (
              <>
                <p style={{ margin: 0, color: '#fff' }}>
                  {fmt(summary.added)} added · {fmt(summary.updated)} updated · {fmt(summary.unchanged)} unchanged
                </p>
                {summary.newColumns.length > 0 && (
                  <p style={{ margin: 0, color: 'var(--nb-text-secondary)' }}>New columns: {summary.newColumns.join(', ')}</p>
                )}
                {summary.uncastable > 0 && (
                  <p style={{ margin: 0, color: '#eab308' }}>
                    {fmt(summary.uncastable)} values didn’t match their column’s type (e.g. text in a price column) and were left empty.
                  </p>
                )}
                {summary.unmatchedSheets.length > 0 && (
                  <p style={{ margin: 0, color: '#eab308' }}>Skipped sheets with no match: {summary.unmatchedSheets.join(', ')}</p>
                )}
                <p style={{ margin: 0, color: 'var(--nb-text-secondary)' }}>
                  The document now has {fmt(summary.rowCount)} rows. New and changed rows are being indexed for smart search.
                </p>
              </>
            )}
            <p style={{ margin: 0, color: 'var(--nb-text-tertiary)', fontSize: 12 }}>
              {summary.additionsUsed} of {summary.additionsLimit} additional files used on your plan.
            </p>
            <button type="button" className="nb-focus" onClick={onClose}
              style={{ alignSelf: 'flex-end', minHeight: 40, padding: '0 18px', borderRadius: 9999, border: 'none', background: '#36f4a4', color: '#000', fontWeight: 500, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--nb-text-secondary)', lineHeight: 1.7 }}>
              <li>{isPdf ? 'PDF files only' : 'CSV or Excel (.xlsx) only'}, up to {MAX_MB} MB.</li>
              {!isPdf && <li>At least half of its column headers must match this document{file?.idColumn ? `, including “${file.idColumn}”` : ''}.</li>}
              <li>{remaining} of {file?.additionsLimit ?? 0} additional files left on your plan.</li>
            </ul>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--nb-text-secondary)' }}>
              File
              <input type="file" className="nb-focus"
                accept={isPdf ? '.pdf,application/pdf' : '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
                onChange={(e) => choose(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13, color: '#fff', padding: 8, borderRadius: 8, border: '1px solid #2a2d35', background: '#0a0a0a' }} />
            </label>

            {!isPdf && (file?.idColumn ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--nb-text-secondary)', lineHeight: 1.6 }}>
                Rows are matched by <strong style={{ color: '#fff' }}>{file.idColumn}</strong>: known IDs are updated, new IDs are added.
              </p>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--nb-text-secondary)' }}>
                Product ID column
                <select value={idColumn} onChange={(e) => setIdColumn(e.target.value)} className="nb-focus"
                  style={{ minHeight: 40, fontSize: 14, color: '#fff', padding: '0 10px', borderRadius: 8, border: '1px solid #2a2d35', background: '#0a0a0a' }}>
                  <option value="">None — always add rows as new</option>
                  {idCandidates.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
                <span style={{ fontSize: 12, color: 'var(--nb-text-tertiary)' }}>
                  With an ID column (e.g. SKU), re-uploading a product updates it instead of duplicating it. This is set once.
                </span>
              </label>
            ))}

            {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#ef4444', lineHeight: 1.5 }}>{error}</p>}

            <button type="submit" className="nb-focus" disabled={!picked || busy || remaining === 0}
              style={{ minHeight: 44, borderRadius: 9999, border: 'none', background: '#36f4a4', color: '#000', fontWeight: 500, fontSize: 14, cursor: busy ? 'wait' : 'pointer', opacity: !picked || busy || remaining === 0 ? 0.6 : 1 }}>
              {busy ? (isPdf ? 'Reading and indexing the PDF…' : 'Merging… this can take a minute') : 'Add to document'}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
