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
  processEvent,
  processPersistedEvent,
  testing,
} from "../hooks/pmnm-guard.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(ROOT, "evals", "host-guard-cases.json"), "utf8"),
);
const IMPLEMENTATION_PATCH =
  "*** Begin Patch\n*** Update File: example.txt\n@@\n-old\n+new\n*** End Patch";
const TEST_DIGEST = "a".repeat(64);

function initial() {
  return testing.baseState();
}

function event(name, turn = "turn-1", extra = {}) {
  return {
    session_id: "session-1",
    cwd: "/workspace",
    hook_event_name: name,
    turn_id: turn,
    permission_mode: "default",
    ...extra,
  };
}

function prompt(state, turn, text = "Investigate and implement the requested change") {
  return processEvent(
    state,
    event("UserPromptSubmit", turn, {prompt: text}),
    {now: 1},
  );
}

function pre(state, command, turn, id = "tool-1", name = "Bash", tokenFactory) {
  return processEvent(
    state,
    event("PreToolUse", turn, {
      tool_name: name,
      tool_use_id: id,
      tool_input: {command},
    }),
    {now: 2, tokenFactory},
  );
}

function post(state, command, turn, id = "tool-1", name = "Bash", response = "ok") {
  return processEvent(
    state,
    event("PostToolUse", turn, {
      tool_name: name,
      tool_use_id: id,
      tool_input: {command},
      tool_response: response,
    }),
    {now: 3},
  );
}

function route(
  state,
  turn,
  {
    effort = "standard",
    activity = "work-1",
    transition = "loaded",
    basis = 1,
    exception = null,
    locator = "registry-receipt",
    record = "record-receipt",
    authority = null,
  } = {},
) {
  let command =
    "pmnm-guard route effort=" +
    effort +
    " activity=" +
    activity +
    " transition=" +
    transition +
    " basis=" +
    basis;
  if (exception) {
    command += " exception=" + exception;
  }
  if (transition === "loaded" || transition === "created") {
    command += " locator=" + locator + " record=" + record;
  }
  if (transition === "planned-and-awaiting-approval") {
    command += " digest=" + TEST_DIGEST;
  }
  if (transition === "created") {
    command += " authority=" + (authority || TEST_DIGEST);
  } else if (authority) {
    command += " authority=" + authority;
  }
  return pre(state, command, turn, "route-" + basis);
}

function checkpoint(state, turn, basis = 1, kind = "combined") {
  return pre(
    state,
    "pmnm-guard checkpoint kind=" + kind + " basis=" + basis,
    turn,
    "checkpoint-" + basis,
  );
}

function align(state, turn, result = "accepted", basis = state.basis) {
  return pre(
    state,
    "pmnm-guard align result=" + result + " basis=" + basis,
    turn,
    "align-" + basis,
  );
}

function ready(
  state,
  turn,
  {
    basis = 1,
    alignment = "current",
    scenarios = "aligned",
    effects = "implementation,verification",
    capture = "current",
    delegation = null,
  } = {},
) {
  let command =
    "pmnm-guard ready basis=" +
    basis +
    " scope=focused-change effects=" +
    effects +
    " verification=focused-contract capture=" +
    capture +
    " alignment=" +
    alignment +
    " scenarios=" +
    scenarios +
    " constraints=repository-instructions capabilities=current-evidence-tools";
  if (delegation) {
    command += " delegation=" + delegation;
  }
  return pre(state, command, turn, "ready-" + basis);
}

function externalVerify(state, turn, result = "passed", source = "interface") {
  return pre(
    state,
    "pmnm-guard verify basis=" +
      state.basis +
      " result=" +
      result +
      " source=" +
      source +
      " scope=observable-contract",
    turn,
    "verify-" + state.basis,
  );
}

function durableCapture(state, turn, id = "capture") {
  state = pre(
    state,
    "pmnm-guard grant effect=durable-content authority=activity-record uses=1 basis=" +
      state.basis,
    turn,
    id + "-grant",
  ).state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    turn,
    id + "-write",
    "apply_patch",
  ).state;
  return post(
    state,
    IMPLEMENTATION_PATCH,
    turn,
    id + "-write",
    "apply_patch",
  ).state;
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
    result.output.hookSpecificOutput.updatedInput?.command ===
      testing.NO_OP_COMMAND
  );
}

function alignedStandardState() {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1").state;
  state = durableCapture(state, "turn-1", "initial-capture");
  state = checkpoint(state, "turn-1").state;
  state = prompt(state, "turn-2", "Proceed with that contract and coverage").state;
  state = align(state, "turn-2").state;
  state = durableCapture(state, "turn-2", "alignment-capture");
  return state;
}

test("fixture IDs are unique and every declared guard case is implemented", () => {
  const ids = FIXTURE.cases.map((entry) => entry.id);
  assert.equal(FIXTURE.schema_version, 1);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, Array.from({length: 60}, (_, index) => "HG-" + String(index + 1).padStart(3, "0")));
});

test("HG-001 denies a covered first write before routing", () => {
  const state = prompt(initial(), "turn-1").state;
  const result = pre(state, IMPLEMENTATION_PATCH, "turn-1", "write-1", "apply_patch");
  assert.equal(isDenied(result), true);
  assert.equal(result.state.phase, "ORIENT");
});

test("HG-002 rejects same-turn current alignment for Standard readiness", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1").state;
  const result = ready(state, "turn-1");
  assert.equal(isDenied(result), true);
  assert.equal(result.state.phase, "INVESTIGATE");
});

test("HG-003 opens a prompt-bound window only after a collaborator turn", () => {
  let state = alignedStandardState();
  const readiness = ready(state, "turn-2");
  assert.equal(isControlRecorded(readiness), true);
  assert.equal(readiness.state.phase, "READY");
  const write = pre(
    readiness.state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "write-1",
    "apply_patch",
  );
  assert.equal(write.output, null);
  const observed = post(
    write.state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "write-1",
    "apply_patch",
  );
  assert.equal(observed.state.phase, "IMPLEMENT");
  assert.equal(observed.state.mutation_count, 1);
});

test("HG-004 invalidates unused readiness on a new user prompt", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = prompt(state, "turn-3", "One more constraint").state;
  assert.equal(state.phase, "INVESTIGATE");
  assert.equal(state.readiness, null);
  assert.equal(
    isDenied(pre(state, IMPLEMENTATION_PATCH, "turn-3", "write-2", "apply_patch")),
    true,
  );
});

test("HG-005 enters recovery after post-mutation collaborator feedback", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "write-1", "apply_patch").state;
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "write-1",
    "apply_patch",
  ).state;
  state = prompt(state, "turn-3", "That finding changes the contract").state;
  state = align(state, "turn-3", "changed", 2).state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.basis, 2);
  assert.equal(state.readiness, null);
});

test("HG-006 binds an unknown-command permit to one exact retry", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1", {
    effort: "light",
    activity: "none",
    transition: "not-applicable",
  }).state;
  const unknown = pre(
    state,
    "python3 custom-check.py",
    "turn-1",
    "unknown-1",
    "Bash",
    () => "0123456789abcdef",
  );
  assert.equal(isDenied(unknown), true);
  assert.equal(unknown.state.pending_permit.token, "0123456789abcdef");
  const permit = pre(
    unknown.state,
    "pmnm-guard permit token=0123456789abcdef effect=investigation",
    "turn-1",
    "permit-1",
  );
  assert.equal(isControlRecorded(permit), true);
  const retry = pre(
    permit.state,
    "python3 custom-check.py",
    "turn-1",
    "unknown-2",
  );
  assert.equal(retry.output, null);
  const changed = pre(
    retry.state,
    "python3 custom-check.py --different",
    "turn-1",
    "unknown-3",
    "Bash",
    () => "fedcba9876543210",
  );
  assert.equal(isDenied(changed), true);
});

test("HG-007 keeps definite mutations outside the investigation permit path", () => {
  assert.deepEqual(classifyShell("mkdir generated"), {
    kind: "write",
    effect: "structure",
    reason: "definite-pattern",
  });
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1", {
    effort: "light",
    activity: "none",
    transition: "not-applicable",
  }).state;
  const result = pre(
    state,
    "mkdir generated",
    "turn-1",
    "mkdir-1",
    "Bash",
    () => "0123456789abcdef",
  );
  assert.equal(isDenied(result), true);
  assert.equal(result.state.pending_permit, null);
  assert.equal(classifyShell("rm generated").effect, "deletion");
  assert.equal(classifyShell("mv source target").effect, "movement");
});

test("HG-008 separates delegated durable capture from implementation", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1", {effort: "standard", transition: "loaded"}).state;
  state = pre(
    state,
    "pmnm-guard grant effect=durable-content authority=activity-record uses=1 basis=1",
    "turn-1",
    "grant-1",
  ).state;
  const capture = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-1",
    "capture-1",
    "apply_patch",
  );
  assert.equal(capture.output, null);
  const observed = post(
    capture.state,
    IMPLEMENTATION_PATCH,
    "turn-1",
    "capture-1",
    "apply_patch",
  );
  assert.equal(observed.state.mutation_count, 0);
  assert.equal(observed.state.phase, "INVESTIGATE");
  assert.equal(
    isDenied(
      pre(
        observed.state,
        IMPLEMENTATION_PATCH,
        "turn-1",
        "capture-2",
        "apply_patch",
      ),
    ),
    true,
  );
});

test("HG-009 preserves one authority checkpoint across an approved record transition", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1", {
    effort: "standard",
    transition: "planned-and-awaiting-approval",
  }).state;
  state = checkpoint(state, "turn-1", 1, "authority").state;
  state = prompt(state, "turn-2", "I approve the proposed record").state;
  state = align(state, "turn-2").state;
  const grant = pre(
    state,
    "pmnm-guard grant effect=durable-structure authority=" + TEST_DIGEST + " uses=1 basis=1",
    "turn-2",
    "grant-structure",
  );
  assert.equal(isControlRecorded(grant), true);
  const mkdir = pre(
    grant.state,
    "mkdir activity-record",
    "turn-2",
    "mkdir-activity",
  );
  assert.equal(mkdir.output, null);
  state = post(
    mkdir.state,
    "mkdir activity-record",
    "turn-2",
    "mkdir-activity",
  ).state;
  const transitioned = route(state, "turn-2", {
    effort: "standard",
    transition: "created",
  });
  assert.equal(transitioned.state.phase, "ALIGNED");
});

test("HG-010 continues once for closure and then permits a bounded stop", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "write-1", "apply_patch").state;
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "write-1",
    "apply_patch",
  ).state;
  const first = processEvent(state, event("Stop", "turn-2"), {now: 4});
  assert.equal(first.output.decision, "block");
  assert.equal(first.state.phase, "VERIFY");
  const second = processEvent(
    first.state,
    event("Stop", "turn-2", {stop_hook_active: true}),
    {now: 5},
  );
  assert.match(second.output.systemMessage, /not continue again automatically/i);
  let captured = durableCapture(first.state, "turn-2", "final-capture");
  captured = externalVerify(captured, "turn-2").state;
  const complete = pre(
    captured,
    "pmnm-guard complete basis=1 verification=passed observable=executed protection=added-or-updated capture=complete audit=passed",
    "turn-2",
    "complete-1",
  );
  assert.equal(complete.state.phase, "COMPLETE");
  const stopped = processEvent(complete.state, event("Stop", "turn-2"), {now: 6});
  assert.equal(stopped.output, null);
});

