import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { applyBulkAction, parseBulkRequest } from '@/lib/adminOps';
import { logAdminAction } from '@/lib/adminAudit';

/** Plan change, deactivate or reactivate for many accounts. Replies with a per-account result. */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await parseBulkRequest(await req.json().catch(() => null));
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const results = await applyBulkAction(auth.admin.id, parsed.request);
    const done = results.filter((r) => r.ok).map((r) => r.id);
    await logAdminAction(auth.admin, `bulk.${parsed.request.action}`, undefined, {
      requested: parsed.request.ids.length,
      succeeded: done.length,
      ids: done,
      plan: parsed.request.plan,
      expiresAt: parsed.request.expiresAt,
      reason: parsed.request.reason,
    });
    return NextResponse.json({ results, succeeded: done.length, failed: results.length - done.length });
  } catch (error) {
    console.error('[admin_users_bulk]', error);
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 });
  }
}
