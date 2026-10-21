import unittest

from nochbot_crawler.url_policy import (
    Origin,
    Site,
    alternate_host,
    resolve_site,
    UrlPolicyError,
    canonicalize,
    is_public_address,
    parse_origin,
    redact,
    resolve_link,
    resolve_public_addresses,
    same_origin,
)


class AddressPolicyTests(unittest.TestCase):
    def test_blocks_special_ipv4_ranges(self):
        for ip in [
            "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254",
            "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.1",
        ]:
            with self.subTest(ip=ip):
                self.assertFalse(is_public_address(ip))

    def test_blocks_special_ipv6_ranges(self):
        for ip in [
            "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2001:db8::1",
            "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2002:a00:1::1",
        ]:
            with self.subTest(ip=ip):
                self.assertFalse(is_public_address(ip))

    def test_allows_public_addresses(self):
        for ip in ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"]:
            with self.subTest(ip=ip):
                self.assertTrue(is_public_address(ip))

    def test_rejects_hostname_when_any_address_is_private(self):
        origin = parse_origin("https://example.com")
        with self.assertRaises(UrlPolicyError) as ctx:
            resolve_public_addresses(origin, resolver=lambda h, p: ["93.184.216.34", "10.0.0.5"])
        self.assertEqual(ctx.exception.reason, "blocked_destination")

    def test_dns_failure_is_reported(self):
        def boom(host, port):
            raise OSError("nope")

        with self.assertRaises(UrlPolicyError) as ctx:
            resolve_public_addresses(parse_origin("https://example.com"), resolver=boom)
        self.assertEqual(ctx.exception.reason, "dns_failed")


class UrlParsingTests(unittest.TestCase):
    def test_rejects_bad_urls(self):
        cases = {
            "ftp://example.com": "invalid_url",
            "file:///etc/passwd": "invalid_url",
            "https://user:pw@example.com": "invalid_url",
            "https://": "invalid_url",
            "http://localhost/": "blocked_destination",
            "http://printer.local/": "blocked_destination",
            "http://127.0.0.1/": "blocked_destination",
            "http://[::1]/": "blocked_destination",
            "http://169.254.169.254/latest/meta-data": "blocked_destination",
            "https://example.com:22/": "blocked_destination",
        }
        for url, reason in cases.items():
            with self.subTest(url=url):
                with self.assertRaises(UrlPolicyError) as ctx:
                    parse_origin(url)
                self.assertEqual(ctx.exception.reason, reason)

    def test_origin_defaults(self):
        self.assertEqual(parse_origin("HTTPS://Example.COM/a"), Origin("https", "example.com", 443))
        self.assertEqual(parse_origin("http://example.com:8080"), Origin("http", "example.com", 8080))

    def test_same_origin_is_exact(self):
        origin = parse_origin("https://example.com")
        self.assertTrue(same_origin("https://example.com:443/x", origin))
        self.assertFalse(same_origin("https://www.example.com/x", origin))
        self.assertFalse(same_origin("http://example.com/x", origin))
        self.assertFalse(same_origin("https://example.com.evil.net/", origin))


class CanonicalizeTests(unittest.TestCase):
    def test_merges_obvious_variants(self):
        variants = [
            "https://Example.com/about/",
            "https://example.com:443/about",
            "https://example.com/about#team",
            "https://example.com/about?utm_source=x&gclid=1",
        ]
        self.assertEqual({canonicalize(v) for v in variants}, {"https://example.com/about"})

    def test_directory_index_files_match_their_directory(self):
        self.assertEqual(canonicalize("https://example.com/index.html"), "https://example.com/")
        self.assertEqual(canonicalize("https://example.com/docs/index.php?x=1"), "https://example.com/docs?x=1")
        self.assertEqual(canonicalize("https://example.com/docs/reindex.html"), "https://example.com/docs/reindex.html")

    def test_keeps_meaningful_query_and_path_case(self):
        self.assertEqual(canonicalize("https://example.com/Docs?page=2"), "https://example.com/Docs?page=2")

    def test_root_keeps_slash(self):
        self.assertEqual(canonicalize("https://example.com"), "https://example.com/")

    def test_resolve_link_skips_non_http(self):
        base = "https://example.com/a/"
        self.assertIsNone(resolve_link(base, "mailto:x@example.com"))
        self.assertIsNone(resolve_link(base, "javascript:void(0)"))
        self.assertIsNone(resolve_link(base, "#top"))
        self.assertEqual(resolve_link(base, "../b/#x"), "https://example.com/b/")

    def test_redact_drops_query_and_fragment(self):
        self.assertEqual(redact("https://example.com/p?token=secret#x"), "https://example.com/p")


class SiteTests(unittest.TestCase):
    def setUp(self):
        self.site = Site(hosts=frozenset({"example.com", "www.example.com"}), primary=parse_origin("https://example.com/"))

    def test_alternate_host(self):
        self.assertEqual(alternate_host("example.com"), "www.example.com")
        self.assertEqual(alternate_host("www.example.com"), "example.com")
        self.assertIsNone(alternate_host("www.com"))
        self.assertIsNone(alternate_host("93.184.216.34"))

    def test_contains_www_and_scheme_variants_only(self):
        self.assertTrue(self.site.contains("http://example.com/a"))
        self.assertTrue(self.site.contains("https://www.example.com/a"))
        self.assertFalse(self.site.contains("https://blog.example.com/a"))
        self.assertFalse(self.site.contains("https://example.com:8443/a"))
        self.assertFalse(self.site.contains("https://evil.test/"))

    def test_custom_port_requires_exact_scheme_and_port(self):
        site = Site(hosts=frozenset({"example.com"}), primary=parse_origin("http://example.com:8080/"))
        self.assertTrue(site.contains("http://example.com:8080/a"))
        self.assertFalse(site.contains("https://example.com:8080/a"))
        self.assertFalse(site.contains("http://example.com/a"))

    def test_keys_and_rebase_use_primary_origin(self):
        site = self.site.with_primary("https://www.example.com/")
        self.assertEqual(site.key("http://example.com/about/"), "https://www.example.com/about")
        self.assertEqual(site.rebase("http://example.com/cat/index.html#x"), "https://www.example.com/cat/index.html")

    def test_with_primary_ignores_urls_off_site(self):
        self.assertEqual(self.site.with_primary("https://evil.test/"), self.site)

    def test_resolve_site_requires_main_host_and_drops_private_counterpart(self):
        addresses = {"example.com": ["93.184.216.34"], "www.example.com": ["10.0.0.1"]}
        hosts = resolve_site(parse_origin("https://example.com"), resolver=lambda h, p: addresses[h])
        self.assertEqual(hosts, {"example.com": ["93.184.216.34"]})


if __name__ == "__main__":
    unittest.main()
