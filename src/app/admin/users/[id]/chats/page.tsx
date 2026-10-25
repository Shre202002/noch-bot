"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Source = "website" | "pdf";

type ChatSummary = {
  id: string;
  title: string;
  visitor?: string;
  messageCount: number;
  startedAt?: string;
  lastActiveAt?: string;
  preview: string;
};

type Thread = {
  chat: { id: string; title: string; visitor?: string; startedAt?: string; lastActiveAt?: string };
  messages: Array<{ role: string; content: string; createdAt?: string }>;
  truncated: boolean;
};

const TABS: Array<{ key: Source; label: string }> = [
  { key: "website", label: "Website chatbot" },
  { key: "pdf", label: "PDF / sheet links" },
];

async function getJson(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AdminUserChatsPage() {
  const { id } = useParams<{ id: string }>();
  const [source, setSource] = useState<Source>("website");
  const [page, setPage] = useState(1);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [owner, setOwner] = useState<{ email: string; name: string | null } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLElement>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJson(`/api/admin/users/${id}/chats?source=${source}&page=${page}`);
      setChats(data.chats);
      setTotal(data.total);
      setOwner(data.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, source, page]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selected) {
      setThread(null);
      return;
    }
    let cancelled = false;
    setThreadLoading(true);
    getJson(`/api/admin/users/${id}/chats/${encodeURIComponent(selected)}?source=${source}`)
      .then((t) => {
        if (cancelled) return;
        setThread(t);
        // On narrow screens the thread sits below the list, so bring it into view.
        if (window.matchMedia("(max-width: 1023px)").matches) {
          requestAnimationFrame(() => threadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setThreadLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, source, selected]);

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/users?open=${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to user
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Chat history</h1>
        {owner && <p className="text-sm text-muted-foreground">{owner.name ? `${owner.name} · ${owner.email}` : owner.email}</p>}
      </div>

      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setSource(t.key);
              setPage(1);
              setSelected(null);
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              source === t.key
                ? "border-signal bg-[var(--nb-surface)] text-foreground"
                : "border-[var(--nb-line)] text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <section className="rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)]">
          <ul className="max-h-[50vh] divide-y divide-[var(--nb-line)] overflow-y-auto">
            {chats.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left text-sm hover:bg-background/60",
                    selected === c.id && "bg-background/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{c.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{c.messageCount} msgs</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.preview}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleString() : "-"}
                    {c.visitor ? ` · ${c.visitor}` : ""}
                  </p>
                </button>
              </li>
            ))}
            {!loading && chats.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">No conversations here yet.</li>
            )}
            {loading && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</li>}
          </ul>
          <div className="flex items-center justify-between border-t border-[var(--nb-line)] px-3 py-2 text-xs text-muted-foreground">
            <span>
              {total.toLocaleString()} total · page {page} of {pages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </section>

        <section ref={threadRef} className="min-h-[300px] scroll-mt-16 rounded-lg border border-[var(--nb-line)] bg-[var(--nb-surface)] p-4">
          {!selected && <p className="py-16 text-center text-sm text-muted-foreground">Select a conversation to read it.</p>}
          {selected && threadLoading && <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>}
          {selected && thread && !threadLoading && (
            <div className="space-y-3">
              <div className="border-b border-[var(--nb-line)] pb-2">
                <h2 className="text-sm font-medium">{thread.chat.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {thread.chat.startedAt ? `Started ${new Date(thread.chat.startedAt).toLocaleString()}` : ""}
                  {thread.chat.visitor ? ` · ${thread.chat.visitor}` : ""}
                </p>
              </div>
              <ul className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                {thread.messages.map((m, i) => (
                  <li key={i} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm",
                        m.role === "user" ? "bg-background" : "bg-signal/10",
                      )}
                    >
                      <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {m.role === "user" ? "Visitor" : "Assistant"}
                        {m.createdAt ? ` · ${new Date(m.createdAt).toLocaleTimeString()}` : ""}
                      </p>
                      {m.content}
                    </div>
                  </li>
                ))}
              </ul>
              {thread.truncated && (
                <p className="text-xs text-muted-foreground">Showing the first 500 messages of this conversation.</p>
              )}
              <p className="text-[11px] text-muted-foreground">Viewing this conversation was recorded in the audit log.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
