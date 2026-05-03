
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { findAccount, clearOtp, updateAccount } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const account = await findAccount(email);

    if (!account || !account.otpHash) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
    }

    // Check expiry
    if (new Date() > new Date(account.otpExpiry!)) {
      await clearOtp(email);
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, account.otpHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await updateAccount(account.id, {
      resetToken,
      resetTokenExpiry,
    });

    // Clear OTP as it is single-use
    await clearOtp(email);

    return NextResponse.json({ success: true, resetToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
