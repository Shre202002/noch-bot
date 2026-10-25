import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

const PUBLIC_FIELDS = {
  _id: 0,
  id: 1,
  email: 1,
  name: 1,
  avatar: 1,
  plan: 1,
  planExpiresAt: 1,
  role: 1,
  disabled: 1,
  emailVerified: 1,
  createdAt: 1,
} as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 25));
    const q = (params.get('q') || '').trim();
    const plan = params.get('plan');
    const status = params.get('status');
    const role = params.get('role');

    const filter: Record<string, unknown> = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q.slice(0, 100)), 'i');
      filter.$or = [{ email: rx }, { name: rx }, { id: q }];
    }
    if (plan) filter.plan = plan;
    if (status === 'disabled') filter.disabled = true;
    if (status === 'active') filter.disabled = { $ne: true };
    if (status === 'unverified') filter.emailVerified = false;
    if (role === 'superadmin') filter.role = 'superadmin';

    const db = await getDb();
    const coll = db.collection('accounts');
    const [users, total] = await Promise.all([
      coll
        .find(filter, { projection: PUBLIC_FIELDS })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      coll.countDocuments(filter),
    ]);

    return NextResponse.json({ users, total, page, pageSize });
  } catch (error) {
    console.error('[admin_users_list]', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
