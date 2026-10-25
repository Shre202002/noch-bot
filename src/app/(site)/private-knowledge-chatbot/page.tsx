import { SeoLandingPage, seoMetadata } from '@/components/seo/SeoLandingPage';

const SLUG = 'private-knowledge-chatbot';

export const metadata = seoMetadata(SLUG);

export default function Page() {
  return <SeoLandingPage slug={SLUG} />;
}
