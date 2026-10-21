"use client";

import React from "react";
import { QRCodeSVG as RawQRCodeSVG } from "qrcode.react";
import type { TicketColorPalette } from "@/models/Event";
import type { FaceTemplateId } from "@/lib/ticketTemplates";

// The QR code only depends on its value and colour, so it skips redraws while other colours are dragged.
const QRCodeSVG = React.memo(RawQRCodeSVG);

export type TicketFaceProps = {
  templateId: FaceTemplateId;
  palette: TicketColorPalette;
  eventName: string;
  dateText: string;
  venue: string | null;
  attendeeName: string;
  code: string;
  /** e.g. "Ticket 2 of 3". */
  ticketLabel?: string;
  logoUrl?: string | null;
  /** Extra answers from the attendee form, shown by designs that have room for them. */
  details?: Array<{ label: string; value: string }>;
};

/**
 * The newer ticket designs, drawn from one set of props so the dashboard preview and the attendee's ticket page can
 * never look different. Colours come only from the palette, so every colour the organizer picks is honoured.
 */
function TicketFaceImpl(props: TicketFaceProps) {
  switch (props.templateId) {
    case "neon":
      return <Neon {...props} />;
    case "sunset":
      return <Sunset {...props} />;
    case "festival":
      return <Festival {...props} />;
    case "badge":
      return <Badge {...props} />;
    case "receipt":
      return <Receipt {...props} />;
  }
}

const Logo = ({ url, className }: { url?: string | null; className?: string }) =>
  url ? <img src={url} alt="" className={className ?? "max-h-10 max-w-24 object-contain"} /> : null;

const Field = ({ label, value, color, muted }: { label: string; value: string; color?: string; muted?: string }) => (
  <div className="min-w-0">
    <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: muted }}>{label}</p>
    <p className="truncate text-sm font-bold" style={{ color }}>{value}</p>
  </div>
);

function Neon({ palette: p, eventName, dateText, venue, attendeeName, code, ticketLabel, logoUrl }: TicketFaceProps) {
  return (
    <div
      className="mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border-2 sm:flex-row"
      style={{
        backgroundColor: p.background_color,
        color: p.text_color,
        borderColor: p.border_color,
        boxShadow: `0 0 0 1px ${p.accent_color}55, 0 0 32px ${p.border_color}66`,
      }}
    >
      <div className="relative flex-1 space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: p.accent_color, textShadow: `0 0 12px ${p.accent_color}` }}>
            Admit one
          </p>
          <Logo url={logoUrl} />
        </div>
        <h2 className="text-3xl font-black uppercase leading-none tracking-tight" style={{ textShadow: `0 0 18px ${p.border_color}` }}>
          {eventName}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Attendee" value={attendeeName} muted={p.muted_text_color} />
          <Field label="Date" value={dateText} muted={p.muted_text_color} />
          <Field label="Venue" value={venue || "To be announced"} muted={p.muted_text_color} />
          {ticketLabel && <Field label="Ticket" value={ticketLabel} muted={p.muted_text_color} />}
        </div>
      </div>
      <div className="flex flex-row items-center justify-center gap-4 border-t-2 border-dashed p-5 sm:w-44 sm:flex-col sm:border-l-2 sm:border-t-0" style={{ borderColor: p.border_color }}>
        <div className="rounded-xl p-2" style={{ backgroundColor: p.qr_background_color, boxShadow: `0 0 20px ${p.accent_color}66` }}>
          <QRCodeSVG value={code} size={104} />
        </div>
        <p className="break-all text-center font-mono text-[10px] tracking-wider" style={{ color: p.muted_text_color }}>{code}</p>
      </div>
    </div>
  );
}

function Sunset({ palette: p, eventName, dateText, venue, attendeeName, code, ticketLabel, logoUrl }: TicketFaceProps) {
  return (
    <div
      className="mx-auto w-full max-w-[520px] overflow-hidden rounded-3xl p-6 shadow-2xl"
      style={{ background: `linear-gradient(135deg, ${p.background_color}, ${p.accent_color})`, color: p.text_color }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em]" style={{ borderColor: `${p.text_color}88` }}>
          Admission
        </p>
        <Logo url={logoUrl} />
      </div>
      <h2 className="mt-6 text-4xl font-black leading-[0.95] tracking-tight">{eventName}</h2>
      <p className="mt-2 text-sm font-medium" style={{ color: p.muted_text_color }}>{dateText}</p>

      <div className="mt-6 flex items-center gap-5 rounded-2xl border p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(255,255,255,0.14)", borderColor: `${p.border_color}66` }}>
        <div className="grid min-w-0 flex-1 gap-3">
          <Field label="Attendee" value={attendeeName} muted={p.muted_text_color} />
          <Field label="Venue" value={venue || "To be announced"} muted={p.muted_text_color} />
          {ticketLabel && <Field label="Ticket" value={ticketLabel} muted={p.muted_text_color} />}
        </div>
        <div className="shrink-0 rounded-xl p-2" style={{ backgroundColor: p.qr_background_color }}>
          <QRCodeSVG value={code} size={92} />
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[10px] tracking-widest" style={{ color: p.muted_text_color }}>{code}</p>
    </div>
  );
}

