import type { Metadata } from 'next';

// Account, widget and tool pages: titled for the browser tab, kept out of search results.
export const metadata: Metadata = {
  title: 'Verify your email',
  description: 'Confirm your NochBot email with a one-time code.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
