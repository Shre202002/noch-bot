import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { readKnowledge, writeKnowledge } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const knowledge = await readKnowledge(userId);

  return NextResponse.json({
    url: knowledge.url || null,
    crawledAt: knowledge.crawledAt || null,
    systemPrompt: knowledge.systemPrompt || null,
    botName: knowledge.botName || null,
    botIcon: knowledge.botIcon || null,
    botColor: knowledge.botColor || null,
    theme: knowledge.theme || null,
    chunkCount: knowledge.chunkCount || 0,
    hasCrawled: !!knowledge.url,
  });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { botName, systemPrompt, botIcon, botColor, theme } = body;

    // Sirf jo fields aaye hain unhe update karo
    const updates: Record<string, any> = {};
    if (botName !== undefined) updates.botName = botName;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (botIcon !== undefined) updates.botIcon = botIcon;
    if (botColor !== undefined) updates.botColor = botColor;
    if (theme !== undefined) updates.theme = theme; // ← theme bhi save karo

    console.log(`💾 Config saved for ${userId}:`, updates);

    await writeKnowledge(userId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[knowledge/config] error:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}