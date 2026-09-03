#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCHEMA_VERSION = 1;
const MAX_INPUT_BYTES = 1_000_000;
const MAX_STATE_BYTES = 65_536;
const MAX_EVENTS = 128;
const MAX_CONTROL_BYTES = 2_048;
const LOCK_ATTEMPTS = 40;
const LOCK_DELAY_MS = 25;
const NO_OP_COMMAND = 'node -e ""';

const PHASES = new Set([
  "ORIENT",
  "INVESTIGATE",
  "AWAITING_COLLABORATOR",
  "COLLABORATOR_RESPONDED",
  "ALIGNED",
  "READY",
  "IMPLEMENT",
  "VERIFY",
  "RECOVERY",
  "BLOCKED",
  "COMPLETE",
  "EXEMPT"
]);
const EFFORTS = new Set(["light", "standard", "high"]);
const EFFORT_ORDER = Object.freeze({ light: 0, standard: 1, high: 2 });
const TRANSITIONS = new Set([
  "not-applicable",
  "loaded",
  "created",
  "no-record-with-valid-reason",
  "planned-and-awaiting-approval",
  "blocked"
]);
const EFFECTS = new Set([
  "implementation",
  "structure",
  "dependencies",
  "environment",
  "verification",
  "version-control",
  "external",
  "publication",
  "durable-content",
  "durable-structure",
  "movement",
  "deletion"
]);
const NON_IMPLEMENTATION_GRANTS = new Set([
  "structure",
  "dependencies",
  "environment",
  "verification",
  "version-control",
  "external",
  "publication",
  "durable-content",
  "durable-structure",
  "movement",
  "deletion"
]);
const READINESS_EFFECTS = new Set(["implementation", "verification"]);
const EXEMPT_EFFECTS = new Set(["implementation", "verification"]);
const SENSITIVE_GRANTS = new Set([
  "structure",
  "dependencies",
  "environment",
  "version-control",
  "external",
  "publication",
  "durable-structure",
  "movement",
  "deletion"
]);
const CHECKPOINT_KINDS = new Set(["direction", "combined", "authority"]);
const COLLABORATOR_RESULTS = new Set(["accepted", "changed", "unclear", "rejected"]);
const RECONCILE_OUTCOMES = new Set(["unknown", "failed-no-effect"]);
const ALIGNMENT_RESULTS = new Set(["current", "delegated", "not-required"]);
const SCENARIO_RESULTS = new Set(["aligned", "delegated", "not-required"]);
const CAPTURE_READINESS = new Set(["current", "not-applicable"]);
const VERIFICATION_RESULTS = new Set(["passed", "partial", "blocked"]);
const VERIFICATION_OBSERVATIONS = new Set(["passed", "failed", "partial", "blocked"]);
const AUDIT_RESULTS = new Set(["passed", "partial", "blocked"]);
const CAPTURE_RESULTS = new Set(["complete", "not-applicable", "incomplete"]);
const PROTECTION_RESULTS = new Set([
  "existing-sufficient",
  "added-or-updated",
  "not-applicable",
  "omitted-with-reason",
  "blocked"
]);
const OBSERVABLE_RESULTS = new Set([
  "executed",
  "reproducible-handoff",
  "not-applicable",
  "blocked"
]);
const EXTERNAL_VERIFICATION_SOURCES = new Set(["collaborator", "interface", "uncovered-tool"]);
const LANGUAGES = new Set(["en", "es"]);
const DIGEST_VALUE = /^[a-f0-9]{64}$/;
const PLACEHOLDER_VALUES = new Set([
  "none",
  "unknown",
  "missing",
  "unconfigured",
  "not-configured",
  "stable-id"
]);
const INVALID_NO_RECORD_EXCEPTIONS = new Set([
  "same-session",
  "current-session",
  "no-configured-record",
  "no-configured-store",
  "missing-store",
  "not-configured"
]);
const FIELD_VALUE = /^[A-Za-z0-9][A-Za-z0-9._,:/+@-]{0,127}$/;
const BASIS_VALUE = /^[1-9][0-9]{0,8}$/;

function hash(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function hashOrNull(value) {
  return typeof value === "string" && value.length > 0 ? hash(value) : null;
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function boundedText(value, maximum = 1_200) {
  const text = String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return text.length <= maximum ? text : text.slice(0, maximum - 1) + "…";
}

function detectLanguage(prompt, fallback = "en") {
  if (typeof prompt !== "string" || prompt.length === 0) {
    return LANGUAGES.has(fallback) ? fallback : "en";
  }
  const sample = prompt.toLocaleLowerCase().slice(0, 4_000);
  const spanishWords = sample.match(/\b(?:el|la|los|las|un|una|que|como|para|por|con|sin|quiero|puedes|debe|deberia|revisa|haz|gracias|pero|ahora|esto|esta|tengo)\b/g)?.length || 0;
  const englishWords = sample.match(/\b(?:the|a|an|that|how|for|with|without|want|can|could|should|review|please|but|now|this|have)\b/g)?.length || 0;
  const spanishMarks = /[áéíóúñü¿¡]/.test(sample) ? 2 : 0;
  if (spanishWords + spanishMarks >= 2 && spanishWords + spanishMarks > englishWords) {
    return "es";
  }
  if (englishWords >= 2 && englishWords > spanishWords + spanishMarks) {
    return "en";
  }
  return LANGUAGES.has(fallback) ? fallback : "en";
}

function localize(state, english, spanish) {
  return state.language === "es" ? spanish : english;
}

function voice(state, _diagnosticCode, capability, english, spanish) {
  return capability + "\n" + localize(state, english, spanish);
}

function baseState() {
  return {
    schema_version: SCHEMA_VERSION,
    phase: "ORIENT",
    prompt_epoch: 0,
    current_turn_hash: null,
    language: "en",
    effort: null,
    basis: null,
    activity_hash: null,
    activity_transition: null,
    exception_hash: null,
    plan_digest: null,
    record_locator_hash: null,
    record_receipt_hash: null,
    checkpoint_epoch: null,
    checkpoint_kind: null,
    collaborator_epoch: null,
    collaborator_result: null,
    response_origin_phase: null,
    readiness: null,
    grant: null,
    pending_permit: null,
    pending_writes: [],
    reconciled_writes: [],
    mutation_count: 0,
    last_capture: null,
    last_verification: null,
    completion: null,
    stop_reminder_turn_hash: null,
    continuation_prompt_hash: null,
    event_seq: 0,
    events: []
  };
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state is not an object");
  }
  if (state.schema_version !== SCHEMA_VERSION || !PHASES.has(state.phase)) {
    throw new Error("state schema or phase is unsupported");
  }
  if (!Number.isInteger(state.prompt_epoch) || state.prompt_epoch < 0) {
    throw new Error("state prompt epoch is invalid");
  }
  if (!Number.isInteger(state.event_seq) || state.event_seq < 0) {
    throw new Error("state sequence is invalid");
  }
  if (!Array.isArray(state.events) || state.events.length > MAX_EVENTS) {
    throw new Error("state event history is invalid");
  }
  if (!Array.isArray(state.pending_writes) || state.pending_writes.length > 32) {
    throw new Error("state pending writes are invalid");
  }
  if (!LANGUAGES.has(state.language || "en")) {
    throw new Error("state language is invalid");
  }
  state.language ||= "en";
  state.plan_digest ??= null;
  state.record_locator_hash ??= null;
  state.record_receipt_hash ??= null;
  state.collaborator_result ??= null;
  state.response_origin_phase ??= null;
  state.reconciled_writes ??= [];
  state.last_verification ??= null;
  if (!Array.isArray(state.reconciled_writes) || state.reconciled_writes.length > 32) {
    throw new Error("state reconciled writes are invalid");
  }
  return state;
}

function recordEvent(state, type, data = {}, now = Date.now()) {
  state.event_seq += 1;
  state.events.push({
    seq: state.event_seq,
    at_ms: now,
    type,
    phase: state.phase,
    data
  });
  if (state.events.length > MAX_EVENTS) {
    state.events = state.events.slice(-MAX_EVENTS);
  }
}

function resetForNewWork(state) {
  const promptEpoch = state.prompt_epoch;
  const currentTurnHash = state.current_turn_hash;
  const language = state.language;
  const events = state.events;
  const eventSeq = state.event_seq;
  Object.assign(state, baseState());
  state.prompt_epoch = promptEpoch;
  state.current_turn_hash = currentTurnHash;
  state.language = language;
  state.events = events;
  state.event_seq = eventSeq;
}

function hookContext(eventName, text) {
  return {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: boundedText(text)
    }
  };
}

function denyTool(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: boundedText(reason)
    }
  };
}

function rewriteControl(context) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: { command: NO_OP_COMMAND },
      additionalContext: boundedText(context)
    }
  };
}

function continueStop(reason) {
  return {
    decision: "block",
    reason: boundedText(reason)
  };
}

function warning(message) {
  return { systemMessage: boundedText(message) };
}

