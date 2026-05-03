import { NextRequest, NextResponse } from 'next/server';
import { findAccount } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const account = await findAccount(email);
    if (!account) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const isValid = account.resetToken === code && account.resetTokenExpiry && account.resetTokenExpiry > now;

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}