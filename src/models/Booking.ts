import { ObjectId } from 'mongodb';

export interface Booking {
  _id?: ObjectId;
  org_id: string;
  event_id: ObjectId;
  visitor_id: string;
  chat_session_id?: string;
  booking_session_id?: ObjectId;
  booking_code: string; 
  status: 'draft' | 'pending_payment' | 'confirmed' | 'cancelled' | 'expired' | 'failed';
  payment_status: 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded';
  event_snapshot: {
    name: string;
    start_at: Date;
    end_at: Date;
    venue: string | null;
    price: number | null;
    currency: string;
    ticket_template_id: string;
  };
  attendee: {
    name?: string;
    email?: string;
    phone?: string;
    answers: Array<{
      field_id: string;
      label: string;
      field_type: string;
      value: any;
    }>;
  };
  quantity: number;
  amount_total: number;
  currency: string;
  ticket_codes: string[];
  payment?: {
    provider?: 'razorpay' | 'stripe';
    provider_order_id?: string;
    checkout_url?: string;
    provider_reference?: string;
  };
  source: 'chat_widget';
  user_agent?: string;
  referrer?: string;
  website_url?: string;
  created_at: Date;
  updated_at: Date;
  confirmed_at?: Date;
  expires_at?: Date;
}
