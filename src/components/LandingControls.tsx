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
    <div className="fixed bottom-5 right-5 z-50" ref={containerRef}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 25
            }}
            className="mb-3 w-72 rounded-2xl border border-border bg-background/85 p-4 text-xs text-foreground shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Motion
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {motionOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPref(o.value)}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] transition ${
                    pref === o.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {pref === "auto" && autoReason && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Auto detected: {autoReason} → reduced
              </p>
            )}

            <div className="mt-4 mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Palette className="h-3 w-3" /> Theme
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {themeOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setTheme(o.value)}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] transition ${
                    theme === o.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[10px] text-muted-foreground">
              Synced across tabs · saved locally
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-lg backdrop-blur-xl transition hover:bg-background"
        aria-label="Display settings"
      >
        {open ? <Zap className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
      </motion.button>
    </div>
  );
}
