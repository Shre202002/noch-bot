import { describe, expect, it, vi } from "vitest";
import { ScraplingCrawlerProvider } from "./scraplingProvider";
import { runCrawl } from "./index";
import { CrawlPolicyError, CrawlServiceUnavailableError, type CrawlBudget, type CrawlProvider } from "./types";

const budget: CrawlBudget = { maxPages: 2, maxDepth: 3, timeoutSeconds: 25, maxResponseBytes: 2_000_000 };

function providerWith(fetchImpl: typeof fetch) {
  return new ScraplingCrawlerProvider({ serviceUrl: "https://crawler.internal.test", token: "secret-token", fetchImpl });
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ScraplingCrawlerProvider", () => {
  it("sends the server-owned budget with the bearer token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { version: 1, pages: [], deferred_count: 0, cap_reached: false, time_budget_reached: false })
    );
    await providerWith(fetchImpl as unknown as typeof fetch).crawl("https://example.com/", budget, "cid1");

    const [endpoint, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe("https://crawler.internal.test/v1/crawl");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(JSON.parse(init.body as string)).toEqual({
      url: "https://example.com/",
      max_pages: 2,
      max_depth: 3,
      timeout_seconds: 25,
      max_response_bytes: 2_000_000,
      correlation_id: "cid1",
    });
  });

  it("drops off-origin pages and enforces the page cap on the response", async () => {
    const page = (url: string, status = "fetched", reason: string | null = null) => ({
      url, title: "T", markdown: "# hello", status, reason, depth: 1,
    });
    const fetchImpl = async () =>
      jsonResponse(200, {
        version: 1,
        pages: [
          page("https://example.com/"),
          page("https://evil.test/"),
          page("https://example.com/private", "skipped", "robots_denied"),
          page("https://example.com/a"),
          page("https://example.com/b"),
          { url: "https://example.com/c", status: "weird" },
        ],
        deferred_count: 4,
        cap_reached: true,
        time_budget_reached: false,
      });
    const result = await providerWith(fetchImpl as unknown as typeof fetch).crawl("https://example.com/", budget, "cid");
    expect(result.pages.map((p) => p.url)).toEqual([
      "https://example.com/",
      "https://example.com/private",
      "https://example.com/a",
    ]);
    expect(result).toMatchObject({ provider: "scrapling", deferredCount: 4, capReached: true });
  });

  it("passes the site header/footer through, capped, and tolerates older services without it", async () => {
    const base = { version: 1, pages: [], deferred_count: 0, cap_reached: false, time_budget_reached: false };
    const withChrome = await providerWith((async () =>
      jsonResponse(200, { ...base, site_chrome: `Footer:\n${"x".repeat(10_000)}` })) as unknown as typeof fetch
    ).crawl("https://example.com/", budget, "cid");
    expect(withChrome.siteChrome?.startsWith("Footer:\nx")).toBe(true);
    expect(withChrome.siteChrome?.length).toBe(4_000);

    const older = await providerWith((async () => jsonResponse(200, base)) as unknown as typeof fetch)
      .crawl("https://example.com/", budget, "cid");
    expect(older.siteChrome).toBe("");
  });

  it("does not count skipped pages toward the cap", async () => {
    const page = (url: string, status: string, reason: string | null = null) => ({
      url, title: "T", markdown: status === "fetched" ? "# hi" : "", status, reason, depth: 1,
    });
    const fetchImpl = async () =>
      jsonResponse(200, {
        version: 1,
        pages: [
          page("https://example.com/", "fetched"),
          page("https://example.com/empty", "skipped", "no_content"),
          page("https://example.com/404", "skipped", "http_error"),
          page("https://example.com/a", "fetched"),
          page("https://example.com/b", "fetched"),
        ],
        deferred_count: 0,
        cap_reached: true,
        time_budget_reached: false,
      });
    const result = await providerWith(fetchImpl as unknown as typeof fetch).crawl("https://example.com/", budget, "cid");
    expect(result.pages.filter((p) => p.status === "fetched").map((p) => p.url)).toEqual([
      "https://example.com/",
      "https://example.com/a",
    ]);
  });

  it("maps policy refusals to CrawlPolicyError", async () => {
    const fetchImpl = async () => jsonResponse(422, { error: "policy", reason: "blocked_destination" });
    await expect(
      providerWith(fetchImpl as unknown as typeof fetch).crawl("https://example.com/", budget, "cid")
    ).rejects.toBeInstanceOf(CrawlPolicyError);
  });

  it.each([
    ["server error", async () => jsonResponse(500, { error: "internal" })],
    ["busy", async () => jsonResponse(503, { error: "busy" })],
    ["auth misconfiguration", async () => jsonResponse(401, { detail: "unauthorized" })],
    ["bad payload", async () => jsonResponse(200, { nope: true })],
    ["network error", async () => { throw new TypeError("fetch failed"); }],
    ["timeout", async () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); }],
  ])("treats %s as service unavailable", async (_label, impl) => {
    await expect(
      providerWith(impl as unknown as typeof fetch).crawl("https://example.com/", budget, "cid")
    ).rejects.toBeInstanceOf(CrawlServiceUnavailableError);
  });
});

describe("runCrawl fallback rules", () => {
  const legacyResult = { provider: "legacy" as const, pages: [], deferredCount: 0, capReached: false, timeBudgetReached: false };
  const fakeProvider = (name: "scrapling" | "legacy", impl: CrawlProvider["crawl"]): CrawlProvider => ({ name, crawl: impl });

  it("falls back to legacy only when the service is unavailable", async () => {
    const primary = fakeProvider("scrapling", async () => { throw new CrawlServiceUnavailableError("service_timeout"); });
    const fallback = fakeProvider("legacy", vi.fn(async () => legacyResult));
    const run = await runCrawl("https://example.com/", budget, "cid", { primary, fallback });
    expect(run).toEqual({ result: legacyResult, fallbackUsed: true });
  });

  it("never falls back on a policy refusal", async () => {
    const primary = fakeProvider("scrapling", async () => { throw new CrawlPolicyError("blocked_destination"); });
    const fallbackCrawl = vi.fn(async () => legacyResult);
    await expect(
      runCrawl("https://example.com/", budget, "cid", { primary, fallback: fakeProvider("legacy", fallbackCrawl) })
    ).rejects.toBeInstanceOf(CrawlPolicyError);
    expect(fallbackCrawl).not.toHaveBeenCalled();
  });

  it("returns the primary result without fallback when it succeeds", async () => {
    const result = { ...legacyResult, provider: "scrapling" as const };
    const run = await runCrawl("https://example.com/", budget, "cid", {
      primary: fakeProvider("scrapling", async () => result),
      fallback: fakeProvider("legacy", async () => legacyResult),
    });
    expect(run).toEqual({ result, fallbackUsed: false });
  });
});
