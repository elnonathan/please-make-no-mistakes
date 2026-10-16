// Claude's additive hook discovery, modelled over the packed artifact.
//
// Claude Code merges a manifest `hooks` value with the conventional `hooks/hooks.json` instead of
// replacing it, so a plugin root that carries both files registers both. The other validators in
// this repository inspect each hook tree on its own and never ask what a host would register after
// the merge, which is the question this file exists to ask.
//
// This models the documented rule. It does not run Claude, so it proves what the contract requires
// and not what a live client does. That boundary is deliberate and is restated in the assertions.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_MANIFEST = path.join(".claude-plugin", "plugin.json");
const DEFAULT_HOOKS = path.join("hooks", "hooks.json");

// Claude Code's complete hook event list, from the official hooks reference.
const CLAUDE_EVENTS = new Set([
  "SessionStart", "Setup", "UserPromptSubmit", "UserPromptExpansion", "PreToolUse", "PermissionRequest",
  "PermissionDenied", "PostToolUse", "PostToolUseFailure", "PostToolBatch", "Notification", "MessageDisplay",
  "SubagentStart", "SubagentStop", "TaskCreated", "TaskCompleted", "Stop", "StopFailure", "TeammateIdle",
  "InstructionsLoaded", "ConfigChange", "CwdChanged", "DirectoryAdded", "FileChanged", "WorktreeCreate",
  "WorktreeRemove", "PreCompact", "PostCompact", "PreModelSwitch", "PostModelSwitch", "Elicitation",
  "ElicitationResult",
]);

// The three path variables Claude defines for a plugin component.
const CLAUDE_VARIABLES = new Set(["CLAUDE_PLUGIN_ROOT", "CLAUDE_PLUGIN_DATA", "CLAUDE_PROJECT_DIR"]);

function packArtifact() {
  const where = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-discovery-"));
  const printed = execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["pack", "--silent", "--pack-destination", where, "--cache", path.join(where, "npm-cache")],
    {cwd: ROOT, encoding: "utf8"},
  );
  const tarball = printed.trim().split(/\r?\n/).filter(Boolean).pop();
  execFileSync("tar", ["-xzf", path.join(where, tarball), "-C", where]);
  return {where, root: path.join(where, "package")};
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Every hooks source a Claude plugin root contributes, in the order Claude loads them. */
function discoveredSources(root) {
  const sources = [];
  const fallback = path.join(root, DEFAULT_HOOKS);
  // "The default file loads first, and what the manifest declares merges into it."
  if (fs.existsSync(fallback)) sources.push({origin: DEFAULT_HOOKS, config: readJson(fallback)});
  const manifestFile = path.join(root, CLAUDE_MANIFEST);
  if (!fs.existsSync(manifestFile)) return sources;
  const declared = readJson(manifestFile).hooks;
  for (const entry of Array.isArray(declared) ? declared : declared === undefined ? [] : [declared]) {
    if (typeof entry === "string") {
      const file = path.join(root, entry.replace(/^\.\//, ""));
      if (fs.existsSync(file)) sources.push({origin: entry, config: readJson(file)});
    } else if (entry && typeof entry === "object") {
      sources.push({origin: "inline", config: {hooks: entry}});
    }
  }
  return sources;
}

/** One row per command a host would register, carrying where it came from. */
function registration(sources) {
  const rows = [];
  for (const {origin, config} of sources) {
    for (const [event, matchers] of Object.entries(config.hooks || {})) {
      for (const matcher of matchers || []) {
        for (const handler of matcher.hooks || []) {
          rows.push({origin, event, command: handler.command ?? JSON.stringify(handler.args ?? "")});
        }
      }
    }
  }
  return rows;
}

function describe(rows) {
  return rows.map((row) => `${row.origin} → ${row.event}: ${String(row.command).slice(0, 70)}`).join("\n  ");
}

test("the packed plugin root carries no conventional hooks/hooks.json", (t) => {
  const {where, root} = packArtifact();
  t.after(() => fs.rmSync(where, {recursive: true, force: true}));
  assert.equal(
    fs.existsSync(path.join(root, DEFAULT_HOOKS)),
    false,
    "Claude would merge a conventional hooks/hooks.json into the Claude plugin",
  );
});

test("a Claude plugin root registers only the Claude adapter", (t) => {
  const {where, root} = packArtifact();
  t.after(() => fs.rmSync(where, {recursive: true, force: true}));

  const rows = registration(discoveredSources(root));
  assert.ok(rows.length > 0, "the packed artifact registered no hook at all");

  const foreign = rows.filter((row) => !String(row.command).includes("pmnm-claude.mjs"));
  assert.deepEqual(
    foreign,
    [],
    "a Claude installation would also register commands that are not the Claude adapter:\n  " + describe(foreign),
  );
});

test("every event a Claude plugin root registers is one Claude defines", (t) => {
  const {where, root} = packArtifact();
  t.after(() => fs.rmSync(where, {recursive: true, force: true}));

  const unknown = registration(discoveredSources(root)).filter((row) => !CLAUDE_EVENTS.has(row.event));
  assert.deepEqual(
    unknown,
    [],
    "the merged registration names events Claude does not define:\n  " + describe(unknown),
  );
});

test("every registered command resolves a variable Claude defines", (t) => {
  const {where, root} = packArtifact();
  t.after(() => fs.rmSync(where, {recursive: true, force: true}));

  // A command that interpolates an undefined variable resolves a broken path. Claude documents a
  // failing or timed-out PreToolUse command hook as fail-open, so the failure would be silent.
  const unresolved = [];
  for (const row of registration(discoveredSources(root))) {
    for (const [, name] of String(row.command).matchAll(/\$\{([A-Z_]+)\}/g)) {
      if (!CLAUDE_VARIABLES.has(name)) unresolved.push({...row, command: `${name} is undefined in ${row.command}`});
    }
  }
  assert.deepEqual(
    unresolved,
    [],
    "the merged registration interpolates variables Claude does not define:\n  " + describe(unresolved),
  );
});
