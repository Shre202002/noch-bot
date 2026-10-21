'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, FileSpreadsheet, Upload, Trash2, Link2, Copy, Check, ExternalLink, RotateCcw, Lock, Users,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LinkAccessDialog } from './link-access-dialog';
import { AddDataDialog, type LibraryFile } from './add-data-dialog';
import remarkGfm from 'remark-gfm';

type Message = { role: 'user' | 'assistant'; content: string };

type PdfFile = {
  fileId: string;
  label: string;
  uploadedAt: string;
  chunkCount: number;
  fileName: string;
  docType?: 'pdf' | 'csv' | 'xlsx';
  rowCount?: number;
  columnCount?: number;
  /** CSV/XLSX: per-row meaning search state ('indexing' | 'ready'; null for files uploaded before it existed). */
  rowVectors?: 'indexing' | 'ready' | null;
  pendingRows?: number;
  idColumn?: string | null;
  columns?: Array<{ key: string; name: string; type: string }>;
  /** Files added to this document so far, and how many the plan allows. */
  additionsUsed?: number;
  additionsLimit?: number;
};

const ACCEPTED_EXTENSIONS = ['.pdf', '.csv', '.xlsx'];
const isAcceptedFile = (f: File) => ACCEPTED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext));
const isTabular = (f?: PdfFile) => f?.docType === 'csv' || f?.docType === 'xlsx';

type DeletedPdf = {
  fileId: string;
  label: string;
  fileName: string;
  docType?: 'pdf' | 'csv' | 'xlsx';
  deletedAt: string;
  purgeAt: string;
};

const formatPurgeDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

type ShareLink = {
  slug: string;
  label: string;
  url: string;
  requireLogin?: boolean;
  pendingCount?: number;
};

