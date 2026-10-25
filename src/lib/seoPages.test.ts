import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { SEO_PAGES } from "@/lib/seoPages";
import sitemap from "@/app/sitemap";

// Pages that target competitive searches carry long-form guides.
const DEEP_PAGES = [
  "free-ai-chatbot-for-website",
  "chatbot-for-small-business",
  "how-to-add-chatbot-to-website",
  "event-booking-chatbot",
  "best-free-ai-chatbot-for-websites",
];

describe("SEO landing pages", () => {
  it("has unique slugs, titles, descriptions and primary keywords", () => {
    for (const field of ["slug", "title", "description", "primaryKeyword", "h1"] as const) {
      const values = SEO_PAGES.map((p) => p[field]);
      expect(new Set(values).size, field).toBe(values.length);
    }
  });

  it("keeps titles and descriptions inside search result limits", () => {
    for (const p of SEO_PAGES) {
      // The root layout appends " | NochBot" (10 characters).
      expect(p.title.length + 10, `${p.slug} title`).toBeLessThanOrEqual(60);
      expect(p.description.length, `${p.slug} description`).toBeGreaterThanOrEqual(110);
      expect(p.description.length, `${p.slug} description`).toBeLessThanOrEqual(160);
    }
  });

  it("puts the primary keyword in the title or H1 and the slug is URL-safe", () => {
    for (const p of SEO_PAGES) {
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const head = `${p.title} ${p.h1}`.toLowerCase();
      const words = p.primaryKeyword.toLowerCase().split(" ").filter((w) => w.length > 2);
      expect(words.some((w) => head.includes(w)), p.slug).toBe(true);
    }
  });

  it("has enough substance for each page", () => {
    for (const p of SEO_PAGES) {
      // Everything the template renders as body copy.
      const text = [
        p.intro,
        ...p.features.flatMap((f) => [f.title, f.body]),
        ...p.steps.flatMap((s) => [s.title, s.body]),
        ...p.useCases.flatMap((u) => [u.title, u.body]),
        ...p.limits,
        ...p.faqs.flatMap((f) => [f.q, f.a]),
        ...(p.guide ?? []).flatMap((g) => [g.title, ...g.paragraphs]),
      ].join(" ");
      const floor = DEEP_PAGES.includes(p.slug) ? 650 : 300;
      expect(text.split(/\s+/).length, p.slug).toBeGreaterThanOrEqual(floor);
      expect(p.faqs.length, p.slug).toBeGreaterThanOrEqual(4);
      expect(p.features.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.limits.length, p.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("links only to pages that exist, and every page has a route file", () => {
    const slugs = new Set(SEO_PAGES.map((p) => p.slug));
    for (const p of SEO_PAGES) {
      for (const r of p.related) expect(slugs.has(r), `${p.slug} -> ${r}`).toBe(true);
      expect(r_exists(p.slug), `route for ${p.slug}`).toBe(true);
    }
  });

  it("lists every page in the sitemap", () => {
    const urls = sitemap().map((s) => s.url);
    for (const p of SEO_PAGES) expect(urls).toContain(`https://nochbot.space/${p.slug}`);
  });

  it("lists only public pages, never signed-in areas", () => {
    for (const { url } of sitemap()) {
      expect(url, url).not.toMatch(/\/(dashboard|admin|api|bot|scan)(\/|$)/);
    }
  });

  it("does not promise things the product does not do", () => {
    const all = JSON.stringify(SEO_PAGES).toLowerCase();
    // Live syncing and WhatsApp may only appear in sentences that say they are not offered.
    for (const sentence of all.split(/(?<=[.!?])\s+/)) {
      if (/live[- ]sync|syncs? live|whatsapp/.test(sentence)) {
        expect(sentence, sentence).toMatch(/\bnot\b|n't|\bno\b/);
      }
    }
    expect(all).not.toMatch(/\b\d{2,3}%\b/); // no invented statistics
    expect(all).not.toMatch(/testimonial|trusted by|\d+\+ (customers|businesses)/);
  });
});

function r_exists(slug: string): boolean {
  return existsSync(join(process.cwd(), "src", "app", slug, "page.tsx"));
}
