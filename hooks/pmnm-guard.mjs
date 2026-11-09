#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  classifyDeclaration as rDeclClass,
  classifyShell,
  classifyToolEvent as rClassifyEvent,
  declarationSensitiveEffect as rDeclSensitive,
  lexShell as rLex,
  operationIdentity as rOpIdentity,
  resolveShellTargets as rShellTargets,
  sensitiveEffects as R_SENSITIVE_EFFECTS,
  shellRead as R_READ,
  shellUnresolved as R_UNRESOLVED,
  shellWrite as rWrite,
  toolResult as rResult,
  toolPayload as rPayload,
} from "./pmnm-shell.mjs";

export {classifyShell};

// RELEASE_RUNTIME_START
const rInvokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
const R_SCHEMA_VERSION = 2, R_MAX_INPUT_BYTES = 1_000_000, R_MAX_STATE_BYTES = 65_536, R_MAX_EVENTS = 128;
const R_MAX_CONTROL_BYTES = 2_048, R_MAX_CARD_BYTES = 2_400, R_MAX_POINTER_BYTES = 4_096, R_MAX_INDEX_BYTES = 262_144;
const R_MAX_TRANSCRIPT_TAIL_BYTES = 1_048_576, R_MAX_TRANSCRIPT_LINE_BYTES = 262_144, R_MAX_TRANSCRIPT_MESSAGE_BYTES = 65_536;
const R_LOCK_WAIT_MS = 3_000, R_LOCK_DELAY_MS = 20, R_LOCK_STALE_MS = 6_000;
const R_NO_OP_COMMAND = 'node -e ""', R_POINTER_FILE = "pmnm.path", R_INDEX_SCHEMA = "pmnm.projects/v1", R_INDEX_FILE = "index.json";
const R_GENERAL_RULES_FILE = "general-rules.md", R_PROJECT_RULES_FILE = "project-rules.md", R_PROJECT_KNOWLEDGE_FILE = "project-knowledge.md";
const R_PROJECT_KNOWLEDGE_TEMPLATE = "# Project knowledge\n\n<!--\n## <topic>\n- applies: <scope>\n- current: <claim>\n- basis: reported | observed | derived | inferred | assumed | unknown\n- last checked: <date>\n- revisit when: <condition>\n- source: <task>\n-->\n";
const R_TASK_INDEX_FILE = "index.md", R_TASK_PLAN_FILE = "plan.md", R_TASK_VERIFY_FILE = "verification.md", R_TASK_IMPACT_FILE = "impact.md";
const R_TASK_EXPECTATIONS_FILE = "expectations.md";
const R_TASK_RULES_FILE = "task-rules.md";
const R_EXPECTATION_SOURCES = new Set(["requirement", "later-comment", "observed-code", "conversation-decision"]);
const R_EXPECTATION_COVERAGE = new Set(["covered", "partial", "missing", "unspecified"]);
const R_TASK_REVIEW_FILE = "review.md", R_TASK_PERMISSION_FILE = "permissions.json", R_TASK_PREFLIGHT_FILE = "preflight.md", R_TASK_ENVIRONMENT_FILE = "environment.md";
const R_MAX_TASK_FILE_BYTES = 131_072, R_MAX_PLAN_TARGETS = 128, R_MAX_RULE_BASIS_PATHS = 10, R_MAX_RULE_FILES = 4;
const R_IMPACT_DIMENSIONS = ["security", "privacy", "performance", "compatibility", "maintainability", "observability"];
const R_IMPACT_DISPOSITIONS = new Set(["verified-unchanged", "changed-and-covered", "excluded-with-evidence", "dynamic-boundary-manually-checked", "unresolved-blocking", "unresolved-accepted-risk"]);

