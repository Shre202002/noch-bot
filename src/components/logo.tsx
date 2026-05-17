import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,transparent_75%)] blur-md" />
        <img
          src="/nohbot.png"
          alt="NochBot"
          className="relative z-10"
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
          src="/nohbot.png"
          alt="NochBot"
          className="relative z-10"
          style={{ height: '1.5em', width: 'auto' }}
        />
      </div>
    );
  }
