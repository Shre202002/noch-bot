"use client";

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { EmbedProcess } from '@/components/EmbedProcess';
import { HowItWorks } from '@/components/HowItWorks';
import { Pricing } from '@/components/Pricing';
import { NewsletterPopup } from '@/components/NewsletterPopup';
import { SiteChrome } from '@/components/site/SiteChrome';
import { ContactSection } from '@/components/ContactSection';
import { UseCaseLinks } from '@/components/seo/UseCaseLinks';
import { useToast } from '@/hooks/use-toast';

// Below-the-fold sections are heavy (animation, globe, charts). They are split into their own chunks so the first
// screen paints without waiting for them; they still render on the server, so crawlers see their text.
const AppFlow = dynamic(() => import('@/components/AppFlow').then((m) => m.AppFlow));
const DashboardScrollSection = dynamic(() =>
  import('@/components/DashboardScrollSection').then((m) => m.DashboardScrollSection),
);
const Featured_05 = dynamic(() => import('@/components/ui/globe-feature-section'));
const GitHubActivity = dynamic(() => import('@/components/GitHubActivity').then((m) => m.GitHubActivity));

/**
 * Reads ?reset=success. It sits in its own Suspense boundary because useSearchParams opts everything above the
 * nearest boundary out of server rendering; keeping it here leaves the rest of the page in the HTML.
 */
function ResetSuccessToast() {
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

  return null;
}

export function HomePage() {
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);

  return (
    <SiteChrome pad={false}>
      <Suspense fallback={null}>
        <ResetSuccessToast />
      </Suspense>

      <main>
        <Hero />
        <Features />
        <EmbedProcess />

        <AppFlow />

        <DashboardScrollSection />

        <HowItWorks />

        <Featured_05 onJoinClick={() => setIsNewsletterOpen(true)} />

        <Pricing />

        <GitHubActivity />

        <UseCaseLinks />

        <ContactSection />
      </main>

      <NewsletterPopup
        isOpen={isNewsletterOpen}
        onClose={() => setIsNewsletterOpen(false)}
      />
    </SiteChrome>
  );
}
