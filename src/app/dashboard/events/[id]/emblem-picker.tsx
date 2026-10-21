"use client";

import { Ban } from "lucide-react";
import { EMBLEM_GROUPS, TICKET_EMBLEMS } from "@/lib/ticketEmblems";

/**
 * Pick one built-in emblem as the event logo. Each tile is drawn the way it will look on the ticket (the ticket's own
 * background and text colour), and the choice behaves as a radio group with a "None" option to clear it.
 */
export function EmblemPicker({
  value,
  tile,
  ink,
  busy,
  onChange,
}: {
  value: string | null;
  /** Ticket background colour, used behind each glyph. */
  tile: string;
  /** Ticket text colour, used for the glyph strokes. */
  ink: string;
  busy?: boolean;
  onChange: (id: string | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Emblem" aria-busy={busy} className="space-y-4">
      {EMBLEM_GROUPS.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{group}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {TICKET_EMBLEMS.filter((e) => e.group === group).map((e) => {
              const selected = value === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={e.name}
                  title={e.name}
                  disabled={busy}
                  onClick={() => onChange(e.id)}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#36f4a4] disabled:cursor-wait disabled:opacity-60 ${
                    selected
                      ? "border-[#36f4a4] bg-[#36f4a4]/5 shadow-[0_0_0_3px_rgba(54,244,164,0.14)]"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <span className="grid aspect-square w-full place-content-center rounded-lg ring-1 ring-white/10" style={{ backgroundColor: tile }}>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-7 w-7"
                      fill="none"
                      stroke={ink}
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {e.paths.map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </svg>
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-white/60">{e.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        disabled={busy || value === null}
        onClick={() => onChange(null)}
        className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs text-white/70 transition-colors hover:border-white/25 hover:text-white disabled:cursor-default disabled:opacity-50"
      >
        <Ban aria-hidden="true" className="h-3.5 w-3.5" /> No emblem
      </button>
    </div>
  );
}
