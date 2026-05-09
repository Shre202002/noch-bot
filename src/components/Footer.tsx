import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#080b10] px-6 py-12 md:py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Link href="/" className="text-[18px] font-bold tracking-[-0.03em] text-white uppercase">
              NOCHQ
            </Link>
            <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/30">
              An AI chatbot platform for the modern web. Built to be fast, embeddable, and out of your way.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-6 md:grid-cols-3">
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-white/20">Product</p>
              <ul className="space-y-3">
                {['Features', 'Pricing', 'Workflow'].map(l => (
                  <li key={l}><Link href={`#${l.toLowerCase()}`} className="text-[13px] text-white/40 hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-white/20">Company</p>
              <ul className="space-y-3">
                {['About', 'Careers', 'Press'].map(l => (
                  <li key={l}><Link href="#" className="text-[13px] text-white/40 hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-white/20">Legal</p>
              <ul className="space-y-3">
                {['Privacy', 'Terms'].map(l => (
                  <li key={l}><Link href="#" className="text-[13px] text-white/40 hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 md:flex-row">
          <p className="text-[11px] text-white/20">
            © 2025 Nochq. All rights reserved. Built for the open web.
          </p>
          <div className="flex gap-6">
             <Link href="#" className="text-[11px] text-white/20 hover:text-white transition-colors">X / Twitter</Link>
             <Link href="#" className="text-[11px] text-white/20 hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}