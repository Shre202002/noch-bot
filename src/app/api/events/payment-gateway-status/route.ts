
import { NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const config = await db.collection('payment_gateway_configs').findOne({
      org_id: userId,
      is_active: true
    });

    return NextResponse.json({
      is_configured: !!config,
      provider: config?.provider || null
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
