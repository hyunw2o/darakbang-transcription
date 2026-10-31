#!/usr/bin/env python3
"""Offline consent, cleanup and model-compatibility regressions. No real accounts."""
import asyncio
import copy
import os
from pathlib import Path
import socket
import sys
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with patch.dict(os.environ, {}, clear=True), patch("dotenv.load_dotenv", return_value=False):
    import main as api
from privacy_controls import AI_CONSENT_KEY, AI_CONSENT_VERSION, DELETION_KEY, PrivacyControls, cleanup_account, consent_status
from transcription_models import model_candidates, transcription_arguments
from apple_revocation import revoke_for_deletion


def user(accepted=True):
    return {"id": "owner", "app_metadata": {AI_CONSENT_KEY: {
        "accepted": accepted, "version": AI_CONSENT_VERSION, "accepted_at": "2026-10-31"}}}


class PrivacyTests(unittest.TestCase):
    def setUp(self):
        network = patch.object(socket.socket, "connect", side_effect=AssertionError("No network in tests"))
        network.start(); self.addCleanup(network.stop)

    def test_missing_old_and_client_forged_consent_rejected(self):
        for data in [{"user_metadata": user()["app_metadata"]}, {}, user(False)]:
            self.assertFalse(consent_status(data)["accepted"])
        old = user(); old["app_metadata"][AI_CONSENT_KEY]["version"] = "2026-09-11"
        self.assertFalse(consent_status(old)["accepted"])

    def test_pending_deletion_overrides_consent(self):
        data = user(); data["app_metadata"][DELETION_KEY] = "today"
        self.assertFalse(consent_status(data)["accepted"])

    def test_accept_and_withdraw_preserve_other_metadata(self):
        service = PrivacyControls("https://test.invalid", "not-a-key")
        data = user(False); data["app_metadata"]["provider"] = "apple"
        def admin(uid, metadata=None):
            if metadata is not None: data["app_metadata"] = metadata
            return copy.deepcopy(data)
        with patch.object(service, "_admin_user", side_effect=admin):
            self.assertTrue(service.update("owner", True, AI_CONSENT_VERSION)["accepted"])
            self.assertEqual(data["app_metadata"]["provider"], "apple")
            self.assertFalse(service.update("owner", False, AI_CONSENT_VERSION)["accepted"])
            self.assertIsNotNone(data["app_metadata"][AI_CONSENT_KEY]["revoked_at"])
            with self.assertRaises(api.HTTPException): service.require("owner")

    def test_invalid_consent_cannot_write(self):
        service = PrivacyControls("", "")
        with patch.object(service, "_admin_user") as write:
            for accepted, version in [("true", AI_CONSENT_VERSION), (True, "old"), (1, AI_CONSENT_VERSION)]:
                with self.assertRaises(api.HTTPException): service.update("owner", accepted, version)
            write.assert_not_called()

    def test_new_model_has_no_unsupported_legacy_parameters(self):
        args = transcription_arguments("gpt-transcribe", "ko", "legacy instruction", ["OURS", "OURS", "bad\nterm", "<x>", "WIO"], "conversation", 30, 0, True)
        self.assertEqual(args["extra_body"], {"languages": ["ko"], "keywords": ["OURS", "WIO"]})
        for name in ["language", "temperature", "include", "timestamp_granularities"]:
            self.assertNotIn(name, args)
        self.assertEqual(args["response_format"], "json")

    def test_retired_models_never_called_after_cutoff(self):
        self.assertEqual(model_candidates("whisper-1", ["gpt-4o-transcribe"], date(2027, 2, 26)), ["gpt-transcribe"])
        self.assertEqual(model_candidates("gpt-transcribe", ["whisper-1"], date(2027, 2, 25)), ["gpt-transcribe", "whisper-1"])

    def test_legacy_request_rollback_before_shutdown(self):
        args = transcription_arguments("whisper-1", "ko", "context", [], "sermon", 30)
        self.assertEqual(args["response_format"], "text")
        self.assertEqual(args["language"], "ko")

    def test_missing_apple_tokens_dont_block_deletion(self):
        data = user(); data["app_metadata"]["providers"] = ["apple"]
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(revoke_for_deletion(data), "manual_disconnect_required")
            self.assertEqual(revoke_for_deletion(user()), "not_applicable")

    def test_apple_revoke_only_for_verified_matching_identity(self):
        import apple_revocation as apple
        data = user(); data["identities"] = [{"provider": "apple", "identity_data": {"sub": "apple-owner"}}]
        client = Mock()
        client.post.return_value.json.return_value = {"id_token": "signed-token", "refresh_token": "refresh"}
        client.get.return_value.json.return_value = {"keys": [{"kid": "key"}]}
        env = {"APPLE_TEAM_ID": "team", "APPLE_KEY_ID": "key", "APPLE_CLIENT_ID": "client", "APPLE_PRIVATE_KEY": "test-only"}
        with patch.dict(os.environ, env, clear=True), patch.object(apple.httpx, "Client") as transport, patch.object(apple.jwt, "encode", return_value="secret"), patch.object(apple.jwt, "get_unverified_header", return_value={"kid": "key"}), patch.object(apple.jwt.PyJWK, "from_dict", return_value=SimpleNamespace(key="public")), patch.object(apple.jwt, "decode") as decode:
            transport.return_value.__enter__.return_value = client
            decode.return_value = {"sub": "other-account"}
            self.assertEqual(revoke_for_deletion(data, "code"), "manual_disconnect_required")
            self.assertEqual(client.post.call_count, 1)
            decode.return_value = {"sub": "apple-owner"}
            self.assertEqual(revoke_for_deletion(data, "code"), "revoked")
            self.assertEqual(client.post.call_args.args[0], "https://appleid.apple.com/auth/revoke")
            self.assertEqual(decode.call_args.kwargs["algorithms"], ["RS256"])
            self.assertEqual(decode.call_args.kwargs["audience"], "client")
            client.post.side_effect = RuntimeError("provider unavailable")
            self.assertEqual(revoke_for_deletion(data, "code"), "manual_disconnect_required")