test("HG-011 keeps bounded state without raw prompt or command content", () => {
  const rawPrompt = "secret-like prompt text that must not persist";
  const rawActivity = "private-work-item";
  let state = prompt(initial(), "turn-1", rawPrompt).state;
  state = route(state, "turn-1", {activity: rawActivity}).state;
  for (let index = 0; index < testing.MAX_EVENTS + 40; index += 1) {
    state = processEvent(
      state,
      event("SessionStart", "turn-1", {source: "compact"}),
      {now: index + 10},
    ).state;
  }
  const serialized = JSON.stringify(state);
  assert.equal(serialized.includes(rawPrompt), false);
  assert.equal(serialized.includes(rawActivity), false);
  assert.equal(serialized.includes(IMPLEMENTATION_PATCH), false);
  assert.equal(state.events.length, testing.MAX_EVENTS);
  assert.ok(Buffer.byteLength(serialized) < 65_536);
});

test("HG-012 fails closed for corrupt persisted state on a covered write", () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-host-guard-"));
  try {
    processPersistedEvent(
      event("UserPromptSubmit", "turn-1", {prompt: "Start work"}),
      {dataRoot, now: 1},
    );
    const stateDirectory = path.join(dataRoot, "host-guard", "v1");
    const stateFile = fs
      .readdirSync(stateDirectory)
      .map((name) => path.join(stateDirectory, name))
      .find((candidate) => candidate.endsWith(".json"));
    fs.writeFileSync(stateFile, "{corrupt", "utf8");
    const child = spawnSync(
      process.execPath,
      [path.join(ROOT, "hooks", "pmnm-guard.mjs")],
      {
        input: JSON.stringify(
          event("PreToolUse", "turn-1", {
            tool_name: "apply_patch",
            tool_use_id: "write-1",
            tool_input: {command: IMPLEMENTATION_PATCH},
          }),
        ),
        encoding: "utf8",
        env: {...process.env, PLUGIN_DATA: dataRoot},
      },
    );
    assert.equal(child.status, 0);
    assert.equal(
      JSON.parse(child.stdout).hookSpecificOutput.permissionDecision,
      "deny",
    );
  } finally {
    fs.rmSync(dataRoot, {recursive: true, force: true});
  }
});

test("HG-013 refuses to exempt sensitive effect classes", () => {
  let state = prompt(initial(), "turn-1").state;
  const result = pre(
    state,
    "pmnm-guard exempt reason=simple-task effects=publication",
    "turn-1",
    "exempt-1",
  );
  assert.equal(isDenied(result), true);
  assert.equal(result.state.phase, "ORIENT");
});

test("HG-014 classifies common checks as verification effects", () => {
  for (const command of [
    "npm test",
    "yarn run lint",
    "pnpm run typecheck",
    "pytest tests/unit",
    "cargo test",
    "go test ./...",
    "dotnet test",
  ]) {
    assert.equal(classifyShell(command).effect, "verification", command);
  }
});

test("HG-015 preserves an in-flight implementation across collaborator feedback", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "write-in-flight", "apply_patch").state;
  assert.equal(state.pending_writes.length, 1);

  state = prompt(state, "turn-3", "Stop, that evidence changes the direction").state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.basis, 2);
  assert.equal(state.pending_writes.length, 1);

  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "write-in-flight",
    "apply_patch",
  ).state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.basis, 2);
  assert.equal(state.mutation_count, 1);
  assert.equal(state.pending_writes.length, 0);
});

test("HG-016 keeps sensitive effects outside implementation readiness", () => {
  const state = alignedStandardState();
  for (const effect of [
    "structure",
    "dependencies",
    "environment",
    "version-control",
    "external",
    "publication",
    "durable-structure",
    "movement",
    "deletion",
  ]) {
    const result = ready(state, "turn-2", {
      effects: "implementation," + effect,
    });
    assert.equal(isDenied(result), true, effect);
    assert.equal(result.state.phase, "ALIGNED", effect);
  }
});

test("HG-017 requires observed delegated capture before readiness and completion", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1").state;
  state = checkpoint(state, "turn-1").state;
  state = prompt(state, "turn-2", "Proceed with the aligned direction").state;
  state = align(state, "turn-2").state;
  assert.equal(isDenied(ready(state, "turn-2")), true);

  state = durableCapture(state, "turn-2", "readiness-capture");
  state = ready(state, "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "write-after-capture", "apply_patch").state;
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "write-after-capture",
    "apply_patch",
  ).state;

  const staleCompletion = pre(
    state,
    "pmnm-guard complete basis=1 verification=passed observable=executed protection=added-or-updated capture=complete audit=passed",
    "turn-2",
    "stale-complete",
  );
  assert.equal(isDenied(staleCompletion), true);

  state = durableCapture(staleCompletion.state, "turn-2", "completion-capture");
  state = externalVerify(state, "turn-2").state;
  const complete = pre(
    state,
    "pmnm-guard complete basis=1 verification=passed observable=executed protection=added-or-updated capture=complete audit=passed",
    "turn-2",
    "current-complete",
  );
  assert.equal(isControlRecorded(complete), true);
  assert.equal(complete.state.phase, "COMPLETE");
});

test("HG-018 invalidates capture freshness on a later collaborator prompt", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1").state;
  state = durableCapture(state, "turn-1", "before-checkpoint");
  state = checkpoint(state, "turn-1").state;
  state = prompt(state, "turn-2", "I confirm the direction").state;
  state = align(state, "turn-2").state;
  assert.equal(state.last_capture, null);
  assert.equal(isDenied(ready(state, "turn-2")), true);

  state = pre(
    state,
    "pmnm-guard grant effect=durable-content authority=activity-record uses=1 basis=1",
    "turn-2",
    "in-flight-capture-grant",
  ).state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "in-flight-capture-write",
    "apply_patch",
  ).state;
  state = prompt(state, "turn-3", "One more material correction").state;
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "in-flight-capture-write",
    "apply_patch",
  ).state;
  assert.equal(state.last_capture, null);
});

test("HG-019 requires closure before switching an implemented activity", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "activity-one-write",
    "apply_patch",
  ).state;

  const inFlightSwitch = route(state, "turn-2", {
    activity: "work-2",
    basis: 1,
  });
  assert.equal(isDenied(inFlightSwitch), true);

  state = post(
    inFlightSwitch.state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "activity-one-write",
    "apply_patch",
  ).state;
  const unclosedSwitch = route(state, "turn-2", {
    activity: "work-2",
    basis: 1,
  });
  assert.equal(isDenied(unclosedSwitch), true);
  assert.equal(unclosedSwitch.state.phase, "IMPLEMENT");

  state = durableCapture(unclosedSwitch.state, "turn-2", "activity-one-close-capture");
  state = pre(
    state,
    "pmnm-guard complete basis=1 verification=partial observable=reproducible-handoff protection=omitted-with-reason capture=complete audit=partial",
    "turn-2",
    "activity-one-complete",
  ).state;
  assert.equal(state.phase, "COMPLETE");

  const switched = route(state, "turn-2", {
    activity: "work-2",
    basis: 1,
  });
  assert.equal(isControlRecorded(switched), true);
  assert.equal(switched.state.phase, "INVESTIGATE");
  assert.equal(switched.state.mutation_count, 0);
});

test("HG-020 prevents route and exemption controls from escaping active work", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1").state;
  const routedExemption = pre(
    state,
    "pmnm-guard exempt reason=now-simple effects=implementation",
    "turn-1",
    "routed-exemption",
  );
  assert.equal(isDenied(routedExemption), true);

  state = durableCapture(routedExemption.state, "turn-1", "route-escape-capture");
  state = checkpoint(state, "turn-1").state;
  state = prompt(state, "turn-2", "Proceed").state;
  state = align(state, "turn-2").state;
  state = durableCapture(state, "turn-2", "route-escape-alignment-capture");
  state = ready(state, "turn-2").state;
  assert.equal(isDenied(route(state, "turn-2")), true);

  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "route-escape-write",
    "apply_patch",
  ).state;
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "route-escape-write",
    "apply_patch",
  ).state;
  assert.equal(isDenied(route(state, "turn-2")), true);

  state = prompt(state, "turn-3", "The basis changed").state;
  state = align(state, "turn-3", "changed", 2).state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(isDenied(route(state, "turn-3", {basis: 2})), true);
});

test("HG-021 refuses completion while a covered write is in flight", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "settled-write-one",
    "apply_patch",
  ).state;
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "settled-write-one",
    "apply_patch",
  ).state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "settled-write-two",
    "apply_patch",
  ).state;
  const premature = pre(
    state,
    "pmnm-guard complete basis=1 verification=partial observable=reproducible-handoff protection=omitted-with-reason capture=complete audit=partial",
    "turn-2",
    "premature-complete",
  );
  assert.equal(isDenied(premature), true);
  assert.equal(premature.state.pending_writes.length, 1);

  state = post(
    premature.state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "settled-write-two",
    "apply_patch",
  ).state;
  state = durableCapture(state, "turn-2", "settled-final-capture");
  const complete = pre(
    state,
    "pmnm-guard complete basis=1 verification=partial observable=reproducible-handoff protection=omitted-with-reason capture=complete audit=partial",
    "turn-2",
    "settled-complete",
  );
  assert.equal(isControlRecorded(complete), true);
});

test("HG-022 prevents effort downgrade and backward route basis", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1", {effort: "high", basis: 2}).state;
  assert.equal(
    isDenied(route(state, "turn-1", {effort: "standard", basis: 2})),
    true,
  );
  assert.equal(
    isDenied(route(state, "turn-1", {effort: "high", basis: 1})),
    true,
  );
  assert.equal(
    isControlRecorded(route(state, "turn-1", {effort: "high", basis: 3})),
    true,
  );
});

test("HG-023 keeps authority-only approval separate from direction readiness", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1").state;
  state = durableCapture(state, "turn-1", "authority-only-initial-capture");
  state = checkpoint(state, "turn-1", 1, "authority").state;
  state = prompt(state, "turn-2", "I approve that bounded authority").state;
  state = align(state, "turn-2").state;
  state = durableCapture(state, "turn-2", "authority-only-current-capture");
  assert.equal(isDenied(ready(state, "turn-2")), true);
  assert.equal(
    isDenied(
      ready(state, "turn-2", {
        scenarios: "delegated",
      }),
    ),
    true,
  );
});

test("HG-024 continues unresolved recovery once without looping", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "recovery-stop-write",
    "apply_patch",
  ).state;
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "recovery-stop-write",
    "apply_patch",
  ).state;
  state = prompt(state, "turn-3", "That evidence invalidates the direction").state;
  state = align(state, "turn-3", "changed", 2).state;
  assert.equal(state.phase, "RECOVERY");

  const first = processEvent(state, event("Stop", "turn-3"), {now: 4});
  assert.equal(first.output.decision, "block");
  assert.match(first.output.reason, /recovery is still open/i);
  const second = processEvent(
    first.state,
    event("Stop", "turn-3", {stop_hook_active: true}),
    {now: 5},
  );
  assert.match(second.output.systemMessage, /not continue again automatically/i);
});

