#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";

import {
  classifyShell,
  parseControlCommand,
  processEvent as guardProcessEvent,
  processPersistedEvent,
  testing,
} from "../hooks/pmnm-guard.mjs";
import {declarationSensitiveEffect, toolResult} from "../hooks/pmnm-shell.mjs";

const IMPLEMENTATION_PATCH =
  "*** Begin Patch\n*** Update File: example.txt\n@@\n-old\n+new\n*** End Patch";
const ACTION_ORACLE = JSON.parse(
  fs.readFileSync(new URL("../evals/host-guard-action-oracle.json", import.meta.url), "utf8"),
);

function encodePathField(value) {
  return Array.from(value)
    .map((character) =>
      /^[A-Za-z0-9._~/-]$/.test(character)
        ? character
        : Array.from(Buffer.from(character, "utf8"))
            .map((byte) => "%" + byte.toString(16).toUpperCase().padStart(2, "0"))
            .join(""),
    )
    .join("");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDenied(result) {
  return (
    result.output?.hookSpecificOutput?.hookEventName === "PreToolUse" &&
    result.output.hookSpecificOutput.permissionDecision === "deny"
  );
}

function isControlRecorded(result) {
  return (
    result.output?.hookSpecificOutput?.permissionDecision === "allow" &&
    result.output.hookSpecificOutput.updatedInput?.command === testing.NO_OP_COMMAND
  );
}

function visibleText(result) {
  const output = result.output;
  if (!output) return "";
  const specific = output.hookSpecificOutput || {};
  return [
    specific.permissionDecisionReason,
    specific.additionalContext,
    output.reason,
    output.systemMessage,
  ]
    .filter((value) => typeof value === "string")
    .join("\n");
}

// ---------------------------------------------------------------------------
// PMNM 0.1.0 release contract. These cases intentionally describe the
// replacement runtime rather than preserving the pre-release ceremony.
// ---------------------------------------------------------------------------

function v2Temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-release-v2-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const cwd = path.join(root, "repository");
  const dataRoot = path.join(root, "plugin-data");
  const codexHome = path.join(root, ".codex");
  fs.mkdirSync(cwd, {recursive: true});
  fs.mkdirSync(codexHome, {recursive: true});
  return {root, cwd, dataRoot, codexHome, notes: path.join(root, "PMNM")};
}

function v2Event(where, name, turn, extra = {}) {
  return {
    session_id: "release-session",
    cwd: where.cwd,
    hook_event_name: name,
    turn_id: turn,
    permission_mode: "default",
    ...extra,
  };
}

function v2Process(state, where, name, turn, extra = {}, options = {}) {
  return guardProcessEvent(state, v2Event(where, name, turn, extra), {
    now: options.now ?? 10,
    environment: {CODEX_HOME: where.codexHome, PLUGIN_DATA: where.dataRoot},
    verifyPaths: true,
    ...(where.guardOptions || {}),
    ...options,
  });
}

function v2Prompt(state, where, turn, text) {
  return v2Process(state, where, "UserPromptSubmit", turn, {prompt: text});
}

function v2RawPre(state, where, turn, command, id = "tool", name = "Bash", input = null, options = {}) {
  return v2Process(state, where, "PreToolUse", turn, {
    tool_name: name,
    tool_use_id: id,
    tool_input: input || {command},
  }, options);
}

function v2Pre(state, where, turn, command, id = "tool", name = "Bash", input = null, options = {}) {
  let result = v2RawPre(state, where, turn, command, id, name, input, options);
  const fixtureCheck = /^(?:npm\s+test|node\s+--check|cargo\s+test|go\s+test|pytest\b|dotnet\s+test|mvn\s+test|gradle\s+test)/.test(command);
  if (name === "Bash" && fixtureCheck && isDenied(result) && /pmnm-guard declare/.test(visibleText(result))) {
    const declaration = v2RawPre(
      result.state,
      where,
      turn,
      "pmnm-guard declare effect=verification boundary=project persistence=none certainty=certain capability=none",
      id + "-declare",
      "Bash",
      null,
      options,
    );
    if (isControlRecorded(declaration)) result = v2RawPre(declaration.state, where, turn, command, id, name, input, options);
  }
  return result;
}

function v2Post(state, where, turn, command, id = "tool", name = "Bash", response = "ok", input = null, options = {}) {
  if (name === "apply_patch" && response === "ok") {
    for (const match of String(command).matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm)) {
      const target = path.resolve(where.cwd, match[1]);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, "applied:" + id + "\n");
    }
    for (const match of String(command).matchAll(/^\*\*\* Delete File: (.+)$/gm)) {
      fs.rmSync(path.resolve(where.cwd, match[1]), {force: true});
    }
  }
  return v2Process(state, where, "PostToolUse", turn, {
    tool_name: name,
    tool_use_id: id,
    tool_input: input || {command},
    tool_response: response,
  }, options);
}

function v2Receipt(state, where, turn, command, id = "receipt", options = {}) {
  if (/^pmnm-guard done\b/.test(command) && state.impact_plan_hash && state.last_verification?.fingerprint?.hash) {
    const target = path.join(state.task_path, "impact.md");
    if (fs.existsSync(target)) {
      const current = fs.readFileSync(target, "utf8");
      fs.writeFileSync(
        target,
        current
          .replace(/^- final-fingerprint:.*$/m, "- final-fingerprint: " + state.last_verification.fingerprint.hash)
          .replace(/^- final:.*$/m, "- final: re-derived independently from the final changed surface"),
      );
    }
  }
  return v2Pre(state, where, turn, command, id, "Bash", null, options);
}

function v2DeclaredPre(
  state,
  where,
  turn,
  command,
  id,
  {effect = "investigation", boundary = "project", persistence = "none", certainty = "certain", capability = "none"} = {},
) {
  let result = v2RawPre(state, where, turn, command, id);
  assert.equal(isDenied(result), true, "fixture expected a declaration request: " + visibleText(result));
  result = v2RawPre(
    result.state,
    where,
    turn,
    `pmnm-guard declare effect=${effect} boundary=${boundary} persistence=${persistence} certainty=${certainty} capability=${capability}`,
    id + "-declare",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  return v2RawPre(result.state, where, turn, command, id);
}

function v2Configured(t, language = "en") {
  const where = v2Temp(t);
  let state = testing.baseState();
  state = v2Prompt(state, where, "turn-1", language === "es" ? "Investiga esta tarea" : "Investigate this task").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", language === "es" ? "Guárdalo aquí" : "Keep it here").state;
  state = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder").state;
  state = v2Prompt(state, where, "turn-3", language === "es" ? "Llámalo ejemplo" : "Call it example").state;
  const project = v2Receipt(state, where, "turn-3", "pmnm-guard project name=example", "project");
  state = project.state;
  return {where, state, projectOutput: visibleText(project)};
}

function twoLines(text) {
  return text.trim().split("\n").filter(Boolean);
}

function v2TaskDirectory(where, task = "TASK-101") {
  return path.join(where.notes, "projects", "example", "tasks", task);
}

function v2Agreed(t) {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] example.txt — exercise the contract under test\n",
  ).state;
  state = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest").state;
  state = v2Prompt(state, where, "turn-4", "Yes, proceed exactly as shown").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard agreed", "agreed").state;
  return {where, state};
}

function v3WorkspaceSnapshot(cwd) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (entry.name === ".git") continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) entries.push({path: target, signature: fs.readFileSync(target)});
    }
  };
  visit(cwd);
  return entries;
}

function v3Write(state, where, turn, target, content, id) {
  const input = {file_path: target, content};
  let result = v2Pre(state, where, turn, "", id, "Write", input);
  if (isDenied(result)) return result;
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, content);
  return v2Post(result.state, where, turn, "", id, "Write", "ok", input);
}

function v3CreateTask(state, where, turn = "turn-3") {
  const task = v2TaskDirectory(where);
  const command = "mkdir -p " + JSON.stringify(task);
  let result = v2Pre(state, where, turn, command, "mkdir-task");
  assert.equal(isDenied(result), false, visibleText(result));
  fs.mkdirSync(task, {recursive: true});
  result = v2Post(result.state, where, turn, command, "mkdir-task");
  return {task, state: result.state};
}

function v3Setup(t, {workspace = false} = {}) {
  const {where, state: configured} = v2Configured(t);
  fs.mkdirSync(path.join(where.cwd, "src"), {recursive: true});
  fs.writeFileSync(path.join(where.cwd, "src", "a.js"), "a=1\n");
  fs.writeFileSync(path.join(where.cwd, "src", "b.js"), "b=1\n");
  if (workspace) where.guardOptions = {workspaceSnapshotProvider: v3WorkspaceSnapshot};
  return {where, ...v3CreateTask(configured, where)};
}

function v3WritePlan(state, where, task, turn, content) {
  let result = v3Write(state, where, turn, path.join(task, "plan.md"), content, "plan-" + turn + "-" + content.length);
  const verificationPlan = [
    "# Verification", "", "## Plan",
    "- contract: requested behavior changes while preserved behavior remains",
    "- request-case: exercise the request's own case",
    "- preserved-case: exercise the behavior that must not change",
    "- entry: repository-declared executable surface",
    "- environment: isolated test environment",
    "- actor: bounded test actor",
    "- data: deterministic safe fixture",
    "- steps: 1. arrange 2. act 3. observe",
    "- expect: requested and preserved cases remain distinct",
    "- capability: focused executable check inspected in the fixture",
    "- evidence: retain literal check output",
    "- cleanup: temporary fixture removed by the test harness", "",
  ].join("\n");
  result = v3Write(
    result.state,
    where,
    turn,
    path.join(task, "verification.md"),
    verificationPlan,
    "verification-plan-" + turn + "-" + content.length,
  );
  result = v3Write(
    result.state,
    where,
    turn,
    path.join(task, "impact.md"),
    v3Impact(),
    "impact-plan-" + turn + "-" + content.length,
  );
  return result;
}

function v3Impact({mode = "local", reason = "The bounded fixture changes one directly inspected surface.", dimensions = {}, final = false} = {}) {
  const values = {
    security: "unchanged; no authority boundary changes",
    privacy: "unchanged; synthetic fixture only",
    performance: "unchanged; no runtime path changes",
    compatibility: "preserved by the unchanged case",
    maintainability: "one bounded implementation path",
    observability: "focused check retains its literal result",
    ...dimensions,
  };
  const transitive = mode === "transitive"
    ? [
        "## Roots", "", "- root: request-value — user-visible contract", "",
        "## Ledger", "", "| Node | Relationship | Evidence | Disposition | Follow-up |", "|---|---|---|---|---|",
        "| request-value | root | direct source inspection | changed-and-covered | focused check |", "",
        "## Dynamic boundaries", "", "- none: no dynamic boundary participates in this fixture", "",
      ]
    : [];
  return [
    "# Impact", "", "Mode: " + mode, "Reason: " + reason, "", ...transitive,
    "## Non-functional dispositions", "",
    ...Object.entries(values).map(([name, value]) => "- " + name + ": " + value),
    "", "## Omission audit", "", "- before-plan: derived independently from the request and inspected fixture",
    "- final-fingerprint: " + (final ? "FINGERPRINT" : "pending"),
    "- final: " + (final ? "re-derived from the final changed surface" : "pending"), "",
  ].join("\n");
}

function v3WritePermissions(state, where, task, turn, manifest) {
  let result = v3Write(
    state,
    where,
    turn,
    path.join(task, "permissions.json"),
    JSON.stringify({schema: "pmnm.permissions/v1", task: [], ...manifest}, null, 2) + "\n",
    "permission-forecast-" + turn,
  );
  const entries = [...(manifest.task || []), ...(manifest.project || [])];
  if (entries.some((entry) => entry?.effect === "environment" || (entry?.boundary === "local-environment" && entry?.persistence === "persistent"))) {
    result = v3Write(
      result.state,
      where,
      turn,
      path.join(task, "environment.md"),
      [
        "# Operational environment preflight",
        "- configuration: fixture configuration inspected",
        "- indirection: fixture command resolves directly with no hidden alias",
        "- resources: bounded fixture resource inspected",
        "- ownership: test harness owns the fixture resource",
        "- health: current fixture state observed before action",
        "- decision: reuse healthy resources and start only what is absent",
        "- conflict: no control-plane or process-state disagreement observed",
        "- cleanup: test harness removes the fixture",
        "",
      ].join("\n"),
      "environment-plan-" + turn,
    );
  }
  return result;
}

function v3Agree(state, where, digestTurn = "turn-3", answerTurn = "turn-4") {
  let result = v2Receipt(state, where, digestTurn, "pmnm-guard digest", "digest-" + digestTurn);
  assert.equal(isControlRecorded(result), true, visibleText(result));
  state = v2Prompt(result.state, where, answerTurn, "Agreed exactly as shown").state;
  result = v2Receipt(state, where, answerTurn, "pmnm-guard agreed", "agreed-" + answerTurn);
  assert.equal(isControlRecorded(result), true, visibleText(result));
  return result.state;
}

function v3ReloadRuleBasis(state, where, turn = "turn-4", id = "reload-rule-basis") {
  const command = "opaque-reader " + state.rule_basis_paths.map((target) => JSON.stringify(target)).join(" ");
  let result = v2RawPre(state, where, turn, command, id);
  assert.equal(isDenied(result), true, visibleText(result));
  result = v2Receipt(
    result.state,
    where,
    turn,
    "pmnm-guard declare effect=investigation boundary=pmnm persistence=none certainty=certain capability=none",
    id + "-declare",
  );
  result = v2RawPre(result.state, where, turn, command, id);
  assert.equal(isDenied(result), false, visibleText(result));
  return v2Post(
    result.state,
    where,
    turn,
    command,
    id,
    "Bash",
    result.state.rule_basis_paths.map((target) => fs.readFileSync(target, "utf8")).join("\n"),
  ).state;
}

function v3AgreedFor(t, plan) {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(created.state, where, created.task, "turn-3", plan).state;
  state = v3Agree(state, where);
  return {where, task: created.task, state};
}

function v3WriteClaims(state, where, task = v2TaskDirectory(where), turn = "turn-4") {
  const target = path.join(task, "verification.md");
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "# Verification\n";
  const retained = current
    .split(/\r?\n/)
    .filter((line) => !/^-\s*(?:example|unchanged):/i.test(line.trim()))
    .join("\n")
    .trimEnd();
  return v3Write(
    state,
    where,
    turn,
    target,
    retained + "\n\n- example: requested case → observed at " + turn + "\n- unchanged: preserved case → observed at " + turn + "\n",
    "verification-claims-" + turn,
  );
}

function v3WriteStateClaims(state, where, task, turn, stateLines) {
  const target = path.join(task, "verification.md");
  const current = fs.readFileSync(target, "utf8");
  const retained = current
    .split(/\r?\n/)
    .filter((line) => !/^-\s*(?:example|unchanged|state|unchanged-state):/i.test(line.trim()))
    .join("\n")
    .trimEnd();
  const claims = [
    "- example: requested state case → observed at " + turn,
    "- unchanged: preserved behavior → observed at " + turn,
    ...stateLines,
  ];
  return v3Write(state, where, turn, target, retained + "\n\n" + claims.join("\n") + "\n", "state-claims-" + turn);
}

function v3StatePermission(objective, input, extra = {}) {
  return {
    task: [{
      effect: "state-change",
      tool: "StateTool",
      input,
      objective,
      reason: "apply the planned synthetic state transition",
      ...extra,
    }],
  };
}

function v3RunStateTool(state, where, turn, input, id = "state-operation") {
  let result = v2Pre(state, where, turn, "", id, "StateTool", input);
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, turn, "", id, "StateTool", "ok", input);
  return result.state;
}

function v3TestDigestMessage(task = "TASK-101") {
  return [
    "Test — " + task,
    "Where: local interface at the repository-declared route",
    "Environment: isolated test environment",
    "As: bounded test actor",
    "Data: deterministic safe fixture",
    "Steps: 1. arrange 2. act 3. observe",
    "Expect: the requested case changes and preserved behavior remains",
    "Evidence: retain the literal observed result",
    "Cleanup: temporary fixture removed by the test harness",
    "Can run: yes, with the fixture's executable check",
  ].join("\n");
}

function v3WriteTranscript(where, name, assistantMessages) {
  const target = path.join(where.root, name + ".jsonl");
  const records = [
    {type: "session_meta", payload: {id: "synthetic-session"}},
    ...assistantMessages.map((text) => ({
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{type: "output_text", text}],
      },
    })),
  ];
  fs.writeFileSync(target, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
  return target;
}

function v3ArmedTestDigest(t) {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "transcript-change").state;
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "transcript-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "transcript-check", "Bash", {exit_code: 0, output: "passed"});
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "transcript-verified");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "transcript-audit");
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /Test Digest/);
  return {where, task, state: result.state};
}

function v3AcknowledgeTestDigest(state, where, shownTurn = "turn-4", answerTurn = "turn-5", audit = "passed") {
  let result = v2Receipt(state, where, shownTurn, "pmnm-guard done audit=" + audit, "request-test-digest-" + shownTurn);
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /Test Digest/);
  result = v2Process(result.state, where, "Stop", shownTurn, {last_assistant_message: v3TestDigestMessage(state.task_id)});
  assert.equal(result.output, null, visibleText(result));
  result = v2Prompt(result.state, where, answerTurn, "The Test Digest is clear; continue to the final audit");
  return result.state;
}

function v3Verify(state, where, task, {writeClaims = true, handoff = true} = {}) {
  if (writeClaims) {
    state = v3WriteClaims(state, where, task, "turn-4").state;
  }
  const command = "npm test";
  let result = v2Pre(state, where, "turn-4", command, "focused-check");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-4", command, "focused-check", "Bash", "passed");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "verified");
  if (!isDenied(result) && handoff) result.state = v3AcknowledgeTestDigest(result.state, where);
  return result;
}

function oracleDecision(result) {
  if (!result?.output) return "silent";
  if (isDenied(result)) return "deny";
  if (isControlRecorded(result)) return "control";
  if (result.output.decision === "block") return "block";
  return "context";
}

function oracleCommand(value, where) {
  return String(value || "")
    .replaceAll("$FOLDER", encodePathField(where.notes))
    .replaceAll("$EXTERNAL", JSON.stringify(path.join(where.root, "external.txt")))
    .replaceAll("$PATCH", IMPLEMENTATION_PATCH);
}

function runOracleSequence(t, sequence) {
  let setup;
  if (sequence.setup === "configured") setup = v2Configured(t);
  else if (sequence.setup === "agreed") setup = v2Agreed(t);
  else if (sequence.setup === "armed-test-digest") setup = v3ArmedTestDigest(t);
  else setup = {where: v2Temp(t), state: testing.baseState()};
  const {where} = setup;
  let state = setup.state;
  let result = {state, output: null};
  for (const [index, event] of sequence.events.entries()) {
    const turn = event.turn || "oracle-turn";
    const id = event.id || "oracle-" + index;
    const command = oracleCommand(event.command, where);
    if (event.event === "prompt") result = v2Prompt(state, where, turn, event.text || "Continue");
    else if (event.event === "prompt-transcript") {
      const transcript = v3WriteTranscript(where, "oracle-transcript-" + index, [v3TestDigestMessage(state.task_id)]);
      result = v2Process(state, where, "UserPromptSubmit", turn, {prompt: event.text || "Continue", transcript_path: transcript});
    }
    else if (event.event === "receipt") result = v2Receipt(state, where, turn, command, id);
    else if (event.event === "raw-receipt") result = v2RawPre(state, where, turn, command, id);
    else if (event.event === "pre") result = v2Pre(state, where, turn, command, id, event.tool || "Bash");
    else if (event.event === "post") result = v2Post(state, where, turn, command, id, event.tool || "Bash");
    else if (event.event === "stop") result = v2Process(state, where, "Stop", turn, {last_assistant_message: event.text || null});
    else if (event.event === "interrupt") result = v2Process(state, where, "Interrupt", turn);
    else if (event.event === "mkdir-task") {
      fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
      result = {state, output: null};
    } else if (event.event === "write-plan") {
      result = v3WritePlan(state, where, v2TaskDirectory(where), turn, event.text);
    } else if (event.event === "write-verification") {
      result = event.text
        ? v3Write(state, where, turn, path.join(v2TaskDirectory(where), "verification.md"), event.text, id)
        : v3WriteClaims(state, where, v2TaskDirectory(where), turn);
    } else if (event.event === "write-permissions") {
      result = v3WritePermissions(state, where, v2TaskDirectory(where), turn, event.value || {});
    } else if (event.event === "write-impact") {
      const content = event.mode === "transitive-unresolved"
        ? v3Impact({mode: "transitive"}).replace("changed-and-covered", "unresolved-blocking")
        : v3Impact({reason: event.reason || "The bounded fixture changes one directly inspected surface."});
      result = v3Write(state, where, turn, path.join(v2TaskDirectory(where), "impact.md"), content, id);
    } else if (event.event === "remove-impact") {
      fs.rmSync(path.join(v2TaskDirectory(where), "impact.md"), {force: true});
      result = {state, output: null};
    } else throw new Error("unknown oracle event " + event.event);
    state = result.state;
  }
  return result;
}

test("HG-109 exposes only the twelve release receipts and rejects retired controls", () => {
  const actions = ["folder", "project", "start", "digest", "agreed", "redo", "allow", "classify", "result", "verified", "done", "status"];
  for (const action of actions) {
    assert.equal(parseControlCommand("pmnm-guard " + action)?.action, action);
  }
  for (const retired of ["ready", "exempt", "capture", "created", "loaded"]) {
    const parsed = parseControlCommand("pmnm-guard " + retired);
    assert.equal(parsed?.action, retired);
  }
  assert.equal(testing.SCHEMA_VERSION, 2);
});

test("HG-110 start opens the task and asks once for the host PMNM folder", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Please investigate TASK-101").state;
  const started = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start");
  assert.equal(isControlRecorded(started), true);
  assert.equal(started.state.task_id, "TASK-101");
  assert.equal(started.state.phase, "INVESTIGATE");
  assert.match(visibleText(started), /^Ask: PMNM needs one folder/m);
  assert.match(
    visibleText(started),
    /NEXT: ask the human where to create the PMNM folder, suggest ~\/PMNM; stop until they answer/,
  );
  const status = v2Receipt(started.state, where, "turn-1", "pmnm-guard status", "status");
  assert.doesNotMatch(visibleText(status), /^Ask: PMNM needs one folder/m);
});

test("HG-111 folder creates the root and pointer atomically and preserves an existing root", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use the suggested folder").state;
  const configured = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder");
  assert.equal(isControlRecorded(configured), true);
  assert.equal(fs.lstatSync(where.notes).isDirectory(), true);
  assert.equal(fs.lstatSync(path.join(where.codexHome, "pmnm.path")).isFile(), true);
  assert.equal(fs.readFileSync(path.join(where.codexHome, "pmnm.path"), "utf8").trim(), fs.realpathSync(where.notes));
  assert.equal(JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8")).schema, "pmnm.projects/v1");
  assert.equal(fs.lstatSync(path.join(where.notes, "general-rules.md")).isFile(), true);
  fs.writeFileSync(path.join(where.notes, "general-rules.md"), "keep-me\n");
  const repeated = v2Receipt(configured.state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder-again");
  assert.equal(isControlRecorded(repeated), true);
  assert.equal(fs.readFileSync(path.join(where.notes, "general-rules.md"), "utf8"), "keep-me\n");
});

test("HG-112 project owns index.json and creates the stable project skeleton", (t) => {
  const {where, state, projectOutput} = v2Configured(t);
  const index = JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8"));
  assert.deepEqual(index.projects.map(({cwd, name, folder}) => ({cwd, name, folder})), [{
    cwd: fs.realpathSync(where.cwd),
    name: "example",
    folder: "projects/example",
  }]);
  assert.equal(fs.lstatSync(path.join(where.notes, "projects", "example", "project-rules.md")).isFile(), true);
  assert.equal(fs.lstatSync(path.join(where.notes, "projects", "example", "tasks")).isDirectory(), true);
  assert.match(projectOutput, /Task TASK-101 has no folder/);
  assert.equal(state.task_path.endsWith(path.join("tasks", "TASK-101")), true);
  assert.equal(fs.existsSync(state.task_path), false);
});

test("HG-113 task notes are a free contained write zone while source implementation waits for the Digest", (t) => {
  const {where, state: configured} = v2Configured(t);
  const taskDir = path.join(where.notes, "projects", "example", "tasks", "TASK-101");
  const mkdir = "mkdir -p " + JSON.stringify(taskDir);
  let result = v2Pre(configured, where, "turn-3", mkdir, "mkdir");
  assert.equal(isDenied(result), false);
  fs.mkdirSync(taskDir, {recursive: true});
  let state = v2Post(result.state, where, "turn-3", mkdir, "mkdir").state;
  const notePatch = "*** Begin Patch\n*** Add File: " + path.join(taskDir, "understanding.md") + "\n+Observed behavior\n*** End Patch";
  result = v2Pre(state, where, "turn-3", notePatch, "note", "apply_patch");
  assert.equal(isDenied(result), false);
  state = v2Post(result.state, where, "turn-3", notePatch, "note", "apply_patch").state;
  const sourcePatch = "*** Begin Patch\n*** Update File: " + path.join(where.cwd, "source.js") + "\n@@\n-old\n+new\n*** End Patch";
  result = v2Pre(state, where, "turn-3", sourcePatch, "source", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /pmnm-guard digest/);
});

test("HG-114 a later human agreement to the current Digest is implementation authority", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] example.txt — exercise the agreed implementation\n",
  ).state;
  state = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest").state;
  let blocked = v2Pre(state, where, "turn-3", IMPLEMENTATION_PATCH, "same-turn", "apply_patch");
  assert.equal(isDenied(blocked), true);
  assert.match(visibleText(blocked), /waiting for the human/);
  state = v2Prompt(blocked.state, where, "turn-4", "Yes, proceed exactly as shown").state;
  assert.match(visibleText({output: v2Receipt(state, where, "turn-4", "pmnm-guard status", "status").output}), /pmnm-guard agreed/);
  state = v2Receipt(state, where, "turn-4", "pmnm-guard agreed", "agreed").state;
  const allowed = v2Pre(state, where, "turn-4", IMPLEMENTATION_PATCH, "write", "apply_patch");
  assert.equal(isDenied(allowed), false);
  assert.equal(allowed.state.phase, "READY");
  const observed = v2Post(allowed.state, where, "turn-4", IMPLEMENTATION_PATCH, "write", "apply_patch");
  assert.equal(observed.state.phase, "IMPLEMENT");
});

