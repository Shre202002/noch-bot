import { SeoLandingPage, seoMetadata } from '@/components/seo/SeoLandingPage';

const SLUG = 'free-ai-chatbot-for-website';

export const metadata = seoMetadata(SLUG);

export default function Page() {
  return <SeoLandingPage slug={SLUG} />;
}
