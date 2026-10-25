import Link from 'next/link';
import { SEO_PAGES } from '@/lib/seoPages';
import { HUBS, spokesOf } from '@/lib/seo/siteMap';
import type { HubKey } from '@/lib/seo/industries';

export const H1 = 'text-balance text-[clamp(1.8rem,5vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]';
export const H2 = 'mt-12 text-2xl font-semibold tracking-tight';

export function FaqList({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  return (
    <section>
      <h2 className={H2}>Frequently asked questions</h2>
      <dl className="mt-6 divide-y divide-white/8">
        {faqs.map((f) => (
          <div key={f.q} className="py-5">
            <dt className="text-[15px] font-semibold">{f.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-white/55">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Links to landing pages by slug. */
export function RelatedLandings({ slugs, heading = 'Related' }: { slugs: string[]; heading?: string }) {
  const pages = slugs.map((s) => SEO_PAGES.find((p) => p.slug === s)).filter((p) => !!p);
  if (!pages.length) return null;
  return (
    <section className="mt-12 border-t border-white/5 pt-8">
      <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">{heading}</h2>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {pages.map((p) => (
          <li key={p!.slug}>
            <Link href={`/${p!.slug}`} className="text-white/60 underline-offset-4 hover:text-white hover:underline">
              {p!.linkLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Spoke pages link up to their pillar so each topic cluster reinforces itself. */
export function HubLink({ hub }: { hub: HubKey | null }) {
  if (!hub) return null;
  const h = HUBS[hub];
  return (
    <p className="mt-10 text-sm text-white/50">
      Part of our guide to{' '}
      <Link href={`/${h.landing}`} className="text-white/80 underline underline-offset-4 hover:text-white">
        {h.label}
      </Link>
      .
    </p>
  );
}

/** The pillar page lists every spoke in its cluster. */
export function MoreOnTopic({ hub }: { hub: HubKey }) {
  const spokes = spokesOf(hub);
  if (!spokes.length) return null;
  return (
    <section className="border-t border-white/5">
      <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">More on this topic</h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {spokes.map((s) => (
            <li key={s.path}>
              <Link href={s.path} className="text-white/60 underline-offset-4 hover:text-white hover:underline">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function IndexCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <li>
      <Link href={href} className="block h-full rounded-xl border border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-white/20">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
      </Link>
    </li>
  );
}
