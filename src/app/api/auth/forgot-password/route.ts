
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAccount, saveOtp, clearOtp } from '@/lib/storage';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const account = await findAccount(email);
    
    // Always return 200 for security (anti-enumeration)
    if (!account) {
      return NextResponse.json({ success: true, message: 'If an account exists, an OTP has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    await saveOtp(email, otpHash, expiry);

    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      await clearOtp(email);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
