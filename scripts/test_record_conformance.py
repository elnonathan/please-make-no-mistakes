#!/usr/bin/env python3
"""Focused tests for the optional read-only activity-record conformance check."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "skills" / "please-make-no-mistakes" / "scripts" / "record_conformance.py"


INDEX = """# Activity

Logical record contract: pmnm.activity-record/v1
Layout profile: pmnm.standard-file/v1
Activity ID: example-1
Status: active
As of: current-source
Current conclusion: bounded conclusion
Current basis revision: 1
Next action: verify the change
Last completed capture: event-1
Capture state: complete

[Understanding](understanding.md)
[Timeline](timeline.md)
[Verification](verification.md)
"""

UNDERSTANDING = """# Understanding

Current basis revision: 1
Claim: bounded conclusion
"""

TIMELINE = """# Timeline

Event identity: event-1
Role: intake
Capture state: complete
"""

VERIFICATION = """# Verification

Current basis revision: 1
Execution result: not-run
"""


class RecordConformanceTests(unittest.TestCase):
    def symlink_or_skip(
        self, link: Path, target: Path, *, target_is_directory: bool = False
    ) -> None:
        try:
            link.symlink_to(target, target_is_directory=target_is_directory)
        except (NotImplementedError, OSError) as exc:
            self.skipTest(f"symlink creation is unavailable: {exc}")

    def make_record(self, root: Path) -> None:
        (root / "index.md").write_text(INDEX, encoding="utf-8")
        (root / "understanding.md").write_text(UNDERSTANDING, encoding="utf-8")
        (root / "timeline.md").write_text(TIMELINE, encoding="utf-8")
        (root / "verification.md").write_text(VERIFICATION, encoding="utf-8")

    def run_tool(self, root: Path) -> tuple[subprocess.CompletedProcess[str], dict[str, object]]:
        result = subprocess.run(
            [sys.executable, str(TOOL), "--activity-root", str(root)],
            check=False,
            capture_output=True,
            text=True,
        )
        return result, json.loads(result.stdout)

    def test_valid_standard_profile_is_conformant(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_record(root)
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(payload["status"], "conformant")
            self.assertEqual(payload["links_checked"], 3)
            self.assertFalse(payload["writes_performed"])

    def test_missing_responsibility_surface_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_record(root)
            (root / "verification.md").unlink()
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertIn("missing required responsibility surface: verification.md", payload["errors"])

    def test_required_responsibility_symlink_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_record(root)
            target = root / "target.md"
            target.write_text(UNDERSTANDING, encoding="utf-8")
            (root / "understanding.md").unlink()
            self.symlink_or_skip(root / "understanding.md", target)
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertTrue(
                any("non-symlink regular file" in item for item in payload["errors"])
            )

    def test_stale_canonical_basis_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_record(root)
            (root / "understanding.md").write_text(
                UNDERSTANDING.replace("revision: 1", "revision: 2"), encoding="utf-8"
            )
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertIn("understanding.md basis revision disagrees with index.md", payload["errors"])

    def test_incomplete_latest_capture_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_record(root)
            (root / "timeline.md").write_text(
                TIMELINE + "\nEvent identity: event-2\nRole: correction\nCapture state: capture-incomplete\n",
                encoding="utf-8",
            )
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertTrue(any("latest timeline event" in item for item in payload["errors"]))

    def test_broken_pointer_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_record(root)
            (root / "index.md").write_text(INDEX + "\n[Missing](records/missing.md)\n", encoding="utf-8")
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertTrue(any("pointer is broken" in item for item in payload["errors"]))

    def test_parent_escape_pointer_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / "activity"
            root.mkdir()
            self.make_record(root)
            (base / "outside.md").write_text("outside", encoding="utf-8")
            (root / "index.md").write_text(
                INDEX + "\n[Outside](../outside.md)\n", encoding="utf-8"
            )
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertTrue(any("pointer escapes" in item for item in payload["errors"]))

    def test_pointer_through_intermediate_symlink_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / "activity"
            outside = base / "outside"
            root.mkdir()
            outside.mkdir()
            self.make_record(root)
            (outside / "external.md").write_text("outside", encoding="utf-8")
            self.symlink_or_skip(root / "linked", outside, target_is_directory=True)
            (root / "index.md").write_text(
                INDEX + "\n[External](linked/external.md)\n", encoding="utf-8"
            )
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertTrue(
                any("through a symlink" in item for item in payload["errors"])
            )

    def test_incompatible_contract_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_record(root)
            (root / "index.md").write_text(
                INDEX.replace("pmnm.activity-record/v1", "pmnm.activity-record/v9"), encoding="utf-8"
            )
            result, payload = self.run_tool(root)
            self.assertEqual(result.returncode, 4)
            self.assertTrue(any("unsupported logical record contract" in item for item in payload["errors"]))


if __name__ == "__main__":
    unittest.main()
