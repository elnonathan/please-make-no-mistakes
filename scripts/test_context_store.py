#!/usr/bin/env python3
"""Adversarial tests for the read-only context-store inspector and planner."""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import inspect
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Optional


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
TOOL = PACKAGE_ROOT / "skills" / "please-make-no-mistakes" / "scripts" / "context_store.py"
SUPPORTED = (
    os.name == "posix"
    and hasattr(os, "O_NOFOLLOW")
    and hasattr(os, "O_DIRECTORY")
    and os.open in getattr(os, "supports_dir_fd", set())
    and os.stat in getattr(os, "supports_dir_fd", set())
    and os.scandir in getattr(os, "supports_fd", set())
)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def load_tool_module() -> Any:
    spec = importlib.util.spec_from_file_location("pmnm_context_store", TOOL)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load context-store runtime.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RuntimeSurfaceTests(unittest.TestCase):
    def test_runtime_contains_no_filesystem_write_primitives(self) -> None:
        source = TOOL.read_text(encoding="utf-8")
        tree = ast.parse(source)
        forbidden_os_calls = {
            "chmod",
            "chown",
            "fchmod",
            "fchown",
            "fsync",
            "link",
            "mkdir",
            "makedirs",
            "remove",
            "rename",
            "renames",
            "replace",
            "rmdir",
            "symlink",
            "truncate",
            "unlink",
            "write",
        }
        forbidden_path_calls = {
            "chmod",
            "hardlink_to",
            "link_to",
            "mkdir",
            "rename",
            "replace",
            "rmdir",
            "symlink_to",
            "touch",
            "unlink",
            "write_bytes",
            "write_text",
        }
        violations: list[str] = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            if isinstance(node.func, ast.Name) and node.func.id == "open":
                violations.append(f"builtin open at line {node.lineno}")
            if not isinstance(node.func, ast.Attribute):
                continue
            if (
                isinstance(node.func.value, ast.Name)
                and node.func.value.id == "os"
                and node.func.attr in forbidden_os_calls
            ):
                violations.append(f"os.{node.func.attr} at line {node.lineno}")
            if node.func.attr in forbidden_path_calls:
                violations.append(f".{node.func.attr} at line {node.lineno}")
        self.assertEqual(violations, [])
        for flag in ("O_WRONLY", "O_RDWR", "O_CREAT", "O_TRUNC", "O_APPEND"):
            self.assertNotIn(flag, source)
        self.assertNotIn("--out", source)
        self.assertNotIn("filesystem_mutated", source)
        self.assertIn("atime", source)

    def test_inspect_streams_without_sorting_or_materializing_directory(self) -> None:
        module = load_tool_module()
        source = inspect.getsource(module.command_inspect)
        self.assertNotIn("sorted(", source)
        self.assertNotIn("list(os.scandir", source)