function stateCard(state) {
  if (state.phase === "ORIENT") {
    return voice(
      state,
      "101",
      "Please, Know the Work",
      "Resolve effort, activity, and continuity before material work. If identified work has no configured store, ask once for a preferred user-controlled location and propose the complete record, locator, delegation, privacy, retrieval check, and digest together. Then record pmnm-guard route effort=<light|standard|high> activity=<stable-id|none> transition=<state> basis=1.",
      "Resuelve esfuerzo, actividad y continuidad antes del trabajo material. Si una actividad identificada no tiene almacén configurado, pregunta una sola vez por una ubicación controlada por el usuario y propón juntos el registro completo, localizador, delegación, privacidad, prueba de recuperación y digest. Después registra pmnm-guard route effort=<light|standard|high> activity=<stable-id|none> transition=<state> basis=1."
    );
  }
  if (state.phase === "INVESTIGATE") {
    return voice(
      state,
      "201",
      "Please, Look Before You Change",
      "Test the strongest counterexample and use every relevant executable capability. Keep delegated records current. Before choosing a material direction, show one combined evidence checkpoint, record pmnm-guard checkpoint kind=<direction|combined|authority> basis=" + String(state.basis) + ", then wait without repeating the question.",
      "Prueba el contraejemplo más fuerte y usa cada capacidad ejecutable relevante. Mantén actualizado cualquier registro delegado. Antes de elegir una dirección material, muestra un solo checkpoint combinado, registra pmnm-guard checkpoint kind=<direction|combined|authority> basis=" + String(state.basis) + " y espera sin repetir la pregunta."
    );
  }
  if (state.phase === "AWAITING_COLLABORATOR") {
    return voice(
      state,
      "301",
      "Please, Align Before You Choose",
      "The checkpoint is waiting for the collaborator. Do not repeat it, answer it yourself, or mutate dependent work.",
      "El checkpoint espera al colaborador. No lo repitas, no lo respondas por tu cuenta y no modifiques trabajo dependiente."
    );
  }
  if (state.phase === "COLLABORATOR_RESPONDED") {
    return voice(
      state,
      "302",
      "Please, Check Our Understanding",
      "A later collaborator turn exists, but agreement is not inferred. Reconcile it with pmnm-guard align result=<accepted|changed|unclear|rejected> basis=<current-or-higher> before readiness or authority use.",
      "Existe un turno posterior del colaborador, pero no se infiere acuerdo. Reconcílialo con pmnm-guard align result=<accepted|changed|unclear|rejected> basis=<actual-o-superior> antes de readiness o de usar autoridad."
    );
  }
  if (state.phase === "ALIGNED") {
    return voice(
      state,
      "401",
      "Please, Guard the First Write",
      "Refresh delegated capture when needed. If the evidence is ready, show the concise receipt, then record pmnm-guard ready basis=" + String(state.basis) + " scope=<id> effects=implementation,verification verification=<id> capture=<current|not-applicable> alignment=current scenarios=<aligned|not-required> constraints=<id> capabilities=<id>.",
      "Actualiza la captura delegada cuando corresponda. Si la evidencia está lista, muestra el recibo breve y registra pmnm-guard ready basis=" + String(state.basis) + " scope=<id> effects=implementation,verification verification=<id> capture=<current|not-applicable> alignment=current scenarios=<aligned|not-required> constraints=<id> capabilities=<id>."
    );
  }
  if (state.phase === "READY") {
    return voice(state, "402", "Please, Make the Smallest Defensible Change", "Readiness is current for this prompt. Stay inside its declared scope and effects.", "Readiness está vigente para este turno. Mantente dentro del alcance y efectos declarados.");
  }
  if (state.phase === "IMPLEMENT") {
    return voice(state, "501", "Please, Prove It", "Verify the current implementation, preserve repeatable protection, reconcile delegated context, and audit before closing.", "Verifica la implementación actual, conserva protección repetible, reconcilia el contexto delegado y audita antes de cerrar.");
  }
  if (state.phase === "VERIFY") {
    return voice(state, "502", "Please, Check Your Work", "Finish the current verification, observable disposition, capture, protection, and audit before reporting completion.", "Completa la verificación vigente, disposición observable, captura, protección y auditoría antes de reportar el cierre.");
  }
  if (state.phase === "RECOVERY") {
    if (state.pending_writes.length > 0) {
      return voice(state, "601", "Please, Don't Guess What Happened", "A covered result is missing. Keep writes paused and record pmnm-guard reconcile outcome=<unknown|failed-no-effect> reason=<id> basis=<higher-basis>. Then inspect current state and continue recovery.", "Falta el resultado de una operación cubierta. Mantén las escrituras pausadas y registra pmnm-guard reconcile outcome=<unknown|failed-no-effect> reason=<id> basis=<base-superior>. Después inspecciona el estado actual y continúa la recuperación.");
    }
    return voice(state, "602", "Please, Stop and Reconcile", "The active basis changed. Show the corrected current state, record pmnm-guard checkpoint kind=combined basis=" + String(state.basis) + ", then wait for the collaborator.", "La base activa cambió. Muestra el estado actual corregido, registra pmnm-guard checkpoint kind=combined basis=" + String(state.basis) + " y espera al colaborador.");
  }
  if (state.phase === "BLOCKED") {
    return voice(state, "701", "Please, Ask Before You Rearrange", "Present the exact missing evidence or authority once. Bundle adjacent known decisions without merging their scopes, record pmnm-guard checkpoint kind=authority basis=" + String(state.basis) + ", then wait.", "Presenta una sola vez la evidencia o autoridad faltante. Agrupa decisiones adyacentes sin mezclar sus alcances, registra pmnm-guard checkpoint kind=authority basis=" + String(state.basis) + " y espera.");
  }
  if (state.phase === "COMPLETE" && state.completion) {
    return voice(state, "801", "Please, Say What Matters", "The recorded result is " + state.completion.status + ". Report that exact limit and the primary next action.", "El resultado registrado es " + state.completion.status + ". Reporta ese límite exacto y la siguiente acción principal.");
  }
  if (state.phase === "EXEMPT") {
    return voice(state, "901", "Please, Keep It Proportional", "The exemption applies only to this prompt and its declared effects.", "La excepción aplica sólo a este turno y a sus efectos declarados.");
  }
  return voice(state, "999", "Please, Make No Mistakes", "Current procedural state: " + state.phase + ".", "Estado procedimental actual: " + state.phase + ".");
}

function parseFields(tokens) {
  const fields = {};
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator <= 0 || separator === token.length - 1) {
      throw new Error("every control argument must be key=value");
    }
    const key = token.slice(0, separator);
    const value = token.slice(separator + 1);
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(key) || !FIELD_VALUE.test(value)) {
      throw new Error("control argument contains an unsupported key or value");
    }
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      throw new Error("control argument is duplicated: " + key);
    }
    fields[key] = value;
  }
  return fields;
}

function exactFields(fields, required, optional = []) {
  const actual = Object.keys(fields).sort();
  const permitted = new Set(required.concat(optional));
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(fields, key));
  const unknown = actual.filter((key) => !permitted.has(key));
  if (missing.length || unknown.length) {
    throw new Error(
      "control fields mismatch; missing=" +
        (missing.join(",") || "none") +
        " unknown=" +
        (unknown.join(",") || "none")
    );
  }
}

export function parseControlCommand(command) {
  if (typeof command !== "string" || Buffer.byteLength(command, "utf8") > MAX_CONTROL_BYTES) {
    return null;
  }
  if (!command.startsWith("pmnm-guard")) {
    return null;
  }
  if (/[\r\n\u0000]/.test(command)) {
    throw new Error("control command must be one line");
  }
  const tokens = command.trim().split(/ +/);
  if (tokens[0] !== "pmnm-guard" || tokens.length < 2) {
    throw new Error("control action is missing");
  }
  const action = tokens[1];
  if (!/^[a-z][a-z-]{0,31}$/.test(action)) {
    throw new Error("control action is invalid");
  }
  return { action, fields: parseFields(tokens.slice(2)) };
}

function parseEffects(value) {
  const effects = value.split(",");
  if (!effects.length || effects.some((effect) => !EFFECTS.has(effect))) {
    throw new Error("effects contain an unsupported class");
  }
  if (new Set(effects).size !== effects.length) {
    throw new Error("effects contain a duplicate class");
  }
  return effects.sort();
}

function currentPrompt(state, event) {
  return (
    state.prompt_epoch > 0 &&
    typeof event.turn_id === "string" &&
    state.current_turn_hash === hash(event.turn_id)
  );
}

function concreteValue(value) {
  return typeof value === "string" && !PLACEHOLDER_VALUES.has(value.toLowerCase());
}

