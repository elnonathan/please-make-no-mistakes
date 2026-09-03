#!/usr/bin/env python3
"""Dependency-free release validation for please-make-no-mistakes."""

from __future__ import annotations

import ast
import json
import os
import re
import stat
import sys
import zlib
from pathlib import Path
from urllib.parse import unquote, urlsplit

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_FILE = PACKAGE_ROOT / "package.json"
PLUGIN_FILE = PACKAGE_ROOT / ".codex-plugin" / "plugin.json"
MARKETPLACE_FILE = PACKAGE_ROOT / ".agents" / "plugins" / "marketplace.json"
CI_FILE = PACKAGE_ROOT / ".github" / "workflows" / "ci.yml"
PUBLISH_FILE = PACKAGE_ROOT / ".github" / "workflows" / "publish.yml"
SETUP_FILE = PACKAGE_ROOT / "SETUP.md"
ARCHITECTURE_FILE = PACKAGE_ROOT / "ARCHITECTURE.md"
SECURITY_FILE = PACKAGE_ROOT / "SECURITY.md"
CONTRIBUTING_FILE = PACKAGE_ROOT / "CONTRIBUTING.md"
CHANGELOG_FILE = PACKAGE_ROOT / "CHANGELOG.md"
ROADMAP_FILE = PACKAGE_ROOT / "ROADMAP.md"
DECISIONS_FILE = PACKAGE_ROOT / "docs" / "architecture-decisions.md"
DISTRIBUTION_FILE = PACKAGE_ROOT / "docs" / "distribution.md"
GETTING_STARTED_FILE = PACKAGE_ROOT / "docs" / "getting-started.md"
POSTPUBLICATION_FILE = PACKAGE_ROOT / "scripts" / "postpublication_smoke.py"
SKILL_ROOT = PACKAGE_ROOT / "skills" / "please-make-no-mistakes"
SKILL_FILE = SKILL_ROOT / "SKILL.md"
OPENAI_FILE = SKILL_ROOT / "agents" / "openai.yaml"
ACTIVATION_FILE = PACKAGE_ROOT / "evals" / "activation-cases.json"
AGENT_EVALUATION_FILE = PACKAGE_ROOT / "evals" / "agent-evaluation-cases.json"
BEHAVIOR_FILE = PACKAGE_ROOT / "evals" / "behavior-cases.md"
TRACE_SCHEMA_FILE = PACKAGE_ROOT / "evals" / "trace.schema.json"
HOST_GUARD_CASES_FILE = PACKAGE_ROOT / "evals" / "host-guard-cases.json"
HOOK_CONFIG_FILE = PACKAGE_ROOT / "hooks" / "hooks.json"
HOOK_RUNTIME_FILE = PACKAGE_ROOT / "hooks" / "pmnm-guard.mjs"
HOOK_TEST_FILE = PACKAGE_ROOT / "scripts" / "test_host_guard.mjs"
CONTEXT_STORE_RUNTIME = SKILL_ROOT / "scripts" / "context_store.py"

PUBLIC_AUTHOR_NAME = "Jonathan Muñoz Lucas"
PUBLIC_AUTHOR_EMAIL = "git" + chr(64) + "jonathanmunoz.dev"
PUBLIC_AUTHOR_URL = "https://github.com/elnonathan"
PUBLIC_DISPLAY_NAME = "Please, Make No Mistakes"
PUBLIC_MARKETPLACE_DISPLAY_NAME = f"{PUBLIC_DISPLAY_NAME} — {PUBLIC_AUTHOR_NAME}"
CHECKOUT_ACTION = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1"
SETUP_NODE_ACTION = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020"
SETUP_PYTHON_ACTION = "actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97"
PUBLISH_NPM_VERSION = "11.19.1"

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SEMVER_RE = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MARKDOWN_LINK_RE = re.compile(
    r"!?\[[^\]]*\]\(\s*(?P<target><[^>]+>|[^\s)]+)"
    r"(?:\s+(?:\"[^\"]*\"|'[^']*'))?\s*\)"
)
BEHAVIOR_HEADING_RE = re.compile(r"(?m)^## (?P<number>[1-9]\d*)\. (?P<title>[^\n]+)$")
EMAIL_ADDRESS_RE = re.compile(
    r"(?i)(?<![a-z0-9._%+-])[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}"
    r"(?![a-z0-9.-])"
)

IGNORED_TREE_NAMES = {".git", "node_modules"}
CACHE_DIR_NAMES = {
    ".cache",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    "__pycache__",
}
OS_METADATA_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
SENSITIVE_FILE_NAMES = {".env", ".npmrc", ".pypirc", "credentials", "id_ed25519", "id_rsa"}
PRIVATE_PATTERNS = (
    (
        re.compile(r"(?<![A-Za-z0-9])/(?:Users|home)/[^/\s`\"']+(?:/[^\s`\"']*)?"),
        "user-specific absolute home path",
    ),
    (
        re.compile(r"(?i)\b[a-z]:\\Users\\[^\\\s`\"']+(?:\\[^\s`\"']*)?"),
        "user-specific Windows home path",
    ),
    (
        re.compile(r"-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----"),
        "private-key material",
    ),
    (
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        "credential-like token",
    ),
    (
        re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
        "credential-like token",
    ),
    (
        re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
        "credential-like token",
    ),
)

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_PUBLIC_METADATA_TEXT = 1_000_000


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def warn(warnings: list[str], message: str) -> None:
    warnings.append(message)


def relative(path: Path) -> str:
    try:
        return path.relative_to(PACKAGE_ROOT).as_posix()
    except ValueError:
        return str(path)


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def load_json(path: Path, errors: list[str]) -> object | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(errors, f"Missing required JSON file: {relative(path)}")
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        fail(errors, f"Invalid JSON in {relative(path)}: {exc}")
    return None


def parse_frontmatter(text: str, errors: list[str]) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        fail(errors, "SKILL.md must start with YAML frontmatter delimiter '---'.")
        return {}
    try:
        end = lines.index("---", 1)
    except ValueError:
        fail(errors, "SKILL.md frontmatter is not closed with '---'.")
        return {}

    result: dict[str, str] = {}
    for number, line in enumerate(lines[1:end], start=2):
        if not line.strip():
            continue
        if line[0].isspace() or ":" not in line:
            fail(errors, f"Invalid frontmatter line {number}: {line!r}")
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        if key in result:
            fail(errors, f"Duplicate SKILL.md frontmatter field: {key!r}")
            continue
        result[key] = value.strip().strip('"').strip("'")

    allowed = {"name", "description"}
    unknown = sorted(set(result) - allowed)
    if unknown:
        fail(errors, f"SKILL.md frontmatter allows only name and description; found: {', '.join(unknown)}")
    return result


