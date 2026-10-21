"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

type Status =
  | { state: "loading" }
  | { state: "error"; message: string; missing?: Array<{ id: string; label: string }> }
  | { state: "ready" };

/**
 * Hosts the real booking widget in test mode for one event. It is shown inside an iframe on the dashboard (and can be
 * opened on its own), so the widget never mixes with the dashboard's styles or state. Only the signed-in organizer
 * gets past the status check, and the server enforces the same rules again for every booking request.
 */
export default function TestBookingPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    let script: HTMLScriptElement | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/test-status`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 401) return setStatus({ state: "error", message: "Sign in to your dashboard to test a booking." });
        if (!res.ok) return setStatus({ state: "error", message: data.error || "Could not start the test." });
        if (!data.ready) {
          return setStatus({ state: "error", message: "Finish every setup step before testing.", missing: data.missing });
        }

        setStatus({ state: "ready" });
        script = document.createElement("script");
        script.src = "/embed.js";
        script.defer = true;
        script.setAttribute("data-user-id", data.user_id);
        script.setAttribute("data-test", "true");
        script.setAttribute("data-event-id", String(eventId));
        script.setAttribute("data-open", "true");
        document.body.appendChild(script);
      } catch {
        if (!cancelled) setStatus({ state: "error", message: "Could not start the test. Check your connection and try again." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <main className="grid min-h-screen place-content-center bg-[#f1f5f9] p-6 text-slate-800">
      {status.state === "loading" && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Starting your test booking…
        </p>
      )}

      {status.state === "error" && (
        <div role="alert" className="max-w-sm space-y-2 text-center">
          <AlertCircle aria-hidden="true" className="mx-auto h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold">{status.message}</p>
          {status.missing && status.missing.length > 0 && (
            <ul className="text-sm text-slate-600">
              {status.missing.map((m) => (
                <li key={m.id}>{m.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status.state === "ready" && (
        <p className="max-w-xs text-center text-sm text-slate-500">
          The test chat is open at the bottom right. Book as an attendee would: nothing real is taken, sent or charged.
        </p>
      )}
    </main>
  );
}
