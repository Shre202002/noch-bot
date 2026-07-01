import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { getDb } from './db';
import { Booking } from '@/models/Booking';
import { Ticket } from '@/models/Ticket';

const TICKET_QR_SECRET = process.env.TICKET_QR_SECRET;
if (!TICKET_QR_SECRET) {
  throw new Error('CRITICAL: TICKET_QR_SECRET environment variable is missing.');
}

/**
 * Generates a high-entropy, human-friendly ticket code.
 * Avoiding ambiguous characters: 0, O, 1, I, L.
 */
function generateReadableCode(length = 8): string {
  const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Issues ticket documents for a confirmed booking.
 * Handles collisions gracefully with retries.
 */
export async function issueTicketsForBooking(booking: Booking): Promise<Ticket[]> {
  const db = await getDb();
  const tickets: Ticket[] = [];
  const now = new Date();

  for (let i = 0; i < booking.quantity; i++) {
    let success = false;
    let attempts = 0;
    let ticketCode = '';

    while (!success && attempts < 3) {
      ticketCode = `EVT-${generateReadableCode()}`;
      
      // Use HMAC with server-side secret to prevent payload forgery
      const qrPayloadHash = crypto
        .createHmac('sha256', TICKET_QR_SECRET!)
        .update(`${ticketCode}:${booking._id}:${booking.event_id}`)
        .digest('hex');

      const ticket: Ticket = {
        booking_id: booking._id!,
        event_id: booking.event_id,
        ticket_code: ticketCode,
        qr_payload_hash: qrPayloadHash,
        status: 'active',
        scanned_at: null,
        scanned_by_staff_id: null,
        scan_device_info: null,
        issued_at: now
      };

      try {
        await db.collection('tickets').insertOne(ticket);
        tickets.push(ticket);
        success = true;
      } catch (err: any) {
        // Handle duplicate key error for ticket_code index
        if (err.code === 11000) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    if (!success) {
      throw new Error(`Failed to generate unique ticket code after ${attempts} attempts`);
    }
  }

  return tickets;
}
