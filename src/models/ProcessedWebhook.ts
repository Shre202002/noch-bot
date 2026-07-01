
import { ObjectId } from 'mongodb';

export interface ProcessedWebhook {
  _id?: ObjectId;
  provider: 'stripe' | 'paypal' | 'razorpay' | 'cashfree';
  provider_event_id: string; // Unique ID from provider to prevent double processing
  booking_id: ObjectId | null;
  status: 'paid' | 'failed' | 'other';
  raw_payload: any; // Stored for audit and debugging
  processed_at: Date;
}
