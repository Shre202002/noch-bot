import { ObjectId } from 'mongodb';
import { getDb } from './db';

/**
 * Whether this pending booking holds seats on the event's counters: chat-bot bookings always do; widget bookings
 * do when created by the current flow (`hold_placed`). Older widget bookings were counted by a booking query instead.
 */
export const bookingHoldsSeats = (booking: Record<string, any>) =>
  booking.status === 'awaiting_payment' || booking.hold_placed === true;

/**
 * Atomically reserves `quantity` seats against an event's capacity.
 * For FREE events - directly increases tickets_sold.
 */
export async function reserveCapacity(eventId: ObjectId, quantity: number) {
  const db = await getDb();
  const result = await db.collection('events').findOneAndUpdate(
    {
      _id: eventId,
      $expr: { 
        $lte: [
          { $add: ['$tickets_sold', '$tickets_held', quantity] }, 
          '$capacity'
        ] 
      }
    },
    { $inc: { tickets_sold: quantity }, $set: { updated_at: new Date() } },
    { returnDocument: 'after' }
  );
  return result;
}

/**
 * Places a temporary hold on inventory for PAID events.
 */
export async function placeHold(eventId: ObjectId, quantity: number, holdMinutes = 5) {
  const db = await getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + holdMinutes * 60000);

  const result = await db.collection('events').findOneAndUpdate(
    {
      _id: eventId,
      $expr: { 
        $lte: [
          { $add: ['$tickets_sold', '$tickets_held', quantity] }, 
          '$capacity'
        ] 
      }
    },
    { $inc: { tickets_held: quantity }, $set: { updated_at: now } },
    { returnDocument: 'after' }
  );

  if (!result) return null;

  return {
    event: result,
    hold_expires_at: expiresAt
  };
}

/**
 * Converts a hold into a final sale. Called when payment succeeds.
 */
export async function confirmHold(eventId: ObjectId, quantity: number) {
  const db = await getDb();
  return await db.collection('events').findOneAndUpdate(
    { _id: eventId },
    { 
      $inc: { 
        tickets_sold: quantity,
        tickets_held: -quantity
      }, 
      $set: { updated_at: new Date() } 
    },
    { returnDocument: 'after' }
  );
}

/**
 * Explicitly releases a hold (e.g. user cancels payment).
 */
export async function releaseHold(eventId: ObjectId, quantity: number) {
  const db = await getDb();
  return await db.collection('events').findOneAndUpdate(
    { 
      _id: eventId,
      tickets_held: { $gte: quantity } // Guard against negative held count
    },
    { $inc: { tickets_held: -quantity }, $set: { updated_at: new Date() } },
    { returnDocument: 'after' }
  );
}

/**
 * Reconciles an expired hold lazily.
 * This passive approach cleans up stale inventory the moment anyone tries to use it.
 */
export async function reconcileExpiredHold(bookingId: ObjectId): Promise<boolean> {
  const db = await getDb();
  const now = new Date();

  // 1. Atomically lock the booking as expired if it was awaiting payment and time is up
  const booking = await db.collection('bookings').findOneAndUpdate(
    { 
      _id: bookingId, 
      status: 'awaiting_payment', 
      hold_expires_at: { $lt: now } 
    },
    { 
      $set: { 
        status: 'expired', 
        conversation_state: 'expired',
        updated_at: now 
      } 
    },
    { returnDocument: 'before' } // Return state before update to verify if we were the ones to expire it
  );

  // 2. If update succeeded, release the hold on the event
  if (booking) {
    await releaseHold(booking.event_id, booking.quantity);
    return true;
  }

  return false;
}

/**
 * Releases every expired hold on an event, from both booking flows:
 * - chat-bot bookings `awaiting_payment` past `hold_expires_at`;
 * - widget bookings `pending_payment` with `hold_placed` past `expires_at`.
 * Each booking is claimed atomically (status → expired) before its seats are released, so a hold is never
 * released twice and a payment that arrives first keeps its seats. Called before seats are reserved, so a
 * visitor who abandons checkout cannot keep seats locked. Returns the number of seats released.
 */
export async function releaseExpiredHolds(eventId: ObjectId, now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const bookings = db.collection('bookings');
  const stale = await bookings
    .find(
      {
        event_id: eventId,
        $or: [
          { status: 'awaiting_payment', hold_expires_at: { $lt: now } },
          { status: 'pending_payment', hold_placed: true, expires_at: { $lt: now } },
        ],
      },
      { projection: { _id: 1, status: 1 } }
    )
    .toArray();

  let released = 0;
  for (const candidate of stale) {
    const claimed = await bookings.findOneAndUpdate(
      { _id: candidate._id, status: candidate.status },
      { $set: { status: 'expired', conversation_state: 'expired', hold_released_at: now, updated_at: now } },
      { returnDocument: 'before' }
    );
    if (claimed) {
      await releaseHold(eventId, claimed.quantity);
      released += claimed.quantity;
    }
  }
  return released;
}