function handleRoute(state, fields, event, now) {
  exactFields(
    fields,
    ["effort", "activity", "transition", "basis"],
    ["exception", "locator", "record", "authority", "digest"]
  );
  if (!EFFORTS.has(fields.effort) || !TRANSITIONS.has(fields.transition) || !BASIS_VALUE.test(fields.basis)) {
    throw new Error("route effort, transition, or basis is invalid");
  }
  if (fields.activity === "none" && fields.transition !== "not-applicable") {
    throw new Error("activity=none requires transition=not-applicable");
  }
  if (fields.activity !== "none" && fields.transition === "not-applicable") {
    throw new Error("an identified activity requires a durable transition result");
  }
  if (fields.activity !== "none" && !concreteValue(fields.activity)) {
    throw new Error("an identified activity requires a concrete non-placeholder identity");
  }
  const transitionFields = {
    "not-applicable": [],
    loaded: ["locator", "record", "authority"],
    created: ["locator", "record", "authority"],
    "no-record-with-valid-reason": ["exception", "authority"],
    "planned-and-awaiting-approval": ["digest"],
    blocked: []
  };
  const suppliedTransitionFields = ["exception", "locator", "record", "authority", "digest"].filter(
    (field) => fields[field]
  );
  if (suppliedTransitionFields.some((field) => !transitionFields[fields.transition].includes(field))) {
    throw new Error("route fields do not match the selected activity transition");
  }
  if (fields.transition === "loaded") {
    if (!concreteValue(fields.locator) || !concreteValue(fields.record)) {
      throw new Error("loaded requires concrete locator=<receipt> and record=<receipt>");
    }
    if (
      state.activity_transition === "planned-and-awaiting-approval" &&
      state.phase === "ALIGNED" &&
      (!DIGEST_VALUE.test(fields.authority || "") || fields.authority !== state.plan_digest)
    ) {
      throw new Error("loaded after an approved plan requires the matching plan digest");
    }
  }
  if (fields.transition === "planned-and-awaiting-approval" && !DIGEST_VALUE.test(fields.digest || "")) {
    throw new Error("planned-and-awaiting-approval requires an exact lowercase SHA-256 digest");
  }
  if (fields.transition === "created") {
    if (!concreteValue(fields.locator) || !concreteValue(fields.record)) {
      throw new Error("created requires concrete locator=<receipt> and record=<receipt>");
    }
    if (!DIGEST_VALUE.test(fields.authority || "") || fields.authority !== state.plan_digest) {
      throw new Error("created requires authority=<approved-plan-digest> matching the pending plan");
    }
  }
  if (fields.transition === "no-record-with-valid-reason") {
    if (!concreteValue(fields.exception) || INVALID_NO_RECORD_EXCEPTIONS.has(fields.exception.toLowerCase())) {
      throw new Error("no-record requires a material exception; a missing store or same session is not one");
    }
    if (
      fields.effort !== "light" &&
      !(
        concreteValue(fields.authority) &&
        state.phase === "ALIGNED" &&
        state.collaborator_result === "accepted" &&
        ["planned-and-awaiting-approval", "blocked"].includes(state.activity_transition)
      )
    ) {
      throw new Error("Standard or High no-record requires a later explicit collaborator decision");
    }
  }
  const nextBasis = Number(fields.basis);
  const nextActivityHash = fields.activity === "none" ? null : hash(fields.activity);
  if (!["ORIENT", "INVESTIGATE", "ALIGNED", "BLOCKED", "COMPLETE"].includes(state.phase)) {
    throw new Error("activity routing cannot bypass the current " + state.phase + " transition");
  }
  if (state.pending_writes.length > 0) {
    throw new Error("an activity route cannot change while a covered write is in flight");
  }
  const startsAfterClosure = state.phase === "COMPLETE";
  const activityChanged =
    state.basis !== null && state.activity_hash !== nextActivityHash;
  if (
    activityChanged &&
    state.mutation_count > 0 &&
    state.phase !== "COMPLETE"
  ) {
    throw new Error("the current activity requires a closing disposition before switching activity");
  }
  const continuesCurrentActivity =
    state.basis !== null && !startsAfterClosure && !activityChanged;
  if (
    continuesCurrentActivity &&
    state.effort &&
    EFFORT_ORDER[fields.effort] < EFFORT_ORDER[state.effort]
  ) {
    throw new Error("effort cannot be lowered inside the current activity lifecycle");
  }
  if (continuesCurrentActivity && nextBasis < state.basis) {
    throw new Error("route basis cannot move backward inside the current activity lifecycle");
  }
  const preservesApprovedTransition =
    state.phase === "ALIGNED" &&
    state.collaborator_result === "accepted" &&
    state.effort === fields.effort &&
    state.basis === nextBasis &&
    state.activity_hash === nextActivityHash &&
    ((state.activity_transition === "planned-and-awaiting-approval" &&
      ["created", "loaded"].includes(fields.transition)) ||
      (["planned-and-awaiting-approval", "blocked"].includes(state.activity_transition) &&
        fields.transition === "no-record-with-valid-reason"));
  const preservedCheckpointEpoch = state.checkpoint_epoch;
  const preservedCheckpointKind = state.checkpoint_kind;
  const preservedCollaboratorEpoch = state.collaborator_epoch;
  const preservedCollaboratorResult = state.collaborator_result;
  state.effort = fields.effort;
  state.basis = nextBasis;
  state.activity_hash = nextActivityHash;
  state.activity_transition = fields.transition;
  state.exception_hash = hashOrNull(fields.exception);
  state.plan_digest = fields.transition === "planned-and-awaiting-approval"
    ? fields.digest
    : preservesApprovedTransition && ["created", "loaded"].includes(fields.transition)
      ? state.plan_digest
      : null;
  state.record_locator_hash = hashOrNull(fields.locator);
  state.record_receipt_hash = hashOrNull(fields.record);
  state.checkpoint_epoch = preservesApprovedTransition ? preservedCheckpointEpoch : null;
  state.checkpoint_kind = preservesApprovedTransition ? preservedCheckpointKind : null;
  state.collaborator_epoch = preservesApprovedTransition ? preservedCollaboratorEpoch : null;
  state.collaborator_result = preservesApprovedTransition ? preservedCollaboratorResult : null;
  state.response_origin_phase = null;
  state.readiness = null;
  state.grant = null;
  state.pending_permit = null;
  state.last_capture = null;
  state.last_verification = null;
  state.completion = null;
  if (startsAfterClosure) {
    state.mutation_count = 0;
  }
  state.stop_reminder_turn_hash = null;
  state.continuation_prompt_hash = null;
  state.phase = preservesApprovedTransition
    ? "ALIGNED"
    : fields.transition === "planned-and-awaiting-approval" || fields.transition === "blocked"
      ? "BLOCKED"
      : "INVESTIGATE";
  recordEvent(
    state,
    "route",
    {
      effort: state.effort,
      identified_activity: Boolean(state.activity_hash),
      transition: state.activity_transition,
      basis: state.basis,
      activity_changed: activityChanged,
      after_closure: startsAfterClosure
    },
    now
  );
  return stateCard(state);
}

function handleCheckpoint(state, fields, now) {
  exactFields(fields, ["kind", "basis"]);
  if (!CHECKPOINT_KINDS.has(fields.kind) || !BASIS_VALUE.test(fields.basis)) {
    throw new Error("checkpoint kind or basis is invalid");
  }
  if (Number(fields.basis) !== state.basis) {
    throw new Error("checkpoint basis does not match the current route");
  }
  if (state.pending_writes.length > 0) {
    throw new Error("checkpoint cannot be recorded while a covered write is in flight");
  }
  if (!["INVESTIGATE", "BLOCKED", "RECOVERY", "ALIGNED"].includes(state.phase)) {
    throw new Error("checkpoint is not valid from phase " + state.phase);
  }
  state.phase = "AWAITING_COLLABORATOR";
  state.checkpoint_epoch = state.prompt_epoch;
  state.checkpoint_kind = fields.kind;
  state.collaborator_epoch = null;
  state.collaborator_result = null;
  state.response_origin_phase = null;
  state.readiness = null;
  state.grant = null;
  recordEvent(state, "checkpoint", { kind: fields.kind, basis: state.basis }, now);
  return stateCard(state);
}

function handleAlign(state, fields, event, now) {
  exactFields(fields, ["result", "basis"]);
  if (!COLLABORATOR_RESULTS.has(fields.result) || !BASIS_VALUE.test(fields.basis)) {
    throw new Error("collaborator result or basis is invalid");
  }
  if (
    state.phase !== "COLLABORATOR_RESPONDED" ||
    state.collaborator_epoch !== state.prompt_epoch ||
    !currentPrompt(state, event)
  ) {
    throw new Error("alignment requires the current later collaborator turn");
  }
  const nextBasis = Number(fields.basis);
  if (fields.result === "accepted") {
    if (nextBasis !== state.basis) {
      throw new Error("accepted alignment must preserve the current basis");
    }
    state.phase = ["IMPLEMENT", "VERIFY"].includes(state.response_origin_phase)
      ? "VERIFY"
      : "ALIGNED";
  } else {
    if (nextBasis <= state.basis) {
      throw new Error("changed, unclear, or rejected alignment requires a higher basis");
    }
    state.basis = nextBasis;
    state.phase =
      fields.result === "rejected" || ["IMPLEMENT", "VERIFY"].includes(state.response_origin_phase)
        ? "RECOVERY"
        : "INVESTIGATE";
    state.checkpoint_epoch = null;
    state.checkpoint_kind = null;
    state.readiness = null;
    state.grant = null;
    state.last_capture = null;
    state.last_verification = null;
  }
  state.collaborator_result = fields.result;
  state.response_origin_phase = null;
  recordEvent(state, "collaborator-response-reconciled", { result: fields.result, basis: state.basis }, now);
  return stateCard(state);
}

