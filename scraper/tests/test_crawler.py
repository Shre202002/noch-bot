"""Crawler tests against a deterministic local fixture site.

The fixture runs on 127.0.0.1, so tests inject a resolver and address check that
allow it; production code always uses the strict defaults.
"""

import http.server
import socketserver
import threading
import unittest
from unittest import mock

from nochbot_crawler import url_policy
from scrapling.parser import Selector

from nochbot_crawler.crawler import CrawlBudget, SiteCrawler, contact_link, extract_site_chrome
from nochbot_crawler.url_policy import UrlPolicyError

FILLER = "Useful knowledge text for the assistant. " * 10


def page(title, body, links=(), nav=(), footer=""):
    nav_html = "".join(f'<a href="{h}">{t}</a>' for h, t in nav)
    link_html = "".join(f'<a href="{h}">{t}</a>' for h, t in links)
    return (
        f"<html><head><title>{title}</title></head><body>"
        f"<nav>{nav_html}</nav><main><h1>{title}</h1><p>{body}</p>{link_html}</main>{footer}"
        f"<script>window.secret = 1</script></body></html>"
    ).encode()


HOME_FOOTER = (
    '<footer><p>Visit us: 12 Garden Road, Kanpur</p><p>Open Mon-Sat 10am-6pm</p>'
    '<a href="tel:+91 84399 77111">Call</a><a href="mailto:hello@site.test?subject=Hi">Email</a></footer>'
)


class FixtureHandler(http.server.BaseHTTPRequestHandler):
    routes = {}
    hits = []
    hosts = []
    redirect_apex_to_www = False

    def log_message(self, *args):
        pass

    def do_GET(self):
        FixtureHandler.hits.append(self.path)
        host = self.headers.get("Host", "")
        FixtureHandler.hosts.append(host.split(":")[0])
        if FixtureHandler.redirect_apex_to_www and host.startswith("site.test"):
            self.send_response(301)
            self.send_header("Location", f"http://www.{host}{self.path}")
            self.end_headers()
            return
        route = self.routes.get(self.path)
        if route is None:
            self.send_response(404)
            self.end_headers()
            return
        status, headers, body = route
        self.send_response(status)
        for key, value in headers.items():
            self.send_header(key, value)
        if body is not None and "Content-Length" not in headers and status != 299:
            self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)


HTML = {"Content-Type": "text/html; charset=utf-8"}


def build_routes(port):
    origin = f"http://site.test:{port}"
    return {
        "/robots.txt": (200, {"Content-Type": "text/plain"}, b"User-agent: *\nDisallow: /private\n"),
        "/sitemap.xml": (200, {"Content-Type": "application/xml"}, (
            '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            f"<url><loc>{origin}/faq</loc></url>"
            f"<url><loc>{origin}/random-post</loc></url>"
            "<url><loc>https://other.test/elsewhere</loc></url>"
            "</urlset>"
        ).encode()),
        "/": (200, HTML, page(
            "Home", FILLER,
            links=[("/cat/index.html", "Category"), ("/blog", "Blog"), ("/blog-copy", "Blog copy"), ("/index.html", "Home again"), ("/about/?utm_source=nav", "About again"), ("/private/x", "Private"),
                   ("/old", "Old"), ("/away", "Away"), ("/missing", "Missing"), ("/broken", "Broken"),
                   ("/big", "Big"), ("/empty", "Empty"), ("/file.pdf", "PDF"), ("https://other.test/", "Other"),
                   ("/deep1", "Deep")],
            nav=[("/about", "About us"), ("/services", "Services")],
            footer=HOME_FOOTER,
        )),
        "/about": (200, HTML, page("About", FILLER)),
        "/services": (200, HTML, page("Services", FILLER)),
        "/faq": (200, HTML, page("FAQ", FILLER)),
        "/random-post": (200, HTML, page("Random", FILLER)),
        "/blog": (200, HTML, page("Blog", FILLER)),
        "/blog-copy": (200, HTML, page("Blog", FILLER)),
        "/old": (301, {"Location": "/services"}, b""),
        "/away": (302, {"Location": "https://evil.test/"}, b""),
        "/broken": (500, HTML, b"oops"),
        "/big": (200, HTML, b"<p>" + b"x" * 300_000 + b"</p>"),
        "/empty": (200, HTML, b"<html><body><div id='app'></div></body></html>"),
        "/cat/index.html": (200, HTML, page("Category", FILLER)),
        "/cat": (302, {"Location": "https://evil.test/cat/"}, b""),
        "/deep1": (200, HTML, page("Deep1", FILLER, links=[("/deep2", "next")])),
        "/deep2": (200, HTML, page("Deep2", FILLER, links=[("/deep3", "next")])),
        "/deep3": (200, HTML, page("Deep3", FILLER)),
    }


class CrawlerFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), FixtureHandler)
        cls.port = cls.server.server_address[1]
        FixtureHandler.routes = build_routes(cls.port)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.ports_patch = mock.patch.object(url_policy, "ALLOWED_PORTS", url_policy.ALLOWED_PORTS | {cls.port})
        cls.ports_patch.start()

    @classmethod
    def tearDownClass(cls):
        cls.ports_patch.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        FixtureHandler.hits = []
        FixtureHandler.hosts = []
        FixtureHandler.redirect_apex_to_www = False

    def crawler(self, **overrides):
        budget = dict(max_pages=15, max_depth=2, timeout_seconds=30, max_response_bytes=100_000,
                      per_page_timeout_seconds=5)
        budget.update(overrides)
        return SiteCrawler(
            CrawlBudget(**budget),
            resolver=lambda host, port: ["127.0.0.1"],
            address_check=lambda ip: True,
            sleep=lambda s: None,
        )

    def crawl(self, **overrides):
        return self.crawler(**overrides).crawl(f"http://site.test:{self.port}/")

    def by_path(self, outcome):
        return {p.url.split(str(self.port), 1)[1]: p for p in outcome.pages}

    def test_order_is_seed_then_nav_then_relevant_sitemap_then_links(self):
        outcome = self.crawl()
        fetched_paths = [p.url.split(str(self.port), 1)[1] for p in outcome.pages if p.status == "fetched"]
        self.assertEqual(fetched_paths[:4], ["/", "/about", "/services", "/faq"])

    def test_outcomes_and_markdown(self):
        pages = self.by_path(self.crawl())
        self.assertEqual(pages["/"].status, "fetched")
        self.assertEqual(pages["/"].title, "Home")
        self.assertIn("Useful knowledge text", pages["/"].markdown)
        self.assertNotIn("window.secret", pages["/"].markdown)
        self.assertEqual((pages["/private/x"].status, pages["/private/x"].reason), ("skipped", "robots_denied"))
        self.assertEqual((pages["/away"].status, pages["/away"].reason), ("skipped", "redirect_outside_origin"))
        self.assertEqual((pages["/missing"].status, pages["/missing"].reason), ("skipped", "http_error"))
        self.assertEqual((pages["/broken"].status, pages["/broken"].reason), ("failed", "http_error"))
        self.assertEqual((pages["/big"].status, pages["/big"].reason), ("skipped", "too_large"))
        self.assertEqual((pages["/empty"].status, pages["/empty"].reason), ("skipped", "no_content"))

    def test_never_leaves_origin_or_fetches_skipped_types(self):
        self.crawl()
        self.assertNotIn("/file.pdf", FixtureHandler.hits)
        self.assertNotIn("/private/x", FixtureHandler.hits)

    def test_duplicates_and_same_origin_redirects_are_merged(self):
        outcome = self.crawl()
        fetched = [p.url for p in outcome.pages if p.status == "fetched"]
        self.assertEqual(len(fetched), len(set(fetched)))
        # /old redirects to /services, which nav already fetched
        self.assertEqual(self.by_path(outcome)["/old"].reason, "duplicate")

    def test_index_file_and_identical_content_are_not_indexed_twice(self):
        pages = self.by_path(self.crawl())
        self.assertNotIn("/index.html", pages)
        statuses = {pages["/blog"].status, pages["/blog-copy"].status}
        self.assertEqual(statuses, {"fetched", "skipped"})
        skipped = pages["/blog"] if pages["/blog"].status == "skipped" else pages["/blog-copy"]
        self.assertEqual(skipped.reason, "duplicate")

    def test_markdown_leaves_out_navigation_when_main_exists(self):
        home = self.by_path(self.crawl())["/"]
        self.assertNotIn("About us", home.markdown)
        self.assertIn("Useful knowledge text", home.markdown)

    def test_site_header_and_footer_are_captured_once_without_counting_as_a_page(self):
        outcome = self.crawl()
        self.assertIn("Footer:", outcome.site_chrome)
        self.assertIn("12 Garden Road, Kanpur", outcome.site_chrome)
        self.assertIn("- Phone: +918439977111", outcome.site_chrome)
        self.assertIn("- Email: hello@site.test", outcome.site_chrome)
        self.assertEqual(outcome.to_dict()["site_chrome"], outcome.site_chrome)
        # Page content still leaves the footer out, and no extra page is reported for it.
        self.assertNotIn("Garden Road", self.by_path(outcome)["/"].markdown)
        self.assertFalse(any("Garden Road" in p.markdown for p in outcome.pages))

    def test_fetches_the_linked_url_not_its_dedup_key(self):
        pages = self.by_path(self.crawl())
        self.assertEqual(pages["/cat/index.html"].status, "fetched")
        self.assertNotIn("/cat", FixtureHandler.hits)

    def test_follows_seed_redirect_to_www_and_crawls_there(self):
        FixtureHandler.redirect_apex_to_www = True
        outcome = self.crawl()
        fetched = [p for p in outcome.pages if p.status == "fetched"]
        self.assertGreater(len(fetched), 3)
        self.assertTrue(all(p.url.startswith(f"http://www.site.test:{self.port}/") for p in fetched))
        # After the first redirects, requests go straight to www.
        self.assertEqual(FixtureHandler.hosts[-1], "www.site.test")

    def test_depth_limit(self):
        paths = self.by_path(self.crawl(max_depth=2, max_pages=40))
        self.assertIn("/deep2", paths)
        self.assertNotIn("/deep3", paths)

    def test_page_cap_counts_only_pages_with_content(self):
        outcome = self.crawl(max_pages=8)
        fetched = [p for p in outcome.pages if p.status == "fetched"]
        attempted = [p for p in outcome.pages if p.reason != "robots_denied"]
        self.assertEqual(len(fetched), 8)
        # Empty, broken and duplicate pages were replaced by later candidates.
        self.assertGreater(len(attempted), 8)
        self.assertTrue(outcome.cap_reached)
        self.assertGreater(outcome.deferred_count, 0)

    def test_stops_at_cap_when_every_page_has_content(self):
        outcome = self.crawl(max_pages=3)
        self.assertEqual([p.status for p in outcome.pages], ["fetched"] * 3)
        self.assertTrue(outcome.cap_reached)

    def test_total_fetches_are_bounded_when_pages_are_empty(self):
        empty = (200, {"Content-Type": "text/html"}, b"<html><body><main></main></body></html>")
        original = dict(FixtureHandler.routes)
        for path in ("/about", "/services", "/faq", "/cat/index.html", "/blog", "/blog-copy", "/deep1", "/random-post"):
            FixtureHandler.routes[path] = empty
        try:
            outcome = self.crawl(max_pages=3)
        finally:
            FixtureHandler.routes = original
        attempted = [p for p in outcome.pages if p.reason != "robots_denied"]
        self.assertEqual(len(attempted), 6)
        self.assertLess(len([p for p in attempted if p.status == "fetched"]), 3)

    def test_robots_unreachable_disallows_everything(self):
        original = FixtureHandler.routes["/robots.txt"]
        FixtureHandler.routes["/robots.txt"] = (503, {}, b"")
        try:
            outcome = self.crawl()
        finally:
            FixtureHandler.routes["/robots.txt"] = original
        self.assertEqual([p.reason for p in outcome.pages], ["robots_denied"])

    def test_blocked_destination_is_refused_before_any_request(self):
        strict = SiteCrawler(CrawlBudget(15, 2, 30, 100_000), resolver=lambda h, p: ["127.0.0.1"])
        with self.assertRaises(UrlPolicyError) as ctx:
            strict.crawl(f"http://site.test:{self.port}/")
        self.assertEqual(ctx.exception.reason, "blocked_destination")
        self.assertEqual(FixtureHandler.hits, [])

    def test_time_budget(self):
        ticks = iter(range(0, 1000, 10))
        crawler = self.crawler(timeout_seconds=25)
        crawler.clock = lambda: next(ticks)
        outcome = crawler.crawl(f"http://site.test:{self.port}/")
        self.assertTrue(outcome.time_budget_reached)


