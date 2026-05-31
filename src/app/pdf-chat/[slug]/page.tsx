'use client';
// src/app/pdf-chat/[slug]/page.tsx

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'assistant'; content: string };

// ── Markdown renderer (same as dashboard) ────────────────────────────────────
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
    <blockquote style={{ borderLeft: '3px solid #36f4a4', paddingLeft: 12, margin: '8px 0', color: '#a8f0d0', fontStyle: 'italic' }}>{children}</blockquote>
  ),
  code: ({ children }: any) => (
    <code style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 4, padding: '1px 6px', fontSize: 12, color: '#36f4a4', fontFamily: 'monospace' }}>{children}</code>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid #2a2d35', margin: '10px 0' }} />
  ),
};

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#9ca3af',
          display: 'inline-block',
          animation: `nb 1.2s infinite ${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function PdfChat() {
  const params = useParams();
  const slug = params?.slug as string;

  const [fileId, setFileId]       = useState('');
  const [userId, setUserId]       = useState('');
  const [label, setLabel]         = useState('PDF Assistant');
  const [loadError, setLoadError] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [typingText, setTypingText]   = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [autoScroll, setAutoScroll]   = useState(true);
  const [abortCtrl, setAbortCtrl]     = useState<AbortController | null>(null);

  const bottomRef       = useRef<HTMLDivElement>(null);
  const containerRef    = useRef<HTMLDivElement>(null);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef        = useRef<HTMLInputElement>(null);

  const accent     = '#36f4a4';
  const accentDark = '#0d2420';

  // ── Load slug metadata ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/pdf-links/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setLoadError(d.error); return; }
        setFileId(d.fileId);
        setUserId(d.userId);
        setLabel(d.label || d.filename || 'PDF Assistant');
      })
      .catch(() => setLoadError('Failed to load chat.'))
      .finally(() => setLoadingMeta(false));
  }, [slug]);

  // ── Auto scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingText, isTyping, loading, autoScroll]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (loading) setAutoScroll(true);
  }, [loading]);

  // ── Cleanup interval on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // ── Typewriter ──────────────────────────────────────────────────────────────
  const runTypewriter = useCallback((text: string, controller: AbortController, onDone: (t: string) => void) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    intervalRef.current = setInterval(() => {
      if (controller.signal.aborted) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        // Save partial response
        setMessages(prev => [...prev, { role: 'assistant', content: text.slice(0, i) + ' ▋' }]);
        setTypingText('');
        setIsTyping(false);
        return;
      }
      i++;
      setTypingText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsTyping(false);
        setTypingText('');
        onDone(text);
      }
    }, 14);
  }, []);

  // ── Stop ────────────────────────────────────────────────────────────────────
  const stopResponse = () => {
    abortCtrl?.abort();
    setAbortCtrl(null);
    setLoading(false);
  };

  // ── Send ────────────────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || loading || isTyping || !fileId) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setAutoScroll(true);

    const controller = new AbortController();
    setAbortCtrl(controller);

    try {
      const res = await fetch('/api/chat/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, fileId, userId }),
        signal: controller.signal,
      });
      const data = await res.json();
      const responseText = data.error ? '⚠️ ' + data.error : data.answer || 'Sorry, no response.';

      setLoading(false);
      runTypewriter(responseText, controller, (full) => {
        setMessages(prev => [...prev, { role: 'assistant', content: full }]);
        setAbortCtrl(null);
      });
    } catch (err: any) {
      setLoading(false);
      setAbortCtrl(null);
      if (err?.name === 'AbortError') return;
      setMessages([...newMessages, { role: 'assistant', content: '⚠️ Network error. Try again.' }]);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loadingMeta) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#7d8187', fontSize: 14 }}>Loading chat...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <p style={{ color: '#ef4444', fontSize: 15 }}>{loadError}</p>
        <p style={{ color: '#7d8187', fontSize: 13 }}>This chat link may have been removed.</p>
      </div>
    );
  }

  const SUGGESTIONS = [
    'What is this document about?',
    'Summarize the key points',
    'What are the main topics covered?',
    'Give me the most important takeaway',
  ];

  const isActive = loading || isTyping;

  return (
    <div style={{ fontFamily: 'system-ui,-apple-system,sans-serif', display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', maxWidth: 800, margin: '0 auto', width: '100%' }}>
      <style>{`
        @keyframes nb  { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes fi  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cb  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin{ to{transform:rotate(360deg)} }
        .nc-msg        { animation: fi 0.2s ease; }
        .sug-btn:hover { border-color: ${accent} !important; color: ${accent} !important; background: ${accentDark} !important; }
        .stop-btn:hover{ background: #2a0f0f !important; }
        .send-btn:hover:not(:disabled){ transform: scale(1.05); }
        /* Responsive tweaks */
        @media (max-width: 600px) {
          .chat-bubble { max-width: 90% !important; font-size: 13px !important; }
          .chat-header-label { font-size: 13px !important; }
          .suggestions-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: '#1f2228', borderBottom: '1px solid #2a2d35', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: accentDark, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          📄
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header-label" style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#7d8187', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#eab308' : accent, flexShrink: 0 }} />
            {loading ? 'Thinking...' : isTyping ? 'Typing...' : 'Ready to help'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#4a4e56', background: '#2a2d35', borderRadius: 9999, padding: '4px 10px', flexShrink: 0 }}>
          PDF Chat
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {/* Empty state */}
        {messages.length === 0 && !loading && !isTyping && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20, textAlign: 'center', padding: '0 16px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: accentDark, border: `2px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              📄
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#fff', margin: 0, fontSize: 16 }}>Ask me about this document</p>
              <p style={{ color: '#7d8187', fontSize: 13, margin: '6px 0 0' }}>{label}</p>
            </div>
            {/* Suggestions — 2-col responsive grid */}
            <div className="suggestions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 380 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className="sug-btn" onClick={() => sendMessage(s)}
                  style={{ fontSize: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #2a2d35', background: '#1f2228', color: '#7d8187', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1.4 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className="nc-msg" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: accentDark, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginBottom: 2 }}>📄</div>
            )}
            <div
              className="chat-bubble"
              style={{
                maxWidth: '75%', padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? accent : '#1f2228',
                color: msg.role === 'user' ? '#000' : '#e5e7eb',
                fontSize: 13.5, lineHeight: 1.65,
                border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none',
                fontWeight: msg.role === 'user' ? 500 : 400,
              }}
            >
              {msg.role === 'user'
                ? msg.content
                : <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
              }
            </div>
          </div>
        ))}

        {/* Loading dots */}
        {loading && (
          <div className="nc-msg" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: accentDark, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📄</div>
            <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', border: '1px solid #2a2d35' }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Typewriter */}
        {isTyping && typingText && (
          <div className="nc-msg" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: accentDark, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📄</div>
            <div className="chat-bubble" style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', color: '#e5e7eb', fontSize: 13.5, lineHeight: 1.65, border: '1px solid #2a2d35' }}>
              <ReactMarkdown components={mdComponents}>{typingText}</ReactMarkdown>
              <span style={{ display: 'inline-block', width: 2, height: '1em', background: accent, marginLeft: 2, animation: 'cb 0.7s infinite', verticalAlign: 'text-bottom' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{ padding: '12px 16px', background: '#1f2228', borderTop: '1px solid #2a2d35', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isActive && sendMessage()}
          placeholder={isActive ? 'Generating...' : 'Ask about this document...'}
          disabled={isActive}
          style={{ flex: 1, padding: '11px 16px', borderRadius: 999, border: '1.5px solid #2a2d35', fontSize: 13.5, outline: 'none', color: '#fff', background: '#0a0a0a', transition: 'border-color 0.15s', minWidth: 0 }}
          onFocus={e => e.currentTarget.style.borderColor = accent}
          onBlur={e => e.currentTarget.style.borderColor = '#2a2d35'}
        />

        {/* Stop button — shown while loading or typing */}
        {isActive ? (
          <button
            className="stop-btn"
            onClick={stopResponse}
            style={{ height: 40, padding: '0 16px', borderRadius: 999, background: '#1a0a0a', border: '1px solid #ef444460', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', flexShrink: 0 }}
          >
            <span style={{ width: 9, height: 9, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} />
            Stop
          </button>
        ) : (
          /* Send button */
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            style={{ width: 40, height: 40, borderRadius: '50%', background: accent, border: 'none', cursor: !input.trim() ? 'not-allowed' : 'pointer', opacity: !input.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#000" stroke="none" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', padding: '8px', background: '#0a0a0a', borderTop: '1px solid #2a2d35', flexShrink: 0 }}>
        <a href="https://nochbot.space" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#4a4e56', textDecoration: 'none' }}>
          Powered by <span style={{ color: accent }}>Nochbot</span>
        </a>
      </div>
    </div>
  );
}

export default function PdfChatPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a', color: '#7d8187', fontSize: 14 }}>
        Loading...
      </div>
    }>
      <PdfChat />
    </Suspense>
  );
}