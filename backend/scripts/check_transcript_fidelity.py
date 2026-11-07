#!/usr/bin/env python3
"""Offline fidelity regressions. Synthetic audio only; network is forbidden."""

import asyncio
import copy
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import ExitStack
from dataclasses import replace
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from transcript_fidelity import decode_edits, faithful_edit, fidelity_issue, join_owned_chunks, merge_opening, render_units, source_units

with patch.dict(os.environ, {}, clear=True), patch("dotenv.load_dotenv", return_value=False):
    import main as api


SENTENCES = [
    "오늘은 교육의 목표와 앞으로의 운영 방향을 함께 살펴보겠습니다.",
    "먼저 참석해 주신 모든 분들께 감사드립니다.",
    "준비한 자료를 보면서 예산에 관해 설명하겠습니다.",
    "이번 교육은 다음 주 월요일부터 시작합니다.",
    "참석 신청서는 사무실에 제출하면 됩니다.",
    "수업 자료는 담당 선생님께서 나누어 드립니다.",
    "중간에 쉬는 시간을 충분히 마련하겠습니다.",
    "질문이 있으면 자유롭게 말씀해 주시기 바랍니다.",
    "추가 의견은 회의가 끝나고 전달해 주세요.",
    "마지막으로 다음 모임의 날짜를 확인하겠습니다.",
]


def response_for(units):
    return {"units": [{"id": u.id, "text": u.text, "break_before": False, "section": "none"} for u in units]}


class OfflineTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(socket.socket, "connect", side_effect=AssertionError("Network forbidden")))


