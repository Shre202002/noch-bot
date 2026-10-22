import { NextRequest, NextResponse } from 'next/server';
import {
  loginScanner,
  scannerCookieName,
  scannerCookieOptions,
  SCANNER_AUTH_MESSAGES,
  signScannerToken,
} from '@/lib/scannerLinkAuth';
import { ATTEMPT_WINDOW_MS, MAX_ATTEMPTS_PER_ACCOUNT, MAX_ATTEMPTS_PER_ADDRESS, allowAttempt, clientIp, isThrottled, requireScannerLink } from '@/lib/scannerSession';

const STATUS_FOR = { invalid: 401, pending: 403, rejected: 403, blocked: 403 } as const;

// POST /api/scan/[slug]/auth/login  Body: { loginId, password }
// Signing in replaces any session on another device (one phone per account).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const found = await requireScannerLink(slug);
    if (found instanceof NextResponse) return found;

    const body = await req.json().catch(() => ({}));
    // Wrong guesses are counted, per account and per address. Once either has used its allowance, further attempts are turned
    // away before any password is checked. A correct password on a not-yet-approved account is not a guess and is never
    // counted, so someone waiting for approval (whose screen retries every few seconds) is not locked out.
    const ipKey = `login-ip:${slug}:${clientIp(req)}`;
    const accountKey = `login-acct:${slug}:${String(body.loginId ?? '').trim().toLowerCase().slice(0, 64)}`;
    if ((await isThrottled(found.db, ipKey, MAX_ATTEMPTS_PER_ADDRESS, ATTEMPT_WINDOW_MS)) || (await isThrottled(found.db, accountKey, MAX_ATTEMPTS_PER_ACCOUNT, ATTEMPT_WINDOW_MS))) {
      return NextResponse.json({ code: 'too_many', error: SCANNER_AUTH_MESSAGES.too_many }, { status: 429, headers: { 'Retry-After': '600' } });
    }
    const result = await loginScanner(found.db, slug, body.loginId, body.password);
    if ('error' in result && result.error === 'invalid') {
      await allowAttempt(found.db, ipKey, MAX_ATTEMPTS_PER_ADDRESS, ATTEMPT_WINDOW_MS);
      await allowAttempt(found.db, accountKey, MAX_ATTEMPTS_PER_ACCOUNT, ATTEMPT_WINDOW_MS);
    }
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
