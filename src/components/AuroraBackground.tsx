'use client';

interface AuroraProps {
  reduced?: boolean;
}

export function AuroraBackground({ reduced }: AuroraProps) {
  if (reduced) {
    return (
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#080b10]">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(ellipse_at_70%_40%,rgba(99,82,244,0.15),transparent_70%)]" />
        <div className="absolute inset-0 grid-bg" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#080b10]">
      {/* Base radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#080b10_80%)]" />

      {/* Animated Blobs */}
      <div 
        className="aurora-blob absolute top-[-10%] left-[-5%] w-[600px] h-[500px] rounded-full bg-[radial-gradient(ellipse,rgba(99,82,244,0.35),transparent_70%)] filter blur-[90px] animate-drift" 
      />
      <div 
        className="aurora-blob absolute top-[10%] right-[-5%] w-[500px] h-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(139,92,246,0.25),transparent_70%)] filter blur-[90px] animate-drift"
        style={{ animationDelay: '-4s' }}
      />
      <div 
        className="aurora-blob absolute bottom-[10%] left-[5%] w-[400px] h-[350px] rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.18),transparent_70%)] filter blur-[90px] animate-drift"
        style={{ animationDelay: '-8s' }}
      />

      {/* Grid Overlay */}
      <div className="absolute inset-0 grid-bg opacity-100" />
      
      {/* Noise Overlay */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[#080b10]" />
    </div>
  );
}