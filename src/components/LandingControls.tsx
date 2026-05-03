'use client';

import { useState } from 'react';
import { Settings, Sparkles, Palette, Zap, X } from 'lucide-react';
import { useMotion, type MotionPref } from '@/hooks/use-reduced-motion';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export function LandingControls() {
  const [open, setOpen] = useState(false);
  const { pref, setPref, autoReason } = useMotion();
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      {open && (
        <div className="mb-4 w-72 rounded-2xl border border-white/10 bg-[#0d1117]/95 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xs font-medium text-white/60">Display Settings</h4>
            <button onClick={() => setOpen(false)} className="text-white/20 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/30">
                <Sparkles className="h-3 w-3" /> Motion
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['auto', 'full', 'reduce'] as MotionPref[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPref(p)}
                    className={cn(
                      "rounded-lg border py-2 text-[10px] font-medium transition-all uppercase tracking-tighter",
                      pref === p 
                        ? "border-white/20 bg-white text-[#080b10]" 
                        : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {pref === 'auto' && autoReason && (
                <p className="mt-2 text-[10px] italic text-white/20">
                  Auto detected: {autoReason} → reduced
                </p>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/30">
                <Palette className="h-3 w-3" /> Theme
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['neon', 'monochrome'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      "rounded-lg border py-2 text-[10px] font-medium transition-all uppercase tracking-tighter",
                      theme === t 
                        ? "border-white/20 bg-white text-[#080b10]" 
                        : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/5 pt-4">
            <p className="text-[10px] text-white/20">
              Synced across tabs · saved locally
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0d1117]/80 text-white/60 shadow-lg backdrop-blur transition-all hover:bg-[#161b22] hover:text-white hover:border-white/20",
          open && "rotate-90 bg-white text-[#080b10] border-transparent"
        )}
      >
        {open ? <Zap className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
      </button>
    </div>
  );
}