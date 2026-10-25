import Link from 'next/link';
import SigninModal from '@/components/ui/signin-modal';
import SignupModal from '@/components/ui/signup-modal';
import { SEO_PAGES } from '@/lib/seoPages';
import { SECTIONS } from '@/lib/seo/siteMap';
import { jsonLd } from '@/lib/seo/meta';

type Crumb = { name: string; path?: string };

/** Header, breadcrumbs, JSON-LD and footer shared by blog, compare, tools, industry and customer pages. */
export function PageShell({
  crumbs,
  schema,
  children,
}: {
  crumbs: Crumb[];
  schema: unknown[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#080b10] text-white">
      {schema.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      ))}

      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5 sm:px-6">
          <Link href="/" className="text-[17px] font-bold uppercase tracking-[-0.03em]">
            NochBot
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-3 text-[13px] text-white/50 sm:gap-5">
            <Link href="/blog" className="hover:text-white">
              Blog
            </Link>
            <Link href="/tools" className="hover:text-white">
              Tools
            </Link>
            <SigninModal trigger={<button className="hover:text-white">Sign in</button>} />
            <SignupModal
              trigger={
                <button className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 font-medium text-[#080b10] sm:px-4">
                  Get started
                </button>
              }
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-5 pb-16 pt-10 sm:px-6 sm:pt-14">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-white/40">
          <Link href="/" className="hover:text-white">
            NochBot
          </Link>
          {crumbs.map((c) => (
            <span key={c.name}>
              <span className="mx-2">/</span>
              {c.path ? (
                <Link href={c.path} className="hover:text-white">
                  {c.name}
                </Link>
              ) : (
                <span>{c.name}</span>
              )}
            </span>
          ))}
        </nav>
        {children}
      </main>

      <footer className="border-t border-white/5 px-5 py-10 sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/45">
            {SECTIONS.map((s) => (
              <Link key={s.path} href={s.path} className="hover:text-white">
                {s.label}
              </Link>
            ))}
          </div>
          <p className="mt-8 text-[11px] uppercase tracking-widest text-white/25">Use cases</p>
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
