import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1400px] px-6 py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-sm bg-foreground" />
              <span className="text-sm font-medium tracking-tight text-foreground">Nocta</span>
            </Link>
            <p className="mt-6 max-w-sm text-sm text-muted-foreground">
              An AI chatbot platform for the modern web. Built to be fast, embeddable, and out of your way.
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Product</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a href="#features" className="text-foreground transition hover:text-muted-foreground">Features</a></li>
              <li><a href="#pricing" className="text-foreground transition hover:text-muted-foreground">Pricing</a></li>
              <li><a href="#how-it-works" className="text-foreground transition hover:text-muted-foreground">Workflow</a></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Company</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a href="#" className="text-foreground transition hover:text-muted-foreground">About</a></li>
              <li><a href="#" className="text-foreground transition hover:text-muted-foreground">Careers</a></li>
              <li><a href="#" className="text-foreground transition hover:text-muted-foreground">Press</a></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a href="#" className="text-foreground transition hover:text-muted-foreground">Privacy</a></li>
              <li><a href="#" className="text-foreground transition hover:text-muted-foreground">Terms</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
          <p className="text-xs text-muted-foreground">© 2026 Nocta. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">Built for the open web.</p>
        </div>
      </div>
    </footer>
  );
}
