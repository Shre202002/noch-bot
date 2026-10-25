import Link from 'next/link';
import type { Metadata } from 'next';
import SigninModal from '@/components/ui/signin-modal';
import SignupModal from '@/components/ui/signup-modal';
import { SEO_PAGES, SITE_URL, getSeoPage, type SeoPage } from '@/lib/seoPages';
import { HUBS, SECTIONS } from '@/lib/seo/siteMap';
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
    <div className="min-h-screen bg-[#080b10] text-white">
      {structuredData(page).map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      ))}

      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5 sm:px-6">
          <Link href="/" className="text-[17px] font-bold uppercase tracking-[-0.03em]">
            NochBot
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-3 text-[13px] text-white/50 sm:gap-5">
            <Link href="/#pricing" className="hover:text-white">
              Pricing
            </Link>
            <Link href="/docs" className="hover:text-white">
              Docs
            </Link>
            <SigninModal trigger={<button className="hover:text-white">Sign in</button>} />
            <SignupModal
              trigger={
                <button className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 font-medium text-[#080b10] sm:px-4">Get started</button>
              }
            />
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[900px] px-5 pb-14 pt-14 sm:px-6 sm:pt-20">
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
            <Link href="/#pricing" className={CTA_SECONDARY}>
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

      <footer className="border-t border-white/5 px-5 py-10 sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/45">
            {SECTIONS.map((s) => (
              <Link key={s.path} href={s.path} className="hover:text-white">
                {s.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] uppercase tracking-widest text-white/25">Use cases</p>
          <ul className="mt-3 grid gap-x-8 gap-y-2 text-[13px] text-white/45 sm:grid-cols-2 lg:grid-cols-3">
            {SEO_PAGES.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="hover:text-white">
                  {p.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/5 pt-6 text-[12px] text-white/30">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/docs" className="hover:text-white">
              Docs
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
