/**
 * @fileOverview Core logic for processing conversational booking messages.
 * 
 * TODO: Phase 3 Checkpoint 2 - AI-assisted correction (typo tolerance, format normalization)
 * is intentionally out of scope for this checkpoint.
 */

import { Booking, ConversationState } from "@/models/Booking";
import { Event } from "@/models/Event";
import { EventFormField } from "@/models/EventFormField";
import { getNextState, BookingContext } from "./bookingStateMachine";

export interface BookingFlowUpdate {
  conversation_state: ConversationState;
  session_context: Booking['session_context'];
  quantity: number;
  form_responses: Booking['form_responses'];
  bot_reply: string;
}

export function processBookingMessage(
  message: string,
  booking: Booking,
  event: Event,
  fields: EventFormField[]
): BookingFlowUpdate {
  const { conversation_state, session_context, quantity, form_responses } = booking;
  const input = message.trim();

  switch (conversation_state) {
    case 'collecting_quantity':
      return handleQuantityInput(input, event, fields, booking);

    case 'collecting_fields':
      return handleFieldInput(input, event, fields, booking);

    case 'reviewing':
      return handleReviewInput(input, event, fields, booking);

    default:
      return {
        conversation_state,
        session_context,
        quantity,
        form_responses,
        bot_reply: "I'm sorry, I didn't quite catch that. Could you try again?"
      };
  }
}

function handleQuantityInput(
  input: string,
  event: Event,
  fields: EventFormField[],
  booking: Booking
): BookingFlowUpdate {
  const parsed = parseInt(input);
  
  if (isNaN(parsed) || parsed <= 0) {
    return {
      ...booking,
      bot_reply: "Please enter a valid number of tickets you'd like to book."
    };
  }

  if (!event.allow_group_booking && parsed !== 1) {
    return {
      ...booking,
      bot_reply: "This event only allows booking 1 ticket at a time. Please enter '1' to continue."
    };
  }

  if (event.allow_group_booking && event.max_tickets_per_booking && parsed > event.max_tickets_per_booking) {
    return {
      ...booking,
      bot_reply: `You can book a maximum of ${event.max_tickets_per_booking} tickets. Please enter a smaller number.`
    };
  }

  const nextContext = {
    ...booking.session_context,
    current_field_index: 0,
    current_attendee_index: 0,
    last_updated_at: new Date()
  };

  const bCtx: BookingContext = {
    field_count: fields.length,
    current_field_index: -1, // We haven't started fields yet
    current_attendee_index: 0,
    quantity: parsed
  };

  const nextState = getNextState('collecting_quantity', event.is_paid, bCtx);
  
  // Initialize responses based on quantity
  let initialResponses: any = {};
  if (parsed > 1) {
    initialResponses = Array.from({ length: parsed }, () => ({}));
  }

  return {
    conversation_state: nextState,
    session_context: nextContext,
    quantity: parsed,
    form_responses: initialResponses,
    bot_reply: getNextQuestion(nextState, nextContext, parsed, fields)
  };
}

function handleFieldInput(
  input: string,
  event: Event,
  fields: EventFormField[],
  booking: Booking
): BookingFlowUpdate {
  const { current_field_index, current_attendee_index } = booking.session_context;
  const field = fields[current_field_index];

  // 1. Validation
  const validationError = validateInput(input, field);
  if (validationError) {
    return {
      ...booking,
      bot_reply: validationError
    };
  }

  // 2. Store Response
  const updatedResponses = JSON.parse(JSON.stringify(booking.form_responses));
  if (booking.quantity > 1) {
    updatedResponses[current_attendee_index][field.field_key] = input;
  } else {
    updatedResponses[field.field_key] = input;
  }

  // 3. Logic to advance
  let nextFieldIndex = current_field_index + 1;
  let nextAttendeeIndex = current_attendee_index;

  if (nextFieldIndex >= fields.length) {
    if (nextAttendeeIndex < booking.quantity - 1) {
      nextFieldIndex = 0;
      nextAttendeeIndex++;
    }
  }

  const nextContext = {
    ...booking.session_context,
    current_field_index: nextFieldIndex,
    current_attendee_index: nextAttendeeIndex,
    last_updated_at: new Date()
  };

  const bCtx: BookingContext = {
    field_count: fields.length,
    current_field_index: nextFieldIndex - 1, 
    current_attendee_index: nextAttendeeIndex,
    quantity: booking.quantity
  };

  const nextState = getNextState('collecting_fields', event.is_paid, bCtx);

  return {
    conversation_state: nextState,
    session_context: nextContext,
    quantity: booking.quantity,
    form_responses: updatedResponses,
    bot_reply: getNextQuestion(nextState, nextContext, booking.quantity, fields)
  };
}

function handleReviewInput(
  input: string,
  event: Event,
  fields: EventFormField[],
  booking: Booking
): BookingFlowUpdate {
  const affirmative = ['yes', 'yeah', 'confirm', 'correct', 'ok', 'sure', 'yep'].includes(input.toLowerCase());
  const negative = ['no', 'nope', 'change', 'edit', 'wrong'].includes(input.toLowerCase());

  if (affirmative) {
    const bCtx: BookingContext = {
      field_count: fields.length,
      current_field_index: fields.length,
      current_attendee_index: booking.quantity,
      quantity: booking.quantity
    };
    const nextState = getNextState('reviewing', event.is_paid, bCtx);
    
    return {
      ...booking,
      conversation_state: nextState,
      bot_reply: nextState === 'awaiting_payment' 
        ? "Great! Please click the link below to complete your payment." 
        : "Perfect! Your booking is being confirmed..."
    };
  }

  if (negative) {
    // TODO: Phase 3 - Implement field editing
    return {
      ...booking,
      bot_reply: "I understand. Which part would you like to change? (Note: Editing support is coming soon, please restart the session for now)."
    };
  }

  return {
    ...booking,
    bot_reply: "I'm sorry, I didn't understand that. Does everything look correct? Please say 'Yes' to confirm or 'No' to make changes."
  };
}

function validateInput(input: string, field: EventFormField): string | null {
  if (field.is_required && !input) {
    return `${field.label} is required. Please provide an answer.`;
  }

  switch (field.validation_rule) {
    case 'email_format':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return "That doesn't look like a valid email address. Please try again.";
      break;
    case 'phone_format':
      if (!/^\+?[0-9]{7,15}$/.test(input)) return "Please enter a valid phone number (digits only, optional + prefix).";
      break;
    case 'name_format':
      if (input.length < 2) return "Please provide a valid name.";
      break;
    case 'custom_regex':
      if (field.custom_regex && !new RegExp(field.custom_regex).test(input)) {
        return `The input format is incorrect. Please check and try again.`;
      }
      break;
  }
  return null;
}

function getNextQuestion(
  state: ConversationState,
  context: Booking['session_context'],
  quantity: number,
  fields: EventFormField[]
): string {
  if (state === 'collecting_fields') {
    const field = fields[context.current_field_index];
    const attendeeSuffix = quantity > 1 ? ` for attendee #${context.current_attendee_index + 1}` : '';
    return `Great. Please provide the ${field.label}${attendeeSuffix}.`;
  }

  if (state === 'reviewing') {
    return "Thank you! I've collected all the details. Does everything look correct? (Yes/No)";
  }

  return "Something went wrong. Could you try sending that again?";
}