function handleReady(state, fields, event, now) {
  exactFields(
    fields,
    [
      "basis",
      "scope",
      "effects",
      "verification",
      "capture",
      "alignment",
      "scenarios",
      "constraints",
      "capabilities"
    ],
    ["delegation"]
  );
  if (!BASIS_VALUE.test(fields.basis) || Number(fields.basis) !== state.basis) {
    throw new Error("readiness basis does not match the current route");
  }
  if (state.pending_writes.length > 0) {
    throw new Error("readiness cannot be recorded while a covered write is in flight");
  }
  const effects = parseEffects(fields.effects);
  if (!effects.includes("implementation")) {
    throw new Error("readiness must explicitly include implementation");
  }
  if (effects.some((effect) => !READINESS_EFFECTS.has(effect))) {
    throw new Error("readiness cannot absorb an independently authorized effect class");
  }
  if (!CAPTURE_READINESS.has(fields.capture)) {
    throw new Error("readiness capture state is invalid");
  }
  const delegatedActivity = ["loaded", "created"].includes(state.activity_transition);
  if (delegatedActivity) {
    if (
      fields.capture !== "current" ||
      !state.last_capture ||
      state.last_capture.basis !== state.basis ||
      state.last_capture.mutation_count !== state.mutation_count
    ) {
      throw new Error("delegated readiness requires an observed current durable capture");
    }
  } else if (fields.capture !== "not-applicable") {
    throw new Error("capture=current requires a loaded or created delegated activity");
  }
  if (!ALIGNMENT_RESULTS.has(fields.alignment) || !SCENARIO_RESULTS.has(fields.scenarios)) {
    throw new Error("readiness alignment or scenario state is invalid");
  }
  if (state.activity_transition === "planned-and-awaiting-approval" || state.activity_transition === "blocked") {
    throw new Error("the activity transition still blocks readiness");
  }
  if (!currentPrompt(state, event)) {
    throw new Error("readiness is not bound to the current user turn");
  }
  const currentAlignment =
    state.phase === "ALIGNED" &&
    state.collaborator_epoch === state.prompt_epoch &&
    state.collaborator_result === "accepted" &&
    ["direction", "combined"].includes(state.checkpoint_kind) &&
    fields.alignment === "current";
  const delegatedAlignment =
    state.phase === "INVESTIGATE" &&
    fields.alignment === "delegated" &&
    fields.delegation;
  const proportionalLight =
    state.effort === "light" &&
    ["INVESTIGATE", "ALIGNED"].includes(state.phase) &&
    fields.alignment === "not-required";
  if (!currentAlignment && !delegatedAlignment && !proportionalLight) {
    throw new Error(
      "readiness requires a later collaborator turn, a declared scope-specific delegation, or a Light not-required basis"
    );
  }
  if (fields.alignment === "delegated" !== Boolean(fields.delegation)) {
    throw new Error("delegated alignment and delegation must appear together");
  }
  if (fields.scenarios === "delegated" && fields.alignment !== "delegated") {
    throw new Error("delegated scenarios require the same scope-specific delegation basis");
  }
  if (fields.alignment === "delegated" && fields.scenarios === "aligned") {
    throw new Error("current scenario alignment requires a current combined checkpoint");
  }
  if (fields.alignment === "not-required" && fields.scenarios !== "not-required") {
    throw new Error("not-required alignment cannot assert aligned or delegated scenarios");
  }
  if (
    fields.alignment === "current" &&
    fields.scenarios === "aligned" &&
    state.checkpoint_kind !== "combined"
  ) {
    throw new Error("current scenario alignment requires a combined checkpoint");
  }
  if (state.effort !== "light" && fields.scenarios === "not-required" && fields.alignment === "not-required") {
    throw new Error("Standard or High readiness cannot omit both alignment and scenario basis");
  }
  state.phase = "READY";
  state.readiness = {
    prompt_epoch: state.prompt_epoch,
    turn_hash: hash(event.turn_id),
    scope_hash: hash(fields.scope),
    effects,
    verification_hash: hash(fields.verification),
    capture: fields.capture,
    alignment: fields.alignment,
    scenarios: fields.scenarios,
    constraints_hash: hash(fields.constraints),
    capabilities_hash: hash(fields.capabilities),
    delegation_hash: hashOrNull(fields.delegation)
  };
  state.grant = null;
  state.pending_permit = null;
  state.completion = null;
  state.stop_reminder_turn_hash = null;
  recordEvent(
    state,
    "readiness",
    {
      basis: state.basis,
      effects,
      capture: fields.capture,
      alignment: fields.alignment,
      scenarios: fields.scenarios,
      constraints_declared: true,
      capabilities_declared: true
    },
    now
  );
  return stateCard(state);
}

function handleExempt(state, fields, event, now) {
  exactFields(fields, ["reason", "effects"]);
  const effects = parseEffects(fields.effects);
  if (effects.some((effect) => !EXEMPT_EFFECTS.has(effect))) {
    throw new Error("exemption is limited to implementation or verification");
  }
  if (state.phase !== "ORIENT" || state.pending_writes.length > 0 || state.mutation_count > 0) {
    throw new Error("exemption is available only from a clean initial orientation");
  }
  if (!currentPrompt(state, event)) {
    throw new Error("exemption is not bound to a current user turn");
  }
  state.phase = "EXEMPT";
  state.readiness = {
    prompt_epoch: state.prompt_epoch,
    turn_hash: hash(event.turn_id),
    scope_hash: hash(fields.reason),
    effects,
    verification_hash: null,
    capture: "not-applicable",
    alignment: "not-required",
    scenarios: "not-required",
    delegation_hash: null
  };
  state.grant = null;
  state.pending_permit = null;
  state.completion = null;
  recordEvent(state, "exemption", { effects, reason_hash: hash(fields.reason) }, now);
  return stateCard(state);
}

function handleGrant(state, fields, event, now) {
  exactFields(fields, ["effect", "authority", "uses", "basis"]);
  if (
    !NON_IMPLEMENTATION_GRANTS.has(fields.effect) ||
    !BASIS_VALUE.test(fields.basis) ||
    Number(fields.basis) !== state.basis
  ) {
    throw new Error("grant effect or basis is invalid");
  }
  const uses = Number(fields.uses);
  if (!Number.isInteger(uses) || uses < 1 || uses > 20 || !currentPrompt(state, event)) {
    throw new Error("grant uses or user-turn binding is invalid");
  }
  if (
    SENSITIVE_GRANTS.has(fields.effect) &&
    !(
      state.phase === "ALIGNED" &&
      state.collaborator_epoch === state.prompt_epoch &&
      state.collaborator_result === "accepted" &&
      state.checkpoint_kind &&
      ["authority", "combined"].includes(state.checkpoint_kind)
    )
  ) {
    throw new Error("this effect requires a later collaborator turn after an authority checkpoint");
  }
  if (
    fields.effect === "durable-content" &&
    !["loaded", "created"].includes(state.activity_transition)
  ) {
    throw new Error("durable content requires a loaded or created delegated activity");
  }
  state.grant = {
    effect: fields.effect,
    authority_hash: hash(fields.authority),
    prompt_epoch: state.prompt_epoch,
    turn_hash: hash(event.turn_id),
    uses,
    command_hash: null
  };
  recordEvent(state, "effect-grant", { effect: fields.effect, uses }, now);
  return voice(
    state,
    "410",
    "Please, Respect the Boundary",
    "Recorded " + fields.effect + " for " + String(uses) + " covered call(s) in this prompt. Native host authority remains separate.",
    "Se registró " + fields.effect + " para " + String(uses) + " operación(es) cubiertas en este turno. La autoridad nativa del host sigue separada."
  );
}

function handlePermit(state, fields, event, now) {
  exactFields(fields, ["token", "effect"]);
  const pending = state.pending_permit;
  if (
    !pending ||
    fields.token !== pending.token ||
    !pending.allowed_effects.includes(fields.effect) ||
    pending.prompt_epoch !== state.prompt_epoch ||
    !currentPrompt(state, event)
  ) {
    throw new Error("permit token is absent, stale, or incompatible with the declared effect");
  }
  state.grant = {
    effect: fields.effect,
    authority_hash: hash("self-classified-command-bound"),
    prompt_epoch: state.prompt_epoch,
    turn_hash: hash(event.turn_id),
    uses: 1,
    command_hash: pending.command_hash
  };
  state.pending_permit = null;
  recordEvent(state, "command-permit", { effect: fields.effect }, now);
  return voice(state, "411", "Please, Name the Effect", "Recorded one " + fields.effect + " classification. Retry only the identical command.", "Se registró una clasificación " + fields.effect + ". Reintenta únicamente el comando idéntico.");
}

function handleInvalidate(state, fields, now) {
  exactFields(fields, ["reason", "basis"]);
  if (
    state.basis === null ||
    !BASIS_VALUE.test(fields.basis) ||
    Number(fields.basis) <= state.basis
  ) {
    throw new Error("invalidation requires a higher positive basis revision");
  }
  if (state.pending_writes.length > 0) {
    throw new Error("invalidation must wait for covered writes already in flight");
  }
  state.basis = Number(fields.basis);
  state.phase = "RECOVERY";
  state.readiness = null;
  state.grant = null;
  state.pending_permit = null;
  state.last_capture = null;
  state.last_verification = null;
  state.completion = null;
  state.collaborator_epoch = null;
  state.collaborator_result = null;
  state.response_origin_phase = null;
  recordEvent(state, "invalidation", { basis: state.basis, reason_hash: hash(fields.reason) }, now);
  return stateCard(state);
}

function handleReconcile(state, fields, now) {
  exactFields(fields, ["outcome", "reason", "basis"]);
  if (!RECONCILE_OUTCOMES.has(fields.outcome) || !BASIS_VALUE.test(fields.basis)) {
    throw new Error("reconciliation outcome or basis is invalid");
  }
  if (state.pending_writes.length === 0) {
    throw new Error("there is no covered result awaiting reconciliation");
  }
  const nextBasis = Number(fields.basis);
  if (state.basis !== null && nextBasis <= state.basis) {
    throw new Error("reconciliation requires a higher basis revision");
  }
  const pending = state.pending_writes.splice(0);
  let possibleMutations = 0;
  for (const entry of pending) {
    if (fields.outcome === "unknown" && entry.effect === "implementation") {
      possibleMutations += 1;
    }
    state.reconciled_writes.push({
      id_hash: entry.id_hash,
      effect: entry.effect,
      outcome: fields.outcome,
      basis: nextBasis,
      at_ms: now,
      late_observed: false
    });
  }
  state.reconciled_writes = state.reconciled_writes.slice(-32);
  state.mutation_count += possibleMutations;
  state.basis = nextBasis;
  state.phase = "RECOVERY";
  state.readiness = null;
  state.grant = null;
  state.pending_permit = null;
  state.last_capture = null;
  state.last_verification = null;
  state.completion = null;
  state.collaborator_epoch = null;
  state.collaborator_result = null;
  state.response_origin_phase = null;
  recordEvent(
    state,
    "covered-results-reconciled",
    {
      outcome: fields.outcome,
      count: pending.length,
      possible_mutations: possibleMutations,
      basis: state.basis,
      reason_hash: hash(fields.reason)
    },
    now
  );
  return stateCard(state);
}

