import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

describe("admin operations", () => {
  let ops: typeof import("@/lib/adminOps");
  let health: typeof import("@/lib/adminHealth");
  let analytics: typeof import("@/lib/adminAnalytics");
  let db: import("mongodb").Db;

  const account = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    email: `${id}@example.com`,
    passwordHash: "x",
    createdAt: new Date().toISOString(),
    plan: "free",
    crawlCount: 0,
    ...extra,
  });

  beforeAll(async () => {
    await startTestMongo();
    ops = await import("@/lib/adminOps");
    health = await import("@/lib/adminHealth");
    analytics = await import("@/lib/adminAnalytics");
    db = await (await import("@/lib/db")).getDb();
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => {
    for (const c of ["accounts", "messages", "bookings", "pdf_files", "tabular_rows"]) {
      await db.collection(c).deleteMany({});
    }
  });

  describe("bulk actions", () => {
    it("validates the request", async () => {
      expect(await ops.parseBulkRequest({ ids: [], action: "plan" })).toEqual({ error: "Select at least one user" });
      expect(await ops.parseBulkRequest({ ids: ["a"], action: "nuke" })).toEqual({ error: "Unknown action" });
      expect(await ops.parseBulkRequest({ ids: ["a"], action: "plan", plan: "nope" })).toEqual({ error: "Unknown plan" });
      expect(await ops.parseBulkRequest({ ids: ["a"], action: "plan", plan: "pro", expiresAt: "2001-01-01" })).toEqual({
        error: "Expiry must be in the future",
      });
      const tooMany = Array.from({ length: ops.BULK_MAX + 1 }, (_, i) => `u${i}`);
      expect(await ops.parseBulkRequest({ ids: tooMany, action: "deactivate" })).toMatchObject({ error: expect.stringMatching(/At most/) });
    });

    it("changes plans and reports unknown users per account", async () => {
      await db.collection("accounts").insertMany([account("u1"), account("u2")]);
      const parsed = await ops.parseBulkRequest({ ids: ["u1", "u2", "ghost"], action: "plan", plan: "pro" });
      if ("error" in parsed) throw new Error(parsed.error);
      const results = await ops.applyBulkAction("admin", parsed.request);
      expect(results).toEqual([
        { id: "u1", ok: true },
        { id: "u2", ok: true },
        { id: "ghost", ok: false, error: "User not found" },
      ]);
      expect(await db.collection("accounts").countDocuments({ plan: "pro", planSource: "admin" })).toBe(2);
    });

    it("never deactivates the acting admin or the last active admin, but still handles the rest", async () => {
      await db.collection("accounts").insertMany([account("a1", { role: "superadmin" }), account("u1")]);
      const results = await ops.applyBulkAction("a1", { ids: ["a1", "u1"], action: "deactivate", reason: "spam" });
      expect(results[0]).toMatchObject({ id: "a1", ok: false });
      expect(results[1]).toEqual({ id: "u1", ok: true });
      expect((await db.collection("accounts").findOne({ id: "u1" }))?.disabled).toBe(true);
      expect((await db.collection("accounts").findOne({ id: "a1" }))?.disabled).toBeUndefined();

      await ops.applyBulkAction("a1", { ids: ["u1"], action: "reactivate" });
      expect((await db.collection("accounts").findOne({ id: "u1" }))?.disabled).toBeUndefined();
    });
  });

  describe("re-queue embeddings", () => {
    it("queues only live spreadsheet rows of that user that lack an embedding", async () => {
      await db.collection("pdf_files").insertMany([
        { userId: "u1", fileId: "sheet", docType: "csv" },
        { userId: "u1", fileId: "gone", docType: "csv", deletedAt: new Date() },
        { userId: "u1", fileId: "doc", docType: "pdf" },
        { userId: "u2", fileId: "other", docType: "csv" },
      ]);
      await db.collection("tabular_rows").insertMany([
        { userId: "u1", fileId: "sheet", rowIndex: 0 },
        { userId: "u1", fileId: "sheet", rowIndex: 1, embedding: "vec" },
        { userId: "u1", fileId: "gone", rowIndex: 0 },
        { userId: "u2", fileId: "other", rowIndex: 0 },
      ]);

      expect(await ops.requeueRowEmbeddings("u1")).toEqual({ documents: 1, rows: 1 });
      expect(await db.collection("tabular_rows").countDocuments({ needsEmbedding: { $exists: true } })).toBe(1);
      expect((await db.collection("pdf_files").findOne({ fileId: "sheet" }))?.rowVectors).toBe("indexing");
      expect(await ops.requeueRowEmbeddings("nobody")).toEqual({ documents: 0, rows: 0 });
    });
  });

  describe("usage history", () => {
    it("returns six calendar months with zeros filled in, counting only user messages", async () => {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2);
      await db.collection("messages").insertMany([
        { userId: "u1", role: "user", createdAt: thisMonth },
        { userId: "u1", role: "user", createdAt: thisMonth },
        { userId: "u1", role: "assistant", createdAt: thisMonth },
        { userId: "u2", role: "user", createdAt: thisMonth },
      ]);
      const history = await ops.monthlyMessageHistory("u1");
      expect(history).toHaveLength(6);
      expect(history[5].messages).toBe(2);
      expect(history.slice(0, 5).every((h) => h.messages === 0)).toBe(true);
    });

    it("counts bookings by status for one organizer", async () => {
      await db.collection("bookings").insertMany([
        { org_id: "u1", status: "confirmed" },
        { org_id: "u1", status: "confirmed" },
        { org_id: "u1", status: "needs_refund" },
        { org_id: "u2", status: "confirmed" },
      ]);
      expect(await ops.bookingStatusCounts("u1")).toEqual({ confirmed: 2, needs_refund: 1 });
    });
  });

  describe("platform health", () => {
    it("reports the crawler as not configured, healthy, degraded or down without exposing its URL", async () => {
      expect((await health.checkCrawler({} as any)).state).toBe("not_configured");
      const env = { CRAWLER_SERVICE_URL: "https://crawler.internal/", CRAWLER_SERVICE_TOKEN: "t".repeat(32) } as any;
      expect((await health.checkCrawler(env, (async () => new Response("{}", { status: 200 })) as any)).state).toBe("ok");
      expect((await health.checkCrawler(env, (async () => new Response("", { status: 503 })) as any)).state).toBe("degraded");
      const down = await health.checkCrawler(env, (async () => { throw new Error("ECONNREFUSED crawler.internal"); }) as any);
      expect(down.state).toBe("down");
      expect(JSON.stringify(down)).not.toContain("crawler.internal");
    });

    it("lists failed and stale documents and the refund queue", async () => {
      const now = new Date();
      const old = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      await db.collection("pdf_files").insertMany([
        { userId: "u1", fileId: "f1", filename: "a.pdf", status: "failed", error: "Scanned PDF", uploadedAt: old },
        { userId: "u1", fileId: "f2", filename: "b.pdf", status: "parsing", uploadedAt: old },
        { userId: "u1", fileId: "f3", filename: "c.pdf", status: "parsing", uploadedAt: now.toISOString() },
        { userId: "u1", fileId: "f4", filename: "d.pdf", status: "failed", uploadedAt: old, deletedAt: new Date() },
      ]);
      await db.collection("bookings").insertMany([
        { org_id: "u1", status: "needs_refund", amount_total: 500, currency: "INR", updated_at: now },
        { org_id: "u1", status: "confirmed", updated_at: now },
        { org_id: "u1", status: "processing_late_payment", updated_at: new Date(now.getTime() - 2 * 3600 * 1000) },
      ]);
      await db.collection("tabular_rows").insertOne({ userId: "u1", fileId: "x", needsEmbedding: now });

      const q = await health.loadQueues(now);
      expect(q.failedDocuments.count).toBe(2);
      expect(q.failedDocuments.recent.map((f) => f.fileId).sort()).toEqual(["f1", "f2"]);
      expect(q.failedDocuments.recent.find((f) => f.fileId === "f1")).toMatchObject({ name: "a.pdf", error: "Scanned PDF" });
      expect(q.needsRefund).toMatchObject({ count: 1, recent: [{ amount: 500, currency: "INR" }] });
      expect(q.lateOrStuckPayments).toBe(1);
      expect(q.pendingRowEmbeddings).toBe(1);
    });
  });

  describe("analytics", () => {
    it("fills missing days with zero", () => {
      const now = new Date("2026-10-25T12:00:00Z");
      const series = analytics.fillDailySeries(new Map([["2026-10-25", 3], ["2026-10-23", 1]]), 4, now);
      expect(series).toEqual([
        { date: "2026-10-22", value: 0 },
        { date: "2026-10-23", value: 1 },
        { date: "2026-10-24", value: 0 },
        { date: "2026-10-25", value: 3 },
      ]);
    });

    it("estimates revenue from paying subscribers only", () => {
      const plans = [
        { key: "free", name: "Free", priceMonthly: 0, currency: "INR" },
        { key: "starter", name: "Starter", priceMonthly: 499, currency: "INR" },
      ];
      expect(analytics.estimateMrr(plans, new Map([["starter", 3]]))).toEqual([
        { plan: "starter", name: "Starter", subscribers: 3, currency: "INR", monthly: 1497 },
      ]);
    });

    it("counts sign-ups, user messages and paid ticket sales in the window", async () => {
      const now = new Date();
      await db.collection("accounts").insertMany([
        account("u1", { planSource: "payment", subscription: { status: "active" } }),
        account("u2", { plan: "starter", planSource: "payment", subscription: { status: "active" } }),
        account("u3", { plan: "starter", planSource: "admin", subscription: { status: "active" } }),
      ]);
      await db.collection("messages").insertMany([
        { userId: "u1", role: "user", createdAt: now },
        { userId: "u1", role: "assistant", createdAt: now },
      ]);
      await db.collection("bookings").insertMany([
        { status: "confirmed", payment_status: "paid", amount_total: 200, currency: "INR", updated_at: now },
        { status: "confirmed", payment_status: "paid", amount_charged: 50, currency: "INR", updated_at: now },
        { status: "confirmed", payment_status: "not_required", updated_at: now },
      ]);

      const a = await analytics.loadAnalytics(7, now);
      expect(a.signups.reduce((n, p) => n + p.value, 0)).toBe(3);
      expect(a.messages.reduce((n, p) => n + p.value, 0)).toBe(1);
      expect(a.ticketSales).toEqual([{ currency: "INR", gross: 250, bookings: 2 }]);
      expect(a.mrr.find((m) => m.plan === "starter")?.subscribers).toBe(1);
    });
  });
});
