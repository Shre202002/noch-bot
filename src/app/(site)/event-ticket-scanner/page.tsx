import { SeoLandingPage, seoMetadata } from '@/components/seo/SeoLandingPage';

const SLUG = 'event-ticket-scanner';

export const metadata = seoMetadata(SLUG);

export default function Page() {
  return <SeoLandingPage slug={SLUG} />;
}
