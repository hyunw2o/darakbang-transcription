#!/usr/bin/env python3
"""Check mallog24 glossary/correction/fine-tuning readiness."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from export_correction_finetune_dataset import DEFAULT_SELECT, DEFAULT_SYSTEM_PROMPT, build_dataset


REQUIRED_TABLES = {
    "transcription_usage_metrics": "backend/sql/transcription_usage_metrics.sql",
    "user_glossary_terms": "backend/sql/user_glossary_terms.sql",
    "user_correction_samples": "backend/sql/user_correction_samples.sql",
    "training_audio_assets": "backend/sql/training_data_assets.sql",
    "training_text_samples": "backend/sql/training_data_assets.sql",
}


@dataclass
class TableReadiness:
    table: str
    ok: bool
    count: int | None = None
    sql_file: str | None = None
    error: str = ""


@dataclass
class ApiReadiness:
    url: str
    ok: bool
    status_code: int | None = None
    error: str = ""


@dataclass
class FineTuneReadiness:
    enabled: bool
    model_configured: bool
    max_chars: int
    sample_count: int | None
    min_examples: int
    enough_samples: bool
    kept_examples: int | None
    enough_kept_examples: bool
    dataset_stats: dict[str, int] | None
    ready_to_train: bool
    ready_to_run: bool


def load_dotenv_if_available() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")


def normalize_api_url(value: str) -> str:
    base_url = (value or "").strip().rstrip("/")
    if not base_url:
        return ""
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return base_url


def check_api_health(api_url: str, timeout: int) -> ApiReadiness | None:
    base_url = normalize_api_url(api_url)
    if not base_url:
        return None
    health_url = f"{base_url}/health"
    try:
        with urllib.request.urlopen(health_url, timeout=timeout) as response:
            status_code = int(response.status)
            payload = response.read(2048).decode("utf-8", errors="replace")
            ok = 200 <= status_code < 300 and "healthy" in payload.lower()
            return ApiReadiness(url=health_url, ok=ok, status_code=status_code)
    except urllib.error.HTTPError as exc:
        return ApiReadiness(url=health_url, ok=False, status_code=exc.code, error=str(exc))
    except Exception as exc:
        return ApiReadiness(url=health_url, ok=False, error=str(exc))


def load_supabase_client():
    load_dotenv_if_available()
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_KEY", "").strip()
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required.")
    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError("Install backend requirements before checking Supabase readiness.") from exc
    return create_client(supabase_url, supabase_key)


def check_table(client: Any, table_name: str) -> TableReadiness:
    try:
        response = client.table(table_name).select("id", count="exact").limit(1).execute()
        count = getattr(response, "count", None)
        return TableReadiness(
            table=table_name,
            ok=True,
            count=count if isinstance(count, int) else None,
            sql_file=REQUIRED_TABLES.get(table_name),
        )
    except Exception as exc:
        error_text = str(exc)
        return TableReadiness(
            table=table_name,
            ok=False,
            sql_file=REQUIRED_TABLES.get(table_name),
            error=error_text,
        )


def fetch_correction_samples(client: Any, batch_size: int = 500) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    offset = 0
    batch_size = max(1, batch_size)

    while True:
        end_index = offset + batch_size - 1
        response = (
            client.table("user_correction_samples")
            .select(DEFAULT_SELECT)
            .order("created_at", desc=False)
            .range(offset, end_index)
            .execute()
        )
        rows = response.data or []
        samples.extend(row for row in rows if isinstance(row, dict))
        if len(rows) < batch_size:
            break
        offset = end_index + 1
    return samples


def build_export_stats(client: Any, batch_size: int = 500) -> dict[str, int]:
    parser_args = argparse.Namespace(
        min_chars=20,
        max_chars=120000,
        max_length_ratio=5.0,
        system_prompt=DEFAULT_SYSTEM_PROMPT,
    )
    _examples, stats = build_dataset(fetch_correction_samples(client, batch_size=batch_size), parser_args)
    return asdict(stats)


def empty_export_stats() -> dict[str, int]:
    return {
        "total": 0,
        "kept": 0,
        "skipped_smoke_test": 0,
        "skipped_unchanged": 0,
        "skipped_short": 0,
        "skipped_too_long": 0,
        "skipped_ratio": 0,
        "skipped_duplicate": 0,
        "skipped_invalid": 0,
    }


def build_fine_tune_readiness(
    correction_sample_count: int | None,
    min_examples: int,
    dataset_stats: dict[str, int] | None = None,
) -> FineTuneReadiness:
    enabled = os.getenv("ENABLE_FINE_TUNED_CORRECTION", "false").strip().lower() == "true"
    model_configured = bool((os.getenv("CORRECTION_FINE_TUNED_MODEL") or "").strip())
    try:
        max_chars = int(os.getenv("FINE_TUNED_CORRECTION_MAX_CHARS", "6000"))
    except ValueError:
        max_chars = 0
    if dataset_stats is None and correction_sample_count == 0:
        dataset_stats = empty_export_stats()
    enough_samples = correction_sample_count is not None and correction_sample_count >= min_examples
    kept_examples = dataset_stats.get("kept") if dataset_stats else None
    enough_kept_examples = kept_examples is not None and kept_examples >= min_examples
    return FineTuneReadiness(
        enabled=enabled,
        model_configured=model_configured,
        max_chars=max_chars,
        sample_count=correction_sample_count,
        min_examples=min_examples,
        enough_samples=enough_samples,
        kept_examples=kept_examples,
        enough_kept_examples=enough_kept_examples,
        dataset_stats=dataset_stats,
        ready_to_train=enough_kept_examples,
        ready_to_run=enabled and model_configured and max_chars >= 1000,
    )


def summarize_result(tables: list[TableReadiness], api: ApiReadiness | None, fine_tune: FineTuneReadiness) -> dict[str, Any]:
    missing_sql = [
        {"table": item.table, "sql_file": item.sql_file, "error": item.error}
        for item in tables
        if not item.ok
    ]
    correction_count = next((item.count for item in tables if item.table == "user_correction_samples"), None)
    return {
        "ok": not missing_sql and (api.ok if api else True),
        "api": asdict(api) if api else None,
        "tables": [asdict(item) for item in tables],
        "missing_sql": missing_sql,
        "correction_sample_count": correction_count,
        "fine_tuned_correction": asdict(fine_tune),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default="", help="Optional backend API base URL for /health check.")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP timeout seconds.")
    parser.add_argument(
        "--min-finetune-examples",
        type=int,
        default=50,
        help="Minimum correction samples before recommending a fine-tuning dataset export.",
    )
    parser.add_argument(
        "--skip-finetune-export-stats",
        action="store_true",
        help="Skip export-style kept sample counting.",
    )
    parser.add_argument("--export-batch-size", type=int, default=500, help="Supabase batch size for export-style stats.")
    parser.add_argument("--warn-only", action="store_true", help="Always exit 0 after printing readiness JSON.")
    parser.add_argument("--self-test", action="store_true", help="Run deterministic local summary test without network.")
    return parser.parse_args()


def run_self_test() -> int:
    tables = [
        TableReadiness(table="transcription_usage_metrics", ok=True, count=2, sql_file=REQUIRED_TABLES["transcription_usage_metrics"]),
        TableReadiness(table="user_glossary_terms", ok=True, count=3, sql_file=REQUIRED_TABLES["user_glossary_terms"]),
        TableReadiness(table="user_correction_samples", ok=False, sql_file=REQUIRED_TABLES["user_correction_samples"], error="PGRST205"),
        TableReadiness(table="training_audio_assets", ok=True, count=0, sql_file=REQUIRED_TABLES["training_audio_assets"]),
        TableReadiness(table="training_text_samples", ok=True, count=0, sql_file=REQUIRED_TABLES["training_text_samples"]),
    ]
    payload = summarize_result(
        tables,
        ApiReadiness(url="https://api.example.test/health", ok=True, status_code=200),
        build_fine_tune_readiness(correction_sample_count=None, min_examples=50),
    )
    assert payload["ok"] is False
    assert payload["missing_sql"][0]["table"] == "user_correction_samples"
    assert payload["fine_tuned_correction"]["ready_to_train"] is False
    assert payload["fine_tuned_correction"]["kept_examples"] is None
    empty_readiness = build_fine_tune_readiness(correction_sample_count=0, min_examples=50)
    assert empty_readiness.kept_examples == 0
    assert empty_readiness.dataset_stats and empty_readiness.dataset_stats["kept"] == 0
    not_enough_kept = build_fine_tune_readiness(
        correction_sample_count=100,
        min_examples=50,
        dataset_stats={"total": 100, "kept": 49},
    )
    assert not_enough_kept.enough_samples is True
    assert not_enough_kept.ready_to_train is False
    enough_kept = build_fine_tune_readiness(
        correction_sample_count=100,
        min_examples=50,
        dataset_stats={"total": 100, "kept": 50},
    )
    assert enough_kept.ready_to_train is True
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()

    load_dotenv_if_available()
    try:
        client = load_supabase_client()
        tables = [check_table(client, table_name) for table_name in REQUIRED_TABLES]
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 0 if args.warn_only else 1

    api = check_api_health(args.api_url, args.timeout)
    correction_count = next((item.count for item in tables if item.table == "user_correction_samples"), None)
    dataset_stats = None
    if not args.skip_finetune_export_stats and correction_count:
        dataset_stats = build_export_stats(client, batch_size=args.export_batch_size)
    payload = summarize_result(
        tables,
        api,
        build_fine_tune_readiness(correction_count, args.min_finetune_examples, dataset_stats),
    )
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    if args.warn_only:
        return 0
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
