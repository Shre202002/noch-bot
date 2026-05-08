"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  MoreVertical,
  Download,
  Trash2,
  MessageSquare,
  User,
  Bot,
  Clock,
  Globe,
  ChevronRight,
  Copy,
  Check,
  Calendar,
  Monitor,
  Hash
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// --- Mock Data ---

const MOCK_SESSIONS = [
  {
    id: "sess_1",
    visitorName: "Visitor #8492",
    lastMessage: "How do I upgrade my plan to Pro?",
    timestamp: "2m ago",
    status: "active",
    messageCount: 8,
    platform: "macOS • Chrome",
    location: "United States",
    unread: true,
  },
  {
    id: "sess_2",
    visitorName: "Sarah Jenkins",
    lastMessage: "Thanks for the help, that resolved it!",
    timestamp: "1h ago",
    status: "resolved",
    messageCount: 4,
    platform: "Windows • Edge",
    location: "United Kingdom",
    unread: false,
  },
  {
    id: "sess_3",
    visitorName: "Visitor #1102",
    lastMessage: "Does your API support streaming responses?",
    timestamp: "3h ago",
    status: "resolved",
    messageCount: 12,
    platform: "Linux • Firefox",
    location: "Germany",
    unread: false,
  },
  {
    id: "sess_4",
    visitorName: "David Miller",
    lastMessage: "I'm having trouble with the embed script.",
    timestamp: "Yesterday",
    status: "active",
    messageCount: 6,
    platform: "macOS • Safari",
    location: "Canada",
    unread: false,
  }
];

const MOCK_MESSAGES: Record<string, any[]> = {
  "sess_1": [
    { role: "assistant", content: "Hi! I'm your Nocta assistant. How can I help you today?", time: "11:42 AM" },
    { role: "user", content: "I'm interested in the Pro plan but I have a few questions about limits.", time: "11:43 AM" },
    { role: "assistant", content: "Of course! The Pro plan offers up to 50,000 messages per month and unlimited website crawls. What specific limits were you wondering about?", time: "11:43 AM" },
    { role: "user", content: "How do I upgrade my plan to Pro?", time: "11:45 AM" },
  ],
  "sess_2": [
    { role: "assistant", content: "Hello! Looking for something specific?", time: "09:10 AM" },
    { role: "user", content: "Where can I find my API key?", time: "09:11 AM" },
    { role: "assistant", content: "You can find your API keys in the Dashboard under Settings > API. Would you like me to show you the way?", time: "09:11 AM" },
    { role: "user", content: "Thanks for the help, that resolved it!", time: "09:12 AM" },
  ]
};

// --- Components ---

export default function ConversationHistoryPage() {
  const [selectedId, setSelectedId] = useState(MOCK_SESSIONS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  const previewBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isMounted) {
      previewBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedId, isMounted]);

  if (!isMounted) return null;

  const currentSession = MOCK_SESSIONS.find(s => s.id === selectedId) || MOCK_SESSIONS[0];
  const messages = MOCK_MESSAGES[selectedId] || [];

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] overflow-hidden border border-border bg-card/30 backdrop-blur-xl rounded-3xl">
      
      {/* LEFT SIDEBAR: List */}
      <div className="w-full md:w-[380px] flex flex-col border-r border-border bg-background/40">
        <div className="p-5 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Conversations</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-black">
              {MOCK_SESSIONS.length} Total
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search sessions..." 
              className="pl-9 bg-background/50 border-border rounded-xl h-10 text-sm focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {MOCK_SESSIONS.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedId(session.id)}
                className={cn(
                  "w-full flex flex-col gap-1.5 p-4 rounded-2xl text-left transition-all group relative cursor-pointer",
                  selectedId === session.id 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-bold truncate max-w-[180px]", selectedId === session.id ? "text-white" : "text-foreground")}>
                    {session.visitorName}
                  </span>
                  <span className="text-[10px] opacity-70 font-medium">{session.timestamp}</span>
                </div>
                
                <p className="text-xs line-clamp-1 opacity-80 leading-relaxed pr-6">
                  {session.lastMessage}
                </p>

                <div className="flex items-center gap-3 mt-1 opacity-70">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter">
                    <MessageSquare className="h-3 w-3" />
                    {session.messageCount}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter">
                    <Globe className="h-3 w-3" />
                    {session.location}
                  </div>
                </div>

                {session.unread && selectedId !== session.id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT PANEL: Thread */}
      <div className="hidden md:flex flex-1 flex-col bg-background/20 relative">
        
        {/* Thread Header */}
        <div className="p-6 border-b border-border bg-background/40 backdrop-blur-md flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {currentSession.visitorName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-foreground flex items-center gap-2">
                {currentSession.visitorName}
                <Badge variant="outline" className="text-[9px] uppercase tracking-widest h-5 px-1.5 border-border">
                  {currentSession.status}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <Monitor className="h-3 w-3" /> {currentSession.platform} 
                <span className="opacity-30">•</span>
                <Clock className="h-3 w-3" /> Started 2h ago
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl h-9 px-4 border-border bg-background/50 hover:bg-accent cursor-pointer">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-destructive hover:bg-destructive/10 cursor-pointer">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 cursor-pointer">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message List */}
        <ScrollArea className="flex-1 p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex justify-center">
              <div className="px-4 py-1 rounded-full bg-accent/30 border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Session started — {currentSession.timestamp}
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "flex flex-col gap-2 max-w-[85%]",
                    msg.role === "user" ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                      {msg.role === "user" ? "Visitor" : "Nocta AI"}
                    </span>
                    <span className="text-[9px] text-muted-foreground opacity-40">{msg.time}</span>
                  </div>

                  <div className={cn(
                    "group relative p-4 rounded-3xl text-sm leading-relaxed shadow-sm",
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-secondary text-foreground border border-border rounded-tl-sm"
                  )}>
                    {msg.content}
                    
                    <button 
                      onClick={() => handleCopyMessage(msg.content, i)}
                      className={cn(
                        "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-background/20 hover:bg-background/40 backdrop-blur-sm cursor-pointer",
                        msg.role === "user" ? "-left-10" : "-right-10"
                      )}
                    >
                      {copiedId === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div ref={previewBottomRef} className="h-10" />
        </ScrollArea>

        {/* Floating Sidebar Toggle Info (Desktop) */}
        <div className="absolute right-8 bottom-8 flex flex-col gap-3 pointer-events-none">
          <div className="bg-card/80 border border-border backdrop-blur-xl p-4 rounded-2xl shadow-2xl space-y-3 w-56 opacity-0 xl:opacity-100 transition-opacity">
            <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
              <Hash className="h-3 w-3" /> Context Info
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Tokens used</span>
                <span className="font-mono">1,402</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">RAG Source</span>
                <span className="font-mono text-emerald-500">Docs (v2)</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Model</span>
                <span className="font-mono">Llama 3.3</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* EMPTY STATE MOBILE */}
      <div className="md:hidden flex flex-1 items-center justify-center text-center p-12">
        <div className="space-y-4">
          <div className="h-16 w-16 bg-accent rounded-3xl flex items-center justify-center mx-auto opacity-20">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold">Select a conversation</h3>
          <p className="text-sm text-muted-foreground">Choose a visitor session from the sidebar to view the full chat history.</p>
        </div>
      </div>

    </div>
  );
}
