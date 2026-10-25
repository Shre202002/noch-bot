import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/seo/PageShell';
import { FaqList, H1, H2, HubLink } from '@/components/seo/blocks';
import { InlineCta } from '@/components/seo/InlineCta';
import { buildMetadata, breadcrumbLd, faqLd } from '@/lib/seo/meta';
import {
  COMPARE_ROWS,
  COMPETITORS,
  compareDescription,
  compareFaqs,
  compareTitle,
  getCompetitor,
} from '@/lib/seo/compare';

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = COMPETITORS.find((x) => x.slug === slug);
  if (!c) return {};
  return buildMetadata({
    title: compareTitle(c),
    description: compareDescription(c),
    path: `/compare/${c.slug}`,
    keywords: [`nochbot vs ${c.name.toLowerCase()}`, `${c.name.toLowerCase()} comparison`],
  });
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!COMPETITORS.some((x) => x.slug === slug)) notFound();
  const c = getCompetitor(slug);
  const faqs = compareFaqs(c);
  const others = c.related.map(getCompetitor);

  return (
    <PageShell
      crumbs={[{ name: 'Compare', path: '/compare' }, { name: compareTitle(c) }]}
      schema={[breadcrumbLd([{ name: 'Compare', path: '/compare' }, { name: compareTitle(c), path: `/compare/${c.slug}` }]), faqLd(faqs)]}
    >
      <h1 className={H1}>
        {compareTitle(c)}: which AI chatbot fits?
      </h1>
      <p className="mt-6 text-base leading-relaxed text-white/65 sm:text-lg">
        {c.name} is {c.category}. NochBot is an AI chatbot you add to your website with one script tag. It answers from your pages and
        documents, and it also takes event bookings with payments and QR tickets. This page lists what NochBot does and what to confirm
        on {c.name}&apos;s own site, so you can decide with facts.
      </p>

      <h2 className={H2}>The checklist</h2>
      <div className="mt-6 space-y-4 md:hidden">
        {COMPARE_ROWS.map((r) => (
          <div key={r.criterion} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold">{r.criterion}</h3>
            <p className="mt-2 text-sm text-white/65">
              <span className="text-[#36f4a4]">NochBot:</span> {r.nochbot}
            </p>
            <p className="mt-2 text-sm text-white/45">
              <span className="text-white/60">Check at {c.name}:</span> {r.check}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-white/8 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-white/50">
            <tr>
              <th scope="col" className="px-4 py-3">What to compare</th>
              <th scope="col" className="px-4 py-3">NochBot</th>
              <th scope="col" className="px-4 py-3">Check at {c.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {COMPARE_ROWS.map((r) => (
              <tr key={r.criterion} className="align-top">
                <th scope="row" className="px-4 py-3 font-medium">{r.criterion}</th>
                <td className="px-4 py-3 text-white/65">{r.nochbot}</td>
                <td className="px-4 py-3 text-white/45">{r.check}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-white/35">
        Confirm every point about {c.name} on{' '}
        <a href={c.site} rel="noopener noreferrer nofollow" target="_blank" className="underline underline-offset-2 hover:text-white">
          their website
        </a>
        . Features and prices change.
      </p>

      <h2 className={H2}>Choose NochBot if</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white/60">
        <li>You take event registrations or sell tickets and want booking, payment, QR tickets and scanning in one place.</li>
        <li>You want answers from your website and documents, including PDF, CSV and Excel files.</li>
        <li>You want to start on a free plan and pay in rupees.</li>
      </ul>

      <h2 className={H2}>Choose {c.name} if</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white/60">
        {c.suits.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <InlineCta title="See how NochBot answers on your own content" />
      <FaqList faqs={faqs} />

      <section className="mt-12 border-t border-white/5 pt-8">
        <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">More comparisons</h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/compare/${o.slug}`} className="text-white/60 underline-offset-4 hover:text-white hover:underline">
                {compareTitle(o)}
              </Link>
            </li>
          ))}
          <li>
            <Link href={`/alternatives/${c.slug}`} className="text-white/60 underline-offset-4 hover:text-white hover:underline">
              {c.name} alternatives
            </Link>
          </li>
        </ul>
      </section>
      <HubLink hub="website-chatbot" />
    </PageShell>
  );
}
