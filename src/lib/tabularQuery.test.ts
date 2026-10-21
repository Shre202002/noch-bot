import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";
import { getDb } from "@/lib/db";
import { parseCsv } from "@/lib/tabularParser";
import {
  buildPipeline,
  resultToMarkdown,
  plannerPrompt,
  runPlan,
  semanticRowsToResult,
  splitFilters,
  TABULAR_ROWS_COLLECTION,
  validatePlan,
  type StoredSheet,
  type ValidPlan,
} from "@/lib/tabularQuery";

const CSV = [
  "Order ID,Region,Product,Units,Revenue,Order Date",
  "O-1,North,Widget,3,300,2026-03-02",
  "O-2,South,Widget,1,100,2026-03-10",
  "O-3,North,Gadget,2,500,2026-03-15",
  "O-4,East,Gadget,4,1000,2026-04-01",
  "O-5,North,Widget,5,500,2026-04-20",
  "O-6,South,Gizmo (v2),1,50,2026-04-21",
].join("\n");

const [parsed] = parseCsv(CSV);
const sheet: StoredSheet = { name: parsed.name, rowCount: parsed.rows.length, columns: parsed.columns };
const sheets = [sheet];

function plan(raw: Record<string, unknown>): ValidPlan {
  const decision = validatePlan({ mode: "query", ...raw }, sheets);
  if (decision.mode !== "query") throw new Error(`expected a query plan for ${JSON.stringify(raw)}`);
  return decision.plan;
}

describe("validatePlan", () => {
  it("accepts column names or keys, case-insensitively", () => {
    const p = plan({ filters: [{ column: "region", op: "eq", value: "North" }], aggregations: [{ op: "sum", column: "c4" }] });
    expect(p.filters[0].column.name).toBe("Region");
    expect(p.aggregations[0].label).toBe("sum of Revenue");
  });

  it.each([
    ["unknown column", { filters: [{ column: "Profit", op: "eq", value: 1 }] }],
    ["unknown filter op", { filters: [{ column: "Region", op: "$where", value: "1" }] }],
    ["unknown aggregation", { aggregations: [{ op: "$function", column: "Units" }] }],
    ["object value (operator injection)", { filters: [{ column: "Region", op: "eq", value: { $ne: null } }] }],
    ["sum of a text column", { aggregations: [{ op: "sum", column: "Region" }] }],
    ["number that cannot be cast", { filters: [{ column: "Units", op: "gt", value: "lots" }] }],
    ["contains on a number column", { filters: [{ column: "Units", op: "contains", value: "1" }] }],
  ])("falls back to lookup for %s", (_, raw) => {
    expect(validatePlan({ mode: "query", ...raw }, sheets)).toEqual({ mode: "lookup" });
  });

  it("falls back to lookup for non-query or malformed replies", () => {
    expect(validatePlan({ mode: "lookup" }, sheets)).toEqual({ mode: "lookup" });
    expect(validatePlan("DROP TABLE", sheets)).toEqual({ mode: "lookup" });
    expect(validatePlan(null, sheets)).toEqual({ mode: "lookup" });
  });

  it("caps the limit and defaults grouping to a count sorted descending", () => {
    const p = plan({ groupBy: ["Region"], limit: 5000 });
    expect(p.limit).toBe(100);
    expect(p.aggregations).toEqual([{ op: "count", label: "count" }]);
    expect(p.sort).toEqual({ field: "count", dir: -1 });
  });
});

describe("buildPipeline", () => {
  it("always scopes to the owner, file and sheet first", () => {
    const pipeline = buildPipeline(plan({ aggregations: [{ op: "count" }] }), "user-a", "file-1");
    expect(pipeline[0]).toEqual({ $match: { userId: "user-a", fileId: "file-1", sheet: "Sheet1" } });
  });

  it("escapes regex characters in contains filters", () => {
    const pipeline = buildPipeline(
      plan({ filters: [{ column: "Product", op: "contains", value: "(v2)" }] }),
      "u", "f"
    );
    expect(pipeline[0].$match.$and[0]).toEqual({ "data.c2": { $regex: "\\(v2\\)", $options: "i" } });
  });

  it("uses only safe storage keys as field paths", () => {
    const pipeline = buildPipeline(plan({ groupBy: ["Region"], aggregations: [{ op: "sum", column: "Revenue" }] }), "u", "f");
    expect(JSON.stringify(pipeline)).not.toMatch(/Region|Revenue/);
  });
});

