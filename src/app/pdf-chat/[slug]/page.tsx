'use client';
// src/app/pdf-chat/[slug]/page.tsx
// Public-facing PDF chat — no login required
// Accessed via /pdf-chat/:slug

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';

type Message = { role: 'user' | 'assistant'; content: string };

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
      <style>{`
        @keyframes nb { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes fi { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cb { 0%,100%{opacity:1} 50%{opacity:0} }
        .nc-msg { animation: fi 0.2s ease; }
      `}</style>
    </div>
  );
}

function PdfChat() {
  const params = useParams();
  const slug = params?.slug as string;

  const [fileId, setFileId] = useState('');
  const [userId, setUserId] = useState('');
  const [label, setLabel] = useState('PDF Assistant');
  const [loadError, setLoadError] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accentColor = '#36f4a4';
  const accentDark = '#0d2420';

  // Resolve slug → fileId + userId
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingText, isTyping, loading]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const runTypewriter = useCallback((text: string, onDone: (t: string) => void) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    intervalRef.current = setInterval(() => {
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

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading || isTyping || !fileId) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, fileId, userId }),
      });
      const data = await res.json();
      const responseText = data.error
        ? '⚠️ ' + data.error
        : data.answer || 'Sorry, no response.';

      setLoading(false);
      runTypewriter(responseText, (full) => {
        setMessages(prev => [...prev, { role: 'assistant', content: full }]);
      });
    } catch (err: any) {
      setLoading(false);
      setMessages([...newMessages, { role: 'assistant', content: '⚠️ Network error. Try again.' }]);
    }
  };

  if (loadingMeta) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a', color: accentColor, fontSize: 14, flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${accentColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#7d8187' }}>Loading chat...</span>
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

  return (
    <div style={{ fontFamily: 'system-ui,-apple-system,sans-serif', display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a' }}>
      <style>{`
        @keyframes nb { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes fi { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cb { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .nc-msg { animation: fi 0.2s ease; }
        .sug-btn:hover { border-color: ${accentColor} !important; color: ${accentColor} !important; background: ${accentDark} !important; }
        .send-btn:hover:not(:disabled) { transform: scale(1.05); }
      `}</style>

      {/* Header */}
      <div style={{ background: '#1f2228', borderBottom: '1px solid #2a2d35', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: accentDark, border: `1px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          📄
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#7d8187', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: loading || isTyping ? '#eab308' : accentColor }} />
            {loading ? 'Thinking...' : isTyping ? 'Typing...' : 'Ready'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#4a4e56', background: '#2a2d35', borderRadius: 9999, padding: '4px 10px' }}>
          PDF Chat
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && !loading && !isTyping && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20, textAlign: 'center', padding: '0 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: accentDark, border: `2px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              📄
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#fff', margin: 0, fontSize: 16 }}>Ask me about this document</p>
              <p style={{ color: '#7d8187', fontSize: 13, margin: '6px 0 0' }}>{label}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className="sug-btn" onClick={() => sendMessage(s)} style={{ fontSize: 13, padding: '10px 16px', borderRadius: 10, border: '1px solid #2a2d35', background: '#1f2228', color: '#7d8187', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="nc-msg" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: accentDark, border: `1px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📄</div>
            )}
            <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? accentColor : '#1f2228', color: msg.role === 'user' ? '#000' : '#e5e7eb', fontSize: 13.5, lineHeight: 1.65, border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none', fontWeight: msg.role === 'user' ? 500 : 400 }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="nc-msg" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: accentDark, border: `1px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📄</div>
            <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', border: '1px solid #2a2d35' }}>
              <TypingDots />
            </div>
          </div>
        )}

        {isTyping && typingText && (
          <div className="nc-msg" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: accentDark, border: `1px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📄</div>
            <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', color: '#e5e7eb', fontSize: 13.5, lineHeight: 1.65, border: '1px solid #2a2d35' }}>
              {typingText}
              <span style={{ display: 'inline-block', width: 2, height: '1em', background: accentColor, marginLeft: 2, animation: 'cb 0.7s infinite', verticalAlign: 'text-bottom' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', background: '#1f2228', borderTop: '1px solid #2a2d35', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about this document..."
          disabled={loading || isTyping}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 999, border: '1.5px solid #2a2d35', fontSize: 13.5, outline: 'none', color: '#fff', background: '#0a0a0a', transition: 'border-color 0.15s' }}
          onFocus={e => e.currentTarget.style.borderColor = accentColor}
          onBlur={e => e.currentTarget.style.borderColor = '#2a2d35'}
        />
        <button
          className="send-btn"
          onClick={() => sendMessage()}
          disabled={loading || isTyping || !input.trim()}
          style={{ width: 40, height: 40, borderRadius: '50%', background: accentColor, border: 'none', cursor: loading || isTyping || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || isTyping || !input.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#000" stroke="none" />
          </svg>
        </button>
      </div>

      {/* Powered by footer */}
      <div style={{ textAlign: 'center', padding: '8px', background: '#0a0a0a', borderTop: '1px solid #2a2d35' }}>
        <a href="https://nochbot.space" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#4a4e56', textDecoration: 'none' }}>
          Powered by <span style={{ color: accentColor }}>Nochbot</span>
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