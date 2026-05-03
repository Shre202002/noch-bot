'use client';

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "nocta:motion-pref";
const CHANNEL = "nocta:prefs";
export type MotionPref = "auto" | "reduce" | "full";

type Reason = "user" | "os" | "device" | "viewport" | "vitals" | null;

function detectAutoReason(): Reason {
  if (typeof window === "undefined") return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "os";

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const lowCores = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMem = (nav.deviceMemory ?? 8) <= 4;
  const saveData = nav.connection?.saveData === true;
  const slowNet = ["slow-2g", "2g", "3g"].includes(nav.connection?.effectiveType ?? "");
  if (lowCores || lowMem || saveData || slowNet) return "device";

  if (window.innerWidth <= 640) return "viewport";

  try {
    const [nav0] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (nav0) {
      const fcpEntry = performance.getEntriesByName("first-contentful-paint")[0];
      const fcp = fcpEntry?.startTime ?? nav0.domContentLoadedEventEnd;
      if (fcp > 2500) return "vitals";
    }
  } catch {
    // ignore
  }
  return null;
}

export interface MotionState {
  reduced: boolean;
  pref: MotionPref;
  autoReason: Reason;
  setPref: (p: MotionPref) => void;
  mounted: boolean;
}

export function useMotion(): MotionState {
  const [pref, setPrefState] = useState<MotionPref>("auto");
  const [autoReason, setAutoReason] = useState<Reason>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);

    const read = () => {
      const stored = (localStorage.getItem(STORAGE_KEY) as MotionPref | null) ?? "auto";
      setPrefState(stored);
      setAutoReason(detectAutoReason());
    };
    read();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => read();
    mq.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (e) => {
        if (e.data?.type === "motion") read();
      };
    }

    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("storage", onStorage);
      bc?.close();
    };
  }, []);

  const setPref = useCallback((p: MotionPref) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, p);
    setPrefState(p);
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(CHANNEL);
      bc.postMessage({ type: "motion", pref: p });
      bc.close();
    }
  }, []);

  const reduced = pref === "reduce" ? true : pref === "full" ? false : autoReason !== null;

  return { reduced, pref, autoReason, setPref, mounted };
}

export function useReducedMotion(): boolean {
  return useMotion().reduced;
}