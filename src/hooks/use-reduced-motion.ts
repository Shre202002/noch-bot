'use client';

import { useState, useEffect, useCallback } from 'react';

export type MotionPref = 'auto' | 'full' | 'reduce';

export function useMotion() {
  const [pref, setPrefState] = useState<MotionPref>('auto');
  const [autoReason, setAutoReason] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('nocta-motion-pref') as MotionPref;
    if (stored) setPrefState(stored);
  }, []);

  const setPref = useCallback((p: MotionPref) => {
    setPrefState(p);
    localStorage.setItem('nocta-motion-pref', p);
  }, []);

  useEffect(() => {
    if (pref === 'auto' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const lowPower = (navigator as any).hardwareConcurrency <= 4 || (navigator as any).deviceMemory <= 4;
      
      if (mediaQuery.matches) {
        setAutoReason('OS preference');
      } else if (lowPower) {
        setAutoReason('Low-power device');
      } else {
        setAutoReason(null);
      }
    }
  }, [pref]);

  // Default to reduced/safe mode during SSR to avoid hydration mismatch
  let reduced = true;
  
  if (mounted) {
    if (pref === 'reduce') {
      reduced = true;
    } else if (pref === 'full') {
      reduced = false;
    } else {
      const isMobile = window.innerWidth < 768;
      reduced = autoReason !== null || isMobile;
    }
  }

  return { reduced, pref, setPref, autoReason, mounted };
}
