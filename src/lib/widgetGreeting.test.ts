import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { cleanGreeting, fallbackGreeting, siteNameFrom } from "@/lib/widgetGreeting";

describe("siteNameFrom", () => {
  it("takes the brand part of a page title", () => {
    expect(siteNameFrom("Kalamic | Handmade Ceramics", null)).toBe("Kalamic");
    expect(siteNameFrom("Baghban Greens - Plants & Pots", null)).toBe("Baghban Greens");
  });

  it("falls back to the domain for generic or missing titles", () => {
    expect(siteNameFrom("Home", "https://www.kalamic.shop/")).toBe("Kalamic");
    expect(siteNameFrom(null, "https://takeuforward.org")).toBe("Takeuforward");
    expect(siteNameFrom(null, "not a url")).toBe("this website");
  });
});

describe("cleanGreeting", () => {
  it("strips emoji, markdown and quotes, and adds final punctuation", () => {
    expect(cleanGreeting('"Hi! Welcome to **Kalamic** 🎉 I can help with orders"')).toBe("Hi! Welcome to Kalamic I can help with orders.");
  });

  it("rejects empty or overly long replies", () => {
    expect(cleanGreeting("")).toBeNull();
    expect(cleanGreeting("Hi")).toBeNull();
    expect(cleanGreeting("x".repeat(400))).toBeNull();
  });
});

describe("getWidgetGreeting", () => {
  let db: Db;
  let getWidgetGreeting: typeof import("@/lib/widgetGreeting").getWidgetGreeting;

  beforeAll(async () => {
    await startTestMongo();
    const { getDb } = await import("@/lib/db");
    db = await getDb();
    ({ getWidgetGreeting } = await import("@/lib/widgetGreeting"));
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => {
    await db.collection("knowledge").deleteMany({});
    await db.collection("nochbot_chunks").deleteMany({});
  });

  it("generates once per crawl from the crawled pages, then serves the cached greeting", async () => {
    await db.collection("knowledge").insertOne({ userId: "u1", url: "https://kalamic.shop", activeGenerationId: "gen-1" });
    await db.collection("nochbot_chunks").insertMany([
      { userId: "u1", generationId: "gen-1", url: "https://kalamic.shop/", title: "Kalamic | Handmade Ceramics", text: "Handmade ceramic mugs and plates.", chunkIndex: 0 },
      { userId: "u1", generationId: "gen-1", url: "https://kalamic.shop/shipping", title: "Shipping", text: "We ship across India.", chunkIndex: 1 },
    ]);
    const generate = vi.fn(async (messages: Array<{ content: string }>) => {
      expect(messages[1].content).toContain("Site name: Kalamic");
      expect(messages[1].content).toContain("- Shipping");
      return "Hi! Welcome to Kalamic. I can help with our handmade ceramics and shipping.";
    });

    const first = await getWidgetGreeting(db, "u1", { generate });
    const second = await getWidgetGreeting(db, "u1", { generate });
    expect(first).toEqual({ greeting: "Hi! Welcome to Kalamic. I can help with our handmade ceramics and shipping.", siteName: "Kalamic" });
    expect(second).toEqual(first);
    expect(generate).toHaveBeenCalledTimes(1);

    // A new crawl writes a new greeting.
    await db.collection("knowledge").updateOne({ userId: "u1" }, { $set: { activeGenerationId: "gen-2" } });
    await db.collection("nochbot_chunks").insertOne({ userId: "u1", generationId: "gen-2", url: "https://kalamic.shop/", title: "Kalamic", text: "New collection.", chunkIndex: 0 });
    await getWidgetGreeting(db, "u1", { generate });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("uses the site-name fallback without crawl data or when generation fails", async () => {
    await db.collection("knowledge").insertOne({ userId: "u2", url: "https://www.baghbangreens.in" });
    expect(await getWidgetGreeting(db, "u2")).toEqual({ greeting: fallbackGreeting("Baghbangreens"), siteName: "Baghbangreens" });

    await db.collection("nochbot_chunks").insertOne({ userId: "u2", url: "https://www.baghbangreens.in/", title: "Baghban Greens | Plants", text: "Plants.", chunkIndex: 0 });
    const failing = vi.fn(async () => { throw new Error("groq down"); });
    expect(await getWidgetGreeting(db, "u2", { generate: failing })).toEqual({ greeting: fallbackGreeting("Baghban Greens"), siteName: "Baghban Greens" });
    expect((await db.collection("knowledge").findOne({ userId: "u2" }))!.widgetGreeting).toBeUndefined();
  });
});
