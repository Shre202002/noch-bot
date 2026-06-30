import { ObjectId } from 'mongodb';

export type BookingStatus = 'in_progress' | 'awaiting_payment' | 'paid' | 'confirmed' | 'cancelled' | 'expired';
export type PaymentProvider = 'stripe' | 'paypal' | 'razorpay' | 'cashfree' | 'none';

export interface Booking {
  _id?: ObjectId;
  event_id: ObjectId;
  session_id: string;
  status: BookingStatus;
  quantity: number;
  form_responses: Record<string, any> | Record<string, any>[];
  amount_charged: number | null;
  payment_provider: PaymentProvider;
  payment_reference_id: string | null;
  created_at: Date;
  updated_at: Date;
}
