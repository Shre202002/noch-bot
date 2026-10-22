'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('nb_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (choice: 'accepted' | 'declined') => {
    localStorage.setItem('nb_cookie_consent', choice);
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-[100] mx-auto max-w-4xl md:bottom-6 md:left-6 md:right-6 short-landscape:bottom-2 short-landscape:left-2 short-landscape:right-2"
        >
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-6 rounded-2xl md:rounded-3xl border border-white/10 bg-[#0d1117]/95 md:bg-[#0d1117]/80 p-3 md:p-6 shadow-2xl backdrop-blur-xl short-landscape:flex-row short-landscape:items-center short-landscape:gap-4 short-landscape:rounded-2xl short-landscape:p-2 short-landscape:pl-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-primary md:flex short-landscape:hidden">
              <Shield className="h-6 w-6" />
            </div>

            <div className="flex-1 space-y-1 text-center md:text-left">
              <p className="hidden text-sm font-medium text-white md:block short-landscape:hidden">We value your privacy</p>
              <p className="text-xs text-white/70 leading-relaxed text-left md:text-left">
                <span className="md:hidden short-landscape:inline">We use cookies and analytics to improve NochBot. </span>
                <span className="hidden md:inline short-landscape:hidden">We use cookies and behavioral analytics to improve NochBot experience and chatbot performance. </span>
                Read our <Link href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</Link><span className="hidden md:inline short-landscape:hidden"> for details</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-3 shrink-0 short-landscape:flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleConsent('declined')}
                className="min-h-11 md:min-h-0 text-white/70 hover:text-white hover:bg-white/5"
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => handleConsent('accepted')}
                className="min-h-11 md:min-h-0 bg-white text-black hover:opacity-90 rounded-full px-6"
              >
                Accept All
              </Button>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
