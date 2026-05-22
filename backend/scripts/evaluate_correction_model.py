#!/usr/bin/env python3
"""Evaluate a correction model against validation JSONL before enabling it."""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from church_terms import SPECIAL_TERM_RULES


DEFAULT_MIN_SIMILARITY = 0.85
DEFAULT_MIN_COMPACT_MATCH_RATE = 0.0
DEFAULT_MAX_LENGTH_RATIO = 4.0


@dataclass
class EvaluationStats:
    rows: int = 0
    evaluated: int = 0
    invalid_rows: int = 0
    empty_outputs: int = 0
    exact_matches: int = 0
    compact_matches: int = 0
    similarity_sum: float = 0.0
    min_similarity: float = 1.0
    length_ratio_failures: int = 0
    domain_expected_terms: int = 0
    domain_missing_terms: int = 0


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


def normalize_text(value: Any) -> str:
    return str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def compact_for_compare(value: Any) -> str:
    return " ".join(normalize_text(value).split())


def redact_preview(text: str, limit: int = 240) -> str:
    redacted = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[email]", str(text or ""))
    redacted = re.sub(r"\b(?:\+?\d[\d .-]{7,}\d)\b", "[phone]", redacted)
    redacted = re.sub(r"\s+", " ", redacted).strip()
    if len(redacted) <= limit:
        return redacted
    return redacted[: limit - 1].rstrip() + "..."


def domain_terms() -> list[str]:
    terms = []
    seen = set()
    for rule in SPECIAL_TERM_RULES:
        canonical = normalize_text(rule.get("canonical"))
        key = canonical.upper()
        if canonical and key not in seen:
            seen.add(key)
            terms.append(canonical)
    return terms


def contains_term(text: str, term: str) -> bool:
    if not term:
        return False
    return re.search(rf"(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])", text, re.IGNORECASE) is not None


def expected_domain_terms(expected: str) -> list[str]:
    return [term for term in domain_terms() if contains_term(expected, term)]


def load_validation_rows(path: str) -> list[dict[str, Any]]:
    rows = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            raw_line = line.strip()
            if not raw_line:
                continue
            try:
                row = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                rows.append({"line_number": line_number, "invalid_reason": f"invalid json: {exc}"})
                continue
            if not isinstance(row, dict):
                rows.append({"line_number": line_number, "invalid_reason": "row is not an object"})
                continue
            row["line_number"] = line_number
            rows.append(row)
    return rows


def extract_prompt_and_expected(row: dict[str, Any]) -> tuple[list[dict[str, str]], str, str]:
    messages = row.get("messages")
    if not isinstance(messages, list) or len(messages) < 2:
        raise ValueError("messages must be a list with at least two items")

    prompt_messages: list[dict[str, str]] = []
    expected = ""
    original = ""
    for message in messages:
        if not isinstance(message, dict):
            raise ValueError("message is not an object")
        role = message.get("role")
        content = normalize_text(message.get("content"))
        if role not in {"system", "user", "assistant"}:
            raise ValueError(f"invalid role: {role}")
        if not content:
            raise ValueError("message content is empty")
        if role == "assistant":
            expected = content
        else:
            prompt_messages.append({"role": role, "content": content})
            if role == "user":
                original = content
    if not prompt_messages or not expected:
        raise ValueError("missing prompt or expected assistant content")
    return prompt_messages, expected, original


def load_prediction_rows(path: str) -> list[str]:
    raw_text = Path(path).read_text(encoding="utf-8")
    predictions: list[str] = []
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, str):
                predictions.append(item)
            elif isinstance(item, dict):
                predictions.append(str(item.get("prediction") or item.get("output") or item.get("content") or ""))
        return predictions

    for line in raw_text.splitlines():
        raw_line = line.strip()
        if not raw_line:
            continue
        try:
            item = json.loads(raw_line)
        except json.JSONDecodeError:
            predictions.append(raw_line)
            continue
        if isinstance(item, str):
            predictions.append(item)
        elif isinstance(item, dict):
            predictions.append(str(item.get("prediction") or item.get("output") or item.get("content") or ""))
    return predictions


def predict_with_model(client: Any, model: str, prompt_messages: list[dict[str, str]], expected: str, args: argparse.Namespace) -> str:
    response = client.chat.completions.create(
        model=model,
        messages=prompt_messages,
        temperature=0,
        max_completion_tokens=max(256, min(args.max_completion_tokens, len(expected) + args.output_token_buffer)),
        timeout=args.timeout,
    )
    return normalize_text(response.choices[0].message.content)


