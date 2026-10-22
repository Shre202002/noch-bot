"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Attendee = {
  code: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  bookingCode: string | null;
  label: string;
  status: string;
  scannedAt: string | null;
  scannedBy: string | null;
};
type Scanner = { id: string; loginId: string; name?: string; status: "pending" | "approved" | "rejected" | "blocked"; createdAt: string; lastLoginAt: string | null; signedIn: boolean };
type Feed = {
  eventName: string;
  counts: { total: number; scanned: number; remaining: number };
  link: { slug: string; active: boolean } | null;
  scanners: Scanner[];
  pendingScanners: number;
  cursor: string | null;
  scans: Attendee[];
  attendees: Attendee[] | null;
};

const POLL_MS = 1000;
const POLL_TIMEOUT_MS = 8000;
// This many failed polls in a row with nothing yet loaded: stop showing a spinner and say what is wrong.
const GIVE_UP_AFTER = 3;
const EPOCH = "1970-01-01T00:00:00.000Z";
// A count mismatch reloads the whole list, but never more often than this (tickets can lag behind a booking for a moment).
const FULL_RELOAD_MIN_MS = 5000;
const MAX_BACKOFF_MS = 10_000;
const FLASH_MS = 4000;
const MAX_ROWS = 300;

const SCANNER_STATUS: Record<Scanner["status"], { label: string; color: string }> = {
  pending: { label: "Waiting for approval", color: "#eab308" },
  approved: { label: "Approved", color: "var(--color-signal, #36f4a4)" },
  rejected: { label: "Declined", color: "#9ca3af" },
  blocked: { label: "Blocked", color: "#ef4444" },
};
const SCANNER_ACTIONS: Record<Scanner["status"], Array<{ action: string; label: string; primary?: boolean }>> = {
  pending: [{ action: "approve", label: "Approve", primary: true }, { action: "reject", label: "Decline" }],
  approved: [{ action: "block", label: "Block" }, { action: "signout", label: "Sign out" }, { action: "remove", label: "Remove" }],
  rejected: [{ action: "approve", label: "Approve" }, { action: "remove", label: "Remove" }],
  blocked: [{ action: "unblock", label: "Unblock", primary: true }, { action: "remove", label: "Remove" }],
};

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
const who = (a: Attendee) => a.name || a.email || a.phone || a.label;

/** True when the viewport is at least `px` wide; used to draw one attendee layout instead of both. */
function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => true
  );
}

// A row only redraws when its own attendee changes or its highlight starts or ends, not on every poll.
const AttendeeRow = memo(function AttendeeRow({ a, flashed }: { a: Attendee; flashed: boolean }) {
  return (
    <tr className={`border-t border-white/5 transition-colors duration-1000 ${flashed ? "bg-signal/15" : ""}`}>
      <td dir="auto" className="max-w-[16rem] truncate py-2 pr-3 font-semibold text-white">{a.name || "—"}</td>
      <td className="max-w-[18rem] break-words py-2 pr-3 text-white/70">{[a.email, a.phone].filter(Boolean).join(" · ") || "—"}</td>
      <td className="py-2 pr-3 text-white/70"><span className="font-mono text-xs">{a.code}</span><br /><span className="text-xs text-white/60">{a.label}</span></td>
      <td className="py-2 pr-3">{a.status === "scanned" ? <Badge className="bg-signal text-black">Scanned</Badge> : <Badge variant="secondary">{a.status === "active" ? "Not yet" : a.status}</Badge>}</td>
      <td className="py-2 pr-3 tabular-nums text-white/70">{time(a.scannedAt) || "—"}</td>
      <td className="py-2 text-white/70">{a.scannedBy || "—"}</td>
    </tr>
  );
});

const AttendeeCard = memo(function AttendeeCard({ a, flashed }: { a: Attendee; flashed: boolean }) {
  return (
    <li className={`rounded-xl border border-white/10 p-3 transition-colors duration-1000 ${flashed ? "bg-signal/15" : "bg-white/[0.03]"}`}>
      <div className="flex items-start justify-between gap-2">
        <p dir="auto" className="min-w-0 truncate font-semibold text-white">{a.name || "—"}</p>
        {a.status === "scanned" ? <Badge className="shrink-0 bg-signal text-black">Scanned</Badge> : <Badge variant="secondary" className="shrink-0">{a.status === "active" ? "Not yet" : a.status}</Badge>}
      </div>
      {(a.email || a.phone) && <p className="mt-0.5 break-words text-sm text-white/70">{[a.email, a.phone].filter(Boolean).join(" · ")}</p>}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-white/60">
        <span className="font-mono">{a.code}</span>
        <span>{a.label}</span>
        {a.scannedAt && <span className="tabular-nums">{time(a.scannedAt)}{a.scannedBy ? ` · ${a.scannedBy}` : ""}</span>}
      </p>
    </li>
  );
});

