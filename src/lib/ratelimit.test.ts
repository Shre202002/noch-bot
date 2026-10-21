import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { sameSite } from "@/lib/ratelimit";

describe("sameSite", () => {
  it("treats www / no-www, case and paths of one host as the same website", () => {
    expect(sameSite("https://baghbangreens.in/", "https://www.BaghbanGreens.in/properties")).toBe(true);
    expect(sameSite("http://kalamic.shop", "https://kalamic.shop/about")).toBe(true);
  });

  it("treats other hosts, missing and invalid URLs as different", () => {
    expect(sameSite("https://kalamic.shop", "https://shop.kalamic.in")).toBe(false);
    expect(sameSite(null, "https://kalamic.shop")).toBe(false);
    expect(sameSite("not a url", "not a url")).toBe(false);
  });
});

describe("monthly crawl count", () => {
  let ratelimit: typeof import("@/lib/ratelimit");

  beforeAll(async () => {
    await startTestMongo();
    ratelimit = await import("@/lib/ratelimit");
  });
  afterAll(async () => { await stopTestMongo(); });

  it("counts new websites but not re-crawls of the current one", async () => {
    await ratelimit.logCrawl("user-1", "https://baghbangreens.in/");
    await ratelimit.logCrawl("user-1", "https://baghbangreens.in/", { recrawl: true });
    await ratelimit.logCrawl("user-1", "https://baghbangreens.in/", { recrawl: true });

    expect(await ratelimit.getMonthlyCrawlCount("user-1")).toBe(1);
    const check = await ratelimit.checkCrawlLimit("user-1", "free");
    expect(check).toMatchObject({ allowed: false, used: 1, limit: 1 });
  });
});
