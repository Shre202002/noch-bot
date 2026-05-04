import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { readKnowledge, writeKnowledge } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// GET — fetch current bot config for dashboard
export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const knowledge = await readKnowledge(userId);

  if (!knowledge) {
    return NextResponse.json({
      url: null,
      crawledAt: null,
      systemPrompt: null,
      botName: null,
      botIcon: null,
      botColor: null,
      theme: null,
      chunkCount: 0,
      hasCrawled: false,
    });
  }

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

// POST — save bot name, system prompt, icon, color
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { botName, systemPrompt, botIcon, botColor } = body;

    const updates: Record<string, string> = {};
    if (botName !== undefined) updates.botName = botName;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (botIcon !== undefined) updates.botIcon = botIcon;
    if (botColor !== undefined) updates.botColor = botColor;

    await writeKnowledge(userId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[knowledge/config] error:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}