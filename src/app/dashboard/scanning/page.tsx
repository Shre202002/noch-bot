"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, ChevronRight, Loader2, Plus, ScanLine, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type EventRow = {
  id: string;
  name: string;
  status: string;
  start_at: string | null;
  venue: string | null;
  confirmed_tickets: number;
  checked_in: number;
};

export default function ScanningOverviewPage() {
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
        <h1 className="text-4xl font-black tracking-tight">Scanning</h1>
        <p className="mt-1 text-muted-foreground">Share a scanner link with your door staff, approve them, and watch tickets get scanned live.</p>
      </div>

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
              <p className="text-sm text-muted-foreground">Create and publish an event, then come back to set up scanning.</p>
            </div>
            <Button asChild variant="signal" className="cursor-pointer">
              <Link href="/dashboard/events/new"><Plus aria-hidden="true" className="mr-2 h-4 w-4" /> Create event</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {events?.map((e) => (
            <li key={e.id}>
              <Link href={`/dashboard/scanning/${e.id}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                <Card className="h-full border-foreground/10 bg-card/40 transition-colors group-hover:border-foreground/25">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-foreground">{e.name}</h2>
                        <p className="truncate text-sm text-foreground/50">
                          {[e.start_at ? new Date(e.start_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : null, e.venue].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Badge variant={e.status === "published" ? "default" : "secondary"}>{e.status.toUpperCase()}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm text-foreground/70">
                        <UserCheck aria-hidden="true" className="h-4 w-4" />
                        <span><b className="text-foreground">{e.checked_in}</b> of {e.confirmed_tickets} scanned</span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-signal">
                        <ScanLine aria-hidden="true" className="h-4 w-4" /> Open scanning <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
