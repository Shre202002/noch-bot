import { EmbedProcess } from "@/components/EmbedProcess";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { LandingControls } from "@/components/LandingControls";
import { Navbar } from "@/components/Navbar";
import { Pricing } from "@/components/Pricing";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <EmbedProcess />
        <Features />
        <Pricing />
      </main>
      <Footer />
      <LandingControls />
    </>
  );
}
