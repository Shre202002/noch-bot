
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { readAccounts, writeAccount } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const accounts = await readAccounts();
    const now = new Date().toISOString();
    const account = accounts.find(
      (a) => a.resetToken === token && a.resetTokenExpiry && a.resetTokenExpiry > now
    );

    if (!account) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    await writeAccount({
      ...account,
      passwordHash,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
