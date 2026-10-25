import { notFound } from 'next/navigation';
import { PageShell } from '@/components/seo/PageShell';
import { H1, IndexCard } from '@/components/seo/blocks';
import { buildMetadata, breadcrumbLd } from '@/lib/seo/meta';
import { CASE_STUDIES } from '@/lib/seo/caseStudies';

export const metadata = buildMetadata({
  title: 'NochBot customer stories',
  description: 'How organizations use NochBot for website questions, event registration and tickets, in their own words and numbers.',
  path: '/customers',
});

export default function CustomersIndex() {
  // Stories need a real, permitted customer; until one is published this section does not exist.
  if (!CASE_STUDIES.length) notFound();
  return (
    <PageShell crumbs={[{ name: 'Customers' }]} schema={[breadcrumbLd([{ name: 'Customers', path: '/customers' }])]}>
      <h1 className={H1}>Customer stories</h1>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {CASE_STUDIES.map((c) => (
          <IndexCard key={c.slug} href={`/customers/${c.slug}`} title={`${c.customer}: ${c.industry}`} body={c.description} />
        ))}
      </ul>
    </PageShell>
  );
}
