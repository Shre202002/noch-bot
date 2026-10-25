import Link from 'next/link';
import { jsonLd } from '@/lib/seo/meta';

type Crumb = { name: string; path?: string };

/**
 * Content column for blog, compare, tools, industry and customer pages. The header and footer come from the
 * (site) layout, so this only adds breadcrumbs and JSON-LD. `after` renders full-width below the column, for
 * homepage sections such as pricing and contact.
 */
export function PageShell({
  crumbs,
  schema,
  children,
  after,
}: {
  crumbs: Crumb[];
  schema: unknown[];
  children: React.ReactNode;
  after?: React.ReactNode;
}) {
  return (
    <>
      {schema.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      ))}

      <main className="mx-auto max-w-[900px] px-5 pb-16 pt-6 text-white sm:px-6 sm:pt-8">
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
      {after}
    </>
  );
}
