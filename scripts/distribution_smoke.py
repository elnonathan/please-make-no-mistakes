#!/usr/bin/env python3
"""Build and verify the exact npm plugin artifact in isolation."""

from __future__ import annotations

import hashlib
import importlib.util
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
def _private_local_paths() -> tuple[str, ...]:
    """Local-work paths, read from the one authority that owns them.

    `validate_skill.py` defines `PRIVATE_LOCAL_PATHS`. This boundary used to keep its own list, which
    never learned `CLAUDE.md`; reading the authority means a new local file is forbidden here the
    moment it is declared there.
    """
    spec = importlib.util.spec_from_file_location(
        "pmnm_private_path_authority", Path(__file__).resolve().with_name("validate_skill.py")
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load the private-path authority in validate_skill.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.PRIVATE_LOCAL_PATHS)


PRIVATE_LOCAL_PATHS = _private_local_paths()
FORBIDDEN_PACKAGE_PARTS = {".agents", ".git", ".github", "__pycache__", "node_modules"} | {
    name.rstrip("/") for name in PRIVATE_LOCAL_PATHS if name.endswith("/")
}
FORBIDDEN_PACKAGE_FILES = {".DS_Store", ".env", ".npmrc", ".pypirc"} | {
    name for name in PRIVATE_LOCAL_PATHS if not name.endswith("/")
}
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


def validate_declared_test_surface(manifest: dict, paths: set[str]) -> None:
    """Every script the installed package's own `npm test` names must be a file it ships.

    The repository gate and the installed artifact's test surface are not the same thing:
    `release:verify` runs its own list and never runs `npm test`, so a test chain can name a file
    that no user receives and stay green here. A check whose file is absent is not a weaker check,
    it is a command that fails on the first line.
    """
    declared = str(manifest.get("scripts", {}).get("test", ""))
    missing = sorted(
        {
            reference
            for reference in re.findall(r"scripts/[A-Za-z0-9_./-]+\.(?:py|mjs)", declared)
            if reference not in paths
        }
    )
    if missing:
        raise SmokeFailure(
            "the declared npm test surface names files the package does not ship: " + ", ".join(missing)
        )


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


CODEX_HOOK_CONFIG = Path("hooks") / "codex" / "hooks.json"
CODEX_HOOK_MANIFEST_PATH = "./hooks/codex/hooks.json"
# Claude Code merges a conventional hooks/hooks.json into any plugin root that carries one.
CONVENTIONAL_HOOK_CONFIG = Path("hooks") / "hooks.json"


def validate_codex_hook_tree(root: Path) -> dict[str, str]:
    if (root / CONVENTIONAL_HOOK_CONFIG).exists():
        raise SmokeFailure("the artifact must not carry a conventional hooks/hooks.json")
    config_file = root / CODEX_HOOK_CONFIG
    if config_file.is_symlink() or not config_file.is_file():
        raise SmokeFailure("the Codex hook config must be a regular file at hooks/codex/hooks.json")
    config = load_json(config_file)
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
        # Keep in step with validate_skill.py. Ratified 2026-09-17: 235,000 bytes
        # per shared runtime module, aggregate held at 260,000. Both numbers are
        # inspectability triggers bounding what a human can review in one sitting.
        # Neither is security evidence and neither escalates automatically; the
        # next response to growth is a reviewed module split.
        if runtime.stat().st_size > 235_000:
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



# --- Claude host branch ------------------------------------------------------
# These assertions are a sibling of the Codex branch above. They never relax a
# Codex assertion and the two are never merged into a permissive union.

CLAUDE_ENTRY = "hooks/claude/pmnm-claude.mjs"
CLAUDE_CONFIG = "hooks/claude/hooks.json"
CLAUDE_MANIFEST = ".claude-plugin/plugin.json"
CLAUDE_COMMAND = 'node "${CLAUDE_PLUGIN_ROOT}/hooks/claude/pmnm-claude.mjs"'
CLAUDE_EVENTS = {
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "Stop",
}
CLAUDE_CATCH_ALL_EVENTS = {"PreToolUse", "PostToolUse", "PostToolUseFailure", "UserPromptSubmit", "Stop"}
CLAUDE_SESSION_MATCHER = "startup|resume|clear|compact|fork"
# Events whose spinner names the acting capability, mirroring the Codex convention.
CLAUDE_NAMED_EVENTS = {"SessionStart", "PreToolUse"}
CLAUDE_ENTRY_MAX_BYTES = 40_000
CLAUDE_CONFIG_MAX_BYTES = 16_000
CLAUDE_MANIFEST_MAX_BYTES = 16_000
CLAUDE_AGGREGATE_MAX_BYTES = 72_000
CLAUDE_ALLOWED_IMPORTS = ("node:fs", "node:os", "node:path", "node:url", "../pmnm-guard.mjs")
CLAUDE_FORBIDDEN_TOKENS = (
    "child_process",
    "node:net",
    "node:http",
    "node:https",
    "node:tls",
    "node:dgram",
    "node:worker_threads",
    "node:vm",
    "node:repl",
    "createRequire",
    "require(",
    "process.binding",
    "spawnSync(",
    "spawn(",
    "execSync(",
    "execFile(",
    "exec(",
    "fetch(",
    "http://",
    "https://",
    "eval(",
    "new Function",
)


