import type { Metadata } from 'next';
import { Inter, Syne } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { CookieBanner } from '@/components/CookieBanner';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter'
});

const syne = Syne({ 
  subsets: ['latin'],
  variable: '--font-syne'
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nochbot.space"),
  title: {
    default: "NochBot | AI Chatbot Platform",
    template: "%s | NochBot",
  },
  description: "NochBot — Deploy your own branded AI chatbot, trained on your data. Multi-tenant. Instant. Powered by Groq LLaMA.",
  keywords: [
    "AI chatbot",
    "SaaS chatbot",
    "Customer support AI",
    "RAG chatbot",
    "Website AI assistant",
    "NochBot",
    "Groq LLaMA chatbot",
    "Embedded AI widget",
  ],
  authors: [{ name: "NochBot Team", url: "https://nochbot.space" }],
  creator: "NochBot",
  publisher: "NochBot",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/Noch-bot-logo.svg",
    shortcut: "/Noch-bot-logo.svg",
    apple: "/Noch-bot-logo.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://nochbot.space",
    siteName: "NochBot",
    title: "NochBot | The Intelligent AI Chatbot Platform",
    description: "Turn your website content into an intelligent AI assistant. Embed NochBot in minutes and provide instant support to your visitors.",
    images: [
      {
        url: "/Noch-bot-logo.svg",
        width: 1200,
        height: 630,
        alt: "NochBot AI Platform Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NochBot | AI Chatbot for Every Business",
    description: "Instant AI support for your website visitors. Trained on your data.",
    images: ["/Noch-bot-logo.svg"],
  },
  manifest: "/site.webmanifest",
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
        <CookieBanner />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}