#!/usr/bin/env python3
"""Offline admin/auth/review/export regressions; no real DB, files or AI calls."""
import copy
import asyncio
import httpx
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import shutil
import wave
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, HTTPException
from training_review import build_router, export_rows, reference_hints, require_admin, validate_review
from prepare_training_review import scan, build_clips, fingerprint

ADMIN = "00000000-0000-0000-0000-000000000001"
ASSET = {"id": 1, "user_id": ADMIN, "sha256": "abc", "audio_seconds": 120, "dataset_split": "train",
         "consent_status": "granted", "original_filename": "audio.mp3", "review_import_key": "key",
         "storage_bucket": "training-audio", "storage_object_path": "private/audio.mp3", "metadata": {"reference_text": "참고문"}}
PAYLOAD = {"start_seconds": 0, "end_seconds": 20, "final_result": "원음 그대로의 문장입니다.",
           "quality_status": "approved", "verbatim_verified": True, "listened": True, "review_version": 0}
SAMPLE = {**PAYLOAD, "id": 1, "user_id": ADMIN, "audio_asset_id": 1, "source_type": "audio_review", "language": "ko",
          "metadata": {}, "reviewed_by": ADMIN, "reviewed_at": "2026-11-07T00:00:00+00:00"}


class OfflineClient:
    def __init__(self, app): self.app = app
    def __getattr__(self, method):
        def request(path, **kwargs):
            async def run():
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test") as client:
                    return await client.request(method.upper(), path, **kwargs)
            return asyncio.run(run())
        return request


class Query:
    def __init__(self, rows):
        self.rows = rows; self.filters = []; self.patch = None; self.new = None
    def select(self, *_): return self
    def order(self, *_): return self
    def eq(self, key, value): self.filters.append((key, value)); return self
    def update(self, payload): self.patch = payload; return self
    def insert(self, payload): self.new = payload; return self
    def range(self, *_): return self
    def execute(self):
        if self.new is not None:
            row = {'id': max([r['id'] for r in self.rows], default=0) + 1, **copy.deepcopy(self.new)}
            self.rows.append(row)
            return Mock(data=[copy.deepcopy(row)])
        rows = [row for row in self.rows if all(row.get(key) == value for key, value in self.filters)]
        if self.patch:
            for row in rows: row.update(copy.deepcopy(self.patch))
        return Mock(data=copy.deepcopy(rows))


