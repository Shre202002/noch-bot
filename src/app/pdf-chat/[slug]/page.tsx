'use client';
// src/app/pdf-chat/[slug]/page.tsx

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, Square, FileText, Sun, Moon, LogOut } from 'lucide-react';
import { LinkSignIn, type GateMode } from './link-sign-in';

const REQUEST_TIMEOUT_MS = 60_000;

// Visitors on a shared link never see raw API errors; each failure maps to a polite next step.
const VISITOR_ERRORS = {
  network: "I couldn't reach the assistant. Check your connection and try again.",
  timeout: 'The assistant is taking too long to answer. Please try again.',
  limit: 'This document assistant has reached its message limit for now. Please try again later.',
  unavailable: 'This document is no longer available for chat.',
  server: 'Something went wrong on our side. Please try again in a moment.',
};

/** Which gate screen to show for a link-session problem reported by the API. */
function gateFor(code: string | undefined, message: string | undefined): { mode: GateMode; notice: string | null } {
  if (code === 'blocked' || code === 'pending' || code === 'rejected') return { mode: code, notice: message || null };
  if (code === 'replaced') return { mode: 'signin', notice: message || null };
  return { mode: 'signin', notice: null };
}

function visitorErrorFor(status: number): string {
  if (status === 429) return VISITOR_ERRORS.limit;
  if (status === 401 || status === 403 || status === 404) return VISITOR_ERRORS.unavailable;
  return VISITOR_ERRORS.server;
}

type Message = { role: 'user' | 'assistant'; content: string; createdAt?: string };

