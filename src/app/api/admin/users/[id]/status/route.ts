import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { findAccountById } from '@/lib/storage';
import { guardAdminChange } from '@/lib/superAdmin';
import { logAdminAction } from '@/lib/adminAudit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { disabled, reason } = await req.json();
    if (typeof disabled !== 'boolean') {
      return NextResponse.json({ error: 'disabled must be true or false' }, { status: 400 });
    }

    const target = await findAccountById(id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const db = await getDb();
    if (disabled) {
      const blocked = await guardAdminChange(auth.admin.id, id, 'disable');
      if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
      const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
      await db.collection('accounts').updateOne(
        { id },
        { $set: { disabled: true, disabledReason: cleanReason, disabledAt: new Date().toISOString() } },
      );
    } else {
      await db.collection('accounts').updateOne(
        { id },
        { $unset: { disabled: '', disabledReason: '', disabledAt: '' } },
      );
    }

    await logAdminAction(auth.admin, disabled ? 'user.deactivate' : 'user.reactivate', id, {
      email: target.email,
      reason: disabled ? reason : undefined,
    });
    return NextResponse.json({ success: true, disabled });
  } catch (error) {
    console.error('[admin_user_status]', error);
    return NextResponse.json({ error: 'Failed to change status' }, { status: 500 });
  }
}
