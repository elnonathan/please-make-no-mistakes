#!/usr/bin/env python3
"""Verify one immutable npm release and its tag-pinned Codex plugin route."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import distribution_smoke


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_FILE = PACKAGE_ROOT / "package.json"
PLUGIN_FILE = PACKAGE_ROOT / ".codex-plugin" / "plugin.json"
MARKETPLACE_FILE = PACKAGE_ROOT / ".agents" / "plugins" / "marketplace.json"
PACKAGE_NAME = "please-make-no-mistakes"
MARKETPLACE_NAME = "please-make-no-mistakes"
MARKETPLACE_SOURCE = "elnonathan/please-make-no-mistakes"
MARKETPLACE_GIT_SOURCE = "https://github.com/elnonathan/please-make-no-mistakes.git"
PLUGIN_SELECTOR = "please-make-no-mistakes@please-make-no-mistakes"
REGISTRY = "https://registry.npmjs.org"
MINIMUM_CODEX_VERSION = (0, 144, 4)
SEMVER_RE = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
NETWORK_UNAVAILABLE_TEXT = (
    "could not resolve host",
    "failed to lookup address information",
    "getaddrinfo enotfound",
    "network is unreachable",
    "network timeout",
    "timed out",
    "unable to access",
)

EXIT_CODE = {"passed": 0, "failed": 1, "invalid": 2, "blocked": 3}


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON root must be an object: {path.name}")
    return value


def result(returncode: int | None, stdout: str = "", stderr: str = "") -> dict[str, Any]:
    return {"returncode": returncode, "stdout": stdout, "stderr": stderr}


def run(
    command: list[str],
    *,
    cwd: Path,
    environment: dict[str, str],
    timeout: int = 180,
) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return result(None, stderr=str(exc))
    return result(completed.returncode, completed.stdout, completed.stderr)


def message(command_result: dict[str, Any]) -> str:
    return str(command_result.get("stderr", "")).strip() or str(command_result.get("stdout", "")).strip()


def network_unavailable(command_result: dict[str, Any]) -> bool:
    if command_result.get("returncode") is None:
        return True
    combined = f"{command_result.get('stdout', '')}\n{command_result.get('stderr', '')}".casefold()
    return any(token in combined for token in NETWORK_UNAVAILABLE_TEXT)


def check(name: str, status: str, reason: str, **details: Any) -> dict[str, Any]:
    return {"name": name, "status": status, "reason": reason, **({"details": details} if details else {})}


def final_status(checks: list[dict[str, Any]]) -> str:
    statuses = {item["status"] for item in checks}
    if "failed" in statuses:
        return "failed"
    if "blocked" in statuses:
        return "blocked"
    if "invalid" in statuses:
        return "invalid"
    return "passed"


def release_identity(version: str) -> list[str]:
    errors: list[str] = []
    package = load_json(PACKAGE_FILE)
    plugin = load_json(PLUGIN_FILE)
    marketplace = load_json(MARKETPLACE_FILE)
    plugins = marketplace.get("plugins")
    entry = plugins[0] if isinstance(plugins, list) and len(plugins) == 1 and isinstance(plugins[0], dict) else {}
    expected_source = {
        "source": "npm",
        "package": PACKAGE_NAME,
        "version": version,
        "registry": REGISTRY,
    }

    if package.get("name") != PACKAGE_NAME:
        errors.append("package name differs from the release identity")
    if package.get("version") != version:
        errors.append("requested version differs from package.json")
    if plugin.get("name") != PACKAGE_NAME or plugin.get("version") != version:
        errors.append("plugin manifest name or version differs from package.json")
    if marketplace.get("name") != MARKETPLACE_NAME:
        errors.append("marketplace identity differs from the release identity")
    if entry.get("name") != PACKAGE_NAME or entry.get("source") != expected_source:
        errors.append("marketplace source does not pin the requested npm version")
    return errors


def parse_codex_version(raw: str) -> tuple[int, int, int] | None:
    match = re.search(r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)", raw)
    if not match:
        return None
    return tuple(int(part) for part in match.groups())


def published_artifact_drift(installed_root: Path) -> dict[str, list[str]]:
    source_manifest = load_json(PACKAGE_FILE)
    expected_paths = distribution_smoke.expected_payload(source_manifest)
    installed_tree = distribution_smoke.tree_manifest(installed_root)
    installed_paths = set(installed_tree)
    missing = sorted(expected_paths - installed_paths)
    unexpected = sorted(installed_paths - expected_paths)
    mismatched = sorted(
        relative
        for relative in expected_paths.intersection(installed_paths)
        if distribution_smoke.hash_file(PACKAGE_ROOT / relative) != installed_tree[relative]
    )
    return {
        "missing": missing[:20],
        "unexpected": unexpected[:20],
        "mismatched": mismatched[:20],
    }


def command_failure(
    name: str,
    command_result: dict[str, Any],
    *,
    unavailable_reason: str,
    failure_reason: str,
) -> dict[str, Any]:
    unavailable = network_unavailable(command_result)
    return check(
        name,
        "blocked" if unavailable else "failed",
        unavailable_reason if unavailable else failure_reason,
        message=message(command_result),
    )


def verify(version: str) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    if not SEMVER_RE.fullmatch(version):
        checks.append(check("requested-version", "invalid", "version-must-be-exact-semver"))
        status = final_status(checks)
        return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}

    try:
        identity_errors = release_identity(version)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        identity_errors = [f"release metadata could not be read: {exc}"]
    if identity_errors:
        checks.append(check("release-identity", "failed", "release-metadata-drift", errors=identity_errors))
        status = final_status(checks)
        return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
    checks.append(check("release-identity", "passed", "exact-version-aligned"))

    environment = dict(os.environ)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    tag = f"v{version}"
    tag_result = run(
        ["git", "rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}"],
        cwd=PACKAGE_ROOT,
        environment=environment,
    )
    if tag_result["returncode"] != 0:
        checks.append(check("repository-tag", "failed", "matching-release-tag-missing", tag=tag))
        status = final_status(checks)
        return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
    head_result = run(["git", "rev-parse", "HEAD"], cwd=PACKAGE_ROOT, environment=environment)
    status_result = run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=PACKAGE_ROOT,
        environment=environment,
    )
    if (
        head_result["returncode"] != 0
        or head_result["stdout"].strip() != tag_result["stdout"].strip()
        or status_result["returncode"] != 0
        or status_result["stdout"].strip()
    ):
        checks.append(check("repository-tag", "failed", "release-checkout-not-clean-tag", tag=tag))
        status = final_status(checks)
        return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
    checks.append(check("repository-tag", "passed", "clean-release-tag-checked-out", tag=tag))

    with tempfile.TemporaryDirectory(prefix="pmnm-postpublication-") as raw:
        workspace = Path(raw).resolve()
        cache = workspace / "npm-cache"
        consumer = workspace / "consumer"
        codex_home = workspace / "codex-home"
        host_home = workspace / "host-home"
        npm_user_config = workspace / "empty-npmrc"
        cache.mkdir()
        consumer.mkdir()
        codex_home.mkdir()
        host_home.mkdir()
        npm_user_config.write_text("", encoding="utf-8")
        isolated = dict(environment)
        isolated["npm_config_cache"] = os.fspath(cache)
        isolated["npm_config_registry"] = REGISTRY
        isolated["npm_config_userconfig"] = os.fspath(npm_user_config)
        for credential_name in ("NODE_AUTH_TOKEN", "NPM_TOKEN"):
            isolated.pop(credential_name, None)

        registry_result = run(
            ["npm", "view", f"{PACKAGE_NAME}@{version}", "version", "--json"],
            cwd=consumer,
            environment=isolated,
        )
        if registry_result["returncode"] != 0:
            if "E404" in f"{registry_result['stdout']}\n{registry_result['stderr']}":
                checks.append(check("npm-registry", "failed", "version-not-published", version=version))
            else:
                checks.append(
                    command_failure(
                        "npm-registry",
                        registry_result,
                        unavailable_reason="registry-unavailable",
                        failure_reason="registry-query-failed",
                    )
                )
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        try:
            registry_version = json.loads(registry_result["stdout"])
        except json.JSONDecodeError:
            registry_version = None
        if registry_version != version:
            checks.append(check("npm-registry", "failed", "registry-version-mismatch", observed=registry_version))
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        checks.append(check("npm-registry", "passed", "exact-version-published", version=version))

        install_result = run(
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--save-exact",
                f"{PACKAGE_NAME}@{version}",
            ],
            cwd=consumer,
            environment=isolated,
        )
        if install_result["returncode"] != 0:
            checks.append(
                command_failure(
                    "npm-installation",
                    install_result,
                    unavailable_reason="registry-unavailable",
                    failure_reason="package-installation-failed",
                )
            )
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}

        installed_root = (consumer / "node_modules" / PACKAGE_NAME).resolve()
        try:
            installed_manifest = load_json(installed_root / "package.json")
            tree = distribution_smoke.validate_plugin_tree(installed_root, PACKAGE_NAME, version)
            drift = published_artifact_drift(installed_root)
        except (OSError, UnicodeError, json.JSONDecodeError, ValueError, distribution_smoke.SmokeFailure) as exc:
            checks.append(check("installed-artifact", "failed", "installed-artifact-invalid", message=str(exc)))
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        if installed_manifest.get("version") != version:
            checks.append(check("installed-artifact", "failed", "installed-version-mismatch"))
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        if any(drift.values()):
            checks.append(check("installed-artifact", "failed", "published-bytes-differ-from-release-source", **drift))
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        checks.append(check("installed-artifact", "passed", "plugin-tree-verified", skill_files=len(tree)))

        codex_environment = dict(isolated)
        codex_environment["CODEX_HOME"] = os.fspath(codex_home)
        codex_environment["HOME"] = os.fspath(host_home)
        codex_environment["USERPROFILE"] = os.fspath(host_home)
        codex_environment["XDG_CONFIG_HOME"] = os.fspath(host_home / ".config")
        codex_version_result = run(["codex", "--version"], cwd=workspace, environment=codex_environment)
        parsed_codex_version = parse_codex_version(codex_version_result["stdout"])
        if codex_version_result["returncode"] != 0 or parsed_codex_version is None:
            checks.append(
                command_failure(
                    "codex-client",
                    codex_version_result,
                    unavailable_reason="codex-cli-unavailable",
                    failure_reason="codex-version-unreadable",
                )
            )
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        if parsed_codex_version < MINIMUM_CODEX_VERSION:
            checks.append(
                check(
                    "codex-client",
                    "blocked",
                    "codex-version-unsupported",
                    observed=".".join(str(part) for part in parsed_codex_version),
                    minimum=".".join(str(part) for part in MINIMUM_CODEX_VERSION),
                )
            )
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        checks.append(check("codex-client", "passed", "supported-version"))

        marketplace_result = run(
            [
                "codex",
                "plugin",
                "marketplace",
                "add",
                MARKETPLACE_SOURCE,
                "--ref",
                tag,
                "--json",
            ],
            cwd=workspace,
            environment=codex_environment,
        )
        if marketplace_result["returncode"] != 0:
            checks.append(
                command_failure(
                    "codex-marketplace",
                    marketplace_result,
                    unavailable_reason="marketplace-unavailable",
                    failure_reason="marketplace-installation-failed",
                )
            )
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}
        checks.append(check("codex-marketplace", "passed", "tag-pinned-marketplace-added", ref=tag))

        plugin_result = run(
            ["codex", "plugin", "add", PLUGIN_SELECTOR, "--json"],
            cwd=workspace,
            environment=codex_environment,
        )
        if plugin_result["returncode"] != 0:
            checks.append(
                command_failure(
                    "codex-plugin",
                    plugin_result,
                    unavailable_reason="plugin-source-unavailable",
                    failure_reason="plugin-installation-failed",
                )
            )
            status = final_status(checks)
            return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}

        list_result = run(
            ["codex", "plugin", "list", "--json"],
            cwd=workspace,
            environment=codex_environment,
        )
        try:
            listed = json.loads(list_result["stdout"])
        except json.JSONDecodeError:
            listed = {}
        installed = listed.get("installed", []) if isinstance(listed, dict) else []
        matching = next(
            (
                item
                for item in installed
                if isinstance(item, dict)
                and item.get("name") == PACKAGE_NAME
                and item.get("marketplaceName") == MARKETPLACE_NAME
            ),
            None,
        )
        if (
            list_result["returncode"] != 0
            or not isinstance(matching, dict)
            or matching.get("version") != version
            or matching.get("enabled") is not True
            or matching.get("source")
            != {
                "source": "npm",
                "package": PACKAGE_NAME,
                "version": version,
                "registry": REGISTRY,
            }
            or matching.get("marketplaceSource")
            != {"sourceType": "git", "source": MARKETPLACE_GIT_SOURCE}
        ):
            checks.append(
                check(
                    "codex-plugin",
                    "failed",
                    "installed-plugin-contract-mismatch",
                    observed=matching,
                    message=message(list_result),
                )
            )
        else:
            checks.append(check("codex-plugin", "passed", "exact-version-installed-and-enabled", version=version))

    status = final_status(checks)
    return {"package": PACKAGE_NAME, "version": version, "status": status, "checks": checks}


def main(arguments: list[str]) -> int:
    if len(arguments) != 1:
        output = {
            "package": PACKAGE_NAME,
            "version": arguments[0] if arguments else None,
            "status": "invalid",
            "checks": [check("requested-version", "invalid", "one-exact-version-required")],
        }
    else:
        output = verify(arguments[0])
    print(json.dumps(output, indent=2, sort_keys=True))
    return EXIT_CODE[output["status"]]


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