// ── Markdown renderer ─────────────────────────────────────────────────────────
const mdComponents = {
  h2: ({ children }: any) => (
    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#D97757', margin: '12px 0 6px 0' }}>{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#C6613F', margin: '10px 0 4px 0' }}>{children}</h3>
  ),
  p: ({ children }: any) => (
    <p style={{ margin: '4px 0', lineHeight: 1.75 }}>{children}</p>
  ),
  strong: ({ children }: any) => (
    <strong style={{ fontWeight: 700 }}>{children}</strong>
  ),
  ul: ({ children }: any) => (
    <ul style={{ paddingLeft: 20, margin: '6px 0' }}>{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol style={{ paddingLeft: 20, margin: '6px 0' }}>{children}</ol>
  ),
  li: ({ children }: any) => (
    <li style={{ margin: '4px 0', lineHeight: 1.65 }}>{children}</li>
  ),
  table: ({ children }: any) => (
    <div style={{ overflowX: 'auto', margin: '10px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead style={{ background: 'rgba(217,119,87,0.08)' }}>{children}</thead>
  ),
  th: ({ children }: any) => (
    <th style={{ border: '1px solid rgba(217,119,87,0.3)', padding: '7px 12px', color: '#D97757', fontWeight: 600, textAlign: 'left', fontSize: 12 }}>{children}</th>
  ),
  td: ({ children }: any) => (
    <td style={{ border: '1px solid var(--bg-300)', padding: '7px 12px' }}>{children}</td>
  ),
  blockquote: ({ children }: any) => (
    <blockquote style={{ borderLeft: '2px solid var(--bg-300)', paddingLeft: 14, margin: '10px 0', color: 'var(--text-300)' }}>{children}</blockquote>
  ),
  code: ({ children }: any) => (
    <code style={{ background: 'var(--bg-200)', borderRadius: 5, padding: '1px 6px', fontSize: 12, fontFamily: 'monospace' }}>{children}</code>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid var(--bg-300)', margin: '12px 0' }} />
  ),
};

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--text-400)',
          display: 'inline-block',
          animation: `typingPulse 1.2s infinite ${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function BotAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
      background: 'rgba(217,119,87,0.12)',
      border: '1px solid rgba(217,119,87,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <FileText size={14} color="#D97757" />
    </div>
  );
}

// ── Main chat component ───────────────────────────────────────────────────────
function PdfChat() {
  const params = useParams();
  const slug = params?.slug as string;

  const [fileId, setFileId]         = useState('');
  const [userId, setUserId]         = useState('');
  const [label, setLabel]           = useState('PDF Assistant');
  const [loadError, setLoadError]   = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  // Sign-in protected links: the gate replaces the chat until the visitor holds a valid link session.
  const [linkGate, setLinkGate] = useState<{ mode: GateMode; notice: string | null } | null>(null);
  const [linkLoginId, setLinkLoginId] = useState('');
  const [isDark, setIsDark]         = useState(false);

  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [abortCtrl, setAbortCtrl]   = useState<AbortController | null>(null);

  // Keep the first render deterministic. Generating a random id in a state
  // initializer runs on both server and client and can trigger hydration
  // warnings because the values differ.
  const [sessionId, setSessionId] = useState('');

  const bottomRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Dark mode detection ───────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setSessionId(current => {
      if (current) return current;
      return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    });
  }, []);

  // ── Load slug ─────────────────────────────────────────────────────────────
  const loadLink = useCallback(async () => {
    if (!slug) return;
    const base = `/api/pdf-links/${encodeURIComponent(String(slug))}`;
    try {
      const r = await fetch(base);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) {
        setLoadError(r.status === 404 ? "This chat link isn't available." : "We couldn't load this chat. Please try again.");
        return;
      }
      setLabel(d.label || d.filename || 'PDF Assistant');
      if (d.requireLogin && !d.signedIn) {
        // Ask why there is no session, so a locked or pending account sees its own screen.
        const me = await fetch(`${base}/auth/me`).then(res => res.json()).catch(() => ({}));
        setLinkGate(gateFor(me.code, me.message));
        setFileId('');
        return;
      }
      setLinkGate(null);
      setLinkLoginId(d.loginId || '');
      setFileId(d.fileId);
      setUserId(d.userId);
    } catch {
      setLoadError("We couldn't load this chat. Check your connection and try again.");
    } finally {
      setLoadingMeta(false);
    }
  }, [slug]);

  useEffect(() => { loadLink(); }, [loadLink]);

  const signOutLink = async () => {
    await fetch(`/api/pdf-links/${encodeURIComponent(String(slug))}/auth/logout`, { method: 'POST' }).catch(() => {});
    setLinkLoginId('');
    setMessages([]);
    setFileId('');
    setLinkGate({ mode: 'signin', notice: null });
  };

  // ── Auto scroll ───────────────────────────────────────────────────────────
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
  }, [loadingMeta, linkGate]);

  useEffect(() => { if (loading) setAutoScroll(true); }, [loading]);

  // ── Auto resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // ── Typewriter ────────────────────────────────────────────────────────────
  const runTypewriter = useCallback((text: string, controller: AbortController, onDone: (t: string) => void) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    intervalRef.current = setInterval(() => {
      if (controller.signal.aborted) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setMessages(prev => [...prev, { role: 'assistant', content: text.slice(0, i) + '\n\n_Response stopped._', createdAt: new Date().toISOString() }]);
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
    }, 10);
  }, []);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopResponse = () => {
    abortCtrl?.abort();
    setAbortCtrl(null);
    setLoading(false);
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || loading || isTyping || !fileId) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userText, createdAt: new Date().toISOString() }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setAutoScroll(true);

    const controller = new AbortController();
    setAbortCtrl(controller);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch('/api/chat/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, fileId, userId, sessionId, slug, label }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.code) {
        setLoading(false);
        setAbortCtrl(null);
        setMessages(messages);
        setInput(userText);
        setFileId('');
        setLinkLoginId('');
        setLinkGate(gateFor(data.code === 'session_replaced' ? 'replaced' : data.code, data.error));
        return;
      }
      const responseText = !res.ok || data.error
        ? visitorErrorFor(res.ok ? 500 : res.status)
        : data.answer || "Sorry, I couldn't find an answer to that in this document.";

      setLoading(false);
      runTypewriter(responseText, controller, (full) => {
        setMessages(prev => [...prev, { role: 'assistant', content: full, createdAt: new Date().toISOString() }]);
        setAbortCtrl(null);
      });
    } catch (err: any) {
      clearTimeout(timeout);
      setLoading(false);
      setAbortCtrl(null);
      // A user-initiated Stop needs no reply; a timeout does.
      if (err?.name === 'AbortError' && !timedOut) return;
      const content = timedOut ? VISITOR_ERRORS.timeout : VISITOR_ERRORS.network;
      setMessages([...newMessages, { role: 'assistant', content, createdAt: new Date().toISOString() }]);
    }
  };

  const isActive = loading || isTyping;

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loadingMeta) {
    return (
      <div className={isDark ? 'dark' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-0)', flexDirection: 'column', gap: 14 }}>
        <style>{cssVars + keyframes}</style>
        <div style={{ width: 36, height: 36, border: '2.5px solid #D97757', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-400)', fontSize: 14 }}>Loading chat...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={isDark ? 'dark' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-0)', flexDirection: 'column', gap: 12 }}>
        <style>{cssVars + keyframes}</style>
        <FileText aria-hidden="true" size={40} color="var(--text-400)" />
        <p role="alert" style={{ color: 'var(--text-100)', fontSize: 15, fontWeight: 500, margin: 0, textAlign: 'center', padding: '0 24px' }}>{loadError}</p>
        <p style={{ color: 'var(--text-400)', fontSize: 13 }}>This chat link may have been removed.</p>
      </div>
    );
  }

  if (linkGate) {
    return (
      <div className={isDark ? 'dark' : ''} style={{ fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg-0)', color: 'var(--text-100)' }}>
        <style>{cssVars + keyframes}</style>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
          <button type="button" className="pc-focus" onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            style={{ background: 'var(--bg-200)', border: '1px solid var(--bg-300)', borderRadius: 8, minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--text-300)', cursor: 'pointer' }}>
            {isDark ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
          </button>
        </div>
        <LinkSignIn
          key={`${linkGate.mode}-${linkGate.notice ?? ''}`}
          slug={String(slug)}
          label={label}
          initialMode={linkGate.mode}
          notice={linkGate.notice}
          onSignedIn={() => { setLoadingMeta(true); loadLink(); }}
        />
      </div>
    );
  }

  const SUGGESTIONS = [
    { icon: '📖', text: 'What is this document about?' },
    { icon: '🎯', text: 'Summarize the key points' },
    { icon: '📋', text: 'List the main topics' },
    { icon: '💡', text: 'Most important takeaway' },
  ];

  return (
    <div className={isDark ? 'dark' : ''} style={{ fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-0)', color: 'var(--text-100)' }}>
      <style>{cssVars + keyframes}</style>

      {/* ── Header ── */}
      <div style={{ background: 'var(--bg-100)', borderBottom: '1px solid var(--bg-300)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, backdropFilter: 'blur(8px)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(217,119,87,0.1)', border: '1px solid rgba(217,119,87,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={17} color="#D97757" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-400)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#f59e0b' : '#22c55e', flexShrink: 0 }} />
            {loading ? 'Thinking...' : isTyping ? 'Typing...' : 'Ready'}
          </div>
        </div>
        {linkLoginId && (
          <button type="button" className="pc-focus" onClick={signOutLink}
            aria-label={`Sign out ${linkLoginId}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--bg-300)', borderRadius: 8, minHeight: 44, padding: '0 12px', color: 'var(--text-300)', cursor: 'pointer', fontSize: 13, flexShrink: 0, maxWidth: 180 }}>
            <LogOut aria-hidden="true" size={14} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkLoginId}</span>
          </button>
        )}
        {/* Dark mode toggle */}
        <button
          type="button" className="pc-focus"
          onClick={() => setIsDark(!isDark)}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{ background: 'var(--bg-200)', border: '1px solid var(--bg-300)', borderRadius: 8, minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--text-300)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
        >
          {isDark ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
        </button>
      </div>

      {/* ── Messages ── */}
      <div ref={containerRef} className="pc-motion" role="log" aria-live="polite" aria-relevant="additions" aria-busy={isActive} aria-label={`Conversation about ${label}`} style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 12px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 780, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Empty state */}
        {messages.length === 0 && !loading && !isTyping && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 24, textAlign: 'center', padding: '0 16px', animation: 'fadeInUp 0.3s ease' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(217,119,87,0.1)', border: '1.5px solid rgba(217,119,87,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={32} color="#D97757" />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text-100)', margin: 0, fontSize: 18 }}>Ask me about this document</p>
              <p style={{ color: 'var(--text-400)', fontSize: 13, margin: '6px 0 0', maxWidth: 320 }}>{label}</p>
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2" style={{ gap: 8, width: '100%', maxWidth: 400 }}>
              {SUGGESTIONS.map(s => (
                <button key={s.text} type="button" className="pc-focus" onClick={() => sendMessage(s.text)}
                  style={{ fontSize: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--bg-300)', background: 'var(--bg-100)', color: 'var(--text-300)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D97757'; (e.currentTarget as HTMLElement).style.color = '#D97757'; (e.currentTarget as HTMLElement).style.background = 'rgba(217,119,87,0.05)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-300)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-300)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-100)'; }}
                >
                  <span aria-hidden="true">{s.icon}</span>{s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-start', animation: 'fadeInUp 0.2s ease' }}>
            {msg.role === 'assistant' && <BotAvatar />}
            <div style={{
              maxWidth: '78%',
              padding: msg.role === 'user' ? '10px 16px' : '12px 16px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
              background: msg.role === 'user' ? '#D97757' : 'var(--bg-100)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-100)',
              fontSize: 14, lineHeight: 1.65, overflowWrap: 'anywhere', minWidth: 0,
              border: msg.role === 'assistant' ? '1px solid var(--bg-300)' : 'none',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <span className="sr-only">{msg.role === 'user' ? 'You: ' : 'Assistant: '}</span>
              {msg.role === 'user'
                ? <span style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                : <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.content}</ReactMarkdown>
              }
            </div>
          </div>
        ))}

        {/* Loading dots */}
        {loading && (
          <div aria-hidden="true" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', animation: 'fadeInUp 0.2s ease' }}>
            <BotAvatar />
            <div style={{ padding: '12px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--bg-100)', border: '1px solid var(--bg-300)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Typewriter */}
        {isTyping && typingText && (
          <div aria-hidden="true" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', animation: 'fadeInUp 0.2s ease' }}>
            <BotAvatar />
            <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--bg-100)', color: 'var(--text-100)', fontSize: 14, lineHeight: 1.65, border: '1px solid var(--bg-300)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{typingText}</ReactMarkdown>
              <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#D97757', marginLeft: 2, animation: 'cursorBlink 0.7s infinite', verticalAlign: 'text-bottom' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div style={{ padding: '12px 16px max(20px, env(safe-area-inset-bottom))', flexShrink: 0 }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{
            background: 'var(--bg-100)',
            border: '1px solid var(--bg-300)',
            borderRadius: 18,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            transition: 'box-shadow 0.2s',
          }}
            className="pc-input-card"
          >
            {/* Textarea */}
            <div style={{ padding: '14px 16px 8px' }}>
              <textarea
                ref={textareaRef}
                aria-label={`Ask about ${label}`}
                enterKeyHint="send"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={isActive ? 'Generating response...' : 'Ask anything about this document...'}
                disabled={isActive}
                rows={1}
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-100)', fontSize: 15, lineHeight: 1.6, resize: 'none',
                  fontFamily: 'inherit', minHeight: '1.5em', maxHeight: 200,
                  opacity: isActive ? 0.6 : 1,
                }}
              />
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 10px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-400)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileText size={12} color="var(--text-400)" />
                {label}
              </span>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Stop button */}
                {isActive && (
                  <button type="button" className="pc-focus" aria-label="Stop response" onClick={stopResponse}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '6px 12px', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                  >
                    <Square size={10} fill="#ef4444" />
                    Stop
                  </button>
                )}

                {/* Send button */}
                <button type="button" className="pc-focus pc-send" aria-label="Send message" onClick={() => sendMessage()}
                  disabled={!input.trim() || isActive}
                  style={{
                    borderRadius: 10, border: 'none',
                    background: input.trim() && !isActive ? '#D97757' : 'var(--bg-300)',
                    color: input.trim() && !isActive ? '#fff' : 'var(--text-400)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: input.trim() && !isActive ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (input.trim() && !isActive) (e.currentTarget as HTMLElement).style.background = '#C6613F'; }}
                  onMouseLeave={e => { if (input.trim() && !isActive) (e.currentTarget as HTMLElement).style.background = '#D97757'; }}
                >
                  <ArrowUp aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <a href="https://nochbot.space" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--text-500)', textDecoration: 'none' }}>
              Powered by <span style={{ color: '#D97757', fontWeight: 600 }}>Nochbot</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CSS injected as string to avoid globals.css dependency ────────────────────
const cssVars = `
  :root {
    --bg-0:#FAF9F5; --bg-100:#FFFFFF; --bg-200:#F0EEE6; --bg-300:#DDDDDD;
    --text-100:#1F1E1D; --text-200:#3D3D3A; --text-300:#73726C;
    --text-400:#888888; --text-500:#999999;
    --accent:#D97757; --accent-hover:#C6613F;
  }
  .dark {
    --bg-0:#212121; --bg-100:#262624; --bg-200:#30302E; --bg-300:#454540;
    --text-100:#ECECEC; --text-200:#E1E1E0; --text-300:#B4B4B4;
    --text-400:#8A8A88; --text-500:#6B6B65;
    --accent:#D2996E; --accent-hover:#E5AA7F;
  }
`;

const keyframes = `
  @keyframes spin         { to { transform: rotate(360deg); } }
  @keyframes fadeInUp     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes cursorBlink  { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes typingPulse  { 0%,60%,100%{opacity:.35} 30%{opacity:1} }
  .pc-focus:focus-visible { outline: 2px solid #D97757; outline-offset: 2px; }
  .pc-input-card:focus-within { outline: 2px solid #D97757; outline-offset: 2px; }
  .pc-send { width: 40px; height: 40px; }
  @media (pointer: coarse) { .pc-send { width: 44px; height: 44px; } }
  @media (prefers-reduced-motion: reduce) {
    .pc-motion, .pc-motion * { animation: none !important; }
  }
`;

// ── Page wrapper ──────────────────────────────────────────────────────────────
export default function PdfChatPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#FAF9F5', color: '#888', fontSize: 14 }}>
        Loading...
      </div>
    }>
      <PdfChat />
    </Suspense>
  );
}