def validate_manifest(manifest: object | None, errors: list[str]) -> dict[str, object]:
    if not isinstance(manifest, dict):
        fail(errors, "package.json must contain a JSON object.")
        return {}

    name = manifest.get("name")
    version = manifest.get("version")
    files = manifest.get("files")
    scripts = manifest.get("scripts")

    if not isinstance(name, str) or not NAME_RE.fullmatch(name):
        fail(errors, f"package.json has an invalid package name: {name!r}")
    if not isinstance(version, str) or not SEMVER_RE.fullmatch(version):
        fail(errors, f"package.json has an invalid semantic version: {version!r}")
    if manifest.get("engines") != {"node": ">=22 <25"}:
        fail(errors, "package.json must declare the Node.js 22 and 24 host-guard support envelope.")
    if not isinstance(files, list) or not files or not all(isinstance(item, str) and item for item in files):
        fail(errors, "package.json files must be a non-empty array of non-empty strings.")
    if not isinstance(scripts, dict):
        fail(errors, "package.json scripts must be an object.")
    else:
        for required in (
            "validate",
            "test",
            "check:documentation",
            "test:documentation",
            "evaluate:agent",
            "smoke:evaluation",
            "test:release-verify",
            "test:host-guard",
            "ci:portable",
            "smoke:distribution",
            "release:verify",
            "verify:published",
        ):
            if not isinstance(scripts.get(required), str) or not scripts[required].strip():
                fail(errors, f"package.json is missing a non-empty {required!r} script.")
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
        declared_lifecycle = sorted(lifecycle_names.intersection(scripts))
        if declared_lifecycle:
            fail(errors, f"package.json must not declare lifecycle scripts: {declared_lifecycle}")
    for dependency_field in ("dependencies", "optionalDependencies", "bundleDependencies"):
        if manifest.get(dependency_field):
            fail(errors, f"Plugin must not declare runtime registry {dependency_field}.")

    required_files = {
        ".codex-plugin",
        "hooks",
        "skills/please-make-no-mistakes",
        "ARCHITECTURE.md",
        "CHANGELOG.md",
        "CONTRIBUTING.md",
        "ROADMAP.md",
        "SECURITY.md",
        "SETUP.md",
        "docs",
        "evals",
        "scripts/postpublication_smoke.py",
        "scripts/documentation_contract.py",
        "scripts/documentation_gate.py",
        "scripts/test_documentation_gate.py",
        "scripts/agent_evaluation.py",
        "scripts/test_agent_evaluation.py",
        "scripts/release_verify.py",
        "scripts/test_release_verify.py",
        "scripts/test_host_guard.mjs",
    }
    declared_files = {item for item in files if isinstance(item, str)} if isinstance(files, list) else set()
    missing_files = sorted(required_files - declared_files)
    if missing_files:
        fail(errors, f"package.json files is missing required plugin payload entries: {missing_files}")
    forbidden_files = sorted(
        entry
        for entry in declared_files
        if entry == "AGENTS.md"
        or entry.startswith(".ai")
        or entry.startswith(".agents")
        or entry.startswith(".github")
        or entry.startswith("public/")
    )
    if forbidden_files:
        fail(errors, f"package.json files exposes private, repository-only, or obsolete paths: {forbidden_files}")

    if manifest.get("license") != "MIT":
        fail(errors, "package.json license must remain MIT.")
    repository = manifest.get("repository")
    if not isinstance(repository, dict) or repository.get("type") != "git":
        fail(errors, "package.json repository must declare a git source.")
    for field in ("homepage", "bugs", "publishConfig", "author"):
        if not isinstance(manifest.get(field), dict) and field in {"bugs", "publishConfig", "author"}:
            fail(errors, f"package.json {field} metadata must be an object.")
        if field == "homepage" and not isinstance(manifest.get(field), str):
            fail(errors, "package.json homepage metadata must be a string.")
    expected_author = {
        "name": PUBLIC_AUTHOR_NAME,
        "email": PUBLIC_AUTHOR_EMAIL,
        "url": PUBLIC_AUTHOR_URL,
    }
    if manifest.get("author") != expected_author:
        fail(errors, "package.json author must match the explicitly public professional identity.")
    return manifest


def validate_frontmatter(manifest: dict[str, object], errors: list[str]) -> dict[str, str]:
    try:
        text = SKILL_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot read {relative(SKILL_FILE)}: {exc}")
        return {}

    data = parse_frontmatter(text, errors)
    name = data.get("name", "")
    description = data.get("description", "")

    if not name:
        fail(errors, "Frontmatter field 'name' is required.")
    elif not NAME_RE.fullmatch(name):
        fail(errors, f"Invalid skill name: {name!r}")
    elif len(name) > 64:
        fail(errors, "Skill name exceeds 64 characters.")
    elif name != SKILL_ROOT.name:
        fail(errors, f"Skill name {name!r} must match directory {SKILL_ROOT.name!r}.")

    package_name = manifest.get("name")
    if isinstance(package_name, str) and name and name != package_name:
        fail(errors, f"Skill name {name!r} must match package name {package_name!r}.")

    if not description:
        fail(errors, "Frontmatter field 'description' is required.")
    elif len(description) > 1024:
        fail(errors, f"Description exceeds 1024 characters ({len(description)}).")

    line_count = len(text.splitlines())
    if line_count > 500:
        fail(errors, f"SKILL.md exceeds 500 lines ({line_count}).")
    return data


def validate_plugin_manifest(
    package_manifest: dict[str, object],
    skill_frontmatter: dict[str, str],
    errors: list[str],
) -> None:
    plugin = load_json(PLUGIN_FILE, errors)
    if not isinstance(plugin, dict):
        return

    allowed = {
        "name",
        "version",
        "description",
        "author",
        "homepage",
        "repository",
        "license",
        "keywords",
        "skills",
        "interface",
    }
    unknown = sorted(set(plugin) - allowed)
    if unknown:
        fail(errors, f"plugin.json contains unsupported fields: {unknown}")

    for field in ("name", "version", "description", "license"):
        if plugin.get(field) != package_manifest.get(field):
            fail(errors, f"plugin.json {field} must match package.json.")
    if plugin.get("name") != skill_frontmatter.get("name"):
        fail(errors, "plugin.json name must match SKILL.md frontmatter.")
    if plugin.get("skills") != "./skills/":
        fail(errors, "plugin.json skills must be './skills/'.")
    if "hooks" in plugin:
        fail(errors, "plugin.json must use default hooks/hooks.json discovery for validator compatibility.")
    for unsupported in ("apps", "mcpServers"):
        if unsupported in plugin:
            fail(errors, f"Plugin must not declare unsupported runtime surface {unsupported}.")

    author = plugin.get("author")
    package_author = package_manifest.get("author")
    expected_author = {
        "name": PUBLIC_AUTHOR_NAME,
        "email": PUBLIC_AUTHOR_EMAIL,
        "url": PUBLIC_AUTHOR_URL,
    }
    if author != expected_author:
        fail(errors, "plugin.json author must match the explicitly public professional identity.")
    elif not isinstance(package_author, dict) or author.get("name") != package_author.get("name"):
        fail(errors, "plugin.json author.name must match package.json author.name.")

    interface = plugin.get("interface")
    if not isinstance(interface, dict):
        fail(errors, "plugin.json interface must be an object.")
        return
    allowed_interface = {
        "displayName",
        "shortDescription",
        "longDescription",
        "developerName",
        "category",
        "capabilities",
        "defaultPrompt",
    }
    unknown_interface = sorted(set(interface) - allowed_interface)
    if unknown_interface:
        fail(errors, f"plugin.json interface contains unsupported fields: {unknown_interface}")
    for field in (
        "displayName",
        "shortDescription",
        "longDescription",
        "developerName",
        "category",
    ):
        value = interface.get(field)
        if not isinstance(value, str) or not value.strip():
            fail(errors, f"plugin.json interface.{field} must be a non-empty string.")
    if isinstance(author, dict) and interface.get("developerName") != author.get("name"):
        fail(errors, "plugin.json interface.developerName must match author.name.")
    capabilities = interface.get("capabilities")
    if not isinstance(capabilities, list) or not capabilities or not all(
        isinstance(item, str) and item.strip() for item in capabilities
    ):
        fail(errors, "plugin.json interface.capabilities must be a non-empty string array.")
    prompts = interface.get("defaultPrompt")
    if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3:
        fail(errors, "plugin.json interface.defaultPrompt must contain one to three prompts.")
    elif not all(isinstance(item, str) and item.strip() and len(item) <= 128 for item in prompts):
        fail(errors, "plugin.json default prompts must be non-empty strings of at most 128 characters.")

    skills_root = PACKAGE_ROOT / "skills"
    if skills_root.is_dir():
        skill_directories = sorted(
            path.name for path in skills_root.iterdir() if path.is_dir() and not path.is_symlink()
        )
        if skill_directories != [skill_frontmatter.get("name")]:
            fail(errors, f"Plugin must package exactly its declared skill directory: {skill_directories}")


