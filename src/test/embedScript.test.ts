import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const source = fs.readFileSync(path.join(process.cwd(), "public", "embed.js"), "utf8").replace(/^﻿/, "");

describe("public/embed.js", () => {
  it("is valid JavaScript", () => {
    expect(() => new vm.Script(source, { filename: "embed.js" })).not.toThrow();
  });

  it("shows the event-aware message beside the icon, with the help message as the fallback", () => {
    expect(source).toContain("state.teaser = data.teaser");
    expect(source).toContain("showTeaser(state.teaser || \"I'm here to help you.\")");
    expect(source).toContain("state.teaserEventId");
  });

  it("uses the chosen chat icon only from the image path the server worked out", () => {
    expect(source).toContain("theme.launcherIconUrl");
    expect(source).toContain("nochbot-launcher-img");
  });

  it("falls back to the robot if the chosen icon cannot load, without an inline handler", () => {
    expect(source).toMatch(/img\.addEventListener\('error'/);
    expect(source).not.toMatch(/onerror\s*=/i);
  });

  it("keeps the test-mode attributes used by the dashboard's test booking", () => {
    for (const attribute of ["data-test", "data-event-id", "data-open"]) expect(source).toContain(attribute);
  });
});
