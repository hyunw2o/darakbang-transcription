from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable


@dataclass(frozen=True)
class AudioChunkPlan:
    index: int
    core_start: float
    core_end: float
    extract_start: float
    extract_end: float

    @property
    def duration(self) -> float:
        return max(0.0, self.extract_end - self.extract_start)

    def to_manifest(self, status: str = "pending") -> dict:
        return {
            "index": self.index,
            "start": round(self.extract_start, 3),
            "end": round(self.extract_end, 3),
            "core_start": round(self.core_start, 3),
            "core_end": round(self.core_end, 3),
            "duration": round(self.duration, 3),
            "status": status,
        }


def _normalize_silence_intervals(
    silence_intervals: Iterable[tuple[float, float]],
    duration: float,
) -> list[tuple[float, float]]:
    normalized: list[tuple[float, float]] = []
    for start, end in silence_intervals:
        bounded_start = max(0.0, min(duration, float(start)))
        bounded_end = max(bounded_start, min(duration, float(end)))
        if bounded_end - bounded_start < 0.05:
            continue
        normalized.append((bounded_start, bounded_end))
    normalized.sort(key=lambda item: (item[0], item[1]))
    return normalized


def build_silence_aware_chunk_plan(
    duration: float,
    silence_intervals: Iterable[tuple[float, float]],
    *,
    target_seconds: float = 90.0,
    min_seconds: float = 60.0,
    max_seconds: float = 120.0,
    overlap_seconds: float = 12.0,
) -> list[AudioChunkPlan]:
    duration = max(0.0, float(duration))
    if duration <= 0:
        return []

    min_seconds = max(1.0, float(min_seconds))
    max_seconds = max(min_seconds, float(max_seconds))
    overlap_seconds = max(0.0, min(float(overlap_seconds), max_seconds / 4.0))
    target_seconds = max(min_seconds, min(float(target_seconds), max_seconds))

    # An interior chunk receives overlap on both sides, so its core must leave room
    # for that padding while still respecting the absolute duration limit.
    max_core_seconds = max(min_seconds, max_seconds - (2.0 * overlap_seconds))
    target_core_seconds = min(target_seconds, max_core_seconds)
    silences = _normalize_silence_intervals(silence_intervals, duration)
    silence_boundaries = [(start + end) / 2.0 for start, end in silences]

    core_ranges: list[tuple[float, float]] = []
    cursor = 0.0
    while duration - cursor > max_core_seconds + 0.001:
        lower = cursor + min_seconds
        upper = min(duration, cursor + max_core_seconds)
        latest_without_short_tail = duration - min_seconds
        if latest_without_short_tail > cursor:
            upper = min(upper, latest_without_short_tail)

        target = min(upper, cursor + target_core_seconds)
        candidates = [point for point in silence_boundaries if lower <= point <= upper]
        cut = min(candidates, key=lambda point: abs(point - target)) if candidates else target
        if cut <= cursor + 0.1:
            cut = min(duration, cursor + max_core_seconds)
        core_ranges.append((cursor, cut))
        cursor = cut

    if cursor < duration:
        core_ranges.append((cursor, duration))

    plans: list[AudioChunkPlan] = []
    for index, (core_start, core_end) in enumerate(core_ranges):
        extract_start = max(0.0, core_start - (overlap_seconds if index > 0 else 0.0))
        extract_end = min(
            duration,
            core_end + (overlap_seconds if index < len(core_ranges) - 1 else 0.0),
        )
        plans.append(
            AudioChunkPlan(
                index=index,
                core_start=core_start,
                core_end=core_end,
                extract_start=extract_start,
                extract_end=extract_end,
            )
        )
    return plans


def find_coverage_gaps(
    plans: Iterable[AudioChunkPlan],
    duration: float,
    *,
    tolerance: float = 0.1,
) -> list[tuple[float, float]]:
    duration = max(0.0, float(duration))
    tolerance = max(0.0, float(tolerance))
    ordered = sorted(plans, key=lambda item: (item.core_start, item.core_end))
    if duration <= tolerance:
        return []
    if not ordered:
        return [(0.0, duration)]

    gaps: list[tuple[float, float]] = []
    covered_until = 0.0
    for plan in ordered:
        if plan.core_start > covered_until + tolerance:
            gaps.append((covered_until, plan.core_start))
        covered_until = max(covered_until, plan.core_end)
    if covered_until < duration - tolerance:
        gaps.append((covered_until, duration))
    return gaps


def trim_fuzzy_overlap(
    previous_text: str,
    current_text: str,
    *,
    max_tokens: int = 100,
    min_tokens: int = 4,
    similarity_threshold: float = 0.82,
) -> str:
    """Trim an overlapped prefix even when adjacent ASR passes differ slightly."""
    if not previous_text or not current_text:
        return current_text

    import re

    token_pattern = re.compile(r"[A-Za-z0-9]+|[가-힣]+|[ぁ-ゟ゠-ヿ一-龯]+")
    previous_matches = list(token_pattern.finditer(previous_text))
    current_matches = list(token_pattern.finditer(current_text))
    if len(previous_matches) < min_tokens or len(current_matches) < min_tokens:
        return current_text

    previous_tokens = [match.group(0).lower() for match in previous_matches]
    current_tokens = [match.group(0).lower() for match in current_matches]
    max_previous = min(max_tokens, len(previous_tokens))
    max_current = min(max_tokens, len(current_tokens))
    best: tuple[float, int, int] | None = None

    for previous_length in range(min_tokens, max_previous + 1):
        previous_slice = previous_tokens[-previous_length:]
        lower_current = max(min_tokens, previous_length - 5)
        upper_current = min(max_current, previous_length + 5)
        for current_length in range(lower_current, upper_current + 1):
            current_slice = current_tokens[:current_length]
            ratio = SequenceMatcher(None, previous_slice, current_slice, autojunk=False).ratio()
            if ratio < similarity_threshold:
                continue
            score = ratio + min(previous_length, current_length) / 1000.0
            if best is None or score > best[0]:
                best = (score, previous_length, current_length)

    if best is None:
        return current_text

    _, _, current_length = best
    duplicate_end = current_matches[current_length - 1].end()
    return current_text[duplicate_end:].lstrip(" \t\r\n,.;:!?，、。？！-—")
