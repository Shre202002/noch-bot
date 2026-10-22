"use client";

import { useEffect, useRef, useState } from "react";

export function AppFlow() {
  const frame = useRef<HTMLIFrameElement>(null);
  // The figure page reports its own height, so the frame never clips the legend or leaves a gap.
  const [height, setHeight] = useState(720);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "nochbot-figure" && typeof event.data.height === "number") setHeight(Math.ceil(event.data.height));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <section id="architecture" className="relative border-t border-white/5 bg-[#080b10] px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1000px]">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Under the hood</p>
          <h2 className="mt-6 text-[clamp(2rem,4vw,3.5rem)] font-normal tracking-[-0.04em] text-white leading-tight">
            One message,<br />two lines.
          </h2>
          <p className="mt-6 text-base text-white/40">
            Every visitor message passes the same guard, then either an answer grounded in your own pages and PDFs or a
            booking that ends with a scanned ticket. Click the desk to send one down each line.
          </p>
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl border border-white/10">
          <iframe
            ref={frame}
            src="/figures/app-flow.html"
            title="NochBot request path: a sorting desk where a visitor's message is guarded, then answered from your content or booked, paid, ticketed and scanned"
            loading="lazy"
            scrolling="no"
            style={{ height }}
            className="block w-full border-0"
          />
        </div>
      </div>
    </section>
  );
}
