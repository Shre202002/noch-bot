import { NextRequest, NextResponse } from 'next/server';
import { registerScanner, SCANNER_AUTH_MESSAGES } from '@/lib/scannerLinkAuth';
import { ATTEMPT_WINDOW_MS, allowAttempt, clientIp, requireScannerLink } from '@/lib/scannerSession';

// POST /api/scan/[slug]/auth/register  Body: { loginId, password }
// Creates a pending account on the event's scanner link; the organizer approves it from the dashboard.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const found = await requireScannerLink(slug);
    if (found instanceof NextResponse) return found;

    // Sign-ups are limited per address, so a link cannot be flooded with pending accounts.
    if (!(await allowAttempt(found.db, `register-ip:${slug}:${clientIp(req)}`, 10, ATTEMPT_WINDOW_MS))) {
      return NextResponse.json({ code: 'too_many', error: SCANNER_AUTH_MESSAGES.too_many }, { status: 429, headers: { 'Retry-After': '600' } });
    }
    const body = await req.json().catch(() => ({}));
    const result = await registerScanner(found.db, found.link, body.loginId, body.password, body.name);
    if ('error' in result) {
      return NextResponse.json(
        { code: result.error, error: SCANNER_AUTH_MESSAGES[result.error] },
        { status: result.error === 'taken' ? 409 : 400 }
      );
    }
    return NextResponse.json({ success: true, code: 'pending', message: SCANNER_AUTH_MESSAGES.pending });
  } catch (err) {
    console.error('[scanner_register]', err);
    return NextResponse.json({ error: 'Could not create the account. Please try again.' }, { status: 500 });
  }
}