const R_PHASES = new Set(["ORIENT", "INVESTIGATE", "AWAITING_HUMAN", "READY", "IMPLEMENT", "VERIFY", "RECOVERY", "COMPLETE"]), R_EFFORTS = new Set(["light", "standard", "high"]), R_WORK_TYPES = new Set(["implementation", "advisory", "verification"]), R_LANGUAGES = new Set(["en", "es"]);
const R_ACTIONS = new Set(["folder", "project", "start", "digest", "agreed", "redo", "allow", "declare", "classify", "result", "verified", "done", "status"]), R_ALIASES = new Set(["route", "checkpoint", "align", "invalidate", "grant", "permit", "reconcile", "verify", "complete"]), R_RETIRED_ACTIONS = new Set(["ready", "exempt", "capture", "created", "loaded"]);
const R_CLASSIFIABLE_EFFECTS = new Set(["investigation", "implementation", "verification", "state-change"]), R_DECLARATION_BOUNDARIES = new Set(["project", "pmnm", "host", "local-environment", "network", "external", "mixed", "unknown"]), R_DECLARATION_PERSISTENCE = new Set(["none", "transient", "persistent", "unknown"]), R_DECLARATION_CERTAINTY = new Set(["certain", "uncertain"]);
const R_VERIFICATION_RESULTS = new Set(["passed", "failed", "partial", "blocked"]), R_VERIFICATION_METHODS = new Set(["command", "inspection", "human"]), R_AUDIT_RESULTS = new Set(["passed", "partial", "blocked"]), R_RESULT_OUTCOMES = new Set(["unknown", "no-effect"]);
const R_HASH = /^[a-f0-9]{64}$/, R_CAPABILITY_ID = /^[a-z][a-z0-9-]{0,63}$/, R_FIELD_NAME = /^[a-z][a-z0-9-]*$/, R_FIELD_VALUE = /^[^\s;&|$()<>"']{1,1536}$/;
const R_SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/, R_SAFE_STATE_ID = /^[a-z0-9][a-z0-9._:/-]{0,127}$/, R_PARENT_TRAVERSAL = /(?:^|[\\/])\.\.(?:[\\/]|$)/, R_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function rHash(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}
function rStableJson(value) {
  if (value === null || ["string", "boolean"].includes(typeof value) || Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(rStableJson).join(",") + "]";
  if (!value || typeof value !== "object") throw new Error("bad");
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + rStableJson(value[key])).join(",") + "}";
}
function rLimitText(value, maximum = R_MAX_CARD_BYTES) {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (Buffer.byteLength(text, "utf8") <= maximum) return text;
  let result = text;
  while (Buffer.byteLength(result + "…", "utf8") > maximum) result = result.slice(0, -1);
  return result + "…";
}
function rOneLine(value, maximum = 120) {
  return rLimitText(value, maximum).replace(/\s+/g, " ").trim();
}
// PMNM renders one language. A card is the level and what happened, then one
// NEXT action; the line break between them is part of the contract.
function rCard(level, english, next) {
  return level + ": " + rOneLine(english, 420) + "\nNEXT: " + rOneLine(next, 1_800);
}
function rHookContext(eventName, text) {
  return {hookSpecificOutput: {hookEventName: eventName, additionalContext: rLimitText(text)}};
}
function rDenyTool(reason, includeReason = true) {
  const output = {hookEventName: "PreToolUse", permissionDecision: "deny"};
  if (includeReason && reason) output.permissionDecisionReason = rLimitText(reason);
  return {hookSpecificOutput: output};
}
function rDenied(state, reason, includeReason = true) {
  return {state, output: rDenyTool(reason, includeReason)};
}
function rRewriteControl(context = "") {
  const output = {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    updatedInput: {command: R_NO_OP_COMMAND},
  };
  if (context) output.additionalContext = rLimitText(context);
  return {hookSpecificOutput: output};
}
function rAllowed(state, context) {
  return {state, output: rRewriteControl(context)};
}
function rContinueStop(reason) {
  return {decision: "block", reason: rLimitText(reason)};
}
function rWarning(message) {
  return {systemMessage: rLimitText(message)};
}
function rBaseState() {
  return {
    schema_version: R_SCHEMA_VERSION, phase: "ORIENT", language: "en", epoch: 1,
    prompt_epoch: 0, current_turn_hash: null, task_revision: null, project_revision: null,
    task_id: null, task_hash: null, effort: null, work_type: null,
    folder_path: null, folder_status: "unknown",
    project_name: null, project_slug: null, project_path: null, task_path: null,
    digest_shown_epoch: null, digest_prompt_epoch: null, human_response_epoch: null, digest_agreed_epoch: null,
    pending_question: null, pending_denied: null, declared_retry: null, classified_retry: null, sensitive_allow: null,
    permission_manifest_hash: null, environment_plan_hash: null, task_permission_epoch: null, task_permissions: [],
    project_permission_project_hash: null, project_permissions: [],
    task_capabilities: [], project_capabilities: [],
    pending_writes: [], reconciled_writes: [],
    mutation_count: 0, effect_count: 0, verification_count: 0, changed_target_hashes: [], observed_state_hashes: [], historical_state_hashes: [],
    source_reads_without_task: 0, plan_write_seq: null, plan_gate_seq: 0,
    plan_file_hash: null, plan_target_hashes: [], verification_plan_hash: null, impact_plan_hash: null, expectations_plan_hash: null,
    redo_contract_hash: null, work_change_authorized: false,
    workspace_scope_snapshot: null, workspace_digest_snapshot: null,
    verification_claim_mutation_count: null, verification_claim_effect_count: null,
    rules_file_hashes_written: [], investigation_stop_count: 0,
    rule_basis_required: false, rule_basis_paths: [], rule_basis_observed_hashes: [], rule_basis_unmatched: [], rule_basis_hash: null,
    digest_rule_basis_hash: null, pending_rule_reads: [],
    last_check: null, last_verification: null,
    test_digest_audit_epoch: null,
    test_digest_epoch: null, test_digest_prompt_epoch: null, test_digest_response_epoch: null,
    test_digest_mutation_count: null, test_digest_effect_count: null, test_digest_verification_count: null,
    completion: null, task_folder_noted: false,
    stop_turn_hash: null, stop_next_hash: null, migration_notice: false,
    event_seq: 0, events: [],
  };
}
function rLegacyState(input) {
  if (input && input.schema_version === 1) {
    const state = rBaseState();
    state.language = R_LANGUAGES.has(input.language) ? input.language : "en";
    state.prompt_epoch = Number.isInteger(input.prompt_epoch) && input.prompt_epoch >= 0 ? input.prompt_epoch : 0;
    state.current_turn_hash = typeof input.current_turn_hash === "string" ? input.current_turn_hash : null;
    state.migration_notice = true;
    return state;
  }
  return input;
}
function rValidHashes(value, maximum) { return Array.isArray(value) && value.length <= maximum && value.every((item) => R_HASH.test(item)); }

function rValidSnapshot(snapshot) {
  return snapshot === null || Boolean(snapshot && ["available", "unavailable"].includes(snapshot.status) &&
    (snapshot.bounded === undefined || typeof snapshot.bounded === "boolean") &&
    Array.isArray(snapshot.entries) && snapshot.entries.length <= 512 && snapshot.entries.every((entry) =>
      entry && typeof entry.label === "string" && entry.label && !path.isAbsolute(entry.label) &&
      !R_PARENT_TRAVERSAL.test(entry.label) && typeof entry.signature === "string" && entry.signature.length <= 256 &&
      (entry.observed === undefined || typeof entry.observed === "boolean")));
}
function rValidateState(input) {
  const state = rLegacyState(input);
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("state is not an object");
  if (state.schema_version !== R_SCHEMA_VERSION || !R_PHASES.has(state.phase)) throw new Error("state schema or phase is unsupported");
  for (const [field, minimum] of [
    ["prompt_epoch", 0],
    ["epoch", 1],
    ["mutation_count", 0],
    ["effect_count", 0],
    ["verification_count", 0],
    ["event_seq", 0],
  ]) {
    if (!Number.isInteger(state[field]) || state[field] < minimum) throw new Error("state " + field + " is invalid");
  }
  if (!R_LANGUAGES.has(state.language)) throw new Error("state language is invalid");
  if (!Array.isArray(state.events) || state.events.length > R_MAX_EVENTS) throw new Error("state event history is invalid");
  if (!Array.isArray(state.pending_writes) || state.pending_writes.length > 16) throw new Error("state pending writes are invalid");
  if (!Array.isArray(state.reconciled_writes) || state.reconciled_writes.length > 16) throw new Error("state reconciled writes are invalid");
  const clean = rBaseState();
  for (const field of (
    "source_reads_without_task task_revision project_revision work_type last_check plan_write_seq plan_gate_seq plan_file_hash plan_target_hashes " +
    "verification_plan_hash impact_plan_hash expectations_plan_hash redo_contract_hash work_change_authorized workspace_scope_snapshot workspace_digest_snapshot " +
    "permission_manifest_hash environment_plan_hash task_permission_epoch task_permissions project_permission_project_hash project_permissions task_capabilities project_capabilities declared_retry " +
    "verification_claim_mutation_count verification_claim_effect_count test_digest_epoch test_digest_prompt_epoch " +
    "test_digest_response_epoch test_digest_mutation_count test_digest_effect_count test_digest_verification_count " +
    "rules_file_hashes_written investigation_stop_count observed_state_hashes historical_state_hashes " +
    "rule_basis_required rule_basis_paths rule_basis_observed_hashes rule_basis_unmatched rule_basis_hash digest_rule_basis_hash pending_rule_reads test_digest_audit_epoch"
  ).split(" ")) if (state[field] === undefined) state[field] = clean[field];
  for (const field of ["source_reads_without_task", "plan_gate_seq", "investigation_stop_count"]) {
    if (!Number.isInteger(state[field]) || state[field] < 0) throw new Error("state " + field + " is invalid");
  }
  for (const field of [
    "plan_write_seq", "task_permission_epoch", "verification_claim_mutation_count", "verification_claim_effect_count",
    "test_digest_epoch", "test_digest_prompt_epoch", "test_digest_response_epoch", "test_digest_mutation_count",
    "test_digest_effect_count", "test_digest_verification_count", "test_digest_audit_epoch", "task_revision", "project_revision",
  ]) {
    if (state[field] !== null && (!Number.isInteger(state[field]) || state[field] < 0)) throw new Error("state " + field + " is invalid");
  }
  if (state.plan_file_hash !== null && !R_HASH.test(state.plan_file_hash)) throw new Error("state plan hash is invalid");
  if (state.verification_plan_hash !== null && !R_HASH.test(state.verification_plan_hash)) throw new Error("state verification plan hash is invalid");
  if (state.impact_plan_hash !== null && !R_HASH.test(state.impact_plan_hash)) throw new Error("state impact plan hash is invalid");
  if (state.expectations_plan_hash !== null && !R_HASH.test(state.expectations_plan_hash)) throw new Error("state expectations plan hash is invalid");
  if (state.redo_contract_hash !== null && !R_HASH.test(state.redo_contract_hash)) throw new Error("state redo contract hash is invalid");
  if (typeof state.work_change_authorized !== "boolean") throw new Error("state work change authority is invalid");
  if (state.permission_manifest_hash !== null && !R_HASH.test(state.permission_manifest_hash)) throw new Error("state permission manifest hash is invalid");
  if (state.environment_plan_hash !== null && !R_HASH.test(state.environment_plan_hash)) throw new Error("state environment plan hash is invalid");
  if (state.project_permission_project_hash !== null && !R_HASH.test(state.project_permission_project_hash)) throw new Error("state project permission binding is invalid");
  for (const field of ["task_permissions", "project_permissions"]) {
    if (!Array.isArray(state[field]) || state[field].length > 32 || state[field].some((entry) =>
      !entry || !R_SENSITIVE_EFFECTS.has(entry.effect) || !R_HASH.test(entry.operation_hash) ||
      (entry.objective_hash === undefined ? entry.effect === "state-change" : field[0] === "p" || !R_HASH.test(entry.objective_hash)))) {
      throw new Error("bad state permissions");
    }
  }
  for (const field of ["task_capabilities", "project_capabilities"]) {
    if (!Array.isArray(state[field]) || state[field].length > 32 || state[field].some((entry) =>
      !entry || !R_CAPABILITY_ID.test(entry.capability) || !R_CLASSIFIABLE_EFFECTS.has(entry.effect) ||
      !R_DECLARATION_BOUNDARIES.has(entry.boundary) || !R_DECLARATION_PERSISTENCE.has(entry.persistence) ||
      typeof entry.shape_hash !== "string" || !R_HASH.test(entry.shape_hash))) {
      throw new Error("bad state capabilities");
    }
  }
  if (state.declared_retry !== null) {
    const entry = state.declared_retry;
    if (
      !entry || typeof entry !== "object" || Array.isArray(entry) ||
      !R_CLASSIFIABLE_EFFECTS.has(entry.effect) || !R_DECLARATION_BOUNDARIES.has(entry.boundary) ||
      !R_DECLARATION_PERSISTENCE.has(entry.persistence) || !R_DECLARATION_CERTAINTY.has(entry.certainty) ||
      (entry.capability !== "none" && !R_CAPABILITY_ID.test(entry.capability)) ||
      (entry.command_hash !== null && !R_HASH.test(entry.command_hash || "")) ||
      (entry.command_hash === null && (entry.turn_hash != null && !R_HASH.test(entry.turn_hash) ||
        (entry.capability !== "none" && !entry.capability_scope))) ||
      (entry.task_hash !== null && !R_HASH.test(entry.task_hash || "")) ||
      !Number.isInteger(entry.epoch) || entry.epoch < 1 || entry.uses !== 1 ||
      (entry.required_effect !== null && !R_SENSITIVE_EFFECTS.has(entry.required_effect)) ||
      ![null, "task", "project"].includes(entry.capability_scope)
    ) {
      throw new Error("bad declared retry");
    }
  }
  if (state.pending_denied !== null) {
    const entry = state.pending_denied;
    if (entry && entry.approved_prompt_epoch === undefined) entry.approved_prompt_epoch = null;
    if (
      !entry || typeof entry !== "object" || Array.isArray(entry) ||
      !["declare", "sensitive"].includes(entry.kind) ||
      (entry.effect !== null && typeof entry.effect !== "string") ||
      (entry.kind === "sensitive" && !R_SENSITIVE_EFFECTS.has(entry.effect)) ||
      ![null, "implementation"].includes(entry.minimum_effect) ||
      (entry.reason !== null && (typeof entry.reason !== "string" || entry.reason.length > 128)) ||
      !R_HASH.test(entry.command_hash || "") ||
      !Number.isInteger(entry.asked_prompt_epoch) || entry.asked_prompt_epoch < 0 ||
      (entry.approved_prompt_epoch !== null && (
        !Number.isInteger(entry.approved_prompt_epoch) ||
        entry.approved_prompt_epoch <= entry.asked_prompt_epoch ||
        entry.approved_prompt_epoch > state.prompt_epoch
      )) ||
      (entry.denied_turn_hash !== null && !R_HASH.test(entry.denied_turn_hash || ""))
    ) {
      throw new Error("bad pending denial");
    }
  }
  if (!rValidHashes(state.plan_target_hashes, R_MAX_PLAN_TARGETS)) throw new Error("state plan targets are invalid");
  if (!rValidHashes(state.rules_file_hashes_written, R_MAX_RULE_FILES)) throw new Error("state rules files are invalid");
  if (typeof state.rule_basis_required !== "boolean") throw new Error("state rule basis flag is invalid");
  if (!Array.isArray(state.rule_basis_paths) || state.rule_basis_paths.length > R_MAX_RULE_BASIS_PATHS || state.rule_basis_paths.some((entry) => typeof entry !== "string" || !path.isAbsolute(entry))) {
    throw new Error("state rule basis paths are invalid");
  }
  if (!rValidHashes(state.rule_basis_observed_hashes, R_MAX_RULE_BASIS_PATHS)) throw new Error("state observed rule basis is invalid");
  if (!rValidHashes(state.rule_basis_unmatched, R_MAX_RULE_BASIS_PATHS)) throw new Error("state unmatched rule basis is invalid");
  for (const field of ["rule_basis_hash", "digest_rule_basis_hash"]) {
    if (state[field] !== null && !R_HASH.test(state[field])) throw new Error("state rule basis hash is invalid");
  }
  if (!Array.isArray(state.pending_rule_reads) || state.pending_rule_reads.length > 8 || state.pending_rule_reads.some((entry) =>
    !entry || !R_HASH.test(entry.command_hash || "") ||
    (entry.tool_use_id !== null && entry.tool_use_id !== undefined && (typeof entry.tool_use_id !== "string" || !entry.tool_use_id || entry.tool_use_id.length > 256)) ||
    !rValidHashes(entry.path_hashes, R_MAX_RULE_BASIS_PATHS))) {
    throw new Error("state pending rule reads are invalid");
  }
  for (const field of ["workspace_scope_snapshot", "workspace_digest_snapshot"]) {
    if (!rValidSnapshot(state[field])) throw new Error("state workspace snapshot is invalid");
  }
  if (!rValidHashes(state.changed_target_hashes, 512)) throw new Error("state changed targets are invalid");
  if (!rValidHashes(state.observed_state_hashes, R_MAX_PLAN_TARGETS)) throw new Error("state observed objectives are invalid");
  if (!rValidHashes(state.historical_state_hashes, R_MAX_PLAN_TARGETS)) throw new Error("state historical objectives are invalid");
  if (state.task_id !== null && (!R_SAFE_NAME.test(state.task_id) || state.task_id.length > 128)) throw new Error("state task id is invalid");
  if (state.effort !== null && !R_EFFORTS.has(state.effort)) throw new Error("state effort is invalid");
  if (state.work_type !== null && !R_WORK_TYPES.has(state.work_type)) throw new Error("state work type is invalid");
  if (state.folder_path !== null && (!path.isAbsolute(state.folder_path) || R_CONTROL_CHARACTERS.test(state.folder_path))) {
    throw new Error("state folder path is invalid");
  }
  for (const collection of [state.pending_writes, state.reconciled_writes]) for (const entry of collection) delete entry.preview;
  return state;
}
function rEvent(state, type, data = {}, now = Date.now()) {
  state.event_seq += 1;
  state.events.push({seq: state.event_seq, at: now, type, ...data});
  if (state.events.length > R_MAX_EVENTS) state.events = state.events.slice(-R_MAX_EVENTS);
}
function rExpireDecl(state) {
  if (state.declared_retry?.command_hash === null) state.declared_retry = null;
}
function rAsk(state, kind, details = {}) {
  state.pending_question = {kind, ...details, asked_prompt_epoch: state.prompt_epoch};
}

const R_TASK_FLOW_FIELDS = (
  "digest_shown_epoch digest_prompt_epoch human_response_epoch digest_agreed_epoch pending_denied declared_retry classified_retry " +
  "sensitive_allow pending_writes reconciled_writes mutation_count effect_count verification_count changed_target_hashes observed_state_hashes historical_state_hashes " +
  "source_reads_without_task work_type work_change_authorized plan_write_seq plan_file_hash plan_target_hashes impact_plan_hash expectations_plan_hash redo_contract_hash workspace_scope_snapshot workspace_digest_snapshot " +
  "permission_manifest_hash environment_plan_hash task_permission_epoch task_permissions task_capabilities " +
  "verification_plan_hash verification_claim_mutation_count verification_claim_effect_count " +
  "rules_file_hashes_written investigation_stop_count last_verification test_digest_epoch test_digest_prompt_epoch " +
  "test_digest_response_epoch test_digest_mutation_count test_digest_effect_count test_digest_verification_count " +
  "test_digest_audit_epoch digest_rule_basis_hash completion task_folder_noted stop_turn_hash stop_next_hash"
).split(" ");

function rClearTaskFlow(state) {
  const clean = rBaseState();
  for (const field of R_TASK_FLOW_FIELDS) state[field] = clean[field];
  state.plan_gate_seq = state.event_seq;
}
function rDecodeField(value, field) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_536 ||
    /%(?![0-9A-Fa-f]{2})/.test(value)
  ) {
    throw new Error("bad value " + field);
  }
  let decoded;
  try {
    const bytes = Buffer.from(
      value.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))),
      "latin1",
    );
    decoded = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  } catch {
    throw new Error("bad value " + field);
  }
  if (!decoded || R_CONTROL_CHARACTERS.test(decoded) || R_PARENT_TRAVERSAL.test(decoded)) throw new Error("bad value " + field);
  return decoded;
}
function rResolvePath(raw, event) {
  let candidate = String(raw ?? "");
  if (!candidate) return null;
  if (candidate === "~") candidate = os.homedir();
  else if (candidate.startsWith("~/")) candidate = path.join(os.homedir(), candidate.slice(2));
  const cwd = event && typeof event.cwd === "string" && event.cwd ? event.cwd : process.cwd();
  if (!path.isAbsolute(candidate)) candidate = path.resolve(cwd, candidate);
  candidate = path.normalize(candidate);
  if (candidate.length > 1) candidate = candidate.replace(/[\\/]+$/, "");
  return candidate;
}
function rFsType(target) {
  try {
    const metadata = fs.lstatSync(target);
    if (metadata.isSymbolicLink()) return "symlink";
    if (metadata.isDirectory()) return "dir";
    if (metadata.isFile()) return "file";
    return "special";
  } catch (error) {
    if (error && error.code === "ENOENT") return "missing";
    return "unreadable";
  }
}
function rCanonical(target) {
  let existing = path.resolve(target);
  const suffix = [];
  while (rFsType(existing) === "missing" && path.dirname(existing) !== existing) {
    suffix.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  try {
    return path.join(fs.realpathSync.native(existing), ...suffix);
  } catch {
    return null;
  }
}
function rInside(target, base) {
  const normalizedTarget = path.resolve(target);
  const normalizedBase = path.resolve(base);
  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(normalizedBase.endsWith(path.sep) ? normalizedBase : normalizedBase + path.sep);
}
function rUnsafePath(base, target) {
  if (!rInside(target, base)) return "outside";
  let current = path.resolve(target);
  const floor = path.resolve(base);
  while (current !== floor) {
    const type = rFsType(current);
    if (type === "symlink" || type === "special" || type === "unreadable") return type;
    current = path.dirname(current);
  }
  const floorType = rFsType(floor);
  return floorType === "symlink" || floorType === "special" || floorType === "unreadable" ? floorType : null;
}
function rNearestExisting(target) {
  let current = path.resolve(target);
  while (rFsType(current) === "missing" && path.dirname(current) !== current) current = path.dirname(current);
  return current;
}
function rSafeSlug(value) {
  const normalized = String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return normalized || "item-" + rHash(value).slice(0, 10);
}
function rValidName(value) {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= 128 &&
    value !== "." &&
    value !== ".." &&
    !R_CONTROL_CHARACTERS.test(value) &&
    !/[\\/]/.test(value)
  );
}
function rConfigRoot(options = {}) {
  const environment = options.environment || process.env;
  const configured = options.hostConfigRoot || environment.CODEX_HOME;
  const resolved = path.resolve(configured || path.join(os.homedir(), ".codex"));
  return rCanonical(resolved) || resolved;
}
function rPointerPath(options = {}) {
  return path.join(rConfigRoot(options), R_POINTER_FILE);
}
function rRemoveTemp(target) {
  try {
    fs.unlinkSync(target);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
}
function rAtomic(target, content, mode = 0o600) {
  const parent = path.dirname(target);
  const parentType = rFsType(parent);
  if (parentType !== "dir" || rUnsafePath(rNearestExisting(parent), parent)) {
    throw new Error("unsafe parent");
  }
  const existing = rFsType(target);
  if (existing === "symlink" || existing === "special" || existing === "dir" || existing === "unreadable") {
    throw new Error("unsafe target");
  }
  const temporary = target + "." + process.pid + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(temporary, content, {encoding: "utf8", mode, flag: "wx"});
    fs.renameSync(temporary, target);
    try {
      fs.chmodSync(target, mode);
    } catch {}
  } finally {
    rRemoveTemp(temporary);
  }
}
function rEnsureDir(target, created = []) {
  const absolute = path.resolve(target);
  const existing = rNearestExisting(absolute);
  if (rFsType(existing) !== "dir") throw new Error("unsafe directory");
  if (rUnsafePath(path.parse(existing).root, existing)) throw new Error("unsafe directory");
  const missing = [];
  for (let current = absolute; current !== existing; current = path.dirname(current)) missing.unshift(current);
  for (const directory of missing) {
    fs.mkdirSync(directory, {mode: 0o700});
    created.push(directory);
    if (rFsType(directory) !== "dir") throw new Error("unsafe directory");
    try {
      fs.chmodSync(directory, 0o700);
    } catch {}
  }
  return absolute;
}
function rCreateFile(target, content, created = []) {
  const type = rFsType(target);
  if (type === "file") return false;
  if (type !== "missing") throw new Error("unsafe target");
  rAtomic(target, content, 0o600);
  created.push(target);
  return true;
}
function rRollback(created) {
  for (const target of created.slice().reverse()) {
    try {
      const type = rFsType(target);
      if (type === "file") fs.unlinkSync(target);
      else if (type === "dir") fs.rmdirSync(target);
    } catch {}
  }
}
function rValidateFolderPath(raw, event, options = {}) {
  const decoded = rDecodeField(raw, "path");
  if (!path.isAbsolute(decoded)) throw new Error("bad value path");
  const target = path.normalize(decoded);
  const cwd = rCanonical(rResolvePath(".", event));
  const config = rCanonical(rConfigRoot(options));
  const physical = rCanonical(target);
  if (!cwd || !config || !physical || physical === path.parse(physical).root) throw new Error("bad value path");
  if (rInside(physical, cwd) || rInside(cwd, physical)) throw new Error("bad value path");
  if (rInside(physical, config) || rInside(config, physical)) throw new Error("bad value path");
  const existing = rNearestExisting(physical);
  if (rFsType(existing) !== "dir" || rUnsafePath(path.parse(existing).root, existing)) throw new Error("bad value path");
  if (rFsType(physical) !== "missing" && rFsType(physical) !== "dir") throw new Error("bad value path");
  if (rFsType(physical) === "dir" && rUnsafePath(existing, physical)) throw new Error("bad value path");
  return physical;
}
function rEmptyIndex() {
  return {schema: R_INDEX_SCHEMA, pointer_version: 1, projects: []};
}
function rReadIndex(folder, allowMissing = true) {
  const target = path.join(folder, R_INDEX_FILE);
  const type = rFsType(target);
  if (type === "missing" && allowMissing) return rEmptyIndex();
  if (type !== "file") throw new Error("index is missing or unsafe");
  const metadata = fs.lstatSync(target);
  if (metadata.isSymbolicLink() || metadata.size > R_MAX_INDEX_BYTES) throw new Error("index is unsafe or oversized");
  let value;
  try {
    value = JSON.parse(fs.readFileSync(target, "utf8"));
  } catch {
    throw new Error("index is unreadable");
  }
  if (
    !value ||
    value.schema !== R_INDEX_SCHEMA ||
    value.pointer_version !== 1 ||
    !Array.isArray(value.projects) ||
    value.projects.length > 1_024
  ) {
    throw new Error("index has an unsupported schema");
  }
  const seenCwd = new Set();
  const seenFolder = new Set();
  for (const entry of value.projects) {
    if (
      !entry ||
      typeof entry.cwd !== "string" ||
      !path.isAbsolute(entry.cwd) ||
      typeof entry.name !== "string" ||
      !rValidName(entry.name) ||
      typeof entry.folder !== "string" ||
      !/^projects\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(entry.folder) ||
      seenCwd.has(entry.cwd) ||
      seenFolder.has(entry.folder)
    ) {
      throw new Error("index contains an invalid project");
    }
    seenCwd.add(entry.cwd);
    seenFolder.add(entry.folder);
  }
  return value;
}
function rWriteIndex(folder, index) {
  const ordered = {
    schema: R_INDEX_SCHEMA,
    pointer_version: 1,
    projects: index.projects
      .slice()
      .sort((left, right) => left.cwd.localeCompare(right.cwd))
      .map(({cwd, name, folder: projectFolder}) => ({cwd, name, folder: projectFolder})),
  };
  rAtomic(path.join(folder, R_INDEX_FILE), JSON.stringify(ordered, null, 2) + "\n", 0o600);
}
function rReadPointer(options = {}) {
  const pointer = rPointerPath(options);
  const type = rFsType(pointer);
  if (type === "missing") return {status: "missing", pointer, folder: null};
  if (type !== "file") return {status: "unreadable", pointer, folder: null};
  const metadata = fs.lstatSync(pointer);
  if (metadata.isSymbolicLink() || metadata.size > R_MAX_POINTER_BYTES) return {status: "unreadable", pointer, folder: null};
  let value;
  try {
    value = fs.readFileSync(pointer, "utf8").trim();
  } catch {
    return {status: "unreadable", pointer, folder: null};
  }
  if (!value || !path.isAbsolute(value) || R_CONTROL_CHARACTERS.test(value) || value.includes("\n")) {
    return {status: "unreadable", pointer, folder: null};
  }
  const folder = rCanonical(value);
  if (!folder) return {status: "unreadable", pointer, folder: null};
  if (rFsType(value) === "missing") return {status: "folder-missing", pointer, folder};
  if (rFsType(value) !== "dir" || rUnsafePath(path.parse(value).root, value)) {
    return {status: "unreadable", pointer, folder: null};
  }
  return {status: "ready", pointer, folder};
}
function rWriteHostPointer(folder, options = {}) {
  const root = rConfigRoot(options);
  if (rFsType(root) !== "dir" || rUnsafePath(path.parse(root).root, root)) throw new Error("host config is unsafe");
  rAtomic(rPointerPath(options), folder + "\n", 0o600);
}
function rPreserve(target) {
  if (rFsType(target) === "missing") return null;
  let recovery;
  do recovery = target + ".recovery-" + crypto.randomBytes(5).toString("hex");
  while (rFsType(recovery) !== "missing");
  fs.renameSync(target, recovery);
  return recovery;
}
function rProjectAtCwd(index, event) {
  const cwd = rCanonical(rResolvePath(".", event));
  return cwd ? index.projects.find((entry) => entry.cwd === cwd) || null : null;
}
function rRefreshConfig(state, event, options = {}) {
  const result = rReadPointer(options);
  state.folder_status = result.status;
  if (result.status === "ready" || result.status === "folder-missing") state.folder_path = result.folder;
  else if (result.status === "missing") state.folder_path = null;
  if (result.status !== "ready") {
    state.project_name = null;
    state.project_slug = null;
    state.project_path = null;
    state.task_path = null;
    return result;
  }
  let index;
  try {
    index = rReadIndex(result.folder, true);
  } catch (error) {
    state.folder_status = "index-unreadable";
    state.folder_path = result.folder;
    state.project_name = null;
    state.project_slug = null;
    state.project_path = null;
    state.task_path = null;
    return {...result, status: "index-unreadable", error: String(error?.message || error)};
  }
  const project = rProjectAtCwd(index, event);
  if (!project) {
    state.project_name = null;
    state.project_slug = null;
    state.project_path = null;
    state.task_path = null;
    return {...result, index, project: null};
  }
  state.project_name = project.name;
  state.project_slug = path.basename(project.folder);
  state.project_path = path.join(result.folder, project.folder);
  state.task_path = state.task_id
    ? path.join(state.project_path, "tasks", rSafeSlug(state.task_id))
    : null;
  return {...result, index, project};
}
function rRecoveryCard(state, kind, target = null) {
  const pointer = kind === "pointer";
  const subject = pointer ? "host pointer" : "index.json";
  const destination = state.folder_path ? " path=" + state.folder_path : " path=<the path they give>";
  return rCard(
    "Ask",
    "PMNM cannot safely read its " + subject + (target ? " at " + target : "") + ".",
    "ask the human whether to preserve the invalid file and rebuild this configuration; stop until they answer; after yes: pmnm-guard folder" + destination,
  );
}
function rEnterRecovery(state, configuration) {
  const kind = configuration.status === "unreadable"
    ? "pointer-recovery"
    : configuration.status === "index-unreadable" ? "index-recovery" : null;
  if (!kind) return false;
  state.phase = "RECOVERY";
  if (state.pending_question?.kind !== kind) {
    rAsk(state, kind, {folder_hash: configuration.folder ? rHash(configuration.folder) : undefined});
  }
  return true;
}
function rFolderCard(state, missing = false) {
  if (missing) {
    return rCard(
      "Ask",
      "The PMNM folder is not at " + state.folder_path + " any more.",
      "ask the human whether the PMNM folder moved or was deleted; stop until they answer; then pmnm-guard folder path=<the path they give>",
    );
  }
  return rCard(
    "Ask",
    "PMNM needs one folder for its notes on this machine; none is set yet.",
    "ask the human where to create the PMNM folder, suggest ~/PMNM; stop until they answer; then pmnm-guard folder path=<the path they give>",
  );
}
function rProjectCard(state, event) {
  const suggested = rSafeSlug(path.basename(rResolvePath(".", event)));
  return rCard(
    "Ask",
    "This repository has no project folder in PMNM yet.",
    "ask the human the project name, suggest " + suggested + "; stop until they answer; then pmnm-guard project name=<the name they give>",
  );
}
function rNoTaskCard(state) {
  return rCard(
    "Blocked",
    "No task is open, so PMNM does not write anything yet.",
    "pmnm-guard start task=<ticket-or-id> effort=<light|standard|high> work=<implementation|advisory|verification>",
  );
}
function rTaskIdentityKey(value) {
  return String(value).toLowerCase().replaceAll("-", "");
}
function rTaskIssueKey(value) {
  const match = String(value).match(/(?:^|[^A-Za-z0-9])([A-Za-z][A-Za-z0-9]*-\d+)(?=$|[^A-Za-z0-9])/);
  return match ? match[1].toLowerCase() : null;
}
function rContainsTaskId(name, taskId) {
  const escaped = String(taskId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?:^|[^a-z0-9])" + escaped + "(?:$|[^a-z0-9])", "i").test(String(name));
}
function rTaskCandidate(name, taskId) {
  const nameKey = rTaskIssueKey(name);
  const taskKey = rTaskIssueKey(taskId);
  return (
    rTaskIdentityKey(name) === rTaskIdentityKey(taskId) ||
    rContainsTaskId(name, taskId) ||
    Boolean(nameKey && taskKey && nameKey === taskKey)
  );
}
function rQ(value){return JSON.stringify(String(value)).replace(/[$`]/g, "\\$&");}

function rTaskFolderCard(state) {
  const place = String(state.task_path || "");
  let existing = [];
  try {
    const tasks = state.project_path ? path.join(state.project_path, "tasks") : null;
    if (tasks && rFsType(tasks) === "dir" && !rUnsafePath(state.folder_path, tasks)) {
      existing = fs
        .readdirSync(tasks, {withFileTypes: true})
        .filter((entry) => entry.isDirectory() && R_SAFE_NAME.test(entry.name))
        .map((entry) => entry.name)
        .filter((name) => name !== rSafeSlug(state.task_id))
        .filter((name) => rTaskCandidate(name, state.task_id))
        .sort((left, right) => left.localeCompare(right))
        .slice(0, 6);
    }
  } catch {
    existing = [];
  }
  const dest = rQ(place), mkdir = "mkdir -p " + dest;
  const found = existing.length;
  const names = existing.join(", ");
  const candidates = found ? " Candidate task folders: " + names + "." : "";
  const tasks = state.project_path ? path.join(state.project_path, "tasks") : "";
  if (found) {
    rAsk(state, "task-identity", {candidates: existing.map((name) => rHash(path.join(tasks, name)))});
  } else if (state.pending_question?.kind === "task-identity") {
    state.pending_question = null;
  }
  const adopt = found === 1
    ? "after yes, run exactly: mv " + rQ(path.join(tasks, existing[0])) + " " + dest + "; "
    : "after the human names one candidate, move that exact folder to " + dest + "; ";
  return rCard(
    found ? "Ask" : "Note",
    "Task " + state.task_id + " has no folder yet at " + place + "." + candidates,
    found
      ? "ask the human whether " + names + " is this task; stop until they answer; " + adopt + "after no, run exactly: " + mkdir
      : "run exactly: " + mkdir,
  );
}
function rTaskFile(state, name) {
  return state.task_path ? path.join(state.task_path, name) : null;
}
function rReadTask(state, name) {
  const target = rTaskFile(state, name);
  if (!target || !state.folder_path || rFsType(target) !== "file" || rUnsafePath(state.folder_path, target)) {
    return {status: "missing", content: ""};
  }
  try {
    const metadata = fs.statSync(target);
    if (metadata.size > R_MAX_TASK_FILE_BYTES) return {status: "invalid", content: ""};
    return {status: "ready", content: fs.readFileSync(target, "utf8")};
  } catch {
    return {status: "invalid", content: ""};
  }
}
function rRulePaths(state, existing = false) {
  return [
    state.folder_path && path.join(state.folder_path, R_GENERAL_RULES_FILE),
    state.project_path && path.join(state.project_path, R_PROJECT_RULES_FILE),
    state.project_path && path.join(state.project_path, R_PROJECT_KNOWLEDGE_FILE),
    rTaskFile(state, R_TASK_RULES_FILE),
  ].filter((target) => target && (!existing || rFsType(target) === "file"));
}
function rRuleBasis(state) {
  const rulePaths = rRulePaths(state, true);
  const paths = [
    ...rulePaths,
    rTaskFile(state, R_TASK_INDEX_FILE),
    rTaskFile(state, R_TASK_PLAN_FILE),
    rTaskFile(state, R_TASK_VERIFY_FILE),
    rTaskFile(state, R_TASK_IMPACT_FILE),
    rTaskFile(state, R_TASK_EXPECTATIONS_FILE),
    rTaskFile(state, R_TASK_PERMISSION_FILE),
  ].filter((target) => target && rFsType(target) === "file");
  return {
    paths,
    hash: rulePaths.length ? rHash(JSON.stringify(rulePaths.map((target) => [target, rFileSig(target)]))) : null,
  };
}
function rRequireRuleBasis(state) {
  const basis = rRuleBasis(state);
  state.rule_basis_paths = basis.paths;
  state.rule_basis_hash = basis.hash;
  state.rule_basis_observed_hashes = [];
  state.rule_basis_unmatched = [];
  state.pending_rule_reads = [];
  state.rule_basis_required = basis.paths.length > 0;
  return basis;
}
function rRuleBasisCurrent(state) {
  const basis = rRuleBasis(state);
  if (!state.rule_basis_required && state.rule_basis_hash === null) {
    state.rule_basis_paths = basis.paths;
    state.rule_basis_hash = basis.hash;
  }
  return !state.rule_basis_required && basis.hash === state.rule_basis_hash;
}
function rRuleBasisCard(state) {
  const all = state.rule_basis_paths.length ? state.rule_basis_paths : rRuleBasis(state).paths;
  const observed = new Set(state.rule_basis_observed_hashes || []);
  const unmatched = new Set(state.rule_basis_unmatched || []);
  const awaiting = new Set(
    (state.pending_rule_reads || []).flatMap((entry) => entry.path_hashes || []),
  );
  // Name only what is still missing, and say what was observed for each one.
  const pending = all.filter((target) => !observed.has(rHash(target)));
  const described = pending.map((target) => {
    const hash = rHash(target);
    const note = rFsType(target) !== "file"
      ? "absent"
      : awaiting.has(hash)
        ? "awaiting its result"
        : unmatched.has(hash)
          ? "no result carried its bytes"
          : "not read";
    return target + " (" + note + ")";
  });
  // Truncate by the card's real budget rather than by a count, and say so when it happens.
  const shown = [];
  let budget = 1_500;
  for (const entry of described) {
    if (shown.length && budget - entry.length - 2 < 0) break;
    shown.push(entry);
    budget -= entry.length + 2;
  }
  const rest = described.length - shown.length;
  const list = shown.join("; ") + (rest > 0 ? "; and " + rest + " more not shown here" : "");
  const done = all.length - pending.length;
  return rCard(
    "Blocked",
    "The active task's durable rules and context have not been reloaded for this session; " +
      done + " of " + all.length + " required paths are satisfied.",
    "use a shell read that returns the complete bytes of these exact paths: " + list + "; then continue; changed rules require a revised Digest",
  );
}
function rRuleReadMatches(state, event, payload) {
  if (!state.rule_basis_required || !state.rule_basis_paths.length) return [];
  const input = event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};
  const direct = typeof (input.file_path || input.path) === "string" ? rResolvePath(input.file_path || input.path, event) : null;
  const cwd = rCanonical(rResolvePath(".", event));
  return state.rule_basis_paths.filter((target) => {
    if (direct && path.resolve(direct) === path.resolve(target)) return true;
    if (typeof payload !== "string" || !payload) return false;
    const relative = cwd && rInside(target, cwd) ? path.relative(cwd, target) : null;
    return payload.includes(target) || (relative && payload.includes(relative));
  });
}
function rPreflightIssue(source, line, status, rule, correction, detail = "") {
  return {source, line: Math.max(1, Number(line) || 1), status, rule, correction, detail: rOneLine(detail, 180)};
}
function rSeedTask(state) {
  if (
    !state.task_path || !state.project_path || !state.folder_path ||
    rFsType(state.project_path) !== "dir" || rFsType(state.task_path) !== "dir" ||
    rUnsafePath(state.folder_path, state.project_path) || rUnsafePath(state.folder_path, state.task_path)
  ) return;
  const created = [];
  try {
    rCreateFile(path.join(state.project_path, R_PROJECT_RULES_FILE), "# Project rules\n", created);
    rCreateFile(
      path.join(state.project_path, R_PROJECT_KNOWLEDGE_FILE),
      R_PROJECT_KNOWLEDGE_TEMPLATE,
      created,
    );
    rCreateFile(
      rTaskFile(state, R_TASK_INDEX_FILE),
      "# " + state.task_id + "\n\nWhat:\nCurrent state:\nNext step:\nOpen questions:\nLinks:\n",
      created,
    );
    rCreateFile(
      rTaskFile(state, R_TASK_PLAN_FILE),
      "# Plan\n\n<!-- - [ ] path — change | excluded: path — reason -->\n" +
        "<!-- - [ ] state: id — before => after | unchanged-state: id — invariant -->\n",
      created,
    );
    rCreateFile(
      rTaskFile(state, R_TASK_VERIFY_FILE),
      "# Verification\n\n## Plan\n\n<!-- Explain unavailable fields. -->\n" +
        "<!-- - contract: contract -->\n<!-- - request-case: case -->\n" +
        "<!-- - preserved-case: case -->\n<!-- - entry: surface -->\n" +
        "<!-- - environment: environment -->\n<!-- - actor: actor -->\n" +
        "<!-- - data: safe data -->\n<!-- - steps: steps -->\n<!-- - expect: expected result -->\n" +
        "<!-- - capability: tool/reason -->\n<!-- - evidence: proof -->\n<!-- - cleanup: action/reason -->\n\n" +
        "## Results\n\n<!-- - example: request → result -->\n<!-- - unchanged: preserved → result -->\n",
      created,
    );
    if (state.effort !== "light") {
      rCreateFile(
        rTaskFile(state, R_TASK_IMPACT_FILE),
        "# Impact\n\nMode: local\nReason: <why local, or use transitive>\n\n" +
          "<!-- Transitive mode sections: ## Roots, ## Ledger, ## Dynamic boundaries. -->\n\n" +
          "## Non-functional dispositions\n\n" +
          R_IMPACT_DIMENSIONS.map((name) => "- " + name + ": <evidence/reason>").join("\n") +
          "\n\n## Omission audit\n\n- before-plan: <roots without plan.md>\n" +
          "- final-fingerprint: pending\n- final: pending\n",
        created,
      );
    }
    rCreateFile(
      rTaskFile(state, R_TASK_PERMISSION_FILE),
      JSON.stringify({schema: "pmnm.permissions/v1", task: []}, null, 2) + "\n",
      created,
    );
    if (state.effort === "high") {
      rCreateFile(
        rTaskFile(state, R_TASK_EXPECTATIONS_FILE),
        "# Expectations\n\n| Expectation | Coverage | Source | Blast | Evidence or open boundary |\n|---|---|---|---|---|\n" +
          "<!-- coverage: covered | partial | missing | unspecified -->\n" +
          "<!-- source: requirement | later-comment | observed-code | conversation-decision -->\n" +
          "<!-- blast: BR0 isolated .. BR4 systemic -->\n",
        created,
      );
      rCreateFile(
        rTaskFile(state, R_TASK_REVIEW_FILE),
        "# Independent review\n\n" +
          "<!-- - contract: contract -->\n<!-- - plan-digest: plan hash -->\n<!-- - fingerprint: check fingerprint -->\n" +
          "<!-- - changed-surface: surface -->\n<!-- - evidence: proof -->\n<!-- - strongest-counterexample: case -->\n" +
          "<!-- - independent-check: check -->\n<!-- - disagreement: result or none -->\n<!-- - residual-limit: limit -->\n" +
          "<!-- - impact-roots: -->\n<!-- - impact-omission-check: -->\n<!-- - non-functional-dispositions: -->\n",
        created,
      );
    }
  } catch {
    rRollback(created);
    throw new Error("unsafe task folder");
  }
}
function rPlan(state, event) {
  const file = rReadTask(state, R_TASK_PLAN_FILE);
  if (file.status !== "ready") {
    return {
      status: file.status,
      targets: [], excluded: [], states: [], invariants: [], deliverables: [], boundaries: [], hash: null, normalizations: [],
      issues: [rPreflightIssue(R_TASK_PLAN_FILE, 1, file.status, "readable-plan", "Create a readable plan.md inside the task folder.")],
    };
  }
  const targets = [], excluded = [], states = [], invariants = [], deliverables = [], boundaries = [];
  const seenFiles = new Set(), seenStates = new Set(), seenDeliverables = new Set(), seenBoundaries = new Set();
  const issues = [], normalizations = [];
  const cwd = rCanonical(rResolvePath(".", event));
  const add = (line, status, rule, correction, detail = "") => {
    issues.push(rPreflightIssue(R_TASK_PLAN_FILE, line, status, rule, correction, detail));
  };
  for (const [index, rawLine] of file.content.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line.startsWith("- [")) continue;
    const checked = /^- \[[xX]\]/.test(line);
    const deliverableMatch = line.match(/^- \[[ xX]\] (deliverable|boundary):\s+([a-z0-9][a-z0-9._:/-]{0,127})\s+(?:—|--)\s+(.+)$/i);
    if (deliverableMatch) {
      const [, kind, rawId, rawValue] = deliverableMatch;
      const id = rawId.toLowerCase(), value = rawValue.trim();
      const seen = kind.toLowerCase() === "deliverable" ? seenDeliverables : seenBoundaries;
      if (seen.has(id) || !value || R_CONTROL_CHARACTERS.test(value) || Buffer.byteLength(value, "utf8") > 480) {
        add(lineNumber, seen.has(id) ? "duplicate" : "malformed", "valid-" + kind.toLowerCase(), "Use one unique id and bounded value.", id);
        continue;
      }
      seen.add(id);
      const entry = {id, hash: rHash(kind.toLowerCase() + "\0" + id), checked};
      if (kind.toLowerCase() === "deliverable") deliverables.push({...entry, result: value});
      else boundaries.push({...entry, disposition: value});
      continue;
    }
    if (/^- \[[ xX]\] (?:deliverable|boundary):/i.test(line)) {
      add(lineNumber, "malformed", "valid-deliverable-entry", "Use `deliverable: id — result` or `boundary: id — disposition`.");
      continue;
    }
    const stateMatch = line.match(/^- \[[ xX]\] (state|unchanged-state):\s+(\S+)\s+(?:—|--)\s+(.+)$/);
    if (stateMatch) {
      const [, kind, id, rawValue] = stateMatch;
      const value = rawValue.trim();
      if (!R_SAFE_STATE_ID.test(id) || seenStates.has(id) || R_CONTROL_CHARACTERS.test(value) || Buffer.byteLength(value, "utf8") > 480) {
        add(
          lineNumber,
          seenStates.has(id) ? "duplicate" : "malformed",
          seenStates.has(id) ? "unique-state-id" : "valid-state-entry",
          seenStates.has(id) ? "Combine the repeated state objective into one line." : "Use one safe state id and a bounded observable value.",
          id,
        );
        continue;
      }
      seenStates.add(id);
      if (kind === "state") {
        const transition = value.match(/^(.+?)\s+=>\s+(.+)$/);
        const before = transition?.[1].trim() || "";
        const after = transition?.[2].trim() || "";
        if (!transition || !before || !after || before === after || before.includes("=>") || after.includes("=>")) {
          add(
            lineNumber,
            before && before === after ? "state-noop" : "malformed",
            "observable-state-transition",
            "Write one transition whose before and after values are both present and different.",
            id,
          );
          continue;
        }
        states.push({id, hash: rHash(id), before, after, checked});
      } else invariants.push({id, hash: rHash(id), invariant: value, checked});
      continue;
    }
    if (/^- \[[ xX]\] (?:state|unchanged-state):/.test(line)) {
      add(lineNumber, "malformed", "valid-state-entry", "Use `state: id — before => after` or `unchanged-state: id — invariant`.", line);
      continue;
    }
    const match = line.match(/^- \[[ xX]\] (?:(excluded):\s+)?(?:`([^`]+)`|(.+?))\s+(?:—|--)\s+(.+)$/);
    if (!match) {
      add(lineNumber, "malformed", "valid-file-entry", "Use one file path, an em dash or `--`, and one concrete reason.", line);
      continue;
    }
    const declared = String(match[2] || match[3] || "").trim();
    const reason = String(match[4] || "").trim();
    if (
      !declared ||
      !reason ||
      R_PARENT_TRAVERSAL.test(declared) ||
      R_CONTROL_CHARACTERS.test(declared) ||
      /[*?{}\[\]]/.test(declared) ||
      (!match[2] && /\s/.test(declared))
    ) {
      add(lineNumber, "malformed", "safe-file-path", "Use one literal repository file path and one non-empty reason; quote paths containing spaces.", line);
      continue;
    }
    const resolved = rCanonical(path.isAbsolute(declared) ? declared : rResolvePath(declared, event));
    if (!resolved || !cwd || resolved === cwd || !rInside(resolved, cwd) || rInside(resolved, path.join(cwd, ".git"))) {
      add(lineNumber, "malformed", "repository-local-file", "Use a repository-relative file path; keep external helpers as referenced task evidence instead of implementation targets.", declared);
      continue;
    }
    const relative = path.relative(cwd, resolved);
    if (declared.endsWith("/") || rFsType(resolved) === "dir") {
      add(lineNumber, "directory", "file-target", "List each material file separately; a directory is not a plan target.", relative || declared);
      continue;
    }
    if (path.isAbsolute(declared)) {
      normalizations.push({source: R_TASK_PLAN_FILE, line: lineNumber, from: declared, to: relative});
    }
    const hash = rHash(resolved);
    if (seenFiles.has(hash)) {
      add(lineNumber, "duplicate", "duplicate-file-target", "Combine every objective for this file into one plan line.", relative);
      continue;
    }
    seenFiles.add(hash);
    const entry = {hash, label: path.relative(cwd, resolved), path: resolved, reason, checked};
    (match[1] ? excluded : targets).push(entry);
  }
  const sort = (entries, key) => entries.sort((left, right) => left[key].localeCompare(right[key]));
  const contractHash = rHash(JSON.stringify({
    targets: sort(targets.map(({label, reason}) => ({label, reason})), "label"),
    excluded: sort(excluded.map(({label, reason}) => ({label, reason})), "label"),
    states: sort(states.map(({id, before, after}) => ({id, before, after})), "id"),
    invariants: sort(invariants.map(({id, invariant}) => ({id, invariant})), "id"),
    deliverables: sort(deliverables.map(({id, result}) => ({id, result})), "id"),
    boundaries: sort(boundaries.map(({id, disposition}) => ({id, disposition})), "id"),
  }));
  const result = {targets,excluded,states,invariants,deliverables,boundaries,hash:contractHash};
  for (const entry of deliverables) if (!seenBoundaries.has(entry.id)) {
    add(1, "missing-boundary", "deliverable-boundary", "Add its matching boundary.", entry.id);
  }
  for (const entry of boundaries) if (!seenDeliverables.has(entry.id)) {
    add(1, "malformed", "orphan-boundary", "Add its matching deliverable.", entry.id);
  }
  if (!state.work_type) {
    add(
      1,
      "work-missing",
      "explicit-work-type",
      "Resume the task with `work=implementation`, `work=advisory` or `work=verification` before showing the Digest.",
    );
  }
  if (state.work_type === "advisory" && (targets.length || states.length)) {
    add(
      1,
      "work-mismatch",
      "advisory-work-shape",
      "Remove file and changing-state objectives. Use one paired `deliverable:` and `boundary:` for advisory work.",
    );
  }
  if (state.work_type === "verification" && (targets.length || states.length || deliverables.length || boundaries.length)) {
    add(
      1,
      "work-mismatch",
      "verification-work-shape",
      "Remove changing file, state and deliverable objectives. Verification work may preserve scope with only `excluded:` and `unchanged-state:` entries.",
    );
  }
  const hasObjective = state.work_type === "verification"
    ? excluded.length || invariants.length
    : targets.length || states.length || deliverables.length;
  if (!hasObjective && !issues.length) {
    add(
      1,
      "empty",
      "material-objective",
      state.work_type === "verification"
        ? "Add at least one `excluded:` or `unchanged-state:` objective."
        : "Add at least one file, changing state or deliverable objective.",
    );
  }
  if (targets.length + excluded.length + states.length + invariants.length + deliverables.length + boundaries.length > R_MAX_PLAN_TARGETS) {
    add(1, "too-large", "bounded-plan", "Reduce the plan to at most " + R_MAX_PLAN_TARGETS + " material entries.");
  }
  if (issues.length) return {...result, status: issues[0].status, detail: issues[0].detail, issues, normalizations};
  return {...result, status: "ready", issues, normalizations};
}
function rPlanCard(state, kind, detail = "") {
  const p = rTaskFile(state, R_TASK_PLAN_FILE) || R_TASK_PLAN_FILE;
  const v = rTaskFile(state, R_TASK_VERIFY_FILE) || R_TASK_VERIFY_FILE;
  const messages = {
    missing: `${p} is missing.`,
    invalid: `${p} cannot be read safely.`,
    empty: `${p} has no file, state or deliverable objective.`,
    "missing-boundary": `${p} is missing a paired boundary: ${detail}.`,
    malformed: `${p} has a malformed or non-local target line${detail ? `: ${detail}` : "."}`,
    directory: `${detail || "A directory"} is a directory; ${p} targets individual files.`,
    "state-noop": `${detail} is a no-op.`,
    duplicate: `${p} repeats ${detail}; combine every objective for that path into one line.`,
    "too-large": `${p} has too many targets.`,
    "work-missing": "The task has no explicit work type.",
    "work-mismatch": "The plan contradicts the task work type.",
    stale: `${p} and the bound impact or expectations contract have not changed since the last Digest or redo.`,
    changed: `${p} changed after the Digest was shown.`,
    scope: `${detail || "A target"} is not in ${p}.`,
    excluded: `An excluded file changed: ${detail}.`,
    "no-change": "The agreed implementation plan has no changed target.",
    incomplete: `The audit still has unchanged plan targets: ${detail}.`,
    "state-unobserved": `State not observed: ${detail}.`,
    "state-evidence": `Stale state evidence: ${detail}.`,
    unchecked: `The audit still has objectives not marked complete: ${detail}.`,
    workspace: `The workspace changed after the first Digest outside the agreed plan: ${detail}.`,
  };
  const english = messages[kind] || messages.invalid;
  const revise = ["workspace", "excluded", "scope", "changed"].includes(kind);
  const missing = ["incomplete", "no-change", "state-unobserved", "state-evidence"].includes(kind);
  const next = kind === "work-missing"
    ? `run pmnm-guard start task=${state.task_id || "<ticket-or-id>"} effort=${state.effort || "<light|standard|high>"} work=<implementation|advisory|verification>`
    : kind === "work-mismatch"
      ? state.work_type === "verification"
        ? `remove changing objectives from ${p}, then keep only excluded: and unchanged-state: entries`
        : `remove file and changing-state objectives from ${p}, then use paired deliverable: and boundary: entries`
      : revise
    ? `run pmnm-guard redo first; then investigate, update ${p}, show the revised Digest, and run pmnm-guard digest`
    : kind === "unchecked"
      ? `confirm the objective's result and evidence, finish anything missing, then mark it [x] in ${p}`
      : missing
        ? `finish the missing work; if it will not be done, run pmnm-guard redo first, then revise ${p}, show the revised Digest, and run pmnm-guard digest`
        : `list files, states or paired deliverables in ${p}; put checks in ${v}; show the Digest; run pmnm-guard digest`;
  const level = ["incomplete", "unchecked", "workspace", "excluded", "no-change"].includes(kind) ? "Ask" : "Blocked";
  return rCard( level, english, next);
}
function rVerifyShape(state, plan = null) {
  const file = rReadTask(state, R_TASK_VERIFY_FILE);
  if (file.status !== "ready") return {status: file.status, example: false, unchanged: false, stateProblem: null, missingKinds: [], hash: null};
  const example = file.content.match(/^-\s*example:\s*(\S.+)$/im)?.[1].trim() || "";
  const unchanged = file.content.match(/^-\s*unchanged:\s*(\S.+)$/im)?.[1].trim() || "";
  const claims = new Map();
  // The card has to name the kinds this plan carries, so the missing ones travel with the problem.
  const missingKinds = new Set();
  let stateProblem = null;
  for (const rawLine of file.content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!/^-\s*(?:state|unchanged-state|deliverable|boundary):/i.test(line)) continue;
    const match = line.match(/^-\s*(state|unchanged-state|deliverable|boundary):\s+([a-z0-9][a-z0-9._:/-]{0,127})\s+(?:—|--)\s+(.+)$/i);
    if (!match) {
      stateProblem ||= rOneLine(line, 160);
      continue;
    }
    const key = match[1].toLowerCase() + ":" + match[2].toLowerCase();
    if (claims.has(key)) {
      stateProblem ||= "duplicate " + match[2];
      continue;
    }
    claims.set(key, match[3].trim());
  }
  if (plan?.status === "ready") {
    const expected = [
      ...plan.states.map((entry) => ["state", entry, entry.before + " => " + entry.after]),
      ...plan.invariants.map((entry) => ["unchanged-state", entry, entry.invariant]),
      ...plan.deliverables.map((entry) => ["deliverable", entry, null]),
      ...plan.boundaries.map((entry) => ["boundary", entry, null]),
    ];
    const planned = new Set();
    for (const [kind, objective, value] of expected) {
      const key = kind + ":" + objective.id;
      planned.add(key);
      if (!claims.has(key)) {
        stateProblem ||= "missing " + objective.id;
        missingKinds.add(kind);
      } else if (value !== null && claims.get(key) !== value) {
        stateProblem ||= objective.id;
        missingKinds.add(kind);
      }
    }
    for (const key of claims.keys()) if (!planned.has(key)) stateProblem ||= "unplanned " + key.split(":").slice(1).join(":");
  }
  const normalized = {example, unchanged, claims: [...claims].sort(([left], [right]) => left.localeCompare(right))};
  return {
    status: stateProblem ? "invalid" : "ready",
    example: Boolean(example),
    unchanged: Boolean(unchanged),
    stateProblem,
    missingKinds: [...missingKinds],
    hash: rHash(JSON.stringify(normalized)),
  };
}

