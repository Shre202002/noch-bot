import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { LegacyCrawlerProvider, extractPage } from "./legacyProvider";
import type { CrawlBudget } from "./types";

// Fixture site on 127.0.0.1. The provider's URL validation is relaxed for the
// fixture only; production uses parseCrawlUrl + safeLookup.
const FILLER = "Useful knowledge text for the assistant. ".repeat(10);
const html = (title: string, links: [string, string][] = [], nav: [string, string][] = []) =>
  `<html><head><title>${title}</title></head><body>` +
  `<nav>${nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}</nav>` +
  `<main><h1>${title}</h1><p>${FILLER}</p>${links.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}</main>` +
  `<script>window.secret = 1</script></body></html>`;

type Route = { status: number; headers?: Record<string, string>; body?: string };
let routes: Record<string, Route> = {};
let hits: string[] = [];
let hosts: string[] = [];
let redirectApexToWww = false;
let server: http.Server;
let base = "";

function buildRoutes(): Record<string, Route> {
  const HTML = { "Content-Type": "text/html" };
  return {
    "/robots.txt": { status: 200, headers: { "Content-Type": "text/plain" }, body: "User-agent: *\nDisallow: /private\n" },
    "/sitemap.xml": {
      status: 200,
      headers: { "Content-Type": "application/xml" },
      body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/faq</loc></url><url><loc>https://other.test/x</loc></url></urlset>`,
    },
    "/": {
      status: 200,
      headers: HTML,
      body: html(
        "Home",
        [["/cat/index.html", "Category"], ["/blog", "Blog"], ["/blog-copy", "Blog copy"], ["/index.html", "Home again"], ["/private/x", "Private"], ["/old", "Old"], ["/away", "Away"], ["/missing", "Missing"],
         ["/broken", "Broken"], ["/big", "Big"], ["/empty", "Empty"], ["/doc.pdf", "PDF"], ["https://other.test/", "Other"]],
        [["/about", "About us"], ["/services", "Services"]]
      ),
    },
    "/about": { status: 200, headers: HTML, body: html("About") },
    "/services": { status: 200, headers: HTML, body: html("Services") },
    "/faq": { status: 200, headers: HTML, body: html("FAQ") },
    "/blog": { status: 200, headers: HTML, body: html("Blog") },
    "/blog-copy": { status: 200, headers: HTML, body: html("Blog") },
    "/cat/index.html": { status: 200, headers: HTML, body: html("Category") },
    "/cat": { status: 302, headers: { Location: "https://evil.test/cat/" } },
    "/old": { status: 301, headers: { Location: "/services" } },
    "/away": { status: 302, headers: { Location: "https://evil.test/" } },
    "/broken": { status: 500, headers: HTML, body: "oops" },
    "/big": { status: 200, headers: HTML, body: `<p>${"x".repeat(300_000)}</p>` },
    "/empty": { status: 200, headers: HTML, body: "<html><body><div id='app'></div></body></html>" },
  };
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url ?? "");
    const host = req.headers.host ?? "";
    hosts.push(host.split(":")[0]);
    if (redirectApexToWww && host.startsWith("site.test")) {
      res.writeHead(301, { Location: `http://www.${host}${req.url}` }).end();
      return;
    }
    const route = routes[req.url ?? ""];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(route.status, route.headers ?? {}).end(route.body ?? "");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  routes = buildRoutes();
  hits = [];
  hosts = [];
  redirectApexToWww = false;
});

const budget = (overrides: Partial<CrawlBudget> = {}): CrawlBudget => ({
  maxPages: 15,
  maxDepth: 2,
  timeoutSeconds: 20,
  maxResponseBytes: 100_000,
  ...overrides,
});

const provider = () => new LegacyCrawlerProvider({ validate: () => {}, sleep: async () => {} });
const pathOf = (url: string) => url.slice(base.length) || "/";

