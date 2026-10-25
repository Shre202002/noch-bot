/**
 * Links shown in the shared footer. Plain data (no content modules) so the client-side footer stays small.
 * USE_CASES must match SEO_PAGES; src/lib/seo/seo.test.ts checks it.
 */

export type FooterLink = { href: string; label: string };

export const PRODUCT_LINKS: FooterLink[] = [
  { href: '/#features', label: 'Features' },
  { href: '/#process', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/docs', label: 'Documentation' },
  { href: '/register', label: 'Get started' },
];

export const RESOURCE_LINKS: FooterLink[] = [
  { href: '/blog', label: 'Blog' },
  { href: '/compare', label: 'Compare' },
  { href: '/alternatives', label: 'Alternatives' },
  { href: '/tools', label: 'Free tools' },
  { href: '/industries', label: 'Industries' },
];

export const LEGAL_LINKS: FooterLink[] = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

export const USE_CASE_LINKS: FooterLink[] = [
  { href: '/free-ai-chatbot-for-website', label: 'Free AI chatbot for your website' },
  { href: '/chatbot-for-small-business', label: 'AI chatbot for small business' },
  { href: '/how-to-add-chatbot-to-website', label: 'How to add a chatbot to your website' },
  { href: '/event-booking-chatbot', label: 'Event registration chatbot' },
  { href: '/event-ticket-scanner', label: 'QR ticket scanner for events' },
  { href: '/chat-with-excel-csv', label: 'CSV and Excel chatbot' },
  { href: '/catalog-chatbot', label: 'Catalog chatbot' },
  { href: '/private-knowledge-chatbot', label: 'Private knowledge base chatbot' },
  { href: '/pdf-chatbot', label: 'PDF chatbot with share link' },
  { href: '/best-free-ai-chatbot-for-websites', label: 'Best free AI chatbot for websites' },
];
