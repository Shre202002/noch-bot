import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The official terms and conditions for using the NochBot AI platform.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
    return (
      <main className="min-h-screen bg-black text-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
  
          <h1 className="text-5xl font-bold mb-10">
            Terms of Service
          </h1>
  
          <p className="text-zinc-400 mb-12">
            Last updated: May 2026
          </p>
  
          <div className="space-y-10 text-zinc-300 leading-8 text-[15px]">
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Acceptance of Terms
              </h2>
  
              <p>
                By accessing or using NochBot, you agree to these Terms
                of Service and all applicable laws and regulations.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Platform Usage
              </h2>
  
              <p>
                NochBot provides AI chatbot infrastructure, website crawling,
                analytics and automation tools.
              </p>
  
              <p className="mt-4">
                Users may not use the platform for illegal activity,
                spam, abuse, malware distribution or harmful automation.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                AI Responses
              </h2>
  
              <p>
                AI-generated responses may contain inaccuracies or incomplete
                information. Users are responsible for reviewing chatbot outputs
                before relying on them.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Accounts & Security
              </h2>
  
              <p>
                Users are responsible for maintaining account security
                and protecting login credentials.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Subscription & Billing
              </h2>
  
              <p>
                Paid plans may include usage limits, branding removal
                and advanced features. Pricing and limits may change over time.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Limitation of Liability
              </h2>
  
              <p>
                NochBot is provided on an “as is” basis without warranties
                of any kind. We are not liable for losses, damages or interruptions
                resulting from use of the platform.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Termination
              </h2>
  
              <p>
                We reserve the right to suspend or terminate accounts
                that violate these Terms or misuse the platform.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Contact
              </h2>
  
              <p>
                Questions regarding these Terms may be sent to:
              </p>
  
              <p className="mt-3 text-white">
                support@nochbot.space
              </p>
            </section>
  
          </div>
        </div>
      </main>
    );
  }