test("HG-115 redo advances the internal epoch and withdraws implementation authority", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] example.txt — exercise invalidation\n",
  ).state;
  state = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest").state;
  state = v2Prompt(state, where, "turn-4", "Agreed").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard agreed", "agreed").state;
  const before = state.epoch;
  const redone = v2Receipt(state, where, "turn-4", "pmnm-guard redo", "redo");
  assert.equal(redone.state.epoch, before + 1);
  assert.equal(redone.state.digest_agreed_epoch, null);
  assert.match(visibleText(redone), /pmnm-guard digest/);
  assert.equal(isDenied(v2Pre(redone.state, where, "turn-4", IMPLEMENTATION_PATCH, "write", "apply_patch")), true);
});

test("HG-116 secret-like additions under PMNM are blocked without echoing the value", (t) => {
  const {where, state} = v2Configured(t);
  const taskDir = path.join(where.notes, "projects", "example", "tasks", "TASK-101");
  fs.mkdirSync(taskDir, {recursive: true});
  const secret = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
  const patch = "*** Begin Patch\n*** Add File: " + path.join(taskDir, "evidence.md") + "\n+api_key=" + secret + "\n*** End Patch";
  const denied = v2Pre(state, where, "turn-3", patch, "secret", "apply_patch");
  assert.equal(isDenied(denied), true);
  assert.match(visibleText(denied), /looks like a secret \(token\)/);
  assert.doesNotMatch(visibleText(denied), new RegExp(secret));
});

test("HG-117 sensitive permission is later-turn, effect-bound, exact-command, and single-use", (t) => {
  const {where, state: agreed} = v3AgreedFor(
    t,
    "- [x] obsolete.txt — remove the obsolete artifact\n",
  );
  let state = agreed;
  const command = "rm obsolete.txt";
  const asked = v2Pre(state, where, "turn-4", command, "delete");
  assert.equal(isDenied(asked), true);
  assert.match(
    visibleText(asked),
    /name what this command changes and ask the human whether to allow it; stop until they answer/,
  );
  assert.match(visibleText(asked), /pmnm-guard allow effect=deletion/);
  const sameTurn = v2Receipt(asked.state, where, "turn-4", "pmnm-guard allow effect=deletion", "allow-early");
  assert.equal(isDenied(sameTurn), true);
  state = v2Prompt(sameTurn.state, where, "turn-5", "Yes, delete that file").state;
  state = v2Receipt(state, where, "turn-5", "pmnm-guard allow effect=deletion", "allow").state;
  const allowed = v2Pre(state, where, "turn-5", command, "delete-retry");
  assert.equal(isDenied(allowed), false);
  const second = v2Pre(allowed.state, where, "turn-5", command, "delete-again");
  assert.equal(isDenied(second), true);
});

test("HG-118 missing and contradictory tool results remain explicit", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let state = agreed;
  state = v2Pre(state, where, "turn-4", IMPLEMENTATION_PATCH, "write", "apply_patch").state;
  const stop = v2Process(state, where, "Stop", "turn-4");
  assert.match(visibleText(stop), /pmnm-guard result outcome=<unknown\|no-effect>/);
  state = v2Receipt(stop.state, where, "turn-4", "pmnm-guard result outcome=no-effect", "result").state;
  const late = v2Post(state, where, "turn-4", IMPLEMENTATION_PATCH, "write", "apply_patch");
  assert.match(visibleText(late), /did take effect after all/);
});

test("HG-119 verified fingerprints are honest with and without a Git provider", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const state = v3WriteClaims(created.state, where, created.task, "turn-4").state;
  let verified = v2Receipt(state, where, "turn-4", "pmnm-guard verified result=passed how=inspection", "verified");
  assert.equal(verified.state.last_verification.fingerprint.provider, "none");
  assert.doesNotMatch(JSON.stringify(verified.state.last_verification.fingerprint), /base|head/);
  verified = v2Receipt(state, where, "turn-4", "pmnm-guard verified result=passed how=inspection", "verified-git", {
    fingerprintProvider: () => ({base: "aaa1111", head: "bbb2222", staged: 1, unstaged: 2, untracked: 3}),
  });
  assert.deepEqual(verified.state.last_verification.fingerprint, {
    provider: "git", base: "aaa1111", head: "bbb2222", staged: 1, unstaged: 2, untracked: 3,
    time: new Date(10).toISOString(), hash: verified.state.last_verification.fingerprint.hash,
  });
});

test("HG-120 cards are localized, bounded to two lines, and contain one literal NEXT", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investiga y corrige esta tarea por favor").state;
  const result = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TAREA-1 effort=standard", "start");
  const lines = twoLines(visibleText(result));
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Pregunta:/);
  assert.match(lines[1], /^NEXT:/);
  assert.match(lines[1], /detente hasta que responda/);
  assert.equal((visibleText(result).match(/NEXT:/g) || []).length, 1);
  assert.doesNotMatch(visibleText(result), /^Please,/m);
});

test("HG-121 PMNM bootstrap and contained notes need only the folder choice and safety checks", (t) => {
  const {where, state} = v2Configured(t);
  const taskDir = path.join(where.notes, "projects", "example", "tasks", "TASK-101", "evidence", "images");
  const operations = [
    ["mkdir -p " + JSON.stringify(taskDir), "Bash"],
    ["*** Begin Patch\n*** Add File: " + path.join(taskDir, "index.md") + "\n+Evidence\n*** End Patch", "apply_patch"],
    ["*** Begin Patch\n*** Update File: " + path.join(where.notes, "projects", "example", "project-rules.md") + "\n@@\n+Always preserve evidence.\n*** End Patch", "apply_patch"],
  ];
  let cursor = state;
  for (const [index, [command, name]] of operations.entries()) {
    const id = "rb-" + index;
    const result = v2Pre(cursor, where, "turn-3", command, id, name);
    assert.equal(isDenied(result), false, visibleText(result));
    assert.doesNotMatch(visibleText(result), /grant|manifest|ready|checkpoint/);
    cursor = v2Post(result.state, where, "turn-3", command, id, name).state;
  }
});

test("HG-122 unsafe PMNM roots and cross-boundary task writes fail closed", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use this location").state;
  const insideRepo = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(path.join(where.cwd, "PMNM")), "bad-folder");
  assert.equal(isDenied(insideRepo), true);
  const {where: configuredWhere, state: configured} = v2Configured(t);
  fs.mkdirSync(path.join(configuredWhere.notes, "projects", "example", "tasks", "TASK-101"), {recursive: true});
  const outsidePatch = "*** Begin Patch\n*** Add File: " + path.join(configuredWhere.root, "not-pmnm.md") + "\n+note\n*** End Patch";
  const denied = v2Pre(configured, configuredWhere, "turn-3", outsidePatch, "outside-note", "apply_patch");
  assert.equal(isDenied(denied), true);
  assert.doesNotMatch(visibleText(denied), /no receipt needed/);
});

test("HG-123 operation identity includes the tool, target path, and edit contract", (t) => {
  const {where, state: agreed} = v3AgreedFor(
    t,
    "- [x] a.txt — exercise operation identity\n- [x] b.txt — distinguish another target\n",
  );
  const first = {file_path: path.join(where.cwd, "a.txt"), content: "same\n"};
  const second = {file_path: path.join(where.cwd, "b.txt"), content: "same\n"};
  let result = v2Pre(agreed, where, "turn-4", "", "write-a", "Write", first);
  assert.equal(isDenied(result), false);
  assert.equal(result.state.pending_writes.length, 1);
  result = v2Post(result.state, where, "turn-4", "", "write-b", "Write", "ok", second);
  assert.equal(result.state.pending_writes.length, 1, "same content at a different path is not the same operation");
  fs.writeFileSync(first.file_path, first.content);
  result = v2Post(result.state, where, "turn-4", "", "write-a", "Write", "ok", first);
  assert.equal(result.state.pending_writes.length, 0);
  assert.equal(result.state.mutation_count, 1);

  const editA = {file_path: path.join(where.cwd, "a.txt"), old_string: "old", new_string: "new"};
  const editB = {file_path: path.join(where.cwd, "a.txt"), old_string: "other", new_string: "new"};
  result = v2Pre(result.state, where, "turn-4", "", "edit-a", "Edit", editA);
  assert.equal(isDenied(result), false);
  result = v2Post(result.state, where, "turn-4", "", "edit-b", "Edit", "ok", editB);
  assert.equal(result.state.pending_writes.length, 1, "old-string identity is part of an Edit operation");
});

test("HG-124 external evidence can be copied into PMNM and secrets are still blocked", (t) => {
  const {where, state: configured} = v2Configured(t);
  const taskDirectory = v2TaskDirectory(where);
  fs.mkdirSync(taskDirectory, {recursive: true});
  const source = path.join(where.root, "evidence.txt");
  const secretSource = path.join(where.root, "secret.txt");
  fs.writeFileSync(source, "observable evidence\n");
  fs.writeFileSync(secretSource, "api_key=sk-proj-1234567890abcdefghijklmnopqrstuvwxyz\n");
  const target = path.join(taskDirectory, "evidence.txt");
  const command = "cp " + JSON.stringify(source) + " " + JSON.stringify(target);
  let result = v2Pre(configured, where, "turn-3", command, "copy-evidence");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-3", command, "copy-evidence");
  const secretCommand = "cp " + JSON.stringify(secretSource) + " " + JSON.stringify(path.join(taskDirectory, "secret.txt"));
  result = v2Pre(result.state, where, "turn-3", secretCommand, "copy-secret");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /looks like a secret \(token\)/);
  assert.doesNotMatch(visibleText(result), /sk-proj-/);
});

test("HG-125 mixed writes, links, and symlink escapes cannot cross the PMNM boundary", (t) => {
  const {where, state: configured} = v2Configured(t);
  const taskDirectory = v2TaskDirectory(where);
  fs.mkdirSync(taskDirectory, {recursive: true});
  const mixed = [
    "*** Begin Patch",
    "*** Add File: " + path.join(taskDirectory, "notes.md"),
    "+notes",
    "*** Update File: " + path.join(where.cwd, "source.js"),
    "@@",
    "-old",
    "+new",
    "*** End Patch",
  ].join("\n");
  let result = v2Pre(configured, where, "turn-3", mixed, "mixed", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /crosses the PMNM folder boundary/);

  const link = "ln -s " + JSON.stringify(path.join(where.root, "evidence.txt")) + " " + JSON.stringify(path.join(taskDirectory, "link"));
  result = v2Pre(configured, where, "turn-3", link, "link");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /crosses the PMNM folder boundary/);

  const outsideDirectory = path.join(where.root, "outside");
  fs.mkdirSync(outsideDirectory);
  fs.symlinkSync(outsideDirectory, path.join(taskDirectory, "escape"));
  const escaped = "*** Begin Patch\n*** Add File: " + path.join(taskDirectory, "escape", "notes.md") + "\n+notes\n*** End Patch";
  result = v2Pre(configured, where, "turn-3", escaped, "escaped", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /crosses the PMNM folder boundary/);

  const indexPatch = "*** Begin Patch\n*** Update File: " + path.join(where.notes, "index.json") + "\n@@\n-old\n+new\n*** End Patch";
  result = v2Pre(configured, where, "turn-3", indexPatch, "index", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /index\.json is maintained by PMNM/);
});

test("HG-126 project display names are Unicode while physical folders remain portable", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investiga TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Usa esa carpeta").state;
  state = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder").state;
  state = v2Prompt(state, where, "turn-3", "El proyecto se llama Proyecto Ártico").state;
  const result = v2Receipt(state, where, "turn-3", "pmnm-guard project name=" + encodePathField("Proyecto Ártico"), "project");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  const index = JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8"));
  assert.equal(index.projects[0].name, "Proyecto Ártico");
  assert.equal(index.projects[0].folder, "projects/Proyecto-Artico");
});

test("HG-127 a moved or deleted PMNM folder is recovered through the same folder receipt", (t) => {
  const {where, state: configured} = v2Configured(t);
  const moved = path.join(where.root, "PMNM-moved");
  fs.renameSync(where.notes, moved);
  let state = v2Prompt(configured, where, "turn-4", "Continue this task").state;
  let result = v2Receipt(state, where, "turn-4", "pmnm-guard status", "status");
  assert.match(visibleText(result), /not at .* any more/);
  state = v2Prompt(result.state, where, "turn-5", "I moved it here").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard folder path=" + encodePathField(moved), "folder-moved");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(fs.readFileSync(path.join(where.codexHome, "pmnm.path"), "utf8").trim(), fs.realpathSync(moved));

  fs.rmSync(moved, {recursive: true, force: true});
  state = v2Prompt(result.state, where, "turn-6", "Continue again").state;
  result = v2Receipt(state, where, "turn-6", "pmnm-guard status", "status");
  assert.match(visibleText(result), /not at .* any more/);
  state = v2Prompt(result.state, where, "turn-7", "Recreate it there").state;
  result = v2Receipt(state, where, "turn-7", "pmnm-guard folder path=" + encodePathField(moved), "folder-recreate");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(fs.existsSync(path.join(moved, "index.json")), true);
  assert.equal(fs.existsSync(path.join(moved, "general-rules.md")), true);
});

test("HG-128 PMNM folder roots reject the repository, host configuration, filesystem root, and traversal", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use this location").state;
  for (const candidate of [where.cwd, path.join(where.cwd, "notes"), where.codexHome, path.parse(where.root).root]) {
    const result = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(candidate), "bad-folder");
    assert.equal(isDenied(result), true, candidate);
  }
  const traversal = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=/tmp/%2E%2E/escape", "traversal");
  assert.equal(isDenied(traversal), true);
});

test("HG-129 one-release aliases preserve the actual operational card and invalid aliases fail closed", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  let result = v2Receipt(
    state,
    where,
    "turn-1",
    "pmnm-guard route activity=TASK-101 effort=standard transition=loaded locator=old record=old",
    "route",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /PMNM needs one folder/);
  assert.doesNotMatch(visibleText(result), /accepted as start/);
  const rejected = v2Receipt(result.state, where, "turn-1", "pmnm-guard align result=changed", "bad-align");
  assert.equal(isDenied(rejected), true);
  assert.match(visibleText(rejected), /Receipt rejected/);

  state = v2Prompt(result.state, where, "turn-2", "Use this folder").state;
  state = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder").state;
  state = v2Prompt(state, where, "turn-3", "Call it example").state;
  state = v2Receipt(state, where, "turn-3", "pmnm-guard project name=example", "project").state;
  const created = v3CreateTask(state, where);
  state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] example.txt — exercise the compatibility alias\n",
  ).state;
  result = v2Receipt(state, where, "turn-3", "pmnm-guard checkpoint kind=combined basis=1", "checkpoint");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /waiting for the human/);
  assert.doesNotMatch(visibleText(result), /accepted as digest/);
});

test("HG-130 the legacy classify receipt remains one-shot while declare is the visible route", (t) => {
  const {where, state: configured} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const unknown = "mystery-tool inspect";
  let result = v2Pre(configured, where, "turn-3", unknown, "unknown");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /pmnm-guard declare/);
  result = v2Receipt(result.state, where, "turn-3", "pmnm-guard classify effect=investigation", "classify");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  result = v2Pre(result.state, where, "turn-3", unknown, "retry");
  assert.equal(isDenied(result), false);
  const different = v2Pre(result.state, where, "turn-3", "mystery-tool inspect-more", "different");
  assert.equal(isDenied(different), true);
});

test("HG-131 Digest agreement requires a later human turn and redo invalidates it", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] example.txt — exercise later-turn agreement\n",
  ).state;
  state = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest").state;
  const spanishState = structuredClone(state);
  spanishState.language = "es";
  const spanishRejected = v2Receipt(
    spanishState,
    where,
    "turn-3",
    "pmnm-guard agreed",
    "same-turn-agreed-es",
  );
  assert.match(visibleText(spanishRejected), /NEXT: detente aquí; ninguna acción más hasta que el humano responda/);
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard agreed", "same-turn-agreed");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /human answer not observed/);
  state = v2Prompt(result.state, where, "turn-4", "Yes").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard agreed", "agreed").state;
  assert.equal(state.phase, "READY");
  result = v2Receipt(state, where, "turn-4", "pmnm-guard redo", "redo");
  assert.equal(result.state.phase, "INVESTIGATE");
  assert.equal(result.state.digest_agreed_epoch, null);
  assert.equal(isDenied(v2Pre(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "write", "apply_patch")), true);
});

test("HG-132 status never repeats an unanswered bookkeeping question as a new Ask", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  const status = v2Receipt(state, where, "turn-1", "pmnm-guard status", "status");
  assert.match(visibleText(status), /^Note: PMNM is waiting for the human/m);
  assert.match(visibleText(status), /NEXT: stop here; no more actions until the human answers/);
  assert.doesNotMatch(visibleText(status), /^Ask:/m);
});

test("HG-133 only narrow negative evidence classifies sensitive shell effects", () => {
  const cases = [
    ["rm file.txt", "deletion"],
    ["mv a b", "movement"],
    ["git commit -m change", "git"],
    ["npm install package", "dependencies"],
    ["npm publish", "publish"],
    ["docker restart service", "environment"],
    ["curl https://example.invalid", "network"],
    ["sed -i '' 's/a/b/' file", "implementation"],
    ["find . -delete", "deletion"],
  ];
  for (const [command, effect] of cases) assert.equal(classifyShell(command).effect, effect, command);
});

test("HG-134 ordinary commands do not gain trust from an ecosystem or executable name", () => {
  for (const command of [
    "rg pattern src", "git diff", "ls -la", "sed -n '1,20p' file", "awk '{print $1}' file",
    "cargo test", "go test ./...", "dotnet test", "prettier --write file.js", "pytest",
  ]) {
    assert.equal(classifyShell(command).kind, "unknown", command);
    assert.equal(classifyShell(command).reason, "dynamic-declaration-required", command);
  }
});

test("HG-135 hidden shell execution fails closed even when it contains a recognizable word", () => {
  for (const command of [
    "awk '{system(\"touch marker\")}' file",
    "xargs custom-tool",
    "eval custom-tool",
    "TOOL=reader $TOOL src",
  ]) {
    const result = classifyShell(command);
    assert.equal(result.kind, "unknown", command);
    assert.equal(result.declarable, false, command);
  }
  assert.equal(classifyShell("bash -c 'echo changed > file'").effect, "implementation");
});

test("HG-136 failed tool results never become observed changes or successful checks", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  assert.equal(isDenied(result), false);
  result = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch", {isError: true});
  assert.equal(result.state.mutation_count, 0);
  assert.equal(result.state.pending_writes.length, 0);
  assert.match(visibleText(result), /did not apply and changed nothing/);

  result = v2Pre(result.state, where, "turn-4", "npm test", "test");
  assert.equal(isDenied(result), false);
  result = v2Post(result.state, where, "turn-4", "npm test", "test", "Bash", {exit_code: 1});
  assert.equal(result.state.last_check, null);
  result = v3WriteClaims(result.state, where);
  const claimed = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "claim");
  assert.equal(isDenied(claimed), true);
  assert.equal(
    visibleText(claimed),
    "Blocked: No successful check is recorded after the latest change.\n" +
      "NEXT: run the check that tests the change again, then pmnm-guard verified result=<passed|failed|partial|blocked> how=command",
  );
});

test("HG-137 command verification is bound to an observed check after the latest change", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  result = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  assert.equal(result.state.mutation_count, 1);
  result = v3WriteClaims(result.state, where);
  result = v2Pre(result.state, where, "turn-4", "npm test", "test");
  result = v2Post(result.state, where, "turn-4", "npm test", "test");
  const verified = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard verified result=passed how=command",
    "verified",
    {now: 1_000, fingerprintProvider: () => null},
  );
  assert.equal(isControlRecorded(verified), true, visibleText(verified));
  assert.equal(verified.state.last_verification.fingerprint.time, "1970-01-01T00:00:01.000Z");
  assert.equal(verified.state.last_verification.mutation_count, 1);
});

test("HG-138 completion reports the actual missing prerequisite instead of a generic Digest error", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  let done = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "done-pending");
  assert.equal(isDenied(done), true);
  assert.match(visibleText(done), /host reported no result/);

  result = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  done = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "done-unverified");
  assert.equal(isDenied(done), true);
  assert.match(visibleText(done), /planned path changed|project work changed/i);

  result = v3WriteClaims(result.state, where);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=inspection", "verified");
  result.state = v3AcknowledgeTestDigest(result.state, where);
  done = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "done");
  assert.equal(isControlRecorded(done), true, visibleText(done));
  assert.equal(done.state.phase, "COMPLETE");
});

test("HG-139 any later observed change makes prior verification stale", (t) => {
  const {where, state: agreed} = v3AgreedFor(
    t,
    "- [x] second.txt — exercise verification invalidation\n",
  );
  let state = v3WriteClaims(agreed, where).state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard verified result=passed how=inspection", "verified").state;
  const secondPatch = "*** Begin Patch\n*** Update File: second.txt\n@@\n-old\n+new\n*** End Patch";
  state = v2Pre(state, where, "turn-4", secondPatch, "second", "apply_patch").state;
  state = v2Post(state, where, "turn-4", secondPatch, "second", "apply_patch").state;
  const done = v2Receipt(state, where, "turn-4", "pmnm-guard done audit=passed", "done");
  assert.equal(isDenied(done), true);
  assert.match(visibleText(done), /planned path changed|project work changed/i);
});

test("HG-140 missing and late results preserve uncertainty without double counting", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let state = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  let result = v2Receipt(state, where, "turn-4", "pmnm-guard result outcome=no-effect", "no-effect");
  assert.equal(result.state.mutation_count, 0);
  assert.equal(result.state.reconciled_writes.length, 1);
  assert.match(visibleText(result), /inspect the current state; rerun the command only if its effect is still required/);
  result = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  assert.equal(result.state.mutation_count, 1);
  assert.equal(result.state.reconciled_writes.length, 0);
  assert.match(visibleText(result), /did take effect after all/);
  const repeated = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  assert.equal(repeated.state.mutation_count, 1);
});

test("HG-141 Stop blocks once per turn and repeats only the same next action", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let state = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  state = v2Post(state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  let result = v2Process(state, where, "Stop", "turn-4");
  assert.equal(result.output.decision, "block");
  assert.match(visibleText(result), /planned path changed|project work changed/i);
  const firstNext = visibleText(result).split("\n")[1];
  result = v2Process(result.state, where, "Stop", "turn-4");
  assert.match(visibleText(result), /stopped this turn once already/);
  assert.equal(visibleText(result).split("\n")[1], firstNext);
  state = v2Prompt(result.state, where, "turn-5", "Continue").state;
  result = v2Process(state, where, "Stop", "turn-5");
  assert.equal(result.output.decision, "block");
});

test("HG-142 Interrupt preserves an in-flight write and enters recovery", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let state = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  const interrupted = v2Process(state, where, "Interrupt", "turn-4");
  assert.equal(interrupted.state.phase, "RECOVERY");
  assert.equal(interrupted.state.pending_writes.length, 1);
  const stop = v2Process(interrupted.state, where, "Stop", "turn-4");
  assert.match(visibleText(stop), /pmnm-guard result/);
});

test("HG-143 a fresh session starts neutral and resumes only the task it explicitly opens", (t) => {
  const where = v2Temp(t);
  const options = {dataRoot: where.dataRoot, environment: {CODEX_HOME: where.codexHome, PLUGIN_DATA: where.dataRoot}, now: 100};
  const send = (event) => ({output: processPersistedEvent(event, options)});
  send(v2Event(where, "UserPromptSubmit", "turn-1", {prompt: "Investigate TASK-101"}));
  send(v2Event(where, "PreToolUse", "turn-1", {tool_name: "Bash", tool_use_id: "start", tool_input: {command: "pmnm-guard start task=TASK-101 effort=standard"}}));
  send(v2Event(where, "UserPromptSubmit", "turn-2", {prompt: "Use this folder"}));
  send(v2Event(where, "PreToolUse", "turn-2", {tool_name: "Bash", tool_use_id: "folder", tool_input: {command: "pmnm-guard folder path=" + encodePathField(where.notes)}}));
  send(v2Event(where, "UserPromptSubmit", "turn-3", {prompt: "Call it example"}));
  send(v2Event(where, "PreToolUse", "turn-3", {tool_name: "Bash", tool_use_id: "project", tool_input: {command: "pmnm-guard project name=example"}}));

  const neutralEvent = {...v2Event(where, "PreToolUse", "turn-4", {tool_name: "Bash", tool_use_id: "status", tool_input: {command: "pmnm-guard status"}}), session_id: "second-session"};
  const neutral = send(neutralEvent);
  assert.match(visibleText(neutral), /No task is open/);
  send({...v2Event(where, "UserPromptSubmit", "turn-5", {prompt: "Resume TASK-101"}), session_id: "second-session"});
  const resumed = send({...v2Event(where, "PreToolUse", "turn-5", {
    tool_name: "Bash", tool_use_id: "resume", tool_input: {command: "pmnm-guard start task=TASK-101 effort=standard"},
  }), session_id: "second-session"});
  assert.match(visibleText(resumed), /TASK-101/);
  const stateFiles = fs.readdirSync(path.join(where.dataRoot, "host-guard", "v3")).filter((name) => name.startsWith("session-") && name.endsWith(".json"));
  assert.equal(stateFiles.length, 2);
});

test("HG-144 corrupt current persisted state fails closed", (t) => {
  const where = v2Temp(t);
  const options = {dataRoot: where.dataRoot, environment: {CODEX_HOME: where.codexHome, PLUGIN_DATA: where.dataRoot}, now: 100};
  const promptEvent = v2Event(where, "UserPromptSubmit", "turn-1", {prompt: "Investigate TASK-101"});
  processPersistedEvent(promptEvent, options);
  const stateFile = testing.statePaths(where.dataRoot, promptEvent).state;
  fs.writeFileSync(stateFile, "not-json");
  const statusEvent = v2Event(where, "PreToolUse", "turn-1", {tool_name: "Bash", tool_use_id: "status", tool_input: {command: "pmnm-guard status"}});
  assert.throws(() => processPersistedEvent(statusEvent, options));
});

