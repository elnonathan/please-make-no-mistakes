#!/usr/bin/env python3
"""Inspect a context store and summarize a create-only machine plan.

This runtime exposes only ``inspect`` and ``plan`` and contains no filesystem
write operations: it never explicitly creates, replaces, deletes, or
synchronizes a filesystem object.  Reads may still update access metadata such
as ``atime``, depending on the filesystem and mount options, so the runtime does
not claim that all filesystem metadata remains unchanged.  A caller must use
separately authorized host tools for every write, and a host operation broader
than this create-only schema requires a new complete plan and digest.

Request schema v2::

    {
      "schema_version": 2,
      "root": "/absolute/context/store",
      "intent": "scaffold|register|adjust|modify|adapt",
      "operations": [
        {"op": "mkdir", "path": "relative/path", "purpose": "activity root"},
        {
          "op": "write-file",
          "path": "relative/file.md",
          "purpose": "canonical recovery index",
          "mode": "create",
          "content": "UTF-8 text"
        }
      ]
    }

``content_file`` may replace ``content``. It must identify an absolute,
non-symlink regular UTF-8 file. Its identity and exact bytes participate in the
digest. The review output includes its direct content hash and a bounded content
review, but never persists the request or plan.

The runtime uses only the Python standard library.  It requires POSIX ``dir_fd``
and ``O_NOFOLLOW`` support so path traversal can fail closed instead of silently
following a concurrent symlink substitution.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
import unicodedata
from pathlib import Path, PurePosixPath
from typing import Any, Optional


TOOL_NAME = "please-make-no-mistakes-context-store"
REQUEST_SCHEMA_VERSION = 2
PLAN_SCHEMA_VERSION = 2
MAX_CONTENT_BYTES = 10 * 1024 * 1024
MAX_TOTAL_CONTENT_BYTES = 10 * 1024 * 1024
MAX_JSON_BYTES = 64 * 1024 * 1024
MAX_REVIEW_CONTENT_BYTES = 8 * 1024
MAX_OPERATIONS = 1_000
MAX_TOTAL_TARGET_BYTES = 1024 * 1024
MAX_TARGET_BYTES = 4_096
MAX_TARGET_SEGMENTS = 128
MAX_ABSOLUTE_PATH_BYTES = 16_384
MAX_ABSOLUTE_PATH_SEGMENTS = 256
DEFAULT_MAX_ENTRIES = 10_000
DEFAULT_MAX_DEPTH = 16
MAX_INSPECT_ENTRIES = 100_000
MAX_INSPECT_DEPTH = 16
MAX_INSPECT_PATH_BYTES = 16 * 1024 * 1024
INTENTS = {"scaffold", "register", "adjust", "modify", "adapt"}
WINDOWS_RESERVED = {
    "CON",
    "CONIN$",
    "CONOUT$",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{number}" for number in range(1, 10)),
    *(f"LPT{number}" for number in range(1, 10)),
}
WINDOWS_RESERVED_KEYS = {
    unicodedata.normalize("NFKC", name).casefold() for name in WINDOWS_RESERVED
}
WINDOWS_FORBIDDEN_RE = re.compile(r'[<>:"|?*]')

EXIT_INVALID = 2
EXIT_CONFLICT = 3
EXIT_UNSUPPORTED = 5


class ToolError(Exception):
    """Expected failure with a stable public status."""

    def __init__(
        self,
        status_name: str,
        message: str,
        *,
        exit_code: int = EXIT_INVALID,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.status_name = status_name
        self.message = message
        self.exit_code = exit_code
        self.details = details or {}


def _emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def _canonical_bytes(value: Any) -> bytes:
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ToolError("invalid-content", "A value contains invalid Unicode data.") from exc


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _ensure_supported_platform() -> None:
    requirements = (
        os.name == "posix",
        hasattr(os, "O_NOFOLLOW"),
        hasattr(os, "O_DIRECTORY"),
        os.open in getattr(os, "supports_dir_fd", set()),
        os.stat in getattr(os, "supports_dir_fd", set()),
        os.scandir in getattr(os, "supports_fd", set()),
    )
    if not all(requirements):
        raise ToolError(
            "unsupported-platform",
            "Safe context-store traversal requires POSIX dir_fd and O_NOFOLLOW support.",
            exit_code=EXIT_UNSUPPORTED,
        )


def _portable_name_key(name: str) -> str:
    return unicodedata.normalize("NFC", name).casefold()


def _absolute_path(raw: Any, label: str) -> Path:
    if not isinstance(raw, str) or not raw:
        raise ToolError("invalid-path", f"{label} must be a non-empty string.")
    if "\x00" in raw or any(ord(character) < 32 or ord(character) == 127 for character in raw):
        raise ToolError("unsafe-path", f"{label} contains a control character.")
    try:
        encoded = raw.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ToolError("unsafe-path", f"{label} contains invalid Unicode data.") from exc
    if len(encoded) > MAX_ABSOLUTE_PATH_BYTES:
        raise ToolError("path-too-large", f"{label} exceeds the supported byte limit.")
    candidate = Path(raw)
    if not candidate.is_absolute():
        raise ToolError("unsafe-path", f"{label} must be absolute.")
    if ".." in candidate.parts:
        raise ToolError("unsafe-path", f"{label} must not contain traversal segments.")
    if len(candidate.parts) > MAX_ABSOLUTE_PATH_SEGMENTS:
        raise ToolError("path-too-deep", f"{label} exceeds the supported segment limit.")
    return Path(os.path.abspath(os.fspath(candidate)))


def _paths_overlap(first: Path, second: Path) -> bool:
    return first == second or first in second.parents or second in first.parents


def _skill_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _select_exact_name(directory_fd: int, wanted: str, *, label: str) -> bool:
    wanted_key = _portable_name_key(wanted)
    found = False
    try:
        with os.scandir(directory_fd) as entries:
            for entry in entries:
                name = entry.name
                if name == wanted:
                    found = True
                elif _portable_name_key(name) == wanted_key:
                    raise ToolError(
                        "path-collision",
                        f"{label} collides by Unicode normalization or case folding.",
                        details={"name": wanted},
                    )
    except ToolError:
        raise
    except OSError as exc:
        raise ToolError("path-inspection-failed", "A directory could not be inspected.") from exc
    return found


def _open_directory_component(parent_fd: int, name: str, *, label: str) -> int:
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    try:
        descriptor = os.open(name, flags, dir_fd=parent_fd)
    except OSError as exc:
        raise ToolError("unsafe-path", f"{label} is not a safe directory path.") from exc
    metadata = os.fstat(descriptor)
    if not stat.S_ISDIR(metadata.st_mode):
        os.close(descriptor)
        raise ToolError("unsafe-path", f"{label} is not a directory.")
    return descriptor


def _open_absolute_directory(path: Path, *, label: str) -> int:
    _ensure_supported_platform()
    parts = path.parts
    if not parts or path.anchor != "/":
        raise ToolError("unsupported-path", f"{label} is not a supported POSIX path.")
    descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in parts[1:]:
            if not _select_exact_name(descriptor, part, label=label):
                raise ToolError("missing-path", f"{label} does not exist.")
            next_descriptor = _open_directory_component(descriptor, part, label=label)
            os.close(descriptor)
            descriptor = next_descriptor
        return descriptor
    except Exception:
        os.close(descriptor)
        raise


def _open_absolute_regular(path: Path, *, label: str, private: bool = False) -> int:
    parent_fd = _open_absolute_directory(path.parent, label=f"{label} parent")
    try:
        if not _select_exact_name(parent_fd, path.name, label=label):
            raise ToolError("missing-file", f"{label} does not exist.")
        flags = os.O_RDONLY | os.O_NOFOLLOW
        try:
            descriptor = os.open(path.name, flags, dir_fd=parent_fd)
        except OSError as exc:
            raise ToolError("unsafe-path", f"{label} is not a safe regular file.") from exc
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            os.close(descriptor)
            raise ToolError("unsafe-path", f"{label} is not a regular file.")
        if private:
            _assert_private_metadata(metadata, label)
        return descriptor
    finally:
        os.close(parent_fd)


def _assert_private_metadata(metadata: os.stat_result, label: str) -> None:
    if hasattr(os, "geteuid") and metadata.st_uid != os.geteuid():
        raise ToolError("unsafe-owner", f"{label} has a different owner.")
    if stat.S_IMODE(metadata.st_mode) & 0o077:
        raise ToolError(
            "unsafe-permissions",
            f"{label} is accessible by group or other users under POSIX mode bits.",
        )
    if metadata.st_nlink != 1:
        raise ToolError(
            "unsafe-links",
            f"{label} must have exactly one hard link.",
        )


def _read_descriptor(descriptor: int, *, max_bytes: int, label: str) -> bytes:
    try:
        os.lseek(descriptor, 0, os.SEEK_SET)
    except OSError as exc:
        raise ToolError("read-failed", f"{label} could not be read.") from exc
    chunks: list[bytes] = []
    total = 0
    while True:
        try:
            chunk = os.read(descriptor, min(1024 * 1024, max_bytes + 1 - total))
        except OSError as exc:
            raise ToolError("read-failed", f"{label} could not be read.") from exc
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
        if total > max_bytes:
            raise ToolError("content-too-large", f"{label} exceeds the supported size limit.")
    return b"".join(chunks)


def _strict_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ToolError("invalid-json", "A JSON object contains a duplicate field.")
        result[key] = value
    return result


def _reject_json_constant(_: str) -> Any:
    raise ToolError("invalid-json", "A JSON document contains a non-standard numeric value.")


def _parse_json_object(raw: bytes) -> dict[str, Any]:
    try:
        value = json.loads(
            raw.decode("utf-8"),
            object_pairs_hook=_strict_json_object,
            parse_constant=_reject_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as exc:
        raise ToolError("invalid-json", "A required input is not valid UTF-8 JSON.") from exc
    if not isinstance(value, dict):
        raise ToolError("invalid-json", "A required JSON document must be an object.")
    return value


def _read_json_file(path: Path, *, private: bool) -> dict[str, Any]:
    descriptor = _open_absolute_regular(path, label="JSON file", private=private)
    try:
        metadata = os.fstat(descriptor)
        raw = _read_descriptor(descriptor, max_bytes=MAX_JSON_BYTES, label="JSON file")
        final_metadata = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    identity_fields = (
        "st_dev",
        "st_ino",
        "st_size",
        "st_mode",
        "st_uid",
        "st_gid",
        "st_nlink",
    )
    if (
        any(getattr(metadata, field) != getattr(final_metadata, field) for field in identity_fields)
        or getattr(metadata, "st_mtime_ns", int(metadata.st_mtime * 1_000_000_000))
        != getattr(final_metadata, "st_mtime_ns", int(final_metadata.st_mtime * 1_000_000_000))
        or metadata.st_size != len(raw)
    ):
        raise ToolError(
            "inspection-conflict",
            "The JSON file changed while it was being read.",
            exit_code=EXIT_CONFLICT,
        )
    return _parse_json_object(raw)


def _read_json_stdin() -> dict[str, Any]:
    try:
        raw = sys.stdin.buffer.read(MAX_JSON_BYTES + 1)
    except OSError as exc:
        raise ToolError("read-failed", "stdin could not be read.") from exc
    if len(raw) > MAX_JSON_BYTES:
        raise ToolError("content-too-large", "stdin exceeds the supported size limit.")
    if not raw:
        raise ToolError("invalid-json", "stdin is empty.")
    return _parse_json_object(raw)


def _read_content_file(raw: Any) -> tuple[str, dict[str, Any]]:
    source = _absolute_path(raw, "content_file")
    descriptor = _open_absolute_regular(source, label="content_file")
    try:
        metadata = os.fstat(descriptor)
        content_bytes = _read_descriptor(
            descriptor,
            max_bytes=MAX_CONTENT_BYTES,
            label="content_file",
        )
        final_metadata = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    identity_before = (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_size,
        getattr(metadata, "st_mtime_ns", int(metadata.st_mtime * 1_000_000_000)),
    )
    identity_after = (
        final_metadata.st_dev,
        final_metadata.st_ino,
        final_metadata.st_size,
        getattr(final_metadata, "st_mtime_ns", int(final_metadata.st_mtime * 1_000_000_000)),
    )
    if identity_before != identity_after or metadata.st_size != len(content_bytes):
        raise ToolError(
            "inspection-conflict",
            "content_file changed while it was being read.",
            exit_code=EXIT_CONFLICT,
        )
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ToolError("invalid-content", "content_file must contain valid UTF-8 text.") from exc
    return content, {
        "path": os.fspath(source),
        "sha256": _sha256_bytes(content_bytes),
        "size": len(content_bytes),
        "device": metadata.st_dev,
        "inode": metadata.st_ino,
        "mode": stat.S_IMODE(metadata.st_mode),
        "uid": metadata.st_uid,
        "gid": metadata.st_gid,
    }


def _validate_relative_target(raw: Any) -> str:
    if not isinstance(raw, str) or not raw:
        raise ToolError("unsafe-target", "Every target path must be a non-empty string.")
    if "\\" in raw:
        raise ToolError("unsafe-target", "Target paths must not contain backslashes.")
    if raw.startswith("/") or re.match(r"^[A-Za-z]:", raw):
        raise ToolError("unsafe-target", "Target paths must be relative.")
    if any(ord(character) < 32 or ord(character) == 127 for character in raw):
        raise ToolError("unsafe-target", "Target paths must not contain control characters.")
    try:
        raw_bytes = raw.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ToolError("unsafe-target", "Target paths must contain valid Unicode text.") from exc
    if len(raw_bytes) > MAX_TARGET_BYTES:
        raise ToolError("target-too-large", "A target path exceeds the supported byte limit.")
    candidate = PurePosixPath(raw)
    if candidate.is_absolute() or not candidate.parts:
        raise ToolError("unsafe-target", "Target paths must be relative.")
    if len(candidate.parts) > MAX_TARGET_SEGMENTS:
        raise ToolError("target-too-deep", "A target path exceeds the supported segment limit.")
    normalized_parts: list[str] = []
    for part in candidate.parts:
        if part in {"", ".", ".."}:
            raise ToolError("unsafe-target", "Target paths must not contain traversal segments.")
        if part.endswith((" ", ".")) or WINDOWS_FORBIDDEN_RE.search(part):
            raise ToolError("unsafe-target", "A target segment is not portable across filesystems.")
        windows_stem = (
            unicodedata.normalize("NFKC", part).split(".", 1)[0].rstrip(" ").casefold()
        )
        if windows_stem in WINDOWS_RESERVED_KEYS:
            raise ToolError("unsafe-target", "A target segment uses a reserved Windows name.")
        if len(part.encode("utf-8")) > 255:
            raise ToolError("unsafe-target", "A target segment is too long.")
        normalized_parts.append(part)
    normalized = "/".join(normalized_parts)
    if normalized != raw:
        raise ToolError("unsafe-target", "Target paths must already be normalized.")
    return normalized


def _metadata_snapshot(metadata: os.stat_result, state_name: str) -> dict[str, Any]:
    return {
        "state": state_name,
        "device": metadata.st_dev,
        "inode": metadata.st_ino,
        "size": metadata.st_size,
        "mtime_ns": getattr(metadata, "st_mtime_ns", int(metadata.st_mtime * 1_000_000_000)),
        "mode": stat.S_IMODE(metadata.st_mode),
        "uid": metadata.st_uid,
        "gid": metadata.st_gid,
    }


def _validate_root(raw: Any, *, must_exist: Optional[bool] = None) -> tuple[Path, Optional[int], dict[str, Any]]:
    root = _absolute_path(raw, "root")
    skill = _skill_root()
    home = Path.home().resolve()
    if root == Path(root.anchor):
        raise ToolError("unsafe-root", "The filesystem root cannot be a context store.")
    if root == home:
        raise ToolError("unsafe-root", "The home directory cannot be a context store root.")
    if _paths_overlap(root, skill):
        raise ToolError("unsafe-root", "The context store cannot overlap the installed skill.")

    parent_fd = _open_absolute_directory(root.parent, label="root parent")
    try:
        exists = _select_exact_name(parent_fd, root.name, label="root")
        if exists:
            root_fd = _open_directory_component(parent_fd, root.name, label="root")
            precondition = _metadata_snapshot(os.fstat(root_fd), "directory")
        else:
            root_fd = None
            parent_metadata = os.fstat(parent_fd)
            precondition = {
                "state": "absent",
                "parent": os.fspath(root.parent),
                **{
                    key: value
                    for key, value in _metadata_snapshot(parent_metadata, "directory").items()
                    if key != "state"
                },
            }
    finally:
        os.close(parent_fd)

    if must_exist is True and root_fd is None:
        raise ToolError("missing-root", "The context store root does not exist.")
    if must_exist is False and root_fd is not None:
        os.close(root_fd)
        raise ToolError("root-exists", "The context store root already exists.")
    return root, root_fd, precondition


def _probe_relative(root_fd: int, relative: str) -> tuple[dict[str, Any], list[str]]:
    parts = PurePosixPath(relative).parts
    descriptor = os.dup(root_fd)
    traversed: list[str] = []
    try:
        for index, part in enumerate(parts):
            if not _select_exact_name(descriptor, part, label=relative):
                anchor = _metadata_snapshot(os.fstat(descriptor), "directory")
                anchor["path"] = "/".join(traversed) or "."
                missing_parents = [
                    "/".join(parts[:depth])
                    for depth in range(index + 1, len(parts))
                ]
                return {
                    "state": "absent",
                    "anchor": anchor,
                    "missing_from": "/".join(parts[: index + 1]),
                }, missing_parents

            try:
                metadata = os.stat(part, dir_fd=descriptor, follow_symlinks=False)
            except OSError as exc:
                raise ToolError("path-inspection-failed", "A target could not be inspected.") from exc
            if stat.S_ISLNK(metadata.st_mode):
                raise ToolError("unsafe-target", "A target path contains a symbolic link.")
            is_final = index == len(parts) - 1
            if is_final:
                if stat.S_ISDIR(metadata.st_mode):
                    return _metadata_snapshot(metadata, "directory"), []
                if stat.S_ISREG(metadata.st_mode):
                    return _metadata_snapshot(metadata, "regular-file"), []
                raise ToolError("unsafe-target", "A target is a special file.")
            if not stat.S_ISDIR(metadata.st_mode):
                raise ToolError("unsafe-target", "A target ancestor is not a directory.")
            next_descriptor = _open_directory_component(descriptor, part, label=relative)
            opened = os.fstat(next_descriptor)
            if (opened.st_dev, opened.st_ino) != (metadata.st_dev, metadata.st_ino):
                os.close(next_descriptor)
                raise ToolError(
                    "inspection-conflict",
                    "A target ancestor changed during inspection.",
                    exit_code=EXIT_CONFLICT,
                )
            os.close(descriptor)
            descriptor = next_descriptor
            traversed.append(part)
    finally:
        os.close(descriptor)
    raise ToolError("internal-error", "Target inspection reached an invalid state.")


def _validate_keys(value: dict[str, Any], allowed: set[str], label: str) -> None:
    extras = set(value) - allowed
    if extras:
        raise ToolError(
            "invalid-request",
            f"{label} contains unsupported fields.",
            details={"unsupported_field_count": len(extras)},
        )


def _required_purpose(raw: Any, label: str) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ToolError("invalid-request", f"{label} purpose must be a non-empty string.")
    purpose = raw.strip()
    try:
        encoded = purpose.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ToolError("invalid-request", f"{label} purpose contains invalid Unicode data.") from exc
    if len(encoded) > 1_024:
        raise ToolError("invalid-request", f"{label} purpose exceeds the supported byte limit.")
    return purpose


def _content_review(content: str, content_bytes: bytes) -> dict[str, Any]:
    line_count = 0 if not content else content.count("\n") + (0 if content.endswith("\n") else 1)
    if len(content_bytes) <= MAX_REVIEW_CONTENT_BYTES:
        return {
            "kind": "complete-text",
            "content": content,
            "truncated": False,
            "line_count": line_count,
        }
    prefix_bytes = content_bytes[:MAX_REVIEW_CONTENT_BYTES]
    while prefix_bytes:
        try:
            prefix = prefix_bytes.decode("utf-8")
            break
        except UnicodeDecodeError:
            prefix_bytes = prefix_bytes[:-1]
    else:
        prefix = ""
    return {
        "kind": "bounded-prefix",
        "prefix": prefix,
        "shown_bytes": len(prefix_bytes),
        "total_bytes": len(content_bytes),
        "line_count": line_count,
        "truncated": True,
        "review_limit_bytes": MAX_REVIEW_CONTENT_BYTES,
    }


def _build_plan(request: dict[str, Any]) -> dict[str, Any]:
    _validate_keys(request, {"schema_version", "root", "intent", "operations"}, "request")
    if request.get("schema_version") != REQUEST_SCHEMA_VERSION:
        raise ToolError("invalid-request", "Unsupported request schema_version.")
    intent = request.get("intent")
    if intent not in INTENTS:
        raise ToolError("invalid-request", "Unsupported intent.")
    root, root_fd, root_precondition = _validate_root(request.get("root"))
    try:
        if root_fd is None and intent != "scaffold":
            raise ToolError("missing-root", "Only scaffold may target a new store root.")
        raw_operations = request.get("operations")
        if not isinstance(raw_operations, list) or not raw_operations:
            raise ToolError("invalid-request", "operations must be a non-empty array.")
        if len(raw_operations) > MAX_OPERATIONS:
            raise ToolError("invalid-request", "The request contains too many operations.")

        normalized: list[dict[str, Any]] = []
        target_types: dict[str, str] = {}
        portable_trie: dict[str, Any] = {}
        mkdir_targets: set[str] = set()
        total_target_bytes = 0
        for request_index, raw_operation in enumerate(raw_operations):
            if not isinstance(raw_operation, dict):
                raise ToolError("invalid-request", "Every operation must be an object.")
            operation_type = raw_operation.get("op")
            if operation_type == "mkdir":
                _validate_keys(
                    raw_operation,
                    {"op", "path", "purpose"},
                    f"operation {request_index}",
                )
            elif operation_type == "write-file":
                _validate_keys(
                    raw_operation,
                    {"op", "path", "purpose", "mode", "content", "content_file"},
                    f"operation {request_index}",
                )
                if raw_operation.get("mode") != "create":
                    raise ToolError("unsupported-operation", "write-file supports only mode=create.")
            else:
                raise ToolError("unsupported-operation", "Only mkdir and write-file/create are supported.")

            relative = _validate_relative_target(raw_operation.get("path"))
            purpose = _required_purpose(raw_operation.get("purpose"), f"operation {request_index}")
            total_target_bytes += len(relative.encode("utf-8"))
            if total_target_bytes > MAX_TOTAL_TARGET_BYTES:
                raise ToolError(
                    "target-too-large",
                    "Target paths exceed the supported aggregate byte limit.",
                )
            if relative in target_types:
                raise ToolError("invalid-request", "Multiple operations target the same path.")
            target_types[relative] = operation_type
            exact_parts = PurePosixPath(relative).parts
            trie_node = portable_trie
            for part in exact_parts:
                portable_part = _portable_name_key(part)
                existing = trie_node.get(portable_part)
                if existing is None:
                    child: dict[str, Any] = {}
                    trie_node[portable_part] = (part, child)
                    trie_node = child
                else:
                    prior_spelling, child = existing
                    if prior_spelling != part:
                        raise ToolError(
                            "target-collision",
                            "Planned path segments have a portable collision.",
                        )
                    trie_node = child
            if operation_type == "mkdir":
                mkdir_targets.add(relative)
            normalized.append(
                {
                    "request_index": request_index,
                    "op": operation_type,
                    "path": relative,
                    "purpose": purpose,
                    "raw": raw_operation,
                }
            )

        for relative, operation_type in target_types.items():
            parts = PurePosixPath(relative).parts
            for depth in range(1, len(parts)):
                prefix = "/".join(parts[:depth])
                if prefix in target_types and target_types[prefix] != "mkdir":
                    raise ToolError("target-conflict", "A file target cannot contain another target.")
            if operation_type == "write-file" and any(
                other != relative and other.startswith(relative + "/") for other in target_types
            ):
                raise ToolError("target-conflict", "A file target cannot be a planned parent.")

        plan_operations: list[dict[str, Any]] = []
        total_content_bytes = 0
        for item in normalized:
            raw_operation = item["raw"]
            relative = item["path"]
            if root_fd is None:
                precondition = {"state": "absent", "root_absent": True}
                parts = PurePosixPath(relative).parts
                missing_parents = ["/".join(parts[:depth]) for depth in range(1, len(parts))]
            else:
                precondition, missing_parents = _probe_relative(root_fd, relative)
            for missing_parent in missing_parents:
                if missing_parent not in mkdir_targets:
                    raise ToolError(
                        "missing-parent-operation",
                        "Every missing target parent requires an explicit mkdir operation.",
                        details={"path": relative, "missing_parent": missing_parent},
                    )

            base = {
                "request_index": item["request_index"],
                "op": item["op"],
                "path": relative,
                "purpose": item["purpose"],
            }
            if item["op"] == "mkdir":
                if precondition["state"] not in {"absent", "directory"}:
                    raise ToolError("target-conflict", "mkdir targets an existing non-directory.")
                plan_operations.append(
                    {
                        **base,
                        "effect": "create" if precondition["state"] == "absent" else "noop",
                        "precondition": precondition,
                        "result_mode": 0o700 if precondition["state"] == "absent" else precondition["mode"],
                        "result_mode_octal": format(
                            0o700 if precondition["state"] == "absent" else precondition["mode"],
                            "04o",
                        ),
                    }
                )
                continue

            if precondition["state"] != "absent":
                raise ToolError("target-conflict", "write-file/create requires an absent target.")
            has_inline = "content" in raw_operation
            has_file = "content_file" in raw_operation
            if has_inline == has_file:
                raise ToolError(
                    "invalid-request",
                    "write-file requires exactly one of content or content_file.",
                )
            source: Optional[dict[str, Any]] = None
            if has_file:
                content, source = _read_content_file(raw_operation["content_file"])
            else:
                content = raw_operation["content"]
                if not isinstance(content, str):
                    raise ToolError("invalid-content", "Inline content must be a string.")
            try:
                content_bytes = content.encode("utf-8")
            except UnicodeEncodeError as exc:
                raise ToolError("invalid-content", "Content must be valid UTF-8 text.") from exc
            if len(content_bytes) > MAX_CONTENT_BYTES:
                raise ToolError("content-too-large", "Content exceeds the per-file size limit.")
            total_content_bytes += len(content_bytes)
            if total_content_bytes > MAX_TOTAL_CONTENT_BYTES:
                raise ToolError("content-too-large", "Content exceeds the aggregate size limit.")
            operation = {
                **base,
                "mode": "create",
                "effect": "create",
                "precondition": precondition,
                "content": content,
                "content_sha256": _sha256_bytes(content_bytes),
                "content_size": len(content_bytes),
                "content_review": _content_review(content, content_bytes),
                "result_mode": 0o600,
                "result_mode_octal": "0600",
            }
            if source is not None:
                operation["content_source"] = source
            plan_operations.append(operation)

        plan_operations.sort(
            key=lambda operation: (
                0 if operation["op"] == "mkdir" else 1,
                len(PurePosixPath(operation["path"]).parts) if operation["op"] == "mkdir" else 0,
                operation["request_index"],
            )
        )
        for index, operation in enumerate(plan_operations):
            operation["index"] = index
            del operation["request_index"]

        source_state = {
            "root_precondition": root_precondition,
            "target_preconditions": [
                {"path": operation["path"], "precondition": operation["precondition"]}
                for operation in plan_operations
            ],
            "content_sources": [
                {"path": operation["path"], "source": operation["content_source"]}
                for operation in plan_operations
                if "content_source" in operation
            ],
        }
        payload: dict[str, Any] = {
            "plan_schema_version": PLAN_SCHEMA_VERSION,
            "tool": TOOL_NAME,
            "execution": "host-authorized",
            "machine_plan_scope": "mkdir-and-write-file-create-only",
            "root": os.fspath(root),
            "intent": intent,
            "root_precondition": root_precondition,
            "source_state_identity": _sha256_bytes(_canonical_bytes(source_state)),
            "root_effect": {
                "effect": "create" if root_precondition["state"] == "absent" else "noop",
                "result_mode": 0o700 if root_precondition["state"] == "absent" else root_precondition["mode"],
                "result_mode_octal": format(
                    0o700 if root_precondition["state"] == "absent" else root_precondition["mode"],
                    "04o",
                ),
            },
            "operations": plan_operations,
        }
        canonical_payload = _canonical_bytes(payload)
        if len(canonical_payload) + 100 > MAX_JSON_BYTES:
            raise ToolError("plan-too-large", "The canonical plan exceeds the JSON size limit.")
        digest = _sha256_bytes(canonical_payload)
        payload["plan_digest"] = digest
        payload["plan_id"] = digest[:16]
        if len(_canonical_bytes(payload)) + 1 > MAX_JSON_BYTES:
            raise ToolError("plan-too-large", "The complete plan exceeds the JSON size limit.")
        return payload
    finally:
        if root_fd is not None:
            os.close(root_fd)


def _plan_summary(plan: dict[str, Any]) -> dict[str, Any]:
    operations: list[dict[str, Any]] = []
    counts = {"root-create": 0, "mkdir": 0, "create": 0, "noop": 0}
    if plan["root_effect"]["effect"] == "create":
        counts["root-create"] = 1
    else:
        counts["noop"] += 1
    for operation in plan["operations"]:
        counts[operation["op"] if operation["op"] == "mkdir" else "create"] += 1
        if operation["effect"] == "noop":
            counts["noop"] += 1
        public_operation = {
            "index": operation["index"],
            "op": operation["op"],
            "path": operation["path"],
            "purpose": operation["purpose"],
            "effect": operation["effect"],
            "precondition": operation["precondition"],
            "result_mode_octal": operation["result_mode_octal"],
        }
        if operation["op"] == "write-file":
            public_operation["content_size"] = operation["content_size"]
            public_operation["content_sha256"] = operation["content_sha256"]
            public_operation["content_review"] = operation["content_review"]
            if "content_source" in operation:
                public_operation["content_source"] = operation["content_source"]
        operations.append(public_operation)
    return {
        "status": "planned-in-memory",
        "plan_digest": plan["plan_digest"],
        "plan_id": plan["plan_id"],
        "root": plan["root"],
        "intent": plan["intent"],
        "root_precondition": plan["root_precondition"],
        "source_state_identity": plan["source_state_identity"],
        "root_effect": plan["root_effect"],
        "machine_plan_scope": plan["machine_plan_scope"],
        "operation_count": len(operations),
        "operations": operations,
        "counts": counts,
        "writes_performed": False,
        "plan_persisted": False,
        "approval_binding": "one-shot-recompute-required",
        "host_mutation_requires_fresh_approval": True,
    }


def command_inspect(arguments: argparse.Namespace) -> dict[str, Any]:
    root, root_fd, _ = _validate_root(arguments.root, must_exist=True)
    assert root_fd is not None
    max_entries = arguments.max_entries
    max_depth = arguments.max_depth
    if (
        max_entries <= 0
        or max_entries > MAX_INSPECT_ENTRIES
        or max_depth < 0
        or max_depth > MAX_INSPECT_DEPTH
    ):
        os.close(root_fd)
        raise ToolError(
            "invalid-argument",
            "Inspection limits are outside the supported range.",
            details={
                "max_entries_limit": MAX_INSPECT_ENTRIES,
                "max_depth_limit": MAX_INSPECT_DEPTH,
            },
        )

    entries: list[dict[str, Any]] = []
    truncated_by_entries = False
    truncated_by_depth = False
    truncated_by_path_bytes = False
    total_path_bytes = 0

    def walk(directory_fd: int, prefix: str, depth: int) -> bool:
        nonlocal truncated_by_entries, truncated_by_depth, truncated_by_path_bytes, total_path_bytes
        try:
            with os.scandir(directory_fd) as directory_entries:
                for directory_entry in directory_entries:
                    if len(entries) >= max_entries:
                        truncated_by_entries = True
                        return False
                    name = directory_entry.name
                    try:
                        metadata = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
                    except OSError as exc:
                        raise ToolError(
                            "inspection-conflict",
                            "An entry changed during inspection.",
                            exit_code=EXIT_CONFLICT,
                        ) from exc
                    if stat.S_ISLNK(metadata.st_mode):
                        kind = "symlink"
                    elif stat.S_ISDIR(metadata.st_mode):
                        kind = "directory"
                    elif stat.S_ISREG(metadata.st_mode):
                        kind = "regular-file"
                    else:
                        kind = "special"
                    relative = f"{prefix}/{name}" if prefix else name
                    relative_bytes = len(relative.encode("utf-8"))
                    if total_path_bytes + relative_bytes > MAX_INSPECT_PATH_BYTES:
                        truncated_by_path_bytes = True
                        return False
                    total_path_bytes += relative_bytes
                    entries.append(
                        {
                            "path": relative,
                            "type": kind,
                            "size": metadata.st_size,
                            "mode": stat.S_IMODE(metadata.st_mode),
                        }
                    )
                    if kind != "directory":
                        continue
                    child_fd = _open_directory_component(directory_fd, name, label=relative)
                    try:
                        opened = os.fstat(child_fd)
                        if (opened.st_dev, opened.st_ino) != (
                            metadata.st_dev,
                            metadata.st_ino,
                        ):
                            raise ToolError(
                                "inspection-conflict",
                                "A directory changed during inspection.",
                                exit_code=EXIT_CONFLICT,
                            )
                        if depth >= max_depth:
                            with os.scandir(child_fd) as child_entries:
                                if next(child_entries, None) is not None:
                                    truncated_by_depth = True
                            continue
                        if not walk(child_fd, relative, depth + 1):
                            return False
                    finally:
                        os.close(child_fd)
        except ToolError:
            raise
        except OSError as exc:
            raise ToolError(
                "inspection-conflict",
                "A directory changed during inspection.",
                exit_code=EXIT_CONFLICT,
            ) from exc
        return True

    try:
        walk(root_fd, "", 0)
    finally:
        os.close(root_fd)
    return {
        "status": "inspected",
        "root": os.fspath(root),
        "content_opened": False,
        "entries": entries,
        "entry_count": len(entries),
        "ordering": "filesystem-native",
        "writes_performed": False,
        "truncated": truncated_by_entries or truncated_by_depth or truncated_by_path_bytes,
        "truncation": {
            "by_entries": truncated_by_entries,
            "by_depth": truncated_by_depth,
            "by_path_bytes": truncated_by_path_bytes,
        },
        "limits": {
            "max_entries": max_entries,
            "max_depth": max_depth,
            "max_path_bytes": MAX_INSPECT_PATH_BYTES,
        },
        "absence_claim_supported": not (
            truncated_by_entries or truncated_by_depth or truncated_by_path_bytes
        ),
        "truncated_subset_stable": False,
    }


def command_plan(arguments: argparse.Namespace) -> dict[str, Any]:
    if arguments.stdin:
        request = _read_json_stdin()
    else:
        request_path = _absolute_path(arguments.request, "request")
        skill = _skill_root()
        if _paths_overlap(request_path, skill):
            raise ToolError("unsafe-request-location", "The request must be outside the installed skill.")
        request = _read_json_file(request_path, private=True)
        requested_root = _absolute_path(request.get("root"), "root")
        if _paths_overlap(request_path, requested_root):
            raise ToolError("unsafe-request-location", "The request must be outside the store.")
    plan = _build_plan(request)
    return _plan_summary(plan)


def _parser() -> argparse.ArgumentParser:
    description = "Inspect a context store or summarize a create-only plan without explicit filesystem writes."
    epilog = """Request schema v2:
  root: absolute path
  intent: scaffold | register | adjust | modify | adapt
  operations:
    - {op: mkdir, path: relative/path, purpose: non-empty review text}
    - {op: write-file, path: relative/file, purpose: non-empty review text, mode: create,
       content: UTF-8 text}  # content_file may replace content

