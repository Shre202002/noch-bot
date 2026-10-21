import { describe, it, expect } from "vitest";
import {
  buildLogoUpdates,
  EMBLEM_GROUPS,
  emblemDataUrl,
  emblemSvg,
  isKnownEmblem,
  resolveTicketLogo,
  TICKET_EMBLEMS,
} from "@/lib/ticketEmblems";

const palette = { text_color: "#0f172a" };

describe("TICKET_EMBLEMS", () => {
  it("has unique ids and names, each in a known group", () => {
    expect(new Set(TICKET_EMBLEMS.map((e) => e.id)).size).toBe(TICKET_EMBLEMS.length);
    expect(new Set(TICKET_EMBLEMS.map((e) => e.name)).size).toBe(TICKET_EMBLEMS.length);
    for (const e of TICKET_EMBLEMS) expect(EMBLEM_GROUPS).toContain(e.group);
  });

  it("offers digital-ticket emblems and event-type emblems", () => {
    for (const group of EMBLEM_GROUPS) expect(TICKET_EMBLEMS.filter((e) => e.group === group).length).toBeGreaterThanOrEqual(6);
    expect(TICKET_EMBLEMS.map((e) => e.id)).toEqual(expect.arrayContaining(["ticket", "eticket", "qr", "scan", "verified", "wallet"]));
  });

  it("gives every emblem drawable path data without markup in it", () => {
    for (const e of TICKET_EMBLEMS) {
      expect(e.paths.length, e.id).toBeGreaterThan(0);
      for (const d of e.paths) {
        expect(d, e.id).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9\s.,-]+$/);
      }
    }
  });
});

describe("emblem rendering", () => {
  it("builds an SVG in the given colour", () => {
    const svg = emblemSvg("ticket", "#22d3ee")!;
    expect(svg).toContain('stroke="#22d3ee"');
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
  });

  it("ignores a colour that is not a plain #rrggbb, so it cannot inject markup", () => {
    for (const bad of ['red" onload="x', "#fff", "url(#x)", '"><script>alert(1)</script>', ""]) {
      const svg = emblemSvg("star", bad)!;
      expect(svg).toContain('stroke="#111111"');
      expect(svg).not.toContain("script");
      expect(svg).not.toContain("onload");
    }
  });

  it("returns null for an unknown emblem", () => {
    expect(emblemSvg("nope", "#000000")).toBeNull();
    expect(emblemDataUrl("nope", "#000000")).toBeNull();
  });

  it("produces an encoded SVG data URL that an image element can show", () => {
    const url = emblemDataUrl("music", "#336699")!;
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    const decoded = decodeURIComponent(url.split(",").slice(1).join(","));
    expect(decoded).toContain("#336699");
    expect(url).not.toContain("<");
    expect(url).not.toContain('"');
  });
});

describe("isKnownEmblem", () => {
  it("accepts only listed ids", () => {
    for (const e of TICKET_EMBLEMS) expect(isKnownEmblem(e.id)).toBe(true);
    for (const bad of ["", "nope", "__proto__", "constructor", 3, null, undefined]) expect(isKnownEmblem(bad)).toBe(false);
  });
});

describe("resolveTicketLogo", () => {
  it("shows nothing when there is neither an upload nor an emblem", () => {
    expect(resolveTicketLogo({}, palette)).toBeNull();
  });

  it("uses the emblem, in the ticket's text colour, when nothing was uploaded", () => {
    const url = resolveTicketLogo({ logo_emblem: "trophy" }, palette)!;
    expect(decodeURIComponent(url)).toContain('stroke="#0f172a"');
  });

  it("prefers an uploaded image over an emblem", () => {
    expect(resolveTicketLogo({ logo_url: "https://img/x.png", logo_emblem: "trophy" }, palette)).toBe("https://img/x.png");
  });

  it("uses the background-removed image only when that is switched on and available", () => {
    const base = { logo_url: "https://img/x.png", bg_removed_logo_url: "https://img/x-nobg.png" };
    expect(resolveTicketLogo({ ...base, remove_background: true }, palette)).toBe("https://img/x-nobg.png");
    expect(resolveTicketLogo({ ...base, remove_background: false }, palette)).toBe("https://img/x.png");
    expect(resolveTicketLogo({ logo_url: "https://img/x.png", remove_background: true }, palette)).toBe("https://img/x.png");
  });

  it("falls back to nothing for an emblem id that no longer exists", () => {
    expect(resolveTicketLogo({ logo_emblem: "retired" }, palette)).toBeNull();
  });
});

describe("buildLogoUpdates", () => {
  it("does not touch the uploaded logo when only background removal changes", () => {
    expect(buildLogoUpdates({ remove_background: true })).toEqual({ ok: true, updates: { remove_background: true } });
    expect(buildLogoUpdates({ remove_background: false })).toEqual({ ok: true, updates: { remove_background: false } });
  });

  it("sets only the emblem when an emblem is chosen", () => {
    expect(buildLogoUpdates({ logo_emblem: "music" })).toEqual({ ok: true, updates: { logo_emblem: "music" } });
  });

  it("clears the emblem with null or an empty string", () => {
    expect(buildLogoUpdates({ logo_emblem: null })).toEqual({ ok: true, updates: { logo_emblem: null } });
    expect(buildLogoUpdates({ logo_emblem: "" })).toEqual({ ok: true, updates: { logo_emblem: null } });
  });

  it("rejects an unknown emblem", () => {
    expect(buildLogoUpdates({ logo_emblem: "nope" })).toEqual({ ok: false, error: "Unknown emblem" });
    expect(buildLogoUpdates({ logo_emblem: 5 })).toEqual({ ok: false, error: "Unknown emblem" });
  });

  it("still saves a full upload", () => {
    expect(
      buildLogoUpdates({ logo_url: "https://img/x.png", logo_file_id: "f1", remove_background: true, bg_removed_logo_url: "https://img/x-nobg.png" })
    ).toEqual({
      ok: true,
      updates: { logo_url: "https://img/x.png", logo_file_id: "f1", remove_background: true, bg_removed_logo_url: "https://img/x-nobg.png" },
    });
  });

  it("clears the upload fields when they are sent as null", () => {
    expect(buildLogoUpdates({ logo_url: null, logo_file_id: null, bg_removed_logo_url: null })).toEqual({
      ok: true,
      updates: { logo_url: null, logo_file_id: null, bg_removed_logo_url: null },
    });
  });

  it("ignores keys it does not know and non-object bodies", () => {
    expect(buildLogoUpdates({ role: "admin", logo_emblem: "star" })).toEqual({ ok: true, updates: { logo_emblem: "star" } });
    for (const bad of [null, undefined, "x", 5, []]) expect(buildLogoUpdates(bad)).toEqual({ ok: true, updates: {} });
  });
});
