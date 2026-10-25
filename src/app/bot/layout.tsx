import type { Metadata } from 'next';

// Account, widget and tool pages: titled for the browser tab, kept out of search results.
export const metadata: Metadata = {
  title: 'NochBot assistant',
  description: 'Chat with the NochBot assistant.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
