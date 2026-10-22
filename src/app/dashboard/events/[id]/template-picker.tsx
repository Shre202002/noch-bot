"use client";

import { Check } from "lucide-react";
import { TICKET_TEMPLATES, type TicketTemplate } from "@/lib/ticketTemplates";

/** A small drawing of each layout in that design's own colours, so organizers can compare them at a glance. */
function Thumb({ template }: { template: TicketTemplate }) {
  const p = template.palette;
  const bar = (w: string, color: string, h = "h-1") => <span className={`block ${h} rounded-full`} style={{ width: w, backgroundColor: color }} />;
  const qr = (size = "size-6", bg = p.qr_background_color) => (
    <span
      className={`block ${size} shrink-0 rounded-[3px]`}
      style={{ backgroundColor: bg, backgroundImage: "radial-gradient(#111 28%, transparent 30%)", backgroundSize: "4px 4px" }}
    />
  );

  const frame = "relative h-full w-full overflow-hidden";
  switch (template.thumb) {
    case "split":
      return (
        <div className={`${frame} flex rounded-md`} style={{ backgroundColor: p.background_color }}>
          <span className="flex w-1/3 items-center justify-center" style={{ backgroundColor: p.qr_background_color }}>{qr("size-5", "#e5e7eb")}</span>
          <span className="flex flex-1 flex-col justify-center gap-1.5 px-2.5">{bar("80%", p.text_color, "h-1.5")}{bar("55%", p.muted_text_color)}{bar("35%", p.text_color)}</span>
        </div>
      );
    case "pass":
      return (
        <div className={`${frame} flex rounded-md border-2`} style={{ backgroundColor: p.background_color, borderColor: p.accent_color }}>
          <span className="flex w-1/3 items-center justify-center border-r-2 border-dashed" style={{ borderColor: p.border_color }}>{qr("size-5", "#e5e7eb")}</span>
          <span className="flex flex-1 flex-col justify-center gap-1.5 px-2.5">{bar("75%", p.text_color, "h-1.5")}{bar("50%", p.accent_color)}{bar("40%", p.muted_text_color)}</span>
        </div>
      );
    case "centered":
      return (
        <div className={`${frame} flex flex-col items-center justify-center gap-1.5 rounded-md border`} style={{ backgroundColor: p.background_color, borderColor: p.accent_color }}>
          <span className="block size-3.5 rounded-full border" style={{ borderColor: p.accent_color }} />
          <span className="block w-1/2 border-y py-0.5" style={{ borderColor: p.accent_color }}>{bar("100%", p.accent_color)}</span>
          {qr("size-5")}
        </div>
      );
    case "vintage":
      return (
        <div className={`${frame} flex flex-col items-center justify-center gap-1.5 rounded-xl border-2`} style={{ backgroundColor: p.background_color, borderColor: p.border_color }}>
          <span className="absolute -left-1.5 top-1/2 size-3 rounded-full border-2 bg-background/20" style={{ borderColor: p.border_color }} />
          <span className="absolute -right-1.5 top-1/2 size-3 rounded-full border-2 bg-background/20" style={{ borderColor: p.border_color }} />
          {bar("55%", p.text_color, "h-1.5")}
          <span className="block w-4/5 border-t border-dashed" style={{ borderColor: p.border_color }} />
          {qr("size-5")}
        </div>
      );
    case "neon":
      return (
        <div className={`${frame} flex items-center gap-2 rounded-md border-2 px-2.5`} style={{ backgroundColor: p.background_color, borderColor: p.border_color, boxShadow: `0 0 10px ${p.border_color}99` }}>
          <span className="flex flex-1 flex-col gap-1.5">{bar("40%", p.accent_color)}{bar("85%", p.text_color, "h-1.5")}{bar("55%", p.muted_text_color)}</span>
          {qr("size-6")}
        </div>
      );
    case "gradient":
      return (
        <div className={`${frame} flex flex-col justify-between rounded-lg p-2`} style={{ background: `linear-gradient(135deg, ${p.background_color}, ${p.accent_color})` }}>
          {bar("60%", p.text_color, "h-1.5")}
          <span className="flex items-center justify-between rounded-md bg-foreground/20 p-1.5">{bar("45%", p.text_color)}{qr("size-4")}</span>
        </div>
      );
    case "stub":
      return (
        <div className={`${frame} flex rounded-sm border-[3px]`} style={{ backgroundColor: p.background_color, borderColor: p.border_color }}>
          <span className="flex flex-1 flex-col justify-center gap-1.5 px-2">
            <span className="block h-1.5 w-full" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${p.accent_color} 0 3px, transparent 3px 6px)` }} />
            {bar("85%", p.text_color, "h-2")}{bar("50%", p.muted_text_color)}
          </span>
          <span className="flex w-1/3 items-center justify-center border-l-[3px] border-dashed" style={{ borderColor: p.border_color }}>{qr("size-5")}</span>
        </div>
      );
    case "badge":
      return (
        <div className="relative mx-auto flex h-full w-[46%] flex-col overflow-hidden rounded-md border" style={{ backgroundColor: p.background_color, borderColor: p.border_color }}>
          <span className="flex h-[34%] items-start justify-center pt-1" style={{ backgroundColor: p.accent_color }}><span className="block h-0.5 w-4 rounded-full bg-background/30" /></span>
          <span className="flex flex-1 flex-col items-center justify-center gap-1">{bar("70%", p.text_color, "h-1.5")}{qr("size-4", "#e5e7eb")}</span>
        </div>
      );
    case "receipt":
      return (
        <div className={`${frame} flex flex-col items-center justify-center gap-1 border-x border-t px-3`} style={{ backgroundColor: p.background_color, borderColor: p.border_color }}>
          {bar("50%", p.text_color)}
          <span className="block w-full border-t border-dashed" style={{ borderColor: p.border_color }} />
          <span className="block w-full border-b border-dotted py-0.5" style={{ borderColor: p.border_color }} />
          <span className="block h-2.5 w-4/5" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${p.text_color} 0 1px, transparent 1px 3px)` }} />
        </div>
      );
  }
}

/** The design chooser: a grid of labelled thumbnails, one selected, behaving as a radio group. */
export function TemplatePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Ticket design" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {TICKET_TEMPLATES.map((t) => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.id)}
            className={`group relative flex cursor-pointer flex-col gap-2.5 rounded-2xl border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
              selected
                ? "border-signal bg-signal/5 shadow-[0_0_0_3px_color-mix(in srgb, var(--signal) 14%, transparent)]"
                : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/25 hover:bg-foreground/[0.04]"
            }`}
          >
            <span className="block aspect-[16/10] w-full overflow-hidden rounded-lg bg-background/40 p-2 ring-1 ring-foreground/5">
              <Thumb template={t} />
            </span>
            <span className="space-y-0.5 px-0.5 pb-0.5">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-foreground">{t.name}</span>
                {t.isNew && <span className="rounded-full bg-signal px-1.5 py-px text-[9px] font-black uppercase leading-none tracking-wide text-black">New</span>}
              </span>
              <span className="block text-[11px] leading-snug text-foreground/50">{t.description}</span>
            </span>
            {selected && (
              <span aria-hidden="true" className="absolute right-2 top-2 grid size-5 place-content-center rounded-full bg-signal text-black">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
