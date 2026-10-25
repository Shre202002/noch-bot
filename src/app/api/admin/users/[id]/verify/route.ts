import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { findAccountById } from '@/lib/storage';
import { logAdminAction } from '@/lib/adminAudit';

/** Marks an email/password account as verified without a code (for example after checking the person by other means). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const target = await findAccountById(id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const db = await getDb();
    await db.collection('accounts').updateOne(
      { id },
      {
        $set: { emailVerified: true, emailVerifiedAt: new Date().toISOString() },
        $unset: { emailOtpHash: '', emailOtpExpiry: '', emailOtpSentAt: '', emailOtpAttempts: '' },
      },
    );
    await logAdminAction(auth.admin, 'user.verify_email', id, { email: target.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin_user_verify]', error);
    return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
  }
}
