'use client';

import { useTheme } from '@/hooks/use-theme';

interface AuroraProps {
  reduced?: boolean;
}

export function AuroraBackground({ reduced }: AuroraProps) {
  const { theme } = useTheme();

  if (reduced) {
    return (
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#080b10]">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_70%_40%,rgba(99,82,244,0.15),transparent_70%)]" />
        <div className="absolute inset-0 grid-bg" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#080b10]">
      {/* 1. Base Animated Blobs */}
      <div 
        className="aurora-blob absolute top-[-10%] left-[-5%] w-[700px] h-[600px] rounded-full bg-[radial-gradient(ellipse,rgba(99,82,244,0.4),transparent_70%)] blur-[100px] animate-drift" 
      />
      <div 
        className="aurora-blob absolute top-[5%] right-[-10%] w-[600px] h-[500px] rounded-full bg-[radial-gradient(ellipse,rgba(139,92,246,0.3),transparent_70%)] blur-[100px] animate-drift"
        style={{ animationDelay: '-5s', animationDirection: 'reverse' }}
      />
      <div 
        className="aurora-blob absolute bottom-[5%] left-[10%] w-[500px] h-[450px] rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.2),transparent_70%)] blur-[100px] animate-drift"
        style={{ animationDelay: '-10s' }}
      />

      {/* 2. Grid Overlay */}
      <div className="absolute inset-0 grid-bg opacity-[0.4]" />
      
      {/* 3. Vignette Overlay (Soft mask to focus center) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#080b10_90%)] opacity-80" />

      {/* 4. Bottom Fade */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-[#080b10]" />
      
      {/* 5. Subtle Noise Texture */}
      <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
