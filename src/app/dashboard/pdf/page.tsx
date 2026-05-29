'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileText, Upload, Trash2, Link2, Copy, Check, ExternalLink,
} from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

type PdfFile = {
  fileId: string;
  label: string;
  uploadedAt: string;
  chunkCount: number;
  fileName: string;
};

type ShareLink = {
  slug: string;
  label: string;
  url: string;
};

export default function PdfPage() {
  // upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLabel, setPdfLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');

  // list state
  const [uploadedPdfs, setUploadedPdfs] = useState<PdfFile[]>([]);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [deletingPdfId, setDeletingPdfId] = useState<string | null>(null);

  // chat state
  const [pdfChatMessages, setPdfChatMessages] = useState<Message[]>([]);
  const [pdfChatInput, setPdfChatInput] = useState('');
  const [pdfChatLoading, setPdfChatLoading] = useState(false);
  const [pdfChatTypingText, setPdfChatTypingText] = useState('');
  const [pdfChatIsTyping, setPdfChatIsTyping] = useState(false);

  // share state
  const [shareLinks, setShareLinks] = useState<Record<string, ShareLink>>({});
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfChatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
    fetch('/api/ingest/pdf')
      .then(r => r.json())
      .then(d => { if (d.files) setUploadedPdfs(d.files); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    pdfChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pdfChatMessages, pdfChatIsTyping]);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setUploadError('');
    setUploadProgress('Parsing PDF...');
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      if (pdfLabel.trim()) formData.append('label', pdfLabel.trim());

      const res = await fetch('/api/ingest/pdf', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        setUploadError(data.error || 'Upload failed');
        return;
      }

      setUploadProgress(`✅ Done! ${data.chunkCount} chunks embedded.`);

      const listRes = await fetch('/api/ingest/pdf');
      const listData = await listRes.json();
      if (listData.files) setUploadedPdfs(listData.files);

      setSelectedPdfId(data.fileId);
      setPdfChatMessages([]);
      setPdfFile(null);
      setPdfLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadProgress(''), 4000);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deletePdf = async (fileId: string) => {
    setDeletingPdfId(fileId);
    try {
      await fetch(`/api/ingest/pdf?fileId=${fileId}`, { method: 'DELETE' });
      setUploadedPdfs(prev => prev.filter(f => f.fileId !== fileId));
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

  // ── Chat ────────────────────────────────────────────────────────────────────
  const sendPdfChatMessage = async () => {
    const userText = pdfChatInput.trim();
    if (!userText || pdfChatLoading || pdfChatIsTyping) return;

    const newMessages: Message[] = [...pdfChatMessages, { role: 'user', content: userText }];
    setPdfChatMessages(newMessages);
    setPdfChatInput('');
    setPdfChatLoading(true);

    try {
      const res = await fetch('/api/chat/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          fileId: selectedPdfId ?? undefined,
          history: newMessages.slice(0, -1),
        }),
      });
      const data = await res.json();
      setPdfChatLoading(false);
      setPdfChatIsTyping(true);

      const fullResponse: string = data.text ?? data.answer ?? '';
      let i = 0;
      const interval = setInterval(() => {
        setPdfChatTypingText(fullResponse.slice(0, i + 1));
        i++;
        if (i >= fullResponse.length) {
          clearInterval(interval);
          setPdfChatMessages([...newMessages, { role: 'assistant', content: fullResponse }]);
          setPdfChatTypingText('');
          setPdfChatIsTyping(false);
        }
      }, 12);
    } catch (err: unknown) {
      setPdfChatLoading(false);
      setPdfChatIsTyping(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setPdfChatMessages([...newMessages, { role: 'assistant', content: '⚠️ Error: ' + msg }]);
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const generateShareLink = async (fileId: string) => {
    setGeneratingLink(fileId);
    try {
      const pdf = uploadedPdfs.find(f => f.fileId === fileId);
      const res = await fetch('/api/pdf-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, label: pdf?.label || pdf?.fileName || 'PDF Chat' }),
      });
      const data = await res.json();
      if (data.slug) {
        const shareUrl = `${baseUrl}/pdf/${data.slug}`;
        setShareLinks(prev => ({
          ...prev,
          [fileId]: { slug: data.slug, label: pdf?.label ?? '', url: shareUrl },
        }));
      }
    } finally {
      setGeneratingLink(null);
    }
  };

  const copyShareLink = (fileId: string) => {
    const link = shareLinks[fileId];
    if (!link) return;
    navigator.clipboard.writeText(link.url);
    setCopiedLinkId(fileId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const selectedPdf = uploadedPdfs.find(f => f.fileId === selectedPdfId);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .pdf-card:hover { border-color: #36f4a440 !important; background: #0d1a16 !important; }
        .del-btn:hover svg { color: #ef4444 !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <FileText className="h-7 w-7 text-[#36f4a4]" />
          <h1 style={{ fontSize: 32, fontWeight: 400, color: '#fff', letterSpacing: '-0.8px', margin: 0 }}>
            PDF RAG
          </h1>
        </div>
        <p style={{ fontSize: 14, color: '#7d8187', margin: 0 }}>
          Upload PDFs, test the AI chat, then share a public link with anyone.
        </p>
      </div>

      {/* ── Three-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.2s ease' }}>

          {/* Upload card */}
          <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload className="h-4 w-4 text-[#36f4a4]" /> Upload PDF
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f?.type === 'application/pdf') setPdfFile(f);
              }}
              style={{
                border: `2px dashed ${pdfFile ? '#36f4a4' : '#2a2d35'}`,
                borderRadius: 10, padding: '20px 12px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
                background: pdfFile ? '#0d2420' : 'transparent',
              }}
            >
              <FileText
                className="h-7 w-7 mx-auto mb-2"
                style={{ color: pdfFile ? '#36f4a4' : '#4a4e56' }}
              />
              {pdfFile ? (
                <>
                  <div style={{ fontSize: 13, color: '#36f4a4', fontWeight: 500, wordBreak: 'break-all' }}>
                    {pdfFile.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#7d8187', marginTop: 3 }}>
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB · click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#7d8187' }}>Drop PDF here or click</div>
                  <div style={{ fontSize: 11, color: '#4a4e56', marginTop: 3 }}>Max 10 MB · PDF only</div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }}
              />
            </div>

            <input
              value={pdfLabel}
              onChange={e => setPdfLabel(e.target.value)}
              placeholder="Label (optional)"
              style={{
                background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 8,
                padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', width: '100%',
                boxSizing: 'border-box',
              }}
            />

            <button
              onClick={handlePdfUpload}
              disabled={!pdfFile || uploading}
              style={{
                background: !pdfFile || uploading ? '#2a2d35' : '#36f4a4',
                color: !pdfFile || uploading ? '#7d8187' : '#000',
                border: 'none', borderRadius: 9999, padding: '10px 0',
                fontWeight: 600, fontSize: 13, cursor: !pdfFile || uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {uploading
                ? <><span style={{ width: 14, height: 14, border: '2px solid #7d8187', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Uploading...</>
                : 'Embed & Store'}
            </button>

            {uploadProgress && (
              <div style={{
                fontFamily: 'monospace', fontSize: 12,
                color: uploadProgress.startsWith('✅') ? '#36f4a4' : '#7d8187',
                padding: '8px 10px', background: '#0a0a0a', borderRadius: 8, border: '1px solid #2a2d35',
              }}>
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
            <div style={{ fontSize: 11, color: '#7d8187', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Your PDFs ({uploadedPdfs.length})
            </div>

            {uploadedPdfs.length === 0 ? (
              <div style={{
                background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 12,
                padding: '28px 16px', textAlign: 'center', color: '#4a4e56', fontSize: 13,
              }}>
                No PDFs yet
              </div>
            ) : (
              uploadedPdfs.map(pdf => (
                <div
                  key={pdf.fileId}
                  className="pdf-card"
                  onClick={() => { setSelectedPdfId(pdf.fileId); setPdfChatMessages([]); }}
                  style={{
                    background: selectedPdfId === pdf.fileId ? '#0d2420' : '#1f2228',
                    border: `1px solid ${selectedPdfId === pdf.fileId ? '#36f4a4' : '#2a2d35'}`,
                    borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <FileText
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: selectedPdfId === pdf.fileId ? '#36f4a4' : '#7d8187' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pdf.label || pdf.fileName}
                        </div>
                        <div style={{ fontSize: 11, color: '#7d8187', marginTop: 2 }}>
                          {pdf.chunkCount} chunks
                        </div>
                      </div>
                    </div>
                    <button
                      className="del-btn"
                      onClick={e => { e.stopPropagation(); deletePdf(pdf.fileId); }}
                      disabled={deletingPdfId === pdf.fileId}
                      style={{ background: 'transparent', border: 'none', color: '#4a4e56', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                    >
                      {deletingPdfId === pdf.fileId
                        ? <span style={{ width: 12, height: 12, border: '1.5px solid #7d8187', borderTopColor: '#ef4444', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Share row */}
                  <div
                    style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2a2d35' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {shareLinks[pdf.fileId] ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{
                          flex: 1, fontSize: 11, color: '#36f4a4', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace',
                        }}>
                          {shareLinks[pdf.fileId].url}
                        </div>
                        <button
                          onClick={() => copyShareLink(pdf.fileId)}
                          title="Copy link"
                          style={{ background: 'transparent', border: 'none', color: copiedLinkId === pdf.fileId ? '#36f4a4' : '#7d8187', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                        >
                          {copiedLinkId === pdf.fileId
                            ? <Check className="h-3.5 w-3.5" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a
                          href={shareLinks[pdf.fileId].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#7d8187', display: 'flex' }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateShareLink(pdf.fileId)}
                        disabled={generatingLink === pdf.fileId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'transparent', border: '1px solid #2a2d35',
                          borderRadius: 9999, padding: '4px 10px',
                          color: '#7d8187', fontSize: 11, cursor: 'pointer',
                          width: '100%', justifyContent: 'center',
                        }}
                      >
                        {generatingLink === pdf.fileId
                          ? <><span style={{ width: 10, height: 10, border: '1.5px solid #7d8187', borderTopColor: '#36f4a4', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Generating...</>
                          : <><Link2 className="h-3 w-3" /> Generate Share Link</>}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN — Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeIn 0.25s ease' }}>
          <div style={{ fontSize: 11, color: '#7d8187', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Test Chat{selectedPdf ? ` — ${selectedPdf.label || selectedPdf.fileName}` : ''}
          </div>

          <div style={{
            background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14,
            overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 560,
          }}>
            {/* Chat header */}
            <div style={{
              background: '#161a1f', borderBottom: '1px solid #2a2d35',
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: '#36f4a420', border: '1px solid #36f4a430',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText className="h-4 w-4 text-[#36f4a4]" />
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
                  {selectedPdf ? (selectedPdf.label || selectedPdf.fileName) : 'PDF Assistant'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7d8187' }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: selectedPdfId ? '#36f4a4' : '#4a4e56',
                  }} />
                  {selectedPdfId ? 'Ready' : 'No PDF selected'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '20px 20px 10px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {!selectedPdfId ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#4a4e56' }}>
                  <FileText className="h-12 w-12" style={{ opacity: 0.3 }} />
                  <div style={{ fontSize: 14, textAlign: 'center' }}>
                    Select a PDF from the left<br />to start chatting with it
                  </div>
                </div>
              ) : pdfChatMessages.length === 0 && !pdfChatLoading && !pdfChatIsTyping ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#4a4e56' }}>
                  <div style={{ fontSize: 13 }}>Ask anything about this PDF...</div>
                  {/* Suggestion chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                    {['Summarize this document', 'What are the key points?', 'List the main topics'].map(s => (
                      <button
                        key={s}
                        onClick={() => { setPdfChatInput(s); }}
                        style={{
                          background: '#2a2d35', border: '1px solid #3a3d45',
                          borderRadius: 9999, padding: '6px 14px', color: '#7d8187',
                          fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {pdfChatMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '78%', padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.role === 'user' ? '#36f4a4' : '#0a0a0a',
                        color: msg.role === 'user' ? '#000' : '#e8eaed',
                        fontSize: 13, lineHeight: 1.6,
                        border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {pdfChatLoading && !pdfChatIsTyping && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#0a0a0a', border: '1px solid #2a2d35', display: 'flex', gap: 4 }}>
                        {[0, 1, 2].map(j => (
                          <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7d8187', display: 'inline-block', animation: `typingBounce 1.2s infinite ${j * 0.2}s` }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {pdfChatIsTyping && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#0a0a0a', color: '#e8eaed', fontSize: 13, lineHeight: 1.6, border: '1px solid #2a2d35' }}>
                        {pdfChatTypingText}
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
              <input
                value={pdfChatInput}
                onChange={e => setPdfChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendPdfChatMessage()}
                placeholder={selectedPdfId ? 'Ask about the PDF...' : 'Select a PDF first'}
                disabled={!selectedPdfId || pdfChatLoading}
                style={{
                  flex: 1, background: '#0a0a0a', border: '1px solid #2a2d35',
                  borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={sendPdfChatMessage}
                disabled={!selectedPdfId || !pdfChatInput.trim() || pdfChatLoading}
                style={{
                  background: '#36f4a4', color: '#000', border: 'none',
                  borderRadius: 10, padding: '11px 22px', fontWeight: 600, fontSize: 13,
                  cursor: !selectedPdfId || pdfChatLoading ? 'not-allowed' : 'pointer',
                  opacity: !selectedPdfId || pdfChatLoading ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                Send
              </button>
            </div>
          </div>

          {/* How-it-works strip */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {[
              ['📤 Upload', 'PDF parsed into 300-word chunks'],
              ['🧠 Embed', 'Gemini vectors → Qdrant'],
              ['💬 Chat', 'Top-6 chunks retrieved → Groq answers'],
              ['🔗 Share', 'Public /pdf/[slug] URL'],
            ].map(([title, desc]) => (
              <div key={title} style={{
                flex: 1, minWidth: 120, background: '#1f2228', border: '1px solid #2a2d35',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <div style={{ fontSize: 12, color: '#36f4a4', fontWeight: 600, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 11, color: '#7d8187', lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}