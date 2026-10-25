import { PageShell } from '@/components/seo/PageShell';
import { H1, IndexCard } from '@/components/seo/blocks';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { TOOLS } from '@/lib/seo/siteMap';

export const metadata = buildMetadata({
  title: 'Free chatbot and event tools',
  description:
    'Free calculators for chatbot ROI, event ticket revenue and choosing a chatbot plan. They run in your browser, with no sign-up.',
  path: '/tools',
});

export default function ToolsIndex() {
  return (
    <PageShell crumbs={[{ name: 'Free tools' }]} schema={[breadcrumbLd([{ name: 'Free tools', path: '/tools' }])]}>
      <h1 className={H1}>Free tools and calculators</h1>
      <p className="mt-5 max-w-[640px] text-white/60">Small calculators that run in your browser. No sign-up needed.</p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <IndexCard key={t.slug} href={`/tools/${t.slug}`} title={t.h1} body={t.description} />
        ))}
      </ul>
    </PageShell>
  );
}
