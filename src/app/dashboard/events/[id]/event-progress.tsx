"use client";

/**
 * One line and a bar saying how far the event is from going live. The numbered steps themselves live in the tab
 * bar (see step-nav.tsx), so this stays a summary rather than a second stepper.
 */
export function EventProgress({
  done,
  total,
  nextLabel,
  published,
}: {
  done: number;
  total: number;
  /** The step to do next, or null when everything is finished. */
  nextLabel: string | null;
  published: boolean;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-widest">
        <span className="text-foreground/50">Setup progress</span>
        <span className="text-signal">{published ? "Live" : `${done} of ${total} complete`}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Event setup progress"
        className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
      >
        <div className="h-full rounded-full bg-signal transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
      {!published && (
        <p className="text-sm text-foreground/70">
          {nextLabel ? (
            <>
              Next step: <span className="font-bold text-foreground">{nextLabel}</span>
            </>
          ) : (
            "All steps are done. Open Go live to publish."
          )}
        </p>
      )}
    </div>
  );
}
