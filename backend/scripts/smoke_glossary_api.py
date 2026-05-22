#!/usr/bin/env python3
"""Smoke test the authenticated user glossary API."""

from __future__ import annotations

import argparse
import json
import os
import uuid
import urllib.error
import urllib.request
from typing import Any


DEFAULT_API_URL = "https://api.mallog24.com"
DEFAULT_MISSING_TERM_ID = 9_223_372_036_854_775_807


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
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    body: bytes | None = None
    if json_body is not None:
        body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
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


def validate_missing_term_preflight(exc: HttpFailure) -> None:
    if exc.status_code != 404:
        raise RuntimeError(f"Expected 404 for missing glossary preflight, got {exc.status_code}: {exc.payload}")
    if isinstance(exc.payload, dict):
        detail = str(exc.payload.get("detail") or "")
        if "용어" not in detail and "term" not in detail.lower():
            raise RuntimeError(f"Unexpected missing glossary response: {exc.payload}")


def sanitize_result(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "success": bool(payload.get("success")),
        "mode": payload.get("mode") or "",
        "created_term_id": payload.get("created_term_id"),
        "deleted_term_id": payload.get("deleted_term_id"),
        "term": payload.get("term") or "",
        "updated_active": payload.get("updated_active"),
    }


def run_missing_term_preflight(args: argparse.Namespace) -> dict[str, Any]:
    missing_id = int(args.missing_term_id)
    try:
        request_api(
            f"{normalize_api_url(args.api_url)}/api/glossary/{missing_id}",
            method="PUT",
            token=args.bearer_token,
            timeout=args.timeout,
            json_body={"meaning": args.updated_meaning},
        )
    except HttpFailure as exc:
        validate_missing_term_preflight(exc)
        return {"success": True, "mode": "missing-term-preflight", "status_code": exc.status_code}
    raise RuntimeError(f"Missing glossary preflight unexpectedly updated term id {missing_id}.")


def run_write_path(args: argparse.Namespace) -> dict[str, Any]:
    base_url = normalize_api_url(args.api_url)
    term = args.term or f"SMOKE-{uuid.uuid4().hex[:12].upper()}"
    term_id: int | None = None
    deleted_term_id: int | None = None
    result_payload: dict[str, Any] = {}

    try:
        created = request_api(
            f"{base_url}/api/glossary",
            method="POST",
            token=args.bearer_token,
            timeout=args.timeout,
            json_body={
                "term": term,
                "meaning": args.meaning,
                "aliases": args.aliases,
                "contexts": args.contexts,
            },
        )
        validate_success(created, "glossary create")
        created_term = created.get("term") if isinstance(created.get("term"), dict) else {}
        term_id = int(created_term.get("id") or 0)
        if term_id <= 0:
            raise RuntimeError(f"Glossary create response did not include id: {created}")

        listed = request_api(
            f"{base_url}/api/glossary",
            method="GET",
            token=args.bearer_token,
            timeout=args.timeout,
        )
        validate_success(listed, "glossary list")
        terms = listed.get("terms") if isinstance(listed.get("terms"), list) else []
        if not any(int(item.get("id") or 0) == term_id for item in terms if isinstance(item, dict)):
            raise RuntimeError("Created glossary term was not returned by list.")

        updated = request_api(
            f"{base_url}/api/glossary/{term_id}",
            method="PUT",
            token=args.bearer_token,
            timeout=args.timeout,
            json_body={
                "meaning": args.updated_meaning,
                "aliases": args.updated_aliases,
                "contexts": args.updated_contexts,
                "is_active": False,
            },
        )
        validate_success(updated, "glossary update")
        updated_term = updated.get("term") if isinstance(updated.get("term"), dict) else {}
        if updated_term.get("is_active") is not False:
            raise RuntimeError(f"Glossary update did not deactivate term: {updated}")

        result_payload = {
            "success": True,
            "mode": "write-path",
            "created_term_id": term_id,
            "term": term,
            "updated_active": updated_term.get("is_active"),
        }
    finally:
        if term_id and not args.keep_term:
            deleted = request_api(
                f"{base_url}/api/glossary/{term_id}",
                method="DELETE",
                token=args.bearer_token,
                timeout=args.timeout,
            )
            validate_success(deleted, "glossary cleanup")
            deleted_term_id = deleted.get("deleted_id")
    result_payload["deleted_term_id"] = deleted_term_id
    return result_payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"Backend API URL. Default: {DEFAULT_API_URL}")
    parser.add_argument("--bearer-token", default=os.getenv("MALLOG24_AUTH_TOKEN", ""), help="Auth token. Defaults to MALLOG24_AUTH_TOKEN.")
    parser.add_argument("--exercise-write-path", action="store_true", help="Create, list, update, then delete a smoke glossary term.")
    parser.add_argument("--keep-term", action="store_true", help="Do not delete the smoke glossary term after --exercise-write-path.")
    parser.add_argument("--missing-term-id", type=int, default=DEFAULT_MISSING_TERM_ID, help="Term id used for non-mutating preflight.")
    parser.add_argument("--term", default="", help="Optional exact smoke term. Generated when omitted.")
    parser.add_argument("--meaning", default="mallog24 user glossary smoke term", help="Smoke term meaning.")
    parser.add_argument("--aliases", action="append", default=["glossary smoke alias"], help="Smoke aliases. Can be repeated.")
    parser.add_argument("--contexts", action="append", default=["glossary smoke context"], help="Smoke contexts. Can be repeated.")
    parser.add_argument("--updated-meaning", default="mallog24 user glossary smoke term updated", help="Updated smoke meaning.")
    parser.add_argument("--updated-aliases", action="append", default=["updated glossary smoke alias"], help="Updated aliases. Can be repeated.")
    parser.add_argument("--updated-contexts", action="append", default=["updated glossary smoke context"], help="Updated contexts. Can be repeated.")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout seconds.")
    parser.add_argument("--self-test", action="store_true", help="Run deterministic local validation without network.")
    return parser.parse_args()


def run_self_test() -> int:
    validate_success({"success": True}, "self-test")
    validate_missing_term_preflight(HttpFailure(404, {"detail": "용어를 찾을 수 없습니다."}))
    try:
        validate_missing_term_preflight(HttpFailure(401, {"detail": "Unauthorized"}))
    except RuntimeError:
        payload = sanitize_result({
            "success": True,
            "mode": "write-path",
            "created_term_id": 10,
            "deleted_term_id": 10,
            "term": "SMOKE-TEST",
            "updated_active": False,
        })
        assert payload["success"] is True
        assert payload["updated_active"] is False
        print("glossary-smoke-self-test-ok")
        return 0
    raise AssertionError("Expected missing-term validation to fail on non-404.")


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()
    if not args.bearer_token:
        raise SystemExit("--bearer-token or MALLOG24_AUTH_TOKEN is required.")

    if args.exercise_write_path:
        payload = run_write_path(args)
    else:
        payload = run_missing_term_preflight(args)
    print(json.dumps(sanitize_result(payload), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