describe("LegacyCrawlerProvider", () => {
  it("crawls in the agreed order: seed, nav, relevant sitemap entries, then links", async () => {
    const result = await provider().crawl(`${base}/`, budget(), "cid");
    const fetched = result.pages.filter((p) => p.status === "fetched").map((p) => pathOf(p.url));
    expect(fetched.slice(0, 4)).toEqual(["/", "/about", "/services", "/faq"]);
    expect(result.provider).toBe("legacy");
  });

  it("records safe outcomes for each page", async () => {
    const result = await provider().crawl(`${base}/`, budget(), "cid");
    const byPath = Object.fromEntries(result.pages.map((p) => [pathOf(p.url), p]));
    expect(byPath["/"]).toMatchObject({ status: "fetched", title: "Home" });
    expect(byPath["/"].markdown).toContain("# Home");
    expect(byPath["/"].markdown).not.toContain("window.secret");
    expect(byPath["/private/x"]).toMatchObject({ status: "skipped", reason: "robots_denied" });
    expect(byPath["/away"]).toMatchObject({ status: "skipped", reason: "redirect_outside_origin" });
    expect(byPath["/old"]).toMatchObject({ status: "skipped", reason: "duplicate" });
    expect(byPath["/missing"]).toMatchObject({ status: "skipped", reason: "http_error" });
    expect(byPath["/broken"]).toMatchObject({ status: "failed", reason: "http_error" });
    expect(byPath["/big"]).toMatchObject({ status: "skipped", reason: "too_large" });
    expect(byPath["/empty"]).toMatchObject({ status: "skipped", reason: "no_content" });
  });

  it("captures the site footer and contact links once, outside every page's content", async () => {
    routes["/"].body = routes["/"].body!.replace(
      "<script>",
      '<footer><p>Visit us: 12 Garden Road, Kanpur</p><a href="tel:+91 84399 77111">Call</a></footer><script>'
    );
    const result = await provider().crawl(`${base}/`, budget(), "cid");
    expect(result.siteChrome).toContain("Footer:\nVisit us: 12 Garden Road, Kanpur");
    expect(result.siteChrome).toContain("- Phone: +918439977111");
    expect(result.pages.some((p) => p.markdown.includes("Garden Road"))).toBe(false);
  });

  it("does not index an index file or identical content twice", async () => {
    const result = await provider().crawl(`${base}/`, budget(), "cid");
    const byPath = Object.fromEntries(result.pages.map((p) => [pathOf(p.url), p]));
    expect(byPath["/index.html"]).toBeUndefined();
    expect([byPath["/blog"].status, byPath["/blog-copy"].status].sort()).toEqual(["fetched", "skipped"]);
  });

  it("fetches the linked URL, not its dedup key", async () => {
    const result = await provider().crawl(`${base}/`, budget({ maxPages: 30 }), "cid");
    const cat = result.pages.find((p) => pathOf(p.url) === "/cat/index.html");
    expect(cat?.status).toBe("fetched");
    expect(hits).not.toContain("/cat");
  });

  it("leaves navigation out of page text when a main region exists", async () => {
    const result = await provider().crawl(`${base}/`, budget(), "cid");
    const home = result.pages.find((p) => pathOf(p.url) === "/")!;
    expect(home.markdown).not.toContain("About us");
  });

  it("never requests disallowed, non-page or off-origin URLs", async () => {
    await provider().crawl(`${base}/`, budget(), "cid");
    expect(hits).not.toContain("/private/x");
    expect(hits).not.toContain("/doc.pdf");
  });

  it("counts only pages with content toward the cap", async () => {
    routes["/blog"] = { status: 404 };
    const result = await provider().crawl(`${base}/`, budget({ maxPages: 6 }), "cid");
    const attempted = result.pages.filter((p) => p.reason !== "robots_denied");
    const fetched = result.pages.filter((p) => p.status === "fetched").map((p) => pathOf(p.url));
    // The broken /blog page did not use a slot; the next candidate took it.
    expect(fetched).toHaveLength(6);
    expect(fetched).toContain("/blog-copy");
    expect(attempted.length).toBeGreaterThan(6);
    expect(result.capReached).toBe(true);
    expect(result.deferredCount).toBeGreaterThan(0);
  });

  it("stops at the cap when every page has content", async () => {
    const result = await provider().crawl(`${base}/`, budget({ maxPages: 3 }), "cid");
    expect(result.pages.map((p) => p.status)).toEqual(["fetched", "fetched", "fetched"]);
    expect(result.capReached).toBe(true);
  });

  it("bounds total fetches when pages are empty", async () => {
    const empty = { status: 200, headers: { "Content-Type": "text/html" }, body: "<html><body><main></main></body></html>" };
    for (const path of ["/about", "/services", "/faq", "/cat/index.html", "/blog", "/blog-copy"]) routes[path] = empty;
    const result = await provider().crawl(`${base}/`, budget({ maxPages: 3 }), "cid");
    const attempted = result.pages.filter((p) => p.reason !== "robots_denied");
    expect(attempted).toHaveLength(6);
    expect(attempted.filter((p) => p.status === "fetched").length).toBeLessThan(3);
  });

  it("treats an unreachable robots.txt as disallow-all", async () => {
    routes["/robots.txt"] = { status: 503 };
    const result = await provider().crawl(`${base}/`, budget(), "cid");
    expect(result.pages.map((p) => p.reason)).toEqual(["robots_denied"]);
  });

  it("follows a seed redirect to www and keeps crawling there", async () => {
    redirectApexToWww = true;
    // Test-only DNS: both fixture hostnames point at the local server.
    const lookup = (_host: string, options: { all?: boolean }, cb: (...args: any[]) => void) =>
      options.all ? cb(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4);
    const port = new URL(base).port;
    const crawler = new LegacyCrawlerProvider({ validate: () => {}, sleep: async () => {}, lookup });
    const result = await crawler.crawl(`http://site.test:${port}/`, budget(), "cid");

    const fetched = result.pages.filter((p) => p.status === "fetched");
    expect(fetched.length).toBeGreaterThan(3);
    expect(fetched.every((p) => p.url.startsWith(`http://www.site.test:${port}/`))).toBe(true);
    expect(hosts.at(-1)).toBe("www.site.test");
  });

  it("validates the seed with the production URL policy by default", async () => {
    await expect(new LegacyCrawlerProvider().crawl(`${base}/`, budget(), "cid")).rejects.toMatchObject({
      reason: "blocked_destination",
    });
    expect(hits).toEqual([]);
  });
});

describe("extractPage", () => {
  it("keeps headings and list structure", () => {
    const { title, text } = extractPage(
      `<html><head><title>T</title></head><body><h2>Plans</h2><ul><li>Basic ${FILLER}</li></ul><style>.x{}</style></body></html>`
    );
    expect(title).toBe("T");
    expect(text).toContain("## Plans");
    expect(text).toContain("- Basic");
    expect(text).not.toContain(".x{}");
  });
});
