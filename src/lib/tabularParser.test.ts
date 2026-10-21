import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildSheet,
  coerceDate,
  coerceNumber,
  detectDocumentKind,
  parseCsv,
  parseTabular,
  renderRow,
  TABULAR_LIMITS,
  TabularParseError,
  type TabularColumn,
  type TabularSheet,
} from "@/lib/tabularParser";

const column = (sheet: TabularSheet, name: string): TabularColumn =>
  sheet.columns.find((c) => c.name === name)!;

describe("coerceNumber", () => {
  it.each([
    ["1,200.50", 1200.5],
    ["₹1,200", 1200],
    ["$3,400", 3400],
    ["Rs. 500", 500],
    ["12%", 12],
    ["(500)", -500],
    ["-7.25", -7.25],
    [42, 42],
  ])("reads %s as %s", (input, expected) => {
    expect(coerceNumber(input)).toBe(expected);
  });

  it.each(["C-0042", "abc", "12 apples", "", "1.2.3"])("rejects %s", (input) => {
    expect(coerceNumber(input)).toBeNull();
  });
});

describe("coerceDate", () => {
  it("normalizes common formats to ISO", () => {
    expect(coerceDate("2026-03-05")).toBe("2026-03-05");
    expect(coerceDate("2026-03-05 14:30")).toBe("2026-03-05T14:30:00");
    expect(coerceDate("05/03/2026", true)).toBe("2026-03-05");
    expect(coerceDate("05/03/2026", false)).toBe("2026-05-03");
    expect(coerceDate("5 March 2026")).toBe("2026-03-05");
    expect(coerceDate(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-03-05");
  });

  it("rejects impossible dates and non-dates", () => {
    expect(coerceDate("2026-02-30")).toBeNull();
    expect(coerceDate("31/13/2026", true)).toBeNull();
    expect(coerceDate("March")).toBeNull();
  });
});

describe("parseCsv", () => {
  const csv = [
    "﻿Order ID,Customer,Region,Revenue,Order Date,Paid,Notes,Region",
    'O-1,"Sharma, Priya",North,"₹1,200.50",05/03/2026,yes,,N1',
    "O-2,Arjun,South,$800,14/03/2026,no,rush,S1",
    "",
    ",,,,,,,",
    "O-3,Mei,North,(50),2026-04-01,yes,N/A,N2",
  ].join("\n");

  it("parses a header row, skips blank rows, and keys rows by safe keys", () => {
    const [sheet] = parseCsv(csv);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.columns.map((c) => c.key)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
    expect(sheet.rows[0].c1).toBe("Sharma, Priya");
  });

  it("de-duplicates repeated header names", () => {
    const [sheet] = parseCsv(csv);
    expect(sheet.columns.map((c) => c.name)).toContain("Region (2)");
  });

  it("infers column types and converts values", () => {
    const [sheet] = parseCsv(csv);
    expect(column(sheet, "Revenue").type).toBe("number");
    expect(sheet.rows.map((r) => r[column(sheet, "Revenue").key])).toEqual([1200.5, 800, -50]);
    expect(column(sheet, "Order Date").type).toBe("date");
    // 14/03 proves the column is day-first.
    expect(sheet.rows.map((r) => r[column(sheet, "Order Date").key])).toEqual(["2026-03-05", "2026-03-14", "2026-04-01"]);
    expect(column(sheet, "Paid").type).toBe("boolean");
    expect(column(sheet, "Order ID").type).toBe("string");
  });

  it("treats N/A and blanks as empty and keeps low-cardinality values", () => {
    const [sheet] = parseCsv(csv);
    const notes = column(sheet, "Notes");
    expect(notes.nullCount).toBe(2);
    expect(column(sheet, "Region").values).toEqual(["North", "South"]);
  });

  it("keeps codes with leading zeros as text", () => {
    const [sheet] = parseCsv("Pin,City\n00123,Pune\n45678,Delhi");
    expect(column(sheet, "Pin").type).toBe("string");
    expect(sheet.rows[0].c0).toBe("00123");
  });
});

describe("buildSheet", () => {
  it("names blank headers and drops empty columns", () => {
    const sheet = buildSheet("S", ["Name", "", "", "Score"], [["A", "x", null, 1], ["B", "y", "", 2]])!;
    expect(sheet.columns.map((c) => c.name)).toEqual(["Name", "Column 2", "Score"]);
  });

  it("returns null when there are no data rows", () => {
    expect(buildSheet("S", ["A", "B"], [[null, ""]])).toBeNull();
  });

  it("rejects sheets wider than the column limit", () => {
    const header = Array.from({ length: TABULAR_LIMITS.maxColumns + 1 }, (_, i) => `H${i}`);
    expect(() => buildSheet("S", header, [header.map(() => 1)])).toThrow(TabularParseError);
  });
});

describe("parseTabular (xlsx)", () => {
  async function workbookBuffer(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sales = wb.addWorksheet("Sales");
    sales.addRow(["Product", "Units", "Price", "Total", "Sold On"]);
    sales.addRow(["Widget", 3, 10, { formula: "B2*C2", result: 30 }, new Date(Date.UTC(2026, 2, 1))]);
    sales.addRow(["Gadget", 5, 20, { formula: "B3*C3", result: 100 }, new Date(Date.UTC(2026, 2, 15))]);
    const empty = wb.addWorksheet("Empty");
    empty.addRow(["Only header"]);
    const staff = wb.addWorksheet("Staff");
    staff.addRow([{ richText: [{ text: "Full " }, { text: "Name" }] }, "Team"]);
    staff.addRow(["Asha", "Ops"]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it("reads every non-empty sheet with formula results, dates and rich text", async () => {
    const buffer = await workbookBuffer();
    expect(detectDocumentKind("book.xlsx", buffer)).toBe("xlsx");

    const sheets = await parseTabular(buffer, "xlsx");
    expect(sheets.map((s) => s.name)).toEqual(["Sales", "Staff"]);

    const sales = sheets[0];
    expect(column(sales, "Total").type).toBe("number");
    expect(sales.rows.map((r) => r.c3)).toEqual([30, 100]);
    expect(column(sales, "Sold On").type).toBe("date");
    expect(sales.rows[1].c4).toBe("2026-03-15");
    expect(sheets[1].columns[0].name).toBe("Full Name");
  });

  it("rejects files over the row limit", async () => {
    const rows = Array.from({ length: TABULAR_LIMITS.maxRows + 1 }, (_, i) => `${i},x`).join("\n");
    await expect(parseTabular(Buffer.from(`n,v\n${rows}`), "csv")).rejects.toMatchObject({ status: 413 });
  });
});

describe("detectDocumentKind", () => {
  it("uses magic bytes before the extension", () => {
    expect(detectDocumentKind("report.csv", Buffer.from("%PDF-1.7"))).toBe("pdf");
    expect(detectDocumentKind("data.csv", Buffer.from("a,b\n1,2"))).toBe("csv");
    expect(detectDocumentKind("data.xlsx", Buffer.from("not a zip"))).toBeNull();
    expect(detectDocumentKind("archive.zip", Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    expect(detectDocumentKind("image.png", Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe("renderRow", () => {
  it("renders non-empty cells with column names", () => {
    const [sheet] = parseCsv("Name,Region,Revenue\nPriya,,1200");
    expect(renderRow(sheet.columns, sheet.rows[0], 7)).toBe("Row 7: Name: Priya; Revenue: 1200");
  });
});
