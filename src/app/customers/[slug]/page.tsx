import { notFound } from 'next/navigation';
import { PageShell } from '@/components/seo/PageShell';
import { H1, H2, HubLink, RelatedLandings } from '@/components/seo/blocks';
import { InlineCta } from '@/components/seo/InlineCta';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { CASE_STUDIES, getCaseStudy } from '@/lib/seo/caseStudies';

export const dynamicParams = false;

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c) return {};
  return buildMetadata({ title: c.title, description: c.description, path: `/customers/${c.slug}`, type: 'article' });
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c) notFound();
  const path = `/customers/${c.slug}`;

  return (
    <PageShell
      crumbs={[{ name: 'Customers', path: '/customers' }, { name: c.customer }]}
      schema={[breadcrumbLd([{ name: 'Customers', path: '/customers' }, { name: c.customer, path }])]}
    >
      <h1 className={H1}>{c.title}</h1>
      <p className="mt-3 text-xs text-white/40">
        {c.customer} · {c.industry}
      </p>

      <h2 className={H2}>The challenge</h2>
      <p className="mt-4 text-[15px] leading-relaxed text-white/60">{c.challenge}</p>
      <h2 className={H2}>What they did</h2>
      <p className="mt-4 text-[15px] leading-relaxed text-white/60">{c.solution}</p>
      <h2 className={H2}>Results</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white/60">
        {c.results.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {c.quote && (
        <blockquote className="mt-8 border-l-2 border-[#36f4a4]/40 pl-5 text-white/70">
          <p>&ldquo;{c.quote.text}&rdquo;</p>
          <footer className="mt-2 text-sm text-white/40">{c.quote.by}</footer>
        </blockquote>
      )}

      <InlineCta />
      <HubLink hub={c.hub} />
      <RelatedLandings slugs={c.related} />
    </PageShell>
  );
}
