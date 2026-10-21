import { describe, expect, it } from "vitest";
import { parseRobots } from "./robots";

describe("parseRobots", () => {
  const robots = parseRobots(
    [
      "User-agent: *",
      "Disallow: /private",
      "Allow: /private/public-page",
      "Disallow: /*.pdf$",
      "Crawl-delay: 3",
      "",
      "User-agent: OtherBot",
      "Disallow: /",
      "",
      "Sitemap: https://example.com/sitemap-main.xml",
    ].join("\n"),
    "NochBot"
  );

  it("applies the wildcard group", () => {
    expect(robots.canFetch("https://example.com/about")).toBe(true);
    expect(robots.canFetch("https://example.com/private/x")).toBe(false);
  });

  it("uses the longest matching rule", () => {
    expect(robots.canFetch("https://example.com/private/public-page")).toBe(true);
  });

  it("supports * and $ patterns", () => {
    expect(robots.canFetch("https://example.com/files/a.pdf")).toBe(false);
    expect(robots.canFetch("https://example.com/files/a.pdf?x=1")).toBe(true);
  });

  it("reads crawl delay and sitemaps", () => {
    expect(robots.crawlDelaySeconds).toBe(3);
    expect(robots.sitemaps).toEqual(["https://example.com/sitemap-main.xml"]);
  });

  it("prefers a group naming the crawler", () => {
    const specific = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: nochbot\nAllow: /\n", "NochBot");
    expect(specific.canFetch("https://example.com/a")).toBe(true);
  });
});
