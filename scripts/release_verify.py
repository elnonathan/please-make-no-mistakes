#!/usr/bin/env python3
"""Run every configured PMNM release check and report all failures."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Sequence


ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable
FULL_CHECKS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("package-and-skill", (PYTHON, "scripts/validate_skill.py")),
    ("host-guard", ("node", "--test", "scripts/test_host_guard.mjs")),
    ("documentation-contract", (PYTHON, "scripts/documentation_gate.py")),
    ("documentation-adversarial", (PYTHON, "scripts/test_documentation_gate.py")),
    ("agent-evaluation", (PYTHON, "scripts/test_agent_evaluation.py")),
    ("release-aggregator", (PYTHON, "scripts/test_release_verify.py")),
    ("context-store", (PYTHON, "scripts/test_context_store.py")),
    ("record-conformance", (PYTHON, "scripts/test_record_conformance.py")),
    ("installed-tree", (PYTHON, "scripts/test_install_smoke.py")),
    ("ordered-trace", (PYTHON, "scripts/test_trace_validator.py")),
    ("distribution-contract", (PYTHON, "scripts/test_distribution_smoke.py")),
    ("distribution-artifact", (PYTHON, "scripts/distribution_smoke.py")),
)
PORTABLE_CHECKS: tuple[tuple[str, tuple[str, ...]], ...] = tuple(
    check for check in FULL_CHECKS if check[0] not in {"context-store", "installed-tree"}
)


Runner = Callable[..., subprocess.CompletedProcess[object]]


def run_checks(
    checks: Sequence[tuple[str, Sequence[str]]] = FULL_CHECKS,
    *,
    runner: Runner = subprocess.run,
    emit_progress: bool = True,
) -> dict[str, object]:
    results: list[dict[str, object]] = []
    for name, command in checks:
        if emit_progress:
            print(f"\n==> {name}", flush=True)
        started = time.monotonic()
        completed = runner(list(command), cwd=ROOT, check=False)
        duration_ms = round((time.monotonic() - started) * 1000)
        exit_code = int(completed.returncode)
        results.append(
            {
                "name": name,
                "status": "pass" if exit_code == 0 else "fail",
                "exit_code": exit_code,
                "duration_ms": duration_ms,
            }
        )

    failures = [result["name"] for result in results if result["status"] == "fail"]
    return {
        "status": "pass" if not failures else "fail",
        "checks_run": len(results),
        "checks_passed": len(results) - len(failures),
        "failures": failures,
        "checks": results,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile",
        choices=("full", "portable"),
        default="full",
        help="Use portable to omit POSIX-only optional-runtime and symlink checks.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    checks = FULL_CHECKS if args.profile == "full" else PORTABLE_CHECKS
    summary = run_checks(checks)
    summary["profile"] = args.profile
    print("\n==> aggregate release result", flush=True)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if summary["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