function handleVerify(state, fields, event, now) {
  exactFields(fields, ["basis", "result", "source", "scope"]);
  if (
    !BASIS_VALUE.test(fields.basis) ||
    Number(fields.basis) !== state.basis ||
    !VERIFICATION_OBSERVATIONS.has(fields.result) ||
    !EXTERNAL_VERIFICATION_SOURCES.has(fields.source)
  ) {
    throw new Error("external verification receipt is invalid");
  }
  if (!currentPrompt(state, event) || !["IMPLEMENT", "VERIFY"].includes(state.phase)) {
    throw new Error("external verification requires current implemented work");
  }
  if (state.pending_writes.length > 0) {
    throw new Error("verification cannot be recorded while a covered result is in flight");
  }
  state.phase = "VERIFY";
  state.last_verification = {
    basis: state.basis,
    mutation_count: state.mutation_count,
    result: fields.result,
    source: fields.source,
    scope_hash: hash(fields.scope),
    event_seq: state.event_seq
  };
  recordEvent(
    state,
    "external-verification-recorded",
    { result: fields.result, source: fields.source, basis: state.basis },
    now
  );
  return stateCard(state);
}

function handleComplete(state, fields, now) {
  exactFields(fields, ["basis", "verification", "observable", "protection", "capture", "audit"]);
  if (!BASIS_VALUE.test(fields.basis) || Number(fields.basis) !== state.basis) {
    throw new Error("completion basis does not match current work");
  }
  if (state.pending_writes.length > 0) {
    throw new Error("completion cannot be recorded while a covered write is in flight");
  }
  if (
    !VERIFICATION_RESULTS.has(fields.verification) ||
    !OBSERVABLE_RESULTS.has(fields.observable) ||
    !PROTECTION_RESULTS.has(fields.protection) ||
    !CAPTURE_RESULTS.has(fields.capture) ||
    !AUDIT_RESULTS.has(fields.audit)
  ) {
    throw new Error("completion contains an unsupported disposition");
  }
  if (state.mutation_count < 1 || !["IMPLEMENT", "VERIFY"].includes(state.phase)) {
    throw new Error("completion requires an observed covered implementation call");
  }
  const currentVerification =
    state.last_verification &&
    state.last_verification.basis === state.basis &&
    state.last_verification.mutation_count === state.mutation_count;
  if (
    fields.verification === "passed" &&
    (!currentVerification || state.last_verification.result !== "passed")
  ) {
    throw new Error("verification=passed requires current successful evidence after the latest mutation");
  }
  if (fields.verification === "passed" && fields.observable !== "executed") {
    throw new Error("verification=passed requires observable=executed");
  }
  if (fields.observable === "reproducible-handoff" && fields.verification === "passed") {
    throw new Error("a reproducible handoff is not executed verification");
  }
  if (fields.observable === "blocked" && fields.verification !== "blocked") {
    throw new Error("observable=blocked requires verification=blocked");
  }
  if (fields.capture === "incomplete") {
    throw new Error("capture-incomplete cannot close the activity");
  }
  const delegatedActivity = ["loaded", "created"].includes(state.activity_transition);
  if (delegatedActivity) {
    if (
      fields.capture !== "complete" ||
      !state.last_capture ||
      state.last_capture.basis !== state.basis ||
      state.last_capture.mutation_count !== state.mutation_count
    ) {
      throw new Error("delegated completion requires an observed capture after the latest mutation");
    }
  } else if (fields.capture !== "not-applicable") {
    throw new Error("capture=complete requires a loaded or created delegated activity");
  }
  const completed =
    fields.verification === "passed" &&
    fields.audit === "passed" &&
    fields.protection !== "blocked";
  const blocked =
    fields.verification === "blocked" ||
    fields.audit === "blocked" ||
    fields.protection === "blocked";
  state.phase = "COMPLETE";
  state.completion = {
    status: completed ? "completed" : blocked ? "blocked" : "partial",
    verification: fields.verification,
    observable: fields.observable,
    protection: fields.protection,
    capture: fields.capture,
    audit: fields.audit
  };
  state.grant = null;
  state.pending_permit = null;
  state.continuation_prompt_hash = null;
  recordEvent(state, "completion", state.completion, now);
  return stateCard(state);
}

function controlTransition(state, control, event, now) {
  if (!currentPrompt(state, event) && control.action !== "status") {
    throw new Error("control transition requires a current UserPromptSubmit turn");
  }
  if (control.action === "route") {
    return handleRoute(state, control.fields, event, now);
  }
  if (control.action === "checkpoint") {
    return handleCheckpoint(state, control.fields, now);
  }
  if (control.action === "align") {
    return handleAlign(state, control.fields, event, now);
  }
  if (control.action === "ready") {
    return handleReady(state, control.fields, event, now);
  }
  if (control.action === "exempt") {
    return handleExempt(state, control.fields, event, now);
  }
  if (control.action === "grant") {
    return handleGrant(state, control.fields, event, now);
  }
  if (control.action === "permit") {
    return handlePermit(state, control.fields, event, now);
  }
  if (control.action === "invalidate") {
    return handleInvalidate(state, control.fields, now);
  }
  if (control.action === "reconcile") {
    return handleReconcile(state, control.fields, now);
  }
  if (control.action === "verify") {
    return handleVerify(state, control.fields, event, now);
  }
  if (control.action === "complete") {
    return handleComplete(state, control.fields, now);
  }
  if (control.action === "status") {
    exactFields(control.fields, []);
    return stateCard(state);
  }
  throw new Error("unsupported control action: " + control.action);
}

function firstCommandWord(segment) {
  const trimmed = segment.trim().replace(/^\s*(?:[A-Za-z_][A-Za-z0-9_]*=[^ ]+\s+)*/, "");
  return trimmed.split(/\s+/, 1)[0] || "";
}

function safeGit(segment) {
  const match = segment.trim().match(/^git\s+([a-z-]+)(?:\s|$)/);
  if (!match) {
    return false;
  }
  const operation = match[1];
  if (["status", "diff", "log", "show", "rev-parse", "ls-files", "grep", "blame"].includes(operation)) {
    return true;
  }
  if (operation === "remote") {
    return /^git\s+remote\s+(?:-v|get-url)(?:\s|$)/.test(segment.trim());
  }
  if (operation === "branch") {
    return /^git\s+branch(?:\s+(?:--show-current|--list|-a|-r|-v|-vv))*\s*$/.test(segment.trim());
  }
  return false;
}

function safePackageQuery(segment) {
  return /^(?:npm|yarn|pnpm|bun)\s+(?:--version|-v|view|info|why|list|ls|help)(?:\s|$)/.test(
    segment.trim()
  );
}

