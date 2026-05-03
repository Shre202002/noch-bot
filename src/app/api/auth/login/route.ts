
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findAccount } from '@/lib/storage';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const account = await findAccount(email);
    if (!account) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!account.passwordHash) {
      return NextResponse.json({ error: 'Please sign in with Google' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signToken(account.id);
    const response = NextResponse.json({ success: true });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
