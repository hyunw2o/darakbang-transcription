#!/usr/bin/env python3
"""Run offline login-boundary regression checks against the real FastAPI app."""

from __future__ import annotations

import argparse
import io
import os
import socket
import sys
import time
import unittest
import uuid
import wave
from contextlib import ExitStack
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Never load local credentials or create configured external clients in this test.
with patch.dict(os.environ, {"GUEST_TRANSCRIPTION_ENABLED": "true"}, clear=True), patch("dotenv.load_dotenv", return_value=False):
    import main as api


ORIGIN = "https://mallog24.com"
GUEST = {"X-Guest-Session-Id": "legacy-guest-session-12345"}
USERS = {
    "token-a": {"id": "user-a", "email": "a@example.test"},
    "token-b": {"id": "user-b", "email": "b@example.test"},
}
PROTECTED_REQUESTS = [
    ("POST", "/api/transcribe"),
    ("GET", "/api/status/unknown"),
    ("GET", "/api/history"),
    ("DELETE", "/api/history"),
    ("DELETE", "/api/history/unknown"),
    ("GET", "/api/usage"),
    ("GET", "/api/glossary"),
    ("POST", "/api/glossary"),
    ("PUT", "/api/glossary/1"),
    ("DELETE", "/api/glossary/1"),
    ("GET", "/api/records"),
    ("POST", "/api/records"),
    ("POST", "/api/records/draft"),
    ("PUT", "/api/records/1"),
    ("DELETE", "/api/records/1"),
    ("POST", "/api/corrections"),
    ("POST", "/api/summarize"),
    ("GET", "/api/auth/me"),
    ("GET", "/api/auth/bootstrap"),
    ("DELETE", "/api/auth/account"),
]


class FakeQuery:
    """Small in-memory Supabase boundary; execute real owner filters from routes."""

    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.action = "select"
        self.payload = None

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def insert(self, payload):
        self.action, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.action, self.payload = "update", payload
        return self

    def delete(self):
        self.action = "delete"
        return self

    def execute(self):
        selected = [row for row in self.rows if all(row.get(k) == v for k, v in self.filters)]
        if self.action == "insert":
            selected = [dict(self.payload)]
            self.rows.extend(selected)
        elif self.action == "update":
            for row in selected:
                row.update(self.payload)
        elif self.action == "delete":
            self.rows[:] = [row for row in self.rows if row not in selected]
        return SimpleNamespace(data=[dict(row) for row in selected])


