import Link from 'next/link';
import { SEO_PAGES } from '@/lib/seoPages';
import { SECTIONS } from '@/lib/seo/siteMap';

/** Crawlable links from the homepage to every landing page. */
export function UseCaseLinks() {
  return (
    <section aria-labelledby="use-cases-heading" className="border-t border-white/5 px-6 py-16">
      <div className="mx-auto max-w-[1100px]">
        <h2 id="use-cases-heading" className="text-2xl font-semibold tracking-tight text-white">
          What you can build with NochBot
        </h2>
        <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEO_PAGES.map((p) => (
            <li key={p.slug}>
              <Link href={`/${p.slug}`} className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline">
                {p.linkLabel}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/45">
          {SECTIONS.map((s) => (
            <Link key={s.path} href={s.path} className="hover:text-white">
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
