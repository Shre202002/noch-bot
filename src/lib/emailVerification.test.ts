import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

describe("email verification", () => {
  let ev: typeof import("@/lib/emailVerification");
  let storage: typeof import("@/lib/storage");
  let db: import("mongodb").Db;

  const base = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    email: `${id}@gmail.com`,
    passwordHash: "x",
    createdAt: new Date().toISOString(),
    plan: "free",
    crawlCount: 0,
    ...extra,
  });
  const load = async (id: string) => (await storage.findAccountById(id))!;

  beforeAll(async () => {
    await startTestMongo();
    ev = await import("@/lib/emailVerification");
    storage = await import("@/lib/storage");
    db = await (await import("@/lib/db")).getDb();
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => { await db.collection("accounts").deleteMany({}); });

  it("only an explicit false is unverified, so older accounts and Google accounts keep working", () => {
    expect(ev.needsEmailVerification({ emailVerified: false })).toBe(true);
    expect(ev.needsEmailVerification({ emailVerified: true })).toBe(false);
    expect(ev.needsEmailVerification({})).toBe(false);
    expect(ev.needsEmailVerification(null)).toBe(false);
  });

  it("the gate blocks only unverified owners", async () => {
    await db.collection("accounts").insertMany([
      base("new", { emailVerified: false }),
      base("old"),
      base("google", { emailVerified: true }),
    ]);
    const blocked = await ev.requireVerifiedEmail("new");
    expect(blocked?.status).toBe(403);
    expect(await blocked?.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(await ev.requireVerifiedEmail("old")).toBeNull();
    expect(await ev.requireVerifiedEmail("google")).toBeNull();
  });

  it("issues a hashed 6-digit code and verifies the account with it", async () => {
    await db.collection("accounts").insertOne(base("u1", { emailVerified: false }));
    const issued = await ev.issueEmailOtp(await load("u1"));
    if (!issued.ok) throw new Error(issued.error);
    expect(issued.otp).toMatch(/^\d{6}$/);

    const stored = await load("u1");
    expect(stored.emailOtpHash).toBeTruthy();
    expect(stored.emailOtpHash).not.toContain(issued.otp);

    expect(await ev.confirmEmailOtp(stored, issued.otp)).toEqual({ ok: true });
    const after = await load("u1");
    expect(after.emailVerified).toBe(true);
    expect(after.emailVerifiedAt).toBeTruthy();
    expect(after.emailOtpHash).toBeUndefined();
  });

  it("throttles resends for 60 seconds", async () => {
    await db.collection("accounts").insertOne(base("u1", { emailVerified: false }));
    const t0 = Date.now();
    expect((await ev.issueEmailOtp(await load("u1"), t0)).ok).toBe(true);
    const again = await ev.issueEmailOtp(await load("u1"), t0 + 20_000);
    expect(again).toMatchObject({ ok: false, status: 429, retryAfterSec: 40 });
    expect((await ev.issueEmailOtp(await load("u1"), t0 + 61_000)).ok).toBe(true);
  });

  it("refuses to issue a code for an already verified account", async () => {
    await db.collection("accounts").insertOne(base("u1", { emailVerified: true }));
    expect(await ev.issueEmailOtp(await load("u1"))).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects malformed, wrong and expired codes", async () => {
    const now = Date.now();
    await db.collection("accounts").insertOne(
      base("u1", {
        emailVerified: false,
        emailOtpHash: await bcrypt.hash("123456", 4),
        emailOtpExpiry: new Date(now + 60_000).toISOString(),
        emailOtpAttempts: 0,
      }),
    );
    expect(await ev.confirmEmailOtp(await load("u1"), "12ab", now)).toMatchObject({ ok: false, status: 400 });
    expect(await ev.confirmEmailOtp(await load("u1"), "654321", now)).toMatchObject({ ok: false, error: "That code is not correct." });
    expect((await load("u1")).emailVerified).toBe(false);

    const expired = await ev.confirmEmailOtp(await load("u1"), "123456", now + 120_000);
    expect(expired).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
    expect((await load("u1")).emailOtpHash).toBeUndefined();
  });

  it("locks a code after five wrong attempts, even if the sixth is right", async () => {
    const now = Date.now();
    await db.collection("accounts").insertOne(
      base("u1", {
        emailVerified: false,
        emailOtpHash: await bcrypt.hash("123456", 4),
        emailOtpExpiry: new Date(now + 60_000).toISOString(),
        emailOtpAttempts: 0,
      }),
    );
    for (let i = 0; i < 4; i++) {
      expect(await ev.confirmEmailOtp(await load("u1"), "000000", now)).toMatchObject({ status: 400 });
    }
    expect(await ev.confirmEmailOtp(await load("u1"), "000000", now)).toMatchObject({ status: 429 });

    const stored = await load("u1");
    expect(stored.emailOtpHash).toBeUndefined();
    expect(await ev.confirmEmailOtp(stored, "123456", now)).toMatchObject({ ok: false, status: 400 });
    expect((await load("u1")).emailVerified).toBe(false);
  });
});
