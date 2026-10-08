#!/usr/bin/env python3
"""Offline meeting diarization checks; no credentials, network, or paid calls."""

from __future__ import annotations

import copy
import json
import os
import re
import socket
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with patch.dict(os.environ, {}, clear=True), patch("dotenv.load_dotenv", return_value=False):
    import main as api
    import meeting_speakers as speakers


def assignment(parts, ids=None, names=None):
    turns, cursor = [], 0
    for index, part in enumerate(parts):
        count = len(speakers.transcript_words(part))
        turns.append({"start": cursor, "end": cursor + count - 1,
                      "speaker": ids[index] if ids else index + 1, "confidence": "high"})
        cursor += count
    return {"turns": turns, "speakers": names or []}


def identity(speaker, name, turn, quote, kind="self_introduction"):
    return {"id": speaker, "name": name, "evidence_turn": turn,
            "evidence_quote": quote, "evidence_type": kind}


PARTS = ["저는 김준서입니다. 일정을 확인합니다.", "저는 이세라입니다. 내일 가능합니다.",
         "예산을 확인하겠습니다.", "네, 네, 그렇게 진행합시다."]
BODY = "\n\n".join(PARTS)
DATA = assignment(PARTS, [1, 2, 3, 1], [identity(1, "김준서", 0, "저는 김준서입니다."),
                                        identity(2, "이세라", 1, "저는 이세라입니다.")])


class OfflineChecks(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(socket.socket, "connect", side_effect=AssertionError("Network is forbidden")))


