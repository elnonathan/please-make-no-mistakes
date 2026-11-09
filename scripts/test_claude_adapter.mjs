#!/usr/bin/env node
// Red-first conformance suite for the Claude host adapter.
// The adapter is a sibling entry module. It must never mutate the frozen engine
// and must never claim coverage it did not observe.

import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {processEvent, testing} from "../hooks/pmnm-guard.mjs";
import {
  READ_TOOLS,
  ENGINE_TOOLS,
  SESSION_SOURCES,
  UNSUPPORTED_TOOLS,
  adapterPath,
  configRoot,
  handle,
  toolDisposition,
} from "../hooks/claude/pmnm-claude.mjs";

const BASE = {
  session_id: "session-1",
  cwd: process.cwd(),
  transcript_path: "/tmp/transcript.jsonl",
  permission_mode: "default",
};

function event(fields) {
  return {...BASE, ...fields};
}

function recorder(output = null) {
  const seen = [];
  return {
    seen,
    engine(normalized, options) {
      seen.push({normalized, options});
      return output;
    },
  };
}


function pendingState() {
  const state = testing.baseState();
  state.task_id = "T-1";
  // A real session has an identified turn; without one the engine treats every
  // stop as a repeat and answers with a note instead of a block.
  state.current_turn_hash = "b".repeat(64);
  state.pending_writes = [
    {
      tool_use_id: "toolu_interrupt",
      command_hash: "a".repeat(64),
      operation_id: "a".repeat(12),
      effect: "implementation",
      objective_hash: null,
      store_write: false,
      project_write: true,
      task_hash: null,
      epoch: state.epoch,
      target_hashes: [],
      target_before: null,
      workspace_before_hash: null,
      plan_write: false,
      verification_claim_write: false,
      rule_file_hashes: [],
      task_directory_write: false,
    },
  ];
  return state;
}

function isDeny(result) {
  return result?.hookSpecificOutput?.permissionDecision === "deny";
}

test("tool dispositions separate the four routes", () => {
  for (const name of ["Bash", "Edit", "Write"]) assert.equal(toolDisposition(name), "engine", name);
  for (const name of ["Read", "Glob", "Grep"]) assert.equal(toolDisposition(name), "read", name);
  for (const name of ["PowerShell", "NotebookEdit"]) assert.equal(toolDisposition(name), "unsupported", name);
  for (const name of [
    "AskUserQuestion",
    "ExitPlanMode",
    "Agent",
    "Workflow",
    "WebFetch",
    "WebSearch",
    "TodoWrite",
    "mcp__plugin_example__lookup",
  ]) assert.equal(toolDisposition(name), "unobserved", name);
  assert.equal(toolDisposition(""), "invalid");
  assert.equal(toolDisposition(undefined), "invalid");
});

test("the four route sets are disjoint and complete for the named tools", () => {
  const sets = [ENGINE_TOOLS, READ_TOOLS, UNSUPPORTED_TOOLS];
  for (let left = 0; left < sets.length; left += 1) {
    for (let right = left + 1; right < sets.length; right += 1) {
      for (const name of sets[left]) assert.equal(sets[right].has(name), false, name);
    }
  }
});

test("an unobserved tool emits no decision and never reaches the engine", () => {
  for (const name of ["AskUserQuestion", "ExitPlanMode", "Agent", "Workflow", "WebFetch", "WebSearch", "mcp__x__y"]) {
    const engine = recorder();
    const result = handle(event({hook_event_name: "PreToolUse", tool_name: name, tool_input: {}}), {engine: engine.engine});
    assert.equal(result, null, name);
    assert.equal(engine.seen.length, 0, name);
  }
});

