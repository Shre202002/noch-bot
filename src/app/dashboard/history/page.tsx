"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Search, Globe, Clock, ChevronRight, ArrowLeft, User, Bot, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConversationItem {
  _id: string;
  website: string;
  sessionId: string;
  messageCount: number;
  lastMessageAt: string;
  startedAt: string;
  preview: string;
}

interface MessageItem {
  _id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  responseTimeMs?: number;
}

interface ThreadData {
  conversation: ConversationItem;
  messages: MessageItem[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch conversations
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/history?${params}`)
      .then((r) => r.json())
      .then((data) => {
        console.log(data.conversations);
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, debouncedSearch]);

  // Fetch thread when conversation selected
  useEffect(() => {
    if (!selectedId) return;
    setThreadLoading(true);
    setThread(null);
    fetch(`/api/history/${selectedId}`)
      .then((r) => r.json())
      .then((data) => { setThread(data); setThreadLoading(false); })
      .catch(() => setThreadLoading(false));
  }, [selectedId]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">

      {/* Header */}
      <div>
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-black">
          Conversation History
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-sm mt-1">
          {total > 0 ? `${total} total conversations` : "No conversations yet"}
        </motion.p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

        {/* LEFT — Conversation List */}
        <div className={cn("xl:col-span-2 space-y-3", selectedId && "hidden xl:block")}>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by website..."
              className="w-full pl-9 pr-4 py-2.5 bg-accent/30 border border-border rounded-xl text-sm outline-none focus:border-[#36f4a4]/50 transition-colors placeholder:text-muted-foreground"
            />
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/50 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch ? "No conversations match your search" : "No conversations yet"}
              </p>
              {!debouncedSearch && (
                <p className="text-xs text-muted-foreground/60">
                  Conversations will appear here once visitors start chatting on your website
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {conversations.map((conv, i) => (
                  <motion.div
                    key={conv._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => {
                      console.log(conv);
                      setSelectedId(String(conv._id));
                    }}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all group",
                      selectedId === conv._id
                        ? "border-[#36f4a4]/40 bg-[#36f4a4]/5"
                        : "border-border bg-card/30 hover:border-border hover:bg-accent/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold text-foreground truncate">
                          {conv.website || "Unknown site"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{timeAgo(conv.lastMessageAt)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                      {conv.preview}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px] px-2">
                        {conv.messageCount} messages
                      </Badge>
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 transition-all",
                        selectedId === conv._id ? "text-[#36f4a4]" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                      )} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Thread Viewer */}
        <div className={cn("xl:col-span-3", !selectedId && "hidden xl:flex xl:items-center xl:justify-center")}>
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/30 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Select a conversation to view messages</p>
            </div>
          ) : (
            <Card className="border-border bg-card/30">
              {/* Thread Header */}
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <button
                  onClick={() => setSelectedId(null)}
                  className="xl:hidden p-1.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {thread && thread.conversation && (
                  <>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{thread.conversation.website || "Unknown site"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {thread.messages?.length || 0} messages · Started {timeAgo(thread.conversation.startedAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Session
                    </Badge>
                  </>
                )}
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {threadLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (thread?.messages?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">No messages in this conversation</div>
                ) : (
                  <AnimatePresence>
                    {thread?.messages.map((msg, i) => (
                      <motion.div
                        key={msg._id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 rounded-lg bg-[#36f4a4]/10 border border-[#36f4a4]/20 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="h-3.5 w-3.5 text-[#36f4a4]" />
                          </div>
                        )}
                        <div className="max-w-[78%] space-y-1">
                          <div
                            className={cn(
                              "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-accent/50 text-foreground border border-border rounded-tl-sm"
                            )}
                          >
                            {msg.content}
                          </div>
                          <div className={cn("flex items-center gap-2 px-1", msg.role === "user" ? "justify-end" : "justify-start")}>
                            <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                            {msg.role === "assistant" && msg.responseTimeMs && (
                              <span className="text-[10px] text-muted-foreground/60">· {msg.responseTimeMs}ms</span>
                            )}
                          </div>
                        </div>
                        {msg.role === "user" && (
                          <div className="w-7 h-7 rounded-lg bg-accent/50 border border-border flex items-center justify-center shrink-0 mt-0.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}