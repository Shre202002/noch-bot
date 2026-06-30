import { getDb } from './db';

/**
 * Initializes indexes for the Booking Chatbot feature.
 * Ensures data integrity and performance for multi-tenant queries.
 */
export async function ensureBookingIndexes() {
  const db = await getDb();

  // Events
  await db.collection('events').createIndexes([
    { key: { org_id: 1 } },
    { key: { chatbot_widget_id: 1 } },
    { key: { status: 1 } }
  ]);

  // Form Fields
  await db.collection('event_form_fields').createIndexes([
    { key: { event_id: 1, order_index: 1 } }
  ]);

  // Bookings
  await db.collection('bookings').createIndexes([
    { key: { event_id: 1 } },
    { key: { session_id: 1 } },
    { key: { status: 1 } }
  ]);

  // Tickets
  await db.collection('tickets').createIndexes([
    { key: { ticket_code: 1 }, unique: true },
    { key: { event_id: 1 } },
    { key: { booking_id: 1 } }
  ]);

  // Gateway Configs
  await db.collection('payment_gateway_configs').createIndexes([
    { key: { org_id: 1, provider: 1 } }
  ]);

  // Scanner Staff
  await db.collection('scanner_staff').createIndexes([
    { key: { org_id: 1 } },
    { key: { email: 1 } }
  ]);

  console.log('✅ Booking feature indexes initialized.');
}
