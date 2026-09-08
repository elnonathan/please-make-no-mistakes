#!/usr/bin/env python3
"""Build and verify the exact npm plugin artifact in isolation."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_FILE = PACKAGE_ROOT / "package.json"
IGNORED_SOURCE_NAMES = {".git", "node_modules", "__pycache__"}
FORBIDDEN_PACKAGE_PARTS = {".ai", ".agents", ".git", ".github", "__pycache__", "node_modules"}
FORBIDDEN_PACKAGE_FILES = {"AGENTS.md", ".DS_Store", ".env", ".npmrc", ".pypirc"}
MAX_PACKAGE_FILES = 500
MAX_PACKAGE_BYTES = 25_000_000


class SmokeFailure(Exception):
    """A bounded distribution verification failure."""


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise SmokeFailure(f"cannot read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise SmokeFailure(f"JSON root must be an object: {path}")
    return value


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_manifest(root: Path) -> dict[str, str]:
    manifest: dict[str, str] = {}
    total_bytes = 0
    for path in sorted(root.rglob("*"), key=lambda item: item.as_posix()):
        relative = path.relative_to(root).as_posix()
        mode = path.lstat().st_mode
        if stat.S_ISDIR(mode):
            continue
        if not stat.S_ISREG(mode):
            raise SmokeFailure(f"special or linked entry in plugin tree: {relative}")
        total_bytes += path.stat().st_size
        if total_bytes > MAX_PACKAGE_BYTES:
            raise SmokeFailure("plugin tree exceeds the bounded byte limit")
        manifest[relative] = hash_file(path)
    if len(manifest) > MAX_PACKAGE_FILES:
        raise SmokeFailure("plugin tree exceeds the bounded file-count limit")
    return manifest


def add_source_tree(path: Path, payload: set[str]) -> None:
    if not os.path.lexists(path):
        raise SmokeFailure(f"declared package path does not exist: {path.relative_to(PACKAGE_ROOT)}")
    mode = path.lstat().st_mode
    if stat.S_ISLNK(mode) or not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
        raise SmokeFailure(f"declared package path is not a regular file or directory: {path}")
    if stat.S_ISREG(mode):
        payload.add(path.relative_to(PACKAGE_ROOT).as_posix())
        return
    for current, directories, files in os.walk(path, followlinks=False):
        current_path = Path(current)
        directories[:] = [name for name in directories if name not in IGNORED_SOURCE_NAMES]
        for name in files:
            child = current_path / name
            child_mode = child.lstat().st_mode
            if not stat.S_ISREG(child_mode):
                raise SmokeFailure(
                    f"special or linked entry in declared package tree: "
                    f"{child.relative_to(PACKAGE_ROOT).as_posix()}"
                )
            payload.add(child.relative_to(PACKAGE_ROOT).as_posix())


def expected_payload(manifest: dict[str, Any]) -> set[str]:
    result = {"package.json"}
    for pattern in ("[Rr][Ee][Aa][Dd][Mm][Ee]*", "[Ll][Ii][Cc][Ee][Nn][Ss][Ee]*"):
        for path in PACKAGE_ROOT.glob(pattern):
            if path.is_file() and not path.is_symlink():
                result.add(path.relative_to(PACKAGE_ROOT).as_posix())
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise SmokeFailure("package.json files must be a non-empty array")
    for raw in entries:
        if not isinstance(raw, str) or not raw:
            raise SmokeFailure("package.json files entries must be non-empty strings")
        relative = PurePosixPath(raw)
        if relative.is_absolute() or ".." in relative.parts:
            raise SmokeFailure(f"package.json files entry escapes the package: {raw!r}")
        add_source_tree(PACKAGE_ROOT / Path(*relative.parts), result)
    return result


def validate_payload_boundary(paths: set[str]) -> None:
    for value in sorted(paths):
        path = PurePosixPath(value)
        if path.name in FORBIDDEN_PACKAGE_FILES:
            raise SmokeFailure(f"forbidden file in package payload: {value}")
        if any(part in FORBIDDEN_PACKAGE_PARTS for part in path.parts):
            raise SmokeFailure(f"private or generated path in package payload: {value}")


def safe_tar_files(archive: Path) -> tuple[set[str], int]:
    files: set[str] = set()
    total_bytes = 0
    with tarfile.open(archive, mode="r:gz") as package:
        for member in package.getmembers():
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts:
                raise SmokeFailure(f"unsafe tar path: {member.name}")
            if not path.parts or path.parts[0] != "package":
                raise SmokeFailure(f"tar entry is outside package/: {member.name}")
            if member.isdir():
                continue
            if not member.isfile():
                raise SmokeFailure(f"linked or special tar entry: {member.name}")
            relative = PurePosixPath(*path.parts[1:]).as_posix()
            if not relative or relative in files:
                raise SmokeFailure(f"duplicate or empty tar entry: {member.name}")
            files.add(relative)
            total_bytes += member.size
    if len(files) > MAX_PACKAGE_FILES:
        raise SmokeFailure("npm archive exceeds the bounded file-count limit")
    if total_bytes > MAX_PACKAGE_BYTES:
        raise SmokeFailure("npm archive exceeds the bounded byte limit")
    validate_payload_boundary(files)
    return files, total_bytes


def extract_safe(archive: Path, destination: Path) -> Path:
    safe_tar_files(archive)
    with tarfile.open(archive, mode="r:gz") as package:
        package.extractall(destination)
    root = destination / "package"
    if not root.is_dir():
        raise SmokeFailure("npm archive did not extract a package root")
    return root


def parse_skill_name(skill_file: Path) -> str:
    try:
        lines = skill_file.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        raise SmokeFailure(f"cannot read installed SKILL.md: {exc}") from exc
    if not lines or lines[0] != "---":
        raise SmokeFailure("installed SKILL.md is missing frontmatter")
    try:
        end = lines.index("---", 1)
    except ValueError as exc:
        raise SmokeFailure("installed SKILL.md frontmatter is not closed") from exc
    for line in lines[1:end]:
        if line.startswith("name:"):
            return line.split(":", 1)[1].strip().strip(chr(34) + chr(39))
    raise SmokeFailure("installed SKILL.md is missing name")


def validate_hook_tree(root: Path) -> dict[str, str]:
    config = load_json(root / "hooks" / "hooks.json")
    if set(config) != {"description", "hooks"}:
        raise SmokeFailure("hook config must contain exactly description and hooks")
    hooks = config.get("hooks")
    expected_events = {
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "Stop",
        "Interrupt",
    }
    if not isinstance(hooks, dict) or set(hooks) != expected_events:
        raise SmokeFailure("hook config lifecycle event set is incomplete or unexpected")
    expected_command = 'node "${PLUGIN_ROOT}/hooks/pmnm-guard.mjs"'
    expected_windows = 'node "${PLUGIN_ROOT}\\hooks\\pmnm-guard.mjs"'
    for event_name, groups in hooks.items():
        if not isinstance(groups, list) or len(groups) != 1 or not isinstance(groups[0], dict):
            raise SmokeFailure(f"hook event {event_name} must contain one group")
        handlers = groups[0].get("hooks")
        if not isinstance(handlers, list) or len(handlers) != 1 or not isinstance(handlers[0], dict):
            raise SmokeFailure(f"hook event {event_name} must contain one handler")
        handler = handlers[0]
        if (
            handler.get("type") != "command"
            or handler.get("command") != expected_command
            or handler.get("commandWindows") != expected_windows
        ):
            raise SmokeFailure(f"hook event {event_name} does not resolve the bundled runtime")
    runtime_names = ("pmnm-guard.mjs", "pmnm-shell.mjs")
    hook_root = root / "hooks"
    actual_runtime_names = tuple(sorted(path.name for path in hook_root.iterdir() if path.suffix == ".mjs"))
    if actual_runtime_names != tuple(sorted(runtime_names)):
        raise SmokeFailure("bundled host guard module set is missing or unexpected")
    runtimes = {name: hook_root / name for name in runtime_names}
    for name, runtime in runtimes.items():
        if runtime.is_symlink() or not runtime.is_file():
            raise SmokeFailure(f"bundled host guard module {name} is missing or linked")
        # Keep in step with validate_skill.py. The reviewed 0.1.0 ceiling is a
        # packaging bound, not security evidence or an automatic future ratchet.
        if runtime.stat().st_size > 230_000:
            raise SmokeFailure(f"bundled host guard module {name} exceeds its inspectable size budget")
    if sum(runtime.stat().st_size for runtime in runtimes.values()) > 260_000:
        raise SmokeFailure("bundled host guard modules exceed their aggregate inspectable size budget")
    runtime_text = runtimes["pmnm-guard.mjs"].read_text(encoding="utf-8")
    shell_text = runtimes["pmnm-shell.mjs"].read_text(encoding="utf-8")
    import_pattern = r'(?:from\s+|import\s*\()\s*["\']([^"\']+)["\']'
    runtime_imports = re.findall(import_pattern, runtime_text)
    shell_imports = re.findall(import_pattern, shell_text)
    local_imports = [item for item in runtime_imports if not item.startswith("node:")]
    if local_imports != ["./pmnm-shell.mjs"] or any(not item.startswith("node:") for item in shell_imports):
        raise SmokeFailure("bundled host guard imports must match the fixed local module graph")
    combined_runtime = runtime_text + "\n" + shell_text
    for forbidden in ("fetch(", "http://", "https://", "execSync(", "execFile(", "spawn("):
        if forbidden in combined_runtime:
            raise SmokeFailure(f"bundled host guard contains forbidden data or execution dependency: {forbidden}")
    transcript_bounds = ("R_MAX_TRANSCRIPT_TAIL_BYTES", "R_MAX_TRANSCRIPT_LINE_BYTES", "R_MAX_TRANSCRIPT_MESSAGE_BYTES")
    if combined_runtime.count("transcript_path") != 1 or "transcript_path" in shell_text or any(item not in runtime_text for item in transcript_bounds):
        raise SmokeFailure("bundled Codex transcript recovery must use its single bounded guard-only path")
    child_process_import = 'import { spawnSync } from "node:child_process";'
    fixed_git_call = 'spawnSync("git", ["--no-optional-locks", ...args], {'
    if (
        runtime_text.count(child_process_import) != 1
        or combined_runtime.count("spawnSync(") != 1
        or runtime_text.count(fixed_git_call) != 1
    ):
        raise SmokeFailure("bundled host guard may spawn only the fixed Git fingerprint provider")
    return tree_manifest(root / "hooks")


def validate_plugin_tree(root: Path, expected_name: str, expected_version: str) -> dict[str, str]:
    manifest = load_json(root / ".codex-plugin" / "plugin.json")
    if manifest.get("name") != expected_name:
        raise SmokeFailure("plugin name does not match package name")
    if manifest.get("version") != expected_version:
        raise SmokeFailure("plugin version does not match package version")
    if manifest.get("skills") != "./skills/":
        raise SmokeFailure("plugin must expose the canonical ./skills/ directory")
    if "hooks" in manifest:
        raise SmokeFailure("plugin must use default hooks/hooks.json discovery")
    for unsupported in ("apps", "mcpServers"):
        if unsupported in manifest:
            raise SmokeFailure(f"plugin unexpectedly declares {unsupported}")
    validate_hook_tree(root)
    skill_root = root / "skills" / expected_name
    if parse_skill_name(skill_root / "SKILL.md") != expected_name:
        raise SmokeFailure("installed skill identity does not match plugin identity")
    validate_payload_boundary(set(tree_manifest(root)))
    return tree_manifest(skill_root)


def run(command: list[str], cwd: Path, environment: dict[str, str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            cwd=cwd,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise SmokeFailure(f"command could not complete: {command[0]}: {exc}") from exc


def run_smoke() -> dict[str, Any]:
    package_manifest = load_json(PACKAGE_FILE)
    name = package_manifest.get("name")
    version = package_manifest.get("version")
    if not isinstance(name, str) or not isinstance(version, str):
        raise SmokeFailure("package name and version must be strings")
    scripts = package_manifest.get("scripts", {})
    lifecycle_names = {
        "preinstall",
        "install",
        "postinstall",
        "prepack",
        "prepare",
        "postpack",
        "prepublish",
        "prepublishOnly",
        "publish",
        "postpublish",
    }
    declared_lifecycle = (
        sorted(lifecycle_names.intersection(scripts))
        if isinstance(scripts, dict)
        else ["invalid-scripts-object"]
    )
    if declared_lifecycle:
        raise SmokeFailure(f"package declares lifecycle scripts: {declared_lifecycle}")
    dependency_fields = ("dependencies", "optionalDependencies", "bundleDependencies")
    declared_dependencies = {
        field: package_manifest[field]
        for field in dependency_fields
        if package_manifest.get(field)
    }
    if declared_dependencies:
        raise SmokeFailure(f"plugin artifact declares runtime registry dependencies: {declared_dependencies}")

    source_payload = expected_payload(package_manifest)
    validate_payload_boundary(source_payload)
    environment = dict(os.environ)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"

    with tempfile.TemporaryDirectory(prefix="pmnm-distribution-") as raw:
        base = Path(raw).resolve()
        cache = base / "npm-cache"
        pack_directory = base / "pack"
        extract_directory = base / "extract"
        consumer = base / "consumer"
        pack_directory.mkdir()
        extract_directory.mkdir()
        consumer.mkdir()

        packed = run(
            [
                "npm",
                "pack",
                "--json",
                "--ignore-scripts",
                "--pack-destination",
                os.fspath(pack_directory),
                "--cache",
                os.fspath(cache),
            ],
            PACKAGE_ROOT,
            environment,
        )
        if packed.returncode != 0:
            raise SmokeFailure(f"npm pack failed: {packed.stderr.strip() or packed.stdout.strip()}")
        try:
            pack_result = json.loads(packed.stdout)
            filename = pack_result[0]["filename"]
        except (json.JSONDecodeError, IndexError, KeyError, TypeError) as exc:
            raise SmokeFailure(f"npm pack returned unexpected JSON: {exc}") from exc
        archive = pack_directory / Path(filename).name
        if not archive.is_file():
            raise SmokeFailure("npm pack did not create the declared archive")

        tar_files, tar_bytes = safe_tar_files(archive)
        if tar_files != source_payload:
            missing = sorted(source_payload - tar_files)
            unexpected = sorted(tar_files - source_payload)
            raise SmokeFailure(
                f"npm payload differs from package.json allowlist: "
                f"missing={missing[:20]}, unexpected={unexpected[:20]}"
            )

        extracted = extract_safe(archive, extract_directory)
        packed_skill = validate_plugin_tree(extracted, name, version)
        packed_hooks = validate_hook_tree(extracted)

        (consumer / "package.json").write_text(
            json.dumps({"name": "pmnm-isolated-consumer", "private": True}) + "\n",
            encoding="utf-8",
        )
        installed = run(
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--cache",
                os.fspath(cache),
                os.fspath(archive),
            ],
            consumer,
            environment,
        )
        if installed.returncode != 0:
            raise SmokeFailure(
                f"isolated npm install failed: {installed.stderr.strip() or installed.stdout.strip()}"
            )
        installed_root = consumer / "node_modules" / name
        installed_skill = validate_plugin_tree(installed_root, name, version)
        installed_hooks = validate_hook_tree(installed_root)
        if tree_manifest(extracted) != tree_manifest(installed_root):
            raise SmokeFailure("installed plugin bytes differ from the packed plugin bytes")
        if packed_skill != installed_skill:
            raise SmokeFailure("installed skill bytes differ from the packed skill bytes")
        if packed_hooks != installed_hooks:
            raise SmokeFailure("installed host guard bytes differ from the packed host guard bytes")

        skill_digest = hashlib.sha256(
            json.dumps(packed_skill, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        hook_digest = hashlib.sha256(
            json.dumps(packed_hooks, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        return {
            "status": "passed",
            "package": f"{name}@{version}",
            "archive_sha256": hash_file(archive),
            "payload_files": len(tar_files),
            "payload_bytes": tar_bytes,
            "skill_tree_sha256": skill_digest,
            "host_guard_tree_sha256": hook_digest,
            "lifecycle_scripts_declared": False,
            "install_scripts_enabled": False,
            "registry_dependencies_declared": False,
        }


def main() -> int:
    try:
        result = run_smoke()
    except SmokeFailure as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, sort_keys=True))
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
