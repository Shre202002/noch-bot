import { ObjectId } from 'mongodb';
import { getDb } from './db';

/**
 * Atomically reserves `quantity` seats against an event's capacity.
 * Returns the updated event document if successful, or null if there
 * wasn't enough remaining capacity (caller must treat null as "sold out").
 * This MUST be used instead of a read-then-write capacity check anywhere
 * a booking is confirmed.
 */
export async function reserveCapacity(eventId: ObjectId, quantity: number) {
  const db = await getDb();
  const result = await db.collection('events').findOneAndUpdate(
    {
      _id: eventId,
      $expr: { $lte: [{ $add: ['$tickets_sold', quantity] }, '$capacity'] }
    },
    { $inc: { tickets_sold: quantity }, $set: { updated_at: new Date() } },
    { returnDocument: 'after' }
  );
  return result; // null = capacity exceeded
}

/**
 * Releases previously reserved seats — used when a booking expires,
 * is cancelled pre-payment, or payment fails after a reservation.
 */
export async function releaseCapacity(eventId: ObjectId, quantity: number) {
  const db = await getDb();
  const result = await db.collection('events').findOneAndUpdate(
    { _id: eventId },
    { $inc: { tickets_sold: -quantity }, $set: { updated_at: new Date() } },
    { returnDocument: 'after' }
  );
  return result;
}
