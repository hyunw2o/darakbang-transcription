#!/usr/bin/env python3
"""Offline language-selection regressions. No real audio or paid API requests."""

import asyncio
import json
import os
import socket
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from transcription_language import (
    TranscriptionLanguageError, language_instruction, language_mismatch,
    language_prompt, language_retry_preserves_content,
)
from transcription_models import transcription_arguments
from transcript_fidelity import correction_instruction, source_units

with patch.dict(os.environ, {}, clear=True), patch("dotenv.load_dotenv", return_value=False):
    import main as api

KO = "오늘은 교육의 목표를 확인하고 다음 주 월요일부터 운영할 수업 계획을 함께 검토하겠습니다."
EN = "Today we will review the education goals and the lesson plan for next Monday."
JA = "今日は教育の目標を確認し、来週の月曜日から始まる授業の計画を検討します。"


class OfflineTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(socket.socket, "connect", side_effect=AssertionError("Network forbidden")))


class LanguageTests(OfflineTests):
    def test_script_mismatch_detects_foreign_sentences_not_acronyms(self):
        for language, good, bad in [("ko", KO, EN), ("en", EN, KO), ("ja", JA, EN)]:
            with self.subTest(language=language):
                self.assertFalse(language_mismatch(good, language))
                self.assertTrue(language_mismatch(bad, language))
                self.assertTrue(language_mismatch(good * 50 + "\n" + bad, language))
        for text in ["OURS WIOS WIO RVS RRTS RSTS", "오늘 OURS와 WIOS를 이야기합니다.",
                     "OpenAI API를 사용합니다.", "John Smith가 설명합니다.",
                     "Remnant Vision School에서 배웁니다.", "John and Jane이 왔습니다.",
                     "University of the Arts에서 공부합니다.",
                     "문의는 support@example.com 또는 https://example.com/help로 주세요."]:
            self.assertFalse(language_mismatch(text, "ko"), text)
        for text in ["지금 this is the reason why we are here 라고 잘못 나옵니다.", "THIS IS THE ENTIRE ENGLISH TRANSCRIPT.", "This is fine."]:
            self.assertTrue(language_mismatch(text, "ko"), text)
        self.assertTrue(language_mismatch(JA, "ko"))
        self.assertTrue(language_mismatch(KO, "ja"))
        self.assertFalse(language_mismatch("Kim said 장로 and OURS.", "en"))

    def test_single_language_and_context_survive_all_model_adapters(self):
        for language in ("ko", "en", "ja"):
            for model in ("gpt-transcribe", "gpt-4o-transcribe", "whisper-1"):
                with self.subTest(language=language, model=model):
                    args = transcription_arguments(model, language, "opening-check\nprevious-context", ["OURS"], "conversation", 30)
                    self.assertIn(language_instruction(language), args["prompt"])
                    self.assertIn("opening-check", args["prompt"])
                    self.assertIn("previous-context", args["prompt"])
                    if model == "gpt-transcribe":
                        self.assertEqual(args["extra_body"]["languages"], [language])
                        self.assertNotIn("language", args)
                    else:
                        self.assertEqual(args["language"], language)
                        self.assertNotIn("extra_body", args)
        self.assertNotIn("A recorded", transcription_arguments("gpt-transcribe", "ko", "", [], "sermon", 30)["prompt"])
        with self.assertRaises(ValueError):
            transcription_arguments("gpt-transcribe", "auto", "", [], "sermon", 30)

    def test_prompt_budget_never_truncates_language_guard(self):
        prompt = language_prompt("ko", "opening-check" + "가" * 6000 + "previous-context", retry=True)
        self.assertLessEqual(len(prompt), 1200)
        for expected in (language_instruction("ko"), "opening-check", "previous-context", "같은 음성"):
            self.assertIn(expected, prompt)

    def test_correction_and_fine_tuned_prompts_obey_selected_language(self):
        for language in ("ko", "en", "ja"):
            self.assertIn(language_instruction(language), correction_instruction(language, "sermon"))
            self.assertIn(language_instruction(language), api._build_fine_tuned_correction_messages(KO, "sermon", language)[0]["content"])
        self.assertNotIn("Korean style", correction_instruction("en", "conversation"))

    def test_retry_must_not_delete_existing_selected_language_speech(self):
        source = KO + " " + EN
        self.assertTrue(language_retry_preserves_content(source, KO, "ko"))
        self.assertFalse(language_retry_preserves_content(source, "네.", "ko"))
        self.assertTrue(language_retry_preserves_content(EN, KO, "ko"))
        self.assertFalse(language_retry_preserves_content(KO * 100, KO * 30, "ko"))

    def test_postprocessing_cannot_add_foreign_sentence(self):
        with patch.object(api, "correct_text", return_value=KO + " " + EN), patch.object(api, "_guard_correction_fidelity", side_effect=lambda source, candidate: (candidate, "accepted")):
            self.assertEqual(api._postprocess_transcript(KO, "conversation", "ko", "normal", source_text=KO), KO)


