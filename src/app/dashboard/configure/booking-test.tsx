"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FlaskConical, Loader2 } from "lucide-react";

type ReadyEvent = { id: string; name: string; status: string; start_at: string; is_paid: boolean };

/**
 * Try an event booking from the chatbot preview: the real booking chat in test mode, for any event that is complete
 * enough to publish (drafts included). Nothing real is taken, sent or charged, and the booking shows in Bookings as a
 * TESTED TICKET.
 */
export function BookingPreview() {
  const [events, setEvents] = useState<ReadyEvent[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [started, setStarted] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events/test-ready")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load your events.");
        if (cancelled) return;
        setEvents(data.events ?? []);
        if (data.events?.[0]) setSelected(data.events[0].id);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load your events."));
    return () => {
      cancelled = true;
    };
  }, []);

  const box = "max-w-[560px] rounded-xl border border-[#2a2d35] bg-[#0a0a0a] p-5 text-sm text-white";

  if (error) return <div role="alert" className={`${box} text-red-400`}>{error}</div>;

  if (!events) {
    return (
      <div className={`${box} flex items-center gap-2 text-white/60`} role="status">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Loading your events…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`${box} space-y-2`}>
        <p className="flex items-center gap-2 font-semibold">
          <FlaskConical aria-hidden="true" className="h-4 w-4 text-[#36f4a4]" /> No event is ready to test yet
        </p>
        <p className="text-white/60">
          An event can be tested once its details, attendee form, ticket design (and payments, for a paid event) are done.
        </p>
        <Link href="/dashboard/events" className="inline-block font-semibold text-[#36f4a4] underline-offset-4 hover:underline">
          Go to your events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[560px] space-y-4">
      <div className={`${box} space-y-3`}>
        <p className="text-white/70">
          Book a ticket here exactly as a visitor would. Nothing real is taken: no seats, no emails and no money. It appears in
          Bookings as a <span className="font-bold text-red-200">TESTED TICKET</span>.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="test-event">Event to test</label>
          <select
            id="test-event"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setStarted(false);
            }}
            className="min-w-0 flex-1 rounded-lg border border-[#2a2d35] bg-[#1f2228] px-3 py-2 text-sm text-white"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.status}{e.is_paid ? ", paid" : ""})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setStarted(true);
              setFrameKey((k) => k + 1);
            }}
            className="cursor-pointer rounded-full bg-[#36f4a4] px-5 py-2 text-sm font-semibold text-black"
          >
            {started ? "Start over" : "Start test booking"}
          </button>
          <a
            href={`/test-booking/${selected}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" /> New tab
          </a>
        </div>
      </div>

      {started && selected && (
        <div className="overflow-hidden rounded-xl border border-[#2a2d35]">
          <iframe key={frameKey} title="Event booking preview" src={`/test-booking/${selected}`} className="h-[680px] w-full bg-[#f1f5f9]" />
        </div>
      )}
    </div>
  );
}
