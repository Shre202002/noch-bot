export default function PrivacyPage() {
    return (
      <main className="min-h-screen bg-black text-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
  
          <h1 className="text-5xl font-bold mb-10">
            Privacy Policy
          </h1>
  
          <p className="text-zinc-400 mb-12">
            Last updated: May 2026
          </p>
  
          <div className="space-y-10 text-zinc-300 leading-8 text-[15px]">
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Overview
              </h2>
  
              <p>
                NochBot provides AI-powered chatbot and automation services
                for websites and businesses. This Privacy Policy explains
                how we collect, use, store and protect user information.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Information We Collect
              </h2>
  
              <ul className="list-disc pl-6 space-y-2">
                <li>Name and email address</li>
                <li>Authentication and login data</li>
                <li>Website URLs submitted for crawling</li>
                <li>Chat conversations and analytics</li>
                <li>Browser and device information</li>
                <li>Usage activity and session metadata</li>
              </ul>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                How We Use Data
              </h2>
  
              <p>
                We use collected information to provide chatbot functionality,
                improve AI responses, generate analytics, maintain security,
                and enhance platform performance.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                AI & Third-Party Services
              </h2>
  
              <p>
                NochBot uses third-party AI and infrastructure providers,
                including Groq, Google Gemini, MongoDB, Qdrant and Google OAuth.
                Data may be processed through these services as required
                for platform functionality.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Cookies & Authentication
              </h2>
  
              <p>
                We use cookies, local storage and secure authentication tokens
                to maintain sessions, improve user experience and protect accounts.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Data Security
              </h2>
  
              <p>
                We implement reasonable technical and organizational safeguards
                to protect user data. However, no online platform can guarantee
                absolute security.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                User Rights
              </h2>
  
              <p>
                Users may request access, correction or deletion of their data
                by contacting us directly.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Contact
              </h2>
  
              <p>
                Questions regarding this Privacy Policy may be sent to:
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