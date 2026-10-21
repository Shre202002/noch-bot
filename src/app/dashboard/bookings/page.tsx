"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, ChevronRight, Loader2, Plus, Ticket, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmbedCodeCard } from "@/components/EmbedCodeCard";

type EventRow = {
  id: string;
  name: string;
  status: string;
  start_at: string | null;
  venue: string | null;
  capacity: number;
  tickets_sold: number;
  counts: { confirmed: number; awaiting_payment: number; needs_attention: number; closed: number; in_progress: number };
  confirmed_tickets: number;
  checked_in: number;
  tests: number;
};

export default function BookingsOverviewPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    fetch("/api/bookings/overview")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not load your events.");
        setEvents(body.events ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your events."));
  };

  useEffect(load, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div>
        <h1 className="text-4xl font-black tracking-tight">Bookings</h1>
        <p className="mt-1 text-muted-foreground">Choose an event to see who booked, their details, and to check people in.</p>
      </div>

      <EmbedCodeCard compact />

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle aria-hidden="true" className="h-4 w-4" /> {error}
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </p>
      )}

      {!events && !error ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 aria-label="Loading events" className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : events && events.length === 0 ? (
        <Card className="border-dashed bg-transparent py-16 text-center">
          <CardContent className="space-y-4">
            <span className="mx-auto grid size-14 place-content-center rounded-full bg-accent/30">
              <Calendar aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
            </span>
            <div>
              <p className="text-lg font-bold">No events yet</p>
              <p className="text-sm text-muted-foreground">Bookings appear here once you create and publish an event.</p>
            </div>
            <Button asChild className="rounded-full bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 font-bold cursor-pointer">
              <Link href="/dashboard/events/new"><Plus aria-hidden="true" className="mr-2 h-4 w-4" /> Create event</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {events?.map((e) => {
            const total = Object.values(e.counts).reduce((a, b) => a + b, 0) - e.counts.in_progress;
            return (
              <li key={e.id}>
                <Link
                  href={`/dashboard/bookings/${e.id}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#36f4a4]"
                >
                  <Card className="h-full border-white/10 bg-card/40 transition-colors group-hover:border-white/25">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-bold text-white">{e.name}</h2>
                          <p className="truncate text-sm text-white/50">
                            {[e.start_at ? new Date(e.start_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : null, e.venue].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Badge variant={e.status === "published" ? "default" : "secondary"}>{e.status.toUpperCase()}</Badge>
                      </div>

                      <dl className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-white/5 p-3">
                          <dt className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-white/50"><Ticket aria-hidden="true" className="h-3 w-3" /> Booked</dt>
                          <dd className="text-xl font-black text-white">{e.confirmed_tickets}<span className="text-sm font-normal text-white/40"> / {e.capacity}</span></dd>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <dt className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-white/50"><UserCheck aria-hidden="true" className="h-3 w-3" /> Checked in</dt>
                          <dd className="text-xl font-black text-white">{e.checked_in}</dd>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <dt className="text-[11px] uppercase tracking-wide text-white/50">Bookings</dt>
                          <dd className="text-xl font-black text-white">{total}</dd>
                        </div>
                      </dl>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {e.counts.awaiting_payment > 0 && (
                            <span className="rounded-full border border-sky-500/40 px-2.5 py-1 text-sky-300">{e.counts.awaiting_payment} awaiting payment</span>
                          )}
                          {e.counts.needs_attention > 0 && (
                            <span className="rounded-full border border-amber-500/50 px-2.5 py-1 text-amber-300">{e.counts.needs_attention} need attention</span>
                          )}
                          {e.tests > 0 && (
                            <span className="rounded-full border border-red-500/50 px-2.5 py-1 text-red-200">{e.tests} test</span>
                          )}
                          {total === 0 && e.tests === 0 && <span className="text-white/40">No bookings yet</span>}
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#36f4a4]">
                          View bookings <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