def validate_host_hooks(errors: list[str]) -> None:
    config = load_json(HOOK_CONFIG_FILE, errors)
    if not isinstance(config, dict):
        return
    if set(config) != {"description", "hooks"}:
        fail(errors, "hooks/hooks.json must contain exactly description and hooks.")
        return
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
        fail(errors, "hooks/hooks.json must declare exactly the supported PMNM lifecycle events.")
        return

    expected_matchers = {
        "SessionStart": "startup|resume|clear|compact",
        "PreToolUse": "Bash|apply_patch|Edit|Write",
        "PostToolUse": "Bash|apply_patch|Edit|Write",
    }
    expected_command = 'node "${PLUGIN_ROOT}/hooks/pmnm-guard.mjs"'
    expected_windows = 'node "${PLUGIN_ROOT}\\hooks\\pmnm-guard.mjs"'
    for event_name in sorted(expected_events):
        groups = hooks.get(event_name)
        if not isinstance(groups, list) or len(groups) != 1 or not isinstance(groups[0], dict):
            fail(errors, f"hooks/hooks.json {event_name} must contain exactly one matcher group.")
            continue
        group = groups[0]
        expected_matcher = expected_matchers.get(event_name)
        if expected_matcher is None:
            if "matcher" in group:
                fail(errors, f"hooks/hooks.json {event_name} must not declare an ignored matcher.")
        elif group.get("matcher") != expected_matcher:
            fail(errors, f"hooks/hooks.json {event_name} matcher is not the expected bounded matcher.")
        handlers = group.get("hooks")
        if not isinstance(handlers, list) or len(handlers) != 1 or not isinstance(handlers[0], dict):
            fail(errors, f"hooks/hooks.json {event_name} must contain exactly one command handler.")
            continue
        handler = handlers[0]
        if handler.get("type") != "command":
            fail(errors, f"hooks/hooks.json {event_name} handler must be a command.")
        if handler.get("command") != expected_command:
            fail(errors, f"hooks/hooks.json {event_name} must resolve the bundled runtime through PLUGIN_ROOT.")
        if handler.get("commandWindows") != expected_windows:
            fail(errors, f"hooks/hooks.json {event_name} Windows command must resolve through PLUGIN_ROOT.")
        timeout = handler.get("timeout")
        if not isinstance(timeout, int) or timeout < 1 or timeout > 5:
            fail(errors, f"hooks/hooks.json {event_name} timeout must be an integer from 1 through 5.")
        limit = handler.get("additionalContextLimit")
        if limit is not None and (not isinstance(limit, int) or limit < 1 or limit > 600):
            fail(errors, f"hooks/hooks.json {event_name} additional context must remain bounded to 600.")
        if event_name == "Stop" and limit is not None:
            fail(errors, "hooks/hooks.json Stop must not declare unsupported additional context.")

    try:
        runtime = HOOK_RUNTIME_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot read bundled host guard: {exc}")
        return
    if HOOK_RUNTIME_FILE.is_symlink() or not HOOK_RUNTIME_FILE.is_file():
        fail(errors, "Bundled host guard must be a regular in-package file.")
    if HOOK_RUNTIME_FILE.stat().st_size > 100_000:
        fail(errors, "Bundled host guard exceeds its inspectable size budget.")
    imports = re.findall(r'(?:from\s+|import\s*\()\s*["\']([^"\']+)["\']', runtime)
    external = sorted({item for item in imports if not item.startswith("node:")})
    if external:
        fail(errors, f"Bundled host guard must remain dependency-free; found imports: {external}")
    for forbidden in ("transcript_path", "child_process", "fetch(", "http://", "https://"):
        if forbidden in runtime:
            fail(errors, f"Bundled host guard contains forbidden data or execution dependency: {forbidden}")

    cases = load_json(HOST_GUARD_CASES_FILE, errors)
    if not isinstance(cases, dict) or cases.get("schema_version") != 1:
        fail(errors, "evals/host-guard-cases.json must use schema_version 1.")
    elif not isinstance(cases.get("cases"), list) or len(cases["cases"]) < 10:
        fail(errors, "Host guard evaluation must contain at least ten adversarial cases.")
    elif len({case.get("id") for case in cases["cases"] if isinstance(case, dict)}) != len(cases["cases"]):
        fail(errors, "Host guard evaluation case IDs must be unique.")
    if not HOOK_TEST_FILE.is_file() or HOOK_TEST_FILE.is_symlink():
        fail(errors, "scripts/test_host_guard.mjs must be a regular packaged test.")


def validate_repository_marketplace(package_manifest: dict[str, object], errors: list[str]) -> None:
    marketplace = load_json(MARKETPLACE_FILE, errors)
    if not isinstance(marketplace, dict):
        return
    if set(marketplace) != {"name", "interface", "plugins"}:
        fail(errors, "Repository marketplace must contain exactly name, interface, and plugins.")
    if marketplace.get("name") != "please-make-no-mistakes":
        fail(errors, "Repository marketplace name must be project-specific to avoid cross-repository collisions.")
    interface = marketplace.get("interface")
    if not isinstance(interface, dict) or not isinstance(interface.get("displayName"), str):
        fail(errors, "Repository marketplace interface.displayName is required.")
    elif interface.get("displayName") != PUBLIC_MARKETPLACE_DISPLAY_NAME:
        fail(errors, "Repository marketplace display name must match its public attribution.")
    plugins = marketplace.get("plugins")
    if not isinstance(plugins, list) or len(plugins) != 1 or not isinstance(plugins[0], dict):
        fail(errors, "Repository marketplace must contain exactly one plugin entry.")
        return
    entry = plugins[0]
    if entry.get("name") != package_manifest.get("name"):
        fail(errors, "Marketplace plugin name must match package.json.")
    expected_source = {
        "source": "npm",
        "package": package_manifest.get("name"),
        "version": package_manifest.get("version"),
        "registry": "https://registry.npmjs.org",
    }
    if entry.get("source") != expected_source:
        fail(errors, "Repository marketplace must pin the exact package.json version from npmjs.org.")
    if entry.get("policy") != {"installation": "AVAILABLE", "authentication": "ON_INSTALL"}:
        fail(errors, "Repository marketplace policy must be AVAILABLE with ON_INSTALL.")
    if not isinstance(entry.get("category"), str) or not entry["category"].strip():
        fail(errors, "Repository marketplace category must be a non-empty string.")


def yaml_top_level_block(text: str, key: str) -> list[str]:
    lines = text.splitlines()
    marker = f"{key}:"
    try:
        start = lines.index(marker)
    except ValueError:
        return []
    result: list[str] = []
    for line in lines[start + 1 :]:
        if line and not line.startswith(" "):
            break
        if line.strip():
            result.append(line)
    return result


