'use client';

import { useState, useEffect, useCallback } from 'react';

export type MotionPref = 'auto' | 'full' | 'reduce';

export function useMotion() {
  const [pref, setPrefState] = useState<MotionPref>('auto');
  const [autoReason, setAutoReason] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('nocta-motion-pref') as MotionPref;
    if (stored) setPrefState(stored);
  }, []);

  const setPref = useCallback((p: MotionPref) => {
    setPrefState(p);
    localStorage.setItem('nocta-motion-pref', p);
  }, []);

  let reduced = pref === 'reduce';
  
  useEffect(() => {
    if (pref === 'auto') {
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

  if (pref === 'auto') {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    reduced = autoReason !== null || isMobile;
  }

  return { reduced, pref, setPref, autoReason };
}