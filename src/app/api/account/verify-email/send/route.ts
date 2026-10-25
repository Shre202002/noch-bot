import { NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { findAccountById } from '@/lib/storage';
import { issueEmailOtp } from '@/lib/emailVerification';
import { sendVerificationEmail } from '@/lib/mailer';

export async function POST() {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const account = await findAccountById(userId);
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const issued = await issueEmailOtp(account);
    if (!issued.ok) {
      return NextResponse.json(
        { error: issued.error, retryAfterSec: issued.retryAfterSec },
        { status: issued.status },
      );
    }

    await sendVerificationEmail(account.email, issued.otp);
    return NextResponse.json({ success: true, resendAfterSec: 60 });
  } catch (error) {
    console.error('[verify_email_send]', error);
    return NextResponse.json({ error: 'Could not send the code. Please try again.' }, { status: 500 });
  }
}
