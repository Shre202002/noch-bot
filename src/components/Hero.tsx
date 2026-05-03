"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { AuroraBackground } from "./AuroraBackground";
import { useMotion } from "@/hooks/use-reduced-motion";

export function Hero() {
  const { reduced, pref, autoReason } = useMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Mobile or low-power → static render (no animation, simpler gradient)
  const useStatic = reduced || isMobile;
  // Show "Performance mode" badge only when auto-detected (not user choice)
  const showPerfBadge = pref === "auto" && autoReason !== null;

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
      <AuroraBackground />
      <div className="absolute inset-0 grid-bg opacity-40" />

      {showPerfBadge && (
        <div className="absolute top-20 left-1/2 z-20 -translate-x-1/2">
          <div
            className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur"
            title={`Heavy effects disabled — reason: ${autoReason}`}
          >
            <Zap className="h-3 w-3" />
            Performance mode: On
          </div>
        </div>
      )}

      {/* Grok-style animated beam stack — desktop only */}
      {!useStatic && (
        <>
          <div className="hero-beam" />
          <div className="hero-beam-core" />
          <div className="hero-beam-streak" />
        </>
      )}

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-10 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
          Announcing Nocta 1.0
        </motion.div>

        {/* Giant Nocta wordmark */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={`select-none text-[22vw] font-semibold leading-[0.85] tracking-[-0.06em] sm:text-[20vw] lg:text-[18rem] ${
            useStatic ? "hero-wordmark-static" : "hero-wordmark"
          }`}
        >
          Nocta
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-10 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          An AI chatbot platform built to deploy intelligent agents on any website in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href="/register"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-80"
          >
            Try Nocta
          </Link>
          <a
            href="#features"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Learn more
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 sm:gap-12"
      >
        <span>Reasoning</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">Embed</span>
        <span className="hidden md:inline">·</span>
        <span className="hidden md:inline">Analytics</span>
        <span className="hidden md:inline">·</span>
        <span className="hidden md:inline">Realtime</span>
      </motion.div>
    </section>
  );
}