class SiteChromeTests(unittest.TestCase):
    def chrome(self, html):
        return extract_site_chrome(Selector(content=html))

    def test_header_top_bar_footer_and_contact_links(self):
        text = self.chrome(
            '<html><body><div class="site-topbar">Free site visits every Sunday</div>'
            '<header><a href="/">Acme Homes</a><span>Call 98765 43210</span></header>'
            '<main><article><header><h2>Card title</h2></header><p>Body</p></article></main>'
            '<footer><p>Acme Homes Pvt Ltd</p><p>Address: 5 Lake View, Pune</p>'
            '<a href="https://wa.me/919876543210">WhatsApp</a><a href="https://www.instagram.com/acme">IG</a>'
            '<a href="/privacy">Privacy</a></footer></body></html>'
        )
        self.assertIn("Header:\nAcme Homes\nCall 98765 43210", text)
        self.assertIn("Top bar:\nFree site visits every Sunday", text)
        self.assertIn("Footer:\nAcme Homes Pvt Ltd\nAddress: 5 Lake View, Pune", text)
        self.assertNotIn("Card title", text)
        self.assertIn("- WhatsApp: https://wa.me/919876543210", text)
        self.assertIn("- Instagram: https://www.instagram.com/acme", text)
        self.assertNotIn("/privacy", text)

    def test_last_footer_and_role_based_regions(self):
        text = self.chrome(
            '<html><body><div role="banner">Brand bar</div><main><section><footer>Post meta</footer></section></main>'
            '<div role="contentinfo">ignored</div><footer>Site footer 2026</footer></body></html>'
        )
        self.assertIn("Header:\nBrand bar", text)
        self.assertIn("Footer:\nSite footer 2026", text)
        self.assertNotIn("Post meta", text)

    def test_pages_without_regions_or_links_give_nothing(self):
        self.assertEqual(self.chrome("<html><body><main><p>Only content</p></main></body></html>"), "")

    def test_contact_link_rules(self):
        self.assertEqual(contact_link("tel:+1 (555) 010-9999"), ("Phone", "+15550109999"))
        self.assertEqual(contact_link("tel:12"), None)
        self.assertEqual(contact_link("mailto:a@b.co?subject=x"), ("Email", "a@b.co"))
        self.assertEqual(contact_link("https://m.facebook.com/acme"), ("Facebook", "https://m.facebook.com/acme"))
        self.assertEqual(contact_link("https://notfacebook.com/x"), None)
        self.assertEqual(contact_link("javascript:alert(1)"), None)


if __name__ == "__main__":
    unittest.main()
