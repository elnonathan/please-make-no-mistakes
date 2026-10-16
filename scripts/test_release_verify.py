#!/usr/bin/env python3
"""Tests for aggregate release verification semantics."""

from __future__ import annotations

import subprocess
import unittest

from release_verify import FULL_CHECKS, PORTABLE_CHECKS, run_checks


class ReleaseVerifyTests(unittest.TestCase):
    def test_all_checks_run_after_a_failure(self) -> None:
        calls: list[list[str]] = []
        exit_codes = iter((0, 1, 0))

        def runner(command: list[str], **_kwargs: object) -> subprocess.CompletedProcess[object]:
            calls.append(command)
            return subprocess.CompletedProcess(command, next(exit_codes))

        checks = (
            ("first", ("python", "first.py")),
            ("second", ("python", "second.py")),
            ("third", ("python", "third.py")),
        )
        summary = run_checks(checks, runner=runner, emit_progress=False)
        self.assertEqual(len(calls), 3)
        self.assertEqual(summary["status"], "fail")
        self.assertEqual(summary["failures"], ["second"])

    def test_complete_pass_reports_every_check(self) -> None:
        def runner(command: list[str], **_kwargs: object) -> subprocess.CompletedProcess[object]:
            return subprocess.CompletedProcess(command, 0)

        checks = (("one", ("python", "one.py")), ("two", ("python", "two.py")))
        summary = run_checks(checks, runner=runner, emit_progress=False)
        self.assertEqual(summary["status"], "pass")
        self.assertEqual(summary["checks_run"], 2)
        self.assertEqual(summary["checks_passed"], 2)
        self.assertEqual(summary["failures"], [])

    def test_portable_profile_omits_only_nonportable_runtime_checks(self) -> None:
        full_names = {name for name, _command in FULL_CHECKS}
        portable_names = {name for name, _command in PORTABLE_CHECKS}
        self.assertEqual(full_names - portable_names, {"installed-tree"})
        self.assertIn("package-and-skill", portable_names)
        self.assertIn("source-validator-adversarial", portable_names)
        self.assertIn("host-guard", portable_names)
        self.assertIn("agent-evaluation", portable_names)
        self.assertIn("distribution-artifact", portable_names)
        self.assertIn("claude-adapter", portable_names)
        self.assertIn("claude-discovery", portable_names)
        self.assertIn("claude-adapter", full_names)
        order = [name for name, _command in FULL_CHECKS]
        self.assertEqual(order[order.index("host-guard") + 1], "claude-adapter")


if __name__ == "__main__":
    unittest.main(verbosity=2)
