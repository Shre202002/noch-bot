import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketPreview } from "./TicketPreview";
import { TICKET_TEMPLATES } from "@/lib/ticketTemplates";
import { emblemDataUrl } from "@/lib/ticketEmblems";

const baseEvent = {
  _id: "e1",
  name: "Pune Developer Summit",
  start_at: "2026-10-21T10:00:00.000Z",
  venue: "Hall 4",
  logo_url: null as string | null,
  form_fields: [],
};

const render = (templateId: string, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(TicketPreview, { event: { ...baseEvent, ...extra } as never, templateId }));

describe("TicketPreview logo", () => {
  for (const t of TICKET_TEMPLATES) {
    describe(t.name, () => {
      it("shows the chosen emblem when nothing was uploaded", () => {
        const url = emblemDataUrl("trophy", t.palette.text_color)!;
        const html = render(t.id, { logo_emblem: "trophy" });
        // The URL is escaped inside the attribute, so compare the decoded SVG's colour and the data URL prefix.
        expect(html).toContain("data:image/svg+xml");
        expect(html).toContain(encodeURIComponent(`stroke="${t.palette.text_color}"`).replace(/&/g, "&amp;"));
        expect(url).toBeTruthy();
      });

      it("shows an uploaded logo instead of the emblem", () => {
        const html = render(t.id, { logo_url: "https://img.example/logo.png", logo_emblem: "trophy" });
        expect(html).toContain("https://img.example/logo.png");
        expect(html).not.toContain("data:image/svg+xml");
      });

      it("shows no logo image when there is neither", () => {
        expect(render(t.id)).not.toContain("<img");
      });
    });
  }
});
