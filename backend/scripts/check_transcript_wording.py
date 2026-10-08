#!/usr/bin/env python3
"""Offline regression checks for acronym spelling and Korean transcript wording."""

from __future__ import annotations

import ast
import re
import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from church_terms import (
    KOREAN_ENDING_PRESERVATION_HINT,
    REFERENCE_PERSON_NAMES,
    correct_text,
    get_correction_prompt_by_type,
    get_gemini_content_prompt,
    get_gemini_prompt,
    get_special_term_prompt_hint,
)


def load_audio_prompt_helpers() -> dict:
    # Exercise the real pure helpers without importing clients or loading .env.
    names = {
        "_dedupe_prompt_terms", "_normalize_whisper_prompt_terms",
        "_build_prompt_with_budget", "_build_compact_whisper_prompt",
        "_gemini_audio_continuity_guard", "_build_gemini_only_system_instruction",
    }
    source = ast.parse((BACKEND / "main.py").read_text(encoding="utf-8"))
    functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in names]
    assert {node.name for node in functions} == names
    namespace = {
        "re": re,
        "REFERENCE_PERSON_NAMES": REFERENCE_PERSON_NAMES,
        "KOREAN_ENDING_PRESERVATION_HINT": KOREAN_ENDING_PRESERVATION_HINT,
        "WHISPER_PROMPT_MAX_CHARS": 1200,
        "get_gemini_prompt": get_gemini_prompt,
        "get_special_term_prompt_hint": get_special_term_prompt_hint,
        "get_correction_prompt_by_type": get_correction_prompt_by_type,
    }
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(BACKEND / "main.py"), "exec"), namespace)
    return namespace


class TranscriptWordingChecks(unittest.TestCase):
    def test_acronym_aliases(self):
        samples = {
            "아월스(Our-S)는 더블유 아이 오 에스와 더블유 아이 오를 소개합니다.":
                "OURS는 WIOS와 WIO를 소개합니다.",
            "아월스, 아워스, Our-S, our-s, OUR-S, O U R S":
                "OURS, OURS, OURS, OURS, OURS, OURS",
            "더블유아이오에스 더블유아이오 W I O S W I O wios wio":
                "WIOS WIO WIOS WIO WIOS WIO",
            "오 유 알 에스와 오유아르에스는": "OURS와 OURS는",
        }
        for original, expected in samples.items():
            with self.subTest(original=original):
                self.assertEqual(correct_text(original), expected)

    def test_distinct_acronyms_and_real_repetitions_are_preserved(self):
        text = "OURS WIOS WIO WIO WIOS. OURS를 소개합니다. OURS를 소개합니다."
        self.assertEqual(correct_text(text), text)

    def test_alias_annotations_collapse_without_removing_other_parentheses(self):
        self.assertEqual(correct_text("아월스 (Our-S), WIOS(더블유 아이 오 에스), WIO(더블유 아이 오)"), "OURS, WIOS, WIO")
        text = "OURS(프로젝트 이름), WIOS(학교 이름), WIO(프로그램 이름)"
        self.assertEqual(correct_text(text), text)

    def test_korean_particles(self):
        for suffix in ("는", "와", "를", "의", "로", "에서", "에서도", "만", "입니다", "이라고"):
            with self.subTest(suffix=suffix):
                self.assertEqual(correct_text(f"아월스{suffix}"), f"OURS{suffix}")

    def test_word_boundaries_and_english_pronouns(self):
        protected = "This is ours. Ours is here. yours hours SWIO WIOScope WIOS2 WIO_code 아월스톤 더블유아이오닉 아워즈"
        for language in ("ko", "en", "ja"):
            with self.subTest(language=language):
                self.assertEqual(correct_text(protected, language=language), protected)

    def test_standalone_geureom_only(self):
        samples = {
            "그럼 기도하시라.": "그러면 기도하시라.",
            "확인했다. 그럼, 시작하시라.": "확인했다. 그러면, 시작하시라.",
            "참석자 1: 그럼 시작하십시오.": "참석자 1: 그러면 시작하십시오.",
            "그럼요. 그럼에도 불구하고 그럼으로써 해결한다.": "그럼요. 그럼에도 불구하고 그럼으로써 해결한다.",
            "그럼에도 그럼에도요 안그럼 A그럼 그럼B 그럼_1": "그럼에도 그럼에도요 안그럼 A그럼 그럼B 그럼_1",
        }
        for original, expected in samples.items():
            with self.subTest(original=original):
                self.assertEqual(correct_text(original), expected)

    def test_endings_are_not_mechanically_rewritten(self):
        text = "기도하시라. 기도하십시오. 주께서 하시리라. 기도하시라고 하셨다. 기도하시라는 말씀이다. 도와주소서."
        for mode in ("normal", "strict", "raw"):
            with self.subTest(mode=mode):
                self.assertEqual(correct_text(text, correction_mode=mode), text)

    def test_all_korean_transcription_types(self):
        for kind in ("sermon", "prayer", "phonecall", "conversation"):
            for mode in ("normal", "strict"):
                with self.subTest(kind=kind, mode=mode):
                    self.assertEqual(
                        correct_text("그럼 아월스(Our-S)와 W I O S, W I O를 확인하시라.", transcription_type=kind, correction_mode=mode),
                        "그러면 OURS와 WIOS, WIO를 확인하시라.",
                    )

    def test_raw_mode_and_non_korean_written_style_are_unchanged(self):
        text = "그럼 아월스(Our-S)를 확인하시라."
        self.assertEqual(correct_text(text, correction_mode="raw"), text)
        for language in ("en", "ja"):
            self.assertEqual(correct_text("그럼", language=language), "그럼")

    def test_correction_is_idempotent(self):
        corrected = correct_text("그럼 아월스(Our-S)에서 더블유아이오에스와 더블유아이오를 확인하시라.")
        self.assertEqual(correct_text(corrected), corrected)

    def test_text_correction_prompts(self):
        for kind in ("sermon", "prayer", "phonecall", "conversation"):
            with self.subTest(kind=kind):
                prompt = get_correction_prompt_by_type(kind, "ko")
                self.assertIn(KOREAN_ENDING_PRESERVATION_HINT, prompt)
                self.assertIn("'그럼'은 '그러면'", prompt)
                for term in ("OURS", "WIOS", "WIO", "마지막 S", "일반 영어 대명사 ours"):
                    self.assertIn(term, prompt)
        self.assertIn("OURS", get_special_term_prompt_hint("ko"))

    def test_audio_prompts_keep_exact_terms_and_endings_within_budget(self):
        helpers = load_audio_prompt_helpers()
        for kind in ("sermon", "prayer", "phonecall", "conversation"):
            with self.subTest(kind=kind):
                prompt = helpers["_build_compact_whisper_prompt"]("ko", kind)
                self.assertLessEqual(len(prompt), 1200)
                self.assertIn(KOREAN_ENDING_PRESERVATION_HINT, prompt)
                for term in ("OURS", "WIOS", "WIO", "RVS", "WRC", "RRTS", "RSTS", *REFERENCE_PERSON_NAMES):
                    self.assertIn(term, prompt)
                audio_prompt = helpers["_build_gemini_only_system_instruction"]("ko", kind)
                self.assertIn(KOREAN_ENDING_PRESERVATION_HINT, audio_prompt)
                self.assertIn("WIOS와 WIO", audio_prompt)
        self.assertIn(KOREAN_ENDING_PRESERVATION_HINT, get_gemini_content_prompt())


if __name__ == "__main__":
    unittest.main()
