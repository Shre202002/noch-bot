"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, UserCheck, Undo2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Group = "all" | "confirmed" | "awaiting_payment" | "needs_attention" | "closed" | "in_progress";

type Ticket = { ticket_code: string; status: string; scanned_at: string | null };

type Row = {
  id: string;
  booking_code?: string;
  attendee: { name: string | null; email: string | null; phone: string | null };
  quantity: number;
  amount_total: number | null;
  currency?: string;
  status: string;
  status_label: string;
  group: Group | null;
  created_at: string;
  tickets: Ticket[];
  checked_in: number;
  actions: Array<"mark_refunded" | "cancel">;
};

type Response = {
  bookings: Row[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<Exclude<Group, "all">, number>;
  truncated: boolean;
};

const FILTERS: Array<{ value: Group; label: string }> = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "closed", label: "Closed" },
  { value: "in_progress", label: "In progress" },
];

const ACTION_LABELS = { mark_refunded: "Mark as refunded", cancel: "Cancel booking" } as const;
const ACTION_CONFIRM = {
  mark_refunded: "Confirm you have refunded this payment in your payment provider.",
  cancel: "Cancel this booking and release its held seats?",
} as const;

const badgeTone = (group: Group | null) =>
  group === "confirmed" ? "border-emerald-500/40 text-emerald-300"
  : group === "needs_attention" ? "border-amber-500/50 text-amber-300"
  : group === "awaiting_payment" ? "border-sky-500/40 text-sky-300"
  : "border-white/15 text-white/60";

export function BookingsPanel({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const requestId = useRef(0);

  // Search waits for a pause in typing, and starts again from page 1.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ group, page: String(page) });
      if (query) qs.set("q", query);
      const res = await fetch(`/api/events/${eventId}/bookings?${qs}`);
      const body = await res.json().catch(() => ({}));
      if (id !== requestId.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(body.error || "Could not load bookings.");
      setData(body);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Could not load bookings.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [eventId, group, page, query]);

  useEffect(() => { load(); }, [load]);

  const act = async (bookingId: string, body: Record<string, string>, key: string, success: string) => {
    setBusyKey(key);
    try {
      const res = await fetch(`/api/events/${eventId}/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: result.error || "That did not work.", variant: "destructive" });
      } else {
        toast({ title: success });
      }
      await load();
    } finally {
      setBusyKey(null);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const money = (r: Row) =>
    r.amount_total == null ? "Free" : `${r.currency ? r.currency.toUpperCase() + " " : ""}${r.amount_total}`;

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by attendee, email, booking reference or ticket code"
          aria-label="Search bookings"
          className="bg-black/40 border-white/10 pl-9 text-white"
        />
      </div>

      <div role="group" aria-label="Filter bookings" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.value === "all" ? undefined : data?.counts[f.value];
          const active = group === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => { setGroup(f.value); setPage(1); }}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                active ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-white/60 hover:text-white"
              }`}
            >
              {f.label}{count != null ? ` (${count})` : ""}
              {f.value === "needs_attention" && count ? <span className="sr-only"> need action</span> : null}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle aria-hidden="true" className="h-4 w-4" /> {error}
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </p>
      )}

      <div aria-live="polite" aria-busy={loading}>
        {loading && !data ? (
          <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading bookings…</p>
        ) : data && data.bookings.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/50">
            {query ? "No bookings match your search." : "No bookings here yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {data?.bookings.map((r) => (
              <li key={r.id}>
                <Card className="border-border bg-card/30">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{r.attendee.name || r.attendee.email || "Unnamed attendee"}</p>
                        <p className="truncate text-sm text-white/50">
                          {[r.attendee.name ? r.attendee.email : null, r.attendee.phone].filter(Boolean).join(" · ") || "No contact details"}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
                          {r.booking_code ?? r.id} · {r.quantity} {r.quantity === 1 ? "ticket" : "tickets"} · {money(r)} ·{" "}
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={badgeTone(r.group)}>{r.status_label}</Badge>
                    </div>

                    {r.tickets.length > 0 && (
                      <ul className="space-y-2 border-t border-white/5 pt-3">
                        {r.tickets.map((t) => {
                          const key = `${r.id}:${t.ticket_code}`;
                          const checkedIn = t.status === "scanned";
                          return (
                            <li key={t.ticket_code} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="font-mono text-white/80">{t.ticket_code}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-white/50">
                                  {checkedIn
                                    ? `Checked in${t.scanned_at ? ` ${new Date(t.scanned_at).toLocaleTimeString()}` : ""}`
                                    : t.status === "active" ? "Not checked in" : `Ticket ${t.status}`}
                                </span>
                                {checkedIn ? (
                                  <Button variant="outline" size="sm" disabled={busyKey === key}
                                    aria-label={`Undo check-in for ticket ${t.ticket_code}`}
                                    onClick={() => act(r.id, { action: "undo_check_in", ticket_code: t.ticket_code }, key, "Check-in undone.")}>
                                    <Undo2 aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Undo
                                  </Button>
                                ) : t.status === "active" && r.status === "confirmed" ? (
                                  <Button size="sm" disabled={busyKey === key}
                                    aria-label={`Check in ticket ${t.ticket_code}`}
                                    onClick={() => act(r.id, { action: "check_in", ticket_code: t.ticket_code }, key, "Checked in.")}>
                                    {busyKey === key ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UserCheck aria-hidden="true" className="mr-1 h-3.5 w-3.5" />}
                                    Check in
                                  </Button>
                                ) : null}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {r.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
                        {r.actions.map((a) => (
                          <Button key={a} variant="outline" size="sm" disabled={busyKey === `${r.id}:${a}`}
                            onClick={() => {
                              if (window.confirm(ACTION_CONFIRM[a])) {
                                act(r.id, { action: a }, `${r.id}:${a}`, a === "cancel" ? "Booking cancelled." : "Marked as refunded.");
                              }
                            }}>
                            {ACTION_LABELS[a]}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data?.truncated && (
        <p className="text-xs text-amber-300">Search covers the 5,000 most recent bookings. Narrow the filter to see older ones.</p>
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {totalPages} · {data.total} bookings</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
