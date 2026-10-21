"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Ticket as TicketIcon, ArrowRight } from "lucide-react";

type StatusResponse = {
  status: string;
  payment_status?: string;
  booking_code?: string;
  can_download_ticket?: boolean;
  download_url?: string;
  error?: string;
};

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingId = searchParams.get("bid");
  const sessionId = searchParams.get("sid");
  const userId = searchParams.get("userId");
  const visitorId = searchParams.get("visitorId");

  const [status, setStatus] = useState<"checking" | "confirmed" | "pending" | "failed">("checking");
  const [data, setData] = useState<StatusResponse | null>(null);

  const fetchStatus = useCallback(async () => {
    // Bot (conversational) flow: verify via the session status endpoint
    if (sessionId && !bookingId) {
      try {
        const res = await fetch(`/api/bot/booking/${sessionId}`);
        const result = await res.json();

        if (!res.ok) {
          setStatus("failed");
          return;
        }

        // Terminal statuses come back at the top level; active ones under data
        const bookingStatus: string = result.status ?? result.data?.conversation_state;
        if (bookingStatus === "confirmed") {
          setStatus("confirmed");
        } else if (bookingStatus === "awaiting_payment" || bookingStatus === "in_progress") {
          setStatus("pending");
        } else if (bookingStatus === "expired" || bookingStatus === "cancelled") {
          setStatus("failed");
        } else {
          setStatus("pending");
        }
      } catch {
        setStatus("pending");
      }
      return;
    }

    // Embed flow: verify via the booking status endpoint
    if (!bookingId || !userId || !visitorId) {
      setStatus("failed");
      return;
    }

    try {
      const res = await fetch(
        `/api/embed/bookings/${bookingId}/status?userId=${userId}&visitorId=${visitorId}`
      );
      const result: StatusResponse = await res.json();

      if (!res.ok) {
        setStatus("failed");
        return;
      }

      setData(result);

      if (result.status === "confirmed" && result.can_download_ticket) {
        setStatus("confirmed");
      } else if (result.status === "pending_payment" || result.status === "awaiting_payment") {
        setStatus("pending");
      } else if (result.status === "expired" || result.status === "cancelled" || result.status === "failed") {
        setStatus("failed");
      } else {
        setStatus("pending");
      }
    } catch {
      setStatus("pending");
    }
  }, [bookingId, sessionId, userId, visitorId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while payment is still settling (webhook may take a few seconds)
  useEffect(() => {
    if (status !== "pending") return;
    const interval = setInterval(fetchStatus, 4000);
    const timeout = setTimeout(() => clearInterval(interval), 60000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, fetchStatus]);

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-12 w-12 text-[#36f4a4] animate-spin mb-6" />
        <p className="text-zinc-400 animate-pulse font-medium">Verifying your booking...</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Booking Not Found</h1>
        <p className="text-zinc-400 max-w-sm mb-8">
          We couldn&apos;t verify this booking. If you completed a payment, please check your
          email for confirmation or contact support.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        >
          Return to Home
        </button>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-12 w-12 text-[#36f4a4] animate-spin mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Finalizing Your Booking</h1>
        <p className="text-zinc-400 max-w-sm">
          Your payment is being confirmed. This page will update automatically — you don&apos;t
          need to do anything.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-[#36f4a4]/20 blur-3xl rounded-full" />
        <CheckCircle2 className="h-16 w-16 text-[#36f4a4] relative z-10" />
      </div>

      <h1 className="text-3xl font-black text-white tracking-tight mb-2">You&apos;re All Set! 🎉</h1>
      <p className="text-zinc-400 max-w-sm mb-4">
        Your booking has been confirmed and your tickets have been issued.
      </p>

      {data?.booking_code && (
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-8">
          Booking Code: <span className="text-[#36f4a4]">{data.booking_code}</span>
        </p>
      )}

      {data?.download_url && (
        <button
          onClick={() => router.push(data.download_url!)}
          className="flex items-center gap-2 px-8 py-3 bg-[#36f4a4] hover:bg-[#2ed98c] text-black font-bold rounded-full transition-colors"
        >
          <TicketIcon className="h-4 w-4" />
          View Your Tickets
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <BookingSuccessContent />
    </Suspense>
  );
}
