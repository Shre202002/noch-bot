"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingsPanel } from "@/components/bookings/bookings-panel";

type EventRow = {
  id: string;
  name: string;
  status: string;
  start_at: string | null;
  venue: string | null;
  capacity: number;
  counts: { confirmed: number; awaiting_payment: number; needs_attention: number; closed: number; in_progress: number };
  confirmed_tickets: number;
  checked_in: number;
};

export default function EventBookingsPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = String(params.eventId);
  const [event, setEvent] = useState<EventRow | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookings/overview")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not load this event.");
        // The overview only lists the signed-in organizer's events, so an id that is not theirs is simply not found.
        if (!cancelled) setEvent((body.events as EventRow[]).find((e) => e.id === eventId) ?? null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load this event."));
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-3 rounded-full text-white/70 cursor-pointer">
      <Link href="/dashboard/bookings"><ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" /> All events</Link>
    </Button>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 pb-20">
        {back}
        <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle aria-hidden="true" className="h-4 w-4" /> {error}
        </p>
      </div>
    );
  }

  if (event === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 aria-label="Loading event" className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 pb-20">
        {back}
        <h1 className="text-2xl font-black">Event not found</h1>
        <p className="text-muted-foreground">It may have been deleted, or it belongs to another account.</p>
      </div>
    );
  }

  const stats = [
    { label: "Tickets booked", value: `${event.confirmed_tickets} / ${event.capacity}` },
    { label: "Checked in", value: String(event.checked_in) },
    { label: "Awaiting payment", value: String(event.counts.awaiting_payment) },
    { label: "Need attention", value: String(event.counts.needs_attention), alert: event.counts.needs_attention > 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <div className="space-y-4">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-white">{event.name}</h1>
              <Badge variant={event.status === "published" ? "default" : "secondary"}>{event.status.toUpperCase()}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[event.start_at ? new Date(event.start_at).toLocaleString() : null, event.venue].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full border-white/15 text-white cursor-pointer">
            <Link href={`/dashboard/events/${event.id}`}><Settings aria-hidden="true" className="mr-2 h-4 w-4" /> Event settings</Link>
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.alert ? "border-amber-500/40 bg-amber-500/5" : "border-white/10 bg-card/40"}`}>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-white/50">{s.label}</dt>
            <dd className={`mt-1 text-2xl font-black ${s.alert ? "text-amber-300" : "text-white"}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Bookings">
        <BookingsPanel eventId={event.id} />
      </section>
    </div>
  );
}
