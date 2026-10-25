import { describe, expect, it } from "vitest";
import { attendeesOf, ticketAttendeeName } from "./ticketLinks";

describe("attendeesOf", () => {
  it("reads widget answers tagged per attendee", () => {
    const attendees = attendeesOf({
      attendee: {
        answers: [
          { label: "Full name", validation_rule: "name_format", value: "Asha", attendee: 1 },
          { label: "Full name", validation_rule: "name_format", value: "Ravi", attendee: 2 },
          { label: "Email", validation_rule: "email_format", value: "asha@x.com", attendee: 1 },
          { label: "Email", validation_rule: "email_format", value: "ravi@x.com", attendee: 2 },
        ],
      },
    });
    expect(attendees).toEqual([
      { name: "Asha", email: "asha@x.com" },
      { name: "Ravi", email: "ravi@x.com" },
    ]);
  });

  it("reads chat-bot form_responses, one object per attendee", () => {
    const attendees = attendeesOf({ form_responses: [{ full_name: "A", email: "a@x.com" }, { full_name: "B" }] });
    expect(attendees).toEqual([{ name: "A", email: "a@x.com" }, { name: "B", email: null }]);
  });

  it("names every ticket of a single-attendee booking, but never borrows a name in a group", () => {
    expect(ticketAttendeeName([{ name: "Solo", email: null }], 3)).toBe("Solo");
    expect(ticketAttendeeName([{ name: "A", email: null }, { name: null, email: null }], 1)).toBeNull();
  });
});
