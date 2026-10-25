import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getThread, parseSource } from '@/lib/adminChats';
import { logAdminAction } from '@/lib/adminAudit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chatId: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id, chatId } = await params;
    const source = parseSource(req.nextUrl.searchParams.get('source'));
    const thread = await getThread(id, source, chatId);
    if (!thread) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

    // Visitors' messages are private; record that an admin read this thread (never its text).
    await logAdminAction(auth.admin, 'user.chats.view', id, { source, chatId });
    return NextResponse.json(thread);
  } catch (error) {
    console.error('[admin_user_chat_thread]', error);
    return NextResponse.json({ error: 'Failed to load chat' }, { status: 500 });
  }
}
