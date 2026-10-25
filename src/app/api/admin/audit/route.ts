import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 25));
    const action = (params.get('action') || '').trim().slice(0, 60);
    const target = (params.get('target') || '').trim().slice(0, 100);

    const filter: Record<string, unknown> = {};
    // Exact match only: user input never reaches a regex or operator.
    if (action) filter.action = action;
    if (target) filter.target = target;

    const db = await getDb();
    const coll = db.collection('admin_audit_log');
    const [entries, total, actions] = await Promise.all([
      coll
        .find(filter, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      coll.countDocuments(filter),
      coll.distinct('action'),
    ]);

    return NextResponse.json({ entries, total, page, pageSize, actions: actions.sort() });
  } catch (error) {
    console.error('[admin_audit_list]', error);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
