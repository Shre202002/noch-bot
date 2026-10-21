"use client";

import { Fragment } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, PartyPopper, Rocket, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmbedCodeCard } from "@/components/EmbedCodeCard";
import { cn } from "@/lib/utils";
import type { ReadinessStep } from "@/lib/eventReadiness";

export type StepDef = {
  tab: string;
  label: string;
  done: boolean;
};

const GREEN_BUTTON = "bg-[#36f4a4] text-black hover:bg-[#36f4a4]/90 shadow-[0_0_0_3px_rgba(54,244,164,0.18)]";

/** The first step still to do: where a first-time organizer should go next. */
export function nextStepTab(steps: StepDef[]): string | null {
  return steps.find((s) => !s.done)?.tab ?? null;
}

/**
 * The tab row as a left-to-right path: numbered steps joined by arrows, finished ones ticked, and the step to do next
 * ringed and labelled. Render inside <Tabs>; every step stays reachable.
 */
export function StepTabsBar({ steps, activeTab }: { steps: StepDef[]; activeTab: string }) {
  const next = nextStepTab(steps);

  return (
    <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-white/5 bg-accent/20 p-1.5">
      {steps.map((step, index) => {
        const isNext = step.tab === next && step.tab !== activeTab;
        const active = step.tab === activeTab;
        return (
          <Fragment key={step.tab}>
            <TabsTrigger
              value={step.tab}
              className={cn(
                "gap-2 rounded-xl border border-transparent px-3 py-2 text-sm cursor-pointer transition-colors sm:px-4",
                // The tab you are on: filled, white text, bold, with a green underline. Nothing else looks like this.
                "data-[state=active]:bg-white/15 data-[state=active]:font-bold data-[state=active]:text-white data-[state=active]:shadow-[inset_0_-2px_0_0_#36f4a4]",
                !active && !step.done && !isNext && "text-white/55 hover:text-white",
                step.done && !active && "text-white/85 hover:text-white",
                // The suggested next step: a dashed outline, so it reads as a suggestion and not as the current tab.
                isNext && "border-dashed border-[#36f4a4] bg-[#36f4a4]/5 text-white"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-5 shrink-0 place-content-center rounded-full text-[11px] font-bold",
                  step.done ? "bg-[#36f4a4] text-black" : isNext ? "border border-[#36f4a4] text-white" : active ? "border border-white text-white" : "border border-white/25"
                )}
              >
                {step.done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {step.label}
              {step.done && <span className="sr-only"> (complete)</span>}
              {active && <span className="sr-only"> (current step)</span>}
              {isNext && (
                <span className="rounded-full border border-[#36f4a4]/70 bg-[#36f4a4]/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Next</span>
              )}
            </TabsTrigger>
            {index < steps.length - 1 && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-white/30" />}
          </Fragment>
        );
      })}
    </TabsList>
  );
}

/** Previous / Next under every step, so the way forward is always one obvious button. */
export function StepFooter({
  steps,
  activeTab,
  onGo,
}: {
  steps: StepDef[];
  activeTab: string;
  onGo: (tab: string) => void;
}) {
  const index = steps.findIndex((s) => s.tab === activeTab);
  if (index < 0) return null;
  const prev = steps[index - 1];
  const next = steps[index + 1];

  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-6">
      {prev ? (
        <Button variant="outline" onClick={() => onGo(prev.tab)} className="rounded-full border-white/15 text-white cursor-pointer">
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Previous: </span>
          {prev.label}
        </Button>
      ) : (
        <span />
      )}
      <span className="hidden text-xs uppercase tracking-widest text-white/40 sm:block">
        Step {index + 1} of {steps.length}
      </span>
      {next ? (
        <Button onClick={() => onGo(next.tab)} className={cn("rounded-full font-bold cursor-pointer", GREEN_BUTTON)}>
          <span className="hidden sm:inline">Next: </span>
          {next.label}
          <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

/** The final step: what is left, a summary, and the single button that publishes. */
export function GoLivePanel({
  eventId,
  summary,
  checklist,
  complete,
  published,
  publishing,
  onFix,
  onPublish,
}: {
  eventId: string;
  summary: Array<{ label: string; value: string }>;
  checklist: ReadinessStep[];
  complete: boolean;
  published: boolean;
  publishing: boolean;
  onFix: (tab: string) => void;
  onPublish: () => void;
}) {
  const missing = checklist.filter((s) => !s.done);

  if (published) {
    return (
      <div className="space-y-6">
      <Card className="border-[#36f4a4]/30 bg-[#36f4a4]/5">
        <CardContent className="space-y-5 p-8 text-center">
          <span className="mx-auto grid size-16 place-content-center rounded-full bg-[#36f4a4]/15 text-[#36f4a4]">
            <PartyPopper aria-hidden="true" className="h-8 w-8" />
          </span>
          <div>
            <h2 className="text-2xl font-black text-white">Your event is live</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Attendees can now book through your website widget and chat bot. Bookings will appear in the Bookings section.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className={cn("rounded-full font-bold cursor-pointer", GREEN_BUTTON)}>
              <Link href={`/dashboard/bookings/${eventId}`}>
                <Ticket aria-hidden="true" className="mr-2 h-4 w-4" /> View bookings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <EmbedCodeCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-tight text-white">Review and go live</h2>
        <p className="text-sm text-muted-foreground">Everything below must be done before attendees can book.</p>
      </div>

      <Card className="border-white/10 bg-card/30">
        <CardContent className="p-0">
          <ul className="divide-y divide-white/5">
            {checklist.map((step) => (
              <li key={step.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span
                  aria-hidden="true"
                  className={cn("grid size-6 shrink-0 place-content-center rounded-full", step.done ? "bg-[#36f4a4] text-black" : "border border-orange-400 text-orange-400")}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">
                    {step.label}
                    <span className="sr-only">{step.done ? " (complete)" : " (needs attention)"}</span>
                  </p>
                  <p className={cn("text-xs", step.done ? "text-white/50" : "text-orange-300")}>{step.hint}</p>
                </div>
                {!step.done && (
                  <Button size="sm" variant="outline" onClick={() => onFix(step.tab)} className="rounded-full border-orange-400/40 text-orange-200 cursor-pointer">
                    Fix this
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-card/30">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          {summary.map((row) => (
            <div key={row.label}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">{row.label}</p>
              <p className="text-sm text-white">{row.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card/40 p-5">
        <p role="status" className={cn("text-sm", complete ? "text-white/70" : "text-orange-300")}>
          {complete
            ? "All set. Making the event live opens it for booking right away."
            : `Finish ${missing.map((m) => m.label).join(" and ")} first.`}
        </p>
        <Button
          onClick={onPublish}
          disabled={!complete || publishing}
          className={cn("h-12 rounded-full px-8 text-base font-black cursor-pointer", GREEN_BUTTON)}
        >
          {publishing ? <Loader2 aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" /> : <Rocket aria-hidden="true" className="mr-2 h-5 w-5" />}
          {publishing ? "Going live…" : "Make event live"}
        </Button>
      </div>
    </div>
  );
}
