"""URL and destination policy for the crawler.

Every URL the crawler touches (seed, robots.txt, sitemap, page, redirect hop)
must pass through these helpers. A crawl stays on one site: the submitted host
and its www/apex counterpart, over http/https on default ports (or the exact
scheme and port when a custom port was submitted). Every resolved address of
those hosts must be public.
"""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass, replace
from typing import Callable, Dict, FrozenSet, Iterable, List, Optional
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443, 8080, 8443}
DEFAULT_PORTS = {"http": 80, "https": 443}
BLOCKED_HOST_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home.arpa")
MAX_URL_LENGTH = 2048

# Query keys that only identify campaigns/clicks and never select different content.
TRACKING_PARAMS = {
    "gclid", "fbclid", "msclkid", "dclid", "yclid", "mc_cid", "mc_eid",
    "_ga", "_gl", "igshid", "ref_src",
}

# "/docs/index.html" serves the same page as "/docs/".
DIRECTORY_INDEX_FILES = {"index.html", "index.htm", "index.php"}

# NAT64 well-known prefix embeds an IPv4 address in the low 32 bits.
NAT64_PREFIX = ipaddress.ip_network("64:ff9b::/96")


class UrlPolicyError(Exception):
    """Raised when a URL or destination is not allowed. `reason` is a safe public category."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Origin:
    scheme: str
    host: str
    port: int

    def url(self, path: str = "/") -> str:
        default = DEFAULT_PORTS[self.scheme]
        netloc = self.host if self.port == default else f"{self.host}:{self.port}"
        if ":" in self.host:
            netloc = f"[{self.host}]" if self.port == default else f"[{self.host}]:{self.port}"
        return urlunsplit((self.scheme, netloc, path, "", ""))


def alternate_host(host: str) -> Optional[str]:
    """The www/apex counterpart of a hostname, or None for IP literals and single-label hosts."""
    try:
        ipaddress.ip_address(host)
        return None
    except ValueError:
        pass
    if host.startswith("www."):
        apex = host[4:]
        return apex if "." in apex else None
    return f"www.{host}" if "." in host else None


@dataclass(frozen=True)
class Site:
    """The set of URLs one crawl may touch. `primary` is the origin the site actually serves from."""

    hosts: FrozenSet[str]
    primary: Origin

    def contains(self, url: str) -> bool:
        try:
            candidate = parse_origin(url)
        except UrlPolicyError:
            return False
        if candidate.host not in self.hosts:
            return False
        if self.primary.port == DEFAULT_PORTS[self.primary.scheme]:
            return candidate.port == DEFAULT_PORTS[candidate.scheme]
        return candidate.scheme == self.primary.scheme and candidate.port == self.primary.port

    def with_primary(self, url: str) -> "Site":
        return replace(self, primary=parse_origin(url)) if self.contains(url) else self

    def rebase(self, url: str) -> str:
        """Same path and query on the primary origin, without the fragment."""
        parts = urlsplit(url)
        return urlunsplit((self.primary.scheme, urlsplit(self.primary.url()).netloc, parts.path or "/", parts.query, ""))

    def key(self, url: str) -> str:
        """Dedup key: the canonical URL on the primary origin."""
        return canonicalize(self.rebase(url))


Resolver = Callable[[str, int], Iterable[str]]
AddressCheck = Callable[[str], bool]


def is_public_address(ip: str) -> bool:
    """True only for globally routable unicast addresses."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False

    if addr.version == 6:
        if addr.ipv4_mapped is not None:
            return is_public_address(str(addr.ipv4_mapped))
        if addr in NAT64_PREFIX:
            return is_public_address(str(ipaddress.IPv4Address(int(addr) & 0xFFFFFFFF)))
        if addr.sixtofour is not None or addr.teredo is not None:
            return False

    return addr.is_global and not addr.is_multicast


def system_resolver(host: str, port: int) -> List[str]:
    infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    return sorted({info[4][0] for info in infos})