const R_VERIFICATION_PLAN_FIELDS = [
  "contract", "request-case", "preserved-case", "entry", "environment", "actor", "data", "steps", "expect", "capability", "evidence", "cleanup",
];

function rVerificationPlan(state) {
  const file = rReadTask(state, R_TASK_VERIFY_FILE);
  if (file.status !== "ready") {
    return {
      status: file.status,
      missing: R_VERIFICATION_PLAN_FIELDS,
      hash: null,
      issues: [rPreflightIssue(R_TASK_VERIFY_FILE, 1, file.status, "readable-verification-plan", "Create a readable verification.md inside the task folder.")],
    };
  }
  const values = new Map();
  const seen = new Set();
  const issues = [];
  for (const [index, raw] of file.content.split(/\r?\n/).entries()) {
    const match = raw.trim().match(/^-\s*([a-z-]+):\s*(\S.*)$/i);
    if (!match) continue;
    const field = match[1].toLowerCase();
    if (!R_VERIFICATION_PLAN_FIELDS.includes(field)) continue;
    if (seen.has(field)) {
      issues.push(rPreflightIssue(
        R_TASK_VERIFY_FILE,
        index + 1,
        "invalid",
        "duplicate-verification-field",
        "Keep exactly one `" + field + ":` line.",
        field,
      ));
      continue;
    }
    seen.add(field);
    const value = match[2].trim();
    if (
      !value ||
      /^<?(?:todo|tbd|unknown|fill|pending)>?$/i.test(value) ||
      /^(?:not[- ]?applicable|n\/?a|unavailable)$/i.test(value)
    ) {
      issues.push(rPreflightIssue(
        R_TASK_VERIFY_FILE,
        index + 1,
        "incomplete",
        "actionable-verification-plan-field",
        "Replace the placeholder with an actionable value, or add the concrete reason it is unavailable.",
        field,
      ));
      continue;
    }
    values.set(field, value);
  }
  const missing = R_VERIFICATION_PLAN_FIELDS.filter((field) => !values.has(field));
  const alreadyReported = new Set(issues.map((issue) => issue.detail));
  for (const field of missing) {
    if (alreadyReported.has(field)) continue;
    issues.push(rPreflightIssue(
      R_TASK_VERIFY_FILE,
      1,
      "incomplete",
      "complete-verification-plan",
      "Add one non-empty `" + field + ":` line.",
      field,
    ));
  }
  const normalized = R_VERIFICATION_PLAN_FIELDS.filter((field) => values.has(field)).map((field) => [field, values.get(field)]);
  const invalid = issues.some((issue) => issue.status === "invalid");
  return {status: invalid ? "invalid" : missing.length ? "incomplete" : "ready", missing, hash: rHash(JSON.stringify(normalized)), issues};
}
function rVerificationPlanCard(state, shape, changed = false) {
  const target = rTaskFile(state, R_TASK_VERIFY_FILE) || R_TASK_VERIFY_FILE;
  const missing = (shape.missing || []).slice(0, 5).join(", ");
  const invalid = shape.status === "invalid";
  return rCard(
    "Blocked",
    changed
      ? "The verification plan changed after the Digest."
      : invalid
        ? "The verification plan contains duplicate fields or cannot be read unambiguously."
        : "The actionable verification plan is incomplete" + (missing ? ": " + missing + "." : "."),
    changed
      ? "run pmnm-guard redo first; then update " + target + ", show the revised Digest, and run pmnm-guard digest"
      : "write contract, request-case, preserved-case, entry, environment, actor, data, steps, expect, capability, evidence, and cleanup in " + target + "; use not-applicable or unavailable only with a reason; then show the Digest and run pmnm-guard digest",
  );
}
function rImpactContract(state, plan, {final = false} = {}) {
  if (state.effort === "light" || !plan?.targets?.length) return {status: "not-required", hash: null, issues: []};
  const file = rReadTask(state, R_TASK_IMPACT_FILE);
  const errs = [];
  const add = (...args) => errs.push(rPreflightIssue(R_TASK_IMPACT_FILE, ...args));
  if (file.status !== "ready") {
    add(1, file.status, "impact.md-readable", "Create impact.md before Digest.");
    return {status: file.status, hash: null, issues:errs};
  }
  if (rScanSecret(file.content)) {
    add(1, "secret", "impact-secret", "Remove secret; keep locator.");
    return {status: "secret", hash: null, issues:errs};
  }
  const ls = file.content.split(/\r?\n/);
  const ok=text=>Boolean(text&&!/<[^>]*>/.test(text)&&!/^<?(?:todo|tbd|unknown|fill|pending|not[- ]?applicable|n\/?a|none|unavailable)>?\W*$/i.test(text));
  const vals=new Map(),put=(k,line,value)=>vals.set(k,[...(vals.get(k)||[]),{line,value:value.trim()}]);
  const fix="Add evidence or N/A reason.",I="invalid",C="incomplete",P="impact-";
  const field=(label,required=true)=>{
    const found=vals.get(label)||[];
    if (found.length > 1) add(found[1].line,I,P+"field-once", "Keep one `" + label + ":`.", label);
    if (required && (!found.length || !ok(found[0].value))) add(found[0]?.line || 1,C,P+"field",fix,label);
    return found[0]?.value || "";
  };
  const dims=new Map(),rs=[],work=[],es=[],no=[];
  let sec="";
  for(const [i,s] of ls.entries()){
    const raw=s.trim(),line=i+1;
    if(raw.startsWith("## ")){sec=raw.slice(3).toLowerCase();continue}if(sec==="ledger"&&raw&&raw[0]!=="|")add(line,I,P+"row","Use a table row.");
    let meta=raw.match(/^(Mode|Reason):\s*(.*)$/i);
    if(!sec&&meta)put(meta[1].toLowerCase(),line,meta[2]);
    meta=raw.match(/^[-*]\s*(before-plan|final-fingerprint|final):\s*(.*)$/i);
    if(sec==="omission audit"&&meta)put(meta[1].toLowerCase(),line,meta[2]);
    const match=raw.match(/^[-*]\s*([a-z-]+):\s*(.*)$/i);
    if (sec==="non-functional dispositions"&&match&&R_IMPACT_DIMENSIONS.includes(match[1].toLowerCase())) {
      const name = match[1].toLowerCase(), value = match[2].trim();
      if (dims.has(name)) add(line,I,P+"dimension-once","Keep one `"+name+":` line.",name);
      else if (!ok(value)) add(line,C,P+"dimension",fix,name);
      else dims.set(name, value);
    }
    const root=raw.match(/^[-*]\s*root:\s*(\S.*?)\s+(?:—|--)\s+(\S.*)$/i);
    if (sec==="roots"&&/^[-*]\s*root\b/i.test(raw)) root && ok(root[1]) && ok(root[2])
      ? rs.push([line, root[1].trim(), root[2].trim()]) : add(line,I,P+"root",fix);
    const boundary=raw.match(/^[-*]\s*boundary:\s*(\S.*?)\s*\|\s*check:\s*(\S.*?)\s*\|\s*outcome:\s*(\S.*?)\s*\|\s*residual:\s*(\S.*)$/i);
    if (sec==="dynamic boundaries"&&/^[-*]\s*boundary\b/i.test(raw)) boundary && boundary.slice(1).every(ok)
      ? es.push(boundary.slice(1).map((item) => item.trim())) : add(line,I,P+"boundary",fix);
    const none=raw.match(/^[-*]\s*none:\s*(\S.*)$/i);
    if (sec==="dynamic boundaries"&&/^[-*]\s*none\b/i.test(raw)) none && ok(none[1]) ? no.push(none[1].trim()) : add(line,I,P+"boundary",fix);
    if(sec!=="ledger"||!/^\|/.test(raw)||/^\|\s*(?:Node\s*\|\s*Relationship\s*\|\s*Evidence\s*\|\s*Disposition\s*\|\s*Follow-up\s*\|$|-+\s*\|(?:\s*-+\s*\|){4}$)/i.test(raw))continue;
    if (!raw.endsWith("|")) { add(line,I,P+"row","End the row with `|`."); continue; }
    const cells=raw.slice(1,-1).split("|").map(item=>item.trim());
    if (cells.length !== 5 || cells.some((item) => !ok(item))) add(line,I,P+"row","Use five concrete cells.");
    else if (!R_IMPACT_DISPOSITIONS.has(cells[3])) {
      add(line,I,P+"disposition","Use an allowed disposition.",cells[3]);
    } else {
      if (cells[3] === "unresolved-blocking") add(line,"blocking",P+"unresolved","Resolve it or record an agreed risk.",cells[0]);
      work.push(cells);
    }
  }
  const modes=vals.get("mode")||[],mode=modes[0]?.value?.toLowerCase()||"";
  if(modes.length!==1||!["local", "transitive"].includes(mode))add(modes[0]?.line||1,I,P+"mode","Use one local or transitive mode.");
  const why=field("reason");
  for (const name of R_IMPACT_DIMENSIONS) if (!dims.has(name) && !errs.some((item) => item.detail === name)) add(1,C,P+"matrix",fix,name);
  const before=field("before-plan"),fp=field("final-fingerprint",final);
  field("final",final);
  const dupe=(a,i)=>new Set(a.map(x=>x[i].toLowerCase())).size!==a.length;
  if (dupe(rs, 1) || dupe(work, 0) || dupe(es, 0)) add(1,I,P+"duplicate","Keep names unique.");
  if (mode === "transitive") {
    if (!rs.length) add(1,C,P+"roots","Add a root under `## Roots` independent of plan.md.");
    if (!work.length) add(1,C,P+"ledger","Add a ledger row.");
    const nodes = new Set(work.map((row) => row[0].toLowerCase()));
    for (const [line, name] of rs) if (!nodes.has(name.toLowerCase())) add(line,C,P+"root-row","Add its ledger row.",name);
    if (!es.length && !no.length) add(1,C,P+"boundary","Add boundary evidence or `- none: <reason>`.");
    if (no.length > 1 || es.length && no.length) add(1,I,P+"boundary","Use boundaries or one none.");
  }else if(rs[0]||work[0]||es[0]||no[0])add(1,I,P+"mode","Use transitive mode for boundaries.");
  if (final && fp !== state.last_verification?.fingerprint?.hash) add(vals.get("final-fingerprint")?.[0]?.line||1,"stale",P+"fingerprint","Use the current verification fingerprint.");
  const contract = [mode, why, rs.map(([, name, evidence]) => [name, evidence]), work,
    es, no, R_IMPACT_DIMENSIONS.map((name) => [name, dims.get(name) || null]), before];
  return {status: errs.length ? "incomplete" : "ready", hash: rHash(JSON.stringify(contract)), issues:errs};
}
function rExpectations(state) {
  // Required only at High effort. The unit is the expectation, so a row states what is expected,
  // what the current implementation covers, where the expectation came from, its blast radius, and
  // either its evidence or the boundary that is still open.
  if (state.effort !== "high") return {status: "not-required", hash: null, issues: []};
  const file = rReadTask(state, R_TASK_EXPECTATIONS_FILE);
  const issues = [];
  const add = (...args) => issues.push(rPreflightIssue(R_TASK_EXPECTATIONS_FILE, ...args));
  if (file.status !== "ready") {
    add(1, file.status, "expectations.md-readable", "Create expectations.md before the Digest.");
    return {status: file.status, hash: null, issues};
  }
  const rows = [];
  let line = 0;
  for (const raw of file.content.split(/\r?\n/)) {
    line += 1;
    const text = raw.trim();
    if (!text.startsWith("|") || /^\|[\s|:-]+\|$/.test(text)) continue;
    const cells = text.slice(1, text.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim());
    if (cells.length !== 5) {
      add(line, "malformed", "expectations.row", "Use five cells: expectation, coverage, source, blast, evidence.");
      continue;
    }
    const [expectation, coverage, source, blast, evidence] = cells;
    if (/^expectation$/i.test(expectation)) continue;
    if (!expectation) add(line, "incomplete", "expectations.expectation", "Name the expectation.");
    if (!R_EXPECTATION_COVERAGE.has(coverage.toLowerCase())) {
      add(line, "invalid", "expectations.coverage", "Use covered, partial, missing or unspecified.", coverage);
    }
    if (!R_EXPECTATION_SOURCES.has(source.toLowerCase())) {
      add(line, "invalid", "expectations.source", "Use requirement, later-comment, observed-code or conversation-decision.", source);
    }
    if (!/^BR[0-4]$/i.test(blast)) add(line, "invalid", "expectations.blast", "Use BR0 through BR4.", blast);
    if (!evidence) add(line, "incomplete", "expectations.evidence", "State the evidence or the open boundary.");
    rows.push([expectation, coverage.toLowerCase(), source.toLowerCase(), blast.toUpperCase(), evidence]);
  }
  if (!rows.length) add(1, "empty", "expectations.rows", "Add one row per expectation.");
  if (issues.length) return {status: issues[0].status, hash: null, issues};
  return {status: "ready", hash: rHash(JSON.stringify(rows)), issues, rows};
}
function rExpectationsCard(state, expectations, changed = false) {
  const target = rTaskFile(state, R_TASK_EXPECTATIONS_FILE) || R_TASK_EXPECTATIONS_FILE;
  const first = expectations.issues?.[0];
  if (state.work_type === "verification" && !state.plan_file_hash) {
    return rCard(
      "Blocked",
      changed
        ? "High verification expectations.md changed after the recorded check."
        : "High effort needs " + R_TASK_EXPECTATIONS_FILE + (first ? ": " + first.rule + "." : "."),
      "complete " + target + " with one row per expectation, rerun the requested check, then pmnm-guard verified result=<passed|failed|partial|blocked> how=<command|inspection|human>",
    );
  }
  const redo = Boolean(state.plan_file_hash);
  return rCard(
    "Blocked",
    changed
      ? "The agreed expectations.md changed."
      : "High effort needs " + R_TASK_EXPECTATIONS_FILE + (first ? ": " + first.rule + "." : "."),
    changed
      ? "restore the exact agreed contents and retry, or run pmnm-guard redo first, revise " + target + ", show the revised Digest, and run pmnm-guard digest"
      : (redo ? "restore the exact agreed contents and retry, or run pmnm-guard redo first, revise " : "complete ") + target + " with one row per expectation: expectation, coverage, source, blast, evidence, then show the Digest and run pmnm-guard digest",
  );
}
function rImpactCard(state, changed = false) {
  const target = rTaskFile(state, R_TASK_IMPACT_FILE) || R_TASK_IMPACT_FILE;
  // The receipt needs the current verification fingerprint, so the card carries the exact value
  // rather than making the agent read private task state to find a required field.
  const current = state.last_verification?.fingerprint?.hash;
  const fingerprint = current
    ? " set '- final-fingerprint: " + current + "'"
    : " set the final fingerprint after a passed pmnm-guard verified";
  const card = changed
    ? ["Agreed impact changed.",
      "pmnm-guard redo; update " + target + "; show revised Digest; pmnm-guard digest"]
    : ["Impact incomplete.",
      "complete " + target + " with evidence;" + fingerprint + "; retry pmnm-guard done"];
  return rCard( "Blocked", ...card);
}

const R_ENVIRONMENT_PLAN_FIELDS = [
  "configuration", "indirection", "resources", "ownership", "health", "decision", "conflict", "cleanup",
];

