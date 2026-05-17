import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAccount, saveOtp } from '@/lib/storage';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const account = await findAccount(email);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await saveOtp(email, otpHash, otpExpiry);
    await sendOtpEmail(email, otp);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json({ error: 'Failed to resend OTP' }, { status: 500 });
  }
}