class FidelityTests(OfflineTests):
    def test_merge_rejects_truncated_tail(self):
        with self.assertRaises(ValueError):
            join_owned_chunks([{"start": 0, "end": 30}], [{"text": "첫 구간입니다."}], expected_duration=60)

    def test_merge_rejects_swapped_result_ownership(self):
        with self.assertRaises(ValueError):
            join_owned_chunks([{"start": 0, "end": 30}, {"start": 30, "end": 60}],
                              [{"text": "뒤 구간", "chunk_index": 1}, {"text": "앞 구간", "chunk_index": 0}], expected_duration=60)

    def test_merge_preserves_real_repeat_across_boundary(self):
        text = "같은 말을 실제로 두 번 했습니다."
        result = join_owned_chunks([{"start": 0, "end": 30}, {"start": 30, "end": 60}],
                                   [{"text": text, "chunk_index": 0}, {"text": text, "chunk_index": 1}], expected_duration=60)
        self.assertEqual(result.count(text), 2)

    def test_distinct_sentences_cannot_converge_to_new_duplicate(self):
        units = source_units("김준서가 참석했습니다. 김성빈이 참석했습니다.")
        edits = response_for(units)
        for edit in edits["units"]:
            edit["text"] = "김준수가 참석했습니다."
        result, rejected = decode_edits(units, json.dumps(edits))
        self.assertEqual(result, units)
        self.assertEqual(rejected, 2)

    def test_small_duplicate_below_old_twelve_percent_threshold(self):
        source = " ".join(SENTENCES)
        candidate = source + " " + SENTENCES[3]
        self.assertLess(len(candidate) / len(source), 1.12)
        self.assertEqual(api._guard_correction_fidelity(source, candidate)[0], source)

    def test_duplicate_replacing_missing_sentence_without_growth(self):
        source = " ".join(SENTENCES)
        candidate = " ".join(SENTENCES[:-1] + [SENTENCES[0]])
        self.assertEqual(api._guard_correction_fidelity(source, candidate)[0], source)

    def test_single_missing_sentence_in_hundred(self):
        sentences = [f"항목 {i}에 대한 검토 결과를 공유하겠습니다." for i in range(100)]
        source = " ".join(sentences)
        del sentences[53]
        self.assertEqual(api._guard_correction_fidelity(source, " ".join(sentences))[0], source)

    def test_real_repeated_speech_is_kept(self):
        for count in [2, 3, 5, 40]:
            source = " ".join(["우리 장로님도 있고 함께 예배를 드립니다."] * count)
            with self.subTest(count=count):
                self.assertEqual(api._guard_correction_fidelity(source, source), (source, "accepted"))
                self.assertEqual(api._postprocess_transcript(source, "sermon", "ko", "raw").count("우리 장로님도"), count)

    def test_normal_postprocess_does_not_collapse_repetitions(self):
        source = "\n\n".join(["이 말씀을 꼭 기억해야 합니다."] * 5)
        result = api._postprocess_transcript(source, "sermon", "ko", "normal", source_text=source)
        self.assertEqual(result.count("이 말씀을 꼭 기억해야 합니다"), 5)

    def test_retry_cannot_remove_repeated_speech_based_on_frequency(self):
        primary = {"text": "\n\n".join([SENTENCES[0]] * 5)}
        retry = {"text": SENTENCES[0], "average_logprob": -0.01}
        self.assertIs(api._prefer_retry_transcription(primary, retry), primary)

    def test_minimal_pronunciation_and_style_changes(self):
        for source, candidate in [("장노님이 말씀하셨습니다.", "장로님이 말씀하셨습니다."),
                                  ("그럼 이게 맞습니다.", "그러면 이것이 맞습니다."),
                                  ("오늘 렙논트가 기도합니다.", "오늘 렘넌트가 기도합니다.")]:
            with self.subTest(source=source):
                self.assertTrue(faithful_edit(source, candidate))

    def test_words_numbers_and_negation_not_removed(self):
        for source, candidate in [("저는 가지 않겠습니다.", "저는 가겠습니다."),
                                  ("지금은 안 됩니다.", "지금은 됩니다."),
                                  ("이번에는 15명이 왔습니다.", "이번에는 50명이 왔습니다."),
                                  ("I will not go.", "I will go.")]:
            self.assertFalse(faithful_edit(source, candidate))

    def test_plain_guard_allows_layout_but_not_summary(self):
        source = " ".join(SENTENCES[:2])
        self.assertIsNone(fidelity_issue(source, "서론\n\n" + source))
        self.assertIsNotNone(fidelity_issue(source, source + "\n\n요약\n" + SENTENCES[0]))

    def test_missing_text_is_not_success(self):
        self.assertEqual(api._guard_correction_fidelity(SENTENCES[0], "")[0], SENTENCES[0])

    def test_existing_acronym_spelling_is_not_rolled_back(self):
        source = "아월스 교육과 더블유 아이 오 에스 교육을 함께 준비합니다."
        corrected = "OURS 교육과 WIOS 교육을 함께 준비합니다."
        self.assertEqual(api._guard_correction_fidelity(source, corrected), (corrected, "accepted"))
        self.assertEqual(api._guard_correction_fidelity(source, corrected + " " + corrected)[0], source)

    def test_source_ids_represent_occurrences(self):
        units = source_units((SENTENCES[0] + " ") * 5)
        self.assertEqual([u.id for u in units], list(range(5)))
        self.assertEqual(len({u.text for u in units}), 1)

    def test_multilingual_source_coverage(self):
        for text in ["はい。 はい。 次に進みます。", "Yes. Yes. Let's continue.", "네. 네. 다음으로 갑니다."]:
            units = source_units(text)
            edited, count = decode_edits(units, json.dumps(response_for(units)))
            self.assertEqual(count, 0)
            self.assertIsNone(fidelity_issue(text, render_units(edited, "ko", "conversation")))


