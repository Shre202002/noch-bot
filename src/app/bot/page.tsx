"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatText } from "@/components/ChatText";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What can you help me with?",
  "Tell me about this website",
  "How do I get started?",
  "What are your main features?",
];

const REQUEST_TIMEOUT_MS = 45_000;

// Side padding that keeps conversation and input in one 760px column on wide screens,
// while the scroll container itself stays full width (scrollbar at the window edge).
const GUTTER = "max(16px, calc((100% - 760px) / 2))";

// Visitors never see raw API errors; each failure maps to a polite next step.
const VISITOR_ERRORS = {
  network: "I couldn't reach the assistant. Check your connection and try again.",
  timeout: "The assistant is taking too long to answer. Please try again.",
  limit: "This assistant has reached its message limit for now. Please try again later or contact the website owner.",
  setup: "This assistant isn't set up correctly yet. Please contact the website owner.",
  server: "Something went wrong on our side. Please try again in a moment.",
};

function visitorErrorFor(status: number): string {
  if (status === 429) return VISITOR_ERRORS.limit;
  if (status >= 400 && status < 500) return VISITOR_ERRORS.setup;
  return VISITOR_ERRORS.server;
}

// The organizer picks botColor freely; fall back to near-black when it is too light to show a focus ring on white.
function focusRingColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#111827";
  const channel = (i: number) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return 1.05 / (luminance + 0.05) >= 3 ? hex : "#111827";
}

const STYLES = `
  @keyframes nb { 0%,60%,100%{opacity:.35} 30%{opacity:1} }
  @keyframes fi { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes cb { 0%,100%{opacity:1} 50%{opacity:0} }
  .nc-msg { animation: fi 0.2s cubic-bezier(0.22, 1, 0.36, 1); }
  .nc-focus:focus-visible { outline: 2px solid var(--nb-ring); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .nc-msg, .nc-dot, .nc-caret { animation: none !important; }
  }
`;