test("HG-025 preserves an interrupted implementation write in recovery", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "interrupted-write",
    "apply_patch",
  ).state;
  state = processEvent(state, event("Interrupt", "turn-2"), {now: 4}).state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.basis, 2);
  assert.equal(state.pending_writes.length, 1);

  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "interrupted-write",
    "apply_patch",
  ).state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.mutation_count, 1);
});

test("HG-026 preserves a sensitive write across a later collaborator prompt", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1", {
    transition: "planned-and-awaiting-approval",
  }).state;
  state = checkpoint(state, "turn-1", 1, "authority").state;
  state = prompt(state, "turn-2", "I approve the exact structure plan").state;
  state = align(state, "turn-2").state;
  state = pre(
    state,
    "pmnm-guard grant effect=durable-structure authority=" + TEST_DIGEST + " uses=1 basis=1",
    "turn-2",
    "sensitive-grant",
  ).state;
  state = pre(
    state,
    "mkdir activity-record",
    "turn-2",
    "sensitive-write",
  ).state;
  state = prompt(state, "turn-3", "Pause, I need to change the location").state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.basis, 2);
  assert.equal(state.pending_writes.length, 1);
  state = post(
    state,
    "mkdir activity-record",
    "turn-2",
    "sensitive-write",
  ).state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.pending_writes.length, 0);
});

test("HG-027 preserves an exempt write until its result is observed", () => {
  let state = prompt(initial(), "turn-1").state;
  state = pre(
    state,
    "pmnm-guard exempt reason=isolated-prose-edit effects=implementation",
    "turn-1",
    "exempt-control",
  ).state;
  state = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-1",
    "exempt-write",
    "apply_patch",
  ).state;
  assert.equal(state.pending_writes.length, 1);

  state = prompt(state, "turn-2", "Start a different task").state;
  assert.equal(state.phase, "EXEMPT");
  assert.equal(state.pending_writes.length, 1);
  state = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-1",
    "exempt-write",
    "apply_patch",
  ).state;
  assert.equal(state.phase, "ORIENT");
  assert.equal(state.pending_writes.length, 0);
  assert.equal(state.current_turn_hash, testing.hash("turn-2"));
});

test("HG-028 requires explicit reconciliation of a collaborator response", () => {
  let state = prompt(initial(), "turn-1").state;
  state = route(state, "turn-1").state;
  state = checkpoint(state, "turn-1").state;
  state = prompt(state, "turn-2", "I do not understand that proposal").state;
  assert.equal(state.phase, "COLLABORATOR_RESPONDED");
  assert.equal(state.collaborator_result, null);
  assert.equal(isDenied(ready(state, "turn-2")), true);

  state = align(state, "turn-2", "unclear", 2).state;
  assert.equal(state.phase, "INVESTIGATE");
  assert.equal(state.basis, 2);
  assert.equal(state.readiness, null);
});

test("HG-029 serializes covered writes and recovers a missing post-use result", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "orphan-one", "apply_patch").state;

  const second = pre(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "orphan-two",
    "apply_patch",
  );
  assert.equal(isDenied(second), true);
  assert.equal(second.state.pending_writes.length, 1);

  const reconciled = pre(
    second.state,
    "pmnm-guard reconcile outcome=unknown reason=missing-post-use basis=2",
    "turn-2",
    "reconcile-orphan",
  );
  assert.equal(isControlRecorded(reconciled), true);
  assert.equal(reconciled.state.pending_writes.length, 0);
  assert.equal(reconciled.state.reconciled_writes.length, 1);
  assert.equal(reconciled.state.phase, "RECOVERY");
  assert.equal(reconciled.state.mutation_count, 1);
  assert.equal(isControlRecorded(checkpoint(reconciled.state, "turn-2", 2)), true);
});

test("HG-030 makes a contradictory late post-use result visible", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "late-write", "apply_patch").state;
  state = pre(
    state,
    "pmnm-guard reconcile outcome=failed-no-effect reason=tool-reported-failure basis=2",
    "turn-2",
    "reconcile-failed",
  ).state;
  assert.equal(state.mutation_count, 0);

  const late = post(
    state,
    IMPLEMENTATION_PATCH,
    "turn-2",
    "late-write",
    "apply_patch",
    {exit_code: 0, output: "applied"},
  );
  assert.equal(late.state.phase, "RECOVERY");
  assert.equal(late.state.basis, 3);
  assert.equal(late.state.mutation_count, 1);
  assert.match(late.output.hookSpecificOutput.additionalContext, /late host result/i);
});

test("HG-031 rejects stale or failed verification after a later mutation", () => {
  let state = alignedStandardState();
  state = ready(state, "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "verify-write-one", "apply_patch").state;
  state = post(state, IMPLEMENTATION_PATCH, "turn-2", "verify-write-one", "apply_patch").state;
  state = externalVerify(state, "turn-2").state;
  assert.equal(state.last_verification.result, "passed");

  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "verify-write-two", "apply_patch").state;
  assert.equal(state.last_verification, null);
  state = post(state, IMPLEMENTATION_PATCH, "turn-2", "verify-write-two", "apply_patch").state;
  state = durableCapture(state, "turn-2", "verify-final-capture");
  const stale = pre(
    state,
    "pmnm-guard complete basis=1 verification=passed observable=executed protection=added-or-updated capture=complete audit=passed",
    "turn-2",
    "stale-verification-complete",
  );
  assert.equal(isDenied(stale), true);

  state = externalVerify(stale.state, "turn-2", "failed").state;
  const failed = pre(
    state,
    "pmnm-guard complete basis=1 verification=passed observable=executed protection=added-or-updated capture=complete audit=passed",
    "turn-2",
    "failed-verification-complete",
  );
  assert.equal(isDenied(failed), true);

  state = externalVerify(failed.state, "turn-2", "passed").state;
  const complete = pre(
    state,
    "pmnm-guard complete basis=1 verification=passed observable=executed protection=added-or-updated capture=complete audit=passed",
    "turn-2",
    "current-verification-complete",
  );
  assert.equal(isControlRecorded(complete), true);
});

test("HG-032 requires concrete activity and durable-record receipts", () => {
  let state = prompt(initial(), "turn-1").state;
  const missingReceipts = pre(
    state,
    "pmnm-guard route effort=standard activity=work-1 transition=loaded basis=1",
    "turn-1",
    "missing-record-receipts",
  );
  assert.equal(isDenied(missingReceipts), true);

  const placeholder = pre(
    missingReceipts.state,
    "pmnm-guard route effort=standard activity=stable-id transition=loaded basis=1 locator=registry record=activity",
    "turn-1",
    "placeholder-activity",
  );
  assert.equal(isDenied(placeholder), true);
  assert.equal(isControlRecorded(route(placeholder.state, "turn-1")), true);
});

test("HG-033 rejects missing storage as a no-record exception", () => {
  let state = prompt(initial(), "turn-1").state;
  const invalid = route(state, "turn-1", {
    transition: "no-record-with-valid-reason",
    exception: "no-configured-store",
    authority: "self-decided",
  });
  assert.equal(isDenied(invalid), true);

  state = route(invalid.state, "turn-1", {transition: "blocked"}).state;
  state = checkpoint(state, "turn-1", 1, "authority").state;
  state = prompt(state, "turn-2", "Do not create a durable record for this activity").state;
  state = align(state, "turn-2").state;
  const explicit = route(state, "turn-2", {
    transition: "no-record-with-valid-reason",
    exception: "collaborator-declined-record",
    authority: "turn-2-decision",
  });
  assert.equal(isControlRecorded(explicit), true);
  assert.equal(explicit.state.phase, "ALIGNED");
});

test("HG-034 classifies common workspace verification commands", () => {
  for (const command of [
    "yarn workspace web-app lint",
    "yarn --cwd web-app lint",
    "yarn exec eslint src/example.ts",
    "npm -w web-app run lint",
    "pnpm --filter web-app test",
    "bun --cwd web-app run check",
    "eslint src/example.ts",
    "prettier --check src/example.ts",
  ]) {
    assert.equal(classifyShell(command).effect, "verification", command);
  }
  assert.equal(classifyShell("prettier --write src/example.ts").effect, "implementation");
});

test("HG-035 keeps unsupported Stop context options out of the hook manifest", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "hooks", "hooks.json"), "utf8"),
  );
  const stop = manifest.hooks.Stop[0].hooks[0];
  assert.equal(Object.hasOwn(stop, "additionalContextLimit"), false);
  assert.equal(
    manifest.hooks.PreToolUse[0].hooks[0].statusMessage,
    "Please, Guard the First Write",
  );
});

