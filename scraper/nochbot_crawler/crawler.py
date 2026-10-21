"""Bounded single-origin crawler built on Scrapling's static fetch session.

Page order (phase decision D-02): submitted URL, then primary navigation links,
then relevant sitemap entries, then breadth-first same-origin links. Within a
tier, likely knowledge pages (about, services, FAQ, ...) go first.

Security model: the site's hosts (submitted host and its www/apex counterpart)
are resolved once, every address must be public, and the HTTP session is pinned
to those addresses with CURLOPT_RESOLVE so later DNS answers cannot redirect the
crawl (DNS rebinding). Redirects are followed manually and only within the
site. Response bodies are capped by curl.
"""

from __future__ import annotations

import hashlib
import heapq
import itertools
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import urlsplit
from xml.etree import ElementTree

from curl_cffi import CurlOpt
from curl_cffi.requests import Session as CurlSession
from curl_cffi.requests.exceptions import RequestException, Timeout
from protego import Protego
from scrapling.engines.static import _SyncSessionLogic

from .url_policy import (
    DEFAULT_PORTS,
    AddressCheck,
    Resolver,
    Site,
    is_public_address,
    parse_origin,
    redact,
    resolve_link,
    resolve_site,
    system_resolver,
)

# Scrapling logs every fetched URL (including query strings) at INFO. Outcomes are
# logged by this service in redacted form instead.
logging.getLogger("scrapling").setLevel(logging.CRITICAL)
log = logging.getLogger("nochbot_crawler")

USER_AGENT = "NochBot/1.0 (+https://nochbot.com/bot)"
ROBOTS_AGENT = "NochBot"
MIN_CONTENT_CHARS = 100
MAX_MARKDOWN_CHARS = 20_000
MAX_REDIRECTS = 5
MAX_SITEMAP_URLS = 200
MAX_SITEMAP_FILES = 3
MAX_RECORDED_SKIPS = 30
DEFAULT_DELAY_SECONDS = 0.25
# Only pages with usable content count toward max_pages, so skipped pages are
# replaced by the next candidate. This caps total fetches at max_pages * 2.
MAX_ATTEMPTS_FACTOR = 2
MAX_DELAY_SECONDS = 2.0
CURL_FILE_TOO_LARGE = 63

TIER_SEED, TIER_NAV, TIER_SITEMAP, TIER_LINK = 0, 1, 2, 3

RELEVANT_TERMS = (
    "about", "service", "product", "pricing", "price", "plan", "faq", "help", "support",
    "contact", "feature", "solution", "event", "ticket", "team", "company", "doc",
    "guide", "how-it-works", "menu", "location", "booking", "policy", "shipping", "return",
)
SKIPPED_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".css", ".js", ".json",
    ".xml", ".zip", ".gz", ".rar", ".mp3", ".mp4", ".mov", ".avi", ".webm", ".woff", ".woff2",
    ".ttf", ".eot", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".exe", ".dmg", ".csv",
}
# Regions tried in order for page content; navigation and footers are left out when one exists.
MAIN_CONTENT_SELECTORS = ("main", "[role=main]", "article")

SKIPPED_PATH_PARTS = re.compile(
    r"/(wp-admin|wp-login|wp-json|cdn-cgi|login|signin|sign-in|logout|cart|checkout|my-account|feed|tag|author)(/|$)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class CrawlBudget:
    max_pages: int
    max_depth: int
    timeout_seconds: float
    max_response_bytes: int
    per_page_timeout_seconds: float = 10.0


@dataclass
class PageResult:
    url: str
    status: str  # fetched | skipped | blocked | failed
    depth: int
    title: str = ""
    markdown: str = ""
    reason: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "url": self.url,
            "title": self.title,
            "markdown": self.markdown,
            "status": self.status,
            "reason": self.reason,
            "depth": self.depth,
            "chars": len(self.markdown),
        }


@dataclass
class CrawlOutcome:
    pages: List[PageResult]
    deferred_count: int
    cap_reached: bool
    time_budget_reached: bool
    robots_denied: int
    requests_made: int
    site_chrome: str = ""

    def to_dict(self) -> Dict:
        return {
            "version": 1,
            "pages": [p.to_dict() for p in self.pages],
            "site_chrome": self.site_chrome,
            "deferred_count": self.deferred_count,
            "cap_reached": self.cap_reached,
            "time_budget_reached": self.time_budget_reached,
            "stats": {"robots_denied": self.robots_denied, "requests": self.requests_made},
        }


