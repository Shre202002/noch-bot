"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import createGlobe, { COBEOptions } from "cobe";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * @fileOverview A global scale feature section for NOCTA.
 * Showcases the platform's reach using an interactive 3D globe.
 * Optimized for a "half-globe" aesthetic with a 60/40 layout split.
 */

interface Featured_05Props {
  onJoinClick?: () => void;
}

export default function Featured_05({ onJoinClick }: Featured_05Props) {
  return (
    <section className="relative w-full overflow-hidden border-y border-white/5 bg-[#0d1117] py-24 md:py-32 mt-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-0">

          {/* TEXT — 60% on desktop */}
          <div className="z-10 w-full lg:w-[60%] lg:pr-20 text-left">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-6">
              Scale Globally
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-white leading-[1.05]">
              Deploy{" "}
              <span className="text-[#7c6fff] font-medium">AI Agents</span>
            </h2>
            <p className="mt-5 text-xl md:text-2xl lg:text-3xl font-normal text-white/35 leading-snug max-w-lg">
              Powering millions of conversations across every continent in real-time.
            </p>
            <Button
              onClick={onJoinClick}
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-6 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Join the Network <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* GLOBE — 40% desktop column, globe overflows right by ~35% */}
          <div className="relative hidden lg:block lg:w-[40%] h-[600px] flex-shrink-0 overflow-visible">
            <Globe className="absolute top-1/2 -translate-y-1/2 -right-[35%] w-[750px] h-[750px]" />
          </div>

          {/* GLOBE — mobile, centered and clipped */}
          <div className="relative block lg:hidden w-full h-[320px] overflow-hidden">
            <Globe className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px]" />
          </div>

        </div>
      </div>

      {/* Right edge fade — makes globe crop feel intentional and smooth */}
      <div className="absolute right-0 top-0 bottom-0 w-48 bg-gradient-to-l from-[#0d1117] to-transparent z-10 pointer-events-none hidden lg:block" />

      {/* Background grid */}
      <div className="absolute inset-0 -z-10 opacity-[0.03] grid-bg" />
    </section>
  );
}

const GLOBE_CONFIG: COBEOptions = {
  width: 1000,
  height: 1000,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 1.2,
  mapSamples: 16000,
  mapBrightness: 6,
  baseColor: [0.3, 0.3, 0.3],
  markerColor: [124 / 255, 111 / 255, 255 / 255], // NOCTA Indigo
  glowColor: [0.1, 0.1, 0.2],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
};

export function Globe({
  className,
  config = GLOBE_CONFIG,
}: {
  className?: string;
  config?: COBEOptions;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  
  const phiRef = useRef(0);
  const widthRef = useRef(0);
  const rRef = useRef(0);
  
  const [r, setR] = useState(0);

  useEffect(() => {
    rRef.current = r;
  }, [r]);

  const onRender = useCallback(
    (state: Record<string, any>) => {
      if (!pointerInteracting.current) phiRef.current += 0.005;
      state.phi = phiRef.current + rRef.current;
      state.width = widthRef.current * 2;
      state.height = widthRef.current * 2;
    },
    [],
  );

  const onResize = useCallback(() => {
    if (canvasRef.current) {
      widthRef.current = canvasRef.current.offsetWidth;
    }
  }, []);

  const memoizedConfig = useMemo(() => config, [config]);

  useEffect(() => {
    if (!canvasRef.current) return;

    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvasRef.current, {
      ...memoizedConfig,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender,
    });

    const timeout = setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = "1";
    });

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timeout);
      globe.destroy();
    };
  }, [memoizedConfig, onRender, onResize]);

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value ? "grabbing" : "grab";
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      setR(delta / 200);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <canvas
        className="size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
        ref={canvasRef}
        onPointerDown={(e) =>
          updatePointerInteraction(
            e.clientX - pointerInteractionMovement.current,
          )
        }
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) =>
          e.touches[0] && updateMovement(e.touches[0].clientX)
        }
      />
    </div>
  );
}