export default function EventScanningPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [attendees, setAttendees] = useState<Map<string, Attendee>>(new Map());
  const [recent, setRecent] = useState<Attendee[]>([]);
  const [flash, setFlash] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const isWide = useMinWidth(768);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "scanned" | "not_yet">("all");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<{ title: string; body: string; action: string; destructive?: boolean; run: () => void } | null>(null);
  const [notice, setNotice] = useState("");

  // Polling state lives in refs so the loop never restarts or overlaps.
  const cursor = useRef<string | null>(null);
  const needFull = useRef(true);
  const known = useRef<Map<string, Attendee>>(new Map());
  const failures = useRef(0);
  const lastFull = useRef(0);
  const lastSignature = useRef("");
  const localScanned = useRef(0);
  const refreshNow = useRef<() => void>(() => {});

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const poll = async () => {
      if (stopped || inFlight) return;
      if (document.hidden) { timer = setTimeout(poll, POLL_MS); return; }
      inFlight = true;
      let delay = POLL_MS;
      try {
        const full = needFull.current;
        const qs = full ? "?full=1" : `?since=${encodeURIComponent(cursor.current ?? EPOCH)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(`/api/events/${eventId}/scan-feed${qs}`, { cache: "no-store", signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.error || "Could not load scanning data."), { status: res.status });
        if (stopped) return;

        // Nothing new (no scans, same counts, link and accounts): there is nothing to redraw.
        const signature = JSON.stringify([data.eventName, data.counts, data.link, data.scanners]);
        const unchanged = !data.attendees && (data.scans as Attendee[]).length === 0 && signature === lastSignature.current;
        lastSignature.current = signature;

        if (!unchanged) {
        const next = new Map(known.current);
        const fresh: Attendee[] = [];
        if (data.attendees) {
          next.clear();
          for (const a of data.attendees as Attendee[]) next.set(a.code, a);
        }
        for (const s of data.scans as Attendee[]) {
          const before = next.get(s.code);
          if (!before || before.status !== "scanned") fresh.push(s);
          next.set(s.code, { ...(before ?? s), ...s });
        }
        known.current = next;
        localScanned.current = [...next.values()].filter((a) => a.status === "scanned").length;
        if (data.cursor) cursor.current = data.cursor;
        else if (data.attendees) cursor.current = null;
        if (data.attendees) lastFull.current = Date.now();

        setAttendees(next);
        setFeed((prev) => ({ ...(prev ?? {}), ...data, attendees: null } as Feed));
        if (full && data.attendees) {
          const latest = (data.attendees as Attendee[]).filter((a) => a.status === "scanned").sort((a, b) => String(b.scannedAt).localeCompare(String(a.scannedAt))).slice(0, 15);
          setRecent(latest);
        } else if (fresh.length) {
          setRecent((prev) => [...fresh.sort((a, b) => String(b.scannedAt).localeCompare(String(a.scannedAt))), ...prev].slice(0, 15));
          setFlash((prev) => {
            const m = new Map(prev);
            for (const f of fresh) m.set(f.code, Date.now() + FLASH_MS);
            return m;
          });
        }
        }

        // The list is out of date when the counts disagree with it (a booking arrived, or a check-in was undone): reload it whole.
        needFull.current =
          !data.attendees &&
          (localScanned.current !== data.counts.scanned || known.current.size !== data.counts.total) &&
          Date.now() - lastFull.current > FULL_RELOAD_MIN_MS;
        failures.current = 0;
        setFailedCount(0);
        setReconnecting(false);
        setError("");
      } catch (e) {
        failures.current += 1;
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 404) {
          setError(status === 401 ? "Please sign in again." : "Event not found.");
          stopped = true;
          return;
        }
        if (failures.current >= 2) setReconnecting(true);
        setFailedCount(failures.current);
        delay = Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** failures.current);
      } finally {
        inFlight = false;
        if (!stopped) timer = setTimeout(poll, delay);
      }
    };

    refreshNow.current = () => { needFull.current = true; clearTimeout(timer); void poll(); };
    void poll();
    const onVisible = () => { if (!document.hidden) { clearTimeout(timer); void poll(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [eventId]);

  // Lets the "just scanned" highlight fade: one timer for the next expiry, and none once nothing is highlighted.
  useEffect(() => {
    if (flash.size === 0) return;
    const next = Math.min(...flash.values());
    const t = setTimeout(() => setFlash((prev) => new Map([...prev].filter(([, until]) => until > Date.now()))), Math.max(0, next - Date.now()) + 20);
    return () => clearTimeout(t);
  }, [flash]);
  const isFlashed = (code: string) => (flash.get(code) ?? 0) > Date.now();

  const act = useCallback(async (key: string, url: string, body: unknown, method = "POST") => {
    setBusy(key);
    setNotice("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That did not work. Try again.");
      refreshNow.current();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That did not work. Try again.");
    } finally {
      setBusy("");
    }
  }, []);

  const linkUrl = feed?.link ? `${typeof window === "undefined" ? "" : window.location.origin}/scan/${feed.link.slug}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(linkUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setNotice("Copy failed. Select the link and copy it."); }
  };

  const deferredQuery = useDeferredValue(query);
  const rows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return [...attendees.values()]
      .filter((a) => (filter === "all" ? true : filter === "scanned" ? a.status === "scanned" : a.status !== "scanned"))
      .filter((a) => !q || [a.name, a.email, a.phone, a.code, a.bookingCode].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (a.status === "scanned" ? 0 : 1) - (b.status === "scanned" ? 0 : 1) || String(b.scannedAt).localeCompare(String(a.scannedAt)) || (a.name ?? "").localeCompare(b.name ?? ""));
  }, [attendees, deferredQuery, filter]);

  if (error && !feed) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-16 text-center">
        <p role="alert" className="flex items-center justify-center gap-2 text-red-400"><AlertCircle aria-hidden="true" className="h-5 w-5" /> {error}</p>
        <Button asChild variant="outline"><Link href="/dashboard/scanning">Back to events</Link></Button>
      </div>
    );
  }
  if (!feed && failedCount >= GIVE_UP_AFTER) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-16 text-center">
        <p role="alert" className="flex items-center justify-center gap-2 text-amber-300"><AlertCircle aria-hidden="true" className="h-5 w-5" /> Could not load the scanning data. Check your connection.</p>
        <Button variant="outline" onClick={() => { setFailedCount(0); refreshNow.current(); }}>Try again</Button>
      </div>
    );
  }
  if (!feed) {
    return <div className="flex h-64 items-center justify-center"><Loader2 aria-label="Loading scanning data" className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" /></div>;
  }

  const { counts } = feed;
  const percent = counts.total ? Math.round((counts.scanned / counts.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard/scanning" className="mb-2 inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> All events
          </Link>
          <h1 dir="auto" className="break-words text-3xl font-black tracking-tight">{feed.eventName}</h1>
          <p className="text-sm text-muted-foreground">Ticket scanning and visitor data, updating live.</p>
        </div>
        <span role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${error ? "border-red-500/50 text-red-300" : reconnecting ? "border-amber-500/50 text-amber-300" : "border-signal/40 text-signal"}`}>
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${error ? "bg-red-400" : reconnecting ? "bg-amber-400" : "motion-safe:animate-pulse bg-signal"}`} />
          {error ? "Stopped" : reconnecting ? "Reconnecting…" : "Live"}
        </span>
      </div>

      {error && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" /> {error} The numbers below are no longer updating.
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload</Button>
        </p>
      )}
      {notice && <p role="alert" className="text-sm text-amber-300">{notice}</p>}

      <section aria-label="Door counts" className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Scanned", value: counts.scanned, tone: "text-signal", icon: UserCheck },
          { label: "Not yet", value: counts.remaining, tone: "text-white", icon: Users },
          { label: "Total", value: counts.total, tone: "text-white", icon: Users },
        ].map((s) => (
          <Card key={s.label} className="border-white/10 bg-card/40">
            <CardContent className="p-3 sm:p-5">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/50"><s.icon aria-hidden="true" className="h-3.5 w-3.5" /> {s.label}</p>
              <p className={`mt-1 text-3xl font-black tabular-nums sm:text-4xl ${s.tone}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
        <div className="col-span-3">
          <div className="flex items-center justify-between text-xs text-white/60"><span>Checked in</span><span>{percent}%</span></div>
          <div role="progressbar" aria-label="Share of tickets checked in" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-signal transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card className="min-w-0 border-white/10 bg-card/40">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-bold">Live scans</h2>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">No tickets scanned yet. Scans appear here the moment they happen.</p>
            ) : (
              <ul aria-live="polite" className="space-y-2">
                {recent.map((a) => (
                  <li key={a.code} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors duration-1000 ${isFlashed(a.code) ? "bg-signal/20" : "bg-white/5"}`}>
                    <div className="min-w-0">
                      <p dir="auto" className="truncate font-semibold text-white">{who(a)}</p>
                      <p className="truncate text-xs text-white/50">{a.code} · {a.label}</p>
                    </div>
                    <div className="min-w-0 max-w-[45%] shrink-0 text-right text-xs text-white/60">
                      <p className="tabular-nums">{time(a.scannedAt)}</p>
                      {a.scannedBy && <p dir="auto" className="truncate">by {a.scannedBy}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="border-white/10 bg-card/40">
            <CardContent className="space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 aria-hidden="true" className="h-5 w-5" /> Scanner link</h2>
              {!feed.link ? (
                <>
                  <p className="text-sm text-white/60">Share one link with your door staff. They create an account, you approve them, and they can scan this event&apos;s tickets only.</p>
                  <Button variant="signal" disabled={busy === "create"} onClick={() => act("create", `/api/events/${eventId}/scanner-link`, { action: "create" })}>
                    {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : null} Create scanner link
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Input readOnly aria-label="Scanner link" value={linkUrl} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 max-sm:h-11 max-sm:text-base" />
                    <Button size="sm" variant="outline" onClick={copy} aria-label="Copy link" className="max-sm:size-11">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                    <Button size="sm" variant="outline" asChild aria-label="Open link" className="max-sm:size-11"><a href={linkUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                  </div>
                  {!feed.link.active && <p className="text-sm text-amber-300">This link is switched off: nobody can sign in or scan with it.</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="max-sm:min-h-11" disabled={!!busy} onClick={() => act("toggle", `/api/events/${eventId}/scanner-link`, { action: feed.link!.active ? "disable" : "enable" })}>
                      {feed.link.active ? "Switch off" : "Switch on"}
                    </Button>
                    <Button size="sm" variant="outline" className="max-sm:min-h-11" disabled={!!busy} onClick={() => setConfirming({ title: "Make a new scanner link?", body: "The old link stops working and every scanner is signed out. Their accounts are kept, and they sign in again at the new link.", action: "Make new link", run: () => void act("rotate", `/api/events/${eventId}/scanner-link`, { action: "rotate" }) })}>
                      <RefreshCw aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> New link
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/40">
            <CardContent className="space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                Scanner accounts
                {feed.pendingScanners > 0 && <Badge className="bg-amber-500/90 text-black">{feed.pendingScanners} waiting</Badge>}
              </h2>
              {feed.scanners.length === 0 ? (
                <p className="text-sm text-white/50">No one has signed up yet.</p>
              ) : (
                <ul className="space-y-2">
                  {[...feed.scanners].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)).map((s) => (
                    <li key={s.id} className="rounded-xl bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p dir="auto" className="min-w-0 truncate font-semibold text-white">{s.name || s.loginId}{s.name && <span className="ml-2 text-xs font-normal text-white/50">{s.loginId}</span>}</p>
                        <span className="shrink-0 text-xs font-semibold" style={{ color: SCANNER_STATUS[s.status].color }}>
                          {SCANNER_STATUS[s.status].label}{s.status === "approved" && s.signedIn ? " · signed in" : ""}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {SCANNER_ACTIONS[s.status].map((a) => (
                          <Button key={a.action} size="sm" variant={a.primary ? "signal" : "outline"} disabled={busy === s.id + a.action}
                            className="max-sm:min-h-11"
                            onClick={() => {
                              const run = () => void act(s.id + a.action, `/api/events/${eventId}/scanner-users/${s.id}`, { action: a.action }, "PATCH");
                              if (a.action === "remove") setConfirming({ title: `Remove ${s.name || s.loginId}?`, body: "This account can no longer sign in or scan. Tickets it already scanned stay scanned.", action: "Remove", destructive: true, run });
                              else run();
                            }}>
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-white/10 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Attendees <span className="text-sm font-normal text-white/50">({rows.length})</span></h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, code" aria-label="Search attendees" className="w-full pl-8 max-sm:h-11 max-sm:text-base sm:w-56" />
              </div>
              {(["all", "scanned", "not_yet"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={`rounded-full border px-3 py-1.5 text-sm max-sm:min-h-11 max-sm:px-4 ${filter === f ? "border-signal bg-signal/15 text-signal" : "border-white/15 text-white/70 hover:text-white"}`}>
                  {f === "all" ? "All" : f === "scanned" ? "Scanned" : "Not yet"}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">{attendees.size === 0 ? "No confirmed tickets yet." : "No one matches."}</p>
          ) : (
            <>
            {isWide ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-white/50">
                    <tr><th className="py-2 pr-3">Attendee</th><th className="py-2 pr-3">Contact</th><th className="py-2 pr-3">Ticket</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Scanned</th><th className="py-2">By</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, MAX_ROWS).map((a) => <AttendeeRow key={a.code} a={a} flashed={isFlashed(a.code)} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {rows.slice(0, MAX_ROWS).map((a) => <AttendeeCard key={a.code} a={a} flashed={isFlashed(a.code)} />)}
              </ul>
            )}
            {rows.length > MAX_ROWS && <p className="pt-3 text-center text-xs text-white/50">Showing the first {MAX_ROWS}. Use search to find the rest.</p>}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirming} onOpenChange={(open) => { if (!open) setConfirming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirming?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={confirming?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={() => confirming?.run()}>
              {confirming?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
