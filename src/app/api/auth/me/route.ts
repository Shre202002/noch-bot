
import { NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { findAccountById } from '@/lib/storage';

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const account = await findAccountById(userId);
    if (!account) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { id, email, plan, name, avatar } = account;
    return NextResponse.json({ id, email, plan, name, avatar });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}