class EditPlanTests(OfflineTests):
    def setUp(self):
        super().setUp()
        self.units = source_units(" ".join(SENTENCES))

    def test_invalid_coverage_falls_back(self):
        for mutation in ["missing", "duplicate", "reorder", "extra", "wrong_type"]:
            data = response_for(self.units)
            if mutation == "missing":
                data["units"].pop(4)
            elif mutation == "duplicate":
                data["units"][4]["id"] = 3
            elif mutation == "reorder":
                data["units"][4], data["units"][5] = data["units"][5], data["units"][4]
            elif mutation == "extra":
                data["units"].append(data["units"][0])
            else:
                data["units"][0]["id"] = False
            with self.subTest(mutation=mutation):
                self.assertEqual(decode_edits(self.units, json.dumps(data))[0], self.units)

    def test_malformed_and_truncated_json(self):
        for payload in ["", "null", "[]", "{}", '{"units":[', "Not JSON", '"text"']:
            self.assertEqual(decode_edits(self.units, payload)[0], self.units)

    def test_only_unsafe_unit_falls_back(self):
        units = source_units("그럼 이게 맞습니다. " + SENTENCES[0])
        data = response_for(units)
        data["units"][0]["text"] = "그러면 이것이 맞습니다."
        data["units"][1]["text"] += " " + SENTENCES[0]
        result, rejected = decode_edits(units, json.dumps(data))
        self.assertEqual(rejected, 1)
        self.assertEqual(result[0].text, "그러면 이것이 맞습니다.")
        self.assertEqual(result[1].text, units[1].text)

    def test_copied_sentence_under_different_id_rejected(self):
        data = response_for(self.units)
        data["units"][4]["text"] = data["units"][3]["text"]
        self.assertEqual(decode_edits(self.units, json.dumps(data))[0][4], self.units[4])

    def test_model_cannot_embed_heading_or_prayer_in_body(self):
        data = response_for(self.units)
        data["units"][0]["text"] += "\n기도\n아멘."
        self.assertEqual(decode_edits(self.units, json.dumps(data))[0][0], self.units[0])

    def test_layout_emits_each_unit_once(self):
        units = [replace(u, section="introduction") for u in self.units]
        rendered = render_units(units, "ko", "sermon")
        self.assertEqual(rendered.count("서론"), 1)
        for sentence in SENTENCES:
            self.assertEqual(rendered.count(sentence), 1)

    def test_sections_do_not_restart_in_later_batches(self):
        units = [replace(u, section=["introduction", "body", "introduction", "body", "conclusion"][i % 5]) for i, u in enumerate(self.units)]
        rendered = render_units(units, "ko", "sermon")
        for heading in ["서론", "본론", "결론"]:
            self.assertEqual(rendered.count(heading), 1)

    def test_no_sermon_headers_in_meetings(self):
        units = [replace(u, section="introduction") for u in self.units]
        self.assertNotIn("서론", render_units(units, "ko", "conversation"))

    def test_renderer_rejects_missing_or_duplicate_ids(self):
        for units in [self.units[1:], self.units + [self.units[0]], list(reversed(self.units))]:
            with self.assertRaises(ValueError):
                render_units(units, "ko", "sermon")


class MergeTests(OfflineTests):
    def test_paraphrased_opening_not_appended(self):
        opening = " ".join(SENTENCES[:2])
        main = "오늘 교육 목표와 향후 운영 방향에 대해 함께 살펴보겠습니다. 우선 참석하신 모든 분들께 감사드립니다. 다음으로 준비 사항을 설명하겠습니다."
        self.assertEqual(merge_opening(opening, main), main)

    def test_missing_prefix_recovered_once_at_anchor(self):
        opening = " ".join(SENTENCES[:2])
        main = " ".join(SENTENCES[1:4])
        result = merge_opening(opening, main)
        for sentence in SENTENCES[:4]:
            self.assertEqual(result.count(sentence), 1)

    def test_ambiguous_opening_does_not_invent_extra_speech(self):
        self.assertEqual(merge_opening("안녕하세요.", SENTENCES[0]), SENTENCES[0])
        self.assertEqual(merge_opening(SENTENCES[0], SENTENCES[0] + " " + SENTENCES[0]), SENTENCES[0] + " " + SENTENCES[0])

    def test_distinct_audio_spans_keep_identical_boundary_speech(self):
        chunks = [{"index": i, "start": i * 90, "end": (i + 1) * 90} for i in range(3)]
        result = join_owned_chunks(chunks, [{"text": SENTENCES[0]}] * 3)
        self.assertEqual(result.count(SENTENCES[0]), 3)

    def test_gaps_overlaps_reordering_or_empty_results_fail(self):
        valid = [{"index": 0, "start": 0, "end": 90}, {"index": 1, "start": 90, "end": 180}]
        cases = [(valid, [{"text": "one"}]),
                 (valid, [{"text": "one"}, {"text": ""}]),
                 (list(reversed(valid)), [{"text": "one"}] * 2)]
        for start in [89, 90.1, float("nan")]:
            chunks = copy.deepcopy(valid)
            chunks[1]["start"] = start
            cases.append((chunks, [{"text": "one"}] * 2))
        for chunks, results in cases:
            with self.assertRaises(ValueError):
                join_owned_chunks(chunks, results)