export function classifyShell(command) {
  if (typeof command !== "string" || command.length === 0) {
    return { kind: "read", effect: null, reason: "empty" };
  }
  const normalized = command.trim();
  const definitePatterns = [
    { re: /(^|[;&|]\s*)(?:rm|rmdir|unlink|truncate)\b/, effect: "deletion" },
    { re: /(^|[;&|]\s*)(?:mv|cp)\b/, effect: "movement" },
    { re: /(^|[;&|]\s*)(?:mkdir|touch|install|chmod|chown|ln|dd|patch)\b/, effect: "structure" },
    { re: /\bgit\s+(?:add|commit|push|tag|checkout|switch|reset|rebase|merge|cherry-pick|revert|clean|stash|apply)\b/, effect: "version-control" },
    { re: /\b(?:npm|yarn|pnpm|bun)\s+(?:install|add|remove|uninstall|update|link)\b/, effect: "dependencies" },
    { re: /\b(?:npm|yarn|pnpm|bun)\s+publish\b/, effect: "publication" },
    { re: /\b(?:docker|podman)(?:\s+compose)?\s+(?:up|down|start|stop|restart|rm|build|run|exec)\b/, effect: "environment" },
    { re: /\b(?:kill|killall|launchctl|systemctl|service)\b/, effect: "environment" },
    { re: /\b(?:curl|wget)\b/, effect: "external" },
    { re: /\b(?:prettier\b[^\n]*--write|eslint\b[^\n]*--fix|gofmt\b[^\n]*-w|ruff\b[^\n]*(?:format|--fix)|black\b|rustfmt\b)/, effect: "implementation" },
    { re: /(^|\s)(?:apply_patch)(?:\s|$)/, effect: "implementation" },
    { re: /\byarn\s+(?:(?:--cwd\s+\S+|workspace\s+\S+)\s+)?(?:run\s+)?(?:test|lint|check|build|typecheck)\b/, effect: "verification" },
    { re: /\bnpm\s+(?:(?:--workspace|-w)\s+\S+\s+)*(?:test|run\s+(?:test|lint|check|build|typecheck))\b/, effect: "verification" },
    { re: /\bpnpm\s+(?:(?:--dir|--filter|-C)\s+\S+\s+)*(?:run\s+)?(?:test|lint|check|build|typecheck)\b/, effect: "verification" },
    { re: /\bbun\s+(?:(?:--cwd|--filter)\s+\S+\s+)*(?:run\s+)?(?:test|lint|check|build|typecheck)\b/, effect: "verification" },
    { re: /\b(?:npm|yarn|pnpm|bun)\s+(?:exec|x|dlx)\s+(?:eslint|prettier|vitest|jest|tsc|vue-tsc)\b/, effect: "verification" },
    { re: /(^|[;&|]\s*)(?:eslint|vitest|jest|tsc|vue-tsc)(?:\s|$)|\bprettier\b[^\n]*--check\b/, effect: "verification" },
    { re: /\b(?:pytest|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradle\s+test)\b/, effect: "verification" },
    { re: /(^|[^<])>{1,2}(?![=>])/, effect: "implementation" }
  ];
  for (const pattern of definitePatterns) {
    if (pattern.re.test(normalized)) {
      return { kind: "write", effect: pattern.effect, reason: "definite-pattern" };
    }
  }
  if (/[\r\n\u0000\x60]/.test(normalized) || /\$\(|<\(|>\(/.test(normalized)) {
    return { kind: "unknown", effect: null, reason: "compound-or-dynamic-shell" };
  }
  const segments = normalized.split(/\s*(?:&&|\|\||\||;)\s*/).filter(Boolean);
  const safeWords = new Set([
    "pwd",
    "ls",
    "rg",
    "grep",
    "egrep",
    "fgrep",
    "cat",
    "head",
    "tail",
    "wc",
    "stat",
    "file",
    "which",
    "where",
    "type",
    "date",
    "sort",
    "uniq",
    "cut",
    "tr",
    "diff",
    "cmp",
    "realpath",
    "readlink",
    "basename",
    "dirname",
    "jq",
    "test",
    "["
  ]);
  for (const segment of segments) {
    const word = firstCommandWord(segment);
    if (safeWords.has(word)) {
      continue;
    }
    if (word === "sed" && !/(^|\s)-(?:[^ ]*i|i[^ ]*)(?:\s|$)/.test(segment)) {
      continue;
    }
    if (word === "find" && !/\s-(?:delete|exec|execdir|ok|okdir)(?:\s|$)/.test(segment)) {
      continue;
    }
    if (word === "git" && safeGit(segment)) {
      continue;
    }
    if (safePackageQuery(segment)) {
      continue;
    }
    if (/^(?:node|python3?|ruby|perl)\s+(?:--version|-v)\s*$/.test(segment.trim())) {
      continue;
    }
    if (/^codex(?:\s+--version|\s+plugin\s+(?:list|marketplace\s+list)|\s+[^\n]*--help)\s*$/.test(segment.trim())) {
      continue;
    }
    return { kind: "unknown", effect: null, reason: "unclassified-command" };
  }
  return { kind: "read", effect: null, reason: "allowlisted-read" };
}

function consumeGrant(state, effect, commandHash, event) {
  const grant = state.grant;
  if (
    !grant ||
    grant.prompt_epoch !== state.prompt_epoch ||
    grant.turn_hash !== hash(event.turn_id) ||
    (
      grant.effect !== effect &&
      effect !== "ambiguous" &&
      !(effect === "structure" && grant.effect === "durable-structure")
    ) ||
    (grant.command_hash && grant.command_hash !== commandHash)
  ) {
    return null;
  }
  grant.uses -= 1;
  const grantedEffect = grant.effect;
  if (grant.uses <= 0) {
    state.grant = null;
  }
  return grantedEffect;
}

function readinessAllows(state, effect, event) {
  const readiness = state.readiness;
  return Boolean(
    readiness &&
      ["READY", "IMPLEMENT", "VERIFY"].includes(state.phase) &&
      readiness.prompt_epoch === state.prompt_epoch &&
      readiness.turn_hash === hash(event.turn_id) &&
      readiness.effects.includes(effect)
  );
}

function exemptionAllows(state, effect, event) {
  const readiness = state.readiness;
  return Boolean(
    readiness &&
      state.phase === "EXEMPT" &&
      readiness.prompt_epoch === state.prompt_epoch &&
      readiness.turn_hash === hash(event.turn_id) &&
      readiness.effects.includes(effect)
  );
}

function addPendingWrite(state, event, effect, now) {
  const idHash = hash(event.tool_use_id || "missing-tool-use-id");
  state.pending_writes.push({
    id_hash: idHash,
    effect,
    prompt_epoch: state.prompt_epoch,
    basis: state.basis,
    at_ms: now
  });
  if (effect === "implementation") {
    state.last_verification = null;
    recordEvent(state, "verification-invalidated", { cause: "implementation-started" }, now);
  }
  if (state.pending_writes.length > 32) {
    state.pending_writes = state.pending_writes.slice(-32);
  }
  recordEvent(
    state,
    "covered-write-allowed",
    { tool: event.tool_name, effect, tool_use_hash: idHash },
    now
  );
}

function handlePreToolUse(state, event, now, tokenFactory) {
  const command = event.tool_input && event.tool_input.command;
  if (typeof command !== "string") {
    return {
      state,
      output: denyTool(voice(state, "610", "Please, Name the Effect", "This covered input cannot be classified safely. No write was allowed.", "Esta entrada cubierta no puede clasificarse con seguridad. No se permitió ninguna escritura."))
    };
  }
  let control;
  try {
    control = parseControlCommand(command);
  } catch (error) {
    recordEvent(state, "control-rejected", { reason_hash: hash(error.message) }, now);
    return { state, output: denyTool(voice(state, "611", "Please, Check the Receipt", "The control receipt was rejected: " + error.message, "El recibo de control fue rechazado: " + error.message)) };
  }
  if (control) {
    try {
      const context = controlTransition(state, control, event, now);
      return { state, output: rewriteControl(context) };
    } catch (error) {
      recordEvent(state, "control-rejected", { reason_hash: hash(error.message) }, now);
      return {
        state,
        output: denyTool(voice(state, "612", "Please, Check the Receipt", "The control receipt was rejected: " + error.message + ". " + stateCard(state), "El recibo de control fue rechazado: " + error.message + ". " + stateCard(state)))
      };
    }
  }

  if (state.pending_writes.length > 0) {
    recordEvent(state, "covered-write-denied", { cause: "prior-result-pending" }, now);
    return {
      state,
      output: denyTool(
        voice(
          state,
          "601",
          "Please, Don't Guess What Happened",
          "One covered result is still missing. Do not start another write. Record pmnm-guard reconcile outcome=<unknown|failed-no-effect> reason=<id> basis=<higher-basis>, then inspect current state.",
          "Aún falta el resultado de una operación cubierta. No inicies otra escritura. Registra pmnm-guard reconcile outcome=<unknown|failed-no-effect> reason=<id> basis=<base-superior> y después inspecciona el estado actual."
        )
      )
    };
  }

  if (event.tool_name === "apply_patch") {
    const grantedPatchEffect = consumeGrant(state, "ambiguous", hash(command), event);
    if (grantedPatchEffect) {
      addPendingWrite(state, event, grantedPatchEffect, now);
      return { state, output: null };
    }
  }
  const classification =
    event.tool_name === "apply_patch"
      ? { kind: "write", effect: "implementation", reason: "apply-patch" }
      : classifyShell(command);
  if (classification.kind === "read") {
    return { state, output: null };
  }
  const commandHash = hash(command);
  if (classification.kind === "unknown") {
    const permitted = consumeGrant(state, "ambiguous", commandHash, event);
    if (permitted) {
      addPendingWrite(state, event, permitted, now);
      return { state, output: null };
    }
    if (!state.effort || state.phase === "ORIENT") {
      recordEvent(state, "unknown-shell-denied", { reason: classification.reason }, now);
      return {
        state,
        output: denyTool(
          voice(state, "613", "Please, Know the Work", "Classify the activity before this shell effect. " + stateCard(state), "Clasifica la actividad antes de este efecto de shell. " + stateCard(state))
        )
      };
    }
    const allowedEffects =
      state.readiness && ["READY", "IMPLEMENT"].includes(state.phase)
        ? state.readiness.effects
        : ["investigation", "verification"];
    const token = tokenFactory();
    state.pending_permit = {
      token,
      command_hash: commandHash,
      prompt_epoch: state.prompt_epoch,
      allowed_effects: allowedEffects
    };
    recordEvent(
      state,
      "unknown-shell-denied",
      { reason: classification.reason, allowed_effects: allowedEffects },
      now
    );
    return {
      state,
      output: denyTool(
        voice(state, "614", "Please, Name the Effect", "The shell effect is unclear. Classify the identical command once with " +
          "pmnm-guard permit token=" +
          token +
          " effect=<" +
          allowedEffects.join("|") +
          ">, then retry it unchanged. This receipt is procedural, not proof.", "El efecto del comando no es claro. Clasifica una vez el comando idéntico con pmnm-guard permit token=" + token + " effect=<" + allowedEffects.join("|") + "> y reinténtalo sin cambios. Este recibo es procedimental, no una prueba.")
      )
    };
  }

  const effect = classification.effect;
  const granted = consumeGrant(state, effect, commandHash, event);
  if (granted) {
    addPendingWrite(state, event, granted, now);
    return { state, output: null };
  }
  if (exemptionAllows(state, effect, event)) {
    addPendingWrite(state, event, "exempt-" + effect, now);
    return { state, output: null };
  }
  if (readinessAllows(state, effect, event)) {
    addPendingWrite(state, event, effect, now);
    return { state, output: null };
  }
  recordEvent(
    state,
    "covered-write-denied",
    { tool: event.tool_name, effect, phase: state.phase },
    now
  );
  let route = stateCard(state);
  if (effect !== "implementation") {
    route +=
      " If this is an independently authorized nonimplementation effect, record " +
      "pmnm-guard grant effect=" +
      effect +
      " authority=<short-id-or-digest> uses=<count> basis=" +
      String(state.basis || 1) +
      " before retrying.";
  }
  return {
    state,
    output: denyTool(voice(state, "615", "Please, Guard the First Write", "A covered " + effect + " write is not ready yet. " + route, "Una escritura cubierta de tipo " + effect + " todavía no está lista. " + route))
  };
}

function toolResultFailed(event) {
  if (event.tool_error) {
    return true;
  }
  const response = event.tool_response;
  if (response && typeof response === "object") {
    if (response.isError === true) {
      return true;
    }
    for (const field of ["exit_code", "exitCode", "statusCode"]) {
      if (typeof response[field] === "number" && response[field] !== 0) {
        return true;
      }
    }
    if (typeof response.status === "string" && /^(?:failed|error|blocked)$/i.test(response.status)) {
      return true;
    }
  }
  if (typeof response === "string") {
    return /(?:process exited with code|exit code:?|exit_code["']?\s*[:=])\s*[1-9][0-9]*|^(?:error|failed):/im.test(
      response.slice(0, 4_000)
    );
  }
  return false;
}

function handlePostToolUse(state, event, now) {
  const idHash = hash(event.tool_use_id || "missing-tool-use-id");
  const index = state.pending_writes.findIndex((entry) => entry.id_hash === idHash);
  if (index < 0) {
    const reconciled = state.reconciled_writes.find(
      (entry) => entry.id_hash === idHash && !entry.late_observed
    );
    if (!reconciled) {
      return { state, output: null };
    }
    reconciled.late_observed = true;
    const failed = toolResultFailed(event);
    let output = null;
    if (
      reconciled.outcome === "failed-no-effect" &&
      !failed &&
      reconciled.effect === "implementation"
    ) {
      state.mutation_count += 1;
      state.basis = state.basis === null ? 1 : state.basis + 1;
      state.phase = "RECOVERY";
      state.last_capture = null;
      state.last_verification = null;
      state.completion = null;
      output = hookContext(
        "PostToolUse",
        voice(
          state,
          "603",
          "Please, Recheck the Result",
          "A late host result contradicted failed-no-effect. Treat the implementation as changed, inspect current state, and reconcile basis " + String(state.basis) + ".",
          "Un resultado tardío del host contradijo failed-no-effect. Trata la implementación como modificada, inspecciona el estado actual y reconcilia la base " + String(state.basis) + "."
        )
      );
    }
    recordEvent(
      state,
      "late-covered-result-observed",
      { effect: reconciled.effect, failed, prior_outcome: reconciled.outcome, basis: state.basis },
      now
    );
    return { state, output };
  }
  const [pending] = state.pending_writes.splice(index, 1);
  const failed = toolResultFailed(event);
  recordEvent(
    state,
    "covered-write-observed",
    { tool: event.tool_name, effect: pending.effect, tool_use_hash: idHash, failed },
    now
  );
  if (pending.effect === "verification") {
    const stale = pending.prompt_epoch !== state.prompt_epoch || pending.basis !== state.basis;
    state.last_verification = stale
      ? null
      : {
          basis: state.basis,
          mutation_count: state.mutation_count,
          result: failed ? "failed" : "passed",
          source: "covered-tool",
          scope_hash: null,
          event_seq: state.event_seq
        };
    if (!stale && state.mutation_count > 0 && ["IMPLEMENT", "VERIFY"].includes(state.phase)) {
      state.phase = "VERIFY";
    }
    recordEvent(
      state,
      stale ? "verification-finished-stale" : "verification-observed",
      { result: failed ? "failed" : "passed", basis: state.basis },
      now
    );
  }
  if (pending.effect === "durable-content") {
    if (failed) {
      state.last_capture = null;
      recordEvent(state, "durable-capture-failed", { basis: state.basis }, now);
    } else if (
      pending.prompt_epoch !== state.prompt_epoch ||
      pending.basis !== state.basis
    ) {
      state.last_capture = null;
      recordEvent(state, "durable-capture-finished-stale", { basis: state.basis }, now);
    } else {
      state.last_capture = {
        basis: state.basis,
        mutation_count: state.mutation_count,
        event_seq: state.event_seq
      };
      recordEvent(
        state,
        "durable-capture-observed",
        { basis: state.basis, mutation_count: state.mutation_count },
        now
      );
    }
  }
  if (!pending.effect.startsWith("exempt-") && pending.effect === "implementation") {
    state.mutation_count += 1;
    const alreadyRecovering = state.phase === "RECOVERY";
    state.phase = alreadyRecovering || failed ? "RECOVERY" : "IMPLEMENT";
    state.completion = null;
    if (alreadyRecovering) {
      state.readiness = null;
      recordEvent(
        state,
        failed ? "covered-write-failed-during-recovery" : "covered-write-finished-during-recovery",
        { basis: state.basis },
        now
      );
    } else if (failed) {
      state.readiness = null;
      state.basis = state.basis === null ? 1 : state.basis + 1;
      recordEvent(
        state,
        "readiness-invalidated",
        { cause: "covered-write-failed-or-partial", basis: state.basis },
        now
      );
    }
  }
  if (
    pending.effect.startsWith("exempt-") &&
    pending.prompt_epoch !== state.prompt_epoch &&
    state.pending_writes.length === 0
  ) {
    resetForNewWork(state);
    recordEvent(state, "stale-exempt-write-reconciled", {}, now);
  }
  return { state, output: null };
}

function handleUserPrompt(state, event, now) {
  const promptHash = hash(typeof event.prompt === "string" ? event.prompt : "");
  if (state.continuation_prompt_hash && state.continuation_prompt_hash === promptHash) {
    state.current_turn_hash = hashOrNull(event.turn_id);
    state.continuation_prompt_hash = null;
    recordEvent(state, "guard-continuation", {}, now);
    return { state, output: hookContext("UserPromptSubmit", stateCard(state)) };
  }

  state.prompt_epoch += 1;
  state.current_turn_hash = hashOrNull(event.turn_id);
  state.language = detectLanguage(event.prompt, state.language);
  state.grant = null;
  state.pending_permit = null;
  state.stop_reminder_turn_hash = null;
  recordEvent(state, "user-prompt", { prompt_hash: promptHash, language: state.language }, now);

  if (["loaded", "created"].includes(state.activity_transition) && state.last_capture) {
    state.last_capture = null;
    recordEvent(state, "durable-capture-invalidated", { cause: "new-user-prompt" }, now);
  }

  const consequentialWriteInFlight = state.pending_writes.some(
    (entry) =>
      entry.effect === "implementation" || SENSITIVE_GRANTS.has(entry.effect)
  );
  if (consequentialWriteInFlight && state.phase !== "RECOVERY") {
    state.phase = "RECOVERY";
    state.readiness = null;
    state.completion = null;
    state.collaborator_epoch = null;
    state.collaborator_result = null;
    state.response_origin_phase = null;
    state.basis = state.basis === null ? 1 : state.basis + 1;
    recordEvent(
      state,
      "readiness-invalidated",
      { cause: "new-user-prompt-during-covered-write", basis: state.basis },
      now
    );
  } else if (
    state.phase === "AWAITING_COLLABORATOR" &&
    state.checkpoint_epoch !== null &&
    state.prompt_epoch > state.checkpoint_epoch
  ) {
    state.response_origin_phase = "AWAITING_COLLABORATOR";
    state.phase = "COLLABORATOR_RESPONDED";
    state.collaborator_epoch = state.prompt_epoch;
    recordEvent(state, "collaborator-turn-observed", { checkpoint_kind: state.checkpoint_kind }, now);
  } else if (state.phase === "COLLABORATOR_RESPONDED") {
    state.collaborator_epoch = state.prompt_epoch;
    state.collaborator_result = null;
    recordEvent(state, "additional-collaborator-turn-observed", {}, now);
  } else if (state.phase === "READY") {
    state.phase = "INVESTIGATE";
    state.readiness = null;
    recordEvent(state, "readiness-invalidated", { cause: "new-user-prompt" }, now);
  } else if (["IMPLEMENT", "VERIFY"].includes(state.phase)) {
    const priorPhase = state.phase;
    state.phase = "COLLABORATOR_RESPONDED";
    state.readiness = null;
    state.completion = null;
    state.collaborator_epoch = state.prompt_epoch;
    state.collaborator_result = null;
    state.response_origin_phase = priorPhase;
    recordEvent(
      state,
      "post-implementation-collaborator-turn-observed",
      { prior_phase: priorPhase, basis: state.basis },
      now
    );
  } else if (state.phase === "COMPLETE") {
    resetForNewWork(state);
    recordEvent(state, "new-work-boundary", {}, now);
  } else if (state.phase === "EXEMPT") {
    if (state.pending_writes.length === 0) {
      resetForNewWork(state);
      recordEvent(state, "new-work-boundary", {}, now);
    } else {
      recordEvent(state, "new-prompt-during-exempt-write", {}, now);
    }
  }
  return { state, output: hookContext("UserPromptSubmit", stateCard(state)) };
}

function handleStop(state, event, now) {
  if (state.pending_writes.length > 0 && state.phase !== "RECOVERY") {
    state.phase = "RECOVERY";
    state.readiness = null;
    state.completion = null;
    state.collaborator_epoch = null;
    state.collaborator_result = null;
    state.response_origin_phase = null;
    recordEvent(
      state,
      "stop-with-covered-result-pending",
      { pending_count: state.pending_writes.length, basis: state.basis },
      now
    );
  }
  if (state.phase === "COLLABORATOR_RESPONDED") {
    const turnHash = hashOrNull(event.turn_id);
    const reason = stateCard(state);
    if (event.stop_hook_active || state.stop_reminder_turn_hash === turnHash) {
      recordEvent(state, "stop-response-unreconciled-reported", {}, now);
      return {
        state,
        output: warning(
          voice(
            state,
            "303",
            "Please, Check Our Understanding",
            "The collaborator response is still unreconciled. The guard will not continue again automatically.",
            "La respuesta del colaborador sigue sin reconciliarse. El guard no continuará otra vez automáticamente."
          )
        )
      };
    }
    state.stop_reminder_turn_hash = turnHash;
    state.continuation_prompt_hash = hash(reason);
    recordEvent(state, "stop-response-unreconciled-continued", {}, now);
    return { state, output: continueStop(reason) };
  }
  if (state.phase === "RECOVERY") {
    const turnHash = hashOrNull(event.turn_id);
    const reason = state.pending_writes.length > 0
      ? voice(state, "601", "Please, Don't Guess What Happened", "A covered result is missing. Record pmnm-guard reconcile outcome=<unknown|failed-no-effect> reason=<id> basis=<higher-basis>, inspect current state, and keep dependent writes paused.", "Falta el resultado de una operación cubierta. Registra pmnm-guard reconcile outcome=<unknown|failed-no-effect> reason=<id> basis=<base-superior>, inspecciona el estado actual y mantén pausadas las escrituras dependientes.")
      : voice(state, "602", "Please, Stop and Reconcile", "Recovery is still open. Show the corrected current state, capture it when delegated, record pmnm-guard checkpoint kind=combined basis=" + String(state.basis) + ", and wait for the collaborator.", "La recuperación sigue abierta. Muestra el estado actual corregido, captúralo si está delegado, registra pmnm-guard checkpoint kind=combined basis=" + String(state.basis) + " y espera al colaborador.");
    if (event.stop_hook_active || state.stop_reminder_turn_hash === turnHash) {
      recordEvent(state, "stop-recovery-reported", {}, now);
      return {
        state,
        output: warning(voice(state, "604", "Please, Pause Here", "Recovery remains open. The guard will not continue again automatically: " + reason, "La recuperación sigue abierta. El guard no continuará otra vez automáticamente: " + reason))
      };
    }
    state.stop_reminder_turn_hash = turnHash;
    state.continuation_prompt_hash = hash(reason);
    recordEvent(state, "stop-recovery-continued", {}, now);
    return { state, output: continueStop(reason) };
  }
  if (["IMPLEMENT", "VERIFY"].includes(state.phase) && !state.completion) {
    const turnHash = hashOrNull(event.turn_id);
    const reason = voice(
      state,
      "503",
      "Please, Prove It",
      "The implementation has no closing disposition. Run the strongest accessible check. If execution belongs to the collaborator, provide the exact entry or URL when known, starting state, data, actions, expected observations, evidence, cleanup, and limits. Then capture delegated context, audit, and record pmnm-guard complete basis=" + String(state.basis) + " verification=<passed|partial|blocked> observable=<executed|reproducible-handoff|not-applicable|blocked> protection=<status> capture=<complete|not-applicable> audit=<passed|partial|blocked>.",
      "La implementación no tiene disposición de cierre. Ejecuta la comprobación accesible más fuerte. Si la ejecución corresponde al colaborador, entrega la entrada o URL exacta cuando se conozca, estado inicial, datos, acciones, observaciones esperadas, evidencia, limpieza y límites. Después captura el contexto delegado, audita y registra pmnm-guard complete basis=" + String(state.basis) + " verification=<passed|partial|blocked> observable=<executed|reproducible-handoff|not-applicable|blocked> protection=<status> capture=<complete|not-applicable> audit=<passed|partial|blocked>."
    );
    if (event.stop_hook_active || state.stop_reminder_turn_hash === turnHash) {
      recordEvent(state, "stop-incomplete-reported", {}, now);
      return {
        state,
        output: warning(voice(state, "504", "Please, Leave an Honest Handoff", "The result remains incomplete and the guard will not continue again automatically: " + reason, "El resultado sigue incompleto y el guard no continuará otra vez automáticamente: " + reason))
      };
    }
    state.phase = "VERIFY";
    state.stop_reminder_turn_hash = turnHash;
    state.continuation_prompt_hash = hash(reason);
    recordEvent(state, "stop-continued", {}, now);
    return { state, output: continueStop(reason) };
  }
  if (state.phase === "READY") {
    state.phase = "INVESTIGATE";
    state.readiness = null;
    recordEvent(state, "unused-readiness-expired", {}, now);
  }
  return { state, output: null };
}

function handleInterrupt(state, now) {
  const consequentialWriteInFlight = state.pending_writes.some(
    (entry) =>
      entry.effect === "implementation" || SENSITIVE_GRANTS.has(entry.effect)
  );
  if (consequentialWriteInFlight) {
    if (state.phase !== "RECOVERY") {
      state.phase = "RECOVERY";
      state.readiness = null;
      state.completion = null;
      state.collaborator_epoch = null;
      state.basis = state.basis === null ? 1 : state.basis + 1;
    }
    recordEvent(
      state,
      "interrupt-with-covered-write",
      { basis: state.basis, pending_count: state.pending_writes.length },
      now
    );
  } else if (state.phase === "READY") {
    state.phase = "INVESTIGATE";
    state.readiness = null;
    recordEvent(state, "interrupt-invalidation", { prior_phase: "READY" }, now);
  } else if (["IMPLEMENT", "VERIFY"].includes(state.phase)) {
    state.phase = "RECOVERY";
    state.readiness = null;
    state.completion = null;
    state.basis = state.basis === null ? 1 : state.basis + 1;
    recordEvent(state, "interrupt-invalidation", { prior_phase: "IMPLEMENT", basis: state.basis }, now);
  } else {
    recordEvent(state, "interrupt", {}, now);
  }
  return { state, output: null };
}

export function processEvent(stateInput, event, options = {}) {
  const state = validateState(structuredClone(stateInput));
  const now = options.now === undefined ? Date.now() : options.now;
  const tokenFactory =
    options.tokenFactory ||
    (() => crypto.randomBytes(8).toString("hex"));
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("hook event must be an object");
  }
  const eventName = event.hook_event_name;
  if (eventName === "SessionStart") {
    recordEvent(state, "session-start", { source: event.source || "unknown" }, now);
    return {
      state,
      output:
        event.source === "compact"
          ? hookContext("SessionStart", stateCard(state))
          : null
    };
  }
  if (eventName === "UserPromptSubmit") {
    return handleUserPrompt(state, event, now);
  }
  if (eventName === "PreToolUse") {
    return handlePreToolUse(state, event, now, tokenFactory);
  }
  if (eventName === "PostToolUse") {
    return handlePostToolUse(state, event, now);
  }
  if (eventName === "Stop") {
    return handleStop(state, event, now);
  }
  if (eventName === "Interrupt") {
    return handleInterrupt(state, now);
  }
  throw new Error("unsupported hook event: " + String(eventName));
}

function dataRoot(environment) {
  const value = environment.PLUGIN_DATA || environment.CLAUDE_PLUGIN_DATA;
  if (!value || typeof value !== "string") {
    throw new Error("PLUGIN_DATA is unavailable");
  }
  return path.resolve(value);
}

function statePaths(root, event) {
  const sessionId = typeof event.session_id === "string" ? event.session_id : "";
  const cwd = typeof event.cwd === "string" ? event.cwd : "";
  if (!sessionId || !cwd) {
    throw new Error("session_id and cwd are required");
  }
  const directory = path.join(root, "host-guard", "v1");
  const key = hash(sessionId + "\u0000" + path.resolve(cwd));
  return {
    directory,
    state: path.join(directory, key + ".json"),
    lock: path.join(directory, key + ".lock")
  };
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const metadata = fs.lstatSync(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("guard data directory is not a real directory");
  }
  try {
    fs.chmodSync(directory, 0o700);
  } catch {
    // Some host filesystems do not expose POSIX mode changes.
  }
}

function acquireLock(lockPath) {
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      return fs.openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if (!error || error.code !== "EEXIST") {
        throw error;
      }
      try {
        const lock = fs.lstatSync(lockPath);
        if (
          lock.isFile() &&
          !lock.isSymbolicLink() &&
          Date.now() - lock.mtimeMs > 30_000
        ) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (lockError) {
        if (!lockError || lockError.code !== "ENOENT") {
          throw lockError;
        }
      }
      wait(LOCK_DELAY_MS);
    }
  }
  throw new Error("guard state is busy");
}

function readState(statePath) {
  try {
    const metadata = fs.lstatSync(statePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_STATE_BYTES) {
      throw new Error("guard state file is unsafe or oversized");
    }
    return validateState(JSON.parse(fs.readFileSync(statePath, "utf8")));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return baseState();
    }
    throw error;
  }
}

function writeState(statePath, state) {
  const serialized = JSON.stringify(validateState(state));
  if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
    throw new Error("guard state exceeds its bounded size");
  }
  const temporary = statePath + "." + process.pid + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, statePath);
    try {
      fs.chmodSync(statePath, 0o600);
    } catch {
      // Some host filesystems do not expose POSIX mode changes.
    }
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function processPersistedEvent(event, options = {}) {
  const root = options.dataRoot || dataRoot(options.environment || process.env);
  const paths = statePaths(root, event);
  ensureDirectory(paths.directory);
  const lockDescriptor = acquireLock(paths.lock);
  try {
    const state = readState(paths.state);
    const result = processEvent(state, event, options);
    writeState(paths.state, result.state);
    return result.output;
  } finally {
    fs.closeSync(lockDescriptor);
    fs.unlinkSync(paths.lock);
  }
}