def parse_origin(raw_url: str) -> Origin:
    """Validate a URL's syntax and return its exact origin."""
    if not isinstance(raw_url, str) or not raw_url or len(raw_url) > MAX_URL_LENGTH:
        raise UrlPolicyError("invalid_url")

    try:
        parts = urlsplit(raw_url.strip())
        port = parts.port
    except ValueError:
        raise UrlPolicyError("invalid_url")

    scheme = (parts.scheme or "").lower()
    if scheme not in ALLOWED_SCHEMES:
        raise UrlPolicyError("invalid_url")
    if parts.username is not None or parts.password is not None:
        raise UrlPolicyError("invalid_url")

    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise UrlPolicyError("invalid_url")
    if host == "localhost" or host.endswith(BLOCKED_HOST_SUFFIXES):
        raise UrlPolicyError("blocked_destination")

    effective_port = port if port is not None else DEFAULT_PORTS[scheme]
    if effective_port not in ALLOWED_PORTS:
        raise UrlPolicyError("blocked_destination")

    # IP-literal hosts are checked here; hostnames are checked after resolution.
    try:
        ipaddress.ip_address(host)
        is_literal = True
    except ValueError:
        is_literal = False
    if is_literal and not is_public_address(host):
        raise UrlPolicyError("blocked_destination")

    return Origin(scheme=scheme, host=host, port=effective_port)


def resolve_public_addresses(
    origin: Origin,
    resolver: Resolver = system_resolver,
    address_check: AddressCheck = is_public_address,
) -> List[str]:
    """Resolve the origin host. Every returned address must be allowed, otherwise the origin is refused."""
    try:
        addresses = list(resolver(origin.host, origin.port))
    except (OSError, UnicodeError):
        raise UrlPolicyError("dns_failed")

    if not addresses:
        raise UrlPolicyError("dns_failed")
    if not all(address_check(ip) for ip in addresses):
        raise UrlPolicyError("blocked_destination")
    return addresses


def canonicalize(url: str) -> str:
    """Normalize obvious variants so they count as one page.

    Removes fragments, default ports, tracking-only params and directory index
    file names, lowercases the scheme/host and drops a trailing slash (except
    the root). Path case and
    meaningful query params are kept because they can select different content.
    """
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").rstrip(".").lower()
    netloc = f"[{host}]" if ":" in host else host
    if parts.port is not None and parts.port != DEFAULT_PORTS.get(scheme):
        netloc = f"{netloc}:{parts.port}"

    path = parts.path or "/"
    last_segment = path.rsplit("/", 1)[-1].lower()
    if last_segment in DIRECTORY_INDEX_FILES:
        path = path[: -len(last_segment)] or "/"
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/") or "/"

    query_pairs = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in TRACKING_PARAMS
    ]
    query = urlencode(query_pairs, doseq=True)
    return urlunsplit((scheme, netloc, path, query, ""))


def resolve_site(
    origin: Origin,
    resolver: Resolver = system_resolver,
    address_check: AddressCheck = is_public_address,
) -> Dict[str, List[str]]:
    """Validated addresses for the submitted host (required) and its www/apex counterpart (optional)."""
    hosts = {origin.host: resolve_public_addresses(origin, resolver, address_check)}
    alt = alternate_host(origin.host)
    if alt:
        try:
            hosts[alt] = resolve_public_addresses(replace(origin, host=alt), resolver, address_check)
        except UrlPolicyError:
            pass  # The counterpart is optional; a missing or private one is simply not allowed.
    return hosts


def same_origin(url: str, origin: Origin) -> bool:
    try:
        candidate = parse_origin(url)
    except UrlPolicyError:
        return False
    return candidate == origin


def resolve_link(base_url: str, href: str) -> str | None:
    """Join a link against its page and return the absolute URL without fragment, or None for non-HTTP links."""
    href = (href or "").strip()
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    try:
        joined = urljoin(base_url, href)
    except ValueError:
        return None
    parts = urlsplit(joined)
    if parts.scheme.lower() not in ALLOWED_SCHEMES or len(joined) > MAX_URL_LENGTH:
        return None
    return urlunsplit((parts.scheme, parts.netloc, parts.path or "/", parts.query, ""))


def redact(url: str) -> str:
    """Scheme, host and path only. Safe for logs and API responses."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return "[invalid-url]"
    netloc = parts.hostname or ""
    if parts.port is not None and parts.port != DEFAULT_PORTS.get(parts.scheme.lower()):
        netloc = f"{netloc}:{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path or "/", "", ""))
