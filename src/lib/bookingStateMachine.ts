import { ConversationState } from "@/models/Booking";

export interface BookingContext {
  field_count: number;
  current_field_index: number;
  current_attendee_index: number;
  quantity: number;
}

/**
 * Pure state transition logic for the booking conversation.
 * Determines the next state based on the current context.
 */
export function getNextState(
  currentState: ConversationState,
  isPaid: boolean,
  context: BookingContext
): ConversationState {
  switch (currentState) {
    case 'collecting_quantity':
      // If we have fields to collect, go to fields. Otherwise go to review.
      return context.field_count > 0 ? 'collecting_fields' : 'reviewing';

    case 'collecting_fields':
      // Check if we've reached the end of fields for the current attendee
      const isLastField = context.current_field_index >= context.field_count - 1;
      const isLastAttendee = context.current_attendee_index >= context.quantity - 1;

      if (isLastField) {
        if (isLastAttendee) {
          return 'reviewing';
        } else {
          // Move to next attendee, reset field index
          return 'collecting_fields';
        }
      } else {
        // More fields to go for this attendee
        return 'collecting_fields';
      }

    case 'reviewing':
      // Transition from review depends on whether payment is required
      return isPaid ? 'awaiting_payment' : 'confirmed';

    default:
      return currentState;
  }
}
