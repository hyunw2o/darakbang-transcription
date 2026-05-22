#!/usr/bin/env python3
"""Create and inspect OpenAI fine-tuning jobs for mallog24 correction JSONL."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


DEFAULT_BASE_MODEL = "gpt-4o-mini"
DEFAULT_SUFFIX = "mallog24-correction"


@dataclass
class DatasetStats:
    rows: int = 0
    invalid_rows: int = 0
    min_assistant_chars: int = 0
    max_assistant_chars: int = 0
    total_assistant_chars: int = 0


def load_dotenv_if_available() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")


def load_openai_client():
    load_dotenv_if_available()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required.")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("Install backend requirements before using this script.") from exc
    return OpenAI(api_key=api_key)


def validate_chat_row(row: Any) -> tuple[bool, str, int]:
    if not isinstance(row, dict):
        return False, "row is not an object", 0
    messages = row.get("messages")
    if not isinstance(messages, list) or len(messages) < 2:
        return False, "messages must be a list with at least two items", 0

    has_user = False
    assistant_chars = 0
    for message in messages:
        if not isinstance(message, dict):
            return False, "message is not an object", 0
        role = message.get("role")
        content = message.get("content")
        if role not in {"system", "user", "assistant"}:
            return False, f"invalid role: {role}", 0
        if not isinstance(content, str) or not content.strip():
            return False, "message content is empty", 0
        if role == "user":
            has_user = True
        if role == "assistant":
            assistant_chars += len(content.strip())

    if not has_user:
        return False, "missing user message", 0
    if assistant_chars <= 0:
        return False, "missing assistant content", 0
    return True, "", assistant_chars


def validate_jsonl(path: str) -> DatasetStats:
    stats = DatasetStats()
    assistant_lengths: list[int] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            raw_line = line.strip()
            if not raw_line:
                continue
            stats.rows += 1
            try:
                row = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                stats.invalid_rows += 1
                print(f"Invalid JSONL row {line_number}: {exc}", file=sys.stderr)
                continue
            valid, reason, assistant_chars = validate_chat_row(row)
            if not valid:
                stats.invalid_rows += 1
                print(f"Invalid JSONL row {line_number}: {reason}", file=sys.stderr)
                continue
            assistant_lengths.append(assistant_chars)

    if assistant_lengths:
        stats.min_assistant_chars = min(assistant_lengths)
        stats.max_assistant_chars = max(assistant_lengths)
        stats.total_assistant_chars = sum(assistant_lengths)
    return stats


def object_to_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if isinstance(value, dict):
        return value
    return json.loads(json.dumps(value, default=str))


def write_json(path: str, payload: dict[str, Any]) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def create_job(args: argparse.Namespace) -> int:
    stats = validate_jsonl(args.training_file)
    if stats.invalid_rows:
        print(json.dumps(asdict(stats), ensure_ascii=False, sort_keys=True), file=sys.stderr)
        return 1
    if stats.rows < args.min_examples:
        print(
            f"Dataset has {stats.rows} valid rows, but --min-examples is {args.min_examples}.",
            file=sys.stderr,
        )
        return 1

    base_model = args.model or os.getenv("CORRECTION_FINE_TUNE_BASE_MODEL", DEFAULT_BASE_MODEL)
    suffix = args.suffix or os.getenv("CORRECTION_FINE_TUNE_SUFFIX", DEFAULT_SUFFIX)

    if args.dry_run:
        print(json.dumps({
            "dry_run": True,
            "model": base_model,
            "suffix": suffix,
            "training_file": args.training_file,
            "stats": asdict(stats),
        }, ensure_ascii=False, sort_keys=True))
        return 0

    client = load_openai_client()
    with Path(args.training_file).open("rb") as training_handle:
        uploaded_file = client.files.create(file=training_handle, purpose="fine-tune")
    uploaded_file_payload = object_to_dict(uploaded_file)
    training_file_id = uploaded_file_payload.get("id")
    if not training_file_id:
        raise RuntimeError("OpenAI did not return a training file id.")

    job = client.fine_tuning.jobs.create(
        model=base_model,
        training_file=training_file_id,
        suffix=suffix,
        metadata={
            "app": "mallog24",
            "dataset_rows": str(stats.rows),
            "source": "user_correction_samples",
        },
    )
    job_payload = object_to_dict(job)
    result = {
        "training_file": uploaded_file_payload,
        "fine_tuning_job": job_payload,
        "stats": asdict(stats),
    }
    if args.output:
        write_json(args.output, result)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


def show_status(args: argparse.Namespace) -> int:
    client = load_openai_client()
    job = object_to_dict(client.fine_tuning.jobs.retrieve(args.job_id))
    if args.output:
        write_json(args.output, job)
    print(json.dumps(job, ensure_ascii=False, sort_keys=True))
    return 0


def show_events(args: argparse.Namespace) -> int:
    client = load_openai_client()
    response = client.fine_tuning.jobs.list_events(
        fine_tuning_job_id=args.job_id,
        limit=args.limit,
    )
    payload = object_to_dict(response)
    if args.output:
        write_json(args.output, payload)
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="Upload JSONL and create a fine-tuning job.")
    create_parser.add_argument("--training-file", required=True, help="Chat fine-tuning JSONL path.")
    create_parser.add_argument("--model", help=f"Base model. Default: env CORRECTION_FINE_TUNE_BASE_MODEL or {DEFAULT_BASE_MODEL}.")
    create_parser.add_argument("--suffix", help=f"Fine-tuned model suffix. Default: env CORRECTION_FINE_TUNE_SUFFIX or {DEFAULT_SUFFIX}.")
    create_parser.add_argument("--min-examples", type=int, default=50, help="Minimum valid JSONL examples required.")
    create_parser.add_argument("--dry-run", action="store_true", help="Validate and print the intended job without network calls.")
    create_parser.add_argument("--output", help="Optional JSON output path for the created job metadata.")

    status_parser = subparsers.add_parser("status", help="Retrieve a fine-tuning job.")
    status_parser.add_argument("job_id", help="Fine-tuning job id, e.g. ftjob_...")
    status_parser.add_argument("--output", help="Optional JSON output path.")

    events_parser = subparsers.add_parser("events", help="List fine-tuning job events.")
    events_parser.add_argument("job_id", help="Fine-tuning job id, e.g. ftjob_...")
    events_parser.add_argument("--limit", type=int, default=20, help="Maximum events to return.")
    events_parser.add_argument("--output", help="Optional JSON output path.")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.command == "create":
            return create_job(args)
        if args.command == "status":
            return show_status(args)
        if args.command == "events":
            return show_events(args)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
