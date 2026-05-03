import type { Metadata } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const dmSans = DM_Sans({ 
  subsets: ['latin'], 
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans'
});

const instrumentSerif = Instrument_Serif({ 
  subsets: ['latin'], 
  weight: ['400'],
  style: ['italic'],
  variable: '--font-instrument-serif'
});

export const metadata: Metadata = {
  title: 'Nocta - Add AI to your website in 60 seconds',
  description: 'Full-stack multi-tenant SaaS AI chatbot platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${instrumentSerif.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}