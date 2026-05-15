'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ExternalLink, X } from 'lucide-react';
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
          className="fixed bottom-6 left-6 right-6 z-[100] mx-auto max-w-4xl"
        >
          <div className="flex flex-col md:flex-row items-center gap-6 rounded-3xl border border-white/10 bg-[#0d1117]/80 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-primary">
              <Shield className="h-6 w-6" />
            </div>
            
            <div className="flex-1 space-y-1 text-center md:text-left">
              <p className="text-sm font-medium text-white">We value your privacy</p>
              <p className="text-xs text-white/40 leading-relaxed">
                We use cookies and behavioral analytics to improve NochBot experience and chatbot performance. 
                Read our <Link href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</Link> for details.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleConsent('declined')}
                className="text-white/40 hover:text-white hover:bg-white/5"
              >
                Decline
              </Button>
              <Button 
                size="sm" 
                onClick={() => handleConsent('accepted')}
                className="bg-white text-black hover:opacity-90 rounded-full px-6"
              >
                Accept All
              </Button>
            </div>

            <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
