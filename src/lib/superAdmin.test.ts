import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

const cookieState = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "token" && cookieState.token ? { value: cookieState.token } : undefined),
  }),
}));

describe("super admin", () => {
  let admin: typeof import("@/lib/superAdmin");
  let auth: typeof import("@/lib/auth");
  let audit: typeof import("@/lib/adminAudit");
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
    admin = await import("@/lib/superAdmin");
    auth = await import("@/lib/auth");
    audit = await import("@/lib/adminAudit");
    db = await (await import("@/lib/db")).getDb();
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => {
    await db.collection("accounts").deleteMany({});
    await db.collection("admin_audit_log").deleteMany({});
    cookieState.token = undefined;
    delete process.env.SUPER_ADMIN_EMAILS;
  });

  it("recognises bootstrap admins case-insensitively", () => {
    process.env.SUPER_ADMIN_EMAILS = " Boss@Example.com , other@example.com";
    expect(admin.isBootstrapAdmin("boss@example.com")).toBe(true);
    expect(admin.isBootstrapAdmin("nobody@example.com")).toBe(false);
    expect(admin.isBootstrapAdmin(undefined)).toBe(false);
  });

  it("promotes a listed account on sign-in", async () => {
    process.env.SUPER_ADMIN_EMAILS = "a1@example.com";
    await db.collection("accounts").insertOne(account("a1"));
    const promoted = await admin.ensureBootstrapAdmin(account("a1") as any);
    expect(promoted.role).toBe("superadmin");
    expect((await db.collection("accounts").findOne({ id: "a1" }))?.role).toBe("superadmin");
  });

  it("refuses self-lockout and removing the last admin", async () => {
    await db.collection("accounts").insertMany([
      account("a1", { role: "superadmin" }),
      account("a2", { role: "superadmin" }),
    ]);
    expect(await admin.guardAdminChange("a1", "a1", "disable")).toMatch(/cannot disable your own/);
    expect(await admin.guardAdminChange("a1", "a2", "demote")).toBeNull();

    await db.collection("accounts").updateOne({ id: "a2" }, { $set: { disabled: true } });
    expect(await admin.guardAdminChange("a3", "a1", "demote")).toMatch(/At least one active super admin/);
  });

  it("allows changes to non-admin targets", async () => {
    await db.collection("accounts").insertOne(account("u1"));
    expect(await admin.guardAdminChange("a1", "u1", "delete")).toBeNull();
  });

  it("requireSuperAdmin returns 401, 403 or the admin", async () => {
    await db.collection("accounts").insertMany([account("u1"), account("a1", { role: "superadmin" })]);

    const anon = await auth.requireSuperAdmin();
    expect(anon.ok === false && anon.response.status).toBe(401);

    cookieState.token = auth.signToken("u1");
    const plain = await auth.requireSuperAdmin();
    expect(plain.ok === false && plain.response.status).toBe(403);

    cookieState.token = auth.signToken("a1");
    const ok = await auth.requireSuperAdmin();
    expect(ok.ok && ok.admin.id).toBe("a1");

    await db.collection("accounts").updateOne({ id: "a1" }, { $set: { disabled: true } });
    const off = await auth.requireSuperAdmin();
    expect(off.ok === false && off.response.status).toBe(401);
  });

  it("records admin actions in the audit log", async () => {
    await audit.logAdminAction({ id: "a1", email: "a1@example.com" }, "user.deactivate", "u1", { reason: "spam" });
    const row = await db.collection("admin_audit_log").findOne({});
    expect(row).toMatchObject({ adminId: "a1", action: "user.deactivate", target: "u1", meta: { reason: "spam" } });
  });
});