test("HG-145 schema-v1 state resets visibly into the 0.1.0 contract", (t) => {
  const where = v2Temp(t);
  const legacy = {schema_version: 1, phase: "ORIENT", language: "es", prompt_epoch: 2, current_turn_hash: null};
  const result = v2Process(legacy, where, "SessionStart", "turn-1", {source: "startup"});
  assert.equal(result.state.schema_version, 2);
  assert.match(visibleText(result), /reinició el estado previo/);
  assert.match(visibleText(result), /pmnm-guard start/);
});

test("HG-146 state history and lock ownership remain bounded", (t) => {
  const where = v2Temp(t);
  let state = testing.baseState();
  for (let index = 0; index < 200; index += 1) {
    state = v2Prompt(state, where, "turn-" + index, "private raw prompt " + index).state;
  }
  assert.equal(state.events.length, testing.MAX_EVENTS);
  assert.doesNotMatch(JSON.stringify(state), /private raw prompt/);
  const lockDirectory = path.join(where.root, "locks");
  fs.mkdirSync(lockDirectory);
  const lock = path.join(lockDirectory, "state.lock");
  const token = testing.acquireLock(lock, 0);
  assert.throws(() => testing.acquireLock(lock, 0), /busy/);
  assert.equal(testing.releaseLock(lock, "wrong"), false);
  assert.equal(testing.releaseLock(lock, token), true);
});

test("HG-147 unreadable pointers and indexes produce recovery instead of guessed state", (t) => {
  const {where, state: configured} = v2Configured(t);
  fs.writeFileSync(path.join(where.notes, "index.json"), "not-json");
  let result = v2Receipt(configured, where, "turn-3", "pmnm-guard status", "status-corrupt-index");
  assert.match(visibleText(result), /cannot safely read its index\.json/);
  assert.equal(result.state.phase, "RECOVERY");

  fs.rmSync(path.join(where.codexHome, "pmnm.path"), {force: true});
  fs.symlinkSync(path.join(where.root, "elsewhere"), path.join(where.codexHome, "pmnm.path"));
  result = v2Receipt(testing.baseState(), where, "turn-4", "pmnm-guard status", "status-linked-pointer");
  assert.match(visibleText(result), /cannot safely read its host pointer/);
});

test("HG-148 switching tasks clears old authority but cannot erase an in-flight result", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let state = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  let result = v2Receipt(state, where, "turn-4", "pmnm-guard start task=TASK-202 effort=standard", "switch-pending");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /host reported no result/);
  state = v2Post(state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  result = v2Receipt(state, where, "turn-4", "pmnm-guard start task=TASK-202 effort=standard", "switch-unverified");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /unfinished, unverified|nothing verified/i);
  state = v2Receipt(state, where, "turn-4", "pmnm-guard verified result=partial how=inspection", "verified").state;
  state = v3AcknowledgeTestDigest(state, where, "turn-4", "turn-5", "partial");
  state = v2Receipt(state, where, "turn-4", "pmnm-guard done audit=partial", "done").state;
  result = v2Receipt(state, where, "turn-4", "pmnm-guard start task=TASK-202 effort=standard", "switch");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(result.state.task_id, "TASK-202");
  assert.equal(result.state.digest_agreed_epoch, null);
  assert.equal(result.state.mutation_count, 0);
});

test("HG-149 a missing task folder yields the task-folder action, never a false no-task error", (t) => {
  const {where, state} = v2Configured(t);
  const result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /Task TASK-101 has no folder/);
  assert.doesNotMatch(visibleText(result), /No task is open/);
  assert.equal(fs.existsSync(v2TaskDirectory(where)), false);
});

test("HG-150 output-producing read tools are never silently classified as pure reads", () => {
  for (const command of ["sort -o output.txt input.txt", "uniq --output=output.txt input.txt", "diff --output=delta.txt a b", "xxd -r input.hex output.bin"]) {
    assert.notEqual(classifyShell(command).kind, "read", command);
  }
});

test("HG-151 starting the same open task is idempotent and can only raise effort", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  const epoch = agreed.epoch;
  let result = v2Receipt(agreed, where, "turn-4", "pmnm-guard start task=TASK-101 effort=high", "resume-high");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(result.state.epoch, epoch);
  assert.equal(result.state.phase, "READY");
  assert.equal(result.state.digest_agreed_epoch, epoch);
  assert.equal(result.state.effort, "high");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard start task=TASK-101 effort=light", "resume-light");
  assert.equal(result.state.epoch, epoch);
  assert.equal(result.state.effort, "high");
  assert.equal(result.state.digest_agreed_epoch, epoch);
});

test("HG-152 the PMNM root needs exact human authority and dynamic paths are never guessed", (t) => {
  const {where, state} = v2Configured(t);
  let result = v2Pre(state, where, "turn-3", "rm -rf " + JSON.stringify(where.notes), "delete-root");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /pmnm-guard allow effect=deletion/);
  result = v2Pre(state, where, "turn-3", 'rm -rf "$PMNM_ROOT"', "dynamic-root");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /hides part of this operation|oculta parte de esta operaci[oó]n/i);
});

test("HG-153 a network command writing into PMNM still needs exact human permission", (t) => {
  const {where, state: configured} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const command = "curl https://example.invalid > " + JSON.stringify(path.join(v2TaskDirectory(where), "response.txt"));
  let result = v2Pre(configured, where, "turn-3", command, "network");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /pmnm-guard allow effect=network/);
  result = v2Prompt(result.state, where, "turn-4", "Yes, make that exact request");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard allow effect=network", "allow");
  result = v2Pre(result.state, where, "turn-4", command, "network-retry");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-4", command, "network-retry");
  assert.equal(result.state.mutation_count, 0, "a contained evidence write is not a source mutation");
  assert.equal(result.state.effect_count, 0);
});

test("HG-154 every compatibility alias maps to its release receipt without hiding the next action", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let result = v2Receipt(agreed, where, "turn-4", "pmnm-guard invalidate basis=1", "invalidate");
  assert.equal(result.state.phase, "INVESTIGATE");
  assert.match(visibleText(result), /pmnm-guard digest/);

  const unknown = "mystery-tool inspect";
  result = v2Pre(result.state, where, "turn-4", unknown, "unknown");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard permit effect=investigation token=legacy", "permit");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(isDenied(v2Pre(result.state, where, "turn-4", unknown, "retry")), false);

  let pending = v2Agreed(t);
  result = v2Pre(pending.state, pending.where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch");
  result = v2Receipt(result.state, pending.where, "turn-4", "pmnm-guard reconcile outcome=failed-no-effect basis=1", "reconcile");
  assert.equal(result.state.pending_writes.length, 0);
  assert.equal(result.state.reconciled_writes.length, 1);

  pending = v2Configured(t);
  const verificationTask = v3CreateTask(pending.state, pending.where);
  const verificationState = v3WriteClaims(verificationTask.state, pending.where, verificationTask.task, "turn-4").state;
  result = v2Receipt(verificationState, pending.where, "turn-4", "pmnm-guard verify result=passed source=inspection basis=1", "verify");
  assert.equal(result.state.last_verification.result, "passed");
  result.state = v3AcknowledgeTestDigest(result.state, pending.where);
  result = v2Receipt(result.state, pending.where, "turn-4", "pmnm-guard complete audit=passed basis=1", "complete");
  assert.equal(result.state.phase, "COMPLETE");

  pending = v2Agreed(t);
  const command = "git commit -m change";
  result = v2Pre(pending.state, pending.where, "turn-4", command, "git");
  result = v2Prompt(result.state, pending.where, "turn-5", "Yes, run that exact command");
  result = v2Receipt(result.state, pending.where, "turn-5", "pmnm-guard grant effect=version-control uses=1 basis=1", "grant");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(isDenied(v2Pre(result.state, pending.where, "turn-5", command, "git-retry")), false);
});

test("HG-155 receipt parsing rejects injection, duplicate fields, and malformed values", () => {
  for (const command of [
    "pmnm-guard status; rm file",
    "pmnm-guard status\npmnm-guard done audit=passed",
    "pmnm-guard start task=A task=B effort=light",
    "pmnm-guard folder path=$HOME/PMNM",
    "pmnm-guard project name='quoted'",
  ]) {
    assert.throws(() => parseControlCommand(command), command);
  }
});

test("HG-156 reads remain available while a result is pending but another write cannot overtake it", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "first", "apply_patch");
  const read = v2DeclaredPre(result.state, where, "turn-4", "rg pattern src", "read");
  assert.equal(isDenied(read), false, visibleText(read));
  const second = "*** Begin Patch\n*** Update File: second.txt\n@@\n-old\n+new\n*** End Patch";
  result = v2Pre(result.state, where, "turn-4", second, "second", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /host reported no result/);
});

test("HG-157 a corrupt canonical project state fails closed across sessions", (t) => {
  const where = v2Temp(t);
  const options = {dataRoot: where.dataRoot, environment: {CODEX_HOME: where.codexHome, PLUGIN_DATA: where.dataRoot}, now: 100};
  processPersistedEvent(v2Event(where, "UserPromptSubmit", "turn-1", {prompt: "Investigate TASK-101"}), options);
  processPersistedEvent(v2Event(where, "PreToolUse", "turn-1", {
    tool_name: "Bash",
    tool_use_id: "start",
    tool_input: {command: "pmnm-guard start task=TASK-101 effort=standard"},
  }), options);
  const statePath = testing.statePaths(where.dataRoot, {
    ...v2Event(where, "SessionStart", "turn-2"),
    session_id: "new-session",
  }).state;
  fs.writeFileSync(statePath, "not-json");
  const nextSession = {...v2Event(where, "PreToolUse", "turn-2", {
    tool_name: "Bash",
    tool_use_id: "status",
    tool_input: {command: "pmnm-guard status"},
  }), session_id: "new-session"};
  assert.throws(() => processPersistedEvent(nextSession, options));
});

test("HG-158 a passed audit cannot conceal partial, failed, or blocked verification", (t) => {
  for (const verification of ["partial", "failed", "blocked"]) {
    const {where, state: agreed} = v2Agreed(t);
    let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch-" + verification, "apply_patch");
    result = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch-" + verification, "apply_patch");
    result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=" + verification + " how=inspection", "verified-" + verification);
    const falsePass = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "done-" + verification);
    assert.equal(isDenied(falsePass), true);
    assert.match(visibleText(falsePass), /bad value audit/);
    if (verification === "blocked") {
      const honest = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=blocked", "honest-blocked");
      assert.equal(isControlRecorded(honest), true, visibleText(honest));
      assert.equal(honest.state.completion, null);
      assert.equal(honest.state.test_digest_audit_epoch, null);
      continue;
    }
    result.state = v3AcknowledgeTestDigest(result.state, where, "turn-4", "turn-5", "partial");
    const honest = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=partial", "honest-" + verification);
    assert.equal(isControlRecorded(honest), true, visibleText(honest));
  }
});

test("HG-159 restarting a completed task opens a fresh epoch without stale authority", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WriteClaims(created.state, where, created.task, "turn-4").state;
  let result = v2Receipt(state, where, "turn-4", "pmnm-guard verified result=passed how=inspection", "verified");
  result.state = v3AcknowledgeTestDigest(result.state, where);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "done");
  const previousEpoch = result.state.epoch;
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard start task=TASK-101 effort=standard", "reopen");
  assert.equal(result.state.epoch, previousEpoch + 1);
  assert.equal(result.state.phase, "INVESTIGATE");
  assert.equal(result.state.digest_agreed_epoch, null);
  assert.equal(result.state.completion, null);
});

test("HG-160 secret scanning rejects a symbolic-link evidence source", (t) => {
  const {where, state} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const source = path.join(where.root, "source.txt");
  const linkedSource = path.join(where.root, "source-link.txt");
  fs.writeFileSync(source, "ordinary evidence\n");
  fs.symlinkSync(source, linkedSource);
  const command = "cp " + JSON.stringify(linkedSource) + " " + JSON.stringify(path.join(v2TaskDirectory(where), "copy.txt"));
  const result = v2Pre(state, where, "turn-3", command, "copy-link");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /looks like a secret \(credential\)/);
});

test("HG-161 representative cards always have two lines and exactly one NEXT action", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  const cards = [];
  let result = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start");
  cards.push(visibleText(result));
  result = v2Receipt(result.state, where, "turn-1", "pmnm-guard done audit=passed", "bad-done");
  cards.push(visibleText(result));
  result = v2Pre(result.state, where, "turn-1", "mystery-tool action", "unknown");
  cards.push(visibleText(result));
  for (const card of cards) {
    assert.equal(twoLines(card).length, 2, card);
    assert.equal((card.match(/NEXT:/g) || []).length, 1, card);
  }
});

test("HG-162 folder and project fields preserve spaces and Unicode through percent encoding", (t) => {
  const where = v2Temp(t);
  where.notes = path.join(where.root, "PMNM Ártico");
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investiga TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Usa esa carpeta").state;
  let result = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  state = v2Prompt(result.state, where, "turn-3", "Llámalo Ejemplo Ártico").state;
  result = v2Receipt(state, where, "turn-3", "pmnm-guard project name=" + encodePathField("Ejemplo Ártico"), "project");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  const index = JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8"));
  assert.equal(index.projects[0].name, "Ejemplo Ártico");
});

test("HG-163 repositories with the same display name receive collision-safe project folders", (t) => {
  const {where, state: firstState} = v2Configured(t);
  const secondCwd = path.join(where.root, "another", "example");
  fs.mkdirSync(secondCwd, {recursive: true});
  const second = {...where, cwd: secondCwd};
  let state = v2Prompt(testing.baseState(), second, "turn-1", "Investigate TASK-202").state;
  state = v2Receipt(state, second, "turn-1", "pmnm-guard start task=TASK-202 effort=standard", "start").state;
  state = v2Prompt(state, second, "turn-2", "Call it example too").state;
  const result = v2Receipt(state, second, "turn-2", "pmnm-guard project name=example", "project");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  const index = JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8"));
  assert.equal(index.projects.length, 2);
  assert.equal(new Set(index.projects.map((entry) => entry.folder)).size, 2);
  assert.equal(firstState.project_slug, "example");
});

test("HG-164 a declared project read routes before a task while any write names the missing start receipt", (t) => {
  const where = v2Temp(t);
  let state = testing.baseState();
  const read = v2DeclaredPre(state, where, "turn-1", "rg pattern src", "read");
  assert.equal(isDenied(read), false, visibleText(read));
  state = read.state;
  const result = v2Pre(state, where, "turn-1", IMPLEMENTATION_PATCH, "write", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /pmnm-guard start task=<ticket-or-id>/);
});

test("HG-165 persisted-state collections are bounded and malformed entries fail closed", () => {
  const tooManyEvents = testing.baseState();
  tooManyEvents.events = Array.from({length: testing.MAX_EVENTS + 1}, (_, index) => ({seq: index + 1}));
  assert.throws(() => testing.validateState(tooManyEvents));
  const tooManyPending = testing.baseState();
  tooManyPending.pending_writes = Array.from({length: 17}, () => ({}));
  assert.throws(() => testing.validateState(tooManyPending));
  const tooManyTargets = testing.baseState();
  tooManyTargets.changed_target_hashes = Array.from({length: 513}, () => "a".repeat(64));
  assert.throws(() => testing.validateState(tooManyTargets));
  const unboundState = testing.baseState();
  unboundState.task_permissions = [{effect: "state-change", operation_hash: "a".repeat(64)}];
  assert.throws(() => testing.validateState(unboundState));
  const projectState = testing.baseState();
  projectState.project_permissions = [{effect: "network", operation_hash: "a".repeat(64), objective_hash: "b".repeat(64)}];
  assert.throws(() => testing.validateState(projectState));
});

test("HG-166 the public action oracle replays against the current guard", async (t) => {
  assert.equal(ACTION_ORACLE.adapter, "codex-lifecycle-hooks");
  assert.equal(ACTION_ORACLE.sequences.length, 32);
  for (const sequence of ACTION_ORACLE.sequences) {
    await t.test(sequence.id + " " + sequence.claim, (child) => {
      const result = runOracleSequence(child, sequence);
      assert.equal(oracleDecision(result), sequence.expect.decision, sequence.id + " decision");
      assert.equal(result.state.phase, sequence.expect.phase, sequence.id + " phase");
      const output = visibleText(result);
      if (sequence.expect.contains) assert.match(output, new RegExp(sequence.expect.contains), sequence.id);
      if (sequence.expect.forbid) assert.doesNotMatch(output, new RegExp(sequence.expect.forbid), sequence.id);
    });
  }
});

test("HG-167 status describes the next action without exposing internal state-machine jargon", (t) => {
  const {where, state: configured} = v2Configured(t);
  let result = v2Receipt(configured, where, "turn-3", "pmnm-guard status", "status-investigating");
  assert.match(visibleText(result), /investigate, show the plan Digest/);
  assert.doesNotMatch(visibleText(result), /\b(?:epoch|phase|INVESTIGATE|READY)\b/);

  const {where: agreedWhere, state: agreed} = v2Agreed(t);
  result = v2Receipt(agreed, agreedWhere, "turn-4", "pmnm-guard status", "status-agreed");
  assert.match(visibleText(result), /Digest for TASK-101 is agreed/);
  assert.doesNotMatch(visibleText(result), /\b(?:epoch|phase|INVESTIGATE|READY)\b/);
});

test("HG-168 folder and project answers are accepted when configuration is missing even before the guard asks", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Use this folder for PMNM").state;
  let result = v2Receipt(
    state,
    where,
    "turn-1",
    "pmnm-guard folder path=" + encodePathField(where.notes),
    "early-folder",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /ask the human the project name/);

  state = v2Prompt(result.state, where, "turn-2", "Call the project example").state;
  result = v2Receipt(state, where, "turn-2", "pmnm-guard project name=example", "early-project");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  const index = JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8"));
  assert.deepEqual(index.projects.map(({name}) => name), ["example"]);
});

test("HG-169 an unrequested folder replacement names the actual recovery step", (t) => {
  const {where, state} = v2Configured(t);
  const replacement = path.join(where.root, "other-PMNM");
  const result = v2Receipt(
    state,
    where,
    "turn-3",
    "pmnm-guard folder path=" + encodePathField(replacement),
    "replacement",
  );
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /folder not requested/);
  assert.match(visibleText(result), /NEXT: pmnm-guard start task=TASK-101 effort=standard/);
  assert.doesNotMatch(visibleText(result), /bad value path/);
});

test("HG-170 a literal cd prefix preserves the nested command effect and target base", (t) => {
  const {where, state} = v2Configured(t);
  const taskDirectory = v2TaskDirectory(where);
  fs.mkdirSync(taskDirectory, {recursive: true});
  assert.equal(classifyShell("cd " + JSON.stringify(where.cwd) + " && rg pattern src").kind, "unknown");
  assert.equal(classifyShell("cd " + JSON.stringify(where.cwd) + " && npm test").kind, "unknown");

  const note = "cd " + JSON.stringify(taskDirectory) + " && touch note.md";
  const noteWrite = v2Pre(state, where, "turn-3", note, "note");
  assert.equal(isDenied(noteWrite), false, visibleText(noteWrite));

  const source = "cd " + JSON.stringify(where.cwd) + " && touch source.js";
  const sourceWrite = v2Pre(state, where, "turn-3", source, "source");
  assert.equal(isDenied(sourceWrite), true);
  assert.match(visibleText(sourceWrite), /No plan Digest is agreed/);
});

test("HG-171 inspection cannot claim passed verification when the project exposes an executable check", (t) => {
  const {where, state: agreed} = v3AgreedFor(
    t,
    "- [x] example.txt — exercise inspection evidence\n- [x] later.txt — invalidate stale approval\n",
  );
  fs.writeFileSync(
    path.join(where.cwd, "package.json"),
    JSON.stringify({scripts: {test: "node --test"}}) + "\n",
  );
  let state = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  state = v2Post(state, where, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  state = v3WriteClaims(state, where).state;
  const claimed = v2Receipt(
    state,
    where,
    "turn-4",
    "pmnm-guard verified result=passed how=inspection",
    "inspection",
  );
  assert.equal(isDenied(claimed), true);
  assert.match(visibleText(claimed), /^Ask: Inspection is not an executed check/m);
  assert.match(visibleText(claimed), /NEXT: ask the human whether inspection-only evidence is enough/);
  const status = v2Receipt(claimed.state, where, "turn-4", "pmnm-guard status", "inspection-status");
  assert.match(visibleText(status), /^Note: PMNM is waiting for the human/m);
  assert.match(visibleText(status), /NEXT: stop here; no more actions until the human answers/);
  assert.doesNotMatch(visibleText(status), /Implementation may begin/);

  state = v2Prompt(claimed.state, where, "turn-5", "Inspection-only evidence is acceptable here").state;
  const accepted = v2Receipt(
    state,
    where,
    "turn-5",
    "pmnm-guard verified result=passed how=inspection",
    "inspection-approved",
  );
  assert.equal(isControlRecorded(accepted), true, visibleText(accepted));

  let staleState = v2Prompt(claimed.state, where, "turn-5b", "Inspection-only evidence is acceptable for the current change").state;
  const laterPatch = "*** Begin Patch\n*** Update File: later.txt\n@@\n-old\n+new\n*** End Patch";
  staleState = v2Pre(staleState, where, "turn-5b", laterPatch, "later", "apply_patch").state;
  staleState = v2Post(staleState, where, "turn-5b", laterPatch, "later", "apply_patch").state;
  staleState = v3WriteClaims(staleState, where, v2TaskDirectory(where), "turn-5b").state;
  const staleClaim = v2Receipt(
    staleState,
    where,
    "turn-5b",
    "pmnm-guard verified result=passed how=inspection",
    "stale-inspection",
  );
  assert.equal(isDenied(staleClaim), true);
  assert.match(visibleText(staleClaim), /^Ask: Inspection is not an executed check/m);
});

test("HG-172 porcelain parsing preserves the leading unstaged column", () => {
  assert.deepEqual(testing.parseGitStatus(" M source.js\n?? new.js\nM  staged.js\nMM both.js\n"), {
    staged: 2,
    unstaged: 2,
    untracked: 1,
  });
});

test("HG-173 Stop yields while a bookkeeping or sensitive human answer is pending", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  let stopped = v2Process(state, where, "Stop", "turn-1");
  assert.equal(stopped.output?.decision, undefined);
  assert.match(visibleText(stopped), /^Note: PMNM is waiting for the human/m);
  assert.match(visibleText(stopped), /NEXT: stop here; no more actions until the human answers/);

  const {where: readyWhere, state: agreed} = v2Agreed(t);
  state = v2Pre(agreed, readyWhere, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  state = v2Post(state, readyWhere, "turn-4", IMPLEMENTATION_PATCH, "patch", "apply_patch").state;
  const sensitive = v2Pre(state, readyWhere, "turn-4", "git commit -m test", "commit");
  assert.equal(isDenied(sensitive), true);
  assert.match(visibleText(sensitive), /^Ask: This command runs git/m);
  stopped = v2Process(sensitive.state, readyWhere, "Stop", "turn-4");
  assert.equal(stopped.output?.decision, undefined);
  assert.match(visibleText(stopped), /^Note: PMNM is waiting for the human/m);
  assert.doesNotMatch(visibleText(stopped), /nothing verified them yet/);
});

test("HG-174 same-turn agreement and shell redirection explain the actual missing prerequisite", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] generated.txt — exercise redirection classification\n",
  ).state;
  state = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest").state;
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard agreed", "too-soon");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /human answer not observed/);
  assert.doesNotMatch(visibleText(result), /redo/);

  result = v2Pre(configured, where, "turn-3", "cat source.txt > generated.txt", "redirect");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /pmnm-guard declare/);
  assert.match(visibleText(result), /persistence=/);
});

test("HG-175 agreement binds an order-insensitive set of canonical path-and-reason pairs", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [ ] src/a.js — change a\n- [ ] src/b.js — change b\n",
  ).state;
  state = v3Agree(state, where);
  assert.match(state.plan_file_hash || "", /^[a-f0-9]{64}$/);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "write-a").state;
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "b.js"), "b=2\n", "write-b").state;
  state = v3WritePlan(
    state,
    where,
    task,
    "turn-4",
    "- [x] src/b.js — change b\n- [x] src/a.js — change a\n",
  ).state;
  state = v3Verify(state, where, task).state;
  const done = v2Receipt(state, where, "turn-4", "pmnm-guard done audit=passed", "done");
  assert.equal(isControlRecorded(done), true, visibleText(done));
});

test("HG-176 a changed excluded file blocks completion even when it changed outside an intercepted tool", (t) => {
  const {where, task, state: initial} = v3Setup(t, {workspace: true});
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [ ] src/a.js — change a\n- [ ] excluded: src/b.js — preserve b\n",
  ).state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "write-a").state;
  fs.writeFileSync(path.join(where.cwd, "src", "b.js"), "b=9\n");
  state = v3WritePlan(
    state,
    where,
    task,
    "turn-4",
    "- [x] src/a.js — change a\n- [ ] excluded: src/b.js — preserve b\n",
  ).state;
  state = v3Verify(state, where, task, {handoff: false}).state;
  const done = v2Receipt(state, where, "turn-4", "pmnm-guard done audit=passed", "done");
  assert.equal(isDenied(done), true);
  assert.match(visibleText(done), /excluded|preserve|src\/b\.js/i);
});

test("HG-177 plan targets are files and a directory is rejected before agreement", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/ — change everything\n").state;
  const digest = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest-directory");
  assert.equal(isDenied(digest), true);
  assert.match(visibleText(digest), /file|directory|archivo|directorio/i);
});

test("HG-178 an agreed plan with no observed or workspace change cannot close", (t) => {
  const {where, task, state: initial} = v3Setup(t, {workspace: true});
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Verify(state, where, task, {handoff: false}).state;
  const done = v2Receipt(state, where, "turn-4", "pmnm-guard done audit=passed", "done");
  assert.equal(isDenied(done), true);
  assert.match(visibleText(done), /nothing changed|no change|sin cambios|src\/a\.js/i);
});

