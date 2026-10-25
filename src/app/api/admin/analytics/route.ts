import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { loadAnalytics } from '@/lib/adminAnalytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 30));
    return NextResponse.json(await loadAnalytics(days));
  } catch (error) {
    console.error('[admin_analytics]', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