class ReviewTests(unittest.TestCase):
    def test_admin_is_explicit_not_billing_or_user_metadata(self):
        with patch.dict(os.environ, {"TRAINING_REVIEW_ADMIN_USER_IDS": ADMIN}):
            self.assertEqual(require_admin({"id": ADMIN})["id"], ADMIN)
            for user in [{"id": "other", "email": "owner@example.com"}, {"id": "other", "user_metadata": {"admin": True}}, None]:
                with self.assertRaises(HTTPException): require_admin(user)

    def test_approval_requires_all_attestations(self):
        for key, value in [("final_result", ""), ("verbatim_verified", False), ("listened", False), ("listened", "true")]:
            with self.subTest(key=key), self.assertRaises(HTTPException): validate_review({**PAYLOAD, key: value}, ASSET)

    def test_invalid_and_nonfinite_ranges(self):
        for start, end in [(-1, 10), (20, 20), (0, 61), (100, 130), (float('nan'), 20), (0, float('inf'))]:
            with self.subTest(start=start, end=end), self.assertRaises(HTTPException):
                validate_review({**PAYLOAD, "start_seconds": start, "end_seconds": end}, ASSET)

    def test_revoked_expired_or_deleted_cannot_be_approved(self):
        for patching in [{"consent_status": "revoked"}, {"deleted_at": "now"}, {"retention_until": "2000-01-01T00:00:00Z"}]:
            with self.assertRaises(HTTPException): validate_review(PAYLOAD, {**ASSET, **patching})

    def test_draft_invalidates_verification(self):
        result = validate_review({**PAYLOAD, "quality_status": "needs_review"}, ASSET)
        self.assertFalse(result["verbatim_verified"]); self.assertFalse(result["listened"])

    def test_export_only_verified_audio_samples(self):
        self.assertEqual(len(export_rows([ASSET], [SAMPLE])), 1)
        for patching in [{"source_type": "user_correction"}, {"quality_status": "needs_review"}, {"reviewed_at": None}]:
            self.assertEqual(export_rows([ASSET], [{**SAMPLE, **patching}]), [])
        for patching in [{"consent_status": "revoked"}, {"dataset_split": "unassigned"}]:
            self.assertEqual(export_rows([{**ASSET, **patching}], [SAMPLE]), [])

    def test_overlap_and_cross_split_leakage_block_export(self):
        with self.assertRaises(HTTPException): export_rows([ASSET], [SAMPLE, {**SAMPLE, "id": 2}])
        with self.assertRaises(HTTPException):
            export_rows([ASSET, {**ASSET, "id": 2, "dataset_split": "test"}], [SAMPLE, {**SAMPLE, "id": 2, "audio_asset_id": 2}])

    def test_adjacent_segments_preserve_real_repetition(self):
        rows = export_rows([ASSET], [SAMPLE, {**SAMPLE, "id": 2, "start_seconds": 20, "end_seconds": 40}])
        self.assertEqual(len(rows), 2); self.assertEqual(rows[0]["text"], rows[1]["text"])

    def test_no_invented_timestamps_for_reference_hints(self):
        hints = reference_hints("오늘은 함께 말씀을 자세하게 살펴보겠습니다.\n" * 3)
        self.assertTrue(hints); self.assertNotIn("start_seconds", hints[0])

    def test_local_pairs_handle_unicode_and_missing_files(self):
        import unicodedata
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "학습.mp3").write_bytes(b"local-only")
            (root / (unicodedata.normalize("NFD", "학습") + ".txt")).write_text("미검수 참고문")
            (root / "missing.txt").write_text("no audio")
            report = scan(root)
            self.assertEqual(len(report["pairs"]), 1); self.assertEqual(len(report["unmatched"]), 1)
            self.assertFalse(report["pairs"][0]["reference_verified"])


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"TRAINING_REVIEW_ADMIN_USER_IDS": ADMIN}); self.env.start(); self.addCleanup(self.env.stop)
        self.assets, self.samples = [copy.deepcopy(ASSET)], [copy.deepcopy(SAMPLE)]
        self.db = Mock()
        self.db.table.side_effect = lambda name: Query(self.assets if name == "training_audio_assets" else self.samples)
        async def user(authorization):
            if not authorization: raise HTTPException(401, "Login required")
            return {"id": ADMIN if authorization == "Bearer admin" else "other"}
        app = FastAPI(); app.include_router(build_router(lambda: self.db, user))
        self.client = OfflineClient(app)
        self.headers = {"Authorization": "Bearer admin"}

    def test_auth_and_admin_guards_before_data_access(self):
        for path in ["/assets", "/assets/1", "/assets/1/audio", "/export"]:
            self.assertEqual(self.client.get('/api/admin/training' + path).status_code, 401)
            self.assertEqual(self.client.get('/api/admin/training' + path, headers={"Authorization": "Bearer other"}).status_code, 403)
        self.db.table.assert_not_called()

    def test_admin_cannot_read_another_owners_asset(self):
        self.assets[0]["user_id"] = "another-admin"
        self.assertEqual(self.client.get('/api/admin/training/assets/1', headers=self.headers).status_code, 404)

    def test_save_then_stale_write_conflict(self):
        path = '/api/admin/training/segments/1'
        first = self.client.put(path, headers=self.headers, json=PAYLOAD)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.headers['cache-control'], 'no-store')
        self.assertEqual(first.json()["review_version"], 1)
        self.assertEqual(len(first.json()["metadata"]["history"]), 1)
        stale = self.client.put(path, headers=self.headers, json={**PAYLOAD, "final_result": "stale"})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.samples[0]["final_result"], PAYLOAD["final_result"])

    def test_reopen_removes_approval(self):
        response = self.client.put('/api/admin/training/segments/1', headers=self.headers, json={**PAYLOAD, "quality_status": "needs_review"})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["reviewed_by"])
        self.assertIsNone(response.json()["reviewed_at"])

    def test_revoked_audio_never_gets_signed_url(self):
        self.assets[0]["consent_status"] = "revoked"
        self.assertEqual(self.client.get('/api/admin/training/assets/1/audio', headers=self.headers).status_code, 403)
        self.db.storage.from_.assert_not_called()

    def test_bad_json_shape_and_missing_version(self):
        for payload in [[], {}, {"review_version": True}]:
            response = self.client.put('/api/admin/training/segments/1', headers=self.headers, json=payload)
            self.assertEqual(response.status_code, 422)

    def test_export_has_no_storage_credentials_or_summary(self):
        response = self.client.get('/api/admin/training/export', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        row = json.loads(response.text)
        self.assertNotIn("storage_object_path", row); self.assertNotIn("reference_text", row)
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def import_pair(self, consent='true'):
        with patch('training_review.shutil.which', return_value='/test/ffprobe'), patch(
            'training_review.subprocess.run', return_value=Mock(stdout=json.dumps({'streams':[{'codec_type':'audio'}], 'format':{'duration':'30'}}))
        ):
            return self.client.post('/api/admin/training/import', headers=self.headers,
                data={'training_rights': consent}, files={'audio': ('synthetic.wav', b'synthetic test only', 'audio/wav'),
                'reference': ('synthetic.txt', '미검수 참고문'.encode(), 'text/plain')})

    def test_import_requires_rights_and_deduplicates_without_overwriting(self):
        self.assertEqual(self.import_pair('false').status_code, 422)
        self.db.storage.from_.assert_not_called()
        first = self.import_pair()
        self.assertEqual(first.status_code, 200, first.text)
        self.assertFalse(first.json()['existing'])
        self.assertEqual(self.assets[-1]['metadata']['reference_kind'], 'unreviewed')
        second = self.import_pair()
        self.assertEqual(second.status_code, 200, second.text)
        self.assertTrue(second.json()['existing'])
        self.assertEqual(first.json()['id'], second.json()['id'])
        self.db.storage.from_.return_value.upload.assert_called_once()

    def test_failed_import_removes_only_new_storage_object(self):
        class BrokenInsert(Query):
            def insert(self, payload): raise RuntimeError('db insert failed')
        self.db.table.side_effect = lambda name: BrokenInsert(self.assets)
        response = self.import_pair()
        self.assertEqual(response.status_code, 503)
        bucket = self.db.storage.from_.return_value
        bucket.remove.assert_called_once_with([bucket.upload.call_args.args[0]])


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg required for local clip verification')
class ClipTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory(); self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.audio = self.root / 'synthetic.wav'
        with wave.open(str(self.audio), 'wb') as target:
            target.setnchannels(1); target.setsampwidth(2); target.setframerate(16000)
            target.writeframes(b'\0\0' * 16000 * 4)
        self.row = {'id': 1, 'audio_sha256': fingerprint(self.audio), 'start_seconds': 1,
                    'end_seconds': 3, 'text': 'Reviewed speech', 'reference_verified': True,
                    'reviewed_at': '2026-11-07', 'split': 'train'}
        self.manifest = self.root / 'reviewed.jsonl'; self.output = self.root / 'clips'

    def write(self, rows):
        self.manifest.write_text(''.join(json.dumps(row) + '\n' for row in rows), encoding='utf-8')

    def test_exact_local_clip_and_no_overwrite(self):
        self.write([self.row])
        self.assertEqual(build_clips(self.root, self.manifest, self.output), 1)
        with wave.open(str(self.output / '1.wav')) as clip:
            self.assertEqual(clip.getnframes() / clip.getframerate(), 2)
            self.assertEqual(clip.getframerate(), 16000)
        self.assertEqual(json.loads((self.output / 'dataset.jsonl').read_text())['text'], self.row['text'])
        with self.assertRaises(FileExistsError): build_clips(self.root, self.manifest, self.output)

    def test_empty_unverified_overlap_and_split_leakage_rejected(self):
        for rows in [[], [{**self.row, 'reference_verified': False}],
                     [self.row, {**self.row, 'id': 2}],
                     [self.row, {**self.row, 'id': 2, 'split': 'test', 'start_seconds': 3, 'end_seconds': 4}]]:
            self.write(rows)
            with self.assertRaises(ValueError): build_clips(self.root, self.manifest, self.output)
            self.assertFalse(self.output.exists())

    def test_missing_audio_tail_removes_partial_output(self):
        self.write([{**self.row, 'end_seconds': 6}])
        with self.assertRaises(ValueError): build_clips(self.root, self.manifest, self.output)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
