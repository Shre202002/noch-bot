'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'neon' | 'monochrome';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('neon');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('nocta-theme') as Theme;
    if (stored) {
      setThemeState(stored);
      document.documentElement.setAttribute('data-theme', stored);
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('nocta-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  return { theme, setTheme, mounted };
}