test("no adapter route may ever emit permissionDecision allow of its own", () => {
  const source = fs.readFileSync(adapterPath, "utf8");
  const literals = source.match(/permissionDecision"?\s*:\s*"allow"/g) || [];
  assert.equal(literals.length, 0, "adapter must not author an allow decision");
});

test("an unsupported mutating tool is blocked and never reaches the engine", () => {
  for (const name of ["PowerShell", "NotebookEdit"]) {
    const engine = recorder();
    const result = handle(
      event({hook_event_name: "PreToolUse", tool_name: name, tool_input: {command: "x"}}),
      {engine: engine.engine},
    );
    assert.equal(isDeny(result), true, name);
    assert.match(result.hookSpecificOutput.permissionDecisionReason, /unsupported/i);
    assert.equal(engine.seen.length, 0, name);
  }
});

test("a read is routed before the call and carries no write authority", () => {
  // This case used to assert that reads were watched and forwarded nowhere.
  // The engine now classifies a tool-shaped read, so the adapter forwards it.
  for (const name of ["Read", "Glob", "Grep"]) {
    const engine = recorder();
    handle(
      event({hook_event_name: "PreToolUse", tool_name: name, tool_input: {file_path: "/tmp/x"}, tool_use_id: "t"}),
      {engine: engine.engine},
    );
    assert.equal(engine.seen.length, 1, name);
    assert.equal("tool_response" in engine.seen[0].normalized, false, name + " carried a result it does not have");
  }
});

test("an engine tool reaches the engine with the Claude configuration root", () => {
  const engine = recorder({hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny"}});
  handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t", prompt_id: "p-1"}),
    {engine: engine.engine},
  );
  assert.equal(engine.seen.length, 1);
  const expected = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  assert.equal(engine.seen[0].options.hostConfigRoot, expected);
  assert.equal(configRoot(), expected);
});

test("a symlinked entry invokes the adapter", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-adapter-link-"));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const link = path.join(directory, "entry.mjs");
  fs.symlinkSync(adapterPath, link);
  const result = spawnSync(process.execPath, [link], {input: "", encoding: "utf8"});
  assert.equal(result.status, 2);
  assert.match(result.stderr, /could not read this host event/);
});

test("an adapter inside a symlinked directory runs with and without --preserve-symlinks-main", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-adapter-dir-link-"));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const linkedRoot = path.join(directory, "plugin");
  fs.symlinkSync(path.dirname(path.dirname(adapterPath)), linkedRoot, "dir");
  const entry = path.join(linkedRoot, path.basename(path.dirname(adapterPath)), path.basename(adapterPath));
  for (const flags of [[], ["--preserve-symlinks-main"]]) {
    const result = spawnSync(process.execPath, [...flags, entry], {input: "", encoding: "utf8"});
    assert.equal(result.status, 2, `node ${flags.join(" ")} ran no adapter: status ${result.status}`);
    assert.match(result.stderr, /could not read this host event/);
  }
});

test("prompt_id becomes the engine turn identity and prompt passes through", () => {
  const engine = recorder();
  handle(event({hook_event_name: "UserPromptSubmit", prompt: "hola", prompt_id: "p-9"}), {engine: engine.engine});
  assert.equal(engine.seen[0].normalized.turn_id, "p-9");
  assert.equal(engine.seen[0].normalized.prompt, "hola");
});

test("SessionStart forwards every documented source and fails closed on an unknown one", () => {
  for (const source of SESSION_SOURCES) {
    const engine = recorder();
    handle(event({hook_event_name: "SessionStart", source}), {engine: engine.engine});
    assert.equal(engine.seen[0].normalized.source, source);
  }
  const engine = recorder();
  const result = handle(event({hook_event_name: "SessionStart", source: "teleport"}), {engine: engine.engine});
  assert.equal(engine.seen.length, 0);
  assert.match(result.systemMessage, /unsupported|unknown/i);
});

test("missing required fields fail closed without reaching the engine", () => {
  const cases = [
    {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {}, session_id: undefined},
    {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {}, cwd: undefined},
    {hook_event_name: undefined},
    {hook_event_name: "Interrupt"},
    {hook_event_name: "PreToolUse", tool_name: "Bash"},
  ];
  for (const fields of cases) {
    const engine = recorder();
    const result = handle(event(fields), {engine: engine.engine});
    assert.equal(engine.seen.length, 0, JSON.stringify(fields));
    assert.notEqual(result, null, JSON.stringify(fields));
  }
});

test("a fail-closed PreToolUse denies and a fail-closed other event only reports", () => {
  const denied = handle(event({hook_event_name: "PreToolUse", tool_name: "Bash"}), {engine: recorder().engine});
  assert.equal(isDeny(denied), true);
  const reported = handle(event({hook_event_name: "SessionStart", source: "teleport"}), {engine: recorder().engine});
  assert.equal(isDeny(reported), false);
  assert.equal(typeof reported.systemMessage, "string");
});

test("PostToolUseFailure becomes an explicit failed PostToolUse result", () => {
  const engine = recorder({hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: "note"}});
  const result = handle(
    event({
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      tool_input: {command: "npm test"},
      tool_use_id: "toolu_1",
      error: "Exit code 1\nboom",
      is_interrupt: false,
    }),
    {engine: engine.engine},
  );
  const normalized = engine.seen[0].normalized;
  assert.equal(normalized.hook_event_name, "PostToolUse");
  assert.equal(normalized.tool_use_id, "toolu_1");
  assert.equal(normalized.tool_response.isError, true);
  assert.match(String(normalized.tool_response.output), /Exit code 1/);
  assert.equal(result.hookSpecificOutput.hookEventName, "PostToolUseFailure");
});

