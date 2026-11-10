#!/usr/bin/env python3
"""Read-only artifact and revision smoke test for an installed skill tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path
from typing import Any


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXPECTED_ROOT = PACKAGE_ROOT / "skills" / "please-make-no-mistakes"
SKILL_NAME = "please-make-no-mistakes"
MAX_MISMATCHES = 100
MAX_FILE_BYTES = 50_000_000
MAX_TREE_BYTES = 250_000_000
MAX_TREE_ENTRIES = 10_000
LINK_RE = re.compile(r"\[[^\]]*\]\((?P<target>references/[^)\s]+\.md)\)")
FRONTMATTER_NAME_RE = re.compile(r"(?m)^name:\s*(?P<name>[^\s]+)\s*$")
HEADING_RE = re.compile(r"(?m)^## (?P<heading>[^\n]+)$")
REQUIRED_HEADINGS = {
    "1. The folder",
    "2. The flow",
    "3. Rules",
    "4. Effort",
    "5. Claims",
    "6. Sensitive actions",
    "7. Brake cards",
    "8. How to speak",
    "Stop and ask",
    "References",
}


class SmokeFailure(Exception):
    """A bounded validation failure suitable for user-facing output."""


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def canonical_root(value: str | Path, label: str) -> Path:
    path = Path(value)
    try:
        resolved = path.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise SmokeFailure(f"{label} cannot be resolved: {exc}") from exc
    if not resolved.is_dir():
        raise SmokeFailure(f"{label} is not a directory: {resolved}")
    return resolved


def tree_manifest(root: Path) -> tuple[dict[str, dict[str, Any]], str]:
    manifest: dict[str, dict[str, Any]] = {}
    tree_bytes = 0

    def reject_walk_error(error: OSError) -> None:
        raise SmokeFailure(f"cannot traverse skill tree safely: {error}")

    for current, directories, filenames in os.walk(
        root,
        followlinks=False,
        onerror=reject_walk_error,
    ):
        current_path = Path(current)
        for name in [*directories, *filenames]:
            path = current_path / name
            metadata = path.lstat()
            relative = path.relative_to(root).as_posix()
            if stat.S_ISLNK(metadata.st_mode):
                raise SmokeFailure(f"symlink entry is not allowed inside the skill tree: {relative}")
            if stat.S_ISDIR(metadata.st_mode):
                manifest[relative] = {"type": "directory"}
                if len(manifest) > MAX_TREE_ENTRIES:
                    raise SmokeFailure(f"skill tree exceeds {MAX_TREE_ENTRIES} entries")
                continue
            if not stat.S_ISREG(metadata.st_mode):
                raise SmokeFailure(f"special file is not allowed inside the skill tree: {relative}")
            if metadata.st_size > MAX_FILE_BYTES:
                raise SmokeFailure(f"skill file exceeds {MAX_FILE_BYTES} bytes: {relative}")
            tree_bytes += metadata.st_size
            if len(manifest) >= MAX_TREE_ENTRIES:
                raise SmokeFailure(f"skill tree exceeds {MAX_TREE_ENTRIES} entries")
            if tree_bytes > MAX_TREE_BYTES:
                raise SmokeFailure(f"skill tree exceeds {MAX_TREE_BYTES} bytes")
            flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            try:
                descriptor = os.open(path, flags)
            except OSError as exc:
                raise SmokeFailure(f"cannot open skill file safely: {relative}: {exc}") from exc
            digest = hashlib.sha256()
            size = 0
            try:
                opened = os.fstat(descriptor)
                if not stat.S_ISREG(opened.st_mode):
                    raise SmokeFailure(f"skill entry changed type during inspection: {relative}")
                if (opened.st_dev, opened.st_ino) != (metadata.st_dev, metadata.st_ino):
                    raise SmokeFailure(f"skill entry changed identity during inspection: {relative}")
                while True:
                    chunk = os.read(descriptor, 1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_FILE_BYTES:
                        raise SmokeFailure(f"skill file grew beyond its limit: {relative}")
                    digest.update(chunk)
                final = os.fstat(descriptor)
                if (
                    final.st_size != opened.st_size
                    or final.st_mtime_ns != opened.st_mtime_ns
                    or size != opened.st_size
                ):
                    raise SmokeFailure(f"skill file changed during inspection: {relative}")
            finally:
                os.close(descriptor)
            manifest[relative] = {
                "type": "file",
                "size": size,
                "sha256": digest.hexdigest(),
            }
    ordered = [{"path": path, **manifest[path]} for path in sorted(manifest)]
    digest = hashlib.sha256(canonical_bytes(ordered)).hexdigest()
    return manifest, digest


def compare_manifests(
    expected: dict[str, dict[str, Any]],
    installed: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, str]], bool]:
    mismatches: list[dict[str, str]] = []
    mismatch_count = 0
    all_paths = sorted(set(expected) | set(installed))
    for path in all_paths:
        if path not in expected:
            effect = "unexpected-installed-entry"
        elif path not in installed:
            effect = "missing-installed-entry"
        elif expected[path] != installed[path]:
            effect = "entry-metadata-or-content-mismatch"
        else:
            continue
        mismatch_count += 1
        if len(mismatches) < MAX_MISMATCHES:
            mismatches.append({"path": path, "effect": effect})
    return mismatches, mismatch_count > len(mismatches)


def validate_skill_shape(root: Path) -> dict[str, Any]:
    skill_file = root / "SKILL.md"
    try:
        text = skill_file.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise SmokeFailure(f"cannot read SKILL.md: {exc}") from exc

    name_match = FRONTMATTER_NAME_RE.search(text)
    if name_match is None or name_match.group("name") != SKILL_NAME:
        raise SmokeFailure("SKILL.md does not declare the expected skill name")

    headings = set(HEADING_RE.findall(text))
    missing_headings = sorted(REQUIRED_HEADINGS - headings)
    if missing_headings:
        raise SmokeFailure(f"SKILL.md is missing kernel sections: {missing_headings}")

    linked_references = sorted(set(LINK_RE.findall(text)))
    actual_references = sorted(
        path.relative_to(root).as_posix() for path in (root / "references").glob("*.md")
    )
    if linked_references != actual_references:
        missing_links = sorted(set(actual_references) - set(linked_references))
        missing_files = sorted(set(linked_references) - set(actual_references))
        omitted = max(0, len(missing_links) - MAX_MISMATCHES) + max(
            0, len(missing_files) - MAX_MISMATCHES
        )
        raise SmokeFailure(
            "reference routing mismatch: "
            f"unlinked={missing_links[:MAX_MISMATCHES]}, "
            f"missing={missing_files[:MAX_MISMATCHES]}, omitted={omitted}"
        )

    return {
        "skill_name": SKILL_NAME,
        "section_count": len(headings),
        "reference_count": len(actual_references),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Compare an installed please-make-no-mistakes skill tree with a trusted "
            "package tree without writing either tree."
        )
    )
    parser.add_argument("--installed-root", required=True)
    parser.add_argument("--expected-root", default=os.fspath(DEFAULT_EXPECTED_ROOT))
    parser.add_argument(
        "--host-loaded-digest",
        type=validated_digest,
        help=(
            "Optional loaded tree digest supplied by a caller-designated trusted host. "
            "The smoke tool compares it but cannot authenticate the reporter."
        ),
    )
    return parser


def validated_digest(value: str) -> str:
    if not re.fullmatch(r"[0-9a-fA-F]{64}", value):
        raise argparse.ArgumentTypeError(
            "host-loaded digest must be exactly 64 hexadecimal characters"
        )
    return value.lower()


def main(argv: list[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    result: dict[str, Any] = {
        "schema_version": 1,
        "status": "failed",
        "writes_performed": False,
        "mismatches": [],
        "limitations": [
            "Reads may update access-time metadata under the host filesystem and mount policy.",
            "The content-tree digest covers relative paths, entry types, file sizes, and file bytes; it does not compare ownership, permissions, ACLs, or extended attributes.",
        ],
    }
    try:
        expected_root = canonical_root(arguments.expected_root, "expected root")
        installed_root = canonical_root(arguments.installed_root, "installed root")
        expected_manifest, expected_digest = tree_manifest(expected_root)
        installed_manifest, installed_digest = tree_manifest(installed_root)
        mismatches, mismatch_output_truncated = compare_manifests(
            expected_manifest,
            installed_manifest,
        )
        result.update(
            {
                "expected_root": os.fspath(expected_root),
                "installed_root": os.fspath(installed_root),
                "expected_tree_digest": expected_digest,
                "installed_tree_digest": installed_digest,
                "expected_entry_count": len(expected_manifest),
                "installed_entry_count": len(installed_manifest),
                "mismatches": mismatches,
                "mismatch_output_truncated": mismatch_output_truncated,
            }
        )
        if expected_digest != installed_digest:
            raise SmokeFailure(
                "installed skill content tree does not match the trusted package content tree"
            )

        result["shape"] = validate_skill_shape(installed_root)

        if arguments.host_loaded_digest is None:
            result["client_session"] = {"status": "unverified"}
            result["limitations"].append(
                "Inspected content-tree equality does not prove that the current client session loaded this revision."
            )
        elif arguments.host_loaded_digest != expected_digest:
            result["client_session"] = {
                "status": "host-reported-stale-or-mismatched",
                "reported_digest": arguments.host_loaded_digest,
            }
            raise SmokeFailure("host-reported loaded digest does not match the trusted revision")
        else:
            result["client_session"] = {
                "status": "host-reported-match",
                "reported_digest": arguments.host_loaded_digest,
            }
            result["limitations"].append(
                "The smoke tool compares the host-reported digest but does not authenticate its reporter."
            )

        result["status"] = "passed"
        result["limitations"].append(
            "Concurrent replacement of an ancestor directory can invalidate this read-only inspection; run against a stable installation."
        )
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except SmokeFailure as exc:
        result["error"] = str(exc)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 1
    except Exception as exc:  # pragma: no cover - fail closed on unexpected host behavior
        result["error"] = f"unexpected failure: {type(exc).__name__}: {exc}"
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
