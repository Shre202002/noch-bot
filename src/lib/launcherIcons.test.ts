import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LAUNCHER_ICON, isKnownLauncherIcon, LAUNCHER_ICONS, launcherIconPath, launcherIconUrl } from "@/lib/launcherIcons";

const PUBLIC = path.join(process.cwd(), "public");
const files = LAUNCHER_ICONS.filter((i) => i.path);

describe("LAUNCHER_ICONS", () => {
  it("has unique ids, names and files", () => {
    expect(new Set(LAUNCHER_ICONS.map((i) => i.id)).size).toBe(LAUNCHER_ICONS.length);
    expect(new Set(LAUNCHER_ICONS.map((i) => i.name)).size).toBe(LAUNCHER_ICONS.length);
    expect(new Set(files.map((i) => i.path)).size).toBe(files.length);
  });

  it("starts with the built-in robot, which has no file", () => {
    expect(LAUNCHER_ICONS[0]).toMatchObject({ id: DEFAULT_LAUNCHER_ICON, path: null });
  });

  it("offers the six icons from public/, with the duplicate file listed only once", () => {
    expect(files).toHaveLength(6);
    const paths = files.map((i) => i.path);
    expect(paths).toContain("/launcher-sparkles.svg");
    expect(paths).not.toContain("/chat-icon-3.svg");
  });

  for (const icon of files) {
    describe(icon.name, () => {
      const file = path.join(PUBLIC, icon.path!.slice(1));

      it("exists in public/", () => {
        expect(fs.existsSync(file)).toBe(true);
      });

      it("is a plain SVG with a viewBox", () => {
        const svg = fs.readFileSync(file, "utf8");
        expect(svg.trimStart().startsWith("<svg")).toBe(true);
        expect(svg).toMatch(/viewBox="[^"]+"/);
      });

      it("is safe to serve to other websites: no scripts, handlers or outside references", () => {
        const svg = fs.readFileSync(file, "utf8");
        expect(svg).not.toMatch(/<script/i);
        expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
        expect(svg).not.toMatch(/javascript:/i);
        expect(svg).not.toMatch(/<foreignObject/i);
        expect(svg).not.toMatch(/<image\b/i);
        // The only URL allowed is the SVG namespace itself.
        const urls = svg.match(/https?:\/\/[^"'\s)]+/g) ?? [];
        expect(urls.filter((u) => u !== "http://www.w3.org/2000/svg")).toEqual([]);
      });

      it("is small enough to load instantly", () => {
        expect(fs.statSync(file).size).toBeLessThan(5_000);
      });
    });
  }
});

describe("isKnownLauncherIcon", () => {
  it("accepts only listed ids", () => {
    for (const icon of LAUNCHER_ICONS) expect(isKnownLauncherIcon(icon.id)).toBe(true);
    for (const bad of ["", "nope", "__proto__", "constructor", "toString", 3, null, undefined, {}]) {
      expect(isKnownLauncherIcon(bad), String(bad)).toBe(false);
    }
  });
});

describe("launcherIconPath", () => {
  it("returns the file for a listed icon", () => {
    expect(launcherIconPath("smile")).toBe("/chat-icon-5.svg");
    expect(launcherIconPath("sparkles")).toBe("/launcher-sparkles.svg");
  });

  it("is null for the robot, an unknown id, or nothing", () => {
    expect(launcherIconPath(DEFAULT_LAUNCHER_ICON)).toBeNull();
    for (const bad of ["nope", "../../etc/passwd", "__proto__", undefined, null, 5]) expect(launcherIconPath(bad)).toBeNull();
  });
});

describe("launcherIconUrl", () => {
  it("points at the themed endpoint with the colour as six digits", () => {
    expect(launcherIconUrl("smile", "#F0C545")).toBe("/api/launcher-icon/smile?color=F0C545");
    expect(launcherIconUrl("orb", "f0c545")).toBe("/api/launcher-icon/orb?color=F0C545");
    expect(launcherIconUrl("voice", "#fc0")).toBe("/api/launcher-icon/voice?color=FFCC00");
  });

  it("has no colour part for a missing or invalid colour", () => {
    for (const bad of [undefined, null, "", "red", "#12", 'x"><script>']) expect(launcherIconUrl("orb", bad), String(bad)).toBe("/api/launcher-icon/orb");
  });

  it("is null for the robot, an unknown id, or anything that is not an id", () => {
    for (const id of [DEFAULT_LAUNCHER_ICON, "nope", "../x", "__proto__", 4, null, undefined]) expect(launcherIconUrl(id, "#F0C545"), String(id)).toBeNull();
  });
});
