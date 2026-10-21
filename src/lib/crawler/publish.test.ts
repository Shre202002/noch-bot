import { describe, expect, it, vi } from "vitest";
import { chunkText, publishCrawl, type PublishDeps, type PublishInput } from "./publish";
import type { CrawledPage, CrawlResult } from "./types";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

function page(path: string, overrides: Partial<CrawledPage> = {}): CrawledPage {
  return { url: `https://example.com${path}`, title: path, markdown: words(450), status: "fetched", reason: null, depth: 1, ...overrides };
}

function crawl(pages: CrawledPage[]): CrawlResult {
  return { provider: "scrapling", pages, deferredCount: 0, capReached: false, timeBudgetReached: false };
}

function input(pages: CrawledPage[]): PublishInput {
  return {
    userId: "user-1",
    siteUrl: "https://example.com/",
    siteUrlRedacted: "https://example.com/",
    crawl: crawl(pages),
    correlationId: "cid",
    fallbackUsed: false,
  };
}

function makeDeps(overrides: Partial<PublishDeps> = {}) {
  const calls: string[] = [];
  let clock = 0;
  const deps: PublishDeps = {
    embedTexts: vi.fn(async (texts: string[]) => { calls.push("embed"); return texts.map(() => [0.1, 0.2]); }),
    insertGeneration: vi.fn(async () => { calls.push("insert"); }),
    countSearchable: vi.fn(async (_u: string, _g: string, _v: number[], limit: number) => { calls.push("probe"); return limit; }),
    deleteGeneration: vi.fn(async () => { calls.push("deleteGeneration"); }),
    deleteInactive: vi.fn(async () => { calls.push("deleteInactive"); }),
    activate: vi.fn(async () => { calls.push("activate"); }),
    sleep: vi.fn(async (ms: number) => { clock += ms; }),
    now: () => clock,
    newGenerationId: () => "gen-new",
    ...overrides,
  };
  return { deps, calls };
}

describe("chunkText", () => {
  it("keeps the original 300-word split", () => {
    expect(chunkText(words(650)).map((c) => c.split(" ").length)).toEqual([300, 300, 50]);
  });
});

describe("publishCrawl site header and footer", () => {
  const withChrome = (pages: CrawledPage[], siteChrome: string): PublishInput => ({
    ...input(pages),
    crawl: { ...crawl(pages), siteChrome },
  });

  it("publishes the header/footer as its own first chunk without counting it as a page", async () => {
    const { deps } = makeDeps();
    const result = await publishCrawl(withChrome([page("/"), page("/about")], "Footer:\nCall 98765 43210"), deps);

    expect(result).toMatchObject({ ok: true, pagesIndexed: 2, chunks: 5 });
    const staged = vi.mocked(deps.insertGeneration).mock.calls[0][2];
    expect(staged[0].payload).toMatchObject({ url: "https://example.com/", title: "Site header and footer" });
    expect(staged[0].payload.text).toContain("Call 98765 43210");
    expect(vi.mocked(deps.activate).mock.calls[0][1]).toMatchObject({ pagesIndexed: 2, chunkCount: 5 });
    if (!result.ok) throw new Error("expected success");
    expect(result.pages.map((p) => p.chunks)).toEqual([2, 2]);
  });

  it("still refuses a crawl whose only content is the header/footer", async () => {
    const { deps } = makeDeps();
    const result = await publishCrawl(withChrome([page("/", { status: "skipped", reason: "no_content", markdown: "" })], "Footer:\nx"), deps);
    expect(result).toMatchObject({ ok: false, reason: "no_content" });
    expect(deps.embedTexts).not.toHaveBeenCalled();
  });
});

