import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { findAccountById, updateAccount } from '@/lib/storage';
import { getMonthlyMessageCount, getMonthlyCrawlCount } from '@/lib/ratelimit';
import { guardAdminChange } from '@/lib/superAdmin';
import { logAdminAction } from '@/lib/adminAudit';
import { bookingStatusCounts, monthlyMessageHistory } from '@/lib/adminOps';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const account = await findAccountById(id);
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const db = await getDb();
    const [messages, crawls, events, bookings, pdfs, links, conversations, gateways, knowledge, history, bookingStatuses] =
      await Promise.all([
        getMonthlyMessageCount(id),
        getMonthlyCrawlCount(id),
        db.collection('events').countDocuments({ org_id: id }),
        db.collection('bookings').countDocuments({ org_id: id }),
        db.collection('pdf_files').countDocuments({ userId: id, deletedAt: { $exists: false } }),
        db.collection('pdf_links').countDocuments({ userId: id, deletedAt: { $exists: false } }),
        db.collection('conversations').countDocuments({ userId: id }),
        db.collection('payment_gateway_configs').countDocuments({ org_id: id, is_active: true }),
        db.collection('knowledge').findOne({ userId: id }, { projection: { _id: 0, lastCrawl: 1, chunkCount: 1 } }),
        monthlyMessageHistory(id),
        bookingStatusCounts(id),
      ]);

    return NextResponse.json({
      user: {
        id: account.id,
        email: account.email,
        name: account.name ?? null,
        avatar: account.avatar ?? null,
        plan: account.plan,
        planExpiresAt: account.planExpiresAt ?? null,
        planSource: account.planSource ?? null,
        role: account.role ?? null,
        disabled: !!account.disabled,
        emailVerified: account.emailVerified !== false,
        disabledReason: account.disabledReason ?? null,
        disabledAt: account.disabledAt ?? null,
        createdAt: account.createdAt,
        hasGoogle: !!account.googleId,
        hasPassword: !!account.passwordHash,
        subscription: account.subscription ?? null,
      },
      usage: { messagesThisMonth: messages, crawlsThisMonth: crawls },
      counts: { events, bookings, pdfs, shareLinks: links, conversations, activeGateways: gateways },
      knowledge: knowledge ?? null,
      history,
      bookingStatuses,
    });
  } catch (error) {
    console.error('[admin_user_get]', error);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}

/** Edit profile fields and role. Plan and status have their own routes. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const target = await findAccountById(id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (typeof body.name === 'string') updates.name = body.name.trim().slice(0, 120);
    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
      if (email !== target.email) {
        const db = await getDb();
        if (await db.collection('accounts').findOne({ email, id: { $ne: id } }, { projection: { id: 1 } })) {
          return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }
        updates.email = email;
      }
    }

    const unset: Record<string, ''> = {};
    if (body.role === 'superadmin') updates.role = 'superadmin';
    else if (body.role === null && target.role === 'superadmin') {
      const blocked = await guardAdminChange(auth.admin.id, id, 'demote');
      if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
      unset.role = '';
    }

    if (!Object.keys(updates).length && !Object.keys(unset).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection('accounts').updateOne(
      { id },
      {
        ...(Object.keys(updates).length ? { $set: updates } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
    );
    await logAdminAction(auth.admin, 'user.update', id, { fields: [...Object.keys(updates), ...Object.keys(unset)] });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin_user_patch]', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * Deactivates rather than erasing: the account is locked out immediately and its data stays
 * recoverable. Permanent erasure is intentionally not exposed until a purge policy exists.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const target = await findAccountById(id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const blocked = await guardAdminChange(auth.admin.id, id, 'delete');
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

    await updateAccount(id, {
      disabled: true,
      disabledReason: 'Removed by administrator',
      disabledAt: new Date().toISOString(),
    });
    await logAdminAction(auth.admin, 'user.remove', id, { email: target.email });
    return NextResponse.json({ success: true, deactivated: true });
  } catch (error) {
    console.error('[admin_user_delete]', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
