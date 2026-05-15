import type { Metadata } from 'next';
import { Inter, Syne } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { CookieConsent } from '@/components/CookieConsent';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter'
});

const syne = Syne({ 
  subsets: ['latin'],
  variable: '--font-syne'
});

export const metadata: Metadata = {
  title: 'NochBot | AI Chatbot Platform',
  description: 'NochBot — Deploy your own branded AI chatbot, trained on your data. Multi-tenant. Instant. Powered by Groq LLaMA.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${syne.variable} font-body antialiased bg-black text-white`}>
        {children}
        <CookieConsent />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
