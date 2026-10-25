import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { findAccountById } from '@/lib/storage';
import { listChats, parseSource } from '@/lib/adminChats';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const account = await findAccountById(id);
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const query = req.nextUrl.searchParams;
    const page = Math.max(1, Number(query.get('page')) || 1);
    const source = parseSource(query.get('source'));
    const result = await listChats(id, source, page, 20);
    return NextResponse.json({
      user: { id: account.id, email: account.email, name: account.name ?? null },
      source,
      page,
      pageSize: 20,
      ...result,
    });
  } catch (error) {
    console.error('[admin_user_chats]', error);
    return NextResponse.json({ error: 'Failed to load chats' }, { status: 500 });
  }
}
