"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { ContactSection } from '@/components/ContactSection';
import { useToast } from '@/hooks/use-toast';

function PageContent() {
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      toast({
        title: "Password Updated",
        description: "Your password has been updated. You can now sign in.",
        className: "bg-[#0a0a0a] border-[#36f4a4]/20 text-white",
      });
    }
  }, [searchParams, toast]);

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

          <ContactSection />
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

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
