export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ height: '1.2em', width: 'auto' }}
    >
      {/* n */}
      <path
        d="M10 32V24C10 20.6863 12.6863 18 16 18C19.3137 18 22 20.6863 22 24V32"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="32" r="2.5" fill="#F59E0B" />

      {/* o (stylized chat bubble) */}
      <circle cx="42" cy="24" r="9" stroke="currentColor" strokeWidth="3.5" />
      <path
        d="M36 30L33 33"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="39" cy="24" r="1" fill="currentColor" />
      <circle cx="42" cy="24" r="1" fill="currentColor" />
      <circle cx="45" cy="24" r="1" fill="currentColor" />
      <circle cx="50" cy="16" r="2.5" fill="#F59E0B" />

      {/* c */}
      <path
        d="M74 18C71 18 68 21 68 25C68 29 71 32 74 32"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* t */}
      <path d="M88 14V32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M83 21H93" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="93" cy="15" r="2.5" fill="#F59E0B" />

      {/* a */}
      <circle cx="108" cy="25" r="7" stroke="currentColor" strokeWidth="3.5" />
      <path d="M115 18V32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="115" cy="25" r="2.5" fill="#F59E0B" />
    </svg>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="11" cy="13" r="7" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M6 18L3 21"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
      <circle cx="11" cy="13" r="1" fill="currentColor" />
      <circle cx="14" cy="13" r="1" fill="currentColor" />
      <circle cx="17" cy="7" r="2.5" fill="#F59E0B" />
    </svg>
  );
}