def validate_publish_workflow_text(text: str, errors: list[str]) -> None:
    trigger = [line.strip() for line in yaml_top_level_block(text, "on")]
    if trigger != ["push:", "tags:", '- "v*"']:
        fail(errors, "Publish workflow must run only for tags matching v*.")

    permissions = [line.strip() for line in yaml_top_level_block(text, "permissions")]
    if permissions != ["contents: read", "id-token: write"]:
        fail(errors, "Publish workflow must grant only contents:read and id-token:write.")

    required_literals = (
        "group: npm-publish-${{ github.ref }}",
        "cancel-in-progress: false",
        "if: github.repository == 'elnonathan/please-make-no-mistakes'",
        "runs-on: ubuntu-latest",
        "environment: npm-publish",
        f"uses: {CHECKOUT_ACTION}",
        f"uses: {SETUP_NODE_ACTION}",
        "node-version: 24",
        "registry-url: https://registry.npmjs.org",
        "package-manager-cache: false",
        f"uses: {SETUP_PYTHON_ACTION}",
        'python-version: "3.13"',
        f"run: npm install --global npm@{PUBLISH_NPM_VERSION}",
        "run: npm run release:verify",
        "run: npm publish --access public",
    )
    for literal in required_literals:
        if literal not in text:
            fail(errors, f"Publish workflow is missing required release control: {literal}")

    if not re.search(r'run: test "v\$\(node -p .*package\.json.*\)" = "\$GITHUB_REF_NAME"', text):
        fail(errors, "Publish workflow must reject tags that differ from package.json version.")
    if text.count("run: npm publish --access public") != 1:
        fail(errors, "Publish workflow must contain exactly one public npm publication step.")
    if len(re.findall(r"(?m)^\s*permissions:", text)) != 1:
        fail(errors, "Publish workflow must not override its minimal top-level permissions.")
    identity_position = text.find("- name: Verify release identity")
    gate_position = text.find("run: npm run release:verify")
    publish_position = text.find("run: npm publish --access public")
    if not 0 <= identity_position < gate_position < publish_position:
        fail(errors, "Publish workflow must verify identity and the release gate before publication.")
    folded = text.casefold()
    for forbidden in (
        "node_auth_token",
        "npm_token",
        "secrets.",
        "continue-on-error:",
        "if: always()",
        "npm ci",
        "pull_request:",
        "workflow_dispatch:",
        "schedule:",
        "branches:",
    ):
        if forbidden in folded:
            fail(errors, f"Publish workflow contains a forbidden trigger, credential, or install step: {forbidden}")


def validate_publish_workflow(errors: list[str]) -> None:
    try:
        text = PUBLISH_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot inspect publish workflow: {exc}")
        return
    validate_publish_workflow_text(text, errors)


