#!/usr/bin/env python3
"""Adversarial checks for the source host-runtime validator."""

from __future__ import annotations

import importlib.util
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
TOOL = PACKAGE_ROOT / "scripts" / "validate_skill.py"


def load_tool():
    spec = importlib.util.spec_from_file_location("pmnm_validate_skill_tests", TOOL)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {TOOL.name}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


VALIDATOR = load_tool()


class HostRuntimeValidationTests(unittest.TestCase):
    def validate_copy(self, root: Path) -> list[str]:
        hooks = root / "hooks"
        guard = hooks / "pmnm-guard.mjs"
        shell = hooks / "pmnm-shell.mjs"
        with (
            mock.patch.object(VALIDATOR, "HOOK_CONFIG_FILE", hooks / "hooks.json"),
            mock.patch.object(VALIDATOR, "HOOK_RUNTIME_FILE", guard),
            mock.patch.object(VALIDATOR, "HOOK_SHELL_FILE", shell),
            mock.patch.object(VALIDATOR, "HOOK_RUNTIME_FILES", (guard, shell)),
        ):
            errors: list[str] = []
            VALIDATOR.validate_host_hooks(errors)
        return errors

    def copied_hooks(self, raw: str) -> Path:
        root = Path(raw)
        shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
        return root

    def test_accepts_the_exact_regular_local_module_graph(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-hooks-") as raw:
            self.assertEqual(self.validate_copy(self.copied_hooks(raw)), [])

    def test_rejects_a_missing_runtime_module(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-missing-") as raw:
            root = self.copied_hooks(raw)
            (root / "hooks" / "pmnm-shell.mjs").unlink()
            errors = self.validate_copy(root)
            self.assertTrue(any("module set" in item for item in errors))
            self.assertTrue(any("regular in-package file" in item for item in errors))

    def test_rejects_a_linked_runtime_module(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-linked-") as raw:
            root = self.copied_hooks(raw)
            shell = root / "hooks" / "pmnm-shell.mjs"
            shell.unlink()
            shell.symlink_to(PACKAGE_ROOT / "hooks" / "pmnm-shell.mjs")
            errors = self.validate_copy(root)
            self.assertTrue(any("regular in-package file" in item for item in errors))

    def test_rejects_an_import_that_escapes_the_fixed_graph(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-import-") as raw:
            root = self.copied_hooks(raw)
            guard = root / "hooks" / "pmnm-guard.mjs"
            guard.write_text(
                guard.read_text(encoding="utf-8").replace(
                    'from "./pmnm-shell.mjs";',
                    'from "../pmnm-shell.mjs";',
                    1,
                ),
                encoding="utf-8",
            )
            errors = self.validate_copy(root)
            self.assertTrue(any("fixed local module graph" in item for item in errors))

    def test_rejects_an_unlisted_runtime_module(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-unlisted-") as raw:
            root = self.copied_hooks(raw)
            (root / "hooks" / "unexpected.mjs").write_text("export {};\n", encoding="utf-8")
            errors = self.validate_copy(root)
            self.assertTrue(any("module set" in item for item in errors))

    def test_rejects_per_file_and_aggregate_budget_overruns(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-file-budget-") as raw:
            root = self.copied_hooks(raw)
            shell = root / "hooks" / "pmnm-shell.mjs"
            shell.write_text(" " * 230_001, encoding="utf-8")
            errors = self.validate_copy(root)
            self.assertTrue(any("module pmnm-shell.mjs exceeds" in item for item in errors))

        with tempfile.TemporaryDirectory(prefix="pmnm-validator-total-budget-") as raw:
            root = self.copied_hooks(raw)
            hooks = root / "hooks"
            shell = hooks / "pmnm-shell.mjs"
            current_total = sum(path.stat().st_size for path in hooks.glob("*.mjs"))
            shell.write_text(
                shell.read_text(encoding="utf-8") + (" " * max(1, 260_001 - current_total)),
                encoding="utf-8",
            )
            errors = self.validate_copy(root)
            self.assertTrue(any("aggregate inspectable size budget" in item for item in errors))


if __name__ == "__main__":
    unittest.main(verbosity=2)
