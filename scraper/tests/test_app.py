import os
import unittest
from unittest import mock

from nochbot_crawler import app as app_module
from nochbot_crawler.crawler import CrawlOutcome, PageResult
from nochbot_crawler.url_policy import UrlPolicyError

TOKEN = "t" * 40
VALID_BODY = {
    "url": "https://example.com",
    "max_pages": 15,
    "max_depth": 3,
    "timeout_seconds": 25,
    "max_response_bytes": 2_000_000,
    "correlation_id": "abc-123",
}


class AppTests(unittest.TestCase):
    def setUp(self):
        env = mock.patch.dict(os.environ, {"CRAWLER_SERVICE_TOKEN": TOKEN})
        env.start()
        self.addCleanup(env.stop)
        self.client = app_module.create_app().test_client()
        self.auth = {"Authorization": f"Bearer {TOKEN}"}

    def test_refuses_to_start_without_strong_token(self):
        with mock.patch.dict(os.environ, {"CRAWLER_SERVICE_TOKEN": "short"}):
            with self.assertRaises(RuntimeError):
                app_module.create_app()

    def test_healthz(self):
        res = self.client.get("/healthz")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json(), {"ok": True})

    def test_auth_is_checked_before_body_validation(self):
        self.assertEqual(self.client.post("/v1/crawl", json={}).status_code, 401)

    def test_requires_bearer_token(self):
        self.assertEqual(self.client.post("/v1/crawl", json=VALID_BODY).status_code, 401)
        bad = {"Authorization": "Bearer wrong"}
        self.assertEqual(self.client.post("/v1/crawl", json=VALID_BODY, headers=bad).status_code, 401)

    def test_rejects_budgets_above_ceilings(self):
        for key, value in [("max_pages", 51), ("max_depth", 9), ("timeout_seconds", 600),
                           ("max_response_bytes", 50_000_000), ("correlation_id", "bad id!")]:
            with self.subTest(key=key):
                body = {**VALID_BODY, key: value}
                self.assertEqual(self.client.post("/v1/crawl", json=body, headers=self.auth).status_code, 422)

    def test_rejects_non_json_body(self):
        res = self.client.post("/v1/crawl", data="not json", headers=self.auth)
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.get_json(), {"error": "invalid_request"})

    def test_policy_errors_return_safe_reason(self):
        with mock.patch.object(app_module.SiteCrawler, "crawl", side_effect=UrlPolicyError("blocked_destination")):
            res = self.client.post("/v1/crawl", json=VALID_BODY, headers=self.auth)
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.get_json(), {"error": "policy", "reason": "blocked_destination"})

    def test_internal_errors_hide_details(self):
        with mock.patch.object(app_module.SiteCrawler, "crawl", side_effect=ValueError("secret detail")):
            res = self.client.post("/v1/crawl", json=VALID_BODY, headers=self.auth)
        self.assertEqual(res.status_code, 500)
        self.assertNotIn("secret", res.get_data(as_text=True))

    def test_busy_when_no_crawl_slot(self):
        with mock.patch.object(app_module, "_crawl_slots") as slots:
            slots.acquire.return_value = False
            res = self.client.post("/v1/crawl", json=VALID_BODY, headers=self.auth)
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.get_json(), {"error": "busy"})

    def test_success_shape(self):
        outcome = CrawlOutcome(
            pages=[PageResult("https://example.com/", "fetched", 0, title="Home", markdown="# Home")],
            deferred_count=2, cap_reached=True, time_budget_reached=False, robots_denied=0, requests_made=3,
        )
        with mock.patch.object(app_module.SiteCrawler, "crawl", return_value=outcome):
            res = self.client.post("/v1/crawl", json=VALID_BODY, headers=self.auth)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["version"], 1)
        self.assertEqual(data["pages"][0]["status"], "fetched")
        self.assertTrue(data["cap_reached"])


if __name__ == "__main__":
    unittest.main()
