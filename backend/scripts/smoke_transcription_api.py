#!/usr/bin/env python3
"""Run a production transcription smoke test with a short audio file."""

from __future__ import annotations

import argparse
import json
import mimetypes
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path
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


def build_multipart_body(fields: dict[str, str], file_field: str, file_path: str) -> tuple[bytes, str]:
    boundary = f"mallog24-smoke-{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        chunks.append(str(value).encode("utf-8"))
        chunks.append(b"\r\n")

    path = Path(file_path)
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    chunks.append(f"--{boundary}\r\n".encode("utf-8"))
    chunks.append(
        (
            f'Content-Disposition: form-data; name="{file_field}"; filename="{path.name}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8")
    )
    chunks.append(path.read_bytes())
    chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), boundary


def request_json(url: str, *, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None, timeout: int) -> dict[str, Any]:
    request = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return read_json_response(response)
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {payload}") from exc


def build_request_headers(args: argparse.Namespace, guest_session_id: str) -> dict[str, str]:
    headers = {"X-Guest-Session-Id": guest_session_id}
    client_platform = str(getattr(args, "client_platform", "") or "").strip()
    if client_platform:
        headers["X-Mallog24-Client-Platform"] = client_platform
    return headers


def submit_transcription(args: argparse.Namespace, guest_session_id: str) -> dict[str, Any]:
    body, boundary = build_multipart_body(
        {
            "language": args.language,
            "transcription_type": args.transcription_type,
            "correction_mode": args.correction_mode,
        },
        "file",
        args.audio_file,
    )
    headers = build_request_headers(args, guest_session_id)
    headers.update({
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    })
    return request_json(
        f"{normalize_api_url(args.api_url)}/api/transcribe",
        method="POST",
        body=body,
        headers=headers,
        timeout=args.timeout,
    )


def poll_until_done(args: argparse.Namespace, payload: dict[str, Any], guest_session_id: str) -> dict[str, Any]:
    status = str(payload.get("status") or "").lower()
    if status in {"completed", "failed"}:
        return payload

    task_id = str(payload.get("task_id") or "").strip()
    if not task_id:
        return payload

    deadline = time.time() + args.poll_timeout
    headers = build_request_headers(args, guest_session_id)
    while time.time() < deadline:
        time.sleep(args.poll_interval)
        payload = request_json(
            f"{normalize_api_url(args.api_url)}/api/status/{task_id}",
            headers=headers,
            timeout=args.timeout,
        )
        status = str(payload.get("status") or "").lower()
        if status in {"completed", "failed"}:
            return payload
    raise RuntimeError(f"Timed out waiting for task {task_id}.")


def validate_payload(payload: dict[str, Any], expected_terms: list[str]) -> None:
    if payload.get("success") is False or str(payload.get("status") or "").lower() == "failed":
        raise RuntimeError(f"Transcription failed: {json.dumps(payload, ensure_ascii=False, sort_keys=True)}")

    corrected_text = str(payload.get("corrected_text") or "")
    missing_terms = [term for term in expected_terms if term not in corrected_text]
    if missing_terms:
        raise RuntimeError(
            "Corrected text is missing expected terms "
            f"{missing_terms}: {corrected_text[:1000]}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"Backend API URL. Default: {DEFAULT_API_URL}")
    parser.add_argument("--audio-file", help="Short audio file to upload.")
    parser.add_argument("--language", default="en", help="Transcription language. Default: en")
    parser.add_argument("--transcription-type", default="sermon", help="Transcription type. Default: sermon")
    parser.add_argument("--correction-mode", default="normal", help="Correction mode. Default: normal")
    parser.add_argument("--expect-corrected-contains", action="append", default=[], help="Term that must appear in corrected_text. Can be repeated.")
    parser.add_argument("--guest-session-id", help="Optional guest session id. Generated when omitted.")
    parser.add_argument("--client-platform", default="", help="Optional X-Mallog24-Client-Platform value, e.g. web/android/ios.")
    parser.add_argument("--timeout", type=int, default=60, help="HTTP timeout seconds.")
    parser.add_argument("--poll-interval", type=float, default=2.0, help="Status poll interval seconds.")
    parser.add_argument("--poll-timeout", type=int, default=180, help="Maximum seconds to wait for queued tasks.")
    parser.add_argument("--self-test", action="store_true", help="Run local validation tests without network.")
    return parser.parse_args()


def run_self_test() -> int:
    validate_payload({"status": "completed", "success": True, "corrected_text": "RVS and RUTC"}, ["RVS", "RUTC"])
    dummy_args = argparse.Namespace(client_platform="android")
    assert build_request_headers(dummy_args, "guest-self-test") == {
        "X-Guest-Session-Id": "guest-self-test",
        "X-Mallog24-Client-Platform": "android",
    }
    try:
        validate_payload({"status": "completed", "success": True, "corrected_text": "RVH and NRDC"}, ["RVS"])
    except RuntimeError:
        print("transcription-smoke-self-test-ok")
        return 0
    raise AssertionError("Expected missing term validation to fail.")


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()
    if not args.audio_file:
        raise SystemExit("--audio-file is required unless --self-test is set.")
    if not Path(args.audio_file).is_file():
        raise SystemExit(f"Audio file not found: {args.audio_file}")

    guest_session_id = args.guest_session_id or f"smoke-{uuid.uuid4().hex}"
    payload = submit_transcription(args, guest_session_id)
    payload = poll_until_done(args, payload, guest_session_id)
    validate_payload(payload, args.expect_corrected_contains)
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
