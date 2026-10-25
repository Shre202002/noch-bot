import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import sitemap from "@/app/sitemap";
import { allEntries, KEYWORD_MAP, TOOLS, HUBS, spokesOf } from "./siteMap";
import { COMPETITORS, alternativesDescription, alternativesTitle, compareDescription, compareTitle } from "./compare";
import { POSTS } from "./posts";
import { INDUSTRIES } from "./industries";
import { CASE_STUDIES } from "./caseStudies";
import { recommendPlan, supportCostSavings, ticketRevenue } from "./calculators";
import { rateLimited } from "../ipRateLimit";
import { SEO_PAGES } from "../seoPages";
import { USE_CASE_LINKS, PRODUCT_LINKS, RESOURCE_LINKS, LEGAL_LINKS } from "../siteLinks";

const metas = [
  ...COMPETITORS.flatMap((c) => [
    { id: `compare/${c.slug}`, title: compareTitle(c), description: compareDescription(c) },
    { id: `alternatives/${c.slug}`, title: alternativesTitle(c), description: alternativesDescription(c) },
  ]),
  ...POSTS.map((p) => ({ id: `blog/${p.slug}`, title: p.title, description: p.description })),
  ...INDUSTRIES.map((p) => ({ id: `industries/${p.slug}`, title: p.title, description: p.description })),
  ...TOOLS.map((t) => ({ id: `tools/${t.slug}`, title: t.title, description: t.description })),
];

/** The app route file that serves a path: a folder page or a [slug] page one level down. */
function routeExists(path: string): boolean {
  const parts = path.split("/").filter(Boolean);
  const base = join(process.cwd(), "src", "app", "(site)");
  if (existsSync(join(base, ...parts, "page.tsx"))) return true;
  return parts.length > 1 && existsSync(join(base, ...parts.slice(0, -1), "[slug]", "page.tsx"));
}