test("HG-179 completion without a workspace provider compares the planned paths directly", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "write-a").state;
  state = v3WritePlan(state, where, task, "turn-4", "- [x] src/a.js — change a\n").state;
  state = v3Verify(state, where, task).state;
  const done = v2Receipt(state, where, "turn-4", "pmnm-guard done audit=passed", "done");
  assert.equal(isControlRecorded(done), true, visibleText(done));
  assert.match(visibleText(done), /planned paths directly|rutas del plan.*directamente/i);
});

test("HG-180 verification claims written before the latest project change are stale", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  const plannedVerification = fs.readFileSync(path.join(task, "verification.md"), "utf8");
  state = v3Write(
    state,
    where,
    "turn-3",
    path.join(task, "verification.md"),
    plannedVerification + "\n- example: requested case → observed\n- unchanged: preserved case → observed\n",
    "early-verification-claims",
  ).state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "write-a").state;
  const verified = v3Verify(state, where, task, {writeClaims: false});
  assert.equal(isDenied(verified), true);
  assert.match(visibleText(verified), /after.*change|postdate|despu[eé]s.*cambio|stale|obsolet/i);
});

test("HG-181 any unknown command segment dominates the whole compound command", () => {
  assert.equal(classifyShell("npm test && node scripts/lint.js").kind, "unknown");
  assert.equal(classifyShell("cat src/a.js && node scripts/lint.js").kind, "unknown");
  assert.equal(classifyShell("node scripts/lint.js 2>&1").kind, "unknown");
  assert.equal(classifyShell("rm obsolete.txt && node scripts/lint.js").kind, "unknown");
});

test("HG-182 project-source reads route into a task without guessing identifiers from prose", (t) => {
  const where = v2Temp(t);
  fs.mkdirSync(path.join(where.cwd, "src"), {recursive: true});
  fs.writeFileSync(path.join(where.cwd, "src", "example.js"), "export const example = true;\n");
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Please help me understand this behavior").state;

  let result = v2DeclaredPre(state, where, "turn-1", "date", "metadata", {boundary: "host"});
  assert.equal(isDenied(result), false, visibleText(result));
  assert.equal(result.state.source_reads_without_task, 0);

  result = v2DeclaredPre(result.state, where, "turn-1", "sed -n '1,20p' src/example.js", "first-source-read");
  assert.equal(isDenied(result), false, visibleText(result));
  assert.match(visibleText(result), /^Note: Project source was read without an open task/m);
  assert.match(visibleText(result), /pmnm-guard start task=<ticket-or-id>/);

  result = v2DeclaredPre(result.state, where, "turn-1", "rg example src", "second-source-read");
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /^Blocked: Project source was read again without an open task/m);
  assert.match(visibleText(result), /pmnm-guard start task=<ticket-or-id>/);
});

test("HG-183 a non-mutating project check can close without an implementation Digest", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WriteClaims(created.state, where, created.task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "verification-only");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-4", "npm test", "verification-only", "Bash", "passed");
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard verified result=passed how=command",
    "verified",
    {fingerprintProvider: () => null},
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  result.state = v3AcknowledgeTestDigest(result.state, where);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "done", {
    workspaceSnapshotProvider: () => ({status: "unavailable", entries: []}),
  });
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /No project-file comparison|Sin comparaci[oó]n de archivos del proyecto/);
});

test("HG-192 external-only deletion asks for exact human authority without inventing a repository plan", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const external = path.join(where.root, "external.txt");
  fs.writeFileSync(external, "remove me\n");
  const command = "rm " + JSON.stringify(external);
  let result = v2Pre(created.state, where, "turn-4", command, "external-delete");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /^Ask: This command deletes files/m);
  assert.match(visibleText(result), /pmnm-guard allow effect=deletion/);
  assert.doesNotMatch(visibleText(result), /Digest/);
  result = v2Prompt(result.state, where, "turn-5", "Yes, delete that exact file");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard allow effect=deletion", "allow-delete");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(isDenied(v2Pre(result.state, where, "turn-5", command, "external-delete-retry")), false);

  const repositoryDelete = v2Pre(created.state, where, "turn-4", "rm src/a.js", "repository-delete");
  assert.equal(isDenied(repositoryDelete), true);
  assert.match(visibleText(repositoryDelete), /Digest/);
});

test("HG-193 direct writes outside both PMNM and the repository require external-write authority", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const target = path.join(where.root, "host-config.txt");
  const input = {file_path: target, content: "setting=true\n"};
  const result = v2Pre(created.state, where, "turn-4", "", "external-write", "Write", input);
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /^Ask: /m);
  assert.match(visibleText(result), /pmnm-guard allow effect=external-write/);
  assert.doesNotMatch(visibleText(result), /Digest/);
});

test("HG-194 mixed unknown or independently sensitive shell segments must be split", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  for (const command of [
    "rm /tmp/obsolete && mystery-tool act",
    "curl https://example.invalid && rm /tmp/obsolete",
  ]) {
    const classification = classifyShell(command);
    assert.equal(classification.kind, "unknown", command);
    const result = v2Pre(created.state, where, "turn-4", command, "compound-" + command.length);
    assert.equal(isDenied(result), true);
    assert.match(visibleText(result), /split|separate|separa/i);
    assert.doesNotMatch(visibleText(result), /pmnm-guard allow/);
  }
});

test("HG-195 network output obeys both target geometry and network authority", (t) => {
  const {where, state: configured} = v3Setup(t);
  let result = v2Pre(configured, where, "turn-4", "curl https://example.invalid > src/a.js", "download-project");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /Digest/);
  assert.doesNotMatch(visibleText(result), /allow effect=network/);

  const external = path.join(where.root, "download.txt");
  result = v2Pre(configured, where, "turn-4", "curl https://example.invalid > " + JSON.stringify(external), "download-external");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /allow effect=network/);
  assert.doesNotMatch(visibleText(result), /Digest/);
});

test("HG-196 command-family option arity resolves literal destinations and fails closed otherwise", (t) => {
  const where = v2Temp(t);
  fs.mkdirSync(path.join(where.cwd, "src"), {recursive: true});
  fs.writeFileSync(path.join(where.cwd, "src", "a.js"), "a\n");
  const destination = path.join(where.root, "dest");
  fs.mkdirSync(destination);
  const resolve = (command) => testing.resolveWriteTargets({
    ...v2Event(where, "PreToolUse", "turn-1"),
    tool_name: "Bash",
    tool_input: {command},
  }, command);
  for (const command of [
    "cp -t " + JSON.stringify(destination) + " src/a.js",
    "ln -s -t " + JSON.stringify(destination) + " src/a.js",
    "install -t " + JSON.stringify(destination) + " src/a.js",
  ]) {
    const resolution = resolve(command);
    assert.equal(resolution.resolvable, true, command);
    assert.ok(resolution.targets.some((entry) => entry.path === path.join(fs.realpathSync(destination), "a.js")), command);
    assert.ok(resolution.targets.every((entry) => entry.path !== fs.realpathSync(path.join(where.cwd, "src", "a.js")) || entry.kind === "delete"), command);
  }
  assert.equal(resolve("install --unknown value src/a.js out.js").resolvable, false);
});

test("HG-197 formatter names do not create trusted target evidence", (t) => {
  const where = v2Temp(t);
  for (const name of ["a.js", "a.py", "a.rs", "a.go"]) fs.writeFileSync(path.join(where.cwd, name), "source\n");
  const cases = [
    ["prettier --write a.js", "a.js"],
    ["black a.py", "a.py"],
    ["rustfmt a.rs", "a.rs"],
    ["gofmt -w a.go", "a.go"],
    ["ruff format a.py", "a.py"],
  ];
  for (const [command, name] of cases) {
    assert.equal(classifyShell(command).kind, "unknown", command);
    const event = {...v2Event(where, "PreToolUse", "turn-1"), tool_name: "Bash", tool_input: {command}};
    const resolution = testing.resolveWriteTargets(event, command);
    assert.equal(resolution.resolvable, false, command + " must use its declaration and workspace comparison");
    assert.ok(fs.existsSync(path.join(where.cwd, name)));
  }
});

test("HG-198 verification-looking flags do not create a positive command catalog", () => {
  const implementations = [
    "npm run build",
    "npm test -- -u",
    "npx vitest --update",
    "eslint --fix source.js",
    "tsc",
    "vue-tsc --build",
    "black source.py",
    "rustfmt source.rs",
    "ruff check --fix source.py",
  ];
  for (const command of implementations) assert.equal(classifyShell(command).kind, "unknown", command);
  for (const command of ["tsc --noEmit", "vue-tsc --noEmit", "black --check source.py", "rustfmt --check source.rs", "ruff check source.py"]) {
    assert.equal(classifyShell(command).kind, "unknown", command);
  }
});

test("HG-199 a passed audit always requires current passed verification", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let result = v2Receipt(created.state, where, "turn-4", "pmnm-guard done audit=passed", "done-without-check");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /verif|check|comprob/i);

  result = v2Receipt(created.state, where, "turn-4", "pmnm-guard verified result=failed how=inspection", "failed");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "false-pass");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /bad value audit|passed verification|verificaci[oó]n/i);
});

test("HG-200 human verification requires a later human turn", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WriteClaims(created.state, where, created.task, "turn-4").state;
  let result = v2Receipt(state, where, "turn-4", "pmnm-guard verified result=passed how=human", "human-too-soon");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /^Ask: /m);
  state = v2Prompt(result.state, where, "turn-5", "I performed the manual check and it passed").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard verified result=passed how=human", "human-after-answer");
  assert.equal(isControlRecorded(result), true, visibleText(result));
});

test("HG-201 verification-only closure still requires fresh example and unchanged evidence", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let result = v2Pre(created.state, where, "turn-4", "npm test", "check");
  result = v2Post(result.state, where, "turn-4", "npm test", "check", "Bash", "passed");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "claim");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /example:|unchanged:/);
});

test("HG-202 a verification command that changes the project returns to the plan path", (t) => {
  const {where, task, state: initial} = v3Setup(t, {workspace: true});
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — preserve generated output\n").state;
  state = v3Agree(state, where);
  let result = v2Pre(state, where, "turn-4", "npm test", "mutating-check");
  fs.writeFileSync(path.join(where.cwd, "src", "a.js"), "generated\n");
  result = v2Post(result.state, where, "turn-4", "npm test", "mutating-check", "Bash", "passed");
  assert.equal(result.state.digest_agreed_epoch, null);
  assert.equal(result.state.phase, "INVESTIGATE");
  assert.match(visibleText(result), /changed the project|cambi[oó] el proyecto/i);
  const next = visibleText(result).split("NEXT:")[1] || "";
  assert.ok(next.indexOf("pmnm-guard redo") >= 0, next);
  assert.ok(next.indexOf("pmnm-guard redo") < next.indexOf("inspect"), next);
});

test("HG-203 no-op and restored writes cannot satisfy an implementation plan", (t) => {
  for (const workspace of [false, true]) for (const restored of [false, true]) {
    const {where, task, state: initial} = v3Setup(t, {workspace});
    let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — materially change a\n").state;
    state = v3Agree(state, where);
    if (restored) {
      state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "change-a").state;
    }
    state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=1\n", "restore-a-" + restored).state;
    state = v3Verify(state, where, task, {handoff: false}).state;
    const done = v2Receipt(state, where, "turn-4", "pmnm-guard done audit=passed", "done-" + workspace + "-" + restored);
    assert.equal(isDenied(done), true);
    assert.match(visibleText(done), /no changed target|no change|sin cambios|objetivo modificado/i);
  }
});

test("HG-204 an existing empty PMNM folder is seeded before its pointer is written", (t) => {
  const where = v2Temp(t);
  fs.mkdirSync(where.notes);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use that existing empty folder").state;
  const result = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(fs.existsSync(path.join(where.notes, "index.json")), true);
  assert.equal(fs.existsSync(path.join(where.notes, "general-rules.md")), true);
  assert.equal(fs.readFileSync(path.join(where.codexHome, "pmnm.path"), "utf8").trim(), fs.realpathSync(where.notes));
});

test("HG-205 corrupt folder state is preserved and repaired only after a later human answer", (t) => {
  const where = v2Temp(t);
  fs.mkdirSync(where.notes);
  fs.writeFileSync(path.join(where.notes, "index.json"), "not-json\n");
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use that existing folder").state;
  let result = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder-corrupt");
  assert.equal(isDenied(result), true);
  assert.equal(fs.existsSync(path.join(where.codexHome, "pmnm.path")), false);
  assert.match(visibleText(result), /preserve|recovery|conserv/i);
  state = v2Prompt(result.state, where, "turn-3", "Yes, preserve the invalid index and rebuild it").state;
  result = v2Receipt(state, where, "turn-3", "pmnm-guard folder path=" + encodePathField(where.notes), "folder-recover");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8")).schema, "pmnm.projects/v1");
  assert.ok(fs.readdirSync(where.notes).some((name) => name.startsWith("index.json.recovery-")));
});

test("HG-206 an unreadable host pointer has an exact human-directed recovery path", (t) => {
  const where = v2Temp(t);
  fs.writeFileSync(path.join(where.codexHome, "pmnm.path"), "relative/not-safe\n");
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  let result = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start");
  assert.match(visibleText(result), /^Ask: /m);
  assert.match(visibleText(result), /pmnm-guard folder path=/);
  state = v2Prompt(result.state, where, "turn-2", "Replace the invalid pointer and use this folder").state;
  result = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "repair-pointer");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(fs.readFileSync(path.join(where.codexHome, "pmnm.path"), "utf8").trim(), fs.realpathSync(where.notes));
  assert.ok(fs.readdirSync(where.codexHome).some((name) => name.startsWith("pmnm.path.recovery-")));
});

test("HG-207 a candidate task folder presents executable yes and no paths", (t) => {
  const {where, state} = v2Configured(t);
  const tasks = path.join(where.notes, "projects", "example", "tasks");
  const candidate = path.join(tasks, "DEMO-6-coupons");
  fs.mkdirSync(candidate, {recursive: true});
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard start task=DEMO-6 effort=standard", "start-candidate");
  assert.match(visibleText(result), /^Ask: /m);
  assert.match(visibleText(result), new RegExp("mv " + escapeRegExp(JSON.stringify(fs.realpathSync(candidate)))));
  assert.match(visibleText(result), new RegExp("mkdir -p " + escapeRegExp(JSON.stringify(result.state.task_path))));
  result = v2Prompt(result.state, where, "turn-4", "Yes, that candidate is this task");
  const command = "mv " + JSON.stringify(candidate) + " " + JSON.stringify(result.state.task_path);
  result = v2Pre(result.state, where, "turn-4", command, "adopt-task");
  assert.equal(isDenied(result), false, visibleText(result));
  fs.renameSync(candidate, result.state.task_path);
  result = v2Post(result.state, where, "turn-4", command, "adopt-task");
  assert.equal(fs.existsSync(path.join(result.state.task_path, "index.md")), true);
  assert.equal(result.state.pending_question, null);
});

test("HG-208 safe extensionless root files are valid plan targets without an ecosystem whitelist", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const state = v3WritePlan(initial, where, task, "turn-3", "- [ ] Gemfile — add the dependency manifest\n").state;
  const digest = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest-extensionless");
  assert.equal(isControlRecorded(digest), true, visibleText(digest));
});

test("HG-209 persisted pending operations contain hashes and metadata but no raw command preview", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "private-patch", "apply_patch");
  assert.doesNotMatch(JSON.stringify(result.state), /\*\*\* Begin Patch|\*\*\* Update File:|\+new/);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard result outcome=no-effect", "reconcile");
  assert.doesNotMatch(JSON.stringify(result.state), /\*\*\* Begin Patch|\*\*\* Update File:|\+new/);
  assert.match(JSON.stringify(result.state), /command_hash/);
});

test("HG-210 sensitive authority is never bound to command bytes the human could not review", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const longCommand = "curl https://example.invalid/" + "x".repeat(600);
  const long = v2Pre(created.state, where, "turn-4", longCommand, "long-sensitive");
  assert.equal(isDenied(long), true);
  assert.match(visibleText(long), /split|shorter|shorter command|divide|separa/i);
  assert.doesNotMatch(visibleText(long), /pmnm-guard allow/);

  const shortCommand = "curl https://example.invalid/status";
  const short = v2Pre(created.state, where, "turn-4", shortCommand, "short-sensitive");
  assert.match(visibleText(short), new RegExp(escapeRegExp(shortCommand)));
  assert.match(visibleText(short), /pmnm-guard allow effect=network/);
});

test("HG-211 persisted authority is session-local while project and task identity stay canonical", (t) => {
  const {where} = v2Configured(t);
  const alias = path.join(where.root, "repository-alias");
  fs.symlinkSync(where.cwd, alias);
  const first = testing.statePaths(where.dataRoot, {...v2Event(where, "SessionStart", "turn-1"), session_id: "first"});
  const second = testing.statePaths(where.dataRoot, {...v2Event(where, "SessionStart", "turn-1"), session_id: "second"});
  const aliased = testing.statePaths(where.dataRoot, {...v2Event({...where, cwd: alias}, "SessionStart", "turn-1"), session_id: "first"});
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.lock, second.lock);
  assert.equal(first.state, aliased.state);
  assert.equal(first.projectState, second.projectState);

  fs.mkdirSync(path.join(where.notes, "projects", "example", "tasks", "TASK-A"), {recursive: true});
  fs.mkdirSync(path.join(where.notes, "projects", "example", "tasks", "TASK-B"), {recursive: true});

  const options = {dataRoot: where.dataRoot, environment: {CODEX_HOME: where.codexHome, PLUGIN_DATA: where.dataRoot}, now: 100};
  processPersistedEvent({...v2Event(where, "SessionStart", "turn-1", {source: "startup"}), session_id: "first"}, options);
  processPersistedEvent({...v2Event(where, "UserPromptSubmit", "turn-1", {prompt: "Work on task A"}), session_id: "first"}, options);
  processPersistedEvent({...v2Event(where, "PreToolUse", "turn-1", {
    tool_name: "Bash", tool_use_id: "start-a", tool_input: {command: "pmnm-guard start task=TASK-A effort=standard"},
  }), session_id: "first"}, options);
  processPersistedEvent({...v2Event(where, "SessionStart", "turn-2", {source: "startup"}), session_id: "second"}, options);
  processPersistedEvent({...v2Event(where, "UserPromptSubmit", "turn-2", {prompt: "Work on task B"}), session_id: "second"}, options);
  processPersistedEvent({...v2Event(where, "PreToolUse", "turn-2", {
    tool_name: "Bash", tool_use_id: "start-b", tool_input: {command: "pmnm-guard start task=TASK-B effort=standard"},
  }), session_id: "second"}, options);

  const statusA = processPersistedEvent({...v2Event(where, "PreToolUse", "turn-3", {
    tool_name: "Bash", tool_use_id: "status-a", tool_input: {command: "pmnm-guard status"},
  }), session_id: "first"}, options);
  const statusB = processPersistedEvent({...v2Event(where, "PreToolUse", "turn-3", {
    tool_name: "Bash", tool_use_id: "status-b", tool_input: {command: "pmnm-guard status"},
  }), session_id: "second"}, options);
  assert.match(visibleText({output: statusA}), /TASK-A/);
  assert.doesNotMatch(visibleText({output: statusA}), /TASK-B/);
  assert.match(visibleText({output: statusB}), /TASK-B/);
});

test("HG-212 ordinary internal PMNM maintenance is free while changing the PMNM root asks", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const internal = path.join(created.task, "temporary.md");
  fs.writeFileSync(internal, "temporary\n");
  let result = v2Pre(created.state, where, "turn-4", "rm " + JSON.stringify(internal), "internal-delete");
  assert.equal(isDenied(result), false, visibleText(result));

  result = v2Pre(created.state, where, "turn-4", "rm -rf " + JSON.stringify(where.notes), "root-delete");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /allow effect=deletion/);
  assert.doesNotMatch(visibleText(result), /Digest/);
});

test("HG-213 documented host plugin changes have an exact external-effect path", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  for (const command of [
    "codex plugin add ./please-make-no-mistakes",
    "codex plugin remove please-make-no-mistakes",
    "codex plugin marketplace add ./source",
    "codex plugin marketplace remove source",
    "claude plugin marketplace add ./source",
    "claude plugin install please-make-no-mistakes@marketplace",
    "claude plugin uninstall please-make-no-mistakes@marketplace",
  ]) {
    const result = v2Pre(created.state, where, "turn-4", command, "plugin-" + command.length);
    assert.equal(isDenied(result), true);
    assert.match(visibleText(result), /allow effect=environment/);
    assert.doesNotMatch(visibleText(result), /classify effect=/);
    assert.doesNotMatch(visibleText(result), /Digest/);
  }
});

test("HG-214 a successful external effect cannot end without current verification", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const command = "codex plugin marketplace add ./source";
  let result = v2Pre(created.state, where, "turn-4", command, "external-effect");
  result = v2Prompt(result.state, where, "turn-5", "Yes, make that exact environment change");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard allow effect=environment", "allow-external-effect");
  result = v2Pre(result.state, where, "turn-5", command, "external-effect-retry");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-5", command, "external-effect-retry");
  assert.equal(result.state.effect_count, 1);
  result = v2Process(result.state, where, "Stop", "turn-5");
  assert.equal(result.output?.decision, "block");
  assert.match(visibleText(result), /unverified|sin verificar/i);
});

test("HG-215 an unverified external effect blocks transition to another task", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const command = "codex plugin marketplace add ./source";
  let result = v2Pre(created.state, where, "turn-4", command, "external-before-transition");
  result = v2Prompt(result.state, where, "turn-5", "Yes, make that exact environment change");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard allow effect=environment", "allow-before-transition");
  result = v2Pre(result.state, where, "turn-5", command, "external-before-transition-retry");
  result = v2Post(result.state, where, "turn-5", command, "external-before-transition-retry");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard start task=TASK-OTHER effort=standard", "change-task");
  assert.equal(isDenied(result), true);
  assert.equal(result.state.task_id, "TASK-101");
  assert.match(visibleText(result), /unverified|sin verificar/i);
});

test("HG-216 task-folder actions quote every literal path for the shell", (t) => {
  const where = v2Temp(t);
  where.notes = path.join(where.root, "PMNM $notes' space");
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use that folder").state;
  state = v2Receipt(state, where, "turn-2", "pmnm-guard folder path=" + encodePathField(where.notes), "folder").state;
  state = v2Prompt(state, where, "turn-3", "Call it example").state;
  const project = v2Receipt(state, where, "turn-3", "pmnm-guard project name=example", "project");
  const match = visibleText(project).match(/NEXT: run exactly: (mkdir -p .+)$/m);
  assert.ok(match, visibleText(project));
  const command = match[1];
  const admitted = v2Pre(project.state, where, "turn-3", command, "mkdir-quoted-task");
  assert.equal(isDenied(admitted), false, visibleText(admitted));
  const executed = spawnSync("/bin/sh", ["-c", command], {cwd: where.cwd, encoding: "utf8"});
  assert.equal(executed.status, 0, executed.stderr);
  const observed = v2Post(admitted.state, where, "turn-3", command, "mkdir-quoted-task");
  assert.equal(fs.existsSync(path.join(observed.state.task_path, "index.md")), true);

  const tasks = path.join(where.notes, "projects", "example", "tasks");
  const candidate = path.join(tasks, "DEMO-6-coupons");
  fs.mkdirSync(candidate, {recursive: true});
  let adoption = v2Receipt(
    observed.state,
    where,
    "turn-4",
    "pmnm-guard start task=DEMO-6 effort=standard",
    "start-quoted-candidate",
  );
  const adoptionMatch = visibleText(adoption).match(/after yes, run exactly: (mv .+); after no/m);
  assert.ok(adoptionMatch, visibleText(adoption));
  adoption = v2Prompt(adoption.state, where, "turn-5", "Yes, that candidate is this task");
  const move = adoptionMatch[1];
  const admittedMove = v2Pre(adoption.state, where, "turn-5", move, "move-quoted-task");
  assert.equal(isDenied(admittedMove), false, visibleText(admittedMove));
  const moved = spawnSync("/bin/sh", ["-c", move], {cwd: where.cwd, encoding: "utf8"});
  assert.equal(moved.status, 0, moved.stderr);
  const observedMove = v2Post(admittedMove.state, where, "turn-5", move, "move-quoted-task");
  assert.equal(fs.existsSync(path.join(observedMove.state.task_path, "index.md")), true);
});

test("HG-217 a new project name requires the human turn requested by the guard", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use that PMNM folder").state;
  const folder = v2Receipt(
    state,
    where,
    "turn-2",
    "pmnm-guard folder path=" + encodePathField(where.notes),
    "folder",
  );
  assert.match(visibleText(folder), /ask the human the project name/);
  const invented = v2Receipt(folder.state, where, "turn-2", "pmnm-guard project name=invented", "same-turn-project");
  assert.equal(isDenied(invented), true);
  assert.match(visibleText(invented), /human answer|human answers/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8")).projects.length, 0);
});

test("HG-218 a revised no-VCS plan compares every path retained from the original baseline", (t) => {
  for (const changedOldTarget of [false, true]) {
    const {where, task, state: initial} = v3Setup(t);
    let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
    state = v3Agree(state, where);
    if (changedOldTarget) {
      state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "change-old-target").state;
    }
    state = v2Receipt(state, where, "turn-5", "pmnm-guard redo", "redo-plan").state;
    state = v3WritePlan(state, where, task, "turn-5", "- [ ] src/b.js — change b\n").state;
    const digest = v2Receipt(state, where, "turn-5", "pmnm-guard digest", "revised-digest");
    assert.equal(isDenied(digest), changedOldTarget, visibleText(digest));
    if (changedOldTarget) assert.match(visibleText(digest), /src\/a\.js/);
  }
});

