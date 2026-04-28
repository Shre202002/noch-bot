import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-bold text-lg">Nocta</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">
            Login
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" className="hidden md:flex">
             <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/register">Start Free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
