#!/usr/bin/env python3
"""Build an idempotent Supabase SQL bundle for mallog24 feature tables."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


TABLE_SQL_FILES = {
    "user_glossary_terms": "backend/sql/user_glossary_terms.sql",
    "user_correction_samples": "backend/sql/user_correction_samples.sql",
}
DEFAULT_SQL_FILES = list(TABLE_SQL_FILES.values())

NOTIFY_STATEMENT = "NOTIFY pgrst, 'reload schema';"


def read_sql_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"SQL file not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def build_bundle(sql_files: list[str], include_notify: bool = True) -> str:
    chunks = [
        "-- mallog24 feature setup bundle",
        "-- Generated from checked-in SQL files. Safe to re-run in Supabase SQL Editor.",
    ]
    repo_root = Path(__file__).resolve().parents[2]
    for sql_file in sql_files:
        sql_path = repo_root / sql_file
        chunks.append(f"\n-- ===== {sql_file} =====")
        chunks.append(read_sql_file(sql_path))
    if include_notify:
        chunks.append("\n-- ===== Reload PostgREST schema cache =====")
        chunks.append(NOTIFY_STATEMENT)
    return "\n\n".join(chunks).rstrip() + "\n"


def load_dotenv_if_available() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")


def load_supabase_client():
    load_dotenv_if_available()
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_KEY", "").strip()
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required for --missing-only.")
    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError("Install backend requirements before using --missing-only.") from exc
    return create_client(supabase_url, supabase_key)


def table_exists(client, table_name: str) -> bool:
    try:
        client.table(table_name).select("id", count="exact").limit(1).execute()
        return True
    except Exception:
        return False


def resolve_missing_sql_files() -> list[str]:
    client = load_supabase_client()
    return [
        sql_file
        for table_name, sql_file in TABLE_SQL_FILES.items()
        if not table_exists(client, table_name)
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default="/private/tmp/mallog24_feature_setup.sql",
        help="Output SQL bundle path.",
    )
    parser.add_argument(
        "--sql-file",
        action="append",
        dest="sql_files",
        help="SQL file to include, relative to repo root. Can be passed more than once.",
    )
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Check Supabase and include only currently missing feature SQL files.",
    )
    parser.add_argument("--no-notify", action="store_true", help="Do not append PostgREST schema reload NOTIFY.")
    parser.add_argument("--print", action="store_true", help="Print bundle to stdout instead of writing a file.")
    parser.add_argument("--self-test", action="store_true", help="Run a deterministic local bundle test.")
    return parser.parse_args()


def run_self_test() -> int:
    bundle = build_bundle(DEFAULT_SQL_FILES, include_notify=True)
    assert "create table if not exists public.user_glossary_terms" in bundle
    assert "create table if not exists public.user_correction_samples" in bundle
    assert NOTIFY_STATEMENT in bundle
    assert TABLE_SQL_FILES["user_glossary_terms"] in DEFAULT_SQL_FILES
    print("feature-sql-bundle-self-test-ok")
    return 0


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()

    try:
        sql_files = resolve_missing_sql_files() if args.missing_only else (args.sql_files or DEFAULT_SQL_FILES)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.missing_only and not sql_files:
        print("All feature SQL tables are already available; no SQL bundle needed.")
        return 0

    bundle = build_bundle(sql_files, include_notify=not args.no_notify)
    if args.print:
        print(bundle, end="")
        return 0

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(bundle, encoding="utf-8")
    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