test("HG-219 an unindexed project directory is never adopted for a new repository", (t) => {
  const where = v2Temp(t);
  let state = v2Prompt(testing.baseState(), where, "turn-1", "Investigate TASK-101").state;
  state = v2Receipt(state, where, "turn-1", "pmnm-guard start task=TASK-101 effort=standard", "start").state;
  state = v2Prompt(state, where, "turn-2", "Use that PMNM folder").state;
  state = v2Receipt(
    state,
    where,
    "turn-2",
    "pmnm-guard folder path=" + encodePathField(where.notes),
    "folder",
  ).state;

  const orphan = path.join(where.notes, "projects", "example");
  fs.mkdirSync(orphan, {recursive: true});
  fs.writeFileSync(path.join(orphan, "belongs-elsewhere.txt"), "preserve me\n");

  state = v2Prompt(state, where, "turn-3", "Call this project example").state;
  const configured = v2Receipt(state, where, "turn-3", "pmnm-guard project name=example", "project");
  assert.equal(isControlRecorded(configured), true, visibleText(configured));
  const index = JSON.parse(fs.readFileSync(path.join(where.notes, "index.json"), "utf8"));
  const mapping = index.projects.find((entry) => entry.cwd === fs.realpathSync(where.cwd));

  assert.ok(mapping);
  assert.notEqual(mapping.folder, "projects/example");
  assert.equal(fs.readFileSync(path.join(orphan, "belongs-elsewhere.txt"), "utf8"), "preserve me\n");
  assert.equal(fs.existsSync(path.join(where.notes, mapping.folder, "project-rules.md")), true);
});

test("HG-220 an external write cannot hide beside another sensitive effect", (t) => {
  const {where, state} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const first = path.join(where.root, "outside-delete.txt");
  const second = path.join(where.root, "outside-create.txt");
  fs.writeFileSync(first, "keep until explicitly authorized\n");
  const command = "rm " + JSON.stringify(first) + " && touch " + JSON.stringify(second);
  const result = v2Pre(state, where, "turn-4", command, "mixed-external-effects");

  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /split/);
  assert.doesNotMatch(visibleText(result), /pmnm-guard allow/);
});

test("HG-184 a plan stays fresh across clarification until the next Digest or redo", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [ ] example.txt — implement the clarified behavior\n",
  ).state;
  state = v2Prompt(state, where, "turn-4", "One clarification: preserve the existing fallback").state;
  const digest = v2Receipt(state, where, "turn-4", "pmnm-guard digest", "digest-after-clarification");
  assert.equal(isControlRecorded(digest), true, visibleText(digest));
  assert.match(visibleText(digest), /waiting for the human/);
});

test("HG-185 the closing card reports distinct rules files written during the task", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const projectRules = path.join(where.notes, "projects", "example", "project-rules.md");
  let result = v3Write(
    created.state,
    where,
    "turn-4",
    projectRules,
    "# Project rules\n\nPreserve the established fallback.\n",
    "project-rule",
  );
  result.state = v3ReloadRuleBasis(result.state, where, "turn-4", "rules-before-close");
  result = v3WriteClaims(result.state, where, created.task, "turn-4");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=inspection", "verified");
  result.state = v3AcknowledgeTestDigest(result.state, where);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "done", {
    workspaceSnapshotProvider: () => ({status: "unavailable", entries: []}),
  });
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /Rules files written: 1\./);
});

test("HG-186 one unrelated task folder does not trigger an identity question", (t) => {
  const {where, state} = v2Configured(t);
  const tasks = path.join(where.notes, "projects", "example", "tasks");
  fs.mkdirSync(path.join(tasks, "DEMO-3"), {recursive: true});

  const result = v2Receipt(
    state,
    where,
    "turn-3",
    "pmnm-guard start task=DEMO-11 effort=standard",
    "start-unrelated",
  );
  const text = visibleText(result);
  assert.doesNotMatch(text, /ask the human/i);
  assert.doesNotMatch(text, /DEMO-3/);
  assert.match(text, new RegExp("NEXT: run exactly: mkdir -p " + escapeRegExp(JSON.stringify(result.state.task_path))));
});

test("HG-187 an exact task folder resumes without an identity question", (t) => {
  const {where, state} = v2Configured(t);
  const exact = v2TaskDirectory(where, "DEMO-6");
  fs.mkdirSync(exact, {recursive: true});

  const result = v2Receipt(
    state,
    where,
    "turn-3",
    "pmnm-guard start task=DEMO-6 effort=standard",
    "start-exact",
  );
  const text = visibleText(result);
  assert.doesNotMatch(text, /ask the human/i);
  assert.doesNotMatch(text, /has no folder/);
  assert.equal(result.state.task_id, "DEMO-6");
  assert.equal(result.state.rule_basis_required, true);
  assert.match(text, /durable rules and context|reglas.*contexto/i);
  assert.doesNotMatch(text, /candidate|candidata/i);
  assert.equal(fs.existsSync(path.join(exact, "index.md")), true);
});

test("HG-188 only bounded or normalized task-folder candidates trigger the identity question", (t) => {
  const {where, state} = v2Configured(t);
  const tasks = path.join(where.notes, "projects", "example", "tasks");
  for (const name of ["DEMO-6-coupons", "demo6", "DEMO-60", "XDEMO-6", "DEMO-6X", "OTHER"]) {
    fs.mkdirSync(path.join(tasks, name), {recursive: true});
  }

  const result = v2Receipt(
    state,
    where,
    "turn-3",
    "pmnm-guard start task=DEMO-6 effort=standard",
    "start-candidates",
  );
  const text = visibleText(result);
  assert.match(text, /Candidate task folders:/);
  assert.match(text, /DEMO-6-coupons/);
  assert.match(text, /demo6/);
  assert.doesNotMatch(text, /DEMO-60/);
  assert.doesNotMatch(text, /XDEMO-6/);
  assert.doesNotMatch(text, /DEMO-6X/);
  assert.doesNotMatch(text, /OTHER/);
  assert.match(text, /ask the human whether/);
});

test("HG-189 several unrelated task folders still produce the exact mkdir action", (t) => {
  const {where, state} = v2Configured(t, "es");
  const tasks = path.join(where.notes, "projects", "example", "tasks");
  for (const name of ["ALPHA-1", "DEMO-3", "DEMO-60", "OMEGA"]) {
    fs.mkdirSync(path.join(tasks, name), {recursive: true});
  }

  const result = v2Receipt(
    state,
    where,
    "turn-3",
    "pmnm-guard start task=DEMO-11 effort=standard",
    "start-many-unrelated",
  );
  const text = visibleText(result);
  assert.doesNotMatch(text, /pregunta al humano/i);
  assert.doesNotMatch(text, /ALPHA-1|DEMO-3|DEMO-60|OMEGA/);
  assert.match(
    text,
    new RegExp("NEXT: ejecuta exactamente: mkdir -p " + escapeRegExp(JSON.stringify(result.state.task_path))),
  );
});

test("HG-190 investigation Stop cards state only the missing Digest they can observe", (t) => {
  for (const language of ["en", "es"]) {
    const {where, state: configured} = v2Configured(t, language);
    const created = v3CreateTask(configured, where);

    let result = v2Process(created.state, where, "Stop", "turn-3");
    assert.equal(
      visibleText(result),
      language === "es"
        ? "Nota: La investigación se pausa sin Digest registrado en este turno.\n" +
            "NEXT: muestra el Digest; si tu último mensaje ya hace una pregunta al humano, detente aquí"
        : "Note: Investigation is pausing with no Digest recorded this turn.\n" +
            "NEXT: show the Digest; if your last message already asks the human one question, stop here",
    );

    result = v2Process(result.state, where, "Stop", "turn-3");
    assert.equal(
      visibleText(result),
      language === "es"
        ? "Pregunta: La investigación se pausa sin Digest registrado en este turno.\n" +
            "NEXT: muestra el Digest ahora; si una pregunta lo bloquea, hazla y detente aquí"
        : "Ask: Investigation is pausing with no Digest recorded this turn.\n" +
            "NEXT: show the Digest now; if one question blocks it, ask that question and stop here",
    );
  }
});

test("HG-191 stale command evidence is distinct from an invalid verification method", (t) => {
  const {where, state: agreed} = v2Agreed(t);

  const invalid = v2Receipt(
    agreed,
    where,
    "turn-4",
    "pmnm-guard verified result=passed how=commands",
    "invalid-how",
  );
  assert.equal(isDenied(invalid), true);
  assert.match(visibleText(invalid), /^Blocked: Receipt rejected: bad value how\./m);

  let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "patch-1", "apply_patch");
  result = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch-1", "apply_patch");
  result = v3WriteClaims(result.state, where);
  result = v2Pre(result.state, where, "turn-4", "npm test", "check-before-latest-change");
  result = v2Post(result.state, where, "turn-4", "npm test", "check-before-latest-change");
  result = v2Pre(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch-2", "apply_patch");
  result = v2Post(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "patch-2", "apply_patch");
  result = v3WriteClaims(result.state, where, v2TaskDirectory(where), "turn-4b");

  const staleState = result.state;
  const staleEnglish = v2Receipt(
    staleState,
    where,
    "turn-4b",
    "pmnm-guard verified result=passed how=command",
    "stale-command-en",
  );
  assert.equal(isDenied(staleEnglish), true);
  assert.equal(
    visibleText(staleEnglish),
    "Blocked: No successful check is recorded after the latest change.\n" +
      "NEXT: run the check that tests the change again, then pmnm-guard verified result=<passed|failed|partial|blocked> how=command",
  );

  const staleSpanish = v2Receipt(
    {...staleState, language: "es"},
    where,
    "turn-4b",
    "pmnm-guard verified result=passed how=command",
    "stale-command-es",
  );
  assert.equal(isDenied(staleSpanish), true);
  assert.equal(
    visibleText(staleSpanish),
    "Bloqueado: No hay una comprobación exitosa registrada después del último cambio.\n" +
      "NEXT: corre de nuevo la comprobación que prueba el cambio y luego pmnm-guard verified result=<passed|failed|partial|blocked> how=command",
  );
});

test("HG-221 byte-identical rewrites above two megabytes remain no-ops", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const target = path.join(where.cwd, "src", "large.bin");
  const content = Buffer.alloc(2_100_000, 0x61);
  fs.writeFileSync(target, content);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/large.bin — rewrite generated fixture\n").state;
  state = v3Agree(state, where);

  fs.writeFileSync(target, content);
  const changedTime = new Date(Date.now() + 5_000);
  fs.utimesSync(target, changedTime, changedTime);
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "large-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "large-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "large-verified");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard done audit=passed", "large-done");

  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /no changed target|ning[uú]n objetivo modificado/i);
});

test("HG-222 revised Digest cards put redo before investigation and plan writing", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  const outsidePlan = {
    file_path: path.join(where.cwd, "outside-plan.txt"),
    content: "new scope\n",
  };
  const result = v2Pre(agreed, where, "turn-4", "", "outside-plan", "Write", outsidePlan);
  const next = visibleText(result).split("NEXT:")[1] || "";

  assert.equal(isDenied(result), true);
  assert.match(next, /pmnm-guard redo/);
  assert.ok(next.indexOf("pmnm-guard redo") < next.indexOf("update"), next);
});

test("HG-223 provider snapshots retain the first direct identity of clean planned paths", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const a = path.join(where.cwd, "src", "a.js");
  const b = path.join(where.cwd, "src", "b.js");
  let dirty = [];
  where.guardOptions = {workspaceSnapshotProvider: () => dirty};

  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  fs.writeFileSync(a, "a=2\n");
  dirty = [{path: a, status: " M"}];

  state = v2Receipt(state, where, "turn-5", "pmnm-guard redo", "provider-redo").state;
  state = v3WritePlan(
    state,
    where,
    task,
    "turn-5",
    "- [x] src/a.js — change a\n- [x] src/b.js — change b\n",
  ).state;
  state = v3Agree(state, where, "turn-5", "turn-6");
  state = v3Write(state, where, "turn-6", b, "b=2\n", "provider-change-b").state;
  dirty = [{path: a, status: " M"}, {path: b, status: " M"}];
  state = v3WriteClaims(state, where, task, "turn-6").state;
  let result = v2Pre(state, where, "turn-6", "npm test", "provider-check");
  result = v2Post(result.state, where, "turn-6", "npm test", "provider-check");
  result = v2Receipt(result.state, where, "turn-6", "pmnm-guard verified result=passed how=command", "provider-verified");
  result.state = v3AcknowledgeTestDigest(result.state, where, "turn-6", "turn-7");
  result = v2Receipt(result.state, where, "turn-7", "pmnm-guard done audit=passed", "provider-done");

  assert.equal(isControlRecorded(result), true, visibleText(result));
});

test("HG-224 project setup separates reusable knowledge from human-owned rules", (t) => {
  const {where, state} = v2Configured(t);
  const project = path.join(where.notes, "projects", "example");
  const knowledge = path.join(project, "project-knowledge.md");

  assert.equal(fs.existsSync(knowledge), true);
  let template = fs.readFileSync(knowledge, "utf8");
  assert.match(template, /^# Project knowledge/m);
  for (const field of ["applies:", "current:", "basis:", "last checked:", "revisit when:", "source:"]) {
    assert.match(template, new RegExp(field.replace(" ", "\\s")));
  }
  assert.equal(state.rules_file_hashes_written.length, 0);

  fs.rmSync(knowledge);
  const upgraded = v3CreateTask(state, where);
  assert.equal(fs.existsSync(knowledge), true);
  template = fs.readFileSync(knowledge, "utf8");
  assert.match(template, /^# Project knowledge/m);
  assert.match(template, /basis: reported \| observed \| derived \| inferred \| assumed \| unknown/);
  assert.equal(upgraded.state.rules_file_hashes_written.length, 0);
});

test("HG-225 related suffixes for one bounded work id cannot silently open sibling tasks", (t) => {
  const {where, state} = v2Configured(t);
  const tasks = path.join(where.notes, "projects", "example", "tasks");
  fs.mkdirSync(path.join(tasks, "CASE-42"), {recursive: true});
  fs.mkdirSync(path.join(tasks, "CASE-420"), {recursive: true});

  const result = v2Receipt(
    state,
    where,
    "turn-3",
    "pmnm-guard start task=CASE-42-local-app effort=standard",
    "related-task-start",
  );
  const text = visibleText(result);
  assert.match(text, /Candidate task folders: CASE-42\./);
  assert.doesNotMatch(text, /CASE-420/);
  assert.match(text, /ask the human whether/);
});

test("HG-226 Standard and High Digests require an actionable verification plan", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3Write(
    created.state,
    where,
    "turn-3",
    path.join(created.task, "plan.md"),
    "- [ ] example.txt — implement the requested behavior\n",
    "plan-without-test-plan",
  ).state;

  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest-without-test-plan");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /verification plan|plan de verificaci[oó]n/i);

  const verificationPlan = [
    "# Verification",
    "",
    "## Plan",
    "- contract: requested behavior changes while the fallback remains",
    "- request-case: configured value reaches the visible result",
    "- preserved-case: default value retains its current result",
    "- entry: local interface at a repository-declared route",
    "- environment: local development environment",
    "- actor: authenticated user with the feature available",
    "- data: existing safe fixture with the required state",
    "- steps: 1. open the entry 2. perform the action 3. inspect the result",
    "- expect: configured and default values remain observably distinct",
    "- capability: inspected host interface tools and project test routes",
    "- evidence: retain the focused check output and visible result",
    "- cleanup: no persistent test mutation expected",
    "",
  ].join("\n");
  state = v3Write(
    state,
    where,
    "turn-3",
    path.join(created.task, "verification.md"),
    verificationPlan.replace("- data: existing safe fixture with the required state", "- data: unavailable"),
    "test-plan-bare-unavailable",
  ).state;
  result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest-bare-unavailable");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /verification plan|plan de verificaci[oó]n/i);

  state = v3Write(
    result.state,
    where,
    "turn-3",
    path.join(created.task, "verification.md"),
    verificationPlan + "- contract: contradictory duplicate\n",
    "test-plan-duplicate",
  ).state;
  result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest-duplicate-test-plan");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /verification plan|plan de verificaci[oó]n/i);

  state = v3Write(state, where, "turn-3", path.join(created.task, "verification.md"), verificationPlan, "test-plan").state;
  state = v3Write(state, where, "turn-3", path.join(created.task, "impact.md"), v3Impact(), "test-plan-impact").state;
  result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "digest-with-test-plan");
  assert.equal(isControlRecorded(result), true, visibleText(result));
});

test("HG-227 closure requires a current Test Digest shown in the assistant message", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "test-digest-change").state;
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "test-digest-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "test-digest-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "test-digest-verified");

  const hidden = v2Receipt(result.state, where, "turn-5", "pmnm-guard done audit=passed", "hidden-test-digest");
  assert.equal(isDenied(hidden), true);
  assert.match(visibleText(hidden), /Test Digest/);

  const message = [
    "Test — TASK-101",
    "Where: local interface at the repository-declared route",
    "Environment: local development",
    "As: authenticated user with the feature available",
    "Data: safe fixture with the required state",
    "Steps: 1. open the entry 2. perform the action 3. inspect the result",
    "Expect: the requested case changes and the fallback is preserved",
    "Evidence: retain the visible result",
    "Cleanup: no persistent mutation",
    "Can run: yes, with the available interface tool",
  ].join("\n");
  const wrongTask = message.replace("Test — TASK-101", "Test — TASK-202\nEvidence note: TASK-101");
  const mismatched = v2Process(hidden.state, where, "Stop", "turn-4", {last_assistant_message: wrongTask});
  assert.match(visibleText(mismatched), /Test Digest/);
  result = v2Process(hidden.state, where, "Stop", "turn-4", {last_assistant_message: message});
  assert.equal(result.output, null, visibleText(result));
  result = v2Prompt(result.state, where, "turn-5", "The handoff is clear; continue to the audit");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard done audit=passed", "visible-test-digest");
  assert.equal(isControlRecorded(result), true, visibleText(result));
});

test("HG-234 Test Digest fields are non-empty, contiguous, and ordered in English or Spanish", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "ordered-test-digest-change").state;
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "ordered-test-digest-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "ordered-test-digest-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "ordered-test-digest-verified");
  const armed = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "ordered-test-digest-audit");
  assert.equal(isDenied(armed), true);
  assert.match(visibleText(armed), /Test Digest/);

  const canonical = v3TestDigestMessage();
  const shuffled = canonical
    .replace(
      "Steps: 1. arrange 2. act 3. observe\nExpect: the requested case changes and preserved behavior remains",
      "Expect: the requested case changes and preserved behavior remains\nSteps: 1. arrange 2. act 3. observe",
    );
  const shuffledResult = v2Process(armed.state, where, "Stop", "turn-4", {last_assistant_message: shuffled});
  assert.match(visibleText(shuffledResult), /Test Digest/);

  const blankValue = canonical.replace("Data: deterministic safe fixture", "Data:\nDeterministic safe fixture");
  const blankResult = v2Process(armed.state, where, "Stop", "turn-4", {last_assistant_message: blankValue});
  assert.match(visibleText(blankResult), /Test Digest/);

  const spanish = [
    "Prueba — TASK-101",
    "Dónde: interfaz local declarada por el repositorio",
    "Entorno: entorno de prueba aislado",
    "Como: actor de prueba acotado",
    "Datos: fixture seguro y determinista",
    "Pasos: 1. preparar 2. actuar 3. observar",
    "Esperado: cambia el caso solicitado y se conserva el comportamiento existente",
    "Evidencia: conservar el resultado literal observado",
    "Limpieza: el arnés elimina el fixture temporal",
    "Se puede ejecutar: sí, con la comprobación ejecutable del fixture",
  ].join("\n");
  const accepted = v2Process(armed.state, where, "Stop", "turn-4", {last_assistant_message: spanish});
  assert.equal(accepted.output, null, visibleText(accepted));
});

test("HG-235 a rejected Test Digest card exposes the exact title and ordered one-line fields", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "test-digest-card-change").state;
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "test-digest-card-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "test-digest-card-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "test-digest-card-verified");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard done audit=passed", "test-digest-card-done");

  assert.equal(isDenied(result), true);
  const card = visibleText(result);
  assert.match(card, /Test — TASK-101/);
  assert.match(card, /non-empty value on each line|valor no vac[ií]o en cada l[ií]nea/i);
  assert.match(card, /Where.*Environment.*As.*Data.*Steps.*Expect.*Evidence.*Cleanup.*Can run/i);
});

test("HG-236 a state-only plan binds one exact operation and closes without a fictitious file", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const input = {operation: "set", resource: "fixture-record", field: "status", value: "approved"};
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [ ] state: approval-status — pending => approved\n" +
      "- [ ] unchanged-state: audit-history — original-entry\n",
  ).state;
  state = v3WritePermissions(state, where, task, "turn-3", v3StatePermission("approval-status", input)).state;
  state = v3Agree(state, where);
  state = v3RunStateTool(state, where, "turn-4", input);
  state = v3Write(
    state,
    where,
    "turn-4",
    path.join(task, "plan.md"),
    "- [x] state: approval-status — pending => approved\n" +
      "- [x] unchanged-state: audit-history — original-entry\n",
    "finish-state-plan",
  ).state;
  state = v3WriteStateClaims(state, where, task, "turn-4", [
    "- state: approval-status — pending => approved",
    "- unchanged-state: audit-history — original-entry",
  ]).state;
  let result = v2Pre(state, where, "turn-4", "npm test", "state-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "state-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "state-verified");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  state = v3AcknowledgeTestDigest(result.state, where);
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "state-done");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(result.state.phase, "COMPLETE");
  assert.match(visibleText(result), /state objective|objetivo de estado/i);

  const pending = v3Setup(t);
  state = v3WritePlan(pending.state, pending.where, pending.task, "turn-3", "- [ ] state: approval-status — pending => approved\n").state;
  state = v3WritePermissions(state, pending.where, pending.task, "turn-3", v3StatePermission("approval-status", input)).state;
  state = v3Agree(state, pending.where);
  state = v3RunStateTool(state, pending.where, "turn-4", input);
  state = v3WriteStateClaims(state, pending.where, pending.task, "turn-4", ["- state: approval-status — pending => approved"]).state;
  result = v3Verify(state, pending.where, pending.task, {writeClaims: false, handoff: false});
  result = v2Receipt(result.state, pending.where, "turn-5", "pmnm-guard done audit=passed", "unchecked-state-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /approval-status/);
});

test("HG-237 a mixed plan must satisfy both its file and state objectives", (t) => {
  const {where, task, state: initial} = v3Setup(t, {workspace: true});
  const input = {operation: "set", resource: "fixture-record", field: "status", value: "approved"};
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [x] src/a.js — change the file contract\n" +
      "- [ ] state: approval-status — pending => approved\n",
  ).state;
  state = v3WritePermissions(state, where, task, "turn-3", v3StatePermission("approval-status", input)).state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "mixed-file").state;
  state = v3RunStateTool(state, where, "turn-4", input, "mixed-state");
  state = v3Write(
    state,
    where,
    "turn-4",
    path.join(task, "plan.md"),
    "- [x] src/a.js — change the file contract\n" +
      "- [x] state: approval-status — pending => approved\n",
    "finish-mixed-plan",
  ).state;
  state = v3WriteStateClaims(state, where, task, "turn-4", [
    "- state: approval-status — pending => approved",
  ]).state;
  const verified = v3Verify(state, where, task, {writeClaims: false});
  assert.equal(isControlRecorded(verified), true, visibleText(verified));
  const done = v2Receipt(verified.state, where, "turn-5", "pmnm-guard done audit=passed", "mixed-done");
  assert.equal(isControlRecorded(done), true, visibleText(done));
});

test("HG-238 a state no-op cannot satisfy a planned transition", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const input = {operation: "set", resource: "fixture-record", field: "status", value: "approved"};
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] state: approval-status — pending => pending\n").state;
  state = v3WritePermissions(state, where, task, "turn-3", v3StatePermission("approval-status", input)).state;
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "noop-plan-digest");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /different|distinto|no-op/i);

  state = v3WritePlan(result.state, where, task, "turn-3", "- [ ] state: approval-status — pending => approved\n").state;
  state = v3Agree(state, where);
  state = v3RunStateTool(state, where, "turn-4", input, "noop-operation");
  state = v3Write(
    state,
    where,
    "turn-4",
    path.join(task, "plan.md"),
    "- [x] state: approval-status — pending => approved\n",
    "finish-noop-state-plan",
  ).state;
  state = v3WriteStateClaims(state, where, task, "turn-4", [
    "- state: approval-status — pending => pending",
  ]).state;
  result = v2Pre(state, where, "turn-4", "npm test", "noop-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "noop-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "noop-verified");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /state evidence|evidencia de estado|before|antes/i);

  state = v3WriteStateClaims(result.state, where, task, "turn-4", [
    "- state: approval-status — pending => approved",
  ]).state;
  result = v3Verify(state, where, task, {writeClaims: false});
  assert.equal(isControlRecorded(result), true, visibleText(result));
  state = v3WriteStateClaims(result.state, where, task, "turn-5", [
    "- state: approval-status — pending => denied",
  ]).state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "stale-state-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /state evidence|evidencia de estado/i);

  const uncertain = v3Setup(t);
  state = v3WritePlan(uncertain.state, uncertain.where, uncertain.task, "turn-3", "- [ ] state: approval-status — pending => approved\n").state;
  state = v3WritePermissions(state, uncertain.where, uncertain.task, "turn-3", v3StatePermission("approval-status", input)).state;
  state = v3Agree(state, uncertain.where);
  result = v2Pre(state, uncertain.where, "turn-4", "", "unknown-state", "StateTool", input);
  result = v2Receipt(result.state, uncertain.where, "turn-4", "pmnm-guard result outcome=unknown", "unknown-state-result");
  state = v3Write(
    result.state,
    uncertain.where,
    "turn-4",
    path.join(uncertain.task, "plan.md"),
    "- [x] state: approval-status — pending => approved\n",
    "finish-uncertain-state-plan",
  ).state;
  state = v3WriteStateClaims(state, uncertain.where, uncertain.task, "turn-4", [
    "- state: approval-status — pending => approved",
  ]).state;
  result = v3Verify(state, uncertain.where, uncertain.task, {writeClaims: false, handoff: false});
  result = v2Receipt(result.state, uncertain.where, "turn-5", "pmnm-guard done audit=passed", "unknown-state-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /state not observed|estado no observado/i);
});