The CLI performs no explicit filesystem writes. Reads may update access metadata
such as atime, depending on the filesystem and mount options. Plan builds the
complete canonical plan in memory, then emits a reviewable bounded operation
summary, source preconditions, direct content hashes, and its deterministic
digest. Small text is shown completely; larger text uses a bounded prefix plus
exact size, line count, and hash. Every host write requires reconstruction of
the complete plan, unchanged preconditions and digest, and fresh explicit user
approval. Replace, move, delete,
migrate, semantic registration, remote backends, and binary ingestion are not
represented by this machine-plan schema.
"""
    parser = argparse.ArgumentParser(
        prog="context_store.py",
        description=description,
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    inspect_parser = subcommands.add_parser(
        "inspect",
        help="Inventory metadata without opening file content or issuing filesystem writes.",
    )
    inspect_parser.add_argument("--root", required=True)
    inspect_parser.add_argument("--max-entries", type=int, default=DEFAULT_MAX_ENTRIES)
    inspect_parser.add_argument("--max-depth", type=int, default=DEFAULT_MAX_DEPTH)
    inspect_parser.set_defaults(handler=command_inspect)

    plan_parser = subcommands.add_parser(
        "plan",
        help="Review a create-only plan in memory without writing files.",
        description="Review a create-only plan in memory. File requests must be owner-private under POSIX mode bits; --stdin creates no request file.",
    )
    input_group = plan_parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--request", help="Absolute path to an owner-private request JSON file.")
    input_group.add_argument("--stdin", action="store_true", help="Read request JSON from standard input.")
    plan_parser.set_defaults(handler=command_plan)
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = _parser()
    try:
        arguments = parser.parse_args(argv)
        _ensure_supported_platform()
        result = arguments.handler(arguments)
        _emit(result)
        return 0
    except ToolError as exc:
        payload: dict[str, Any] = {"status": exc.status_name, "error": exc.message}
        if exc.details:
            payload["details"] = exc.details
        _emit(payload)
        return exc.exit_code
    except KeyboardInterrupt:
        _emit({"status": "interrupted", "error": "The operation was interrupted."})
        return 130
    except Exception:
        _emit({"status": "internal-error", "error": "An unexpected internal error occurred."})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
