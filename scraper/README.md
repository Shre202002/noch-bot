# NochBot crawler service

A private Python service (Flask, served by waitress) that crawls one website with [Scrapling](https://github.com/D4Vinci/Scrapling) and returns per-page Markdown. The NochBot Next.js app calls it from `POST /api/crawl`. The app keeps responsibility for authentication, plan limits, chunking, embeddings, MongoDB Atlas writes and knowledge publication. This service never sees database or embedding credentials.

## What it does

- Crawls one exact origin (scheme, host and port), in this order: submitted URL, navigation links, relevant sitemap entries, then other same-origin links. Within each group, likely knowledge pages (about, services, FAQ, pricing, …) go first.
- Enforces the page, depth, time and response-size budget sent by the app, capped by hard ceilings (50 pages, depth 4, 60 s, 5 MB).
- Obeys `robots.txt` per RFC 9309: a 4xx response means no restrictions; a 5xx or unreachable file means nothing may be crawled.
- Sends an honest user agent (`NochBot/1.0`). It does no stealth fetching, browser impersonation or proxy use.

### SSRF protections

- Allows only `http`/`https` URLs on ports 80, 443, 8080 or 8443, with no embedded credentials. Rejects `localhost`, `*.local` and similar hostnames.
- Resolves the host once. Every resolved address must be public; loopback, private, link-local, CGNAT, multicast, documentation, metadata, IPv4-mapped and NAT64 forms of those are all refused.
- Pins the curl session to the validated addresses (`CURLOPT_RESOLVE`), so DNS rebinding cannot redirect later requests.
- Follows redirects manually and only within the same origin.
- Caps response bodies at the transport level (`CURLOPT_MAXFILESIZE_LARGE`).
- Never puts query strings in logs or responses. Scrapling's own URL logging is silenced.

## API

`POST /v1/crawl` requires the header `Authorization: Bearer $CRAWLER_SERVICE_TOKEN`.

```json
{ "url": "https://example.com", "max_pages": 15, "max_depth": 3, "timeout_seconds": 25,
  "max_response_bytes": 2000000, "correlation_id": "c0ffee" }
```

The response has `version`, `pages[]` (each with `url`, `title`, `markdown`, `status`, `reason`, `depth` and `chars`), `deferred_count`, `cap_reached`, `time_budget_reached` and `stats`.

| HTTP status | Meaning |
|---|---|
| 200 | The crawl ran. Each page's outcome is in its `status`. |
| 401 | Bad or missing token. |
| 422 | Invalid body, or the URL was refused by policy: `{"error":"policy","reason":...}`. |
| 503 | Busy; the concurrent-crawl limit was reached. |
| 500 | Internal error. Details are logged, never returned. |

Each page's `status` is one of:
- **fetched:** usable content.
- **skipped:** robots-denied, an HTTP 4xx, an off-origin redirect, too large, not HTML, no text, or a duplicate.
- **failed:** a timeout, 5xx or 429 response, or a network error.

`GET /healthz` is a liveness check.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `CRAWLER_SERVICE_TOKEN` | yes | Shared secret, 32 characters or more. Use the same value in the Next.js app. |
| `CRAWLER_MAX_CONCURRENT` | no (default 2) | Number of crawls this instance runs at once. |
| `HOST` | no (default 127.0.0.1; 0.0.0.0 in the container) | Listen address. |
| `PORT` | no (default 8787; 8080 in the container) | Listen port. |

`python -m nochbot_crawler` also reads a `.env` file in the working directory (see `.env.example`). Real environment variables take precedence.

## Run locally

```powershell
cd scraper
python -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt     # use .venv/bin/... outside Windows
copy .env.example .env                                   # then set CRAWLER_SERVICE_TOKEN (32+ chars)
.venv\Scripts\python -m nochbot_crawler                  # serves on http://127.0.0.1:8787
```

Then set these in the Next.js app's environment: `CRAWLER_SERVICE_URL=http://127.0.0.1:8787` and the same `CRAWLER_SERVICE_TOKEN`.

## Tests

```bash
cd scraper
.venv/Scripts/python -m unittest discover -s tests -t .
```

The tests run a local fixture website (navigation, sitemap, robots.txt, redirects, oversized pages, errors, depth chains) and cover the URL/IP policy and the API's auth and limits.

## Deploy

Build the container with `docker build -t nochbot-crawler scraper/`. It runs as a non-root user and contains no browser binaries.

- Expose the service only to the Next.js backend. Keep the bearer token secret, and restrict ingress where the platform allows.
- Because the app runs on Vercel, the service needs an HTTPS URL that the app can reach. Free-tier options include Google Cloud Run (free monthly quota), Render, or Hugging Face Spaces (Docker).
- On platforms that support it, also add an egress firewall that blocks private ranges, as defence in depth.
