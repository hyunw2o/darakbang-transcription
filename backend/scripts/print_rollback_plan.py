#!/usr/bin/env python3
"""Print a non-destructive rollback plan for a deployed commit range."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class RollbackPlan:
    stable_ref: str
    stable_sha: str
    deploy_ref: str
    deploy_sha: str
    branch: str
    remote: str
    dirty_worktree: bool
    commands: list[str]
    notes: list[str]


def run_git(args: list[str]) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=str(REPO_ROOT),
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.stdout.strip()


def resolve_ref(ref: str) -> str:
    return run_git(["rev-parse", "--verify", ref])


def is_ancestor(ancestor: str, descendant: str) -> bool:
    completed = subprocess.run(
        ["git", "merge-base", "--is-ancestor", ancestor, descendant],
        cwd=str(REPO_ROOT),
        check=False,
    )
    return completed.returncode == 0


def has_dirty_worktree() -> bool:
    return bool(run_git(["status", "--porcelain"]))


def build_commands(stable_sha: str, deploy_sha: str, remote: str, branch: str) -> list[str]:
    if stable_sha == deploy_sha:
        return []
    return [
        f"git fetch {remote}",
        f"git revert --no-edit {stable_sha}..{deploy_sha}",
        "python3.11 backend/scripts/run_feature_quality_gates.py",
        f"git push {remote} {branch}",
    ]


def build_plan(args: argparse.Namespace) -> RollbackPlan:
    stable_sha = resolve_ref(args.stable_ref)
    deploy_sha = resolve_ref(args.deploy_ref)
    notes = [
        "This plan does not run rollback commands.",
        "Use git revert so the rollback is auditable and can be pushed normally.",
    ]
    if stable_sha == deploy_sha:
        notes.append("Stable ref and deploy ref resolve to the same commit; no revert is needed.")
    elif not is_ancestor(stable_sha, deploy_sha):
        notes.append("Stable ref is not an ancestor of deploy ref; inspect history before using the range command.")
    if has_dirty_worktree():
        notes.append("Worktree has uncommitted changes. Stash or commit unrelated changes before running rollback commands.")

    return RollbackPlan(
        stable_ref=args.stable_ref,
        stable_sha=stable_sha,
        deploy_ref=args.deploy_ref,
        deploy_sha=deploy_sha,
        branch=args.branch,
        remote=args.remote,
        dirty_worktree=has_dirty_worktree(),
        commands=build_commands(stable_sha, deploy_sha, args.remote, args.branch),
        notes=notes,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stable-ref", default="HEAD~1", help="Known-good commit before the deploy. Default: HEAD~1.")
    parser.add_argument("--deploy-ref", default="HEAD", help="Commit currently deployed or about to deploy. Default: HEAD.")
    parser.add_argument("--remote", default="origin", help="Git remote to push rollback revert to. Default: origin.")
    parser.add_argument("--branch", default="main", help="Git branch to push. Default: main.")
    parser.add_argument("--self-test", action="store_true", help="Run local deterministic command tests.")
    return parser.parse_args()


def run_self_test() -> int:
    commands = build_commands("stable123", "deploy456", "origin", "main")
    assert commands == [
        "git fetch origin",
        "git revert --no-edit stable123..deploy456",
        "python3.11 backend/scripts/run_feature_quality_gates.py",
        "git push origin main",
    ]
    assert build_commands("same", "same", "origin", "main") == []
    print("rollback-plan-self-test-ok")
    return 0


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_self_test()
    try:
        plan = build_plan(args)
    except subprocess.CalledProcessError as exc:
        payload: dict[str, Any] = {
            "ok": False,
            "error": (exc.stderr or str(exc)).strip(),
            "command": exc.cmd,
        }
        print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
        return 1

    print(json.dumps({"ok": True, **asdict(plan)}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
