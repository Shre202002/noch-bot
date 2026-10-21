import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketFace, type TicketFaceProps } from "./TicketFace";
import { FACE_TEMPLATE_IDS, TICKET_TEMPLATE_DEFAULT_PALETTES } from "@/lib/ticketTemplates";

const render = (props: Partial<TicketFaceProps> & Pick<TicketFaceProps, "templateId">) =>
  renderToStaticMarkup(
    createElement(TicketFace, {
      palette: TICKET_TEMPLATE_DEFAULT_PALETTES[props.templateId],
      eventName: "Pune Developer Summit",
      dateText: "Wed, Oct 21, 2026",
      venue: "Hall 4, Tech Hub",
      attendeeName: "Asha Rao",
      code: "K7M2PQ9X",
      ticketLabel: "Ticket 2 of 3",
      ...props,
    })
  );

describe("TicketFace", () => {
  for (const templateId of FACE_TEMPLATE_IDS) {
    describe(templateId, () => {
      it("shows the event, attendee, date, venue, ticket label and a QR code", () => {
        const html = render({ templateId });
        for (const text of ["Pune Developer Summit", "Asha Rao", "Wed, Oct 21, 2026", "Hall 4, Tech Hub", "Ticket 2 of 3", "K7M2PQ9X"]) {
          expect(html, text).toContain(text);
        }
        expect(html).toContain("<svg");
      });

      it("uses the organizer's palette colours", () => {
        const html = render({ templateId, palette: { ...TICKET_TEMPLATE_DEFAULT_PALETTES[templateId], background_color: "#123456", accent_color: "#abcdef" } });
        expect(html.toLowerCase()).toMatch(/#123456|rgb\(18, 52, 86\)/);
      });

      it("falls back to a placeholder when the venue is missing", () => {
        const html = render({ templateId, venue: null });
        expect(html).toMatch(/To be announced|TBA/);
      });

      it("shows the logo only when there is one", () => {
        expect(render({ templateId, logoUrl: "https://img.example/logo.png" })).toContain("https://img.example/logo.png");
        expect(render({ templateId })).not.toContain("<img");
      });

      it("escapes markup in attendee and event names", () => {
        const html = render({ templateId, attendeeName: "<script>alert(1)</script>", eventName: "<b>Hi</b>" });
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<b>Hi</b>");
      });
    });
  }

  it("lists extra attendee answers on the badge and receipt designs", () => {
    const details = [{ label: "Company", value: "Acme Labs" }];
    expect(render({ templateId: "badge", details })).toContain("Acme Labs");
    expect(render({ templateId: "receipt", details })).toContain("Acme Labs");
  });
});