@unittest.skipUnless(SUPPORTED, "secure POSIX dir_fd traversal is unavailable")
class ContextStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="pmnm-context-test-")
        self.base = Path(self.temp.name).resolve()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_json(self, name: str, value: dict[str, Any], *, mode: int = 0o600) -> Path:
        path = self.base / name
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        path.chmod(mode)
        return path

    def run_tool(
        self, *arguments: str, input_text: Optional[str] = None
    ) -> tuple[int, dict[str, Any], str]:
        environment = dict(os.environ)
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        completed = subprocess.run(
            [sys.executable, os.fspath(TOOL), *arguments],
            cwd=PACKAGE_ROOT,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            input=input_text,
        )
        payload = json.loads(completed.stdout) if completed.stdout.strip().startswith("{") else {}
        return completed.returncode, payload, completed.stdout + completed.stderr

    def plan_request(
        self,
        root: Path,
        operations: list[dict[str, Any]],
        *,
        intent: str = "scaffold",
        name: str = "request.json",
    ) -> Path:
        normalized_operations = [
            {**operation, "purpose": operation.get("purpose", f"test operation {index}")}
            for index, operation in enumerate(operations)
        ]
        return self.write_json(
            name,
            {
                "schema_version": 2,
                "root": os.fspath(root),
                "intent": intent,
                "operations": normalized_operations,
            },
        )

    def snapshot(self) -> dict[str, tuple[Any, ...]]:
        # Access times are intentionally excluded: reads may update atime.
        result: dict[str, tuple[Any, ...]] = {}
        for path in sorted(self.base.rglob("*"), key=lambda item: os.fspath(item)):
            metadata = path.lstat()
            relative = os.fspath(path.relative_to(self.base))
            if stat.S_ISREG(metadata.st_mode):
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
            elif stat.S_ISLNK(metadata.st_mode):
                digest = os.readlink(path)
            else:
                digest = ""
            result[relative] = (
                stat.S_IFMT(metadata.st_mode),
                stat.S_IMODE(metadata.st_mode),
                metadata.st_uid,
                metadata.st_gid,
                metadata.st_size,
                getattr(metadata, "st_mtime_ns", int(metadata.st_mtime * 1_000_000_000)),
                digest,
            )
        return result

    def test_help_exposes_new_read_only_cli(self) -> None:
        code, _, output = self.run_tool("--help")
        self.assertEqual(code, 0, output)
        self.assertIn("{inspect,plan}", output)
        self.assertIn("explicit filesystem writes", output)
        self.assertIn("atime", output)
        self.assertIn("write-file", output)
        self.assertNotIn("--out", output)
        for command in ("apply", "status", "rollback"):
            self.assertNotIn(f"    {command} ", output)

        code, _, output = self.run_tool("plan", "--help")
        self.assertEqual(code, 0, output)
        self.assertIn("--request", output)
        self.assertIn("--stdin", output)
        self.assertNotIn("--out", output)

    def test_removed_out_option_is_rejected_without_creating_artifact(self) -> None:
        root = self.base / "new-store"
        request = self.plan_request(root, [{"op": "mkdir", "path": "notes"}])
        artifact = self.base / "plan.json"
        code, payload, output = self.run_tool(
            "plan", "--request", os.fspath(request), "--out", os.fspath(artifact)
        )
        self.assertEqual(code, 2, output)
        self.assertEqual(payload, {})
        self.assertFalse(artifact.exists())
        self.assertFalse(root.exists())

    def test_plan_accepts_stdin_without_a_request_file(self) -> None:
        root = self.base / "stdin-store"
        request = {
            "schema_version": 2,
            "root": os.fspath(root),
            "intent": "scaffold",
            "operations": [
                {"op": "mkdir", "path": "activity", "purpose": "activity root"},
                {
                    "op": "write-file",
                    "path": "activity/index.md",
                    "purpose": "canonical recovery index",
                    "mode": "create",
                    "content": "# Activity\n",
                },
            ],
        }
        before = self.snapshot()
        code, payload, output = self.run_tool(
            "plan", "--stdin", input_text=json.dumps(request, ensure_ascii=False)
        )
        self.assertEqual(code, 0, output)
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(root.exists())
        self.assertEqual(payload["operations"][1]["purpose"], "canonical recovery index")
        self.assertEqual(payload["operations"][1]["content_review"]["kind"], "complete-text")
        self.assertRegex(payload["source_state_identity"], r"^[0-9a-f]{64}$")

    def test_plan_is_deterministic_reviewable_and_performs_no_writes(self) -> None:
        root = self.base / "new-store"
        secret = "private-plan-content-7f9b"
        request = self.plan_request(
            root,
            [
                {"op": "write-file", "path": "notes/index.md", "mode": "create", "content": secret},
                {"op": "mkdir", "path": "notes"},
            ],
        )
        before = self.snapshot()
        code, first, output = self.run_tool("plan", "--request", os.fspath(request))
        self.assertEqual(code, 0, output)
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(root.exists())
        self.assertEqual(first["status"], "planned-in-memory")
        self.assertFalse(first["writes_performed"])
        self.assertNotIn("filesystem_mutated", first)
        self.assertFalse(first["plan_persisted"])
        self.assertEqual(first["root_effect"]["effect"], "create")
        self.assertEqual([item["op"] for item in first["operations"]], ["mkdir", "write-file"])
        self.assertIn(secret, output)
        self.assertIn(hashlib.sha256(secret.encode()).hexdigest(), output)
        self.assertIn("content_sha256", output)
        self.assertIn("precondition", output)
        self.assertEqual(first["operations"][1]["result_mode_octal"], "0600")
        self.assertNotIn("content_source", output)
        self.assertRegex(first["plan_digest"], r"^[0-9a-f]{64}$")

        code, repeated, output = self.run_tool("plan", "--request", os.fspath(request))
        self.assertEqual(code, 0, output)
        self.assertEqual(repeated, first)

        changed_request = self.plan_request(
            root,
            [
                {"op": "write-file", "path": "notes/index.md", "mode": "create", "content": secret + "!"},
                {"op": "mkdir", "path": "notes"},
            ],
        )
        code, changed, output = self.run_tool("plan", "--request", os.fspath(changed_request))
        self.assertEqual(code, 0, output)
        self.assertNotEqual(changed["plan_digest"], first["plan_digest"])
        self.assertIn(secret + "!", output)

    def test_digest_is_over_exact_canonical_plan_while_summary_stays_reviewable(self) -> None:
        module = load_tool_module()
        root = self.base / "store"
        root.mkdir()
        request = {
            "schema_version": 2,
            "root": os.fspath(root),
            "intent": "adapt",
            "operations": [
                {
                    "op": "write-file",
                    "path": "a.md",
                    "purpose": "test content review",
                    "mode": "create",
                    "content": "secret",
                }
            ],
        }
        plan = module._build_plan(request)
        digest_input = {key: value for key, value in plan.items() if key not in {"plan_digest", "plan_id"}}
        self.assertEqual(plan["plan_digest"], hashlib.sha256(canonical_bytes(digest_input)).hexdigest())
        summary = module._plan_summary(plan)
        serialized = json.dumps(summary, ensure_ascii=False)
        self.assertIn("secret", serialized)
        self.assertIn("content_sha256", serialized)
        self.assertIn("precondition", serialized)
        self.assertEqual(summary["approval_binding"], "one-shot-recompute-required")

    def test_existing_store_noop_is_summarized_without_writes(self) -> None:
        root = self.base / "store"
        root.mkdir(mode=0o700)
        (root / "existing").mkdir(mode=0o700)
        request = self.plan_request(
            root,
            [
                {"op": "mkdir", "path": "existing"},
                {"op": "write-file", "path": "new.md", "mode": "create", "content": "new"},
            ],
            intent="adapt",
        )
        before = self.snapshot()
        code, payload, output = self.run_tool("plan", "--request", os.fspath(request))
        self.assertEqual(code, 0, output)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(payload["root_effect"]["effect"], "noop")
        self.assertEqual(payload["operations"][0]["effect"], "noop")
        self.assertFalse(payload["writes_performed"])
        self.assertFalse((root / "new.md").exists())

    def test_request_must_be_private_and_outside_store(self) -> None:
        root = self.base / "store"
        root.mkdir()
        request = self.plan_request(root, [{"op": "mkdir", "path": "new"}], intent="adapt")
        request.chmod(0o644)
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "unsafe-permissions")

        inside = root / "request.json"
        inside.write_text(
            json.dumps(
                {
                    "schema_version": 2,
                    "root": os.fspath(root),
                    "intent": "adapt",
                    "operations": [{"op": "mkdir", "path": "new", "purpose": "test"}],
                }
            ),
            encoding="utf-8",
        )
        inside.chmod(0o600)
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(inside))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "unsafe-request-location")

        duplicate = self.base / "duplicate.json"
        duplicate.write_text(
            '{"schema_version":2,"schema_version":2,"root":"/unused",'
            '"intent":"scaffold","operations":[]}',
            encoding="utf-8",
        )
        duplicate.chmod(0o600)
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(duplicate))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "invalid-json")

        private_key = "private-field-name-7f9b"
        request = self.write_json(
            "unknown-field.json",
            {
                "schema_version": 2,
                "root": os.fspath(root),
                "intent": "adapt",
                "operations": [{"op": "mkdir", "path": "new", "purpose": "test"}],
                private_key: "value",
            },
        )
        code, payload, output = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "invalid-request")
        self.assertNotIn(private_key, output)

    def test_request_with_hard_link_alias_inside_store_is_rejected(self) -> None:
        root = self.base / "store"
        root.mkdir()
        request = self.plan_request(root, [{"op": "mkdir", "path": "new"}], intent="adapt")
        os.link(request, root / "request-alias.json")
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "unsafe-links")

    def test_replace_and_other_mutations_are_unsupported(self) -> None:
        root = self.base / "store"
        root.mkdir()
        unsupported = [
            {"op": "write-file", "path": "a.md", "mode": "replace", "content": "x"},
            {"op": "delete", "path": "a.md"},
            {"op": "move", "path": "a.md"},
        ]
        for index, operation in enumerate(unsupported):
            request = self.plan_request(root, [operation], intent="modify", name=f"request-{index}.json")
            code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
            self.assertNotEqual(code, 0)
            self.assertEqual(payload["status"], "unsupported-operation")

    def test_unsafe_targets_and_path_complexity_are_rejected(self) -> None:
        root = self.base / "store"
        root.mkdir()
        unsafe = [
            "../escape",
            "/absolute",
            "a\\b",
            "CON",
            "ＣＯＮ",
            "ＣＯＮ．txt",
            "COM¹",
            "COM².txt",
            "LPT³",
            "lpt⁹.log",
            "CONIN$",
            "CONOUT$",
            "NUL .txt",
            "PRN  .md",
            "COM1 .txt",
            "bad:name",
            "a\x00b",
            "trail. ",
        ]
        for index, target in enumerate(unsafe):
            request = self.plan_request(
                root,
                [{"op": "mkdir", "path": target}],
                intent="adapt",
                name=f"unsafe-{index}.json",
            )
            code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
            self.assertNotEqual(code, 0)
            self.assertIn(payload["status"], {"unsafe-target", "invalid-json"})

        module = load_tool_module()
        with self.assertRaises(module.ToolError) as byte_error:
            module._validate_relative_target("a" * (module.MAX_TARGET_BYTES + 1))
        self.assertEqual(byte_error.exception.status_name, "target-too-large")
        with self.assertRaises(module.ToolError) as depth_error:
            module._validate_relative_target("/".join(["a"] * (module.MAX_TARGET_SEGMENTS + 1)))
        self.assertEqual(depth_error.exception.status_name, "target-too-deep")
        with self.assertRaises(module.ToolError) as absolute_error:
            module._absolute_path("/" + "a" * module.MAX_ABSOLUTE_PATH_BYTES, "test")
        self.assertEqual(absolute_error.exception.status_name, "path-too-large")

    def test_planned_and_existing_casefold_unicode_collisions_are_rejected(self) -> None:
        root = self.base / "store"
        root.mkdir()
        cases = [
            [{"op": "mkdir", "path": "Alpha"}, {"op": "mkdir", "path": "alpha"}],
            [{"op": "mkdir", "path": "é"}, {"op": "mkdir", "path": "e\u0301"}],
        ]
        for index, operations in enumerate(cases):
            request = self.plan_request(root, operations, intent="adapt", name=f"collision-{index}.json")
            code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
            self.assertNotEqual(code, 0)
            self.assertEqual(payload["status"], "target-collision")

        (root / "Existing").mkdir()
        request = self.plan_request(root, [{"op": "mkdir", "path": "existing"}], intent="adapt")
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "path-collision")

    def test_missing_parents_and_file_parent_conflicts_are_rejected(self) -> None:
        root = self.base / "store"
        root.mkdir()
        request = self.plan_request(
            root,
            [{"op": "write-file", "path": "a/b.md", "mode": "create", "content": "x"}],
            intent="adapt",
        )
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "missing-parent-operation")

        request = self.plan_request(
            root,
            [
                {"op": "write-file", "path": "a", "mode": "create", "content": "x"},
                {"op": "write-file", "path": "a/b", "mode": "create", "content": "y"},
            ],
            intent="adapt",
            name="file-parent.json",
        )
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "target-conflict")

    def test_content_file_is_digest_bound_utf8_bounded_and_symlink_safe(self) -> None:
        root = self.base / "store"
        root.mkdir()
        source = self.base / "source.txt"
        source.write_text("embedded-content", encoding="utf-8")
        request = self.plan_request(
            root,
            [{"op": "write-file", "path": "copy.md", "mode": "create", "content_file": os.fspath(source)}],
            intent="adapt",
        )
        code, first, output = self.run_tool("plan", "--request", os.fspath(request))
        self.assertEqual(code, 0, output)
        self.assertIn("embedded-content", output)
        self.assertIn(hashlib.sha256(b"embedded-content").hexdigest(), output)
        self.assertIn(os.fspath(source), output)
        source.write_text("changed-content", encoding="utf-8")
        code, changed, output = self.run_tool("plan", "--request", os.fspath(request))
        self.assertEqual(code, 0, output)
        self.assertNotEqual(first["plan_digest"], changed["plan_digest"])
        self.assertNotEqual(first["source_state_identity"], changed["source_state_identity"])

        bad = self.base / "bad.bin"
        bad.write_bytes(b"\xff\xfe")
        request = self.plan_request(
            root,
            [{"op": "write-file", "path": "bad.md", "mode": "create", "content_file": os.fspath(bad)}],
            intent="adapt",
            name="bad-request.json",
        )
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "invalid-content")

        link = self.base / "source-link"
        link.symlink_to(source)
        request = self.plan_request(
            root,
            [{"op": "write-file", "path": "linked.md", "mode": "create", "content_file": os.fspath(link)}],
            intent="adapt",
            name="link-request.json",
        )
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "unsafe-path")

    def test_operation_content_target_and_json_limits(self) -> None:
        root = self.base / "store"
        root.mkdir()

        module = load_tool_module()
        module.MAX_OPERATIONS = 2
        with self.assertRaises(module.ToolError) as operations_error:
            module._build_plan(
                {
                    "schema_version": 2,
                    "root": os.fspath(root),
                    "intent": "adapt",
                    "operations": [
                        {"op": "mkdir", "path": name, "purpose": f"test {name}"}
                        for name in ("a", "b", "c")
                    ],
                }
            )
        self.assertEqual(operations_error.exception.status_name, "invalid-request")

        module = load_tool_module()
        module.MAX_TOTAL_CONTENT_BYTES = 5
        with self.assertRaises(module.ToolError) as content_error:
            module._build_plan(
                {
                    "schema_version": 2,
                    "root": os.fspath(root),
                    "intent": "adapt",
                    "operations": [
                        {"op": "write-file", "path": "a", "purpose": "test a", "mode": "create", "content": "123"},
                        {"op": "write-file", "path": "b", "purpose": "test b", "mode": "create", "content": "456"},
                    ],
                }
            )
        self.assertEqual(content_error.exception.status_name, "content-too-large")

        module = load_tool_module()
        module.MAX_TOTAL_TARGET_BYTES = 3
        with self.assertRaises(module.ToolError) as target_error:
            module._build_plan(
                {
                    "schema_version": 2,
                    "root": os.fspath(root),
                    "intent": "adapt",
                    "operations": [
                        {"op": "mkdir", "path": "aa", "purpose": "test aa"},
                        {"op": "mkdir", "path": "bb", "purpose": "test bb"},
                    ],
                }
            )
        self.assertEqual(target_error.exception.status_name, "target-too-large")

        module = load_tool_module()
        module.MAX_JSON_BYTES = 100
        with self.assertRaises(module.ToolError) as json_error:
            module._build_plan(
                {
                    "schema_version": 2,
                    "root": os.fspath(root),
                    "intent": "adapt",
                    "operations": [
                        {"op": "write-file", "path": "a", "purpose": "test a", "mode": "create", "content": "small"}
                    ],
                }
            )
        self.assertEqual(json_error.exception.status_name, "plan-too-large")

    def test_inspect_is_metadata_only_streaming_and_bounded(self) -> None:
        root = self.base / "store"
        root.mkdir()
        for index in range(200):
            (root / f"entry-{index:03d}").write_text("never-print-this", encoding="utf-8")
        (root / "child").mkdir()
        (root / "child" / "nested.txt").write_text("nested-secret", encoding="utf-8")
        external = self.base / "external"
        external.mkdir()
        (external / "outside.txt").write_text("outside-secret", encoding="utf-8")
        (root / "external-link").symlink_to(external)

        code, payload, output = self.run_tool(
            "inspect", "--root", os.fspath(root), "--max-depth", "0", "--max-entries", "1000"
        )
        self.assertEqual(code, 0, output)
        self.assertFalse(payload["content_opened"])
        self.assertFalse(payload["writes_performed"])
        self.assertTrue(payload["truncation"]["by_depth"])
        self.assertFalse(payload["truncation"]["by_entries"])
        self.assertEqual(payload["ordering"], "filesystem-native")
        self.assertFalse(payload["absence_claim_supported"])
        self.assertFalse(payload["truncated_subset_stable"])
        self.assertIn("external-link", {item["path"] for item in payload["entries"]})
        self.assertNotIn("never-print-this", output)
        self.assertNotIn("nested-secret", output)
        self.assertNotIn("outside.txt", output)

        code, payload, output = self.run_tool(
            "inspect", "--root", os.fspath(root), "--max-entries", "1"
        )
        self.assertEqual(code, 0, output)
        self.assertTrue(payload["truncation"]["by_entries"])
        self.assertEqual(payload["entry_count"], 1)

        module = load_tool_module()
        for flag, value in (
            ("--max-entries", module.MAX_INSPECT_ENTRIES + 1),
            ("--max-depth", module.MAX_INSPECT_DEPTH + 1),
        ):
            code, payload, _ = self.run_tool("inspect", "--root", os.fspath(root), flag, str(value))
            self.assertNotEqual(code, 0)
            self.assertEqual(payload["status"], "invalid-argument")

        module = load_tool_module()
        module.MAX_INSPECT_PATH_BYTES = 5
        bounded = module.command_inspect(
            SimpleNamespace(root=os.fspath(root), max_entries=1000, max_depth=0)
        )
        self.assertTrue(bounded["truncated"])
        self.assertTrue(bounded["truncation"]["by_path_bytes"])

    def test_roots_requests_and_targets_reject_symlinks_or_special_files(self) -> None:
        real = self.base / "real"
        real.mkdir()
        root_link = self.base / "root-link"
        root_link.symlink_to(real)
        code, payload, _ = self.run_tool("inspect", "--root", os.fspath(root_link))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "unsafe-path")

        request = self.plan_request(real, [{"op": "mkdir", "path": "new"}], intent="adapt")
        request_link = self.base / "request-link"
        request_link.symlink_to(request)
        code, payload, _ = self.run_tool("plan", "--request", os.fspath(request_link))
        self.assertNotEqual(code, 0)
        self.assertEqual(payload["status"], "unsafe-path")

        outside = self.base / "outside"
        outside.mkdir()
        (real / "linked").symlink_to(outside)
        fifo = real / "pipe"
        os.mkfifo(fifo)
        for index, target in enumerate(("linked/file", "pipe")):
            request = self.plan_request(
                real,
                [{"op": "mkdir", "path": target}],
                intent="adapt",
                name=f"target-{index}.json",
            )
            code, payload, _ = self.run_tool("plan", "--request", os.fspath(request))
            self.assertNotEqual(code, 0)
            self.assertEqual(payload["status"], "unsafe-target")

    def test_forbidden_roots_are_rejected(self) -> None:
        for root in (Path("/"), Path.home(), PACKAGE_ROOT / "skills" / "please-make-no-mistakes"):
            code, payload, _ = self.run_tool("inspect", "--root", os.fspath(root))
            self.assertNotEqual(code, 0)
            self.assertIn(payload["status"], {"unsafe-root", "unsafe-path"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