test("an interrupted failure is never resolved as an ordinary failed operation", () => {
  const engine = recorder();
  const result = handle(
    event({
      hook_event_name: "PostToolUseFailure",
      tool_name: "Write",
      tool_input: {file_path: "/tmp/x", content: "y"},
      tool_use_id: "toolu_2",
      error: "aborted",
      is_interrupt: true,
    }),
    {engine: engine.engine},
  );
  assert.equal(engine.seen.length, 0);
  const text = JSON.stringify(result);
  assert.equal(/no effect|succeeded|success/i.test(text), false);
  assert.match(text, /unknown/i);
});

test("post events for a non-engine tool are not forwarded", () => {
  for (const name of ["Read", "AskUserQuestion", "PowerShell", "NotebookEdit"]) {
    for (const hook of ["PostToolUse", "PostToolUseFailure"]) {
      const engine = recorder();
      handle(
        event({hook_event_name: hook, tool_name: name, tool_input: {}, tool_use_id: "t", error: "e", tool_response: {}}),
        {engine: engine.engine},
      );
      assert.equal(engine.seen.length, 0, name + " " + hook);
    }
  }
});

test("Stop keeps the engine's block decision and its reason verbatim", () => {
  const engine = recorder({decision: "block", reason: "Blocked — one exact next action."});
  const result = handle(
    event({hook_event_name: "Stop", last_assistant_message: "text", stop_hook_active: false}),
    {engine: engine.engine},
  );
  assert.deepEqual(result, {decision: "block", reason: "Blocked — one exact next action."});
});

test("Stop passes a non-blocking engine answer through unchanged", () => {
  const engine = recorder({systemMessage: "Note — continue."});
  const result = handle(event({hook_event_name: "Stop", last_assistant_message: "", stop_hook_active: true}), {engine: engine.engine});
  assert.deepEqual(result, {systemMessage: "Note — continue."});
});

test("an engine receipt rewrite keeps its allow and its no-op input", () => {
  const engine = recorder({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: {command: 'node -e ""'},
    },
  });
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "pmnm-guard status"}, tool_use_id: "t"}),
    {engine: engine.engine},
  );
  assert.equal(result.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(result.hookSpecificOutput.updatedInput.command, 'node -e ""');
});

test("the output hookEventName always names the real Claude event", () => {
  const engine = recorder({hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: "x"}});
  const result = handle(
    event({hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {command: "x"}, tool_use_id: "t", error: "e"}),
    {engine: engine.engine},
  );
  assert.equal(result.hookSpecificOutput.hookEventName, "PostToolUseFailure");
});

test("an engine failure fails closed with a bounded diagnostic", () => {
  const thrower = () => {
    throw new Error("x".repeat(5000));
  };
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t"}),
    {engine: thrower},
  );
  assert.equal(isDeny(result), true);
  assert.ok(JSON.stringify(result).length < 2000);
});

test("every emitted answer is bounded", () => {
  const engine = recorder({systemMessage: "y".repeat(20000)});
  const result = handle(event({hook_event_name: "Stop", last_assistant_message: "", stop_hook_active: false}), {engine: engine.engine});
  assert.ok(JSON.stringify(result).length < 4000);
});

