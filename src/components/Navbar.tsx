import Link from "next/link";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <img
            src="/Noch-bot-logo.svg"
            alt="NochBot"
            className="h-10 w-auto"
          />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Product</a>
          <a href="#how-it-works" className="hover:text-foreground">Company</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
        </nav>
        <Link href="/register" className="rounded-full bg-foreground px-4 py-1.5 text-xs text-background">
          Try Nocta
        </Link>
      </div>
    </header>
  );
}