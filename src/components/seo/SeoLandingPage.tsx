import Link from 'next/link';
import type { Metadata } from 'next';
import SignupModal from '@/components/ui/signup-modal';
import { SEO_PAGES, SITE_URL, getSeoPage, type SeoPage } from '@/lib/seoPages';
import { HUBS } from '@/lib/seo/siteMap';
import { Pricing } from '@/components/Pricing';
import { MoreOnTopic } from '@/components/seo/blocks';

/** Builds the <head> for a landing page from its content entry. */
export function seoMetadata(slug: string): Metadata {
  const page = getSeoPage(slug);
  const url = `${SITE_URL}/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: 'website',
      url,
      siteName: 'NochBot',
      title: `${page.title} | NochBot`,
      description: page.description,
      images: [{ url: '/brand/og-image.jpg', width: 1200, height: 630, alt: 'NochBot AI chatbot platform' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${page.title} | NochBot`,
      description: page.description,
      images: ['/brand/og-image.jpg'],
    },
  };
}

/** JSON-LD is embedded as text, so "<" is escaped to keep it from closing the script element. */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function structuredData(page: SeoPage) {
  const url = `${SITE_URL}/${page.slug}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'NochBot', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: page.linkLabel, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'NochBot',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url,
      description: page.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', description: 'Free plan available' },
    },
  ];
}

const CTA_PRIMARY =
  'inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-medium text-[#080b10] transition-opacity hover:opacity-90';
const CTA_SECONDARY =
  'inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white';

export function SeoLandingPage({ slug }: { slug: string }) {
  const page = getSeoPage(slug);
  const hubKey = (Object.keys(HUBS) as Array<keyof typeof HUBS>).find((k) => HUBS[k].landing === slug) ?? null;
  const related = page.related.map((s) => SEO_PAGES.find((p) => p.slug === s)).filter((p): p is SeoPage => !!p);

  return (
    <div className="text-white">
      {structuredData(page).map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      ))}

      <main>
        <section className="mx-auto max-w-[900px] px-5 pb-14 pt-6 sm:px-6 sm:pt-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-white/40">
            <Link href="/" className="hover:text-white">
              NochBot
            </Link>
            <span className="mx-2">/</span>
            <span>{page.linkLabel}</span>
          </nav>
          <h1 className="text-balance text-[clamp(1.9rem,5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em]">
            {page.h1}
          </h1>
          <p className="mt-6 max-w-[680px] text-base leading-relaxed text-white/60 sm:text-lg">{page.intro}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <SignupModal trigger={<button className={CTA_PRIMARY}>Start free</button>} />
            <Link href="#pricing" className={CTA_SECONDARY}>
              See plans
            </Link>
          </div>
        </section>

        <section className="border-t border-white/5 bg-white/[0.015]">
          <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">What you get</h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {page.features.map((f) => (
                <li key={f.title} className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
                  <h3 className="text-[15px] font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {page.guide?.map((g) => (
          <section key={g.title} className="mx-auto max-w-[760px] px-5 pt-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">{g.title}</h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-white/60">
              {g.paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ))}

        <section className="mx-auto max-w-[900px] px-5 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 space-y-5">
            {page.steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-content-center rounded-full border border-[#36f4a4]/30 text-sm font-semibold text-[#36f4a4]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-white/5 bg-white/[0.015]">
          <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Who it is for</h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-3">
              {page.useCases.map((u) => (
                <li key={u.title}>
                  <h3 className="text-[15px] font-semibold">{u.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{u.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[900px] px-5 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Good to know</h2>
          <ul className="mt-6 list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/60">
            {page.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>

        <section className="border-t border-white/5 bg-white/[0.015]">
          <div className="mx-auto max-w-[900px] px-5 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
            <dl className="mt-8 divide-y divide-white/8">
              {page.faqs.map((f) => (
                <div key={f.q} className="py-5">
                  <dt className="text-[15px] font-semibold">{f.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-white/55">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <Pricing />

        <section className="mx-auto max-w-[900px] px-5 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Try NochBot on your own content</h2>
          <p className="mx-auto mt-3 max-w-[520px] text-sm text-white/55">
            Start on the free plan. Upgrade only when you need higher limits.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <SignupModal trigger={<button className={CTA_PRIMARY}>Create a free account</button>} />
            <Link href="/" className={CTA_SECONDARY}>
              Learn more about NochBot
            </Link>
          </div>
        </section>

        {related.length > 0 && (
          <section className="border-t border-white/5">
            <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-6">
              <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">Related</h2>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/${r.slug}`} className="text-white/60 underline-offset-4 hover:text-white hover:underline">
                      {r.linkLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {hubKey && <MoreOnTopic hub={hubKey} />}
      </main>

    </div>
  );
}
