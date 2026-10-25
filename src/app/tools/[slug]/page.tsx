import { notFound } from 'next/navigation';
import { PageShell } from '@/components/seo/PageShell';
import { H1, HubLink, RelatedLandings } from '@/components/seo/blocks';
import { InlineCta } from '@/components/seo/InlineCta';
import { LeadForm } from '@/components/seo/LeadForm';
import { PlanEstimator, RoiCalculator, TicketRevenueCalculator } from '@/components/seo/tools/Calculators';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { TOOLS, getTool } from '@/lib/seo/siteMap';
import { SITE_URL } from '@/lib/seoPages';

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) return {};
  return buildMetadata({ title: t.title, description: t.description, path: `/tools/${t.slug}` });
}

const WIDGETS: Record<string, () => React.ReactElement> = {
  'chatbot-roi-calculator': () => <RoiCalculator />,
  'event-ticket-revenue-calculator': () => <TicketRevenueCalculator />,
  'chatbot-plan-estimator': () => <PlanEstimator />,
};

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!TOOLS.some((x) => x.slug === slug)) notFound();
  const t = getTool(slug);
  const path = `/tools/${t.slug}`;
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t.h1,
    url: `${SITE_URL}${path}`,
    description: t.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  };

  return (
    <PageShell
      crumbs={[{ name: 'Free tools', path: '/tools' }, { name: t.h1 }]}
      schema={[app, breadcrumbLd([{ name: 'Free tools', path: '/tools' }, { name: t.h1, path }])]}
    >
      <h1 className={H1}>{t.h1}</h1>
      <p className="mt-5 max-w-[680px] text-base leading-relaxed text-white/65">{t.intro}</p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">{WIDGETS[t.slug]()}</div>
      <p className="mt-3 text-xs text-white/35">Estimates only, based on the numbers you enter. Nothing is stored or sent.</p>

      <InlineCta />
      <LeadForm source={path} heading="Want the next tool and guide by email?" />
      <HubLink hub={t.hub} />
      <RelatedLandings slugs={t.related} />
    </PageShell>
  );
}
