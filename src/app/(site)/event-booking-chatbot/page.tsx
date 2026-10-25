import { SeoLandingPage, seoMetadata } from '@/components/seo/SeoLandingPage';

const SLUG = 'event-booking-chatbot';

export const metadata = seoMetadata(SLUG);

export default function Page() {
  return <SeoLandingPage slug={SLUG} />;
}
