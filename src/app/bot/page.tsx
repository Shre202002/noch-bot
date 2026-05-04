"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What can you help me with?",
  "Tell me about this website",
  "How do I get started?",
  "What are your main features?",
];

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#9ca3af",
          display: "inline-block",
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
    fetch(`/api/knowledge/config?userId=${userId}`)
      .then(r => r.json())
      .then(d => {
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

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading || isTyping) return;

    const newMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, userId }),
      });
      const data = await res.json();
      const responseText = data.error ? "⚠️ " + data.error : data.text || "Sorry, no response.";
      setLoading(false);
      runTypewriter(responseText, (full) => {
        setMessages(prev => [...prev, { role: "assistant", content: full }]);
      });
    } catch (err: any) {
      setLoading(false);
      setMessages([...newMessages, { role: "assistant", content: "⚠️ Network error. Try again." }]);
    }
  };

  const avatar = (size = 24) => (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: botColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.45, fontWeight: 700, flexShrink: 0 }}>
      {botIcon ? <img src={botIcon} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : botName[0]?.toUpperCase() || "A"}
    </div>
  );

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", display: "flex", flexDirection: "column", height: "100dvh", background: "#f9fafb" }}>
      {/* Header */}
      <div style={{ backgroundColor: botColor, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 8px rgba(0,0,0,0.15)" }}>
        {avatar(34)}
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{botName}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: loading || isTyping ? "#fbbf24" : "#4ade80", transition: "background 0.3s" }} />
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{loading ? "Thinking..." : isTyping ? "Typing..." : "Online"}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && !loading && !isTyping && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: botColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 700 }}>
              {botIcon ? <img src={botIcon} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : botName[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>Hi! I'm {botName} 👋</p>
              <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Ask me anything about this website</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 280 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ fontSize: 13, padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}
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
            <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? botColor : "#fff", color: msg.role === "user" ? "#fff" : "#1f2937", fontSize: 13.5, lineHeight: 1.6, boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.06)" : "none", border: msg.role === "assistant" ? "1px solid #f3f4f6" : "none" }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing dots while waiting */}
        {loading && (
          <div className="nc-msg" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {avatar(26)}
            <div style={{ padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "#fff", border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Typewriter effect */}
        {isTyping && typingText && (
          <div className="nc-msg" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {avatar(26)}
            <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "#fff", color: "#1f2937", fontSize: 13.5, lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f3f4f6" }}>
              {typingText}
              <span style={{ display: "inline-block", width: 2, height: "1em", background: botColor, marginLeft: 2, animation: "cb 0.7s infinite", verticalAlign: "text-bottom" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          disabled={loading || isTyping}
          style={{ flex: 1, padding: "10px 16px", borderRadius: 999, border: "1.5px solid #e5e7eb", fontSize: 13.5, outline: "none", color: "#111827", background: loading || isTyping ? "#f9fafb" : "#fff", transition: "border-color 0.15s" }}
          onFocus={e => e.currentTarget.style.borderColor = botColor}
          onBlur={e => e.currentTarget.style.borderColor = "#e5e7eb"}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || isTyping || !input.trim()}
          style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: botColor, border: "none", cursor: loading || isTyping || !input.trim() ? "not-allowed" : "pointer", opacity: loading || isTyping || !input.trim() ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.15s", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function BotPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", color: "#9ca3af", fontSize: 14 }}>Loading...</div>}>
      <BotChat />
    </Suspense>
  );
}