function emergencyOutput(event, error) {
  const fallbackState = baseState();
  fallbackState.language = detectLanguage(event && event.prompt, "en");
  const detail = boundedText(error && error.message ? error.message : String(error), 300);
  const message = voice(
    fallbackState,
    "990",
    "Please, Pause Safely",
    "The guard could not verify its procedural state, so covered writes remain paused. Inspect /hooks and the guard status before deciding how to continue. Detail: " + detail,
    "El guard no pudo verificar su estado procedimental, por lo que las escrituras cubiertas siguen pausadas. Revisa /hooks y el estado del guard antes de decidir cómo continuar. Detalle: " + detail
  );
  if (event && event.hook_event_name === "PreToolUse") {
    const command = event.tool_input && event.tool_input.command;
    const classification =
      event.tool_name === "Bash" && typeof command === "string"
        ? classifyShell(command)
        : { kind: "write" };
    return classification.kind === "read" ? warning(message) : denyTool(message);
  }
  return warning(message);
}

export function main(environment = process.env) {
  let raw;
  let event = null;
  try {
    raw = fs.readFileSync(0);
    if (raw.length > MAX_INPUT_BYTES) {
      throw new Error("hook input exceeds its bounded size");
    }
    event = JSON.parse(raw.toString("utf8"));
    const output = processPersistedEvent(event, { environment });
    if (output) {
      process.stdout.write(JSON.stringify(output));
    }
    return 0;
  } catch (error) {
    const output = emergencyOutput(event, error);
    process.stdout.write(JSON.stringify(output));
    return 0;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  process.exitCode = main();
}

export const testing = Object.freeze({
  baseState,
  hash,
  stateCard,
  validateState,
  NO_OP_COMMAND,
  MAX_EVENTS,
  SCHEMA_VERSION,
  modulePath: fileURLToPath(import.meta.url)
});
