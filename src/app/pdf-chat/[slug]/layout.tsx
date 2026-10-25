import type { Metadata } from 'next';

// Account, widget and tool pages: titled for the browser tab, kept out of search results.
export const metadata: Metadata = {
  title: 'Chat with a document',
  description: 'Ask questions about a shared document on NochBot.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
