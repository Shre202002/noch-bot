import { ObjectId } from 'mongodb';

export type TicketStatus = 'active' | 'scanned' | 'void' | 'expired';

export interface Ticket {
  _id?: ObjectId;
  booking_id: ObjectId;
  event_id: ObjectId;
  ticket_code: string;
  ticket_index: number; // Order of ticket within a booking (0, 1, 2...)
  qr_payload_hash: string;
  status: TicketStatus;
  scanned_at: Date | null;
  scanned_by_staff_id: ObjectId | null;
  scan_device_info: Record<string, any> | null;
  client_scan_id: string | null; // Unique ID from client to track which specific attempt won
  issued_at: Date;
}
