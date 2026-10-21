import { describe, expect, it } from "vitest";
import { contactLink, extractSiteChrome, MAX_SITE_CHROME_CHARS } from "./siteChrome";

describe("extractSiteChrome", () => {
  it("captures the header, top bar, site footer and contact/social links", () => {
    const text = extractSiteChrome(
      '<html><body><div class="site-topbar">Free site visits every Sunday</div>' +
        '<header><a href="/">Acme Homes</a><span>Call 98765 43210</span></header>' +
        '<main><article><header><h2>Card title</h2></header><p>Body</p></article></main>' +
        '<footer><p>Acme Homes Pvt Ltd</p><p>Address: 5 Lake View,<br>Pune</p>' +
        '<a href="https://wa.me/919876543210">WhatsApp</a><a href="https://www.instagram.com/acme">IG</a>' +
        '<a href="/privacy">Privacy</a><script>var x = 1</script></footer>' +
        '<a href="tel:+91 98765-43210">Call</a><a href="mailto:hi@acme.in?subject=x">Mail</a></body></html>'
    );
    expect(text).toContain("Header:\nAcme Homes\nCall 98765 43210");
    expect(text).toContain("Top bar:\nFree site visits every Sunday");
    expect(text).toContain("Footer:\nAcme Homes Pvt Ltd\nAddress: 5 Lake View,\nPune");
    expect(text).not.toContain("Card title");
    expect(text).not.toContain("var x");
    expect(text).toContain("- WhatsApp: https://wa.me/919876543210");
    expect(text).toContain("- Instagram: https://www.instagram.com/acme");
    expect(text).toContain("- Phone: +919876543210");
    expect(text).toContain("- Email: hi@acme.in");
    expect(text).not.toContain("/privacy");
  });

  it("uses the last footer and role-based regions", () => {
    const text = extractSiteChrome(
      '<html><body><div role="banner">Brand bar</div><main><section><footer>Post meta</footer></section></main>' +
        "<footer>Site footer 2026</footer></body></html>"
    );
    expect(text).toContain("Header:\nBrand bar");
    expect(text).toContain("Footer:\nSite footer 2026");
    expect(text).not.toContain("Post meta");
  });

  it("returns nothing for pages without header, footer or contact links, and caps its size", () => {
    expect(extractSiteChrome("<html><body><main><p>Only content</p></main></body></html>")).toBe("");
    const huge = `<footer>${"<p>Line of footer text</p>".repeat(1000)}</footer>`;
    expect(extractSiteChrome(huge).length).toBeLessThanOrEqual(MAX_SITE_CHROME_CHARS);
  });
});

describe("contactLink", () => {
  it("recognizes phone, email, WhatsApp and social links only", () => {
    expect(contactLink("tel:+1 (555) 010-9999")).toEqual(["Phone", "+15550109999"]);
    expect(contactLink("tel:12")).toBeNull();
    expect(contactLink("mailto:a@b.co?subject=x")).toEqual(["Email", "a@b.co"]);
    expect(contactLink("https://m.facebook.com/acme")).toEqual(["Facebook", "https://m.facebook.com/acme"]);
    expect(contactLink("https://notfacebook.com/x")).toBeNull();
    expect(contactLink("javascript:alert(1)")).toBeNull();
  });
});
