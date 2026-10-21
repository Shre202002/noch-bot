import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

const USER = "user-a";
const OTHER_USER = "user-b";
const FILE = "file-1";
const DAY = 24 * 60 * 60 * 1000;

let db: Db;
let retention: typeof import("@/lib/pdfRetention");
let collections: string[];

beforeAll(async () => {
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  retention = await import("@/lib/pdfRetention");
  const { PDF_VECTOR_COLLECTION } = await import("@/lib/vectorStore");
  const { TABULAR_ROWS_COLLECTION } = await import("@/lib/tabularQuery");
  db = await getDb();
  collections = [
    retention.PDF_FILES_COLLECTION,
    PDF_VECTOR_COLLECTION,
    TABULAR_ROWS_COLLECTION,
    retention.PDF_LINKS_COLLECTION,
    retention.PDF_LINK_USERS_COLLECTION,
  ];
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  for (const name of collections) await db.collection(name).deleteMany({});
  // The same fileId under two owners: deletes must stay inside one tenant.
  for (const userId of [USER, OTHER_USER]) {
    await db.collection(retention.PDF_FILES_COLLECTION).insertOne({ userId, fileId: FILE, filename: "a.pdf" });
    await db.collection(collections[1]).insertMany([{ userId, fileId: FILE, text: "1" }, { userId, fileId: FILE, text: "2" }]);
    await db.collection(collections[2]).insertOne({ userId, fileId: FILE, rowIndex: 0 });
    await db.collection(retention.PDF_LINKS_COLLECTION).insertOne({ userId, fileId: FILE, slug: `slug-${userId}` });
    await db.collection(retention.PDF_LINK_USERS_COLLECTION).insertOne({ userId, fileId: FILE, slug: `slug-${userId}`, loginId: "viewer" });
  }
});

describe("softDeletePdf", () => {
  it("marks every record of the file with deletedAt and a purgeAt 7 days out", async () => {
    const now = new Date("2026-10-08T10:00:00Z");
    const result = await retention.softDeletePdf(db, USER, FILE, now);

    expect(result?.purgeAt.getTime()).toBe(now.getTime() + retention.PDF_RETENTION_DAYS * DAY);
    for (const name of collections) {
      const docs = await db.collection(name).find({ userId: USER, fileId: FILE }).toArray();
      expect(docs.length).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(doc.deletedAt).toEqual(now);
        expect(doc.purgeAt).toEqual(result?.purgeAt);
      }
    }
  });

  it("leaves another tenant's records with the same fileId untouched", async () => {
    await retention.softDeletePdf(db, USER, FILE);
    for (const name of collections) {
      const marked = await db.collection(name).countDocuments({ userId: OTHER_USER, deletedAt: { $exists: true } });
      expect(marked).toBe(0);
    }
  });

  it("hides the file and its share link from live lookups", async () => {
    await retention.softDeletePdf(db, USER, FILE);
    const file = await db.collection(retention.PDF_FILES_COLLECTION).findOne({ userId: USER, fileId: FILE, ...retention.NOT_DELETED });
    const link = await db.collection(retention.PDF_LINKS_COLLECTION).findOne({ slug: `slug-${USER}`, ...retention.NOT_DELETED });
    expect(file).toBeNull();
    expect(link).toBeNull();
  });

  it("returns null for an unknown or already deleted file", async () => {
    expect(await retention.softDeletePdf(db, USER, "missing")).toBeNull();
    await retention.softDeletePdf(db, USER, FILE);
    expect(await retention.softDeletePdf(db, USER, FILE)).toBeNull();
  });
});

describe("restorePdf", () => {
  it("unmarks every record inside the retention window", async () => {
    const deletedAt = new Date("2026-10-08T10:00:00Z");
    await retention.softDeletePdf(db, USER, FILE, deletedAt);

    const result = await retention.restorePdf(db, USER, FILE, new Date(deletedAt.getTime() + 3 * DAY));
    expect(result).toEqual({ restored: true });
    for (const name of collections) {
      const marked = await db.collection(name).countDocuments({ userId: USER, $or: [{ deletedAt: { $exists: true } }, { purgeAt: { $exists: true } }] });
      expect(marked).toBe(0);
    }
  });

  it("refuses once purgeAt has passed", async () => {
    const deletedAt = new Date("2026-10-08T10:00:00Z");
    await retention.softDeletePdf(db, USER, FILE, deletedAt);
    expect(await retention.restorePdf(db, USER, FILE, new Date(deletedAt.getTime() + 8 * DAY))).toBeNull();
  });

  it("returns null for a live or unknown file", async () => {
    expect(await retention.restorePdf(db, USER, FILE)).toBeNull();
    expect(await retention.restorePdf(db, USER, "missing")).toBeNull();
  });
});

describe("ensurePdfRetentionIndexes", () => {
  it("creates a purgeAt TTL index on every document collection", async () => {
    await retention.ensurePdfRetentionIndexes(db);
    for (const name of collections) {
      const indexes = await db.collection(name).indexes();
      const ttl = indexes.find((ix) => ix.key.purgeAt === 1);
      expect(ttl?.expireAfterSeconds).toBe(0);
    }
  });
});