describe("runPlan", () => {
  beforeAll(async () => {
    await startTestMongo();
    const db = await getDb();
    const docs = (userId: string, fileId: string) =>
      parsed.rows.map((data, rowIndex) => ({ userId, fileId, sheet: "Sheet1", rowIndex, data }));
    await db.collection(TABULAR_ROWS_COLLECTION).insertMany([...docs("user-a", "file-1"), ...docs("user-b", "file-2")]);
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("sums revenue by region exactly", async () => {
    const result = await runPlan(
      plan({ groupBy: ["Region"], aggregations: [{ op: "sum", column: "Revenue" }], sort: { by: "sum of Revenue", dir: "desc" } }),
      "user-a", "file-1"
    );
    expect(result.labels).toEqual(["Region", "sum of Revenue"]);
    expect(result.rows).toEqual([["North", 1300], ["East", 1000], ["South", 150]]);
    expect(result.totalMatched).toBe(6);
  });

  it("counts rows in a month using startsWith on an ISO date", async () => {
    const result = await runPlan(
      plan({ filters: [{ column: "Order Date", op: "startsWith", value: "2026-03" }], aggregations: [{ op: "count" }] }),
      "user-a", "file-1"
    );
    expect(result.rows).toEqual([[3]]);
  });

  it("ranks products by units with a limit", async () => {
    const result = await runPlan(
      plan({ groupBy: ["Product"], aggregations: [{ op: "sum", column: "Units" }], sort: { by: "sum", dir: "desc" }, limit: 2 }),
      "user-a", "file-1"
    );
    expect(result.rows).toEqual([["Widget", 9], ["Gadget", 6]]);
  });

  it("matches text filters case-insensitively and lists rows", async () => {
    const result = await runPlan(
      plan({ filters: [{ column: "Region", op: "eq", value: "north" }, { column: "Revenue", op: "gte", value: "500" }] }),
      "user-a", "file-1"
    );
    expect(result.rows.map((r) => r[0])).toEqual(["O-3", "O-5"]);
  });

  it("computes avg, min, max and distinctCount", async () => {
    const result = await runPlan(
      plan({
        aggregations: [
          { op: "avg", column: "Revenue" },
          { op: "min", column: "Order Date" },
          { op: "max", column: "Units" },
          { op: "distinctCount", column: "Product" },
        ],
      }),
      "user-a", "file-1"
    );
    expect(result.rows).toEqual([[408.33, "2026-03-02", 5, 3]]);
  });

  it("never returns another account's rows", async () => {
    const result = await runPlan(plan({ aggregations: [{ op: "count" }] }), "user-a", "file-2");
    expect(result.rows).toEqual([]);
    expect(result.totalMatched).toBe(0);
  });

  it("renders results as a Markdown table", async () => {
    const result = await runPlan(plan({ groupBy: ["Region"], sort: { by: "Region", dir: "asc" } }), "user-a", "file-1");
    expect(resultToMarkdown(result)).toBe(
      "| Region | count |\n| --- | --- |\n| East | 1 |\n| North | 3 |\n| South | 2 |"
    );
  });
});

describe("semantic plans", () => {
  it("keeps a trimmed semantic phrase on row-listing plans and defaults to 10 rows", () => {
    const p = plan({ filters: [{ column: "Revenue", op: "lt", value: 600 }], semantic: "  good for a small shop  " });
    expect(p.semantic).toBe("good for a small shop");
    expect(p.limit).toBe(10);
  });

  it("drops semantic on grouped or aggregated plans", () => {
    const p = plan({ groupBy: ["Region"], semantic: "anything" });
    expect(p.semantic).toBeUndefined();
  });

  it("only mentions semantic in the planner prompt when meaning search is available", () => {
    expect(plannerPrompt(sheets)).not.toContain('"semantic"');
    expect(plannerPrompt(sheets, { semantic: true })).toContain('"semantic"');
  });

  it("pre-filters numbers inside the vector search and matches text afterwards", () => {
    const p = plan({
      filters: [
        { column: "Revenue", op: "lt", value: 600 },
        { column: "Revenue", op: "gte", value: 100 },
        { column: "Region", op: "eq", value: "north" },
        { column: "Product", op: "contains", value: "Gad" },
      ],
      semantic: "best seller",
    });
    const { prefilter, post } = splitFilters(p, 50);
    expect(prefilter).toEqual({ "data.c4": { $lt: 600, $gte: 100 } });
    expect(post.$and).toHaveLength(2);
  });

  it("matches columns past the index limit afterwards", () => {
    const p = plan({ filters: [{ column: "Revenue", op: "lt", value: 600 }], semantic: "x" });
    const { prefilter, post } = splitFilters(p, 4); // c4 is beyond c0..c3
    expect(prefilter).toEqual({});
    expect(post.$and).toEqual([{ "data.c4": { $lt: 600 } }]);
  });

  it("keeps relevance order unless the plan asks for a sort", () => {
    const hits = [{ data: { c1: "North", c4: 500 } }, { data: { c1: "South", c4: 100 } }];
    const ranked = semanticRowsToResult(plan({ semantic: "x" }), hits);
    expect(ranked.rows.map((r) => r[4])).toEqual([500, 100]);

    const cheapest = semanticRowsToResult(plan({ semantic: "x", sort: { by: "Revenue", dir: "asc" } }), hits);
    expect(cheapest.rows.map((r) => r[4])).toEqual([100, 500]);
  });
});
