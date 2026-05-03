'use client';

import { useMotion } from "@/hooks/use-reduced-motion";

export function AuroraBackground() {
  const { reduced, mounted } = useMotion();

  if (!mounted) {
    return (
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0_0_0)_75%)]" />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background"
      aria-hidden="true"
    >
      {/* Base radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0_0_0)_75%)]" />

      {reduced ? (
        // Lightweight static fallback — no blur filter, no animation
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(ellipse_60%_50%_at_70%_40%,oklch(0.45_0.22_270/0.55),transparent_70%),radial-gradient(ellipse_50%_40%_at_30%_60%,oklch(0.4_0.2_220/0.45),transparent_70%)]" />
      ) : (
        <>
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
          <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay noise" />
        </>
      )}

      {/* Bottom fade into black */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