test("HG-239 an unlisted or differently bound state operation cannot widen the agreed plan", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const planned = {operation: "set", resource: "fixture-record", field: "status", value: "approved"};
  const other = {...planned, field: "owner", value: "other"};
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] state: approval-status — pending => approved\n").state;
  state = v3WritePermissions(state, where, task, "turn-3", v3StatePermission("other-status", planned)).state;
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "wrong-objective-digest");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /objective|objetivo/i);

  state = v3WritePermissions(result.state, where, task, "turn-3", v3StatePermission("approval-status", planned)).state;
  state = v3Agree(state, where);
  result = v2Pre(state, where, "turn-4", "", "unlisted-state", "StateTool", other);
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /declare|declar/i);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard classify effect=state-change", "classify-unlisted-state");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  result = v2Pre(result.state, where, "turn-4", "", "unlisted-state-retry", "StateTool", other);
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /redo.*permissions\.json|permissions\.json.*redo/i);
});

test("HG-240 state-only closure reports its evidence boundary without inventing version control", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const input = {operation: "set", resource: "fixture-record", field: "status", value: "approved"};
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] state: approval-status — pending => approved\n").state;
  state = v3WritePermissions(state, where, task, "turn-3", v3StatePermission("approval-status", input)).state;
  state = v3Agree(state, where);
  state = v3RunStateTool(state, where, "turn-4", input, "no-vcs-state");
  state = v3Write(
    state,
    where,
    "turn-4",
    path.join(task, "plan.md"),
    "- [x] state: approval-status — pending => approved\n",
    "finish-no-vcs-state-plan",
  ).state;
  state = v3WriteStateClaims(state, where, task, "turn-4", ["- state: approval-status — pending => approved"]).state;
  let result = v2Pre(state, where, "turn-4", "npm test", "no-vcs-state-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "no-vcs-state-check");
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard verified result=passed how=command",
    "no-vcs-state-verified",
    {fingerprintProvider: () => null},
  );
  state = v3AcknowledgeTestDigest(result.state, where);
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "no-vcs-state-done");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /no project-file comparison|sin comparación de archivos/i);
  assert.match(visibleText(result), /state objectives: 1|objetivos de estado: 1/i);
  assert.doesNotMatch(visibleText(result), /Git|version-control state/i);
});

test("HG-241 state objective grammar and exact generic operation identity fail closed", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const input = {operation: "set", resource: "fixture-record", field: "status", value: "approved"};
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [ ] state: approval status — pending => approved\n" +
      "- [ ] state: approval-status — pending => approved\n",
  ).state;
  state = v3WritePermissions(state, where, task, "turn-3", v3StatePermission("approval-status", input)).state;
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "malformed-state-digest");
  assert.equal(isDenied(result), true);

  state = v3WritePlan(result.state, where, task, "turn-3", "- [ ] state: approval-status — pending => approved\n").state;
  state = v3Agree(state, where);
  const reordered = {value: "approved", field: "status", resource: "fixture-record", operation: "set"};
  result = v2Pre(state, where, "turn-4", "", "canonical-state", "StateTool", reordered);
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-4", "", "canonical-state", "StateTool", "ok", reordered);
  assert.equal(result.state.observed_state_hashes.length, 1);
  state = v3WritePlan(result.state, where, task, "turn-4", "- [ ] state: approval-status — approved => denied\n").state;
  result = v2Receipt(state, where, "turn-4", "pmnm-guard digest", "revised-state-digest");
  state = v2Prompt(result.state, where, "turn-5", "Agreed to the revised state contract").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard agreed", "revised-state-agreed");
  state = v3Write(
    result.state,
    where,
    "turn-5",
    path.join(task, "plan.md"),
    "- [x] state: approval-status — approved => denied\n",
    "finish-revised-state-plan",
  ).state;
  state = v3WriteStateClaims(state, where, task, "turn-5", ["- state: approval-status — approved => denied"]).state;
  result = v2Pre(state, where, "turn-5", "npm test", "revised-state-check");
  result = v2Post(result.state, where, "turn-5", "npm test", "revised-state-check");
  result = v2Receipt(result.state, where, "turn-5", "pmnm-guard verified result=passed how=command", "revised-state-verified");
  result = v2Receipt(result.state, where, "turn-6", "pmnm-guard done audit=passed", "revised-state-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /state not observed|estado no observado/i);

  const specific = v3Setup(t);
  const command = "curl https://example.invalid/state";
  state = v3WritePlan(specific.state, specific.where, specific.task, "turn-3", "- [ ] state: remote-status — pending => approved\n").state;
  state = v3WritePermissions(state, specific.where, specific.task, "turn-3", {
    task: [{effect: "network", tool: "Bash", input: {command}, objective: "remote-status", reason: "exercise a specific classified effect"}],
  }).state;
  state = v3Agree(state, specific.where);
  result = v2Pre(state, specific.where, "turn-4", command, "specific-state-effect");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, specific.where, "turn-4", command, "specific-state-effect");
  assert.equal(result.state.observed_state_hashes.length, 1);
});

test("HG-228 one agreed forecast activates several exact task permissions without repeated questions", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — exercise the permission forecast\n").state;
  state = v3WritePermissions(state, where, task, "turn-3", {
    task: [
      {effect: "environment", tool: "Bash", input: {command: "codex plugin marketplace add ./fixture"}, reason: "validate local installation"},
      {effect: "network", tool: "Bash", input: {command: "curl https://example.invalid/health"}, reason: "check the declared endpoint"},
    ],
  }).state;
  state = v3Agree(state, where);

  let result = v2Pre(state, where, "turn-4", "codex plugin marketplace add ./fixture", "forecast-environment");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-4", "codex plugin marketplace add ./fixture", "forecast-environment");
  result = v2Pre(result.state, where, "turn-4", "codex plugin marketplace add ./fixture", "forecast-environment-again");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-4", "codex plugin marketplace add ./fixture", "forecast-environment-again");
  result = v2Pre(result.state, where, "turn-4", "curl https://example.invalid/health", "forecast-network");
  assert.equal(isDenied(result), false, visibleText(result));
});

test("HG-229 a forecast never authorizes a changed or unlisted operation", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — exercise exact permission identity\n").state;
  state = v3WritePermissions(state, where, task, "turn-3", {
    task: [{effect: "network", tool: "Bash", input: {command: "curl https://example.invalid/a"}, reason: "query fixture A"}],
  }).state;
  state = v3Agree(state, where);
  const result = v2Pre(state, where, "turn-4", "curl https://example.invalid/b", "unlisted-network");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /ask the human|pregunta al humano/i);
});

test("HG-230 task permissions expire at task transition while project permissions survive", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const taskCommand = "curl https://example.invalid/task";
  const projectCommand = "codex plugin marketplace add ./fixture";
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — exercise permission scope\n").state;
  state = v3WritePermissions(state, where, task, "turn-3", {
    task: [{effect: "network", tool: "Bash", input: {command: taskCommand}, reason: "task-only fixture"}],
    project: [{effect: "environment", tool: "Bash", input: {command: projectCommand}, reason: "reusable project installation check"}],
  }).state;
  state = v3Agree(state, where);
  state = v2Receipt(state, where, "turn-4", "pmnm-guard start task=TASK-202 effort=standard", "switch-after-forecast").state;
  fs.mkdirSync(v2TaskDirectory(where, "TASK-202"), {recursive: true});

  let result = v2Pre(state, where, "turn-5", projectCommand, "project-permission");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-5", projectCommand, "project-permission");
  result = v2Pre(result.state, where, "turn-5", taskCommand, "expired-task-permission");
  assert.equal(isDenied(result), true);
});

test("HG-231 an explicit empty project forecast revokes earlier project permissions", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const command = "codex plugin marketplace add ./fixture";
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — establish a project permission\n").state;
  state = v3WritePermissions(state, where, task, "turn-3", {
    project: [{effect: "environment", tool: "Bash", input: {command}, reason: "project installation check"}],
  }).state;
  state = v3Agree(state, where);
  state = v2Receipt(state, where, "turn-4", "pmnm-guard redo", "revoke-redo").state;
  state = v3WritePlan(state, where, task, "turn-4", "- [ ] src/a.js — revoke the project permission\n").state;
  state = v3WritePermissions(state, where, task, "turn-4", {project: []}).state;
  state = v3Agree(state, where, "turn-4", "turn-5");
  const result = v2Pre(state, where, "turn-5", command, "revoked-project-permission");
  assert.equal(isDenied(result), true);
});

test("HG-232 permission forecasts fail closed on secrets, malformed entries, and post-Digest changes", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — exercise forecast validation\n").state;
  fs.writeFileSync(path.join(task, "permissions.json"), JSON.stringify({
    schema: "pmnm.permissions/v1",
    task: [{effect: "network", tool: "Bash", input: {command: "curl -H 'Authorization: Bearer sk-proj-1234567890abcdefghijklmnopqrstuvwxyz' https://example.invalid"}, reason: "unsafe fixture"}],
  }));
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "secret-forecast");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /secret/i);

  state = v3WritePermissions(result.state, where, task, "turn-3", {
    task: [{effect: "network", tool: "Bash", input: {command: "curl https://example.invalid/a"}, reason: "safe fixture"}],
  }).state;
  result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "safe-forecast");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  state = v3WritePermissions(result.state, where, task, "turn-3", {
    task: [{effect: "network", tool: "Bash", input: {command: "curl https://example.invalid/b"}, reason: "changed fixture"}],
  }).state;
  state = v2Prompt(state, where, "turn-4", "Agreed to the Digest that was shown").state;
  result = v2Receipt(state, where, "turn-4", "pmnm-guard agreed", "changed-forecast-agree");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /permission|permiso/i);
});

test("HG-233 bound verification and permission contracts cannot drift after agreement", (t) => {
  {
    const {where, task, state: initial} = v3Setup(t);
    let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — exercise bound verification\n").state;
    state = v3Agree(state, where);
    const target = path.join(task, "verification.md");
    const changed = fs.readFileSync(target, "utf8").replace(
      "- entry: repository-declared executable surface",
      "- entry: a different executable surface",
    );
    state = v3Write(state, where, "turn-4", target, changed, "changed-verification-contract").state;
    const result = v2Pre(
      state,
      where,
      "turn-4",
      "",
      "write-after-verification-drift",
      "Write",
      {file_path: path.join(where.cwd, "src", "a.js"), content: "a=2\n"},
    );
    assert.equal(isDenied(result), true);
    assert.match(visibleText(result), /verification plan changed|plan de verificaci[oó]n cambi[oó]/i);
    assert.match(visibleText(result), /pmnm-guard redo/);
  }

  {
    const {where, task, state: initial} = v3Setup(t);
    const command = "curl https://example.invalid/original";
    let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — exercise bound permissions\n").state;
    state = v3WritePermissions(state, where, task, "turn-3", {
      task: [{effect: "network", tool: "Bash", input: {command}, reason: "query the original fixture"}],
    }).state;
    state = v3Agree(state, where);
    state = v3WritePermissions(state, where, task, "turn-4", {task: []}).state;
    const result = v2Pre(state, where, "turn-4", command, "forecast-after-manifest-drift");
    assert.equal(isDenied(result), true);
    assert.match(visibleText(result), /permission forecast changed|pron[oó]stico de permisos cambi[oó]/i);
    assert.match(visibleText(result), /pmnm-guard redo/);
  }
});

test("HG-242 switching unfinished tasks takes one bounded human reconciliation and isolates the successor", (t) => {
  const {where, task, state: initial} = v3Setup(t, {workspace: true});
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change the active task\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "unfinished-a").state;

  let result = v2Receipt(state, where, "turn-4", "pmnm-guard start task=TASK-202 effort=standard", "ask-switch");
  assert.equal(isDenied(result), true);
  assert.equal(result.state.task_id, "TASK-101");
  assert.equal(result.state.pending_question?.kind, "task-transition");
  assert.match(visibleText(result), /pause.*TASK-101.*TASK-202|paus.*TASK-101.*TASK-202/i);

  state = v2Prompt(result.state, where, "turn-5", "Pause TASK-101 and switch to TASK-202").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard start task=TASK-202 effort=standard", "confirm-switch");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(result.state.task_id, "TASK-202");
  assert.equal(result.state.mutation_count, 0);
  assert.equal(result.state.digest_agreed_epoch, null);
  assert.equal(result.state.pending_question?.kind === "task-transition", false);
});

test("HG-243 Digest preflight reports every task-metadata problem in one durable report", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const outside = path.join(where.root, "outside-helper.mjs");
  let state = v3Write(
    initial,
    where,
    "turn-3",
    path.join(task, "plan.md"),
    "- [ ] " + outside + " — external helper\n" +
      "- [ ] src/ — directory target\n" +
      "- [ ] src/a.js — first objective\n" +
      "- [ ] src/a.js — duplicate objective\n",
    "invalid-plan",
  ).state;
  state = v3Write(
    state,
    where,
    "turn-3",
    path.join(task, "verification.md"),
    "# Verification\n\n## Plan\n- contract: one\n- contract: two\n- entry: local\n",
    "invalid-verification",
  ).state;
  state = v3WritePermissions(state, where, task, "turn-3", {
    task: [{effect: "verification", tool: "Bash", input: {command: "npm test"}, reason: "not a sensitive permission"}],
  }).state;

  const result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "aggregate-preflight");
  assert.equal(isDenied(result), true);
  const reportPath = path.join(task, "preflight.md");
  assert.equal(fs.existsSync(reportPath), true, visibleText(result));
  const report = fs.readFileSync(reportPath, "utf8");
  assert.match(report, /plan\.md:[0-9]+/);
  assert.match(report, /verification\.md:[0-9]+/);
  assert.match(report, /permissions\.json/);
  assert.match(report, /outside-helper|non-local/i);
  assert.match(report, /directory/i);
  assert.match(report, /duplicate/i);
  assert.match(report, /verification.*not.*permission|unsupported.*verification/i);
  assert.match(visibleText(result), /preflight\.md/);
});

test("HG-244 adding a clean excluded path to a revised plan does not invent a workspace change", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let changed = [];
  where.guardOptions = {workspaceSnapshotProvider: () => changed};
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v2Receipt(state, where, "turn-5", "pmnm-guard redo", "redo-clean-exclusion").state;
  state = v3WritePlan(
    state,
    where,
    task,
    "turn-5",
    "- [ ] src/a.js — change a\n- [ ] excluded: src/b.js — preserve b\n",
  ).state;
  const result = v2Receipt(state, where, "turn-5", "pmnm-guard digest", "digest-clean-exclusion");
  assert.equal(isControlRecorded(result), true, visibleText(result));

  const dirtySetup = v3Setup(t);
  let dirtyEntries = [];
  dirtySetup.where.guardOptions = {workspaceSnapshotProvider: () => dirtyEntries};
  let dirtyState = v3WritePlan(
    dirtySetup.state,
    dirtySetup.where,
    dirtySetup.task,
    "turn-3",
    "- [ ] src/a.js — change a\n",
  ).state;
  dirtyState = v3Agree(dirtyState, dirtySetup.where);
  dirtyEntries = [{path: path.join(dirtySetup.where.cwd, "src", "b.js"), status: " M"}];
  dirtyState = v2Receipt(dirtyState, dirtySetup.where, "turn-5", "pmnm-guard redo", "redo-dirty-exclusion").state;
  dirtyState = v3WritePlan(
    dirtyState,
    dirtySetup.where,
    dirtySetup.task,
    "turn-6",
    "- [ ] src/a.js — change a\n- [ ] excluded: src/b.js — preserve b\n",
  ).state;
  const dirty = v2Receipt(dirtyState, dirtySetup.where, "turn-6", "pmnm-guard digest", "digest-dirty-exclusion");
  assert.equal(isDenied(dirty), true);
  assert.match(visibleText(dirty), /excluded.*src\/b\.js/i);
});

test("HG-245 a repeated unchanged Digest after the human response preserves that response", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const plan = "- [ ] src/a.js — change a\n";
  let state = v3WritePlan(initial, where, task, "turn-3", plan).state;
  state = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "first-digest").state;
  state = v2Prompt(state, where, "turn-4", "I agree exactly as shown").state;

  let result = v2Receipt(state, where, "turn-4", "pmnm-guard digest", "repeated-digest");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.notEqual(result.state.human_response_epoch, null);
  assert.match(visibleText(result), /pmnm-guard agreed/);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard agreed", "agree-after-repeat");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(result.state.phase, "READY");
});

test("HG-246 a state already complete at Digest time needs current evidence but no future operation", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [x] state: historical-status — pending => approved\n",
  ).state;
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "historical-digest");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  state = v2Prompt(result.state, where, "turn-4", "Agreed exactly as shown").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard agreed", "historical-agreed").state;
  state = v3WriteStateClaims(state, where, task, "turn-4", [
    "- state: historical-status — pending => approved",
  ]).state;
  result = v2Pre(state, where, "turn-4", "npm test", "historical-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "historical-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "historical-verified");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  state = v3AcknowledgeTestDigest(result.state, where);
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "historical-done");
  assert.equal(isControlRecorded(result), true, visibleText(result));
});

test("HG-247 container exec preserves inner hard stops without positively trusting reads or checks", () => {
  assert.equal(classifyShell("docker exec app cat /etc/hosts").kind, "unknown");
  assert.equal(classifyShell("podman exec app rm /tmp/stale").effect, "deletion");
  assert.equal(classifyShell("docker compose exec app npm test").kind, "unknown");
  const unknown = classifyShell("docker exec -u 1000 app custom-query --readonly");
  assert.equal(unknown.kind, "unknown");
  assert.notEqual(unknown.effect, "environment");
  assert.equal(classifyShell("docker run image cat /etc/hosts").effect, "environment");
});

test("HG-248 a failed node check cannot become a project mutation or successful verification", (t) => {
  const {where, state: agreed} = v3AgreedFor(t, "- [ ] src/a.js — preserve the planned source\n");
  const command = "node --check permissions.json";
  let result = v2Pre(agreed, where, "turn-4", command, "failed-node-check");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(
    result.state,
    where,
    "turn-4",
    command,
    "failed-node-check",
    "Bash",
    {exit_code: 1, stderr: "SyntaxError", stdout: ""},
  );
  assert.equal(result.state.mutation_count, 0);
  assert.equal(result.state.effect_count, 0);
  assert.equal(result.state.last_check, null);
});

test("HG-249 a safe absolute plan path canonicalizes without changing authority", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  const absolute = path.join(where.cwd, "src", "a.js");
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] " + absolute + " — change a\n").state;
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "absolute-digest");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  const preflight = fs.readFileSync(path.join(task, "preflight.md"), "utf8");
  assert.match(preflight, /Safe canonicalization/);
  assert.match(preflight, /src\/a\.js/);

  state = v2Prompt(result.state, where, "turn-4", "Proceed with this plan").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard agreed", "absolute-agreed").state;
  state = v3Write(
    state,
    where,
    "turn-4",
    path.join(task, "plan.md"),
    "- [ ] src/a.js — change a\n",
    "canonical-plan-representation",
  ).state;
  result = v2Pre(
    state,
    where,
    "turn-4",
    "",
    "write-after-canonicalization",
    "Write",
    {file_path: absolute, content: "a=2\n"},
  );
  assert.equal(isDenied(result), false, visibleText(result));
});

test("HG-250 clear natural-language approval authorizes only the exact sensitive operation", (t) => {
  const {where, state: agreed} = v3AgreedFor(t, "- [x] obsolete.txt — remove obsolete output\n");
  const command = "rm obsolete.txt";
  let result = v2Pre(agreed, where, "turn-4", command, "ask-procede");
  assert.equal(isDenied(result), true);
  assert.doesNotMatch(visibleText(result), /yes or no|sí o no/i);
  let state = v2Prompt(result.state, where, "turn-5", "Procede con la operación descrita").state;
  state = v2Receipt(state, where, "turn-5", "pmnm-guard allow effect=deletion", "allow-procede").state;
  result = v2Pre(state, where, "turn-5", command, "exact-after-procede");
  assert.equal(isDenied(result), false, visibleText(result));

  const changed = v3AgreedFor(t, "- [x] obsolete.txt — remove obsolete output\n");
  result = v2Pre(changed.state, changed.where, "turn-4", command, "ask-changed-range");
  state = v2Prompt(result.state, changed.where, "turn-5", "Apruebo esa operación").state;
  state = v2Receipt(state, changed.where, "turn-5", "pmnm-guard allow effect=deletion", "allow-original").state;
  result = v2Pre(state, changed.where, "turn-5", "rm other.txt", "changed-after-approval");
  assert.equal(isDenied(result), true);
});

test("HG-251 an investigation check cannot become final verification while plan objectives remain open", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — implement the requested behavior\n").state;
  state = v3Agree(state, where);
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "node --check src/a.js", "administrative-check");
  result = v2Post(result.state, where, "turn-4", "node --check src/a.js", "administrative-check", "Bash", {exit_code: 0});
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "premature-verified");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /open plan objectives|objetivos abiertos/i);
  assert.equal(result.state.last_verification, null);
  assert.equal(result.state.test_digest_epoch, null);
});

test("HG-252 ordinary commands use one dynamic route without a positive executable catalog", () => {
  for (const command of [
    "rg pattern src",
    "git show HEAD:file",
    "docker ps",
    "command -v mongo",
    "new-tool inspect --format=json",
  ]) {
    const result = classifyShell(command);
    assert.equal(result.kind, "unknown", command);
    assert.equal(result.reason, "dynamic-declaration-required", command);
  }
  assert.equal(classifyShell("rm obsolete.txt").effect, "deletion");
  assert.equal(classifyShell("git commit -m change").effect, "git");
  assert.equal(classifyShell("docker restart app").effect, "environment");
});

test("HG-253 a dynamic declaration is observable, exact and explicit about its boundary", (t) => {
  const {where, state: configured} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const command = "docker ps";
  let result = v2Pre(configured, where, "turn-3", command, "dynamic-first");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /pmnm-guard declare/);
  assert.match(visibleText(result), /shell tool|herramienta shell/i);

  result = v2Receipt(
    result.state,
    where,
    "turn-3",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=none",
    "declare-dynamic",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /^Ask: /m);
  assert.match(visibleText(result), /allow effect=environment/);

  let state = v2Prompt(result.state, where, "turn-4", "Allow this exact local runtime inspection").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard allow effect=environment", "allow-runtime-read").state;
  result = v2Pre(state, where, "turn-4", command, "dynamic-retry");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Pre(result.state, where, "turn-4", "docker ps --all", "dynamic-different");
  assert.equal(isDenied(result), true);
});

test("HG-254 a declaration cannot downgrade a mechanical write or hidden command", (t) => {
  const {where, state: configured} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const redirected = "new-tool inspect > output.txt";
  let result = v2Pre(configured, where, "turn-3", redirected, "redirect-first");
  assert.equal(isDenied(result), true);
  result = v2Receipt(
    result.state,
    where,
    "turn-3",
    "pmnm-guard declare effect=investigation boundary=project persistence=none certainty=certain capability=none",
    "false-read",
  );
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /contradict|write|redirection|contradice|escritura|redirecci/i);

  result = v2Pre(configured, where, "turn-3", "TOOL=reader $TOOL src", "hidden-first");
  assert.equal(isDenied(result), true);
  assert.doesNotMatch(visibleText(result), /automatic|autom[aá]tic/i);
});

test("HG-255 a human-approved project capability is reusable, bounded and revocable", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] state: runtime-read-capability — absent => approved\n",
  ).state;
  state = v3WritePermissions(state, where, created.task, "turn-3", {
    project: [{
      capability: "local-runtime-read",
      effect: "investigation",
      boundary: "local-environment",
      persistence: "none",
      shape: "read-current-runtime-state",
      constraints: "literal arguments, no writes, no external network and no hidden shell",
      reason: "reuse bounded read-only local runtime inspection across tasks",
    }],
  }).state;
  state = v3Agree(state, where);

  for (const [index, command] of ["runtime-query status=active", "runtime-query status=idle"].entries()) {
    let result = v2Pre(state, where, "turn-4", command, "cap-first-" + index);
    assert.equal(isDenied(result), true);
    result = v2Receipt(
      result.state,
      where,
      "turn-4",
      "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=local-runtime-read",
      "cap-declare-" + index,
    );
    assert.equal(isControlRecorded(result), true, visibleText(result));
    assert.doesNotMatch(visibleText(result), /^Ask: /m);
    result = v2Pre(result.state, where, "turn-4", command, "cap-retry-" + index);
    assert.equal(isDenied(result), false, visibleText(result));
    state = result.state;
  }

  state = v2Receipt(state, where, "turn-5", "pmnm-guard redo", "revoke-redo").state;
  state = v3WritePermissions(state, where, created.task, "turn-5", {project: []}).state;
  state = v3WritePlan(
    state,
    where,
    created.task,
    "turn-5",
    "- [x] state: runtime-read-capability — approved => revoked\n",
  ).state;
  state = v3Agree(state, where, "turn-5", "turn-6");
  let result = v2Pre(state, where, "turn-6", "runtime-query status=active", "revoked-first");
  result = v2Receipt(
    result.state,
    where,
    "turn-6",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=local-runtime-read",
    "revoked-declare",
  );
  assert.match(visibleText(result), /^Ask: /m);
});

test("HG-256 a capability declaration never creates its own authority", (t) => {
  const {where, state: configured} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const command = "runtime-query status=active";
  let result = v2Pre(configured, where, "turn-3", command, "self-authority-first");
  result = v2Receipt(
    result.state,
    where,
    "turn-3",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=local-runtime-read",
    "self-authority-declare",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /^Ask: /m);
  assert.equal(result.state.project_capabilities?.length || 0, 0);
});