function rNeedsEnvironmentPlan(permissions) {
  const entries = [
    ...(permissions.task || []),
    ...(permissions.project || []),
    ...(permissions.taskCapabilities || []),
    ...(permissions.projectCapabilities || []),
  ];
  return entries.some((entry) =>
    entry.effect === "environment" ||
    (entry.boundary === "local-environment" && entry.persistence === "persistent"),
  );
}
function rEnvironmentPlan(state, required) {
  if (!required) return {status: "not-required", hash: null, issues: []};
  const file = rReadTask(state, R_TASK_ENVIRONMENT_FILE);
  if (file.status !== "ready") {
    return {
      status: file.status,
      hash: null,
      issues: [rPreflightIssue(
        R_TASK_ENVIRONMENT_FILE,
        1,
        file.status,
        "operational-environment-preflight",
        "Create environment.md and record configuration, indirection, resources, ownership, health, decision, conflict and cleanup before approving an environment effect.",
      )],
    };
  }
  const values = new Map();
  const issues = [];
  for (const [index, raw] of file.content.split(/\r?\n/).entries()) {
    const match = raw.trim().match(/^-\s*([a-z-]+):\s*(\S.*)$/i);
    if (!match || !R_ENVIRONMENT_PLAN_FIELDS.includes(match[1].toLowerCase())) continue;
    const field = match[1].toLowerCase();
    if (values.has(field)) {
      issues.push(rPreflightIssue(R_TASK_ENVIRONMENT_FILE, index + 1, "invalid", "unique-environment-field", "Keep exactly one `" + field + ":` line.", field));
    } else {
      const value = match[2].trim();
      if (/^<?(?:todo|tbd|unknown|pending)>?$/i.test(value)) {
        issues.push(rPreflightIssue(R_TASK_ENVIRONMENT_FILE, index + 1, "incomplete", "resolved-environment-preflight", "Discover the current value before requesting environment authority.", field));
      } else values.set(field, value);
    }
  }
  for (const field of R_ENVIRONMENT_PLAN_FIELDS) if (!values.has(field) && !issues.some((issue) => issue.detail === field)) {
    issues.push(rPreflightIssue(R_TASK_ENVIRONMENT_FILE, 1, "incomplete", "complete-environment-preflight", "Add one non-empty `" + field + ":` line.", field));
  }
  return {
    status: issues.length ? "incomplete" : "ready",
    hash: issues.length ? null : rHash(JSON.stringify(R_ENVIRONMENT_PLAN_FIELDS.map((field) => [field, values.get(field)]))),
    issues,
  };
}
function rEnvironmentPlanCard(state, changed = false) {
  const target = rTaskFile(state, R_TASK_ENVIRONMENT_FILE) || R_TASK_ENVIRONMENT_FILE;
  return rCard(
    "Blocked",
    changed ? "The operational environment preflight changed after the Digest." : "An environment effect has no complete operational preflight.",
    changed
      ? "run pmnm-guard redo; update " + target + ", show the revised Digest, then pmnm-guard digest"
      : "discover configuration and indirection; check resources, ownership and health; choose reuse or start-only-missing; record conflicts and cleanup in " + target + "; then show the Digest",
  );
}
function rPermissionManifest(state, event, plan = null) {
  const file = rReadTask(state, R_TASK_PERMISSION_FILE);
  const reject = (status = "invalid", extra = {}) => ({status, task: [], project: null, taskCapabilities: [], projectCapabilities: null, hash: null, ...extra});
  const issue = (line, status, rule, correction, detail = "") =>
    rPreflightIssue(R_TASK_PERMISSION_FILE, line, status, rule, correction, detail);
  const oneIssue = (status, line, rule, correction, detail = "", extra = {}) =>
    reject(status, {...extra, issues: [issue(line, status, rule, correction, detail)]});
  if (file.status !== "ready") return oneIssue(file.status, 1, "readable-permission-forecast", "Create a readable permissions.json inside the task folder.");
  const secret = rScanSecret(file.content);
  if (secret) return oneIssue("secret", 1, "no-secret-values", "Remove the secret value and retain only a locator to its protected source.", secret, {secret});
  let value;
  try {
    value = JSON.parse(file.content);
  } catch (error) {
    const position = Number(String(error?.message || "").match(/position\s+(\d+)/i)?.[1] || 0);
    const line = file.content.slice(0, position).split(/\r?\n/).length;
    return oneIssue("invalid", line, "valid-json", "Repair the JSON syntax before requesting agreement.");
  }
  const hasProject = Object.prototype.hasOwnProperty.call(value || {}, "project");
  if (!value || Array.isArray(value) || typeof value !== "object" || value.schema !== "pmnm.permissions/v1")
    return oneIssue("invalid", 1, "permission-schema", "Use a JSON object with schema `pmnm.permissions/v1` and a task array.");
  const rootKeys = Object.keys(value).sort().join(",");
  if (!["schema,task", "project,schema,task"].includes(rootKeys) || !Array.isArray(value.task) || (hasProject && !Array.isArray(value.project)))
    return oneIssue("invalid", 1, "permission-root-shape", "Keep only schema, task, and optional project arrays at the root.");
  const all = value.task.length + (value.project?.length || 0);
  if (all > 32) return oneIssue("invalid", 1, "bounded-permission-forecast", "Reduce the forecast to at most 32 operations.");
  const effectLines = file.content.split(/\r?\n/).flatMap((line, index) => /"effect"\s*:/.test(line) ? [index + 1] : []);
  let entryCursor = 0;
  const issues = [];
  const boundedText = (entry, field, maximum) => typeof entry[field] === "string" && Boolean(entry[field].trim()) && entry[field].length <= maximum;
  const parse = (entries, scope) => {
    const operations = [], capabilities = [];
    const seen = new Set();
    for (const [index, entry] of entries.entries()) {
      const line = effectLines[entryCursor] || 1;
      entryCursor += 1;
      const label = scope + "[" + index + "]";
      const add = (rule, correction, detail = label) => issues.push(issue(line, "invalid", rule, correction, detail));
      if (!entry || Array.isArray(entry) || typeof entry !== "object") { add("permission-entry-object", "Use one object per forecast operation."); continue; }
      const keys = Object.keys(entry).sort().join(",");
      if (keys === "boundary,capability,constraints,effect,persistence,reason,shape") {
        if (!R_CAPABILITY_ID.test(entry.capability || "")) { add("bounded-capability-id", "Use a lowercase capability id with letters, digits, and hyphens."); continue; }
        if (![R_CLASSIFIABLE_EFFECTS.has(entry.effect), R_DECLARATION_BOUNDARIES.has(entry.boundary), R_DECLARATION_PERSISTENCE.has(entry.persistence)].every(Boolean)) {
          add("bounded-capability-contract", "Use supported effect, boundary, and persistence values."); continue;
        }
        if (!boundedText(entry, "shape", 160) || !boundedText(entry, "constraints", 320) || !boundedText(entry, "reason", 240)) {
          add("described-capability", "Describe the operation shape, constraints, and reason within their bounded lengths."); continue;
        }
        const identity = [entry.capability, entry.effect, entry.boundary, entry.persistence].join("\0");
        if (seen.has(identity)) { add("unique-permission-operation", "Keep one entry for each capability contract."); continue; }
        seen.add(identity);
        const [shape, constraints, reason] = [entry.shape.trim(), entry.constraints.trim(), entry.reason.trim()];
        capabilities.push({capability: entry.capability, effect: entry.effect, boundary: entry.boundary, persistence: entry.persistence, shape, constraints, reason, shape_hash: rHash(shape + "\0" + constraints)});
        continue;
      }
      if (!["effect,input,reason,tool", "effect,input,objective,reason,tool"].includes(keys)) { add("permission-entry-fields", "Use either one exact operation or one bounded capability entry."); continue; }
      const hasObjective = Object.prototype.hasOwnProperty.call(entry, "objective");
      if (!R_SENSITIVE_EFFECTS.has(entry.effect)) {
        const verification = entry.effect === "verification";
        add(verification ? "unsupported-verification-permission" : "sensitive-permission-effect", verification ? "Put checks in verification.md; permissions.json forecasts only predictable sensitive operations." : "Use one supported sensitive effect, or leave non-sensitive verification in verification.md.", String(entry.effect || label));
        continue;
      }
      if (typeof entry.tool !== "string" || !/^[A-Za-z0-9_.:/-]{1,200}$/.test(entry.tool)) { add("literal-tool-name", "Use the exact bounded host tool name."); continue; }
      if (!boundedText(entry, "reason", 240)) { add("bounded-permission-reason", "Describe why this exact sensitive operation is needed in 240 characters or fewer."); continue; }
      if (!entry.input || Array.isArray(entry.input) || typeof entry.input !== "object") { add("literal-tool-input", "Use one literal object matching the host tool input."); continue; }
      if (hasObjective && (!R_SAFE_STATE_ID.test(entry.objective) || scope !== "task")) { add("task-state-objective", "Bind objectives only to task-scoped state changes using an exact plan state id."); continue; }
      if (entry.effect === "state-change" && !hasObjective) { add("bound-state-operation", "Add the exact objective id from plan.md to this state-changing operation."); continue; }
      let encodedInput;
      try { encodedInput = rStableJson(entry.input); }
      catch { add("serializable-tool-input", "Use a finite JSON value for every tool input field."); continue; }
      if (Buffer.byteLength(encodedInput, "utf8") > 4_096) { add("bounded-tool-input", "Reduce the literal tool input to 4096 bytes or fewer."); continue; }
      const synthetic = {...event, tool_name: entry.tool, tool_input: entry.input};
      const payload = rPayload(synthetic);
      const classification = rClassifyEvent(synthetic, payload);
      if (entry.tool === "Bash") {
        if (Object.keys(entry.input).join(",") !== "command") { add("literal-shell-input", "Use exactly one command field for a Bash forecast."); continue; }
        if (typeof entry.input.command !== "string" || !entry.input.command || /[\r\n]/.test(entry.input.command) || Buffer.byteLength(entry.input.command, "utf8") > 320) {
          add("bounded-shell-command", "Use one non-empty single-line command of 320 bytes or fewer."); continue;
        }
        if (entry.effect === "state-change" ? classification.kind !== "unknown" : classification.kind !== "write" || classification.effect !== entry.effect) {
          add("matching-observable-effect", "Make the declared effect match the command's deterministic classification; unknown commands need the separate human classification path.", entry.effect); continue;
        }
      } else if (entry.effect !== "state-change" || ["apply_patch", "Edit", "Write"].includes(entry.tool)) {
        add("external-state-tool", "Use a non-file host tool only for an exact task-scoped state change."); continue;
      }
      const operationHash = rOpHash(synthetic, payload);
      if (seen.has(operationHash)) { add("unique-permission-operation", "Keep one forecast entry for each exact operation."); continue; }
      seen.add(operationHash);
      operations.push({effect: entry.effect, operation_hash: operationHash, reason: entry.reason.trim(), ...(hasObjective ? {objective: entry.objective, objective_hash: rHash(entry.objective)} : {})});
    }
    return {operations: operations.sort((left, right) => left.operation_hash.localeCompare(right.operation_hash)), capabilities: capabilities.sort((left, right) => left.capability.localeCompare(right.capability))};
  };
  const taskParsed = parse(value.task, "task");
  const projectParsed = hasProject ? parse(value.project, "project") : null;
  const task = taskParsed.operations;
  const project = projectParsed?.operations ?? null;
  const taskCapabilities = taskParsed.capabilities;
  const projectCapabilities = projectParsed?.capabilities ?? null;
  if (project && new Set([...task, ...project].map((entry) => entry.operation_hash)).size !== task.length + project.length)
    issues.push(issue(1, "invalid", "unique-permission-scope", "Declare an exact operation at only one permission scope."));
  const plannedStates = new Set((plan?.states || []).map((entry) => entry.id));
  const referencedStates = new Set(task.filter((entry) => entry.objective).map((entry) => entry.objective));
  for (const entry of task.filter((candidate) => candidate.objective && !plannedStates.has(candidate.objective)))
    issues.push(issue(1, "state-objective", "planned-state-objective", "Use an exact state id declared in plan.md.", entry.objective));
  for (const entry of (plan?.states || []).filter((candidate) => !candidate.checked && !referencedStates.has(candidate.id)))
    issues.push(issue(1, "state-objective", "future-state-operation", "Bind one exact task operation to this unfinished state objective.", entry.id));
  if (issues.length) {
    const firstState = issues.find((candidate) => candidate.status === "state-objective");
    return reject(firstState ? "state-objective" : "invalid", {detail: firstState?.detail || "", issues});
  }
  const compactOperation = ({effect, operation_hash, reason, objective}) => ({effect, operation_hash, reason, ...(objective ? {objective} : {})});
  const compactCapability = ({capability, effect, boundary, persistence, shape, constraints, reason}) => ({capability, effect, boundary, persistence, shape, constraints, reason});
  const contract = {task: task.map(compactOperation), taskCapabilities: taskCapabilities.map(compactCapability), ...(project === null ? {} : {project: project.map(compactOperation), projectCapabilities: projectCapabilities.map(compactCapability)})};
  return {status: "ready", task, project, taskCapabilities, projectCapabilities, hash: rHash(JSON.stringify(contract)), issues: []};
}
function rPermissionManifestCard(state, manifest, changed = false) {
  const target = rTaskFile(state, R_TASK_PERMISSION_FILE) || R_TASK_PERMISSION_FILE;
  let lines;
  if (manifest.status === "secret") lines = [
    "Possible " + manifest.secret + " secret in " + target + ".",
      "remove the value, leave a reference, show the Digest",
  ];
  else if (manifest.status === "state-objective") {
    const redo = changed ? "pmnm-guard redo; " : "";
    lines = [
      manifest.detail + " has no exact operation.",
      redo + "bind objective=" + manifest.detail + " in " + target + ", show Digest, run pmnm-guard digest",
    ];
  } else if (changed) lines = [
    "Permission forecast changed: " + target + ".",
    "pmnm-guard redo; review the file, show the revised Digest, run pmnm-guard digest",
  ];
  else lines = [
    "Invalid pmnm.permissions/v1 file: " + target + ".",
    "fix the file, show the Digest, run pmnm-guard digest",
  ];
  return rCard( "Blocked", ...lines);
}
function rWriteTaskPreflight(state, issues, normalizations = []) {
  const target = rTaskFile(state, R_TASK_PREFLIGHT_FILE);
  if (!target || !state.folder_path || rUnsafePath(state.folder_path, target)) throw new Error("unsafe task preflight");
  const lines = [
    "# Task preflight",
    "",
    "Status: " + (issues.length ? "blocked" : "ready"),
    "",
  ];
  if (issues.length) {
    lines.push("## Issues", "");
    for (const entry of issues.slice(0, 128)) {
      lines.push(
        "- " + entry.source + ":" + entry.line + " | " + entry.rule +
        (entry.detail ? " | " + entry.detail : "") + " | Correction: " + entry.correction,
      );
    }
  }
  if (normalizations.length) {
    lines.push("## Safe canonicalization", "");
    for (const entry of normalizations.slice(0, 128)) {
      lines.push("- " + entry.source + ":" + entry.line + " | " + entry.from + " => " + entry.to);
    }
  }
  if (!issues.length && !normalizations.length) lines.push("No task-metadata issues found.");
  rAtomic(target, lines.join("\n") + "\n");
  return target;
}
function rTaskPreflightCard(state, target, issues) {
  const summary = issues.slice(0, 4).map((entry) => {
    const status = entry.status === "state-noop" ? "no-op" : entry.status.replaceAll("-", " ");
    const rule = entry.rule.replaceAll("-", " ");
    const surface = entry.source === R_TASK_VERIFY_FILE
      ? "verification plan " + entry.source + " "
      : entry.source + " ";
    return surface + status + " " + rule + (entry.detail ? " (" + entry.detail + ")" : "");
  }).join("; ");
  return rCard(
    "Blocked",
    "Task preflight found " + issues.length + " issues: " + summary + ". Full report: " + target + ".",
    "fix every issue in " + target + ", then show the Digest and run pmnm-guard digest once",
  );
}
function rStateOperationCard(state) {
  const plan = rTaskFile(state, R_TASK_PLAN_FILE) || R_TASK_PLAN_FILE;
  const permissions = rTaskFile(state, R_TASK_PERMISSION_FILE) || R_TASK_PERMISSION_FILE;
  return rCard(
    "Blocked",
    "Unplanned state operation.",
    "pmnm-guard redo; add it to " + plan + " and " + permissions + ", show Digest, run pmnm-guard digest",
  );
}
function rBoundContractProblem(state, event) {
  if (!rRuleBasisCurrent(state)) return rRuleBasisCard(state);
  if (state.digest_rule_basis_hash !== state.rule_basis_hash) {
    return rPlanCard(state, "changed", "durable rules or task context changed");
  }
  const plan = rPlan(state, event);
  const verificationPlan = rVerificationPlan(state);
  if (
    state.effort !== "light" &&
    (verificationPlan.status !== "ready" || verificationPlan.hash !== state.verification_plan_hash)
  ) {
    return rVerificationPlanCard(state, verificationPlan, verificationPlan.status === "ready");
  }
  const impact = rImpactContract(state, plan);
  if (impact.status !== "not-required" && (impact.status !== "ready" || impact.hash !== state.impact_plan_hash)) {
    return rImpactCard(state, impact.status === "ready");
  }
  const expectations = rExpectations(state);
  if (expectations.status !== "not-required" && (expectations.status !== "ready" || expectations.hash !== state.expectations_plan_hash)) {
    return rExpectationsCard(state, expectations, expectations.status === "ready");
  }
  const permissions = rPermissionManifest(state, event, plan);
  if (permissions.status !== "ready" || permissions.hash !== state.permission_manifest_hash) {
    return rPermissionManifestCard(state, permissions, true);
  }
  const environmentPlan = rEnvironmentPlan(state, rNeedsEnvironmentPlan(permissions));
  if (environmentPlan.status === "ready" && environmentPlan.hash !== state.environment_plan_hash) {
    return rEnvironmentPlanCard(state, true);
  }
  if (environmentPlan.status !== "ready" && environmentPlan.status !== "not-required") {
    return rEnvironmentPlanCard(state);
  }
  return null;
}
function rShapeCard(state, shape, stale = false) {
  const verificationPath = rTaskFile(state, R_TASK_VERIFY_FILE) || R_TASK_VERIFY_FILE;
  if (stale) {
    return rCard(
      "Blocked",
      verificationPath + " claims predate the latest project change.",
      "write fresh example: and unchanged: observations in " + verificationPath + " after the latest change, then retry pmnm-guard verified",
    );
  }
  if (shape.stateProblem) {
    // Name the kinds the plan actually carries, so following this NEXT literally can succeed.
    const kinds = (shape.missingKinds || []).map((kind) => kind + ":");
    const named = kinds.length
      ? kinds.length === 1 ? kinds[0] : kinds.slice(0, -1).join(", ") + " and " + kinds[kinds.length - 1]
      : "the planned";
    const stateKind = kinds.some((kind) => kind.startsWith("state:") || kind.startsWith("unchanged-state:"));
    return rCard(
      "Blocked",
      (stateKind ? "State evidence" : "Evidence") + " differs from plan: " + shape.stateProblem + ".",
      "record exact " + named + " lines in " + verificationPath + "; retry pmnm-guard verified",
    );
  }
  const missing = [!shape.example && "example:", !shape.unchanged && "unchanged:"].filter(Boolean).join(" and ");
  return rCard(
    "Blocked",
    verificationPath + " is missing " + (missing || "the required evidence lines") + ".",
    "write '- example: <task case> → <observed>' and '- unchanged: <preserved case> → <observed>' in " + verificationPath + ", then retry pmnm-guard verified",
  );
}
function rScopeProblem(state, event, resolution) {
  const plan = rPlan(state, event);
  if (plan.status !== "ready") return rPlanCard(state, plan.status, plan.detail);
  if (plan.hash !== state.plan_file_hash) return rPlanCard(state, "changed");
  if (!resolution.resolvable || !resolution.targets.length) {
    return rPlanCard(state, "scope", "This command's write target");
  }
  const unexpected = resolution.targets.filter(
    (target) => !plan.targets.some((planned) => planned.hash === rHash(target.path)),
  );
  if (!unexpected.length) return null;
  const cwd = rCanonical(rResolvePath(".", event));
  const labels = unexpected
    .slice(0, 3)
    .map((target) => (cwd && rInside(target.path, cwd) ? path.relative(cwd, target.path) : path.basename(target.path)))
    .join(", ");
  if (unexpected.some((target) => plan.excluded.some((excluded) => excluded.hash === rHash(target.path)))) {
    return rPlanCard(state, "excluded", labels || "An excluded file");
  }
  return rPlanCard(state, "scope", labels || "A target");
}
function rReadsProjectSource(classification) {
  return classification?.boundary === "project";
}
function rOpenTask(state) {
  return Boolean(state.task_id && !state.completion);
}
function rRouteReadCard() {
  return rCard(
    "Blocked",
    "Project source cannot be read before a task is open.",
    "pmnm-guard start task=<ticket-or-id> effort=<light|standard|high> work=<implementation|advisory|verification>",
  );
}
function rFileReadBoundary(state, event) {
  const input = event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};
  const named = input.file_path || input.path;
  const cwd = rCanonical(rResolvePath(".", event));
  if (!cwd) return null;
  // A pattern search with no directory searches the working directory itself.
  const target = typeof named === "string" && named ? rCanonical(rResolvePath(named, event)) : cwd;
  const search = event.tool_name === "Glob" || event.tool_name === "Grep";
  if (!target || (!rInside(target, cwd) && !(search && rInside(cwd, target)))) return null;
  if (state.folder_path && rInside(target, rCanonical(state.folder_path) || state.folder_path)) return null;
  return "project";
}
function rRouteBeforeRead(state, event, options, classification) {
  if (!rOpenTask(state)) {
    // No grace: the project is not read before the task that will record why.
    if (!rReadsProjectSource(classification)) return null;
    state.source_reads_without_task += 1;
    return {deny: true, card: rRouteReadCard()};
  }
  const unavailable = rFolderIssue(state, event, options);
  if (unavailable) return {deny: true, card: unavailable};
  if (!state.task_path || rFsType(state.task_path) !== "dir") {
    state.task_folder_noted = true;
    return {deny: true, card: rTaskFolderCard(state)};
  }
  if (state.rule_basis_required) {
    if (classification.reason === "file-tool-read") return {deny: true, card: rRuleBasisCard(state)};
    const payload = rPayload(event);
    const matches = rRuleReadMatches(state, event, payload);
    if (!matches.length) return {deny: true, card: rRuleBasisCard(state)};
    state.pending_rule_reads.push({
      tool_use_id: typeof event.tool_use_id === "string" ? event.tool_use_id : null,
      command_hash: rOpHash(event, payload),
      path_hashes: matches.map((target) => rHash(target)),
    });
    state.pending_rule_reads = state.pending_rule_reads.slice(-8);
  }
  return null;
}
function rRejectedCard(state, reason, next) {
  return rCard(
    "Blocked",
    "Receipt rejected: " + reason + ".",
    next,
  );
}
function rParseFields(tokens) {
  const fields = {};
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator <= 0) throw new Error("unknown receipt");
    const key = token.slice(0, separator);
    const value = token.slice(separator + 1);
    if (!R_FIELD_NAME.test(key) || !R_FIELD_VALUE.test(value) || Object.hasOwn(fields, key)) {
      throw new Error("bad value " + (R_FIELD_NAME.test(key) ? key : "field"));
    }
    fields[key] = value;
  }
  return fields;
}
export function parseControlCommand(command) {
  if (typeof command !== "string" || !command.startsWith("pmnm-guard")) return null;
  if (
    Buffer.byteLength(command, "utf8") > R_MAX_CONTROL_BYTES ||
    command !== command.trim() ||
    /[\r\n;&|\`]/.test(command) ||
    !/^pmnm-guard(?:\s|$)/.test(command)
  ) {
    throw new Error("unknown receipt");
  }
  const tokens = command.split(/\s+/);
  if (tokens[0] !== "pmnm-guard" || tokens.length < 2 || !/^[a-z][a-z-]*$/.test(tokens[1])) {
    throw new Error("unknown receipt");
  }
  return {action: tokens[1], fields: rParseFields(tokens.slice(2))};
}
function rFields(fields, required = [], optional = []) {
  for (const field of required) {
    if (!Object.hasOwn(fields, field)) throw new Error("missing field " + field);
  }
  const accepted = new Set([...required, ...optional]);
  for (const field of Object.keys(fields)) {
    if (!accepted.has(field)) throw new Error("bad value " + field);
  }
}
function rAliasControl(control) {
  const fields = {...control.fields};
  const alias = control.action;
  const mapped = (action, nextFields = {}) => ({action, fields: nextFields, alias});
  if (alias === "route") {
    const task = fields.task || fields.activity;
    if (!task) throw new Error("missing field task");
    if (!fields.effort) throw new Error("missing field effort");
    return mapped("start", {task, effort: fields.effort, work: fields.work || "implementation"});
  }
  if (alias === "checkpoint") return mapped("digest");
  if (alias === "align") {
    if (fields.result !== "accepted") throw new Error("bad value result");
    return mapped("agreed");
  }
  if (alias === "invalidate") return mapped("redo");
  if (alias === "grant") {
    const effect = {"version-control": "git", publication: "publish", external: "network"}[fields.effect] ||
      (["deletion", "movement", "dependencies", "environment"].includes(fields.effect) && fields.effect);
    if (!effect) throw new Error("bad value effect");
    return mapped("allow", {effect});
  }
  if (alias === "permit") return mapped("classify", {effect: fields.effect});
  if (alias === "reconcile") return mapped("result", {outcome: fields.outcome === "failed-no-effect" ? "no-effect" : fields.outcome});
  if (alias === "verify") {
    const how = fields.how || (fields.source === "collaborator" ? "human" : fields.source === "inspection" ? "inspection" : "command");
    return mapped("verified", {result: fields.result, how});
  }
  return alias === "complete" ? mapped("done", {audit: fields.audit}) : control;
}
function rReceiptNext(action, state) {
  const fixed = {
    folder: "pmnm-guard folder path=<abs>", project: "pmnm-guard project name=<name>",
    digest: "pmnm-guard digest", agreed: "pmnm-guard agreed", redo: "pmnm-guard redo",
    declare: "pmnm-guard declare effect=<investigation|implementation|verification|state-change> boundary=<project|pmnm|host|local-environment|network|external|mixed|unknown> persistence=<none|transient|persistent|unknown> certainty=<certain|uncertain> capability=<id|none>",
    classify: "pmnm-guard classify effect=<investigation|implementation|verification>",
    result: "pmnm-guard result outcome=<unknown|no-effect>",
    verified: "pmnm-guard verified result=<passed|failed|partial|blocked> how=<command|inspection|human>",
    done: "pmnm-guard done audit=<passed|partial|blocked>",
  };
  if (action === "start") return `pmnm-guard start task=${state.task_id || "<ticket-or-id>"} effort=${state.effort || "<light|standard|high>"} work=${state.work_type || "<implementation|advisory|verification>"}`;
  if (action === "allow") return "pmnm-guard allow effect=" + (state.pending_denied?.effect || "<effect>");
  return fixed[action] || "pmnm-guard status";
}
function rStateCard(state, event = null, options = {}) {
  if (state.folder_status === "missing") return rFolderCard(state, false);
  if (state.folder_status === "folder-missing") return rFolderCard(state, true);
  if (state.folder_status === "unreadable") return rRecoveryCard(state, "pointer", rPointerPath(options));
  if (state.folder_status === "index-unreadable") return rRecoveryCard(state, "index", path.join(state.folder_path, R_INDEX_FILE));
  if (state.pending_question?.kind === "project" && event) return rProjectCard(state, event);
  if (!state.task_id) return rNoTaskCard(state);
  if (state.pending_question?.kind === "task-transition") return rTaskTransitionCard(state);
  if (state.pending_question?.kind === "digest") {
    if (state.human_response_epoch !== null) {
      return rCard(
        "Note",
        "The human answered the Digest for " + state.task_id + ".",
        "if the human agreed as shown: pmnm-guard agreed; if anything changed: show the revised Digest, then pmnm-guard digest",
      );
    }
    return rCard(
      "Blocked",
      "The Digest for " + state.task_id + " is waiting for the human's answer.",
      "stop here; no more actions until the human answers",
    );
  }
  if (state.task_path && rFsType(state.task_path) === "missing" && !state.task_folder_noted) {
    return rTaskFolderCard(state);
  }
  if (state.digest_agreed_epoch === state.epoch) {
    return rCard(
      "Note",
      "Digest for " + state.task_id + " is agreed.",
      "continue within the Digest; pmnm-guard redo if it no longer holds",
    );
  }
  if (state.work_type === "verification") {
    return rCard(
      "Note",
      "Task " + state.task_id + " is open for exact non-mutating verification without an implementation Digest.",
      "run only the requested read or check, record its literal evidence, then pmnm-guard verified",
    );
  }
  const planPath = rTaskFile(state, R_TASK_PLAN_FILE) || R_TASK_PLAN_FILE;
  return rCard(
    "Note",
    "Task " + state.task_id + " is open and its plan Digest at " + planPath + " is not agreed.",
    "investigate, show the plan Digest for " + planPath + ", then pmnm-guard digest",
  );
}
function rTaskTransitionCard(state) {
  const requested = state.pending_question?.task || "the requested task";
  const verified = rVerifiedNow(state);
  return rCard(
    "Ask",
    verified
      ? "Unfinished work remains in task " + state.task_id + " before switching to " + requested + "; current verification remains recorded."
      : "Task " + state.task_id + " has unfinished, unverified work before switching to " + requested + ".",
    "ask the human whether to pause " + state.task_id + " and switch to " + requested + "; stop until they answer; after yes, repeat pmnm-guard start task=" + requested + " effort=" + (state.pending_question?.effort || state.effort || "standard") + " work=" + (state.pending_question?.work || "<implementation|advisory|verification>") + "; after no, repeat pmnm-guard start task=" + state.task_id + " effort=" + (state.effort || "standard") + " work=" + (state.work_type || "<implementation|advisory|verification>"),
  );
}
function rWorkTypeCard(state, requested) {
  return rCard(
    "Blocked",
    "Task " + state.task_id + " is already bound to work type " + state.work_type + ", not " + requested + ".",
    "run pmnm-guard redo before changing the work type, or repeat pmnm-guard start with work=" + state.work_type,
  );
}
function rVerificationMutationCard(state) {
  const plan = rTaskFile(state, R_TASK_PLAN_FILE) || R_TASK_PLAN_FILE;
  return rCard(
    "Blocked",
    "Non-mutating verification cannot perform this operation, so it needs implementation work.",
    "run pmnm-guard redo first, then pmnm-guard start task=" + state.task_id + " effort=" + state.effort + " work=implementation, update " + plan + ", show the Digest, and run pmnm-guard digest",
  );
}
function rOnStart(state, fields, event, now, options) {
  rFields(fields, ["task", "effort", "work"]);
  const task = rDecodeField(fields.task, "task");
  if (!R_SAFE_NAME.test(task)) throw new Error("bad value task");
  if (!R_EFFORTS.has(fields.effort)) throw new Error("bad value effort");
  if (!R_WORK_TYPES.has(fields.work)) throw new Error("bad value work");
  const changed = state.task_id !== task;
  const reopening = !changed && Boolean(state.completion);
  let transitionApproved = false;
  if (state.task_id && state.pending_writes.length) {
    return rDenied(state, rResultCard(state, state.pending_writes[0]));
  }
  if (state.pending_question?.kind === "task-transition") {
    const answered = state.prompt_epoch > state.pending_question.asked_prompt_epoch;
    const requested = state.pending_question.task;
    if (!answered) return rDenied(state, rTaskTransitionCard(state));
    if (!changed || task === requested) {
      transitionApproved = changed && task === requested;
      state.pending_question = null;
      rEvent(state, task === requested ? "task-transition-confirmed" : "task-transition-cancelled", {
        from_task_hash: state.task_hash,
        to_task_hash: task === requested ? rHash(requested) : state.task_hash,
      }, now);
    }
  }
  if (changed && !transitionApproved && state.task_id && (state.mutation_count > 0 || state.effect_count > 0) && !state.completion) {
      rAsk(state, "task-transition", {task, effort: fields.effort, work: fields.work});
      return rDenied(state, rTaskTransitionCard(state));
  }
  if (!changed && !reopening) {
    const mayChangeWork =
      state.phase === "INVESTIGATE" &&
      state.digest_shown_epoch === null &&
      state.digest_agreed_epoch === null &&
      state.work_change_authorized;
    if (
      state.work_type &&
      state.work_type !== fields.work &&
      (!mayChangeWork || state.pending_writes.length)
    ) {
      return rDenied(state, rWorkTypeCard(state, fields.work));
    }
    if (state.work_type !== fields.work) state.work_change_authorized = false;
    state.work_type = fields.work;
    const effortRank = {light: 0, standard: 1, high: 2};
    if (effortRank[fields.effort] > effortRank[state.effort]) state.effort = fields.effort;
    const unavailable = rFolderIssue(state, event, options);
    if (!unavailable && state.task_path && rFsType(state.task_path) === "dir") {
      rSeedTask(state);
      rRequireRuleBasis(state);
    }
    const output = unavailable ||
      (state.task_path && rFsType(state.task_path) === "missing" ? rTaskFolderCard(state) :
        (state.rule_basis_required ? rRuleBasisCard(state) : rStateCard(state, event, options)));
    rEvent(state, "task-resumed", {task_hash: state.task_hash, effort: state.effort, work: state.work_type}, now);
    return rAllowed(state, output);
  }
  if (changed || reopening) {
    rClearTaskFlow(state);
    state.epoch += state.task_id ? 1 : 0;
  }
  state.task_id = task;
  state.task_hash = rHash(task);
  state.source_reads_without_task = 0;
  state.plan_gate_seq = state.event_seq;
  state.effort = fields.effort;
  state.work_type = fields.work;
  state.phase = "INVESTIGATE";
  state.pending_question = null;
  const configuration = rRefreshConfig(state, event, options);
  let output;
  if (["missing", "folder-missing"].includes(configuration.status)) {
    rAsk(state, "folder");
    output = rFolderCard(state, configuration.status === "folder-missing");
  } else if (rEnterRecovery(state, configuration)) {
    output = rStateCard(state, event, options);
  } else if (!configuration.project) {
    rAsk(state, "project");
    output = rProjectCard(state, event);
  } else if (state.task_path && rFsType(state.task_path) === "missing") {
    state.task_folder_noted = true;
    output = rTaskFolderCard(state);
  } else {
    rSeedTask(state);
    rRequireRuleBasis(state);
    output = state.rule_basis_required ? rRuleBasisCard(state) : rStateCard(state, event, options);
  }
  rEvent(state, "task-started", {task_hash: state.task_hash, effort: state.effort, work: state.work_type}, now);
  return rAllowed(state, output);
}
function rOnFolder(state, fields, event, now, options) {
  rFields(fields, ["path"]);
  const folder = rValidateFolderPath(fields.path, event, options);
  const existingPointer = rReadPointer(options);
  const idempotent = existingPointer.status === "ready" && existingPointer.folder === folder;
  const configurationMissing = existingPointer.status === "missing" || existingPointer.status === "folder-missing";
  const pointerRecovery =
    existingPointer.status === "unreadable" &&
    state.pending_question?.kind === "pointer-recovery" &&
    state.prompt_epoch > state.pending_question.asked_prompt_epoch;
  if (
    !idempotent &&
    !configurationMissing &&
    !pointerRecovery &&
    (!state.pending_question || state.pending_question.kind !== "folder" || state.prompt_epoch <= state.pending_question.asked_prompt_epoch)
  ) {
    throw new Error("folder not requested");
  }
  const created = [];
  const preserved = [];
  try {
    const wasMissing = rFsType(folder) === "missing";
    if (wasMissing) rEnsureDir(folder, created);
    const indexTarget = path.join(folder, R_INDEX_FILE);
    try {
      rReadIndex(folder, true);
    } catch {
      const approved =
        state.pending_question?.kind === "index-recovery" &&
        state.pending_question.folder_hash === rHash(folder) &&
        state.prompt_epoch > state.pending_question.asked_prompt_epoch;
      if (!approved) {
        state.folder_path = folder;
        state.folder_status = "index-unreadable";
        state.phase = "RECOVERY";
        rAsk(state, "index-recovery", {folder_hash: rHash(folder)});
        return rDenied(state, rRecoveryCard(state, "index", indexTarget));
      }
      const recovery = rPreserve(indexTarget);
      if (recovery) preserved.push([indexTarget, recovery]);
    }
    rCreateFile(indexTarget, JSON.stringify(rEmptyIndex(), null, 2) + "\n", created);
    rCreateFile(path.join(folder, R_GENERAL_RULES_FILE), "# General rules\n", created);
    if (pointerRecovery) {
      const recovery = rPreserve(existingPointer.pointer);
      if (recovery) preserved.push([existingPointer.pointer, recovery]);
    }
    rWriteHostPointer(folder, options);
  } catch (error) {
    rRollback(created);
    for (const [target, recovery] of preserved.reverse()) {
      try {
        if (rFsType(target) === "missing" && rFsType(recovery) !== "missing") fs.renameSync(recovery, target);
      } catch {}
    }
    throw error;
  }
  state.folder_path = folder;
  state.folder_status = "ready";
  state.pending_question = null;
  const configuration = rRefreshConfig(state, event, options);
  let output;
  if (!configuration.project) {
    rAsk(state, "project");
    output = rProjectCard(state, event);
  } else if (state.task_id && state.task_path && rFsType(state.task_path) === "missing") {
    state.task_folder_noted = true;
    output = rTaskFolderCard(state);
  } else {
    rSeedTask(state);
    rRequireRuleBasis(state);
    output = state.rule_basis_required ? rRuleBasisCard(state) : rStateCard(state, event, options);
  }
  rEvent(state, "folder-configured", {folder_hash: rHash(folder)}, now);
  return rAllowed(state, output);
}
function rProjectFolder(index, name, cwd, root) {
  const existing = index.projects.find((entry) => entry.cwd === cwd);
  if (existing) return existing.folder;
  const base = rSafeSlug(name);
  const used = new Set(index.projects.map((entry) => entry.folder));
  let candidate = "projects/" + base;
  for (let attempt = 0; used.has(candidate) || rFsType(path.join(root, candidate)) !== "missing"; attempt += 1) {
    if (attempt > 999) throw new Error("project folder collision limit");
    const suffix = "-" + rHash(cwd).slice(0, 8) + (attempt ? "-" + attempt : "");
    candidate = "projects/" + base.slice(0, 96 - suffix.length) + suffix;
  }
  return candidate;
}
function rOnProject(state, fields, event, now, options) {
  rFields(fields, ["name"]);
  const name = rDecodeField(fields.name, "name");
  if (!rValidName(name)) throw new Error("bad value name");
  const configuration = rRefreshConfig(state, event, options);
  if (configuration.status !== "ready") throw new Error("bad value name");
  const idempotent = configuration.project && configuration.project.name === name;
  if (!idempotent) {
    if (!state.pending_question || state.pending_question.kind !== "project") throw new Error("project not requested");
    if (state.prompt_epoch <= state.pending_question.asked_prompt_epoch) throw new Error("human answer not observed");
  }
  const index = configuration.index || rReadIndex(state.folder_path, true);
  const cwd = rCanonical(rResolvePath(".", event));
  if (!cwd) throw new Error("bad value name");
  const projectFolder = rProjectFolder(index, name, cwd, state.folder_path);
  const projectPath = path.join(state.folder_path, projectFolder);
  const created = [];
  try {
    rEnsureDir(path.join(projectPath, "tasks"), created);
    rCreateFile(path.join(projectPath, R_PROJECT_RULES_FILE), "# Project rules\n", created);
    rCreateFile(
      path.join(projectPath, R_PROJECT_KNOWLEDGE_FILE),
      R_PROJECT_KNOWLEDGE_TEMPLATE,
      created,
    );
    const withoutCurrent = index.projects.filter((entry) => entry.cwd !== cwd);
    withoutCurrent.push({cwd, name, folder: projectFolder});
    rWriteIndex(state.folder_path, {...index, projects: withoutCurrent});
  } catch (error) {
    rRollback(created);
    throw error;
  }
  state.pending_question = null;
  rRefreshConfig(state, event, options);
  let output;
  if (state.task_id && state.task_path && rFsType(state.task_path) === "missing") {
    state.task_folder_noted = true;
    output = rTaskFolderCard(state);
  } else {
    rSeedTask(state);
    output = rStateCard(state, event, options);
  }
  rEvent(state, "project-configured", {project_hash: rHash(name), cwd_hash: rHash(cwd)}, now);
  return rAllowed(state, output);
}
function rOnDigest(state, fields, event, now, options) {
  rFields(fields);
  if (!state.task_id) throw new Error("no task open");
  const unavailable = rFolderIssue(state, event, options);
  if (unavailable) return rAllowed(state, unavailable);
  if (!state.task_path || rFsType(state.task_path) !== "dir" || rUnsafePath(state.folder_path, state.task_path)) {
    state.task_folder_noted = true;
    return rAllowed(state, rTaskFolderCard(state));
  }
  if (!rRuleBasisCurrent(state)) return rDenied(state, rRuleBasisCard(state));
  if (state.pending_question?.kind === "digest" && state.digest_shown_epoch === state.epoch) {
    return rAllowed(state, rStateCard(state, event, options));
  }
  const plan = rPlan(state, event);
  const verificationPlan = rVerificationPlan(state);
  const impact = rImpactContract(state, plan);
  const expectations = rExpectations(state);
  const permissions = rPermissionManifest(state, event, plan);
  const environmentPlan = rEnvironmentPlan(state, permissions.status === "ready" && rNeedsEnvironmentPlan(permissions));
  const issues = [
    ...(plan.issues || []),
    ...(state.effort === "light" ? [] : verificationPlan.issues || []),
    ...(impact.issues || []),
    ...(expectations.issues || []),
    ...(permissions.issues || []),
    ...(environmentPlan.issues || []),
  ];
  const preflight = rWriteTaskPreflight(state, issues, plan.normalizations || []);
  if (issues.length) return rDenied(state, rTaskPreflightCard(state, preflight, issues));
  if (plan.status !== "ready") return rDenied(state, rPlanCard(state, plan.status, plan.detail));
  const revisedContract = state.redo_contract_hash !== null && state.redo_contract_hash !==
    rHash(JSON.stringify([impact.hash, expectations.hash]));
  if ((state.plan_write_seq === null || state.plan_write_seq <= state.plan_gate_seq) && !revisedContract) {
    return rDenied(state, rPlanCard(state, "stale"));
  }
  if (state.effort !== "light" && verificationPlan.status !== "ready") {
    return rDenied(state, rVerificationPlanCard(state, verificationPlan));
  }
  if (permissions.status !== "ready") return rDenied(state, rPermissionManifestCard(state, permissions));
  if (expectations.status !== "not-required" && expectations.status !== "ready") {
    return rDenied(state, rExpectationsCard(state, expectations));
  }
  const workspace = rScope(event, options, plan, state.workspace_scope_snapshot);
  const workspaceProblem = rPlanScopeProblem(state, plan, workspace);
  if (workspaceProblem) return rDenied(state, workspaceProblem);
  state.workspace_scope_snapshot = rExtendWorkspaceBaseline(state.workspace_scope_snapshot, workspace);
  state.plan_file_hash = plan.hash;
  state.plan_target_hashes = plan.targets.map((target) => target.hash);
  state.verification_plan_hash = verificationPlan.status === "ready" ? verificationPlan.hash : null;
  state.impact_plan_hash = impact.status === "ready" ? impact.hash : null;
  state.expectations_plan_hash = expectations.status === "ready" ? expectations.hash : null;
  state.redo_contract_hash = null;
  state.permission_manifest_hash = permissions.hash;
  state.environment_plan_hash = environmentPlan.status === "ready" ? environmentPlan.hash : null;
  state.digest_rule_basis_hash = state.rule_basis_hash;
  state.historical_state_hashes = plan.states.filter((objective) => objective.checked).map((objective) => rMarkKey(state, objective.hash));
  state.workspace_digest_snapshot = workspace;
  state.investigation_stop_count = 0;
  state.digest_shown_epoch = state.epoch;
  state.pending_denied = null;
  state.digest_prompt_epoch = state.prompt_epoch;
  state.human_response_epoch = null;
  state.digest_agreed_epoch = null;
  state.phase = "AWAITING_HUMAN";
  rAsk(state, "digest");
  const output = rCard(
    "Blocked",
    "The Digest for " + state.task_id + " is waiting for the human's answer; it forecasts " + (permissions.task.length + permissions.taskCapabilities.length) + " task and " + ((permissions.project?.length || 0) + (permissions.projectCapabilities?.length || 0)) + " project permissions.",
    "stop here; no more actions until the human answers",
  );
  rEvent(state, "digest-shown", {epoch: state.epoch}, now);
  state.plan_gate_seq = state.event_seq;
  return rAllowed(state, output);
}
function rOnAgreed(state, fields, event, now, options) {
  rFields(fields);
  if (!state.task_id) throw new Error("no task open");
  if (state.digest_shown_epoch !== state.epoch) throw new Error("no Digest shown");
  if (
    state.pending_question?.kind !== "digest" ||
    state.human_response_epoch === null ||
    state.prompt_epoch <= state.digest_prompt_epoch
  ) {
    throw new Error("human answer not observed");
  }
  const plan = rPlan(state, event);
  if (plan.status !== "ready" || plan.hash !== state.plan_file_hash) {
    return rDenied(state, rPlanCard(state, plan.status === "ready" ? "changed" : plan.status, plan.detail));
  }
  const verificationPlan = rVerificationPlan(state);
  if (
    state.effort !== "light" &&
    (verificationPlan.status !== "ready" || verificationPlan.hash !== state.verification_plan_hash)
  ) {
    return rDenied(state, rVerificationPlanCard(state, verificationPlan, verificationPlan.status === "ready"));
  }
  const impact = rImpactContract(state, plan);
  if (impact.status !== "not-required" && (impact.status !== "ready" || impact.hash !== state.impact_plan_hash)) {
    return rDenied(state, rImpactCard(state, impact.status === "ready"));
  }
  const expectations = rExpectations(state);
  if (expectations.status !== "not-required" && (expectations.status !== "ready" || expectations.hash !== state.expectations_plan_hash)) {
    return rDenied(state, rExpectationsCard(state, expectations, expectations.status === "ready"));
  }
  const permissions = rPermissionManifest(state, event, plan);
  if (permissions.status !== "ready" || permissions.hash !== state.permission_manifest_hash) {
    return rDenied(state, rPermissionManifestCard(state, permissions, true));
  }
  const workspace = rScope(event, options, plan, state.workspace_scope_snapshot);
  const intervening = rDelta(state.workspace_digest_snapshot, workspace);
  if (intervening.length) {
    return rDenied(state, rPlanCard(state, "workspace", intervening.slice(0, 5).join(", ")));
  }
  state.digest_agreed_epoch = state.epoch;
  state.pending_question = null;
  state.phase = "READY";
  state.last_verification = null;
  state.task_permissions = permissions.task.map(({effect, operation_hash, objective_hash}) => ({effect, operation_hash, ...(objective_hash ? {objective_hash} : {})}));
  state.task_capabilities = permissions.taskCapabilities.map(({capability, effect, boundary, persistence, shape_hash}) => ({
    capability, effect, boundary, persistence, shape_hash,
  }));
  state.task_permission_epoch = state.epoch;
  if (permissions.project !== null) {
    state.project_permissions = permissions.project.map(({effect, operation_hash}) => ({effect, operation_hash}));
    state.project_capabilities = permissions.projectCapabilities.map(({capability, effect, boundary, persistence, shape_hash}) => ({
      capability, effect, boundary, persistence, shape_hash,
    }));
    state.project_permission_project_hash = rHash(state.project_path);
  }
  const mode = state.work_type === "verification"
    ? ["Non-mutating verification may begin within it.", "run only the agreed read or check and record its evidence"]
    : state.work_type === "advisory"
      ? ["Advisory work may begin within it.", "produce only the agreed deliverable and test its boundary"]
      : ["Implementation may begin within it.", "implement and record decisions and evidence in the task folder as they happen"];
  const output = rCard(
    "Note",
    "Digest for " + state.task_id + " agreed. " + mode[0] + " " + (state.task_permissions.length + state.task_capabilities.length) + " task permissions are active.",
    mode[1],
  );
  rEvent(state, "digest-agreed", {epoch: state.epoch}, now);
  return rAllowed(state, output);
}
function rOnRedo(state, fields, now) {
  rFields(fields);
  if (!state.task_id) throw new Error("no task open");
  if (state.plan_file_hash) {
    state.redo_contract_hash ||= rHash(JSON.stringify([state.impact_plan_hash, state.expectations_plan_hash]));
  }
  state.epoch += 1;
  state.work_change_authorized = true;
  state.digest_shown_epoch = null;
  state.digest_prompt_epoch = null;
  state.human_response_epoch = null;
  state.digest_agreed_epoch = null;
  state.plan_file_hash = null;
  state.plan_target_hashes = [];
  state.verification_plan_hash = null;
  state.impact_plan_hash = null;
  state.expectations_plan_hash = null;
  state.permission_manifest_hash = null;
  state.task_permission_epoch = null;
  state.task_permissions = [];
  state.task_capabilities = [];
  state.plan_gate_seq = state.event_seq;
  state.pending_question = null;
  state.pending_denied = null;
  state.classified_retry = null;
  state.declared_retry = null;
  state.sensitive_allow = null;
  state.last_verification = null;
  state.completion = null;
  state.phase = "INVESTIGATE";
  const output = rCard(
    "Note",
    "Digest for " + state.task_id + " withdrawn.",
    "investigate what changed, update the task record and the changed plan, impact or expectations contract, show a new Digest, then pmnm-guard digest",
  );
  rEvent(state, "digest-redone", {epoch: state.epoch}, now);
  return rAllowed(state, output);
}


const R_PATCH_HEADER = /^\*\*\* (Add File|Update File|Delete File|Move to): (.+)$/gm;

function rPatchTargets(patchText, event) {
  const targets = [];
  let pendingMoveSource = null;
  for (const match of patchText.matchAll(R_PATCH_HEADER)) {
    const target = rResolvePath(match[2], event);
    if (!target) return R_UNRESOLVED;
    if (match[1] === "Update File") {
      pendingMoveSource = target;
      targets.push({path: target, kind: "update"});
    } else if (match[1] === "Add File") {
      pendingMoveSource = null;
      targets.push({path: target, kind: "file", implicitParents: true});
    } else if (match[1] === "Delete File") {
      pendingMoveSource = null;
      targets.push({path: target, kind: "delete"});
    } else if (match[1] === "Move to") {
      if (pendingMoveSource) targets.push({path: pendingMoveSource, kind: "delete"});
      targets.push({path: target, kind: "move"});
      pendingMoveSource = null;
    }
  }
  return {resolvable: targets.length > 0, targets, sources: []};
}
function rToolFileTarget(event) {
  const input = event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};
  const raw = input.file_path || input.path;
  const target = typeof raw === "string" ? rResolvePath(raw, event) : null;
  return target
    ? {resolvable: true, targets: [{path: target, kind: rFsType(target) === "missing" ? "file" : "update"}], sources: []}
    : R_UNRESOLVED;
}
function rWriteTargets(event, payload) {
  let resolution;
  if (event.tool_name === "apply_patch") resolution = rPatchTargets(payload, event);
  else if (event.tool_name === "Edit" || event.tool_name === "Write") resolution = rToolFileTarget(event);
  else if (event.tool_name === "Bash") {
    resolution = rShellTargets(payload, event, {resolvePath: rResolvePath, fsType: rFsType, defaultCwd: process.cwd()});
  }
  else resolution = R_UNRESOLVED;
  if (!resolution.resolvable) return resolution;
  for (const target of resolution.targets) {
    target.lexical = path.resolve(target.path);
    target.path = rCanonical(target.path);
    if (!target.path) return {resolvable: false, targets: [], sources: [], reason: "physical"};
  }
  resolution.sources = (resolution.sources || []).map((source) => ({lexical: path.resolve(source), path: rCanonical(source)}));
  if (resolution.sources.some((source) => !source.path)) return {resolvable: false, targets: [], sources: [], reason: "physical"};
  return resolution;
}
function rInsideFolder(resolution, folder) {
  if (!resolution.resolvable || !resolution.targets.length || !folder) return false;
  return resolution.targets.every((entry) => {
    if (entry.kind === "link") return false;
    if (path.resolve(entry.path) === path.resolve(folder)) return false;
    if (!rInside(entry.path, folder)) return false;
    return !rUnsafePath(folder, entry.path);
  });
}
function rProjectTargets(resolution, event) {
  if (!resolution.resolvable) return R_UNRESOLVED;
  const cwd = rCanonical(rResolvePath(".", event));
  if (!cwd) return R_UNRESOLVED;
  return {
    resolvable: true,
    targets: resolution.targets.filter((entry) => rInside(entry.path, cwd) && !rInside(entry.path, path.join(cwd, ".git"))),
    sources: resolution.sources || [],
  };
}
function rRootOperation(resolution, folder) {
  if (!resolution.resolvable || !folder) return false;
  const root = path.resolve(folder);
  return resolution.targets.some((entry) => path.resolve(entry.path) === root) &&
    resolution.targets.every((entry) => path.resolve(entry.path) === root || !rInside(entry.path, root));
}
function rTouchesFolder(resolution, folder) {
  if (!resolution.resolvable || !folder) return false;
  return resolution.targets.some(
    (entry) =>
      rInside(entry.path, folder) ||
      rInside(entry.lexical || entry.path, folder) ||
      rLexicalInside(entry.lexical || entry.path, folder),
  );
}
function rLexicalInside(target, folder) {
  let current = path.resolve(target);
  const root = path.parse(current).root;
  while (current !== root) {
    const type = rFsType(current);
    if (type !== "missing" && type !== "unreadable") {
      try {
        if (rInside(fs.realpathSync.native(current), folder)) return true;
      } catch {}
    }
    current = path.dirname(current);
  }
  return false;
}
function rTouchesIndex(resolution, folder) {
  const index = path.join(folder, R_INDEX_FILE);
  return resolution.resolvable && resolution.targets.some((entry) => path.resolve(entry.path) === path.resolve(index));
}
function rPatchAddedText(patchText) {
  return patchText
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++") && !line.startsWith("+***"))
    .map((line) => line.slice(1))
    .join("\n");
}

const R_SECRET_PATTERNS = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i],
  ["token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["token", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["token", /\bAKIA[0-9A-Z]{16}\b/],
  ["token", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["token", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["credential", /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]{8,}@/i],
  ["token", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}\b/i],
  ["password", /\b(?:password|passwd|pwd|api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{16,}/i],
];

function rScanSecret(text) {
  if (typeof text !== "string" || !text) return null;
  for (const [kind, pattern] of R_SECRET_PATTERNS) if (pattern.test(text)) return kind;
  return null;
}
function rScanFileSecret(target) {
  const type = rFsType(target);
  if (type === "symlink" || type === "special" || type === "unreadable") return "credential";
  if (type === "missing") return null;
  if (type === "dir") {
    const stack = [target];
    let visited = 0;
    while (stack.length) {
      const directory = stack.pop();
      for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        visited += 1;
        if (visited > 10_000) return "credential";
        const child = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) return "credential";
        if (entry.isDirectory()) stack.push(child);
        else if (entry.isFile()) {
          const kind = rScanFileSecret(child);
          if (kind) return kind;
        } else return "credential";
      }
    }
    return null;
  }
  const metadata = fs.statSync(target);
  const descriptor = fs.openSync(target, "r");
  try {
    const sampleSize = 1_048_576;
    const chunks = [];
    const first = Buffer.alloc(Math.min(sampleSize, metadata.size));
    if (first.length) {
      fs.readSync(descriptor, first, 0, first.length, 0);
      chunks.push(first);
    }
    if (metadata.size > sampleSize) {
      const last = Buffer.alloc(Math.min(sampleSize, metadata.size - sampleSize));
      fs.readSync(descriptor, last, 0, last.length, metadata.size - last.length);
      chunks.push(last);
    }
    return rScanSecret(Buffer.concat(chunks).toString("latin1"));
  } finally {
    fs.closeSync(descriptor);
  }
}
function rStoreSecretKind(event, payload, resolution) {
  let content = payload;
  if (event.tool_name === "apply_patch") content = rPatchAddedText(payload);
  const direct = rScanSecret(content);
  if (direct) return direct;
  for (const source of resolution.sources || []) {
    const kind = rScanFileSecret(source.lexical || source.path);
    if (kind) return kind;
  }
  return null;
}
function rPreview(payload) {
  return rScanSecret(payload) ? "<redacted command>" : rOneLine(payload, 80);
}
function rDigestCurrent(state) {
  return state.task_id && state.digest_agreed_epoch === state.epoch;
}
function rVerifiedNow(state) {
  return Boolean(
    state.last_verification &&
      state.last_verification.epoch === state.epoch &&
      state.last_verification.mutation_count === state.mutation_count &&
      state.last_verification.effect_count === state.effect_count,
  );
}
function rOwesHandover(state) {
  // Both conditions are observed, not inferred: the work type was declared at start and is durable,
  // and an unbounded available workspace is what the closing card calls a version-control comparison.
  return (
    state.work_type === "implementation" &&
    state.plan_target_hashes.length > 0 &&
    state.workspace_scope_snapshot?.status === "available" &&
    // The closing card reads this same flag as falsy meaning a version-control comparison, and it is
    // only set true for a direct comparison of planned paths, so the test matches that line exactly.
    !state.workspace_scope_snapshot?.bounded
  );
}
// The sentence the card asks for, without its terminal period, so the card and this parser are one
// string rather than two that happen to agree.
const R_HANDOVER_NONE = "No version-control step applies to this task";

/** Index of the first `#` that opens a comment: unquoted, unescaped and starting a word. */
function rCommentStart(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\\" && quote !== "'") {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#" && (index === 0 || /\s/.test(line[index - 1]))) return index;
  }
  return -1;
}

/**
 * One supported hand-over command, as a complete token sequence.
 *
 * Quoting is shell syntax and not evidence that the words after it are not prose, so the whole line
 * is matched against a bounded form instead. An unexplained positional token refuses the line, which
 * is what separates handing a command over from mentioning one.
 */
function rHandoverCommand(tokens) {
  if (tokens.length < 2 || tokens[0].quoted || tokens[1].quoted || tokens[0].value !== "git") return false;
  const rest = tokens.slice(2);
  const positional = (token) => !token.quoted && !token.value.startsWith("-");
  if (tokens[1].value === "commit") return rest.length === 2 && !rest[0].quoted && rest[0].value === "-m";
  if (tokens[1].value === "push") return rest.length === 0 || (rest.length === 2 && rest.every(positional));
  if (tokens[1].value === "tag") return rest.length === 1 && positional(rest[0]);
  return false;
}

function rHandoverSatisfied(message) {
  const text = typeof message === "string" ? message : "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[`$>*\-\s]+/, "");
    if (line.replace(/\.$/, "").toLowerCase() === R_HANDOVER_NONE.toLowerCase()) return true;
    const comment = rCommentStart(line);
    const lexed = rLex(comment < 0 ? line : line.slice(0, comment));
    if (lexed.invalid || lexed.segments.length !== 1) continue;
    const [segment] = lexed.segments;
    // A redirection is a second effect the token list no longer shows, so it refuses the line.
    if (segment.redirectWrite || segment.redirectTargets.length) continue;
    if (rHandoverCommand(segment.tokens)) return true;
  }
  return false;
}
function rHandoverCard(state) {
  return rCard(
    "Ask",
    "This task changed planned files against version control, so the human needs the exact command to run.",
    "show the Test Digest again with one line added: the exact command, such as git commit -m \"<message>\", or the line '" + R_HANDOVER_NONE + ".'; both must be in one message; then end the turn",
  );
}
function rTestDigestCurrent(state) {
  return Boolean(
    state.test_digest_epoch === state.epoch &&
      state.test_digest_mutation_count === state.mutation_count &&
      state.test_digest_effect_count === state.effect_count &&
      state.test_digest_verification_count === state.verification_count,
  );
}
function rTestDigestShape(state, message) {
  if (typeof message !== "string" || !state.task_id) return false;
  const task = state.task_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const title = new RegExp("^(?:Test|Prueba)\\s+[—-]\\s*" + task + "\\s*$", "iu");
  const fields = [
    /^(?:Where|Dónde|Donde):\s*\S.*$/iu,
    /^(?:Environment|Entorno):\s*\S.*$/iu,
    /^(?:As|Como):\s*\S.*$/iu,
    /^(?:Data|Datos):\s*\S.*$/iu,
    /^(?:Steps|Pasos):\s*\S.*$/iu,
    /^(?:Expect|Esperado|Espera):\s*\S.*$/iu,
    /^(?:Evidence|Evidencia):\s*\S.*$/iu,
    /^(?:Cleanup|Limpieza):\s*\S.*$/iu,
    /^(?:Can run|Puedo ejecutar|Se puede ejecutar):\s*\S.*$/iu,
  ];
  const lines = message.split(/\r?\n/);
  return lines.some((line, index) => {
    if (!title.test(line.trim()) || index + fields.length >= lines.length) return false;
    return fields.every((pattern, offset) => pattern.test(lines[index + offset + 1]));
  });
}
function rTranscriptAssistant(target) {
  if (typeof target !== "string" || !path.isAbsolute(target)) return null;
  let fd;
  try {
    const before = fs.lstatSync(target);
    if (!before.isFile()) return null;
    fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const meta = fs.fstatSync(fd);
    if (!meta.isFile() || meta.dev !== before.dev || meta.ino !== before.ino) return null;
    const wanted = Math.min(meta.size, R_MAX_TRANSCRIPT_TAIL_BYTES + 1);
    const start = Math.max(0, meta.size - wanted);
    const buffer = Buffer.allocUnsafe(wanted);
    let total = 0;
    while (total < wanted) {
      const count = fs.readSync(fd, buffer, total, wanted - total, start + total);
      if (!count) break;
      total += count;
    }
    let text = buffer.subarray(0, total).toString("utf8");
    if (start > 0) {
      const boundary = text.indexOf("\n");
      if (boundary < 0) return null;
      text = text.slice(boundary + 1);
    }
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (Buffer.byteLength(line) > R_MAX_TRANSCRIPT_LINE_BYTES) return null;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        return null;
      }
      const payload = record?.type === "response_item" ? record.payload : null;
      if (payload?.type !== "message") {
        if (payload?.role === "assistant" || record?.role === "assistant") return null;
        continue;
      }
      if (payload.role !== "assistant") continue;
      if (!Array.isArray(payload.content) || !payload.content.length) return null;
      const parts = [];
      for (const item of payload.content) {
        if (!item || item.type !== "output_text" || typeof item.text !== "string") return null;
        parts.push(item.text);
      }
      const message = parts.join("\n");
      return Buffer.byteLength(message) <= R_MAX_TRANSCRIPT_MESSAGE_BYTES ? message : null;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function rRecoverDigest(state, event, now) {
  if (state.completion || state.test_digest_audit_epoch !== state.epoch || rTestDigestCurrent(state)) return false;
  const message = rTranscriptAssistant(event.transcript_path);
  if (!rTestDigestShape(state, message)) return false;
  state.test_digest_epoch = state.epoch;
  state.test_digest_prompt_epoch = state.prompt_epoch;
  state.test_digest_response_epoch = null;
  state.test_digest_mutation_count = state.mutation_count;
  state.test_digest_effect_count = state.effect_count;
  state.test_digest_verification_count = state.verification_count;
  rAsk(state, "test-digest", {mutation_count: state.mutation_count, effect_count: state.effect_count});
  rEvent(state, "test-digest-shown", {epoch: state.epoch, source: "transcript"}, now);
  return true;
}
function rTestDigestCard(state) {
  const target = rTaskFile(state, R_TASK_VERIFY_FILE) || R_TASK_VERIFY_FILE;
  const task = state.task_id || "<task id>";
  return rCard(
    "Blocked",
    "A current actionable Test Digest has not been shown to the human.",
    "read " + target + ", then show this contiguous block with one non-empty value on each line, in order: Test — " + task + "; Where: …; Environment: …; As: …; Data: …; Steps: …; Expect: …; Evidence: …; Cleanup: …; Can run: …; stop for the human",
  );
}
function rRetry(state, entry, hash, effect) {
  return entry?.task_hash === state.task_hash && entry.epoch === state.epoch && entry.uses > 0 &&
    (hash === undefined || entry.command_hash === hash) &&
    (effect === undefined || entry.effect === effect);
}
function rOnAllow(state, fields, now) {
  rFields(fields, ["effect"]);
  if (!R_SENSITIVE_EFFECTS.has(fields.effect)) throw new Error("bad value effect");
  const pending = state.pending_denied;
  if (!pending || pending.kind !== "sensitive" || pending.effect !== fields.effect) throw new Error("nothing to allow");
  if (
    state.prompt_epoch <= pending.asked_prompt_epoch ||
    pending.approved_prompt_epoch !== state.prompt_epoch
  ) {
    return rDenied(state, rSensitiveProofCard(state));
  }
  state.sensitive_allow = {
    effect: pending.effect,
    command_hash: pending.command_hash,
    task_hash: state.task_hash,
    epoch: state.epoch,
    uses: 1,
  };
  state.pending_denied = null;
  const output = rCard(
    "Note",
    "The human allowed this " + fields.effect + " command once.",
    "rerun the same command",
  );
  rEvent(state, "sensitive-allowed", {effect: fields.effect}, now);
  return rAllowed(state, output);
}
function rForecastEntry(state, operationHash, effect = null) {
  const matches = (entry) => entry.operation_hash === operationHash && (!effect || entry.effect === effect);
  if (state.task_permission_epoch === state.epoch) {
    const task = state.task_permissions.find(matches);
    if (task) return task;
  }
  if (state.project_path && state.project_permission_project_hash === rHash(state.project_path)) {
    return state.project_permissions.find(matches) || null;
  }
  return null;
}
function rCapabilityEntry(state, declaration) {
  if (!declaration.capability || declaration.capability === "none" || declaration.certainty !== "certain") return null;
  const matches = (entry) =>
    entry.capability === declaration.capability &&
    entry.effect === declaration.effect &&
    entry.boundary === declaration.boundary &&
    entry.persistence === declaration.persistence;
  if (state.task_permission_epoch === state.epoch) {
    const task = state.task_capabilities.find(matches);
    if (task) return {...task, scope: "task"};
  }
  if (state.project_path && state.project_permission_project_hash === rHash(state.project_path)) {
    const project = state.project_capabilities.find(matches);
    if (project) return {...project, scope: "project"};
  }
  return null;
}
function rOnDeclare(state, fields, now) {
  rFields(fields, ["effect", "boundary", "persistence", "certainty", "capability"]);
  for (const [field, allowed] of [
    ["effect", R_CLASSIFIABLE_EFFECTS],
    ["boundary", R_DECLARATION_BOUNDARIES],
    ["persistence", R_DECLARATION_PERSISTENCE],
    ["certainty", R_DECLARATION_CERTAINTY],
  ]) if (!allowed.has(fields[field])) throw new Error("bad value " + field);
  if (fields.capability !== "none" && !R_CAPABILITY_ID.test(fields.capability)) throw new Error("bad value capability");
  const pending = state.pending_denied;
  if (state.pending_writes.length && !pending) return rDenied(state, rResultCard(state, state.pending_writes[0]));
  const declaration = {...fields};
  const capability = rCapabilityEntry(state, declaration);
  const proactive = !pending;
  const mayDeclare = state.task_id && !state.completion && !state.pending_question &&
    state.pending_writes.length === 0 && state.current_turn_hash && (fields.capability === "none" || capability);
  if ((pending && pending.kind !== "declare") || (proactive && !mayDeclare)) {
    throw new Error("nothing denied to declare");
  }
  if (
    pending &&
    pending.minimum_effect === "implementation" &&
    (fields.effect === "investigation" || fields.persistence === "none")
  ) {
    throw new Error("declaration contradicts shell write");
  }
  const requiredEffect = capability ? null : rDeclSensitive(declaration);
  state.declared_retry = {
    ...declaration,
    command_hash: pending?.command_hash || null,
    turn_hash: proactive ? state.current_turn_hash : null,
    task_hash: state.task_hash,
    epoch: state.epoch,
    uses: 1,
    required_effect: requiredEffect,
    capability_scope: capability?.scope || null,
  };
  if (pending) state.pending_denied = null;
  let output;
  if (
    requiredEffect && !proactive &&
    !rRetry(state, state.sensitive_allow, state.declared_retry.command_hash, requiredEffect)
  ) {
    const classification = {effect: requiredEffect};
    rDenyState(state, "sensitive", classification, state.declared_retry.command_hash);
    output = rSensitiveCard(state, requiredEffect, "declared " + fields.effect + " at " + fields.boundary + " boundary");
  } else {
    const text = proactive
      ? ["Intent is set for the next unknown operation, without authority.", "run it"]
      : ["The command has one declared effect and boundary.", "retry it"];
    output = rCard( "Note", ...text);
  }
  rEvent(state, "command-declared", {effect: fields.effect, boundary: fields.boundary, capability: fields.capability}, now);
  return rAllowed(state, output);
}
function rOnClassify(state, fields, now) {
  rFields(fields, ["effect"]);
  if (!R_CLASSIFIABLE_EFFECTS.has(fields.effect)) throw new Error("bad value effect");
  const pending = state.pending_denied;
  if (!pending || !["classify", "declare"].includes(pending.kind)) throw new Error("nothing denied to classify");
  state.classified_retry = {
    effect: fields.effect,
    command_hash: pending.command_hash,
    task_hash: state.task_hash,
    epoch: state.epoch,
    uses: 1,
  };
  state.pending_denied = null;
  const output = rCard(
    "Note",
    "The command is classified as " + fields.effect + " for one exact retry.",
    "rerun the same command",
  );
  rEvent(state, "command-classified", {effect: fields.effect}, now);
  return rAllowed(state, output);
}
function rMarkChangedTargets(state, hashes) {
  const values = new Set(state.changed_target_hashes);
  for (const targetHash of hashes || []) values.add(targetHash);
  state.changed_target_hashes = Array.from(values).slice(-512);
}
function rMarkKey(state, hash) {
  return rHash([state.epoch, state.plan_file_hash, state.permission_manifest_hash, hash].join("\0"));
}
function rObserveState(state, hash) {
  if (hash) state.observed_state_hashes = [...new Set([...state.observed_state_hashes, rMarkKey(state, hash)])].slice(-R_MAX_PLAN_TARGETS);
}
function rSnapshotHash(snapshot) {
  return snapshot?.status === "available" ? rHash(JSON.stringify(snapshot.entries)) : null;
}
function rTargetSnapshot(targets) {
  return rHash(targets.map((target) => rHash(target.path) + "\0" + rFileSig(target.path)).join("\0"));
}
function rObserveEffect(state, pending, now, late = false, resolution = null, workspaceAfter = null, uncertain = false) {
  const targetsChanged = Boolean(resolution?.resolvable && pending.target_before && pending.target_before !== rTargetSnapshot(resolution.targets));
  const changedTargets = targetsChanged ? pending.target_hashes : [];
  const workspaceAfterHash = rSnapshotHash(workspaceAfter);
  const workspaceChanged = Boolean(pending.workspace_before_hash && workspaceAfterHash && pending.workspace_before_hash !== workspaceAfterHash);
  const material = uncertain || targetsChanged || workspaceChanged || (pending.project_write && !pending.workspace_before_hash && !resolution?.resolvable);
  if (pending.store_write) {
    rSeedTask(state);
    if (pending.plan_write && material) state.plan_write_seq = state.event_seq + 1;
    if (pending.verification_claim_write && material) {
      state.verification_claim_mutation_count = state.mutation_count;
      state.verification_claim_effect_count = state.effect_count;
    }
    if (pending.rule_file_hashes?.length) {
      state.rules_file_hashes_written = [...new Set([...state.rules_file_hashes_written, ...pending.rule_file_hashes])].slice(0, R_MAX_RULE_FILES);
      if (material) {
        rRequireRuleBasis(state);
        state.digest_agreed_epoch = null;
      }
    }
    if (pending.task_directory_write && state.task_path && rFsType(state.task_path) === "dir") {
      state.pending_question = null;
      state.task_folder_noted = false;
    }
    rEvent(state, late ? "late-folder-write" : "folder-write", {effect: pending.effect, material}, now);
    return workspaceChanged;
  }
  if (pending.effect === "verification") {
    if (workspaceChanged) {
      state.mutation_count += 1;
      state.effect_count += 1;
      state.last_verification = null;
      state.digest_agreed_epoch = null;
      state.plan_file_hash = null;
      state.plan_target_hashes = [];
      state.plan_gate_seq = state.event_seq;
      state.phase = "INVESTIGATE";
      rEvent(state, "verification-mutated-project", {}, now);
      return workspaceChanged;
    }
    state.verification_count += 1;
    state.last_check = {epoch: state.epoch, mutation_count: state.mutation_count, effect_count: state.effect_count, verification_count: state.verification_count};
    if (state.mutation_count > 0 || state.effect_count > 0) state.phase = "VERIFY";
  } else if (pending.effect !== "investigation" && (material || R_SENSITIVE_EFFECTS.has(pending.effect))) {
    if (material) state.mutation_count += 1;
    state.effect_count += 1;
    if (state.pending_question?.kind === "inspection") state.pending_question = null;
    rMarkChangedTargets(state, changedTargets);
    if (!uncertain) rObserveState(state, pending.objective_hash);
    state.last_verification = null;
    state.phase = "IMPLEMENT";
  }
  rEvent(state, late ? "late-effect-observed" : material ? "effect-observed" : "effect-no-change", {effect: pending.effect}, now);
  return workspaceChanged;
}
function rOnResult(state, fields, now) {
  rFields(fields, ["outcome"]);
  if (!R_RESULT_OUTCOMES.has(fields.outcome)) throw new Error("bad value outcome");
  const pending = state.pending_writes[0];
  if (!pending) throw new Error("nothing to allow");
  state.pending_writes = state.pending_writes.slice(1);
  if (fields.outcome === "no-effect") {
    state.reconciled_writes.push({...pending, outcome: "no-effect"});
    state.reconciled_writes = state.reconciled_writes.slice(-16);
    const output = rCard(
      "Note",
      "The command is recorded as no effect.",
      "inspect the current state; rerun the command only if its effect is still required",
    );
    rEvent(state, "result-reconciled", {outcome: "no-effect"}, now);
    return rAllowed(state, output);
  }
  rObserveEffect(state, pending, now, false, null, null, true);
  state.phase = "RECOVERY";
  const output = rCard(
    "Note",
    "The command result remains unknown, so its possible effect is preserved.",
    "inspect the current state; pmnm-guard redo if the Digest no longer holds",
  );
  rEvent(state, "result-reconciled", {outcome: "unknown"}, now);
  return rAllowed(state, output);
}
function rRunGit(cwd, args) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 2_000,
    maxBuffer: 2_000_000,
    shell: false,
    env: {...process.env, GIT_OPTIONAL_LOCKS: "0"},
  });
  return result.status === 0 ? String(result.stdout || "").trimEnd() : null;
}
function rParseGitStatus(status) {
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  for (const line of status ? status.split("\n") : []) {
    if (!line) continue;
    if (line.startsWith("??")) {
      untracked += 1;
      continue;
    }
    if (line[0] && line[0] !== " ") staged += 1;
    if (line[1] && line[1] !== " ") unstaged += 1;
  }
  return {staged, unstaged, untracked};
}
function rGitFingerprint(cwd) {
  if (!cwd || rFsType(cwd) !== "dir") return null;
  if (rRunGit(cwd, ["rev-parse", "--is-inside-work-tree"]) !== "true") return null;
  const head = rRunGit(cwd, ["rev-parse", "--short=12", "HEAD"]);
  if (!head) return null;
  const base =
    rRunGit(cwd, ["merge-base", "HEAD", "@{upstream}"]) ||
    rRunGit(cwd, ["rev-parse", "HEAD^"]);
  const status = rRunGit(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status === null) return null;
  const {staged, unstaged, untracked} = rParseGitStatus(status);
  return {
    base: base ? String(base).slice(0, 12) : "unavailable",
    head,
    staged,
    unstaged,
    untracked,
  };
}
function rFileSig(target, status = "") {
  try {
    const metadata = fs.lstatSync(target);
    if (metadata.isSymbolicLink()) return rHash(status + "\0link\0" + fs.readlinkSync(target));
    if (metadata.isDirectory()) return rHash(status + "\0directory");
    if (!metadata.isFile()) return rHash(status + "\0other\0" + metadata.mode);
    const direct = metadata.size <= 2_000_000;
    const digest = crypto.createHash("sha256").update(direct ? status + "\0file\0" : "large\0", "utf8");
    const buffer = Buffer.allocUnsafe(65_536), descriptor = fs.openSync(target, "r");
    try {
      for (let size = fs.readSync(descriptor, buffer, 0, buffer.length, null); size > 0; size = fs.readSync(descriptor, buffer, 0, buffer.length, null)) {
        digest.update(buffer.subarray(0, size));
      }
    } finally {
      fs.closeSync(descriptor);
    }
    const signature = digest.digest("hex");
    return direct ? signature : rHash(status + "\0file\0" + signature);
  } catch {
    return rHash(status + "\0missing");
  }
}
function rGitEntries(cwd) {
  if (!cwd || rFsType(cwd) !== "dir") return null;
  if (rRunGit(cwd, ["rev-parse", "--is-inside-work-tree"]) !== "true") return null;
  const raw = rRunGit(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (raw === null) return null;
  const records = String(raw).split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length < 4) continue;
    const status = record.slice(0, 2);
    const label = record.slice(3);
    if (/[RC]/.test(status) && index + 1 < records.length) index += 1;
    const target = rCanonical(path.resolve(cwd, label));
    if (!target || !rInside(target, cwd) || rInside(target, path.join(cwd, ".git"))) continue;
    entries.push({label: path.relative(cwd, target), signature: rFileSig(target, status)});
  }
  return entries;
}
function rSnapshot(event, options) {
  const cwd = rCanonical(rResolvePath(".", event));
  if (!cwd) return {status: "unavailable", entries: []};
  let raw;
  try {
    raw = typeof options.workspaceSnapshotProvider === "function"
      ? options.workspaceSnapshotProvider(cwd)
      : rGitEntries(cwd);
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw) || raw.length > 512) return {status: "unavailable", entries: []};
  const entries = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item || (typeof item.path !== "string" && typeof item.label !== "string")) {
      return {status: "unavailable", entries: []};
    }
    const candidate = item.path || item.label;
    const target = rCanonical(path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate));
    if (!target || !rInside(target, cwd) || rInside(target, path.join(cwd, ".git"))) {
      return {status: "unavailable", entries: []};
    }
    const label = path.relative(cwd, target);
    if (!label || seen.has(label)) return {status: "unavailable", entries: []};
    seen.add(label);
    const signature = typeof item.signature === "string" && item.signature
      ? rHash(item.signature)
      : rFileSig(target, String(item.status || ""));
    entries.push({label, signature, observed: true});
  }
  entries.sort((left, right) => left.label.localeCompare(right.label));
  return {status: "available", entries};
}
function rScope(event, options, plan, previous = null) {
  const workspace = rSnapshot(event, options);
  if (plan?.status !== "ready") return workspace;
  const direct = [...plan.targets, ...plan.excluded];
  const labels = new Set(direct.map(({label}) => label));
  for (const {label} of previous?.entries || []) {
    if (!labels.has(label)) direct.push({label, path: rResolvePath(label, event)});
  }
  if (workspace.status !== "available") {
    return {status: "available", bounded: true, entries: direct.map(({label, path: target}) => ({label, signature: rFileSig(target), observed: false}))};
  }
  const observed = new Set(workspace.entries.map(({label}) => label));
  const entries = [...workspace.entries];
  for (const {label, path: target} of direct) {
    if (!observed.has(label)) entries.push({label, signature: rFileSig(target), observed: false});
  }
  entries.sort((left, right) => left.label.localeCompare(right.label));
  return {...workspace, entries};
}
function rExtendWorkspaceBaseline(previous, current) {
  if (current.status !== "available") return previous || current;
  const earlier = new Map(previous?.status === "available" ? previous.entries.map(({label, signature}) => [label, signature]) : []);
  return {...current, entries: current.entries.map((entry) => earlier.has(entry.label) ? {...entry, signature: earlier.get(entry.label)} : entry)};
}
function rDelta(baseline, current) {
  if (baseline?.status !== "available" || current?.status !== "available") return [];
  const before = new Map(baseline.entries.map((entry) => [entry.label, entry.signature]));
  const after = new Map(current.entries.map((entry) => [entry.label, entry.signature]));
  const changed = [];
  for (const label of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(label) !== after.get(label)) changed.push(label);
  }
  return changed.sort();
}
function rPlanEntry(entries, label) {
  return entries.find((entry) => entry.label === label);
}
function rPlanScopeProblem(state, plan, current) {
  const changed = rDelta(state.workspace_scope_snapshot, current);
  const baselineLabels = new Set(state.workspace_scope_snapshot?.entries?.map((entry) => entry.label) || []);
  const excluded = changed
    .filter((label) => rPlanEntry(plan.excluded, label))
    .filter((label) => {
      const currentEntry = current.entries?.find((entry) => entry.label === label);
      const newlyObservedCleanPath = !baselineLabels.has(label) && !current.bounded && currentEntry?.observed === false;
      return !newlyObservedCleanPath;
    });
  if (excluded.length) return rPlanCard(state, "excluded", excluded.slice(0, 5).join(", "));
  const unexpected = changed.filter(
    (label) => !rPlanEntry(plan.targets, label) && !rPlanEntry(plan.excluded, label),
  );
  return unexpected.length ? rPlanCard(state, "workspace", unexpected.slice(0, 5).join(", ")) : null;
}
function rHasCheck(cwd) {
  if (!cwd || rFsType(cwd) !== "dir") return false;
  const markerFiles = [
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "pytest.ini",
    "tox.ini",
    "pyproject.toml",
    "Makefile",
    "Justfile",
  ];
  if (markerFiles.some((name) => rFsType(path.join(cwd, name)) === "file")) return true;
  const packagePath = path.join(cwd, "package.json");
  if (rFsType(packagePath) === "file") {
    try {
      const raw = fs.readFileSync(packagePath, "utf8");
      if (Buffer.byteLength(raw, "utf8") > 1_000_000) return false;
      const manifest = JSON.parse(raw);
      const scripts = manifest && typeof manifest.scripts === "object" ? Object.keys(manifest.scripts) : [];
      if (scripts.some((name) => /^(?:test|lint|check|typecheck)(?::|$)/.test(name))) return true;
    } catch {
      return false;
    }
  }
  try {
    return fs.readdirSync(cwd).some((name) => /\.(?:sln|xcodeproj)$/.test(name));
  } catch {
    return false;
  }
}