class PipelineTests(OfflineTests):
    def setUp(self):
        super().setUp()
        directory = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.path = Path(directory) / "mock.wav"
        self.path.write_bytes(b"synthetic placeholder; never transmitted")
        self.chunk = {"index": 0, "path": str(self.path), "start": 0, "end": 30,
                      "core_start": 0, "core_end": 30, "duration": 30}
        self.stack.enter_context(patch.object(api, "split_audio_file", side_effect=lambda *a, **k: [dict(self.chunk)]))
        for name, value in {"WHISPER_OPENING_GUARD_SECONDS": 0, "WHISPER_SOURCE_OPENING_GUARD_SECONDS": 0,
                            "WHISPER_CHUNK_MAX_RETRIES": 3, "WHISPER_SELECTIVE_RETRY_ENABLED": False,
                            "WHISPER_TIMESTAMP_AUDIT_ENABLED": False}.items():
            self.stack.enter_context(patch.object(api, name, value))
        self.stack.enter_context(patch.object(api, "_get_openai_transcription_model_candidates", return_value=["gpt-transcribe", "whisper-1"]))
        self.client = Mock()
        self.stack.enter_context(patch.object(api, "openai_client", self.client))
        self.stack.enter_context(patch.object(api, "_require_task_ai_consent"))
        self.usage = self.stack.enter_context(patch.object(api, "_record_openai_api_usage"))

    def run_pipeline(self, language="ko"):
        return api.whisper_transcribe(str(self.path), language=language, transcription_type="conversation")

    def test_wrong_language_retried_on_same_audio_and_selected_language(self):
        for language, wrong, right in [("ko", EN, KO), ("en", KO, EN), ("ja", EN, JA)]:
            with self.subTest(language=language):
                self.client.reset_mock()
                self.client.audio.transcriptions.create.side_effect = [{"text": wrong}, {"text": right}]
                self.assertEqual(self.run_pipeline(language), right)
                calls = self.client.audio.transcriptions.create.call_args_list
                self.assertEqual(len(calls), 2)
                self.assertEqual([c.kwargs["extra_body"]["languages"] for c in calls], [[language], [language]])
                self.assertEqual([c.kwargs["file"].name for c in calls], [str(self.path)] * 2)
                self.assertEqual(self.usage.call_args.kwargs["operation"], "language_retry")

    def test_unresolved_mismatch_is_not_returned_as_success_or_multiplied(self):
        self.client.audio.transcriptions.create.return_value = {"text": EN}
        with self.assertRaises(TranscriptionLanguageError) as caught:
            self.run_pipeline()
        self.assertEqual(self.client.audio.transcriptions.create.call_count, 2)
        self.assertIn("한국어", api._sanitize_transcription_error(caught.exception))
        self.assertIn("00:00", str(caught.exception))

    def test_retry_cannot_succeed_by_dropping_most_of_the_source(self):
        self.client.audio.transcriptions.create.side_effect = [{"text": KO + EN}, {"text": "네."}]
        with self.assertRaises(TranscriptionLanguageError):
            self.run_pipeline()

    def test_good_result_adds_no_api_calls(self):
        self.client.audio.transcriptions.create.return_value = {"text": KO + " OURS와 WIOS를 소개합니다."}
        self.assertIn("OURS", self.run_pipeline())
        self.assertEqual(self.client.audio.transcriptions.create.call_count, 1)

    def test_provider_error_fallback_keeps_selected_language(self):
        self.client.audio.transcriptions.create.side_effect = [RuntimeError("provider unavailable"), {"text": KO}]
        self.assertEqual(self.run_pipeline(), KO)
        self.assertEqual(self.client.audio.transcriptions.create.call_args.kwargs["language"], "ko")

    def test_only_mismatched_chunk_is_retried(self):
        second = self.path.with_name("second.wav")
        second.write_bytes(b"second synthetic placeholder")
        chunks = [dict(self.chunk), {**self.chunk, "index": 1, "path": str(second), "start": 30,
                                     "end": 60, "core_start": 30, "core_end": 60}]
        attempts = []

        def respond(**kwargs):
            name = kwargs["file"].name
            attempts.append(name)
            return {"text": EN if name == str(second) and attempts.count(name) == 1 else KO}

        self.client.audio.transcriptions.create.side_effect = respond
        with patch.object(api, "split_audio_file", return_value=chunks):
            self.assertEqual(self.run_pipeline().count(KO), 2)
        self.assertEqual(attempts.count(str(self.path)), 1)
        self.assertEqual(attempts.count(str(second)), 2)

    def test_secondary_retry_cannot_reintroduce_foreign_language(self):
        self.chunk["boundary_review"] = True
        self.client.audio.transcriptions.create.side_effect = [{"text": KO}, {"text": EN}, {"text": EN}]
        with patch.object(api, "WHISPER_SELECTIVE_RETRY_ENABLED", True):
            result = self.run_pipeline()
        self.assertIn(KO, result)
        self.assertNotIn(EN, result)
        self.assertEqual(self.client.audio.transcriptions.create.call_count, 3)

    def test_parallel_jobs_cannot_leak_language(self):
        def respond(**kwargs):
            return {"text": {"ko": KO, "en": EN}[kwargs["extra_body"]["languages"][0]]}
        self.client.audio.transcriptions.create.side_effect = respond
        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(list(executor.map(self.run_pipeline, ["ko", "en"])), [KO, EN])

    def test_timestamp_audit_cannot_replace_source_with_english(self):
        self.client.audio.transcriptions.create.return_value = {"text": EN, "segments": []}
        with patch.object(api, "WHISPER_TIMESTAMP_AUDIT_ENABLED", True), patch.object(api, "legacy_available", return_value=True):
            self.assertIsNone(api._transcribe_with_whisper_timestamp_audit(str(self.path), "ko", "context"))
        self.assertIn(language_instruction("ko"), self.client.audio.transcriptions.create.call_args.kwargs["prompt"])

    def test_gemini_only_has_the_same_guard_and_one_retry(self):
        audio = Mock()
        model = Mock()
        with patch.object(api.genai, "upload_file", return_value=audio), patch.object(api.genai, "GenerativeModel", return_value=model) as factory, patch.object(api, "_extract_gemini_response_text", side_effect=[EN, KO]), patch.object(api, "_record_gemini_api_usage"), patch.object(api, "_touch_task_runtime_state"):
            raw, corrected = api._transcribe_with_gemini_only(task_id="test", temp_file_path=str(self.path), source_mime_type="audio/wav", transcription_type="conversation", language="ko", correction_mode="raw")
        self.assertEqual((raw, corrected), (KO, KO))
        self.assertIn(language_instruction("ko"), factory.call_args.kwargs["system_instruction"])
        self.assertEqual(model.generate_content.call_count, 2)
        audio.delete.assert_called_once()

    def test_gemini_only_unresolved_mismatch_fails_and_cleans_upload(self):
        audio, model = Mock(), Mock()
        with patch.object(api.genai, "upload_file", return_value=audio), patch.object(api.genai, "GenerativeModel", return_value=model), patch.object(api, "_extract_gemini_response_text", return_value=EN), patch.object(api, "_record_gemini_api_usage"), patch.object(api, "_touch_task_runtime_state"):
            with self.assertRaises(TranscriptionLanguageError):
                api._transcribe_with_gemini_only(task_id="test", temp_file_path=str(self.path), source_mime_type="audio/wav", transcription_type="conversation", language="ko", correction_mode="raw")
        self.assertEqual(model.generate_content.call_count, 2)
        audio.delete.assert_called_once()

    def test_structuring_rejects_translated_unit(self):
        units = source_units(KO)
        response = json.dumps({"units": [{"id": units[0].id, "text": EN, "break_before": False, "section": "none"}]})
        with patch.object(api.genai, "GenerativeModel", return_value=Mock()), patch.object(api, "_extract_gemini_response_text", return_value=response), patch.object(api, "_record_gemini_api_usage"), patch.object(api, "_touch_task_runtime_state"):
            result = asyncio.run(api.gemini_correct_and_structure(KO, "test", "conversation", "ko"))
        self.assertEqual(result, KO)


if __name__ == "__main__":
    unittest.main(verbosity=2)
