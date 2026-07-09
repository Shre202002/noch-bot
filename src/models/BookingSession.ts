import { ObjectId } from 'mongodb';

export interface BookingSession {
  _id?: ObjectId;
  org_id: string;
  event_id?: ObjectId;
  visitor_id: string;
  chat_session_id?: string;
  status: 'started' | 'collecting_details' | 'summary' | 'checkout_pending' | 'confirmed' | 'cancelled' | 'expired';
  current_step: 'select_event' | 'collect_field' | 'quantity' | 'summary' | 'payment' | 'complete';
  selected_event_snapshot?: {
    name: string;
    price: number | null;
    currency: string;
    is_paid: boolean;
  };
  answers: Array<{
    field_id: string;
    label: string;
    field_type: string;
    value: any;
  }>;
  current_field_index: number;
  quantity: number;
  booking_id?: ObjectId;
  checkout_url?: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}