test("the adapter never imports the engine's testing surface", () => {
  const source = fs.readFileSync(adapterPath, "utf8");
  assert.equal(/\btesting\b/.test(source), false);
  const local = [...source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((item) => !item.startsWith("node:"));
  assert.deepEqual(local, ["../pmnm-guard.mjs"]);
});

test("the adapter declares no execution, network or dynamic-code capability", () => {
  const source = fs.readFileSync(adapterPath, "utf8");
  for (const forbidden of ["child_process", "spawnSync(", "spawn(", "exec(", "execSync(", "fetch(", "http://", "https://", "eval(", "new Function"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(source.includes("transcript_path"), false);
});

test("the module runs as a host entry and stays silent for an unobserved tool", () => {
  const run = (payload) =>
    spawnSync(process.execPath, [adapterPath], {input: JSON.stringify(payload), encoding: "utf8"});

  const quiet = run(event({hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", tool_input: {}}));
  assert.equal(quiet.status, 0);
  assert.equal(quiet.stdout, "");

  const blocked = run(event({hook_event_name: "PreToolUse", tool_name: "PowerShell", tool_input: {command: "x"}}));
  assert.equal(blocked.status, 0);
  assert.equal(JSON.parse(blocked.stdout).hookSpecificOutput.permissionDecision, "deny");

  const unknown = run(event({hook_event_name: "Interrupt"}));
  assert.equal(unknown.status, 0);
  assert.match(JSON.parse(unknown.stdout).systemMessage, /unsupported or unknown host event/);

  const malformed = spawnSync(process.execPath, [adapterPath], {input: "{not json", encoding: "utf8"});
  assert.equal(malformed.status, 2);
});

// Required fields and malformed entry.

const REQUIRED_CASES = [
  ["SessionStart", {hook_event_name: "SessionStart"}],
  ["SessionStart bad source", {hook_event_name: "SessionStart", source: "teleport"}],
  ["UserPromptSubmit", {hook_event_name: "UserPromptSubmit"}],
  ["UserPromptSubmit wrong type", {hook_event_name: "UserPromptSubmit", prompt: 7}],
  ["Stop missing flag", {hook_event_name: "Stop", last_assistant_message: "x"}],
  ["Stop wrong flag type", {hook_event_name: "Stop", last_assistant_message: "x", stop_hook_active: "yes"}],
  ["Stop missing message", {hook_event_name: "Stop", stop_hook_active: false}],
  ["PreToolUse missing tool_use_id", {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}}],
  ["PreToolUse wrong tool_input", {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: [], tool_use_id: "t"}],
  ["PostToolUse missing response", {hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_use_id: "t"}],
  ["PostToolUse missing id", {hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_response: {}}],
  ["PostToolUseFailure missing error", {hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, tool_use_id: "t"}],
  ["PostToolUseFailure wrong error type", {hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, tool_use_id: "t", error: {}}],
];

test("every registered event rejects a missing or wrong-typed required field", () => {
  for (const [label, fields] of REQUIRED_CASES) {
    const engine = recorder();
    const result = handle(event(fields), {engine: engine.engine});
    assert.equal(engine.seen.length, 0, label + " reached the engine");
    assert.notEqual(result, null, label + " produced no host-visible answer");
  }
});

test("a rejected PreToolUse denies while a rejected lifecycle or post event only reports", () => {
  for (const [label, fields] of REQUIRED_CASES) {
    const result = handle(event(fields), {engine: recorder().engine});
    if (fields.hook_event_name === "PreToolUse") {
      assert.equal(isDeny(result), true, label);
    } else {
      assert.equal(isDeny(result), false, label);
      assert.equal(typeof result.systemMessage, "string", label);
    }
  }
});

test("a complete event for every registered shape still reaches the engine", () => {
  const complete = [
    {hook_event_name: "SessionStart", source: "startup"},
    {hook_event_name: "UserPromptSubmit", prompt: ""},
    {hook_event_name: "Stop", last_assistant_message: "", stop_hook_active: false},
    {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t"},
    {hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t", tool_response: {}},
    {hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t", error: "Exit code 1"},
  ];
  for (const fields of complete) {
    const engine = recorder();
    handle(event(fields), {engine: engine.engine});
    assert.equal(engine.seen.length, 1, fields.hook_event_name);
  }
});

test("malformed or oversized stdin blocks through the host-native exit code", () => {
  const malformed = spawnSync(process.execPath, [adapterPath], {input: "{not json", encoding: "utf8"});
  assert.equal(malformed.status, 2);
  assert.match(malformed.stderr, /PMNM/);

  const oversized = spawnSync(process.execPath, [adapterPath], {
    input: JSON.stringify({...BASE, hook_event_name: "Stop", filler: "x".repeat(1_100_000)}),
    encoding: "utf8",
  });
  assert.equal(oversized.status, 2);
});

// Subagent material effects stay denied until proven.

test("a supported material subagent call is denied until its contracts pass", () => {
  for (const name of ["Bash", "Edit", "Write"]) {
    const engine = recorder();
    const result = handle(
      event({
        hook_event_name: "PreToolUse",
        tool_name: name,
        tool_input: {command: "ls", file_path: "/tmp/x", content: "y", new_string: "y"},
        tool_use_id: "t",
        agent_id: "agent-1",
        agent_type: "Explore",
      }),
      {engine: engine.engine},
    );
    assert.equal(isDeny(result), true, name);
    assert.match(result.hookSpecificOutput.permissionDecisionReason, /subagent/i);
    assert.equal(engine.seen.length, 0, name);
  }
});

test("subagent identity never enters the engine event", () => {
  const engine = recorder();
  handle(
    event({hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t", tool_response: {}, agent_id: "agent-1"}),
    {engine: engine.engine},
  );
  for (const seen of engine.seen) {
    assert.equal("agent_id" in seen.normalized, false);
    assert.equal("agent_type" in seen.normalized, false);
  }
});

test("a parent call with no agent identity is unaffected", () => {
  const engine = recorder();
  handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t"}),
    {engine: engine.engine},
  );
  assert.equal(engine.seen.length, 1);
});

test("an unobserved subagent call keeps its parent disposition", () => {
  const engine = recorder();
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", tool_input: {}, tool_use_id: "t", agent_id: "agent-1"}),
    {engine: engine.engine},
  );
  assert.equal(result, null);
  assert.equal(engine.seen.length, 0);
});

test("a subagent call to an unsupported mutating tool stays unsupported, not subagent-denied", () => {
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "NotebookEdit", tool_input: {}, tool_use_id: "t", agent_id: "a"}),
    {engine: recorder().engine},
  );
  assert.match(result.hookSpecificOutput.permissionDecisionReason, /unsupported/i);
});

// An interrupted result never resolves a pending operation.

function interruptedFailure() {
  return event({
    hook_event_name: "PostToolUseFailure",
    tool_name: "Write",
    tool_input: {file_path: "/tmp/x", content: "y"},
    tool_use_id: "toolu_interrupt",
    error: "aborted",
    is_interrupt: true,
  });
}

test("an interrupted failure never reaches the shared engine", () => {
  const engine = recorder();
  const result = handle(interruptedFailure(), {engine: engine.engine});
  assert.equal(engine.seen.length, 0);
  assert.notEqual(result, null);
  assert.match(JSON.stringify(result), /unknown|reconcil/i);
});

test("an interrupted failure leaves real engine state byte-identical", () => {
  const before = pendingState();
  const after = structuredClone(before);
  const engine = (normalized, options) => processEvent(after, normalized, options).output;
  handle(interruptedFailure(), {engine});
  assert.deepEqual(after, before);
  assert.equal(after.pending_writes.length, 1);
  assert.equal(after.effect_count, before.effect_count);
  assert.equal(after.verification_count, before.verification_count);
});

test("the real engine still asks to reconcile the surviving pending operation", () => {
  const state = pendingState();
  const engine = (normalized, options) => processEvent(state, normalized, options).output;
  const result = handle(
    event({hook_event_name: "Stop", last_assistant_message: "", stop_hook_active: false}),
    {engine},
  );
  assert.equal(result.decision, "block");
  assert.match(result.reason, /Blocked/);
  assert.doesNotMatch(result.reason, /Bloqueado/);
});

test("a non-interrupted failure still reaches the engine as an explicit failed result", () => {
  const engine = recorder();
  handle(
    event({
      hook_event_name: "PostToolUseFailure",
      tool_name: "Write",
      tool_input: {file_path: "/tmp/x", content: "y"},
      tool_use_id: "toolu_plain",
      error: "Exit code 1\nboom",
      is_interrupt: false,
    }),
    {engine: engine.engine},
  );
  assert.equal(engine.seen.length, 1);
  assert.equal(engine.seen[0].normalized.tool_response.isError, true);
  assert.equal(engine.seen[0].normalized.tool_response.exit_code, 1);
});

// The recovery card follows the Claude configuration root.

test("an unreadable pointer names the Claude root, end to end through the adapter", () => {
  // A real unreadable pointer: the engine recomputes pointer status from disk,
  // so the precondition has to exist on disk rather than in a state field.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-claude-root-"));
  fs.mkdirSync(path.join(root, "pmnm.path"));
  const environment = {CLAUDE_CONFIG_DIR: root};
  assert.equal(configRoot(environment), root);

  const state = testing.baseState();
  let card = "";
  const engine = (normalized, options) => {
    const result = processEvent(state, normalized, options);
    card = JSON.stringify(result.output);
    return result.output;
  };
  handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "pmnm-guard status"}, tool_use_id: "t"}),
    {engine, environment},
  );
  fs.rmSync(root, {recursive: true, force: true});
  assert.match(card, new RegExp(path.join(root, "pmnm.path").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(card.includes(path.join(os.homedir(), ".codex")), false);
});

// --- correction round: is_interrupt must be a boolean when present -----------

const HOST_NEUTRAL_RECEIPT =
  "Send the `pmnm-guard` receipt as a shell-tool command. The active host adapter intercepts it before shell execution.";

test("a present non-boolean is_interrupt is rejected before the engine", () => {
  for (const value of ["true", "false", 1, 0, null, {}, []]) {
    const engine = recorder();
    const result = handle(
      event({
        hook_event_name: "PostToolUseFailure",
        tool_name: "Write",
        tool_input: {file_path: "/tmp/x", content: "y"},
        tool_use_id: "t",
        error: "boom",
        is_interrupt: value,
      }),
      {engine: engine.engine},
    );
    assert.equal(engine.seen.length, 0, JSON.stringify(value));
    assert.notEqual(result, null, JSON.stringify(value));
    assert.equal(isDeny(result), false, JSON.stringify(value));
  }
});

test("the three valid is_interrupt forms keep their dispositions", () => {
  const base = {
    hook_event_name: "PostToolUseFailure",
    tool_name: "Write",
    tool_input: {file_path: "/tmp/x", content: "y"},
    tool_use_id: "t",
    error: "Exit code 1\nboom",
  };

  const absent = recorder();
  handle(event(base), {engine: absent.engine});
  assert.equal(absent.seen.length, 1, "absent forwards");

  const explicitFalse = recorder();
  handle(event({...base, is_interrupt: false}), {engine: explicitFalse.engine});
  assert.equal(explicitFalse.seen.length, 1, "false forwards");

  const explicitTrue = recorder();
  const result = handle(event({...base, is_interrupt: true}), {engine: explicitTrue.engine});
  assert.equal(explicitTrue.seen.length, 0, "true never forwards");
  assert.match(JSON.stringify(result), /unknown/i);
});

test("the shared receipt card names the active host adapter, not one host", () => {
  // The declaration card is reachable only once a task is open, so the fixture opens one first.
  let state = testing.baseState();
  let card = "";
  const engine = (normalized, options) => {
    const result = processEvent(state, normalized, options);
    state = result.state;
    card = JSON.stringify(result.output);
    return result.output;
  };
  handle(event({hook_event_name: "UserPromptSubmit", prompt: "Investigate this task"}), {engine});
  handle(
    event({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {command: "pmnm-guard start task=TASK-101 effort=standard work=implementation"},
      tool_use_id: "start",
    }),
    {engine},
  );
  handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t"}),
    {engine},
  );
  assert.ok(card.includes(HOST_NEUTRAL_RECEIPT.replace(/`/g, "`")), "card: " + card);
  assert.ok(card.includes("use this shell tool to submit `pmnm-guard declare"), "card: " + card);
  assert.ok(card.includes("then rerun the exact blocked command"), "card: " + card);
  assert.equal(/Codex/i.test(card), false, "card names a single host: " + card);
});

// --- fidelity: adapter cards obey the documented card grammar ---------------

// The model-facing channels only. On a denial Claude shows the reason to the
// model and never to the human, so a separate short human line is not a card.
function cardsIn(result) {
  if (!result) return [];
  const specific = result.hookSpecificOutput || {};
  const model = [specific.permissionDecisionReason, specific.additionalContext, result.reason]
    .filter((value) => typeof value === "string" && value.length > 0);
  if (model.length) return model;
  return typeof result.systemMessage === "string" && result.systemMessage ? [result.systemMessage] : [];
}

const CARD_CASES = [
  ["unsupported", {hook_event_name: "PreToolUse", tool_name: "PowerShell", tool_input: {command: "x"}, tool_use_id: "t"}],
  ["subagent", {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t", agent_id: "a"}],
  ["fail-closed pre", {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}}],
  ["fail-closed other", {hook_event_name: "SessionStart", source: "teleport"}],
  ["interrupted", {
    hook_event_name: "PostToolUseFailure",
    tool_name: "Write",
    tool_input: {file_path: "/tmp/x", content: "y"},
    tool_use_id: "t",
    error: "aborted",
    is_interrupt: true,
  }],
];

test("every adapter-authored card is two lines with a level and one NEXT", () => {
  for (const [label, fields] of CARD_CASES) {
    const cards = cardsIn(handle(event(fields), {engine: recorder().engine}));
    assert.equal(cards.length, 1, label + " produced " + cards.length + " cards");
    const lines = cards[0].split("\n");
    assert.equal(lines.length, 2, label + " is not two lines: " + cards[0]);
    assert.match(lines[0], /^(Blocked|Ask|Note): \S/, label + " has no level: " + lines[0]);
    assert.match(lines[1], /^NEXT: \S/, label + " has no NEXT: " + lines[1]);
  }
});

test("a NEXT line orders one action, never a choice", () => {
  for (const [label, fields] of CARD_CASES) {
    const next = cardsIn(handle(event(fields), {engine: recorder().engine}))[0].split("\n")[1];
    assert.equal(/\bor\b/.test(next), false, label + " offers a choice: " + next);
  }
});

test("no adapter card claims a blocked call was left unguarded", () => {
  for (const [label, fields] of CARD_CASES) {
    const card = cardsIn(handle(event(fields), {engine: recorder().engine}))[0];
    if (card.startsWith("Blocked:")) {
      assert.equal(/unguarded|unprotected/i.test(card), false, label + " contradicts itself: " + card);
    }
  }
});

test("the first card line states what happened and stays within the card bound", () => {
  for (const [label, fields] of CARD_CASES) {
    const lines = cardsIn(handle(event(fields), {engine: recorder().engine}))[0].split("\n");
    assert.ok(lines[0].length <= 430, label + " first line is too long");
    assert.ok(lines[1].length <= 1800, label + " NEXT line is too long");
  }
});

test("an engine card keeps its two lines through translation", () => {
  const engine = () => ({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Blocked: something happened.\nNEXT: do one thing.",
    },
  });
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t"}),
    {engine},
  );
  const card = result.hookSpecificOutput.permissionDecisionReason;
  assert.equal(card.split("\n").length, 2, "card was flattened: " + JSON.stringify(card));
  assert.match(card.split("\n")[1], /^NEXT: /);
});

test("a bounded engine answer still collapses runaway whitespace", () => {
  const engine = () => ({systemMessage: "Note:   padded    text.\n\n\n\nNEXT: act once."});
  const result = handle(event({hook_event_name: "Stop", last_assistant_message: "", stop_hook_active: false}), {engine});
  assert.equal(result.systemMessage.includes("   "), false);
  assert.equal(result.systemMessage.split("\n").length, 2);
});

// --- the human gets one short line; the model gets the exact action ---------

test("a blocked step tells the human one short line and Claude the full card", () => {
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "PowerShell", tool_input: {command: "x"}, tool_use_id: "t"}),
    {engine: recorder().engine},
  );
  const forModel = result.hookSpecificOutput.permissionDecisionReason;
  const forHuman = result.systemMessage;

  assert.equal(typeof forHuman, "string", "the human was told nothing");
  assert.ok(forHuman.length <= 120, "the human line is not short: " + forHuman);
  assert.equal(forHuman.includes("\n"), false, "the human line is not one line");
  assert.match(forHuman, /^Please, Make No Mistakes /);

  assert.match(forModel, /^Blocked: /);
  assert.match(forModel.split("\n")[1], /^NEXT: /);
  assert.ok(forModel.length > forHuman.length, "the model card lost its detail");
});

test("the human line never replaces or duplicates the model's next action", () => {
  for (const [, fields] of CARD_CASES) {
    const result = handle(event(fields), {engine: recorder().engine});
    if (!result?.hookSpecificOutput?.permissionDecisionReason) continue;
    assert.equal(result.systemMessage.includes("NEXT:"), false, "the human line repeats the receipt");
  }
});

// --- deeper adversarial coverage --------------------------------------------

test("a tool name is matched exactly, never by prefix or case", () => {
  for (const name of ["Bash ", " Bash", "BashTool", "Edit2", "WriteFile", "bash", "edit", "write"]) {
    assert.equal(toolDisposition(name), "unobserved", name);
  }
  for (const name of ["powershell", "POWERSHELL", "notebookedit", "NotebookEdit "]) {
    assert.equal(toolDisposition(name), "unobserved", name);
  }
  assert.equal(toolDisposition("PowerShell"), "unsupported");
  assert.equal(toolDisposition("NotebookEdit"), "unsupported");
});

test("an MCP tool name is unobserved whatever it contains", () => {
  for (const name of [
    "mcp__server__tool",
    "mcp__plugin_x__deeply__nested__name",
    "mcp__" + "x".repeat(200),
    "mcp__server__Edit",
    "mcp__server__Bash",
  ]) {
    const engine = recorder();
    assert.equal(toolDisposition(name), "unobserved", name);
    assert.equal(handle(event({hook_event_name: "PreToolUse", tool_name: name, tool_input: {}, tool_use_id: "t"}), {engine: engine.engine}), null);
    assert.equal(engine.seen.length, 0, name);
  }
});

test("a malformed engine answer never crashes the adapter", () => {
  const events = [
    {hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t"},
    {hook_event_name: "Stop", last_assistant_message: "", stop_hook_active: false},
  ];
  for (const answer of [undefined, null, "text", 7, true, [], {hookSpecificOutput: null}, {hookSpecificOutput: "x"}]) {
    for (const fields of events) {
      const result = handle(event(fields), {engine: () => answer});
      if (result !== null) assert.equal(typeof result, "object", JSON.stringify(answer));
    }
  }
});

test("the engine's own event name is always corrected to the delivered one", () => {
  const wrong = {hookSpecificOutput: {hookEventName: "Interrupt", permissionDecision: "deny", permissionDecisionReason: "Blocked: x.\nNEXT: y."}};
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command: "ls"}, tool_use_id: "t"}),
    {engine: () => wrong},
  );
  assert.equal(result.hookSpecificOutput.hookEventName, "PreToolUse");
});

