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
  assert.deepEqual(ids, Array.from({length: 37}, (_, index) => "HG-" + String(index + 1).padStart(3, "0")));
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
    "pmnm-guard grant effect=durable-structure authority=approved-plan uses=1 basis=1",
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
    "pmnm-guard grant effect=durable-structure authority=approved-plan uses=1 basis=1",
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
  assert.match(result.output.hookSpecificOutput.additionalContext, /Resuelve esfuerzo/);
  assert.equal(JSON.stringify(result.state).includes(rawPrompt), false);

  const english = prompt(initial(), "turn-1-en", "Please investigate this change before editing it");
  assert.equal(english.state.language, "en");
  assert.match(english.output.hookSpecificOutput.additionalContext, /Resolve effort/);
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
