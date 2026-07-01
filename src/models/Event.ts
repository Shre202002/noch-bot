import { ObjectId } from 'mongodb';

export type EventStatus = 'draft' | 'published' | 'closed' | 'cancelled';

export interface Event {
  _id?: ObjectId;
  org_id: string; // UUID string from auth session
  name: string;
  description: string;
  start_at: Date;
  end_at: Date;
  venue: string | null;
  capacity: number;
  tickets_sold: number;
  tickets_held: number; // BMS-style temporary holds
  status: EventStatus;
  is_paid: boolean;
  price: number | null;
  currency: string;
  allow_group_booking: boolean;
  max_tickets_per_booking: number | null;
  ticket_template_id: string;
  logo_url: string | null;
  banner_url: string | null;
  chatbot_widget_id: ObjectId;
  created_at: Date;
  updated_at: Date;
}
