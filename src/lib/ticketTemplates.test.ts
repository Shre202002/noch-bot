import { describe, it, expect } from "vitest";
import {
  contrastRatio,
  FACE_TEMPLATE_IDS,
  isFaceTemplate,
  isKnownTemplate,
  TICKET_TEMPLATE_DEFAULT_PALETTES,
  TICKET_TEMPLATES,
} from "@/lib/ticketTemplates";

const HEX = /^#([0-9A-Fa-f]{6})$/;

describe("TICKET_TEMPLATES", () => {
  it("has nine designs, the first four being the originals", () => {
    expect(TICKET_TEMPLATES).toHaveLength(9);
    expect(TICKET_TEMPLATES.slice(0, 4).map((t) => t.id)).toEqual(["modern", "minimal", "dark", "classic"]);
  });

  it("has unique ids and names", () => {
    expect(new Set(TICKET_TEMPLATES.map((t) => t.id)).size).toBe(TICKET_TEMPLATES.length);
    expect(new Set(TICKET_TEMPLATES.map((t) => t.name)).size).toBe(TICKET_TEMPLATES.length);
  });

  it("uses only colours the ticket-design API accepts", () => {
    for (const t of TICKET_TEMPLATES) {
      for (const [key, value] of Object.entries(t.palette)) {
        expect(value, `${t.id}.${key}`).toMatch(HEX);
      }
    }
  });

  it("keeps the main text readable on every default background", () => {
    for (const t of TICKET_TEMPLATES) {
      expect(contrastRatio(t.palette.text_color, t.palette.background_color), t.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps text readable at the light end of the sunset gradient", () => {
    const sunset = TICKET_TEMPLATES.find((t) => t.id === "sunset")!;
    expect(contrastRatio(sunset.palette.text_color, sunset.palette.accent_color)).toBeGreaterThanOrEqual(3);
  });

  it("describes each design for the picker", () => {
    for (const t of TICKET_TEMPLATES) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.thumb).toBeTruthy();
    }
  });

  it("exposes a default palette per id, matching the list", () => {
    for (const t of TICKET_TEMPLATES) expect(TICKET_TEMPLATE_DEFAULT_PALETTES[t.id]).toEqual(t.palette);
  });
});

describe("template ids", () => {
  it("knows every listed design and nothing else", () => {
    for (const t of TICKET_TEMPLATES) expect(isKnownTemplate(t.id)).toBe(true);
    for (const bad of ["default", "nope", "", null, undefined, 3, "__proto__"]) expect(isKnownTemplate(bad)).toBe(false);
  });

  it("routes the five new designs to the shared face renderer and leaves the originals alone", () => {
    expect([...FACE_TEMPLATE_IDS].sort()).toEqual(["badge", "festival", "neon", "receipt", "sunset"]);
    for (const id of FACE_TEMPLATE_IDS) expect(isKnownTemplate(id)).toBe(true);
    for (const id of ["modern", "minimal", "dark", "classic"]) expect(isFaceTemplate(id)).toBe(false);
  });

  it("marks only the new designs as new", () => {
    expect(TICKET_TEMPLATES.filter((t) => t.isNew).map((t) => t.id).sort()).toEqual([...FACE_TEMPLATE_IDS].sort());
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for identical colours", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("#111111", "#facc15")).toBeCloseTo(contrastRatio("#facc15", "#111111"), 10);
  });
});
