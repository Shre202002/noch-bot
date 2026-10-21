"use client";

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { TicketColorPalette } from '@/models/Event';
import { TICKET_TEMPLATE_DEFAULT_PALETTES, isFaceTemplate } from '@/lib/ticketTemplates';
import { resolveTicketLogo } from '@/lib/ticketEmblems';
import { TicketFace } from '@/components/TicketFace';

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
  ticket_color_palette?: TicketColorPalette;
  logo_emblem?: string | null;
}

interface TicketPreviewProps {
  event: EventData;
  templateId: string;
}

// The palettes now live in the shared registry; re-exported so existing imports keep working.
export { TICKET_TEMPLATE_DEFAULT_PALETTES };

export function TicketPreview({ event, templateId }: TicketPreviewProps) {
  const ticketCode = "EVT-DEMO-123456";
  const formattedDate = new Date(event.start_at).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const palette = event.ticket_color_palette || TICKET_TEMPLATE_DEFAULT_PALETTES[templateId] || TICKET_TEMPLATE_DEFAULT_PALETTES.dark;

  // Decide which logo to show: an uploaded image, else the chosen emblem
  const displayLogoUrl = resolveTicketLogo(event, palette);

  // Dummy attendee data for preview based on actual form fields
  const attendeeDetails = event.form_fields.map(field => ({
    label: field.label,
    value: field.field_key === 'full_name' ? "John Doe" : field.field_key === 'email' ? "john@example.com" : "Sample Info"
  }));

  const logoImg = displayLogoUrl ? (
    <img 
      src={displayLogoUrl} 
      alt="Logo" 
      className="max-h-12 max-w-24 object-contain" 
    />
  ) : null;

  if (isFaceTemplate(templateId)) {
    return (
      <TicketFace
        templateId={templateId}
        palette={palette}
        eventName={event.name}
        dateText={formattedDate}
        venue={event.venue}
        attendeeName="John Doe"
        code={ticketCode}
        ticketLabel="Ticket 1 of 1"
        logoUrl={displayLogoUrl}
        details={attendeeDetails.filter((d) => d.label.toLowerCase() !== 'full name' && d.label.toLowerCase() !== 'name')}
      />
    );
  }

  switch (templateId) {
    case 'minimal': // Template 1 — "Boarding Pass"
      return (
        <div 
          className="flex w-full max-w-[500px] border-4 rounded-xl overflow-hidden shadow-2xl font-sans"
          style={{ backgroundColor: palette.background_color, color: palette.text_color, borderColor: palette.accent_color }}
        >
          <div className="w-1/3 p-4 flex flex-col items-center justify-center border-r-2 border-dashed" style={{ borderColor: palette.border_color }}>
            <div className="p-2 rounded shadow-sm" style={{ backgroundColor: palette.qr_background_color }}>
              <QRCodeSVG value={ticketCode} size={100} />
            </div>
            <p className="mt-4 text-[9px] font-bold uppercase tracking-tighter opacity-50" style={{ color: palette.muted_text_color }}>Ticket Number</p>
            <p className="text-[10px] font-black">{ticketCode}</p>
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
                <p className="text-[8px] font-bold uppercase mb-1" style={{ color: palette.accent_color }}>Attendee</p>
                <p className="text-[10px] font-black uppercase truncate">John Doe</p>
              </div>
              <div className="col-span-1">
                <p className="text-[8px] font-bold uppercase mb-1" style={{ color: palette.accent_color }}>Event Date</p>
                <p className="text-[10px] font-black uppercase truncate">{formattedDate}</p>
              </div>
              <div className="col-span-1">
                <p className="text-[8px] font-bold uppercase mb-1" style={{ color: palette.accent_color }}>Venue</p>
                <p className="text-[10px] font-black uppercase truncate">{event.venue || "TBA"}</p>
              </div>
            </div>
            <div className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-widest" style={{ color: palette.border_color }}>
              Boarding Pass
            </div>
          </div>
        </div>
      );

    case 'classic': // Template 2 — "Vintage/Raffle"
      return (
        <div 
          className="w-full max-w-[340px] border-2 rounded-3xl overflow-hidden shadow-xl relative"
          style={{ backgroundColor: palette.background_color, color: palette.text_color, borderColor: palette.border_color }}
        >
          <div className="absolute -left-3 top-[35%] h-6 w-6 rounded-full bg-black/10 border-2" style={{ borderColor: palette.border_color }} />
          <div className="absolute -right-3 top-[35%] h-6 w-6 rounded-full bg-black/10 border-2" style={{ borderColor: palette.border_color }} />
          <div className="p-8 text-center border-b-2 border-dashed" style={{ borderColor: palette.border_color }}>
            <p className="absolute top-4 left-4 text-[9px] font-bold opacity-30" style={{ color: palette.muted_text_color }}># {ticketCode}</p>
            {displayLogoUrl && <img src={displayLogoUrl} alt="Logo" className="mx-auto mb-3 max-h-10 max-w-28 object-contain" />}
            <h2 className="text-3xl font-serif italic mb-2 tracking-tighter">{event.name}</h2>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60" style={{ color: palette.accent_color }}>Admission Ticket</p>
          </div>
          <div className="p-8 flex flex-col items-center">
            <div className="p-3 rounded-lg border mb-6 shadow-inner" style={{ backgroundColor: palette.qr_background_color, borderColor: palette.border_color }}>
              <QRCodeSVG value={ticketCode} size={140} />
            </div>
            <div className="w-full space-y-3">
              {attendeeDetails.map((detail, i) => (
                <div key={i} className="flex justify-between border-b pb-1" style={{ borderColor: palette.border_color }}>
                  <span className="text-[10px] font-black uppercase opacity-40" style={{ color: palette.muted_text_color }}>{detail.label}</span>
                  <span className="text-xs font-bold">{detail.value}</span>
                </div>
              ))}
              <div className="flex justify-between border-b pb-1" style={{ borderColor: palette.border_color }}>
                <span className="text-[10px] font-black uppercase opacity-40" style={{ color: palette.muted_text_color }}>Date</span>
                <span className="text-xs font-bold">{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'modern': // Template 3 — "Bold/Graphic"
      return (
        <div 
          className="w-full max-w-[500px] rounded-2xl overflow-hidden shadow-2xl flex"
          style={{ backgroundColor: palette.background_color, color: palette.text_color }}
        >
          <div className="w-[140px] p-6 flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: palette.qr_background_color }}>
            <QRCodeSVG value={ticketCode} size={90} fgColor={palette.background_color} />
            <p className="mt-4 text-[8px] font-black uppercase tracking-tighter text-center" style={{ color: palette.background_color }}>
              {ticketCode}
            </p>
          </div>
          <div className="flex-1 p-8 flex flex-col justify-between relative">
            <div className="space-y-1">
              <h2 className="text-3xl font-black leading-none uppercase tracking-tighter">
                {event.name}
              </h2>
              <p className="text-sm font-medium opacity-80" style={{ color: palette.muted_text_color }}>
                {formattedDate} • {event.venue || "Global Venue"}
              </p>
            </div>
            <div className="flex justify-between items-end mt-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase opacity-70" style={{ color: palette.accent_color }}>Admit One</p>
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
        <div 
          className="w-full max-w-[340px] border rounded-[2rem] overflow-hidden shadow-2xl relative p-8 font-sans"
          style={{ backgroundColor: palette.background_color, color: palette.text_color, borderColor: palette.border_color }}
        >
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full border-2 p-1 bg-black/40 flex items-center justify-center overflow-hidden" style={{ borderColor: palette.accent_color }}>
              {displayLogoUrl ? (
                <img src={displayLogoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-zinc-800" />
              )}
            </div>
          </div>
          <div className="relative mb-8 px-4 py-6 text-center">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: palette.accent_color }} />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: palette.accent_color }} />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: palette.accent_color }} />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: palette.accent_color }} />
            <h2 className="text-2xl font-black tracking-tight leading-tight" style={{ color: palette.accent_color }}>
              {event.name}
            </h2>
          </div>
          <div className="rounded-3xl p-6 flex flex-col items-center mb-8 shadow-2xl" style={{ backgroundColor: palette.qr_background_color }}>
            <QRCodeSVG value={ticketCode} size={140} />
            <p className="mt-4 text-[11px] font-mono font-bold tracking-widest" style={{ color: palette.background_color }}>
              [{ticketCode}]
            </p>
          </div>
          <div className="space-y-4">
            <div className="h-[1px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${palette.accent_color}80, transparent)` }} />
            <div className="space-y-2">
              {attendeeDetails.map((detail, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="font-black uppercase min-w-[70px]" style={{ color: palette.accent_color }}>{detail.label} :</span>
                  <span className="font-medium opacity-90">{detail.value}</span>
                </div>
              ))}
              <div className="flex gap-2 text-[11px]">
                <span className="font-black uppercase min-w-[70px]" style={{ color: palette.accent_color }}>Date :</span>
                <span className="font-medium opacity-90">{formattedDate}</span>
              </div>
            </div>
            <div className="h-[1px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${palette.accent_color}80, transparent)` }} />
          </div>
          <div className="mt-8 text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: palette.muted_text_color }}>
              Powered by NochBot
            </p>
          </div>
        </div>
      );
  }
}
