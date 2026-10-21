"use client";

import { Check } from "lucide-react";

export type ProgressStep = {
  id: string;
  label: string;
  done: boolean;
  /** Tab that completes this step; steps without one (publish) are status only. */
  tab?: string;
};

/**
 * How far an event is from going live: one step per stage, in the order an organizer works through them.
 * The first unfinished step is "current"; every step with a tab is a shortcut to it.
 */
export function EventProgress({
  steps,
  activeTab,
  onSelect,
}: {
  steps: ProgressStep[];
  activeTab: string;
  onSelect: (tab: string) => void;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <nav aria-label="Event setup progress" className="w-full space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest">
        <span className="text-white/50">Setup progress</span>
        <span className="text-[#36f4a4]">
          {doneCount} of {steps.length} complete
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Event setup progress"
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-[#36f4a4] transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:gap-3">
        {steps.map((step, index) => {
          const current = index === currentIndex;
          const selected = !!step.tab && step.tab === activeTab;
          const tone = step.done
            ? "border-[#36f4a4]/40 bg-[#36f4a4]/10 text-white"
            : current
            ? "border-[#36f4a4] bg-[#36f4a4]/5 text-white shadow-[0_0_0_3px_rgba(54,244,164,0.12)]"
            : "border-white/10 text-white/50";
          const body = (
            <>
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-content-center rounded-full text-xs font-bold ${
                  step.done ? "bg-[#36f4a4] text-black" : current ? "border border-[#36f4a4] text-[#36f4a4]" : "border border-white/20"
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 text-left text-sm font-medium leading-tight">
                {step.label}
                <span className="sr-only">{step.done ? " (complete)" : current ? " (next step)" : " (not started)"}</span>
              </span>
            </>
          );
          const className = `flex min-h-11 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${tone} ${
            selected ? "ring-1 ring-white/40" : ""
          }`;

          return (
            <li key={step.id} className="flex flex-1" aria-current={current ? "step" : undefined}>
              {step.tab ? (
                <button type="button" onClick={() => onSelect(step.tab!)} className={`${className} cursor-pointer hover:bg-white/5`}>
                  {body}
                </button>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
