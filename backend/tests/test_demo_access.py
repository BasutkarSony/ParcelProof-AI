"""Tests for in-app demo sign-in and the signed browser session."""
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response

from app.main import (
    app,
    DEMO_SESSION_TTL_SECONDS,
    _create_demo_session_token,
    _valid_demo_session,
    protect_public_demo,
)


class DemoAccessTests(unittest.TestCase):
    def _request(self, path="/api/orders", headers=None, cookies=None):
        request_headers = dict(headers or {})
        if cookies:
            request_headers["cookie"] = "; ".join(f"{key}={value}" for key, value in cookies.items())
        return Request({
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "https",
            "path": path,
            "raw_path": path.encode("utf-8"),
            "query_string": b"",
            "headers": [(key.lower().encode("ascii"), value.encode("latin-1")) for key, value in request_headers.items()],
            "client": ("127.0.0.1", 12345),
            "server": ("parcelproof.test", 443),
        })

    def test_private_api_requires_session_but_login_page_remains_public(self):
        async def call_next(_request):
            return Response("ok", status_code=200)
        with patch.dict(os.environ, {
            "PARCELPROOF_DEMO_AUTH_REQUIRED": "true",
            "PARCELPROOF_DEMO_USERNAME": "merchant.demo",
            "PARCELPROOF_DEMO_PASSWORD": "PackSafe#2026",
            "PARCELPROOF_DEMO_SESSION_SECRET": "test-session-secret",
        }):
            api_response = __import__("asyncio").run(protect_public_demo(self._request("/api/orders"), call_next))
            root_response = __import__("asyncio").run(protect_public_demo(self._request("/"), call_next))
        self.assertEqual(api_response.status_code, 401)
        self.assertNotIn("www-authenticate", api_response.headers)
        self.assertEqual(root_response.status_code, 200)

    def test_health_endpoint_remains_public(self):
        async def call_next(_request):
            return Response("healthy", status_code=200)
        with patch.dict(os.environ, {
            "PARCELPROOF_DEMO_AUTH_REQUIRED": "true",
            "PARCELPROOF_DEMO_USERNAME": "",
            "PARCELPROOF_DEMO_PASSWORD": "",
        }):
            response = __import__("asyncio").run(protect_public_demo(self._request("/health"), call_next))
        self.assertEqual(response.status_code, 200)

    def test_signed_session_expires_and_rejects_tampering(self):
        with patch.dict(os.environ, {
            "PARCELPROOF_DEMO_AUTH_REQUIRED": "true",
            "PARCELPROOF_DEMO_USERNAME": "merchant.demo",
            "PARCELPROOF_DEMO_PASSWORD": "PackSafe#2026",
            "PARCELPROOF_DEMO_SESSION_SECRET": "test-session-secret",
        }):
            issued = int(time.time())
            token = _create_demo_session_token(issued)
            self.assertTrue(_valid_demo_session(token, issued + 60))
            self.assertFalse(_valid_demo_session(token, issued + DEMO_SESSION_TTL_SECONDS + 1))
            self.assertFalse(_valid_demo_session(token + "tampered", issued + 60))
            self.assertFalse(_valid_demo_session("not-a-session"))

    def test_login_sets_http_only_cookie_and_logout_clears_it(self):
        with patch.dict(os.environ, {
            "PARCELPROOF_DEMO_AUTH_REQUIRED": "true",
            "PARCELPROOF_DEMO_USERNAME": "merchant.demo",
            "PARCELPROOF_DEMO_PASSWORD": "PackSafe#2026",
            "PARCELPROOF_DEMO_SESSION_SECRET": "test-session-secret",
        }):
            client = TestClient(app)
            login = client.post("/api/auth/login", json={"username": "merchant.demo", "password": "PackSafe#2026"})
            self.assertEqual(login.status_code, 200)
            self.assertTrue(login.cookies.get("parcelproof_demo_session"))
            self.assertIn("httponly", login.headers.get("set-cookie", "").lower())
            self.assertEqual(client.get("/api/orders").status_code, 200)
            logout = client.post("/api/auth/logout")
            self.assertEqual(logout.status_code, 200)
            self.assertEqual(client.get("/api/orders").status_code, 401)

    def test_wrong_password_is_rejected(self):
        with patch.dict(os.environ, {
            "PARCELPROOF_DEMO_AUTH_REQUIRED": "true",
            "PARCELPROOF_DEMO_USERNAME": "merchant.demo",
            "PARCELPROOF_DEMO_PASSWORD": "PackSafe#2026",
            "PARCELPROOF_DEMO_SESSION_SECRET": "test-session-secret",
        }):
            response = TestClient(app).post("/api/auth/login", json={"username": "merchant.demo", "password": "wrong"})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("parcelproof_demo_session", response.cookies)

    def test_missing_credentials_fail_closed(self):
        async def call_next(_request):
            return Response("unexpected")
        with patch.dict(os.environ, {
            "PARCELPROOF_DEMO_AUTH_REQUIRED": "true",
            "PARCELPROOF_DEMO_USERNAME": "",
            "PARCELPROOF_DEMO_PASSWORD": "",
        }):
            response = __import__("asyncio").run(protect_public_demo(self._request("/api/orders"), call_next))
            login = TestClient(app).post("/api/auth/login", json={"username": "merchant.demo", "password": "wrong"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(login.status_code, 503)


if __name__ == "__main__":
    unittest.main()
