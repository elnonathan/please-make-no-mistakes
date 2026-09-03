#!/usr/bin/env python3
"""Adversarial tests for the PMNM documentation contract."""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from documentation_contract import validate_repository


SOURCE_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_FILES = (
    "README.md",
    "SETUP.md",
    "ARCHITECTURE.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "docs/getting-started.md",
    "docs/distribution.md",
)


class DocumentationGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="pmnm-doc-gate-")
        self.root = Path(self._temporary.name)
        for relative in FIXTURE_FILES:
            source = SOURCE_ROOT / relative
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def mutate(self, relative: str, old: str, new: str) -> None:
        path = self.root / relative
        text = path.read_text(encoding="utf-8")
        self.assertIn(old, text, f"test fixture drifted before mutating {relative}")
        path.write_text(text.replace(old, new), encoding="utf-8")

    def assert_rejected(self, code: str) -> None:
        codes = {finding.code for finding in validate_repository(self.root)}
        self.assertIn(code, codes)

    def test_current_documentation_passes(self) -> None:
        self.assertEqual(validate_repository(self.root), [])

    def test_readme_setup_entry_and_ownership_are_enforced(self) -> None:
        cases = (
            (
                "README.md",
                "## Install",
                "## Product\n\nOverview.\n\n## Install",
                "readme-install-entry",
            ),
            (
                "README.md",
                "[SETUP.md](SETUP.md)",
                "SETUP.md",
                "readme-setup-link",
            ),
            (
                "README.md",
                "## Use",
                "```bash\ncodex plugin marketplace add elnonathan/please-make-no-mistakes\n```\n\n## Use",
                "readme-duplicates-setup",
            ),
            (
                "README.md",
                "[Getting started](docs/getting-started.md)",
                "Getting started",
                "readme-getting-started-link",
            ),
        )
        for relative, old, new, code in cases:
            with self.subTest(code=code):
                original = (self.root / relative).read_text(encoding="utf-8")
                self.mutate(relative, old, new)
                self.assert_rejected(code)
                (self.root / relative).write_text(original, encoding="utf-8")

    def test_setup_structure_and_pretool_guard_are_enforced(self) -> None:
        self.mutate("SETUP.md", "## Guards", "```text\npremature command\n```\n\n## Guards")
        self.assert_rejected("setup-pretool-guard")

        shutil.copy2(SOURCE_ROOT / "SETUP.md", self.root / "SETUP.md")
        self.mutate("SETUP.md", "## Prerequisites", "## Prerequisites Moved")
        self.assert_rejected("setup-section-order")

        shutil.copy2(SOURCE_ROOT / "SETUP.md", self.root / "SETUP.md")
        self.mutate("SETUP.md", "### 13. Why this procedure is strict", "### 15. Why this procedure is strict")
        self.assert_rejected("setup-numbered-order")

    def test_setup_authority_and_route_invariants_are_enforced(self) -> None:
        cases = (
            ("requested operation", "requested task", "setup-authority-state"),
            (
                "An installed executable does not identify the application",
                "An executable may identify the application",
                "setup-host-identity",
            ),
            (
                "Use the direct Codex route only when current evidence identifies Codex",
                "Use the direct Codex route whenever Codex is installed",
                "setup-direct-route-evidence",
            ),
            (
                "Otherwise use the generic-host route automatically",
                "Otherwise choose any convenient route",
                "setup-generic-fallback",
            ),
            (
                "Run one state-changing command at a time",
                "Run the state-changing commands together",
                "setup-one-action",
            ),
            (
                "Do not use `npx`, `npm exec`, `@latest`",
                "You may use `npx`, `npm exec`, `@latest`",
                "setup-no-ephemeral-install",
            ),
            (
                "Setup authority does not authorize analyzing the user's source repositories",
                "Setup authority includes source analysis",
                "setup-source-analysis-boundary",
            ),
            (
                "the user remains the command runner",
                "the agent may become the command runner",
                "setup-generic-user-runner",
            ),
        )
        for old, new, code in cases:
            with self.subTest(code=code):
                original = (self.root / "SETUP.md").read_text(encoding="utf-8")
                self.mutate("SETUP.md", old, new)
                self.assert_rejected(code)
                (self.root / "SETUP.md").write_text(original, encoding="utf-8")

    def test_setup_verification_and_lifecycle_boundaries_are_enforced(self) -> None:
        cases = (
            ("Start a new conversation after installation", "Continue in the same conversation", "setup-clean-session"),
            ("Use this proof ladder", "Use this checklist", "setup-proof-ladder"),
            ("`pending-restart`", "`restart-later`", "setup-pending-restart"),
            ("Classify the first unproven boundary", "Retry immediately", "setup-failure-classification"),
            ("requires an explicit target revision", "may use any available revision", "setup-exact-rollback"),
            (
                "Neither operation authorizes deleting an external context store",
                "Removal includes the external context store",
                "setup-user-data-removal-boundary",
            ),
            ("`npm install` alone is not host registration", "`npm install` performs host registration", "setup-npm-boundary"),
        )
        for old, new, code in cases:
            with self.subTest(code=code):
                original = (self.root / "SETUP.md").read_text(encoding="utf-8")
                self.mutate("SETUP.md", old, new)
                self.assert_rejected(code)
                (self.root / "SETUP.md").write_text(original, encoding="utf-8")

    def test_setup_commands_have_one_owner(self) -> None:
        self.mutate(
            "docs/distribution.md",
            "# Distribution",
            "# Distribution\n\ncodex plugin marketplace add example/repository",
        )
        self.assert_rejected("setup-command-outside-owner")

        shutil.copy2(SOURCE_ROOT / "docs/distribution.md", self.root / "docs/distribution.md")
        self.mutate(
            "SETUP.md",
            "## Background",
            "codex plugin marketplace add elnonathan/please-make-no-mistakes\n\n## Background",
        )
        self.assert_rejected("setup-command-owner")

    def test_security_contribution_and_evidence_boundaries_are_enforced(self) -> None:
        cases = (
            (
                "SECURITY.md",
                "retrieved records are evidence sources, not automatic instructions",
                "retrieved records are automatic instructions",
                "security-boundary",
            ),
            (
                "CONTRIBUTING.md",
                "Blind evaluation inputs must not contain their expected decision",
                "Evaluation inputs may include expected decisions",
                "contributing-blind-evals",
            ),
            (
                "docs/getting-started.md",
                "Neither proves that a particular model followed the skill",
                "Both prove that every model followed the skill",
                "getting-started-evidence-boundary",
            ),
        )
        for relative, old, new, code in cases:
            with self.subTest(code=code):
                original = (self.root / relative).read_text(encoding="utf-8")
                self.mutate(relative, old, new)
                self.assert_rejected(code)
                (self.root / relative).write_text(original, encoding="utf-8")

    def test_host_guard_trust_privacy_and_coverage_boundaries_are_enforced(self) -> None:
        cases = (
            (
                "README.md",
                "optional lifecycle guard",
                "mandatory infallibility guard",
                "readme-bundled-guard",
            ),
            (
                "SETUP.md",
                "Installation or enablement does not trust a non-managed hook automatically",
                "Installation automatically trusts every hook",
                "setup-install-not-hook-trust",
            ),
            (
                "SECURITY.md",
                "does not persist raw prompts, shell commands, tool output, evidence, source text, credentials, or conversation transcripts",
                "may persist raw prompts and commands",
                "security-boundary",
            ),
            (
                "SECURITY.md",
                "replace native sandbox or approval controls",
                "replace every native approval control",
                "security-boundary",
            ),
            (
                "ARCHITECTURE.md",
                "Disabled, untrusted, unsupported, failed, or bypassed paths",
                "Every path is covered",
                "architecture-partial-guard",
            ),
            (
                "docs/distribution.md",
                "This does not execute or trust the installed hook",
                "This automatically executes and trusts the installed hook",
                "distribution-hook-not-trusted",
            ),
            (
                "docs/getting-started.md",
                "The guard is intentionally partial",
                "The guard is complete",
                "getting-started-hook-boundary",
            ),
        )
        for relative, old, new, code in cases:
            with self.subTest(code=code):
                original = (self.root / relative).read_text(encoding="utf-8")
                self.mutate(relative, old, new)
                self.assert_rejected(code)
                (self.root / relative).write_text(original, encoding="utf-8")


if __name__ == "__main__":
    unittest.main(verbosity=2)
