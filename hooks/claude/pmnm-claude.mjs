#!/usr/bin/env node
// Please, Make No Mistakes — Claude Code host entry.
//
// This module is the Claude-owned adapter. It normalizes native Claude
// lifecycle events into the shapes the reviewed persisted-event engine already
// accepts, calls that engine without modifying it, and translates its answer
// back into Claude's output contract.
//
// It never invents an event the host did not deliver, never reads the engine's
// card prose as protocol, and never claims coverage for a surface it did not
// forward. Unknown shapes fail closed; unrecognized tool names proceed with no
// PMNM decision, no evidence and no coverage claim.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {processPersistedEvent} from "../pmnm-guard.mjs";

const R_MAX_INPUT_BYTES = 1_000_000;
const R_MAX_TEXT = 1200;
const R_MAX_ERROR_TEXT = 180;
// On a denial Claude shows the reason to the model and never to the human, so
// PMNM says one short line to the human instead of leaving them with nothing.
const R_HUMAN_BLOCKED = "Please, Make No Mistakes blocked this step; Claude has the exact next action.";

export const adapterPath = fileURLToPath(import.meta.url);

// Events this adapter registers. Anything else fails closed.
export const CLAUDE_EVENTS = new Set([
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Stop",
]);

// Documented SessionStart sources. An unknown value is a host change, not a guess.
export const SESSION_SOURCES = new Set(["startup", "resume", "clear", "compact", "fork"]);

// Write and command shapes the frozen engine already normalizes.
export const ENGINE_TOOLS = new Set(["Bash", "Edit", "Write"]);

// Read shapes the engine classifies natively. They are forwarded before the
// call so route-before-read applies, and never after it: a file tool renders
// its output, so its result cannot carry the file's current bytes.
export const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);

// Mutating shapes the engine cannot resolve a target for. Blocked, never guessed.
export const UNSUPPORTED_TOOLS = new Set(["PowerShell", "NotebookEdit"]);

export function toolDisposition(name) {
  if (typeof name !== "string" || !name) return "invalid";
  if (ENGINE_TOOLS.has(name)) return "engine";
  if (READ_TOOLS.has(name)) return "read";
  if (UNSUPPORTED_TOOLS.has(name)) return "unsupported";
  return "unobserved";
}

export function configRoot(environment = process.env) {
  const configured = environment && typeof environment.CLAUDE_CONFIG_DIR === "string" && environment.CLAUDE_CONFIG_DIR
    ? environment.CLAUDE_CONFIG_DIR
    : null;
  return path.resolve(configured || path.join(os.homedir(), ".claude"));
}

function bounded(value, limit = R_MAX_TEXT) {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
}
// A card is two lines: the level and what happened, then one NEXT action. Its
// line break is part of the contract, so bounding an answer must not flatten it.
function boundedCard(value, limit = R_MAX_TEXT) {
  const text = String(value == null ? "" : value)
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
  return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
}

function isText(value) {
  return typeof value === "string" && value.length > 0;
}

function exitCodeFrom(error) {
  const first = String(error == null ? "" : error).split("\n", 1)[0];
  const match = first.match(/^Exit code (\d+)/);
  return match ? Number(match[1]) : null;
}

function closed(reason) {
  return {status: "closed", reason};
}

