'use client';

import { motion } from 'framer-motion';
import { Zap, Settings2, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: "Live in one line.",
    description: "Drop a single script tag into any site. Your bot is online — no build step, no SDK, no configuration.",
  },
  {
    icon: <Settings2 className="h-8 w-8 text-primary" />,
    title: "Yours, end to end.",
    description: "Rename, restyle, retrain. Match your brand pixel-for-pixel with full control over voice and visuals.",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "Measure signal, not noise.",
    description: "Real-time conversations, top intents, and resolution metrics — surfaced without dashboards in your way.",
  },
];

export function Features() {
  return (
    <section id="features" className="w-full py-24 md:py-32 bg-background">
      <div className="mx-auto max-w-[1200px] px-6">
        {/* Header */}
        <div className="text-center">
          <p className="font-medium text-primary px-6 py-1.5 rounded-full
                         bg-primary/10 border border-primary/20
                         w-max mx-auto text-[11px] uppercase tracking-wider">
            Capabilities
          </p>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-normal tracking-[-0.04em] mt-6 text-white leading-tight">
            Built for builders
          </h2>
          <p className="mt-4 text-white/40 max-w-xl mx-auto text-base">
            A chatbot stack, reduced to essentials. Everything you need to deploy, customize, and measure performance.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-6 place-items-center">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className={`group hover:-translate-y-1 transition-all duration-300 w-full max-w-sm ${
                index === 1
                  ? "p-[1px] rounded-[13px] bg-gradient-to-br from-primary via-primary/50 to-accent"
                  : ""
              }`}
            >
              <div className="p-8 rounded-xl space-y-6
                              border border-white/5 
                              bg-card
                              text-white
                              h-full min-h-[280px]">
                <div className="p-3 rounded-lg bg-white/5 w-fit group-hover:bg-primary/10 transition-colors">
                  {feature.icon}
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-medium tracking-tight">{feature.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
