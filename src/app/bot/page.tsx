"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What can you help me with?",
  "Tell me about this website",
  "How do I get started?",
  "What are your main features?",
];

function BotChat() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [botName, setBotName] = useState("Assistant");
  const [botColor, setBotColor] = useState("#6366f1");
  const [botIcon, setBotIcon] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load bot config on mount
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/knowledge/config?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.botName) setBotName(data.botName);
        if (data.botColor) setBotColor(data.botColor);
        if (data.botIcon) setBotIcon(data.botIcon);
      })
      .catch(() => {});
  }, [userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userText },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Add typing indicator
    setMessages([...newMessages, { role: "assistant", content: "..." }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, userId }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: "⚠️ " + data.error },
        ]);
      } else {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.text },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "⚠️ Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{ fontFamily: "system-ui, sans-serif" }}
      className="flex flex-col h-screen bg-gray-50"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shadow-sm"
        style={{ backgroundColor: botColor }}
      >
        {botIcon ? (
          <img src={botIcon} alt="bot" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-sm">
            {botName[0]?.toUpperCase() || "A"}
          </div>
        )}
        <span className="text-white font-semibold text-sm">{botName}</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-300" />
          <span className="text-white/80 text-xs">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: botColor }}
            >
              {botIcon ? (
                <img src={botIcon} alt="bot" className="w-full h-full rounded-full object-cover" />
              ) : (
                botName[0]?.toUpperCase() || "A"
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800">Hi! I&apos;m {botName}</p>
              <p className="text-gray-500 text-sm mt-1">Ask me anything about this website</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-left transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1"
                style={{ backgroundColor: botColor }}
              >
                {botName[0]?.toUpperCase() || "A"}
              </div>
            )}
            <div
              className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-white rounded-br-sm"
                  : "bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100"
              }`}
              style={
                msg.role === "user" ? { backgroundColor: botColor } : {}
              }
            >
              {msg.content === "..." ? (
                <div className="flex gap-1 items-center py-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-full border border-gray-200 text-sm outline-none focus:border-gray-400 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: botColor }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function BotPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>}>
      <BotChat />
    </Suspense>
  );
}