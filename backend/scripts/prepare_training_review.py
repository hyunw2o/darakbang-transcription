#!/usr/bin/env python3
"""Pair local recordings/references or cut reviewed clips. Never calls an AI API."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import unicodedata

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from training_review import EXTENSIONS, reference_hints


def fingerprint(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def scan(root):
    groups = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            continue
        ext = path.suffix.lower()
        if ext not in EXTENSIONS | {".txt"}:
            continue
        key = unicodedata.normalize("NFC", str(path.relative_to(root).with_suffix("")))
        group = groups.setdefault(key, {"audio": [], "reference": []})
        group["reference" if ext == ".txt" else "audio"].append(path)
    pairs, unmatched = [], []
    for key, group in groups.items():
        if len(group["audio"]) != 1 or len(group["reference"]) != 1:
            unmatched.append({"name": key, "audio_count": len(group["audio"]), "reference_count": len(group["reference"])})
            continue
        audio, reference = group["audio"][0], group["reference"][0]
        text = reference.read_text(encoding="utf-8-sig")
        pairs.append({"audio": str(audio.relative_to(root)), "reference": str(reference.relative_to(root)),
                      "sha256": fingerprint(audio), "reference_verified": False,
                      "reference_characters": len(text), "text_only_hints": reference_hints(text)})
    return {"pairs": pairs, "unmatched": unmatched}


def build_clips(root, manifest, output):
    """JSONL from admin export + hash-matched original files -> 16 kHz WAV pairs."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise ValueError("ffmpeg is required")
    rows = [json.loads(line) for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not rows:
        raise ValueError("No reviewed examples")
    by_hash = {}
    for path in root.rglob("*"):
        if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve()) and path.suffix.lower() in EXTENSIONS:
            by_hash[fingerprint(path)] = path
    # Validate everything before producing a partial corpus.
    seen, intervals, splits = set(), {}, {}
    for row in rows:
        key = str(row["id"])
        if not key.isdigit() or key in seen or row.get("reference_verified") is not True or not row.get("reviewed_at") or not str(row.get("text", "")).strip():
            raise ValueError("Only unique reviewed examples can be exported")
        seen.add(key)
        sha = row["audio_sha256"]
        if sha not in by_hash or row.get("split") not in {"train", "validation", "test"}:
            raise ValueError("Missing original audio or dataset split")
        start, end = float(row["start_seconds"]), float(row["end_seconds"])
        if not all(math.isfinite(x) for x in (start, end)) or not 0 <= start < end or not end - start <= 60:
            raise ValueError("Invalid audio interval")
        row["start_seconds"], row["end_seconds"] = start, end
        if sha in splits and splits[sha] != row["split"]:
            raise ValueError("Source leakage across dataset splits")
        splits[sha] = row["split"]
        for a, b in intervals.setdefault(sha, []):
            if start < b and end > a:
                raise ValueError("Overlapping reviewed intervals")
        intervals[sha].append((start, end))
    output.mkdir(parents=True, exist_ok=False)
    manifest_rows = []
    try:
        for row in rows:
            name = f"{row['id']}.wav"
            subprocess.run([ffmpeg, "-nostdin", "-v", "error", "-i", str(by_hash[row["audio_sha256"]]),
                            "-ss", str(row["start_seconds"]), "-t", str(row["end_seconds"] - row["start_seconds"]),
                            "-map", "0:a:0", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(output / name)],
                           check=True, timeout=120)
            import wave
            with wave.open(str(output / name)) as clip:
                seconds = clip.getnframes() / clip.getframerate()
            if abs(seconds - (row["end_seconds"] - row["start_seconds"])) > 0.05:
                raise ValueError("Extracted clip does not cover the approved interval")
            manifest_rows.append({**row, "audio": name})
        (output / "dataset.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in manifest_rows), encoding="utf-8")
    except Exception:
        # This directory was created exclusively for this run.
        shutil.rmtree(output)
        raise
    return len(manifest_rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--reviewed-manifest", type=Path)
    parser.add_argument("--clips-output", type=Path)
    args = parser.parse_args()
    if args.reviewed_manifest:
        if not args.clips_output:
            parser.error("--clips-output is required")
        print(json.dumps({"clips": build_clips(args.root, args.reviewed_manifest, args.clips_output)}))
    else:
        report = scan(args.root)
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"paired": len(report["pairs"]), "unmatched": len(report["unmatched"]),
                          "reference_verified": False, "external_uploads": 0}))
