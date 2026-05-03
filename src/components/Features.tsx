'use client';

import { motion } from 'framer-motion';

const features = [
  {
    label: "01 / Deploy",
    title: "Live in one line.",
    description: "Drop a single script tag into any site. Your bot is online — no build step, no SDK, no configuration.",
  },
  {
    label: "02 / Customize",
    title: "Yours, end to end.",
    description: "Rename, restyle, retrain. Match your brand pixel-for-pixel with full control over voice and visuals.",
  },
  {
    label: "03 / Measure",
    title: "Signal, not noise.",
    description: "Real-time conversations, top intents, and resolution metrics — surfaced without dashboards in your way.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-white/5 px-6 py-24 md:py-32 bg-[#0d1117]">
      <div className="mx-auto max-w-[1200px]">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Capabilities</p>
          <h2 className="mt-6 text-[clamp(2rem,4vw,3.5rem)] font-normal tracking-[-0.04em] text-white leading-tight">
            A chatbot stack,<br />reduced to essentials.
          </h2>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group bg-[#080b10] p-10 transition-colors hover:bg-[#161b22]"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{f.label}</p>
              <h3 className="mt-12 text-2xl font-medium tracking-tight text-white">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/40">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}