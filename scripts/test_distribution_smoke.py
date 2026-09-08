#!/usr/bin/env python3
"""Adversarial checks for the exact npm distribution smoke test."""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest import mock


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
TOOL = PACKAGE_ROOT / "scripts" / "distribution_smoke.py"
VALIDATOR_TOOL = PACKAGE_ROOT / "scripts" / "validate_skill.py"
POSTPUBLICATION_TOOL = PACKAGE_ROOT / "scripts" / "postpublication_smoke.py"


def load_tool(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path.name}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SMOKE = load_tool("pmnm_distribution_smoke", TOOL)
VALIDATOR = load_tool("pmnm_validate_skill", VALIDATOR_TOOL)
POSTPUBLICATION = load_tool("pmnm_postpublication_smoke", POSTPUBLICATION_TOOL)


class DistributionSmokeTests(unittest.TestCase):
    def test_marketplace_pins_the_exact_npm_release(self) -> None:
        package = SMOKE.load_json(PACKAGE_ROOT / "package.json")
        marketplace = SMOKE.load_json(PACKAGE_ROOT / ".agents" / "plugins" / "marketplace.json")
        entry = marketplace["plugins"][0]
        self.assertEqual(marketplace["name"], "please-make-no-mistakes")
        self.assertEqual(entry["name"], package["name"])
        self.assertEqual(
            entry["source"],
            {
                "source": "npm",
                "package": package["name"],
                "version": package["version"],
                "registry": "https://registry.npmjs.org",
            },
        )

    def test_publish_workflow_has_the_tag_only_oidc_contract(self) -> None:
        workflow = (PACKAGE_ROOT / ".github" / "workflows" / "publish.yml").read_text(encoding="utf-8")
        errors: list[str] = []
        VALIDATOR.validate_publish_workflow_text(workflow, errors)
        self.assertEqual(errors, [])

    def test_publish_workflow_rejects_weakened_release_controls(self) -> None:
        workflow = (PACKAGE_ROOT / ".github" / "workflows" / "publish.yml").read_text(encoding="utf-8")
        mutations = {
            "mutable branch trigger": workflow.replace('- "v*"', '- "main"'),
            "missing OIDC": workflow.replace("  id-token: write\n", ""),
            "foreign repository": workflow.replace(
                "elnonathan/please-make-no-mistakes",
                "someone/example",
            ),
            "long-lived token": workflow + "\n# NODE_AUTH_TOKEN\n",
            "skipped release gate": workflow.replace("run: npm run release:verify", "run: npm run validate"),
            "ignored gate failure": workflow + "\n# continue-on-error: true\n",
            "job permission override": workflow.replace(
                "    runs-on: ubuntu-latest",
                "    permissions:\n      contents: write\n    runs-on: ubuntu-latest",
            ),
            "publication before gate": workflow.replace(
                "run: npm run release:verify",
                "run: __release_gate_placeholder__",
            ).replace(
                "run: npm publish --access public",
                "run: npm run release:verify",
            ).replace(
                "run: __release_gate_placeholder__",
                "run: npm publish --access public",
            ),
        }
        for label, mutated in mutations.items():
            with self.subTest(label=label):
                errors: list[str] = []
                VALIDATOR.validate_publish_workflow_text(mutated, errors)
                self.assertTrue(errors)

    def test_postpublication_identity_matches_all_release_surfaces(self) -> None:
        manifest = SMOKE.load_json(PACKAGE_ROOT / "package.json")
        self.assertEqual(POSTPUBLICATION.release_identity(manifest["version"]), [])

    def test_postpublication_detects_published_byte_drift(self) -> None:
        manifest = SMOKE.load_json(PACKAGE_ROOT / "package.json")
        with tempfile.TemporaryDirectory(prefix="pmnm-published-drift-") as raw:
            installed = Path(raw)
            for relative in SMOKE.expected_payload(manifest):
                source = PACKAGE_ROOT / relative
                target = installed / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
            self.assertFalse(any(POSTPUBLICATION.published_artifact_drift(installed).values()))
            changed = installed / "skills" / manifest["name"] / "SKILL.md"
            changed.write_text(changed.read_text(encoding="utf-8") + "\nchanged\n", encoding="utf-8")
            drift = POSTPUBLICATION.published_artifact_drift(installed)
            self.assertEqual(drift["mismatched"], [f"skills/{manifest['name']}/SKILL.md"])

    def test_postpublication_rejects_mutable_version_requests_without_network(self) -> None:
        output = POSTPUBLICATION.verify("latest")
        self.assertEqual(output["status"], "invalid")
        self.assertEqual(output["checks"][0]["reason"], "version-must-be-exact-semver")

    def test_postpublication_rejects_a_dirty_release_checkout(self) -> None:
        manifest = SMOKE.load_json(PACKAGE_ROOT / "package.json")

        def fake_run(command, *, cwd, environment, timeout=180):
            del cwd, environment, timeout
            if command[:3] == ["git", "rev-parse", "--verify"]:
                return POSTPUBLICATION.result(0, stdout="release-commit\n")
            if command == ["git", "rev-parse", "HEAD"]:
                return POSTPUBLICATION.result(0, stdout="release-commit\n")
            if command == ["git", "status", "--porcelain", "--untracked-files=all"]:
                return POSTPUBLICATION.result(0, stdout=" M README.md\n")
            return POSTPUBLICATION.result(1, stderr=f"unexpected command: {command}")

        with mock.patch.object(POSTPUBLICATION, "run", side_effect=fake_run):
            output = POSTPUBLICATION.verify(manifest["version"])
        self.assertEqual(output["status"], "failed")
        self.assertEqual(output["checks"][-1]["reason"], "release-checkout-not-clean-tag")

    def test_postpublication_distinguishes_network_blockage_from_missing_version(self) -> None:
        unavailable = POSTPUBLICATION.result(1, stderr="getaddrinfo ENOTFOUND registry.npmjs.org")
        missing = POSTPUBLICATION.result(1, stderr="npm ERR! code E404")
        self.assertTrue(POSTPUBLICATION.network_unavailable(unavailable))
        self.assertFalse(POSTPUBLICATION.network_unavailable(missing))

    def test_postpublication_codex_version_parser_is_bounded(self) -> None:
        self.assertEqual(POSTPUBLICATION.parse_codex_version("codex-cli 0.144.4"), (0, 144, 4))
        self.assertIsNone(POSTPUBLICATION.parse_codex_version("codex development build"))

    def test_postpublication_happy_path_is_exact_and_tag_pinned(self) -> None:
        manifest = SMOKE.load_json(PACKAGE_ROOT / "package.json")
        version = manifest["version"]
        commands: list[list[str]] = []
        environments: list[tuple[list[str], dict[str, str]]] = []

        def fake_run(command, *, cwd, environment, timeout=180):
            del timeout
            commands.append(command)
            environments.append((command, dict(environment)))
            if command[:3] == ["git", "rev-parse", "--verify"]:
                return POSTPUBLICATION.result(0, stdout="release-commit\n")
            if command == ["git", "rev-parse", "HEAD"]:
                return POSTPUBLICATION.result(0, stdout="release-commit\n")
            if command == ["git", "status", "--porcelain", "--untracked-files=all"]:
                return POSTPUBLICATION.result(0)
            if command[:2] == ["npm", "view"]:
                return POSTPUBLICATION.result(0, stdout=json.dumps(version))
            if command[:2] == ["npm", "install"]:
                installed = Path(cwd) / "node_modules" / manifest["name"]
                for relative in SMOKE.expected_payload(manifest):
                    source = PACKAGE_ROOT / relative
                    target = installed / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, target)
                return POSTPUBLICATION.result(0)
            if command == ["codex", "--version"]:
                return POSTPUBLICATION.result(0, stdout="codex-cli 0.144.4\n")
            if command[:4] == ["codex", "plugin", "marketplace", "add"]:
                return POSTPUBLICATION.result(0, stdout="{}")
            if command[:3] == ["codex", "plugin", "add"]:
                return POSTPUBLICATION.result(0, stdout="{}")
            if command == ["codex", "plugin", "list", "--json"]:
                return POSTPUBLICATION.result(
                    0,
                    stdout=json.dumps(
                        {
                            "installed": [
                                {
                                    "name": manifest["name"],
                                    "marketplaceName": "please-make-no-mistakes",
                                    "version": version,
                                    "enabled": True,
                                    "source": {
                                        "source": "npm",
                                        "package": manifest["name"],
                                        "version": version,
                                        "registry": "https://registry.npmjs.org",
                                    },
                                    "marketplaceSource": {
                                        "sourceType": "git",
                                        "source": "https://github.com/elnonathan/please-make-no-mistakes.git",
                                    },
                                }
                            ]
                        }
                    ),
                )
            return POSTPUBLICATION.result(1, stderr=f"unexpected command: {command}")

        with mock.patch.object(POSTPUBLICATION, "run", side_effect=fake_run):
            output = POSTPUBLICATION.verify(version)

        self.assertEqual(output["status"], "passed")
        self.assertIn(
            [
                "codex",
                "plugin",
                "marketplace",
                "add",
                "elnonathan/please-make-no-mistakes",
                "--ref",
                f"v{version}",
                "--json",
            ],
            commands,
        )
        self.assertIn(
            ["codex", "plugin", "add", "please-make-no-mistakes@please-make-no-mistakes", "--json"],
            commands,
        )
        self.assertIn(
            ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", f"{manifest['name']}@{version}"],
            commands,
        )
        npm_environment = next(environment for command, environment in environments if command[:2] == ["npm", "install"])
        self.assertEqual(npm_environment["npm_config_registry"], "https://registry.npmjs.org")
        self.assertIn("empty-npmrc", npm_environment["npm_config_userconfig"])
        self.assertNotIn("NODE_AUTH_TOKEN", npm_environment)
        codex_environment = next(environment for command, environment in environments if command == ["codex", "--version"])
        self.assertIn("codex-home", codex_environment["CODEX_HOME"])
        self.assertIn("host-home", codex_environment["HOME"])

    def test_declared_payload_excludes_private_and_repository_only_state(self) -> None:
        manifest = SMOKE.load_json(PACKAGE_ROOT / "package.json")
        payload = SMOKE.expected_payload(manifest)
        self.assertIn(".codex-plugin/plugin.json", payload)
        self.assertIn("hooks/hooks.json", payload)
        self.assertIn("hooks/pmnm-guard.mjs", payload)
        self.assertIn("hooks/pmnm-shell.mjs", payload)
        self.assertIn("skills/please-make-no-mistakes/SKILL.md", payload)
        self.assertNotIn(".agents/plugins/marketplace.json", payload)
        self.assertNotIn(".github/workflows/ci.yml", payload)
        self.assertNotIn(".github/workflows/publish.yml", payload)
        self.assertNotIn("AGENTS.md", payload)
        self.assertFalse(any(path.startswith(".ai/") for path in payload))
        SMOKE.validate_payload_boundary(payload)

    def test_public_boundary_deduplicates_overlapping_file_sets(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-public-overlap-") as raw:
            public_file = Path(raw) / "README.md"
            public_file.write_text("private-overlap-sentinel\n", encoding="utf-8")
            errors: list[str] = []
            with mock.patch.dict(os.environ, {"PMNM_PRIVATE_TERMS": "private-overlap-sentinel"}):
                VALIDATOR.validate_public_boundaries({public_file}, {public_file}, errors)
            self.assertEqual(len(errors), 1)
            self.assertIn("configured private term #1", errors[0])

    def test_public_checkout_validates_without_private_coordination(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-public-checkout-") as raw:
            checkout = Path(raw) / "please-make-no-mistakes"
            shutil.copytree(
                PACKAGE_ROOT,
                checkout,
                ignore=shutil.ignore_patterns(
                    ".git",
                    ".ai",
                    "AGENTS.md",
                    "node_modules",
                    "__pycache__",
                    ".DS_Store",
                ),
            )
            completed = subprocess.run(
                [sys.executable, "scripts/validate_skill.py"],
                cwd=checkout,
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr or completed.stdout)

    def test_payload_boundary_rejects_private_paths(self) -> None:
        for path in (".ai/project/STATUS.md", "AGENTS.md", ".agents/plugins/marketplace.json"):
            with self.subTest(path=path):
                with self.assertRaises(SMOKE.SmokeFailure):
                    SMOKE.validate_payload_boundary({path})

    def test_tar_validation_rejects_traversal_and_links(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-tar-negative-") as raw:
            archive = Path(raw) / "unsafe.tgz"
            with tarfile.open(archive, "w:gz") as package:
                traversal = tarfile.TarInfo("package/../outside")
                traversal.size = 0
                package.addfile(traversal)
            with self.assertRaises(SMOKE.SmokeFailure):
                SMOKE.safe_tar_files(archive)

            archive = Path(raw) / "link.tgz"
            with tarfile.open(archive, "w:gz") as package:
                link = tarfile.TarInfo("package/SKILL.md")
                link.type = tarfile.SYMTYPE
                link.linkname = "../../outside"
                package.addfile(link)
            with self.assertRaises(SMOKE.SmokeFailure):
                SMOKE.safe_tar_files(archive)

    def test_plugin_tree_rejects_mcp_or_version_drift(self) -> None:
        current_version = SMOKE.load_json(PACKAGE_ROOT / "package.json")["version"]
        with tempfile.TemporaryDirectory(prefix="pmnm-plugin-negative-") as raw:
            root = Path(raw)
            (root / ".codex-plugin").mkdir()
            skill = root / "skills" / "please-make-no-mistakes"
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                "---\nname: please-make-no-mistakes\ndescription: test\n---\n",
                encoding="utf-8",
            )
            manifest = {
                "name": "please-make-no-mistakes",
                "version": "0.0.0",
                "description": "test",
                "skills": "./skills/",
                "mcpServers": "./.mcp.json",
            }
            (root / ".codex-plugin" / "plugin.json").write_text(
                json.dumps(manifest),
                encoding="utf-8",
            )
            with self.assertRaises(SMOKE.SmokeFailure):
                SMOKE.validate_plugin_tree(root, "please-make-no-mistakes", current_version)

    def test_plugin_tree_uses_default_hook_discovery(self) -> None:
        manifest = SMOKE.load_json(PACKAGE_ROOT / "package.json")
        with tempfile.TemporaryDirectory(prefix="pmnm-plugin-hook-default-") as raw:
            root = Path(raw)
            shutil.copytree(PACKAGE_ROOT / ".codex-plugin", root / ".codex-plugin")
            shutil.copytree(PACKAGE_ROOT / "skills", root / "skills")
            shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
            plugin_file = root / ".codex-plugin" / "plugin.json"
            plugin = SMOKE.load_json(plugin_file)
            plugin["hooks"] = "./hooks/hooks.json"
            plugin_file.write_text(json.dumps(plugin), encoding="utf-8")
            with self.assertRaisesRegex(
                SMOKE.SmokeFailure,
                "default hooks/hooks.json discovery",
            ):
                SMOKE.validate_plugin_tree(root, manifest["name"], manifest["version"])

    def test_hook_tree_rejects_an_external_runtime_path(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-hook-negative-") as raw:
            root = Path(raw)
            hooks = root / "hooks"
            hooks.mkdir()
            (hooks / "pmnm-guard.mjs").write_text("export {};\n", encoding="utf-8")
            config = {
                "description": "test",
                "hooks": {
                    event: [
                        {
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "node ../outside.mjs",
                                    "commandWindows": "node ..\\outside.mjs",
                                }
                            ]
                        }
                    ]
                    for event in (
                        "SessionStart",
                        "UserPromptSubmit",
                        "PreToolUse",
                        "PostToolUse",
                        "Stop",
                        "Interrupt",
                    )
                },
            }
            (hooks / "hooks.json").write_text(json.dumps(config), encoding="utf-8")
            with self.assertRaises(SMOKE.SmokeFailure):
                SMOKE.validate_hook_tree(root)

    def test_hook_tree_accepts_only_the_fixed_local_module_graph(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-hook-modules-") as raw:
            root = Path(raw)
            shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
            manifest = SMOKE.validate_hook_tree(root)
            self.assertIn("pmnm-guard.mjs", manifest)
            self.assertIn("pmnm-shell.mjs", manifest)

            (root / "hooks" / "unexpected.mjs").write_text("export {};\n", encoding="utf-8")
            with self.assertRaisesRegex(SMOKE.SmokeFailure, "module set"):
                SMOKE.validate_hook_tree(root)

    def test_hook_tree_rejects_an_import_outside_the_fixed_graph(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-hook-import-") as raw:
            root = Path(raw)
            shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
            runtime = root / "hooks" / "pmnm-guard.mjs"
            runtime.write_text(
                runtime.read_text(encoding="utf-8").replace(
                    'from "./pmnm-shell.mjs";',
                    'from "../pmnm-shell.mjs";',
                    1,
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SMOKE.SmokeFailure, "fixed local module graph"):
                SMOKE.validate_hook_tree(root)

    def test_hook_tree_rejects_a_linked_or_oversized_module_graph(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pmnm-hook-linked-") as raw:
            root = Path(raw)
            shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
            shell = root / "hooks" / "pmnm-shell.mjs"
            shell.unlink()
            shell.symlink_to(PACKAGE_ROOT / "hooks" / "pmnm-shell.mjs")
            with self.assertRaisesRegex(SMOKE.SmokeFailure, "missing or linked"):
                SMOKE.validate_hook_tree(root)

        with tempfile.TemporaryDirectory(prefix="pmnm-hook-budget-") as raw:
            root = Path(raw)
            shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
            shell = root / "hooks" / "pmnm-shell.mjs"
            current_total = sum(path.stat().st_size for path in (root / "hooks").glob("*.mjs"))
            padding = max(1, 260_001 - current_total)
            shell.write_text(shell.read_text(encoding="utf-8") + (" " * padding), encoding="utf-8")
            with self.assertRaisesRegex(SMOKE.SmokeFailure, "aggregate inspectable size budget"):
                SMOKE.validate_hook_tree(root)

    def test_source_validator_rejects_runtime_module_graph_drift(self) -> None:
        def validate(root: Path) -> list[str]:
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

        mutations = {
            "missing": lambda hooks: (hooks / "pmnm-shell.mjs").unlink(),
            "unlisted": lambda hooks: (hooks / "unexpected.mjs").write_text("export {};\n", encoding="utf-8"),
            "escaping import": lambda hooks: (hooks / "pmnm-guard.mjs").write_text(
                (hooks / "pmnm-guard.mjs").read_text(encoding="utf-8").replace(
                    'from "./pmnm-shell.mjs";',
                    'from "../pmnm-shell.mjs";',
                    1,
                ),
                encoding="utf-8",
            ),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory(prefix="pmnm-validator-drift-") as raw:
                root = Path(raw)
                shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
                mutate(root / "hooks")
                self.assertTrue(validate(root))

        with tempfile.TemporaryDirectory(prefix="pmnm-validator-link-") as raw:
            root = Path(raw)
            shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
            shell = root / "hooks" / "pmnm-shell.mjs"
            shell.unlink()
            shell.symlink_to(PACKAGE_ROOT / "hooks" / "pmnm-shell.mjs")
            self.assertTrue(any("regular in-package file" in item for item in validate(root)))

        with tempfile.TemporaryDirectory(prefix="pmnm-validator-budget-") as raw:
            root = Path(raw)
            shutil.copytree(PACKAGE_ROOT / "hooks", root / "hooks")
            shell = root / "hooks" / "pmnm-shell.mjs"
            current_total = sum(path.stat().st_size for path in (root / "hooks").glob("*.mjs"))
            shell.write_text(
                shell.read_text(encoding="utf-8") + (" " * max(1, 260_001 - current_total)),
                encoding="utf-8",
            )
            self.assertTrue(any("aggregate inspectable size budget" in item for item in validate(root)))

    def test_real_package_packs_and_installs_in_isolation(self) -> None:
        environment = dict(os.environ)
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        completed = subprocess.run(
            [sys.executable, os.fspath(TOOL)],
            cwd=PACKAGE_ROOT,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr or completed.stdout)
        payload = json.loads(completed.stdout)
        self.assertEqual(payload["status"], "passed")
        self.assertFalse(payload["lifecycle_scripts_declared"])
        self.assertFalse(payload["install_scripts_enabled"])
        self.assertFalse(payload["registry_dependencies_declared"])
        self.assertRegex(payload["host_guard_tree_sha256"], r"^[0-9a-f]{64}$")
        self.assertGreater(payload["payload_files"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
