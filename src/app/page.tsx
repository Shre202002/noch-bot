
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
  return (
    <div className="relative min-h-screen">
      <Nav />
      <main>
        <Hero />
        <Features />
        <EmbedProcess />
        <HowItWorks />
        
        {/* New Global Scale Feature Section */}
        <div className="mx-auto max-w-[1200px] px-6">
          <Featured_05 />
        </div>

        <Pricing />
      </main>
      <Footer />
      <LandingControls />
      <NewsletterPopup />
    </div>
  );
}
