import type { Metadata } from 'next';

// Account, widget and tool pages: titled for the browser tab, kept out of search results.
export const metadata: Metadata = {
  title: 'Ticket scanner',
  description: 'Scan event tickets at the door with NochBot.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