test("HG-036 uses a calm localized voice without storing raw prompts", () => {
  const rawPrompt = "Hola, quiero que revises este cambio antes de modificarlo";
  const result = prompt(initial(), "turn-1", rawPrompt);
  assert.equal(result.state.language, "es");
  assert.match(
    result.output.hookSpecificOutput.additionalContext,
    /^Please, Know the Work\n/,
  );
  assert.doesNotMatch(result.output.hookSpecificOutput.additionalContext, /\[PLS-/);
  assert.match(result.output.hookSpecificOutput.additionalContext, /resuelv\w* esfuerzo/i);
  assert.equal(JSON.stringify(result.state).includes(rawPrompt), false);

  const english = prompt(initial(), "turn-1-en", "Please investigate this change before editing it");
  assert.equal(english.state.language, "en");
  assert.match(english.output.hookSpecificOutput.additionalContext, /resolve effort/i);
  assert.doesNotMatch(english.output.hookSpecificOutput.additionalContext, /PMNM|\[PLS-/);
});

test("HG-037 keeps the friendly hook heading aligned with the portable router", () => {
  const skill = fs.readFileSync(
    path.join(ROOT, "skills", "please-make-no-mistakes", "SKILL.md"),
    "utf8",
  );
  const hostReference = fs.readFileSync(
    path.join(
      ROOT,
      "skills",
      "please-make-no-mistakes",
      "references",
      "host-enforcement.md",
    ),
    "utf8",
  );
  assert.match(skill, /registered `Please, \.\.\.` capability heading/);
  assert.match(hostReference, /registered `Please, \.\.\.` capability heading/);
  assert.doesNotMatch(skill, /begins with `PMNM guard`/);
  assert.doesNotMatch(hostReference, /begins with `PMNM guard`/);
});

test("control parser rejects compound or quoted control commands", () => {
  assert.throws(
    () => parseControlCommand("pmnm-guard status\nrm -rf example"),
    /one line/,
  );
  assert.throws(
    () => parseControlCommand("pmnm-guard route effort='high'"),
    /unsupported/,
  );
});

// ---------------------------------------------------------------------------
// P0-21 — single executable next action, retained denied intent, honest closure
// ---------------------------------------------------------------------------

import {spawn} from "node:child_process";

const CONTROL_LINE = /pmnm-guard [a-z-]+(?: [a-z-]+=[^\s]+)*/g;

function visibleText(result) {
  const output = result.output;
  if (!output) {
    return "";
  }
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

function controlCommands(text) {
  return (text.match(CONTROL_LINE) || []).map((command) => command.replace(/[,.;]+$/, ""));
}

function substitute(command, state) {
  if (/^pmnm-guard route\b/.test(command) && /transition=</.test(command)) {
    let concrete = command
      .replace(/activity=<[^>]+>/, "activity=work-1")
      .replace(/transition=<[^>]+>/, "transition=planned-and-awaiting-approval")
      .replace(/effort=<[^>]+>/, "effort=standard");
    if (!/digest=/.test(concrete)) {
      concrete += " digest=" + TEST_DIGEST;
    }
    return concrete;
  }
  return command.replace(/<([^>]+)>/g, (_, inner) => {
    const options = inner.split("|");
    const first = options[0];
    if (/digest|sha256/i.test(first)) {
      return TEST_DIGEST;
    }
    if (/higher/i.test(first)) {
      return String((state.basis || 1) + 1);
    }
    if (/count/i.test(first)) {
      return "1";
    }
    if (/^[a-z-]+$/.test(first) && options.length > 1) {
      return first;
    }
    return "x1";
  });
}

function assertSingleAction(result, label) {
  const text = visibleText(result);
  const commands = controlCommands(text);
  assert.ok(commands.length <= 1, label + ": more than one control command: " + commands.join(" || "));
  assert.doesNotMatch(text, /before retrying/i, label + ": appended grant branch");
  assert.doesNotMatch(text, /\[PLS-|PMNM guard/i, label + ": diagnostic label");
  assert.doesNotMatch(text, /\n#+\s|\nPlease, [A-Z][^\n]*\n[^\n]*\nPlease, /, label + ": nested heading");
  return {text, command: commands[0] || null};
}

function assertAdmissible(state, command, turn, label) {
  const concrete = substitute(command, state);
  const recorded = pre(state, concrete, turn, "self-check-" + Math.random().toString(16).slice(2));
  assert.equal(
    isControlRecorded(recorded),
    true,
    label + ": emitted command was rejected: " + concrete + " -> " + visibleText(recorded),
  );
  return recorded.state;
}

function plannedBlockedState() {
  let state = prompt(initial(), "turn-1", "Investigate and implement the requested change").state;
  return route(state, "turn-1", {transition: "planned-and-awaiting-approval"}).state;
}

function authorityAlignedPlannedState() {
  let state = plannedBlockedState();
  state = checkpoint(state, "turn-1", 1, "authority").state;
  state = prompt(state, "turn-2", "I approve the proposed record").state;
  return align(state, "turn-2").state;
}

function stopTwice(state, turn, now = 40) {
  const first = processEvent(state, event("Stop", turn), {now});
  const second = processEvent(
    first.state,
    event("Stop", turn, {stop_hook_active: true}),
    {now: now + 1},
  );
  return {first, second};
}

test("HG-038 every card and denial names one next action with at most one command", () => {
  const checks = [];
  let state = prompt(initial(), "turn-1").state;
  checks.push(["orient-card", prompt(initial(), "turn-1")]);
  checks.push(["orient-structure-denial", pre(state, "mkdir activity-record", "turn-1", "d1")]);
  checks.push(["orient-impl-denial", pre(state, IMPLEMENTATION_PATCH, "turn-1", "d2", "apply_patch")]);
  state = route(state, "turn-1").state;
  checks.push(["investigate-structure-denial", pre(state, "mkdir activity-record", "turn-1", "d3")]);
  checks.push(["investigate-impl-denial", pre(state, IMPLEMENTATION_PATCH, "turn-1", "d4", "apply_patch")]);
  checks.push(["investigate-card", prompt(state, "turn-2", "Keep going")]);
  let blocked = plannedBlockedState();
  checks.push(["blocked-card", prompt(blocked, "turn-2", "Here is the location")]);
  checks.push(["blocked-structure-denial", pre(blocked, "mkdir activity-record", "turn-1", "d5")]);
  const aligned = authorityAlignedPlannedState();
  checks.push(["aligned-authority-planned-card", pre(aligned, "pmnm-guard status", "turn-2", "s1")]);
  checks.push(["aligned-structure-denial", pre(aligned, "mkdir activity-record", "turn-2", "d6")]);
  let readyState = ready(alignedStandardState(), "turn-2").state;
  checks.push(["ready-sensitive-denial", pre(readyState, "git commit -m x", "turn-2", "d7")]);
  let implemented = pre(readyState, IMPLEMENTATION_PATCH, "turn-2", "w1", "apply_patch").state;
  implemented = post(implemented, IMPLEMENTATION_PATCH, "turn-2", "w1", "apply_patch").state;
  checks.push(["implement-sensitive-denial", pre(implemented, "npm publish", "turn-2", "d8")]);
  checks.push(["implement-stop", processEvent(implemented, event("Stop", "turn-2"), {now: 9})]);
  let recovering = prompt(implemented, "turn-3", "That changes the direction").state;
  recovering = align(recovering, "turn-3", "changed", 2).state;
  checks.push(["recovery-card", pre(recovering, "pmnm-guard status", "turn-3", "s2")]);
  checks.push(["recovery-structure-denial", pre(recovering, "mkdir x", "turn-3", "d9")]);
  for (const [label, result] of checks) {
    assertSingleAction(result, label);
  }
});

test("HG-039 every emitted control command is admissible from its own state", () => {
  const cases = [];
  const oriented = prompt(initial(), "turn-1").state;
  cases.push(["orient", oriented, prompt(initial(), "turn-1"), "turn-1"]);
  const investigating = route(oriented, "turn-1").state;
  cases.push(["investigate", investigating, pre(investigating, "pmnm-guard status", "turn-1", "s"), "turn-1"]);
  const blocked = plannedBlockedState();
  cases.push(["blocked", blocked, pre(blocked, "pmnm-guard status", "turn-1", "s"), "turn-1"]);
  let responded = checkpoint(investigating, "turn-1").state;
  responded = prompt(responded, "turn-2", "Proceed").state;
  cases.push(["collaborator-responded", responded, pre(responded, "pmnm-guard status", "turn-2", "s"), "turn-2"]);
  const alignedPlanned = authorityAlignedPlannedState();
  cases.push(["aligned-authority-planned", alignedPlanned, pre(alignedPlanned, "pmnm-guard status", "turn-2", "s"), "turn-2"]);
  let alignedNoCapture = prompt(initial(), "turn-1").state;
  alignedNoCapture = route(alignedNoCapture, "turn-1").state;
  alignedNoCapture = checkpoint(alignedNoCapture, "turn-1").state;
  alignedNoCapture = prompt(alignedNoCapture, "turn-2", "Proceed").state;
  alignedNoCapture = align(alignedNoCapture, "turn-2").state;
  cases.push(["aligned-combined-stale-capture", alignedNoCapture, pre(alignedNoCapture, "pmnm-guard status", "turn-2", "s"), "turn-2"]);
  const alignedReady = alignedStandardState();
  cases.push(["aligned-combined-ready", alignedReady, pre(alignedReady, "pmnm-guard status", "turn-2", "s"), "turn-2"]);
  const light = route(oriented, "turn-1", {effort: "light", activity: "none", transition: "not-applicable"}).state;
  cases.push(["light-impl-denial", light, pre(light, IMPLEMENTATION_PATCH, "turn-1", "d", "apply_patch"), "turn-1"]);
  const readyState = ready(alignedReady, "turn-2").state;
  cases.push(["ready-sensitive-denial", readyState, pre(readyState, "git commit -m x", "turn-2", "d"), "turn-2"]);
  let implemented = pre(readyState, IMPLEMENTATION_PATCH, "turn-2", "w1", "apply_patch").state;
  implemented = post(implemented, IMPLEMENTATION_PATCH, "turn-2", "w1", "apply_patch").state;
  cases.push(["implement-closure-step-1", implemented, pre(implemented, "pmnm-guard status", "turn-2", "s"), "turn-2"]);
  let recovering = prompt(implemented, "turn-3", "That changes the direction").state;
  recovering = align(recovering, "turn-3", "changed", 2).state;
  cases.push(["recovery-no-pending", recovering, pre(recovering, "pmnm-guard status", "turn-3", "s"), "turn-3"]);
  let pending = pre(readyState, IMPLEMENTATION_PATCH, "turn-2", "orphan", "apply_patch").state;
  const pendingDenial = pre(pending, IMPLEMENTATION_PATCH, "turn-2", "second", "apply_patch");
  cases.push(["recovery-pending", pendingDenial.state, pendingDenial, "turn-2"]);
  for (const [label, state, result, turn] of cases) {
    const {command} = assertSingleAction(result, label);
    assert.ok(command, label + ": no control command emitted");
    assertAdmissible(state, command, turn, label);
  }
});

test("HG-040 a denied write is retained as the unresolved cursor and Stop blocks once", () => {
  let state = prompt(initial(), "turn-1").state;
  const denied = pre(state, "mkdir activity-record", "turn-1", "mkdir-1");
  assert.equal(isDenied(denied), true);
  state = denied.state;
  assert.ok(state.pending_denied, "cursor missing after denial");
  assert.equal(state.pending_denied.effect, "structure");
  assert.equal(JSON.stringify(state).includes("mkdir activity-record"), false);

  const {first, second} = stopTwice(state, "turn-1");
  assert.equal(first.output.decision, "block");
  assert.match(first.output.reason, /pmnm-guard route/);
  assert.match(second.output.systemMessage, /not continue again automatically/i);
  assert.ok(second.state.pending_denied);

  state = route(second.state, "turn-1", {transition: "planned-and-awaiting-approval"}).state;
  assert.ok(state.pending_denied, "same-activity route must not clear the cursor");
  state = prompt(state, "turn-2", "I created the folder myself").state;
  assert.ok(state.pending_denied, "a later prompt must not clear the cursor");
  assert.match(pre(state, "pmnm-guard status", "turn-2", "s").output.hookSpecificOutput.additionalContext, /structure/);

  state = checkpoint(state, "turn-2", 1, "authority").state;
  const waiting = processEvent(state, event("Stop", "turn-2"), {now: 50});
  assert.equal(waiting.output, null, "a waiting-on-collaborator state must be allowed to stop");

  state = prompt(state, "turn-3", "Approved").state;
  state = align(state, "turn-3").state;
  state = pre(state, "pmnm-guard grant effect=durable-structure authority=" + TEST_DIGEST + " uses=1 basis=1", "turn-3", "g").state;
  const allowed = pre(state, "mkdir activity-record", "turn-3", "mkdir-2");
  assert.equal(allowed.output, null);
  assert.ok(allowed.state.pending_denied, "an admitted exact retry keeps the cursor until its result is observed");
  assert.equal(allowed.state.pending_denied.in_flight, true);
  const observed = post(allowed.state, "mkdir activity-record", "turn-3", "mkdir-2");
  assert.equal(observed.state.pending_denied, null, "a successful matching result clears the cursor");
});

test("HG-041 repeated denials count as one obligation and external directory creation is not a created activity", () => {
  let state = prompt(initial(), "turn-1", "Where should durable context live?").state;
  state = prompt(state, "turn-2", "Use the external location I mentioned").state;
  const firstDenial = pre(state, "mkdir /external/activity", "turn-2", "m1");
  const secondDenial = pre(firstDenial.state, "mkdir /external/activity", "turn-2", "m2");
  assert.equal(isDenied(secondDenial), true);
  assert.equal(secondDenial.state.pending_denied.denials, 2);
  assert.match(visibleText(secondDenial), /same/i);
  assert.doesNotMatch(visibleText(secondDenial), /ask the collaborator to run|hand.*to the collaborator/i);

  state = prompt(secondDenial.state, "turn-3", "I created the directory for you").state;
  assert.equal(state.activity_transition, null);
  const created = route(state, "turn-3", {transition: "created"});
  assert.equal(isDenied(created), true, "created requires an approved plan digest");
  assert.ok(state.pending_denied);
  const {first} = stopTwice(state, "turn-3");
  assert.equal(first.output.decision, "block");
  assert.doesNotMatch(first.output.reason, /collaborator (?:should|must|can) run/i);
});

test("HG-042 authority-only alignment compiles to the combined checkpoint and planned creation reaches created", () => {
  let state = authorityAlignedPlannedState();
  let card = visibleText(pre(state, "pmnm-guard status", "turn-2", "s1"));
  assert.match(card, /grant effect=durable-structure/);
  assert.doesNotMatch(card, /pmnm-guard ready/);
  const grant = pre(state, controlCommands(card)[0].replace(/<[^>]+>/g, "1"), "turn-2", "g1");
  assert.equal(isControlRecorded(grant), true);
  const afterGrant = visibleText(grant);
  assert.doesNotMatch(afterGrant, /transition=created/, "the grant confirmation must not declare the result");
  assert.equal(controlCommands(afterGrant).length, 0, "after the grant the next action is the pending operation itself");
  state = grant.state;
  const premature = route(state, "turn-2", {transition: "created"});
  assert.equal(isDenied(premature), true, "created cannot precede the observed structural operation");
  state = pre(premature.state, "mkdir activity-record", "turn-2", "mk").state;
  const observedOperation = post(state, "mkdir activity-record", "turn-2", "mk");
  state = observedOperation.state;
  const nextLine = controlCommands(visibleText(observedOperation));
  assert.equal(nextLine.length, 1, "the observed operation announces the created transition");
  assert.match(nextLine[0], /transition=created/);
  const created = pre(state, nextLine[0].replace(/<activity-id>/, "work-1").replace(/<locator-receipt>/, "registry-receipt").replace(/<record-receipt>/, "record-receipt"), "turn-2", "created");
  assert.equal(isControlRecorded(created), true);
  state = created.state;
  card = visibleText(pre(state, "pmnm-guard status", "turn-2", "s2"));
  assert.doesNotMatch(card, /pmnm-guard ready/);
  assert.match(card, /checkpoint kind=combined|grant effect=durable-content/);
  assert.equal(isDenied(ready(state, "turn-2")), true);
});

test("HG-043 unexpected sensitive effects route to invalidation and blocked transitions can carry a digest", () => {
  let state = ready(alignedStandardState(), "turn-2").state;
  const denied = pre(state, "git commit -m x", "turn-2", "vc");
  assert.equal(isDenied(denied), true);
  const text = visibleText(denied);
  assert.doesNotMatch(text, /pmnm-guard grant/);
  assert.match(text, /pmnm-guard invalidate/);
  const invalidated = pre(denied.state, substitute(controlCommands(text)[0], denied.state), "turn-2", "inv");
  assert.equal(isControlRecorded(invalidated), true);
  assert.equal(invalidated.state.phase, "RECOVERY");

  let blocked = prompt(initial(), "turn-1").state;
  blocked = pre(
    blocked,
    "pmnm-guard route effort=standard activity=work-1 transition=blocked basis=1 digest=" + TEST_DIGEST,
    "turn-1",
    "blocked-digest",
  ).state;
  assert.equal(blocked.phase, "BLOCKED");
  blocked = checkpoint(blocked, "turn-1", 1, "authority").state;
  blocked = prompt(blocked, "turn-2", "Approved").state;
  blocked = align(blocked, "turn-2").state;
  assert.equal(isDenied(route(blocked, "turn-2", {transition: "created"})), true, "created still needs the observed operation");
  blocked = pre(blocked, "pmnm-guard grant effect=durable-structure authority=" + TEST_DIGEST + " uses=1 basis=1", "turn-2", "g").state;
  blocked = pre(blocked, "mkdir activity-record", "turn-2", "mk").state;
  blocked = post(blocked, "mkdir activity-record", "turn-2", "mk").state;
  const created = route(blocked, "turn-2", {transition: "created"});
  assert.equal(isControlRecorded(created), true);
  assert.equal(created.state.phase, "ALIGNED");
});

test("HG-044 closure is progressive and a nonimplementation lifecycle can close honestly", () => {
  let state = ready(alignedStandardState(), "turn-2").state;
  state = pre(state, IMPLEMENTATION_PATCH, "turn-2", "w1", "apply_patch").state;
  state = post(state, IMPLEMENTATION_PATCH, "turn-2", "w1", "apply_patch").state;
  let step = visibleText(processEvent(state, event("Stop", "turn-2"), {now: 9}));
  assert.match(step, /pmnm-guard verify/);
  assert.doesNotMatch(step, /pmnm-guard complete/);
  state = externalVerify(state, "turn-2").state;
  step = visibleText(pre(state, "pmnm-guard status", "turn-2", "s1"));
  assert.match(step, /grant effect=durable-content/);
  assert.doesNotMatch(step, /pmnm-guard complete/);
  state = durableCapture(state, "turn-2", "close");
  step = visibleText(pre(state, "pmnm-guard status", "turn-2", "s2"));
  assert.match(step, /pmnm-guard complete/);
  assert.equal(controlCommands(step).length, 1);

  let vc = prompt(initial(), "turn-1").state;
  vc = route(vc, "turn-1", {activity: "release-1", transition: "planned-and-awaiting-approval"}).state;
  vc = checkpoint(vc, "turn-1", 1, "authority").state;
  vc = prompt(vc, "turn-2", "Approved: commit exactly that").state;
  vc = align(vc, "turn-2").state;
  vc = route(vc, "turn-2", {activity: "release-1", transition: "no-record-with-valid-reason", exception: "collaborator-declined-record", authority: "turn-2-decision"}).state;
  vc = pre(vc, "pmnm-guard grant effect=version-control authority=turn-2-decision uses=1 basis=1", "turn-2", "g").state;
  vc = pre(vc, "git commit -m x", "turn-2", "commit").state;
  vc = post(vc, "git commit -m x", "turn-2", "commit").state;
  assert.equal(vc.mutation_count, 0);
  assert.equal(vc.effect_count, 1);
  const stop = processEvent(vc, event("Stop", "turn-2"), {now: 9});
  assert.equal(stop.output.decision, "block");
  assert.match(stop.output.reason, /pmnm-guard (?:verify|complete)/);
  assert.equal(controlCommands(stop.output.reason).length, 1);
  const complete = pre(
    vc,
    "pmnm-guard complete basis=1 verification=partial observable=executed protection=not-applicable capture=not-applicable audit=passed",
    "turn-2",
    "complete",
  );
  assert.equal(isControlRecorded(complete), true);
  assert.equal(complete.state.phase, "COMPLETE");
  assert.equal(complete.state.completion.status, "partial");

  const investigateOnly = route(prompt(initial(), "turn-1").state, "turn-1", {activity: "design-1", transition: "planned-and-awaiting-approval"}).state;
  const premature = pre(
    investigateOnly,
    "pmnm-guard complete basis=1 verification=not-applicable observable=not-applicable protection=not-applicable capture=not-applicable audit=passed",
    "turn-1",
    "premature",
  );
  assert.equal(isDenied(premature), true, "blocked activity cannot close");
});

test("HG-045 quote-aware shell segmentation, bounded diagnostics, and receipt grammar", () => {
  for (const command of [
    "rg \"foo|bar\" src",
    "grep -n 'a && b' file.txt",
    "rg -n \"x; y || z\" .",
    "claude --version",
    "git check-ignore -v .ai AGENTS.md",
    "git var GIT_AUTHOR_IDENT",
    "git config --get user.email",
  ]) {
    assert.equal(classifyShell(command).kind, "read", command);
  }
  assert.equal(classifyShell("rg \"unterminated").kind, "unknown");
  assert.equal(classifyShell("echo \\\"a\\\" | python3 x.py").kind, "unknown");
  assert.equal(classifyShell("echo $(date)").kind, "unknown");
  assert.equal(classifyShell("ls `pwd`").kind, "unknown");
  assert.equal(classifyShell("git config user.name example").kind, "unknown");
  assert.equal(classifyShell("rg \"a|b\" . | rm -rf x").effect, "deletion");

  let state = prompt(initial(), "turn-1").state;
  const dotted = pre(
    state,
    "pmnm-guard route effort=standard activity=work-1 transition=loaded basis=1 locator=.ai/activities/index.md record=.ai/activities/work-1.md",
    "turn-1",
    "dotted",
  );
  assert.equal(isControlRecorded(dotted), true);
  const traversal = pre(
    state,
    "pmnm-guard route effort=standard activity=work-1 transition=loaded basis=1 locator=../outside record=../outside/work-1.md",
    "turn-1",
    "traversal",
  );
  assert.equal(isDenied(traversal), true);
});

test("HG-046 concurrent persisted events serialize and lock ownership is enforced", async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-host-guard-lock-"));
  try {
    const guard = path.join(ROOT, "hooks", "pmnm-guard.mjs");
    const env = {...process.env, PLUGIN_DATA: dataRoot};
    processPersistedEvent(event("UserPromptSubmit", "turn-1", {prompt: "Start"}), {dataRoot, now: 1});
    const runs = Array.from({length: 8}, (_, index) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [guard], {env});
        let stdout = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.on("close", (code) => resolve({code, stdout}));
        child.stdin.end(
          JSON.stringify(
            event("PreToolUse", "turn-1", {
              tool_name: "Bash",
              tool_use_id: "read-" + index,
              tool_input: {command: "ls -la"},
            }),
          ),
        );
      }),
    );
    const results = await Promise.all(runs);
    for (const result of results) {
      assert.equal(result.code, 0);
      assert.doesNotMatch(result.stdout, /busy|Pause Safely/i, result.stdout);
    }

    const stateDirectory = path.join(dataRoot, "host-guard", "v1");
    const lockPath = fs
      .readdirSync(stateDirectory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(stateDirectory, name.replace(/\.json$/, ".lock")))[0];
    fs.writeFileSync(lockPath, "other-owner", {flag: "wx"});
    const stale = Date.now() / 1000 - 10;
    fs.utimesSync(lockPath, stale, stale);
    const recovered = processPersistedEvent(
      event("PreToolUse", "turn-1", {tool_name: "Bash", tool_use_id: "after-orphan", tool_input: {command: "ls"}}),
      {dataRoot, now: 2},
    );
    assert.equal(recovered, null);
    assert.equal(fs.existsSync(lockPath), false);

    fs.writeFileSync(lockPath, "other-owner", {flag: "wx"});
    assert.throws(
      () =>
        processPersistedEvent(
          event("PreToolUse", "turn-1", {tool_name: "Bash", tool_use_id: "held", tool_input: {command: "ls"}}),
          {dataRoot, now: 3, lockWaitMs: 150},
        ),
      /busy/,
    );
    assert.equal(fs.readFileSync(lockPath, "utf8"), "other-owner", "a non-owner must not remove the lock");
    assert.equal(testing.releaseLock(lockPath, "wrong-token"), false);
    assert.equal(fs.existsSync(lockPath), true);
    assert.equal(testing.releaseLock(lockPath, "other-owner"), true);
    assert.equal(fs.existsSync(lockPath), false);
  } finally {
    fs.rmSync(dataRoot, {recursive: true, force: true});
  }
});

test("HG-047 legacy state loads with defaults, outputs stay within budget, aligned prompts reconcile, fixtures stay synthetic", () => {
  const legacy = testing.baseState();
  delete legacy.pending_denied;
  delete legacy.effect_count;
  const loaded = testing.validateState(structuredClone(legacy));
  assert.equal(loaded.pending_denied, null);
  assert.equal(loaded.effect_count, 0);

  const outputs = [];
  let state = prompt(initial(), "turn-1", "Hola, quiero que revises este cambio antes de modificarlo").state;
  outputs.push(prompt(initial(), "turn-1", "Hola, quiero que revises este cambio antes de modificarlo"));
  outputs.push(prompt(initial(), "turn-1", "Please review this change before editing it"));
  const spanishDenied = pre(state, "mkdir x", "turn-1", "d1");
  outputs.push(spanishDenied);
  outputs.push(prompt(spanishDenied.state, "turn-2", "Ya creé la carpeta, sigue con la actividad"));
  const englishDenied = pre(prompt(initial(), "turn-1", "Please review this change before editing it").state, "mkdir x", "turn-1", "d1-en");
  outputs.push(prompt(englishDenied.state, "turn-2", "I created the folder, continue with the activity"));
  state = route(state, "turn-1").state;
  outputs.push(pre(state, IMPLEMENTATION_PATCH, "turn-1", "d2", "apply_patch"));
  const aligned = authorityAlignedPlannedState();
  outputs.push(pre(aligned, "pmnm-guard status", "turn-2", "s"));
  outputs.push(pre(aligned, "mkdir x", "turn-2", "d3"));
  let implemented = ready(alignedStandardState(), "turn-2").state;
  implemented = pre(implemented, IMPLEMENTATION_PATCH, "turn-2", "w", "apply_patch").state;
  implemented = post(implemented, IMPLEMENTATION_PATCH, "turn-2", "w", "apply_patch").state;
  outputs.push(processEvent(implemented, event("Stop", "turn-2"), {now: 9}));
  for (const result of outputs) {
    const specific = result.output?.hookSpecificOutput || {};
    if (typeof specific.additionalContext === "string") {
      assert.ok(specific.additionalContext.length <= 600, "additionalContext over budget: " + specific.additionalContext.length);
    }
    for (const text of [specific.permissionDecisionReason, result.output?.reason]) {
      if (typeof text === "string") {
        assert.ok(text.length <= 900, "reason over budget: " + text.length);
      }
    }
    assertSingleAction(result, "budget");
  }

  let alignedTwice = alignedStandardState();
  alignedTwice = prompt(alignedTwice, "turn-3", "Go ahead").state;
  assert.equal(alignedTwice.phase, "COLLABORATOR_RESPONDED");
  assert.equal(isDenied(ready(alignedTwice, "turn-3")), true);
  alignedTwice = align(alignedTwice, "turn-3").state;
  assert.equal(alignedTwice.phase, "ALIGNED");
  alignedTwice = durableCapture(alignedTwice, "turn-3", "again");
  assert.equal(isControlRecorded(ready(alignedTwice, "turn-3")), true);

  const fixtureText = fs.readFileSync(path.join(ROOT, "evals", "host-guard-cases.json"), "utf8");
  const testText = fs.readFileSync(new URL(import.meta.url), "utf8");
  for (const text of [fixtureText, testText]) {
    assert.doesNotMatch(text, /\/Users\/|\/home\/[a-z]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
  }
});

// ---------------------------------------------------------------------------
// P0-21 review round two — CXR-001 to CXR-009, voice contract, action oracle
// ---------------------------------------------------------------------------

const ORACLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, "evals", "host-guard-action-oracle.json"), "utf8"),
);