# Every static import form is recognized, including a side-effect import that
# binds no name. An import statement the recognizer cannot classify fails closed
# rather than leaving the extracted graph silently short.
CLAUDE_IMPORT_STATEMENT = re.compile(r'''^[ \t]*import\b(?!\s*[.(])''', re.MULTILINE)
CLAUDE_IMPORT_SIDE_EFFECT = re.compile(r'''^[ \t]*import\s+["']([^"']+)["']\s*;?[ \t]*$''', re.MULTILINE)
CLAUDE_IMPORT_BINDING = re.compile(
    r'''^[ \t]*import\s+[^;"'\n]+?\s+from\s*["']([^"']+)["']\s*;?[ \t]*$''', re.MULTILINE
)
CLAUDE_EXPORT_FROM = re.compile(r'''^[ \t]*export\b[^;\n]*?\bfrom\s*["']([^"']+)["']''', re.MULTILINE)


def claude_static_imports(text: str) -> list[str]:
    statements = [match.start() for match in CLAUDE_IMPORT_STATEMENT.finditer(text)]
    recognized = {match.start() for match in CLAUDE_IMPORT_SIDE_EFFECT.finditer(text)}
    recognized |= {match.start() for match in CLAUDE_IMPORT_BINDING.finditer(text)}
    unrecognized = [start for start in statements if start not in recognized]
    if unrecognized:
        line = text.count("\n", 0, unrecognized[0]) + 1
        raise SmokeFailure(f"unrecognized static import syntax in the Claude adapter at line {line}")
    return (
        CLAUDE_IMPORT_SIDE_EFFECT.findall(text)
        + CLAUDE_IMPORT_BINDING.findall(text)
        + CLAUDE_EXPORT_FROM.findall(text)
    )


def validate_manifest_precedence(root: Path) -> None:
    """Codex resolves .codex-plugin before .claude-plugin. That order is an
    invariant of this package, not an observation made once at install time."""
    codex_manifest = root / ".codex-plugin" / "plugin.json"
    claude_manifest = root / CLAUDE_MANIFEST
    if not claude_manifest.is_file():
        raise SmokeFailure("the Claude manifest is missing from the package")
    if not codex_manifest.is_file():
        raise SmokeFailure(
            "manifest precedence is broken: .codex-plugin/plugin.json must exist so Codex never "
            "resolves .claude-plugin/plugin.json and routes its lifecycle at the Claude entry"
        )
    for manifest in (codex_manifest, claude_manifest):
        if manifest.is_symlink() or not manifest.is_file():
            raise SmokeFailure(f"plugin manifest is missing or linked: {manifest.name}")


