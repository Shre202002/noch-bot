"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

/**
 * @fileOverview Secure internal payment bridge page for SDK-based gateways (Razorpay).
 */
function PaymentBridgeContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initPayment() {
      if (!token) {
        setError("Invalid payment access link.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/booking/pay/${params.bookingId}?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load payment details");
          setLoading(false);
          return;
        }

        if (data.provider === "razorpay") {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = () => {
            const options = {
              key: data.key_id,
              amount: Math.round(data.amount * 100),
              currency: data.currency,
              name: "NochBot",
              description: data.description,
              order_id: data.order_id,
              handler: function (response: any) {
                router.push(`/booking/success?bid=${params.bookingId}&pay_id=${response.razorpay_payment_id}`);
              },
              prefill: data.prefill,
              theme: { color: "#36f4a4" },
              modal: {
                ondismiss: function() {
                    router.push(`/booking/cancel?bid=${params.bookingId}`);
                }
              }
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.open();
            setLoading(false);
          };
          document.body.appendChild(script);
        } else {
           setError("Unsupported payment provider for this secure bridge.");
           setLoading(false);
        }
      } catch (err) {
        setError("An unexpected error occurred.");
        setLoading(false);
      }
    }

    initPayment();
  }, [params.bookingId, router, token]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Payment Error</h1>
        <p className="text-zinc-400 max-w-sm">{error}</p>
        <button 
            onClick={() => router.push('/')}
            className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        >
            Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-[#36f4a4]/20 blur-3xl rounded-full animate-pulse" />
        <Loader2 className="h-16 w-16 text-[#36f4a4] animate-spin relative z-10" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Preparing Secure Checkout</h1>
      <p className="text-zinc-500 text-sm max-w-xs mx-auto">
        Please wait while we connect to the payment provider. Do not refresh this page.
      </p>
      <div className="mt-12 flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
        <ShieldCheck className="h-3 w-3" /> Encrypted Transaction
      </div>
    </div>
  );
}

export default function PaymentBridgePage() {
  return (
    <Suspense fallback={null}>
      <PaymentBridgeContent />
    </Suspense>
  );
}
