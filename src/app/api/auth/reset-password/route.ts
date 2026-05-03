
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAccountByResetToken, updatePassword, updateAccount } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { resetToken, newPassword } = await req.json();

    if (!resetToken || !newPassword) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const account = await findAccountByResetToken(resetToken);

    if (!account) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Check expiry
    if (new Date() > new Date(account.resetTokenExpiry!)) {
      await updateAccount(account.id, { resetToken: undefined, resetTokenExpiry: undefined });
      return NextResponse.json({ error: 'Reset token expired, please start over' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await updatePassword(account.email, newHash);
    
    // Clear token fields
    await updateAccount(account.id, {
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
