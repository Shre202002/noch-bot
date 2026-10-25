import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seoPages';

type MetaInput = { title: string; description: string; path: string; keywords?: string[]; type?: 'website' | 'article' };

/** <head> for any content page. The root layout appends " | NochBot" to `title`. */
export function buildMetadata({ title, description, path, keywords, type = 'website' }: MetaInput): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: `${SITE_URL}${path}`,
      siteName: 'NochBot',
      title: `${title} | NochBot`,
      description,
      images: [{ url: '/brand/og-image.jpg', width: 1200, height: 630, alt: 'NochBot AI chatbot platform' }],
    },
    twitter: { card: 'summary_large_image', title: `${title} | NochBot`, description, images: ['/brand/og-image.jpg'] },
  };
}

/** JSON-LD is embedded as text, so "<" is escaped to keep it from closing the script element. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\u003c');
}

export function breadcrumbLd(trail: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'NochBot', path: '/' }, ...trail].map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${SITE_URL}${t.path === '/' ? '' : t.path}`,
    })),
  };
}

export function faqLd(faqs: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}
