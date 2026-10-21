import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ownerLinkUserAction, type OwnerAction } from '@/lib/linkUserAuth';

const ACTIONS: OwnerAction[] = ['approve', 'reject', 'block', 'unblock', 'signout', 'remove'];

// PATCH /api/pdf-links/[slug]/users/[linkUserId]  Body: { action }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; linkUserId: string }> }
) {
  try {
    const ownerId = await getUserIdFromCookie();
    if (!ownerId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { slug, linkUserId } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as OwnerAction;
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

    const db = await getDb();
    // Scoped to the owner's own link inside ownerLinkUserAction (userId + slug).
    const done = await ownerLinkUserAction(db, ownerId, slug, linkUserId, action);
    if (!done) {
      return NextResponse.json({ error: 'That change is not possible for this user anymore. Refresh and try again.' }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[pdf_link_users_patch]', err);
    return NextResponse.json({ error: 'Could not update this user.' }, { status: 500 });
  }
}
