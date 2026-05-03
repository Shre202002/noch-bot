import { NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { readKnowledge } from '@/lib/storage';

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const knowledge = await readKnowledge(userId);
    
    if (!knowledge) {
      return NextResponse.json(null);
    }

    // Omit sensitive or large content fields
    const { content, ...safeKnowledge } = knowledge;
    return NextResponse.json(safeKnowledge);
  } catch (error) {
    console.error('[knowledge] error:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
  }
}
