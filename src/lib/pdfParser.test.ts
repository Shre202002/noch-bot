import { describe, expect, it } from "vitest";
import { chunkPages } from "@/lib/pdfParser";

// Distinct numbered sentences so overlap and ordering can be asserted exactly.
function sentences(from: number, count: number, wordsEach = 10): string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = from + i;
    const filler = Array.from({ length: wordsEach - 2 }, () => "word").join(" ");
    return `Sentence S${n} ${filler}.`;
  });
}

/** Lay sentences out the way unpdf returns a page: one visual line per ~12 words. */
function page(lines: string[]): string {
  return lines.join("\n");
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe("chunkPages", () => {
  it("splits a long page with no blank lines into bounded chunks", () => {
    const chunks = chunkPages([page(sentences(1, 100))], { wordsPerChunk: 100, overlapWords: 20 });

    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) {
      expect(words(chunk.text)).toBeLessThanOrEqual(100);
    }
    expect(chunks.every((c) => c.totalChunks === chunks.length)).toBe(true);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it("keeps every sentence and splits only on sentence boundaries", () => {
    const chunks = chunkPages([page(sentences(1, 60))], { wordsPerChunk: 100, overlapWords: 20 });
    const all = chunks.map((c) => c.text).join(" ");

    for (let n = 1; n <= 60; n++) expect(all).toContain(`S${n} `);
    for (const chunk of chunks) {
      expect(chunk.text).toMatch(/^Sentence S\d+ /);
      expect(chunk.text).toMatch(/\.$/);
    }
  });

  it("carries trailing sentences into the next chunk as overlap", () => {
    const chunks = chunkPages([page(sentences(1, 30))], { wordsPerChunk: 100, overlapWords: 20 });

    // 10-word sentences: chunk 0 = S1..S10, then two sentences of overlap.
    expect(chunks[0].text).toMatch(/S10 .*\.$/);
    expect(chunks[1].text.startsWith("Sentence S9 ")).toBe(true);
    expect(chunks[1].text).toContain("S10 ");
  });

  it("records the page range of each chunk", () => {
    const chunks = chunkPages(
      [page(sentences(1, 6)), page(sentences(7, 6)), page(sentences(13, 6))],
      { wordsPerChunk: 100, overlapWords: 0 }
    );

    expect(chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 2 });
    expect(chunks[1]).toMatchObject({ pageStart: 2, pageEnd: 3 });
    expect(chunks[chunks.length - 1].pageEnd).toBe(3);
  });

  it("does not leave a heading at the end of a chunk", () => {
    const pageText = page([...sentences(1, 9), "2. INSTALLATION", ...sentences(10, 5)]);
    const chunks = chunkPages([pageText], { wordsPerChunk: 100, overlapWords: 0 });

    expect(chunks[0].markdown).not.toMatch(/## 2\. INSTALLATION\s*$/);
    const withHeading = chunks.find((c) => c.markdown.includes("## 2. INSTALLATION"));
    expect(withHeading?.markdown).toMatch(/## 2\. INSTALLATION\n\nSentence S10 /);
  });

  it("formats headings and bullets as Markdown", () => {
    const chunks = chunkPages([
      page(["PRODUCT MANUAL", "Overview of the device features.", "• Wi-Fi support", "• Battery backup", "▪ Voice control"]),
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].markdown).toBe(
      "## PRODUCT MANUAL\n\nOverview of the device features.\n\n- Wi-Fi support\n- Battery backup\n- Voice control"
    );
    expect(chunks[0].text).toBe("PRODUCT MANUAL Overview of the device features. Wi-Fi support Battery backup Voice control");
  });

  it("splits a single oversized run of text with no punctuation", () => {
    const table = Array.from({ length: 250 }, (_, i) => `cell${i}`).join(" ");
    const chunks = chunkPages([table], { wordsPerChunk: 100, overlapWords: 0 });

    expect(chunks.map((c) => words(c.text))).toEqual([100, 100, 50]);
  });

  it("re-joins hyphenated line breaks and drops bare page numbers", () => {
    const chunks = chunkPages([page(["The thermostat adjusts heating auto-", "matically every day.", "3"])]);

    expect(chunks[0].text).toBe("The thermostat adjusts heating automatically every day.");
  });

  it("returns no chunks for empty or whitespace-only pages", () => {
    expect(chunkPages(["", "   \n  "])).toEqual([]);
  });
});
