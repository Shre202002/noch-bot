import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

describe("plans", () => {
  let plans: typeof import("@/lib/plans");
  let ratelimit: typeof import("@/lib/ratelimit");
  let db: import("mongodb").Db;

  beforeAll(async () => {
    await startTestMongo();
    plans = await import("@/lib/plans");
    ratelimit = await import("@/lib/ratelimit");
    db = await (await import("@/lib/db")).getDb();
  });
  afterAll(async () => { await stopTestMongo(); });

  it("seeds the three original plans with their original limits", async () => {
    const all = await plans.getPlans();
    expect(all.map((p) => p.key)).toEqual(["free", "starter", "pro"]);
    expect(plans.planLimits("free")).toMatchObject({ messagesPerMonth: 100, crawlsPerMonth: 1, crawlPagesPerCrawl: 15 });
    expect(plans.planLimits("starter")).toMatchObject({ messagesPerMonth: 5000, pdfDocuments: 10, additionalFiles: 3 });
    expect(plans.pdfLimitFor("pro")).toBe(Infinity);
  });

  it("falls back to the free plan for unknown plans", async () => {
    await plans.loadPlans();
    expect(plans.planLimits("enterprise-trial").messagesPerMonth).toBe(100);
    expect(plans.effectivePlanKey({ plan: "enterprise-trial" })).toBe("free");
  });

  it("drops an account to free once its plan has expired", async () => {
    await plans.loadPlans();
    const day = 24 * 60 * 60 * 1000;
    expect(plans.effectivePlanKey({ plan: "pro", planExpiresAt: new Date(Date.now() + day).toISOString() })).toBe("pro");
    expect(plans.effectivePlanKey({ plan: "pro", planExpiresAt: new Date(Date.now() - day).toISOString() })).toBe("free");
    expect(plans.effectivePlanKey({ plan: "pro" })).toBe("pro");
  });

  it("applies an admin edit to enforcement after the cache is invalidated", async () => {
    await db.collection("plans").updateOne({ key: "free" }, { $set: { "limits.messagesPerMonth": 7 } });
    plans.invalidatePlans();
    const check = await ratelimit.checkMessageLimit("nobody", "free");
    expect(check.limit).toBe(7);
  });

  it("never overwrites an edited plan when seeding again", async () => {
    plans.invalidatePlans();
    await plans.loadPlans();
    expect(plans.planLimits("free").messagesPerMonth).toBe(7);
  });

  it("supports admin-created plans", async () => {
    const made = plans.validatePlanInput({
      key: "business",
      name: "Business",
      priceMonthly: 2999,
      features: ["Priority support", " "],
      sortOrder: 3,
      limits: { messagesPerMonth: 200000, crawlsPerMonth: 50, crawlPagesPerCrawl: 50, pdfDocuments: null, additionalFiles: 8 },
    });
    if ("error" in made) throw new Error(made.error);
    await db.collection("plans").insertOne({ ...made.plan });
    plans.invalidatePlans();
    await plans.loadPlans();
    expect(plans.planLimits("business").messagesPerMonth).toBe(200000);
    expect(plans.pdfLimitFor("business")).toBe(Infinity);
    expect(made.plan.features).toEqual(["Priority support"]);
    expect(plans.hasHigherPlan("pro")).toBe(true);
    expect(plans.hasHigherPlan("business")).toBe(false);
  });

  it("rejects invalid plan input", () => {
    const bad = (input: unknown) => "error" in plans.validatePlanInput(input);
    expect(bad({ key: "Bad Key", name: "x", limits: {} })).toBe(true);
    expect(bad({ key: "ok", name: "", limits: {} })).toBe(true);
    expect(
      bad({ key: "ok", name: "Ok", limits: { messagesPerMonth: -1, crawlsPerMonth: 1, crawlPagesPerCrawl: 1, additionalFiles: 0 } }),
    ).toBe(true);
    expect(
      bad({ key: "ok", name: "Ok", limits: { messagesPerMonth: 1, crawlsPerMonth: 1, crawlPagesPerCrawl: 0, additionalFiles: 0 } }),
    ).toBe(true);
  });
});
