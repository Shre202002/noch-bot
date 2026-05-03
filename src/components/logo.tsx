export function Logo({ className }: { className?: string }) {
    return (
      <img
        src="/logo.png"
        alt="Nocta"
        className={className}
        style={{ height: '2em', width: 'auto' }}
      />
    );
  }
  
  export function LogoIcon({ className }: { className?: string }) {
    return (
      <img
        src="/logo.png"
        alt="Nocta"
        className={className}
        style={{ height: '1.5em', width: 'auto' }}
      />
    );
  }