function concreteCreatedLine(line) {
  return line
    .replace(/<activity-id>/, "work-1")
    .replace(/<locator-receipt>/, "registry-receipt")
    .replace(/<record-receipt>/, "record-receipt");
}

function structuralGrant(state, turn, uses = 1) {
  return pre(
    state,
    "pmnm-guard grant effect=durable-structure authority=" + TEST_DIGEST + " uses=" + uses + " basis=" + state.basis,
    turn,
    "grant-" + uses + "-" + Math.random().toString(16).slice(2),
  );
}

test("HG-048 created follows observed structural operations, never the grant alone", () => {
  let state = authorityAlignedPlannedState();
  const grant = structuralGrant(state, "turn-2", 2);
  assert.equal(isControlRecorded(grant), true);
  assert.equal(controlCommands(visibleText(grant)).length, 0);
  assert.doesNotMatch(visibleText(grant), /transition=created/);
  state = grant.state;
  assert.equal(state.plan_required_operations, 2);
  assert.equal(isDenied(route(state, "turn-2", {transition: "created"})), true, "created right after the grant");

  state = pre(state, "mkdir activity-record", "turn-2", "op-1").state;
  assert.equal(isDenied(route(state, "turn-2", {transition: "created"})), true, "created with a pending result");
  const first = post(state, "mkdir activity-record", "turn-2", "op-1");
  state = first.state;
  assert.equal(state.plan_observed_operations, 1);
  assert.doesNotMatch(visibleText(first), /transition=created/, "one of two operations is not enough");
  assert.equal(isDenied(route(state, "turn-2", {transition: "created"})), true, "created with one of two operations");

  const retryGrant = structuralGrant(state, "turn-2", 1);
  assert.equal(retryGrant.state.plan_required_operations, 2, "a later grant cannot lower the required count");
  state = retryGrant.state;
  state = pre(state, "touch activity-record/index.md", "turn-2", "op-2").state;
  const failed = post(state, "touch activity-record/index.md", "turn-2", "op-2", "Bash", {exit_code: 1, output: "denied"});
  assert.equal(failed.state.plan_observed_operations, 1, "a failed result is not an observed operation");
  assert.equal(isDenied(route(failed.state, "turn-2", {transition: "created"})), true, "created after a failed operation");

  state = structuralGrant(failed.state, "turn-2", 1).state;
  state = pre(state, "touch activity-record/index.md", "turn-2", "op-3").state;
  const second = post(state, "touch activity-record/index.md", "turn-2", "op-3");
  const line = controlCommands(visibleText(second));
  assert.equal(line.length, 1);
  assert.match(line[0], /transition=created/);
  const created = pre(second.state, concreteCreatedLine(line[0]), "turn-2", "created");
  assert.equal(isControlRecorded(created), true);
  assert.equal(created.state.activity_transition, "created");
});