test("the adapter holds no state between calls", () => {
  const fields = {hook_event_name: "PreToolUse", tool_name: "PowerShell", tool_input: {command: "x"}, tool_use_id: "t"};
  const first = handle(event(fields), {engine: recorder().engine});
  const second = handle(event(fields), {engine: recorder().engine});
  assert.deepEqual(first, second, "two identical calls diverged");
});

test("the short human line appears only when the model is denied", () => {
  const cases = [
    [{hook_event_name: "PreToolUse", tool_name: "PowerShell", tool_input: {command: "x"}, tool_use_id: "t"}, true],
    [{hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", tool_input: {}, tool_use_id: "t"}, false],
    [{hook_event_name: "SessionStart", source: "teleport"}, false],
    [{hook_event_name: "PostToolUseFailure", tool_name: "Write", tool_input: {file_path: "/tmp/x", content: "y"}, tool_use_id: "t", error: "e", is_interrupt: true}, false],
  ];
  for (const [fields, expected] of cases) {
    const result = handle(event(fields), {engine: recorder().engine});
    const denied = Boolean(result?.hookSpecificOutput?.permissionDecision === "deny");
    const human = typeof result?.systemMessage === "string" && result.systemMessage.startsWith("Please, Make No Mistakes");
    assert.equal(denied && human, expected, JSON.stringify(fields.tool_name || fields.hook_event_name));
    if (!denied) assert.equal(human, false, "a non-denial carried the denial line");
  }
});

test("a forwarded operation keeps its identity exactly", () => {
  const engine = recorder();
  const input = {command: "npm test", description: "run the suite"};
  handle(
    event({hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: input, tool_use_id: "toolu_exact", prompt_id: "p-7"}),
    {engine: engine.engine},
  );
  const normalized = engine.seen[0].normalized;
  assert.equal(normalized.tool_use_id, "toolu_exact");
  assert.deepEqual(normalized.tool_input, input, "the tool input was altered");
  assert.equal(normalized.turn_id, "p-7");
});

test("an absent prompt_id adds no turn identity", () => {
  const engine = recorder();
  handle(event({hook_event_name: "SessionStart", source: "startup"}), {engine: engine.engine});
  assert.equal("turn_id" in engine.seen[0].normalized, false);
});

test("a hostile key in the host event cannot reach the engine", () => {
  const engine = recorder();
  const hostile = event({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: {command: "ls"},
    tool_use_id: "t",
    constructor: "x",
    toString: "x",
    phase: "COMPLETE",
    pending_writes: [],
  });
  handle(hostile, {engine: engine.engine});
  const normalized = engine.seen[0].normalized;
  assert.deepEqual(Object.keys(normalized).sort(), ["cwd", "hook_event_name", "session_id", "tool_input", "tool_name", "tool_use_id"]);
});

// --- RB: native reads are forwarded, not merely watched ---------------------

test("RB a read tool is its own disposition and reaches the engine", () => {
  for (const name of ["Read", "Glob", "Grep"]) {
    assert.equal(toolDisposition(name), "read", name);
    const engine = recorder();
    handle(
      event({hook_event_name: "PreToolUse", tool_name: name, tool_input: {file_path: "/tmp/x", pattern: "*"}, tool_use_id: "t"}),
      {engine: engine.engine},
    );
    assert.equal(engine.seen.length, 1, name + " never reached the engine");
    assert.equal(engine.seen[0].normalized.tool_name, name);
  }
});

test("RB a read result is not forwarded, because it cannot carry the file bytes", () => {
  for (const name of ["Read", "Glob", "Grep"]) {
    for (const hook of ["PostToolUse", "PostToolUseFailure"]) {
      const engine = recorder();
      handle(
        event({hook_event_name: hook, tool_name: name, tool_input: {file_path: "/tmp/x"}, tool_use_id: "t", tool_response: {}, error: "e"}),
        {engine: engine.engine},
      );
      assert.equal(engine.seen.length, 0, name + " " + hook);
    }
  }
});

test("RB a read still requires its declared fields", () => {
  const engine = recorder();
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "Read", tool_input: {file_path: "/tmp/x"}}),
    {engine: engine.engine},
  );
  assert.equal(engine.seen.length, 0, "a read with no tool_use_id was forwarded");
  assert.equal(isDeny(result), true);
});

test("RB a subagent read keeps the parent disposition and is not denied", () => {
  const engine = recorder();
  const result = handle(
    event({hook_event_name: "PreToolUse", tool_name: "Read", tool_input: {file_path: "/tmp/x"}, tool_use_id: "t", agent_id: "a"}),
    {engine: engine.engine},
  );
  assert.equal(isDeny(result), false, "a subagent read must not be blocked as a material effect");
  assert.equal(engine.seen.length, 1, "a subagent read is still routed");
});
