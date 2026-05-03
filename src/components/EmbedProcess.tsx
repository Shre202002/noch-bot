'use client';

import { motion } from 'framer-motion';
import { UserPlus, Settings2, Code2, MessageSquare } from 'lucide-react';

const steps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Create account",
    desc: "Sign up in seconds — no credit card required.",
    visual: (
      <div className="space-y-3">
        <div className="h-2 w-3/4 rounded-full bg-white/10" />
        <div className="h-2 w-1/2 rounded-full bg-white/5" />
        <div className="mt-4 h-8 w-full rounded-md bg-white/5" />
        <div className="h-8 w-full rounded-md bg-white/5" />
        <div className="mt-2 h-9 w-full rounded-full bg-white/10" />
      </div>
    ),
  },
  {
    num: "02",
    icon: Settings2,
    title: "Configure bot",
    desc: "Set the name, tone, color, and knowledge.",
    visual: (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#7c6fff] to-[#3b82f6]" />
          <div className="h-2 w-20 rounded-full bg-white/10" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-6 rounded-full bg-fuchsia-500" />
          <div className="h-6 w-6 rounded-full bg-indigo-500" />
          <div className="h-6 w-6 rounded-full bg-emerald-500" />
          <div className="h-6 w-6 rounded-full bg-amber-500" />
          <div className="h-6 w-6 rounded-full border border-white/20" />
        </div>
        <div className="h-12 w-full rounded-md border border-white/5 bg-white/5 p-2 space-y-1.5">
          <div className="h-1.5 w-2/3 rounded-full bg-white/10" />
          <div className="h-1.5 w-1/2 rounded-full bg-white/5" />
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
      <div className="rounded-md border border-white/10 bg-black/40 p-4 font-mono text-[10px] leading-relaxed">
        <div className="text-white/20 mb-1">{"<!-- Add to <head> -->"}</div>
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
      <div className="space-y-2.5">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 text-[10px] text-[#080b10]">
          Hey, do you ship to EU?
        </div>
        <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[10px] text-white/80">
          Yes! Free EU shipping over €50 ✨
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[9px] uppercase tracking-wider text-white/30">live indicator</span>
        </div>
      </div>
    ),
  },
];

export function EmbedProcess() {
  return (
    <section id="process" className="relative border-t border-white/5 px-6 py-24 md:py-32 bg-[#080b10]">
      <div className="mx-auto max-w-[1200px]">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Process</p>
          <h2 className="mt-6 text-[clamp(2rem,4vw,3.5rem)] font-normal tracking-[-0.04em] text-white leading-tight">
            From signup to<br />live in 4 minutes.
          </h2>
          <p className="mt-6 text-base text-white/40">
            Watch how a Nocta chatbot goes from blank slate to answering customers — visualized.
          </p>
        </div>

        <div className="relative mt-24">
          {/* Connector line */}
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent md:block" />

          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
                className="group flex flex-col bg-[#0d1117] p-8 transition-colors hover:bg-[#161b22]"
              >
                <div className="flex items-center gap-4">
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#080b10]">
                    <s.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/20">
                    Step {s.num}
                  </span>
                </div>

                <div className="mt-8 flex-1 min-h-[180px] rounded-2xl border border-white/5 bg-[#080b10] p-6 shadow-inner">
                  {s.visual}
                </div>

                <h3 className="mt-8 text-lg font-medium text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}