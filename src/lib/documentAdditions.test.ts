import { describe, it, expect } from "vitest";
import { buildSheet } from "@/lib/tabularParser";
import {
  additionKindError,
  additionLimitError,
  additionLimitFor,
  fileSizeError,
  sheetFormatError,
} from "@/lib/documentAdditions";

const columns = (header: string[]) => buildSheet("Sheet1", header, [header.map(() => "x")])!.columns;

describe("additionKindError", () => {
  it("allows only the same kind: PDF to PDF, CSV/Excel to spreadsheets", () => {
    expect(additionKindError("pdf", "pdf")).toBeNull();
    expect(additionKindError(undefined, "pdf")).toBeNull(); // older PDF records have no docType
    expect(additionKindError("csv", "xlsx")).toBeNull();
    expect(additionKindError("xlsx", "csv")).toBeNull();
    expect(additionKindError("pdf", "csv")).toMatch(/only PDF files/);
    expect(additionKindError("xlsx", "pdf")).toMatch(/only CSV or Excel/);
    expect(additionKindError("csv", null)).toMatch(/Only PDF, CSV and Excel/);
  });
});

describe("plan limits", () => {
  it("allows Free 1, Starter 3, Pro 5 additional files, unknown plans as Free", () => {
    expect([additionLimitFor("free"), additionLimitFor("starter"), additionLimitFor("pro")]).toEqual([1, 3, 5]);
    expect(additionLimitFor("enterprise-trial")).toBe(1);
    expect(additionLimitFor(undefined)).toBe(1);
  });

  it("refuses once the plan's files are used, with an upgrade hint", () => {
    expect(additionLimitError("free", 0)).toBeNull();
    expect(additionLimitError("free", 1)).toMatch(/Free plan allows 1 additional file .*Upgrade/);
    expect(additionLimitError("starter", 2)).toBeNull();
    expect(additionLimitError("starter", 3)).toMatch(/Starter plan allows 3 additional files/);
    expect(additionLimitError("pro", 5)).toMatch(/Pro plan allows 5/);
  });
});

describe("fileSizeError", () => {
  it("caps each added file at 10 MB", () => {
    expect(fileSizeError(10 * 1024 * 1024)).toBeNull();
    expect(fileSizeError(10 * 1024 * 1024 + 1)).toMatch(/larger than 10 MB/);
  });
});

describe("sheetFormatError", () => {
  const catalog = columns(["SKU", "Product Name", "Price", "Category"]);

  it("accepts a sheet whose headers mostly match, ignoring case and spacing, with new columns allowed", () => {
    expect(sheetFormatError(catalog, columns(["sku", "product  name", "Price", "Warranty"]), "c0")).toBeNull();
  });

  it("refuses an unrelated sheet and names unmatched headers", () => {
    const employees = columns(["employee_code", "first_name", "department", "Price"]);
    const err = sheetFormatError(catalog, employees);
    expect(err).toMatch(/only 1 of 4 headers match/);
    expect(err).toMatch(/employee_code/);
  });

  it("requires the document's ID column when one is set", () => {
    const noSku = columns(["Product Name", "Price", "Category"]);
    expect(sheetFormatError(catalog, noSku, "c0")).toMatch(/no "SKU" column/);
    expect(sheetFormatError(catalog, noSku)).toBeNull();
  });
});
