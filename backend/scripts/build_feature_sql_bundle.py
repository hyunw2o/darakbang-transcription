#!/usr/bin/env python3
"""Build an idempotent Supabase SQL bundle for mallog24 feature tables."""

from __future__ import annotations

import argparse
from pathlib import Path


DEFAULT_SQL_FILES = [
    "backend/sql/user_glossary_terms.sql",
    "backend/sql/user_correction_samples.sql",
]

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
    parser.add_argument("--no-notify", action="store_true", help="Do not append PostgREST schema reload NOTIFY.")
    parser.add_argument("--print", action="store_true", help="Print bundle to stdout instead of writing a file.")
    parser.add_argument("--self-test", action="store_true", help="Run a deterministic local bundle test.")
    return parser.parse_args()


def run_self_test() -> int:
    bundle = build_bundle(DEFAULT_SQL_FILES, include_notify=True)
    assert "create table if not exists public.user_glossary_terms" in bundle
    assert "create table if not exists public.user_correction_samples" in bundle
    assert NOTIFY_STATEMENT in bundle
    print("feature-sql-bundle-self-test-ok")
    return 0


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()

    bundle = build_bundle(args.sql_files or DEFAULT_SQL_FILES, include_notify=not args.no_notify)
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
