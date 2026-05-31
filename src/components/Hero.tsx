'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { AuroraBackground } from './AuroraBackground';
import { useMotion } from '@/hooks/use-reduced-motion';
import Link from 'next/link';
import { LandingControls } from './LandingControls';
import SignupModal from "./ui/signup-modal";


export function Hero() {
  const { reduced, autoReason, mounted } = useMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const showComplexEffects = mounted && !reduced && !isMobile;

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-16">
      <AuroraBackground />

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
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Announcing NOCHBOT 1.0
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className={`${showComplexEffects ? 'hero-wordmark' : 'hero-wordmark-static'} select-none text-[clamp(4rem,18vw,16rem)] font-bold leading-[0.85] tracking-[-0.04em]`}
        >
          NOCHBOT
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-10 max-w-[500px] px-4 text-base text-white/40 md:text-lg"
        >
          An AI chatbot platform built to deploy intelligent agents on any website in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <SignupModal trigger={
            <button className="w-full sm:w-auto rounded-full bg-white px-8 py-3 text-sm font-medium text-[#080b10] hover:opacity-90 transition-opacity"
            >
              Try NochBot
            </button>
          } />
          <Link
            href="#features"
            className="w-full sm:w-auto rounded-full border border-white/10 px-8 py-3 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
            Learn more
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="mt-24 flex w-full flex-wrap items-center justify-center gap-6 px-4 text-[10px] uppercase tracking-[0.22em] text-white/50 sm:mt-40 sm:gap-12 sm:text-[11px]"
      >
        <span className="whitespace-nowrap">Reasoning</span>
        <span className="h-px w-8 bg-white/20 hidden sm:inline" />
        <span className="whitespace-nowrap">Embed</span>
        <span className="h-px w-8 bg-white/20 hidden md:inline" />
        <span className="whitespace-nowrap">Analytics</span>
        <span className="h-px w-8 bg-white/20 hidden lg:inline" />
        <span className="whitespace-nowrap">Realtime</span>
      </motion.div>

      <LandingControls />
    </section>
  );
}