test("HG-049 the denied cursor keeps exact operation identity", () => {
  let state = prompt(initial(), "turn-1", "Create the record").state;
  state = pre(state, "mkdir /external/activity", "turn-1", "deny-a").state;
  const cursor = state.pending_denied;
  assert.ok(cursor);

  const deniedB = pre(state, "mkdir /workspace/.ai/activity", "turn-1", "deny-b");
  assert.equal(deniedB.state.pending_denied.command_hash, cursor.command_hash, "a distinct denial does not replace the cursor");
  assert.equal(deniedB.state.pending_denied.denials, 1);
  assert.match(visibleText(deniedB), /earlier/i);
  state = deniedB.state;

  state = route(state, "turn-1", {transition: "planned-and-awaiting-approval"}).state;
  state = checkpoint(state, "turn-1", 1, "authority").state;
  state = prompt(state, "turn-2", "Approved").state;
  state = align(state, "turn-2").state;
  state = structuralGrant(state, "turn-2", 3).state;

  const substitute = pre(state, "mkdir /workspace/.ai/activity", "turn-2", "sub");
  assert.equal(substitute.output, null);
  assert.equal(substitute.state.pending_denied.command_hash, cursor.command_hash, "same-class substitution keeps the cursor");
  assert.equal(substitute.state.pending_denied.in_flight, false);
  state = post(substitute.state, "mkdir /workspace/.ai/activity", "turn-2", "sub").state;
  assert.ok(state.pending_denied, "an observed different operation does not clear the cursor");

  const retry = pre(state, "mkdir /external/activity", "turn-2", "retry-1");
  assert.equal(retry.output, null);
  assert.equal(retry.state.pending_denied.in_flight, true);
  const failedRetry = post(retry.state, "mkdir /external/activity", "turn-2", "retry-1", "Bash", {exit_code: 1});
  assert.ok(failedRetry.state.pending_denied, "a failed exact retry keeps the cursor");
  assert.equal(failedRetry.state.pending_denied.in_flight, false);

  const retryAgain = pre(failedRetry.state, "mkdir /external/activity", "turn-2", "retry-2");
  const missing = prompt(retryAgain.state, "turn-3", "Any news?");
  assert.ok(missing.state.pending_denied, "a missing result keeps the cursor");
  assert.equal(missing.state.pending_denied.in_flight, true);
  const settled = post(missing.state, "mkdir /external/activity", "turn-2", "retry-2");
  assert.equal(settled.state.pending_denied, null, "only the successful matching result clears it");
  assert.ok(settled.state.events.some((entry) => entry.type === "denied-attempt-cleared" && entry.data.cause === "observed-success"));
});

test("HG-050 conversational age never clears the cursor", () => {
  let state = prompt(initial(), "turn-1", "Create the record").state;
  state = pre(state, "mkdir /external/activity", "turn-1", "deny").state;
  for (let index = 2; index <= 7; index += 1) {
    state = prompt(state, "turn-" + index, "Still here").state;
    assert.ok(state.pending_denied, "cursor survived prompt " + index);
  }
  assert.equal(state.events.some((entry) => entry.type === "denied-attempt-expired"), false);
  state = route(state, "turn-7", {transition: "planned-and-awaiting-approval"}).state;
  const invalidated = pre(state, "pmnm-guard invalidate reason=location-changed basis=2", "turn-7", "inv");
  assert.equal(isControlRecorded(invalidated), true);
  assert.equal(invalidated.state.pending_denied, null);
  assert.ok(invalidated.state.events.some((entry) => entry.type === "denied-attempt-cleared" && entry.data.cause === "invalidate"));
});

test("HG-051 Stop decides from the cursor's own action", () => {
  let waiting = prompt(initial(), "turn-1").state;
  waiting = route(waiting, "turn-1").state;
  const deniedCheck = pre(waiting, "npm test", "turn-1", "check");
  assert.equal(isDenied(deniedCheck), true);
  const stop = processEvent(deniedCheck.state, event("Stop", "turn-1"), {now: 5});
  assert.equal(stop.output?.decision, "block", "an executable verification grant cannot be abandoned while the phase waits");
  assert.match(stop.output.reason, /grant effect=verification/);

  let structural = prompt(initial(), "turn-1").state;
  structural = route(structural, "turn-1", {transition: "loaded"}).state;
  structural = durableCapture(structural, "turn-1", "cap");
  structural = checkpoint(structural, "turn-1", 1, "authority").state;
  structural = prompt(structural, "turn-2", "Approved").state;
  structural = align(structural, "turn-2").state;
  const deniedCommit = pre(structural, "git commit -m x", "turn-2", "vc");
  assert.equal(isDenied(deniedCommit), true);
  const stopStructural = processEvent(deniedCommit.state, event("Stop", "turn-2"), {now: 6});
  assert.equal(stopStructural.output?.decision, "block");
  assert.match(stopStructural.output.reason, /grant effect=version-control/);

  let blocked = prompt(initial(), "turn-1").state;
  blocked = pre(blocked, "mkdir /external/activity", "turn-1", "deny").state;
  blocked = route(blocked, "turn-1", {transition: "planned-and-awaiting-approval"}).state;
  blocked = checkpoint(blocked, "turn-1", 1, "authority").state;
  const waitStop = processEvent(blocked, event("Stop", "turn-1"), {now: 7});
  assert.equal(waitStop.output, null, "a genuine collaborator wait stops silently even with a cursor");
});