def evaluate_prediction(
    *,
    line_number: int,
    original: str,
    expected: str,
    prediction: str,
    stats: EvaluationStats,
    args: argparse.Namespace,
) -> dict[str, Any] | None:
    stats.evaluated += 1
    expected_compact = compact_for_compare(expected)
    prediction_compact = compact_for_compare(prediction)
    if not prediction_compact:
        stats.empty_outputs += 1

    exact_match = prediction == expected
    compact_match = prediction_compact == expected_compact
    if exact_match:
        stats.exact_matches += 1
    if compact_match:
        stats.compact_matches += 1

    similarity = difflib.SequenceMatcher(a=expected_compact, b=prediction_compact, autojunk=False).ratio()
    stats.similarity_sum += similarity
    stats.min_similarity = min(stats.min_similarity, similarity)

    length_ratio = max(len(expected_compact), len(prediction_compact)) / max(1, min(len(expected_compact), len(prediction_compact)))
    length_ratio_failed = length_ratio > args.max_length_ratio
    if length_ratio_failed:
        stats.length_ratio_failures += 1

    missing_terms = []
    for term in expected_domain_terms(expected):
        stats.domain_expected_terms += 1
        if not contains_term(prediction, term):
            missing_terms.append(term)
            stats.domain_missing_terms += 1

    failed = (
        not prediction_compact
        or similarity < args.min_similarity
        or length_ratio_failed
        or bool(missing_terms)
    )
    if not failed:
        return None
    return {
        "line_number": line_number,
        "similarity": round(similarity, 4),
        "length_ratio": round(length_ratio, 4),
        "missing_domain_terms": missing_terms,
        "original_preview": redact_preview(original),
        "expected_preview": redact_preview(expected),
        "prediction_preview": redact_preview(prediction),
    }


