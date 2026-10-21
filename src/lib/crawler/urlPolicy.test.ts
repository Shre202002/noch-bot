import { describe, expect, it } from "vitest";
import {
  CrawlSite,
  alternateHost,
  canonicalizeUrl,
  isPublicAddress,
  parseCrawlUrl,
  redactUrl,
  resolveLink,
  validateCrawlTarget,
} from "./urlPolicy";
import { CrawlPolicyError } from "./types";

function reasonOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof CrawlPolicyError ? err.reason : "other";
  }
}

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1", "10.0.0.1", "172.20.1.1", "192.168.0.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fd00::1", "ff02::1",
    "2001:db8::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:1", "64:ff9b::a00:1", "2002:a00::1",
  ])("blocks %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it("rejects non-IP strings", () => {
    expect(isPublicAddress("example.com")).toBe(false);
  });
});

describe("parseCrawlUrl", () => {
  it.each([
    ["ftp://example.com", "invalid_url"],
    ["javascript:alert(1)", "invalid_url"],
    ["https://user:pass@example.com", "invalid_url"],
    ["not a url", "invalid_url"],
    ["http://localhost:3000", "blocked_destination"],
    ["http://router.local", "blocked_destination"],
    ["http://127.0.0.1", "blocked_destination"],
    ["http://2130706433/", "blocked_destination"],
    ["http://[::1]/", "blocked_destination"],
    ["http://169.254.169.254/latest/meta-data/", "blocked_destination"],
    ["https://example.com:6379", "blocked_destination"],
  ])("%s -> %s", (url, reason) => {
    expect(reasonOf(() => parseCrawlUrl(url))).toBe(reason);
  });

  it("accepts public http(s) URLs", () => {
    expect(parseCrawlUrl("https://example.com/about").hostname).toBe("example.com");
    expect(parseCrawlUrl("http://example.com:8080").port).toBe("8080");
  });

  it("rejects non-string input", () => {
    expect(reasonOf(() => parseCrawlUrl(undefined))).toBe("invalid_url");
    expect(reasonOf(() => parseCrawlUrl({ url: "x" }))).toBe("invalid_url");
  });
});

describe("validateCrawlTarget", () => {
  it("refuses hostnames that resolve to any private address", async () => {
    await expect(
      validateCrawlTarget("https://example.com", async () => ["93.184.216.34", "10.0.0.3"])
    ).rejects.toMatchObject({ reason: "blocked_destination" });
  });

  it("reports DNS failure", async () => {
    await expect(
      validateCrawlTarget("https://nope.example", async () => {
        throw new Error("ENOTFOUND");
      })
    ).rejects.toMatchObject({ reason: "dns_failed" });
  });

  it("returns the canonical URL for public hosts", async () => {
    await expect(
      validateCrawlTarget("https://Example.com/?utm_source=x#top", async () => ["93.184.216.34"])
    ).resolves.toBe("https://example.com/?utm_source=x");
  });
});

describe("URL helpers", () => {
  it("canonicalizes obvious variants to one URL", () => {
    const variants = [
      "https://Example.com/about/",
      "https://example.com:443/about",
      "https://example.com/about#team",
      "https://example.com/about?utm_campaign=x&fbclid=1",
    ];
    expect(new Set(variants.map(canonicalizeUrl))).toEqual(new Set(["https://example.com/about"]));
  });

  it("treats directory index files as their directory", () => {
    expect(canonicalizeUrl("https://example.com/index.html")).toBe("https://example.com/");
    expect(canonicalizeUrl("https://example.com/docs/index.php?x=1")).toBe("https://example.com/docs?x=1");
    expect(canonicalizeUrl("https://example.com/docs/reindex.html")).toBe("https://example.com/docs/reindex.html");
  });

  it("keeps meaningful query params and path case", () => {
    expect(canonicalizeUrl("https://example.com/Docs?page=2")).toBe("https://example.com/Docs?page=2");
  });

  it("resolves only http(s) links and drops fragments", () => {
    expect(resolveLink("https://example.com/a/", "../b/#x")).toBe("https://example.com/b/");
    expect(resolveLink("https://example.com/", "mailto:a@b.c")).toBeNull();
    expect(resolveLink("https://example.com/", "#x")).toBeNull();
  });

  it("redacts query strings and fragments", () => {
    expect(redactUrl("https://example.com/p?token=secret#f")).toBe("https://example.com/p");
  });
});

describe("CrawlSite", () => {
  const site = CrawlSite.forUrl("https://example.com/start");

  it("finds the www/apex counterpart", () => {
    expect(alternateHost("example.com")).toBe("www.example.com");
    expect(alternateHost("www.example.com")).toBe("example.com");
    expect(alternateHost("www.com")).toBeNull();
    expect(alternateHost("93.184.216.34")).toBeNull();
  });

  it("contains the host, its counterpart and http/https on default ports only", () => {
    expect(site.contains("http://example.com/a")).toBe(true);
    expect(site.contains("https://www.example.com/a")).toBe(true);
    expect(site.contains("https://blog.example.com/a")).toBe(false);
    expect(site.contains("https://example.com:8443/a")).toBe(false);
    expect(site.contains("https://evil.test/")).toBe(false);
  });

  it("requires the exact scheme and port for custom ports", () => {
    const custom = CrawlSite.forUrl("http://example.com:8080/");
    expect(custom.contains("http://example.com:8080/a")).toBe(true);
    expect(custom.contains("https://example.com:8080/a")).toBe(false);
    expect(custom.contains("http://example.com/a")).toBe(false);
  });

  it("rebases and keys URLs on the primary origin", () => {
    const moved = site.withPrimary("https://www.example.com/");
    expect(moved.key("http://example.com/about/")).toBe("https://www.example.com/about");
    expect(moved.rebase("http://example.com/cat/index.html#x")).toBe("https://www.example.com/cat/index.html");
    expect(site.withPrimary("https://evil.test/")).toBe(site);
  });
});
