import { PageShell } from '@/components/seo/PageShell';
import { H1, IndexCard } from '@/components/seo/blocks';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { COMPETITORS, compareDescription, compareTitle } from '@/lib/seo/compare';

export const metadata = buildMetadata({
  title: 'Compare NochBot with other AI chatbots',
  description:
    'Side-by-side checklists comparing NochBot with other AI chatbot tools, so you can see where each fits and what to verify before you choose.',
  path: '/compare',
});

export default function CompareIndex() {
  return (
    <PageShell crumbs={[{ name: 'Compare' }]} schema={[breadcrumbLd([{ name: 'Compare', path: '/compare' }])]}>
      <h1 className={H1}>Compare NochBot with other chatbots</h1>
      <p className="mt-5 max-w-[640px] text-white/60">
        Each page is a checklist, not a sales pitch: what NochBot does, and what to confirm on the other tool&apos;s own site.
      </p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {COMPETITORS.map((c) => (
          <IndexCard key={c.slug} href={`/compare/${c.slug}`} title={compareTitle(c)} body={compareDescription(c)} />
        ))}
      </ul>
    </PageShell>
  );
}
