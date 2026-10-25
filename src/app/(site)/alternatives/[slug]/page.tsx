import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pricing } from '@/components/Pricing';
import { ContactSection } from '@/components/ContactSection';
import { PageShell } from '@/components/seo/PageShell';
import { FaqList, H1, H2, HubLink } from '@/components/seo/blocks';
import { InlineCta } from '@/components/seo/InlineCta';
import { buildMetadata, breadcrumbLd, faqLd } from '@/lib/seo/meta';
import {
  COMPARE_ROWS,
  COMPETITORS,
  alternativesDescription,
  alternativesFaqs,
  alternativesTitle,
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
    title: alternativesTitle(c),
    description: alternativesDescription(c),
    path: `/alternatives/${c.slug}`,
    keywords: [`${c.name.toLowerCase()} alternative`, `${c.name.toLowerCase()} alternatives`],
  });
}

export default async function AlternativesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!COMPETITORS.some((x) => x.slug === slug)) notFound();
  const c = getCompetitor(slug);
  const faqs = alternativesFaqs(c);
  const others = c.related.map(getCompetitor);

  return (
    <PageShell
      after={<>
        <Pricing />
        <ContactSection />
      </>}
      crumbs={[{ name: 'Alternatives', path: '/alternatives' }, { name: alternativesTitle(c) }]}
      schema={[
        breadcrumbLd([{ name: 'Alternatives', path: '/alternatives' }, { name: alternativesTitle(c), path: `/alternatives/${c.slug}` }]),
        faqLd(faqs),
      ]}
    >
      <h1 className={H1}>A {c.name} alternative worth comparing</h1>
      <p className="mt-6 text-base leading-relaxed text-white/65 sm:text-lg">
        {c.name} is {c.category}. If you are weighing other options, decide what you actually need first, then check each tool against the
        same questions. NochBot is one option: an AI chatbot for your website that also runs event booking with QR tickets.
      </p>

      <h2 className={H2}>What to compare before you switch</h2>
      <ol className="mt-5 space-y-4">
        {COMPARE_ROWS.map((r, i) => (
          <li key={r.criterion} className="flex gap-4">
            <span className="grid size-7 shrink-0 place-content-center rounded-full border border-[#36f4a4]/30 text-xs font-semibold text-[#36f4a4]">
              {i + 1}
            </span>
            <div>
              <h3 className="text-[15px] font-semibold">{r.criterion}</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/55">Ask: {r.check}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className={H2}>Where NochBot fits</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white/60">
        <li>Events: registration, payment through your own gateway account, a QR ticket for every attendee and scanning from a browser.</li>
        <li>Content: your crawled website plus PDF, CSV and Excel files, with answers limited to those sources.</li>
        <li>Getting started: a free plan and one script tag.</li>
        <li>Not included: WhatsApp delivery and live syncing of a Google Sheet.</li>
      </ul>

      <InlineCta title="Test NochBot on your own site" />
      <FaqList faqs={faqs} />

      <section className="mt-12 border-t border-white/5 pt-8">
        <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">Keep comparing</h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link href={`/compare/${c.slug}`} className="text-white/60 underline-offset-4 hover:text-white hover:underline">
              {compareTitle(c)}
            </Link>
          </li>
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/alternatives/${o.slug}`} className="text-white/60 underline-offset-4 hover:text-white hover:underline">
                {alternativesTitle(o)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <HubLink hub="website-chatbot" />
    </PageShell>
  );
}