class CorrectionPipelineTests(OfflineTests):
    def setUp(self):
        super().setUp()
        self.model = Mock()
        self.stack.enter_context(patch.object(api.genai, "GenerativeModel", return_value=self.model))
        self.stack.enter_context(patch.object(api, "_touch_task_runtime_state"))
        self.stack.enter_context(patch.object(api, "_record_gemini_api_usage"))
        self.stack.enter_context(patch.object(api, "_extract_gemini_response_text", side_effect=lambda r, **kw: r))
        self.stack.enter_context(patch.object(api, "GEMINI_CORRECTION_MAX_RETRIES", 1))

    def run_correction(self, text, transform=lambda data: data):
        def generate(parts, **kw):
            data = json.loads(parts[-1])
            for unit in data["units"]:
                unit.update(break_before=False, section="none")
            return json.dumps(transform(data), ensure_ascii=False)
        self.model.generate_content.side_effect = generate
        return asyncio.run(api.gemini_correct_and_structure(text, "offline-test", "sermon", "ko"))

    def test_full_correction_preserves_five_actual_repeats(self):
        text = " ".join([SENTENCES[0]] * 5)
        result = self.run_correction(text)
        self.assertEqual(result.count(SENTENCES[0]), 5)

    def test_generated_extra_sentence_dropped_at_its_unit(self):
        def corrupt(data):
            data["units"][4]["text"] += " " + SENTENCES[3]
            return data
        result = self.run_correction(" ".join(SENTENCES), corrupt)
        self.assertEqual(result, " ".join(SENTENCES))

    def test_missing_id_restores_batch(self):
        def corrupt(data):
            data["units"].pop(4)
            return data
        self.assertEqual(self.run_correction(" ".join(SENTENCES), corrupt), " ".join(SENTENCES))

    def test_parallel_results_stay_ordered(self):
        def slower_first(data):
            if data["units"][0]["id"] == 0:
                time.sleep(0.03)
            return data
        with patch.object(api, "GEMINI_CORRECTION_CHUNK_CHARS", 85), patch.object(api, "GEMINI_CORRECTION_CHUNK_CONCURRENCY", 3):
            result = self.run_correction(" ".join(SENTENCES), slower_first)
        self.assertEqual(result, " ".join(SENTENCES))
        self.assertGreater(self.model.generate_content.call_count, 1)

    def test_provider_failure_preserves_all_words(self):
        self.model.generate_content.side_effect = RuntimeError("provider unavailable")
        result = asyncio.run(api.gemini_correct_and_structure(" ".join(SENTENCES), "offline-test"))
        self.assertEqual(result, " ".join(SENTENCES))

    def test_structured_schema_compiles_in_installed_sdk(self):
        config = api.genai.types.GenerationConfig(response_mime_type="application/json", response_schema=api.EDIT_SCHEMA)
        self.assertEqual(config.response_mime_type, "application/json")


