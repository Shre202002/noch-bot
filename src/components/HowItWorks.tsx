'use client';

import { motion } from 'framer-motion';

const steps = [
  { num: "01", title: "Sign up", desc: "Create an account in under a minute." },
  { num: "02", title: "Configure", desc: "Define your bot's voice, colors and content." },
  { num: "03", title: "Embed", desc: "Paste one line of code. You're live." },
];

export function HowItWorks() {
  return (
    <section id="workflow" className="border-t border-white/5 px-6 py-24 md:py-32 bg-[#0d1117]">
      <div className="mx-auto max-w-[1200px]">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Workflow</p>
          <h2 className="mt-6 text-[clamp(2rem,4vw,3.5rem)] font-normal tracking-[-0.04em] text-white leading-tight">
            Three steps.<br />Zero friction.
          </h2>
        </div>

        <div className="mt-20">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-6 border-t border-white/5 py-12 md:grid-cols-12 md:items-start"
            >
              <div className="text-sm font-medium text-white/20 md:col-span-2">
                {s.num}
              </div>
              <div className="text-2xl font-medium tracking-tight text-white md:col-span-4">
                {s.title}
              </div>
              <div className="text-base leading-relaxed text-white/40 md:col-span-6">
                {s.desc}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}