test("HG-052 lexer-first shell classification by command family", () => {
  for (const command of [
    "rg \"git commit -m\" src",
    "grep -rn \"curl -X POST\" .",
    "git grep \"rm -rf\" -- src",
    "git log --grep \"npm publish\"",
    "sed -n \"s/a>b/x/p\" file.txt",
    "find . -name \"*.orig\"",
    "find . -path \"*/build/*\" -regex \".*kill.*\"",
    "jq \".scripts.publish\" package.json",
    "rg \"a>b\" .",
    "rg -e \"docker run\" -e \"mkdir\" src",
    "cat file.txt 2>&1",
    "ls > /dev/null",
  ]) {
    assert.equal(classifyShell(command).kind, "read", command);
  }
  const expectations = [
    ["sh -c \"rm -rf x\"", "write", "deletion"],
    ["bash -c \"git push\"", "write", "version-control"],
    ["node -e \"process.exit(0)\"", "unknown", null],
    ["find . -exec rm {} \;", "unknown", null],
    ["find . -delete", "write", "deletion"],
    ["find . -fprint out.txt", "write", "implementation"],
    ["sed -i 's/a/b/' file.txt", "write", "implementation"],
    ["sed -i '' 's/a/b/' file.txt", "write", "implementation"],
    ["sed -ni.bak 's/a/b/p' file.txt", "write", "implementation"],
    ["sed --in-place 's/a/b/' file.txt", "write", "implementation"],
    ["rg --pre cat \"x\" .", "unknown", null],
    ["git log --output=history.txt", "unknown", null],
    ["echo x > file.txt", "write", "implementation"],
    ["cat a >> b", "write", "implementation"],
    ["rg \"unterminated", "unknown", null],
    ["rg \"x\" . | rm -rf y", "write", "deletion"],
    ["ls $(rm -rf x)", "unknown", null],
    ["ls \"$(pwd)\"", "unknown", null],
    ["ls '$(pwd)'", "read", null],
    ["\"rm\" -rf x", "unknown", null],
  ];
  for (const [command, kind, effect] of expectations) {
    const result = classifyShell(command);
    assert.equal(result.kind, kind, command + " -> " + JSON.stringify(result));
    if (effect) {
      assert.equal(result.effect, effect, command);
    }
  }
});

test("HG-053 legacy evidence is bound to zero effects", () => {
  const legacy = testing.baseState();
  legacy.basis = 1;
  legacy.last_capture = {basis: 1, mutation_count: 0, event_seq: 3};
  legacy.last_verification = {basis: 1, mutation_count: 0, result: "passed", source: "covered-tool", scope_hash: null, event_seq: 4};
  const loaded = testing.validateState(structuredClone(legacy));
  assert.equal(loaded.last_capture.effect_count, 0);
  assert.equal(loaded.last_verification.effect_count, 0);
  assert.equal(testing.captureCurrent(loaded), true);
  assert.equal(testing.verificationCurrent(loaded), true);
  loaded.effect_count = 1;
  assert.equal(testing.captureCurrent(loaded), false, "legacy capture is stale after a new effect");
  assert.equal(testing.verificationCurrent(loaded), false, "legacy verification is stale after a new effect");
});

function runOracleSequence(sequence) {
  let state = initial();
  let result = null;
  const patch = IMPLEMENTATION_PATCH;
  const fill = (value) => value.replace(/\$DIGEST/g, TEST_DIGEST).replace(/\$PATCH/g, patch);
  let tokenSeed = 0;
  for (const step of sequence.events) {
    if (step.event === "prompt") {
      result = prompt(state, step.turn, step.text);
    } else if (step.event === "control") {
      result = pre(state, fill(step.command), step.turn, "ctl-" + tokenSeed++);
    } else if (step.event === "write") {
      result = pre(state, fill(step.command), step.turn, step.id, step.tool, () => "0123456789abcdef");
    } else if (step.event === "post") {
      const response = step.result === "failed" ? {exit_code: 1, output: "failed"} : "ok";
      result = post(state, fill(step.command), step.turn, step.id, step.tool, response);
    } else if (step.event === "stop") {
      result = processEvent(state, event("Stop", step.turn, step.active ? {stop_hook_active: true} : {}), {now: 9});
    } else if (step.event === "interrupt") {
      result = processEvent(state, event("Interrupt", step.turn), {now: 9});
    } else if (step.event === "session") {
      result = processEvent(state, event("SessionStart", "turn-x", {source: step.source}), {now: 9});
    } else {
      throw new Error("unknown oracle event " + step.event);
    }
    state = result.state;
  }
  return {state, result};
}

function decisionOf(result) {
  const output = result.output;
  if (!output) {
    return "silent";
  }
  if (output.decision === "block") {
    return "block";
  }
  if (output.systemMessage) {
    return "warn";
  }
  const specific = output.hookSpecificOutput || {};
  if (specific.permissionDecision === "deny") {
    return "deny";
  }
  if (specific.permissionDecision === "allow") {
    return specific.updatedInput ? "control" : "allow";
  }
  if (specific.hookEventName === "UserPromptSubmit" || specific.hookEventName === "SessionStart") {
    return "card";
  }
  return "context";
}

function actionOf(command) {
  if (!command) {
    return "none";
  }
  return command.split(" ")[1];
}

test("HG-054 the action oracle holds for every normalized sequence", () => {
  assert.equal(ORACLE.schema_version, 1);
  assert.equal(ORACLE.adapter, "codex-lifecycle-hooks");
  assert.ok(ORACLE.scope.includes("not a cross-host conformance claim"));
  assert.equal(new Set(ORACLE.sequences.map((entry) => entry.id)).size, ORACLE.sequences.length);
  const classes = new Set(ORACLE.sequences.map((entry) => entry.class));
  for (const required of ["normal-state", "rejected-receipt", "unknown-command", "repeated-denial", "second-stop", "recovery", "missing-store", "multi-use-grant"]) {
    assert.ok(classes.has(required), "oracle lacks class " + required);
  }
  const packageManifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok(packageManifest.files.includes("evals"), "the oracle must ship inside the declared evals payload");
  assert.match(fs.readFileSync(path.join(ROOT, "evals", "README.md"), "utf8"), /host-guard-action-oracle\.json/);

  const orientCard = visibleText(prompt(initial(), "turn-1"));
  assert.doesNotMatch(orientCard, /transition=loaded/);

  for (const sequence of ORACLE.sequences) {
    const {state, result} = runOracleSequence(sequence);
    const label = sequence.id + " " + sequence.claim;
    const expect = sequence.expect;
    assert.equal(decisionOf(result), expect.decision, label + ": decision -> " + JSON.stringify(result.output));
    const text = visibleText(result);
    const commands = controlCommands(text);
    assert.ok(commands.length <= 1, label + ": more than one command");
    assert.equal(actionOf(commands[0]), expect.action, label + ": action -> " + text);
    if (expect.command) {
      assert.match(text, new RegExp(expect.command.replace(/\$DIGEST/g, TEST_DIGEST)), label + ": command shape");
    }
    for (const forbidden of expect.forbid || []) {
      assert.doesNotMatch(text, new RegExp(forbidden), label + ": forbidden " + forbidden);
    }
    if (expect.text) {
      assert.match(text, new RegExp(expect.text, "i"), label + ": text");
    }
    if (expect.wait !== undefined) {
      const compiled = testing.compileNextAction(state, state.pending_denied ? state.pending_denied.effect : null);
      assert.equal(Boolean(compiled.wait), expect.wait, label + ": wait");
    }
    assert.equal(state.phase, expect.phase, label + ": phase");
    const cursor = state.pending_denied ? (state.pending_denied.in_flight ? "in-flight" : "pending") : "none";
    assert.equal(cursor, expect.cursor || "none", label + ": cursor");
    if (expect.denials !== undefined) {
      assert.equal(state.pending_denied.denials, expect.denials, label + ": denials");
    }
    if (expect.cursor_command) {
      assert.equal(state.pending_denied.command_hash, testing.hash(expect.cursor_command), label + ": cursor identity");
    }
    for (const [key, field] of [["plan_required", "plan_required_operations"], ["plan_observed", "plan_observed_operations"], ["basis", "basis"], ["effect_count", "effect_count"], ["pending_response", "pending_response"]]) {
      if (expect[key] !== undefined) {
        assert.equal(state[field], expect[key], label + ": " + field);
      }
    }
  }
});

test("HG-055 result first: pending nonimplementation results, response classification, and late contradictions", () => {
  let state = authorityAlignedPlannedState();
  state = structuralGrant(state, "turn-2", 1).state;
  state = pre(state, "mkdir activity-record", "turn-2", "op").state;
  const arrived = prompt(state, "turn-3", "Yes, go ahead and create it");
  state = arrived.state;
  assert.equal(state.phase, "RECOVERY");
  assert.equal(state.pending_writes.length, 1);
  assert.equal(state.grant, null, "the active grant is removed");
  assert.equal(state.checkpoint_kind, "authority", "the checkpoint is preserved");
  assert.equal(state.plan_digest, TEST_DIGEST, "the digest is preserved");
  assert.equal(state.pending_response, true);
  assert.equal(isDenied(align(state, "turn-3", "accepted", 2)), true, "the result must be settled before the response is classified");

  const failed = post(state, "mkdir activity-record", "turn-2", "op", "Bash", {exit_code: 1});
  assert.equal(failed.state.pending_writes.length, 0);
  assert.equal(failed.state.phase, "RECOVERY");
  const restored = align(failed.state, "turn-3", "accepted", 2);
  assert.equal(isControlRecorded(restored), true);
  assert.equal(restored.state.phase, "ALIGNED");
  assert.equal(restored.state.pending_response, false);
  assert.match(visibleText(restored), /grant effect=durable-structure/);
  assert.equal(isControlRecorded(structuralGrant(restored.state, "turn-3", 1)), true, "no second human round is needed");

  let unknown = authorityAlignedPlannedState();
  unknown = structuralGrant(unknown, "turn-2", 1).state;
  unknown = pre(unknown, "mkdir activity-record", "turn-2", "op").state;
  unknown = prompt(unknown, "turn-3", "Yes, go ahead").state;
  unknown = pre(unknown, "pmnm-guard reconcile outcome=unknown reason=missing-post-use basis=3", "turn-3", "rc").state;
  const stillOpen = align(unknown, "turn-3", "accepted", 3);
  assert.equal(isControlRecorded(stillOpen), true);
  assert.equal(stillOpen.state.phase, "RECOVERY", "an unknown result keeps recovery open");
  assert.match(visibleText(stillOpen), /checkpoint kind=authority/);

  let late = authorityAlignedPlannedState();
  late = structuralGrant(late, "turn-2", 1).state;
  late = pre(late, "mkdir activity-record", "turn-2", "late").state;
  late = pre(late, "pmnm-guard reconcile outcome=failed-no-effect reason=tool-reported-failure basis=2", "turn-2", "rc").state;
  assert.equal(late.effect_count, 0);
  const contradiction = post(late, "mkdir activity-record", "turn-2", "late");
  assert.equal(contradiction.state.phase, "RECOVERY");
  assert.equal(contradiction.state.basis, 3);
  assert.equal(contradiction.state.effect_count, 1);
  assert.equal(contradiction.state.plan_observed_operations, 1);
  assert.match(visibleText(contradiction), /late host result/i);
  const accepted = prompt(contradiction.state, "turn-3", "Go on").state;
  assert.equal(accepted.pending_response, false, "a contradicted result is not a restorable response window");
});

