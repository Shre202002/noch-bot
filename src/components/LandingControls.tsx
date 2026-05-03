'use client';

import { useState, useEffect, useRef } from "react";
import { Settings, Sparkles, Palette, Zap } from "lucide-react";
import { useMotion, type MotionPref } from "@/hooks/use-reduced-motion";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { motion, AnimatePresence } from "framer-motion";

const motionOptions: { value: MotionPref; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "full", label: "Full effects" },
  { value: "reduce", label: "Reduced motion" },
];

const themeOptions: { value: Theme; label: string }[] = [
  { value: "neon", label: "Neon" },
  { value: "monochrome", label: "Mono" },
];

export function LandingControls() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pref, setPref, autoReason, mounted: motionMounted } = useMotion();
  const { theme, setTheme, mounted: themeMounted } = useTheme();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!motionMounted || !themeMounted) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50" ref={containerRef}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.94, y: 10, filter: "blur(4px)" }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 30,
              mass: 0.8,
            }}
            className="mb-3 w-[calc(100vw-2rem)] max-w-[300px] sm:w-72 rounded-2xl border border-border bg-background/85 p-4 text-xs text-foreground shadow-2xl backdrop-blur-xl origin-bottom-right"
          >
            {/* Motion section */}
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Motion
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {motionOptions.map((o) => (
                <motion.button
                  key={o.value}
                  onClick={() => setPref(o.value)}
                  whileTap={{ scale: 0.95 }}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] transition-all duration-200 ${
                    pref === o.value
                      ? "border-foreground bg-foreground text-background shadow-sm"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {o.label}
                </motion.button>
              ))}
            </div>

            {pref === "auto" && autoReason && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-[10px] text-muted-foreground overflow-hidden"
              >
                Auto detected: {autoReason} → reduced
              </motion.p>
            )}

            {/* Divider */}
            <motion.div
              className="my-3 h-px bg-border"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            />

            {/* Theme section */}
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Palette className="h-3 w-3" /> Theme
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {themeOptions.map((o) => (
                <motion.button
                  key={o.value}
                  onClick={() => setTheme(o.value)}
                  whileTap={{ scale: 0.95 }}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] transition-all duration-200 ${
                    theme === o.value
                      ? "border-foreground bg-foreground text-background shadow-sm"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {o.label}
                </motion.button>
              ))}
            </div>

            <p className="mt-3 text-[10px] text-muted-foreground">
              Synced across tabs · saved locally
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.85, rotate: -15 }}
        whileHover={{ scale: 1.08 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-lg backdrop-blur-xl transition hover:bg-background"
        aria-label="Display settings"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "zap" : "settings"}
            initial={{ opacity: 0, rotate: -30, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 30, scale: 0.5 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            {open ? <Zap className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}