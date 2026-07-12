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
import { Badge } from "@/components/ui/badge";

interface TicketData {
  booking_id: string;
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
  logo_url: string | null;
  bg_removed_logo_url?: string | null;
  remove_background?: boolean;
  ticket_color_palette?: {
    background_color: string;
    text_color: string;
    accent_color: string;
    border_color: string;
    muted_text_color: string;
    qr_background_color: string;
  };
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

  const palette = data.ticket_color_palette || {
    background_color: "#111111",
    text_color: "#ffffff",
    accent_color: "#36f4a4",
    border_color: "rgba(255,255,255,0.1)",
    muted_text_color: "#71717a",
    qr_background_color: "#ffffff"
  };

  const displayLogo = data.remove_background ? data.bg_removed_logo_url || data.logo_url : data.logo_url;

  const renderTemplate = (code: string, index: number) => {
    switch (data.template_id) {
      case 'minimal':
        return (
          <div 
            className="flex w-full flex-col md:flex-row rounded-xl overflow-hidden shadow-xl"
            style={{ backgroundColor: "#ffffff", color: "#000000", border: `1px solid ${palette.border_color}` }}
          >
            <div className="w-full md:w-48 p-6 flex flex-col items-center justify-center bg-zinc-50 border-b md:border-b-0 md:border-r border-dashed border-zinc-200">
              <div className="p-1 bg-white border border-zinc-100 rounded">
                <QRCodeSVG value={code} size={120} />
              </div>
              <p className="mt-4 text-[9px] font-bold uppercase text-zinc-400 tracking-tighter">Ticket {index + 1} of {data.quantity}</p>
            </div>
            <div className="flex-1 p-8 relative">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-black italic tracking-tighter leading-tight uppercase">{data.event_name}</h2>
                {displayLogo && <img src={displayLogo} alt="Logo" className="h-10 w-auto object-contain opacity-80" />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Attendee</p>
                  <p className="text-sm font-bold truncate">{data.attendee.answers.find(a => a.label.toLowerCase().includes('name'))?.value || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Date</p>
                  <p className="text-sm font-bold truncate">{new Date(data.date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'modern':
        return (
          <div 
            className="flex w-full flex-col md:flex-row rounded-2xl overflow-hidden shadow-2xl"
            style={{ backgroundColor: palette.background_color, color: palette.text_color }}
          >
            <div className="w-full md:w-40 p-6 flex items-center justify-center" style={{ backgroundColor: palette.qr_background_color }}>
              <QRCodeSVG value={code} size={100} fgColor={palette.background_color} />
            </div>
            <div className="flex-1 p-8">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black uppercase opacity-60 mb-2" style={{ color: palette.accent_color }}>Admission Pass</p>
                  <h2 className="text-3xl font-black leading-none uppercase tracking-tighter mb-4">{data.event_name}</h2>
                  <div className="flex items-center gap-4 text-xs font-bold opacity-80">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(data.date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {data.venue || "Global"}</span>
                  </div>
                </div>
                {displayLogo && <img src={displayLogo} alt="Logo" className="h-12 w-auto object-contain brightness-0 invert opacity-40" />}
              </div>
            </div>
          </div>
        );
      case 'classic':
        return (
          <div 
            className="w-full border-2 rounded-3xl overflow-hidden shadow-xl relative"
            style={{ backgroundColor: "#fdfbf7", color: "#433322", borderColor: "#e5e0d8" }}
          >
             <div className="absolute -left-3 top-[40%] h-6 w-6 rounded-full bg-[#0a0a0a]" />
             <div className="absolute -right-3 top-[40%] h-6 w-6 rounded-full bg-[#0a0a0a]" />
             <div className="p-8 text-center border-b-2 border-dashed border-[#e5e0d8]">
                <h2 className="text-3xl font-serif italic mb-1">{data.event_name}</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a09488]">Admission Pass • #{data.booking_code}</p>
             </div>
             <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="p-2 bg-white border border-[#e5e0d8] rounded-lg">
                  <QRCodeSVG value={code} size={130} />
                </div>
                <div className="flex-1 space-y-4 text-left w-full">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-[#a09488]">Attendee Details</p>
                    <p className="text-sm font-bold">{data.attendee.answers.slice(0, 2).map(a => a.value).join(" • ")}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-[#a09488]">Venue & Date</p>
                    <p className="text-xs font-medium">{data.venue || "TBA"} • {formattedDate}</p>
                  </div>
                </div>
             </div>
          </div>
        );
      case 'dark':
      default:
        return (
          <div 
            className="relative flex flex-col md:flex-row bg-[#111111] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl hover:border-[#36f4a4]/20 transition-all duration-500"
          >
            <div className="w-full md:w-64 p-8 flex flex-col items-center justify-center bg-white text-black border-b md:border-b-0 md:border-r border-dashed border-zinc-300">
              <div className="p-3 bg-white rounded-xl shadow-inner border border-zinc-100 mb-4">
                <QRCodeSVG value={code} size={160} level="H" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Scan to Check-in</p>
                <p className="text-sm font-mono font-bold tracking-tighter">{code}</p>
              </div>
            </div>
            <div className="flex-1 p-8 md:p-12 relative flex flex-col justify-between">
              <div className="space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-[#36f4a4] text-xs font-black uppercase tracking-[0.2em]">Admission Pass</p>
                    <h2 className="text-3xl font-black tracking-tight">{data.event_name}</h2>
                  </div>
                  {displayLogo && <img src={displayLogo} alt="Logo" className="h-12 w-auto object-contain" />}
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
              </div>
              <div className="mt-12 flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                <ShieldCheck className="h-3 w-3" /> Encrypted & Verified by NochBot
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
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
          </div>
        </div>

        <div className="grid gap-8">
          {data.ticket_codes.map((code, index) => (
            <div key={code}>
              {renderTemplate(code, index)}
            </div>
          ))}
        </div>

        <div className="text-center space-y-4 pt-12 print:hidden border-t border-white/5">
          <p className="text-zinc-500 text-xs italic">
            Please present the QR code(s) above at the entrance. Each code is valid for one-time check-in.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .min-h-screen { min-height: auto !important; padding: 0 !important; background: white !important; }
          .text-white { color: black !important; }
          .print\:hidden { display: none !important; }
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
