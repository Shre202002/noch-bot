import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { findAccountById } from '@/lib/storage';
import { requeueRowEmbeddings } from '@/lib/adminOps';
import { logAdminAction } from '@/lib/adminAudit';

/**
 * Queues the user's spreadsheet rows that lack an embedding. The owner's dashboard index loop does the
 * embedding, so nothing runs here and the owner's own quota and rate limits stay in charge.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!(await findAccountById(id))) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const queued = await requeueRowEmbeddings(id);
    await logAdminAction(auth.admin, 'user.reindex', id, queued);
    return NextResponse.json({ success: true, ...queued });
  } catch (error) {
    console.error('[admin_user_reindex]', error);
    return NextResponse.json({ error: 'Failed to queue re-index' }, { status: 500 });
  }
}
