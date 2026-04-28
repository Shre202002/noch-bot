"use client";

import { motion } from "framer-motion";

const steps = [
  { num: "01", title: "Sign up", desc: "Create an account in under a minute." },
  { num: "02", title: "Configure", desc: "Define your bot's voice, colors and content." },
  { num: "03", title: "Embed", desc: "Paste one line of code. You're live." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-t border-border py-32">
      <div className="mx-auto max-w-[1400px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Workflow</p>
          <h2 className="mt-6 text-4xl font-medium tracking-tight text-foreground sm:text-6xl">
            Three steps.<br />Zero friction.
          </h2>
        </motion.div>

        <div className="mt-20 space-y-px">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="grid grid-cols-12 gap-6 border-t border-border py-10"
            >
              <div className="col-span-2 text-sm text-muted-foreground">{s.num}</div>
              <div className="col-span-10 md:col-span-4">
                <h3 className="text-2xl font-medium tracking-tight text-foreground">{s.title}</h3>
              </div>
              <div className="col-span-12 md:col-span-6">
                <p className="text-base text-muted-foreground">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
