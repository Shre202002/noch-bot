"use client";

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface FormField {
  _id: string;
  field_key: string;
  label: string;
  field_type: string;
}

interface EventData {
  _id: string;
  name: string;
  start_at: string;
  venue: string | null;
  logo_url: string | null;
  bg_removed_logo_url?: string | null;
  remove_background?: boolean;
  form_fields: FormField[];
}

interface TicketPreviewProps {
  event: EventData;
  templateId: string;
}

export function TicketPreview({ event, templateId }: TicketPreviewProps) {
  const ticketCode = "EVT-DEMO-123456";
  const formattedDate = new Date(event.start_at).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Decide which logo to show
  const displayLogoUrl = event.remove_background && event.bg_removed_logo_url 
    ? event.bg_removed_logo_url 
    : event.logo_url;

  // Dummy attendee data for preview based on actual form fields
  const attendeeDetails = event.form_fields.map(field => ({
    label: field.label,
    value: field.field_key === 'full_name' ? "John Doe" : field.field_key === 'email' ? "john@example.com" : "Sample Info"
  }));

  const logoImg = displayLogoUrl ? (
    <img 
      src={displayLogoUrl} 
      alt="Logo" 
      className="max-h-16 max-w-32 object-contain" 
    />
  ) : null;

  switch (templateId) {
    case 'minimal': // Template 1 — "Boarding Pass"
      return (
        <div className="flex w-full max-w-[500px] bg-white text-slate-900 border-4 border-emerald-500 rounded-xl overflow-hidden shadow-2xl font-serif">
          <div className="w-1/3 p-4 flex flex-col items-center justify-center border-r-2 border-dashed border-slate-200">
            <div className="p-2 bg-white border border-slate-100 rounded">
              <QRCodeSVG value={ticketCode} size={100} />
            </div>
            <p className="mt-4 text-[9px] font-sans font-bold uppercase tracking-tighter opacity-50">Ticket Number</p>
            <p className="text-[10px] font-sans font-black">{ticketCode}</p>
          </div>
          <div className="flex-1 p-6 relative">
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-2xl font-black italic tracking-tighter leading-tight uppercase max-w-[70%]">
                {event.name}
              </h2>
              {logoImg}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-auto">
              <div className="col-span-1">
                <p className="text-[8px] font-sans font-bold uppercase text-emerald-600 mb-1">Attendee</p>
                <p className="text-[10px] font-sans font-black uppercase truncate">John Doe</p>
              </div>
              <div className="col-span-1">
                <p className="text-[8px] font-sans font-bold uppercase text-emerald-600 mb-1">Event Date</p>
                <p className="text-[10px] font-sans font-black uppercase truncate">{formattedDate}</p>
              </div>
              <div className="col-span-1">
                <p className="text-[8px] font-sans font-bold uppercase text-emerald-600 mb-1">Venue</p>
                <p className="text-[10px] font-sans font-black uppercase truncate">{event.venue || "TBA"}</p>
              </div>
            </div>
            <div className="absolute top-2 right-2 text-[8px] font-sans font-black text-slate-300 uppercase tracking-widest">
              Boarding Pass
            </div>
          </div>
        </div>
      );

    case 'classic': // Template 2 — "Vintage/Raffle"
      return (
        <div className="w-full max-w-[340px] bg-[#fcf9f2] border-2 border-[#dcb] text-[#432] rounded-3xl overflow-hidden shadow-xl relative">
          <div className="absolute -left-3 top-[35%] h-6 w-6 rounded-full bg-slate-900 border-2 border-[#dcb]" />
          <div className="absolute -right-3 top-[35%] h-6 w-6 rounded-full bg-slate-900 border-2 border-[#dcb]" />
          <div className="p-8 text-center border-b-2 border-dashed border-[#dcb]/50">
            <p className="absolute top-4 left-4 text-[9px] font-bold opacity-30"># {ticketCode}</p>
            <h2 className="text-4xl font-serif italic mb-2 tracking-tighter">{event.name}</h2>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Admission Ticket</p>
          </div>
          <div className="p-8 flex flex-col items-center">
            <div className="bg-white p-3 rounded-lg border border-[#dcb] mb-6 shadow-inner">
              <QRCodeSVG value={ticketCode} size={140} />
            </div>
            <div className="w-full space-y-3">
              {attendeeDetails.map((detail, i) => (
                <div key={i} className="flex justify-between border-b border-[#dcb]/30 pb-1">
                  <span className="text-[10px] font-black uppercase opacity-40">{detail.label}</span>
                  <span className="text-xs font-bold">{detail.value}</span>
                </div>
              ))}
              <div className="flex justify-between border-b border-[#dcb]/30 pb-1">
                <span className="text-[10px] font-black uppercase opacity-40">Date</span>
                <span className="text-xs font-bold">{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'modern': // Template 3 — "Bold/Graphic"
      return (
        <div className="w-full max-w-[500px] bg-blue-600 text-white rounded-2xl overflow-hidden shadow-2xl flex">
          <div className="w-[140px] bg-white p-6 flex flex-col items-center justify-center shrink-0">
            <QRCodeSVG value={ticketCode} size={90} fgColor="#2563eb" />
            <p className="mt-4 text-[8px] font-black text-blue-600 uppercase tracking-tighter text-center">
              {ticketCode}
            </p>
          </div>
          <div className="flex-1 p-8 flex flex-col justify-between relative">
            <div className="space-y-1">
              <h2 className="text-3xl font-black leading-none uppercase tracking-tighter">
                {event.name}
              </h2>
              <p className="text-sm font-medium text-blue-100 opacity-80">
                {formattedDate} • {event.venue || "Global Venue"}
              </p>
            </div>
            <div className="flex justify-between items-end mt-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-blue-200">Admit One</p>
                <p className="text-xl font-black">John Doe</p>
              </div>
              {logoImg && <div className="brightness-0 invert opacity-50">{logoImg}</div>}
            </div>
          </div>
        </div>
      );

    case 'dark': // Template 4 — "Branded/Premium"
    default:
      return (
        <div className="w-full max-w-[340px] bg-[#0c0c1d] border border-zinc-800 text-white rounded-[2rem] overflow-hidden shadow-2xl relative p-8 font-sans">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full border-2 border-[#d4af37] p-1 bg-black flex items-center justify-center overflow-hidden">
              {displayLogoUrl ? (
                <img src={displayLogoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-zinc-800" />
              )}
            </div>
          </div>
          <div className="relative mb-8 px-4 py-6 text-center">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#d4af37]" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#d4af37]" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#d4af37]" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#d4af37]" />
            <h2 className="text-2xl font-black tracking-tight text-[#d4af37] leading-tight">
              {event.name}
            </h2>
          </div>
          <div className="bg-white rounded-3xl p-6 flex flex-col items-center mb-8 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <QRCodeSVG value={ticketCode} size={140} />
            <p className="mt-4 text-[11px] font-mono font-bold text-zinc-500 tracking-widest">
              [{ticketCode}]
            </p>
          </div>
          <div className="space-y-4">
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />
            <div className="space-y-2">
              {attendeeDetails.map((detail, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="font-black text-[#d4af37] uppercase min-w-[70px]">{detail.label} :</span>
                  <span className="font-medium text-white/90">{detail.value}</span>
                </div>
              ))}
              <div className="flex gap-2 text-[11px]">
                <span className="font-black text-[#d4af37] uppercase min-w-[70px]">Date :</span>
                <span className="font-medium text-white/90">{formattedDate}</span>
              </div>
            </div>
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />
          </div>
          <div className="mt-8 text-right">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
              Powered by NochBot
            </p>
          </div>
        </div>
      );
  }
}