const R_FIXED_CARDS = {
  inspection: ["Ask", "Inspection is not an executed check, and this project exposes a verification command.", "ask the human whether inspection-only evidence is enough; stop until they answer; after yes: pmnm-guard verified result=passed how=inspection; after no: run the check that tests the change"],
  "stale-command": ["Blocked", "No successful check is recorded after the latest change.", "run the check that tests the change again, then pmnm-guard verified result=<passed|failed|partial|blocked> how=command"],
  "open-objectives": ["Blocked", "Open plan objectives mean this check cannot yet verify the task contract.", "continue the planned work; keep investigation checks as evidence without running pmnm-guard verified, then mark completed objectives [x] before final verification"],
  human: ["Ask", "Human verification has not been observed after this request.", "ask the human to perform and report the manual check; stop until they answer; then retry pmnm-guard verified result=passed how=human"],
  compound: ["Blocked", "This compound command contains an unknown or separately sensitive effect.", "split it into one directly reviewable command per effect, then retry each command separately"],
  unresolved: ["Blocked", "PMNM cannot resolve this write's literal target safely.", "use one supported literal command with explicit targets, or split the operation"],
  index: ["Blocked", "index.json is maintained by PMNM and this write did not run.", "write task evidence in the task folder instead"],
  boundary: ["Blocked", "This write crosses the PMNM folder boundary, so it did not run.", "split it into one contained PMNM write and one separate project operation"],
  redirect: ["Blocked", "This command writes through shell redirection, so implementation cannot start without an agreed Digest.", "investigate, show the Digest, then pmnm-guard digest"],
  "split-sensitive": ["Blocked", "This sensitive operation is too long or complex to review completely in one card.", "split it into a shorter command whose complete effect can be shown, then retry"],
  "stale-session": ["Blocked", "Another session owns guarded changes for this project.", "continue in the active session, or restart this session to take over with transient authority cleared"],
};

