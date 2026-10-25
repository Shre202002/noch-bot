"use client";

import { AnimatedNavFramer } from "@/components/ui/navigation-menu";
import { CinematicFooter } from "@/components/ui/motion-footer";

/**
 * The homepage's shell, shared by every public page: the fixed pill navigation, a rounded content panel, and the
 * footer that is revealed from underneath it. The panel is at least one screen tall so the fixed footer never sits
 * over a short page. Pass `pad={false}` where the first section already handles the space under the navigation.
 */
export function SiteChrome({ children, pad = true }: { children: React.ReactNode; pad?: boolean }) {
  return (
    <div className="relative w-full selection:bg-white/20 overflow-x-hidden">
      <AnimatedNavFramer />
      <div
        className={`relative z-10 w-full bg-background border-b border-white/5 rounded-b-[40px] shadow-2xl ${
          pad ? "min-h-screen pt-14 sm:pt-28" : ""
        }`}
      >
        {children}
      </div>
      <CinematicFooter />
    </div>
  );
}