def validate_claude_hook_tree(root: Path, expected_name: str, expected_version: str) -> dict[str, str]:
    manifest_file = root / CLAUDE_MANIFEST
    if manifest_file.is_symlink() or not manifest_file.is_file():
        raise SmokeFailure("the Claude plugin manifest is missing or linked")
    manifest = load_json(manifest_file)
    if manifest.get("name") != expected_name:
        raise SmokeFailure("Claude plugin name does not match package name")
    if manifest.get("version") != expected_version:
        raise SmokeFailure("Claude plugin version does not match package version")
    if manifest.get("hooks") != "./hooks/claude/hooks.json":
        raise SmokeFailure("the Claude manifest must route hooks at ./hooks/claude/hooks.json")
    for unsupported in ("skills", "mcpServers", "agents", "commands", "lspServers", "workflows", "outputStyles"):
        if unsupported in manifest:
            raise SmokeFailure(f"the Claude manifest unexpectedly declares {unsupported}")

    config_file = root / CLAUDE_CONFIG
    entry_file = root / CLAUDE_ENTRY
    for path in (config_file, entry_file):
        if path.is_symlink() or not path.is_file():
            raise SmokeFailure(f"bundled Claude adapter file is missing or linked: {path.name}")

    config = load_json(config_file)
    if set(config) != {"hooks"}:
        raise SmokeFailure("the Claude hook config must contain exactly hooks")
    hooks = config.get("hooks")
    if not isinstance(hooks, dict) or set(hooks) != CLAUDE_EVENTS:
        raise SmokeFailure("the Claude lifecycle event set is incomplete or unexpected")
    for event_name, groups in hooks.items():
        if not isinstance(groups, list) or len(groups) != 1 or not isinstance(groups[0], dict):
            raise SmokeFailure(f"Claude event {event_name} must contain one group")
        group = groups[0]
        if event_name in CLAUDE_CATCH_ALL_EVENTS:
            if "matcher" in group:
                raise SmokeFailure(
                    f"Claude event {event_name} must stay catch-all so an unsupported tool cannot bypass by name"
                )
        elif group.get("matcher") != CLAUDE_SESSION_MATCHER:
            raise SmokeFailure(f"Claude event {event_name} does not declare its exact matcher")
        handlers = group.get("hooks")
        if not isinstance(handlers, list) or len(handlers) != 1 or not isinstance(handlers[0], dict):
            raise SmokeFailure(f"Claude event {event_name} must contain one handler")
        handler = handlers[0]
        allowed = {"type", "command", "timeout"} | ({"statusMessage"} if event_name in CLAUDE_NAMED_EVENTS else set())
        if set(handler) != allowed:
            raise SmokeFailure(f"Claude event {event_name} declares unexpected handler fields")
        if event_name in CLAUDE_NAMED_EVENTS and not str(handler.get("statusMessage", "")).startswith("Please, "):
            raise SmokeFailure(f"Claude event {event_name} must name the acting PMNM capability")
        if handler.get("type") != "command" or handler.get("command") != CLAUDE_COMMAND:
            raise SmokeFailure(f"Claude event {event_name} does not resolve the bundled Claude entry")
        if handler.get("timeout") != 30:
            raise SmokeFailure(
                f"Claude event {event_name} must declare the explicit 30-second timeout; the host stays fail-open"
            )

    # The Claude subtree is enumerated recursively. Nested entries, alternate
    # extensions and links are all rejected, not merely unmatched.
    claude_root = root / "hooks" / "claude"
    present: set[str] = set()
    for path in sorted(claude_root.rglob("*")):
        relative = path.relative_to(claude_root).as_posix()
        if path.is_symlink():
            raise SmokeFailure(f"the Claude subtree contains a link: {relative}")
        if path.is_dir():
            raise SmokeFailure(f"the Claude subtree contains a nested directory: {relative}")
        if not path.is_file():
            raise SmokeFailure(f"the Claude subtree contains a non-regular entry: {relative}")
        present.add(relative)
    if present != {"hooks.json", "pmnm-claude.mjs"}:
        raise SmokeFailure(f"the Claude subtree file set is unexpected: {sorted(present)}")

    entry_text = entry_file.read_text(encoding="utf-8")
    static_imports = claude_static_imports(entry_text)
    if sorted(static_imports) != sorted(CLAUDE_ALLOWED_IMPORTS):
        raise SmokeFailure(f"the Claude adapter import graph is not the reviewed set: {sorted(static_imports)}")
    if re.search(r"\bimport\s*\(", entry_text):
        raise SmokeFailure("the Claude adapter must not use a dynamic import")
    if "testing" in entry_text:
        raise SmokeFailure("the Claude adapter must not reach the engine's non-production surface")
    for forbidden in CLAUDE_FORBIDDEN_TOKENS:
        if forbidden in entry_text:
            raise SmokeFailure(f"the Claude adapter contains a forbidden capability: {forbidden}")
    if "transcript_path" in entry_text:
        raise SmokeFailure("the Claude adapter must carry zero transcript references")

    sizes = {
        CLAUDE_ENTRY: (entry_file.stat().st_size, CLAUDE_ENTRY_MAX_BYTES),
        CLAUDE_CONFIG: (config_file.stat().st_size, CLAUDE_CONFIG_MAX_BYTES),
        CLAUDE_MANIFEST: (manifest_file.stat().st_size, CLAUDE_MANIFEST_MAX_BYTES),
    }
    for label, (size, ceiling) in sizes.items():
        if size > ceiling:
            raise SmokeFailure(f"Claude adapter file exceeds its inspectable size budget: {label}")
    if sum(size for size, _ in sizes.values()) > CLAUDE_AGGREGATE_MAX_BYTES:
        raise SmokeFailure("Claude adapter files exceed their aggregate inspectable size budget")
    return tree_manifest(claude_root)


def validate_plugin_tree(root: Path, expected_name: str, expected_version: str) -> dict[str, str]:
    manifest = load_json(root / ".codex-plugin" / "plugin.json")
    if manifest.get("name") != expected_name:
        raise SmokeFailure("plugin name does not match package name")
    if manifest.get("version") != expected_version:
        raise SmokeFailure("plugin version does not match package version")
    if manifest.get("skills") != "./skills/":
        raise SmokeFailure("plugin must expose the canonical ./skills/ directory")
    if manifest.get("hooks") != CODEX_HOOK_MANIFEST_PATH:
        raise SmokeFailure("plugin must declare its hooks at ./hooks/codex/hooks.json")
    for unsupported in ("apps", "mcpServers"):
        if unsupported in manifest:
            raise SmokeFailure(f"plugin unexpectedly declares {unsupported}")
    validate_codex_hook_tree(root)
    validate_claude_hook_tree(root, expected_name, expected_version)
    validate_manifest_precedence(root)
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
    validate_declared_test_surface(package_manifest, source_payload)
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
        packed_hooks = validate_codex_hook_tree(extracted)

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
        installed_hooks = validate_codex_hook_tree(installed_root)
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