class LoginRequiredChecks(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(socket.socket, "connect", side_effect=AssertionError("Network is forbidden")))
        for name in (
            "task_status", "task_owner", "task_updated_at", "task_progress",
            "active_source_jobs", "task_source_keys", "_auth_user_cache",
            "_auth_active_sessions", "_request_counters", "_guest_usage",
            "_guest_ip_usage", "_guest_task_results",
        ):
            self.stack.enter_context(patch.dict(getattr(api, name), {}, clear=True))
        self.stack.enter_context(patch.object(api, "ADMIN_BYPASS_USER_IDS", set()))
        self.stack.enter_context(patch.object(api, "ADMIN_BYPASS_EMAILS", set()))
        self.stack.enter_context(patch.object(api, "SUPABASE_URL", "https://supabase.invalid"))
        self.stack.enter_context(patch.object(api, "RATE_LIMIT_GENERAL", 10000))
        self.stack.enter_context(patch.object(api, "RATE_LIMIT_AUTH", 10000))
        self.stack.enter_context(patch.object(api, "RATE_LIMIT_TRANSCRIBE", 10000))
        self.stack.enter_context(patch.object(api, "EXPOSE_TERMS_ENDPOINT", True))
        self.ready_checks = [self.stack.enter_context(patch.object(api, name, return_value=True)) for name in (
            "_ensure_transcriptions_user_scope_ready", "_ensure_transcription_jobs_scope_ready",
            "_ensure_user_usage_scope_ready", "_ensure_user_glossary_scope_ready",
        )]
        self.auth = self.stack.enter_context(patch.object(api, "_supabase_auth_request", new=AsyncMock(side_effect=self.auth_request)))
        self.tables = {api.TRANSCRIPTION_JOBS_TABLE_NAME: [], "transcriptions": [], "saved_records": []}
        self.db = Mock()
        self.db.table.side_effect = lambda name: FakeQuery(self.tables.setdefault(name, []))
        self.db_access = self.stack.enter_context(patch.object(api, "_get_supabase_client", return_value=self.db))
        self.usage = self.stack.enter_context(patch.object(api, "_get_or_create_usage_row", return_value={
            "plan_tier": "free", "used_audio_seconds": 999999999,
            "usage_month": "2026-09-01", "user_id": "user-a",
        }))
        self.metrics = self.stack.enter_context(patch.object(api, "_fetch_transcription_usage_summaries", return_value={}))
        self.duration = self.stack.enter_context(patch.object(api, "_extract_audio_duration_seconds", return_value=12))
        self.stack.enter_context(patch.object(api, "_find_active_duplicate_transcription_job", return_value=None))
        self.storage = self.stack.enter_context(patch.object(api, "_upload_transcription_input_to_storage", return_value={
            "storage_bucket": "transcription-inputs", "storage_object_path": "test/input.wav",
        }))
        self.process = self.stack.enter_context(patch.object(api, "process_transcription", new=AsyncMock(side_effect=self.fake_process)))
        self.model = self.stack.enter_context(patch.object(api.genai, "GenerativeModel", side_effect=AssertionError("ASR is forbidden")))
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="https://api.example.test")
        self.addAsyncCleanup(self.client.aclose)

    async def auth_request(self, path, method="POST", payload=None, token=None):
        if path == "user":
            if token not in USERS:
                raise api.HTTPException(status_code=401, detail="Invalid or expired token")
            return USERS[token]
        if path.startswith("recover"):
            return {}
        if path == "signup" or path.startswith("token?"):
            return {"access_token": "token-a", "refresh_token": "refresh-a", "user": USERS["token-a"]}
        raise AssertionError(f"Unexpected auth request: {method} {path}")

    async def fake_process(self, *args):
        Path(args[2]).unlink(missing_ok=True)
        api._release_active_source_job(args[0])
        return {"task_id": args[0], "status": "completed", "raw_text": "result", "corrected_text": "result"}

    def headers(self, token="token-a", cookie=False):
        return {**GUEST, **({"Cookie": f"{api.AUTH_COOKIE_NAME}={token}", "Origin": ORIGIN} if cookie else {
            "Authorization": f"Bearer {token}",
        })}

    def add_result(self, owner, table=None, **extra):
        task_id = str(uuid.uuid4())
        row = {
            "task_id": task_id, "owner_key": owner, "user_id": owner,
            "is_guest": False, "status": "completed", "raw_text": f"private {owner}",
            "corrected_text": f"private {owner}", "created_at": datetime.now().isoformat(), **extra,
        }
        self.tables[table or api.TRANSCRIPTION_JOBS_TABLE_NAME].append(row)
        return task_id

    async def test_missing_and_guest_only_rejected_before_body_or_work(self):
        for headers in ({}, GUEST):
            for method, path in PROTECTED_REQUESTS:
                with self.subTest(method=method, path=path, headers=headers):
                    response = await self.client.request(method, path, headers=headers)
                    self.assertEqual(response.status_code, 401, response.text)
            with patch("starlette.formparsers.MultiPartParser.parse", new=AsyncMock(side_effect=AssertionError("Must authenticate before parsing"))) as parser:
                response = await self.client.post("/api/transcribe", content=b"unparsed audio", headers={
                    **headers, "Content-Type": "multipart/form-data; boundary=never-read",
                })
                parser.assert_not_called()
            self.assertEqual(response.status_code, 401)
        for mock in [*self.ready_checks, self.auth, self.db_access, self.duration, self.storage, self.process, self.model]:
            mock.assert_not_called()
        self.assertFalse(api._guest_usage)
        self.assertFalse(api._guest_task_results)

    async def test_invalid_auth_never_falls_back_to_guest_or_cookie(self):
        for value in ("Bearer invalid", "Bearer expired", "Basic token-a", "Bearer", "Bearer   ", ""):
            for method, path in PROTECTED_REQUESTS:
                with self.subTest(value=value, path=path):
                    response = await self.client.request(method, path, headers={
                        **GUEST, "Authorization": value, "Cookie": f"{api.AUTH_COOKIE_NAME}=token-a",
                    })
                    self.assertEqual(response.status_code, 401, response.text)
        with patch("starlette.formparsers.MultiPartParser.parse", new=AsyncMock(side_effect=AssertionError("Must authenticate before parsing"))) as parser:
            response = await self.client.post("/api/transcribe", content=b"unparsed audio", headers={
                **self.headers("invalid", cookie=True), "Content-Type": "multipart/form-data; boundary=never-read",
            })
            parser.assert_not_called()
        self.assertEqual(response.status_code, 401)
        for mock in [*self.ready_checks, self.db_access, self.duration, self.storage, self.process, self.model]:
            mock.assert_not_called()

    async def test_guest_endpoint_is_explicitly_retired(self):
        self.assertFalse(api.GUEST_TRANSCRIPTION_ENABLED)
        for headers in ({}, GUEST, self.headers(), self.headers(cookie=True)):
            response = await self.client.get("/api/guest/usage", headers=headers)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json()["code"], "authentication_required")
            self.assertTrue(response.json()["login_required"])
            self.assertFalse(response.json()["guest_transcription_enabled"])
        self.assertFalse(api._guest_usage)
        self.db_access.assert_not_called()

    async def test_owner_resolver_requires_verified_user_independently(self):
        for authorization in (None, "Bearer invalid"):
            with self.assertRaises(api.HTTPException) as error:
                await api._resolve_transcription_owner(authorization, GUEST["X-Guest-Session-Id"], None)
            self.assertEqual(error.exception.status_code, 401)
        owner = await api._resolve_transcription_owner("Bearer token-a", "invalid-guest-id", None)
        self.assertEqual(owner["owner_id"], "user-a")
        self.assertFalse(owner["is_guest"])
        self.assertFalse(api._guest_usage)

    async def test_cookie_csrf_cannot_be_bypassed_by_guest_header(self):
        for extra in ({}, {"Origin": "null"}, {"Origin": "https://evil.example"}, {"Referer": "https://evil.example/path"}, {"Referer": "http://[malformed"}):
            for method, path in [
                ("POST", "/api/transcribe"), ("DELETE", "/api/history"), ("PUT", "/api/glossary/1"),
                ("POST", "/api/auth/logout"), ("POST", "/api/auth/session"),
                ("POST", "/api/auth/password-reset/confirm"),
            ]:
                response = await self.client.request(method, path, headers={
                    **GUEST, "Cookie": f"{api.AUTH_COOKIE_NAME}=token-a", **extra,
                })
                self.assertEqual(response.status_code, 403, response.text)
        # An untrusted Origin cannot be overridden by a trusted Referer.
        response = await self.client.post("/api/transcribe", headers={
            **self.headers(cookie=True), "Origin": "https://evil.example", "Referer": ORIGIN,
        })
        self.assertEqual(response.status_code, 403)
        for extra in ({"Origin": ORIGIN}, {"Origin": "https://api.example.test"}, {"Referer": f"{ORIGIN}/workspace"}):
            response = await self.client.post("/api/transcribe", headers={
                **GUEST, "Cookie": f"{api.AUTH_COOKIE_NAME}=token-a", **extra,
            })
            self.assertEqual(response.status_code, 422)  # Authentication passed; missing file.
        response = await self.client.post("/api/transcribe", headers={**self.headers(), "Origin": "https://evil.example"})
        self.assertEqual(response.status_code, 422)  # Explicit bearer is not cookie auth.
        self.duration.assert_not_called()
        self.process.assert_not_called()

    async def test_bearer_cookie_and_explicit_bearer_precedence(self):
        for headers in (self.headers(), self.headers(cookie=True), {"Cookie": f"{api.AUTH_COOKIE_NAME}=token-a"}):
            response = await self.client.get("/api/auth/me", headers=headers)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["user"]["id"], "user-a")
        response = await self.client.get("/api/auth/me", headers={
            **self.headers("token-b"), "Cookie": f"{api.AUTH_COOKIE_NAME}=token-a",
        })
        self.assertEqual(response.json()["user"]["id"], "user-b")

    async def test_owner_isolation_for_persisted_legacy_and_runtime_results(self):
        for table in (api.TRANSCRIPTION_JOBS_TABLE_NAME, "transcriptions"):
            own = self.add_result("user-a", table)
            other = self.add_result("user-b", table)
            guest = self.add_result("guest:historical", table, is_guest=True)
            for cookie in (False, True):
                response = await self.client.get(f"/api/status/{own}", headers=self.headers(cookie=cookie))
                self.assertEqual(response.json()["raw_text"], "private user-a")
                for task_id in (other, guest):
                    response = await self.client.get(f"/api/status/{task_id}", headers=self.headers(cookie=cookie))
                    self.assertEqual(response.json(), {"task_id": task_id, "status": "not_found"})
        for owner in ("user-a", "user-b", None, "guest:historical"):
            task_id = str(uuid.uuid4())
            api.task_status[task_id] = "queued"
            api.task_updated_at[task_id] = time.time()
            if owner:
                api.task_owner[task_id] = owner
            response = await self.client.get(f"/api/status/{task_id}", headers=self.headers())
            self.assertEqual(response.json()["status"], "queued" if owner == "user-a" else "not_found")

    async def test_history_records_and_admin_usage_remain_owner_scoped(self):
        own = self.add_result("user-a", "transcriptions")
        other = self.add_result("user-b", "transcriptions")
        self.tables["saved_records"] = [{"id": 1, "user_id": "user-a"}, {"id": 2, "user_id": "user-b"}]
        self.metrics.return_value = {own: {"total_requests": 3}}
        response = await self.client.get("/api/history", headers=self.headers())
        self.assertEqual([row["task_id"] for row in response.json()], [own])
        self.assertNotIn("api_usage", response.json()[0])
        self.metrics.assert_not_called()
        with patch.object(api, "ADMIN_BYPASS_USER_IDS", {"user-a"}):
            response = await self.client.get("/api/history", headers=self.headers(cookie=True))
            self.assertEqual(response.json()[0]["api_usage"], {"total_requests": 3})
            self.assertEqual(len(response.json()), 1)
        response = await self.client.get("/api/records", headers=self.headers(cookie=True))
        self.assertEqual(response.json(), [{"id": 1, "user_id": "user-a"}])
        for path in (f"/api/history/{other}", "/api/records/2"):
            response = await self.client.delete(path, headers=self.headers(cookie=True))
            self.assertEqual(response.status_code, 404)
        response = await self.client.delete(f"/api/history/{own}", headers=self.headers(cookie=True))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["task_id"] for row in self.tables["transcriptions"]], [other])

    async def test_free_unlimited_usage_on_every_client_platform(self):
        for platform in ("web", "ios", "android"):
            response = await self.client.get("/api/usage", headers={
                **self.headers(cookie=platform == "web"), "X-Mallog24-Client-Platform": platform,
            })
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["plan_tier"], "free")
            self.assertTrue(payload["can_upload"])
            self.assertIsNone(payload["monthly_limit_seconds"])
            self.assertIsNone(payload["remaining_seconds"])

    async def test_authenticated_upload_queue_background_and_replay(self):
        audio = io.BytesIO()
        with wave.open(audio, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\x00\x00" * 16000)
        for worker, cookie in ((False, False), (False, True), (True, False), (True, True)):
            with self.subTest(worker=worker, cookie=cookie), patch.object(api, "_can_use_worker_queue", return_value=worker):
                task_id = str(uuid.uuid4())
                headers = {**self.headers(cookie=cookie), "X-Mallog24-Upload-Id": task_id}
                before = self.process.await_count
                response = await self.client.post("/api/transcribe", files={"file": ("test.wav", audio.getvalue(), "audio/wav")}, headers=headers)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["status"], "queued")
                self.assertFalse(response.json()["guest"])
                self.assertTrue(response.json()["quota"]["can_upload"])
                job = next(row for row in self.tables[api.TRANSCRIPTION_JOBS_TABLE_NAME] if row["task_id"] == task_id)
                self.assertEqual(job["owner_key"], "user-a")
                self.assertEqual(job["user_id"], "user-a")
                self.assertFalse(job["is_guest"])
                self.assertTrue(any(row["task_id"] == task_id and row["user_id"] == "user-a" for row in self.tables["transcriptions"]))
                if worker:
                    self.assertEqual(response.json()["processing_mode"], "worker_queue")
                    self.assertEqual(self.process.await_count, before)
                else:
                    self.assertEqual(self.process.await_count, before + 1)
                    self.assertEqual(self.process.call_args.args[1], "user-a")
                    self.assertFalse(self.process.call_args.args[-1])
                reads = self.duration.call_count
                response = await self.client.post("/api/transcribe", files={"file": ("test.wav", b"unused", "audio/wav")}, headers=headers)
                self.assertTrue(response.json()["idempotent_replay"], response.text)
                self.assertEqual(self.duration.call_count, reads)
                response = await self.client.get(f"/api/status/{task_id}", headers=headers)
                self.assertEqual(response.json()["status"], "queued")
                response = await self.client.get(f"/api/status/{task_id}", headers=self.headers("token-b"))
                self.assertEqual(response.json()["status"], "not_found")
        self.assertEqual(self.storage.call_count, 2)

    async def test_public_auth_reference_and_health_remain_available(self):
        for path in ("/", "/health", "/api/stats", "/api/terms", "/openapi.json", "/docs"):
            response = await self.client.get(path, headers={
                **GUEST, "Cookie": f"{api.AUTH_COOKIE_NAME}=expired", "Authorization": "invalid",
            })
            self.assertEqual(response.status_code, 200, path)
        for path in ("/terms", "/privacy", "/api/auth/login", "/api/auth/signup", "/api/auth/password-reset/request"):
            self.assertFalse(api._requires_login(path))
        self.auth.assert_not_called()
        for path, data in (
            ("/api/auth/login", {"email": "a@example.test", "password": "test-password"}),
            ("/api/auth/signup", {"email": "a@example.test", "password": "test-password"}),
            ("/api/auth/password-reset/request", {"email": "a@example.test"}),
            ("/api/auth/session", {"access_token": "token-a"}),
        ):
            self.client.cookies.clear()
            headers = GUEST if path == "/api/auth/session" else {**GUEST, "Cookie": f"{api.AUTH_COOKIE_NAME}=expired"}
            response = await self.client.post(path, data=data, headers=headers)
            self.assertEqual(response.status_code, 200, response.text)
        self.client.cookies.clear()
        response = await self.client.post("/api/auth/apple", json={"identity_token": "apple-test-token"})
        self.assertEqual(response.status_code, 200, response.text)
        self.client.cookies.clear()
        response = await self.client.get("/api/auth/oauth-url", params={"provider": "google", "redirect_to": f"{ORIGIN}/auth/callback"})
        self.assertEqual(response.status_code, 200, response.text)
        response = await self.client.post("/api/auth/password-reset/confirm", data={"new_password": "new-test-password"}, headers=self.headers())
        self.assertEqual(response.status_code, 200, response.text)
        response = await self.client.get("/api/billing/status")
        self.assertEqual(response.status_code, 410)

    async def test_cors_preflight_and_auth_errors_visible_to_web(self):
        for method, path in (("POST", "/api/transcribe"), ("PUT", "/api/glossary/1")):
            response = await self.client.options(path, headers={
                "Origin": ORIGIN, "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "content-type,x-guest-session-id,x-mallog24-client-platform",
            })
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.headers["access-control-allow-origin"], ORIGIN)
        self.auth.assert_not_called()
        response = await self.client.post("/api/transcribe", headers={**GUEST, "Origin": ORIGIN})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["access-control-allow-origin"], ORIGIN)
        self.assertEqual(response.headers["access-control-allow-credentials"], "true")
        self.assertEqual(response.headers["cache-control"], "no-store")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true", help="Run deterministic local checks (the default).")
    parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(LoginRequiredChecks)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if result.wasSuccessful():
        print(f"login-required-self-test-ok ({result.testsRun} tests)")
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
