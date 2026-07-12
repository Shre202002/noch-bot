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
    result += charset.charAt(crypto.randomInt(0, charset.length));
  }
  return result;
}

/**
 * Issues ticket documents for a confirmed booking.
 * Handles collisions gracefully with retries.
 * Idempotent: Handles partial issuance and avoids duplicates using ticket_index.
 */
export async function issueTicketsForBooking(booking: Booking): Promise<Ticket[]> {
  const db = await getDb();
  
  // 1. Identify existing tickets for this booking
  const existingTickets = await db.collection('tickets')
    .find({ booking_id: booking._id })
    .sort({ ticket_index: 1 })
    .toArray();

  // If we already have enough tickets, return them
  if (existingTickets.length >= booking.quantity) {
    return existingTickets.slice(0, booking.quantity) as unknown as Ticket[];
  }

  const tickets = [...existingTickets] as unknown as Ticket[];
  const now = new Date();

  // 2. Issue missing tickets starting from the last index
  for (let i = existingTickets.length; i < booking.quantity; i++) {
    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
      const ticketCode = `EVT-${generateReadableCode()}`;
      
      // Use HMAC with server-side secret to prevent payload forgery
      const qrPayloadHash = crypto
        .createHmac('sha256', TICKET_QR_SECRET!)
        .update(`${ticketCode}:${booking._id}:${booking.event_id}`)
        .digest('hex');

      const ticket: Ticket = {
        booking_id: booking._id!,
        event_id: booking.event_id,
        ticket_code: ticketCode,
        ticket_index: i,
        qr_payload_hash: qrPayloadHash,
        status: 'active',
        scanned_at: null,
        scanned_by_staff_id: null,
        scan_device_info: null,
        client_scan_id: null,
        issued_at: now
      };

      try {
        await db.collection('tickets').insertOne(ticket);
        tickets.push(ticket);
        success = true;
      } catch (err: any) {
        // Handle duplicate key error (code collision or index collision)
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
