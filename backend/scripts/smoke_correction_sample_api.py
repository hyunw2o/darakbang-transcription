#!/usr/bin/env python3
"""Smoke test the authenticated correction-sample API."""

from __future__ import annotations

import argparse
import json
import os
import uuid
import urllib.error
import urllib.request
from typing import Any


DEFAULT_API_URL = "https://api.mallog24.com"


def normalize_api_url(value: str) -> str:
    base_url = (value or "").strip().rstrip("/")
    if not base_url:
        return DEFAULT_API_URL
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return base_url


def read_json_response(response: urllib.request.addinfourl) -> dict[str, Any]:
    raw_body = response.read().decode("utf-8", errors="replace")
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Expected JSON response, got: {raw_body[:500]}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Expected JSON object response.")
    return payload


def request_json(url: str, *, body: dict[str, Any], token: str, timeout: int) -> dict[str, Any]:
    encoded_body = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded_body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Content-Length": str(len(encoded_body)),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return read_json_response(response)
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {payload}") from exc


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
    task_id = args.task_id or f"correction-smoke-{uuid.uuid4().hex}"
    original_text = args.original_text
    edited_text = args.edited_text if args.store_sample else args.original_text
    if args.store_sample and not args.edited_text:
        edited_text = "mallog24 correction smoke sample RVS and RUTC."
    return {
        "source_type": args.source_type,
        "category": args.category,
        "language": args.language,
        "task_id": task_id,
        "original_text": original_text,
        "edited_text": edited_text,
        "metadata": {
            "smoke_test": True,
            "source": "smoke_correction_sample_api",
            "mode": "stored" if args.store_sample else "unchanged_preflight",
        },
    }


def sanitize_result(payload: dict[str, Any]) -> dict[str, Any]:
    sample = payload.get("sample") if isinstance(payload.get("sample"), dict) else {}
    return {
        "success": bool(payload.get("success")),
        "stored": bool(payload.get("stored")),
        "reason": payload.get("reason") or "",
        "sample_id": sample.get("id"),
        "task_id": sample.get("task_id"),
        "source_type": sample.get("source_type"),
        "category": sample.get("category"),
        "language": sample.get("language"),
    }


def validate_response(payload: dict[str, Any], *, expect_stored: bool) -> None:
    if payload.get("success") is not True:
        raise RuntimeError(f"Correction smoke failed: {json.dumps(sanitize_result(payload), ensure_ascii=False, sort_keys=True)}")
    stored = bool(payload.get("stored"))
    if stored != expect_stored:
        raise RuntimeError(
            "Unexpected stored state: "
            f"expected {expect_stored}, got {stored}; "
            f"{json.dumps(sanitize_result(payload), ensure_ascii=False, sort_keys=True)}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"Backend API URL. Default: {DEFAULT_API_URL}")
    parser.add_argument("--bearer-token", default=os.getenv("MALLOG24_AUTH_TOKEN", ""), help="Auth token. Defaults to MALLOG24_AUTH_TOKEN.")
    parser.add_argument("--store-sample", action="store_true", help="Actually insert a smoke sample. Default only verifies auth/schema using an unchanged payload.")
    parser.add_argument("--source-type", default="transcript_edit", help="Correction sample source_type.")
    parser.add_argument("--category", default="sermon", help="Correction sample category.")
    parser.add_argument("--language", default="ko", help="Correction sample language.")
    parser.add_argument("--task-id", default="", help="Optional task id. Generated when omitted.")
    parser.add_argument("--original-text", default="mallog24 correction smoke sample RBS and R U T C.", help="Original text payload.")
    parser.add_argument("--edited-text", default="", help="Edited text payload when --store-sample is set.")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout seconds.")
    parser.add_argument("--self-test", action="store_true", help="Run local response validation without network.")
    return parser.parse_args()


def run_self_test() -> int:
    validate_response({"success": True, "stored": False, "reason": "unchanged"}, expect_stored=False)
    validate_response(
        {
            "success": True,
            "stored": True,
            "sample": {
                "id": 123,
                "task_id": "correction-smoke-test",
                "source_type": "transcript_edit",
                "category": "sermon",
                "language": "ko",
            },
        },
        expect_stored=True,
    )
    try:
        validate_response({"success": True, "stored": False}, expect_stored=True)
    except RuntimeError:
        print("correction-sample-smoke-self-test-ok")
        return 0
    raise AssertionError("Expected stored-state validation to fail.")


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()
    if not args.bearer_token:
        raise SystemExit("--bearer-token or MALLOG24_AUTH_TOKEN is required.")

    payload = build_payload(args)
    response = request_json(
        f"{normalize_api_url(args.api_url)}/api/corrections",
        body=payload,
        token=args.bearer_token,
        timeout=args.timeout,
    )
    validate_response(response, expect_stored=bool(args.store_sample))
    print(json.dumps(sanitize_result(response), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
