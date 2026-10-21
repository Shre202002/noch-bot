import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LAUNCHER_ICONS } from "@/lib/launcherIcons";
import { contrastRatio } from "@/lib/ticketTemplates";
import { ICON_TEMPLATES, mix, ORIGINAL_PALETTE, paletteFor, renderLauncherIcon } from "@/lib/launcherIconArt";

const PUBLIC = path.join(process.cwd(), "public");
const withFiles = LAUNCHER_ICONS.filter((i) => i.path);
const normalise = (svg: string) => svg.replace(/\r\n/g, "\n").replace(/^﻿/, "").trim();

// Themes a real organizer might have: the detected gold, and the awkward ends of the range.
const THEMES = { gold: "#F0C545", white: "#FFFFFF", black: "#000000", navy: "#0B1F4B", red: "#E53935", green: "#2ECC71", orange: "#FF5701" };

describe("templates", () => {
  it("has a template for every icon that has artwork, and nothing else", () => {
    expect(Object.keys(ICON_TEMPLATES).sort()).toEqual(withFiles.map((i) => i.id).sort());
  });

  for (const icon of withFiles) {
    it(`${icon.name}: the original palette gives back ${icon.path} exactly`, () => {
      const file = normalise(fs.readFileSync(path.join(PUBLIC, icon.path!.slice(1)), "utf8"));
      expect(
        normalise(renderLauncherIcon(icon.id, null)!),
        `public${icon.path} changed. Update ICON_TEMPLATES in src/lib/launcherIconArt.ts to match (swap its colours for the {{tokens}}).`
      ).toBe(file);
    });
  }
});

describe("renderLauncherIcon", () => {
  it("leaves no token behind for any icon or theme", () => {
    for (const icon of withFiles) {
      for (const color of Object.values(THEMES)) {
        expect(renderLauncherIcon(icon.id, color), `${icon.id} ${color}`).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  it("draws the icon in the theme colour", () => {
    // Most icons use the colour itself. The typing bubble (lines on a white disc) and the voice bars (a gradient of
    // lighter and darker shades) are covered by their own checks.
    for (const icon of withFiles.filter((i) => i.id !== "typing" && i.id !== "voice")) {
      const svg = renderLauncherIcon(icon.id, "#F0C545")!;
      expect(svg.toUpperCase(), icon.id).toContain("#F0C545");
    }
  });

  it("builds the voice bars' gradient from lighter and darker shades of the colour", () => {
    const p = paletteFor("#F0C545");
    const voice = renderLauncherIcon("voice", "#F0C545")!.toUpperCase();
    expect(voice).toContain(p.light);
    expect(voice).toContain(p.dark);
    expect(p.light).not.toBe(p.dark);
  });

  it("darkens the colour where it is drawn on white, so a light theme colour stays visible", () => {
    // The typing bubble is coloured lines on a white disc. Gold lines on white would almost vanish.
    const typing = renderLauncherIcon("typing", "#F0C545")!;
    const p = paletteFor("#F0C545");
    expect(typing.toUpperCase()).toContain(p.onWhite);
    expect(p.onWhite).not.toBe("#F0C545");
    expect(contrastRatio(p.onWhite, "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });

  it("no longer contains the original orange once themed", () => {
    for (const icon of withFiles) {
      const svg = renderLauncherIcon(icon.id, "#2E7D32")!.toUpperCase();
      for (const orange of ["#FF5701", "#FF7A33", "#FFB15C", "#FFA066", "#E64A00", "#B83D00", "#C2185B"]) {
        expect(svg, `${icon.id} ${orange}`).not.toContain(orange);
      }
    }
  });

  it("falls back to the original artwork for a missing or invalid colour", () => {
    const original = renderLauncherIcon("orb", null);
    for (const bad of [undefined, "", "red", "#12", 'red" onload="x', "javascript:1", "#ggg"]) {
      expect(renderLauncherIcon("orb", bad as string | undefined), String(bad)).toBe(original);
    }
  });

  it("accepts a colour without the # or in short form", () => {
    expect(renderLauncherIcon("orb", "F0C545")).toBe(renderLauncherIcon("orb", "#f0c545"));
    expect(renderLauncherIcon("orb", "#fc0")).toBe(renderLauncherIcon("orb", "#FFCC00"));
  });

  it("returns null for an unknown icon, including prototype names", () => {
    for (const id of ["nope", "", "__proto__", "constructor", "toString", "default"]) expect(renderLauncherIcon(id, "#F0C545"), id).toBeNull();
  });

  it("never lets anything but a six-digit colour into the markup", () => {
    const svg = renderLauncherIcon("typing", '#F0C545"><script>alert(1)</script>');
    expect(svg).toBe(renderLauncherIcon("typing", null));
    for (const icon of withFiles) {
      const themed = renderLauncherIcon(icon.id, "#F0C545")!;
      expect(themed).not.toMatch(/<script|\son[a-z]+\s*=|javascript:|<foreignObject|<image\b/i);
      expect(themed.startsWith("<svg")).toBe(true);
      expect(themed).toMatch(/viewBox="[^"]+"/);
    }
  });
});

describe("paletteFor", () => {
  it("uses the original palette when there is no colour", () => {
    expect(paletteFor(null)).toBe(ORIGINAL_PALETTE);
    expect(paletteFor("nonsense")).toBe(ORIGINAL_PALETTE);
  });

  it("puts a dark glyph on a light theme colour and a white glyph on a dark one", () => {
    expect(paletteFor(THEMES.gold).glyph.toUpperCase()).not.toBe("#FFFFFF");
    expect(paletteFor(THEMES.white).glyph.toUpperCase()).not.toBe("#FFFFFF");
    expect(paletteFor(THEMES.navy).glyph.toUpperCase()).toBe("#FFFFFF");
    expect(paletteFor(THEMES.black).glyph.toUpperCase()).toBe("#FFFFFF");
  });

  for (const [name, color] of Object.entries(THEMES)) {
    describe(name, () => {
      const p = paletteFor(color);

      it("keeps glyphs readable on the main colour", () => {
        expect(contrastRatio(p.glyph.length === 4 ? "#FFFFFF" : p.glyph, p.base)).toBeGreaterThanOrEqual(2.5);
      });

      it("keeps the face readable on the main colour", () => {
        expect(contrastRatio(p.face, p.base)).toBeGreaterThanOrEqual(3);
      });

      it("keeps the mark readable on the glyph it is drawn over", () => {
        expect(contrastRatio(p.mark, p.glyph)).toBeGreaterThanOrEqual(3);
      });

      it("keeps the main colour readable on white where it is drawn there", () => {
        expect(contrastRatio(p.onWhite, "#FFFFFF")).toBeGreaterThanOrEqual(3);
      });

      it("only produces six-digit colours", () => {
        for (const value of Object.values(p)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
      });
    });
  }
});

describe("mix", () => {
  it("returns the colour itself at 0 and the other at 1", () => {
    expect(mix("#336699", "#FFFFFF", 0)).toBe("#336699");
    expect(mix("#336699", "#FFFFFF", 1)).toBe("#FFFFFF");
  });

  it("blends halfway", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});
