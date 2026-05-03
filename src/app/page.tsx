
"use client";

import { useState } from 'react';
import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { EmbedProcess } from '@/components/EmbedProcess';
import { HowItWorks } from '@/components/HowItWorks';
import { Pricing } from '@/components/Pricing';
import { Footer } from '@/components/Footer';
import { LandingControls } from '@/components/LandingControls';
import Featured_05 from '@/components/ui/globe-feature-section';
import { NewsletterPopup } from '@/components/NewsletterPopup';

export default function Page() {
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);

  return (
    <div className="relative min-h-screen">
      <Nav />
      <main>
        <Hero />
        <Features />
        <EmbedProcess />
        <HowItWorks />
        
        {/* New Global Scale Feature Section - Full Width */}
        <Featured_05 onJoinClick={() => setIsNewsletterOpen(true)} />

        <Pricing />
      </main>
      <Footer />
      <LandingControls />
      <NewsletterPopup 
        isOpen={isNewsletterOpen} 
        onClose={() => setIsNewsletterOpen(false)} 
      />
    </div>
  );
}
