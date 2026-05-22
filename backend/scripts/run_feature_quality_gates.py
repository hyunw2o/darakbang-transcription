#!/usr/bin/env python3
"""Run mallog24 feature-change quality gates before push/deploy."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PYTHON_FILES = [
    "backend/main.py",
    "backend/church_terms.py",
    "backend/worker.py",
    "backend/scripts/export_correction_finetune_dataset.py",
    "backend/scripts/manage_correction_finetune.py",
    "backend/scripts/check_feature_readiness.py",
    "backend/scripts/build_feature_sql_bundle.py",
    "backend/scripts/smoke_transcription_api.py",
    "backend/scripts/smoke_glossary_api.py",
    "backend/scripts/smoke_correction_sample_api.py",
    "backend/scripts/smoke_saved_record_edit_api.py",
    "backend/scripts/run_post_deploy_checks.py",
    "backend/scripts/print_rollback_plan.py",
    "backend/scripts/report_correction_samples.py",
]


def run_command(command: list[str], *, cwd: Path = REPO_ROOT, env: dict[str, str] | None = None) -> None:
    print(f"+ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=str(cwd), env=env, check=True)


def run_py_compile() -> None:
    env = os.environ.copy()
    env.setdefault("PYTHONPYCACHEPREFIX", "/private/tmp/pycache")
    run_command([sys.executable, "-m", "py_compile", *PYTHON_FILES], env=env)


def run_main_import() -> None:
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "import main; "
            "assert main.ENABLE_FINE_TUNED_CORRECTION is False; "
            "print('main-import-ok')"
        ),
    ])


def run_special_term_sample() -> None:
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "from church_terms import _normalize_special_term_rules; "
            "text=_normalize_special_term_rules('RVH, NRDC, H M C, R V I S, C V D I P.'); "
            "assert 'RVS' in text and 'RUTC' in text and 'HMC' in text and 'RVIS' in text and 'CVDIP' in text; "
            "print('sample-term-correction-ok', text)"
        ),
    ])


def run_script_self_tests() -> None:
    run_command([sys.executable, "backend/scripts/check_feature_readiness.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/export_correction_finetune_dataset.py", "--self-test", "--dry-run", "--min-kept", "1"])
    run_command([sys.executable, "backend/scripts/build_feature_sql_bundle.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_transcription_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_glossary_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_correction_sample_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_saved_record_edit_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/run_post_deploy_checks.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/print_rollback_plan.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/report_correction_samples.py", "--self-test"])
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".jsonl", delete=False) as handle:
        training_file = handle.name
        handle.write(json.dumps({
            "messages": [
                {"role": "system", "content": "Correct transcript text."},
                {"role": "user", "content": "RBS and R U T C"},
                {"role": "assistant", "content": "RVS and RUTC"},
            ]
        }, ensure_ascii=False) + "\n")
    try:
        run_command([
            sys.executable,
            "backend/scripts/manage_correction_finetune.py",
            "create",
            "--training-file",
            training_file,
            "--dry-run",
            "--min-examples",
            "1",
        ])
    finally:
        Path(training_file).unlink(missing_ok=True)


def run_frontend_build() -> None:
    run_command(["npm", "run", "build"], cwd=REPO_ROOT / "frontend")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-frontend-build", action="store_true", help="Also run frontend npm build.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    run_py_compile()
    run_main_import()
    run_special_term_sample()
    run_script_self_tests()
    if args.with_frontend_build:
        run_frontend_build()
    print("feature-quality-gates-ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
