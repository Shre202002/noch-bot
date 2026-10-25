import { PageShell } from '@/components/seo/PageShell';
import { H1, IndexCard } from '@/components/seo/blocks';
import { LeadForm } from '@/components/seo/LeadForm';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { POSTS } from '@/lib/seo/posts';

export const metadata = buildMetadata({
  title: 'NochBot blog: chatbots, events and tickets',
  description:
    'Practical guides on adding an AI chatbot to your website, keeping answers accurate, selling event tickets with QR codes and turning spreadsheets into chatbots.',
  path: '/blog',
});

export default function BlogIndex() {
  return (
    <PageShell crumbs={[{ name: 'Blog' }]} schema={[breadcrumbLd([{ name: 'Blog', path: '/blog' }])]}>
      <h1 className={H1}>Guides for chatbots, events and tickets</h1>
      <p className="mt-5 max-w-[640px] text-white/60">
        Short, practical write-ups on getting more from an AI chatbot on your own website.
      </p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {POSTS.map((p) => (
          <IndexCard key={p.slug} href={`/blog/${p.slug}`} title={p.h1} body={p.description} />
        ))}
      </ul>
      <div className="mt-12">
        <LeadForm source="/blog" blurb="New guides, no spam. One email when we publish something worth reading." />
      </div>
    </PageShell>
  );
}