def validate_documentation_and_repository_contract(payload: set[Path], errors: list[str]) -> None:
    required_public = {
        SETUP_FILE,
        ARCHITECTURE_FILE,
        SECURITY_FILE,
        CONTRIBUTING_FILE,
        CHANGELOG_FILE,
        ROADMAP_FILE,
        DECISIONS_FILE,
        DISTRIBUTION_FILE,
        GETTING_STARTED_FILE,
    }
    for path in sorted(required_public):
        if not path.is_file():
            fail(errors, f"Missing public documentation owner: {relative(path)}")
        elif not payload_contains(path, payload):
            fail(errors, f"Public documentation owner is not packaged: {relative(path)}")

    try:
        readme = (PACKAGE_ROOT / "README.md").read_text(encoding="utf-8")
        setup = SETUP_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot inspect README/SETUP documentation contract: {exc}")
        return
    for required in (
        "[SETUP.md](SETUP.md)",
        "[docs/distribution.md](docs/distribution.md)",
        "[Getting started](docs/getting-started.md)",
        "skills/please-make-no-mistakes",
    ):
        if required not in readme:
            fail(errors, f"README.md is missing required public route: {required}")
    for forbidden in (
        "$HOME/.agents/skills",
        "\nln -s ",
        "Install from the Plugins Directory",
        "codex plugin marketplace add",
        "codex plugin add please-make-no-mistakes",
    ):
        if forbidden in readme:
            fail(errors, f"README.md contains an unsupported installation route: {forbidden!r}")
    for required in (
        "## Guards",
        "## Install With Codex",
        "## Install With Another Host",
        "## Verify The Installation",
        "codex plugin marketplace add elnonathan/please-make-no-mistakes",
        "codex plugin add please-make-no-mistakes@please-make-no-mistakes --json",
        "codex plugin marketplace add /absolute/path/to/please-make-no-mistakes",
        "npm run verify:published -- <version>",
        "`npm install` alone is not host registration",
    ):
        if required not in setup:
            fail(errors, f"SETUP.md is missing required procedure or boundary: {required}")
    try:
        distribution = DISTRIBUTION_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot inspect distribution documentation: {exc}")
    else:
        for required in (
            "The package must already exist on npm before Trusted Publishing can be configured.",
            "npm publish --access public --tag bootstrap",
            "npm run verify:published -- <version>",
        ):
            if required not in distribution:
                fail(errors, f"Distribution documentation is missing a release boundary: {required}")

    try:
        from documentation_contract import validate_repository as validate_documentation_contract
    except ImportError as exc:
        fail(errors, f"Cannot import documentation contract: {exc}")
    else:
        for finding in validate_documentation_contract(PACKAGE_ROOT):
            fail(errors, f"Documentation contract {finding.code} in {finding.path}: {finding.message}")

    try:
        ci = CI_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot inspect CI workflow: {exc}")
    else:
        if "npm run release:verify" not in ci:
            fail(errors, "CI must run npm run release:verify.")
        if "npm run ci:portable" not in ci:
            fail(errors, "CI must run the portable profile on non-POSIX candidates.")
        for required in (
            CHECKOUT_ACTION,
            SETUP_NODE_ACTION,
            "runs-on: ${{ matrix.os }}",
            "os: ubuntu-latest",
            "os: macos-latest",
            "os: windows-latest",
            "profile: full",
            "profile: portable",
            'node-version: "22"',
            'node-version: "24"',
            "node-version: ${{ matrix.node-version }}",
            "package-manager-cache: false",
            SETUP_PYTHON_ACTION,
            'python-version: "3.9"',
            'python-version: "3.13"',
            "python-version: ${{ matrix.python-version }}",
        ):
            if required not in ci:
                fail(errors, f"CI is missing a supported release-gate runtime control: {required}")
        for forbidden in ("npm publish", "git push", "gh release", "plugin submission"):
            if forbidden in ci:
                fail(errors, f"CI must validate without external publication action: {forbidden}")

    private_paths = {
        ".ai/": PACKAGE_ROOT / ".ai",
        "AGENTS.md": PACKAGE_ROOT / "AGENTS.md",
    }
    present_private_paths = {
        rule: path for rule, path in private_paths.items() if os.path.lexists(path)
    }
    if present_private_paths:
        exclude_file = PACKAGE_ROOT / ".git" / "info" / "exclude"
        try:
            exclude_lines = {
                line.strip()
                for line in exclude_file.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            }
        except (OSError, UnicodeError) as exc:
            fail(errors, f"Local private coordination exists but .git/info/exclude is unavailable: {exc}")
        else:
            for required in present_private_paths:
                if required not in exclude_lines:
                    fail(errors, f".git/info/exclude must contain {required!r} while that local path exists.")

    try:
        public_ignore = (PACKAGE_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot inspect .gitignore: {exc}")
    else:
        if any(line.strip() in {".ai/", "AGENTS.md"} for line in public_ignore):
            fail(errors, "Private maintainer coordination belongs in .git/info/exclude, not .gitignore.")

    for private in present_private_paths.values():
        if payload_contains(private, payload):
            fail(errors, f"Private coordination must not be packaged: {relative(private)}")
    if (PACKAGE_ROOT / "IMPROVEMENT-BACKLOG.md").exists():
        fail(errors, "Root IMPROVEMENT-BACKLOG.md must be relocated to private project state.")
    if (PACKAGE_ROOT / ".ai").exists() and not (PACKAGE_ROOT / ".ai" / "project" / "BACKLOG.md").is_file():
        fail(errors, "Private project backlog is missing after relocation.")
    if (PACKAGE_ROOT / "public").exists():
        fail(errors, "Obsolete public/ compatibility tree must not remain.")
    for repository_only in (MARKETPLACE_FILE, CI_FILE, PUBLISH_FILE):
        if payload_contains(repository_only, payload):
            fail(errors, f"Repository-only distribution control must not enter the npm payload: {relative(repository_only)}")


def manifest_entry_path(entry: str, errors: list[str]) -> Path | None:
    candidate = Path(entry)
    if candidate.is_absolute() or ".." in candidate.parts:
        fail(errors, f"package.json files entry escapes the package root: {entry!r}")
        return None
    if any(character in entry for character in "*?[]{}"):
        fail(errors, f"Globs are not supported in package.json files; declare a stable path: {entry!r}")
        return None
    resolved = (PACKAGE_ROOT / candidate).resolve(strict=False)
    if not is_within(resolved, PACKAGE_ROOT):
        fail(errors, f"package.json files entry resolves outside the package: {entry!r}")
        return None
    return PACKAGE_ROOT / candidate


def add_declared_tree(root: Path, payload: set[Path], errors: list[str]) -> None:
    if not os.path.lexists(root):
        fail(errors, f"Declared package path does not exist: {relative(root)}")
        return
    if root.is_symlink() or root.is_file():
        payload.add(root)
        return
    if not root.is_dir():
        fail(errors, f"Declared package path is not a regular file or directory: {relative(root)}")
        return

    for current, directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        kept_directories: list[str] = []
        for name in directories:
            child = current_path / name
            if name in IGNORED_TREE_NAMES:
                continue
            if name in CACHE_DIR_NAMES:
                fail(errors, f"Cache directory appears inside declared payload: {relative(child)}")
                continue
            if child.is_symlink():
                payload.add(child)
            else:
                kept_directories.append(name)
        directories[:] = kept_directories
        for name in filenames:
            payload.add(current_path / name)


def collect_payload(manifest: dict[str, object], errors: list[str]) -> set[Path]:
    payload: set[Path] = {PACKAGE_FILE}
    for readme in PACKAGE_ROOT.glob("[Rr][Ee][Aa][Dd][Mm][Ee]*"):
        if readme.is_file() or readme.is_symlink():
            payload.add(readme)
    for license_file in PACKAGE_ROOT.glob("[Ll][Ii][Cc][Ee][Nn][Ss][Ee]*"):
        if license_file.is_file() or license_file.is_symlink():
            payload.add(license_file)

    entries = manifest.get("files", [])
    if isinstance(entries, list):
        for entry in entries:
            if not isinstance(entry, str):
                continue
            path = manifest_entry_path(entry, errors)
            if path is not None:
                add_declared_tree(path, payload, errors)
    return payload


def collect_repository_public_files() -> set[Path]:
    public: set[Path] = set()
    for current, directories, filenames in os.walk(PACKAGE_ROOT, followlinks=False):
        current_path = Path(current)
        directories[:] = [
            name
            for name in directories
            if name not in IGNORED_TREE_NAMES
            and name not in CACHE_DIR_NAMES
            and not (current_path == PACKAGE_ROOT and name == ".ai")
        ]
        for name in filenames:
            path = current_path / name
            if path == PACKAGE_ROOT / "AGENTS.md":
                continue
            public.add(path)
    return public


def validate_payload_types_and_symlinks(payload: set[Path], errors: list[str]) -> None:
    resolved_payload = {path.resolve(strict=False) for path in payload if not path.is_symlink()}
    for path in sorted(payload):
        try:
            mode = path.lstat().st_mode
        except OSError as exc:
            fail(errors, f"Cannot inspect declared payload path {relative(path)}: {exc}")
            continue

        if stat.S_ISLNK(mode):
            try:
                target = path.resolve(strict=True)
            except (OSError, RuntimeError) as exc:
                fail(errors, f"Broken or cyclic symlink in declared payload {relative(path)}: {exc}")
                continue
            if not is_within(target, PACKAGE_ROOT):
                fail(errors, f"Symlink escapes declared payload: {relative(path)}")
            elif target not in resolved_payload and not any(is_within(candidate, target) for candidate in resolved_payload):
                fail(errors, f"Symlink target is not otherwise declared in payload: {relative(path)} -> {relative(target)}")
        elif not stat.S_ISREG(mode):
            fail(errors, f"Special filesystem entry is not allowed in declared payload: {relative(path)}")


def markdown_link_targets(text: str) -> list[str]:
    targets: list[str] = []
    for match in MARKDOWN_LINK_RE.finditer(text):
        target = match.group("target")
        if target.startswith("<") and target.endswith(">"):
            target = target[1:-1]
        targets.append(target)
    return targets


def local_link_path(source: Path, target: str) -> Path | None:
    if target.startswith("#"):
        return None
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc or target.startswith("//"):
        return None
    clean = unquote(parsed.path)
    if not clean:
        return None
    if Path(clean).is_absolute() or re.match(r"^[A-Za-z]:[\\/]", clean):
        return Path(clean)
    return (source.parent / clean).resolve(strict=False)


def payload_contains(target: Path, payload: set[Path]) -> bool:
    resolved_payload = {path.resolve(strict=False) for path in payload}
    resolved_target = target.resolve(strict=False)
    if resolved_target in resolved_payload:
        return True
    return target.is_dir() and any(is_within(candidate, resolved_target) for candidate in resolved_payload)


def validate_links(payload: set[Path], errors: list[str]) -> None:
    for path in sorted(item for item in payload if item.suffix.lower() == ".md"):
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            fail(errors, f"Cannot read Markdown file {relative(path)}: {exc}")
            continue
        for target in markdown_link_targets(text):
            resolved = local_link_path(path, target)
            if resolved is None:
                continue
            if not is_within(resolved, PACKAGE_ROOT):
                fail(errors, f"Relative link escapes package payload in {relative(path)}: {target}")
            elif not os.path.lexists(resolved):
                fail(errors, f"Broken relative link in {relative(path)}: {target}")
            elif not payload_contains(resolved, payload):
                fail(errors, f"Relative link points to an unpackaged target in {relative(path)}: {target}")


def validate_reference_routing(payload: set[Path], errors: list[str]) -> None:
    try:
        skill_text = SKILL_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return
    linked: set[Path] = set()
    for target in markdown_link_targets(skill_text):
        resolved = local_link_path(SKILL_FILE, target)
        if resolved is not None and is_within(resolved, SKILL_ROOT):
            linked.add(resolved.resolve(strict=False))

    references = sorted((SKILL_ROOT / "references").glob("*.md"))
    for ref in references:
        if ref.resolve(strict=False) not in linked:
            fail(errors, f"Reference is not directly linked from SKILL.md: {relative(ref)}")
        if not payload_contains(ref, payload):
            fail(errors, f"Reference is not included in declared payload: {relative(ref)}")


def report_configured_private_terms(
    path_label: str,
    raw: bytes,
    text: str,
    configured_terms: list[str],
    errors: list[str],
) -> None:
    folded_path = path_label.casefold()
    folded_text = text.casefold()
    for index, token in enumerate(configured_terms, start=1):
        scopes: list[str] = []
        if token.casefold() in folded_path:
            scopes.append("path/name")
        encoded = token.encode("utf-8")
        if token.casefold() in folded_text or encoded in raw:
            scopes.append("content")
        if scopes:
            fail(
                errors,
                f"Public file {path_label} contains configured private term #{index} in {' and '.join(scopes)}.",
            )


def decompress_bounded_png_text(
    compressed: bytes,
    path_label: str,
    chunk_name: str,
    errors: list[str],
) -> bytes | None:
    try:
        decoder = zlib.decompressobj()
        output = decoder.decompress(compressed, MAX_PUBLIC_METADATA_TEXT + 1)
    except zlib.error as exc:
        fail(errors, f"Public PNG {path_label} has invalid {chunk_name} metadata: {exc}")
        return None
    if len(output) > MAX_PUBLIC_METADATA_TEXT or decoder.unconsumed_tail or not decoder.eof:
        fail(errors, f"Public PNG {path_label} has oversized or incomplete {chunk_name} metadata.")
        return None
    return output


def png_metadata_text(raw: bytes, path_label: str, errors: list[str]) -> list[str]:
    if not raw.startswith(PNG_SIGNATURE):
        return []

    result: list[str] = []
    position = len(PNG_SIGNATURE)
    while position + 12 <= len(raw):
        length = int.from_bytes(raw[position : position + 4], "big")
        chunk_type = raw[position + 4 : position + 8]
        data_start = position + 8
        data_end = data_start + length
        chunk_end = data_end + 4
        if chunk_end > len(raw):
            fail(errors, f"Public PNG {path_label} has a truncated metadata or image chunk.")
            return result
        data = raw[data_start:data_end]

        if chunk_type == b"tEXt":
            keyword, separator, value = data.partition(b"\0")
            if not separator:
                fail(errors, f"Public PNG {path_label} has malformed tEXt metadata.")
            else:
                result.append(keyword.decode("latin-1") + "\n" + value.decode("latin-1"))
        elif chunk_type == b"zTXt":
            keyword, separator, remainder = data.partition(b"\0")
            if not separator or len(remainder) < 2 or remainder[0] != 0:
                fail(errors, f"Public PNG {path_label} has malformed zTXt metadata.")
            else:
                value = decompress_bounded_png_text(remainder[1:], path_label, "zTXt", errors)
                if value is not None:
                    result.append(keyword.decode("latin-1") + "\n" + value.decode("latin-1"))
        elif chunk_type == b"iTXt":
            keyword, separator, remainder = data.partition(b"\0")
            if not separator or len(remainder) < 2:
                fail(errors, f"Public PNG {path_label} has malformed iTXt metadata.")
            else:
                compression_flag, compression_method = remainder[0], remainder[1]
                language, separator, remainder = remainder[2:].partition(b"\0")
                translated, next_separator, value = remainder.partition(b"\0")
                if not separator or not next_separator or compression_flag not in {0, 1}:
                    fail(errors, f"Public PNG {path_label} has malformed iTXt metadata fields.")
                elif compression_method != 0:
                    fail(errors, f"Public PNG {path_label} uses an unsupported iTXt compression method.")
                else:
                    if compression_flag == 1:
                        value = decompress_bounded_png_text(value, path_label, "iTXt", errors)
                    if value is not None:
                        try:
                            result.append(
                                "\n".join(
                                    (
                                        keyword.decode("latin-1"),
                                        language.decode("ascii"),
                                        translated.decode("utf-8"),
                                        value.decode("utf-8"),
                                    )
                                )
                            )
                        except UnicodeDecodeError as exc:
                            fail(errors, f"Public PNG {path_label} has invalid iTXt encoding: {exc}")
        elif chunk_type == b"eXIf":
            fail(errors, f"Public PNG {path_label} contains opaque EXIF metadata; remove it before release.")

        position = chunk_end
        if chunk_type == b"IEND":
            break
    return result


def report_public_email_addresses(path: Path, text: str, errors: list[str]) -> None:
    approved_metadata_files = {PACKAGE_FILE, PLUGIN_FILE}
    for match in EMAIL_ADDRESS_RE.finditer(text):
        if match.group(0).casefold() != PUBLIC_AUTHOR_EMAIL.casefold():
            fail(errors, f"Public file {relative(path)} contains an unapproved email address.")
        elif path not in approved_metadata_files:
            fail(
                errors,
                f"Public professional email appears outside approved author metadata: {relative(path)}",
            )


def validate_public_boundary(payload: set[Path], errors: list[str]) -> None:
    configured_terms = [
        token.strip()
        for token in os.environ.get("PMNM_PRIVATE_TERMS", "").split(",")
        if token.strip()
    ]
    for path in sorted(payload):
        path_label = relative(path)
        if path.is_symlink() or not path.is_file():
            report_configured_private_terms(path_label, b"", "", configured_terms, errors)
            continue
        try:
            raw = path.read_bytes()
        except OSError as exc:
            fail(errors, f"Cannot scan public file {relative(path)}: {exc}")
            continue
        try:
            text_parts = [raw.decode("utf-8")]
        except UnicodeDecodeError:
            text_parts = png_metadata_text(raw, path_label, errors)
        text = "\n".join(text_parts)
        report_configured_private_terms(path_label, raw, text, configured_terms, errors)
        for pattern, description in PRIVATE_PATTERNS:
            if pattern.search(text):
                fail(errors, f"Public file {relative(path)} contains {description}.")
        report_public_email_addresses(path, text, errors)


def validate_private_pattern_contract(errors: list[str]) -> None:
    synthetic_email = "privacy-sentinel" + chr(64) + "example.invalid"
    if not EMAIL_ADDRESS_RE.search(synthetic_email):
        fail(errors, "Public-boundary email detection is absent or ineffective.")
    elif EMAIL_ADDRESS_RE.search("ordinary public content"):
        fail(errors, "Public-boundary email detection rejects its negative control.")

    policy_errors: list[str] = []
    report_public_email_addresses(PACKAGE_FILE, synthetic_email, policy_errors)
    if len(policy_errors) != 1 or "unapproved email address" not in policy_errors[0]:
        fail(errors, "Public-boundary email policy does not reject an undeclared address.")

    policy_errors.clear()
    report_public_email_addresses(PACKAGE_ROOT / "README.md", PUBLIC_AUTHOR_EMAIL, policy_errors)
    if len(policy_errors) != 1 or "outside approved author metadata" not in policy_errors[0]:
        fail(errors, "Public-boundary email policy does not constrain the approved address by location.")

    policy_errors.clear()
    report_public_email_addresses(PACKAGE_FILE, PUBLIC_AUTHOR_EMAIL, policy_errors)
    report_public_email_addresses(PLUGIN_FILE, PUBLIC_AUTHOR_EMAIL, policy_errors)
    if policy_errors:
        fail(errors, "Public-boundary email policy rejects approved professional metadata.")


def self_test_private_term_detection() -> int:
    term = "sentinel" + "account"
    errors: list[str] = []
    report_configured_private_terms(
        f"assets/{term.upper()}/neutral.md",
        b"ordinary public content",
        "ordinary public content",
        [term],
        errors,
    )
    if len(errors) != 1 or "path/name" not in errors[0] or "content" in errors[0]:
        print("Private-term path self-test failed.", file=sys.stderr)
        return 1

    errors.clear()
    report_configured_private_terms(
        "assets/neutral.md",
        term.encode("utf-8"),
        term,
        [term],
        errors,
    )
    if len(errors) != 1 or "content" not in errors[0] or "path/name" in errors[0]:
        print("Private-term content self-test failed.", file=sys.stderr)
        return 1

    errors.clear()
    report_configured_private_terms(
        "assets/neutral.md",
        b"ordinary public content",
        "ordinary public content",
        [term],
        errors,
    )
    if errors:
        print("Private-term negative-control self-test failed.", file=sys.stderr)
        return 1

    pattern_errors: list[str] = []
    validate_private_pattern_contract(pattern_errors)
    if pattern_errors:
        print(pattern_errors[0], file=sys.stderr)
        return 1

    print("Private-term and email-address self-test passed.")
    return 0


def parse_openai_interface(errors: list[str]) -> dict[str, str]:
    try:
        lines = OPENAI_FILE.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot read {relative(OPENAI_FILE)}: {exc}")
        return {}

    if any("\t" in line for line in lines):
        fail(errors, "agents/openai.yaml must not contain tab indentation.")
    interface_count = sum(line == "interface:" for line in lines)
    if interface_count != 1:
        fail(errors, "agents/openai.yaml must contain exactly one top-level interface mapping.")

    in_interface = False
    result: dict[str, str] = {}
    for number, line in enumerate(lines, start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line.startswith(" "):
            in_interface = line == "interface:"
            continue
        if not in_interface:
            continue
        match = re.fullmatch(r"  ([a-z][a-z0-9_]*):\s*(.+)", line)
        if not match:
            fail(errors, f"Invalid interface field at agents/openai.yaml:{number}")
            continue
        key, encoded = match.groups()
        if key in result:
            fail(errors, f"Duplicate agents/openai.yaml interface field: {key}")
            continue
        try:
            value = json.loads(encoded)
        except json.JSONDecodeError:
            fail(errors, f"agents/openai.yaml interface strings must be double-quoted at line {number}.")
            continue
        if not isinstance(value, str):
            fail(errors, f"agents/openai.yaml interface field {key} must be a string.")
            continue
        result[key] = value
    return result


def validate_openai_yaml(skill_name: str, errors: list[str]) -> None:
    interface = parse_openai_interface(errors)
    for field in ("display_name", "short_description", "default_prompt"):
        value = interface.get(field)
        if not isinstance(value, str) or not value.strip():
            fail(errors, f"agents/openai.yaml is missing non-empty interface.{field}.")
    short = interface.get("short_description", "")
    if short and not 25 <= len(short) <= 64:
        fail(errors, f"agents/openai.yaml short_description must be 25-64 characters; found {len(short)}.")
    prompt = interface.get("default_prompt", "")
    if skill_name and prompt and f"${skill_name}" not in prompt:
        fail(errors, f"agents/openai.yaml default_prompt must mention ${skill_name}.")


def validate_activation_cases(errors: list[str]) -> None:
    data = load_json(ACTIVATION_FILE, errors)
    if not isinstance(data, list) or not data:
        fail(errors, "evals/activation-cases.json must contain a non-empty array.")
        return

    expected = {"id", "query", "should_trigger", "reason"}
    seen_ids: set[str] = set()
    seen_queries: set[str] = set()
    outcomes: set[bool] = set()
    for index, item in enumerate(data):
        label = f"activation case #{index + 1}"
        if not isinstance(item, dict):
            fail(errors, f"{label} must be an object.")
            continue
        if set(item) != expected:
            missing = sorted(expected - set(item))
            extra = sorted(set(item) - expected)
            fail(errors, f"{label} has wrong fields; missing={missing}, extra={extra}.")
            continue

        case_id = item["id"]
        query = item["query"]
        should_trigger = item["should_trigger"]
        reason = item["reason"]
        if not isinstance(case_id, str) or not ID_RE.fullmatch(case_id):
            fail(errors, f"{label} has an invalid stable id: {case_id!r}")
        elif case_id in seen_ids:
            fail(errors, f"Duplicate activation case id: {case_id}")
        else:
            seen_ids.add(case_id)
        if not isinstance(query, str) or not query.strip():
            fail(errors, f"{label} query must be a non-empty string.")
        else:
            normalized = " ".join(query.split()).casefold()
            if normalized in seen_queries:
                fail(errors, f"Duplicate activation query in {label}.")
            seen_queries.add(normalized)
        if type(should_trigger) is not bool:
            fail(errors, f"{label} should_trigger must be a boolean.")
        else:
            outcomes.add(should_trigger)
        if not isinstance(reason, str) or not reason.strip():
            fail(errors, f"{label} reason must be a non-empty string.")
    if outcomes != {False, True}:
        fail(errors, "Activation cases must include both trigger and non-trigger outcomes.")


def validate_agent_evaluation_cases(errors: list[str]) -> None:
    payload = load_json(AGENT_EVALUATION_FILE, errors)
    if not isinstance(payload, dict) or set(payload) != {"schema_version", "cases"}:
        fail(errors, "evals/agent-evaluation-cases.json must contain exactly schema_version and cases.")
        return
    if payload.get("schema_version") != 1:
        fail(errors, "Agent evaluation cases require schema_version 1.")
    cases = payload.get("cases")
    if not isinstance(cases, list) or not cases:
        fail(errors, "Agent evaluation cases must be a non-empty array.")
        return
    seen: set[str] = set()
    for index, case in enumerate(cases):
        if not isinstance(case, dict) or set(case) != {"id", "scenario", "question"}:
            fail(errors, f"Agent evaluation case {index} must contain exactly id, scenario, and question.")
            continue
        case_id = case.get("id")
        if not isinstance(case_id, str) or not ID_RE.fullmatch(case_id):
            fail(errors, f"Agent evaluation case {index} has an invalid id: {case_id!r}")
        elif case_id in seen:
            fail(errors, f"Duplicate agent evaluation case id: {case_id}")
        else:
            seen.add(case_id)
        for field in ("scenario", "question"):
            if not isinstance(case.get(field), str) or not case[field].strip():
                fail(errors, f"Agent evaluation case {case_id!r} has an empty {field}.")
        if any("expected" in key.casefold() for key in case):
            fail(errors, f"Agent evaluation case {case_id!r} exposes an expected answer.")

    try:
        from agent_evaluation import load_cases

        load_cases()
    except (ImportError, ValueError) as exc:
        fail(errors, f"Agent evaluation contract is inconsistent: {exc}")


def validate_behavior_cases(errors: list[str]) -> None:
    try:
        text = BEHAVIOR_FILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        fail(errors, f"Cannot read evals/behavior-cases.md: {exc}")
        return

    matches = list(BEHAVIOR_HEADING_RE.finditer(text))
    if not matches:
        fail(errors, "evals/behavior-cases.md must contain numbered behavior cases.")
        return

    titles: set[str] = set()
    for index, match in enumerate(matches, start=1):
        number = int(match.group("number"))
        title = match.group("title").strip()
        if number != index:
            fail(
                errors,
                f"Behavior case sequence mismatch: expected {index}, found {number}.",
            )
        normalized_title = " ".join(title.casefold().split())
        if normalized_title in titles:
            fail(errors, f"Duplicate behavior case title: {title}")
        titles.add(normalized_title)

        section_end = matches[index].start() if index < len(matches) else len(text)
        section = text[match.end() : section_end]
        if "**Must pass:**" not in section:
            fail(errors, f"Behavior case {number} is missing **Must pass:**")
        if "**Must not:**" not in section:
            fail(errors, f"Behavior case {number} is missing **Must not:**")
        if "**Prompt:**" not in section and "**Fixture:**" not in section:
            fail(errors, f"Behavior case {number} needs a prompt or fixture.")


def validate_trace_schema(errors: list[str]) -> None:
    schema = load_json(TRACE_SCHEMA_FILE, errors)
    if not isinstance(schema, dict):
        return
    try:
        event_properties = schema["$defs"]["event"]["properties"]
        event_types = event_properties["type"]["enum"]
        event_statuses = event_properties["status"]["enum"]
        requirement_properties = schema["properties"]["requirements"]["properties"]
    except (KeyError, TypeError):
        fail(errors, "evals/trace.schema.json is missing the event type/status contract.")
        return
    if not isinstance(requirement_properties, dict):
        fail(errors, "Trace schema requirement properties must be an object.")
        return
    for field in {
        "identified_activity",
        "observable_equivalence",
        "asynchronous_delivery",
        "effect_scope",
        "correction_recovery",
        "decision_alignment",
        "scenario_coverage",
        "epistemic_reconciliation",
        "canonical_reconciliation",
        "capability_routing",
    }:
        definition = requirement_properties.get(field)
        if not isinstance(definition, dict) or definition.get("type") != "boolean":
            fail(errors, f"Trace schema must expose requirements.{field} as boolean.")
    required_types = {
        "skill-activation",
        "skill-load",
        "capability-route",
        "activity-transition",
        "durable-gate-trigger",
        "reference-load",
        "material-investigation",
        "decision-alignment",
        "scenario-coverage",
        "readiness",
        "readiness-invalidation",
        "recovery",
        "implementation-mutation-attempt",
        "implementation-mutation",
        "verification",
        "regression-protection",
        "final-audit",
        "report",
    }
    usable_event_types = (
        {item for item in event_types if isinstance(item, str)}
        if isinstance(event_types, list)
        else set()
    )
    if not isinstance(event_types, list) or len(usable_event_types) != len(event_types):
        fail(errors, "Trace schema event types must be unique strings.")
    if not required_types.issubset(usable_event_types):
        missing = sorted(required_types - usable_event_types)
        fail(errors, f"Trace schema is missing required event types: {missing}")
    usable_event_statuses = (
        {item for item in event_statuses if isinstance(item, str)}
        if isinstance(event_statuses, list)
        else set()
    )
    if not isinstance(event_statuses, list) or len(usable_event_statuses) != len(event_statuses):
        fail(errors, "Trace schema event statuses must be unique strings.")
    if not {"denied", "applied", "invalidated"}.issubset(usable_event_statuses):
        fail(errors, "Trace schema is missing required mutation or invalidation statuses.")


def validate_all_json(payload: set[Path], errors: list[str]) -> None:
    for path in sorted(item for item in payload if item.suffix.lower() == ".json"):
        if path in {PACKAGE_FILE, ACTIVATION_FILE}:
            continue
        load_json(path, errors)


def validate_context_store_runtime(errors: list[str]) -> None:
    try:
        source = CONTEXT_STORE_RUNTIME.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=relative(CONTEXT_STORE_RUNTIME))
    except FileNotFoundError:
        fail(errors, f"Missing context-store runtime: {relative(CONTEXT_STORE_RUNTIME)}")
        return
    except (OSError, UnicodeError, SyntaxError) as exc:
        fail(errors, f"Invalid context-store runtime {relative(CONTEXT_STORE_RUNTIME)}: {exc}")
        return

    subcommands: list[str] = []
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
    forbidden_open_flags = {"O_WRONLY", "O_RDWR", "O_CREAT", "O_TRUNC", "O_APPEND"}
    write_surface: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id in forbidden_open_flags:
            write_surface.add(node.id)
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Name) and node.func.id == "open":
            write_surface.add("builtin open")
        if not isinstance(node.func, ast.Attribute):
            continue
        if (
            isinstance(node.func.value, ast.Name)
            and node.func.value.id == "os"
            and node.func.attr in forbidden_os_calls
        ):
            write_surface.add(f"os.{node.func.attr}")
        if node.func.attr in forbidden_path_calls:
            write_surface.add(f".{node.func.attr}")
        if node.func.attr != "add_parser" or not node.args:
            continue
        name = node.args[0]
        if not isinstance(name, ast.Constant) or not isinstance(name.value, str):
            fail(errors, "Context-store subcommand names must be literal strings.")
            continue
        subcommands.append(name.value)

    expected = ["inspect", "plan"]
    if sorted(subcommands) != expected:
        fail(
            errors,
            "Context-store runtime must expose exactly inspect and plan; "
            f"found: {', '.join(sorted(subcommands)) or '(none)'}."
        )
    if write_surface:
        fail(
            errors,
            "Context-store runtime must remain free of filesystem write primitives; found: "
            f"{', '.join(sorted(write_surface))}."
        )


