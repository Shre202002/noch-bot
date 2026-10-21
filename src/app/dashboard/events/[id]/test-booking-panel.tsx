"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, FlaskConical, Loader2, Lock, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { ReadinessStep } from "@/lib/eventReadiness";

/**
 * Try the event as an attendee before going live: the real booking chat, in test mode, inside the page. Only once
 * every required step is done; until then it says what is missing.
 */
export function TestBookingPanel({
  eventId,
  missing,
  testCount,
  paid,
  onFix,
  onChanged,
}: {
  eventId: string;
  /** Required steps still to do; empty means the event can be tested. */
  missing: ReadinessStep[];
  testCount: number;
  paid: boolean;
  onFix: (tab: string) => void;
  /** Re-read the test count after tests are made or cleared. */
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  const locked = missing.length > 0;

  const clear = async () => {
    if (!window.confirm("Remove all test bookings and test tickets for this event? Real bookings are not touched.")) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/bookings`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not clear the test bookings.");
      toast({ title: "Test bookings cleared" });
      setFrameKey((k) => k + 1);
      onChanged();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not clear the test bookings." });
    } finally {
      setClearing(false);
    }
  };

  if (locked) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="border-white/10 bg-card/30">
          <CardContent className="space-y-4 p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Lock aria-hidden="true" className="h-4 w-4 text-amber-300" /> Finish these steps to unlock the test
            </p>
            <ul className="divide-y divide-white/5">
              {missing.map((step) => (
                <li key={step.id} className="flex flex-wrap items-center gap-3 py-3">
                  <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{step.label}</p>
                    <p className="text-xs text-orange-300">{step.hint}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onFix(step.tab)} className="rounded-full border-orange-400/40 text-orange-200 cursor-pointer">
                    Fix this
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      <Card className="border-white/10 bg-card/30">
        <CardContent className="space-y-4 p-5">
          <ul className="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
            <li>Pick tickets, fill in the attendee form and confirm, just as an attendee would.</li>
            <li>{paid ? "Payment is simulated on a test page: no money is charged." : "This event is free, so the booking confirms straight away."}</li>
            <li>You can open and download the ticket. It carries a TEST ribbon and cannot be scanned.</li>
            <li>No real seats are used and no emails are sent. It appears in Bookings as a TESTED TICKET.</li>
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            {!running ? (
              <Button onClick={() => setRunning(true)} className="rounded-full bg-[#36f4a4] font-bold text-black shadow-[0_0_0_3px_rgba(54,244,164,0.18)] hover:bg-[#36f4a4]/90 cursor-pointer">
                <Play aria-hidden="true" className="mr-2 h-4 w-4" /> Start test booking
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setFrameKey((k) => k + 1)} className="rounded-full border-white/15 text-white cursor-pointer">
                Start over
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-full border-white/15 text-white cursor-pointer">
              <a href={`/test-booking/${eventId}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" className="mr-2 h-4 w-4" /> Open in a new tab
              </a>
            </Button>
            {testCount > 0 && (
              <>
                <Button asChild variant="ghost" className="rounded-full text-white/80 cursor-pointer">
                  <Link href={`/dashboard/bookings/${eventId}`}>View {testCount} test {testCount === 1 ? "booking" : "bookings"}</Link>
                </Button>
                <Button variant="ghost" onClick={clear} disabled={clearing} className="rounded-full text-red-300 hover:bg-red-500/10 cursor-pointer">
                  {clearing ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />}
                  Clear test bookings
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {running && (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <iframe
            key={frameKey}
            title="Test booking"
            src={`/test-booking/${eventId}`}
            className="h-[720px] w-full bg-[#f1f5f9]"
          />
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-black tracking-tight text-white">
        <FlaskConical aria-hidden="true" className="h-5 w-5 text-[#36f4a4]" /> Test your booking
      </h2>
      <p className="text-sm text-muted-foreground">Recommended before going live. See exactly what an attendee will see, from choosing tickets to downloading the ticket.</p>
    </div>
  );
}