// Strict normalization. Every accepted field is named and required fields are
// rejected rather than defaulted. Nothing is inferred from a neighbouring field
// and no permissive fallback exists.
export function normalize(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return closed("the host event is not an object");
  const name = source.hook_event_name;
  if (!CLAUDE_EVENTS.has(name)) return closed("unsupported or unknown host event " + bounded(name, 40));
  if (!isText(source.session_id)) return closed("the host event has no session_id");
  if (!isText(source.cwd)) return closed("the host event has no cwd");

  const normalized = {
    hook_event_name: name,
    session_id: source.session_id,
    cwd: source.cwd,
  };
  if (isText(source.prompt_id)) normalized.turn_id = source.prompt_id;

  if (name === "SessionStart") {
    if (!SESSION_SOURCES.has(source.source)) return closed("unknown SessionStart source " + bounded(source.source, 40));
    normalized.source = source.source;
    return {status: "forward", event: normalized};
  }

  if (name === "UserPromptSubmit") {
    if (typeof source.prompt !== "string") return closed("UserPromptSubmit has no prompt string");
    normalized.prompt = source.prompt;
    return {status: "forward", event: normalized};
  }

  if (name === "Stop") {
    if (typeof source.last_assistant_message !== "string") return closed("Stop has no last_assistant_message string");
    if (typeof source.stop_hook_active !== "boolean") return closed("Stop has no stop_hook_active boolean");
    normalized.last_assistant_message = source.last_assistant_message;
    normalized.stop_hook_active = source.stop_hook_active;
    return {status: "forward", event: normalized};
  }

  const disposition = toolDisposition(source.tool_name);
  if (disposition === "invalid") return closed("the tool event has no tool_name");
  const fromSubagent = isText(source.agent_id);

  if (name === "PreToolUse") {
    if (disposition === "unobserved") return {status: "skip"};
    if (disposition === "unsupported") return {status: "unsupported", tool: source.tool_name};
    // Material subagent effects are unsupported in 0.1.0. Shared task authority
    // across parent and subagent is the eventual target, not a proven one, so
    // the effect stays closed rather than inheriting authority it never earned.
    if (fromSubagent && disposition !== "read") return {status: "subagent", tool: source.tool_name};
    if (!source.tool_input || typeof source.tool_input !== "object" || Array.isArray(source.tool_input)) {
      return closed("the tool event has no tool_input object");
    }
    if (!isText(source.tool_use_id)) return closed("the tool event has no tool_use_id");
    normalized.tool_name = source.tool_name;
    normalized.tool_input = source.tool_input;
    normalized.tool_use_id = source.tool_use_id;
    return {status: "forward", event: normalized};
  }

  // Post events are forwarded only for operations this adapter forwarded before
  // execution. Anything else was never the engine's operation to resolve.
  if (disposition !== "engine" || fromSubagent) return {status: "skip"};

  // `is_interrupt` is an optional boolean. Absent is valid; a present value of
  // any other type is a malformed host shape and must not fall through to the
  // ordinary failure path.
  if (name === "PostToolUseFailure" && "is_interrupt" in source && typeof source.is_interrupt !== "boolean") {
    return closed("PostToolUseFailure has a non-boolean is_interrupt");
  }
  // An interruption is evidence that one interruption shape occurred. It is not
  // evidence that the operation had no effect, so the pending operation is left
  // unresolved for the engine's own recovery path to reconcile.
  if (name === "PostToolUseFailure" && source.is_interrupt === true) return {status: "interrupted"};

  if (!source.tool_input || typeof source.tool_input !== "object" || Array.isArray(source.tool_input)) {
    return closed("the tool event has no tool_input object");
  }
  if (!isText(source.tool_use_id)) return closed("the tool event has no tool_use_id");
  normalized.hook_event_name = "PostToolUse";
  normalized.tool_name = source.tool_name;
  normalized.tool_input = source.tool_input;
  normalized.tool_use_id = source.tool_use_id;

  if (name === "PostToolUse") {
    if (source.tool_response === undefined) return closed("PostToolUse has no tool_response");
    normalized.tool_response = source.tool_response;
    return {status: "forward", event: normalized};
  }

  if (typeof source.error !== "string") return closed("PostToolUseFailure has no error string");
  const code = exitCodeFrom(source.error);
  normalized.tool_response = {
    isError: true,
    output: bounded(source.error),
    ...(code === null ? {} : {exit_code: code}),
  };
  return {status: "forward", event: normalized};
}

function boundStrings(value, depth = 0) {
  if (typeof value === "string") return boundedCard(value);
  if (depth > 6 || !value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => boundStrings(item, depth + 1));
  const result = {};
  for (const [key, item] of Object.entries(value)) result[key] = boundStrings(item, depth + 1);
  return result;
}