class AudioOwnershipTests(OfflineTests):
    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg required")
    def test_actual_audio_extraction_covers_source_once(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=16", str(path)], check=True)
            with patch.object(api, "WHISPER_SEGMENT_SECONDS", 6), patch.object(api, "WHISPER_SEGMENT_MIN_SECONDS", 4), patch.object(api, "WHISPER_SEGMENT_MAX_SECONDS", 8), patch.object(api, "WHISPER_CHUNK_OVERLAP_SECONDS", 12):
                chunks = api.split_audio_file(str(path))
            self.assertGreater(len(chunks), 1)
            self.assertAlmostEqual(chunks[-1]["end"], 16, places=2)
            for index, chunk in enumerate(chunks):
                self.assertEqual(chunk["start"], chunk["core_start"])
                self.assertEqual(chunk["end"], chunk["core_end"])
                self.assertEqual(chunk["start"], chunks[index - 1]["end"] if index else 0)
                self.assertTrue(Path(chunk["path"]).exists())
                self.assertTrue(chunk["boundary_review"])
            self.assertEqual(join_owned_chunks(chunks, [{"text": SENTENCES[0]}] * len(chunks)).count(SENTENCES[0]), len(chunks))


class WhisperPipelineTests(OfflineTests):
    def setUp(self):
        super().setUp()
        directory = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.path = Path(directory) / "mock.wav"
        self.path.write_bytes(b"synthetic mock; never transmitted")
        self.chunk = {"index": 0, "path": str(self.path), "start": 0, "end": 30,
                      "core_start": 0, "core_end": 30, "duration": 30}
        self.stack.enter_context(patch.object(api, "split_audio_file", return_value=[self.chunk]))
        for name, value in {"WHISPER_OPENING_GUARD_SECONDS": 0, "WHISPER_SOURCE_OPENING_GUARD_SECONDS": 0,
                            "WHISPER_CHUNK_MAX_RETRIES": 1, "WHISPER_SELECTIVE_RETRY_ENABLED": True,
                            "WHISPER_TIMESTAMP_AUDIT_ENABLED": True}.items():
            self.stack.enter_context(patch.object(api, name, value))
        self.stack.enter_context(patch.object(api, "_get_openai_transcription_model_candidates", return_value=["whisper-1"]))
        self.client = Mock()
        self.stack.enter_context(patch.object(api, "openai_client", self.client))
        self.audit = self.stack.enter_context(patch.object(api, "_transcribe_with_whisper_timestamp_audit", return_value=None))
        self.stack.enter_context(patch.object(api, "_record_openai_api_usage"))

    def run_pipeline(self):
        # Compatible with the deployed baseline, which has no RAG keyword yet.
        return api.whisper_transcribe(str(self.path), language="ko", transcription_type="sermon")

    def test_all_stt_stages_preserve_real_repetitions(self):
        source = "\n\n".join([SENTENCES[0]] * 5)
        self.client.audio.transcriptions.create.side_effect = [{"text": source}, {"text": SENTENCES[0]}]
        self.audit.return_value = {"text": SENTENCES[0], "segments": [], "average_logprob": -0.01}
        result = self.run_pipeline()
        self.assertEqual(result.count(SENTENCES[0]), 5)
        self.assertIn("[확인 필요 00:00]", result)
        self.assertEqual(self.client.audio.transcriptions.create.call_count, 2)

    def test_retry_disabled_still_preserves_and_flags_repeat(self):
        self.client.audio.transcriptions.create.return_value = {"text": " ".join([SENTENCES[0]] * 5)}
        with patch.object(api, "WHISPER_SELECTIVE_RETRY_ENABLED", False):
            result = self.run_pipeline()
        self.assertEqual(result.count(SENTENCES[0]), 5)
        self.assertIn("[확인 필요 00:00]", result)

    def test_non_silent_boundary_remains_flagged_after_retry(self):
        self.chunk["boundary_review"] = True
        self.client.audio.transcriptions.create.return_value = {"text": SENTENCES[0]}
        result = self.run_pipeline()
        self.assertEqual(result.count(SENTENCES[0]), 1)
        self.assertIn("[확인 필요 00:00]", result)

    def test_missing_chunk_text_is_not_silently_skipped(self):
        self.client.audio.transcriptions.create.return_value = {"text": ""}
        with self.assertRaises(RuntimeError):
            self.run_pipeline()


if __name__ == "__main__":
    unittest.main(verbosity=2)
