
"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import createGlobe, { COBEOptions } from "cobe";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * @fileOverview A global scale feature section for NOCTA.
 * Showcases the platform's reach using an interactive 3D globe.
 */

interface Featured_05Props {
  onJoinClick?: () => void;
}

export default function Featured_05({ onJoinClick }: Featured_05Props) {
  return (
    <section className="relative w-full overflow-hidden border-y border-white/5 bg-[#0d1117] py-24 md:py-32 mt-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="flex flex-col-reverse items-center justify-between gap-12 md:flex-row">
          <div className="z-10 max-w-xl text-left">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-4">Scale Globally</p>
            <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-white leading-tight">
              Deploy <span className="text-primary font-medium">AI Agents</span>{" "}
              <span className="text-white/40">anywhere in the world. NOCTA powers millions of conversations across every continent, in real-time.</span>
            </h2>
            <Button 
              onClick={onJoinClick}
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-6 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Join the Network <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative h-[300px] w-full max-w-xl md:h-[450px]">
            <Globe className="absolute -bottom-20 -right-20 md:-right-40 scale-125 md:scale-150" />
          </div>
        </div>
      </div>
      
      {/* Background Decorative Element */}
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
  let phi = 0;
  let width = 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [r, setR] = useState(0);

  const updatePointerInteraction = (value: any) => {
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

  const onRender = useCallback(
    (state: Record<string, any>) => {
      if (!pointerInteracting.current) phi += 0.005;
      state.phi = phi + r;
      state.width = width * 2;
      state.height = width * 2;
    },
    [r],
  );

  const onResize = () => {
    if (canvasRef.current) {
      width = canvasRef.current.offsetWidth;
    }
  };

  useEffect(() => {
    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvasRef.current!, {
      ...config,
      width: width * 2,
      height: width * 2,
      onRender,
    });

    setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = "1";
    });
    return () => globe.destroy();
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 mx-auto aspect-[1/1] w-full max-w-[600px]",
        className,
      )}
    >
      <canvas
        className={cn(
          "size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]",
        )}
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
