import { describe, it, expect } from "vitest";
import { describeMissing, eventReadiness, isTicketDesignConfirmed } from "@/lib/eventReadiness";

const base = { name: "Meetup", description: "Come along", capacity: 50, is_paid: false, ticket_template_id: "default" };

describe("isTicketDesignConfirmed", () => {
  it("is not confirmed for a new event that still has the default template", () => {
    expect(isTicketDesignConfirmed({ ticket_template_id: "default" })).toBe(false);
    expect(isTicketDesignConfirmed({})).toBe(false);
  });

  it("is confirmed once the design was saved", () => {
    expect(isTicketDesignConfirmed({ ticket_template_id: "default", ticket_design_confirmed_at: new Date() })).toBe(true);
    expect(isTicketDesignConfirmed({ ticket_design_confirmed_at: "2026-10-21T00:00:00.000Z" })).toBe(true);
  });

  it("treats older events with a custom template or palette as confirmed", () => {
    expect(isTicketDesignConfirmed({ ticket_template_id: "dark" })).toBe(true);
    expect(isTicketDesignConfirmed({ ticket_template_id: "default", ticket_color_palette: { accent_color: "#36f4a4" } })).toBe(true);
  });

  it("ignores an empty palette", () => {
    expect(isTicketDesignConfirmed({ ticket_template_id: "default", ticket_color_palette: {} })).toBe(false);
  });
});

describe("eventReadiness", () => {
  it("lists the ticket design as missing for a fresh free event", () => {
    const r = eventReadiness(base, { fieldCount: 2, gatewayActive: false });
    expect(r.complete).toBe(false);
    expect(r.missing.map((s) => s.id)).toEqual(["design"]);
    expect(r.missing[0].tab).toBe("ticket");
  });

  it("is complete for a free event with fields and a saved design", () => {
    const r = eventReadiness({ ...base, ticket_design_confirmed_at: new Date() }, { fieldCount: 1, gatewayActive: false });
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("has no payment step for a free event, even without a gateway", () => {
    const r = eventReadiness({ ...base, ticket_design_confirmed_at: new Date() }, { fieldCount: 1, gatewayActive: false });
    expect(r.steps.map((s) => s.id)).toEqual(["details", "fields", "design"]);
  });

  it("requires an active gateway for a paid event", () => {
    const paid = { ...base, is_paid: true, ticket_design_confirmed_at: new Date() };
    const without = eventReadiness(paid, { fieldCount: 1, gatewayActive: false });
    expect(without.complete).toBe(false);
    expect(without.missing.map((s) => s.id)).toEqual(["payments"]);
    expect(without.missing[0].tab).toBe("gateway");
    expect(eventReadiness(paid, { fieldCount: 1, gatewayActive: true }).complete).toBe(true);
  });

  it("reports every missing step together, in order", () => {
    const r = eventReadiness({ ...base, is_paid: true, description: "  " }, { fieldCount: 0, gatewayActive: false });
    expect(r.missing.map((s) => s.id)).toEqual(["details", "fields", "design", "payments"]);
  });

  it("needs a name, a description and a capacity above zero", () => {
    const ctx = { fieldCount: 1, gatewayActive: false };
    const confirmed = { ticket_design_confirmed_at: new Date() };
    for (const broken of [{ name: "" }, { description: "" }, { capacity: 0 }, { capacity: null }]) {
      expect(eventReadiness({ ...base, ...confirmed, ...broken }, ctx).complete).toBe(false);
    }
  });
});

describe("describeMissing", () => {
  it("reads naturally for one, two and three items", () => {
    expect(describeMissing([{ label: "Ticket design" }])).toBe("Ticket design");
    expect(describeMissing([{ label: "Ticket design" }, { label: "Payments" }])).toBe("Ticket design and Payments");
    expect(describeMissing([{ label: "A" }, { label: "B" }, { label: "C" }])).toBe("A, B and C");
    expect(describeMissing([])).toBe("");
  });
});
