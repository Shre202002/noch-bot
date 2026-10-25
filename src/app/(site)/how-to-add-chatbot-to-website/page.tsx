import { SeoLandingPage, seoMetadata } from '@/components/seo/SeoLandingPage';

const SLUG = 'how-to-add-chatbot-to-website';

export const metadata = seoMetadata(SLUG);

export default function Page() {
  return <SeoLandingPage slug={SLUG} />;
}
