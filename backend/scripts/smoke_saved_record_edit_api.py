#!/usr/bin/env python3
"""Smoke test saved-record edit and correction capture paths."""

from __future__ import annotations

import argparse
import json
import os
import uuid
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


DEFAULT_API_URL = "https://api.mallog24.com"
DEFAULT_MISSING_RECORD_ID = 9_223_372_036_854_775_807


class HttpFailure(RuntimeError):
    def __init__(self, status_code: int, payload: dict[str, Any] | str):
        self.status_code = status_code
        self.payload = payload
        super().__init__(f"HTTP {status_code}: {payload}")


def normalize_api_url(value: str) -> str:
    base_url = (value or "").strip().rstrip("/")
    if not base_url:
        return DEFAULT_API_URL
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return base_url


def read_json_body(raw_body: bytes) -> dict[str, Any]:
    raw_text = raw_body.decode("utf-8", errors="replace")
    if not raw_text:
        return {}
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Expected JSON response, got: {raw_text[:500]}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Expected JSON object response.")
    return payload


def request_api(
    url: str,
    *,
    method: str,
    token: str,
    timeout: int,
    json_body: dict[str, Any] | None = None,
    form_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    body: bytes | None = None
    if json_body is not None:
        body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif form_body is not None:
        body = urllib.parse.urlencode(form_body).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if body is not None:
        headers["Content-Length"] = str(len(body))

    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return read_json_body(response.read())
    except urllib.error.HTTPError as exc:
        try:
            payload: dict[str, Any] | str = read_json_body(exc.read())
        except Exception:
            payload = str(exc)
        raise HttpFailure(exc.code, payload) from exc


def validate_success(payload: dict[str, Any], label: str) -> None:
    if payload.get("success") is not True:
        raise RuntimeError(f"{label} failed: {json.dumps(payload, ensure_ascii=False, sort_keys=True)}")


def validate_missing_record_preflight(exc: HttpFailure) -> None:
    if exc.status_code != 404:
        raise RuntimeError(f"Expected 404 for missing record preflight, got {exc.status_code}: {exc.payload}")
    if isinstance(exc.payload, dict):
        detail = str(exc.payload.get("detail") or "")
        if "저장 기록본" not in detail and "record" not in detail.lower():
            raise RuntimeError(f"Unexpected missing record response: {exc.payload}")


def sanitize_result(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "success": bool(payload.get("success")),
        "mode": payload.get("mode") or "",
        "created_record_id": payload.get("created_record_id"),
        "deleted_record_id": payload.get("deleted_record_id"),
        "correction_sample_stored": bool(payload.get("correction_sample_stored")),
        "correction_sample_id": payload.get("correction_sample_id"),
    }


def run_missing_record_preflight(args: argparse.Namespace) -> dict[str, Any]:
    missing_id = int(args.missing_record_id)
    try:
        request_api(
            f"{normalize_api_url(args.api_url)}/api/records/{missing_id}",
            method="PUT",
            token=args.bearer_token,
            timeout=args.timeout,
            json_body={"content": args.original_text},
        )
    except HttpFailure as exc:
        validate_missing_record_preflight(exc)
        return {"success": True, "mode": "missing-record-preflight", "status_code": exc.status_code}
    raise RuntimeError(f"Missing record preflight unexpectedly updated record id {missing_id}.")


def run_write_path(args: argparse.Namespace) -> dict[str, Any]:
    base_url = normalize_api_url(args.api_url)
    task_id = args.task_id or f"saved-record-smoke-{uuid.uuid4().hex}"
    record_id: int | None = None
    deleted_record_id: int | None = None
    correction_sample_id: Any = None
    correction_sample_stored = False
    result_payload: dict[str, Any] = {}

    try:
        create_payload = {
            "category": args.category,
            "title": args.title,
            "content": args.original_text,
            "task_id": task_id,
            "source_type": args.source_type,
        }
        created = request_api(
            f"{base_url}/api/records",
            method="POST",
            token=args.bearer_token,
            timeout=args.timeout,
            form_body=create_payload,
        )
        validate_success(created, "record create")
        created_record = created.get("record") if isinstance(created.get("record"), dict) else {}
        record_id = int(created_record.get("id") or 0)
        if record_id <= 0:
            raise RuntimeError(f"Record create response did not include id: {created}")

        updated = request_api(
            f"{base_url}/api/records/{record_id}",
            method="PUT",
            token=args.bearer_token,
            timeout=args.timeout,
            json_body={
                "title": args.title,
                "content": args.edited_text,
                "language": args.language,
                "correction_metadata": {
                    "smoke_test": True,
                    "source": "smoke_saved_record_edit_api",
                },
            },
        )
        validate_success(updated, "record update")
        updated_record = updated.get("record") if isinstance(updated.get("record"), dict) else {}
        if str(updated_record.get("content") or "") != args.edited_text:
            raise RuntimeError("Record update response did not include edited content.")

        correction = updated.get("correction_sample") if isinstance(updated.get("correction_sample"), dict) else {}
        validate_success(correction, "correction capture")
        correction_sample_stored = bool(correction.get("stored"))
        sample = correction.get("sample") if isinstance(correction.get("sample"), dict) else {}
        correction_sample_id = sample.get("id")
        if not correction_sample_stored:
            raise RuntimeError(f"Correction capture did not store a sample: {correction}")

        result_payload = {
            "success": True,
            "mode": "write-path",
            "created_record_id": record_id,
            "correction_sample_stored": correction_sample_stored,
            "correction_sample_id": correction_sample_id,
        }
    finally:
        if record_id and not args.keep_record:
            deleted = request_api(
                f"{base_url}/api/records/{record_id}",
                method="DELETE",
                token=args.bearer_token,
                timeout=args.timeout,
            )
            validate_success(deleted, "record cleanup")
            deleted_record_id = deleted.get("deleted_id")
    result_payload["deleted_record_id"] = deleted_record_id
    return result_payload


def run_create_capture_path(args: argparse.Namespace) -> dict[str, Any]:
    base_url = normalize_api_url(args.api_url)
    task_id = args.task_id or f"saved-record-create-capture-smoke-{uuid.uuid4().hex}"
    record_id: int | None = None
    deleted_record_id: int | None = None
    correction_sample_id: Any = None
    correction_sample_stored = False
    result_payload: dict[str, Any] = {}

    try:
        created = request_api(
            f"{base_url}/api/records",
            method="POST",
            token=args.bearer_token,
            timeout=args.timeout,
            form_body={
                "category": args.category,
                "title": args.title,
                "content": args.edited_text,
                "task_id": task_id,
                "source_type": args.source_type,
                "correction_original_text": args.original_text,
                "correction_language": args.language,
                "correction_metadata_json": json.dumps({
                    "smoke_test": True,
                    "source": "smoke_saved_record_create_capture_api",
                }),
            },
        )
        validate_success(created, "record create")
        created_record = created.get("record") if isinstance(created.get("record"), dict) else {}
        record_id = int(created_record.get("id") or 0)
        if record_id <= 0:
            raise RuntimeError(f"Record create response did not include id: {created}")

        correction = created.get("correction_sample") if isinstance(created.get("correction_sample"), dict) else {}
        validate_success(correction, "create correction capture")
        correction_sample_stored = bool(correction.get("stored"))
        sample = correction.get("sample") if isinstance(correction.get("sample"), dict) else {}
        correction_sample_id = sample.get("id")
        if not correction_sample_stored:
            raise RuntimeError(f"Create correction capture did not store a sample: {correction}")

        result_payload = {
            "success": True,
            "mode": "create-capture-path",
            "created_record_id": record_id,
            "correction_sample_stored": correction_sample_stored,
            "correction_sample_id": correction_sample_id,
        }
    finally:
        if record_id and not args.keep_record:
            deleted = request_api(
                f"{base_url}/api/records/{record_id}",
                method="DELETE",
                token=args.bearer_token,
                timeout=args.timeout,
            )
            validate_success(deleted, "record cleanup")
            deleted_record_id = deleted.get("deleted_id")
    result_payload["deleted_record_id"] = deleted_record_id
    return result_payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"Backend API URL. Default: {DEFAULT_API_URL}")
    parser.add_argument("--bearer-token", default=os.getenv("MALLOG24_AUTH_TOKEN", ""), help="Auth token. Defaults to MALLOG24_AUTH_TOKEN.")
    parser.add_argument("--exercise-write-path", action="store_true", help="Create, update, capture a smoke correction, then delete a saved record.")
    parser.add_argument("--exercise-create-capture", action="store_true", help="Create a saved record and capture a record-draft correction in the same request.")
    parser.add_argument("--keep-record", action="store_true", help="Do not delete the smoke saved record after --exercise-write-path.")
    parser.add_argument("--missing-record-id", type=int, default=DEFAULT_MISSING_RECORD_ID, help="Record id used for non-mutating preflight.")
    parser.add_argument("--category", default="sermon_core_summary", help="Saved record category.")
    parser.add_argument("--language", default="ko", help="Correction sample language.")
    parser.add_argument("--source-type", default="smoke_saved_record_edit_api", help="Saved record source_type.")
    parser.add_argument("--title", default="mallog24 smoke saved record edit", help="Smoke saved record title.")
    parser.add_argument("--task-id", default="", help="Optional smoke task id. Generated when omitted.")
    parser.add_argument("--original-text", default="mallog24 saved record smoke RBS and R U T C.", help="Original saved record content.")
    parser.add_argument("--edited-text", default="mallog24 saved record smoke RVS and RUTC.", help="Edited saved record content.")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout seconds.")
    parser.add_argument("--self-test", action="store_true", help="Run deterministic local validation without network.")
    return parser.parse_args()


def run_self_test() -> int:
    validate_success({"success": True}, "self-test")
    validate_missing_record_preflight(HttpFailure(404, {"detail": "저장 기록본을 찾을 수 없습니다."}))
    try:
        validate_missing_record_preflight(HttpFailure(401, {"detail": "Unauthorized"}))
    except RuntimeError:
        payload = sanitize_result({
            "success": True,
            "mode": "create-capture-path",
            "created_record_id": 10,
            "deleted_record_id": 10,
            "correction_sample_stored": True,
            "correction_sample_id": 20,
        })
        assert payload["success"] is True
        assert payload["correction_sample_stored"] is True
        assert payload["mode"] == "create-capture-path"
        print("saved-record-edit-smoke-self-test-ok")
        return 0
    raise AssertionError("Expected missing-record validation to fail on non-404.")


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()
    if not args.bearer_token:
        raise SystemExit("--bearer-token or MALLOG24_AUTH_TOKEN is required.")

    if args.exercise_create_capture:
        payload = run_create_capture_path(args)
    elif args.exercise_write_path:
        payload = run_write_path(args)
    else:
        payload = run_missing_record_preflight(args)
    print(json.dumps(sanitize_result(payload), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
