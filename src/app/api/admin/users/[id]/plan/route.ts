import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { findAccountById } from '@/lib/storage';
import { loadPlans, planExists } from '@/lib/plans';
import { logAdminAction } from '@/lib/adminAudit';

/** Activates a plan for a user, optionally until an expiry date. Omit `expiresAt` for no expiry. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { plan, expiresAt } = await req.json();
    await loadPlans();
    if (typeof plan !== 'string' || !planExists(plan)) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
    }

    let expiry: string | undefined;
    if (expiresAt) {
      const date = new Date(expiresAt);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
      }
      if (date.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Expiry must be in the future' }, { status: 400 });
      }
      expiry = date.toISOString();
    }

    const target = await findAccountById(id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const db = await getDb();
    await db.collection('accounts').updateOne(
      { id },
      {
        $set: { plan, planSource: 'admin', ...(expiry ? { planExpiresAt: expiry } : {}) },
        ...(expiry ? {} : { $unset: { planExpiresAt: '' } }),
      },
    );

    await logAdminAction(auth.admin, 'user.plan', id, {
      from: target.plan,
      to: plan,
      expiresAt: expiry ?? null,
    });
    return NextResponse.json({ success: true, plan, planExpiresAt: expiry ?? null });
  } catch (error) {
    console.error('[admin_user_plan]', error);
    return NextResponse.json({ error: 'Failed to change plan' }, { status: 500 });
  }
}