export default function PdfPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLabel, setPdfLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');

  const [uploadedPdfs, setUploadedPdfs] = useState<PdfFile[]>([]);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [deletingPdfId, setDeletingPdfId] = useState<string | null>(null);
  const [deletedPdfs, setDeletedPdfs] = useState<DeletedPdf[]>([]);
  const [restoringPdfId, setRestoringPdfId] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState(7);
  const [listNotice, setListNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const [pdfChatMessages, setPdfChatMessages] = useState<Message[]>([]);
  const [pdfChatInput, setPdfChatInput] = useState('');
  const [pdfChatLoading, setPdfChatLoading] = useState(false);
  const [pdfChatTypingText, setPdfChatTypingText] = useState('');
  const [pdfChatIsTyping, setPdfChatIsTyping] = useState(false);

  const [shareLinks, setShareLinks] = useState<Record<string, ShareLink>>({});
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  // "Require sign-in" switch per document, read when its share link is generated.
  const [requireLoginFor, setRequireLoginFor] = useState<Record<string, boolean>>({});
  const [accessDialog, setAccessDialog] = useState<{ slug: string; label: string } | null>(null);
  const [addDataFor, setAddDataFor] = useState<LibraryFile | null>(null);
  const [indexErrors, setIndexErrors] = useState<Record<string, string>>({});
  const indexingRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [baseUrl, setBaseUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfChatBottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  // 1. Auto-scroll when content changes
  useEffect(() => {
    if (autoScroll) {
      pdfChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pdfChatMessages, pdfChatTypingText, pdfChatIsTyping, autoScroll]);

  // 2. Detect manual scroll up/down
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 3. Re-enable auto-scroll when new generation starts
  useEffect(() => {
    if (pdfChatLoading) setAutoScroll(true);
  }, [pdfChatLoading]);

  // ── Fetch PDFs on mount + when user navigates back ──────────────────────────
  const fetchPdfs = async () => {
    try {
      const res = await fetch('/api/ingest/pdf');
      if (!res.ok) return;
      const data = await res.json();
      if (data.files) setUploadedPdfs(data.files);
      if (Array.isArray(data.deletedFiles)) setDeletedPdfs(data.deletedFiles);
      if (typeof data.retentionDays === 'number') setRetentionDays(data.retentionDays);
    } catch {
      // silent fail
    }
  };

  // Works through a catalog's rows that still need their meaning-search embedding, one server slice at a time.
  // Safe to call repeatedly: one loop per document, and it resumes on the next page load if the tab closes.
  const runIndexing = useCallback(async (fileId: string) => {
    if (indexingRef.current.has(fileId)) return;
    indexingRef.current.add(fileId);
    setIndexErrors(prev => { const next = { ...prev }; delete next[fileId]; return next; });
    try {
      while (mountedRef.current) {
        const res = await fetch('/api/ingest/pdf/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setIndexErrors(prev => ({ ...prev, [fileId]: data.error || 'Indexing paused.' }));
          break;
        }
        setUploadedPdfs(prev => prev.map(f => f.fileId === fileId ? { ...f, pendingRows: data.remaining, rowVectors: data.rowVectors } : f));
        if (data.remaining === 0) break;
        if (data.retryAfterMs) await new Promise(resolve => setTimeout(resolve, data.retryAfterMs));
      }
    } catch {
      setIndexErrors(prev => ({ ...prev, [fileId]: 'Indexing paused. Check your connection.' }));
    } finally {
      indexingRef.current.delete(fileId);
    }
  }, []);

  useEffect(() => {
    for (const f of uploadedPdfs) {
      if (isTabular(f) && (f.rowVectors === 'indexing' || (f.pendingRows ?? 0) > 0) && !indexErrors[f.fileId]) {
        runIndexing(f.fileId);
      }
    }
  }, [uploadedPdfs, runIndexing, indexErrors]);

  const fetchShareLinks = async () => {
    try {
      const res = await fetch('/api/pdf-links');
      if (!res.ok) return;
      const data = await res.json();
      const origin = window.location.origin;
      const byFile: Record<string, ShareLink> = {};
      // Links arrive newest first; keep the newest per document.
      for (const l of data.links ?? []) {
        if (byFile[l.fileId]) continue;
        byFile[l.fileId] = {
          slug: l.slug,
          label: l.label ?? '',
          url: `${origin}/pdf-chat/${l.slug}`,
          requireLogin: l.requireLogin === true,
          pendingCount: l.pendingCount ?? 0,
        };
      }
      setShareLinks(byFile);
    } catch {
      // silent fail: links can still be generated
    }
  };

  useEffect(() => {
    setBaseUrl(window.location.origin);
    fetchPdfs();
    fetchShareLinks();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPdfs();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setUploadError('');
    setUploadProgress('Processing file...');
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      if (pdfLabel.trim()) formData.append('label', pdfLabel.trim());

      const res = await fetch('/api/ingest/pdf', {
        method: 'POST',
        body: formData,
      });

      const raw = await res.text();

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(raw || `Upload failed with status ${res.status}`);
      }

      if (!res.ok || data.error) {
        setUploadError(data.error || `Upload failed with status ${res.status}`);
        setUploadProgress('');
        return;
      }

      // FIX: response field is chunkCount (not chunks)
      setUploadProgress(data.rowCount != null
        ? `✅ Done! ${Number(data.rowCount).toLocaleString('en-US')} rows indexed.`
        : `✅ Done! ${data.chunkCount} chunks embedded.`);

      await fetchPdfs();

      setSelectedPdfId(data.fileId);
      setPdfChatMessages([]);
      setPdfFile(null);
      setPdfLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadProgress(''), 4000);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Unknown error');
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  // Deleting is a soft delete: the document and its share links stop working now and can be restored
  // from "Recently deleted" until the server purges them.
  const deletePdf = async (fileId: string) => {
    const doc = uploadedPdfs.find(f => f.fileId === fileId);
    setDeletingPdfId(fileId);
    setListNotice(null);
    try {
      const res = await fetch(`/api/ingest/pdf?fileId=${encodeURIComponent(fileId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setListNotice({ tone: 'error', text: data.error || 'Could not delete this document. Please try again.' });
        return;
      }
      setListNotice({
        tone: 'info',
        text: `"${doc?.label || doc?.fileName || 'Document'}" was deleted and its share links no longer work. You can restore it for ${retentionDays} days.`,
      });
      setUploadedPdfs(prev => prev.filter(f => f.fileId !== fileId));
      fetchPdfs();
      if (selectedPdfId === fileId) {
        setSelectedPdfId(null);
        setPdfChatMessages([]);
      }
      setShareLinks(prev => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    } finally {
      setDeletingPdfId(null);
    }
  };

  const restorePdf = async (fileId: string) => {
    setRestoringPdfId(fileId);
    setListNotice(null);
    try {
      const res = await fetch('/api/ingest/pdf/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListNotice({ tone: 'error', text: data.error || 'Could not restore this document. Please try again.' });
        if (res.status === 404) fetchPdfs();
        return;
      }
      setListNotice({ tone: 'info', text: 'Document restored. Its share links work again.' });
      await fetchPdfs();
    } catch {
      setListNotice({ tone: 'error', text: 'Could not restore this document. Check your connection and try again.' });
    } finally {
      setRestoringPdfId(null);
    }
  };

  // ── Chat ────────────────────────────────────────────────────────────────────
  const sendPdfChatMessage = async () => {
    const userText = pdfChatInput.trim();
    if (!userText || pdfChatLoading || pdfChatIsTyping) return;

    const newMessages: Message[] = [...pdfChatMessages, { role: 'user', content: userText }];
    setPdfChatMessages(newMessages);
    setPdfChatInput('');
    setPdfChatLoading(true);
    setAutoScroll(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch('/api/chat/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          fileId: selectedPdfId ?? undefined,
        }),
        signal: controller.signal,  // ← attach abort signal
      });

      const data = await res.json();
      setPdfChatLoading(false);
      setPdfChatIsTyping(true);

      const fullResponse: string = data.answer
        ?? data.text
        ?? (data.error ? `⚠️ ${data.error}` : `⚠️ No response (status ${res.status}).`);
      let i = 0;

      const interval = setInterval(() => {
        // Check if aborted mid-typing
        if (controller.signal.aborted) {
          clearInterval(interval);
          // Save whatever was typed so far as the final message
          setPdfChatMessages(prev => [
            ...prev,
            { role: 'assistant', content: fullResponse.slice(0, i) + ' ▋' },
          ]);
          setPdfChatTypingText('');
          setPdfChatIsTyping(false);
          return;
        }

        setPdfChatTypingText(fullResponse.slice(0, i + 1));
        i++;

        if (i >= fullResponse.length) {
          clearInterval(interval);
          setPdfChatMessages([...newMessages, { role: 'assistant', content: fullResponse }]);
          setPdfChatTypingText('');
          setPdfChatIsTyping(false);
          setAbortController(null);
        }
      }, 12);

    } catch (err: unknown) {
      setPdfChatLoading(false);
      setPdfChatIsTyping(false);
      setAbortController(null);

      // Don't show error if user intentionally stopped
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setPdfChatMessages([...newMessages, { role: 'assistant', content: '⚠️ Error: ' + msg }]);
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const generateShareLink = async (fileId: string) => {
    setGeneratingLink(fileId);
    try {
      const pdf = uploadedPdfs.find(f => f.fileId === fileId);
      // FIX: correct API route is /api/pdf-links (not /api/pdf-share)
      const res = await fetch('/api/pdf-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          filename: pdf?.fileName || 'document.pdf',
          label: pdf?.label || pdf?.fileName || 'PDF Chat',
          requireLogin: requireLoginFor[fileId] === true,
        }),
      });
      const data = await res.json();
      if (data.slug) {
        // FIX: correct public path is /pdf-chat/[slug]
        const shareUrl = `${baseUrl}/pdf-chat/${data.slug}`;
        setShareLinks(prev => ({
          ...prev,
          [fileId]: { slug: data.slug, label: pdf?.label ?? '', url: shareUrl, requireLogin: data.requireLogin === true, pendingCount: 0 },
        }));
      }
    } finally {
      setGeneratingLink(null);
    }
  };

  const onPendingChange = useCallback((slug: string, pending: number) => {
    setShareLinks(prev => {
      const entry = Object.entries(prev).find(([, l]) => l.slug === slug);
      if (!entry || entry[1].pendingCount === pending) return prev;
      return { ...prev, [entry[0]]: { ...entry[1], pendingCount: pending } };
    });
  }, []);

  const copyShareLink = (fileId: string) => {
    const link = shareLinks[fileId];
    if (!link) return;
    navigator.clipboard.writeText(link.url);
    setCopiedLinkId(fileId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const selectedPdf = uploadedPdfs.find(f => f.fileId === selectedPdfId);

  // ADD this just before: return (
  const mdComponents = {
    h2: ({ children }: any) => (
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#36f4a4', margin: '12px 0 6px 0' }}>{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a8f0d0', margin: '10px 0 4px 0' }}>{children}</h3>
    ),
    p: ({ children }: any) => (
      <p style={{ margin: '4px 0', lineHeight: 1.7 }}>{children}</p>
    ),
    strong: ({ children }: any) => (
      <strong style={{ color: '#fff', fontWeight: 700 }}>{children}</strong>
    ),
    ul: ({ children }: any) => (
      <ul style={{ paddingLeft: 18, margin: '6px 0' }}>{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol style={{ paddingLeft: 18, margin: '6px 0' }}>{children}</ol>
    ),
    li: ({ children }: any) => (
      <li style={{ margin: '3px 0', lineHeight: 1.6 }}>{children}</li>
    ),
    table: ({ children }: any) => (
      <div style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead style={{ background: '#36f4a420' }}>{children}</thead>
    ),
    th: ({ children }: any) => (
      <th style={{ border: '1px solid #36f4a440', padding: '6px 10px', color: '#36f4a4', fontWeight: 600, textAlign: 'left' }}>{children}</th>
    ),
    td: ({ children }: any) => (
      <td style={{ border: '1px solid #2a2d35', padding: '6px 10px', color: '#e8eaed' }}>{children}</td>
    ),
    blockquote: ({ children }: any) => (
      <blockquote style={{ borderLeft: '2px solid #3a3d45', paddingLeft: 12, margin: '8px 0', color: 'var(--nb-text-secondary)' }}>{children}</blockquote>
    ),
    code: ({ children }: any) => (
      <code style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 4, padding: '1px 6px', fontSize: 12, color: '#36f4a4', fontFamily: 'monospace' }}>{children}</code>
    ),
    hr: () => (
      <hr style={{ border: 'none', borderTop: '1px solid #2a2d35', margin: '10px 0' }} />
    ),
  };

  const stopResponse = () => {
    abortController?.abort();
    setAbortController(null);
    setPdfChatLoading(false);
  };
  return (
    <div className="py-2 md:py-6 lg:px-6 xl:px-10" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .pdf-card:hover { border-color: #36f4a440 !important; background: #0d1a16 !important; }
        .del-btn:hover svg { color: #ef4444 !important; }
        .nb-focus:focus-visible, .nb-focus-within:focus-within { outline: 2px solid #36f4a4; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .nb-motion, .nb-motion * { animation: none !important; } }
        @keyframes typingPulse { 0%,60%,100%{opacity:.35} 30%{opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <FileText className="h-7 w-7 text-[#36f4a4]" />
          <h1 style={{ fontSize: 32, fontWeight: 400, color: '#fff', letterSpacing: '-0.8px', margin: 0 }}>
            PDF RAG
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)', margin: 0 }}>
          Upload PDFs, CSV or Excel files, test the AI chat, then share a public link with anyone.
        </p>
      </div>

      {/* Side by side only once the chat column has room beside the dashboard sidebar; stacked below that. */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]" style={{ gap: 20, alignItems: 'start' }}>

        {/* LEFT — Upload + PDF list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.2s ease' }}>

          {/* Upload card */}
          <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload className="h-4 w-4 text-[#36f4a4]" /> Upload document
            </div>

            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              className="nb-focus"
              aria-label={pdfFile ? `Selected file: ${pdfFile.name}. Choose a different file` : 'Choose a PDF, CSV or Excel file to upload'}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); }
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && isAcceptedFile(f)) { setPdfFile(f); setUploadError(''); }
                else if (f) setUploadError('Only PDF, CSV and Excel (.xlsx) files are supported.');
              }}
              style={{
                border: `2px dashed ${pdfFile ? '#36f4a4' : '#2a2d35'}`,
                borderRadius: 10, padding: '20px 12px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
                background: pdfFile ? '#0d2420' : 'transparent',
              }}
            >
              <FileText className="h-7 w-7 mx-auto mb-2" style={{ color: pdfFile ? '#36f4a4' : 'var(--nb-text-tertiary)' }} />
              {pdfFile ? (
                <>
                  <div style={{ fontSize: 13, color: '#36f4a4', fontWeight: 500, wordBreak: 'break-all' }}>{pdfFile.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--nb-text-secondary)', marginTop: 3 }}>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB · click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--nb-text-secondary)' }}>Drop a PDF, CSV or Excel file</div>
                  <div style={{ fontSize: 11, color: 'var(--nb-text-tertiary)', marginTop: 3 }}>Max 10 MB · PDF, CSV, XLSX</div>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} />
            </div>

            <input value={pdfLabel} onChange={e => setPdfLabel(e.target.value)} placeholder="Label (optional)" aria-label="Document label (optional)" maxLength={120} className="nb-focus"
              style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />

            <button
              type="button"
              onClick={handlePdfUpload}
              disabled={!pdfFile || uploading}
              style={{
                background: !pdfFile || uploading ? '#2a2d35' : '#36f4a4',
                color: !pdfFile || uploading ? 'var(--nb-text-secondary)' : '#000',
                border: 'none',
                borderRadius: 9999,
                padding: '10px 0',
                fontWeight: 600,
                fontSize: 13,
                cursor: !pdfFile || uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {uploading
                ? <><span style={{ width: 14, height: 14, border: '2px solid #7d8187', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Uploading...</>
                : 'Embed & Store'}
            </button>

            {uploadProgress && (
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: uploadProgress.startsWith('✅') ? '#36f4a4' : 'var(--nb-text-secondary)', padding: '8px 10px', background: '#0a0a0a', borderRadius: 8, border: '1px solid #2a2d35' }}>
                {uploadProgress}
              </div>
            )}
            {uploadError && (
              <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 10px', background: '#1a0a0a', borderRadius: 8, border: '1px solid #ef444440' }}>
                ❌ {uploadError}
              </div>
            )}
          </div>

          {/* PDF list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--nb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Your documents ({uploadedPdfs.length})
            </div>

            <div role="status" aria-live="polite">
              {listNotice && (
                <div style={{ fontSize: 12, lineHeight: 1.5, padding: '8px 10px', borderRadius: 8,
                  color: listNotice.tone === 'error' ? '#ef4444' : 'var(--nb-text-secondary)',
                  background: listNotice.tone === 'error' ? '#1a0a0a' : '#0a0a0a',
                  border: `1px solid ${listNotice.tone === 'error' ? '#ef444440' : '#2a2d35'}` }}>
                  {listNotice.text}
                </div>
              )}
            </div>

            {uploadedPdfs.length === 0 ? (
              <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 12, padding: '28px 16px', textAlign: 'center', color: 'var(--nb-text-tertiary)', fontSize: 13 }}>
                No documents yet
              </div>
            ) : (
              uploadedPdfs.map(pdf => (
                <div key={pdf.fileId} className="pdf-card"
                  onClick={() => { setSelectedPdfId(pdf.fileId); setPdfChatMessages([]); }}
                  style={{ background: selectedPdfId === pdf.fileId ? '#0d2420' : '#1f2228', border: `1px solid ${selectedPdfId === pdf.fileId ? '#36f4a4' : '#2a2d35'}`, borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all 0.15s' }}>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <button type="button" className="nb-focus"
                      aria-pressed={selectedPdfId === pdf.fileId}
                      aria-label={`Chat with ${pdf.label || pdf.fileName}`}
                      onClick={e => { e.stopPropagation(); setSelectedPdfId(pdf.fileId); setPdfChatMessages([]); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, background: 'transparent', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', borderRadius: 6 }}>
                      {isTabular(pdf)
                        ? <FileSpreadsheet className="h-4 w-4 flex-shrink-0" style={{ color: selectedPdfId === pdf.fileId ? '#36f4a4' : 'var(--nb-text-secondary)' }} />
                        : <FileText className="h-4 w-4 flex-shrink-0" style={{ color: selectedPdfId === pdf.fileId ? '#36f4a4' : 'var(--nb-text-secondary)' }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.label || pdf.fileName}</div>
                        <div style={{ fontSize: 11, color: 'var(--nb-text-secondary)', marginTop: 2 }}>{isTabular(pdf)
                          ? `${(pdf.rowCount ?? 0).toLocaleString('en-US')} rows · ${pdf.columnCount ?? 0} columns`
                          : `${pdf.chunkCount} chunks`}</div>
                      </div>
                    </button>
                    <button type="button" className="del-btn nb-focus" aria-label={`Delete ${pdf.label || pdf.fileName}`} onClick={e => { e.stopPropagation(); deletePdf(pdf.fileId); }} disabled={deletingPdfId === pdf.fileId}
                      style={{ background: 'transparent', border: 'none', color: 'var(--nb-text-tertiary)', cursor: 'pointer', padding: 15, margin: -11, flexShrink: 0 }}>
                      {deletingPdfId === pdf.fileId
                        ? <span style={{ width: 12, height: 12, border: '1.5px solid #7d8187', borderTopColor: '#ef4444', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {(() => {
                    const sheetDoc = isTabular(pdf);
                    const used = pdf.additionsUsed ?? 0;
                    const max = pdf.additionsLimit ?? 1;
                    const atLimit = used >= max;
                    const total = pdf.rowCount ?? 0;
                    const done = Math.max(0, total - (pdf.pendingRows ?? 0));
                    const error = indexErrors[pdf.fileId];
                    const indexing = pdf.rowVectors === 'indexing' || (pdf.pendingRows ?? 0) > 0;
                    return (
                      <div onClick={e => e.stopPropagation()}
                        style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <span role="status" aria-live="polite" style={{ fontSize: 11, color: error ? '#eab308' : 'var(--nb-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {!sheetDoc ? (
                            atLimit ? 'Limit reached · upgrade for more' : null
                          ) : error ? (
                            <>
                              {error}
                              <button type="button" className="nb-focus" onClick={() => { setIndexErrors(prev => { const n = { ...prev }; delete n[pdf.fileId]; return n; }); runIndexing(pdf.fileId); }}
                                style={{ background: 'none', border: 'none', color: '#36f4a4', fontSize: 11, cursor: 'pointer', padding: '4px 2px', textDecoration: 'underline' }}>
                                Retry
                              </button>
                            </>
                          ) : indexing ? (
                            `Indexing for smart search: ${done.toLocaleString('en-US')} / ${total.toLocaleString('en-US')}`
                          ) : pdf.rowVectors === 'ready' ? (
                            atLimit ? 'Smart search ready · file limit reached' : 'Smart search ready'
                          ) : (
                            <button type="button" className="nb-focus" onClick={() => runIndexing(pdf.fileId)}
                              style={{ background: 'none', border: 'none', color: '#36f4a4', fontSize: 11, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
                              Enable smart search
                            </button>
                          )}
                        </span>
                        <button type="button" className="nb-focus" disabled={atLimit}
                          title={atLimit ? `Your plan allows ${max} additional file${max === 1 ? '' : 's'} per document` : undefined}
                          aria-label={`Add more data, ${used} of ${max} additional files used`}
                          onClick={() => setAddDataFor({
                            fileId: pdf.fileId, label: pdf.label, fileName: pdf.fileName, docType: pdf.docType ?? 'pdf',
                            rowCount: pdf.rowCount, idColumn: pdf.idColumn ?? null, columns: pdf.columns,
                            additionsUsed: used, additionsLimit: max,
                          })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 10px', borderRadius: 9999, background: 'transparent', border: '1px solid #2a2d35', color: 'var(--nb-text-secondary)', fontSize: 11, cursor: atLimit ? 'not-allowed' : 'pointer', opacity: atLimit ? 0.5 : 1 }}>
                          <Upload aria-hidden="true" className="h-3 w-3" /> Add more data ({used} of {max})
                        </button>
                      </div>
                    );
                  })()}

                  {/* Share row */}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2a2d35' }} onClick={e => e.stopPropagation()}>
                    {shareLinks[pdf.fileId] ? (
                      <>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, fontSize: 11, color: '#36f4a4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                          {shareLinks[pdf.fileId].url}
                        </div>
                        <button type="button" className="nb-focus" onClick={() => copyShareLink(pdf.fileId)} title="Copy link" aria-label={copiedLinkId === pdf.fileId ? 'Link copied' : 'Copy share link'}
                          style={{ background: 'transparent', border: 'none', color: copiedLinkId === pdf.fileId ? '#36f4a4' : 'var(--nb-text-secondary)', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                          {copiedLinkId === pdf.fileId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a href={shareLinks[pdf.fileId].url} target="_blank" rel="noopener noreferrer" aria-label="Open share link in a new tab" className="nb-focus" style={{ color: 'var(--nb-text-secondary)', display: 'flex' }}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      {shareLinks[pdf.fileId].requireLogin && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--nb-text-secondary)' }}>
                            <Lock aria-hidden="true" className="h-3 w-3" /> Sign-in required
                          </span>
                          <button type="button" className="nb-focus"
                            onClick={() => setAccessDialog({ slug: shareLinks[pdf.fileId].slug, label: pdf.label || pdf.fileName })}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 10px', borderRadius: 9999, background: 'transparent', border: '1px solid #2a2d35', color: 'var(--nb-text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                            <Users aria-hidden="true" className="h-3 w-3" />
                            Manage access
                            {(shareLinks[pdf.fileId].pendingCount ?? 0) > 0 && (
                              <span style={{ background: '#eab308', color: '#000', borderRadius: 9999, padding: '0 6px', fontSize: 10, fontWeight: 600, lineHeight: '16px' }}>
                                {shareLinks[pdf.fileId].pendingCount} pending
                              </span>
                            )}
                          </button>
                        </div>
                      )}
                      </>
                    ) : (
                      <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <span id={`require-login-${pdf.fileId}`} style={{ fontSize: 11, color: 'var(--nb-text-secondary)' }}>
                          Require sign-in
                        </span>
                        <button type="button" role="switch" className="nb-focus"
                          aria-checked={requireLoginFor[pdf.fileId] === true}
                          aria-labelledby={`require-login-${pdf.fileId}`}
                          onClick={() => setRequireLoginFor(prev => ({ ...prev, [pdf.fileId]: !prev[pdf.fileId] }))}
                          style={{ position: 'relative', width: 36, height: 20, borderRadius: 9999, border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                            background: requireLoginFor[pdf.fileId] ? '#36f4a4' : '#3a3d45', transition: 'background 0.15s' }}>
                          <span aria-hidden="true" style={{ position: 'absolute', top: 2, left: requireLoginFor[pdf.fileId] ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                        </button>
                      </div>
                      <button onClick={() => generateShareLink(pdf.fileId)} disabled={generatingLink === pdf.fileId}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #2a2d35', borderRadius: 9999, padding: '4px 10px', color: 'var(--nb-text-secondary)', fontSize: 11, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                        {generatingLink === pdf.fileId
                          ? <><span style={{ width: 10, height: 10, border: '1.5px solid #7d8187', borderTopColor: '#36f4a4', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Generating...</>
                          : <><Link2 className="h-3 w-3" /> Generate Share Link</>}
                      </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recently deleted: restorable until the server purges them */}
          {deletedPdfs.length > 0 && (
            <section aria-labelledby="recently-deleted-heading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 id="recently-deleted-heading" style={{ fontSize: 11, fontWeight: 400, margin: 0, color: 'var(--nb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recently deleted ({deletedPdfs.length})
              </h2>
              <p style={{ fontSize: 12, color: 'var(--nb-text-tertiary)', margin: 0, lineHeight: 1.5 }}>
                Share links are off. Each document is permanently removed on the date shown.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {deletedPdfs.map(pdf => {
                  const name = pdf.label || pdf.fileName;
                  const busy = restoringPdfId === pdf.fileId;
                  return (
                    <li key={pdf.fileId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px dashed #2a2d35' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--nb-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: 11, color: 'var(--nb-text-tertiary)', marginTop: 2 }}>
                          Removed permanently on <time dateTime={pdf.purgeAt}>{formatPurgeDate(pdf.purgeAt)}</time>
                        </div>
                      </div>
                      <button type="button" className="nb-focus" onClick={() => restorePdf(pdf.fileId)}
                        disabled={busy}
                        aria-label={`Restore ${name}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 36, padding: '6px 12px', borderRadius: 9999, background: 'transparent', border: '1px solid #36f4a4', color: '#36f4a4', fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                        {busy ? 'Restoring…' : 'Restore'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <AddDataDialog
          file={addDataFor}
          onClose={() => setAddDataFor(null)}
          onAdded={() => { fetchPdfs(); }}
        />

        <LinkAccessDialog
          slug={accessDialog?.slug ?? null}
          label={accessDialog?.label ?? ''}
          onClose={() => setAccessDialog(null)}
          onPendingChange={onPendingChange}
        />

        {/* RIGHT — Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeIn 0.25s ease' }}>
          <div style={{ fontSize: 11, color: 'var(--nb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Test Chat{selectedPdf ? ` — ${selectedPdf.label || selectedPdf.fileName}` : ''}
          </div>

          <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'min(560px, calc(100dvh - 96px))', minHeight: 380 }}>
            {/* Chat header */}
            <div style={{ background: '#161a1f', borderBottom: '1px solid #2a2d35', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#36f4a420', border: '1px solid #36f4a430', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText className="h-4 w-4 text-[#36f4a4]" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedPdf ? (selectedPdf.label || selectedPdf.fileName) : 'Document Assistant'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--nb-text-secondary)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedPdfId ? '#36f4a4' : '#4a4e56' }} />
                  {selectedPdfId ? 'Ready' : 'No document selected'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="nb-motion"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-busy={pdfChatLoading || pdfChatIsTyping}
              aria-label="Document chat"
              style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}
            >              {!selectedPdfId ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--nb-text-tertiary)' }}>
                <FileText className="h-12 w-12" style={{ opacity: 0.3 }} />
                <div style={{ fontSize: 14, textAlign: 'center' }}>Select a document from the left<br />to start chatting with it</div>
              </div>
            ) : pdfChatMessages.length === 0 && !pdfChatLoading && !pdfChatIsTyping ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--nb-text-tertiary)' }}>
                <div style={{ fontSize: 13 }}>Ask anything about this document...</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                  {['Summarize this document', 'What are the key points?', 'List the main topics'].map(s => (
                    <button key={s} type="button" className="nb-focus" onClick={() => setPdfChatInput(s)}
                      style={{ background: '#2a2d35', border: '1px solid #3a3d45', borderRadius: 9999, padding: '6px 14px', color: 'var(--nb-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {pdfChatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? '#36f4a4' : '#0a0a0a', color: msg.role === 'user' ? '#000' : '#e8eaed', fontSize: 13, lineHeight: 1.6, border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none' }}>
                      {msg.role === 'user' ? msg.content : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.content}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {pdfChatLoading && !pdfChatIsTyping && (
                  <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#0a0a0a', border: '1px solid #2a2d35', display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(j => <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7d8187', display: 'inline-block', animation: `typingPulse 1.2s infinite ${j * 0.2}s` }} />)}
                    </div>
                  </div>
                )}
                {pdfChatIsTyping && (
                  <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#0a0a0a', color: '#e8eaed', fontSize: 13, lineHeight: 1.6, border: '1px solid #2a2d35' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{pdfChatTypingText}</ReactMarkdown>
                      <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#36f4a4', marginLeft: 3, verticalAlign: 'text-bottom', animation: 'cursorBlink 0.7s infinite' }} />
                    </div>
                  </div>
                )}
              </>
            )}
              <div ref={pdfChatBottomRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid #2a2d35', padding: 16, display: 'flex', gap: 10 }}>
              <input value={pdfChatInput} onChange={e => setPdfChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendPdfChatMessage()}
                aria-label="Ask about this document" className="nb-focus"
                placeholder={selectedPdfId ? 'Ask about this document...' : 'Select a document first'}
                disabled={!selectedPdfId || pdfChatLoading}
                style={{ flex: 1, background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 13, outline: 'none' }} />
              {pdfChatLoading || pdfChatIsTyping ? (
                <button
                  onClick={stopResponse}
                  style={{
                    background: '#1f2228',
                    color: '#ef4444',
                    border: '1px solid #ef444460',
                    borderRadius: 10,
                    padding: '11px 22px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    width: 10,
                    height: 10,
                    background: '#ef4444',
                    borderRadius: 2,
                    display: 'inline-block',
                  }} />
                  Stop
                </button>
              ) : (
                <button
                  onClick={sendPdfChatMessage}
                  disabled={!selectedPdfId || !pdfChatInput.trim()}
                  style={{
                    background: '#36f4a4',
                    color: '#000',
                    border: 'none',
                    borderRadius: 10,
                    padding: '11px 22px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: !selectedPdfId || !pdfChatInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: !selectedPdfId || !pdfChatInput.trim() ? 0.4 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  Send
                </button>
              )}
            </div>
          </div>

          {/* How-it-works strip */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {[
              ['📤 Upload', 'PDFs split into ~220-word chunks; CSV/Excel rows stored as a table'],
              ['🧠 Embed', 'Gemini vectors → MongoDB Atlas'],
              ['💬 Chat', 'Relevant chunks or table queries → Groq answers'],
              ['🔗 Share', 'Public /pdf-chat/[slug] URL'],
            ].map(([title, desc]) => (
              <div key={title} style={{ flex: 1, minWidth: 120, background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: '#36f4a4', fontWeight: 600, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--nb-text-secondary)', lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
