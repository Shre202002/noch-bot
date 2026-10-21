import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { buildSheet, type TabularSheet } from "@/lib/tabularParser";
import type { StoredSheet } from "@/lib/tabularQuery";

const USER = "owner-1";
const FILE = "catalog-1";

let db: Db;
let lib: typeof import("@/lib/tabularLibrary");

function sheet(header: string[], rows: unknown[][]): TabularSheet {
  return buildSheet("Sheet1", header, rows)!;
}

/** Store a sheet the way ingestTabular does, returning its StoredSheet. */
async function seed(s: TabularSheet, idColumnKey?: string): Promise<StoredSheet> {
  await db.collection("tabular_rows").insertMany(
    s.rows.map((data, i) => ({ userId: USER, fileId: FILE, sheet: s.name, rowIndex: i, data, needsEmbedding: new Date(0) }))
  );
  if (idColumnKey) await lib.backfillRowKeys(db, { userId: USER, fileId: FILE, sheet: s.name, idColumnKey });
  return { name: s.name, rowCount: s.rows.length, columns: s.columns, idColumnKey };
}

const rows = () => db.collection("tabular_rows").find({ userId: USER, fileId: FILE }).sort({ rowIndex: 1 }).toArray();

beforeAll(async () => {
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  lib = await import("@/lib/tabularLibrary");
  db = await getDb();
  await lib.ensureLibraryIndexes(db);
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await db.collection("tabular_rows").deleteMany({});
});

describe("mergeColumns", () => {
  it("matches headers case- and space-insensitively and appends new columns with fresh keys", () => {
    const existing = sheet(["SKU", "Product Name", "Price"], [["A1", "Tent", 100]]).columns;
    const incoming = sheet(["sku", "product  name", "Price", "Warranty"], [["A2", "Lamp", 20, "1 year"]]).columns;
    const { columns, mapping, newColumns } = lib.mergeColumns(existing, incoming);

    expect(newColumns).toEqual(["Warranty"]);
    expect(columns.map((c) => c.key)).toEqual(["c0", "c1", "c2", "c3"]);
    expect(mapping.get("c1")?.key).toBe("c1");
    expect(mapping.get("c3")?.name).toBe("Warranty");
  });
});

describe("castToColumn", () => {
  it("coerces into the library column's type and reports what cannot fit", () => {
    const [price] = sheet(["Price"], [[10]]).columns;
    expect(lib.castToColumn(price, "₹1,250")).toBe(1250);
    expect(lib.castToColumn(price, "call us")).toBeUndefined();
    expect(lib.castToColumn(price, null)).toBeNull();
  });
});

describe("appendRows", () => {
  it("updates products by ID, keeps unchanged ones untouched, adds new ones after the last row", async () => {
    const target = await seed(sheet(["SKU", "Name", "Price"], [["A1", "Tent", 100], ["A2", "Stove", 50]]), "c0");
    const incoming = sheet(["SKU", "Name", "Price"], [["a1", "Tent", 120], ["A2", "Stove", 50], ["A3", "Mat", 30]]);

    const { summary } = await lib.appendRows(db, { userId: USER, fileId: FILE, target, idColumnKey: "c0", incoming, now: new Date(1000) });

    expect(summary).toMatchObject({ added: 1, updated: 1, unchanged: 1, uncastable: 0, rowCount: 3 });
    const stored = await rows();
    expect(stored.map((r) => r.data.c2)).toEqual([120, 50, 30]);
    expect(stored[2].rowIndex).toBe(2);
    expect(stored[2].rowKey).toBe("a3");
    // Only the changed and the new row need a new embedding.
    expect(stored.map((r) => (r.needsEmbedding as Date).getTime())).toEqual([1000, 0, 1000]);
  });

  it("keeps existing values for columns the batch does not have and adds new columns", async () => {
    const target = await seed(sheet(["SKU", "Name", "Price"], [["A1", "Tent", 100]]), "c0");
    const incoming = sheet(["SKU", "Warranty"], [["A1", "2 years"]]);

    const { summary, columns } = await lib.appendRows(db, { userId: USER, fileId: FILE, target, idColumnKey: "c0", incoming });

    expect(summary.newColumns).toEqual(["Warranty"]);
    expect(columns.map((c) => c.name)).toEqual(["SKU", "Name", "Price", "Warranty"]);
    const [row] = await rows();
    expect(row.data).toMatchObject({ c0: "A1", c1: "Tent", c2: 100, c3: "2 years" });
  });

  it("appends every row when there is no ID column, and the last duplicate in a batch wins", async () => {
    const target = await seed(sheet(["SKU", "Price"], [["A1", 10]]));
    const plain = await lib.appendRows(db, { userId: USER, fileId: FILE, target, incoming: sheet(["SKU", "Price"], [["A1", 10]]) });
    expect(plain.summary.added).toBe(1);

    await db.collection("tabular_rows").deleteMany({});
    const keyed = await seed(sheet(["SKU", "Price"], [["A1", 10]]), "c0");
    const dup = await lib.appendRows(db, {
      userId: USER, fileId: FILE, target: keyed, idColumnKey: "c0",
      incoming: sheet(["SKU", "Price"], [["B1", 1], ["B1", 2]]),
    });
    expect(dup.summary.added).toBe(1);
    expect((await rows()).find((r) => r.rowKey === "b1")?.data.c1).toBe(2);
  });

  it("counts values that don't fit the column type", async () => {
    const target = await seed(sheet(["SKU", "Price"], [["A1", 10]]), "c0");
    const { summary } = await lib.appendRows(db, {
      userId: USER, fileId: FILE, target, idColumnKey: "c0",
      incoming: sheet(["SKU", "Price"], [["A2", "ask"]]),
    });
    expect(summary.uncastable).toBe(1);
    expect((await rows())[1].data.c1).toBeNull();
  });
});

