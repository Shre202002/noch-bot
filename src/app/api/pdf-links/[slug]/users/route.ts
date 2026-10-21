import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listLinkUsers } from '@/lib/linkUserAuth';
import { NOT_DELETED } from '@/lib/pdfRetention';

// GET /api/pdf-links/[slug]/users — the link owner's view of who signed up for a sign-in protected link.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const ownerId = await getUserIdFromCookie();
    if (!ownerId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { slug } = await params;
    const db = await getDb();
    const link = await db.collection('pdf_links').findOne({ slug, userId: ownerId, ...NOT_DELETED });
    if (!link) return NextResponse.json({ error: 'Link not found.' }, { status: 404 });

    const users = await listLinkUsers(db, ownerId, slug);
    return NextResponse.json({
      users,
      pendingCount: users.filter((u) => u.status === 'pending').length,
    });
  } catch (err) {
    console.error('[pdf_link_users_get]', err);
    return NextResponse.json({ error: 'Could not load link users.' }, { status: 500 });
  }
}
