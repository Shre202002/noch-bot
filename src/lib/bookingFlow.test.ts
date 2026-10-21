import { describe, it, expect } from "vitest";
import { processBookingMessage, BookingFlowUpdate } from "@/lib/bookingFlow";
import { Booking, BookingFormResponses } from "@/models/Booking";
import { Event } from "@/models/Event";
import { EventFormField } from "@/models/EventFormField";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    _id: undefined,
    org_id: "org-1",
    name: "Test Event",
    description: "desc",
    start_at: new Date("2026-10-01T10:00:00Z"),
    end_at: new Date("2026-10-01T18:00:00Z"),
    venue: "Test Venue",
    capacity: 100,
    tickets_sold: 0,
    tickets_held: 0,
    status: "published",
    is_paid: false,
    price: null,
    currency: "INR",
    allow_group_booking: true,
    max_tickets_per_booking: 5,
    ticket_template_id: "dark",
    logo_url: null,
    banner_url: null,
    chatbot_widget_id: undefined as any,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function makeField(overrides: Partial<EventFormField> = {}): EventFormField {
  return {
    _id: undefined,
    event_id: undefined as any,
    field_key: "full_name",
    label: "Full Name",
    field_type: "text",
    options: null,
    is_required: true,
    validation_rule: "none",
    custom_regex: null,
    order_index: 0,
    ai_correction_enabled: false,
    ...overrides,
  };
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    org_id: "org-1",
    event_id: undefined as any,
    status: "in_progress",
    conversation_state: "collecting_quantity",
    session_context: {
      current_field_index: 0,
      current_attendee_index: 0,
      last_updated_at: new Date(),
    },
    quantity: 0,
    form_responses: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// collecting_quantity
// ---------------------------------------------------------------------------

describe("processBookingMessage: collecting_quantity", () => {
  const fields = [makeField()];

  it("rejects non-numeric input", () => {
    const update = processBookingMessage("abc", makeBooking(), makeEvent(), fields);
    expect(update.conversation_state).toBe("collecting_quantity");
    expect(update.quantity).toBe(0);
    expect(update.bot_reply).toMatch(/valid number/i);
  });

  it("rejects zero and negative numbers", () => {
    for (const input of ["0", "-2"]) {
      const update = processBookingMessage(input, makeBooking(), makeEvent(), fields);
      expect(update.bot_reply).toMatch(/valid number/i);
    }
  });

  it("accepts a valid quantity and asks for the first field", () => {
    const update = processBookingMessage("2", makeBooking(), makeEvent(), fields);
    expect(update.conversation_state).toBe("collecting_fields");
    expect(update.quantity).toBe(2);
    expect(update.bot_reply).toContain("Full Name");
    expect(update.bot_reply).toContain("attendee #1");
  });

  it("initializes per-attendee response objects for group bookings", () => {
    const update = processBookingMessage("3", makeBooking(), makeEvent(), fields);
    expect(update.form_responses).toEqual([{}, {}, {}]);
  });

  it("keeps a plain object for single bookings", () => {
    const update = processBookingMessage("1", makeBooking(), makeEvent(), fields);
    expect(update.form_responses).toEqual({});
  });

  it("rejects quantities above max_tickets_per_booking", () => {
    const update = processBookingMessage("6", makeBooking(), makeEvent(), fields);
    expect(update.conversation_state).toBe("collecting_quantity");
    expect(update.bot_reply).toContain("maximum of 5");
  });

  it("allows only 1 ticket when group booking is disabled", () => {
    const event = makeEvent({ allow_group_booking: false, max_tickets_per_booking: null });
    const rejected = processBookingMessage("2", makeBooking(), event, fields);
    expect(rejected.bot_reply).toMatch(/only allows booking 1/i);

    const accepted = processBookingMessage("1", makeBooking(), event, fields);
    expect(accepted.quantity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// collecting_fields
// ---------------------------------------------------------------------------

describe("processBookingMessage: collecting_fields", () => {
  const fields = [
    makeField({ field_key: "full_name", label: "Full Name" }),
    makeField({
      field_key: "email",
      label: "Email",
      validation_rule: "email_format",
      order_index: 1,
    }),
  ];

  it("validates email format and re-asks on failure", () => {
    const booking = makeBooking({
      quantity: 1,
      conversation_state: "collecting_fields",
      session_context: {
        current_field_index: 1,
        current_attendee_index: 0,
        last_updated_at: new Date(),
      },
      form_responses: { full_name: "Alice" },
    });

    const bad = processBookingMessage("not-an-email", booking, makeEvent(), fields);
    expect(bad.conversation_state).toBe("collecting_fields");
    expect(bad.bot_reply).toMatch(/valid email/i);
    expect(bad.form_responses).toEqual({ full_name: "Alice" });

    const good = processBookingMessage("alice@example.com", booking, makeEvent(), fields);
    expect(good.conversation_state).toBe("reviewing");
    expect(good.form_responses).toEqual({ full_name: "Alice", email: "alice@example.com" });
  });

  it("validates phone format", () => {
    const phoneFields = [
      makeField({ field_key: "phone", label: "Phone", validation_rule: "phone_format" }),
    ];
    const booking = makeBooking({ quantity: 1, conversation_state: "collecting_fields" });

    const bad = processBookingMessage("abc12", booking, makeEvent(), phoneFields);
    expect(bad.bot_reply).toMatch(/valid phone/i);

    const good = processBookingMessage("+919876543210", booking, makeEvent(), phoneFields);
    expect(good.conversation_state).toBe("reviewing");
  });

  it("advances to the next attendee after the last field of an attendee", () => {
    const booking = makeBooking({
      quantity: 2,
      conversation_state: "collecting_fields",
      session_context: {
        current_field_index: 1, // email: the last field for attendee 0
        current_attendee_index: 0,
        last_updated_at: new Date(),
      },
      form_responses: [{ full_name: "Alice" }, {}],
    });

    const update = processBookingMessage("a@x.com", booking, makeEvent(), fields);
    expect(update.conversation_state).toBe("collecting_fields");
    expect(update.session_context.current_attendee_index).toBe(1);
    expect(update.session_context.current_field_index).toBe(0);
    expect(update.bot_reply).toContain("attendee #2");
    expect(update.form_responses).toEqual([
      { full_name: "Alice", email: "a@x.com" },
      {},
    ]);
  });

  it("moves to reviewing after the last attendee completes the last field", () => {
    const booking = makeBooking({
      quantity: 2,
      conversation_state: "collecting_fields",
      session_context: {
        current_field_index: 1,
        current_attendee_index: 1,
        last_updated_at: new Date(),
      },
      form_responses: [{ full_name: "A", email: "a@x.com" }, { full_name: "B" }],
    });

    const update = processBookingMessage("b@x.com", booking, makeEvent(), fields);
    expect(update.conversation_state).toBe("reviewing");
    expect(update.bot_reply).toMatch(/correct/i);
  });

  it("rejects empty input for required fields", () => {
    const booking = makeBooking({ quantity: 1, conversation_state: "collecting_fields" });
    const update = processBookingMessage("", booking, makeEvent(), fields);
    expect(update.bot_reply).toMatch(/required/i);
  });
});

// ---------------------------------------------------------------------------
// reviewing
// ---------------------------------------------------------------------------

describe("processBookingMessage: reviewing", () => {
  const fields = [makeField()];

  function reviewingBooking(isPaid: boolean): Booking {
    return makeBooking({
      quantity: 1,
      conversation_state: "reviewing",
      form_responses: { full_name: "Alice" },
    });
  }

  it("confirms a free event on 'yes'", () => {
    const update = processBookingMessage("yes", reviewingBooking(false), makeEvent(), fields);
    expect(update.conversation_state).toBe("confirmed");
    expect(update.bot_reply).toMatch(/confirmed/i);
  });

  it("moves a paid event to awaiting_payment on 'yes'", () => {
    const event = makeEvent({ is_paid: true, price: 500 });
    const update = processBookingMessage("yes", reviewingBooking(true), event, fields);
    expect(update.conversation_state).toBe("awaiting_payment");
    expect(update.bot_reply).toMatch(/payment/i);
  });

  it.each(["yeah", "confirm", "correct", "ok", "sure", "yep"])(
    "accepts '%s' as affirmative",
    (word) => {
      const update = processBookingMessage(word, reviewingBooking(false), makeEvent(), fields);
      expect(update.conversation_state).toBe("confirmed");
    }
  );

  it.each(["no", "nope", "change", "edit", "wrong"])("accepts '%s' as negative", (word) => {
    const update = processBookingMessage(word, reviewingBooking(false), makeEvent(), fields);
    expect(update.conversation_state).toBe("reviewing");
    expect(update.bot_reply).toMatch(/coming soon/i);
  });

  it("re-asks on unrecognized input", () => {
    const update = processBookingMessage("maybe", reviewingBooking(false), makeEvent(), fields);
    expect(update.conversation_state).toBe("reviewing");
    expect(update.bot_reply).toMatch(/Yes/);
    expect(update.bot_reply).toMatch(/No/);
  });
});

// ---------------------------------------------------------------------------
// Unknown states / robustness
// ---------------------------------------------------------------------------

describe("processBookingMessage: robustness", () => {
  it("responds generically for unexpected conversation states", () => {
    const booking = makeBooking({ conversation_state: "confirmed" });
    const update = processBookingMessage("hello", booking, makeEvent(), []);
    expect(update.bot_reply).toMatch(/didn't quite catch that/i);
    expect(update.conversation_state).toBe("confirmed");
  });

  it("handles a missing session_context without crashing", () => {
    const booking = makeBooking({
      conversation_state: "processing_confirmation" as any,
      session_context: undefined,
    });
    const update = processBookingMessage("hello", booking, makeEvent(), []);
    expect(update.bot_reply).toMatch(/didn't quite catch that/i);
    expect(update.conversation_state).toBe("processing_confirmation");
  });
});