test("HG-056 ordinary output uses the first-person guard voice", () => {
  const outputs = [];
  let state = prompt(initial(), "turn-1", "Please review this change before editing it").state;
  outputs.push(prompt(initial(), "turn-1", "Please review this change before editing it"));
  outputs.push(pre(state, "mkdir x", "turn-1", "d1"));
  outputs.push(pre(state, "python3 x.py", "turn-1", "u1", "Bash", () => "0123456789abcdef"));
  state = route(state, "turn-1").state;
  outputs.push(pre(state, "pmnm-guard status", "turn-1", "s1"));
  outputs.push(pre(state, "python3 x.py", "turn-1", "u2", "Bash", () => "0123456789abcdef"));
  outputs.push(pre(state, "pmnm-guard ready basis=9", "turn-1", "bad"));
  const aligned = authorityAlignedPlannedState();
  outputs.push(pre(aligned, "pmnm-guard status", "turn-2", "s2"));
  outputs.push(structuralGrant(aligned, "turn-2", 1));
  let implemented = ready(alignedStandardState(), "turn-2").state;
  implemented = pre(implemented, IMPLEMENTATION_PATCH, "turn-2", "w", "apply_patch").state;
  implemented = post(implemented, IMPLEMENTATION_PATCH, "turn-2", "w", "apply_patch").state;
  outputs.push(processEvent(implemented, event("Stop", "turn-2"), {now: 9}));
  outputs.push(processEvent(implemented, event("Stop", "turn-2", {stop_hook_active: true}), {now: 9}));
  let recovering = prompt(implemented, "turn-3", "That changes the direction").state;
  recovering = align(recovering, "turn-3", "changed", 2).state;
  outputs.push(pre(recovering, "pmnm-guard status", "turn-3", "s3"));
  const spanish = prompt(initial(), "turn-1", "Hola, quiero que revises este cambio antes de modificarlo");
  outputs.push(spanish);
  outputs.push(pre(spanish.state, "mkdir x", "turn-1", "d2"));
  for (const result of outputs) {
    const text = visibleText(result);
    assert.match(text, /^Please, [A-Z][A-Za-z' ]+\n/, "heading: " + text.slice(0, 60));
    const body = text.split("\n").slice(1).join("\n");
    assert.ok(controlCommands(body).length <= 1, "more than one NEXT: " + body);
    assert.doesNotMatch(body, /\b(you must|you should|you need to|debes|deberías|usted)\b/i, "user-directed instruction: " + body);
    assert.doesNotMatch(body, /\b(safe|safely|secure|guarantee|guaranteed|seguro|segura|garantiza|verified|verificado)\b/i, "unsupported assurance: " + body);
    assert.doesNotMatch(body, /\[PLS-|PMNM guard/, "diagnostic label: " + body);
    if (!/Resuelve|registro|reintento|clasific|verific|reconcil|espero|puedo|mantengo/i.test(body) || /^[A-Z][a-z]+ /.test(body)) {
      // English bodies must carry a first-person marker before the NEXT line.
      if (!/[áéíóúñ¿¡]/.test(body)) {
        assert.match(body.split("NEXT:")[0], /\b(I|I'm|I've|my|me)\b/, "first-person voice: " + body);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// P0-21 review round three — grant authority, sed and ripgrep modes, effect closure, late identity
// ---------------------------------------------------------------------------

test("HG-057 a structural grant binds to the plan digest and states the approved operation count", () => {
  const aligned = authorityAlignedPlannedState();
  const wrongAuthority = pre(aligned, "pmnm-guard grant effect=durable-structure authority=approved-plan uses=1 basis=1", "turn-2", "g-wrong");
  assert.equal(isDenied(wrongAuthority), true, "a non-digest authority is rejected");
  const otherDigest = pre(aligned, "pmnm-guard grant effect=durable-structure authority=" + "b".repeat(64) + " uses=1 basis=1", "turn-2", "g-other");
  assert.equal(isDenied(otherDigest), true, "a digest that is not the approved plan is rejected");
  const card = visibleText(pre(aligned, "pmnm-guard status", "turn-2", "s"));
  assert.match(card, /uses=<approved-operation-count>/);
  const exact = structuralGrant(aligned, "turn-2", 1);
  assert.equal(isControlRecorded(exact), true);

  let noPlan = prompt(initial(), "turn-1").state;
  noPlan = route(noPlan, "turn-1", {transition: "loaded"}).state;
  noPlan = durableCapture(noPlan, "turn-1", "cap");
  noPlan = checkpoint(noPlan, "turn-1", 1, "authority").state;
  noPlan = prompt(noPlan, "turn-2", "Approved").state;
  noPlan = align(noPlan, "turn-2").state;
  const withoutPlan = pre(noPlan, "pmnm-guard grant effect=durable-structure authority=" + TEST_DIGEST + " uses=1 basis=1", "turn-2", "g-noplan");
  assert.equal(isDenied(withoutPlan), true, "durable structure without an approved plan digest is rejected");
});

test("HG-058 sed write commands, ambiguous sed scripts, and ripgrep compressed search", () => {
  const expectations = [
    ["sed -n 'w output.txt' input.txt", "write", "implementation"],
    ["sed -n '/x/w out.txt' input.txt", "write", "implementation"],
    ["sed 's/a/b/w changed.txt' input.txt", "write", "implementation"],
    ["sed -e 's/a/b/' -e 'W first.txt' input.txt", "write", "implementation"],
    ["sed -f script.sed input.txt", "unknown", null],
    ["sed --file=script.sed input.txt", "unknown", null],
    ["sed -n '/a/{p;w x.txt}' input.txt", "unknown", null],
    ["sed -n 's/a/b/p' input.txt", "read", null],
    ["sed -n '2,5p' input.txt", "read", null],
    ["sed 's/w/x/' input.txt", "read", null],
    ["sed -n '$p' input.txt", "read", null],
    ["sed '/start/,/end/d' input.txt", "read", null],
    ["sed -n '1~2w out.txt' input.txt", "unknown", null],
    ["sed -n '\\%x%w out.txt' input.txt", "unknown", null],
    ["sed -n 'Z' input.txt", "unknown", null],
    ["sed -n 'l 5' input.txt", "unknown", null],
    ["sed -n '5' input.txt", "unknown", null],
    ["sed 'y/abc/xyz/' input.txt", "read", null],
    ["rg --search-zip pattern .", "unknown", null],
    ["rg -z pattern .", "unknown", null],
    ["rg -nz pattern .", "unknown", null],
    ["rg -n pattern .", "read", null],
  ];
  for (const [command, kind, effect] of expectations) {
    const result = classifyShell(command);
    assert.equal(result.kind, kind, command + " -> " + JSON.stringify(result));
    if (effect) {
      assert.equal(result.effect, effect, command);
    }
  }
});

test("HG-059 observed authorized effects require closure before switching activity", () => {
  let vc = prompt(initial(), "turn-1").state;
  vc = route(vc, "turn-1", {activity: "release-1", transition: "planned-and-awaiting-approval"}).state;
  vc = checkpoint(vc, "turn-1", 1, "authority").state;
  vc = prompt(vc, "turn-2", "Approved: commit exactly that").state;
  vc = align(vc, "turn-2").state;
  vc = route(vc, "turn-2", {activity: "release-1", transition: "no-record-with-valid-reason", exception: "collaborator-declined-record", authority: "turn-2-decision"}).state;
  vc = pre(vc, "pmnm-guard grant effect=version-control authority=turn-2-decision uses=1 basis=1", "turn-2", "g").state;
  vc = pre(vc, "git commit -m x", "turn-2", "commit").state;
  vc = post(vc, "git commit -m x", "turn-2", "commit").state;
  assert.equal(vc.effect_count, 1);
  const switched = route(vc, "turn-2", {activity: "release-2", transition: "planned-and-awaiting-approval"});
  assert.equal(isDenied(switched), true, "effects without closure cannot be relabeled as another activity");
  assert.match(visibleText(switched), /closing disposition/i);
  const closed = pre(
    vc,
    "pmnm-guard complete basis=1 verification=partial observable=executed protection=not-applicable capture=not-applicable audit=passed",
    "turn-2",
    "complete",
  ).state;
  const afterClosure = route(closed, "turn-2", {activity: "release-2", transition: "planned-and-awaiting-approval"});
  assert.equal(isControlRecorded(afterClosure), true);
  assert.equal(afterClosure.state.effect_count, 0);
});

test("HG-060 a late result keeps its original activity and plan identity", () => {
  let a = authorityAlignedPlannedState();
  a = structuralGrant(a, "turn-2", 1).state;
  a = pre(a, "mkdir activity-a", "turn-2", "late-a").state;
  a = pre(a, "pmnm-guard reconcile outcome=failed-no-effect reason=tool-reported-failure basis=2", "turn-2", "rc").state;
  a = checkpoint(a, "turn-2", 2, "authority").state;
  a = prompt(a, "turn-3", "Fine, approve again").state;
  a = align(a, "turn-3", "accepted", 2).state;
  assert.equal(a.phase, "ALIGNED");
  const bDigest = "c".repeat(64);
  let b = pre(a, "pmnm-guard route effort=standard activity=work-2 transition=planned-and-awaiting-approval basis=2 digest=" + bDigest, "turn-3", "route-b").state;
  assert.equal(b.phase, "BLOCKED");
  b = checkpoint(b, "turn-3", 2, "authority").state;
  b = prompt(b, "turn-4", "Approved for the second record").state;
  b = align(b, "turn-4", "accepted", 2).state;
  b = pre(b, "pmnm-guard grant effect=durable-structure authority=" + bDigest + " uses=1 basis=2", "turn-4", "g-b").state;
  assert.equal(b.plan_required_operations, 1);
  assert.equal(b.plan_observed_operations, 0);

  const late = post(b, "mkdir activity-a", "turn-2", "late-a");
  assert.equal(late.state.phase, "RECOVERY", "a contradictory late result still reopens recovery");
  assert.equal(late.state.plan_observed_operations, 0, "activity B's plan must not advance from activity A's late result");
  assert.equal(late.state.effect_count, 0, "activity B's effect accounting must not absorb activity A's late effect");
  assert.ok(late.state.events.some((entry) => entry.type === "late-covered-result-observed" && entry.data.same_activity === false));
  assert.equal(isDenied(pre(late.state, "pmnm-guard route effort=standard activity=work-2 transition=created basis=" + late.state.basis + " locator=x record=y authority=" + bDigest, "turn-4", "created-b")), true);
});
