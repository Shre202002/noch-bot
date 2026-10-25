import { PageShell } from '@/components/seo/PageShell';
import { H1, IndexCard } from '@/components/seo/blocks';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { INDUSTRIES } from '@/lib/seo/industries';

export const metadata = buildMetadata({
  title: 'AI chatbot for your industry',
  description:
    'How colleges, coaching institutes, small retailers and event organizers can use a NochBot chatbot for questions, registrations and tickets.',
  path: '/industries',
});

export default function IndustriesIndex() {
  return (
    <PageShell crumbs={[{ name: 'Industries' }]} schema={[breadcrumbLd([{ name: 'Industries', path: '/industries' }])]}>
      <h1 className={H1}>NochBot for your industry</h1>
      <p className="mt-5 max-w-[640px] text-white/60">How different kinds of organisations use the chatbot, bookings and tickets.</p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {INDUSTRIES.map((p) => (
          <IndexCard key={p.slug} href={`/industries/${p.slug}`} title={p.linkLabel} body={p.description} />
        ))}
      </ul>
    </PageShell>
  );
}
