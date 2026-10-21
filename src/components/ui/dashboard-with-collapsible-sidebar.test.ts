import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) =>
    createElement("a", { href, ...rest }, children),
}));

import { NavGroups, NoctaDashboard } from "./dashboard-with-collapsible-sidebar";

const GROUP_LABELS = ["General", "Assistant", "Events", "Insights"];

const ITEM_TITLES = [
  "Dashboard",
  "Chat History",
  "Bot Config",
  "Embed Codes",
  "PDF Documents",
  "All Events",
  "New Event",
  "Website Analytics",
  "PDF Analytics",
];

const ITEM_HREFS = [
  "/dashboard",
  "/dashboard/history",
  "/dashboard/configure",
  "/dashboard/embed",
  "/dashboard/pdf",
  "/dashboard/events",
  "/dashboard/events/new",
  "/dashboard/analytics",
  "/dashboard/pdf-analytics",
];

const renderGroups = (pathname: string, open: boolean) =>
  renderToStaticMarkup(createElement(NavGroups, { pathname, open }));

const activeLinks = (html: string) =>
  [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);

describe("grouped dashboard sidebar", () => {
  it("labels every group and lists every destination when expanded", () => {
    const html = renderGroups("/dashboard/analytics", true);

    for (const label of GROUP_LABELS) {
      expect(html).toContain(`>${label}<`);
    }
    for (const title of ITEM_TITLES) {
      expect(html).toContain(title);
    }
    for (const href of ITEM_HREFS) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("keeps every destination reachable as an icon link when collapsed to the rail", () => {
    const html = renderGroups("/dashboard", false);

    // The rail shows dividers instead of group headers, but never loses an item.
    for (const label of GROUP_LABELS) {
      expect(html).not.toContain(`>${label}<`);
    }
    for (const href of ITEM_HREFS) {
      expect(html).toContain(`href="${href}"`);
    }
    // Labels move to title attributes so icons stay identifiable.
    expect(html).toContain('title="Bot Config"');
    expect(html).toContain('title="PDF Analytics"');
  });

  it("marks exactly one destination active for the current route", () => {
    const analytics = renderGroups("/dashboard/analytics", true);
    expect(activeLinks(analytics)).toHaveLength(1);
    expect(activeLinks(analytics)[0]).toContain('href="/dashboard/analytics"');

    const pdfAnalytics = renderGroups("/dashboard/pdf-analytics", true);
    expect(activeLinks(pdfAnalytics)).toHaveLength(1);
    // /dashboard/pdf-analytics must not select the PDF Documents entry.
    expect(activeLinks(pdfAnalytics)[0]).toContain('href="/dashboard/pdf-analytics"');

    const eventDetail = renderGroups("/dashboard/events/abc", true);
    expect(activeLinks(eventDetail)).toHaveLength(1);
    expect(activeLinks(eventDetail)[0]).toContain('href="/dashboard/events"');
  });

  it("mounts the grouped navigation inside the dashboard shell", () => {
    const html = renderToStaticMarkup(
      createElement(NoctaDashboard, { user: { email: "a@b.com", plan: "Free" } }, "shell-content")
    );

    expect(html).toContain("shell-content");
    for (const label of GROUP_LABELS) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html).toContain("Logout");
  });
});
