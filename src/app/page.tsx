
"use client";

import { useState } from 'react';
import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { EmbedProcess } from '@/components/EmbedProcess';
import { HowItWorks } from '@/components/HowItWorks';
import { Pricing } from '@/components/Pricing';
import { LandingControls } from '@/components/LandingControls';
import Featured_05 from '@/components/ui/globe-feature-section';
import { NewsletterPopup } from '@/components/NewsletterPopup';
import { CinematicFooter } from '@/components/ui/motion-footer';

export default function Page() {
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);

  return (
    <div className="relative w-full selection:bg-white/20 overflow-x-hidden">
      {/* 
        MAIN CONTENT AREA 
        We use a high z-index and minimum height to allow the user 
        to scroll down and reveal the footer underneath.
      */}
      <div className="relative z-10 w-full bg-background border-b border-white/5 rounded-b-[40px] shadow-2xl">
        <Nav />
        <main>
          <Hero />
          <Features />
          <EmbedProcess />
          <HowItWorks />
          
          <Featured_05 onJoinClick={() => setIsNewsletterOpen(true)} />

          <Pricing />
        </main>
      </div>

      <CinematicFooter />
      
      <LandingControls />
      <NewsletterPopup 
        isOpen={isNewsletterOpen} 
        onClose={() => setIsNewsletterOpen(false)} 
      />
    </div>
  );
}