def build_report(stats: EvaluationStats, failures: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    avg_similarity = stats.similarity_sum / stats.evaluated if stats.evaluated else 0.0
    compact_match_rate = stats.compact_matches / stats.evaluated if stats.evaluated else 0.0
    domain_missing_rate = stats.domain_missing_terms / stats.domain_expected_terms if stats.domain_expected_terms else 0.0
    ready_to_promote = (
        stats.evaluated > 0
        and stats.invalid_rows == 0
        and stats.empty_outputs == 0
        and avg_similarity >= args.min_avg_similarity
        and stats.min_similarity >= args.min_similarity
        and compact_match_rate >= args.min_compact_match_rate
        and stats.length_ratio_failures == 0
        and stats.domain_missing_terms <= args.max_domain_misses
    )
    return {
        "ready_to_promote": ready_to_promote,
        "thresholds": {
            "min_similarity": args.min_similarity,
            "min_avg_similarity": args.min_avg_similarity,
            "min_compact_match_rate": args.min_compact_match_rate,
            "max_length_ratio": args.max_length_ratio,
            "max_domain_misses": args.max_domain_misses,
        },
        "metrics": {
            **asdict(stats),
            "avg_similarity": round(avg_similarity, 4),
            "compact_match_rate": round(compact_match_rate, 4),
            "domain_missing_rate": round(domain_missing_rate, 4),
        },
        "failures": failures[: args.max_failures],
    }


def write_json(path: str, payload: dict[str, Any]) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def evaluate_rows(rows: list[dict[str, Any]], args: argparse.Namespace) -> dict[str, Any]:
    stats = EvaluationStats(rows=len(rows))
    failures: list[dict[str, Any]] = []
    predictions = load_prediction_rows(args.predictions_json) if args.predictions_json else []
    model = args.model or os.getenv("CORRECTION_FINE_TUNED_MODEL", "").strip()
    client = None
    if not predictions and not args.use_expected_as_prediction:
        if not model:
            raise RuntimeError("--model or CORRECTION_FINE_TUNED_MODEL is required unless --predictions-json or --use-expected-as-prediction is set.")
        client = load_openai_client()

    prediction_index = 0
    for row in rows:
        if args.limit and stats.evaluated >= args.limit:
            break
        if row.get("invalid_reason"):
            stats.invalid_rows += 1
            failures.append({
                "line_number": row.get("line_number"),
                "error": row.get("invalid_reason"),
            })
            continue
        try:
            prompt_messages, expected, original = extract_prompt_and_expected(row)
        except ValueError as exc:
            stats.invalid_rows += 1
            failures.append({
                "line_number": row.get("line_number"),
                "error": str(exc),
            })
            continue

        if args.use_expected_as_prediction:
            prediction = expected
        elif predictions:
            if prediction_index >= len(predictions):
                stats.invalid_rows += 1
                failures.append({
                    "line_number": row.get("line_number"),
                    "error": "missing prediction",
                })
                continue
            prediction = normalize_text(predictions[prediction_index])
            prediction_index += 1
        else:
            prediction = predict_with_model(client, model, prompt_messages, expected, args)

        failure = evaluate_prediction(
            line_number=int(row.get("line_number") or 0),
            original=original,
            expected=expected,
            prediction=prediction,
            stats=stats,
            args=args,
        )
        if failure:
            failures.append(failure)

    return build_report(stats, failures, args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--validation-jsonl", help="Validation JSONL with expected assistant messages.")
    source_group.add_argument("--self-test", action="store_true", help="Run deterministic local evaluation without network.")
    parser.add_argument("--model", help="Model id to evaluate. Defaults to CORRECTION_FINE_TUNED_MODEL.")
    parser.add_argument("--predictions-json", help="Optional JSON/JSONL predictions to score without model calls.")
    parser.add_argument("--use-expected-as-prediction", action="store_true", help="Use expected assistant text as predictions; intended for smoke tests.")
    parser.add_argument("--output", help="Optional JSON report output path.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum validation rows to evaluate.")
    parser.add_argument("--timeout", type=int, default=120, help="OpenAI request timeout seconds.")
    parser.add_argument("--max-completion-tokens", type=int, default=16000, help="Maximum completion tokens per model call.")
    parser.add_argument("--output-token-buffer", type=int, default=1000, help="Extra output token budget above expected text length.")
    parser.add_argument("--min-similarity", type=float, default=DEFAULT_MIN_SIMILARITY, help="Minimum per-row similarity.")
    parser.add_argument("--min-avg-similarity", type=float, default=DEFAULT_MIN_SIMILARITY, help="Minimum average similarity.")
    parser.add_argument("--min-compact-match-rate", type=float, default=DEFAULT_MIN_COMPACT_MATCH_RATE, help="Minimum exact compact-text match rate.")
    parser.add_argument("--max-length-ratio", type=float, default=DEFAULT_MAX_LENGTH_RATIO, help="Maximum expected/predicted length ratio.")
    parser.add_argument("--max-domain-misses", type=int, default=0, help="Maximum missing domain-term occurrences.")
    parser.add_argument("--max-failures", type=int, default=10, help="Maximum failure examples in report.")
    parser.add_argument("--fail-unready", action="store_true", help="Exit non-zero when ready_to_promote is false.")
    return parser.parse_args()


def run_self_test(args: argparse.Namespace) -> int:
    rows = [
        {
            "line_number": 1,
            "messages": [
                {"role": "system", "content": "Correct transcript text."},
                {"role": "user", "content": "Language: ko\n\n[Original transcript]\nRBS and R U T C"},
                {"role": "assistant", "content": "RVS and RUTC"},
            ],
        },
        {
            "line_number": 2,
            "messages": [
                {"role": "system", "content": "Correct transcript text."},
                {"role": "user", "content": "Language: ko\n\n[Original transcript]\nH M C"},
                {"role": "assistant", "content": "HMC"},
            ],
        },
    ]
    args.use_expected_as_prediction = True
    report = evaluate_rows(rows, args)
    assert report["ready_to_promote"] is True
    assert report["metrics"]["evaluated"] == 2
    assert report["metrics"]["domain_missing_terms"] == 0

    args.use_expected_as_prediction = False
    args.predictions_json = ""
    bad_rows = [rows[0]]
    original_load_prediction_rows = load_prediction_rows
    try:
        globals()["load_prediction_rows"] = lambda _path: ["RBS and R U T C"]
        args.predictions_json = "inline"
        bad_report = evaluate_rows(bad_rows, args)
        assert bad_report["ready_to_promote"] is False
        assert bad_report["metrics"]["domain_missing_terms"] >= 1
    finally:
        globals()["load_prediction_rows"] = original_load_prediction_rows
    print("correction-model-eval-self-test-ok")
    return 0


def main() -> int:
    args = parse_args()
    try:
        if args.self_test:
            return run_self_test(args)
        rows = load_validation_rows(args.validation_jsonl)
        report = evaluate_rows(rows, args)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    if args.output:
        write_json(args.output, report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    if args.fail_unready and not report["ready_to_promote"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
