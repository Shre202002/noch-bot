"""Private HTTP API for the NochBot crawler.

Only the NochBot Next.js backend calls this service. It authenticates with a
shared bearer token (CRAWLER_SERVICE_TOKEN), never touches MongoDB, embeddings
or tenant records, and returns per-page Markdown plus crawl outcomes.
"""

from __future__ import annotations

import hmac
import logging
import os
import threading
import time

from flask import Flask, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from .crawler import CrawlBudget, SiteCrawler
from .url_policy import UrlPolicyError, redact

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("nochbot_crawler.app")

# Hard ceilings: the app computes per-plan budgets, and the service refuses anything above these.
MAX_PAGES_CEILING = 50
MAX_DEPTH_CEILING = 4
TIMEOUT_CEILING_SECONDS = 60
RESPONSE_BYTES_CEILING = 5 * 1024 * 1024
MAX_CONCURRENT_CRAWLS = int(os.environ.get("CRAWLER_MAX_CONCURRENT", "2"))
MIN_TOKEN_LENGTH = 32
MAX_REQUEST_BODY_BYTES = 16 * 1024

_crawl_slots = threading.BoundedSemaphore(MAX_CONCURRENT_CRAWLS)


class CrawlRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    max_pages: int = Field(ge=1, le=MAX_PAGES_CEILING)
    max_depth: int = Field(ge=0, le=MAX_DEPTH_CEILING)
    timeout_seconds: float = Field(ge=5, le=TIMEOUT_CEILING_SECONDS)
    max_response_bytes: int = Field(ge=64 * 1024, le=RESPONSE_BYTES_CEILING)
    correlation_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")


def _service_token() -> str:
    token = os.environ.get("CRAWLER_SERVICE_TOKEN", "")
    if len(token) < MIN_TOKEN_LENGTH:
        raise RuntimeError(f"CRAWLER_SERVICE_TOKEN must be set to at least {MIN_TOKEN_LENGTH} characters")
    return token


def create_app() -> Flask:
    token = _service_token()
    expected_auth = f"Bearer {token}".encode()
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BODY_BYTES

    def authorized() -> bool:
        header = request.headers.get("Authorization", "")
        return bool(header) and hmac.compare_digest(header.encode(), expected_auth)

    @app.get("/healthz")
    def healthz():
        return jsonify(ok=True)

    # Threaded WSGI server: each request runs in its own worker thread, and the crawl itself is sequential.
    @app.post("/v1/crawl")
    def crawl():
        # Auth runs before the body is read, so unauthenticated callers learn nothing about the schema.
        if not authorized():
            return jsonify(detail="unauthorized"), 401

        try:
            body = CrawlRequest.model_validate(request.get_json(silent=True))
        except ValidationError:
            return jsonify(error="invalid_request"), 422

        if not _crawl_slots.acquire(blocking=False):
            return jsonify(error="busy"), 503

        started = time.monotonic()
        try:
            budget = CrawlBudget(
                max_pages=body.max_pages,
                max_depth=body.max_depth,
                timeout_seconds=body.timeout_seconds,
                max_response_bytes=body.max_response_bytes,
            )
            outcome = SiteCrawler(budget).crawl(body.url)
        except UrlPolicyError as exc:
            log.info("crawl_rejected cid=%s target=%s reason=%s", body.correlation_id, redact(body.url), exc.reason)
            return jsonify(error="policy", reason=exc.reason), 422
        except Exception:
            log.exception("crawl_error cid=%s target=%s", body.correlation_id, redact(body.url))
            return jsonify(error="internal"), 500
        finally:
            _crawl_slots.release()

        result = outcome.to_dict()
        fetched = sum(1 for p in outcome.pages if p.status == "fetched")
        log.info(
            "crawl_done cid=%s target=%s pages=%d fetched=%d deferred=%d robots_denied=%d requests=%d ms=%d",
            body.correlation_id,
            redact(body.url),
            len(outcome.pages),
            fetched,
            outcome.deferred_count,
            outcome.robots_denied,
            outcome.requests_made,
            int((time.monotonic() - started) * 1000),
        )
        return jsonify(result)

    return app
