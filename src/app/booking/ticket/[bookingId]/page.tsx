"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { 
  FileText, Calendar, MapPin, User, Ticket as TicketIcon, 
  Printer, Download, ArrowLeft, Loader2, AlertCircle, 
  CheckCircle2, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TicketData {
  booking_code: string;
  event_name: string;
  date: string;
  venue: string | null;
  attendee: {
    answers: Array<{ label: string; value: any }>;
  };
  quantity: number;
  ticket_codes: string[];
  template_id: string;
}

function TicketViewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const userId = searchParams.get("userId");
  const visitorId = searchParams.get("visitorId");
  
  const [data, setData] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTicket() {
      if (!userId || !visitorId) {
        setError("Missing authorization parameters.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/embed/bookings/${params.bookingId}/ticket?userId=${userId}&visitorId=${visitorId}`);
        const result = await res.json();

        if (!res.ok) {
          setError(result.error || "Failed to load ticket.");
        } else {
          setData(result.ticket_data);
        }
      } catch (err) {
        setError("An unexpected error occurred while loading your ticket.");
      } finally {
        setLoading(false);
      }
    }

    fetchTicket();
  }, [params.bookingId, userId, visitorId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-12 w-12 text-[#36f4a4] animate-spin mb-4" />
        <p className="text-zinc-400 animate-pulse font-medium">Generating your tickets...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-zinc-400 max-w-xs mx-auto mb-8">{error || "This ticket is not available for download."}</p>
        <Button 
          variant="outline" 
          onClick={() => router.push("/")}
          className="rounded-full border-white/10 text-white hover:bg-white/5"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Return Home
        </Button>
      </div>
    );
  }

  const formattedDate = new Date(data.date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 selection:bg-[#36f4a4]/30">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header - Hidden on Print */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <div className="flex items-center gap-2 text-[#36f4a4] mb-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-bold uppercase tracking-widest">Booking Confirmed</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight">{data.event_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => window.print()}
              className="bg-white text-black hover:bg-zinc-200 font-bold rounded-full px-6"
            >
              <Printer className="mr-2 h-4 w-4" /> Print Tickets
            </Button>
            <Button 
              variant="outline" 
              disabled
              className="border-white/10 text-white/50 rounded-full px-6 cursor-not-allowed"
            >
              <Download className="mr-2 h-4 w-4" /> Save as PDF
            </Button>
          </div>
        </div>

        {/* Tickets Grid */}
        <div className="grid gap-8">
          {data.ticket_codes.map((code, index) => (
            <div 
              key={code} 
              className="relative flex flex-col md:flex-row bg-[#111111] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl hover:border-[#36f4a4]/20 transition-all duration-500 animate-in fade-in slide-in-from-bottom-8"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Left Section - QR Code */}
              <div className="w-full md:w-64 p-8 flex flex-col items-center justify-center bg-white text-black border-b md:border-b-0 md:border-r border-dashed border-zinc-300">
                <div className="p-3 bg-white rounded-xl shadow-inner border border-zinc-100 mb-4">
                  <QRCodeSVG value={code} size={160} level="H" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Scan to Check-in</p>
                  <p className="text-sm font-mono font-bold tracking-tighter">{code}</p>
                </div>
                
                {/* Visual Perforation Dots */}
                <div className="hidden md:block absolute -right-3 top-0 bottom-0 flex flex-col justify-around py-4 opacity-20 pointer-events-none">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="h-1.5 w-1.5 rounded-full bg-black" />
                  ))}
                </div>
              </div>

              {/* Right Section - Details */}
              <div className="flex-1 p-8 md:p-12 relative flex flex-col justify-between">
                {/* Template Badge */}
                <div className="absolute top-6 right-8 opacity-20 hidden md:block">
                  <Badge variant="outline" className="border-white/20 text-[10px] uppercase font-bold tracking-widest">
                    Ticket {index + 1} of {data.quantity}
                  </Badge>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <p className="text-[#36f4a4] text-xs font-black uppercase tracking-[0.2em]">Admission Pass</p>
                    <h2 className="text-3xl font-black tracking-tight">{data.event_name}</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-zinc-500 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Date & Time</p>
                        <p className="text-sm font-bold text-zinc-200">{formattedDate}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-zinc-500 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Venue</p>
                        <p className="text-sm font-bold text-zinc-200">{data.venue || "Global Event (Online)"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-zinc-500 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Attendee</p>
                        <div className="space-y-1">
                          {data.attendee.answers.slice(0, 3).map((ans, i) => (
                            <p key={i} className="text-xs font-medium text-zinc-300">
                              <span className="text-zinc-500 font-bold mr-1">{ans.label}:</span> {ans.value}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-zinc-500 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Booking Info</p>
                        <p className="text-xs font-medium text-zinc-300">Order Ref: <span className="font-bold text-[#36f4a4]">{data.booking_code}</span></p>
                        <p className="text-xs font-medium text-zinc-400 mt-1">Issued: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                  <ShieldCheck className="h-3 w-3" /> Encrypted & Verified by NochBot
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-4 pt-12 print:hidden border-t border-white/5 animate-in fade-in duration-1000 delay-500">
          <p className="text-zinc-500 text-xs italic">
            Please present the QR code(s) above at the entrance. Each code is valid for one-time check-in.
          </p>
          <div className="flex items-center justify-center gap-6">
            <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Secure Booking</span>
            <div className="h-1 w-1 rounded-full bg-zinc-800" />
            <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Instant Delivery</span>
            <div className="h-1 w-1 rounded-full bg-zinc-800" />
            <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Support: support@nochbot.space</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .min-h-screen { min-height: auto !important; padding: 0 !important; background: white !important; }
          .bg-[#111111] { background: white !important; border: 1px solid #e5e7eb !important; }
          .text-white { color: black !important; }
          .text-zinc-400, .text-zinc-500 { color: #4b5563 !important; }
          .shadow-2xl { shadow: none !important; }
          .border-white\\/5 { border-color: #e5e7eb !important; }
          .QRCodeSVG { width: 140px !important; height: 140px !important; }
          .flex-col { flex-direction: column !important; }
          .md\\:flex-row { flex-direction: row !important; }
        }
      `}</style>
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={null}>
      <TicketViewContent />
    </Suspense>
  );
}
