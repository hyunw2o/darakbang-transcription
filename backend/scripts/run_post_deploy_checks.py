#!/usr/bin/env python3
"""Run post-deploy mallog24 checks against a live backend."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


DEFAULT_API_URL = "https://api.mallog24.com"
REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class CheckResult:
    name: str
    status: str
    required: bool
    command: list[str]
    returncode: int | None = None
    output_tail: str = ""
    error: str = ""


def normalize_api_url(value: str) -> str:
    base_url = (value or "").strip().rstrip("/")
    if not base_url:
        return DEFAULT_API_URL
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return base_url


def tail_text(value: str, limit: int = 2400) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[-limit:]


def run_command(name: str, command: list[str], *, required: bool) -> CheckResult:
    try:
        completed = subprocess.run(
            command,
            cwd=str(REPO_ROOT),
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
    except Exception as exc:
        return CheckResult(
            name=name,
            status="failed",
            required=required,
            command=command,
            error=str(exc),
        )
    return CheckResult(
        name=name,
        status="passed" if completed.returncode == 0 else "failed",
        required=required,
        command=command,
        returncode=completed.returncode,
        output_tail=tail_text(completed.stdout),
    )


def skipped_check(name: str, reason: str, *, required: bool) -> CheckResult:
    return CheckResult(
        name=name,
        status="failed" if required else "skipped",
        required=required,
        command=[],
        error=reason,
    )


def check_ok(check: CheckResult) -> bool:
    if check.status == "passed":
        return True
    if check.status == "skipped" and not check.required:
        return True
    return False


def summarize(checks: list[CheckResult]) -> dict[str, Any]:
    return {
        "ok": all(check_ok(check) for check in checks),
        "checks": [asdict(check) for check in checks],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"Backend API URL. Default: {DEFAULT_API_URL}")
    parser.add_argument("--min-finetune-examples", type=int, default=50, help="Minimum kept samples expected before fine-tune readiness.")
    parser.add_argument("--auth-token", default=os.getenv("MALLOG24_AUTH_TOKEN", ""), help="Auth token for correction smoke. Defaults to MALLOG24_AUTH_TOKEN.")
    parser.add_argument("--exercise-glossary", action="store_true", help="Create, list, update, and clean up a smoke user glossary term.")
    parser.add_argument("--require-glossary-smoke", action="store_true", help="Fail when no auth token is available for glossary smoke.")
    parser.add_argument("--store-correction-sample", action="store_true", help="Insert a smoke correction sample instead of unchanged preflight.")
    parser.add_argument("--require-correction-smoke", action="store_true", help="Fail when no auth token is available for correction smoke.")
    parser.add_argument("--exercise-saved-record-edit", action="store_true", help="Create, update, capture, and clean up a smoke saved record.")
    parser.add_argument("--exercise-saved-record-create-capture", action="store_true", help="Create a saved record and capture a record-draft correction in the same request.")
    parser.add_argument("--require-saved-record-edit-smoke", action="store_true", help="Fail when no auth token is available for saved-record edit smoke.")
    parser.add_argument("--require-saved-record-create-capture-smoke", action="store_true", help="Fail unless saved-record create-capture smoke can run successfully.")
    parser.add_argument("--audio-file", default="", help="Optional short audio file for transcription smoke.")
    parser.add_argument("--expect-corrected-contains", action="append", default=[], help="Expected term in corrected_text. Can be repeated.")
    parser.add_argument("--client-platform", action="append", default=[], help="Client platform to smoke, e.g. web or android. Can be repeated. Default: web.")
    parser.add_argument("--require-transcription-smoke", action="store_true", help="Fail when --audio-file is missing.")
    parser.add_argument("--with-sample-report", action="store_true", help="Also run the Supabase correction sample quality report.")
    parser.add_argument("--self-test", action="store_true", help="Run deterministic local summary tests without network.")
    return parser.parse_args()


def run_self_test() -> int:
    payload = summarize([
        CheckResult(name="required-pass", status="passed", required=True, command=["true"], returncode=0),
        CheckResult(name="optional-skip", status="skipped", required=False, command=[], error="not configured"),
    ])
    assert payload["ok"] is True
    payload = summarize([
        CheckResult(name="required-skip", status="failed", required=True, command=[], error="missing token"),
    ])
    assert payload["ok"] is False
    assert normalize_api_url("api.example.test") == "https://api.example.test"
    args = parse_args_for_self_test(["--client-platform", "web", "--client-platform", "android"])
    assert args.client_platform == ["web", "android"]
    args = parse_args_for_self_test(["--exercise-glossary", "--require-glossary-smoke"])
    assert args.exercise_glossary is True
    assert args.require_glossary_smoke is True
    args = parse_args_for_self_test(["--exercise-saved-record-edit", "--require-saved-record-edit-smoke"])
    assert args.exercise_saved_record_edit is True
    assert args.require_saved_record_edit_smoke is True
    args = parse_args_for_self_test(["--exercise-saved-record-create-capture"])
    assert args.exercise_saved_record_create_capture is True
    args = parse_args_for_self_test(["--require-saved-record-create-capture-smoke"])
    assert args.require_saved_record_create_capture_smoke is True
    missing_token_payload = summarize([
        skipped_check(
            "saved-record-create-capture-smoke",
            "--auth-token or MALLOG24_AUTH_TOKEN is required.",
            required=False,
        )
    ])
    assert missing_token_payload["ok"] is True
    print("post-deploy-checks-self-test-ok")
    return 0


def parse_args_for_self_test(argv: list[str]) -> argparse.Namespace:
    original_argv = sys.argv
    try:
        sys.argv = [original_argv[0], *argv, "--self-test"]
        args = parse_args()
        args.self_test = False
        return args
    finally:
        sys.argv = original_argv


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()

    api_url = normalize_api_url(args.api_url)
    checks: list[CheckResult] = []

    checks.append(run_command(
        "readiness",
        [
            sys.executable,
            "backend/scripts/check_feature_readiness.py",
            "--api-url",
            api_url,
            "--min-finetune-examples",
            str(args.min_finetune_examples),
        ],
        required=True,
    ))

    if args.auth_token:
        glossary_command = [
            sys.executable,
            "backend/scripts/smoke_glossary_api.py",
            "--api-url",
            api_url,
            "--bearer-token",
            args.auth_token,
        ]
        if args.exercise_glossary:
            glossary_command.append("--exercise-write-path")
        checks.append(run_command("glossary-smoke", glossary_command, required=True))
    else:
        checks.append(skipped_check(
            "glossary-smoke",
            "--auth-token or MALLOG24_AUTH_TOKEN is required.",
            required=bool(args.require_glossary_smoke),
        ))

    if args.auth_token:
        correction_command = [
            sys.executable,
            "backend/scripts/smoke_correction_sample_api.py",
            "--api-url",
            api_url,
            "--bearer-token",
            args.auth_token,
        ]
        if args.store_correction_sample:
            correction_command.append("--store-sample")
        checks.append(run_command("correction-sample-smoke", correction_command, required=True))
    else:
        checks.append(skipped_check(
            "correction-sample-smoke",
            "--auth-token or MALLOG24_AUTH_TOKEN is required.",
            required=bool(args.require_correction_smoke),
        ))

    if args.auth_token:
        saved_record_command = [
            sys.executable,
            "backend/scripts/smoke_saved_record_edit_api.py",
            "--api-url",
            api_url,
            "--bearer-token",
            args.auth_token,
        ]
        if args.exercise_saved_record_edit:
            saved_record_command.append("--exercise-write-path")
        checks.append(run_command("saved-record-edit-smoke", saved_record_command, required=True))
        if args.exercise_saved_record_create_capture or args.require_saved_record_create_capture_smoke:
            checks.append(run_command(
                "saved-record-create-capture-smoke",
                [
                    sys.executable,
                    "backend/scripts/smoke_saved_record_edit_api.py",
                    "--api-url",
                    api_url,
                    "--bearer-token",
                    args.auth_token,
                    "--exercise-create-capture",
                ],
                required=True,
            ))
    else:
        checks.append(skipped_check(
            "saved-record-edit-smoke",
            "--auth-token or MALLOG24_AUTH_TOKEN is required.",
            required=bool(args.require_saved_record_edit_smoke),
        ))
        if args.exercise_saved_record_create_capture or args.require_saved_record_create_capture_smoke:
            checks.append(skipped_check(
                "saved-record-create-capture-smoke",
                "--auth-token or MALLOG24_AUTH_TOKEN is required.",
                required=bool(args.require_saved_record_create_capture_smoke),
            ))

    if args.audio_file:
        platforms = args.client_platform or ["web"]
        for platform in platforms:
            transcription_command = [
                sys.executable,
                "backend/scripts/smoke_transcription_api.py",
                "--api-url",
                api_url,
                "--audio-file",
                args.audio_file,
                "--client-platform",
                platform,
            ]
            for expected in args.expect_corrected_contains:
                transcription_command.extend(["--expect-corrected-contains", expected])
            checks.append(run_command(f"transcription-smoke-{platform}", transcription_command, required=True))
    else:
        checks.append(skipped_check(
            "transcription-smoke",
            "--audio-file is required.",
            required=bool(args.require_transcription_smoke),
        ))

    if args.with_sample_report:
        checks.append(run_command(
            "correction-sample-report",
            [
                sys.executable,
                "backend/scripts/report_correction_samples.py",
                "--from-supabase",
                "--min-kept",
                str(args.min_finetune_examples),
                "--asr-threshold",
                "20",
            ],
            required=True,
        ))

    payload = summarize(checks)
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
