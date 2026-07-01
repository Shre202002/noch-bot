import { ObjectId } from 'mongodb';

export type BookingStatus = 'in_progress' | 'awaiting_payment' | 'paid' | 'confirmed' | 'cancelled' | 'expired';
export type PaymentProvider = 'stripe' | 'paypal' | 'razorpay' | 'cashfree' | 'none';

/**
 * Conversational state separate from payment/lifecycle status.
 */
export type ConversationState = 
  | 'collecting_quantity' 
  | 'collecting_fields' 
  | 'reviewing' 
  | 'processing_confirmation' // Transitional locking state
  | 'awaiting_payment' 
  | 'confirmed' 
  | 'cancelled' 
  | 'expired';

export interface Booking {
  _id?: ObjectId;
  event_id: ObjectId;
  session_id: string; // Public unique session ID for the visitor
  status: BookingStatus;
  quantity: number;
  form_responses: Record<string, any> | Record<string, any>[];
  
  // Conversational state tracking
  conversation_state: ConversationState;
  session_context: {
    current_field_index: number;
    current_attendee_index: number;
    last_updated_at: Date;
  };

  hold_expires_at: Date | null; // For paid events BMS-style flow

  amount_charged: number | null;
  payment_provider: PaymentProvider;
  payment_reference_id: string | null;
  created_at: Date;
  updated_at: Date;
}
