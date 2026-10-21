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

  it("colours the booking, pay and download buttons, their hover and the input focus from the chat bubble colour", () => {
    expect(source).toContain("var actionColor = theme.bubbleColor || theme.sendBtnColor;");
    expect(source).toContain(".nochbot-pay-link,.nochbot-action.is-primary{background:' + actionColor");
    expect(source).toContain("#nochbot-input:focus{border-color:' + actionColor");
    // No separate accent colour is used for styling any more.
    expect(source).not.toContain("theme.accentColor");
  });

  it("styles quick replies as buttons: a coloured outline, bold text, and a fill on hover", () => {
    expect(source).toContain(".nochbot-action{border:1.5px solid ' + actionColor + ';background:#fff");
    expect(source).toContain("font-weight:600;min-width:44px");
    expect(source).toContain(".nochbot-action:hover{background:' + actionColor + ';color:' + actionInk");
    // They no longer share the faint grey outline that message bubbles use.
    expect(source).not.toContain(".nochbot-action,.nochbot-pay-link{border:1px solid rgba(17,24,39,.12)");
  });

  it("locks sending while a reply types, with a Stop button that cuts it off", () => {
    expect(source).toContain("var STOP_ICON = ");
    expect(source).toContain("function stopTyping()");
    expect(source).toContain("if (typingMessage()) return stopTyping();");
    expect(source).toContain("send.disabled = state.loading;");
  });

  it("labels the ticket quantity choices with what they are", () => {
    expect(source).toContain("n === 1 ? '1 ticket' : n + ' tickets'");
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
