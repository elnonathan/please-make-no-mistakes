#!/usr/bin/env python3
"""Adversarial checks for the source host-runtime validator."""

from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
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


class PrivateBoundaryTests(unittest.TestCase):
    """Files that customise our own work are ignored locally and never shipped.

    The rule already guarded `.ai/` and `AGENTS.md`. `CLAUDE.md` arrived a month later and was never
    added, so the validator stayed green while that file was neither tracked, ignored nor shipped.
    """

    def boundary(self, raw: str, *, present=(), excluded=(), gitignored=(), packaged=()) -> list[str]:
        root = Path(raw)
        (root / ".git" / "info").mkdir(parents=True)
        (root / ".git" / "info" / "exclude").write_text("".join(f"{name}\n" for name in excluded), encoding="utf-8")
        (root / ".gitignore").write_text("".join(f"{name}\n" for name in gitignored) or "node_modules/\n", encoding="utf-8")
        for name in present:
            target = root / name.rstrip("/")
            if name.endswith("/"):
                target.mkdir(parents=True)
            else:
                target.write_text("local\n", encoding="utf-8")
        payload = {root / name.rstrip("/") for name in packaged}
        errors: list[str] = []
        VALIDATOR.validate_private_boundary(root, payload, errors)
        return errors

    def test_a_local_file_that_is_excluded_passes(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            self.assertEqual(self.boundary(raw, present=["AGENTS.md", "CLAUDE.md"], excluded=["AGENTS.md", "CLAUDE.md"]), [])

    def test_a_local_file_that_is_not_excluded_fails(self) -> None:
        for name in ("AGENTS.md", "CLAUDE.md", ".ai/"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as raw:
                errors = self.boundary(raw, present=[name])
                self.assertTrue(any(repr(name) in error for error in errors), errors)

    def test_a_local_file_listed_in_the_public_gitignore_fails(self) -> None:
        # The tracked .gitignore travels with every clone, so listing a local file there publishes
        # its name. That is the maintainer's reason for keeping these in .git/info/exclude.
        for name in ("AGENTS.md", "CLAUDE.md", ".ai/"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as raw:
                errors = self.boundary(raw, present=[name], excluded=[name], gitignored=[name])
                self.assertTrue(any("not .gitignore" in error for error in errors), errors)

    def test_an_equivalent_public_ignore_pattern_fails(self) -> None:
        # CBR-01. A literal comparison let every Git-equivalent spelling through. A negation is the
        # worst of them: `.gitignore` outranks `.git/info/exclude`, so `!CLAUDE.md` in the public
        # file un-ignores the local one and `git add .` would commit it.
        private = ["AGENTS.md", "CLAUDE.md", ".ai/"]
        for rule in ["/CLAUDE.md", "**/CLAUDE.md", "!CLAUDE.md", "CLAUDE.*",
                     "/AGENTS.md", "**/AGENTS.md", ".ai", "/.ai", "/.ai/", "**/.ai/", "!/.ai/",
                     # Caught only with core.ignorecase=true: on a case-insensitive checkout, which
                     # is the default on macOS and Windows, this exposes the local CLAUDE.md.
                     "!claude.md",
                     # Caught only with core.ignorecase=false: Git on a case-insensitive checkout does
                     # not fold an escaped or bracketed capital, but a case-sensitive clone applies it.
                     "[C]LAUDE.md", "C\\LAUDE.md"]:
            with self.subTest(rule=rule), tempfile.TemporaryDirectory() as raw:
                errors = self.boundary(raw, present=private, excluded=private, gitignored=[rule])
                self.assertTrue(any("not .gitignore" in error for error in errors), errors)

    def test_a_rule_reaching_into_a_private_directory_fails(self) -> None:
        # CBR-04. A rule with an inner slash was refused outright as naming a nested path, so rules
        # rooted at the private directory itself escaped: they publish `.ai` and govern everything
        # under it.
        private = ["AGENTS.md", "CLAUDE.md", ".ai/"]
        for rule in [".ai/**", "/.ai/**", "**/.ai/**", ".ai/*"]:
            with self.subTest(rule=rule), tempfile.TemporaryDirectory() as raw:
                errors = self.boundary(raw, present=private, excluded=private, gitignored=[rule])
                self.assertTrue(any("not .gitignore" in error for error in errors), errors)

    def test_an_escaped_spelling_of_a_private_path_fails(self) -> None:
        # CBR-05. Git lets a backslash escape any character, so `\.ai` means `.ai`. Python's fnmatch
        # kept the backslash literal, and these spellings named the private paths unnoticed.
        private = ["AGENTS.md", "CLAUDE.md", ".ai/"]
        for rule in ["\\.ai/**", "/\\.ai/**", "CLAUDE\\.md", "AGENTS\\.md"]:
            with self.subTest(rule=rule), tempfile.TemporaryDirectory() as raw:
                errors = self.boundary(raw, present=private, excluded=private, gitignored=[rule])
                self.assertTrue(any("not .gitignore" in error for error in errors), errors)

    def test_an_escaped_marker_stays_literal(self) -> None:
        # `\!` and `\#` escape the negation and comment markers. The rule then names a file whose name
        # starts with that character, which is not a private path.
        private = ["AGENTS.md", "CLAUDE.md", ".ai/"]
        for rule in ["\\!CLAUDE.md", "\\#CLAUDE.md", "\\!.ai/", "\\#AGENTS.md"]:
            with self.subTest(rule=rule), tempfile.TemporaryDirectory() as raw:
                self.assertEqual(self.boundary(raw, present=private, excluded=private, gitignored=[rule]), [])

    def test_a_public_ignore_pattern_that_matches_no_private_path_passes(self) -> None:
        private = ["AGENTS.md", "CLAUDE.md", ".ai/"]
        # `CLAUDE.md/` applies to directories only and CLAUDE.md is a file, so Git does not apply it, like
        # `docs/CLAUDE.md`. It was refused by the hand-written matcher in round 2; with Git as the
        # oracle it is judged by what Git does, not by the name it contains.
        for rule in ["node_modules/", ".env.*", "!.env.example", "docs/CLAUDE.md", "# CLAUDE.md", "*.tgz",
                     "docs/.ai/**", "CLAUDE.md/"]:
            with self.subTest(rule=rule), tempfile.TemporaryDirectory() as raw:
                self.assertEqual(self.boundary(raw, present=private, excluded=private, gitignored=[rule]), [])

    def test_a_checkout_without_git_fails_explicitly(self) -> None:
        # CBR-06. Git decides the grammar now, so where it is needed and absent the validator must say
        # it cannot decide rather than pass. A checkout needs Git whether or not private paths exist.
        for present in (["CLAUDE.md"], []):
            with self.subTest(present=present), tempfile.TemporaryDirectory() as raw, mock.patch.object(
                VALIDATOR, "_run_git", side_effect=FileNotFoundError("git")
            ):
                errors = self.boundary(raw, present=present, excluded=present, gitignored=["node_modules/"])
                self.assertTrue(any("Cannot decide" in error for error in errors), errors)

    def test_a_git_timeout_fails_explicitly(self) -> None:
        with tempfile.TemporaryDirectory() as raw, mock.patch.object(
            VALIDATOR, "_run_git", side_effect=subprocess.TimeoutExpired(["git"], 1)
        ):
            errors = self.boundary(raw, present=["CLAUDE.md"], excluded=["CLAUDE.md"], gitignored=["node_modules/"])
            self.assertTrue(any("Cannot decide" in error for error in errors), errors)

    def test_undecidable_git_output_fails_explicitly(self) -> None:
        # Each answer isolates one check: its shape, its coverage of the probed paths, and the source
        # of a match. The answers are built from the probes the validator actually sent.
        def record(source, pattern, path):
            return f"{source}\0{'1' if source else ''}\0{pattern}\0{path}\0"

        def not_four_fields(probes):
            return "garbage"

        def a_path_never_probed(probes):
            return "".join(record("", "", path) for path in probes[:-1]) + record("", "", "elsewhere")

        def a_match_from_outside_the_rule(probes):
            return "".join(
                record(".git/info/exclude", "CLAUDE.md", path) if path == "CLAUDE.md" else record("", "", path)
                for path in probes
            )

        for answer in (not_four_fields, a_path_never_probed, a_match_from_outside_the_rule):
            def run(args, cwd, stdin=None, answer=answer):
                if "init" in args:
                    return subprocess.CompletedProcess(args, 0, "", "")
                return subprocess.CompletedProcess(args, 0, answer(stdin.split("\0")[:-1]), "")

            with self.subTest(case=answer.__name__), tempfile.TemporaryDirectory() as raw, mock.patch.object(
                VALIDATOR, "_run_git", side_effect=run
            ):
                errors = self.boundary(raw, present=["CLAUDE.md"], excluded=["CLAUDE.md"], gitignored=["node_modules/"])
                self.assertTrue(any("Cannot decide" in error for error in errors), (answer.__name__, errors))

    def test_a_rule_that_matches_the_sentinel_anywhere_passes(self) -> None:
        # CBR-07. The sentinel is a fixture name. A rule that matches it under any directory says nothing
        # about the private one, which the same sentinel under a non-private control directory shows.
        private = ["AGENTS.md", "CLAUDE.md", ".ai/"]
        for rule in ["pmnm-*", "*/pmnm-*", "**/pmnm-private-sentinel", "*/*"]:
            with self.subTest(rule=rule), tempfile.TemporaryDirectory() as raw:
                self.assertEqual(self.boundary(raw, present=private, excluded=private, gitignored=[rule]), [])

    def test_a_rule_that_reaches_only_the_private_sentinel_fails(self) -> None:
        private = ["AGENTS.md", "CLAUDE.md", ".ai/"]
        for rule in [".ai/**", ".ai/*", ".ai/pmnm-private-sentinel"]:
            with self.subTest(rule=rule), tempfile.TemporaryDirectory() as raw:
                errors = self.boundary(raw, present=private, excluded=private, gitignored=[rule])
                self.assertTrue(any("not .gitignore" in error for error in errors), errors)

    def test_descendant_hits_are_compared_within_one_case_mode(self) -> None:
        # Git answers per mode. Here one mode reaches only the private descendant and the other only the
        # control one. Pooling the modes would read that as a generic rule and let it pass; within each
        # mode, the first is a rule that targets the private directory.
        def record(source, pattern, path):
            return f"{source}\0{'1' if source else ''}\0{pattern}\0{path}\0"

        def run(args, cwd, stdin=None):
            if "init" in args:
                return subprocess.CompletedProcess(args, 0, "", "")
            probes = stdin.split("\0")[:-1]
            wanted = "/" if "core.ignorecase=false" in args else "control"
            answer = "".join(
                record(".gitignore", "rule", path)
                if (path.startswith(".ai/") if wanted == "/" else path.split("/")[0] != ".ai" and "/" in path)
                else record("", "", path)
                for path in probes
            )
            return subprocess.CompletedProcess(args, 0, answer, "")

        with tempfile.TemporaryDirectory() as raw, mock.patch.object(VALIDATOR, "_run_git", side_effect=run):
            errors = self.boundary(raw, present=[".ai/"], excluded=[".ai/"], gitignored=["rule"])
            self.assertTrue(any("not .gitignore" in error for error in errors), errors)

    def test_an_installed_tree_does_not_need_git(self) -> None:
        # An installed or packed tree has no .git, so no tracked .gitignore can be committed from it.
        with tempfile.TemporaryDirectory() as raw, mock.patch.object(
            VALIDATOR, "_run_git", side_effect=AssertionError("Git must not be called")
        ) as run:
            root = Path(raw)
            (root / ".gitignore").write_text("CLAUDE.md\n", encoding="utf-8")
            errors: list[str] = []
            VALIDATOR.validate_private_boundary(root, set(), errors)
            self.assertEqual(errors, [])
            run.assert_not_called()

    def test_a_local_file_in_the_payload_fails(self) -> None:
        for name in ("AGENTS.md", "CLAUDE.md"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as raw:
                errors = self.boundary(raw, present=[name], excluded=[name], packaged=[name])
                self.assertTrue(any("must not be packaged: " + name in error for error in errors), errors)


class CodexHookDiscoveryTests(unittest.TestCase):
    """The shared package root may carry only the Codex hook file its manifest declares."""

    def manifest_errors(self, root: Path, plugin: dict[str, object]) -> list[str]:
        plugin_file = root / ".codex-plugin" / "plugin.json"
        plugin_file.parent.mkdir(parents=True, exist_ok=True)
        plugin_file.write_text(json.dumps(plugin), encoding="utf-8")
        package_manifest = json.loads((PACKAGE_ROOT / "package.json").read_text(encoding="utf-8"))
        frontmatter = {"name": package_manifest["name"]}
        with (
            mock.patch.object(VALIDATOR, "PLUGIN_FILE", plugin_file),
            mock.patch.object(VALIDATOR, "CONVENTIONAL_HOOK_FILE", root / "hooks" / "hooks.json"),
        ):
            errors: list[str] = []
            VALIDATOR.validate_plugin_manifest(package_manifest, frontmatter, errors)
        return [error for error in errors if "hooks" in error]

    def current_plugin(self) -> dict[str, object]:
        return json.loads((PACKAGE_ROOT / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))

    def test_the_declared_codex_hook_path_passes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-codex-hooks-") as raw:
            self.assertEqual(self.manifest_errors(Path(raw), self.current_plugin()), [])

    def test_a_manifest_without_the_hook_path_fails(self) -> None:
        plugin = self.current_plugin()
        del plugin["hooks"]
        with tempfile.TemporaryDirectory(prefix="pmnm-codex-hooks-") as raw:
            self.assertTrue(self.manifest_errors(Path(raw), plugin))

    def test_a_manifest_naming_another_hook_file_fails(self) -> None:
        plugin = self.current_plugin()
        plugin["hooks"] = "./hooks/hooks.json"
        with tempfile.TemporaryDirectory(prefix="pmnm-codex-hooks-") as raw:
            self.assertTrue(self.manifest_errors(Path(raw), plugin))

    def test_a_conventional_root_hook_file_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-codex-hooks-") as raw:
            root = Path(raw)
            (root / "hooks").mkdir()
            (root / "hooks" / "hooks.json").write_text("{}", encoding="utf-8")
            errors = self.manifest_errors(root, self.current_plugin())
            self.assertTrue(any("must not exist" in error for error in errors), errors)


class ClaudeMarketplaceTests(unittest.TestCase):
    """Claude installs from the repository marketplace exactly like Codex: one pinned npm artifact."""

    def package(self) -> dict[str, object]:
        return json.loads((PACKAGE_ROOT / "package.json").read_text(encoding="utf-8"))

    def current(self) -> dict[str, object]:
        return json.loads((PACKAGE_ROOT / ".claude-plugin" / "marketplace.json").read_text(encoding="utf-8"))

    def marketplace_errors(self, marketplace: dict[str, object]) -> list[str]:
        with tempfile.TemporaryDirectory(prefix="pmnm-claude-marketplace-") as raw:
            target = Path(raw) / "marketplace.json"
            target.write_text(json.dumps(marketplace), encoding="utf-8")
            with mock.patch.object(VALIDATOR, "CLAUDE_MARKETPLACE_FILE", target):
                errors: list[str] = []
                VALIDATOR.validate_claude_marketplace(self.package(), errors)
        return errors

    def test_the_repository_marketplace_passes(self) -> None:
        self.assertEqual(self.marketplace_errors(self.current()), [])

    def test_a_drifted_or_mutable_version_fails(self) -> None:
        for version in ("0.0.9", "latest", "^0.1.0"):
            with self.subTest(version=version):
                marketplace = self.current()
                marketplace["plugins"][0]["source"]["version"] = version
                self.assertTrue(any("same exact npm artifact" in error for error in self.marketplace_errors(marketplace)))

    def test_another_identity_or_source_type_fails(self) -> None:
        renamed = self.current()
        renamed["name"] = "pmnm"
        self.assertTrue(self.marketplace_errors(renamed))
        github = self.current()
        github["plugins"][0]["source"] = {"source": "github", "repo": "elnonathan/please-make-no-mistakes"}
        self.assertTrue(self.marketplace_errors(github))

    def test_an_unexpected_field_fails(self) -> None:
        marketplace = self.current()
        marketplace["plugins"][0]["strict"] = False
        self.assertTrue(self.marketplace_errors(marketplace))

    def test_the_marketplace_is_never_packaged(self) -> None:
        for entry in (".claude-plugin", ".claude-plugin/marketplace.json"):
            with self.subTest(entry=entry):
                manifest = self.package()
                manifest["files"] = [item for item in manifest["files"] if item != ".claude-plugin/plugin.json"] + [entry]
                errors: list[str] = []
                VALIDATOR.validate_manifest(manifest, errors)
                self.assertTrue(any(entry in error for error in errors), errors)


class HostRuntimeValidationTests(unittest.TestCase):
    def validate_copy(self, root: Path) -> list[str]:
        hooks = root / "hooks"
        guard = hooks / "pmnm-guard.mjs"
        shell = hooks / "pmnm-shell.mjs"
        with (
            mock.patch.object(VALIDATOR, "HOOK_CONFIG_FILE", hooks / "codex" / "hooks.json"),
            mock.patch.object(VALIDATOR, "HOOK_RUNTIME_FILE", guard),
            mock.patch.object(VALIDATOR, "HOOK_SHELL_FILE", shell),
            mock.patch.object(VALIDATOR, "HOOK_RUNTIME_FILES", (guard, shell)),
            mock.patch.object(VALIDATOR, "BRAKE_FILE", hooks / "pmnm-brake.mjs"),
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
            shell.write_text(" " * 235_001, encoding="utf-8")
            errors = self.validate_copy(root)
            self.assertTrue(any("module pmnm-shell.mjs exceeds" in item for item in errors))

        with tempfile.TemporaryDirectory(prefix="pmnm-validator-total-budget-") as raw:
            root = self.copied_hooks(raw)
            hooks = root / "hooks"
            shell = hooks / "pmnm-shell.mjs"
            # The aggregate budget covers the two legacy engine modules; the brake has its own.
            current_total = sum((hooks / name).stat().st_size for name in ("pmnm-guard.mjs", "pmnm-shell.mjs"))
            shell.write_text(
                shell.read_text(encoding="utf-8") + (" " * max(1, 260_001 - current_total)),
                encoding="utf-8",
            )
            errors = self.validate_copy(root)
            self.assertTrue(any("aggregate inspectable size budget" in item for item in errors))

    def test_rejects_the_retired_interlock_registration(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-old-registration-") as raw:
            root = self.copied_hooks(raw)
            config_file = root / "hooks" / "codex" / "hooks.json"
            old = json.loads(config_file.read_text(encoding="utf-8"))
            old["hooks"]["SessionStart"] = old["hooks"]["PreToolUse"]
            config_file.write_text(json.dumps(old), encoding="utf-8")
            errors = self.validate_copy(root)
            self.assertTrue(any("register only the brake" in item for item in errors))

    def test_rejects_a_brake_that_reaches_the_network(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-brake-network-") as raw:
            root = self.copied_hooks(raw)
            brake = root / "hooks" / "pmnm-brake.mjs"
            brake.write_text(brake.read_text(encoding="utf-8") + '\nfetch("https://example.com");\n', encoding="utf-8")
            errors = self.validate_copy(root)
            self.assertTrue(any("brake" in item and "forbidden" in item for item in errors))

    def test_rejects_a_brake_that_runs_another_program(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-validator-brake-spawn-") as raw:
            root = self.copied_hooks(raw)
            brake = root / "hooks" / "pmnm-brake.mjs"
            brake.write_text(brake.read_text(encoding="utf-8").replace('spawn("codex", [', 'spawn("sh", [', 1), encoding="utf-8")
            errors = self.validate_copy(root)
            self.assertTrue(any("brake may run only" in item for item in errors))


class SkillCoreTests(unittest.TestCase):
    """SKILL.md is the core an agent holds before any action, and what survives compaction."""

    def copied_skill(self, raw: str) -> Path:
        root = Path(raw) / "skill"
        shutil.copytree(PACKAGE_ROOT / "skills" / "please-make-no-mistakes", root)
        return root

    def errors_for(self, root: Path) -> list[str]:
        errors: list[str] = []
        VALIDATOR.validate_skill_core(errors, root)
        return errors

    def order_line(self, root: Path, order: str) -> tuple[Path, str]:
        for path in [root / "SKILL.md", *sorted((root / "references").glob("*.md"))]:
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.startswith("- " + order + ". "):
                    return path, line
        raise AssertionError(order + " not found")

    def replace(self, path: Path, old: str, new: str) -> None:
        text = path.read_text(encoding="utf-8")
        self.assertIn(old, text)
        path.write_text(text.replace(old, new, 1), encoding="utf-8")

    def test_the_packaged_core_passes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            self.assertEqual(self.errors_for(self.copied_skill(raw)), [])

    def test_a_missing_order_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            path, line = self.order_line(root, "IN-1")
            self.replace(path, line + "\n", "")
            self.assertTrue(any("IN-1 is missing" in item for item in self.errors_for(root)))

    def test_a_changed_order_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            path, line = self.order_line(root, "VE-3")
            self.replace(path, line, line.replace("fail", "pass", 1))
            self.assertTrue(any("VE-3 changed" in item for item in self.errors_for(root)))

    def test_a_duplicated_order_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            _, line = self.order_line(root, "SE-1")
            flow = root / "references" / "flow.md"
            flow.write_text(flow.read_text(encoding="utf-8") + "\n" + line + "\n", encoding="utf-8")
            self.assertTrue(any("SE-1 appears 2 times" in item for item in self.errors_for(root)))

    def test_an_essential_order_outside_the_core_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            path, line = self.order_line(root, "SE-5")
            self.assertEqual(path.name, "SKILL.md")
            self.replace(path, line + "\n", "")
            target = root / "references" / "review-and-security.md"
            target.write_text(target.read_text(encoding="utf-8") + "\n" + line + "\n", encoding="utf-8")
            self.assertTrue(any("Essential order SE-5" in item for item in self.errors_for(root)))

    def test_a_reading_map_path_that_does_not_exist_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            self.replace(root / "SKILL.md", "(references/verification.md)", "(references/verifying.md)")
            errors = self.errors_for(root)
            self.assertTrue(any("references/verifying.md" in item and "does not exist" in item for item in errors))
            self.assertTrue(any("does not name references/verification.md" in item for item in errors))

    def test_the_reading_map_must_come_first(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            skill = root / "SKILL.md"
            text = skill.read_text(encoding="utf-8")
            skill.write_text(text.replace(VALIDATOR.SKILL_MAP_HEADING, "## Map", 1), encoding="utf-8")
            self.assertTrue(any("must open with" in item for item in self.errors_for(root)))

    def test_a_personal_or_absolute_skill_path_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            home = "Users"
            for spelling in ("/" + home + "/someone/.claude/skills/please-make-no-mistakes", "~/.claude/skills/please-make-no-mistakes", "C:\\" + home + "\\someone\\skills"):
                skill = root / "SKILL.md"
                original = skill.read_text(encoding="utf-8")
                skill.write_text(original + "\nReload it from " + spelling + ".\n", encoding="utf-8")
                self.assertTrue(any("personal or absolute path" in item for item in self.errors_for(root)), spelling)
                skill.write_text(original, encoding="utf-8")

    def test_the_core_cap_fails_when_exceeded(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            skill = root / "SKILL.md"
            text = skill.read_text(encoding="utf-8")
            body = VALIDATOR.skill_body(text)
            skill.write_text(text + "x" * (VALIDATOR.SKILL_CORE_CAP - len(body) + 1), encoding="utf-8")
            self.assertTrue(any("core cap" in item for item in self.errors_for(root)))
            self.assertEqual(VALIDATOR.SKILL_CORE_CAP, 12_000)
            self.assertNotIn("name: please-make-no-mistakes", VALIDATOR.skill_body(text), "the cap counted the frontmatter")

    def test_a_critical_map_row_must_say_before_its_step(self) -> None:
        for old, new in (("| verifying |", "| after verifying |"), ("| investigating, planning, implementing |", "| after implementing |"), ("| Before | Read |", "| After | Read |")):
            with self.subTest(old=old), tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
                root = self.copied_skill(raw)
                self.replace(root / "SKILL.md", old, new)
                self.assertTrue(any("before" in item and "reading map" in item for item in self.errors_for(root)), old)

    def test_the_reload_reads_the_core_and_only_the_next_reference(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            skill = root / "SKILL.md"
            skill.write_text(skill.read_text(encoding="utf-8") + "\nReread this file and the references it names.\n", encoding="utf-8")
            self.assertTrue(any("every reference" in item for item in self.errors_for(root)))

    def test_the_verification_only_exception_is_in_the_core(self) -> None:
        exception = "A verification-only task may skip the plan Digest only for an exact non-mutating check the human asked for"
        self.assertTrue(any(exception in phrase for phrase in VALIDATOR.CORE_PHRASES))
        with tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
            root = self.copied_skill(raw)
            skill = root / "SKILL.md"
            text = skill.read_text(encoding="utf-8")
            start = text.index(exception)
            sentence = text[start:text.index("full flow.", start) + len("full flow.")]
            skill.write_text(text.replace(sentence, "", 1), encoding="utf-8")
            self.assertNotIn(exception, skill.read_text(encoding="utf-8"), "the mutation did not remove the exception")
            flow = root / "references" / "flow.md"
            flow.write_text(flow.read_text(encoding="utf-8") + "\n" + sentence + "\n", encoding="utf-8")
            self.assertTrue(any("essential sentence" in item for item in self.errors_for(root)))

    def test_the_essential_sentences_are_required(self) -> None:
        for phrase in VALIDATOR.CORE_PHRASES:
            with self.subTest(phrase=phrase[:40]), tempfile.TemporaryDirectory(prefix="pmnm-core-") as raw:
                root = self.copied_skill(raw)
                self.replace(root / "SKILL.md", phrase, "")
                self.assertTrue(any("essential sentence" in item for item in self.errors_for(root)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
