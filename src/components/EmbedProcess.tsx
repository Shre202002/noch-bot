"use client";

import { motion } from "framer-motion";
import { UserPlus, Settings2, Code2, MessageSquare } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Create account",
    desc: "Sign up in seconds — no credit card required.",
    visual: (
      <div className="space-y-2">
        <div className="h-2 w-3/4 rounded-full bg-foreground/20" />
        <div className="h-2 w-1/2 rounded-full bg-foreground/10" />
        <div className="mt-4 h-8 w-full rounded-md bg-foreground/10" />
        <div className="h-8 w-full rounded-md bg-foreground/10" />
        <div className="mt-2 h-9 w-full rounded-full bg-foreground" />
      </div>
    ),
  },
  {
    num: "02",
    icon: Settings2,
    title: "Configure bot",
    desc: "Set the name, tone, color, and knowledge.",
    visual: (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500" />
          <div className="h-2 w-20 rounded-full bg-foreground/30" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-5 rounded-full bg-fuchsia-500" />
          <div className="h-5 w-5 rounded-full bg-indigo-500" />
          <div className="h-5 w-5 rounded-full bg-emerald-500" />
          <div className="h-5 w-5 rounded-full bg-amber-500" />
          <div className="h-5 w-5 rounded-full border border-foreground/30" />
        </div>
        <div className="h-16 w-full rounded-md border border-border bg-foreground/5 p-2">
          <div className="h-1.5 w-2/3 rounded-full bg-foreground/20" />
          <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-foreground/10" />
        </div>
      </div>
    ),
  },
  {
    num: "03",
    icon: Code2,
    title: "Embed snippet",
    desc: "Paste one script tag into your site's HTML.",
    visual: (
      <div className="rounded-md border border-border bg-black/40 p-3 font-mono text-[10px] leading-relaxed">
        <div className="text-muted-foreground">{"<!-- Add to <head> -->"}</div>
        <div>
          <span className="text-fuchsia-400">{"<script"}</span>{" "}
          <span className="text-emerald-400">src</span>=
          <span className="text-amber-300">"nocta.io/v1.js"</span>
        </div>
        <div className="pl-4">
          <span className="text-emerald-400">data-bot</span>=
          <span className="text-amber-300">"abc123"</span>
        </div>
        <div>
          <span className="text-fuchsia-400">{"</script>"}</span>
        </div>
      </div>
    ),
  },
  {
    num: "04",
    icon: MessageSquare,
    title: "Go live",
    desc: "Your chatbot is talking to users instantly.",
    visual: (
      <div className="space-y-2">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground px-3 py-1.5 text-[11px] text-background">
          Hey, do you ship to EU?
        </div>
        <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-foreground/10 px-3 py-1.5 text-[11px] text-foreground">
          Yes! Free EU shipping over €50 ✨
        </div>
        <div className="flex items-center gap-1 pt-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[10px] text-muted-foreground">live</span>
        </div>
      </div>
    ),
  },
];

export function EmbedProcess() {
  return (
    <section className="relative border-t border-border py-32">
      <div className="mx-auto max-w-[1400px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Process</p>
          <h2 className="mt-6 text-4xl font-medium tracking-tight text-foreground sm:text-6xl">
            From signup to<br />live in 4 minutes.
          </h2>
          <p className="mt-6 max-w-md text-base text-muted-foreground">
            Watch how a Nocta chatbot goes from blank slate to answering customers — visualized.
          </p>
        </motion.div>

        {/* Connector line */}
        <div className="relative mt-20">
          <div className="absolute left-0 right-0 top-[140px] hidden h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent md:block" />

          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative"
              >
                {/* Step header */}
                <div className="flex items-center gap-3">
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
                    <s.icon className="h-4 w-4 text-foreground" />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Step {s.num}
                  </span>
                </div>

                {/* Visual mock card */}
                <div className="mt-6 min-h-[180px] rounded-2xl border border-border bg-card p-5">
                  {s.visual}
                </div>

                {/* Title + desc */}
                <h3 className="mt-6 text-lg font-medium tracking-tight text-foreground">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
