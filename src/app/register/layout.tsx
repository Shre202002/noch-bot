import type { Metadata } from 'next';

// This route only redirects to the homepage, where sign-in happens in a modal. Keep it out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
