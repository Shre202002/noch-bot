"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

function BookingCancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingId = searchParams.get("bid");
  const sessionId = searchParams.get("sid");

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
        <XCircle className="h-10 w-10 text-amber-500" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
      <p className="text-zinc-400 max-w-sm mb-2">
        Your payment was not completed and no charge has been made.
      </p>
      {bookingId && (
        <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold mb-8">
          Booking: <span className="text-zinc-400">{bookingId}</span>
        </p>
      )}
      {!bookingId && <div className="mb-8" />}

      <p className="text-zinc-500 text-sm max-w-xs mb-8">
        Your ticket hold may still be active for a few minutes — if you&apos;d like to complete
        the booking, please return to the chat and try again.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 border border-white/10 hover:bg-white/5 text-white rounded-full transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}

export default function BookingCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <BookingCancelContent />
    </Suspense>
  );
}
