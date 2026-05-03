import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { writeKnowledge } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { botName, systemPrompt, botIcon, botColor } = body;

    const updates: any = {};
    if (botName !== undefined) updates.botName = botName;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (botIcon !== undefined) updates.botIcon = botIcon;
    if (botColor !== undefined) updates.botColor = botColor;

    await writeKnowledge(userId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[knowledge-config] error:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
