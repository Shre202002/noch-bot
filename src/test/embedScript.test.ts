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

  it("greets with one message that includes the live event, instead of two", () => {
    expect(source).toContain("' live. You can book your tickets right here in the chat.'");
    expect(source).not.toContain("You can also book tickets for");
    // One addMessage carries both the welcome and the booking button.
    expect(source).toMatch(/addMessage\('assistant', text \+ '\\n\\n' \+ names/);
    expect(source).toMatch(/\(open\.length === 1 \? ' is' : ' are'\)/);
  });

  it("colours the booking, pay and download buttons and the input focus from the Send button colour", () => {
    expect(source).toContain("var actionColor = theme.sendBtnColor || theme.accentColor;");
    expect(source).toContain(".nochbot-pay-link,.nochbot-action.is-primary{background:' + actionColor");
    expect(source).toContain("#nochbot-input:focus{border-color:' + actionColor");
    expect(source).not.toMatch(/background:' \+ theme\.accentColor/);
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
