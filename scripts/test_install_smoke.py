#!/usr/bin/env python3
"""Tests for the read-only installed-skill smoke checker."""

from __future__ import annotations

import ast
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = PACKAGE_ROOT / "skills" / "please-make-no-mistakes"
TOOL = PACKAGE_ROOT / "scripts" / "install_smoke.py"


class InstallSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="pmnm-install-smoke-")
        self.base = Path(self.temp.name).resolve()
        self.installed = self.base / "installed"
        shutil.copytree(SKILL_ROOT, self.installed)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_tool(
        self,
        installed: Path | None = None,
        *,
        expected: Path | None = None,
        loaded_digest: str | None = None,
    ) -> tuple[int, dict[str, Any]]:
        command = [
            sys.executable,
            os.fspath(TOOL),
            "--installed-root",
            os.fspath(installed or self.installed),
        ]
        if expected is not None:
            command.extend(["--expected-root", os.fspath(expected)])
        if loaded_digest is not None:
            command.extend(["--host-loaded-digest", loaded_digest])
        environment = dict(os.environ)
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        completed = subprocess.run(
            command,
            cwd=PACKAGE_ROOT,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        payload = json.loads(completed.stdout)
        return completed.returncode, payload

    def content_manifest(self, root: Path) -> dict[str, str]:
        return {
            path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(root.rglob("*"), key=lambda item: item.as_posix())
            if path.is_file()
        }

    def test_runtime_surface_has_no_filesystem_write_primitives(self) -> None:
        source = TOOL.read_text(encoding="utf-8")
        self.assertNotIn("subprocess", source)
        tree = ast.parse(source)
        forbidden = {
            "chmod",
            "chown",
            "link",
            "mkdir",
            "remove",
            "rename",
            "replace",
            "rmdir",
            "symlink",
            "touch",
            "truncate",
            "unlink",
            "write",
            "write_bytes",
            "write_text",
        }
        violations = [
            f"{node.func.attr} at line {node.lineno}"
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in forbidden
        ]
        self.assertEqual(violations, [])
        for flag in ("O_WRONLY", "O_RDWR", "O_CREAT", "O_TRUNC", "O_APPEND"):
            self.assertNotIn(flag, source)

    def test_matching_tree_passes_without_writes_and_marks_session_unverified(self) -> None:
        before = self.content_manifest(self.installed)
        returncode, payload = self.run_tool()
        after = self.content_manifest(self.installed)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "passed")
        self.assertFalse(payload["writes_performed"])
        self.assertIn("access-time metadata", " ".join(payload["limitations"]))
        self.assertIn("ACLs", " ".join(payload["limitations"]))
        self.assertEqual(payload["client_session"]["status"], "unverified")
        self.assertGreater(payload["shape"]["section_count"], 0)
        self.assertGreater(payload["shape"]["reference_count"], 0)
        self.assertEqual(before, after)

    def test_a_passing_install_never_claims_the_current_session_loaded_it(self) -> None:
        """a successful comparison is evidence about bytes, never about this session."""
        returncode, payload = self.run_tool()
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "passed")
        self.assertEqual(payload["client_session"]["status"], "unverified")
        self.assertIn(
            "does not prove that the current client session loaded this revision",
            " ".join(payload["limitations"]),
        )

    def test_matching_host_reported_digest_passes(self) -> None:
        first_code, first = self.run_tool()
        self.assertEqual(first_code, 0)
        returncode, payload = self.run_tool(loaded_digest=first["expected_tree_digest"])
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["client_session"]["status"], "host-reported-match")

    def test_stale_host_reported_digest_fails(self) -> None:
        returncode, payload = self.run_tool(loaded_digest="0" * 64)
        self.assertEqual(returncode, 1)
        self.assertEqual(
            payload["client_session"]["status"],
            "host-reported-stale-or-mismatched",
        )
        self.assertIn("host-reported loaded digest", payload["error"])

    def test_host_reported_digest_rejects_non_digest_input(self) -> None:
        completed = subprocess.run(
            [
                sys.executable,
                os.fspath(TOOL),
                "--installed-root",
                os.fspath(self.installed),
                "--host-loaded-digest",
                "not-a-digest",
            ],
            cwd=PACKAGE_ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        self.assertEqual(completed.returncode, 2)
        self.assertIn("exactly 64 hexadecimal characters", completed.stderr)

    def test_modified_installed_file_fails_with_bounded_mismatch(self) -> None:
        skill = self.installed / "SKILL.md"
        skill.write_text(skill.read_text(encoding="utf-8") + "\nchanged\n", encoding="utf-8")
        returncode, payload = self.run_tool()
        self.assertEqual(returncode, 1)
        self.assertEqual(payload["status"], "failed")
        self.assertIn("access-time metadata", " ".join(payload["limitations"]))
        self.assertIn(
            {"path": "SKILL.md", "effect": "entry-metadata-or-content-mismatch"},
            payload["mismatches"],
        )

    def test_unexpected_empty_directory_changes_tree_identity(self) -> None:
        (self.installed / "unexpected-empty").mkdir()
        returncode, payload = self.run_tool()
        self.assertEqual(returncode, 1)
        self.assertIn(
            {"path": "unexpected-empty", "effect": "unexpected-installed-entry"},
            payload["mismatches"],
        )

    def test_reference_routing_mismatch_fails_even_when_trees_match(self) -> None:
        expected = self.base / "expected"
        shutil.copytree(SKILL_ROOT, expected)
        for root in (expected, self.installed):
            (root / "references" / "unlinked.md").write_text("# Unlinked\n", encoding="utf-8")
        returncode, payload = self.run_tool(expected=expected)
        self.assertEqual(returncode, 1)
        self.assertIn("reference routing mismatch", payload["error"])

    @unittest.skipUnless(hasattr(os, "symlink"), "symlinks are unavailable")
    def test_symlink_entry_inside_tree_fails_closed(self) -> None:
        os.symlink(self.installed / "SKILL.md", self.installed / "linked-skill.md")
        returncode, payload = self.run_tool()
        self.assertEqual(returncode, 1)
        self.assertIn("symlink entry", payload["error"])

    @unittest.skipUnless(hasattr(os, "symlink"), "symlinks are unavailable")
    def test_symlinked_install_root_is_supported(self) -> None:
        linked_root = self.base / "installed-link"
        os.symlink(self.installed, linked_root)
        returncode, payload = self.run_tool(installed=linked_root)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["installed_root"], os.fspath(self.installed.resolve()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
