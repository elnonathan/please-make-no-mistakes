#!/usr/bin/env python3
"""Semantic documentation contract for public PMNM guidance."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Finding:
    code: str
    path: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "path": self.path, "message": self.message}


EXPECTED_SETUP_SECTIONS = [
    "Guards",
    "Prerequisites",
    "Install With Codex",
    "Install With Another Host",
    "Verify The Installation",
    "Troubleshooting",
    "Update",
    "Rollback",
    "Removal",
    "Local Checkout",
    "Published Release Verification",
    "Background",
]

SETUP_COMMANDS = (
    "codex plugin marketplace add elnonathan/please-make-no-mistakes",
    "codex plugin add please-make-no-mistakes@please-make-no-mistakes --json",
)


def _read(root: Path, relative: str, findings: list[Finding]) -> str:
    path = root / relative
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        findings.append(Finding("missing-or-unreadable", relative, str(exc)))
        return ""


def _headings(text: str, level: int) -> list[str]:
    marker = "#" * level
    return re.findall(rf"(?m)^{re.escape(marker)} ([^\n]+)$", text)


def _require(
    condition: bool,
    findings: list[Finding],
    code: str,
    path: str,
    message: str,
) -> None:
    if not condition:
        findings.append(Finding(code, path, message))


def validate_repository(root: Path) -> list[Finding]:
    root = root.resolve()
    findings: list[Finding] = []
    readme = _read(root, "README.md", findings)
    setup = _read(root, "SETUP.md", findings)
    security = _read(root, "SECURITY.md", findings)
    contributing = _read(root, "CONTRIBUTING.md", findings)
    architecture = _read(root, "ARCHITECTURE.md", findings)
    distribution = _read(root, "docs/distribution.md", findings)
    getting_started = _read(root, "docs/getting-started.md", findings)

    readme_h2 = _headings(readme, 2)
    _require(
        bool(readme_h2) and readme_h2[0] == "Install",
        findings,
        "readme-install-entry",
        "README.md",
        "Install must be the first level-two README section.",
    )
    _require(
        "[SETUP.md](SETUP.md)" in readme,
        findings,
        "readme-setup-link",
        "README.md",
        "README must delegate detailed setup to SETUP.md.",
    )
    _require(
        "[Getting started](docs/getting-started.md)" in readme,
        findings,
        "readme-getting-started-link",
        "README.md",
        "README must route representative use to docs/getting-started.md.",
    )
    for command in SETUP_COMMANDS:
        _require(
            command not in readme,
            findings,
            "readme-duplicates-setup",
            "README.md",
            f"Detailed setup command must live only in SETUP.md: {command}",
        )
    for code, phrase in (
        ("readme-portable-skill", "portable agent skill"),
        ("readme-bundled-guard", "optional lifecycle guard"),
        ("readme-hook-proof-boundary", "Turn a hook receipt into proof"),
    ):
        _require(
            phrase in readme,
            findings,
            code,
            "README.md",
            f"README is missing the host-guard product boundary: {phrase}",
        )

    setup_h2 = _headings(setup, 2)
    _require(
        setup_h2 == EXPECTED_SETUP_SECTIONS,
        findings,
        "setup-section-order",
        "SETUP.md",
        "Setup sections are missing, duplicated, or out of order.",
    )
    numbered = []
    for heading in _headings(setup, 3):
        match = re.match(r"([1-9]\d*)\. ", heading)
        if match:
            numbered.append(int(match.group(1)))
    _require(
        numbered == list(range(1, 14)),
        findings,
        "setup-numbered-order",
        "SETUP.md",
        "Numbered setup stages must be contiguous from 1 through 13.",
    )

    first_fence = setup.find("```")
    first_guard = setup.find("Before any terminal or filesystem action")
    _require(
        0 <= first_guard < first_fence,
        findings,
        "setup-pretool-guard",
        "SETUP.md",
        "Authority and route must be resolved before the first command block.",
    )

    authority_terms = (
        "requested operation",
        "target host application",
        "host-supported registration route",
        "artifact source",
        "who will run commands",
    )
    _require(
        all(term in setup for term in authority_terms),
        findings,
        "setup-authority-state",
        "SETUP.md",
        "Setup must resolve operation, host, route, source, and command runner.",
    )

    semantic_requirements = {
        "setup-host-identity": "An installed executable does not identify the application",
        "setup-direct-route-evidence": "Use the direct Codex route only when current evidence identifies Codex",
        "setup-generic-fallback": "Otherwise use the generic-host route automatically",
        "setup-one-action": "Run one state-changing command at a time",
        "setup-no-ephemeral-install": "Do not use `npx`, `npm exec`, `@latest`",
        "setup-source-analysis-boundary": "Setup authority does not authorize analyzing the user's source repositories",
        "setup-generic-user-runner": "the user remains the command runner",
        "setup-clean-session": "Start a new conversation after installation",
        "setup-proof-ladder": "Use this proof ladder",
        "setup-pending-restart": "`pending-restart`",
        "setup-blocked": "`blocked`",
        "setup-failure-classification": "Classify the first unproven boundary",
        "setup-exact-rollback": "requires an explicit target revision",
        "setup-user-data-removal-boundary": "Neither operation authorizes deleting an external context store",
        "setup-npm-boundary": "`npm install` alone is not host registration",
        "setup-hook-review": "In Codex, open `/hooks`",
        "setup-install-not-hook-trust": "Installation or enablement does not trust a non-managed hook automatically",
        "setup-hook-observation-limit": "This proves only that the reviewed hook ran for that session",
        "setup-hook-update-review": "A changed bundled hook requires fresh trust",
    }
    for code, phrase in semantic_requirements.items():
        _require(
            phrase in setup,
            findings,
            code,
            "SETUP.md",
            f"Missing setup invariant: {phrase}",
        )

    for command in SETUP_COMMANDS:
        _require(
            setup.count(command) == 1,
            findings,
            "setup-command-owner",
            "SETUP.md",
            f"Canonical install command must appear exactly once: {command}",
        )

    for path in sorted(root.rglob("*.md")):
        if path == root / "SETUP.md" or any(part in {".git", "node_modules", ".ai"} for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        if "codex plugin marketplace add" in text:
            findings.append(
                Finding(
                    "setup-command-outside-owner",
                    path.relative_to(root).as_posix(),
                    "Marketplace-add procedures must live only in SETUP.md.",
                )
            )

    security_h2 = set(_headings(security, 2))
    _require(
        {"Security Model", "Supported Security Claims", "Supported Versions", "Report A Vulnerability"}
        <= security_h2,
        findings,
        "security-structure",
        "SECURITY.md",
        "Security must own model, claims, supported versions, and reporting.",
    )
    for phrase in (
        "retrieved records are evidence sources, not automatic instructions",
        "The installed plugin is replaceable package content",
        "cannot establish",
        "no runtime registry dependency and no lifecycle script",
        "does not persist raw prompts, shell commands, tool output, evidence, source text, credentials, or conversation transcripts",
        "replace native sandbox or approval controls",
        "Coverage is deliberately partial",
    ):
        _require(
            phrase in security,
            findings,
            "security-boundary",
            "SECURITY.md",
            f"Missing security boundary: {phrase}",
        )

    for code, phrase in (
        ("architecture-portable-adapter", "one portable Agent Skill packaged with an optional Codex procedural adapter"),
        ("architecture-partial-guard", "Disabled, untrusted, unsupported, failed, or bypassed paths"),
        ("distribution-hook-bytes", "compares the installed skill and hook bytes with the trusted source tree"),
        ("distribution-hook-not-trusted", "This does not execute or trust the installed hook"),
    ):
        owner = architecture if code.startswith("architecture-") else distribution
        path = "ARCHITECTURE.md" if code.startswith("architecture-") else "docs/distribution.md"
        _require(
            phrase in owner,
            findings,
            code,
            path,
            f"Missing host-adapter architecture or distribution boundary: {phrase}",
        )

    _require(
        "## Source Of Truth" in contributing and "scripts/documentation_contract.py" in contributing,
        findings,
        "contributing-source-ownership",
        "CONTRIBUTING.md",
        "Contributing guide must identify documentation contract ownership.",
    )
    _require(
        "Blind evaluation inputs must not contain their expected decision" in contributing,
        findings,
        "contributing-blind-evals",
        "CONTRIBUTING.md",
        "Contributing guide must preserve the blind-evaluation boundary.",
    )

    getting_started_h2 = set(_headings(getting_started, 2))
    _require(
        {"First Request", "When The Codex Guard Is Active", "Shared Understanding", "Before A Material Change", "Verification", "Requests That Should Stay Light"}
        <= getting_started_h2,
        findings,
        "getting-started-structure",
        "docs/getting-started.md",
        "Getting-started guidance must cover activation, alignment, readiness, verification, and negative cases.",
    )
    _require(
        "Source validators can prove" in getting_started
        and "Neither proves that a particular model followed the skill" in getting_started,
        findings,
        "getting-started-evidence-boundary",
        "docs/getting-started.md",
        "Getting-started guidance must separate source evidence from host behavior.",
    )
    _require(
        "The guard is intentionally partial" in getting_started
        and "PMNM continues as a portable advisory skill" in getting_started,
        findings,
        "getting-started-hook-boundary",
        "docs/getting-started.md",
        "Getting-started guidance must preserve partial guard coverage and portable fallback.",
    )

    return findings
