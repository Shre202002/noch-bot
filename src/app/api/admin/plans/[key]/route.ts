import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { FREE_PLAN_KEY, invalidatePlans, PLANS_COLLECTION, validatePlanInput } from '@/lib/plans';
import { logAdminAction } from '@/lib/adminAudit';

type Ctx = { params: Promise<{ key: string }> };

/** Replaces a plan's editable fields. The key never changes. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { key } = await params;
    const body = await req.json();
    // The free plan is the fallback for expired and unknown plans, so it must stay available.
    if (key === FREE_PLAN_KEY && body?.active === false) {
      return NextResponse.json({ error: 'The free plan cannot be deactivated' }, { status: 400 });
    }

    const result = validatePlanInput(body, key);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const db = await getDb();
    const { key: _key, ...fields } = result.plan;
    const update = await db.collection(PLANS_COLLECTION).updateOne({ key }, { $set: fields });
    if (!update.matchedCount) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    invalidatePlans();
    await logAdminAction(auth.admin, 'plan.update', key, { limits: fields.limits, active: fields.active });
    return NextResponse.json({ success: true, plan: result.plan });
  } catch (error) {
    console.error('[admin_plans_update]', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

/** Removes a plan nobody is on. Plans in use can only be deactivated. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { key } = await params;
    if (key === FREE_PLAN_KEY) {
      return NextResponse.json({ error: 'The free plan cannot be deleted' }, { status: 400 });
    }
    const db = await getDb();
    const inUse = await db.collection('accounts').countDocuments({ plan: key });
    if (inUse > 0) {
      return NextResponse.json(
        { error: `${inUse} user${inUse === 1 ? ' is' : 's are'} on this plan. Move them first, or deactivate the plan instead.` },
        { status: 409 },
      );
    }
    const res = await db.collection(PLANS_COLLECTION).deleteOne({ key });
    if (!res.deletedCount) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    invalidatePlans();
    await logAdminAction(auth.admin, 'plan.delete', key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin_plans_delete]', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
