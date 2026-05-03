import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAccount, writeAccount } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const account = await findAccount(email);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    await writeAccount({
      ...account,
      passwordHash,
      resetToken: undefined, // Clear the code
      resetTokenExpiry: undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}