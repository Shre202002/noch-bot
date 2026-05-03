'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { AuroraBackground } from './AuroraBackground';
import { useMotion } from '@/hooks/use-reduced-motion';
import Link from 'next/link';

export function Hero() {
  const { reduced, autoReason, mounted } = useMotion();

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
      <AuroraBackground reduced={reduced} />

      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center text-center">
        {mounted && autoReason && (
          <div className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-white/40 backdrop-blur">
            <Zap className="h-3 w-3" />
            Performance mode: On
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/7 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/40 backdrop-blur"
        >
          <span className="h-1 w-1 rounded-full bg-white" />
          Announcing Nocta 1.0
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="hero-wordmark select-none text-[clamp(5rem,20vw,16rem)] font-medium leading-[0.85] tracking-[-0.06em]"
        >
          nocta
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-10 max-w-[500px] text-base text-white/40 md:text-lg"
        >
          An AI chatbot platform built to deploy intelligent agents on any website in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/register"
            className="rounded-full bg-white px-8 py-3 text-sm font-medium text-[#080b10] hover:opacity-90 transition-opacity"
          >
            Try Nocta
          </Link>
          <Link
            href="#features"
            className="rounded-full border border-white/10 px-8 py-3 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
            Learn more
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-6 text-[11px] uppercase tracking-[0.18em] text-white/20 sm:gap-12"
      >
        <span>Reasoning</span>
        <span className="h-px w-4 bg-white/10" />
        <span>Embed</span>
        <span className="h-px w-4 bg-white/10 hidden sm:inline" />
        <span className="hidden sm:inline">Analytics</span>
        <span className="h-px w-4 bg-white/10 hidden md:inline" />
        <span className="hidden md:inline">Realtime</span>
      </motion.div>
    </section>
  );
}
