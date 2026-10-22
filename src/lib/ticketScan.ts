import crypto from 'crypto';
import type { Db, ObjectId } from 'mongodb';
import { attendeeNameFrom } from './ticketLinks';

/**
 * The one set of rules for admitting a ticket at the door, used by every scanner entry point (staff token API and the
 * shared scanner link). A scan succeeds only for a real, untampered ticket of a confirmed booking, for the scanner's own
 * event, and claims the ticket atomically so two phones can never both admit it.
 */

export type ScanOutcome =
  | { code: 'scanned'; ticket: Record<string, any>; retry: boolean; attendeeName: string | null }
  | { code: 'misconfigured' }
  | { code: 'not_found' }
  | { code: 'test_ticket' }
  | { code: 'wrong_event' }
  | { code: 'tampered' }
  | { code: 'not_confirmed' }
  | {
      code: 'not_active';
      /** The ticket's status, e.g. `scanned` or `void`. */
      status: string;
      scannedAt: Date | null;
      scannedByName: string | null;
      attendeeName: string | null;
    };

export interface ScanRequest {
  ticketCode: string;
  /** The scanner's event, or null for a scanner allowed at every event of the organizer. */
  eventScope: ObjectId | null;
  scannerId: ObjectId;
  scannerName?: string | null;
  deviceInfo?: Record<string, any> | null;
  clientScanId?: string | null;
}

export async function scanTicket(db: Db, request: ScanRequest): Promise<ScanOutcome> {
  const secret = process.env.TICKET_QR_SECRET;
  if (!secret) return { code: 'misconfigured' };

  const { ticketCode } = request;
  // The ticket and its booking come back in one database round trip.
  const [ticket] = await db
    .collection('tickets')
    .aggregate([
      { $match: { ticket_code: ticketCode } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking_id',
          foreignField: '_id',
          as: 'booking',
          pipeline: [{ $project: { status: 1, attendee: 1 } }],
        },
      },
    ])
    .toArray();
  if (!ticket) return { code: 'not_found' };
  const booking = (ticket.booking as Array<Record<string, any>>)[0];

  // Test tickets (made to try the booking) never admit anyone.
  if (ticket.is_test) return { code: 'test_ticket' };

  if (request.eventScope && !request.eventScope.equals(ticket.event_id)) return { code: 'wrong_event' };

  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(`${ticketCode}:${ticket.booking_id}:${ticket.event_id}`)
    .digest('hex');
  if (ticket.qr_payload_hash !== expectedHash) return { code: 'tampered' };

  // Only tickets of confirmed bookings admit anyone (e.g. not one refunded after a late payment).
  if (booking && booking.status !== 'confirmed') return { code: 'not_confirmed' };
  const attendeeName = attendeeNameFrom(booking?.attendee?.answers);

  const claimed = await db.collection('tickets').findOneAndUpdate(
    { ticket_code: ticketCode, status: 'active' },
    {
      $set: {
        status: 'scanned',
        scanned_at: new Date(),
        scanned_by_staff_id: request.scannerId,
        scanned_by_name: request.scannerName ?? null,
        scan_device_info: request.deviceInfo || null,
        client_scan_id: request.clientScanId || null,
      },
    },
    { returnDocument: 'after' }
  );
  if (claimed) return { code: 'scanned', ticket: claimed, retry: false, attendeeName };

  // Someone got there first: report who and when, unless it is this same scan being retried.
  const existing = await db.collection('tickets').findOne({ ticket_code: ticketCode });
  if (existing?.status === 'scanned' && request.clientScanId && existing.client_scan_id === request.clientScanId) {
    return { code: 'scanned', ticket: existing, retry: true, attendeeName };
  }
  return {
    code: 'not_active',
    status: existing?.status || 'unknown',
    scannedAt: existing?.scanned_at ?? null,
    scannedByName: existing?.scanned_by_name ?? null,
    attendeeName,
  };
}
