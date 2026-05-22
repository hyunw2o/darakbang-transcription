#!/usr/bin/env python3
"""Export mallog24 correction samples as chat fine-tuning JSONL."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


DEFAULT_TABLE = "user_correction_samples"
DEFAULT_SELECT = "id,task_id,source_type,category,language,original_text,edited_text,created_at"
DEFAULT_SYSTEM_PROMPT = (
    "You are mallog24's transcript correction model. Correct speech-to-text output "
    "without summarizing or adding new claims. Preserve meaning, speaker labels, paragraph "
    "structure, and useful formatting. Apply domain-specific terms only when context supports "
    "them. Return only the corrected transcript."
)

SELF_TEST_SAMPLES = [
    {
        "id": 1,
        "task_id": "self-test-rvs",
        "source_type": "record_draft",
        "category": "sermon",
        "language": "ko",
        "original_text": "오늘은 RBS 비전 스쿨 흐름과 R U T C 메시지를 정리합니다.",
        "edited_text": "오늘은 RVS 비전 스쿨 흐름과 RUTC 메시지를 정리합니다.",
        "created_at": "2026-05-22T00:00:00+09:00",
    },
    {
        "id": 2,
        "category": "sermon",
        "language": "ko",
        "original_text": "변경 없는 샘플입니다.",
        "edited_text": "변경 없는 샘플입니다.",
    },
]


@dataclass
class ExportStats:
    total: int = 0
    kept: int = 0
    training_kept: int = 0
    validation_kept: int = 0
    skipped_smoke_test: int = 0
    skipped_unchanged: int = 0
    skipped_short: int = 0
    skipped_too_long: int = 0
    skipped_ratio: int = 0
    skipped_duplicate: int = 0
    skipped_invalid: int = 0


def normalize_text(value: Any) -> str:
    return str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def compact_for_compare(value: str) -> str:
    return " ".join(normalize_text(value).split())


def normalize_metadata(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def is_smoke_test_sample(sample: dict[str, Any]) -> bool:
    metadata = normalize_metadata(sample.get("metadata"))
    return bool(metadata.get("smoke_test") or metadata.get("source") == "smoke_correction_sample_api")


def load_json_samples(path: str) -> list[dict[str, Any]]:
    raw_text = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    payload = json.loads(raw_text)
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("samples", "data", "records"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    raise ValueError("Input JSON must be a list or an object with samples/data/records.")


def fetch_supabase_samples(args: argparse.Namespace) -> list[dict[str, Any]]:
    try:
        from dotenv import load_dotenv
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError("Install backend requirements before using --from-supabase.") from exc

    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_KEY", "").strip()
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required for --from-supabase.")

    client = create_client(supabase_url, supabase_key)
    samples: list[dict[str, Any]] = []
    offset = 0
    batch_size = max(1, args.batch_size)
    target_limit = max(0, args.limit)

    while True:
        end_index = offset + batch_size - 1
        if target_limit:
            remaining = target_limit - len(samples)
            if remaining <= 0:
                break
            end_index = offset + min(batch_size, remaining) - 1

        query = (
            client.table(args.table)
            .select(DEFAULT_SELECT)
            .order("created_at", desc=False)
            .range(offset, end_index)
        )
        if args.since:
            query = query.gte("created_at", args.since)
        if args.language:
            query = query.eq("language", args.language)
        if args.category:
            query = query.eq("category", args.category)

        try:
            response = query.execute()
        except Exception as exc:
            error_text = str(exc).lower()
            if (
                args.table in error_text
                or "schema cache" in error_text
                or "could not find the table" in error_text
                or "pgrst205" in error_text
            ):
                raise RuntimeError(
                    f"Supabase table '{args.table}' is not available. "
                    "Run backend/sql/user_correction_samples.sql in Supabase SQL Editor, "
                    "then execute NOTIFY pgrst, 'reload schema'; before exporting."
                ) from exc
            raise
        rows = response.data or []
        if not rows:
            break
        samples.extend(row for row in rows if isinstance(row, dict))
        if len(rows) < (end_index - offset + 1):
            break
        offset = end_index + 1

    return samples


def build_chat_example(sample: dict[str, Any], system_prompt: str) -> dict[str, Any] | None:
    original = normalize_text(sample.get("original_text"))
    edited = normalize_text(sample.get("edited_text"))
    if not original or not edited:
        return None

    language = normalize_text(sample.get("language")) or "ko"
    category = normalize_text(sample.get("category")) or "uncategorized"
    source_type = normalize_text(sample.get("source_type")) or "correction_sample"

    user_content = (
        f"Language: {language}\n"
        f"Category: {category}\n"
        f"Source type: {source_type}\n\n"
        "[Original transcript]\n"
        f"{original}"
    )
    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": edited},
        ]
    }


def build_dataset(samples: list[dict[str, Any]], args: argparse.Namespace) -> tuple[list[dict[str, Any]], ExportStats]:
    stats = ExportStats(total=len(samples))
    examples: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    system_prompt = args.system_prompt or DEFAULT_SYSTEM_PROMPT

    for sample in samples:
        try:
            if is_smoke_test_sample(sample):
                stats.skipped_smoke_test += 1
                continue
            original = normalize_text(sample.get("original_text"))
            edited = normalize_text(sample.get("edited_text"))
            original_compact = compact_for_compare(original)
            edited_compact = compact_for_compare(edited)
            if not original_compact or not edited_compact:
                stats.skipped_invalid += 1
                continue
            if original_compact == edited_compact:
                stats.skipped_unchanged += 1
                continue
            if min(len(original_compact), len(edited_compact)) < args.min_chars:
                stats.skipped_short += 1
                continue
            if max(len(original), len(edited)) > args.max_chars:
                stats.skipped_too_long += 1
                continue
            ratio = max(len(original_compact), len(edited_compact)) / max(1, min(len(original_compact), len(edited_compact)))
            if ratio > args.max_length_ratio:
                stats.skipped_ratio += 1
                continue
            dedupe_key = (original_compact, edited_compact)
            if dedupe_key in seen:
                stats.skipped_duplicate += 1
                continue
            seen.add(dedupe_key)
            example = build_chat_example(sample, system_prompt)
            if not example:
                stats.skipped_invalid += 1
                continue
            examples.append(example)
        except Exception:
            stats.skipped_invalid += 1

    stats.kept = len(examples)
    stats.training_kept = stats.kept
    return examples, stats


def write_jsonl(examples: list[dict[str, Any]], output_path: str) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for example in examples:
            handle.write(json.dumps(example, ensure_ascii=False, separators=(",", ":")) + "\n")


def write_stats(stats: ExportStats, stats_path: str) -> None:
    path = Path(stats_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(stats), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_validation_count(total_examples: int, args: argparse.Namespace) -> int:
    if not args.validation_output:
        return 0
    min_training = max(1, args.min_training_after_split)
    if total_examples <= min_training:
        raise ValueError(
            f"Need more than {min_training} kept example(s) to write a validation split."
        )
    if args.validation_count > 0:
        count = args.validation_count
    else:
        ratio = max(0.0, min(0.95, args.validation_ratio))
        count = round(total_examples * ratio)
        if ratio > 0 and count == 0:
            count = 1
    if count <= 0:
        return 0
    return min(count, total_examples - min_training)


def split_train_validation(
    examples: list[dict[str, Any]],
    args: argparse.Namespace,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    validation_count = resolve_validation_count(len(examples), args)
    if validation_count <= 0:
        return examples, []
    return examples[:-validation_count], examples[-validation_count:]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--from-supabase", action="store_true", help="Read samples from Supabase.")
    source_group.add_argument("--input-json", help="Read samples from a local JSON file or '-' for stdin.")
    source_group.add_argument("--self-test", action="store_true", help="Run against built-in sample rows.")
    parser.add_argument("--output", help="Output JSONL path. Required unless --dry-run is used.")
    parser.add_argument("--validation-output", help="Optional validation JSONL path. Uses the newest kept examples after filtering.")
    parser.add_argument("--stats-output", help="Optional JSON stats output path.")
    parser.add_argument("--dry-run", action="store_true", help="Build and validate examples without writing JSONL.")
    parser.add_argument("--table", default=DEFAULT_TABLE, help=f"Supabase table name. Default: {DEFAULT_TABLE}.")
    parser.add_argument("--since", help="Supabase created_at lower bound, e.g. 2026-05-01T00:00:00+09:00.")
    parser.add_argument("--language", help="Optional Supabase language filter.")
    parser.add_argument("--category", help="Optional Supabase category filter.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum rows to fetch from Supabase. 0 means no explicit limit.")
    parser.add_argument("--batch-size", type=int, default=500, help="Supabase fetch batch size.")
    parser.add_argument("--min-chars", type=int, default=20, help="Skip examples shorter than this after whitespace compaction.")
    parser.add_argument("--max-chars", type=int, default=120000, help="Skip examples with either side longer than this.")
    parser.add_argument("--max-length-ratio", type=float, default=5.0, help="Skip pairs where one side is much longer.")
    parser.add_argument("--min-kept", type=int, default=0, help="Fail if fewer than this many examples remain after filtering.")
    parser.add_argument("--validation-ratio", type=float, default=0.1, help="Validation split ratio when --validation-output is set.")
    parser.add_argument("--validation-count", type=int, default=0, help="Explicit validation example count. Overrides --validation-ratio when > 0.")
    parser.add_argument("--min-training-after-split", type=int, default=1, help="Minimum training rows to keep when writing validation split.")
    parser.add_argument("--system-prompt", default=DEFAULT_SYSTEM_PROMPT, help="System prompt to embed in each JSONL row.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.dry_run and not args.output:
        raise SystemExit("--output is required unless --dry-run is set.")

    try:
        if args.self_test:
            samples = SELF_TEST_SAMPLES
        elif args.input_json:
            samples = load_json_samples(args.input_json)
        else:
            samples = fetch_supabase_samples(args)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    examples, stats = build_dataset(samples, args)
    if args.self_test and stats.kept != 1:
        print(f"Self-test failed: expected 1 kept example, got {stats.kept}", file=sys.stderr)
        return 1
    if args.self_test:
        smoke_samples = [
            *SELF_TEST_SAMPLES,
            {
                "id": 3,
                "category": "sermon",
                "language": "ko",
                "original_text": "RBS smoke sample",
                "edited_text": "RVS smoke sample",
                "metadata": {"smoke_test": True},
            },
        ]
        _smoke_examples, smoke_stats = build_dataset(smoke_samples, args)
        if smoke_stats.skipped_smoke_test != 1 or smoke_stats.kept != 1:
            print(
                "Self-test failed: smoke samples must be skipped before export.",
                file=sys.stderr,
            )
            return 1
        split_args = argparse.Namespace(
            validation_output="validation.jsonl",
            validation_ratio=0.34,
            validation_count=0,
            min_training_after_split=1,
        )
        train_split, validation_split = split_train_validation([{"id": 1}, {"id": 2}, {"id": 3}], split_args)
        if len(train_split) != 2 or len(validation_split) != 1:
            print("Self-test failed: validation ratio split is incorrect.", file=sys.stderr)
            return 1
        split_args.validation_count = 2
        train_split, validation_split = split_train_validation([{"id": 1}, {"id": 2}, {"id": 3}], split_args)
        if len(train_split) != 1 or len(validation_split) != 2:
            print("Self-test failed: validation count split is incorrect.", file=sys.stderr)
            return 1
    if args.min_kept and stats.kept < args.min_kept:
        print(json.dumps(asdict(stats), ensure_ascii=False, sort_keys=True))
        print(
            f"Dataset kept {stats.kept} examples after filtering, but --min-kept is {args.min_kept}.",
            file=sys.stderr,
        )
        return 1
    try:
        training_examples, validation_examples = split_train_validation(examples, args)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    stats.training_kept = len(training_examples)
    stats.validation_kept = len(validation_examples)

    if not args.dry_run and args.output:
        write_jsonl(training_examples, args.output)
    if not args.dry_run and args.validation_output:
        write_jsonl(validation_examples, args.validation_output)
    if args.stats_output:
        write_stats(stats, args.stats_output)

    print(json.dumps(asdict(stats), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