describe("publishCrawl", () => {
  it("stages, waits for search readiness, activates, then cleans up — in that order", async () => {
    const { deps, calls } = makeDeps();
    const result = await publishCrawl(input([page("/"), page("/about")]), deps);

    expect(calls).toEqual(["embed", "insert", "probe", "activate", "deleteInactive"]);
    expect(result).toMatchObject({ ok: true, generationId: "gen-new", pagesIndexed: 2, chunks: 4 });
    expect(deps.deleteInactive).toHaveBeenCalledWith("user-1", "gen-new");

    const activation = vi.mocked(deps.activate).mock.calls[0][1];
    expect(activation).toMatchObject({ activeGenerationId: "gen-new", chunkCount: 4, pagesIndexed: 2, url: "https://example.com/" });
  });

  it("tags every chunk with the user, generation and its own page URL", async () => {
    const { deps } = makeDeps();
    await publishCrawl(input([page("/"), page("/faq")]), deps);
    const [, generationId, chunks] = vi.mocked(deps.insertGeneration).mock.calls[0];
    expect(generationId).toBe("gen-new");
    expect(chunks.every((c) => c.payload.userId === "user-1" && c.payload.generationId === "gen-new")).toBe(true);
    expect(chunks.map((c) => c.payload.url)).toEqual([
      "https://example.com/", "https://example.com/", "https://example.com/faq", "https://example.com/faq",
    ]);
    expect(chunks[0].payload.text.startsWith("--- Page: https://example.com/ ---")).toBe(true);
  });

  it("reports per-page outcomes with chunk counts", async () => {
    const { deps } = makeDeps();
    const result = await publishCrawl(
      input([page("/"), page("/private", { status: "skipped", reason: "robots_denied", markdown: "" })]),
      deps
    );
    expect(result.pages).toEqual([
      expect.objectContaining({ url: "https://example.com/", status: "indexed", chunks: 2 }),
      expect.objectContaining({ url: "https://example.com/private", status: "skipped", reason: "robots_denied", chunks: 0 }),
    ]);
  });

  it("does not publish when any selected page failed to fetch", async () => {
    const { deps, calls } = makeDeps();
    const result = await publishCrawl(input([page("/"), page("/down", { status: "failed", reason: "timeout", markdown: "" })]), deps);
    expect(result).toMatchObject({ ok: false, reason: "pages_failed" });
    expect(calls).toEqual([]);
  });

  it("does not publish when no page has content", async () => {
    const { deps, calls } = makeDeps();
    const result = await publishCrawl(input([page("/", { status: "skipped", reason: "no_content", markdown: "" })]), deps);
    expect(result).toMatchObject({ ok: false, reason: "no_content" });
    expect(calls).toEqual([]);
  });

  it("writes nothing when embedding fails", async () => {
    const { deps, calls } = makeDeps({ embedTexts: vi.fn(async () => { throw new Error("429"); }) });
    const result = await publishCrawl(input([page("/")]), deps);
    expect(result).toMatchObject({ ok: false, reason: "embedding_failed" });
    expect(calls).toEqual([]);
  });

  it("discards the staged generation when it never becomes searchable", async () => {
    const { deps, calls } = makeDeps({ countSearchable: vi.fn(async () => 0) });
    const result = await publishCrawl(input([page("/")]), deps);
    expect(result).toMatchObject({ ok: false, reason: "index_not_ready" });
    expect(deps.activate).not.toHaveBeenCalled();
    expect(deps.deleteInactive).not.toHaveBeenCalled();
    expect(deps.deleteGeneration).toHaveBeenCalledWith("user-1", "gen-new");
    expect(calls.at(-1)).toBe("deleteGeneration");
  });

  it("keeps polling through probe errors until ready", async () => {
    let attempts = 0;
    const { deps } = makeDeps({
      countSearchable: vi.fn(async (_u: string, _g: string, _v: number[], limit: number) => {
        attempts++;
        if (attempts < 3) throw new Error("Path 'generationId' needs to be indexed as filter");
        return limit;
      }),
    });
    const result = await publishCrawl(input([page("/")]), deps);
    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  it("discards the staged generation when staging or activation fails", async () => {
    const staging = makeDeps({ insertGeneration: vi.fn(async () => { throw new Error("write failed"); }) });
    expect(await publishCrawl(input([page("/")]), staging.deps)).toMatchObject({ ok: false, reason: "storage_failed" });
    expect(staging.deps.deleteGeneration).toHaveBeenCalled();

    const activation = makeDeps({ activate: vi.fn(async () => { throw new Error("write failed"); }) });
    expect(await publishCrawl(input([page("/")]), activation.deps)).toMatchObject({ ok: false, reason: "storage_failed" });
    expect(activation.deps.deleteGeneration).toHaveBeenCalled();
    expect(activation.deps.deleteInactive).not.toHaveBeenCalled();
  });

  it("still succeeds when cleanup of old generations fails", async () => {
    const { deps } = makeDeps({ deleteInactive: vi.fn(async () => { throw new Error("timeout"); }) });
    expect((await publishCrawl(input([page("/")]), deps)).ok).toBe(true);
  });
});