def validate_repository_metadata(payload: set[Path], errors: list[str]) -> None:
    for current, directories, filenames in os.walk(PACKAGE_ROOT, followlinks=False):
        directories[:] = [
            name for name in directories if name not in IGNORED_TREE_NAMES and name not in CACHE_DIR_NAMES
        ]
        current_path = Path(current)
        for name in [*directories, *filenames]:
            path = current_path / name
            if name in OS_METADATA_NAMES or name.startswith("._") or "__MACOSX" in path.parts:
                fail(errors, f"Operating-system metadata must not be distributed: {relative(path)}")

    for path in payload:
        package_parts = path.relative_to(PACKAGE_ROOT).parts
        if any(part in CACHE_DIR_NAMES for part in package_parts):
            fail(errors, f"Cache content must not be distributed: {relative(path)}")
        if any(part in IGNORED_TREE_NAMES for part in package_parts):
            fail(errors, f"Ignored repository or dependency content must not be declared: {relative(path)}")
        if path.name in SENSITIVE_FILE_NAMES:
            fail(errors, f"Sensitive configuration filename must not be distributed: {relative(path)}")


def validate_release_readiness(manifest: dict[str, object], warnings: list[str]) -> None:
    license_files = [path for path in PACKAGE_ROOT.glob("[Ll][Ii][Cc][Ee][Nn][Ss][Ee]*") if path.is_file()]
    license_value = manifest.get("license")
    if not isinstance(license_value, str) or not license_value.strip() or not license_files:
        warn(warnings, "No complete license declaration is present; choose package.json license metadata and a license file before public release.")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    manifest = validate_manifest(load_json(PACKAGE_FILE, errors), errors)
    frontmatter = validate_frontmatter(manifest, errors) if SKILL_FILE.exists() else {}
    if not SKILL_FILE.exists():
        fail(errors, f"Missing required skill entry point: {relative(SKILL_FILE)}")

    payload = collect_payload(manifest, errors)
    repository_public_files = collect_repository_public_files()
    validate_plugin_manifest(manifest, frontmatter, errors)
    validate_host_hooks(errors)
    validate_repository_marketplace(manifest, errors)
    validate_publish_workflow(errors)
    validate_payload_types_and_symlinks(payload, errors)
    validate_repository_metadata(payload, errors)
    validate_links(payload, errors)
    validate_reference_routing(payload, errors)
    validate_private_pattern_contract(errors)
    validate_public_boundary(payload, errors)
    validate_public_boundary(repository_public_files, errors)
    validate_documentation_and_repository_contract(payload, errors)
    validate_openai_yaml(frontmatter.get("name", ""), errors)
    validate_activation_cases(errors)
    validate_agent_evaluation_cases(errors)
    validate_behavior_cases(errors)
    validate_trace_schema(errors)
    validate_all_json(payload, errors)
    validate_context_store_runtime(errors)
    validate_release_readiness(manifest, warnings)

    if errors:
        print("Validation failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print("Validation passed")
    print(f"- package: {manifest.get('name')}@{manifest.get('version')}")
    print(f"- plugin manifest: {relative(PLUGIN_FILE)}")
    print(f"- repository marketplace: {relative(MARKETPLACE_FILE)}")
    print(f"- declared payload files: {len(payload)}")
    print(f"- SKILL.md lines: {len(SKILL_FILE.read_text(encoding='utf-8').splitlines())}")
    print(f"- description characters: {len(frontmatter.get('description', ''))}")
    print(f"- references: {len(list((SKILL_ROOT / 'references').glob('*.md')))}")
    print(f"- example assets: {len(list((SKILL_ROOT / 'assets').glob('*.md')))}")
    agent_cases = load_json(AGENT_EVALUATION_FILE, [])
    print(f"- blind agent cases: {len(agent_cases.get('cases', [])) if isinstance(agent_cases, dict) else 0}")
    print(f"- behavior cases: {len(list(BEHAVIOR_HEADING_RE.finditer(BEHAVIOR_FILE.read_text(encoding='utf-8'))))}")
    if warnings:
        print("Release warnings:")
        for item in warnings:
            print(f"- {item}")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test-private-terms"]:
        raise SystemExit(self_test_private_term_detection())
    if sys.argv[1:]:
        print("Usage: validate_skill.py [--self-test-private-terms]", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main())
