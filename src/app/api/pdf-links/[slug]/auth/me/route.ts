import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { findProtectedLink, LINK_AUTH_MESSAGES, linkCookieName, verifyLinkSession } from '@/lib/linkUserAuth';

// GET /api/pdf-links/[slug]/auth/me → { signedIn, loginId } or { signedIn: false, code, message }
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDb();
    const link = await findProtectedLink(db, slug);
    if (!link) return NextResponse.json({ error: "This chat link isn't available." }, { status: 404 });

    const session = await verifyLinkSession(db, slug, req.cookies.get(linkCookieName(slug))?.value);
    if ('error' in session) {
      return NextResponse.json({ signedIn: false, code: session.error, message: LINK_AUTH_MESSAGES[session.error] });
    }
    return NextResponse.json({ signedIn: true, loginId: session.user.loginId });
  } catch (err) {
    console.error('[pdf_link_me]', err);
    return NextResponse.json({ error: 'Could not check your sign-in.' }, { status: 500 });
  }
}
