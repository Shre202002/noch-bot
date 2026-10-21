import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  attemptLinkLogin,
  findProtectedLink,
  LINK_AUTH_MESSAGES,
  linkCookieName,
  linkCookieOptions,
  signLinkToken,
} from '@/lib/linkUserAuth';

const STATUS_FOR = { invalid: 401, pending: 403, rejected: 403, blocked: 403 } as const;

// POST /api/pdf-links/[slug]/auth/login  Body: { loginId, password }
// Signing in replaces any session on another device (single-device accounts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDb();
    const link = await findProtectedLink(db, slug);
    if (!link) return NextResponse.json({ error: "This chat link isn't available." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const result = await attemptLinkLogin(db, slug, body.loginId, body.password);
    if ('error' in result) {
      return NextResponse.json(
        { code: result.error, error: LINK_AUTH_MESSAGES[result.error] },
        { status: STATUS_FOR[result.error] }
      );
    }

    const res = NextResponse.json({ success: true, loginId: result.user.loginId });
    res.cookies.set(linkCookieName(slug), signLinkToken(result.user, result.sessionId), linkCookieOptions);
    return res;
  } catch (err) {
    console.error('[pdf_link_login]', err);
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 500 });
  }
}