class Query:
    def __init__(self, db, name):
        self.db, self.name, self.filters, self.action, self.bounds = db, name, [], "select", (0, 1000)
    def eq(self, key, value): self.filters.append((key, value)); return self
    def select(self, *_): return self
    def order(self, *_): return self
    def range(self, start, end): self.bounds = (start, end + 1); return self
    def update(self, values): self.action, self.values = "update", values; return self
    def delete(self): self.action = "delete"; return self
    def execute(self):
        if self.name == self.db.failure: raise RuntimeError("DB failure")
        rows = self.db.rows.setdefault(self.name, [])
        selected = [r for r in rows if all(r.get(k) == v for k, v in self.filters)]
        if self.action == "update":
            for row in selected: row.update(self.values)
        if self.action == "delete":
            self.db.events.append("delete:" + self.name)
            rows[:] = [r for r in rows if r not in selected]
        return SimpleNamespace(data=copy.deepcopy(selected[slice(*self.bounds)]))


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.db = SimpleNamespace(rows={}, failure=None, events=[])
        self.db.table = lambda name: Query(self.db, name)
        self.deleted = []
    def cleanup(self, delete=None):
        cleanup_account(self.db, "owner", delete or (lambda b, p: self.deleted.append((b, p))), ["transcriptions", "user_usage"], ["training_text_samples", "training_audio_assets"])
    def test_all_pages_and_other_account_preserved(self):
        self.db.rows["transcription_jobs"] = [{"owner_key": "owner", "status": "completed", "storage_bucket": "input", "storage_object_path": str(i)} for i in range(1002)]
        self.db.rows["transcriptions"] = [{"user_id": "owner"}, {"user_id": "other"}]
        self.cleanup()
        self.assertEqual(len(self.deleted), 1002)
        self.assertEqual(self.db.rows["transcriptions"], [{"user_id": "other"}])
    def test_storage_error_keeps_database_references(self):
        self.db.rows["transcription_jobs"] = [{"owner_key": "owner", "status": "completed", "storage_bucket": "input", "storage_object_path": "audio"}]
        with self.assertRaises(RuntimeError): self.cleanup(Mock(side_effect=RuntimeError("storage failure")))
        self.assertEqual(self.db.events, [])
        self.assertTrue(self.db.rows["transcription_jobs"])
    def test_active_job_prevents_false_success(self):
        self.db.rows["transcription_jobs"] = [{"owner_key": "owner", "status": "processing"}]
        with self.assertRaises(api.HTTPException) as error: self.cleanup()
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.events, [])
    def test_queued_job_is_cancelled(self):
        self.db.rows["transcription_jobs"] = [{"owner_key": "owner", "status": "queued"}]
        self.cleanup()
        self.assertEqual(self.db.rows["transcription_jobs"], [])
    def test_optional_table_permission_errors_are_not_swallowed(self):
        self.db.failure = "training_audio_assets"
        with self.assertRaises(RuntimeError): self.cleanup()
    def test_training_copy_and_source_are_deleted(self):
        self.db.rows["training_audio_assets"] = [{"user_id": "owner", "storage_bucket": "training", "storage_object_path": "copy", "source_storage_bucket": "input", "source_storage_object_path": "original"}]
        self.cleanup()
        self.assertEqual(self.deleted, [("training", "copy"), ("input", "original")])


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.data = user(False)
        self.patches = [patch.object(api, "_get_current_user", AsyncMock(return_value={"id": "owner"})),
                        patch.object(api.PrivacyControls, "user", side_effect=lambda _: copy.deepcopy(self.data)),
                        patch.object(socket.socket, "connect", side_effect=AssertionError("No network"))]
        for item in self.patches: item.start(); self.addCleanup(item.stop)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="https://api.test")
        self.addAsyncCleanup(self.client.aclose)
    async def test_no_audio_parsing_without_consent(self):
        with patch("starlette.formparsers.MultiPartParser.parse", new=AsyncMock()) as parser:
            r = await self.client.post("/api/transcribe", content=b"audio", headers={"Authorization": "Bearer test", "Content-Type": "multipart/form-data; boundary=test"})
            self.assertEqual(r.status_code, 403, r.text)
            parser.assert_not_called()
    async def test_summary_and_draft_blocked(self):
        for path in ["/api/summarize", "/api/records/draft"]:
            r = await self.client.post(path, json={"text": "private"})
            self.assertEqual(r.status_code, 403, r.text)
    async def test_privacy_read_available_without_consent(self):
        r = await self.client.get("/api/auth/privacy")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["accepted"])
    async def test_cleanup_failure_never_deletes_identity(self):
        with patch.object(api.PrivacyControls, "mark_deleting", return_value=self.data), patch.object(api, "_delete_user_app_data", side_effect=RuntimeError("failure")), patch.object(api, "_delete_supabase_auth_user", AsyncMock()) as auth_delete:
            r = await self.client.delete("/api/auth/account", headers={"Authorization": "Bearer test"})
            self.assertEqual(r.status_code, 503, r.text)
            auth_delete.assert_not_called()
    async def test_pending_delete_blocks_mutation_but_allows_retry(self):
        self.data["app_metadata"][DELETION_KEY] = "today"
        r = await self.client.post("/api/glossary", json={})
        self.assertEqual(r.status_code, 409)
        with patch.object(api.PrivacyControls, "mark_deleting", return_value=self.data), patch.object(api, "_delete_user_app_data"), patch.object(api, "_delete_supabase_auth_user", AsyncMock()) as auth_delete:
            r = await self.client.delete("/api/auth/account", headers={"Authorization": "Bearer test"})
            self.assertEqual(r.status_code, 200, r.text)
            auth_delete.assert_awaited_once()


if __name__ == "__main__": unittest.main()
