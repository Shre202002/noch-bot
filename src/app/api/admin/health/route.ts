import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { checkCrawler, checkDatabase, checkVectorIndexes, loadQueues } from '@/lib/adminHealth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const [crawler, database, indexes, queues] = await Promise.all([
      checkCrawler(),
      checkDatabase(),
      checkVectorIndexes().catch(() => []),
      loadQueues(),
    ]);
    return NextResponse.json({ checkedAt: new Date().toISOString(), services: [database, crawler, ...indexes], queues });
  } catch (error) {
    console.error('[admin_health]', error);
    return NextResponse.json({ error: 'Failed to load platform health' }, { status: 500 });
  }
}
