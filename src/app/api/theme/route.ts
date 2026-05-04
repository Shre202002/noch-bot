import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { writeKnowledge } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { theme } = await req.json();

    if (!theme || typeof theme !== 'object') {
      return NextResponse.json({ error: 'Invalid theme data' }, { status: 400 });
    }

    await writeKnowledge(userId, { theme });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[theme] error:', err);
    return NextResponse.json({ error: 'Failed to save theme' }, { status: 500 });
  }
}