import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { getDb } from "@/lib/db";
import { acquireCrawlLock, releaseCrawlLock } from "./lock";

beforeAll(async () => {
  await startTestMongo();
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  const db = await getDb();
  await db.collection("crawl_locks").deleteMany({});
});

describe("crawl lock", () => {
  it("allows one crawl per user at a time", async () => {
    expect(await acquireCrawlLock("u1", "a")).toBe(true);
    expect(await acquireCrawlLock("u1", "b")).toBe(false);
    expect(await acquireCrawlLock("u2", "c")).toBe(true);
  });

  it("can be taken again after release", async () => {
    await acquireCrawlLock("u1", "a");
    await releaseCrawlLock("u1", "a");
    expect(await acquireCrawlLock("u1", "b")).toBe(true);
  });

  it("only the holder can release it", async () => {
    await acquireCrawlLock("u1", "a");
    await releaseCrawlLock("u1", "someone-else");
    expect(await acquireCrawlLock("u1", "b")).toBe(false);
  });

  it("expires so a crashed request cannot block forever", async () => {
    await acquireCrawlLock("u1", "a", new Date("2026-01-01T00:00:00Z"));
    expect(await acquireCrawlLock("u1", "b", new Date("2026-01-01T00:10:00Z"))).toBe(true);
  });
});
