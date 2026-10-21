"""Run the crawler service: ``python -m nochbot_crawler``.

Reads settings from the environment, plus a ``.env`` file in the working
directory when present (real environment variables win).
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

# Load before importing the app: it reads CRAWLER_MAX_CONCURRENT at import time.
load_dotenv()

from waitress import serve  # noqa: E402

from .app import MAX_CONCURRENT_CRAWLS, create_app  # noqa: E402


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8787"))
    # A couple of spare threads so health checks and 503 "busy" replies are not queued behind crawls.
    serve(create_app(), host=host, port=port, threads=MAX_CONCURRENT_CRAWLS + 2, ident=None)


if __name__ == "__main__":
    main()
