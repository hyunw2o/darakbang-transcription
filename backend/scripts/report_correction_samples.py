#!/usr/bin/env python3
"""Summarize correction samples before exporting/fine-tuning."""

from __future__ import annotations

import argparse
import difflib
import json
import re
from collections import Counter
from dataclasses import asdict
from pathlib import Path
from typing import Any

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from church_terms import SPECIAL_TERM_RULES
from export_correction_finetune_dataset import (
    DEFAULT_TABLE,
    SELF_TEST_SAMPLES,
    build_dataset,
    compact_for_compare,
    fetch_supabase_samples,
    is_smoke_test_sample,
    load_json_samples,
)


TOKEN_PATTERN = re.compile(r"[A-Za-z0-9]+|[가-힣]+|[^\s]", re.UNICODE)
EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_PATTERN = re.compile(r"\b(?:\+?\d[\d .-]{7,}\d)\b")


def normalize_domain_key(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()


def domain_term_meanings() -> dict[str, tuple[str, str]]:
    terms: dict[str, tuple[str, str]] = {}
    for rule in SPECIAL_TERM_RULES:
        canonical = str(rule.get("canonical") or "").strip()
        if not canonical:
            continue
        key = normalize_domain_key(canonical)
        if not key:
            continue
        meaning = str(rule.get("meaning") or "").strip()
        terms[key] = (canonical, meaning)
    return terms


def tokenize_for_diff(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(compact_for_compare(text))


def redact_preview(text: str, limit: int = 240) -> str:
    redacted = EMAIL_PATTERN.sub("[email]", str(text or ""))
    redacted = PHONE_PATTERN.sub("[phone]", redacted)
    redacted = re.sub(r"\s+", " ", redacted).strip()
    if len(redacted) <= limit:
        return redacted
    return redacted[: limit - 1].rstrip() + "..."


def extract_replacements(original: str, edited: str, max_tokens: int = 8) -> list[tuple[str, str]]:
    original_tokens = tokenize_for_diff(original)
    edited_tokens = tokenize_for_diff(edited)
    matcher = difflib.SequenceMatcher(a=original_tokens, b=edited_tokens, autojunk=False)
    replacements: list[tuple[str, str]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "replace":
            continue
        source_tokens = original_tokens[i1:i2]
        target_tokens = edited_tokens[j1:j2]
        if not source_tokens or not target_tokens:
            continue
        if len(source_tokens) > max_tokens or len(target_tokens) > max_tokens:
            continue
        source = " ".join(source_tokens)
        target = " ".join(target_tokens)
        if source and target and source != target:
            replacements.append((source, target))
    return replacements


def count_field(samples: list[dict[str, Any]], field: str, fallback: str = "unknown") -> dict[str, int]:
    counter = Counter(str(sample.get(field) or fallback).strip() or fallback for sample in samples)
    return dict(sorted(counter.items(), key=lambda item: (-item[1], item[0])))


def build_asr_escalation_candidates(
    replacement_counter: Counter[tuple[str, str]],
    threshold: int,
    limit: int,
) -> list[dict[str, Any]]:
    threshold = max(1, threshold)
    domain_terms = domain_term_meanings()
    candidates = []
    for (source, target), count in replacement_counter.items():
        canonical = domain_terms.get(normalize_domain_key(target))
        if not canonical or count < threshold:
            continue
        candidates.append({
            "from": source,
            "to": target,
            "canonical": canonical[0],
            "meaning": canonical[1],
            "count": count,
        })
    return sorted(candidates, key=lambda item: (-item["count"], item["canonical"], item["from"]))[:limit]


def build_next_action(
    *,
    kept: int,
    min_kept: int,
    reportable_samples: int,
    smoke_test_samples: int,
    asr_candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    kept_gap = max(0, min_kept - kept)
    if kept_gap > 0:
        stage = "collect_more_correction_samples"
        if reportable_samples == 0:
            message = "No real correction samples are available yet. Verify deployed edit flows, then collect user corrections before fine-tuning."
        elif kept == 0:
            message = "Correction samples exist, but none pass export filters. Review sample quality before fine-tuning."
        else:
            message = f"Collect at least {kept_gap} more kept correction example(s) before creating a correction fine-tune."
        return {
            "stage": stage,
            "kept_gap": kept_gap,
            "message": message,
            "ignore_smoke_samples": smoke_test_samples > 0,
        }

    if asr_candidates:
        return {
            "stage": "create_correction_finetune_then_evaluate_asr",
            "kept_gap": 0,
            "message": "Correction fine-tune data is ready. Train/evaluate the correction model before considering ASR fine-tuning candidates.",
            "ignore_smoke_samples": smoke_test_samples > 0,
        }

    return {
        "stage": "create_correction_finetune",
        "kept_gap": 0,
        "message": "Correction fine-tune data is ready. Export the dataset and create the correction fine-tuning job.",
        "ignore_smoke_samples": smoke_test_samples > 0,
    }


def build_recommended_commands(next_action: dict[str, Any], min_kept: int) -> list[str]:
    stage = str(next_action.get("stage") or "")
    if stage == "collect_more_correction_samples":
        return [
            (
                "MALLOG24_AUTH_TOKEN=... python backend/scripts/run_post_deploy_checks.py "
                "--api-url https://api.mallog24.com "
                "--require-saved-record-create-capture-smoke "
                "--with-sample-report"
            ),
            (
                "python backend/scripts/report_correction_samples.py "
                "--from-supabase "
                f"--min-kept {min_kept} "
                "--asr-threshold 20"
            ),
        ]
    if stage in {"create_correction_finetune", "create_correction_finetune_then_evaluate_asr"}:
        return [
            (
                "python backend/scripts/export_correction_finetune_dataset.py "
                "--from-supabase "
                "--output backend/finetune_datasets/correction_train.jsonl "
                "--validation-output backend/finetune_datasets/correction_validation.jsonl "
                "--stats-output backend/finetune_datasets/correction_export_stats.json "
                f"--min-kept {min_kept}"
            ),
            (
                "python backend/scripts/manage_correction_finetune.py create "
                "--training-file backend/finetune_datasets/correction_train.jsonl "
                "--validation-file backend/finetune_datasets/correction_validation.jsonl "
                "--dry-run "
                f"--min-examples {min_kept}"
            ),
            (
                "python backend/scripts/manage_correction_finetune.py create "
                "--training-file backend/finetune_datasets/correction_train.jsonl "
                "--validation-file backend/finetune_datasets/correction_validation.jsonl "
                "--output backend/finetune_datasets/correction_finetune_job.json "
                f"--min-examples {min_kept}"
            ),
        ]
    return []


def build_report(samples: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    _examples, export_stats = build_dataset(samples, args)
    smoke_test_samples = [sample for sample in samples if is_smoke_test_sample(sample)]
    report_samples = [sample for sample in samples if not is_smoke_test_sample(sample)]
    replacement_counter: Counter[tuple[str, str]] = Counter()
    preview_examples = []

    for sample in report_samples:
        original = str(sample.get("original_text") or "")
        edited = str(sample.get("edited_text") or "")
        if compact_for_compare(original) == compact_for_compare(edited):
            continue
        replacement_counter.update(extract_replacements(original, edited))
        if args.include_examples and len(preview_examples) < args.max_examples:
            preview_examples.append({
                "id": sample.get("id"),
                "language": sample.get("language") or "unknown",
                "category": sample.get("category") or "unknown",
                "source_type": sample.get("source_type") or "unknown",
                "original_preview": redact_preview(original),
                "edited_preview": redact_preview(edited),
            })

    top_replacements = [
        {"from": source, "to": target, "count": count}
        for (source, target), count in replacement_counter.most_common(args.max_replacements)
    ]
    asr_candidates = build_asr_escalation_candidates(
        replacement_counter,
        args.asr_threshold,
        args.max_asr_candidates,
    )
    kept = export_stats.kept
    next_action = build_next_action(
        kept=kept,
        min_kept=args.min_kept,
        reportable_samples=len(report_samples),
        smoke_test_samples=len(smoke_test_samples),
        asr_candidates=asr_candidates,
    )
    return {
        "total_samples": len(samples),
        "reportable_samples": len(report_samples),
        "smoke_test_samples": len(smoke_test_samples),
        "min_kept": args.min_kept,
        "kept_examples": kept,
        "kept_gap": next_action["kept_gap"],
        "ready_to_train": kept >= args.min_kept,
        "asr_escalation_threshold": args.asr_threshold,
        "ready_for_asr_fine_tune": bool(asr_candidates),
        "next_action": next_action,
        "recommended_commands": build_recommended_commands(next_action, args.min_kept),
        "export_stats": asdict(export_stats),
        "by_language": count_field(report_samples, "language"),
        "by_category": count_field(report_samples, "category"),
        "by_source_type": count_field(report_samples, "source_type"),
        "top_replacements": top_replacements,
        "asr_escalation_candidates": asr_candidates,
        "examples": preview_examples,
    }


def write_json(path: str, payload: dict[str, Any]) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--from-supabase", action="store_true", help="Read samples from Supabase.")
    source_group.add_argument("--input-json", help="Read samples from a local JSON file or '-' for stdin.")
    source_group.add_argument("--self-test", action="store_true", help="Run against built-in sample rows.")
    parser.add_argument("--output", help="Optional JSON report output path.")
    parser.add_argument("--table", default=DEFAULT_TABLE, help=f"Supabase table name. Default: {DEFAULT_TABLE}.")
    parser.add_argument("--since", help="Supabase created_at lower bound, e.g. 2026-05-01T00:00:00+09:00.")
    parser.add_argument("--language", help="Optional Supabase language filter.")
    parser.add_argument("--category", help="Optional Supabase category filter.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum rows to fetch from Supabase. 0 means no explicit limit.")
    parser.add_argument("--batch-size", type=int, default=500, help="Supabase fetch batch size.")
    parser.add_argument("--min-chars", type=int, default=20, help="Match dataset export minimum compacted chars.")
    parser.add_argument("--max-chars", type=int, default=120000, help="Match dataset export maximum text chars.")
    parser.add_argument("--max-length-ratio", type=float, default=5.0, help="Match dataset export length-ratio filter.")
    parser.add_argument("--system-prompt", default="", help="Compatibility with export dataset filtering.")
    parser.add_argument("--min-kept", type=int, default=50, help="Minimum kept examples for ready_to_train.")
    parser.add_argument("--max-replacements", type=int, default=20, help="Maximum replacement patterns to report.")
    parser.add_argument("--asr-threshold", type=int, default=20, help="Repeated domain-term replacements needed before ASR fine-tuning is considered.")
    parser.add_argument("--max-asr-candidates", type=int, default=10, help="Maximum ASR escalation candidates to report.")
    parser.add_argument("--include-examples", action="store_true", help="Include redacted short text previews.")
    parser.add_argument("--max-examples", type=int, default=5, help="Maximum redacted examples when --include-examples is set.")
    parser.add_argument("--fail-unready", action="store_true", help="Exit non-zero when kept examples are below --min-kept.")
    return parser.parse_args()


def load_samples(args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.self_test:
        return SELF_TEST_SAMPLES
    if args.input_json:
        return load_json_samples(args.input_json)
    return fetch_supabase_samples(args)


def main() -> int:
    args = parse_args()
    samples = load_samples(args)
    report = build_report(samples, args)
    if args.self_test:
        assert report["export_stats"]["kept"] == 1
        assert report["kept_examples"] == 1
        expected_ready_to_train = report["kept_examples"] >= args.min_kept
        assert report["ready_to_train"] is expected_ready_to_train
        assert report["kept_gap"] == max(0, args.min_kept - 1)
        if expected_ready_to_train:
            assert report["next_action"]["stage"] == "create_correction_finetune"
            assert any("export_correction_finetune_dataset.py" in command for command in report["recommended_commands"])
        else:
            assert report["next_action"]["stage"] == "collect_more_correction_samples"
            assert any("run_post_deploy_checks.py" in command for command in report["recommended_commands"])
        assert any(item["from"] == "RBS" and item["to"] == "RVS" for item in report["top_replacements"])
        if args.asr_threshold > 1:
            assert report["ready_for_asr_fine_tune"] is False
        else:
            assert any(item["canonical"] == "RVS" for item in report["asr_escalation_candidates"])
        low_threshold_candidates = build_asr_escalation_candidates(
            Counter({("RBS", "RVS"): 1}),
            threshold=1,
            limit=5,
        )
        assert low_threshold_candidates[0]["canonical"] == "RVS"
        smoke_report = build_report(
            [
                *SELF_TEST_SAMPLES,
                {
                    "id": 3,
                    "category": "sermon",
                    "language": "ko",
                    "original_text": "RBS smoke sample",
                    "edited_text": "RVS smoke sample",
                    "metadata": {"smoke_test": True},
                },
            ],
            args,
        )
        assert smoke_report["smoke_test_samples"] == 1
        assert smoke_report["export_stats"]["skipped_smoke_test"] == 1
        rbs_items = [
            item for item in smoke_report["top_replacements"]
            if item["from"] == "RBS" and item["to"] == "RVS"
        ]
        assert rbs_items and rbs_items[0]["count"] == 1
    if args.output:
        write_json(args.output, report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    if args.fail_unready and not report["ready_to_train"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