@dataclass(order=True)
class _Candidate:
    tier: int
    relevance: int  # negated so higher relevance sorts first
    depth: int
    seq: int
    key: str = field(compare=False)  # canonical URL used for dedup
    url: str = field(compare=False)  # URL actually requested


class _PinnedSession(_SyncSessionLogic):
    """Scrapling static session whose curl handle is pinned to pre-validated addresses."""

    def __init__(self, curl_options: Dict, **kwargs):
        super().__init__(**kwargs)
        self._pinned_options = curl_options

    def __enter__(self):
        if self._is_alive:
            raise RuntimeError("Session already active")
        self._curl_session = CurlSession(curl_options=self._pinned_options)
        self._is_alive = True
        return self


class _FetchResult:
    def __init__(self, status: int, response=None, location: Optional[str] = None):
        self.status = status
        self.response = response
        self.location = location


def extract_markdown(response) -> str:
    """Markdown for the page's main content region, falling back to the whole body."""
    for selector in MAIN_CONTENT_SELECTORS:
        if response.css(selector).first is not None:
            markdown = response.markdown(css_selector=selector, main_content_only=True).strip()
            if len(markdown) >= MIN_CONTENT_CHARS:
                return markdown
            break
    return response.markdown(main_content_only=True).strip()


# Site-wide regions. Contact details, addresses and hours often appear only here, and main-content extraction drops
# them, so they are captured once per crawl (see src/lib/crawler/siteChrome.ts for the same rules in the legacy crawler).
HEADER_SELECTORS = ("body > header", "header", "[role=banner]", "#header", "#masthead", ".site-header")
TOPBAR_SELECTORS = ("[class*=topbar]", "[class*=top-bar]", "[class*=announcement]")
FOOTER_SELECTORS = ("footer", "[role=contentinfo]", "#footer", ".site-footer", ".footer")
SOCIAL_HOSTS = {
    "facebook.com": "Facebook", "instagram.com": "Instagram", "linkedin.com": "LinkedIn", "twitter.com": "Twitter",
    "x.com": "X", "youtube.com": "YouTube", "pinterest.com": "Pinterest", "t.me": "Telegram",
}
MAX_CHROME_CHARS = 4_000
MAX_CHROME_LINKS = 20


def _region_text(element) -> str:
    """Visible text of a region, one line per text run, without repeated or empty lines."""
    lines: List[str] = []
    for raw in str(element.get_all_text(separator="\n", strip=True, ignore_tags=("script", "style", "noscript", "svg"))).split("\n"):
        line = re.sub(r"\s+", " ", raw).strip()
        if line and (not lines or lines[-1] != line):
            lines.append(line)
    return "\n".join(lines)


def _pick(response, selectors, last: bool = False):
    for selector in selectors:
        found = response.css(selector)
        if len(found):
            return found[-1] if last else found[0]
    return None


def contact_link(href: str) -> Optional[Tuple[str, str]]:
    """("Phone", "84399771118") for tel:, mailto:, WhatsApp and social-profile links; None for any other link."""
    href = (href or "").strip()
    lower = href.lower()
    if lower.startswith("tel:"):
        number = re.sub(r"[^\d+]", "", href[4:])
        return ("Phone", number) if len(re.sub(r"\D", "", number)) >= 6 else None
    if lower.startswith("mailto:"):
        email = href[7:].split("?")[0].strip()
        return ("Email", email) if "@" in email else None
    if not lower.startswith(("http://", "https://")):
        return None
    host = (urlsplit(href).hostname or "").lower().removeprefix("www.")
    if host in ("wa.me", "api.whatsapp.com", "whatsapp.com", "chat.whatsapp.com"):
        return ("WhatsApp", href)
    for social, label in SOCIAL_HOSTS.items():
        if host == social or host.endswith("." + social):
            return (label, href)
    return None


def extract_site_chrome(response) -> str:
    """Header, top bar and footer text plus contact/social links, as one block for the whole site."""
    try:
        sections: List[str] = []
        seen_regions: Set[str] = set()
        for label, selectors, last in (("Header", HEADER_SELECTORS, False), ("Top bar", TOPBAR_SELECTORS, False), ("Footer", FOOTER_SELECTORS, True)):
            element = _pick(response, selectors, last)
            text = _region_text(element) if element is not None else ""
            if text and text not in seen_regions:
                seen_regions.add(text)
                sections.append(f"{label}:\n{text}")

        links: List[str] = []
        for anchor in response.css("a[href]"):
            found = contact_link(str(anchor.attrib.get("href", "")))
            if found:
                line = f"- {found[0]}: {found[1]}"
                if line not in links:
                    links.append(line)
            if len(links) >= MAX_CHROME_LINKS:
                break
        if links:
            sections.append("Contact and social links:\n" + "\n".join(links))
        return "\n\n".join(sections)[:MAX_CHROME_CHARS]
    except Exception:  # noqa: BLE001 - site-wide details are a bonus; a page must never fail because of them
        log.warning("site_chrome_extraction_failed")
        return ""