function rFixCard(state, name) {
  return rCard( ...R_FIXED_CARDS[name]);
}
function rFingerprint(state, event, options, now) {
  const provider = typeof options.fingerprintProvider === "function" ? options.fingerprintProvider : rGitFingerprint;
  let git = null;
  try {
    git = provider(event.cwd, state);
  } catch {
    git = null;
  }
  const time = new Date(now).toISOString();
  const payload = git
    ? {provider: "git", ...git, time}
    : {provider: "none", changed: state.changed_target_hashes.length, time};
  return {...payload, hash: rHash(JSON.stringify(payload)).slice(0, 12)};
}
function rVerificationAnswer(state, kind) {
  const question = state.pending_question;
  if (
    question?.kind === kind &&
    state.prompt_epoch > question.asked_prompt_epoch &&
    question.mutation_count === state.mutation_count &&
    question.effect_count === state.effect_count
  ) return true;
  rAsk(state, kind, {mutation_count: state.mutation_count, effect_count: state.effect_count});
  return false;
}
function rOnVerified(state, fields, event, now, options) {
  rFields(fields, ["result", "how"]);
  if (!R_VERIFICATION_RESULTS.has(fields.result)) throw new Error("bad value result");
  if (!R_VERIFICATION_METHODS.has(fields.how)) throw new Error("bad value how");
  if (!state.task_id) throw new Error("no task open");
  if (state.work_type === "verification" && (state.mutation_count > 0 || state.effect_count > 0)) {
    return rDenied(state, rVerificationMutationCard(state));
  }
  let shape = null;
  let expectationsHash = null;
  if (fields.result === "passed") {
    let plan = null;
    if (state.plan_file_hash) {
      const contractProblem = rBoundContractProblem(state, event);
      if (contractProblem) return rDenied(state, contractProblem);
      plan = rPlan(state, event);
      if (plan.status !== "ready" || plan.hash !== state.plan_file_hash) {
        return rDenied(state, rPlanCard(state, plan.status === "ready" ? "changed" : plan.status, plan.detail));
      }
    }
    if (state.effort === "high" && state.work_type === "verification" && !state.plan_file_hash) {
      const expectations = rExpectations(state);
      if (expectations.status !== "ready") return rDenied(state, rExpectationsCard(state, expectations));
      expectationsHash = expectations.hash;
    }
    shape = rVerifyShape(state, plan);
    if (shape.status !== "ready" || !shape.example || !shape.unchanged) {
      return rDenied(state, rShapeCard(state, shape));
    }
    if (
      state.verification_claim_mutation_count !== state.mutation_count ||
      state.verification_claim_effect_count !== state.effect_count
    ) {
      return rDenied(state, rShapeCard(state, shape, true));
    }
    if (plan?.targets.some((objective) => !objective.checked)) {
      return rDenied(state, rFixCard(state, "open-objectives"));
    }
  }
  if (
    fields.result === "passed" &&
    fields.how === "inspection" &&
    rHasCheck(event.cwd)
  ) {
    if (!rVerificationAnswer(state, "inspection")) {
      return rDenied(state, rFixCard(state, "inspection"));
    }
  }
  if (fields.result === "passed" && fields.how === "human") {
    if (!rVerificationAnswer(state, "human-verification")) {
      return rDenied(state, rFixCard(state, "human"));
    }
  }
  if (
    fields.result === "passed" &&
    fields.how === "command" &&
    (!state.last_check ||
      state.last_check.epoch !== state.epoch ||
      state.last_check.mutation_count !== state.mutation_count ||
      state.last_check.effect_count !== state.effect_count)
  ) {
    return rDenied(state, rFixCard(state, "stale-command"));
  }
  const fingerprint = rFingerprint(state, event, options, now);
  state.test_digest_epoch = null;
  state.test_digest_prompt_epoch = null;
  state.test_digest_response_epoch = null;
  state.test_digest_mutation_count = null;
  state.test_digest_effect_count = null;
  state.test_digest_verification_count = null;
  state.test_digest_audit_epoch = null;
  state.last_verification = {
    epoch: state.epoch,
    mutation_count: state.mutation_count,
    effect_count: state.effect_count,
    result: fields.result,
    how: fields.how,
    fingerprint,
    claim_hash: shape?.hash || null,
    expectations_hash: expectationsHash,
  };
  state.phase = "VERIFY";
  if (["inspection", "human-verification"].includes(state.pending_question?.kind)) state.pending_question = null;
  rEvent(state, "verification-recorded", {result: fields.result, how: fields.how, fingerprint: fingerprint.hash}, now);
  return rAllowed(
    state,
    rCard(
      "Note",
      "Final task verification is recorded (" + fields.result + ").",
      "complete the required review and final audit, then pmnm-guard done audit=<passed|partial|blocked>; the Test Digest follows that audit",
    ),
  );
}

const R_REVIEW_FIELDS = [
  "contract",
  "plan-digest",
  "fingerprint",
  "changed-surface",
  "evidence",
  "strongest-counterexample",
  "independent-check",
  "disagreement",
  "residual-limit",
];
const R_IMPACT_REVIEW_FIELDS = ["impact-roots", "impact-omission-check", "non-functional-dispositions"];