// The engine names the event it believes it answered. Claude validates that
// name against the event it actually delivered, so the adapter restates it.
export function translate(eventName, output) {
  if (!output || typeof output !== "object") return null;
  const answer = boundStrings(output);
  if (answer.hookSpecificOutput && typeof answer.hookSpecificOutput === "object") {
    answer.hookSpecificOutput.hookEventName = eventName;
  }
  return answer;
}

function failClosed(source, reason) {
  const detail = "PMNM could not admit this host event: " + bounded(reason, R_MAX_ERROR_TEXT) + ".";
  if (source && source.hook_event_name === "PreToolUse") {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Blocked: " + detail + "\nNEXT: tell the human PMNM could not read this host event.",
      },
      systemMessage: R_HUMAN_BLOCKED,
    };
  }
  return {systemMessage: "Note: " + detail + "\nNEXT: tell the human PMNM did not observe this step."};
}

function blockUnsupported(tool) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "Blocked: " + bounded(tool, 40) + " is an unsupported write surface for PMNM in this host, so the call did not run." +
        "\nNEXT: make this change with a supported write tool.",
    },
    systemMessage: R_HUMAN_BLOCKED,
  };
}

function blockSubagent(tool) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "Blocked: material subagent effects are unsupported in PMNM 0.1.0, so this subagent " +
        bounded(tool, 40) + " call did not run." +
        "\nNEXT: make this change from the main conversation.",
    },
    systemMessage: R_HUMAN_BLOCKED,
  };
}

function reportInterrupted() {
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUseFailure",
      additionalContext:
        "Note: PMNM observed an interruption, so this operation's outcome is unknown and stays unresolved." +
        "\nNEXT: inspect the target's current state before the next write.",
    },
  };
}

function defaultEngine(normalized, options) {
  return processPersistedEvent(normalized, options);
}

export function handle(source, options = {}) {
  const engine = typeof options.engine === "function" ? options.engine : defaultEngine;
  const environment = options.environment || process.env;
  let decision;
  try {
    decision = normalize(source);
  } catch (error) {
    return failClosed(source, error && error.message ? error.message : String(error));
  }
  if (decision.status === "skip") return null;
  if (decision.status === "unsupported") return blockUnsupported(decision.tool);
  if (decision.status === "subagent") return blockSubagent(decision.tool);
  if (decision.status === "interrupted") return reportInterrupted();
  if (decision.status === "closed") return failClosed(source, decision.reason);
  try {
    const output = engine(decision.event, {environment, hostConfigRoot: configRoot(environment)});
    return translate(source.hook_event_name, output);
  } catch (error) {
    return failClosed(source, error && error.message ? error.message : String(error));
  }
}

export function main(environment = process.env) {
  let source = null;
  try {
    const raw = fs.readFileSync(0);
    if (raw.length > R_MAX_INPUT_BYTES) throw new Error("host event exceeds its bounded size");
    source = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    // The event could not be read, so the event it would have been is unknown.
    // Exit 2 is the host's own blocking path and is the only honest answer here.
    process.stderr.write(
      "PMNM could not read this host event: " + bounded(error && error.message ? error.message : String(error), R_MAX_ERROR_TEXT) + ".",
    );
    return 2;
  }
  const answer = handle(source, {environment});
  if (answer) process.stdout.write(JSON.stringify(answer));
  return 0;
}

// Node keeps the link path in import.meta.url under --preserve-symlinks-main, so both sides are
// resolved before they are compared; a symlinked plugin directory must still run the adapter.
function resolvedPath(candidate) {
  if (typeof candidate !== "string") return "";
  try {
    return fs.realpathSync(candidate);
  } catch {
    // A missing path cannot be this running module.
    return "";
  }
}

const invokedPath = resolvedPath(process.argv[1]);
const isThisModule = invokedPath !== "" && invokedPath === resolvedPath(adapterPath);
if (isThisModule) process.exitCode = main();
