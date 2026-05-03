'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 h-14 transition-all duration-300",
      scrolled ? "backdrop-blur-xl bg-[#080b10]/85 border-b border-white/5" : "bg-transparent"
    )}>
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="text-[18px] font-medium tracking-[-0.03em] text-white">
          nocta
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          {['Product', 'Company', 'Pricing', 'Sign in'].map((item) => (
            <Link 
              key={item} 
              href={`#${item.toLowerCase().replace(' ', '-')}`}
              className="text-[13px] text-white/40 transition-colors hover:text-white"
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link 
            href="/login" 
            className="hidden sm:inline-flex rounded-full border border-white/10 px-4 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link 
            href="/register" 
            className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#080b10] hover:opacity-90 transition-opacity"
          >
            Try Nocta
          </Link>
        </div>
      </div>
    </nav>
  );
}