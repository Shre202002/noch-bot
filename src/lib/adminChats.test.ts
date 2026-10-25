import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

describe("admin chat history", () => {
  let chats: typeof import("@/lib/adminChats");
  let health: typeof import("@/lib/adminHealth");
  let db: import("mongodb").Db;

  beforeAll(async () => {
    await startTestMongo();
    chats = await import("@/lib/adminChats");
    health = await import("@/lib/adminHealth");
    db = await (await import("@/lib/db")).getDb();
  });
  afterAll(async () => { await stopTestMongo(); });
  beforeEach(async () => {
    for (const c of ["conversations", "messages", "chat_sessions", "chat_messages", "accounts", "pdf_files", "bookings"]) {
      await db.collection(c).deleteMany({});
    }
  });

  async function seedWebsite(userId: string, website: string, texts: string[], lastMessageAt = new Date()) {
    const conv = await db.collection("conversations").insertOne({
      userId, sessionId: `s-${website}`, visitorId: "v1", website, messageCount: texts.length, startedAt: lastMessageAt, lastMessageAt,
    });
    const conversationId = String(conv.insertedId);
    let t = lastMessageAt.getTime();
    for (const [i, content] of texts.entries()) {
      await db.collection("messages").insertOne({
        userId, conversationId, role: i % 2 === 0 ? "user" : "assistant", content, createdAt: new Date(t++),
      });
    }
    return conversationId;
  }

  it("lists a user's website chats newest first with the first question as preview", async () => {
    await seedWebsite("u1", "old.example.com", ["old question", "answer"], new Date("2026-01-01"));
    await seedWebsite("u1", "new.example.com", ["what are the fees?", "answer"], new Date("2026-02-01"));
    await seedWebsite("u2", "other.example.com", ["secret"]);

    const { chats: list, total } = await chats.listChats("u1", "website");
    expect(total).toBe(2);
    expect(list.map((c) => c.title)).toEqual(["new.example.com", "old.example.com"]);
    expect(list[0]).toMatchObject({ preview: "what are the fees?", messageCount: 2, visitor: "v1" });
  });

  it("returns a full thread in order and refuses another user's conversation", async () => {
    const id = await seedWebsite("u1", "a.example.com", ["hi", "hello", "bye"]);
    const thread = await chats.getThread("u1", "website", id);
    expect(thread?.messages.map((m) => m.content)).toEqual(["hi", "hello", "bye"]);
    expect(thread?.truncated).toBe(false);

    expect(await chats.getThread("u2", "website", id)).toBeNull();
    expect(await chats.getThread("u1", "website", "not-an-id")).toBeNull();
    expect(await chats.getThread("u1", "website", String(new ObjectId()))).toBeNull();
  });

  it("paginates", async () => {
    for (let i = 0; i < 25; i++) await seedWebsite("u1", `site${i}.example.com`, ["q"], new Date(2026, 0, i + 1));
    const first = await chats.listChats("u1", "website", 1, 20);
    const second = await chats.listChats("u1", "website", 2, 20);
    expect(first.chats).toHaveLength(20);
    expect(second.chats).toHaveLength(5);
    expect(first.total).toBe(25);
  });

  it("reads PDF share-link sessions scoped to the owner and leaves out visitor IP", async () => {
    await db.collection("chat_sessions").insertMany([
      { sessionId: "p1", slug: "abc", userId: "u1", label: "Price list", createdAt: "2026-02-01T00:00:00.000Z", lastActiveAt: "2026-02-01T01:00:00.000Z", messageCount: 2, ip: "1.2.3.4", userAgent: "UA" },
      { sessionId: "p2", slug: "def", userId: "u2", label: "Other", createdAt: "2026-02-01T00:00:00.000Z", lastActiveAt: "2026-02-01T01:00:00.000Z", messageCount: 1, ip: "5.6.7.8" },
    ]);
    await db.collection("chat_messages").insertMany([
      { sessionId: "p1", ownerId: "u1", role: "user", content: "how much?", createdAt: "2026-02-01T00:10:00.000Z" },
      { sessionId: "p1", ownerId: "u1", role: "assistant", content: "100", createdAt: "2026-02-01T00:10:05.000Z" },
      { sessionId: "p2", ownerId: "u2", role: "user", content: "private", createdAt: "2026-02-01T00:10:00.000Z" },
    ]);

    const { chats: list, total } = await chats.listChats("u1", "pdf");
    expect(total).toBe(1);
    expect(list[0]).toMatchObject({ id: "p1", title: "Price list", preview: "how much?" });

    const thread = await chats.getThread("u1", "pdf", "p1");
    expect(thread?.messages.map((m) => m.content)).toEqual(["how much?", "100"]);
    expect(JSON.stringify(thread)).not.toContain("1.2.3.4");
    expect(JSON.stringify(list)).not.toContain("1.2.3.4");
    expect(await chats.getThread("u1", "pdf", "p2")).toBeNull();
  });

  it("names the owner of failed documents and refund bookings, including missing accounts", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    await db.collection("accounts").insertOne({
      id: "u1", email: "asha@gmail.com", name: "Asha", passwordHash: "x", createdAt: old, plan: "free", crawlCount: 0,
    });
    await db.collection("pdf_files").insertMany([
      { userId: "u1", fileId: "f1", filename: "menu.pdf", docType: "pdf", status: "failed", error: "Scanned PDF", uploadedAt: old },
      { userId: "ghost", fileId: "f2", filename: "x.csv", docType: "csv", status: "failed", uploadedAt: old },
    ]);
    await db.collection("bookings").insertOne({ org_id: "u1", status: "needs_refund", updated_at: now });

    const q = await health.loadQueues(now);
    const f1 = q.failedDocuments.recent.find((f) => f.fileId === "f1");
    expect(f1).toMatchObject({ name: "menu.pdf", docType: "pdf", owner: { id: "u1", name: "Asha", email: "asha@gmail.com" } });
    const f2 = q.failedDocuments.recent.find((f) => f.fileId === "f2");
    expect(f2?.owner).toMatchObject({ id: "ghost", name: null, email: null });
    expect(q.needsRefund.recent[0].owner).toMatchObject({ name: "Asha" });
  });
});
