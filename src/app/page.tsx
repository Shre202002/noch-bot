
"use client";

import { useState } from 'react';
import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { EmbedProcess } from '@/components/EmbedProcess';
import { DashboardScrollSection } from '@/components/DashboardScrollSection';
import { HowItWorks } from '@/components/HowItWorks';
import { Pricing } from '@/components/Pricing';
import Featured_05 from '@/components/ui/globe-feature-section';
import { NewsletterPopup } from '@/components/NewsletterPopup';
import { CinematicFooter } from '@/components/ui/motion-footer';
import { AnimatedNavFramer } from '@/components/ui/navigation-menu';

export default function Page() {
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);

  return (
    <div className="relative w-full selection:bg-white/20 overflow-x-hidden">
      <AnimatedNavFramer />
      <div className="relative z-10 w-full bg-background border-b border-white/5 rounded-b-[40px] shadow-2xl">
        <main>
          <Hero />
          <Features />
          <EmbedProcess />
          
          <DashboardScrollSection />

          <HowItWorks />
          
          <Featured_05 onJoinClick={() => setIsNewsletterOpen(true)} />

          <Pricing />
        </main>
      </div>

      <CinematicFooter />
      
      <NewsletterPopup 
        isOpen={isNewsletterOpen} 
        onClose={() => setIsNewsletterOpen(false)} 
      />
    </div>
  );
}