describe("SEO content pages", () => {
  it("has unique titles and descriptions and keeps them inside search result limits", () => {
    expect(new Set(metas.map((m) => m.title)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.description)).size).toBe(metas.length);
    for (const m of metas) {
      expect(m.title.length + 10, `${m.id} title`).toBeLessThanOrEqual(60);
      expect(m.description.length, `${m.id} description`).toBeGreaterThanOrEqual(100);
      expect(m.description.length, `${m.id} description`).toBeLessThanOrEqual(160);
    }
  });

  it("has a route file and a sitemap entry for every page", () => {
    const urls = sitemap().map((s) => s.url);
    for (const e of allEntries()) {
      expect(routeExists(e.path), `route for ${e.path}`).toBe(true);
      expect(urls, e.path).toContain(`https://nochbot.space${e.path}`);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("maps every keyword to exactly one existing page of the right type", () => {
    const entries = allEntries();
    expect(new Set(KEYWORD_MAP.map((k) => k.keyword)).size).toBe(KEYWORD_MAP.length);
    for (const k of KEYWORD_MAP) {
      const e = entries.find((x) => x.path === k.path);
      expect(e, k.path).toBeTruthy();
      expect(e!.type, k.keyword).toBe(k.type);
    }
    // "alternative" keywords go to alternatives pages and "vs" keywords to comparisons.
    for (const k of KEYWORD_MAP) {
      if (/alternative/.test(k.keyword)) expect(k.type).toBe("alternatives");
      if (/\bvs\b/.test(k.keyword)) expect(k.type).toBe("compare");
    }
  });

  it("links every spoke to a hub that exists, and every hub lists its spokes", () => {
    const entries = allEntries();
    for (const [hub, h] of Object.entries(HUBS)) {
      expect(entries.some((e) => e.path === `/${h.landing}`), hub).toBe(true);
      expect(spokesOf(hub as keyof typeof HUBS).length, hub).toBeGreaterThan(0);
    }
    for (const e of entries.filter((x) => x.type !== "landing" && /\/.+/.test(x.path.slice(1)) && x.path.split("/").length > 2)) {
      expect(e.hub, e.path).toBeTruthy();
    }
  });

  it("publishes no customer story without real content, and the section stays out of the sitemap", () => {
    const urls = sitemap().map((s) => s.url);
    expect(urls.some((u) => u.includes("/customers"))).toBe(CASE_STUDIES.length > 0);
  });

  it("does not invent statistics, customers or competitor prices", () => {
    const all = JSON.stringify({ COMPETITORS, POSTS, INDUSTRIES, TOOLS }).toLowerCase();
    expect(all).not.toMatch(/\b\d{2,3}%/);
    expect(all).not.toMatch(/testimonial|trusted by|\d+\+ (customers|businesses)/);
    for (const c of COMPETITORS) {
      expect(JSON.stringify(c)).not.toMatch(/[₹$€]\s?\d/);
    }
    // WhatsApp and live sync may only appear in sentences that say they are not offered.
    for (const sentence of all.split(/(?<=[.!?])\s+/)) {
      if (/live[- ]sync|syncs? live|whatsapp/.test(sentence)) expect(sentence, sentence).toMatch(/\bnot\b|n't|\bno\b/);
    }
  });
});

describe("shared footer links", () => {
  it("lists every landing page with its label, and every link goes to a page that exists", () => {
    expect(USE_CASE_LINKS).toEqual(SEO_PAGES.map((p) => ({ href: `/${p.slug}`, label: p.linkLabel })));
    const paths = new Set(allEntries().map((e) => e.path));
    for (const l of [...RESOURCE_LINKS, ...LEGAL_LINKS, ...PRODUCT_LINKS]) {
      const path = l.href.split("#")[0] || "/";
      expect(paths.has(path) || ["/", "/register", "/docs", "/privacy", "/terms"].includes(path), l.href).toBe(true);
    }
  });
});

describe("calculators", () => {
  it("works out support savings from the visitor's own assumptions", () => {
    const r = supportCostSavings({ chatsPerMonth: 600, minutesPerChat: 5, hourlyCost: 300, deflectionPercent: 50 });
    expect(r.monthlyCost).toBe(15000);
    expect(r.monthlySaving).toBe(7500);
    expect(r.hoursSavedPerMonth).toBe(25);
    expect(r.yearlySaving).toBe(90000);
  });

  it("ignores negative, empty and absurd inputs", () => {
    expect(supportCostSavings({ chatsPerMonth: -5, minutesPerChat: NaN, hourlyCost: 100, deflectionPercent: 500 }).monthlySaving).toBe(0);
    expect(supportCostSavings({ chatsPerMonth: 60, minutesPerChat: 1, hourlyCost: 60, deflectionPercent: 500 }).monthlySaving).toBe(60);
  });

  it("works out ticket revenue with gateway fees charged once per booking", () => {
    const r = ticketRevenue({ price: 500, seats: 100, soldPercent: 50, gatewayFeePercent: 2, fixedFee: 3, ticketsPerBooking: 2 });
    expect(r.ticketsSold).toBe(50);
    expect(r.gross).toBe(25000);
    expect(r.bookings).toBe(25);
    expect(r.fees).toBe(500 + 75);
    expect(r.net).toBe(25000 - 575);
  });

  it("recommends the smallest plan that covers the messages, from whatever plans it is given", () => {
    const plans = [
      { key: "pro", sortOrder: 2, limits: { messagesPerMonth: 20000 } },
      { key: "free", sortOrder: 0, limits: { messagesPerMonth: 100 } },
      { key: "starter", sortOrder: 1, limits: { messagesPerMonth: 2000 } },
    ];
    expect(recommendPlan(plans, 50)?.key).toBe("free");
    expect(recommendPlan(plans, 100)?.key).toBe("free");
    expect(recommendPlan(plans, 101)?.key).toBe("starter");
    expect(recommendPlan(plans, 20001)).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows a burst, then blocks until the window passes", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimited("k", 3, 1000, t + i)).toBe(false);
    expect(rateLimited("k", 3, 1000, t + 10)).toBe(true);
    expect(rateLimited("k", 3, 1000, t + 5000)).toBe(false);
  });
});

describe("POST /api/leads", () => {
  let db: import("mongodb").Db;
  const post = async (body: unknown, ip = "9.9.9.9") => {
    const { POST } = await import("@/app/api/leads/route");
    return POST(
      new NextRequest("http://localhost:9002/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
    );
  };

  beforeAll(async () => {
    await startTestMongo();
    const { getDb } = await import("@/lib/db");
    db = await getDb();
  }, 120_000);
  afterAll(async () => {
    await stopTestMongo();
  });

  it("rejects a bad email", async () => {
    const res = await post({ email: "nope", source: "/blog" }, "1.1.1.1");
    expect(res.status).toBe(400);
  });

  it("stores a lead once, case-insensitively, and treats a repeat as success", async () => {
    expect((await post({ email: "Ana@Example.com", source: "/blog" }, "2.2.2.2")).status).toBe(200);
    expect((await post({ email: "ana@example.com", source: "/tools/x" }, "2.2.2.2")).status).toBe(200);
    const rows = await db.collection("leads").find({ email: "ana@example.com" }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("/blog");
  });

  it("ignores honeypot submissions without storing them", async () => {
    const res = await post({ email: "bot@example.com", website: "http://spam", source: "/blog" }, "3.3.3.3");
    expect(res.status).toBe(200);
    expect(await db.collection("leads").countDocuments({ email: "bot@example.com" })).toBe(0);
  });

  it("limits repeated attempts from one address", async () => {
    let last = 200;
    for (let i = 0; i < 7; i++) last = (await post({ email: `u${i}@example.com`, source: "/blog" }, "4.4.4.4")).status;
    expect(last).toBe(429);
  });
});