function Festival({ palette: p, eventName, dateText, venue, attendeeName, code, ticketLabel, logoUrl }: TicketFaceProps) {
  return (
    <div
      className="mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl border-4 sm:flex-row"
      style={{ backgroundColor: p.background_color, color: p.text_color, borderColor: p.border_color }}
    >
      <div className="flex-1 p-5">
        <div className="mb-4 h-3 w-full" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${p.accent_color} 0 8px, transparent 8px 16px)` }} aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter">{eventName}</h2>
          <Logo url={logoUrl} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="Name" value={attendeeName} muted={p.muted_text_color} />
          <Field label="When" value={dateText} muted={p.muted_text_color} />
          <Field label="Where" value={venue || "To be announced"} muted={p.muted_text_color} />
          {ticketLabel && <Field label="Ticket" value={ticketLabel} muted={p.muted_text_color} />}
        </div>
      </div>
      <div className="flex flex-row items-center justify-center gap-4 border-t-4 border-dashed p-4 sm:w-40 sm:flex-col sm:border-l-4 sm:border-t-0" style={{ borderColor: p.border_color }}>
        <p className="text-xs font-black uppercase tracking-[0.3em] sm:[writing-mode:vertical-rl] sm:rotate-180">Admit one</p>
        <div className="rounded-lg border-2 p-1.5" style={{ backgroundColor: p.qr_background_color, borderColor: p.border_color }}>
          <QRCodeSVG value={code} size={92} />
        </div>
        <p className="break-all text-center font-mono text-[9px] font-bold">{code}</p>
      </div>
    </div>
  );
}

function Badge({ palette: p, eventName, dateText, venue, attendeeName, code, ticketLabel, logoUrl, details }: TicketFaceProps) {
  return (
    <div
      className="mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border shadow-xl"
      style={{ backgroundColor: p.background_color, color: p.text_color, borderColor: p.border_color }}
    >
      <div className="relative px-6 pb-6 pt-7 text-center" style={{ backgroundColor: p.accent_color, color: "#ffffff" }}>
        <span className="absolute left-1/2 top-2.5 h-2 w-14 -translate-x-1/2 rounded-full bg-black/25" aria-hidden="true" />
        <Logo url={logoUrl} className="mx-auto mb-2 max-h-10 max-w-28 object-contain brightness-0 invert" />
        <h2 className="text-xl font-black leading-tight">{eventName}</h2>
        <p className="mt-1 text-xs opacity-85">{dateText}</p>
      </div>
      <div className="space-y-1 px-6 pb-2 pt-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: p.muted_text_color }}>Attendee</p>
        <p className="break-words text-3xl font-black leading-tight">{attendeeName}</p>
        <p className="text-xs" style={{ color: p.muted_text_color }}>{venue || "To be announced"}</p>
      </div>
      {details && details.length > 0 && (
        <dl className="mx-6 mt-3 space-y-1 border-t pt-3 text-xs" style={{ borderColor: p.border_color }}>
          {details.slice(0, 3).map((d) => (
            <div key={d.label} className="flex justify-between gap-3">
              <dt style={{ color: p.muted_text_color }}>{d.label}</dt>
              <dd className="truncate font-semibold">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-col items-center gap-2 p-6">
        <div className="rounded-xl border p-2" style={{ backgroundColor: p.qr_background_color, borderColor: p.border_color }}>
          <QRCodeSVG value={code} size={120} />
        </div>
        <p className="font-mono text-[10px] tracking-widest" style={{ color: p.muted_text_color }}>{code}</p>
        {ticketLabel && <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: p.accent_color }}>{ticketLabel}</p>}
      </div>
    </div>
  );
}

function Receipt({ palette: p, eventName, dateText, venue, attendeeName, code, ticketLabel, logoUrl, details }: TicketFaceProps) {
  const rule = { borderColor: p.border_color } as const;
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="uppercase" style={{ color: p.muted_text_color }}>{k}</span>
      <span className="flex-1 border-b border-dotted" style={rule} aria-hidden="true" />
      <span className="max-w-[60%] truncate text-right font-bold">{v}</span>
    </div>
  );
  return (
    <div
      className="mx-auto w-full max-w-[340px] border-x border-t px-6 pb-8 pt-7 font-mono shadow-lg"
      style={{ backgroundColor: p.background_color, color: p.text_color, borderColor: p.border_color }}
    >
      <Logo url={logoUrl} className="mx-auto mb-3 max-h-10 max-w-28 object-contain grayscale" />
      <p className="text-center text-xs font-bold tracking-[0.3em]">*** ADMIT ONE ***</p>
      <h2 className="mt-3 break-words text-center text-xl font-bold uppercase leading-tight">{eventName}</h2>
      <div className="my-4 border-t border-dashed" style={rule} />
      <div className="space-y-2">
        <Row k="Attendee" v={attendeeName} />
        <Row k="Date" v={dateText} />
        <Row k="Venue" v={venue || "TBA"} />
        {ticketLabel && <Row k="Ticket" v={ticketLabel} />}
        {details?.slice(0, 2).map((d) => <Row key={d.label} k={d.label} v={d.value} />)}
      </div>
      <div className="my-4 border-t border-dashed" style={rule} />
      <div className="flex justify-center">
        <div className="p-1.5" style={{ backgroundColor: p.qr_background_color }}>
          <QRCodeSVG value={code} size={120} />
        </div>
      </div>
      <div
        className="mx-auto mt-4 h-8 w-4/5"
        style={{ backgroundImage: `repeating-linear-gradient(90deg, ${p.text_color} 0 2px, transparent 2px 4px, ${p.text_color} 4px 5px, transparent 5px 9px)` }}
        aria-hidden="true"
      />
      <p className="mt-2 text-center text-[10px] tracking-[0.25em]" style={{ color: p.muted_text_color }}>{code}</p>
    </div>
  );
}

export const TicketFace = React.memo(TicketFaceImpl);