def relevance_score(url: str, anchor_text: str = "") -> int:
    haystack = f"{urlsplit(url).path} {anchor_text}".lower()
    return sum(1 for term in RELEVANT_TERMS if term in haystack)


def is_crawlable_path(url: str) -> bool:
    path = urlsplit(url).path.lower()
    dot = path.rfind(".")
    if dot > path.rfind("/") and path[dot:] in SKIPPED_EXTENSIONS:
        return False
    return not SKIPPED_PATH_PARTS.search(path)


class SiteCrawler:
    def __init__(
        self,
        budget: CrawlBudget,
        resolver: Resolver = system_resolver,
        address_check: AddressCheck = is_public_address,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.budget = budget
        self.resolver = resolver
        self.address_check = address_check
        self.clock = clock
        self.sleep = sleep
        self._requests = 0
        self._content_hashes: Set[str] = set()

    # ── public ──────────────────────────────────────────────────────

    def crawl(self, start_url: str) -> CrawlOutcome:
        origin = parse_origin(start_url)
        addresses = resolve_site(origin, self.resolver, self.address_check)
        site = Site(hosts=frozenset(addresses), primary=origin)

        deadline = self.clock() + self.budget.timeout_seconds
        ports = [origin.port] if origin.port != DEFAULT_PORTS[origin.scheme] else sorted(set(DEFAULT_PORTS.values()))
        curl_options = {
            CurlOpt.RESOLVE: [
                self._resolve_entry(host, port, ip)
                for host, ips in addresses.items()
                for port in ports
                for ip in ips
            ],
            CurlOpt.MAXFILESIZE_LARGE: self.budget.max_response_bytes,
            CurlOpt.PROTOCOLS_STR: "http,https",
        }

        with _PinnedSession(
            curl_options,
            impersonate=None,
            stealthy_headers=False,
            retries=1,
            follow_redirects=False,
            timeout=self.budget.per_page_timeout_seconds,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"},
        ) as session:
            robots, site = self._load_robots(session, site)
            delay = self._crawl_delay(robots)
            return self._run(session, site, start_url, robots, delay, deadline)

    # ── crawl loop ──────────────────────────────────────────────────

    def _run(self, session, site: Site, start_url: str, robots: Protego, delay: float, deadline: float) -> CrawlOutcome:
        seq = itertools.count()
        queue: List[_Candidate] = []
        queued: Set[str] = set()
        visited: Set[str] = set()
        pages: List[PageResult] = []
        fetched = 0
        attempts = 0
        max_attempts = self.budget.max_pages * MAX_ATTEMPTS_FACTOR
        robots_denied = 0
        recorded_skips = 0
        time_budget_reached = False
        sitemap_loaded = False
        site_chrome = ""

        def push(url: str, tier: int, depth: int, anchor: str = "") -> None:
            if depth > self.budget.max_depth or not site.contains(url) or not is_crawlable_path(url):
                return
            key = site.key(url)
            if key in queued or key in visited:
                return
            queued.add(key)
            heapq.heappush(queue, _Candidate(tier, -relevance_score(url, anchor), depth, next(seq), key, site.rebase(url)))

        push(start_url, TIER_SEED, 0)

        while queue and fetched < self.budget.max_pages and attempts < max_attempts:
            if self.clock() >= deadline:
                time_budget_reached = True
                break

            candidate = heapq.heappop(queue)
            queued.discard(candidate.key)
            if candidate.key in visited:
                continue
            visited.add(candidate.key)

            if not robots.can_fetch(candidate.url, ROBOTS_AGENT):
                robots_denied += 1
                if recorded_skips < MAX_RECORDED_SKIPS:
                    pages.append(PageResult(redact(candidate.url), "skipped", candidate.depth, reason="robots_denied"))
                    recorded_skips += 1
                continue

            if attempts > 0:
                self.sleep(delay)
            attempts += 1

            page, response, final_url = self._fetch_page(session, site, robots, candidate, visited)
            pages.append(page)
            if page.status == "fetched":
                fetched += 1
                # Taken from the first usable page (normally the homepage); it is not a page of its own.
                if not site_chrome and response is not None:
                    site_chrome = extract_site_chrome(response)

            if candidate.tier == TIER_SEED and final_url:
                # The seed may redirect to the site's real origin (https or www); later URLs use it.
                site = site.with_primary(final_url)
                visited.add(site.key(final_url))

            if response is not None and candidate.depth < self.budget.max_depth:
                self._enqueue_links(response, final_url or candidate.url, candidate.depth, candidate.tier, push)

            # Sitemap candidates join the queue after the seed so that the seed's
            # navigation links (tier 1) still outrank them.
            if not sitemap_loaded:
                sitemap_loaded = True
                for url in self._sitemap_urls(session, site, robots, deadline):
                    tier = TIER_SITEMAP if relevance_score(url) > 0 else TIER_LINK
                    push(url, tier, 1)

        deferred = len({c.key for c in queue} - visited)
        return CrawlOutcome(
            pages=pages,
            deferred_count=deferred,
            cap_reached=fetched >= self.budget.max_pages and deferred > 0,
            time_budget_reached=time_budget_reached,
            robots_denied=robots_denied,
            requests_made=self._requests,
            site_chrome=site_chrome,
        )

    def _enqueue_links(self, response, base_url: str, depth: int, tier: int, push) -> None:
        nav_links: Set[str] = set()
        if tier == TIER_SEED:
            for anchor in response.css("nav a, header a"):
                url = resolve_link(base_url, anchor.attrib.get("href", ""))
                if url:
                    nav_links.add(url)
                    push(url, TIER_NAV, depth + 1, str(anchor.get_all_text(strip=True)))

        for anchor in response.css("a[href]"):
            url = resolve_link(base_url, anchor.attrib.get("href", ""))
            if url and url not in nav_links:
                push(url, TIER_LINK, depth + 1, str(anchor.get_all_text(strip=True)))

    # ── fetching ────────────────────────────────────────────────────

    def _fetch_page(self, session, site: Site, robots: Protego, candidate: _Candidate, visited: Set[str]):
        safe_url = redact(candidate.url)
        url = candidate.url
        try:
            for _ in range(MAX_REDIRECTS + 1):
                result = self._get(session, url)
                if result.location is None:
                    break
                # Follow exactly where the site points, as long as it stays on the site.
                target = resolve_link(url, result.location)
                if target is None or not site.contains(target):
                    return PageResult(safe_url, "skipped", candidate.depth, reason="redirect_outside_origin"), None, None
                if not robots.can_fetch(target, ROBOTS_AGENT):
                    return PageResult(safe_url, "skipped", candidate.depth, reason="robots_denied"), None, None
                target_key = site.key(target)
                if target_key != candidate.key and target_key in visited:
                    return PageResult(safe_url, "skipped", candidate.depth, reason="duplicate"), None, None
                visited.add(target_key)
                url = target
            else:
                return PageResult(safe_url, "failed", candidate.depth, reason="too_many_redirects"), None, None
        except Timeout:
            return PageResult(safe_url, "failed", candidate.depth, reason="timeout"), None, None
        except RequestException as exc:
            if getattr(exc, "code", None) == CURL_FILE_TOO_LARGE:
                return PageResult(safe_url, "skipped", candidate.depth, reason="too_large"), None, None
            return PageResult(safe_url, "failed", candidate.depth, reason="fetch_failed"), None, None

        safe_url = redact(url)
        status = result.status
        response = result.response
        if status == 429 or status >= 500:
            return PageResult(safe_url, "failed", candidate.depth, reason="http_error"), None, None
        if status >= 400:
            # Broken or forbidden links are not usable content; they do not block publication.
            reason = "blocked_by_site" if status in (401, 403) else "http_error"
            return PageResult(safe_url, "skipped", candidate.depth, reason=reason), None, None

        content_type = str(self._header(response, "content-type") or "").lower()
        if content_type and "html" not in content_type:
            return PageResult(safe_url, "skipped", candidate.depth, reason="unsupported_content"), None, None

        title = str(response.css("title::text").get() or "").strip()[:300]
        markdown = extract_markdown(response)[:MAX_MARKDOWN_CHARS]
        if len(markdown) < MIN_CONTENT_CHARS:
            return PageResult(safe_url, "skipped", candidate.depth, title=title, reason="no_content"), response, url

        # The same content served under different URLs would only add duplicate chunks.
        digest = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
        if digest in self._content_hashes:
            return PageResult(safe_url, "skipped", candidate.depth, title=title, reason="duplicate"), response, url
        self._content_hashes.add(digest)
        return PageResult(safe_url, "fetched", candidate.depth, title=title, markdown=markdown), response, url

    def _get(self, session, url: str) -> _FetchResult:
        self._requests += 1
        response = session.get(url)
        status = int(response.status)
        if status in (301, 302, 303, 307, 308):
            return _FetchResult(status, response, location=self._header(response, "location") or "")
        return _FetchResult(status, response)

    @staticmethod
    def _header(response, name: str) -> Optional[str]:
        for key, value in dict(response.headers or {}).items():
            if key.lower() == name:
                return value
        return None

    @staticmethod
    def _resolve_entry(host: str, port: int, ip: str) -> str:
        return f"{host}:{port}:{f'[{ip}]' if ':' in ip else ip}"

    # ── robots.txt and sitemaps ─────────────────────────────────────

    def _load_robots(self, session, site: Site) -> Tuple[Protego, Site]:
        """RFC 9309: 4xx means no restrictions; 5xx or unreachable means disallow everything.

        Where robots.txt redirects within the site (to https or www) is also where
        the site serves from, so the final URL becomes the site's primary origin.
        """
        url = site.primary.url("/robots.txt")
        try:
            result = self._get(session, url)
            hops = 0
            while result.location is not None and hops < MAX_REDIRECTS:
                target = resolve_link(url, result.location)
                if target is None or not site.contains(target):
                    return Protego.parse(""), site
                url = target
                result = self._get(session, url)
                hops += 1
        except RequestException:
            return Protego.parse("User-agent: *\nDisallow: /"), site

        if result.location is not None or 400 <= result.status < 500:
            return Protego.parse(""), site
        if result.status >= 500:
            return Protego.parse("User-agent: *\nDisallow: /"), site

        site = site.with_primary(url)
        body = result.response.body.decode("utf-8", errors="replace")[:500_000]
        try:
            return Protego.parse(body), site
        except Exception:
            return Protego.parse(""), site

    def _crawl_delay(self, robots: Protego) -> float:
        delay = robots.crawl_delay(ROBOTS_AGENT)
        if delay is None:
            return DEFAULT_DELAY_SECONDS
        return min(max(float(delay), DEFAULT_DELAY_SECONDS), MAX_DELAY_SECONDS)

    def _sitemap_urls(self, session, site: Site, robots: Protego, deadline: float) -> List[str]:
        sitemap_files = [u for u in robots.sitemaps if site.contains(u)] or [site.primary.url("/sitemap.xml")]
        pending = list(dict.fromkeys(site.rebase(u) for u in sitemap_files))
        seen_files: Set[str] = set()
        urls: List[str] = []

        while pending and len(seen_files) < MAX_SITEMAP_FILES and len(urls) < MAX_SITEMAP_URLS:
            if self.clock() >= deadline:
                break
            sitemap_url = pending.pop(0)
            if sitemap_url in seen_files or not robots.can_fetch(sitemap_url, ROBOTS_AGENT):
                continue
            seen_files.add(sitemap_url)
            try:
                result = self._get(session, sitemap_url)
            except RequestException:
                continue
            if result.location is not None or result.status != 200:
                continue

            for kind, loc in self._parse_sitemap(result.response.body):
                link = resolve_link(sitemap_url, loc)
                if not link or not site.contains(link):
                    continue
                if kind == "sitemap":
                    pending.append(site.rebase(link))
                elif len(urls) < MAX_SITEMAP_URLS:
                    urls.append(link)
        return urls

    @staticmethod
    def _parse_sitemap(body: bytes) -> List[Tuple[str, str]]:
        # Sitemaps never need a DTD; refusing one blocks entity-expansion attacks.
        if b"<!DOCTYPE" in body.upper():
            return []
        try:
            root = ElementTree.fromstring(body)
        except ElementTree.ParseError:
            return []
        entries: List[Tuple[str, str]] = []
        for element in root:
            tag = element.tag.rsplit("}", 1)[-1]
            loc = next((child.text for child in element if child.tag.rsplit("}", 1)[-1] == "loc"), None)
            if loc:
                entries.append(("sitemap" if tag == "sitemap" else "url", loc.strip()))
        return entries
