'use client';

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nocta:theme";
const CHANNEL = "nocta:prefs";

export type Theme = "neon" | "monochrome";
const DEFAULT: Theme = "neon";

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-neon", "theme-monochrome");
  root.classList.add(`theme-${theme}`);
  root.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);
    
    const read = () => {
      const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? DEFAULT;
      setThemeState(stored);
      apply(stored);
    };
    read();

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (e) => {
        if (e.data?.type === "theme") read();
      };
    }
    return () => {
      window.removeEventListener("storage", onStorage);
      bc?.close();
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    apply(t);
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(CHANNEL);
      bc.postMessage({ type: "theme", theme: t });
      bc.close();
    }
  }, []);

  return { theme, setTheme, mounted };
}