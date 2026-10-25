import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { findAccountById } from '@/lib/storage';
import { confirmEmailOtp } from '@/lib/emailVerification';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { code } = await req.json().catch(() => ({}));
    const account = await findAccountById(userId);
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const result = await confirmEmailOtp(account, code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[verify_email_confirm]', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
