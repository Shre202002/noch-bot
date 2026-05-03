import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { EmbedProcess } from '@/components/EmbedProcess';
import { HowItWorks } from '@/components/HowItWorks';
import { Pricing } from '@/components/Pricing';
import { Footer } from '@/components/Footer';
import { LandingControls } from '@/components/LandingControls';

export default function Page() {
  return (
    <div className="relative min-h-screen">
      <Nav />
      <main>
        <Hero />
        <Features />
        <EmbedProcess />
        <HowItWorks />
        <Pricing />
      </main>
      <Footer />
      <LandingControls />
    </div>
  );
}