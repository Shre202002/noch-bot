import { NextRequest, NextResponse } from 'next/server';
import { doorCounts } from '@/lib/scanFeed';
import { requireScannerLink } from '@/lib/scannerSession';
import { scannerCookieName, SCANNER_AUTH_MESSAGES, verifyScannerSession } from '@/lib/scannerLinkAuth';

// GET /api/scan/[slug]/auth/me → { signedIn, loginId, name, event, counts } or { signedIn: false, code, message, event }
// The event's name, date and venue are shown on the sign-in screen too, so staff can see they are on the right link.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const found = await requireScannerLink(slug);
    if (found instanceof NextResponse) return found;

    const eventDoc = await found.db.collection('events').findOne(
      { _id: found.link.event_id, org_id: found.link.org_id },
      { projection: { name: 1, start_at: 1, venue: 1 } }
    );
    const event = eventDoc ? { name: eventDoc.name, startAt: eventDoc.start_at ?? null, venue: eventDoc.venue ?? null } : null;

    const session = await verifyScannerSession(found.db, slug, req.cookies.get(scannerCookieName(slug))?.value);
    if ('error' in session) {
      return NextResponse.json({ signedIn: false, code: session.error, message: SCANNER_AUTH_MESSAGES[session.error], event });
    }
    return NextResponse.json({
      signedIn: true,
      loginId: session.user.loginId,
      name: typeof session.user.name === 'string' ? session.user.name : null,
      event,
      counts: await doorCounts(found.db, found.link.org_id, found.link.event_id),
    });
  } catch (err) {
    console.error('[scanner_me]', err);
    return NextResponse.json({ error: 'Could not check your sign-in.' }, { status: 500 });
  }
}
