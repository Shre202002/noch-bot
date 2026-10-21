import { describe, it, expect } from "vitest";
import { buildCitations, formatCitations } from "@/lib/pdfCitations";

describe("buildCitations", () => {
  it("groups passages by document and sorts unique pages", () => {
    const citations = buildCitations([
      { filename: "guide.pdf", pageStart: 5, pageEnd: 6 },
      { filename: "guide.pdf", pageStart: 3, pageEnd: 3 },
      { filename: "guide.pdf", pageStart: 3, pageEnd: 3 },
      { filename: "faq.pdf", pageStart: 1, pageEnd: 1 },
    ]);
    expect(citations).toEqual([
      { filename: "guide.pdf", pages: "3, 5-6" },
      { filename: "faq.pdf", pages: "1" },
    ]);
  });

  it("cites the document alone when passages have no page numbers", () => {
    expect(buildCitations([{ filename: "sheet.csv" }])).toEqual([{ filename: "sheet.csv", pages: null }]);
  });

  it("falls back to an unknown file name and ignores non-numeric pages", () => {
    expect(buildCitations([{ pageStart: "2" }])).toEqual([{ filename: "Unknown file", pages: null }]);
  });

  it("sorts pages numerically, not as text", () => {
    expect(buildCitations([
      { filename: "a.pdf", pageStart: 10, pageEnd: 10 },
      { filename: "a.pdf", pageStart: 2, pageEnd: 2 },
    ])[0].pages).toBe("2, 10");
  });
});

describe("formatCitations", () => {
  it("renders one line, with pages when known", () => {
    expect(formatCitations([{ filename: "guide.pdf", pages: "3, 5-6" }, { filename: "faq.pdf", pages: null }])).toBe(
      "Sources: guide.pdf (p. 3, 5-6); faq.pdf"
    );
  });

  it("is empty with nothing to cite", () => {
    expect(formatCitations([])).toBe("");
  });
});