class RenderingChecks(OfflineChecks):
    def test_three_speakers_keep_same_voice_and_exact_words(self):
        result = speakers.render_assignment(BODY, DATA, "ko", BODY)
        self.assertEqual(result.count("참석자 1(김준서):"), 2)
        self.assertIn("참석자 2(이세라):", result)
        self.assertIn("참석자 3:", result)
        self.assertEqual(speakers.strip_speaker_labels(result).split(), BODY.split())
        self.assertIn("네, 네,", result)

    def test_four_speakers_not_limited_to_two(self):
        result = speakers.render_assignment(BODY, assignment(PARTS), "ko", BODY)
        for number in range(1, 5):
            self.assertIn(f"참석자 {number}:", result)

    def test_uncertain_turn_does_not_borrow_name(self):
        data = copy.deepcopy(DATA)
        data["turns"][0]["confidence"] = "uncertain"
        result = speakers.render_assignment(BODY, data, "ko", BODY)
        self.assertIn("참석자 ?(확인 필요):", result)
        self.assertNotIn("(김준서):", result)

    def test_mentions_roles_and_expanded_names_do_not_identify_speaker(self):
        for body, name, source in [
            ("김준서님 의견을 듣겠습니다.", "김준서", "김준서님 의견을 듣겠습니다."),
            ("진행자는 김준서입니다.", "김준서", "진행자는 김준서입니다."),
            ("저는 김준서입니다.", "김준서", "저는 준서입니다."),
            ("저는 장승경입니다.", "장승경", "승경이라고 합니다."),
            ("그분이 '저는 김준서입니다.'라고 했습니다.", "김준서", "그분이 '저는 김준서입니다.'라고 했습니다."),
        ]:
            with self.subTest(body=body):
                data = assignment([body], names=[identity(1, name, 0, body)])
                result = speakers.render_assignment(body, data, "ko", source)
                self.assertTrue(result.startswith("참석자 1:"), result)

    def test_explicit_confirmed_identity_but_not_calling_on_someone(self):
        for question, answer, valid in [
            ("김준서님 맞으시죠?", "네, 맞습니다.", True),
            ("김준서님 의견은 어떠세요?", "네, 맞습니다.", False),
            ("김준서님 맞으시죠?", "아니요.", False),
            ("김준서님 맞으시죠?", "네, 김준서는 옆에 있습니다.", False),
        ]:
            with self.subTest(question=question, answer=answer):
                body = f"{question} {answer}"
                data = assignment([question, answer], names=[identity(2, "김준서", 1, answer, "confirmed_address")])
                result = speakers.render_assignment(body, data, "ko", body)
                self.assertEqual("참석자 2(김준서):" in result, valid)

    def test_english_and_japanese_explicit_introductions(self):
        for lang, body, name in [("en", "My name is Alex. I can help.", "Alex"), ("ja", "私は田中です。", "田中")]:
            data = assignment([body], names=[identity(1, name, 0, body)])
            result = speakers.render_assignment(body, data, lang, body)
            self.assertIn(f"({name}):", result)

    def test_duplicate_names_not_attached_to_different_voices(self):
        parts = ["저는 김준서입니다.", "저는 김준서입니다."]
        body = " ".join(parts)
        data = assignment(parts, names=[identity(i + 1, "김준서", i, part) for i, part in enumerate(parts)])
        self.assertNotIn("(김준서):", speakers.render_assignment(body, data, "ko", body))

    def test_later_given_name_introduction_labels_same_voice_without_expansion(self):
        parts = ["일정을 확인하겠습니다.", "네, 확인했습니다.", "저는 준서입니다."]
        body = " ".join(parts)
        data = assignment(parts, [1, 2, 1], [identity(1, "준서", 2, parts[2])])
        result = speakers.render_assignment(body, data, "ko", body)
        self.assertEqual(result.count("참석자 1(준서):"), 2)
        self.assertNotIn("김준서", result)

    def test_duplicate_identity_ids_are_rejected(self):
        data = copy.deepcopy(DATA)
        data["speakers"].append(identity(1, "다른이름", 0, PARTS[0]))
        with self.assertRaises(ValueError):
            speakers.render_assignment(BODY, data, "ko", BODY)

    def test_rejects_missing_overlapping_invalid_and_truncated_ranges(self):
        bad_values = [
            ("turns", []), ("speakers", None),
            ("turns", [{"start": 1, "end": 2, "speaker": 1, "confidence": "high"}]),
        ]
        for key, value in bad_values:
            data = copy.deepcopy(DATA)
            data[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                speakers.render_assignment(BODY, data, "ko", BODY)
        for index, key, value in [(0, "start", True), (0, "speaker", -1), (0, "speaker", 129),
                                   (0, "end", 99999), (1, "start", 0), (1, "start", 999)]:
            data = copy.deepcopy(DATA)
            data["turns"][index][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                speakers.render_assignment(BODY, data, "ko", BODY)
        data = copy.deepcopy(DATA)
        data["turns"].pop()
        with self.assertRaises(ValueError):
            speakers.render_assignment(BODY, data, "ko", BODY)

    def test_stripping_labels_preserves_paragraphs_and_mentions(self):
        text = "참석자 1(김준서): 첫 발언.\n\n참석자 ?(확인 필요): 두 번째.\nParticipant 3: 참석자 2를 부릅니다."
        self.assertEqual(speakers.strip_speaker_labels(text), "첫 발언.\n\n두 번째.\n참석자 2를 부릅니다.")
        self.assertEqual(speakers.strip_speaker_labels(speakers.unverified_transcript(text, "ko")), speakers.strip_speaker_labels(text))


class TransportChecks(OfflineChecks):
    def request(self, *, failure=None, processing=False):
        paths, uploaded, usage = [], [], []
        real_client = httpx.Client
        def handler(request):
            paths.append((request.method, request.url.path))
            self.assertEqual(request.headers.get("x-goog-api-key"), "test-key")
            if request.url.path == "/upload/v1beta/files":
                url = "https://attacker.invalid/upload" if failure == "host" else "https://generativelanguage.googleapis.com/resumable"
                return httpx.Response(200, headers={"x-goog-upload-url": url})
            if request.url.path == "/resumable":
                uploaded.append(request.read())
                return httpx.Response(200, json={"file": {"name": "files/test123", "uri": "https://generativelanguage.googleapis.com/v1beta/files/test123",
                    "state": "FAILED" if failure == "file" else "PROCESSING" if processing else "ACTIVE"}})
            if request.method == "DELETE":
                return httpx.Response(200, json={})
            if request.method == "GET":
                return httpx.Response(200, json={"name": "files/test123", "uri": "https://generativelanguage.googleapis.com/v1beta/files/test123", "state": "ACTIVE"})
            payload = json.loads(request.read())
            self.assertEqual(payload["generationConfig"]["responseMimeType"], "application/json")
            self.assertIn("acoustic voice continuity", payload["contents"][0]["parts"][1]["text"])
            if failure == "timeout":
                raise httpx.ReadTimeout("test timeout")
            if failure == "quota":
                return httpx.Response(429, json={"error": {"message": "quota"}})
            return httpx.Response(200, json={"candidates": [{"finishReason": "MAX_TOKENS" if failure == "truncated" else "STOP",
                "content": {"parts": [{"text": "private thoughts", "thought": True}, {"text": "{broken" if failure == "json" else json.dumps(DATA)}]}}],
                "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 20, "totalTokenCount": 120}})
        with tempfile.NamedTemporaryFile(suffix=".wav") as audio, patch.object(speakers.httpx, "Client", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)), patch.object(speakers.time, "sleep"):
            audio.write(b"offline-audio-fixture"); audio.flush()
            try:
                result = speakers.request_assignment(file_path=audio.name, mime_type="audio/wav", body=BODY, language="ko",
                    api_key="test-key", model="gemini-2.5-flash", timeout=10, record_usage=usage.append, heartbeat=Mock())
            finally:
                if failure != "host":
                    self.assertEqual(paths[-1], ("DELETE", "/v1beta/files/test123"))
                    self.assertEqual(uploaded, [b"offline-audio-fixture"])
                else:
                    self.assertEqual(len(paths), 1)
        return result, paths, usage

    def test_upload_processing_usage_and_remote_cleanup(self):
        data, paths, usage = self.request(processing=True)
        self.assertEqual(data, DATA)
        self.assertIn(("GET", "/v1beta/files/test123"), paths)
        self.assertEqual(usage[0]["usageMetadata"]["totalTokenCount"], 120)

    def test_rejects_bad_responses_and_always_cleans_up(self):
        for failure in ["timeout", "quota", "truncated", "json", "host", "file"]:
            with self.subTest(failure=failure), self.assertRaises((ValueError, httpx.HTTPError)):
                self.request(failure=failure)


class PipelineChecks(OfflineChecks):
    def setUp(self):
        super().setUp()
        self.directory = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.audio = Path(self.directory) / "meeting.wav"
        self.audio.write_bytes(b"offline audio")
        for key, value in {"GEMINI_API_KEY": "test-key", "MEETING_DIARIZATION_ENABLED": True,
                           "MEETING_DIARIZATION_MAX_AUDIO_SECONDS": 7200, "FORCE_GC_AFTER_TRANSCRIPTION": False}.items():
            self.stack.enter_context(patch.object(api, key, value))
        self.request = self.stack.enter_context(patch.object(api, "request_assignment", return_value=DATA))

    def apply(self, **overrides):
        args = dict(task_id="meeting-test", file_path=str(self.audio), source_mime_type="audio/wav", text=BODY,
                    raw_text=BODY, language="ko", audio_seconds=30, progress_callback=Mock())
        args.update(overrides)
        return api._apply_meeting_speakers(**args)

    def test_summary_not_assigned_and_progress_is_reported(self):
        progress = Mock()
        result, success = self.apply(text=f"{BODY}\n\n요약\n일정과 예산을 확인했습니다.", progress_callback=progress)
        self.assertTrue(success)
        self.assertTrue(result.endswith("\n\n요약\n일정과 예산을 확인했습니다."))
        self.assertNotIn("요약", self.request.call_args.kwargs["body"])
        progress.assert_called_once_with("identifying_speakers")
        self.assertEqual(api._build_transcription_progress("identifying_speakers")["percent"], 95)

    def test_unavailable_analysis_preserves_text_without_inventing_voices(self):
        for error in [httpx.ReadTimeout("timeout"), RuntimeError("quota"), ValueError("incomplete range")]:
            self.request.side_effect = error
            result, success = self.apply(text="참석자 1(추측한이름): " + BODY)
            self.assertFalse(success)
            self.assertNotIn("추측한이름", result)
            self.assertIn("참석자 ?(확인 필요):", result)
            self.assertEqual(speakers.strip_speaker_labels(result).split(), BODY.split())

    def test_incomplete_assignment_preserves_body_and_summary(self):
        data = copy.deepcopy(DATA)
        data["turns"].pop()
        self.request.return_value = data
        source = BODY + "\n\n요약\n일정을 확인했습니다."
        result, success = self.apply(text=source)
        self.assertFalse(success)
        self.assertEqual(speakers.strip_speaker_labels(result).split(), source.split())

    def test_limits_and_missing_key_do_not_make_paid_requests(self):
        for key, value in [("GEMINI_API_KEY", ""), ("MEETING_DIARIZATION_ENABLED", False)]:
            with patch.object(api, key, value):
                _, success = self.apply()
                self.assertFalse(success)
        for overrides in [dict(audio_seconds=7201), dict(audio_seconds=0), dict(file_path="/nonexistent-audio"), dict(text="x" * 120001)]:
            _, success = self.apply(**overrides)
            self.assertFalse(success)
        self.request.assert_not_called()

    def pipeline(self, *, correction_failure=False, **overrides):
        mocks = {}
        for name in ["_set_task_runtime_state", "_upsert_transcription_job", "_upsert_transcription_state",
                     "_set_task_pipeline_progress", "_increment_user_usage_seconds", "_persist_transcription_usage_summary",
                     "_clear_task_runtime_state", "_release_active_source_job", "_log_stage_memory", "_touch_task_runtime_state"]:
            mocks[name] = self.stack.enter_context(patch.object(api, name))
        self.stack.enter_context(patch.object(api, "_fetch_active_user_glossary_prompt_terms", return_value=[]))
        self.stack.enter_context(patch.object(api, "_should_use_whisper_pipeline", return_value=True))
        self.stack.enter_context(patch.object(api, "whisper_transcribe", return_value=BODY))
        self.stack.enter_context(patch.object(api, "gemini_correct_and_structure", new=AsyncMock(
            return_value=BODY, side_effect=ValueError("invalid correction") if correction_failure else None)))
        self.stack.enter_context(patch.object(api, "_apply_fine_tuned_correction_if_enabled", side_effect=lambda text, *_: (text, False)))
        self.stack.enter_context(patch.object(api, "WHISPER_FALLBACK_TO_GEMINI_ON_ERROR", correction_failure))
        def audio_fallback(**_kwargs):
            self.assertTrue(self.audio.exists(), "Correction failure must not delete the fallback audio")
            return BODY, BODY
        fallback = self.stack.enter_context(patch.object(api, "_transcribe_with_gemini_only", side_effect=audio_fallback))
        def request(**kwargs):
            self.assertTrue(self.audio.exists(), "Original audio must survive ASR and correction")
            kwargs["record_usage"]({"usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 20, "totalTokenCount": 120}})
            sentences = re.split(r"(?<=[.!?])\s+", kwargs["body"])
            self.assertEqual(len(sentences), 6)
            parts = [" ".join(sentences[:2]), " ".join(sentences[2:4]), *sentences[4:]]
            return assignment(parts, [1, 2, 3, 1], DATA["speakers"])
        self.request.side_effect = request
        args = dict(task_id="pipeline-speakers", user_id="test-user", temp_file_path=str(self.audio),
                    language="ko", correct=True, transcription_type="conversation", audio_seconds=30)
        args.update(overrides)
        result = api._process_transcription_sync(**args)
        self.assertEqual(result["status"], "completed", result)
        self.assertFalse(self.audio.exists(), "Local audio must be removed after pipeline completion")
        self.assertEqual(result["raw_text"], BODY)
        self.assertEqual(fallback.call_count, int(correction_failure))
        mocks["_upsert_transcription_state"].assert_called_with("pipeline-speakers", "test-user", result)
        return result, mocks

    def test_real_pipeline_persists_speakers_and_admin_usage(self):
        result, mocks = self.pipeline()
        self.assertIn("+audio-speakers", result["engine"])
        self.assertIn("참석자 1(김준서):", result["corrected_text"])
        self.assertIn("참석자 2(이세라):", result["corrected_text"])
        self.assertEqual(result["content_style"], "meeting")
        usage = mocks["_persist_transcription_usage_summary"].call_args.args[2]
        self.assertEqual(usage["total_reported_tokens"], 120)
        self.assertNotIn("api_usage", result)

    def test_other_types_raw_and_disabled_correction_skip_audio_analysis(self):
        for overrides in [dict(transcription_type="sermon"), dict(transcription_type="prayer"),
                          dict(transcription_type="phonecall"), dict(correction_mode="raw"), dict(correct=False)]:
            with self.subTest(overrides=overrides):
                self.audio.write_bytes(b"offline audio")
                self.request.reset_mock()
                result, _ = self.pipeline(**overrides)
                self.request.assert_not_called()
                self.assertNotIn("audio-speakers", result["engine"])

    def test_audio_survives_correction_failure_until_fallback_and_diarization(self):
        result, _ = self.pipeline(correction_failure=True)
        self.assertEqual(result["engine"], "gemini-only-fallback+audio-speakers")
        self.assertIn("참석자 1(김준서):", result["corrected_text"])

    def test_unknown_label_parser_and_no_fabricated_alternation(self):
        self.assertEqual(api._count_detected_speakers("참석자 ?(확인 필요): 안녕하세요."), 0)
        self.assertEqual(api._infer_content_style("참석자 ?(확인 필요): 안녕하세요.", "conversation"), "meeting")
        for index in range(4):
            self.assertEqual(api._default_speaker_label("conversation", "ko", index), "참석자 ?")
        self.assertEqual(api._parse_speaker_line("参加者 3(田中): 確認します。")["speaker_id"], "3")

    def test_meeting_prompts_do_not_assign_voices_from_roles(self):
        ko = api.get_correction_prompt_by_type("conversation", "ko")
        en = api.get_correction_prompt_by_type("conversation", "en")
        ja = api.get_correction_prompt_by_type("conversation", "ja")
        self.assertIn("텍스트만 보고 목소리나 참석자 수를 추측하지 마라", ko)
        self.assertNotIn("참석자 1(김팀장)", ko)
        self.assertIn("This text-only step cannot hear voices", en)
        self.assertIn("この段階では音声を聞けません", ja)
        self.assertIn("한국어 회의 녹음", api._build_gemini_only_system_instruction("ko", "conversation"))
        self.assertIn("신원 근거로 사용 금지", api._build_gemini_only_content_prompt("ko", "conversation"))


if __name__ == "__main__":
    unittest.main()
