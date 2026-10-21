import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,transparent_75%)] blur-md" />
        <img
          src="/brand/nochbot-logo.webp"
          alt="NochBot"
          width={192}
          height={128}
          decoding="async"
          className="relative z-10 bg-transparent"
          style={{ height: '2em', width: 'auto' }}
        />
      </div>
    );
  }
  
  export function LogoIcon({ className }: { className?: string }) {
    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.15)_0%,transparent_70%)] blur-sm" />
        <img
          src="/brand/nochbot-logo.webp"
          alt="NochBot"
          width={192}
          height={128}
          decoding="async"
          className="relative z-10 bg-transparent"
          style={{ height: '1.5em', width: 'auto' }}
        />
      </div>
    );
  }
  /** The wordmark trimmed to its artwork, so `height` is the height people actually see. */
  export function Wordmark({ height = 24, className }: { height?: number; className?: string }) {
    return (
      <img
        src="/brand/nochbot-wordmark.webp"
        alt="NochBot"
        width={408}
        height={96}
        decoding="async"
        className={cn("block w-auto", className)}
        style={{ height }}
      />
    );
  }
