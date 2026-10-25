import { notFound } from 'next/navigation';
import { PageShell } from '@/components/seo/PageShell';
import { FaqList, H1, H2, HubLink, RelatedLandings } from '@/components/seo/blocks';
import { InlineCta } from '@/components/seo/InlineCta';
import { buildMetadata, breadcrumbLd, faqLd } from '@/lib/seo/meta';
import { INDUSTRIES, getIndustry } from '@/lib/seo/industries';

export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = INDUSTRIES.find((x) => x.slug === slug);
  if (!p) return {};
  return buildMetadata({ title: p.title, description: p.description, path: `/industries/${p.slug}` });
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!INDUSTRIES.some((x) => x.slug === slug)) notFound();
  const p = getIndustry(slug);
  const path = `/industries/${p.slug}`;

  return (
    <PageShell
      crumbs={[{ name: 'Industries', path: '/industries' }, { name: p.linkLabel }]}
      schema={[breadcrumbLd([{ name: 'Industries', path: '/industries' }, { name: p.linkLabel, path }]), faqLd(p.faqs)]}
    >
      <h1 className={H1}>{p.h1}</h1>
      <p className="mt-6 text-base leading-relaxed text-white/65 sm:text-lg">{p.intro}</p>

      <h2 className={H2}>The problems</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {p.problems.map((x) => (
          <li key={x.title} className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
            <h3 className="text-[15px] font-semibold">{x.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{x.body}</p>
          </li>
        ))}
      </ul>

      <h2 className={H2}>How NochBot helps</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {p.solutions.map((x) => (
          <li key={x.title} className="rounded-xl border border-[#36f4a4]/15 bg-[#36f4a4]/[0.03] p-5">
            <h3 className="text-[15px] font-semibold">{x.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{x.body}</p>
          </li>
        ))}
      </ul>

      <h2 className={H2}>How to set it up</h2>
      <ol className="mt-5 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-white/60">
        {p.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <InlineCta />
      <FaqList faqs={p.faqs} />
      <HubLink hub={p.hub} />
      <RelatedLandings slugs={p.related} />
    </PageShell>
  );
}