test("HG-257 High completion requires a current semantic adjudication packet without inheriting its verdict", (t) => {
  const seed = v2Configured(t);
  const high = v2Receipt(seed.state, seed.where, "turn-3", "pmnm-guard start task=TASK-101 effort=high", "high-start").state;
  const highTask = v3CreateTask(high, seed.where).task;
  const seededReview = fs.readFileSync(path.join(highTask, "review.md"), "utf8");
  for (const field of ["impact-roots", "impact-omission-check", "non-functional-dispositions"]) {
    assert.match(seededReview, new RegExp("- " + field + ":"));
  }

  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(created.state, where, created.task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "high-write").state;
  state = v3WritePlan(state, where, created.task, "turn-4", "- [x] src/a.js — change a\n").state;
  state = v3WriteClaims(state, where, created.task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "high-check");
  if (isDenied(result)) {
    result = v2Receipt(
      result.state,
      where,
      "turn-4",
      "pmnm-guard declare effect=verification boundary=project persistence=none certainty=certain capability=none",
      "high-check-declare",
    );
    result = v2Pre(result.state, where, "turn-4", "npm test", "high-check");
  }
  result = v2Post(result.state, where, "turn-4", "npm test", "high-check", "Bash", "passed");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "high-verified");
  state = v3AcknowledgeTestDigest(result.state, where);
  state.effort = "high";
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "high-done-no-review");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /review\.md|counterexample|contraejemplo/i);

  const review = ({
    planDigest = result.state.plan_file_hash,
    fingerprint = result.state.last_verification.fingerprint.hash,
    evidence = "focused check passed after the change",
    counterexample = "identity transform would also pass a non-discriminating assertion",
    independentCheck = "inspected a negative branch not used by the author",
    disagreement = "none",
  } = {}) => [
    "# Independent review",
    "- contract: requested behavior changes while preserved behavior remains",
    "- plan-digest: " + planDigest,
    "- fingerprint: " + fingerprint,
    "- changed-surface: src/a.js",
    "- evidence: " + evidence,
    "- strongest-counterexample: " + counterexample,
    "- independent-check: " + independentCheck,
    "- disagreement: " + disagreement,
    "- residual-limit: synthetic fixture does not prove production wiring",
    "- impact-roots: challenged the request root against the final changed surface",
    "- impact-omission-check: inspected one branch outside the author's plan",
    "- non-functional-dispositions: checked all six dimensions and their evidence",
    "",
  ].join("\n");

  state = v3Write(result.state, where, "turn-5", path.join(created.task, "review.md"), review({planDigest: "0".repeat(64)}), "high-review-stale").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "high-done-stale-review");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /stale|obsoleto/i);

  state = v3Write(result.state, where, "turn-5", path.join(created.task, "review.md"), review({
    disagreement: "unresolved — the check also passes an identity transform",
  }), "high-review-disagreement").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "high-done-disagreement");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /disagreement|desacuerdo/i);

  state = v3Write(result.state, where, "turn-5", path.join(created.task, "review.md"), review({
    independentCheck: "focused check passed after the change",
  }), "high-review-duplicate-check").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "high-done-duplicate-check");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /repeats|repite/i);

  state = v3Write(result.state, where, "turn-5", path.join(created.task, "review.md"), review({
    disagreement: "none — unresolved: the reviewer says the omission remains",
  }), "high-review-contradictory-none").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "high-done-contradictory-none");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /disagreement|desacuerdo/i);

  for (const [field, value] of [
    ["impact-roots", "none"],
    ["impact-omission-check", "<check>"],
    ["non-functional-dispositions", "unknown"],
    ["impact-roots", "none."],
    ["impact-omission-check", "unknown."],
    ["non-functional-dispositions", "N/A."],
  ]) {
    const invalid = review().replace(new RegExp("^- " + field + ":.*$", "m"), "- " + field + ": " + value);
    state = v3Write(result.state, where, "turn-5", path.join(created.task, "review.md"), invalid, "high-review-invalid-" + field).state;
    result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "high-done-invalid-" + field);
    assert.equal(isDenied(result), true, field);
    assert.match(visibleText(result), new RegExp(field));
  }

  state = v3Write(result.state, where, "turn-5", path.join(created.task, "review.md"), review(), "high-review").state;
  result = v2Receipt(state, where, "turn-5", "pmnm-guard done audit=passed", "high-done-reviewed");
  assert.equal(isControlRecorded(result), true, visibleText(result));
});

test("HG-258 task capabilities expire and uncertain or mismatched declarations cannot borrow authority", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] state: task-read-capability — absent => approved\n",
  ).state;
  state = v3WritePermissions(state, where, created.task, "turn-3", {
    task: [{
      capability: "task-local-read",
      effect: "investigation",
      boundary: "local-environment",
      persistence: "none",
      shape: "read bounded local runtime state",
      constraints: "literal command, no writes, no hidden shell and no external network",
      reason: "exercise task-scoped capability expiry",
    }],
  }).state;
  state = v3Agree(state, where);

  let result = v2Pre(state, where, "turn-4", "runtime-query status=active", "task-cap-first");
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=uncertain capability=task-local-read",
    "task-cap-uncertain",
  );
  assert.match(visibleText(result), /^Ask: /m);

  state = v2Receipt(state, where, "turn-5", "pmnm-guard start task=TASK-202 effort=standard", "switch-task-capability").state;
  fs.mkdirSync(v2TaskDirectory(where, "TASK-202"), {recursive: true});
  result = v2Pre(state, where, "turn-5", "runtime-query status=active", "expired-task-cap-first");
  result = v2Receipt(
    result.state,
    where,
    "turn-5",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=task-local-read",
    "expired-task-cap-declare",
  );
  assert.match(visibleText(result), /^Ask: /m);
  assert.equal(result.state.task_capabilities.length, 0);
});

test("HG-259 persisted dynamic retry authority is structurally bounded", () => {
  const state = testing.baseState();
  state.declared_retry = {
    effect: "investigation",
    boundary: "project",
    persistence: "none",
    certainty: "certain",
    capability: "none",
    command_hash: "a".repeat(64),
    task_hash: "b".repeat(64),
    epoch: 1,
    uses: 2,
    required_effect: null,
    capability_scope: null,
  };
  assert.throws(() => testing.validateState(state), /bad declared retry/);
});

test("HG-260 a transient mixed-boundary read declaration does not invent a state change", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const command = "runtime-read fixture-state";
  let result = v2RawPre(created.state, where, "turn-4", command, "mixed-read");
  assert.equal(isDenied(result), true);
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=mixed persistence=none certainty=certain capability=none",
    "mixed-read-declare",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.doesNotMatch(visibleText(result), /allow effect=state-change/);
  result = v2RawPre(result.state, where, "turn-4", command, "mixed-read");
  assert.equal(isDenied(result), false, visibleText(result));
});

test("HG-261 final verification does not request the Test Digest before the final audit", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "audit-order-change").state;
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "audit-order-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "audit-order-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "audit-order-verified");
  assert.doesNotMatch(visibleText(result), /show.*Test Digest/i);
  const prematureStop = v2Process(result.state, where, "Stop", "turn-4", {last_assistant_message: "Verification passed."});
  assert.equal(prematureStop.output, null, visibleText(prematureStop));
  result = v2Receipt(prematureStop.state, where, "turn-4", "pmnm-guard done audit=passed", "audit-order-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /Test Digest/);
});

test("HG-262 compact and resume reload the exact durable rule basis before material work", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] example.txt — change a\n").state;
  state = v3Agree(state, where);
  let result = v2Process(state, where, "SessionStart", "turn-4", {source: "compact"});
  assert.match(visibleText(result), /general-rules\.md/);
  assert.match(visibleText(result), /project-rules\.md/);
  assert.match(visibleText(result), /plan\.md/);
  result = v2Pre(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "before-reload", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /not been reloaded|no se han recargado/i);
  const command = "sed -n '1,240p' " + result.state.rule_basis_paths.map((target) => JSON.stringify(target)).join(" ");
  result = v2Pre(result.state, where, "turn-4", command, "reload-rules");
  assert.equal(isDenied(result), true);
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=pmnm persistence=none certainty=certain capability=none",
    "reload-rules-declare",
  );
  result = v2Pre(result.state, where, "turn-4", command, "reload-rules");
  assert.equal(isDenied(result), false, visibleText(result));
  const returnedRules = result.state.rule_basis_paths.map((target) => fs.readFileSync(target, "utf8")).join("\n");
  result = v2Post(result.state, where, "turn-4", command, "reload-rules", "Bash", returnedRules);
  assert.equal(result.state.rule_basis_required, false);
  result = v2Pre(result.state, where, "turn-4", IMPLEMENTATION_PATCH, "after-reload", "apply_patch");
  assert.equal(isDenied(result), false, visibleText(result));
});

test("HG-263 environment authority requires one complete generic operational preflight", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] state: local-service — absent => healthy\n").state;
  state = v3Write(
    state,
    where,
    "turn-3",
    path.join(task, "permissions.json"),
    JSON.stringify({schema: "pmnm.permissions/v1", task: [{
      effect: "environment", tool: "Bash", input: {command: "docker restart fixture"}, objective: "local-service", reason: "start the missing fixture service",
    }]}, null, 2) + "\n",
    "environment-permission",
  ).state;
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "environment-missing-preflight");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /operational environment preflight|preflight operativo/i);
});

test("HG-264 concurrent sessions on the same task must reload a newer durable revision before writing", (t) => {
  const {where, state: configured} = v2Configured(t);
  v3CreateTask(configured, where);
  const options = {dataRoot: where.dataRoot, environment: {CODEX_HOME: where.codexHome, PLUGIN_DATA: where.dataRoot}, now: 100};
  const send = (session, event) => processPersistedEvent({...event, session_id: session}, options);
  for (const session of ["session-a", "session-b"]) {
    send(session, v2Event(where, "UserPromptSubmit", "turn-1", {prompt: "Resume TASK-101"}));
    send(session, v2Event(where, "PreToolUse", "turn-1", {
      tool_name: "Bash", tool_use_id: "start-" + session, tool_input: {command: "pmnm-guard start task=TASK-101 effort=standard"},
    }));
  }
  send("session-a", v2Event(where, "PreToolUse", "turn-2", {
    tool_name: "Bash", tool_use_id: "redo-a", tool_input: {command: "pmnm-guard redo"},
  }));
  const blocked = send("session-b", v2Event(where, "PreToolUse", "turn-2", {
    tool_name: "Write", tool_use_id: "stale-b", tool_input: {file_path: path.join(v2TaskDirectory(where), "index.md"), content: "stale\n"},
  }));
  assert.equal(blocked?.hookSpecificOutput?.permissionDecision, "deny");
  assert.match(visibleText({output: blocked}), /changed in another session|cambi[oó] en otra sesi[oó]n/i);
});

test("HG-265 restarting the same task cannot erase an in-flight operation", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  const options = {dataRoot: where.dataRoot, environment: {CODEX_HOME: where.codexHome, PLUGIN_DATA: where.dataRoot}, now: 100};
  const seedEvent = {...v2Event(where, "UserPromptSubmit", "turn-4", {prompt: "Continue"}), session_id: "same-task-session"};
  const paths = testing.statePaths(where.dataRoot, seedEvent);
  fs.mkdirSync(paths.directory, {recursive: true});
  fs.writeFileSync(paths.state, JSON.stringify(agreed));
  processPersistedEvent(seedEvent, options);

  const pre = {...v2Event(where, "PreToolUse", "turn-4", {
    tool_name: "apply_patch", tool_use_id: "in-flight", tool_input: {patch: IMPLEMENTATION_PATCH},
  }), session_id: "same-task-session"};
  const allowed = processPersistedEvent(pre, options);
  assert.notEqual(allowed?.hookSpecificOutput?.permissionDecision, "deny");

  const restart = {...v2Event(where, "PreToolUse", "turn-4", {
    tool_name: "Bash", tool_use_id: "restart", tool_input: {command: "pmnm-guard start task=TASK-101 effort=standard"},
  }), session_id: "same-task-session"};
  const blocked = processPersistedEvent(restart, options);
  assert.equal(blocked?.hookSpecificOutput?.permissionDecision, "deny");
  assert.match(visibleText({output: blocked}), /host reported no result|no report[oó] resultado/i);

  fs.writeFileSync(path.join(where.cwd, "example.txt"), "changed\n");
  const post = {...v2Event(where, "PostToolUse", "turn-4", {
    tool_name: "apply_patch", tool_use_id: "in-flight", tool_input: {patch: IMPLEMENTATION_PATCH}, tool_response: "ok",
  }), session_id: "same-task-session"};
  processPersistedEvent(post, options);
  const persisted = JSON.parse(fs.readFileSync(paths.state, "utf8"));
  assert.equal(persisted.pending_writes.length, 0);
  assert.equal(persisted.mutation_count, 1);
});

test("HG-266 mentioning durable paths is not evidence that they were read", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  let result = v2Process(state, where, "SessionStart", "turn-4", {source: "compact"});
  const command = "opaque-tool " + result.state.rule_basis_paths.map((target) => JSON.stringify(target)).join(" ");
  result = v2RawPre(result.state, where, "turn-4", command, "mention-only");
  assert.equal(isDenied(result), true);
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=pmnm persistence=none certainty=certain capability=none",
    "mention-only-declare",
  );
  result = v2RawPre(result.state, where, "turn-4", command, "mention-only");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Post(result.state, where, "turn-4", command, "mention-only");
  assert.equal(result.state.rule_basis_required, true);
});

test("HG-267 Standard and High implementation Digests require a canonical impact contract", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  fs.rmSync(path.join(task, "impact.md"));
  let result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "missing-impact");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /impact\.md|impact contract/i);

  result = v3Write(result.state, where, "turn-3", path.join(task, "impact.md"), v3Impact({dimensions: {privacy: "N/A"}}), "invalid-impact");
  result = v2Receipt(result.state, where, "turn-3", "pmnm-guard digest", "invalid-impact-digest");
  assert.equal(isDenied(result), true);
  assert.match(fs.readFileSync(path.join(task, "preflight.md"), "utf8"), /impact\.md.*privacy/i);
});

test("HG-268 local impact mode remains concise while transitive unresolved nodes block", (t) => {
  const local = v3Setup(t);
  let localState = v3WritePlan(local.state, local.where, local.task, "turn-3", "- [ ] src/a.js — change a\n").state;
  let result = v2Receipt(localState, local.where, "turn-3", "pmnm-guard digest", "local-impact");
  assert.equal(isControlRecorded(result), true, visibleText(result));

  const transitive = v3Setup(t);
  let transitiveState = v3WritePlan(transitive.state, transitive.where, transitive.task, "turn-3", "- [ ] src/a.js — change a\n").state;
  const unresolved = v3Impact({mode: "transitive"}).replace("changed-and-covered", "unresolved-blocking");
  transitiveState = v3Write(transitiveState, transitive.where, "turn-3", path.join(transitive.task, "impact.md"), unresolved, "unresolved-impact").state;
  result = v2Receipt(transitiveState, transitive.where, "turn-3", "pmnm-guard digest", "unresolved-impact-digest");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /impact|unresolved/i);
});

test("HG-269 an agreed impact contract is bound and drift requires a revised Digest", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(task, "impact.md"), v3Impact({reason: "A materially different root now applies."}), "impact-drift").state;
  const result = v2Pre(state, where, "turn-4", IMPLEMENTATION_PATCH, "write-after-impact-drift", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /impact\.md|Digest.*changed|Digest.*cambi/i);
});

test("HG-270 completion requires a fresh final impact omission audit", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "impact-final-change").state;
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "impact-final-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "impact-final-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "impact-final-verified");
  result = v2RawPre(result.state, where, "turn-4", "pmnm-guard done audit=passed", "impact-final-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /impact\.md|omission audit/i);
  const stale = v3Impact({final: true}).replace("FINGERPRINT", "deadbeefdead");
  result = v3Write(result.state, where, "turn-4", path.join(task, "impact.md"), stale, "stale-impact-fingerprint");
  result = v2RawPre(result.state, where, "turn-4", "pmnm-guard done audit=passed", "stale-impact-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /Impact incomplete|Impacto incompleto/);
  const current = stale.replace("deadbeefdead", result.state.last_verification.fingerprint.hash);
  result = v3Write(result.state, where, "turn-4", path.join(task, "impact.md"), current, "current-impact-fingerprint");
  result = v2RawPre(result.state, where, "turn-4", "pmnm-guard done audit=passed", "current-impact-done");
  assert.match(visibleText(result), /Test Digest/);
});

test("HG-271 lifecycle rehydration includes impact.md and records only successful reads", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  let result = v2Process(state, where, "SessionStart", "turn-4", {source: "compact"});
  assert.ok(result.state.rule_basis_paths.includes(fs.realpathSync(path.join(task, "impact.md"))));
  assert.match(visibleText(result), /impact\.md/);
  const direct = result.state.rule_basis_paths.map((target) => JSON.stringify(target)).join(" ");
  const failed = v2DeclaredPre(result.state, where, "turn-4", "sed -n '1,240p' " + direct, "failed-rule-read", {boundary: "pmnm"});
  result = v2Post(failed.state, where, "turn-4", "sed -n '1,240p' " + direct, "failed-rule-read", "Bash", {exit_code: 1});
  assert.equal(result.state.rule_basis_required, true);
});

test("HG-272 impact preflight rejects untouched and malformed evidence placeholders", async (t) => {
  const cases = [
    ["seed", null],
    ["embedded-placeholders", "embedded"],
    ["punctuated-reason", v3Impact({reason: "pending."})],
    ["punctuated-dimensions", v3Impact({dimensions: {
      security: "unknown.", privacy: "none.", performance: "unavailable.",
      compatibility: "N/A.", maintainability: "TBD.", observability: "todo.",
    }})],
    ["punctuated-before-plan", v3Impact().replace(
      "derived independently from the request and inspected fixture",
      "unknown.",
    )],
    ["unknown-boundary", v3Impact({mode: "transitive"}).replace(
      "- none: no dynamic boundary participates in this fixture",
      "- none: unknown",
    )],
    ["placeholder-root-boundary", v3Impact({mode: "transitive"})
      .replace("- root: request-value — user-visible contract", "- root: <stable name> — <direct evidence>")
      .replace("- none: no dynamic boundary participates in this fixture", "- boundary: <name> | check: <check> | outcome: <outcome> | residual: <risk>")],
    ["unterminated-ledger-row", v3Impact({mode: "transitive"}).replace(
      "| request-value | root | direct source inspection | changed-and-covered | focused check |",
      "| request-value | root | direct source inspection | changed-and-covered | focused check",
    )],
    ["missing-leading-pipe", v3Impact({mode: "transitive"}).replace(
      "| request-value | root | direct source inspection | changed-and-covered | focused check |",
      "| request-value | root | direct source inspection | changed-and-covered | focused check |\nNodeConsumer | consumer | direct evidence | unresolved-blocking | inspect |",
    )],
    ["ledger-row-outside-ledger", v3Impact({mode: "transitive"}).replace(
      "| request-value | root | direct source inspection | changed-and-covered | focused check |",
      "",
    ) + "\n## Appendix\n\n| request-value | root | direct source inspection | changed-and-covered | focused check |\n"],
    ["root-outside-roots", v3Impact({mode: "transitive"}).replace(
      "- root: request-value — user-visible contract",
      "",
    ) + "\n## Appendix\n\n- root: request-value — user-visible contract\n"],
    ["boundary-outside-boundaries", v3Impact({mode: "transitive"}).replace(
      "- none: no dynamic boundary participates in this fixture",
      "",
    ) + "\n## Appendix\n\n- none: no dynamic boundary participates in this fixture\n"],
    ["dimension-outside-matrix", v3Impact().replace(
      "- security: unchanged; no authority boundary changes",
      "",
    ) + "\n## Appendix\n\n- security: unchanged; no authority boundary changes\n"],
    ["audit-field-outside-audit", v3Impact().replace(
      "- before-plan: derived independently from the request and inspected fixture",
      "",
    ) + "\n## Appendix\n\n- before-plan: derived independently from the request and inspected fixture\n"],
    ["malformed-root", v3Impact({mode: "transitive"}).replace(
      "- root: request-value — user-visible contract",
      "- root: request-value — user-visible contract\n- root: omitted-consumer —",
    )],
    ["malformed-boundary", v3Impact({mode: "transitive"}).replace(
      "- none: no dynamic boundary participates in this fixture",
      "- boundary: runtime edge | check:\n- none: no dynamic boundary participates in this fixture",
    )],
    ["boundary-and-none", v3Impact({mode: "transitive"}).replace(
      "- none: no dynamic boundary participates in this fixture",
      "- boundary: runtime edge | check: observed request | outcome: preserved | residual: none with inspected reason\n- none: no other dynamic boundary participates",
    )],
    ["duplicate-none", v3Impact({mode: "transitive"}).replace(
      "- none: no dynamic boundary participates in this fixture",
      "- none: no dynamic boundary participates\n- none: no other dynamic boundary participates",
    )],
    ["duplicate-ledger-node", v3Impact({mode: "transitive"}).replace(
      "| request-value | root | direct source inspection | changed-and-covered | focused check |",
      "| request-value | root | direct source inspection | changed-and-covered | focused check |\n| request-value | consumer | second source | unresolved-accepted-risk | human accepted a different claim |",
    )],
    ["duplicate-root", v3Impact({mode: "transitive"}).replace(
      "- root: request-value — user-visible contract",
      "- root: request-value — user-visible contract\n- root: request-value — conflicting source",
    )],
    ["duplicate-boundary", v3Impact({mode: "transitive"}).replace(
      "- none: no dynamic boundary participates in this fixture",
      "- boundary: runtime edge | check: first check | outcome: preserved | residual: none with reason\n- boundary: runtime edge | check: second check | outcome: changed | residual: accepted risk",
    )],
    ["local-with-boundary", v3Impact().replace(
      "## Non-functional dispositions",
      "## Dynamic boundaries\n\n- boundary: runtime edge | check: observed request | outcome: preserved | residual: none with reason\n\n## Non-functional dispositions",
    )],
    ["local-with-transitive-ledger", v3Impact().replace(
      "## Non-functional dispositions",
      "## Roots\n\n- root: request-value — user-visible contract\n\n## Ledger\n\n| Node | Relationship | Evidence | Disposition | Follow-up |\n|---|---|---|---|---|\n| request-value | root | direct source inspection | changed-and-covered | focused check |\n| consumer-value | consumer | direct source inspection | verified-unchanged | focused check |\n\n## Non-functional dispositions",
    )],
    ["node-prefix-unresolved", v3Impact({mode: "transitive"}).replace(
      "| request-value | root | direct source inspection | changed-and-covered | focused check |",
      "| request-value | root | direct source inspection | changed-and-covered | focused check |\n| NodeConsumer | consumer | direct evidence | unresolved-blocking | inspect |",
    )],
    ["node-exact-unresolved", v3Impact({mode: "transitive"}).replace(
      "| request-value | root | direct source inspection | changed-and-covered | focused check |",
      "| request-value | root | direct source inspection | changed-and-covered | focused check |\n| Node | consumer | direct evidence | unresolved-blocking | inspect |",
    )],
    ["node-header-prefix-unresolved", v3Impact({mode: "transitive"}).replace(
      "| request-value | root | direct source inspection | changed-and-covered | focused check |",
      "| request-value | root | direct source inspection | changed-and-covered | focused check |\n| Node | Relationship | direct evidence | unresolved-blocking | inspect |",
    )],
  ];
  for (const [name, replacement] of cases) await t.test(name, () => {
    const {where, task, state: initial} = v3Setup(t);
    const seeded = fs.readFileSync(path.join(task, "impact.md"), "utf8");
    let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
    const content = replacement === "embedded" ? seeded.replaceAll(": <", ": filler <") : replacement || seeded;
    state = v3Write(state, where, "turn-3", path.join(task, "impact.md"), content, "bad-impact-" + name).state;
    const result = v2Receipt(state, where, "turn-3", "pmnm-guard digest", "bad-impact-digest-" + name);
    assert.equal(isDenied(result), true, name + ": " + visibleText(result));
    assert.match(fs.readFileSync(path.join(task, "preflight.md"), "utf8"), /impact\.md/);
  });
});

test("HG-273 standalone rule curation can stop without an implementation Digest", (t) => {
  for (const language of ["en", "es"]) {
    const standalone = v2Configured(t, language);
    const created = v3CreateTask(standalone.state, standalone.where);
    const projectRules = path.join(standalone.where.notes, "projects", "example", "project-rules.md");
    let result = v3Write(
      created.state,
      standalone.where,
      "turn-4",
      projectRules,
      "# Project rules\n\nPreserve the established fallback.\n",
      "standalone-project-rule",
    );
    assert.equal(result.state.rules_file_hashes_written.length, 1);
    result = v2Process(result.state, standalone.where, "Stop", "turn-4");
    assert.equal(visibleText(result), "");

    const planned = v2Configured(t, language);
    const plannedTask = v3CreateTask(planned.state, planned.where);
    let plannedState = v3WritePlan(
      plannedTask.state,
      planned.where,
      plannedTask.task,
      "turn-3",
      "- [ ] example.txt — implement the requested behavior\n",
    ).state;
    const plannedRules = path.join(planned.where.notes, "projects", "example", "project-rules.md");
    plannedState = v3Write(
      plannedState,
      planned.where,
      "turn-3",
      plannedRules,
      "# Project rules\n\nPreserve the established fallback.\n",
      "planned-project-rule",
    ).state;
    result = v2Process(plannedState, planned.where, "Stop", "turn-3");
    assert.match(visibleText(result), /Digest/);
  }
});

test("HG-274 reload cards name only the canonical files that actually exist", (t) => {
  const {where, state: configured} = v2Configured(t);
  configured.effort = "light";
  const created = v3CreateTask(configured, where);
  const impact = path.join(created.task, "impact.md");
  fs.rmSync(impact, {force: true});

  const result = v2Process(created.state, where, "SessionStart", "turn-4", {source: "compact"});
  assert.equal(result.state.rule_basis_paths.includes(impact), false);
  assert.doesNotMatch(visibleText(result), /impact\.md/);
  for (const target of result.state.rule_basis_paths) assert.match(visibleText(result), new RegExp(escapeRegExp(target)));
});

