import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const { sessionId } = params;

    // Verify session belongs to this user's PDF
    const session = await db.collection('chat_sessions').findOne({ sessionId, userId });
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const messages = await db.collection('chat_messages')
      .find({ sessionId })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json({
      session: {
        sessionId: session.sessionId,
        label: session.label,
        slug: session.slug,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        messageCount: session.messageCount,
        ip: session.ip,
        userAgent: session.userAgent,
      },
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        tokenEstimate: m.tokenEstimate,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}