import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  ensureLinkUserIndexes,
  findProtectedLink,
  LINK_AUTH_MESSAGES,
  registerLinkUser,
} from '@/lib/linkUserAuth';

// POST /api/pdf-links/[slug]/auth/register  Body: { loginId, password }
// Creates a pending account on a sign-in protected link; the link owner approves it from the dashboard.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDb();
    const link = await findProtectedLink(db, slug);
    if (!link) return NextResponse.json({ error: "This chat link isn't available." }, { status: 404 });

    await ensureLinkUserIndexes(db);
    const body = await req.json().catch(() => ({}));
    const result = await registerLinkUser(db, link, body.loginId, body.password);
    if ('error' in result) {
      return NextResponse.json(
        { code: result.error, error: LINK_AUTH_MESSAGES[result.error] },
        { status: result.error === 'taken' ? 409 : 400 }
      );
    }
    return NextResponse.json({ success: true, code: 'pending', message: LINK_AUTH_MESSAGES.pending });
  } catch (err) {
    console.error('[pdf_link_register]', err);
    return NextResponse.json({ error: 'Could not create the account. Please try again.' }, { status: 500 });
  }
}
