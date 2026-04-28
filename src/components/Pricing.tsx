"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "$0",
    desc: "For testing.",
    features: ["1 chatbot", "100 messages / mo", "Basic analytics", "Community support"],
    cta: "Get started",
    featured: false,
  },
  {
    name: "Pro",
    price: "$29",
    desc: "For production.",
    features: ["Unlimited bots", "Unlimited messages", "Advanced analytics", "Custom branding", "Priority support", "API access"],
    cta: "Go Pro",
    featured: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative border-t border-border py-32">
      <div className="mx-auto max-w-[1400px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
          <h2 className="mt-6 text-4xl font-medium tracking-tight text-foreground sm:text-6xl">
            Pay for usage.<br />Nothing else.
          </h2>
        </motion.div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`flex flex-col bg-background p-10 ${plan.featured ? "bg-card" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-medium text-foreground">{plan.name}</h3>
                {plan.featured && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Recommended</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>

              <div className="mt-10 flex items-baseline gap-1">
                <span className="text-5xl font-medium tracking-tight text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>

              <ul className="mt-10 flex-1 space-y-3 border-t border-border pt-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="h-px w-3 bg-muted-foreground" /> {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-10 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition ${
                  plan.featured
                    ? "bg-foreground text-background hover:opacity-80"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
