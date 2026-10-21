import { describe, it, expect } from "vitest";
import { getNextState, BookingContext } from "@/lib/bookingStateMachine";

function ctx(partial: Partial<BookingContext>): BookingContext {
  return {
    field_count: 0,
    current_field_index: 0,
    current_attendee_index: 0,
    quantity: 1,
    ...partial,
  };
}

describe("getNextState", () => {
  describe("from collecting_quantity", () => {
    it("goes to collecting_fields when the event has form fields", () => {
      const next = getNextState("collecting_quantity", false, ctx({ field_count: 3 }));
      expect(next).toBe("collecting_fields");
    });

    it("goes straight to reviewing when there are no form fields", () => {
      const next = getNextState("collecting_quantity", false, ctx({ field_count: 0 }));
      expect(next).toBe("reviewing");
    });
  });

  describe("from collecting_fields", () => {
    it("stays in collecting_fields when there are more fields for this attendee", () => {
      const next = getNextState(
        "collecting_fields",
        false,
        ctx({ field_count: 3, current_field_index: 0, quantity: 2, current_attendee_index: 0 })
      );
      expect(next).toBe("collecting_fields");
    });

    it("stays in collecting_fields when moving to the next attendee", () => {
      const next = getNextState(
        "collecting_fields",
        false,
        ctx({ field_count: 2, current_field_index: 1, quantity: 3, current_attendee_index: 0 })
      );
      expect(next).toBe("collecting_fields");
    });

    it("moves to reviewing after the last field of the last attendee", () => {
      const next = getNextState(
        "collecting_fields",
        false,
        ctx({ field_count: 2, current_field_index: 1, quantity: 2, current_attendee_index: 1 })
      );
      expect(next).toBe("reviewing");
    });
  });

  describe("from reviewing", () => {
    it("goes to awaiting_payment for paid events", () => {
      const next = getNextState("reviewing", true, ctx({}));
      expect(next).toBe("awaiting_payment");
    });

    it("goes straight to confirmed for free events", () => {
      const next = getNextState("reviewing", false, ctx({}));
      expect(next).toBe("confirmed");
    });
  });

  it("returns the same state for unknown states", () => {
    const next = getNextState("processing_confirmation" as any, true, ctx({}));
    expect(next).toBe("processing_confirmation");
  });
});
