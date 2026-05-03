
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { findAccountByEmail, writeAccount } from '@/lib/storage';
import { hashPassword, createTokenCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const existing = await findAccountByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const userId = uuidv4();
    const passwordHash = await hashPassword(password);

    await writeAccount({
      id: userId,
      email,
      passwordHash,
      name,
      createdAt: new Date().toISOString(),
      plan: 'free',
      crawlCount: 0,
    });

    const response = NextResponse.json({ success: true, userId });
    const cookie = createTokenCookie(userId);
    response.cookies.set(cookie.name, cookie.value, cookie);

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
