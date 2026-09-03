#!/usr/bin/env python3
"""Read-only conformance check for PMNM's adopted Standard file profile."""

from __future__ import annotations

import argparse
import json
import os
import re
import stat
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlsplit


TOOL_NAME = "please-make-no-mistakes-record-conformance"
LOGICAL_CONTRACT = "pmnm.activity-record/v1"
PROFILE = "pmnm.standard-file/v1"
REQUIRED_FILES = ("index.md", "understanding.md", "timeline.md", "verification.md")
MAX_FILE_BYTES = 4 * 1024 * 1024
FIELD_RE = re.compile(r"(?m)^\s*(?P<name>[A-Za-z][A-Za-z0-9 _/-]*):\s*(?P<value>.*?)\s*$")
LINK_RE = re.compile(r"!?\[[^\]]*\]\(\s*(?P<target><[^>]+>|[^\s)]+)")
EVENT_RE = re.compile(
    r"(?ms)^\s*Event identity(?: or time)?:\s*(?P<identity>[^\n]+).*?"
    r"^\s*Capture state:\s*(?P<state>[^\n]+)"
)


class ConformanceError(Exception):
    pass


def _emit(payload: dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def _absolute_root(raw: str) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute() or ".." in candidate.parts or "\x00" in raw:
        raise ConformanceError("activity root must be an absolute normalized path")
    return Path(os.path.abspath(os.fspath(candidate)))


def _read_regular(path: Path) -> str:
    try:
        path_metadata = os.lstat(path)
    except OSError as exc:
        raise ConformanceError(f"cannot inspect {path.name}") from exc
    if stat.S_ISLNK(path_metadata.st_mode) or not stat.S_ISREG(path_metadata.st_mode):
        raise ConformanceError(f"{path.name} must be a non-symlink regular file")
    if path_metadata.st_size > MAX_FILE_BYTES:
        raise ConformanceError(f"{path.name} exceeds the supported size limit")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise ConformanceError(f"cannot read {path.name}") from exc
    try:
        opened_metadata = os.fstat(descriptor)
        if not stat.S_ISREG(opened_metadata.st_mode):
            raise ConformanceError(f"{path.name} must be a non-symlink regular file")
        identity_fields = ("st_dev", "st_ino", "st_size", "st_mtime_ns")
        before_identity = tuple(
            getattr(path_metadata, field, None) for field in identity_fields
        )
        opened_identity = tuple(
            getattr(opened_metadata, field, None) for field in identity_fields
        )
        if before_identity != opened_identity:
            raise ConformanceError(f"{path.name} changed before it could be read")
        chunks: list[bytes] = []
        remaining = MAX_FILE_BYTES + 1
        while remaining:
            chunk = os.read(descriptor, min(64 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        final_metadata = os.fstat(descriptor)
    except OSError as exc:
        raise ConformanceError(f"cannot read {path.name}") from exc
    finally:
        os.close(descriptor)
    try:
        final_path_metadata = os.lstat(path)
    except OSError as exc:
        raise ConformanceError(f"{path.name} changed while it was read") from exc
    final_identity = tuple(
        getattr(final_metadata, field, None) for field in identity_fields
    )
    final_path_identity = tuple(
        getattr(final_path_metadata, field, None) for field in identity_fields
    )
    if (
        len(raw) > MAX_FILE_BYTES
        or len(raw) != opened_metadata.st_size
        or final_identity != opened_identity
        or final_path_identity != opened_identity
        or stat.S_ISLNK(final_path_metadata.st_mode)
    ):
        raise ConformanceError(f"{path.name} changed while it was read")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ConformanceError(f"{path.name} is not UTF-8 text") from exc


def _fields(text: str) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for match in FIELD_RE.finditer(text):
        key = " ".join(match.group("name").casefold().split())
        result.setdefault(key, []).append(match.group("value").strip())
    return result


def _one(fields: dict[str, list[str]], key: str, errors: list[str]) -> str:
    values = [value for value in fields.get(key, []) if value]
    if len(values) != 1:
        errors.append(f"index field {key!r} must occur exactly once with a value")
        return ""
    return values[0]


def _validate_links(root: Path, source: Path, text: str, errors: list[str]) -> int:
    checked = 0
    for match in LINK_RE.finditer(text):
        raw = match.group("target")
        if raw.startswith("<") and raw.endswith(">"):
            raw = raw[1:-1]
        parsed = urlsplit(raw)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        target_text = unquote(parsed.path)
        target = Path(target_text)
        if target.is_absolute():
            errors.append(f"{source.name} contains an absolute local pointer: {target_text}")
            continue
        resolved = Path(os.path.abspath(os.fspath(source.parent / target)))
        try:
            resolved.relative_to(root)
        except ValueError:
            errors.append(f"{source.name} pointer escapes the activity root: {target_text}")
            continue
        root_real = Path(os.path.realpath(root))
        resolved_real = Path(os.path.realpath(resolved))
        try:
            resolved_real.relative_to(root_real)
        except ValueError:
            errors.append(
                f"{source.name} pointer escapes the activity root through a symlink: "
                f"{target_text}"
            )
            continue
        current = root
        symlink_component = ""
        for component in resolved.relative_to(root).parts:
            current /= component
            if os.path.lexists(current) and stat.S_ISLNK(os.lstat(current).st_mode):
                symlink_component = os.fspath(current.relative_to(root))
                break
        if symlink_component:
            errors.append(
                f"{source.name} pointer crosses a symlink component "
                f"{symlink_component}: {target_text}"
            )
            continue
        checked += 1
        if not os.path.lexists(resolved):
            errors.append(f"{source.name} pointer is broken: {target_text}")
            continue
        try:
            target_metadata = os.lstat(resolved)
        except OSError:
            errors.append(f"{source.name} pointer cannot be inspected: {target_text}")
            continue
        if stat.S_ISLNK(target_metadata.st_mode):
            errors.append(f"{source.name} pointer targets a symlink: {target_text}")
    return checked


def validate(root: Path) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        metadata = os.lstat(root)
    except OSError as exc:
        raise ConformanceError("activity root does not exist") from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise ConformanceError("activity root must be a non-symlink directory")

    texts: dict[str, str] = {}
    for name in REQUIRED_FILES:
        path = root / name
        if not os.path.lexists(path):
            errors.append(f"missing required responsibility surface: {name}")
            continue
        try:
            texts[name] = _read_regular(path)
        except ConformanceError as exc:
            errors.append(str(exc))

    links_checked = 0
    for name, content in texts.items():
        links_checked += _validate_links(root, root / name, content, errors)

    index_fields = _fields(texts.get("index.md", ""))
    contract = _one(index_fields, "logical record contract", errors)
    profile = _one(index_fields, "layout profile", errors)
    _one(index_fields, "activity id", errors)
    _one(index_fields, "status", errors)
    _one(index_fields, "as of", errors)
    _one(index_fields, "current conclusion", errors)
    basis_revision = _one(index_fields, "current basis revision", errors)
    _one(index_fields, "next action", errors)
    last_capture = _one(index_fields, "last completed capture", errors)
    capture_state = _one(index_fields, "capture state", errors)

    if contract and contract != LOGICAL_CONTRACT:
        errors.append(f"unsupported logical record contract: {contract}")
    if profile and profile != PROFILE:
        errors.append(f"unsupported layout profile: {profile}")
    if basis_revision and not re.fullmatch(r"[1-9][0-9]*", basis_revision):
        errors.append("current basis revision must be a positive decimal integer")
    if capture_state and capture_state not in {"complete", "reconciled"}:
        errors.append("canonical capture state must be complete or reconciled")

    for name in ("understanding.md", "verification.md"):
        fields = _fields(texts.get(name, ""))
        declared = [value for value in fields.get("current basis revision", []) if value]
        if declared and (len(declared) != 1 or declared[0] != basis_revision):
            errors.append(f"{name} basis revision disagrees with index.md")

    timeline = texts.get("timeline.md", "")
    events = [(m.group("identity").strip(), m.group("state").strip()) for m in EVENT_RE.finditer(timeline)]
    if not events:
        errors.append("timeline.md contains no event with a capture state")
    else:
        final_identity, final_state = events[-1]
        if final_state not in {"complete", "reconciled"}:
            errors.append(f"latest timeline event {final_identity!r} is {final_state!r}")
        if last_capture and final_identity != last_capture:
            errors.append("last completed capture disagrees with the latest timeline event")

    if links_checked == 0:
        warnings.append("no relative Markdown pointers were available to validate")

    return {
        "status": "conformant" if not errors else "nonconformant",
        "tool": TOOL_NAME,
        "logical_contract": LOGICAL_CONTRACT,
        "profile": PROFILE,
        "activity_root": os.fspath(root),
        "files_checked": sorted(texts),
        "links_checked": links_checked,
        "errors": errors,
        "warnings": warnings,
        "writes_performed": False,
        "coverage": "default-standard-file-profile-only",
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="record_conformance.py",
        description="Read-only validation for an explicitly adopted PMNM Standard file profile.",
    )
    parser.add_argument("--activity-root", required=True)
    parser.add_argument("--profile", default=PROFILE, choices=(PROFILE,))
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    try:
        arguments = _parser().parse_args(argv)
        result = validate(_absolute_root(arguments.activity_root))
        _emit(result)
        return 0 if result["status"] == "conformant" else 4
    except ConformanceError as exc:
        _emit({"status": "invalid-input", "error": str(exc), "writes_performed": False})
        return 2
    except KeyboardInterrupt:
        _emit({"status": "interrupted", "error": "The operation was interrupted."})
        return 130
    except Exception:
        _emit({"status": "internal-error", "error": "An unexpected internal error occurred."})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
