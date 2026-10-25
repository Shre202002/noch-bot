import { notFound } from 'next/navigation';
import { PageShell } from '@/components/seo/PageShell';
import { H1, H2, HubLink, RelatedLandings } from '@/components/seo/blocks';
import { InlineCta } from '@/components/seo/InlineCta';
import { LeadForm } from '@/components/seo/LeadForm';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { POSTS, getPost } from '@/lib/seo/posts';
import { SITE_URL } from '@/lib/seoPages';

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  return buildMetadata({ title: post.title, description: post.description, path: `/blog/${post.slug}`, type: 'article' });
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!POSTS.some((p) => p.slug === slug)) notFound();
  const post = getPost(slug);
  const path = `/blog/${post.slug}`;
  const midpoint = Math.ceil(post.sections.length / 2);

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.h1,
    description: post.description,
    datePublished: post.published,
    dateModified: post.published,
    mainEntityOfPage: `${SITE_URL}${path}`,
    author: { '@type': 'Organization', name: 'NochBot' },
    publisher: { '@type': 'Organization', name: 'NochBot', logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/nochbot-logo.png` } },
  };

  return (
    <PageShell
      crumbs={[{ name: 'Blog', path: '/blog' }, { name: post.h1 }]}
      schema={[article, breadcrumbLd([{ name: 'Blog', path: '/blog' }, { name: post.h1, path }])]}
    >
      <article>
        <h1 className={H1}>{post.h1}</h1>
        <p className="mt-3 text-xs text-white/40">
          <time dateTime={post.published}>{post.published}</time> · {post.readMinutes} min read
        </p>
        <p className="mt-6 text-base leading-relaxed text-white/65 sm:text-lg">{post.intro}</p>

        {post.sections.map((s, i) => (
          <div key={s.heading}>
            {i === midpoint && <InlineCta />}
            <section>
              <h2 className={H2}>{s.heading}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-white/60">
                {s.paragraphs.map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
                {s.bullets && (
                  <ul className="list-disc space-y-2 pl-5">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        ))}
      </article>

      <HubLink hub={post.hub} />
      <div className="mt-10">
        <LeadForm source={path} />
      </div>
      <RelatedLandings slugs={post.related} />
    </PageShell>
  );
}