test("HG-275 individually returned rule files correlate by host operation identity", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v2Process(state, where, "SessionStart", "turn-4", {source: "compact"}).state;

  for (const [index, target] of state.rule_basis_paths.entries()) {
    const id = "reload-file-" + index;
    const command = "opaque-reader " + JSON.stringify(target);
    let result = v2RawPre(state, where, "turn-4", command, id);
    assert.equal(isDenied(result), true);
    result = v2Receipt(
      result.state,
      where,
      "turn-4",
      "pmnm-guard declare effect=investigation boundary=pmnm persistence=none certainty=certain capability=none",
      id + "-declare",
    );
    result = v2RawPre(result.state, where, "turn-4", command, id);
    assert.equal(isDenied(result), false, visibleText(result));
    result = v2Post(
      result.state,
      where,
      "turn-4",
      command + " --host-normalized",
      id,
      "Bash",
      fs.readFileSync(target, "utf8"),
    );
    state = result.state;
  }

  assert.equal(state.rule_basis_required, false);
  assert.equal(state.pending_rule_reads.length, 0);
});

test("HG-276 an agreed capability can classify the next operation before a denial", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v3WritePlan(
    created.state,
    where,
    created.task,
    "turn-3",
    "- [x] state: runtime-read-capability — absent => approved\n",
  ).state;
  state = v3WritePermissions(state, where, created.task, "turn-3", {
    project: [{
      capability: "local-runtime-read",
      effect: "investigation",
      boundary: "local-environment",
      persistence: "none",
      shape: "read-current-runtime-state",
      constraints: "one explicit operation, no writes and native host review remains authoritative",
      reason: "reuse one already-agreed read-only capability",
    }],
  }).state;
  state = v3Agree(state, where);

  let result = v2Receipt(
    state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=local-runtime-read",
    "proactive-capability",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  result = v2RawPre(result.state, where, "turn-4", "runtime-query status=active", "proactive-use");
  assert.equal(isDenied(result), false, visibleText(result));

  result = v2RawPre(result.state, where, "turn-4", "runtime-query status=idle", "proactive-spent");
  assert.equal(isDenied(result), true);
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=local-runtime-read",
    "proactive-before-write",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  result = v2RawPre(result.state, where, "turn-4", "rm obsolete.txt", "mechanical-write");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /deletion|eliminaci[oó]n|not in .*plan|no est[aá] en .*plan/i);
  assert.doesNotMatch(visibleText(result), /explicit effect and boundary|efecto y l[ií]mite expl[ií]citos/i);
});

test("HG-277 non-persistent verification is observed without being presumed mutating", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  let state = v2Process(created.state, where, "SessionStart", "turn-4", {source: "compact"}).state;
  const target = state.rule_basis_paths[0];
  const command = "wc-like count " + JSON.stringify(target);
  let result = v2RawPre(state, where, "turn-4", command, "readonly-check");
  assert.equal(isDenied(result), true);
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=verification boundary=project persistence=none certainty=certain capability=none",
    "readonly-check-declare",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  result = v2RawPre(result.state, where, "turn-4", command, "readonly-check");
  assert.equal(isDenied(result), false, visibleText(result));
  assert.equal(result.state.pending_writes.length, 1);
  assert.equal(result.state.pending_rule_reads.length, 1);
  result = v2Post(result.state, where, "turn-4", command, "readonly-check", "Bash", fs.readFileSync(target, "utf8"));
  assert.equal(result.state.verification_count, 1);
  assert.equal(result.state.mutation_count, 0);
  assert.equal(result.state.effect_count, 0);
  assert.equal(result.state.last_check?.verification_count, 1);
  assert.doesNotMatch(visibleText(result), /verification command changed the project|comando de verificaci[oó]n cambi[oó] el proyecto/i);
});

test("HG-278 deliverable plans close without inventing a project mutation", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [x] deliverable: review — evidence-backed review of the requested contract\n" +
      "- [x] boundary: review — the strongest plausible alternative was tested and rejected\n",
  ).state;
  state = v3Agree(state, where);
  const verification = path.join(task, "verification.md");
  state = v3Write(
    state,
    where,
    "turn-4",
    verification,
    fs.readFileSync(verification, "utf8") +
      "\n- example: requested review → delivered with direct evidence\n" +
      "- unchanged: project files → no project mutation requested or observed\n" +
      "- deliverable: review — reviewed result is present in the task record\n" +
      "- boundary: review — alternative disposition is recorded with its evidence\n",
    "deliverable-claims",
  ).state;
  let result = v2Pre(state, where, "turn-4", "npm test", "deliverable-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "deliverable-check");
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "deliverable-verified");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=passed", "deliverable-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /Test Digest/);
  assert.doesNotMatch(visibleText(result), /no changed target|ning[uú]n objetivo modificado/i);
});

test("HG-279 a material deliverable reframe permits investigation but not stale closure", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(
    initial,
    where,
    task,
    "turn-3",
    "- [x] deliverable: decision — compare two bounded options\n" +
      "- [x] boundary: decision — a third option was checked and excluded\n",
  ).state;
  state = v3Agree(state, where);
  state = v3Write(
    state,
    where,
    "turn-4",
    path.join(task, "plan.md"),
    "# Plan\n\n- [x] deliverable: decision — compare three materially different options\n" +
      "- [x] boundary: decision — the prior two-option framing no longer bounds the request\n",
    "reframed-deliverable",
  ).state;

  const command = "advisory-reader inspect-evidence";
  let result = v2RawPre(state, where, "turn-4", command, "reframe-read");
  assert.equal(isDenied(result), true);
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=project persistence=none certainty=certain capability=none",
    "reframe-read-declare",
  );
  result = v2RawPre(result.state, where, "turn-4", command, "reframe-read");
  assert.equal(isDenied(result), false, visibleText(result));
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard done audit=partial", "stale-deliverable-done");
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /changed after the Digest|cambi[oó] despu[eé]s del Digest/i);
});

test("HG-280 project knowledge is a canonical, tracked curation surface", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const knowledge = path.join(where.notes, "projects", "example", "project-knowledge.md");
  const result = v3Write(
    created.state,
    where,
    "turn-4",
    knowledge,
    "# Project knowledge\n\n## observed contract\n- current: corroborated by two task records\n",
    "curate-project-knowledge",
  );
  assert.equal(result.state.rules_file_hashes_written.length, 1);
  assert.equal(result.state.rule_basis_required, true);
});

test("HG-281 rule curation reloads a concurrently changed canonical basis before writing", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v2Process(state, where, "SessionStart", "turn-4", {source: "compact"}).state;
  const command = "opaque-reader " + state.rule_basis_paths.map((target) => JSON.stringify(target)).join(" ");
  let result = v2RawPre(state, where, "turn-4", command, "curation-reload");
  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=pmnm persistence=none certainty=certain capability=none",
    "curation-reload-declare",
  );
  result = v2RawPre(result.state, where, "turn-4", command, "curation-reload");
  result = v2Post(
    result.state,
    where,
    "turn-4",
    command,
    "curation-reload",
    "Bash",
    result.state.rule_basis_paths.map((target) => fs.readFileSync(target, "utf8")).join("\n"),
  );
  assert.equal(result.state.rule_basis_required, false);

  const projectRules = path.join(where.notes, "projects", "example", "project-rules.md");
  fs.writeFileSync(projectRules, "# Project rules\n\nConcurrent change.\n");
  const input = {
    file_path: path.join(where.notes, "projects", "example", "project-knowledge.md"),
    content: "# Project knowledge\n\nStale overwrite.\n",
  };
  result = v2RawPre(result.state, where, "turn-4", "", "stale-curation", "Write", input);
  assert.equal(isDenied(result), true);
  assert.match(visibleText(result), /reloaded|recargad/i);
});

test("HG-282 explicit host outcomes outrank fallback output text", (t) => {
  assert.equal(toolResult({tool_response: {exit_code: 0, output: "error: expected fixture"}}).failed, false);
  assert.equal(toolResult({tool_response: {success: true, output: "failure: expected branch"}}).failed, false);
  assert.equal(toolResult({tool_response: {ok: true, output: "failed: expected branch"}}).failed, false);
  assert.equal(toolResult({tool_response: {exit_code: 1, output: "ok"}}).failed, true);
  assert.equal(toolResult({tool_response: {success: false, output: "ok"}}).failed, true);
  assert.equal(toolResult({tool_response: {output: "error: no explicit outcome"}}).failed, true);
  assert.equal(toolResult({tool_response: "failure: no explicit outcome"}).failed, true);

  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — materially change a\n").state;
  state = v3Agree(state, where);
  const target = path.join(where.cwd, "src", "a.js");
  const input = {file_path: target, content: "a=2\n"};
  let result = v2RawPre(state, where, "turn-4", "", "explicit-success-write", "Write", input);
  assert.equal(isDenied(result), false, visibleText(result));
  fs.writeFileSync(target, input.content);
  result = v2Post(
    result.state,
    where,
    "turn-4",
    "",
    "explicit-success-write",
    "Write",
    {exit_code: 0, output: "error: expected fixture"},
    input,
  );
  assert.equal(result.state.pending_writes.length, 0);
  assert.equal(result.state.mutation_count, 1);
});

test("HG-283 regular-file identity compares raw bytes for changes and no-ops", (t) => {
  for (const workspace of [false, true]) for (const changed of [false, true]) {
    const {where, task, state: initial} = v3Setup(t, {workspace});
    const target = path.join(where.cwd, "src", "a.js");
    fs.writeFileSync(target, Buffer.from([0x80]));
    let state = v3WritePlan(initial, where, task, "turn-3", "- [ ] src/a.js — materially change binary content\n").state;
    state = v3Agree(state, where);
    const content = Buffer.from([changed ? 0x81 : 0x80]);
    const input = {file_path: target, content: "binary fixture"};
    let result = v2RawPre(state, where, "turn-4", "", "binary-write-" + workspace + "-" + changed, "Write", input);
    assert.equal(isDenied(result), false, visibleText(result));
    fs.writeFileSync(target, content);
    result = v2Post(
      result.state,
      where,
      "turn-4",
      "",
      "binary-write-" + workspace + "-" + changed,
      "Write",
      {exit_code: 0, output: "ok"},
      input,
    );
    assert.equal(result.state.mutation_count, changed ? 1 : 0, `workspace=${workspace} changed=${changed}`);
  }
});

test("HG-284 a plain proactive declaration is same-turn and next-operation only", (t) => {
  const declare = (state, where, turn, id, boundary = "project") => v2Receipt(
    state,
    where,
    turn,
    `pmnm-guard declare effect=investigation boundary=${boundary} persistence=none certainty=certain capability=none`,
    id,
  );

  {
    const {where, state: configured} = v2Configured(t);
    const created = v3CreateTask(configured, where);
    let result = declare(created.state, where, "turn-3", "proactive-plain");
    assert.equal(isControlRecorded(result), true, visibleText(result));
    result = v2RawPre(result.state, where, "turn-3", "unfamiliar-reader inspect", "proactive-plain-use");
    assert.equal(isDenied(result), false, visibleText(result));
    assert.equal(result.state.declared_retry, null);
    result = v2RawPre(result.state, where, "turn-3", "unfamiliar-reader inspect-again", "proactive-plain-spent");
    assert.equal(isDenied(result), true, visibleText(result));
  }

  {
    const {where, state: configured} = v2Configured(t);
    const created = v3CreateTask(configured, where);
    const target = path.join(where.cwd, "known.txt");
    fs.writeFileSync(target, "known\n");
    let result = declare(created.state, where, "turn-3", "proactive-before-known");
    result = v2RawPre(result.state, where, "turn-3", "", "known-read", "Read", {file_path: target});
    assert.equal(isDenied(result), false, visibleText(result));
    assert.equal(result.state.declared_retry, null);
    result = v2RawPre(result.state, where, "turn-3", "unfamiliar-reader after-known", "after-known");
    assert.equal(isDenied(result), true, visibleText(result));
  }

  const boundaries = [
    ["human-prompt", (state, where) => v2Prompt(state, where, "turn-4", "The direction changed")],
    ["session-start", (state, where) => v2Process(state, where, "SessionStart", "turn-3", {source: "compact"})],
    ["stop", (state, where) => v2Process(state, where, "Stop", "turn-3", {last_assistant_message: "Pausing"})],
    ["interrupt", (state, where) => v2Process(state, where, "Interrupt", "turn-3")],
    ["task-start", (state, where) => v2Receipt(state, where, "turn-3", "pmnm-guard start task=TASK-101 effort=standard", "same-task-start")],
    ["redo", (state, where) => v2Receipt(state, where, "turn-3", "pmnm-guard redo", "redo")],
    ["completion", (state, where) => v2Receipt(state, where, "turn-3", "pmnm-guard done audit=partial", "done")],
  ];
  for (const [label, crossBoundary] of boundaries) {
    const {where, state: configured} = v2Configured(t);
    const created = v3CreateTask(configured, where);
    let result = declare(created.state, where, "turn-3", "declare-" + label);
    assert.equal(isControlRecorded(result), true, label + ": " + visibleText(result));
    result = crossBoundary(result.state, where);
    assert.equal(result.state.declared_retry, null, label);
  }

  {
    const {where, state: configured} = v2Configured(t);
    const created = v3CreateTask(configured, where);
    let result = declare(created.state, where, "turn-3", "legacy-proactive");
    delete result.state.declared_retry.turn_hash;
    result = v2Process(result.state, where, "SessionStart", "turn-4", {source: "resume"});
    assert.equal(result.state.declared_retry, null, "a pre-upgrade declaration expires instead of corrupting session state");
  }

  {
    const {where, state: configured} = v2Configured(t);
    const created = v3CreateTask(configured, where);
    let result = declare(created.state, where, "turn-3", "stale-turn");
    result.state.declared_retry.turn_hash = "0".repeat(64);
    result = v2RawPre(result.state, where, "turn-3", "unfamiliar-reader stale", "stale-turn-operation");
    assert.equal(isDenied(result), true, visibleText(result));
    assert.equal(result.state.declared_retry, null, "a stale declaration is consumed without applying");
  }
});

test("HG-285 proactive intent cannot pre-authorize sensitive or mechanical effects", (t) => {
  {
    const {where, state: configured} = v2Configured(t);
    const created = v3CreateTask(configured, where);
    let result = v2Receipt(
      created.state,
      where,
      "turn-3",
      "pmnm-guard declare effect=investigation boundary=network persistence=none certainty=certain capability=none",
      "network-intent",
    );
    assert.equal(isControlRecorded(result), true, visibleText(result));
    assert.equal(result.state.pending_denied, null);
    assert.equal(result.state.declared_retry.command_hash, null);
    assert.equal(result.state.sensitive_allow, null);
    result = v2RawPre(result.state, where, "turn-3", "opaque-network inspect", "network-operation");
    assert.equal(isDenied(result), true, visibleText(result));
    assert.match(visibleText(result), /allow effect=network/);
    assert.match(result.state.pending_denied?.command_hash || "", /^[a-f0-9]{64}$/);
  }

  {
    const {where, state: configured} = v2Configured(t);
    const created = v3CreateTask(configured, where);
    let result = v2Receipt(
      created.state,
      where,
      "turn-3",
      "pmnm-guard declare effect=investigation boundary=project persistence=none certainty=certain capability=none",
      "read-intent-before-delete",
    );
    assert.equal(isControlRecorded(result), true, visibleText(result));
    result = v2RawPre(result.state, where, "turn-3", "rm obsolete.txt", "mechanical-delete");
    assert.equal(isDenied(result), true, visibleText(result));
    assert.equal(result.state.declared_retry, null);
    assert.match(visibleText(result), /plan Digest|Digest de plan|deletion|eliminaci[oó]n|not in .*plan|no est[aá] en .*plan/i);
    assert.doesNotMatch(visibleText(result), /explicit effect and boundary|efecto y l[ií]mite expl[ií]citos/i);
  }
});

test("HG-286 a pending host result outranks a proactive declaration", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  let result = v2Pre(agreed, where, "turn-4", IMPLEMENTATION_PATCH, "pending-before-declare", "apply_patch");
  assert.equal(isDenied(result), false, visibleText(result));
  assert.equal(result.state.pending_writes.length, 1);

  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=project persistence=none certainty=certain capability=none",
    "declare-with-pending-result",
  );
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /host reported no result|host no report[oó] resultado/i);
  assert.match(visibleText(result), /pmnm-guard result outcome=<unknown\|no-effect>/);
  assert.doesNotMatch(visibleText(result), /nothing denied to declare|nada denegado que declarar/i);
  assert.equal(result.state.pending_writes.length, 1);
});

test("HG-287 certain non-persistent mixed verification remains a read declaration", () => {
  assert.equal(declarationSensitiveEffect({
    effect: "verification",
    boundary: "mixed",
    persistence: "none",
    certainty: "certain",
  }), null);
  assert.equal(declarationSensitiveEffect({
    effect: "verification",
    boundary: "mixed",
    persistence: "persistent",
    certainty: "certain",
  }), "state-change");
  assert.equal(declarationSensitiveEffect({
    effect: "verification",
    boundary: "mixed",
    persistence: "none",
    certainty: "uncertain",
  }), "state-change");
});

test("HG-288 unverified cards never relabel counters as files or unscoped targets as project paths", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  const counted = structuredClone(agreed);
  counted.mutation_count = 6;
  let result = v2Process(counted, where, "Stop", "turn-4", {last_assistant_message: "Paused"});
  assert.match(visibleText(result), /project work changed|trabajo del proyecto cambi[oó]/i);
  assert.doesNotMatch(visibleText(result), /6 files|6 archivos/i);

  const targets = structuredClone(agreed);
  targets.mutation_count = 6;
  targets.changed_target_hashes = ["a".repeat(64), "b".repeat(64)];
  result = v2Process(targets, where, "Stop", "turn-4", {last_assistant_message: "Paused"});
  assert.match(visibleText(result), /2 planned paths changed|2 rutas planificadas cambiaron/i);
  assert.doesNotMatch(visibleText(result), /project paths|rutas planificadas del proyecto/i);
  assert.doesNotMatch(visibleText(result), /files changed|archivos cambiaron/i);
});

test("HG-289 task-transition cards preserve current verification truth", (t) => {
  const {where, task, state: initial} = v3Setup(t);
  let state = v3WritePlan(initial, where, task, "turn-3", "- [x] src/a.js — change a\n").state;
  state = v3Agree(state, where);
  state = v3Write(state, where, "turn-4", path.join(where.cwd, "src", "a.js"), "a=2\n", "verified-transition-change").state;
  state = v3WriteClaims(state, where, task, "turn-4").state;
  let result = v2Pre(state, where, "turn-4", "npm test", "verified-transition-check");
  result = v2Post(result.state, where, "turn-4", "npm test", "verified-transition-check", "Bash", {exit_code: 0, output: "passed"});
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard verified result=passed how=command", "verified-transition-receipt");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.equal(result.state.last_verification?.result, "passed");

  const verification = structuredClone(result.state.last_verification);
  result = v2Receipt(result.state, where, "turn-4", "pmnm-guard start task=TASK-202 effort=standard", "verified-transition-start");
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /unfinished work remains|a[uú]n queda trabajo pendiente/i);
  assert.doesNotMatch(visibleText(result), /unverified|sin verificar/i);
  assert.deepEqual(result.state.last_verification, verification);
});

test("HG-290 a blocked audit keeps the task open without arming final acceptance", (t) => {
  const {where, state: agreed} = v2Agreed(t);
  const result = v2Receipt(agreed, where, "turn-4", "pmnm-guard done audit=blocked", "blocked-audit");
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.match(visibleText(result), /audit is blocked|auditor[ií]a est[aá] bloqueada/i);
  assert.equal(result.state.completion, null);
  assert.notEqual(result.state.phase, "COMPLETE");
  assert.equal(result.state.test_digest_audit_epoch, null);
  assert.equal(result.state.test_digest_epoch, null);
  assert.notEqual(result.state.pending_question?.kind, "test-digest");
  assert.equal(result.state.events.at(-1)?.type, "audit-blocked");
});

test("HG-291 the next prompt can recover only the latest bounded current Test Digest", (t) => {
  {
    const {where, state: armed} = v3ArmedTestDigest(t);
    const transcript = v3WriteTranscript(where, "current-test-digest", [v3TestDigestMessage()]);
    let result = v2Process(armed, where, "UserPromptSubmit", "turn-5", {
      prompt: "The handoff is clear; continue to the final audit",
      transcript_path: transcript,
    });
    assert.equal(result.state.test_digest_epoch, result.state.epoch);
    assert.equal(result.state.test_digest_response_epoch, result.state.prompt_epoch);
    assert.equal(result.state.pending_question, null);
    assert.match(visibleText(result), /received the current Test Digest|recibi[oó] el Test Digest vigente/i);
    result = v2Receipt(result.state, where, "turn-5", "pmnm-guard done audit=passed", "transcript-recovered-done");
    assert.equal(isControlRecorded(result), true, visibleText(result));
  }

  const cases = [
    ["stale", (where) => v3WriteTranscript(where, "stale-test-digest", [v3TestDigestMessage(), "An unrelated later assistant message."])],
    ["malformed", (where) => {
      const target = path.join(where.root, "malformed.jsonl");
      fs.writeFileSync(target, "{not-json}\n");
      return target;
    }],
    ["unsupported", (where) => {
      const target = path.join(where.root, "unsupported.jsonl");
      fs.writeFileSync(target, JSON.stringify({role: "assistant", message: v3TestDigestMessage()}) + "\n");
      return target;
    }],
    ["oversized", (where) => v3WriteTranscript(where, "oversized-test-digest", [v3TestDigestMessage() + "x".repeat(1_200_000)])],
    ["missing", (where) => path.join(where.root, "missing.jsonl")],
    ["symlink", (where) => {
      const source = v3WriteTranscript(where, "linked-source", [v3TestDigestMessage()]);
      const target = path.join(where.root, "linked-transcript.jsonl");
      fs.symlinkSync(source, target);
      return target;
    }],
  ];
  for (const [label, transcriptFor] of cases) {
    const {where, state: armed} = v3ArmedTestDigest(t);
    const result = v2Process(armed, where, "UserPromptSubmit", "turn-5", {
      prompt: "Continue",
      transcript_path: transcriptFor(where),
    });
    assert.equal(result.state.test_digest_epoch, null, label);
    assert.equal(result.state.test_digest_response_epoch, null, label);
    const retry = v2Receipt(result.state, where, "turn-5", "pmnm-guard done audit=passed", "transcript-retry-" + label);
    assert.equal(isDenied(retry), true, label + ": " + visibleText(retry));
    assert.match(visibleText(retry), /Test Digest/, label);
  }
});

test("HG-292 proactive classification survives a separate exact authority decision", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const command = "opaque-runtime inspect";
  let result = v2Receipt(
    created.state,
    where,
    "turn-3",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=none",
    "proactive-environment-declare",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));

  result = v2RawPre(result.state, where, "turn-3", command, "proactive-environment-operation");
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /allow effect=environment/);
  assert.equal(result.state.declared_retry?.command_hash, result.state.pending_denied?.command_hash);

  let state = v2Prompt(result.state, where, "turn-4", "Allow that exact local environment inspection").state;
  state = v2Receipt(
    state,
    where,
    "turn-4",
    "pmnm-guard allow effect=environment",
    "proactive-environment-allow",
  ).state;
  result = v2RawPre(state, where, "turn-4", command, "proactive-environment-retry");
  assert.equal(isDenied(result), false, visibleText(result));
  assert.equal(result.state.declared_retry, null);
  assert.equal(result.state.sensitive_allow, null);
  assert.equal(result.state.pending_writes.length, 1);

  result = v2Post(
    result.state,
    where,
    "turn-4",
    command,
    "proactive-environment-retry",
    "Bash",
    {exit_code: 0, output: "active"},
  );
  assert.equal(result.state.pending_writes.length, 0);
});

test("HG-293 exact classification and authority cannot cross operation identity", (t) => {
  const {where, state: configured} = v2Configured(t);
  const created = v3CreateTask(configured, where);
  const command = "opaque-runtime inspect";
  let result = v2Receipt(
    created.state,
    where,
    "turn-3",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=none",
    "identity-declare",
  );
  result = v2RawPre(result.state, where, "turn-3", command, "identity-operation");
  let state = v2Prompt(result.state, where, "turn-4", "Allow only the command that was shown").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard allow effect=environment", "identity-allow").state;

  result = v2RawPre(state, where, "turn-4", command + " --all", "identity-changed-operation");
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /pmnm-guard declare/);
  assert.equal(result.state.sensitive_allow?.uses, 1);
  assert.match(result.state.declared_retry?.command_hash || "", /^[a-f0-9]{64}$/);
  assert.notEqual(result.state.declared_retry?.command_hash, result.state.pending_denied?.command_hash);

  result = v2RawPre(result.state, where, "turn-4", command, "identity-original-retry");
  assert.equal(isDenied(result), false, visibleText(result));
  assert.equal(result.state.declared_retry, null);
  assert.equal(result.state.sensitive_allow, null);
  assert.equal(result.state.pending_denied, null);
});

test("HG-294 a pre-fix allowance recovers without asking the human twice", (t) => {
  const {where, state: configured} = v2Configured(t);
  fs.mkdirSync(v2TaskDirectory(where), {recursive: true});
  const command = "legacy-stuck-runtime inspect";
  let result = v2Pre(configured, where, "turn-3", command, "legacy-stuck-first");
  result = v2Receipt(
    result.state,
    where,
    "turn-3",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=none",
    "legacy-stuck-declare",
  );
  let state = v2Prompt(result.state, where, "turn-4", "Allow that exact local environment command").state;
  state = v2Receipt(state, where, "turn-4", "pmnm-guard allow effect=environment", "legacy-stuck-allow").state;
  state.declared_retry = null;
  result = v2Pre(state, where, "turn-4", command, "legacy-stuck-unknown-again");
  assert.equal(isDenied(result), true, visibleText(result));
  assert.match(visibleText(result), /pmnm-guard declare/);

  result = v2Receipt(
    result.state,
    where,
    "turn-4",
    "pmnm-guard declare effect=investigation boundary=local-environment persistence=none certainty=certain capability=none",
    "legacy-stuck-redeclare",
  );
  assert.equal(isControlRecorded(result), true, visibleText(result));
  assert.doesNotMatch(visibleText(result), /^Ask: /m);
  result = v2Pre(result.state, where, "turn-4", command, "legacy-stuck-retry");
  assert.equal(isDenied(result), false, visibleText(result));
});
