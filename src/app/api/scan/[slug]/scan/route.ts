import { NextRequest, NextResponse } from 'next/server';
import { scanTicket } from '@/lib/ticketScan';
import { requireScannerSession } from '@/lib/scannerSession';

/** A ticket code, whether the QR held the bare code or a link containing it. */
const CODE_RE = /EVT-[A-Z0-9]{8}/;

// POST /api/scan/[slug]/scan  Body: { ticketCode, clientScanId? }
// The event is the link's event, never taken from the request. Every outcome is a 200 with a `result`, so the scanner
// screen can show it; only a missing or invalid sign-in is an error status. The door counts are not computed here: the
// scanner updates them itself and re-reads them every few seconds, which keeps this route to a few database waits.
// The time spent here is sent as a Server-Timing header (visible in the browser's network panel).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const startedAt = Date.now();
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Server-Timing': `scan;dur=${Date.now() - startedAt}`, 'Cache-Control': 'no-store' } });

  try {
    const { slug } = await params;
    const session = await requireScannerSession(req, slug);
    if (session instanceof NextResponse) return session;

    const body = await req.json().catch(() => ({}));
    const ticketCode = CODE_RE.exec(String(body.ticketCode ?? '').trim().toUpperCase())?.[0];
    if (!ticketCode) return reply({ result: 'invalid', message: 'That is not a ticket code.' });

    const { db, link, user } = session;
    const outcome = await scanTicket(db, {
      ticketCode,
      eventScope: link.event_id,
      scannerId: user._id,
      scannerName: (typeof user.name === 'string' && user.name) || user.loginId,
      deviceInfo: { source: 'scanner_link' },
      clientScanId: typeof body.clientScanId === 'string' ? body.clientScanId.slice(0, 64) : null,
    });

    switch (outcome.code) {
      case 'scanned':
        return reply({ result: 'admitted', code: ticketCode, attendee: outcome.attendeeName, retry: outcome.retry });
      case 'not_active':
        return reply({
          result: outcome.status === 'scanned' ? 'already_scanned' : 'void',
          code: ticketCode,
          attendee: outcome.attendeeName,
          scannedAt: outcome.scannedAt,
          scannedBy: outcome.scannedByName,
        });
      case 'misconfigured':
        return reply({ error: 'Scanning is temporarily unavailable.' }, 503);
      default:
        // not_found, test_ticket, wrong_event, tampered, not_confirmed
        return reply({ result: outcome.code, code: ticketCode });
    }
  } catch (err) {
    console.error('[scanner_scan]', err);
    return reply({ error: 'Could not check that ticket. Try again.' }, 500);
  }
}
