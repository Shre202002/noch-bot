import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

const OWNER = "owner-1";
const LINK = { slug: "slug-a", userId: OWNER, fileId: "file-1" };
const OTHER_LINK = { slug: "slug-b", userId: OWNER, fileId: "file-1" };
const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-10-09T08:00:00Z");
const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);

let db: Db;
let auth: typeof import("@/lib/linkUserAuth");

beforeAll(async () => {
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  auth = await import("@/lib/linkUserAuth");
  db = await getDb();
  await auth.ensureLinkUserIndexes(db);
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await db.collection("pdf_link_users").deleteMany({});
});

async function approvedUser(loginId = "alice", password = "correct-horse") {
  await auth.registerLinkUser(db, LINK, loginId, password, T0);
  const user = await db.collection("pdf_link_users").findOne({ slug: LINK.slug, loginId });
  await auth.ownerLinkUserAction(db, OWNER, LINK.slug, user!._id.toHexString(), "approve", T0);
  return user!._id.toHexString();
}

describe("registerLinkUser", () => {
  it("validates the Login ID and password", async () => {
    expect(await auth.registerLinkUser(db, LINK, "a", "longenough")).toEqual({ error: "invalid_login_id" });
    expect(await auth.registerLinkUser(db, LINK, "has space", "longenough")).toEqual({ error: "invalid_login_id" });
    expect(await auth.registerLinkUser(db, LINK, "bob", "short")).toEqual({ error: "weak_password" });
  });

  it("creates a pending account and keeps Login IDs unique per link, case-insensitively", async () => {
    expect(await auth.registerLinkUser(db, LINK, "Alice", "password1")).toEqual({ ok: true });
    expect(await auth.registerLinkUser(db, LINK, "alice", "password2")).toEqual({ error: "taken" });
    expect(await auth.registerLinkUser(db, OTHER_LINK, "alice", "password3")).toEqual({ ok: true });
    const user = await db.collection("pdf_link_users").findOne({ slug: LINK.slug, loginId: "alice" });
    expect(user?.status).toBe("pending");
    expect(user?.passwordHash).not.toBe("password1");
  });
});

describe("attemptLinkLogin", () => {
  it("refuses unknown and wrong credentials with the same error", async () => {
    await approvedUser();
    expect(await auth.attemptLinkLogin(db, LINK.slug, "nobody", "whatever", at(1))).toEqual({ error: "invalid" });
    expect(await auth.attemptLinkLogin(db, LINK.slug, "alice", "wrong-pass", at(1))).toEqual({ error: "invalid" });
  });

  it("does not let pending users in and does not count their attempts", async () => {
    await auth.registerLinkUser(db, LINK, "carol", "password1", T0);
    for (let i = 0; i < 5; i++) {
      expect(await auth.attemptLinkLogin(db, LINK.slug, "carol", "password1", at(i))).toEqual({ error: "pending" });
    }
    const user = await db.collection("pdf_link_users").findOne({ loginId: "carol" });
    expect(user?.status).toBe("pending");
    expect(user?.loginAttempts).toEqual([]);
  });

  it("refuses rejected users", async () => {
    await auth.registerLinkUser(db, LINK, "dave", "password1", T0);
    const user = await db.collection("pdf_link_users").findOne({ loginId: "dave" });
    await auth.ownerLinkUserAction(db, OWNER, LINK.slug, user!._id.toHexString(), "reject");
    expect(await auth.attemptLinkLogin(db, LINK.slug, "dave", "password1", at(1))).toEqual({ error: "rejected" });
  });

  it("allows two attempts in 48 hours and blocks the third, even with the right password", async () => {
    await approvedUser();
    expect(await auth.attemptLinkLogin(db, LINK.slug, "alice", "wrong-pass", at(1))).toEqual({ error: "invalid" });
    const second = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(2));
    expect("ok" in second && second.ok).toBe(true);
    expect(await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(3))).toEqual({ error: "blocked" });
    const user = await db.collection("pdf_link_users").findOne({ loginId: "alice" });
    expect(user?.status).toBe("blocked");
    expect(user?.currentSessionId).toBeUndefined();
  });

  it("forgets attempts older than the window", async () => {
    await approvedUser();
    await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(0));
    await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(1));
    const later = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(49));
    expect("ok" in later && later.ok).toBe(true);
  });
});

describe("single-device sessions", () => {
  it("signs the previous device out when the account signs in again", async () => {
    await approvedUser();
    const first = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(1));
    const second = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(2));
    if (!("ok" in first) || !("ok" in second)) throw new Error("sign-in failed");

    const oldToken = auth.signLinkToken(first.user, first.sessionId);
    const newToken = auth.signLinkToken(second.user, second.sessionId);
    expect(await auth.verifyLinkSession(db, LINK.slug, oldToken)).toEqual({ error: "replaced" });
    const current = await auth.verifyLinkSession(db, LINK.slug, newToken);
    expect("ok" in current && current.ok).toBe(true);
  });

  it("rejects a token for a different link and garbage tokens", async () => {
    await approvedUser();
    const login = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(1));
    if (!("ok" in login)) throw new Error("sign-in failed");
    const token = auth.signLinkToken(login.user, login.sessionId);
    expect(await auth.verifyLinkSession(db, OTHER_LINK.slug, token)).toEqual({ error: "none" });
    expect(await auth.verifyLinkSession(db, LINK.slug, "not-a-jwt")).toEqual({ error: "none" });
    expect(await auth.verifyLinkSession(db, LINK.slug, undefined)).toEqual({ error: "none" });
  });

  it("ends the session when the owner blocks the user, and unblock lets them back in", async () => {
    const id = await approvedUser();
    const login = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(1));
    if (!("ok" in login)) throw new Error("sign-in failed");
    const token = auth.signLinkToken(login.user, login.sessionId);

    expect(await auth.ownerLinkUserAction(db, OWNER, LINK.slug, id, "block")).toBe(true);
    expect(await auth.verifyLinkSession(db, LINK.slug, token)).toEqual({ error: "blocked" });

    expect(await auth.ownerLinkUserAction(db, OWNER, LINK.slug, id, "unblock")).toBe(true);
    const again = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(2));
    expect("ok" in again && again.ok).toBe(true);
  });

  it("the user's own sign-out ends only the current session", async () => {
    await approvedUser();
    const login = await auth.attemptLinkLogin(db, LINK.slug, "alice", "correct-horse", at(1));
    if (!("ok" in login)) throw new Error("sign-in failed");
    const token = auth.signLinkToken(login.user, login.sessionId);
    await auth.endLinkSession(db, LINK.slug, token);
    expect(await auth.verifyLinkSession(db, LINK.slug, token)).toEqual({ error: "none" });
  });
});

describe("ownerLinkUserAction", () => {
  it("only lets the link's owner manage its users", async () => {
    const id = await approvedUser();
    expect(await auth.ownerLinkUserAction(db, "someone-else", LINK.slug, id, "block")).toBe(false);
    expect(await auth.ownerLinkUserAction(db, OWNER, OTHER_LINK.slug, id, "block")).toBe(false);
    expect(await auth.ownerLinkUserAction(db, OWNER, LINK.slug, "not-an-id", "block")).toBe(false);
  });

  it("lists users without secrets", async () => {
    await approvedUser();
    const list = await auth.listLinkUsers(db, OWNER, LINK.slug);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ loginId: "alice", status: "approved" });
    expect(JSON.stringify(list)).not.toContain("passwordHash");
  });
});
