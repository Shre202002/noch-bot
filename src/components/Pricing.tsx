'use client';

import { motion } from 'framer-motion';

const plans = [
  {
    name: "Free",
    desc: "For testing.",
    price: "0",
    features: ["1 chatbot", "100 messages / mo", "Basic analytics", "Community support"],
    featured: false,
    cta: "Get started",
  },
  {
    name: "Pro",
    desc: "For production.",
    price: "29",
    features: ["Unlimited bots", "Unlimited messages", "Advanced analytics", "Custom branding", "Priority support", "API access"],
    featured: true,
    cta: "Go Pro",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-white/5 px-6 py-24 md:py-32 bg-[#080b10]">
      <div className="mx-auto max-w-[1200px]">
        <div className="max-w-2xl text-center mx-auto mb-20">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Pricing</p>
          <h2 className="mt-6 text-[clamp(2rem,4vw,3.5rem)] font-normal tracking-[-0.04em] text-white leading-tight">
            Pay for usage.<br />Nothing else.
          </h2>
        </div>

        <div className="mx-auto max-w-[900px] grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-2">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`flex flex-col p-10 md:p-12 ${plan.featured ? "bg-[#161b22]" : "bg-[#0d1117]"}`}
            >
              <div className="flex-1">
                {plan.featured && (
                  <div className="mb-6 inline-flex rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider text-white/60">
                    Recommended
                  </div>
                )}
                <h3 className="text-lg font-medium text-white">{plan.name}</h3>
                <p className="mt-2 text-sm text-white/40">{plan.desc}</p>

                <div className="mt-10 flex items-baseline gap-1">
                  <span className="text-5xl font-medium tracking-tighter text-white">${plan.price}</span>
                  <span className="text-sm text-white/30">/ month</span>
                </div>

                <div className="my-10 h-px w-full bg-white/5" />

                <ul className="space-y-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white/40">
                      <div className="h-1 w-1 shrink-0 rounded-full bg-white/20" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className={`mt-12 w-full rounded-full py-3.5 text-sm font-medium transition-all ${
                  plan.featured 
                    ? "bg-white text-[#080b10] hover:opacity-90" 
                    : "border border-white/10 text-white hover:bg-white/5"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}