function rReviewPacket(state) {
  const required = state.impact_plan_hash ? [...R_REVIEW_FIELDS, ...R_IMPACT_REVIEW_FIELDS] : R_REVIEW_FIELDS;
  const file = rReadTask(state, R_TASK_REVIEW_FILE);
  if (file.status !== "ready") return {status: file.status, missing: required};
  if (rScanSecret(file.content)) return {status: "secret", missing: []};
  const values = new Map();
  let duplicate = false;
  for (const raw of file.content.split(/\r?\n/)) {
    const match = raw.trim().match(/^-\s*([a-z][a-z-]*):\s*(\S.*)$/);
    if (!match || !required.includes(match[1])) continue;
    if (values.has(match[1])) duplicate = true;
    values.set(match[1], match[2].trim());
  }
  const missing = required.filter((field) => !values.has(field));
  if (duplicate || missing.length) return {status: duplicate ? "duplicate" : "incomplete", missing};
  const planBinding = state.work_type === "verification" && !state.plan_file_hash ? "none" : state.plan_file_hash;
  if (values.get("plan-digest") !== planBinding) return {status: "stale-plan", missing: []};
  if (values.get("fingerprint") !== state.last_verification?.fingerprint?.hash) return {status: "stale-verification", missing: []};
  const empty=value=>/^(?:none|n\/a|not applicable|unavailable|unknown)\W*$/i.test(value)||/<[^>]*>/.test(value);
  if (empty(values.get("strongest-counterexample"))) return {status: "missing-counterexample", missing: []};
  if (empty(values.get("independent-check"))) return {status: "missing-independent-check", missing: []};
  const bad=R_IMPACT_REVIEW_FIELDS.filter(field=>values.has(field)&&empty(values.get(field)));
  if(bad.length)return {status:"incomplete",missing:bad};
  if(values.get("independent-check")===values.get("evidence"))return {status:"non-independent-check",missing:[]};
  if(!/^none\.?$/i.test(values.get("disagreement")))return {status:"unresolved-disagreement",missing:[]};
  return {status: "ready", missing: [], hash: rHash(JSON.stringify(required.map((field) => [field, values.get(field)])))};
}
function rReviewPacketCard(state, packet) {
  const target = rTaskFile(state, R_TASK_REVIEW_FILE) || R_TASK_REVIEW_FILE;
  const statuses = {
    "stale-plan": " Its plan binding is stale.",
    "stale-verification": " Its verification binding is stale.",
    "missing-counterexample": " It does not test a concrete counterexample.",
    "missing-independent-check": " It has no independent check.",
    "non-independent-check": " Its independent check repeats the author's evidence.",
    "unresolved-disagreement": " It records an unresolved disagreement.",
  };
  if (packet.status === "stale-plan" && state.effort === "high" && !state.plan_file_hash && state.work_type !== "verification") {
    return rCard(
      "Blocked",
      "High implementation needs an agreed plan Digest before closure.",
      "write the implementation plan and show its Digest, or run pmnm-guard redo first, then pmnm-guard start task=" + state.task_id + " effort=high work=verification for strictly non-mutating work",
    );
  }
  const binding = packet.status === "stale-plan"
    ? state.plan_file_hash
      ? " Use the exact plan-digest: " + state.plan_file_hash + "."
      : " Use the exact plan-digest: none for verification without a Digest."
    : "";
  const statusDetail = (statuses[packet.status] || "") + binding;
  const detail = packet.missing?.length ? " Missing: " + packet.missing.join(", ") + "." : statusDetail;
  return rCard(
    "Blocked",
    "High-effort completion needs a current semantic review packet in " + target + "." + detail,
    "have a human or non-author model review the contract, evidence and strongest counterexample; complete every named field in " + target + ", including the impact fields when shown; then retry pmnm-guard done",
  );
}
function rOnDone(state, fields, event, now, options) {
  rFields(fields, ["audit"]);
  if (!R_AUDIT_RESULTS.has(fields.audit)) throw new Error("bad value audit");
  if (!state.task_id) throw new Error("no task open");
  if (state.work_type === "verification" && (state.mutation_count > 0 || state.effect_count > 0)) {
    return rDenied(state, rVerificationMutationCard(state));
  }
  if (!rRuleBasisCurrent(state)) {
    rRequireRuleBasis(state);
    return rDenied(state, rRuleBasisCard(state));
  }
  if (state.pending_writes.length) {
    return rDenied(state, rResultCard(state, state.pending_writes[0]));
  }
  if (fields.audit === "blocked") {
    state.test_digest_audit_epoch = null;
    state.test_digest_epoch = null;
    state.test_digest_prompt_epoch = null;
    state.test_digest_response_epoch = null;
    state.test_digest_mutation_count = null;
    state.test_digest_effect_count = null;
    state.test_digest_verification_count = null;
    if (state.pending_question?.kind === "test-digest") state.pending_question = null;
    state.phase = "VERIFY";
    rEvent(state, "audit-blocked", {epoch: state.epoch}, now);
    return rAllowed(
      state,
      rCard(
        "Note",
        "The audit is blocked, so task " + state.task_id + " remains open.",
        "resolve the blocker, verify again, then retry pmnm-guard done audit=<passed|partial|blocked>",
      ),
    );
  }
  if (state.plan_file_hash) {
    const currentPlan = rPlan(state, event);
    if (currentPlan.status !== "ready" || currentPlan.hash !== state.plan_file_hash) {
      return rDenied(state, rPlanCard(state, currentPlan.status === "ready" ? "changed" : currentPlan.status, currentPlan.detail));
    }
  }
  if (fields.audit === "passed" && !rVerifiedNow(state)) {
    return rDenied(state, rUnverifiedCard(state));
  }
  if (fields.audit === "passed" && state.last_verification?.result !== "passed") {
    throw new Error("bad value audit");
  }
  if (fields.audit === "passed" && state.impact_plan_hash) {
    const impactPlan = rPlan(state, event);
    const impact = rImpactContract(state, impactPlan, {final: true});
    if (impact.status !== "ready" || impact.hash !== state.impact_plan_hash) {
      return rDenied(state, rImpactCard(state, impact.status === "ready"));
    }
  }
  if (fields.audit === "passed" && state.effort === "high" && state.work_type === "verification" && !state.plan_file_hash) {
    const expectations = rExpectations(state);
    if (expectations.status !== "ready" || expectations.hash !== state.last_verification?.expectations_hash) {
      return rDenied(state, rExpectationsCard(state, expectations, expectations.status === "ready"));
    }
  }
  if (fields.audit === "passed" && state.effort === "high") {
    const review = rReviewPacket(state);
    if (review.status !== "ready") return rDenied(state, rReviewPacketCard(state, review));
  }
  let currentWorkspace = rSnapshot(event, options), stateCount = 0;
  if (fields.audit === "passed" && state.plan_file_hash) {
    const contractProblem = rBoundContractProblem(state, event);
    if (contractProblem) return rDenied(state, contractProblem);
    const plan = rPlan(state, event);
    if (plan.status !== "ready" || plan.hash !== state.plan_file_hash) {
      return rDenied(state, rPlanCard(state, plan.status === "ready" ? "changed" : plan.status, plan.detail));
    }
    currentWorkspace = rScope(event, options, plan, state.workspace_scope_snapshot);
    const workspaceProblem = rPlanScopeProblem(state, plan, currentWorkspace);
    if (workspaceProblem) return rDenied(state, workspaceProblem);
    const objectives = [...plan.targets, ...plan.states, ...plan.invariants, ...plan.deliverables, ...plan.boundaries];
    const unchecked = objectives.filter((target) => !target.checked);
    if (unchecked.length) {
      return {
        state,
        output: rDenyTool(rPlanCard(state, "unchecked", unchecked.slice(0, 5).map((target) => target.label || target.id).join(", "))),
      };
    }
    const observed = new Set(state.changed_target_hashes);
    const workspaceAvailable = state.workspace_scope_snapshot?.status === "available" && currentWorkspace.status === "available";
    const workspaceChanged = new Set(rDelta(state.workspace_scope_snapshot, currentWorkspace));
    if (plan.targets.length) {
      const changed = plan.targets.filter((target) => workspaceAvailable ? workspaceChanged.has(target.label) : observed.has(target.hash));
      if (!changed.length) return rDenied(state, rPlanCard(state, "no-change"));
      const missing = plan.targets.filter((target) => workspaceAvailable ? !workspaceChanged.has(target.label) : !observed.has(target.hash));
      if (missing.length) {
        return {
          state,
          output: rDenyTool(rPlanCard(state, "incomplete", missing.slice(0, 5).map((target) => target.label).join(", "))),
        };
      }
    }
    const observedStates = new Set(state.observed_state_hashes);
    const historicalStates = new Set(state.historical_state_hashes);
    const missingStates = plan.states.filter((objective) => {
      const key = rMarkKey(state, objective.hash);
      return !observedStates.has(key) && !historicalStates.has(key);
    });
    if (missingStates.length) {
      return rDenied(state, rPlanCard(state, "state-unobserved", missingStates.slice(0, 5).map((objective) => objective.id).join(", ")));
    }
    stateCount = plan.states.length;
    if (plan.states.length || plan.invariants.length || plan.deliverables.length || plan.boundaries.length) {
      const shape = rVerifyShape(state, plan);
      if (shape.status !== "ready" || !shape.example || !shape.unchanged) {
        return rDenied(state, rShapeCard(state, shape));
      }
      if (state.last_verification?.claim_hash !== shape.hash) {
        return rDenied(state, rPlanCard(state, "state-evidence", "verification.md changed after verification"));
      }
    }
  }
  if (state.test_digest_audit_epoch !== state.epoch) {
    state.test_digest_audit_epoch = state.epoch;
    state.test_digest_epoch = null;
    state.test_digest_response_epoch = null;
    return rDenied(state, rTestDigestCard(state));
  }
  if (!rTestDigestCurrent(state) || state.test_digest_response_epoch === null || state.test_digest_response_epoch <= state.test_digest_prompt_epoch) {
    return rDenied(state, rTestDigestCard(state));
  }
  state.completion = {
    epoch: state.epoch,
    audit: fields.audit,
    mutation_count: state.mutation_count,
    effect_count: state.effect_count,
  };
  state.phase = "COMPLETE";
  state.pending_question = null;
  state.pending_denied = null;
  const mode = state.plan_target_hashes.length && currentWorkspace.status === "available" ? (currentWorkspace.bounded ? 1 : 2) : 0;
  const stateDetail = stateCount ? " State objectives: " + stateCount + "." : "";
  const comparison = ["No project-file comparison.", "Compared planned paths directly.", "Compared version-control state."][mode] + stateDetail;
  const rules = state.rules_file_hashes_written.length;
  const output = rCard(
    "Note",
    "Task " + state.task_id + " closed, audit " + fields.audit + ". " + comparison + " Rules files written: " + rules + ". The human commits.",
    "for a new request, run pmnm-guard start task=<ticket-or-id> effort=<light|standard|high> work=<implementation|advisory|verification>",
  );
  rEvent(state, "task-completed", {audit: fields.audit}, now);
  return rAllowed(state, output);
}
function rOnStatus(state, fields, event, options) {
  rFields(fields);
  let openedQuestion = false;
  try {
    const configuration = rRefreshConfig(state, event, options);
    if (rEnterRecovery(state, configuration)) openedQuestion = true;
    const questionKind =
      configuration.status === "missing" || configuration.status === "folder-missing"
        ? "folder"
        : configuration.status === "ready" && !configuration.project
          ? "project"
          : null;
    if (questionKind && state.pending_question?.kind !== questionKind) {
      rAsk(state, questionKind);
      openedQuestion = true;
    }
  } catch {
    state.folder_status = "unreadable";
    state.phase = "RECOVERY";
  }
  if (
    !openedQuestion &&
    state.pending_question &&
    state.prompt_epoch <= state.pending_question.asked_prompt_epoch
  ) {
    return {
      state,
      output: rRewriteControl(rHumanCard(state)),
    };
  }
  return rAllowed(state, rStateCard(state, event, options));
}
function rReceiptReason(error) {
  const message = String(error && error.message ? error.message : error);
  const accepted = [
    "unknown receipt",
    "no task open",
    "no Digest shown",
    "Digest not agreed",
    "stale, before last redo",
    "human answer not observed",
    "folder not requested",
    "project not requested",
    "nothing denied to classify",
    "nothing denied to declare",
    "declaration contradicts shell write",
    "nothing to allow",
  ];
  if (accepted.includes(message)) return message;
  const field = message.match(/^(?:missing field|bad value) ([a-z-]+)$/);
  return field ? message : "unknown receipt";
}
function rTransition(state, control, event, now, options) {
  const mapped = R_ALIASES.has(control.action) ? rAliasControl(control) : control;
  if (!R_ACTIONS.has(mapped.action)) throw new Error("unknown receipt");
  const f = mapped.fields;
  if (/^(start|redo|done)$/.test(mapped.action)) rExpireDecl(state);
  const handlers = {
    folder: () => rOnFolder(state, f, event, now, options),
    project: () => rOnProject(state, f, event, now, options),
    start: () => rOnStart(state, f, event, now, options),
    digest: () => rOnDigest(state, f, event, now, options),
    agreed: () => rOnAgreed(state, f, event, now, options),
    redo: () => rOnRedo(state, f, now),
    allow: () => rOnAllow(state, f, now),
    declare: () => rOnDeclare(state, f, now),
    classify: () => rOnClassify(state, f, now),
    result: () => rOnResult(state, f, now),
    verified: () => rOnVerified(state, f, event, now, options),
    done: () => rOnDone(state, f, event, now, options),
    status: () => rOnStatus(state, f, event, options),
  };
  const result = handlers[mapped.action]();
  if (mapped.alias) rEvent(state, "alias-used", {alias: mapped.alias, action: mapped.action}, now);
  return result;
}
function rReject(state, error, action) {
  const reason = rReceiptReason(error);
  let next = rReceiptNext(action, state);
  if (reason === "human answer not observed") {
    next = "stop here; no more actions until the human answers";
  }
  if (reason === "folder not requested" || reason === "project not requested") next = rReceiptNext("start", state);
  return rDenied(state, rRejectedCard(state, reason, next));
}
function rResultCard(state, pending) {
  const operation = "operation " + (pending.operation_id || pending.command_hash?.slice(0, 12) || "unknown") + " (" + pending.effect + ")";
  return rCard(
    "Blocked",
    "The host reported no result for " + operation + ".",
    "inspect what happened, then pmnm-guard result outcome=<unknown|no-effect>",
  );
}
function rUnknownCommandCard(state, payload) {
  return rCard(
    "Blocked",
    "This shell tool has no trusted effect declaration: " + rPreview(payload) + ". Send the `pmnm-guard` receipt as a shell-tool command. The active host adapter intercepts it before shell execution. It is not a program on PATH.",
    "use this shell tool to submit `pmnm-guard declare effect=<investigation|implementation|verification|state-change> boundary=<project|pmnm|host|local-environment|network|external|mixed|unknown> persistence=<none|transient|persistent|unknown> certainty=<certain|uncertain> capability=<id|none>`, then rerun the exact blocked command",
  );
}
function rHiddenCommandCard(state) {
  return rCard(
    "Blocked",
    "The shell hides part of this operation, so an effect declaration cannot make it reviewable.",
    "run one literal command without expansion, evaluation, or a hidden inner command",
  );
}
function rSecretCard(state, kind) {
  return rCard(
    "Blocked",
    "That write contains what looks like a secret (" + kind + "), and secrets never go in the PMNM folder.",
    "remove it, keep a reference to where it lives, then retry",
  );
}
function rDigestRequiredCard(state) {
  return rCard(
    "Blocked",
    "No plan Digest is agreed for " + state.task_id + ", so implementation cannot start.",
    "investigate, show the Digest, then pmnm-guard digest",
  );
}
function rReviewable(event, payload, resolution) {
  if (event.tool_name === "Bash") {
    return !/[\r\n]/.test(payload) && Buffer.byteLength(payload, "utf8") <= 320 && !rScanSecret(payload) ? payload : null;
  }
  const input = event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};
  const target = resolution.targets?.[0]?.path;
  const content = event.tool_name === "Write" ? input.content : event.tool_name === "Edit" ? input.new_string : payload;
  if (!target || typeof content !== "string" || rScanSecret(content) || Buffer.byteLength(content, "utf8") > 160) return null;
  return event.tool_name + " " + target + " with " + JSON.stringify(content);
}
function rSensitiveCard(state, effect, review) {
  const phrases = {
    deletion: "deletes files",
    movement: "moves files",
    "external-write": "writes outside the project and PMNM folder",
    git: "runs git",
    dependencies: "changes dependencies",
    publish: "publishes",
    environment: "changes the environment",
    network: "reaches the network",
  };
  const englishEffect = phrases[effect] || effect;
  const independent =
    effect === "git" && /\bgit\s+(?:commit|push|tag)\b/.test(review)
      ? " PMNM does not commit or push by itself."
      : "";
  const token = rApprovalToken(state);
  return rCard(
    "Ask",
    "This command " + englishEffect + ": " + review + "." + independent,
    "show the exact operation and ask the human to reply exactly " + token + ", then stop. After that exact reply, run pmnm-guard allow effect=" + effect + " and rerun the same command",
  );
}
function rApprovalToken(state) {
  const pending = state.pending_denied;
  if (!pending || pending.kind !== "sensitive") return "PMNM-ALLOW-UNKNOWN";
  return "PMNM-ALLOW-" + rHash([
    state.task_hash || "no-task",
    state.epoch,
    pending.command_hash,
    pending.effect,
    pending.asked_prompt_epoch,
  ].join("\0")).slice(0, 12).toUpperCase();
}
function rSensitiveProofCard(state) {
  return rCard(
    "Ask",
    "The exact operation-bound approval token was not observed in the latest human message.",
    "ask the human to reply exactly " + rApprovalToken(state) + " and stop. Then run pmnm-guard allow effect=" + (state.pending_denied?.effect || "<effect>"),
  );
}
function rSameDenial(state, kind, commandHash, turnHash) {
  const previous = state.pending_denied;
  return Boolean(
    previous &&
      previous.kind === kind &&
      previous.command_hash === commandHash &&
      previous.denied_turn_hash === turnHash,
  );
}
function rDenyState(state, kind, classification, commandHash) {
  state.pending_denied = {
    kind,
    effect: classification.effect || null,
    minimum_effect: classification.minimumEffect || null,
    reason: classification.reason || null,
    command_hash: commandHash,
    asked_prompt_epoch: state.prompt_epoch,
    approved_prompt_epoch: null,
    denied_turn_hash: state.current_turn_hash,
  };
}
function rOpHash(event, payload) { return rHash(rStableJson(rOpIdentity(event, payload))); }
function rPendWrite(state, event, effect, resolution, storeWrite, commandHash, options, projectWrite = false) {
  if (rRetry(state, state.declared_retry, commandHash)) state.declared_retry = state.pending_denied = null;
  const planPath = rTaskFile(state, R_TASK_PLAN_FILE);
  const verificationPath = rTaskFile(state, R_TASK_VERIFY_FILE);
  const rulePaths = rRulePaths(state);
  const targets = resolution.resolvable ? resolution.targets : [];
  const workspaceBefore = rScope(event, options, rPlan(state, event), state.workspace_scope_snapshot);
  const forecast = rForecastEntry(state, commandHash, effect);
  const entry = {
    tool_use_id: typeof event.tool_use_id === "string" ? event.tool_use_id : commandHash.slice(0, 16),
    command_hash: commandHash,
    operation_id: commandHash.slice(0, 12),
    effect,
    objective_hash: forecast?.objective_hash || null,
    store_write: storeWrite,
    project_write: projectWrite,
    task_hash: state.task_hash,
    epoch: state.epoch,
    target_hashes: targets.map((target) => rHash(target.path)),
    target_before: rTargetSnapshot(targets),
    workspace_before_hash: rSnapshotHash(workspaceBefore),
    plan_write: Boolean(planPath && targets.some((target) => path.resolve(target.path) === path.resolve(planPath))),
    verification_claim_write: Boolean(
      verificationPath && targets.some((target) => path.resolve(target.path) === path.resolve(verificationPath)),
    ),
    rule_file_hashes: rulePaths
      .filter((rulePath) => targets.some((target) => path.resolve(target.path) === path.resolve(rulePath)))
      .map((rulePath) => rHash(path.resolve(rulePath))),
    task_directory_write: Boolean(state.task_path && targets.some((target) => path.resolve(target.path) === path.resolve(state.task_path))),
  };
  state.pending_writes.push(entry);
  state.pending_writes = state.pending_writes.slice(-16);
}
function rFolderIssue(state, event, options) {
  let configuration;
  try {
    configuration = rRefreshConfig(state, event, options);
  } catch {
    state.folder_status = "unreadable";
    state.phase = "RECOVERY";
    return rStateCard(state, event, options);
  }
  if (["missing", "folder-missing"].includes(configuration.status)) {
    if (!state.pending_question || state.pending_question.kind !== "folder") {
      rAsk(state, "folder");
    }
    return rFolderCard(state, configuration.status === "folder-missing");
  }
  if (rEnterRecovery(state, configuration)) return rStateCard(state, event, options);
  if (!configuration.project) {
    if (!state.pending_question || state.pending_question.kind !== "project") {
      rAsk(state, "project");
    }
    return rProjectCard(state, event);
  }
  return null;
}
function rOnPreTool(state, event, now, options) {
  const payload = rPayload(event);
  if (event.tool_name === "Bash" && typeof payload === "string") {
    let control;
    try {
      control = parseControlCommand(payload);
    } catch (error) {
      const hint = payload.match(/^pmnm-guard\s+([a-z][a-z-]*)/)?.[1];
      return rReject(state, error, hint && R_ACTIONS.has(hint) ? hint : "status");
    }
    if (control) {
      if (R_RETIRED_ACTIONS.has(control.action)) return rReject(state, new Error("unknown receipt"), "status");
      let correctedAction = control.action;
      if (R_ALIASES.has(control.action)) {
        try {
          correctedAction = rAliasControl(control).action;
        } catch {
          correctedAction = "status";
        }
      }
      try {
        return rTransition(state, control, event, now, options);
      } catch (error) {
        return rReject(state, error, correctedAction);
      }
    }
  }

  let classificationInitial = rClassifyEvent(event, payload);
  if (classificationInitial.reason === "file-tool-read") {
    const boundary = rFileReadBoundary(state, event);
    if (boundary) classificationInitial = {...classificationInitial, boundary};
  }
  const commandHash = rOpHash(event, payload);
  const stateForecast = rForecastEntry(state, commandHash, "state-change");
  let classification = classificationInitial;
  const decl = state.declared_retry;
  if (decl?.command_hash === null && decl.turn_hash !== state.current_turn_hash) state.declared_retry = null;
  if (
    rRetry(state, decl) &&
    (decl.command_hash === null ? decl.turn_hash === state.current_turn_hash : decl.command_hash === commandHash)
  ) {
    const proactive = decl.command_hash === null;
    const mayApply = !proactive || (classificationInitial.kind === "unknown" &&
      classificationInitial.declarable !== false && !classificationInitial.minimumEffect);
    if (mayApply) {
      classification = rDeclClass(decl, Boolean(decl.capability_scope));
      classification.requiredEffect = decl.required_effect;
      if (classification.requiredEffect) {
        decl.command_hash = commandHash;
        decl.turn_hash = null;
      } else state.declared_retry = null;
    } else {
      state.declared_retry = null;
    }
  } else if (
    rRetry(state, state.classified_retry, commandHash)
  ) {
    classification = state.classified_retry.effect === "investigation"
      ? {...R_READ, boundary: "project", reason: "legacy-model-classified"}
      : rWrite(state.classified_retry.effect, "model-classified");
    state.classified_retry.uses -= 1;
    if (state.classified_retry.uses === 0) state.classified_retry = null;
  } else if (classification.kind === "unknown" && stateForecast) {
    classification = rWrite("state-change", "permission-forecast");
  } else if (classification.kind === "unknown") {
    if (["compound-with-unknown", "multiple-sensitive-effects"].includes(classification.reason)) {
      return rDenied(state, rFixCard(state, "compound"));
    }
    if (classification.declarable === false) return rDenied(state, rHiddenCommandCard(state));
    const duplicate = rSameDenial(state, "declare", commandHash, state.current_turn_hash);
    if (!duplicate) rDenyState(state, "declare", classification, commandHash);
    const message = rUnknownCommandCard(state, payload);
    return rDenied(state, message, !duplicate);
  }

  if (classification.kind === "read" && !classification.requiredEffect) {
    const route = rRouteBeforeRead(state, event, options, classification);
    if (route?.deny) return {state, output: rDenyTool(route.card)};
    if (classification.effect === "verification" && state.task_id) {
      rPendWrite(state, event, "verification", R_UNRESOLVED, false, commandHash, options);
      rEvent(state, "verification-started", {}, now);
    }
    return {state, output: route ? rHookContext("PreToolUse", route.card) : null};
  }
  if (state.pending_writes.length) {
    const pending = state.pending_writes[0];
    return rDenied(state, rResultCard(state, pending));
  }
  if (!state.task_id) return rDenied(state, rNoTaskCard(state));

  const unavailable = rFolderIssue(state, event, options);
  if (unavailable) return rDenied(state, unavailable);
  if (
    state.pending_question?.kind === "task-identity" &&
    state.prompt_epoch <= state.pending_question.asked_prompt_epoch
  ) {
    return rDenied(state, rHumanCard(state));
  }

  const resolution = rWriteTargets(event, payload);
  const storeWrite = rInsideFolder(resolution, state.folder_path);
  const rootOperation = rRootOperation(resolution, state.folder_path);
  const projectResolution = rProjectTargets(resolution, event);
  const declaredProjectWrite =
    classification.reason === "dynamic-declaration" &&
    classification.boundary === "project" &&
    ["implementation", "state-change"].includes(classification.effect);
  const projectWrite = projectResolution.targets.length > 0 || declaredProjectWrite;
  const projectRoot = rCanonical(rResolvePath(".", event));
  const externalWrite =
    resolution.resolvable && projectRoot &&
    resolution.targets.some(
      (entry) =>
        !rInside(entry.path, projectRoot) &&
        !rInside(entry.path, state.folder_path),
    );
  const externalOrdinaryWrite = externalWrite && resolution.targets.some(
    (entry) => !["delete", "move"].includes(entry.kind) && !rInside(entry.path, projectRoot) && !rInside(entry.path, state.folder_path),
  );
  if (
    externalOrdinaryWrite &&
    classification.observedEffects?.includes("implementation") &&
    classification.observedEffects.some((effect) => R_SENSITIVE_EFFECTS.has(effect))
  ) {
    return rDenied(state, rFixCard(state, "compound"));
  }
  if (classification.effect === "implementation" && externalWrite) {
    classification = rWrite("external-write", classification.reason);
  }
  if (rTouchesIndex(resolution, state.folder_path)) return rDenied(state, rFixCard(state, "index"));
  if (!storeWrite && !rootOperation && rTouchesFolder(resolution, state.folder_path)) {
    return rDenied(state, rFixCard(state, "boundary"));
  }
  if (storeWrite) {
    const curationPaths = rRulePaths(state).map((target) => path.resolve(target));
    const curationWrite = resolution.resolvable && resolution.targets.some((target) => curationPaths.includes(path.resolve(target.path)));
    if (curationWrite && !rRuleBasisCurrent(state)) {
      rRequireRuleBasis(state);
      return rDenied(state, rRuleBasisCard(state));
    }
    const secret = rStoreSecretKind(event, payload, resolution);
    if (secret) return rDenied(state, rSecretCard(state, secret));
    if (!["git", "dependencies", "publish", "environment", "network"].includes(classification.effect)) {
      rPendWrite(state, event, classification.effect, resolution, true, commandHash, options);
      rEvent(state, "folder-write-started", {effect: classification.effect}, now);
      return {state, output: null};
    }
  }

  const unresolvedImplementation = classification.effect === "implementation" && !resolution.resolvable;
  const mayRewriteProject =
    classification.effect === "dependencies" ||
    (classification.effect === "git" && /^(?:git-(?:checkout|switch|reset|rebase|merge|cherry-pick|revert|clean|apply|rm|mv|restore|pull))$/.test(classification.reason));
  if (
    state.work_type === "verification" &&
    (projectWrite || externalWrite || unresolvedImplementation || mayRewriteProject || R_SENSITIVE_EFFECTS.has(classification.requiredEffect || classification.effect))
  ) {
    return rDenied(state, rVerificationMutationCard(state));
  }

  if (!rootOperation && state.task_path && rFsType(state.task_path) !== "dir") {
    state.task_folder_noted = true;
    return rDenied(state, rTaskFolderCard(state));
  }

  if (state.pending_question?.kind === "digest") {
    return rDenied(state, rStateCard(state, event, options));
  }

  const requiresDigest = projectWrite || unresolvedImplementation || mayRewriteProject || classification.effect === "state-change";
  if (requiresDigest && !rDigestCurrent(state)) {
    const card = classification.reason === "shell-redirection" ? rFixCard(state, "redirect") : rDigestRequiredCard(state);
    return rDenied(state, card);
  }
  if (requiresDigest && rDigestCurrent(state)) {
    const contractProblem = rBoundContractProblem(state, event);
    if (contractProblem) return rDenied(state, contractProblem);
  }
  if (rDigestCurrent(state) && projectWrite && !(declaredProjectWrite && !resolution.resolvable)) {
    const scope = rScopeProblem(state, event, projectResolution);
    if (scope) return rDenied(state, scope);
  }

  if (
    !resolution.resolvable &&
    ["implementation", "deletion", "movement", "external-write"].includes(classification.effect) &&
    !(classification.reason === "dynamic-declaration" && classification.boundary === "project" && rDigestCurrent(state))
  ) {
    return rDenied(state, rFixCard(state, "unresolved"));
  }

  const sensitiveEffect = classification.requiredEffect || classification.effect;
  if (R_SENSITIVE_EFFECTS.has(sensitiveEffect)) {
    const allowance = state.sensitive_allow;
    const forecast = rForecastEntry(state, commandHash, sensitiveEffect);
    const forecastAllowed = Boolean(forecast);
    if (forecastAllowed && rDigestCurrent(state)) {
      const contractProblem = rBoundContractProblem(state, event);
      if (contractProblem) return rDenied(state, contractProblem);
    }
    if (sensitiveEffect === "state-change" && !forecastAllowed && !classification.requiredEffect) {
      return rDenied(state, rStateOperationCard(state));
    }
    const allowed = forecastAllowed || rRetry(state, allowance, commandHash, sensitiveEffect);
    if (!allowed) {
      const review = rReviewable(event, payload, resolution);
      if (!review) return rDenied(state, rFixCard(state, "split-sensitive"));
      const duplicate = rSameDenial(state, "sensitive", commandHash, state.current_turn_hash);
      if (!duplicate) rDenyState(state, "sensitive", {effect: sensitiveEffect}, commandHash);
      return rDenied(state, rSensitiveCard(state, sensitiveEffect, review), !duplicate);
    }
    if (!forecastAllowed) {
      allowance.uses -= 1;
      if (allowance.uses === 0) state.sensitive_allow = null;
    }
  }

  rPendWrite(
    state,
    event,
    classification.effect,
    resolution,
    storeWrite,
    commandHash,
    options,
    projectWrite || mayRewriteProject || unresolvedImplementation,
  );
  rEvent(state, "effect-started", {effect: classification.effect}, now);
  return {state, output: null};
}
function rOnPostTool(state, event, now, options) {
  const payload = rPayload(event);
  const commandHash = rOpHash(event, payload);
  const identifier = typeof event.tool_use_id === "string" ? event.tool_use_id : null;
  const toolResult = rResult(event);
  let ruleOutput = null;
  const ruleReadIndex = state.pending_rule_reads.findIndex((entry) =>
    identifier && entry.tool_use_id ? entry.tool_use_id === identifier : entry.command_hash === commandHash,
  );
  if (ruleReadIndex >= 0) {
    const pending = state.pending_rule_reads[ruleReadIndex];
    state.pending_rule_reads.splice(ruleReadIndex, 1);
    if (!toolResult.failed) {
      const returned = toolResult.text;
      const observed = state.rule_basis_paths.filter((target) => {
        if (!pending.path_hashes.includes(rHash(target)) || !returned) return false;
        try {
          const content = fs.readFileSync(target, "utf8");
          return Boolean(content) && returned.includes(content);
        } catch {
          return false;
        }
      }).map((target) => rHash(target));
      state.rule_basis_observed_hashes = [...new Set([...state.rule_basis_observed_hashes, ...observed])].slice(-R_MAX_RULE_BASIS_PATHS);
      // A read that named a required path and came back without its bytes is a distinct observation
      // from a path nobody read, and the reload card has to be able to tell them apart.
      const attempted = state.rule_basis_paths
        .filter((target) => pending.path_hashes.includes(rHash(target)))
        .map((target) => rHash(target))
        .filter((hash) => !state.rule_basis_observed_hashes.includes(hash));
      state.rule_basis_unmatched = [...new Set([...state.rule_basis_unmatched, ...attempted])].slice(-R_MAX_RULE_BASIS_PATHS);
      const required = state.rule_basis_paths.map((target) => rHash(target));
      if (required.every((hash) => state.rule_basis_observed_hashes.includes(hash))) {
        const basis = rRuleBasis(state);
        state.rule_basis_paths = basis.paths;
        state.rule_basis_hash = basis.hash;
        state.rule_basis_required = false;
        rEvent(state, "rule-basis-loaded", {basis_hash: basis.hash}, now);
        ruleOutput = rHookContext("PostToolUse", rCard(
            "Note",
            "The active task's durable rule basis is loaded.",
            "continue from the current task record; show a revised Digest if the basis changed",
          ));
      }
    }
  }
  const index = state.pending_writes.findIndex(
    (entry) => entry.command_hash === commandHash && (!identifier || entry.tool_use_id === identifier),
  );
  if (index >= 0) {
    const pending = state.pending_writes[index];
    state.pending_writes.splice(index, 1);
    if (toolResult.failed) {
      if (event.tool_name === "apply_patch") {
        const target = rPatchTargets(payload, event).targets[0]?.path || "file";
        const output = rCard(
          "Note",
          "The patch to " + path.basename(target) + " did not apply and changed nothing.",
          "fix the patch against the current file and retry",
        );
        rEvent(state, "effect-failed", {effect: pending.effect}, now);
        return {state, output: rHookContext("PostToolUse", output)};
      }
      rEvent(state, "effect-failed", {effect: pending.effect}, now);
      return {state, output: null};
    }
    const resolution = rWriteTargets(event, payload);
    const workspaceAfter = rScope(event, options, rPlan(state, event), state.workspace_scope_snapshot);
    const wasVerification = pending.effect === "verification";
    const workspaceChanged = rObserveEffect(state, pending, now, false, resolution, workspaceAfter);
    if (wasVerification && workspaceChanged) {
      const output = state.work_type === "verification"
        ? rVerificationMutationCard(state)
        : rCard(
          "Blocked",
          "The verification command changed the project, so it cannot count as a check.",
          "run pmnm-guard redo first, then inspect the changes, update plan.md, show the revised Digest, and run pmnm-guard digest",
        );
      return {state, output: rHookContext("PostToolUse", output)};
    }
    return {state, output: ruleOutput};
  }

  const reconciled = state.reconciled_writes.findIndex(
    (entry) => entry.command_hash === commandHash && (!identifier || entry.tool_use_id === identifier),
  );
  if (reconciled >= 0 && !toolResult.failed) {
    const pending = state.reconciled_writes[reconciled];
    state.reconciled_writes.splice(reconciled, 1);
    const resolution = rWriteTargets(event, payload);
    rObserveEffect(state, pending, now, true, resolution, rSnapshot(event, options));
    const operation = "Operation " + (pending.operation_id || pending.command_hash?.slice(0, 12) || "unknown");
    const output = rCard(
      "Note",
      operation + " did take effect after all.",
      "inspect the current state, then continue; pmnm-guard redo if the Digest no longer holds",
    );
    return {state, output: rHookContext("PostToolUse", output)};
  }
  return {state, output: ruleOutput};
}
function rOnPrompt(state, event, now) {
  rExpireDecl(state);
  rRecoverDigest(state, event, now);
  state.prompt_epoch += 1;
  state.current_turn_hash = rHash(String(event.turn_id || state.prompt_epoch));
  state.stop_turn_hash = null;
  state.stop_next_hash = null;
  let output = null;
  if (state.pending_denied?.kind === "sensitive" && !["digest", "test-digest"].includes(state.pending_question?.kind)) {
    state.pending_denied.approved_prompt_epoch = null;
    if (String(event.prompt || "").trim() === rApprovalToken(state)) {
      state.pending_denied.approved_prompt_epoch = state.prompt_epoch;
      output = rHookContext(
        "UserPromptSubmit",
        rCard(
          "Note",
          "The human supplied the exact operation-bound approval token.",
          "pmnm-guard allow effect=" + state.pending_denied.effect + ", then rerun the same command",
        ),
      );
      rEvent(state, "sensitive-approval-observed", {effect: state.pending_denied.effect}, now);
    } else {
      output = rHookContext("UserPromptSubmit", rSensitiveProofCard(state));
      rEvent(state, "sensitive-approval-missing", {effect: state.pending_denied.effect}, now);
    }
  } else if (
    state.pending_question?.kind === "digest" &&
    state.digest_shown_epoch === state.epoch &&
    state.prompt_epoch > state.pending_question.asked_prompt_epoch
  ) {
    state.pending_denied = null;
    state.human_response_epoch = state.prompt_epoch;
    state.phase = "AWAITING_HUMAN";
    output = rHookContext(
      "UserPromptSubmit",
      rCard(
        "Note",
        "The human answered the Digest for " + state.task_id + ".",
        "if the human agreed as shown: pmnm-guard agreed; if anything changed: show the revised Digest, then pmnm-guard digest",
      ),
    );
    rEvent(state, "digest-response-observed", {epoch: state.epoch}, now);
  } else if (
    state.pending_question?.kind === "test-digest" &&
    rTestDigestCurrent(state) &&
    state.prompt_epoch > state.pending_question.asked_prompt_epoch
  ) {
    state.pending_denied = null;
    state.test_digest_response_epoch = state.prompt_epoch;
    state.pending_question = null;
    output = rHookContext(
      "UserPromptSubmit",
      rCard(
        "Note",
        "The human received the current Test Digest for " + state.task_id + ".",
        "audit the whole change and its evidence, then pmnm-guard done audit=<passed|partial|blocked>",
      ),
    );
    rEvent(state, "test-digest-response-observed", {epoch: state.epoch}, now);
  }
  rEvent(state, "user-prompt", {turn_hash: state.current_turn_hash}, now);
  return {state, output};
}
function rQuestionText(state) {
  const kind = state.pending_question?.kind;
  const words = {
    folder: "PMNM folder location",
    project: "project name",
    digest: "the plan Digest",
    "test-digest": "the Test Digest",
    inspection: "inspection-only verification",
    "human-verification": "human verification",
    "task-identity": "task-folder identity",
    "task-transition": "the task transition",
    "pointer-recovery": "PMNM configuration recovery",
    "index-recovery": "PMNM configuration recovery",
  }[kind] || "the open question";
  return words;
}
function rHumanCard(state) {
  if (state.pending_denied?.kind === "sensitive") return rSensitiveProofCard(state);
  const question = rQuestionText(state);
  return rCard(
    "Note",
    "PMNM is waiting for the human: " + question + ".",
    "stop here; no more actions until the human answers",
  );
}
function rRepeatedStop(state, next) {
  return rCard(
    "Note",
    "PMNM stopped this turn once already and will not again.",
    next,
  );
}
function rStopOnce(state, nextCard, now) {
  const next =
    nextCard.split("\n").find((line) => line.startsWith("NEXT:"))?.slice(5).trim() ||
    "stop here; no more actions until the human answers";
  if (state.stop_turn_hash === state.current_turn_hash) {
    return {state, output: rWarning(rRepeatedStop(state, next))};
  }
  state.stop_turn_hash = state.current_turn_hash;
  state.stop_next_hash = rHash(next);
  rEvent(state, "stop-blocked", {next_hash: state.stop_next_hash}, now);
  return {state, output: rContinueStop(nextCard)};
}
function rUnverifiedCard(state) {
  const paths = state.changed_target_hashes.length;
  const changed = paths > 0 || state.mutation_count > 0;
  const external = !changed;
  const next = rReceiptNext("verified", state);
  let english = "External or system effects are unverified.";
  if (paths) {
    english = paths + " planned " + (paths === 1 ? "path changed; it is unverified." : "paths changed; they are unverified.");
  } else if (changed) {
    english = "Project work changed and nothing verified it yet.";
  }
  return rCard(
    "Blocked",
    english,
    "check the " + (external ? "effect" : "change") + ", then " + next,
  );
}
function rClosingCard(state) {
  const verification = state.last_verification;
  const fingerprint = verification?.fingerprint;
  const detail = fingerprint?.provider === "git"
    ? "Fingerprint " + fingerprint.hash + ": base " + fingerprint.base + ", HEAD " + fingerprint.head + ", " + fingerprint.staged + " staged, " + fingerprint.unstaged + " unstaged, " + fingerprint.untracked + " untracked."
    : "Fingerprint " + (fingerprint?.hash || "unknown") + ": " + (fingerprint?.changed || 0) + " files changed by PMNM, no version control.";
  return rCard(
    "Note",
    "Verification recorded (" + (verification?.result || "unknown") + "). " + detail,
    "complete the required review and final audit, then pmnm-guard done audit=<passed|partial|blocked>; show the Test Digest only when that audit requests it",
  );
}
function rPauseCard(state, repeated = false) {
  return rCard(
    repeated ? "Ask" : "Note",
    "Investigation is pausing with no Digest recorded this turn.",
    repeated
      ? "show the Digest now; if one question blocks it, ask that question and stop here"
      : "show the Digest; if your last message already asks the human one question, stop here",
  );
}
function rOnStop(state, event, now) {
  rExpireDecl(state);
  if (state.pending_writes.length) return rStopOnce(state, rResultCard(state, state.pending_writes[0]), now);
  if (state.pending_question || state.pending_denied?.kind === "sensitive") {
    return {
      state,
      output: rWarning(rHumanCard(state)),
    };
  }
  const affected = state.mutation_count > 0 || state.effect_count > 0;
  if (affected && !rVerifiedNow(state)) return rStopOnce(state, rUnverifiedCard(state), now);
  if (rVerifiedNow(state) && !state.completion && state.test_digest_audit_epoch === state.epoch) {
    if (!rTestDigestCurrent(state)) {
      if (!rTestDigestShape(state, event.last_assistant_message)) return rStopOnce(state, rTestDigestCard(state), now);
      // The hand-over rides the same message. It is always satisfiable, so a wrong reading of the
      // condition costs one line rather than a blocked closure.
      if (rOwesHandover(state) && !rHandoverSatisfied(event.last_assistant_message)) {
        return rStopOnce(state, rHandoverCard(state), now);
      }
      state.test_digest_epoch = state.epoch;
      state.test_digest_prompt_epoch = state.prompt_epoch;
      state.test_digest_response_epoch = null;
      state.test_digest_mutation_count = state.mutation_count;
      state.test_digest_effect_count = state.effect_count;
      state.test_digest_verification_count = state.verification_count;
      rAsk(state, "test-digest", {mutation_count: state.mutation_count, effect_count: state.effect_count});
      rEvent(state, "test-digest-shown", {epoch: state.epoch}, now);
      return {state, output: null};
    }
    if (state.test_digest_response_epoch === null) return {state, output: rWarning(rHumanCard(state))};
    return rStopOnce(state, rClosingCard(state), now);
  }
  if (state.phase === "INVESTIGATE" && (!state.rules_file_hashes_written.length || state.plan_write_seq !== null)) {
    const repeated = state.investigation_stop_count++ > 0;
    const card = rPauseCard(state, repeated);
    return repeated
      ? rStopOnce(state, card, now)
      : {state, output: rWarning(card)};
  }
  return {state, output: null};
}
function rOnInterrupt(state, now) {
  rExpireDecl(state);
  if (state.pending_writes.length) state.phase = "RECOVERY";
  rEvent(state, "interrupt", {pending: state.pending_writes.length}, now);
  return {state, output: null};
}
export function processEvent(stateInput, event, options = {}) {
  const state = rValidateState(structuredClone(stateInput));
  const now = options.now === undefined ? Date.now() : options.now;
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("hook event must be an object");
  switch (event.hook_event_name) {
    case "SessionStart": {
      rExpireDecl(state);
      rEvent(state, "session-start", {source: event.source || "unknown"}, now);
      if (state.migration_notice) {
        state.migration_notice = false;
        return {
          state,
          output: rHookContext(
            "SessionStart",
            rCard(
              "Note",
              "PMNM reset pre-release guard state to the 0.1.0 flow.",
              "pmnm-guard start task=<ticket-or-id> effort=<light|standard|high> work=<implementation|advisory|verification>",
            ),
          ),
        };
      }
      if (state.task_id && ["startup", "resume", "clear", "compact"].includes(event.source)) {
        const unavailable = rFolderIssue(state, event, options);
        if (unavailable) return {state, output: rHookContext("SessionStart", unavailable)};
        rRequireRuleBasis(state);
        return {
          state,
          output: state.rule_basis_required ? rHookContext("SessionStart", rRuleBasisCard(state)) : null,
        };
      }
      return {
        state,
        output: null,
      };
    }
    case "UserPromptSubmit":
      return rOnPrompt(state, event, now);
    case "PreToolUse":
      return rOnPreTool(state, event, now, options);
    case "PostToolUse":
      return rOnPostTool(state, event, now, options);
    case "Stop":
      return rOnStop(state, event, now);
    case "Interrupt":
      return rOnInterrupt(state, now);
    default:
      throw new Error("unsupported hook event: " + String(event.hook_event_name));
  }
}
function rDataRoot(environment) {
  const value = environment.PLUGIN_DATA || environment.CLAUDE_PLUGIN_DATA;
  if (!value || typeof value !== "string") throw new Error("PLUGIN_DATA is unavailable");
  return path.resolve(value);
}
function rStatePaths(root, event) {
  const cwd = typeof event.cwd === "string" ? event.cwd : "";
  if (typeof event.session_id !== "string" || !event.session_id || !cwd) throw new Error("session_id and cwd are required");
  const directory = path.join(root, "host-guard", "v3");
  const canonicalCwd = rCanonical(cwd) || path.resolve(cwd);
  const projectKey = rHash(canonicalCwd);
  const name = rHash(canonicalCwd + "\0" + event.session_id);
  return {
    directory,
    state: path.join(directory, "session-" + name + ".json"),
    lock: path.join(directory, "session-" + name + ".lock"),
    projectState: path.join(directory, "project-" + projectKey + ".json"),
    projectLock: path.join(directory, "project-" + projectKey + ".lock"),
    projectKey,
  };
}
function rTaskStatePaths(paths, task) {
  const key = rHash(paths.projectKey + "\0" + task);
  return {
    state: path.join(paths.directory, "task-" + key + ".json"),
    lock: path.join(paths.directory, "task-" + key + ".lock"),
  };
}
function rEnsureDirectory(directory) {
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  const metadata = fs.lstatSync(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("guard data directory is not a real directory");
  try {
    fs.chmodSync(directory, 0o700);
  } catch {}
}
function rAcquireLock(lockPath, waitMs = R_LOCK_WAIT_MS) {
  const token = String(process.pid) + ":" + crypto.randomBytes(8).toString("hex");
  const deadline = Date.now() + (Number.isFinite(waitMs) ? waitMs : R_LOCK_WAIT_MS);
  for (;;) {
    try {
      const descriptor = fs.openSync(lockPath, "wx", 0o600);
      try {
        fs.writeSync(descriptor, token);
      } finally {
        fs.closeSync(descriptor);
      }
      return token;
    } catch (error) {
      if (!error || error.code !== "EEXIST") throw error;
      try {
        const lock = fs.lstatSync(lockPath);
        if (lock.isFile() && !lock.isSymbolicLink() && Date.now() - lock.mtimeMs > R_LOCK_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (lockError) {
        if (!lockError || lockError.code !== "ENOENT") throw lockError;
        continue;
      }
      if (Date.now() >= deadline) throw new Error("guard state is busy");
      const delay = R_LOCK_DELAY_MS + Math.floor(Math.random() * R_LOCK_DELAY_MS);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}
function rReleaseLock(lockPath, token) {
  try {
    if (fs.readFileSync(lockPath, "utf8") !== token) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}
function rReadState(statePath) {
  try {
    const metadata = fs.lstatSync(statePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > R_MAX_STATE_BYTES) {
      throw new Error("guard state file is unsafe or oversized");
    }
    return {state: rValidateState(JSON.parse(fs.readFileSync(statePath, "utf8"))), missing: false};
  } catch (error) {
    if (error && error.code === "ENOENT") return {state: rBaseState(), missing: true};
    throw error;
  }
}
function rWriteState(statePath, state) {
  const serialized = JSON.stringify(rValidateState(state));
  if (Buffer.byteLength(serialized, "utf8") > R_MAX_STATE_BYTES) throw new Error("guard state exceeds its bounded size");
  rAtomic(statePath, serialized, 0o600);
}

const R_TASK_DURABLE_FIELDS = (
  "phase epoch effort work_type digest_shown_epoch digest_agreed_epoch permission_manifest_hash environment_plan_hash task_permission_epoch task_permissions task_capabilities " +
  "mutation_count effect_count verification_count changed_target_hashes observed_state_hashes historical_state_hashes " +
  "plan_file_hash plan_target_hashes verification_plan_hash impact_plan_hash expectations_plan_hash redo_contract_hash work_change_authorized workspace_scope_snapshot workspace_digest_snapshot " +
  "verification_claim_mutation_count verification_claim_effect_count rules_file_hashes_written last_check last_verification " +
  "digest_rule_basis_hash completion"
).split(" ");
const R_PROJECT_DURABLE_FIELDS = (
  "project_permission_project_hash project_permissions project_capabilities"
).split(" ");

function rFieldsSnapshot(state, fields) {
  return Object.fromEntries(fields.map((field) => [field, structuredClone(state[field])]));
}
function rFieldsChanged(before, state, fields) {
  return rStableJson(before) !== rStableJson(rFieldsSnapshot(state, fields));
}
function rReadRuntime(target, schema) {
  try {
    const metadata = fs.lstatSync(target);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > R_MAX_STATE_BYTES) throw new Error("runtime state is unsafe");
    const value = JSON.parse(fs.readFileSync(target, "utf8"));
    if (!value || value.schema !== schema || !Number.isInteger(value.revision) || value.revision < 0 || !value.fields || typeof value.fields !== "object") {
      throw new Error("runtime state is invalid");
    }
    return value;
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}
function rWriteRuntime(target, schema, revision, fields, identity = {}) {
  const value = {schema, revision, ...identity, fields};
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > R_MAX_STATE_BYTES) throw new Error("runtime state exceeds its bounded size");
  rAtomic(target, serialized, 0o600);
}
function rApplyFields(state, fields, names) {
  for (const name of names) if (Object.hasOwn(fields, name)) state[name] = structuredClone(fields[name]);
}
function rAdoptTaskRuntime(state, task, runtime) {
  const pendingQuestion = state.pending_question;
  rClearTaskFlow(state);
  state.pending_question = pendingQuestion;
  state.task_id = task;
  state.task_hash = rHash(task);
  rApplyFields(state, runtime.fields, R_TASK_DURABLE_FIELDS);
  state.task_revision = runtime.revision;
  state.test_digest_epoch = null;
  state.test_digest_prompt_epoch = null;
  state.test_digest_response_epoch = null;
  state.test_digest_audit_epoch = null;
}
function rRequestedTask(event) {
  if (event.hook_event_name !== "PreToolUse" || event.tool_name !== "Bash") return null;
  try {
    let control = parseControlCommand(rPayload(event));
    if (!control) return null;
    if (R_ALIASES.has(control.action)) control = rAliasControl(control);
    return control.action === "start" ? rDecodeField(control.fields.task, "task") : null;
  } catch {
    return null;
  }
}
function rCanLoadRequestedTask(state, task) {
  if (state.pending_writes.length) return false;
  if (!state.task_id || state.task_id === task || state.completion) return true;
  if (
    state.pending_question?.kind === "task-transition" &&
    state.pending_question.task === task &&
    state.prompt_epoch > state.pending_question.asked_prompt_epoch
  ) return true;
  return state.mutation_count === 0 && state.effect_count === 0;
}
function rConcurrentTaskCard(state) {
  return rCard(
    "Blocked",
    "This task changed in another session after this session loaded it.",
    "run pmnm-guard start task=" + state.task_id + " effort=" + (state.effort || "standard") + " work=" + (state.work_type || "<implementation|advisory|verification>") + " to reload it, then reconcile any conflicting local conclusion before writing",
  );
}
export function processPersistedEvent(event, options = {}) {
  const environment = options.environment || process.env;
  const root = options.dataRoot || rDataRoot(environment);
  const paths = rStatePaths(root, event);
  rEnsureDirectory(paths.directory);
  const token = rAcquireLock(paths.lock, options.lockWaitMs);
  let projectToken = null;
  let taskToken = null;
  let taskLockPath = null;
  try {
    const state = rReadState(paths.state).state;
    projectToken = rAcquireLock(paths.projectLock, options.lockWaitMs);
    const projectRuntime = rReadRuntime(paths.projectState, "pmnm.project-state/v1");
    if (projectRuntime) {
      rApplyFields(state, projectRuntime.fields, R_PROJECT_DURABLE_FIELDS);
      state.project_revision = projectRuntime.revision;
    }
    const requested = rRequestedTask(event);
    const canLoadRequested = Boolean(requested && rCanLoadRequestedTask(state, requested));
    const selected = canLoadRequested ? requested : state.task_id;
    const taskPaths = selected ? rTaskStatePaths(paths, selected) : null;
    if (taskPaths) {
      taskLockPath = taskPaths.lock;
      taskToken = rAcquireLock(taskLockPath, options.lockWaitMs);
    }
    const taskRuntime = taskPaths ? rReadRuntime(taskPaths.state, "pmnm.task-state/v1") : null;
    const explicitReload = Boolean(canLoadRequested && requested === selected);
    if (taskRuntime && (state.task_id !== selected || explicitReload || state.task_revision === null)) {
      rAdoptTaskRuntime(state, selected, taskRuntime);
    }
    const staleTask = Boolean(
      taskRuntime && state.task_id === selected && state.task_revision !== null && state.task_revision !== taskRuntime.revision,
    );
    if (staleTask && !explicitReload) {
      const payload = rPayload(event);
      const classification = event.hook_event_name === "PreToolUse" ? rClassifyEvent(event, payload) : null;
      if (classification?.kind !== "read") {
        if (event.hook_event_name === "PreToolUse") return rDenyTool(rConcurrentTaskCard(state));
        if (event.hook_event_name === "UserPromptSubmit" || event.hook_event_name === "SessionStart") return rWarning(rConcurrentTaskCard(state));
        return null;
      }
    }
    const taskBefore = rFieldsSnapshot(state, R_TASK_DURABLE_FIELDS);
    const projectBefore = rFieldsSnapshot(state, R_PROJECT_DURABLE_FIELDS);
    const before = JSON.stringify(state);
    const result = processEvent(state, event, {...options, environment});
    if (result.state.task_id) {
      const resultTaskPaths = rTaskStatePaths(paths, result.state.task_id);
      if (!taskPaths || resultTaskPaths.state !== taskPaths.state) throw new Error("task changed without its runtime lock");
      if (!taskRuntime || rFieldsChanged(taskBefore, result.state, R_TASK_DURABLE_FIELDS)) {
        const revision = (taskRuntime?.revision || 0) + 1;
        rWriteRuntime(
          resultTaskPaths.state,
          "pmnm.task-state/v1",
          revision,
          rFieldsSnapshot(result.state, R_TASK_DURABLE_FIELDS),
          {task_hash: result.state.task_hash},
        );
        result.state.task_revision = revision;
      }
    }
    if (!projectRuntime || rFieldsChanged(projectBefore, result.state, R_PROJECT_DURABLE_FIELDS)) {
      const revision = (projectRuntime?.revision || 0) + 1;
      rWriteRuntime(paths.projectState, "pmnm.project-state/v1", revision, rFieldsSnapshot(result.state, R_PROJECT_DURABLE_FIELDS));
      result.state.project_revision = revision;
    }
    if (JSON.stringify(result.state) !== before) {
      rWriteState(paths.state, result.state);
    }
    return result.output;
  } finally {
    if (taskToken) rReleaseLock(taskLockPath, taskToken);
    if (projectToken) rReleaseLock(paths.projectLock, projectToken);
    rReleaseLock(paths.lock, token);
  }
}
function rEmergencyOutput(event, error) {
  const state = rBaseState();
  const detail = rOneLine(error && error.message ? error.message : String(error), 180);
  const message = rCard(
    "Blocked",
    "PMNM could not read its own state: " + detail + ".",
    "check /hooks and pmnm-guard status before continuing",
  );
  if (event?.hook_event_name === "PreToolUse") {
    const payload = rPayload(event);
    const classification = rClassifyEvent(event, payload);
    return classification.kind === "read" ? rWarning(message) : rDenyTool(message);
  }
  return rWarning(message);
}
export function main(environment = process.env) {
  let raw;
  let event = null;
  try {
    raw = fs.readFileSync(0);
    if (raw.length > R_MAX_INPUT_BYTES) throw new Error("hook input exceeds its bounded size");
    event = JSON.parse(raw.toString("utf8"));
    const output = processPersistedEvent(event, {environment});
    if (output) process.stdout.write(JSON.stringify(output));
    return 0;
  } catch (error) {
    process.stdout.write(JSON.stringify(rEmergencyOutput(event, error)));
    return 0;
  }
}

if (import.meta.url === rInvokedPath) process.exitCode = main();

export const testing = Object.freeze({
  baseState: rBaseState,
  acquireLock: rAcquireLock,
  releaseLock: rReleaseLock,
  hash: rHash,
  validateState: rValidateState,
  resolveTarget: rResolvePath,
  resolveWriteTargets: rWriteTargets,
  readHostPointer: rReadPointer,
  gitFingerprint: rGitFingerprint,
  parseGitStatus: rParseGitStatus,
  scanSecret: rScanSecret,
  statePaths: rStatePaths,
  stateCard: rStateCard,
  NO_OP_COMMAND: R_NO_OP_COMMAND,
  MAX_EVENTS: R_MAX_EVENTS,
  SCHEMA_VERSION: R_SCHEMA_VERSION,
  modulePath: fileURLToPath(import.meta.url),
});
