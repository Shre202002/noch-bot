import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import {
  COUNTS_TOWARD_LIMIT,
  deriveStatus,
  INTERRUPTED_MESSAGE,
  isRetrievable,
  PARSING_STALE_MS,
  safeFailureMessage,
} from "@/lib/pdfStatus";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("deriveStatus", () => {
  it("treats legacy PDFs without a status as ready", () => {
    expect(deriveStatus({ docType: undefined }, NOW)).toEqual({ status: "ready" });
    expect(deriveStatus({ docType: "pdf" }, NOW)).toEqual({ status: "ready" });
  });

  it("shows a spreadsheet as indexed until every row is embedded, then ready", () => {
    expect(deriveStatus({ docType: "csv", status: "indexed", rowVectors: "indexing" }, NOW).status).toBe("indexed");
    expect(deriveStatus({ docType: "xlsx", status: "indexed", rowVectors: "ready" }, NOW).status).toBe("ready");
    expect(deriveStatus({ docType: "csv", rowVectors: null }, NOW).status).toBe("indexed");
  });

  it("keeps a recent parsing record as parsing", () => {
    expect(deriveStatus({ status: "parsing", uploadedAt: ago(30_000) }, NOW)).toEqual({ status: "parsing" });
  });

  it("reports a stale parsing record as failed", () => {
    expect(deriveStatus({ status: "parsing", uploadedAt: ago(PARSING_STALE_MS + 1000) }, NOW)).toEqual({
      status: "failed",
      error: INTERRUPTED_MESSAGE,
    });
  });

  it("passes the stored error of a failed record through, with a fallback", () => {
    expect(deriveStatus({ status: "failed", error: "Scanned PDF" }, NOW)).toEqual({ status: "failed", error: "Scanned PDF" });
    expect(deriveStatus({ status: "failed" }, NOW).error).toMatch(/retry/i);
  });
});

describe("helpers", () => {
  it("only indexed and ready documents are retrievable", () => {
    expect(isRetrievable("ready")).toBe(true);
    expect(isRetrievable("indexed")).toBe(true);
    expect(isRetrievable("parsing")).toBe(false);
    expect(isRetrievable("failed")).toBe(false);
  });

  it("keeps parse problems and hides internal errors", () => {
    expect(safeFailureMessage(new Error("Could not extract text from this PDF. It may be scanned/image-only."))).toMatch(/scanned/);
    expect(safeFailureMessage(new Error("MongoServerError: connect ECONNREFUSED 10.0.0.5:27017"))).not.toMatch(/ECONNREFUSED/);
    expect(safeFailureMessage("boom")).toMatch(/retry/i);
  });
});

describe("failed records in Mongo", () => {
  const USER = "user-a";
  const OTHER = "user-b";
  let db: Db;
  let status: typeof import("@/lib/pdfStatus");

  beforeAll(async () => {
    await startTestMongo();
    const { getDb } = await import("@/lib/db");
    status = await import("@/lib/pdfStatus");
    db = await getDb();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  beforeEach(async () => {
    await db.collection("pdf_files").deleteMany({});
    await db.collection("nochbot_pdf_chunks").deleteMany({});
    await db.collection("nochbot_chunks").deleteMany({});
    await db.collection("tabular_rows").deleteMany({});
  });

  it("failed uploads do not count toward the plan limit", async () => {
    await db.collection("pdf_files").insertMany([
      { userId: USER, fileId: "f1", status: "failed" },
      { userId: USER, fileId: "f2", status: "ready" },
      { userId: USER, fileId: "f3" },
    ]);
    expect(await db.collection("pdf_files").countDocuments({ userId: USER, ...COUNTS_TOWARD_LIMIT })).toBe(2);
  });

  it("purges a failed record and its leftovers, only for its owner", async () => {
    await db.collection("pdf_files").insertMany([
      { userId: USER, fileId: "f1", status: "failed" },
      { userId: OTHER, fileId: "f1", status: "failed" },
    ]);
    await db.collection("nochbot_pdf_chunks").insertMany([
      { userId: USER, fileId: "f1", text: "x" },
      { userId: OTHER, fileId: "f1", text: "x" },
    ]);

    expect(await status.purgeFailedFile(db, USER, "f1")).toBe(true);
    expect(await db.collection("pdf_files").countDocuments({ userId: USER })).toBe(0);
    expect(await db.collection("nochbot_pdf_chunks").countDocuments({ userId: USER })).toBe(0);
    expect(await db.collection("pdf_files").countDocuments({ userId: OTHER })).toBe(1);
    expect(await db.collection("nochbot_pdf_chunks").countDocuments({ userId: OTHER })).toBe(1);
  });

  it("never purges a live document, or website knowledge", async () => {
    await db.collection("pdf_files").insertOne({ userId: USER, fileId: "live", status: "ready" });
    await db.collection("nochbot_pdf_chunks").insertOne({ userId: USER, fileId: "live", text: "x" });
    await db.collection("nochbot_chunks").insertOne({ userId: USER, text: "site" });

    expect(await status.purgeFailedFile(db, USER, "live")).toBe(false);
    expect(await db.collection("pdf_files").countDocuments({ userId: USER })).toBe(1);
    expect(await db.collection("nochbot_pdf_chunks").countDocuments({ userId: USER })).toBe(1);
    expect(await db.collection("nochbot_chunks").countDocuments({ userId: USER })).toBe(1);
  });

  it("purges a stale parsing record but not a recent one", async () => {
    const now = new Date();
    await db.collection("pdf_files").insertMany([
      { userId: USER, fileId: "stale", status: "parsing", uploadedAt: new Date(now.getTime() - PARSING_STALE_MS - 1000).toISOString() },
      { userId: USER, fileId: "fresh", status: "parsing", uploadedAt: now.toISOString() },
    ]);
    expect(await status.purgeFailedFile(db, USER, "stale", now)).toBe(true);
    expect(await status.purgeFailedFile(db, USER, "fresh", now)).toBe(false);
  });

  it("markFailed records the error without touching other documents", async () => {
    await db.collection("pdf_files").insertMany([
      { userId: USER, fileId: "a", status: "parsing" },
      { userId: USER, fileId: "b", status: "ready" },
    ]);
    await status.markFailed(db, USER, "a", "Scanned PDF");
    expect(await db.collection("pdf_files").findOne({ fileId: "a" })).toMatchObject({ status: "failed", error: "Scanned PDF" });
    expect(await db.collection("pdf_files").findOne({ fileId: "b" })).toMatchObject({ status: "ready" });
  });
});