describe("refreshColumnStats", () => {
  it("recomputes counts and category values from the stored rows", async () => {
    const target = await seed(sheet(["SKU", "Category"], [["A1", "Tent"]]), "c0");
    const { columns } = await lib.appendRows(db, {
      userId: USER, fileId: FILE, target, idColumnKey: "c0",
      incoming: sheet(["SKU", "Category"], [["A2", "Lamp"]]),
    });
    const refreshed = await lib.refreshColumnStats(db, { userId: USER, fileId: FILE, sheetName: "Sheet1", columns });
    expect(refreshed.rowCount).toBe(2);
    expect(refreshed.columns[1].values).toEqual(["Lamp", "Tent"]);
  });
});

describe("rowEmbeddingText", () => {
  it("renders non-empty cells as 'Column: value' without a row number", () => {
    const s = sheet(["Name", "Price", "Notes"], [["Tent", 100, null]]);
    expect(lib.rowEmbeddingText(s.columns, s.rows[0])).toBe("Name: Tent; Price: 100");
  });
});

describe("embedPendingRows", () => {
  it("embeds queued rows in slices, clears their flag and reports what is left", async () => {
    const s = sheet(["Name"], Array.from({ length: 5 }, (_, i) => [`Item ${i}`]));
    const stored = await seed(s);
    const seen: string[][] = [];
    const fake = async (texts: string[]) => {
      seen.push(texts);
      return texts.map(() => Array.from({ length: 4 }, () => 0.5));
    };

    const first = await lib.embedPendingRows(db, { userId: USER, fileId: FILE, sheets: [stored], maxRows: 3, embed: fake });
    expect(first).toEqual({ embedded: 3, remaining: 2 });
    expect(seen[0][0]).toBe("Name: Item 0");

    const second = await lib.embedPendingRows(db, { userId: USER, fileId: FILE, sheets: [stored], embed: fake });
    expect(second).toEqual({ embedded: 2, remaining: 0 });
    const done = await rows();
    expect(done.every((r) => r.needsEmbedding === undefined && r.embedding)).toBe(true);
  });

  it("stops early on a rate limit and keeps the rows queued", async () => {
    const { EmbeddingRateLimitError } = await import("@/lib/embeddings");
    const stored = await seed(sheet(["Name"], [["Tent"]]));
    const limited = async () => { throw new EmbeddingRateLimitError(); };

    const result = await lib.embedPendingRows(db, { userId: USER, fileId: FILE, sheets: [stored], embed: limited });
    expect(result).toEqual({ embedded: 0, remaining: 1, retryAfterMs: 30_000 });
  });

  it("re-queues a row that changed while it was being embedded", async () => {
    const stored = await seed(sheet(["Name"], [["Tent"]]));
    const racing = async (texts: string[]) => {
      await db.collection("tabular_rows").updateOne({ fileId: FILE }, { $set: { needsEmbedding: new Date(5000) } });
      return texts.map(() => [1, 0]);
    };
    const result = await lib.embedPendingRows(db, { userId: USER, fileId: FILE, sheets: [stored], embed: racing });
    expect(result.remaining).toBe(1);
  });
});