function TypingDots() {
  return (
    <div aria-hidden="true" style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="nc-dot" style={{
          width: 7, height: 7, borderRadius: "50%", background: "#9ca3af",
          display: "inline-block",
          animation: `nb 1.2s infinite ${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function BotChat() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [botName, setBotName] = useState("Assistant");
  const [botColor, setBotColor] = useState("#6366f1");
  const [botIcon, setBotIcon] = useState("");
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/knowledge/config?userId=${encodeURIComponent(userId)}`)
      .then(r => (r.ok ? r.json() : {}))
      .then((d: { botName?: string; botColor?: string; botIcon?: string }) => {
        if (d.botName) setBotName(d.botName);
        if (d.botColor) setBotColor(d.botColor);
        if (d.botIcon) setBotIcon(d.botIcon);
      }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingText, isTyping, loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const runTypewriter = useCallback((text: string, onDone: (t: string) => void) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsTyping(true);
    setTypingText("");
    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      setTypingText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsTyping(false);
        setTypingText("");
        onDone(text);
      }
    }, 14);
  }, []);

  const busy = loading || isTyping;

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || busy) return;

    const newMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, userId }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      const responseText = !res.ok || data.error
        ? visitorErrorFor(res.ok ? 500 : res.status)
        : data.text || "Sorry, I don't have an answer for that.";
      setLoading(false);
      runTypewriter(responseText, (full) => {
        setMessages(prev => [...prev, { role: "assistant", content: full }]);
      });
    } catch (err: any) {
      setLoading(false);
      const content = err?.name === "AbortError" ? VISITOR_ERRORS.timeout : VISITOR_ERRORS.network;
      setMessages([...newMessages, { role: "assistant", content }]);
    } finally {
      clearTimeout(timeout);
    }
  };

  const avatar = (size = 24) => (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", backgroundColor: botColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.45, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
      {botIcon ? <img src={botIcon} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : botName[0]?.toUpperCase() || "A"}
    </div>
  );

  const bubbleText: React.CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", display: "flex", flexDirection: "column", height: "100dvh", background: "#f9fafb", ["--nb-ring" as string]: focusRingColor(botColor) }}>
      <style>{STYLES}</style>

      {/* Header */}
      <header style={{ backgroundColor: botColor, padding: "12px 16px", paddingTop: "max(12px, env(safe-area-inset-top))", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 8px rgba(0,0,0,0.15)" }}>
        {avatar(34)}
        <h1 style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{botName}</h1>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: busy ? "#fbbf24" : "#4ade80", transition: "background 0.3s" }} />
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{loading ? "Thinking..." : isTyping ? "Typing..." : "Online"}</span>
        </div>
      </header>

      {/* Messages: completed messages are appended to the log, so screen readers announce each reply once. */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={busy}
        aria-label={`Conversation with ${botName}`}
        style={{ flex: 1, overflowY: "auto", padding: `16px ${GUTTER}`, display: "flex", flexDirection: "column", gap: 12 }}
      >
        {messages.length === 0 && !busy && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, textAlign: "center" }}>
            <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: botColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 700, overflow: "hidden" }}>
              {botIcon ? <img src={botIcon} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : botName[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>Hi! I'm {botName}</p>
              <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Ask me anything about this website</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 280 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" className="nc-focus" onClick={() => sendMessage(s)} style={{ fontSize: 13, padding: "12px 14px", minHeight: 44, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = botColor)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="nc-msg" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
            {msg.role === "assistant" && avatar(26)}
            <div style={{ ...bubbleText, whiteSpace: msg.role === "user" ? "pre-wrap" : "normal", maxWidth: "75%", padding: "10px 14px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? botColor : "#fff", color: msg.role === "user" ? "#fff" : "#1f2937", fontSize: 13.5, lineHeight: 1.6, boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.06)" : "none", border: msg.role === "assistant" ? "1px solid #f3f4f6" : "none" }}>
              <span className="sr-only">{msg.role === "user" ? "You: " : `${botName}: `}</span>
              {msg.role === "assistant" ? <ChatText text={msg.content} /> : msg.content}
            </div>
          </div>
        ))}

        {/* Typing dots while waiting */}
        {loading && (
          <div className="nc-msg" aria-hidden="true" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {avatar(26)}
            <div style={{ padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "#fff", border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Typewriter effect: hidden from assistive tech, which hears the finished message instead. */}
        {isTyping && typingText && (
          <div className="nc-msg" aria-hidden="true" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {avatar(26)}
            <div style={{ ...bubbleText, whiteSpace: "normal", maxWidth: "75%", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "#fff", color: "#1f2937", fontSize: 13.5, lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f3f4f6" }}>
              <ChatText text={typingText} caret={<span className="nc-caret" style={{ display: "inline-block", width: 2, height: "1em", background: botColor, marginLeft: 2, animation: "cb 0.7s infinite", verticalAlign: "text-bottom" }} />} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(); }}
        style={{ padding: `12px ${GUTTER}`, paddingBottom: "max(12px, env(safe-area-inset-bottom))", background: "#fff", borderTop: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "center" }}
      >
        {/* readOnly rather than disabled while busy, so keyboard focus stays in the field between messages. */}
        <input
          type="text"
          className="nc-focus"
          aria-label={`Message ${botName}`}
          enterKeyHint="send"
          autoComplete="off"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          readOnly={busy}
          aria-busy={busy}
          style={{ flex: 1, minWidth: 0, padding: "10px 16px", minHeight: 44, borderRadius: 999, border: "1.5px solid #e5e7eb", fontSize: 13.5, color: "#111827", background: busy ? "#f9fafb" : "#fff", transition: "border-color 0.15s" }}
          onFocus={e => e.currentTarget.style.borderColor = botColor}
          onBlur={e => e.currentTarget.style.borderColor = "#e5e7eb"}
        />
        <button
          type="submit"
          className="nc-focus"
          aria-label="Send message"
          disabled={busy || !input.trim()}
          style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: botColor, border: "none", cursor: busy || !input.trim() ? "not-allowed" : "pointer", opacity: busy || !input.trim() ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.15s", flexShrink: 0 }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default function BotPage() {
  return (
    <Suspense fallback={<div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", color: "#6b7280", fontSize: 14 }}>Loading...</div>}>
      <BotChat />
    </Suspense>
  );
}
