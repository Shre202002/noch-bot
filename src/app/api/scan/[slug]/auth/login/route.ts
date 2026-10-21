import { NextRequest, NextResponse } from 'next/server';
import {
  loginScanner,
  scannerCookieName,
  scannerCookieOptions,
  SCANNER_AUTH_MESSAGES,
  signScannerToken,
} from '@/lib/scannerLinkAuth';
import { requireScannerLink } from '@/lib/scannerSession';

const STATUS_FOR = { invalid: 401, pending: 403, rejected: 403, blocked: 403 } as const;

// POST /api/scan/[slug]/auth/login  Body: { loginId, password }
// Signing in replaces any session on another device (one phone per account).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const found = await requireScannerLink(slug);
    if (found instanceof NextResponse) return found;

    const body = await req.json().catch(() => ({}));
    const result = await loginScanner(found.db, slug, body.loginId, body.password);
    if ('error' in result) {
      return NextResponse.json(
        { code: result.error, error: SCANNER_AUTH_MESSAGES[result.error] },
        { status: STATUS_FOR[result.error] }
      );
    }

    const res = NextResponse.json({ success: true, loginId: result.user.loginId });
    res.cookies.set(scannerCookieName(slug), signScannerToken(result.user, result.sessionId), scannerCookieOptions);
    return res;
  } catch (err) {
    console.error('[scanner_login]', err);
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 500 });
  }
}
