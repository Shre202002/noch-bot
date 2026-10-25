import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getPlans, invalidatePlans, PLANS_COLLECTION, validatePlanInput } from '@/lib/plans';
import { logAdminAction } from '@/lib/adminAudit';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const plans = await getPlans({ includeInactive: true });
    const db = await getDb();
    const counts = await db
      .collection('accounts')
      .aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }])
      .toArray();
    const userCounts = Object.fromEntries(counts.map((c) => [String(c._id), c.count as number]));
    return NextResponse.json({ plans: plans.map((p) => ({ ...p, userCount: userCounts[p.key] ?? 0 })) });
  } catch (error) {
    console.error('[admin_plans_list]', error);
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const result = validatePlanInput(await req.json());
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const db = await getDb();
    const coll = db.collection(PLANS_COLLECTION);
    if (await coll.findOne({ key: result.plan.key }, { projection: { key: 1 } })) {
      return NextResponse.json({ error: 'A plan with this key already exists' }, { status: 409 });
    }
    await coll.insertOne({ ...result.plan });
    invalidatePlans();
    await logAdminAction(auth.admin, 'plan.create', result.plan.key);
    return NextResponse.json({ success: true, plan: result.plan }, { status: 201 });
  } catch (error) {
    console.error('[admin_plans_create]', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
