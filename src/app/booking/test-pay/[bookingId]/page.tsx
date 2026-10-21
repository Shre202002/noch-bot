"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = { status: string; ticket_page_url?: string; ticket_pdf_url?: string };

function TestPayContent() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const params = useSearchParams();
  const userId = params.get("userId") ?? "";
  const visitorId = params.get("visitorId") ?? "";

  const [busy, setBusy] = useState<"paid" | "failed" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const finish = async (outcome: "paid" | "failed") => {
    setBusy(outcome);
    setError("");
    try {
      const res = await fetch(`/api/embed/bookings/${bookingId}/test-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, visitorId, outcome }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not finish the test payment.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish the test payment.");
    } finally {
      setBusy(null);
    }
  };

  const missingIdentity = !userId || !visitorId;

  return (
    <main className="grid min-h-screen place-content-center bg-[#0a0a0a] p-6 text-white">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-amber-500/40 bg-[#111] p-8 shadow-2xl">
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200">
          <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">TEST PAYMENT. No money is charged and no card is needed.</p>
        </div>

        {result ? (
          <div className="space-y-5 text-center" role="status">
            {result.status === "confirmed" ? (
              <>
                <CheckCircle2 aria-hidden="true" className="mx-auto h-14 w-14 text-[#36f4a4]" />
                <div>
                  <h1 className="text-xl font-black">Test payment received</h1>
                  <p className="mt-1 text-sm text-white/60">Your test booking is confirmed. Go back to the chat to download the ticket, or open it here.</p>
                </div>
                {result.ticket_page_url && (
                  <Button asChild className="w-full rounded-full bg-[#36f4a4] font-bold text-black hover:bg-[#36f4a4]/90">
                    <a href={result.ticket_page_url}>View test ticket</a>
                  </Button>
                )}
              </>
            ) : (
              <>
                <XCircle aria-hidden="true" className="mx-auto h-14 w-14 text-red-400" />
                <div>
                  <h1 className="text-xl font-black">Test payment failed</h1>
                  <p className="mt-1 text-sm text-white/60">That is how a declined payment looks to an attendee. Go back to the chat to start again.</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-black">Complete your test payment</h1>
              <p className="mt-1 text-sm text-white/60">This stands in for your payment gateway, so you can see the whole booking as an attendee would.</p>
            </div>

            {missingIdentity && (
              <p role="alert" className="text-sm text-red-400">
                This link is missing its booking details. Start the test booking again from your dashboard.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="grid gap-3">
              <Button
                onClick={() => finish("paid")}
                disabled={!!busy || missingIdentity}
                className="h-12 w-full rounded-full bg-[#36f4a4] text-base font-black text-black hover:bg-[#36f4a4]/90"
              >
                {busy === "paid" && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                Pay (test)
              </Button>
              <Button
                variant="outline"
                onClick={() => finish("failed")}
                disabled={!!busy || missingIdentity}
                className="h-11 w-full rounded-full border-white/20 text-white"
              >
                {busy === "failed" && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                Fail payment (test)
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TestPayPage() {
  return (
    <Suspense fallback={null}>
      <TestPayContent />
    </Suspense>
  );
}
