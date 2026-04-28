"use client";

import { motion } from "framer-motion";

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
    <section id="features" className="relative border-t border-border py-32">
      <div className="mx-auto max-w-[1400px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Capabilities</p>
          <h2 className="mt-6 text-4xl font-medium tracking-tight text-foreground sm:text-6xl">
            A chatbot stack,<br />reduced to essentials.
          </h2>
        </motion.div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-background p-10 transition hover:bg-card"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{f.label}</p>
              <h3 className="mt-12 text-2xl font-medium tracking-tight text-foreground">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
