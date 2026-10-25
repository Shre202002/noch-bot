import { PageShell } from '@/components/seo/PageShell';
import { H1, IndexCard } from '@/components/seo/blocks';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { COMPETITORS, alternativesDescription, alternativesTitle } from '@/lib/seo/compare';

export const metadata = buildMetadata({
  title: 'AI chatbot alternatives',
  description:
    'Thinking of switching AI chatbot tools? What to compare first, and when NochBot, with event booking and QR tickets, is the better fit.',
  path: '/alternatives',
});

export default function AlternativesIndex() {
  return (
    <PageShell crumbs={[{ name: 'Alternatives' }]} schema={[breadcrumbLd([{ name: 'Alternatives', path: '/alternatives' }])]}>
      <h1 className={H1}>AI chatbot alternatives</h1>
      <p className="mt-5 max-w-[640px] text-white/60">Pick the tool you are using now to see what to compare before you switch.</p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {COMPETITORS.map((c) => (
          <IndexCard key={c.slug} href={`/alternatives/${c.slug}`} title={alternativesTitle(c)} body={alternativesDescription(c)} />
        ))}
      </ul>
    </PageShell>
  );
}
