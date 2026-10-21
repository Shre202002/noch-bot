import { ObjectId } from 'mongodb';

/**
 * Conversation state machine for the deterministic chatbot booking flow.
 *
 * collecting_quantity -> collecting_fields -> reviewing -> awaiting_payment -> confirmed
 *      (or straight to reviewing when the event has no form fields)
 * reviewing -> confirmed                      (free events)
 * awaiting_payment -> confirmed | cancelled   (payment webhook)
 * awaiting_payment -> expired                 (hold reconciliation)
 */
export type ConversationState =
  | 'collecting_quantity'
  | 'collecting_fields'
  | 'reviewing'
  | 'processing_confirmation'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cancelled'
  | 'expired';

/**
 * Booking lifecycle status.
 *
 * - Bot (conversational) flow:  in_progress -> processing_confirmation -> awaiting_payment -> confirmed
 * - Embed (classic) flow:       pending_payment -> confirmed
 * - Shared terminal states:     confirmed | cancelled | expired | failed
 */
export type BookingStatus =
  | 'draft'
  | 'in_progress'
  | 'processing_confirmation'
  | 'pending_payment'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export type BookingPaymentStatus =
  | 'not_required'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

/** Cursor state for the conversational form collection. */
export interface BookingSessionContext {
  current_field_index: number;
  current_attendee_index: number;
  last_updated_at: Date;
}

/**
 * Answers collected by the chatbot.
 * - Single-attendee bookings: object keyed by field_key.
 * - Group bookings: array with one object per attendee, each keyed by field_key.
 */
export type BookingFormResponses = Record<string, any> | Array<Record<string, any>>;

export interface Booking {
  _id?: ObjectId;

  // --- Identity & ownership ---
  org_id?: string; // UUID string from auth session (always set by embed flow; derivable from event for bot flow)
  event_id: ObjectId;
  visitor_id?: string; // embed flow
  chat_session_id?: string;
  booking_session_id?: ObjectId; // embed flow: link to the booking_sessions document
  session_id?: string; // bot flow: conversational session UUID

  // --- Conversational (bot) flow state machine ---
  conversation_state?: ConversationState;
  session_context?: BookingSessionContext;
  form_responses?: BookingFormResponses;
  hold_expires_at?: Date | null; // expiry of the BMS-style inventory hold (paid events)
  /** Widget flow: seats for this pending booking are held on the event counters (released when it expires). */
  hold_placed?: boolean;

  // --- Lifecycle ---
  status: BookingStatus;
  payment_status?: BookingPaymentStatus;
  booking_code?: string; // human-friendly reference (e.g. NBK-2026-A1B2C3)
  source?: 'chat_widget';

  // --- Event snapshot (embed flow) ---
  event_snapshot?: {
    name: string;
    start_at: Date;
    end_at: Date;
    venue: string | null;
    price: number | null;
    currency: string;
    ticket_template_id: string;
  };
  attendee?: {
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

  // --- Commerce ---
  quantity: number;
  amount_total?: number | null; // embed flow: total payable
  amount_charged?: number | null; // bot flow: charged amount
  currency?: string;
  ticket_codes?: string[];

  // --- Payment ---
  payment?: {
    provider?: 'razorpay' | 'stripe' | 'paypal' | 'cashfree';
    provider_order_id?: string;
    checkout_url?: string;
    provider_reference?: string;
    provider_payment_id?: string;
    raw_webhook_event_id?: string;
    access_token?: string; // one-time token for the /booking/pay bridge
  };
  // Bot flow stores flattened payment identifiers at the top level
  payment_provider?: 'razorpay' | 'stripe' | 'paypal' | 'cashfree' | 'none';
  payment_reference_id?: string | null;

  // --- Metadata ---
  user_agent?: string;
  referrer?: string;
  website_url?: string;

  created_at: Date;
  updated_at: Date;
  confirmed_at?: Date;
  expires_at?: Date;
}
