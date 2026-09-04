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
const LOCK_WAIT_MS = 3_000;
const LOCK_DELAY_MS = 20;
const LOCK_STALE_MS = 6_000;
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
const FIELD_VALUE = /^(?!\.\.)[A-Za-z0-9.][A-Za-z0-9._,:/+@-]{0,127}$/;
const PARENT_TRAVERSAL = /(?:^|\/)\.\.(?:\/|$)/;
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
    pending_denied: null,
    pending_writes: [],
    reconciled_writes: [],
    mutation_count: 0,
    effect_count: 0,
    plan_required_operations: 0,
    plan_observed_operations: 0,
    pending_response: false,
    recovery_result: null,
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
  state.pending_denied ??= null;
  state.effect_count ??= 0;
  state.plan_required_operations ??= 0;
  state.plan_observed_operations ??= 0;
  state.pending_response ??= false;
  state.recovery_result ??= null;
  if (state.last_capture && typeof state.last_capture === "object") {
    state.last_capture.effect_count ??= 0;
  }
  if (state.last_verification && typeof state.last_verification === "object") {
    state.last_verification.effect_count ??= 0;
  }
  if (state.pending_denied && typeof state.pending_denied === "object") {
    state.pending_denied.in_flight ??= false;
  }
  if (!Array.isArray(state.reconciled_writes) || state.reconciled_writes.length > 32) {
    throw new Error("state reconciled writes are invalid");
  }
  if (!Number.isInteger(state.effect_count) || state.effect_count < 0) {
    throw new Error("state effect count is invalid");
  }
  if (
    !Number.isInteger(state.plan_required_operations) ||
    !Number.isInteger(state.plan_observed_operations) ||
    state.plan_required_operations < 0 ||
    state.plan_observed_operations < 0
  ) {
    throw new Error("state plan operation counters are invalid");
  }
  if (typeof state.pending_response !== "boolean") {
    throw new Error("state pending response flag is invalid");
  }
  if (state.recovery_result !== null && !["resolved", "unknown", "contradicted"].includes(state.recovery_result)) {
    throw new Error("state recovery result is invalid");
  }
  if (
    state.pending_denied !== null &&
    (typeof state.pending_denied !== "object" ||
      Array.isArray(state.pending_denied) ||
      !EFFECTS.has(state.pending_denied.effect) ||
      !Number.isInteger(state.pending_denied.denials))
  ) {
    throw new Error("state denied cursor is invalid");
  }
  return state;
}

function isDelegated(state) {
  return ["loaded", "created"].includes(state.activity_transition);
}

function captureCurrent(state) {
  return Boolean(
    state.last_capture &&
      state.last_capture.basis === state.basis &&
      state.last_capture.mutation_count === state.mutation_count &&
      state.last_capture.effect_count === state.effect_count
  );
}

function verificationCurrent(state) {
  return Boolean(
    state.last_verification &&
      state.last_verification.basis === state.basis &&
      state.last_verification.mutation_count === state.mutation_count &&
      state.last_verification.effect_count === state.effect_count
  );
}

function alignmentCurrent(state) {
  return (
    state.phase === "ALIGNED" &&
    state.collaborator_epoch === state.prompt_epoch &&
    state.collaborator_result === "accepted"
  );
}

function nonImplementationOpen(state) {
  return (
    state.mutation_count === 0 &&
    state.effect_count > 0 &&
    state.pending_writes.length === 0 &&
    !state.completion &&
    ["INVESTIGATE", "ALIGNED"].includes(state.phase)
  );
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

const CHANNEL_EN = " I send that line through my shell tool; PMNM intercepts it and runs no shell.";
const CHANNEL_ES = " Envío esa línea por mi herramienta de shell; PMNM la intercepta y no ejecuta ningún shell.";

function action(heading, en, es, command = null, wait = false) {
  return { heading, en, es, command, wait };
}

function planPending(state) {
  return (
    state.activity_transition === "planned-and-awaiting-approval" ||
    (state.activity_transition === "blocked" && Boolean(state.plan_digest))
  );
}

function planOperationsComplete(state) {
  return state.plan_required_operations >= 1 && state.plan_observed_operations >= state.plan_required_operations;
}

function readyLine(state) {
  const capture = isDelegated(state) ? "current" : "not-applicable";
  let alignment = "current";
  let scenarios = state.checkpoint_kind === "combined" ? "aligned" : "not-required";
  if (state.effort === "light" && !alignmentCurrent(state)) {
    alignment = "not-required";
    scenarios = "not-required";
  }
  return (
    "pmnm-guard ready basis=" + String(state.basis) +
    " scope=<scope-id> effects=implementation,verification verification=<verification-id> capture=" + capture +
    " alignment=" + alignment + " scenarios=" + scenarios +
    " constraints=<constraints-id> capabilities=<capabilities-id>"
  );
}

function grantLine(state, effect) {
  const authority =
    effect === "durable-structure" && state.plan_digest
      ? state.plan_digest
      : effect === "durable-content"
        ? "<delegation-id>"
        : "<authority-id>";
  const uses =
    effect === "durable-content" ? "1" : effect === "durable-structure" ? "<approved-operation-count>" : "<count>";
  return "pmnm-guard grant effect=" + effect + " authority=" + authority + " uses=" + uses + " basis=" + String(state.basis);
}

function checkpointLine(state, kind) {
  return "pmnm-guard checkpoint kind=" + kind + " basis=" + String(state.basis);
}

function alignLine(state) {
  return "pmnm-guard align result=<accepted|changed|unclear|rejected> basis=" + String(state.basis);
}

function createdRouteLine(state) {
  return (
    "pmnm-guard route effort=" + state.effort + " activity=<activity-id> transition=created basis=" + String(state.basis) +
    " locator=<locator-receipt> record=<record-receipt> authority=" + (state.plan_digest || "<plan-digest>")
  );
}

function progressText(state) {
  return {
    en: "I have observed " + String(state.plan_observed_operations) + " of " + String(state.plan_required_operations) + " approved operations.",
    es: "He observado " + String(state.plan_observed_operations) + " de " + String(state.plan_required_operations) + " operaciones aprobadas."
  };
}

function captureAction(state) {
  return action(
    "Please, Write It Down",
    "My delegated capture is not current, so I record the grant and update the activity record with one covered write before anything depends on it.",
    "Mi captura delegada no está vigente, así que registro la concesión y actualizo el registro de la actividad con una sola escritura cubierta antes de que algo dependa de ella.",
    grantLine(state, "durable-content")
  );
}

function structuralAction(state) {
  if (planOperationsComplete(state) && state.pending_writes.length === 0) {
    return action(
      "Please, Don't Lose the Thread",
      "Every approved structural operation is observed, so I now record the created transition with the locator and record I actually established.",
      "Todas las operaciones estructurales aprobadas están observadas, así que ahora registro la transición created con el localizador y el registro que realmente establecí.",
      createdRouteLine(state)
    );
  }
  if (state.grant && state.grant.effect === "durable-structure") {
    const progress = progressText(state);
    const pendingRetry = state.pending_denied && ["structure", "durable-structure"].includes(state.pending_denied.effect);
    return action(
      "Please, Ask Before You Rearrange",
      (pendingRetry
        ? "The structural grant is recorded, so I perform the exact denied operation unchanged under native host authority. "
        : "The structural grant is recorded, so I perform the next approved operation under native host authority. ") + progress.en,
      (pendingRetry
        ? "La concesión estructural está registrada, así que realizo la operación denegada exacta sin cambios bajo autoridad nativa del host. "
        : "La concesión estructural está registrada, así que realizo la siguiente operación aprobada bajo autoridad nativa del host. ") + progress.es
    );
  }
  if (["authority", "combined"].includes(state.checkpoint_kind)) {
    return action(
      "Please, Ask Before You Rearrange",
      "The plan is approved. I record the structural grant, apply only the approved operations under native host authority, and record created only after I observe them.",
      "El plan está aprobado. Registro la concesión estructural, aplico sólo las operaciones aprobadas bajo autoridad nativa del host y registro created sólo después de observarlas.",
      grantLine(state, "durable-structure")
    );
  }
  return action(
    "Please, Ask Before You Rearrange",
    "Creating the record still needs an authority checkpoint. I present the exact plan and its digest once, record the checkpoint, then wait.",
    "Crear el registro aún necesita un checkpoint de autoridad. Presento una vez el plan exacto y su digest, registro el checkpoint y espero.",
    checkpointLine(state, "authority"),
    true
  );
}

function closureAction(state) {
  if (!verificationCurrent(state)) {
    return action(
      "Please, Prove It",
      "I verify the current result with the strongest check I can reach: a covered check command, or the external result I record. A handoff stays partial, not passed.",
      "Verifico el resultado actual con la comprobación más fuerte que alcanzo: un comando de verificación cubierto o el resultado externo que registro. Un handoff queda parcial, no passed.",
      "pmnm-guard verify basis=" + String(state.basis) + " result=<passed|failed|partial|blocked> source=<collaborator|interface|uncovered-tool> scope=<scope-id>"
    );
  }
  if (isDelegated(state) && !captureCurrent(state)) {
    return captureAction(state);
  }
  const capture = isDelegated(state) ? "complete" : "not-applicable";
  const zeroEffects = state.mutation_count === 0 && state.effect_count === 0;
  const verification = zeroEffects ? "not-applicable" : "<passed|partial|blocked>";
  const observable = zeroEffects ? "not-applicable" : "<executed|reproducible-handoff|not-applicable|blocked>";
  const protection = zeroEffects ? "not-applicable" : "<existing-sufficient|added-or-updated|not-applicable|omitted-with-reason|blocked>";
  return action(
    "Please, Check Your Work",
    "I audit the complete final state, then I record the closing disposition with its real limits.",
    "Audito el estado final completo y después registro la disposición de cierre con sus límites reales.",
    "pmnm-guard complete basis=" + String(state.basis) + " verification=" + verification + " observable=" + observable +
      " protection=" + protection + " capture=" + capture + " audit=<passed|partial|blocked>"
  );
}

function phaseAction(state) {
  const basis = String(state.basis);
  switch (state.phase) {
    case "ORIENT":
      return action(
        "Please, Know the Work",
        "I resolve effort, activity, and continuity before material work. Without a configured store I ask once for a user-controlled location and propose the full bootstrap with its digest. I record only the transition I established: loaded needs locator and record, planned needs digest=<sha256>, none needs not-applicable.",
        "Resuelvo esfuerzo, actividad y continuidad antes del trabajo material. Sin almacén pregunto una vez la ubicación del usuario y propongo el bootstrap completo con su digest. Registro sólo la transición que establecí: loaded necesita locator y record, planned necesita digest=<sha256>, none va con not-applicable.",
        "pmnm-guard route effort=<light|standard|high> activity=<activity-id|none> transition=<loaded|planned-and-awaiting-approval|blocked|not-applicable> basis=1"
      );
    case "INVESTIGATE":
      if (isDelegated(state) && !captureCurrent(state) && state.effort === "light") {
        return captureAction(state);
      }
      if (state.effort === "light") {
        return action(
          "Please, Look Before You Change",
          "This is Light work: I inspect the relevant surface, show my one-line readiness receipt, and record it before the narrow change.",
          "Es trabajo Light: inspecciono la superficie relevante, muestro mi recibo de readiness de una línea y lo registro antes del cambio acotado.",
          readyLine(state)
        );
      }
      return action(
        "Please, Look Before You Change",
        "I test the strongest counterexample and use every relevant executable capability. Before I choose a material direction I show one combined evidence checkpoint, record it, and wait.",
        "Pruebo el contraejemplo más fuerte y uso cada capacidad ejecutable relevante. Antes de elegir una dirección material muestro un solo checkpoint combinado de evidencia, lo registro y espero.",
        checkpointLine(state, "combined"),
        true
      );
    case "AWAITING_COLLABORATOR":
      return action(
        "Please, Align Before You Choose",
        "My checkpoint is waiting for the collaborator. I do not repeat it, answer it myself, or touch dependent work.",
        "Mi checkpoint espera al colaborador. No lo repito, no lo respondo yo ni toco trabajo dependiente.",
        null,
        true
      );
    case "COLLABORATOR_RESPONDED":
      return action(
        "Please, Check Our Understanding",
        "A later collaborator turn exists and I do not infer agreement from it. I classify its meaning first; changed, unclear, or rejected need basis=" + String(state.basis + 1) + ".",
        "Existe un turno posterior del colaborador y no infiero acuerdo de él. Clasifico primero su significado; changed, unclear o rejected necesitan basis=" + String(state.basis + 1) + ".",
        alignLine(state)
      );
    case "ALIGNED": {
      if (!alignmentCurrent(state)) {
        return action(
          "Please, Align Before You Choose",
          "My earlier alignment is not bound to this prompt, so I show the checkpoint again, record it, and wait.",
          "Mi alineación anterior no está ligada a este turno, así que muestro de nuevo el checkpoint, lo registro y espero.",
          checkpointLine(state, "combined"),
          true
        );
      }
      if (planPending(state)) {
        return structuralAction(state);
      }
      if (isDelegated(state) && !captureCurrent(state)) {
        return captureAction(state);
      }
      if (state.checkpoint_kind === "authority") {
        return action(
          "Please, Align Before You Choose",
          "Authority alone does not align my direction. I investigate, show the combined evidence checkpoint, record it, and wait.",
          "La autoridad por sí sola no alinea mi dirección. Investigo, muestro el checkpoint combinado de evidencia, lo registro y espero.",
          checkpointLine(state, "combined"),
          true
        );
      }
      return action(
        "Please, Guard the First Write",
        "The evidence is aligned, so I show my concise readiness receipt and record it before the first implementation write.",
        "La evidencia está alineada, así que muestro mi recibo breve de readiness y lo registro antes de la primera escritura de implementación.",
        readyLine(state)
      );
    }
    case "READY":
      return action(
        "Please, Make the Smallest Defensible Change",
        "My readiness is current for this prompt. I stay inside its declared scope and effects.",
        "Mi readiness está vigente para este turno. Me mantengo dentro del alcance y los efectos declarados."
      );
    case "IMPLEMENT":
    case "VERIFY":
      return closureAction(state);
    case "RECOVERY":
      if (state.pending_writes.length > 0) {
        return action(
          "Please, Don't Guess What Happened",
          "A covered result is missing, so I keep writes paused, record the conservative reconciliation, and then inspect the current state.",
          "Falta el resultado de una operación cubierta, así que mantengo las escrituras pausadas, registro la reconciliación conservadora y después inspecciono el estado actual.",
          "pmnm-guard reconcile outcome=<unknown|failed-no-effect> reason=<reason-id> basis=" + String(state.basis + 1)
        );
      }
      if (state.pending_response) {
        return action(
          "Please, Check Our Understanding",
          "The pending result is settled. A collaborator turn arrived meanwhile and I do not infer agreement from it, so I classify its meaning now.",
          "El resultado pendiente ya quedó resuelto. Mientras tanto llegó un turno del colaborador y no infiero acuerdo de él, así que clasifico ahora su significado.",
          alignLine(state)
        );
      }
      if (planPending(state) && state.checkpoint_kind === "authority") {
        return action(
          "Please, Stop and Reconcile",
          "Recovery is still open and the pending plan needs its authority again. I show the corrected current state, record the authority checkpoint, and wait for the collaborator.",
          "La recuperación sigue abierta y el plan pendiente necesita de nuevo su autoridad. Muestro el estado actual corregido, registro el checkpoint de autoridad y espero al colaborador.",
          checkpointLine(state, "authority"),
          true
        );
      }
      return action(
        "Please, Stop and Reconcile",
        "Recovery is still open. I show the corrected current state, capture it when delegated, record the checkpoint, and wait for the collaborator.",
        "La recuperación sigue abierta. Muestro el estado actual corregido, lo capturo si está delegado, registro el checkpoint y espero al colaborador.",
        checkpointLine(state, "combined"),
        true
      );
    case "BLOCKED":
      return action(
        "Please, Ask Before You Rearrange",
        "I present the exact missing evidence or authority once, with the plan digest when a record must be created. I record the checkpoint, then wait.",
        "Presento una sola vez la evidencia o autoridad que falta, con el digest del plan cuando haya que crear un registro. Registro el checkpoint y espero.",
        "pmnm-guard checkpoint kind=<authority|combined> basis=" + basis,
        true
      );
    case "COMPLETE":
      return action(
        "Please, Say What Matters",
        "My recorded result is " + (state.completion ? state.completion.status : "closed") + ". I report that exact limit and the primary next action.",
        "Mi resultado registrado es " + (state.completion ? state.completion.status : "closed") + ". Reporto ese límite exacto y la siguiente acción principal."
      );
    case "EXEMPT":
      return action(
        "Please, Keep It Proportional",
        "My exemption applies only to this prompt and its declared effects.",
        "Mi excepción aplica sólo a este turno y a sus efectos declarados."
      );
    default:
      return action("Please, Make No Mistakes", "My current procedural state is " + state.phase + ".", "Mi estado procedimental actual es " + state.phase + ".");
  }
}

function denialAction(state, effect) {
  if (effect === "durable-content") {
    if (isDelegated(state) && state.basis !== null) {
      return captureAction(state);
    }
    return phaseAction(state);
  }
  if (effect === "verification" && state.basis !== null && !["ORIENT", "COMPLETE", "EXEMPT"].includes(state.phase)) {
    return action(
      "Please, Respect the Boundary",
      "A check outside my readiness needs its own bounded grant, so I record it and retry the identical check.",
      "Una comprobación fuera de mi readiness necesita su propia concesión acotada, así que la registro y reintento la comprobación idéntica.",
      grantLine(state, "verification")
    );
  }
  if (SENSITIVE_GRANTS.has(effect)) {
    if (alignmentCurrent(state) && ["authority", "combined"].includes(state.checkpoint_kind)) {
      return action(
        "Please, Respect the Boundary",
        "The accepted authority checkpoint covers this " + effect + " effect, so I record its grant and retry the identical operation.",
        "El checkpoint de autoridad aceptado cubre este efecto " + effect + ", así que registro su concesión y reintento la operación idéntica.",
        grantLine(state, effect === "structure" && state.plan_digest ? "durable-structure" : effect)
      );
    }
    if (["READY", "IMPLEMENT", "VERIFY"].includes(state.phase)) {
      return action(
        "Please, Respect the Boundary",
        "An unplanned " + effect + " effect is outside my current readiness. I record the invalidation and then present the authority checkpoint.",
        "Un efecto " + effect + " no planificado está fuera de mi readiness vigente. Registro la invalidación y después presento el checkpoint de autoridad.",
        "pmnm-guard invalidate reason=unplanned-" + effect + " basis=" + String(state.basis + 1)
      );
    }
    if (["INVESTIGATE", "ALIGNED", "BLOCKED"].includes(state.phase) || (state.phase === "RECOVERY" && state.pending_writes.length === 0 && !state.pending_response)) {
      return action(
        "Please, Ask Before You Rearrange",
        "This " + effect + " effect needs the collaborator's authority. I show the checkpoint once, record it, and wait; I use kind=combined when I also show the direction checkpoint.",
        "Este efecto " + effect + " necesita la autoridad del colaborador. Muestro el checkpoint una vez, lo registro y espero; uso kind=combined cuando también muestro el checkpoint de dirección.",
        "pmnm-guard checkpoint kind=<authority|combined> basis=" + String(state.basis),
        true
      );
    }
    if (state.phase === "EXEMPT") {
      return action(
        "Please, Keep It Proportional",
        "This " + effect + " effect exceeds my exemption. I tell the collaborator and wait for a routed activity.",
        "Este efecto " + effect + " excede mi excepción. Se lo digo al colaborador y espero una actividad enrutada.",
        null,
        true
      );
    }
  }
  return phaseAction(state);
}

function cursorNote(state) {
  if (!state.pending_denied) {
    return { en: "", es: "" };
  }
  const effect = state.pending_denied.effect;
  if (state.pending_denied.in_flight) {
    return {
      en: " My retried " + effect + " operation still has no observed result.",
      es: " Mi operación " + effect + " reintentada aún no tiene resultado observado."
    };
  }
  return {
    en: " My denied " + effect + " operation is still pending; I retry it only after the next receipt succeeds.",
    es: " Mi operación " + effect + " denegada sigue pendiente; la reintento sólo tras el siguiente recibo."
  };
}

function renderAction(state, next, options = {}) {
  const note = options.cursor === false ? { en: "", es: "" } : cursorNote(state);
  const channel = options.channel && next.command ? localize(state, CHANNEL_EN, CHANNEL_ES) : "";
  const text =
    (options.lead || "") +
    localize(state, next.en, next.es) +
    localize(state, note.en, note.es) +
    (next.command ? " NEXT: " + next.command : "") +
    channel;
  return next.heading + "\n" + text;
}

function stateCard(state) {
  return renderAction(state, phaseAction(state));
}

function nextActionFor(state, effect) {
  return effect ? denialAction(state, effect) : phaseAction(state);
}

function clearCursor(state, cause, now) {
  if (!state.pending_denied) {
    return;
  }
  state.pending_denied = null;
  recordEvent(state, "denied-attempt-cleared", { cause }, now);
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
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(key) || !FIELD_VALUE.test(value) || PARENT_TRAVERSAL.test(value)) {
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
    blocked: ["digest"]
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
      ["planned-and-awaiting-approval", "blocked"].includes(state.activity_transition) &&
      state.plan_digest &&
      state.phase === "ALIGNED" &&
      (!DIGEST_VALUE.test(fields.authority || "") || fields.authority !== state.plan_digest)
    ) {
      throw new Error("loaded after an approved plan requires the matching plan digest");
    }
  }
  if (fields.transition === "planned-and-awaiting-approval" && !DIGEST_VALUE.test(fields.digest || "")) {
    throw new Error("planned-and-awaiting-approval requires an exact lowercase SHA-256 digest");
  }
  if (fields.transition === "blocked" && fields.digest && !DIGEST_VALUE.test(fields.digest)) {
    throw new Error("a blocked transition digest must be an exact lowercase SHA-256 digest");
  }
  if (fields.transition === "created") {
    if (!concreteValue(fields.locator) || !concreteValue(fields.record)) {
      throw new Error("created requires concrete locator=<receipt> and record=<receipt>");
    }
    if (!DIGEST_VALUE.test(fields.authority || "") || fields.authority !== state.plan_digest) {
      throw new Error("created requires authority=<approved-plan-digest> matching the pending plan");
    }
    if (!planOperationsComplete(state)) {
      throw new Error("created requires every approved covered structural operation to be observed successful");
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
    (state.mutation_count > 0 || state.effect_count > 0) &&
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
    ((["planned-and-awaiting-approval", "blocked"].includes(state.activity_transition) &&
      Boolean(state.plan_digest) &&
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
  state.plan_digest =
    fields.transition === "planned-and-awaiting-approval" || (fields.transition === "blocked" && fields.digest)
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
    state.effect_count = 0;
  }
  if (startsAfterClosure || activityChanged) {
    clearCursor(state, startsAfterClosure ? "activity-closed" : "activity-changed", now);
  }
  if (!(preservesApprovedTransition && ["created", "loaded"].includes(fields.transition))) {
    state.plan_required_operations = 0;
    state.plan_observed_operations = 0;
  }
  state.pending_response = false;
  state.recovery_result = null;
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
  state.pending_response = false;
  state.recovery_result = null;
  recordEvent(state, "checkpoint", { kind: fields.kind, basis: state.basis }, now);
  return stateCard(state);
}

function handleAlign(state, fields, event, now) {
  exactFields(fields, ["result", "basis"]);
  if (!COLLABORATOR_RESULTS.has(fields.result) || !BASIS_VALUE.test(fields.basis)) {
    throw new Error("collaborator result or basis is invalid");
  }
  const recoveryResponse = state.phase === "RECOVERY" && state.pending_response;
  if (recoveryResponse && state.pending_writes.length > 0) {
    throw new Error("the pending covered result must be settled before the collaborator response is classified");
  }
  if (
    !(state.phase === "COLLABORATOR_RESPONDED" || recoveryResponse) ||
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
    if (recoveryResponse) {
      const restorable = state.recovery_result === "resolved";
      state.phase = restorable ? state.response_origin_phase || "ALIGNED" : "RECOVERY";
      if (restorable) {
        state.recovery_result = null;
      }
    } else {
      state.phase = ["IMPLEMENT", "VERIFY"].includes(state.response_origin_phase)
        ? "VERIFY"
        : "ALIGNED";
    }
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
    clearCursor(state, "collaborator-redirect", now);
  }
  state.collaborator_result = fields.result;
  state.response_origin_phase = null;
  state.pending_response = false;
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
    if (fields.capture !== "current" || !captureCurrent(state)) {
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
  if (
    fields.effect === "durable-structure" &&
    (!state.plan_digest || !DIGEST_VALUE.test(fields.authority) || fields.authority !== state.plan_digest)
  ) {
    throw new Error("durable structure requires authority equal to the approved plan digest");
  }
  state.grant = {
    effect: fields.effect,
    authority_hash: hash(fields.authority),
    prompt_epoch: state.prompt_epoch,
    turn_hash: hash(event.turn_id),
    uses,
    command_hash: null
  };
  const structural = fields.effect === "durable-structure" && planPending(state);
  if (structural) {
    state.plan_required_operations = Math.max(state.plan_required_operations, uses);
  }
  recordEvent(
    state,
    "effect-grant",
    { effect: fields.effect, uses, plan_required_operations: structural ? state.plan_required_operations : null },
    now
  );
  const next = structural
    ? structuralAction(state)
    : action(
        "Please, Respect the Boundary",
        "I recorded " + fields.effect + " for " + String(uses) + " covered call(s) in this prompt. Native host authority remains separate, and I now perform the identical operation.",
        "Registré " + fields.effect + " para " + String(uses) + " operación(es) cubiertas en este turno. La autoridad nativa del host sigue separada, y ahora realizo la operación idéntica."
      );
  return renderAction(state, next, { cursor: false });
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
  return voice(state, "411", "Please, Name the Effect", "I recorded one " + fields.effect + " classification for this exact command, and I retry only that identical command.", "Registré una clasificación " + fields.effect + " para este comando exacto, y reintento únicamente ese comando idéntico.");
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
  clearCursor(state, "invalidate", now);
  state.last_capture = null;
  state.last_verification = null;
  state.completion = null;
  state.collaborator_epoch = null;
  state.collaborator_result = null;
  state.response_origin_phase = null;
  state.pending_response = false;
  state.recovery_result = null;
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
    if (state.pending_denied && entry.command_hash && entry.command_hash === state.pending_denied.command_hash) {
      state.pending_denied.in_flight = false;
      recordEvent(state, "denied-attempt-retry-reconciled", { outcome: fields.outcome }, now);
    }
    state.reconciled_writes.push({
      id_hash: entry.id_hash,
      effect: entry.effect,
      command_hash: entry.command_hash || null,
      activity_hash: entry.activity_hash ?? null,
      plan_digest: entry.plan_digest ?? null,
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
  state.recovery_result = fields.outcome === "unknown" ? "unknown" : "resolved";
  if (!state.pending_response) {
    state.collaborator_epoch = null;
    state.collaborator_result = null;
    state.response_origin_phase = null;
  }
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
  const implemented = ["IMPLEMENT", "VERIFY"].includes(state.phase);
  const authorizedEffects =
    state.mutation_count === 0 &&
    state.effect_count > 0 &&
    ["INVESTIGATE", "ALIGNED"].includes(state.phase);
  if (!currentPrompt(state, event) || (!implemented && !authorizedEffects)) {
    throw new Error("external verification requires current implemented or authorized-effect work");
  }
  if (state.pending_writes.length > 0) {
    throw new Error("verification cannot be recorded while a covered result is in flight");
  }
  if (implemented) {
    state.phase = "VERIFY";
  }
  state.last_verification = {
    basis: state.basis,
    mutation_count: state.mutation_count,
    effect_count: state.effect_count,
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
    !(VERIFICATION_RESULTS.has(fields.verification) || fields.verification === "not-applicable") ||
    !OBSERVABLE_RESULTS.has(fields.observable) ||
    !PROTECTION_RESULTS.has(fields.protection) ||
    !CAPTURE_RESULTS.has(fields.capture) ||
    !AUDIT_RESULTS.has(fields.audit)
  ) {
    throw new Error("completion contains an unsupported disposition");
  }
  if (state.mutation_count > 0) {
    if (!["IMPLEMENT", "VERIFY"].includes(state.phase)) {
      throw new Error("completion requires the implemented work to be open in IMPLEMENT or VERIFY");
    }
    if (fields.verification === "not-applicable") {
      throw new Error("implemented work requires a verification disposition");
    }
  } else {
    if (!["INVESTIGATE", "ALIGNED"].includes(state.phase)) {
      throw new Error("completion without implementation requires an open investigate or aligned phase");
    }
    if (state.effect_count === 0) {
      if (
        fields.verification !== "not-applicable" ||
        fields.observable !== "not-applicable" ||
        fields.protection !== "not-applicable"
      ) {
        throw new Error("work without any covered effect closes only with not-applicable verification, observable, and protection");
      }
    } else if (fields.verification === "not-applicable") {
      throw new Error("authorized effects require a verification disposition");
    }
  }
  const currentVerification = verificationCurrent(state);
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
    if (fields.capture !== "complete" || !captureCurrent(state)) {
      throw new Error("delegated completion requires an observed capture after the latest mutation");
    }
  } else if (fields.capture !== "not-applicable") {
    throw new Error("capture=complete requires a loaded or created delegated activity");
  }
  const completed =
    ["passed", "not-applicable"].includes(fields.verification) &&
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
  clearCursor(state, "completion", now);
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

const READ_WORDS = new Set([
  "pwd", "ls", "cat", "head", "tail", "wc", "stat", "file", "which", "where", "type", "date", "sort", "uniq", "cut", "tr",
  "diff", "cmp", "realpath", "readlink", "basename", "dirname", "test", "["
]);
const SEARCH_WORDS = new Set(["rg", "grep", "egrep", "fgrep", "jq"]);
const INTERPRETERS = new Set([
  "sh", "bash", "zsh", "dash", "ksh", "fish", "node", "nodejs", "deno", "python", "python3", "ruby", "perl", "php",
  "eval", "xargs", "env", "nohup", "exec", "time", "nice", "sudo", "doas", "source", "."
]);
const GIT_MUTATING = new Set([
  "add", "commit", "push", "tag", "checkout", "switch", "reset", "rebase", "merge", "cherry-pick", "revert", "clean",
  "stash", "apply", "am", "rm", "mv", "restore", "fetch", "pull", "init", "clone", "worktree", "submodule", "notes", "filter-branch", "gc", "prune"
]);
const GIT_READ = new Set(["status", "diff", "log", "show", "rev-parse", "ls-files", "grep", "blame", "check-ignore", "var", "describe", "shortlog", "rev-list", "cat-file", "ls-tree", "name-rev"]);
const PACKAGE_MANAGERS = new Set(["npm", "yarn", "pnpm", "bun"]);
const VERIFICATION_SUBCOMMANDS = new Set(["test", "lint", "check", "build", "typecheck"]);
const VERIFICATION_TOOLS = new Set(["eslint", "prettier", "vitest", "jest", "tsc", "vue-tsc"]);
const WRITE_SEVERITY = [
  "deletion", "movement", "structure", "version-control", "publication", "dependencies", "environment", "external", "implementation", "verification"
];
const CONTROL_CHARACTERS = new RegExp("[\\r\\n\\u0000]");
const INTERPRETER_VOCABULARY = [
  { re: /\b(?:rm|rmdir|unlink|truncate|shred)\b/, effect: "deletion" },
  { re: /\b(?:mv|cp)\b/, effect: "movement" },
  { re: /\b(?:mkdir|touch|install|chmod|chown|ln|dd|patch)\b/, effect: "structure" },
  { re: /\bgit\s+(?:add|commit|push|tag|checkout|switch|reset|rebase|merge|cherry-pick|revert|clean|stash|apply|rm|mv|restore)\b/, effect: "version-control" },
  { re: /\b(?:npm|yarn|pnpm|bun)\s+publish\b/, effect: "publication" },
  { re: /\b(?:npm|yarn|pnpm|bun)\s+(?:install|add|remove|uninstall|update|link)\b/, effect: "dependencies" },
  { re: /\b(?:docker|podman|kill|killall|launchctl|systemctl|service)\b/, effect: "environment" },
  { re: /\b(?:curl|wget)\b/, effect: "external" },
  { re: /(^|[^<>])>{1,2}(?![=>&])/, effect: "implementation" }
];

function lexShell(command) {
  const segments = [];
  let tokens = [];
  let current = "";
  let currentQuoted = false;
  let inToken = false;
  let quote = null;
  let escaped = false;
  let redirectWrite = false;
  let dynamic = false;
  let awaitingRedirectTarget = false;
  let text = "";

  const flushToken = () => {
    if (inToken) {
      if (awaitingRedirectTarget) {
        if (current !== "/dev/null") {
          redirectWrite = true;
        }
        awaitingRedirectTarget = false;
      } else {
        tokens.push({ value: current, quoted: currentQuoted });
      }
    }
    current = "";
    currentQuoted = false;
    inToken = false;
  };
  const flushSegment = () => {
    flushToken();
    if (awaitingRedirectTarget) {
      redirectWrite = true;
      awaitingRedirectTarget = false;
    }
    segments.push({ tokens, text: text.trim(), redirectWrite, dynamic });
    tokens = [];
    text = "";
    redirectWrite = false;
    dynamic = false;
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    const next = command[index + 1];
    text += character;
    if (escaped) {
      current += character;
      inToken = true;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      inToken = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
        continue;
      }
      if (quote === '"' && (character === "`" || (character === "$" && next === "("))) {
        dynamic = true;
      }
      current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      inToken = true;
      currentQuoted = true;
      continue;
    }
    if (character === "`" || (character === "$" && next === "(") || ((character === "<" || character === ">") && next === "(")) {
      dynamic = true;
      current += character;
      inToken = true;
      continue;
    }
    if (character === "&" && next === "&") {
      flushSegment();
      index += 1;
      continue;
    }
    if (character === "|") {
      flushSegment();
      if (next === "|") {
        index += 1;
      }
      continue;
    }
    if (character === ";") {
      flushSegment();
      continue;
    }
    if (character === ">") {
      const fdOnly = inToken && /^[0-9]+$/.test(current) && !currentQuoted;
      if (fdOnly) {
        current = "";
        inToken = false;
      } else {
        flushToken();
      }
      let cursor = index + 1;
      if (command[cursor] === ">") {
        cursor += 1;
      }
      if (command[cursor] === "&") {
        index = cursor;
        while (/[0-9-]/.test(command[index + 1] || "")) {
          index += 1;
        }
        continue;
      }
      awaitingRedirectTarget = true;
      index = cursor - 1;
      continue;
    }
    if (character === "<") {
      const fdOnly = inToken && /^[0-9]+$/.test(current) && !currentQuoted;
      if (fdOnly) {
        current = "";
        inToken = false;
      } else {
        flushToken();
      }
      continue;
    }
    if (/\s/.test(character)) {
      flushToken();
      continue;
    }
    current += character;
    inToken = true;
  }
  if (quote || escaped) {
    return { invalid: true, segments: [] };
  }
  flushSegment();
  return { invalid: false, segments: segments.filter((segment) => segment.tokens.length > 0 || segment.redirectWrite) };
}

function write(effect) {
  return { kind: "write", effect, reason: "definite-pattern" };
}

const UNKNOWN = Object.freeze({ kind: "unknown", effect: null, reason: "unclassified-command" });
const READ = Object.freeze({ kind: "read", effect: null, reason: "allowlisted-read" });

function classifyGit(values) {
  let index = 1;
  while (index < values.length) {
    const token = values[index];
    if (token === "-C" || token === "-c") {
      index += 2;
      continue;
    }
    if (/^--(?:git-dir|work-tree|namespace)=/.test(token) || /^--no-pager$/.test(token)) {
      index += 1;
      continue;
    }
    break;
  }
  const subcommand = values[index];
  const rest = values.slice(index + 1);
  if (!subcommand) {
    return UNKNOWN;
  }
  if (GIT_MUTATING.has(subcommand)) {
    return write("version-control");
  }
  if (rest.some((token) => /^--output(?:=|$)/.test(token))) {
    return UNKNOWN;
  }
  if (GIT_READ.has(subcommand)) {
    return READ;
  }
  if (subcommand === "config") {
    return rest.some((token) => /^(?:--get|--get-all|--list|-l)$/.test(token)) && !rest.some((token) => /^--(?:unset|add|replace-all|edit|rename-section|remove-section)/.test(token))
      ? READ
      : UNKNOWN;
  }
  if (subcommand === "remote") {
    return rest.length === 0 || rest[0] === "-v" || rest[0] === "get-url" ? READ : write("version-control");
  }
  if (subcommand === "branch") {
    return rest.every((token) => /^(?:--show-current|--list|-a|-r|-v|-vv)$/.test(token)) ? READ : write("version-control");
  }
  return UNKNOWN;
}

function classifyPackageManager(values) {
  let index = 1;
  while (index < values.length) {
    const token = values[index];
    if (/^(?:--cwd|-w|--workspace|--filter|--dir|-C)$/.test(token) || token === "workspace") {
      index += 2;
      continue;
    }
    if (token === "run") {
      index += 1;
      continue;
    }
    break;
  }
  const subcommand = values[index];
  if (!subcommand) {
    return UNKNOWN;
  }
  if (VERIFICATION_SUBCOMMANDS.has(subcommand)) {
    return write("verification");
  }
  if (["exec", "x", "dlx"].includes(subcommand)) {
    return VERIFICATION_TOOLS.has(values[index + 1]) ? write("verification") : UNKNOWN;
  }
  if (["install", "add", "remove", "uninstall", "update", "link"].includes(subcommand)) {
    return write("dependencies");
  }
  if (subcommand === "publish") {
    return write("publication");
  }
  if (["view", "info", "why", "list", "ls", "help", "--version", "-v"].includes(subcommand)) {
    return READ;
  }
  return UNKNOWN;
}

const SED_SIMPLE_COMMANDS = new Set(["p", "P", "n", "N", "d", "D", "g", "G", "h", "H", "x", "=", "q", "Q", "z", "F"]);
const SED_SINGLE_ADDRESS = /^(?:\d+|\$|\/(?:\\.|[^/\\])*\/)/;
const SED_SECOND_ADDRESS = /^\s*,\s*(?:\d+|\$|\/(?:\\.|[^/\\])*\/)/;

function sedAddressBody(piece) {
  let rest = piece;
  const first = rest.match(SED_SINGLE_ADDRESS);
  if (first) {
    rest = rest.slice(first[0].length);
    const second = rest.match(SED_SECOND_ADDRESS);
    if (second) {
      rest = rest.slice(second[0].length);
    }
    rest = rest.replace(/^\s*!?\s*/, "");
    return /^[~+,]/.test(rest) ? null : rest;
  }
  if (/^[\\~+,\d]/.test(rest)) {
    return null;
  }
  return rest.replace(/^\s*/, "");
}

function sedPieceVerdict(rawPiece) {
  const body = sedAddressBody(rawPiece.trim());
  if (body === null || body === "") {
    return "unknown";
  }
  const command = body[0];
  const rest = body.slice(1);
  if (command === "#") {
    return "read";
  }
  if (SED_SIMPLE_COMMANDS.has(command)) {
    if (rest.trim() === "" || ((command === "q" || command === "Q") && /^\s*\d+\s*$/.test(rest))) {
      return "read";
    }
    return "unknown";
  }
  if (command === "l") {
    return rest.trim() === "" ? "read" : "unknown";
  }
  if (command === ":") {
    return /^\S+\s*$/.test(rest) ? "read" : "unknown";
  }
  if (command === "b" || command === "t" || command === "T") {
    return /^\s*\S*\s*$/.test(rest) ? "read" : "unknown";
  }
  if (command === "a" || command === "i" || command === "c") {
    return "read";
  }
  if (command === "r" || command === "R") {
    return /^\s*\S+\s*$/.test(rest) ? "read" : "unknown";
  }
  if (command === "w" || command === "W") {
    return /^\s*\S+\s*$/.test(rest) ? "write" : "unknown";
  }
  if (command === "y") {
    const tail = sedSubstituteFlags(body);
    return tail !== null && tail.trim() === "" ? "read" : "unknown";
  }
  if (command === "s") {
    const flags = sedSubstituteFlags(body);
    if (flags === null) {
      return "unknown";
    }
    const letters = (flags.match(/^[A-Za-z0-9]*/) || [""])[0];
    const tail = flags.slice(letters.length);
    if (letters.includes("w")) {
      return /^\s*\S+\s*$/.test(tail) ? "write" : "unknown";
    }
    if (tail.trim() !== "" || !/^[gpIMim0-9]*$/.test(letters)) {
      return "unknown";
    }
    return "read";
  }
  return "unknown";
}

function sedSubstituteFlags(piece) {
  const delimiter = piece[1];
  if (!delimiter || /[\s\\]/.test(delimiter)) {
    return null;
  }
  let index = 2;
  let seen = 0;
  while (index < piece.length && seen < 2) {
    if (piece[index] === "\\") {
      index += 2;
      continue;
    }
    if (piece[index] === delimiter) {
      seen += 1;
    }
    index += 1;
  }
  return seen < 2 ? null : piece.slice(index);
}

function classifySed(tokens) {
  const flags = tokens.slice(1).filter((token) => !token.quoted).map((token) => token.value);
  if (flags.some((flag) => /^-[a-zA-Z]*i/.test(flag) || /^--in-place/.test(flag) || flag === "-I")) {
    return write("implementation");
  }
  if (flags.some((flag) => flag === "-f" || /^--file(?:=|$)/.test(flag) || /^-[a-zA-Z]*f$/.test(flag))) {
    return UNKNOWN;
  }
  const scripts = [];
  let expectScript = false;
  let positionalTaken = false;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (expectScript) {
      scripts.push(token.value);
      expectScript = false;
      continue;
    }
    if (!token.quoted && (token.value === "-e" || token.value === "--expression" || /^-[a-zA-Z]*e$/.test(token.value))) {
      expectScript = true;
      continue;
    }
    if (!token.quoted && /^--expression=/.test(token.value)) {
      scripts.push(token.value.slice("--expression=".length));
      continue;
    }
    if (!token.quoted && token.value.startsWith("-") && token.value !== "-") {
      continue;
    }
    if (!positionalTaken && scripts.length === 0) {
      scripts.push(token.value);
      positionalTaken = true;
    }
  }
  if (scripts.length === 0) {
    return UNKNOWN;
  }
  let writes = false;
  let unknown = false;
  for (const script of scripts) {
    if (/[{}]/.test(script)) {
      unknown = true;
      continue;
    }
    for (const rawPiece of script.split(/[;\n]/)) {
      if (rawPiece.trim() === "") {
        continue;
      }
      const verdict = sedPieceVerdict(rawPiece);
      if (verdict === "write") {
        writes = true;
      } else if (verdict === "unknown") {
        unknown = true;
      }
    }
  }
  if (writes) {
    return write("implementation");
  }
  return unknown ? UNKNOWN : READ;
}

function classifyInterpreter(segment) {
  const values = segment.tokens.map((token) => token.value);
  if (values.length === 2 && /^(?:--version|-v)$/.test(values[1])) {
    return READ;
  }
  for (const entry of INTERPRETER_VOCABULARY) {
    if (entry.re.test(segment.text)) {
      return write(entry.effect);
    }
  }
  return UNKNOWN;
}

function classifySegment(segment) {
  if (segment.dynamic) {
    return { kind: "unknown", effect: null, reason: "compound-or-dynamic-shell" };
  }
  let start = 0;
  while (start < segment.tokens.length && !segment.tokens[start].quoted && /^[A-Za-z_][A-Za-z0-9_]*=/.test(segment.tokens[start].value)) {
    start += 1;
  }
  const tokens = segment.tokens.slice(start);
  if (tokens.length === 0) {
    return segment.redirectWrite ? write("implementation") : READ;
  }
  if (tokens[0].quoted) {
    return UNKNOWN;
  }
  const word = tokens[0].value;
  const values = tokens.map((token) => token.value);
  const flags = tokens.filter((token) => !token.quoted).map((token) => token.value);
  let result;
  if (word === "apply_patch") {
    result = { kind: "write", effect: "implementation", reason: "apply-patch" };
  } else if (["rm", "rmdir", "unlink", "truncate", "shred"].includes(word)) {
    result = write("deletion");
  } else if (["mv", "cp"].includes(word)) {
    result = write("movement");
  } else if (["mkdir", "touch", "install", "chmod", "chown", "ln", "dd", "patch"].includes(word)) {
    result = write("structure");
  } else if (["kill", "killall", "launchctl", "systemctl", "service"].includes(word)) {
    result = write("environment");
  } else if (["docker", "podman"].includes(word)) {
    const sub = values[1] === "compose" ? values[2] : values[1];
    result = ["up", "down", "start", "stop", "restart", "rm", "build", "run", "exec"].includes(sub) ? write("environment") : UNKNOWN;
  } else if (["curl", "wget"].includes(word)) {
    result = write("external");
  } else if (word === "git") {
    result = classifyGit(values);
  } else if (PACKAGE_MANAGERS.has(word)) {
    result = classifyPackageManager(values);
  } else if (word === "prettier") {
    result = flags.includes("--write") || flags.includes("-w") ? write("implementation") : flags.includes("--check") ? write("verification") : UNKNOWN;
  } else if (word === "eslint") {
    result = flags.includes("--fix") ? write("implementation") : write("verification");
  } else if (["vitest", "jest", "tsc", "vue-tsc"].includes(word)) {
    result = write("verification");
  } else if (word === "gofmt") {
    result = flags.includes("-w") ? write("implementation") : UNKNOWN;
  } else if (word === "ruff") {
    result = values[1] === "format" || flags.includes("--fix") ? write("implementation") : UNKNOWN;
  } else if (["black", "rustfmt"].includes(word)) {
    result = write("implementation");
  } else if (word === "pytest") {
    result = write("verification");
  } else if (["cargo", "go", "dotnet", "mvn", "gradle"].includes(word)) {
    result = values[1] === "test" ? write("verification") : UNKNOWN;
  } else if (word === "sed") {
    result = classifySed(tokens);
  } else if (word === "find") {
    if (flags.includes("-delete")) {
      result = write("deletion");
    } else if (flags.some((flag) => /^-(?:exec|execdir|ok|okdir)$/.test(flag))) {
      result = UNKNOWN;
    } else if (flags.some((flag) => /^-(?:fprint|fprint0|fprintf|fls)$/.test(flag))) {
      result = write("implementation");
    } else {
      result = READ;
    }
  } else if (word === "rg") {
    result = flags.some(
      (flag) =>
        /^--pre(?:-glob)?(?:=|$)/.test(flag) ||
        flag === "--search-zip" ||
        /^-[a-zA-Z]*z[a-zA-Z]*$/.test(flag)
    )
      ? UNKNOWN
      : READ;
  } else if (SEARCH_WORDS.has(word)) {
    result = READ;
  } else if (READ_WORDS.has(word)) {
    result = READ;
  } else if (INTERPRETERS.has(word)) {
    result = classifyInterpreter(segment);
  } else if (word === "codex") {
    result = /^codex(?:\s+--version|\s+plugin\s+(?:list|marketplace\s+list)|\s+[^\n]*--help)\s*$/.test(segment.text) ? READ : UNKNOWN;
  } else if (word === "claude") {
    result = values.length === 2 && values[1] === "--version" ? READ : UNKNOWN;
  } else {
    result = UNKNOWN;
  }
  if (segment.redirectWrite && result.kind !== "write") {
    return write("implementation");
  }
  return result;
}

export function classifyShell(command) {
  if (typeof command !== "string" || command.length === 0) {
    return { kind: "read", effect: null, reason: "empty" };
  }
  if (CONTROL_CHARACTERS.test(command)) {
    return { kind: "unknown", effect: null, reason: "compound-or-dynamic-shell" };
  }
  const lexed = lexShell(command.trim());
  if (lexed.invalid) {
    return { kind: "unknown", effect: null, reason: "unbalanced-quoting" };
  }
  if (lexed.segments.length === 0) {
    return { kind: "read", effect: null, reason: "empty" };
  }
  let strongest = null;
  let unknown = null;
  for (const segment of lexed.segments) {
    const result = classifySegment(segment);
    if (result.kind === "write") {
      if (!strongest || WRITE_SEVERITY.indexOf(result.effect) < WRITE_SEVERITY.indexOf(strongest.effect)) {
        strongest = result;
      }
    } else if (result.kind === "unknown" && !unknown) {
      unknown = result;
    }
  }
  if (strongest) {
    return strongest;
  }
  if (unknown) {
    return unknown;
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

function addPendingWrite(state, event, effect, now, commandHash = null) {
  const idHash = hash(event.tool_use_id || "missing-tool-use-id");
  const toolHash = hash(String(event.tool_name || ""));
  const denied = state.pending_denied;
  if (denied && commandHash && denied.command_hash === commandHash && denied.tool_hash === toolHash) {
    denied.in_flight = true;
    recordEvent(state, "denied-attempt-in-flight", { effect }, now);
  }
  state.pending_writes.push({
    id_hash: idHash,
    effect,
    prompt_epoch: state.prompt_epoch,
    basis: state.basis,
    at_ms: now,
    command_hash: commandHash,
    tool_hash: toolHash,
    activity_hash: state.activity_hash,
    plan_digest: state.plan_digest
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
      output: denyTool(voice(state, "610", "Please, Name the Effect", "I cannot classify this covered input, so I allow no write from it.", "No puedo clasificar esta entrada cubierta, así que no permito ninguna escritura desde ella."))
    };
  }
  let control;
  try {
    control = parseControlCommand(command);
  } catch (error) {
    recordEvent(state, "control-rejected", { reason_hash: hash(error.message) }, now);
    return { state, output: denyTool(voice(state, "611", "Please, Check the Receipt", "I rejected that receipt: " + error.message + ".", "Rechacé ese recibo: " + error.message + ".")) };
  }
  if (control) {
    try {
      const context = controlTransition(state, control, event, now);
      return { state, output: rewriteControl(context) };
    } catch (error) {
      recordEvent(state, "control-rejected", { reason_hash: hash(error.message) }, now);
      const card = stateCard(state);
      const body = card.slice(card.indexOf("\n") + 1);
      return {
        state,
        output: denyTool(card.slice(0, card.indexOf("\n")) + "\n" + localize(state, "I rejected that receipt: " + error.message + ". ", "Rechacé ese recibo: " + error.message + ". ") + body)
      };
    }
  }
  const commandHash = hash(command);

  if (state.pending_writes.length > 0) {
    recordEvent(state, "covered-write-denied", { cause: "prior-result-pending" }, now);
    const next = phaseAction({ ...state, phase: "RECOVERY" });
    return {
      state,
      output: denyTool(
        renderAction(state, next, {
          lead: localize(state, "I do not start another write yet. ", "Todavía no inicio otra escritura. "),
          cursor: false,
          channel: true
        })
      )
    };
  }

  if (event.tool_name === "apply_patch") {
    const grantedPatchEffect = consumeGrant(state, "ambiguous", commandHash, event);
    if (grantedPatchEffect) {
      addPendingWrite(state, event, grantedPatchEffect, now, commandHash);
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
  if (classification.kind === "unknown") {
    const permitted = consumeGrant(state, "ambiguous", commandHash, event);
    if (permitted) {
      addPendingWrite(state, event, permitted, now, commandHash);
      return { state, output: null };
    }
    if (!state.effort || state.phase === "ORIENT") {
      recordEvent(state, "unknown-shell-denied", { reason: classification.reason }, now);
      return {
        state,
        output: denyTool(
          renderAction(state, phaseAction(state), {
            lead: localize(state, "I have not resolved the activity yet, so I run no unclassified shell effect. ", "Todavía no he resuelto la actividad, así que no ejecuto ningún efecto de shell sin clasificar. "),
            channel: true
          })
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
    const permitLine = "pmnm-guard permit token=" + token + " effect=<" + allowedEffects.join("|") + ">";
    return {
      state,
      output: denyTool(
        renderAction(
          state,
          action(
            "Please, Name the Effect",
            "I cannot tell whether this command mutates anything, so I do not run it yet. I classify the identical command once and retry it unchanged; the classification is my own procedural receipt, not proof.",
            "No puedo saber si este comando modifica algo, así que todavía no lo ejecuto. Clasifico una vez el comando idéntico y lo reintento sin cambios; la clasificación es mi recibo procedimental, no una prueba.",
            permitLine
          ),
          { cursor: false, channel: true }
        )
      )
    };
  }

  const effect = classification.effect;
  const granted = consumeGrant(state, effect, commandHash, event);
  if (granted) {
    addPendingWrite(state, event, granted, now, commandHash);
    return { state, output: null };
  }
  if (exemptionAllows(state, effect, event)) {
    addPendingWrite(state, event, "exempt-" + effect, now, commandHash);
    return { state, output: null };
  }
  if (readinessAllows(state, effect, event)) {
    addPendingWrite(state, event, effect, now, commandHash);
    return { state, output: null };
  }
  const toolHash = hash(String(event.tool_name || ""));
  const existing = state.pending_denied;
  const repeated = Boolean(existing && existing.command_hash === commandHash && existing.tool_hash === toolHash);
  const deferred = Boolean(existing && !repeated);
  const targetEffect = deferred ? existing.effect : effect;
  const next = nextActionFor(state, targetEffect);
  if (repeated) {
    existing.denials += 1;
    existing.in_flight = false;
  } else if (!deferred) {
    state.pending_denied = {
      effect,
      phase: state.phase,
      basis: state.basis,
      prompt_epoch: state.prompt_epoch,
      command_hash: commandHash,
      tool_hash: toolHash,
      in_flight: false,
      denials: 1
    };
  }
  recordEvent(
    state,
    deferred ? "denied-attempt-deferred" : "covered-write-denied",
    { tool: event.tool_name, effect, phase: state.phase, repeated },
    now
  );
  const lead = repeated
    ? localize(
        state,
        "This is the same denied " + effect + " operation; retrying does not change what I still owe. ",
        "Es la misma operación " + effect + " denegada; reintentar no cambia lo que aún debo. "
      )
    : deferred
      ? localize(
          state,
          "An earlier denied " + existing.effect + " operation is still pending and comes first, so I do not start this " + effect + " write yet. ",
          "Una operación " + existing.effect + " denegada antes sigue pendiente y va primero, así que todavía no inicio esta escritura " + effect + ". "
        )
      : localize(
          state,
          "I am not ready for this covered " + effect + " write yet. ",
          "Todavía no estoy listo para esta escritura cubierta " + effect + ". "
        );
  return {
    state,
    output: denyTool(renderAction(state, next, { lead, cursor: false, channel: true }))
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
    const consequential =
      reconciled.effect === "implementation" ||
      SENSITIVE_GRANTS.has(reconciled.effect) ||
      reconciled.effect === "durable-content";
    const sameActivity = (reconciled.activity_hash ?? null) === state.activity_hash;
    const samePlan = (reconciled.plan_digest ?? null) === state.plan_digest;
    if (reconciled.outcome === "failed-no-effect" && !failed && consequential) {
      if (sameActivity && reconciled.effect === "implementation") {
        state.mutation_count += 1;
      } else if (sameActivity && reconciled.effect !== "durable-content") {
        state.effect_count += 1;
      }
      if (
        sameActivity &&
        samePlan &&
        ["durable-structure", "structure"].includes(reconciled.effect) &&
        planPending(state)
      ) {
        state.plan_observed_operations += 1;
      }
      state.basis = state.basis === null ? 1 : state.basis + 1;
      state.phase = "RECOVERY";
      state.readiness = null;
      state.grant = null;
      state.last_capture = null;
      state.last_verification = null;
      state.completion = null;
      state.pending_response = false;
      state.recovery_result = "contradicted";
      state.collaborator_epoch = null;
      state.collaborator_result = null;
      state.response_origin_phase = null;
      const next = phaseAction(state);
      output = hookContext(
        "PostToolUse",
        renderAction(
          state,
          action(
            "Please, Recheck the Result",
            "A late host result contradicted my failed-no-effect reconciliation of a " + reconciled.effect + " effect. I treat that effect as real, inspect the current state, and reopen recovery at basis " + String(state.basis) + ".",
            "Un resultado tardío del host contradijo mi reconciliación failed-no-effect de un efecto " + reconciled.effect + ". Trato ese efecto como real, inspecciono el estado actual y reabro la recuperación en la base " + String(state.basis) + ".",
            next.command,
            next.wait
          ),
          { cursor: false }
        )
      );
    }
    recordEvent(
      state,
      "late-covered-result-observed",
      {
        effect: reconciled.effect,
        failed,
        prior_outcome: reconciled.outcome,
        basis: state.basis,
        same_activity: sameActivity,
        same_plan: samePlan
      },
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
  if (state.pending_denied && pending.command_hash && pending.command_hash === state.pending_denied.command_hash) {
    if (failed) {
      state.pending_denied.in_flight = false;
      recordEvent(state, "denied-attempt-retry-failed", { effect: pending.effect }, now);
    } else {
      clearCursor(state, "observed-success", now);
    }
  }
  if (
    !failed &&
    NON_IMPLEMENTATION_GRANTS.has(pending.effect) &&
    !["durable-content", "verification"].includes(pending.effect)
  ) {
    state.effect_count += 1;
    recordEvent(state, "authorized-effect-observed", { effect: pending.effect, effect_count: state.effect_count }, now);
  }
  let structuralProgress = false;
  if (!failed && ["durable-structure", "structure"].includes(pending.effect) && planPending(state)) {
    state.plan_observed_operations += 1;
    structuralProgress = true;
    recordEvent(
      state,
      "plan-operation-observed",
      { observed: state.plan_observed_operations, required: state.plan_required_operations },
      now
    );
  }
  if (pending.effect === "verification") {
    const stale = pending.prompt_epoch !== state.prompt_epoch || pending.basis !== state.basis;
    state.last_verification = stale
      ? null
      : {
          basis: state.basis,
          mutation_count: state.mutation_count,
          effect_count: state.effect_count,
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
        effect_count: state.effect_count,
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
  let output = null;
  if (state.phase === "RECOVERY" && state.pending_response && state.pending_writes.length === 0) {
    state.recovery_result = "resolved";
    recordEvent(state, "pending-result-settled", { failed }, now);
    output = hookContext("PostToolUse", stateCard(state));
  } else if (structuralProgress && state.phase === "ALIGNED") {
    output = hookContext("PostToolUse", renderAction(state, structuralAction(state), { cursor: false }));
  }
  return { state, output };
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

  const implementationInFlight = state.pending_writes.some((entry) => entry.effect === "implementation");
  const consequentialWriteInFlight = state.pending_writes.some(
    (entry) => entry.effect === "implementation" || SENSITIVE_GRANTS.has(entry.effect)
  );
  if (consequentialWriteInFlight && !implementationInFlight && state.phase !== "RECOVERY") {
    state.response_origin_phase = state.phase;
    state.phase = "RECOVERY";
    state.readiness = null;
    state.completion = null;
    state.collaborator_epoch = state.prompt_epoch;
    state.collaborator_result = null;
    state.pending_response = true;
    state.recovery_result = null;
    state.basis = state.basis === null ? 1 : state.basis + 1;
    recordEvent(
      state,
      "collaborator-turn-during-covered-effect",
      { basis: state.basis, pending_count: state.pending_writes.length, origin_phase: state.response_origin_phase },
      now
    );
  } else if (consequentialWriteInFlight && state.phase !== "RECOVERY") {
    state.phase = "RECOVERY";
    state.readiness = null;
    state.completion = null;
    state.collaborator_epoch = null;
    state.collaborator_result = null;
    state.response_origin_phase = null;
    state.pending_response = false;
    state.recovery_result = null;
    state.basis = state.basis === null ? 1 : state.basis + 1;
    recordEvent(
      state,
      "readiness-invalidated",
      { cause: "new-user-prompt-during-covered-write", basis: state.basis },
      now
    );
  } else if (state.phase === "RECOVERY" && state.pending_response) {
    state.collaborator_epoch = state.prompt_epoch;
    state.collaborator_result = null;
    recordEvent(state, "additional-collaborator-turn-observed", { during: "pending-result" }, now);
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
  } else if (state.phase === "ALIGNED") {
    state.phase = "COLLABORATOR_RESPONDED";
    state.readiness = null;
    state.collaborator_epoch = state.prompt_epoch;
    state.collaborator_result = null;
    state.response_origin_phase = "ALIGNED";
    recordEvent(state, "aligned-collaborator-turn-observed", { checkpoint_kind: state.checkpoint_kind }, now);
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

function stopOnce(state, event, reason, heading, warningEn, warningEs, continuedEvent, reportedEvent, now) {
  const turnHash = hashOrNull(event.turn_id);
  if (event.stop_hook_active || state.stop_reminder_turn_hash === turnHash) {
    recordEvent(state, reportedEvent, {}, now);
    return {
      state,
      output: warning(voice(state, "", heading, warningEn + " " + reason, warningEs + " " + reason))
    };
  }
  state.stop_reminder_turn_hash = turnHash;
  state.continuation_prompt_hash = hash(reason);
  recordEvent(state, continuedEvent, {}, now);
  return { state, output: continueStop(reason) };
}

const NOT_AGAIN_EN = "I will not continue again automatically.";
const NOT_AGAIN_ES = "No continuaré otra vez automáticamente.";

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
    return stopOnce(
      state, event, stateCard(state), "Please, Check Our Understanding",
      "I still have not reconciled the collaborator's response. " + NOT_AGAIN_EN,
      "Todavía no he reconciliado la respuesta del colaborador. " + NOT_AGAIN_ES,
      "stop-response-unreconciled-continued", "stop-response-unreconciled-reported", now
    );
  }
  if (state.phase === "RECOVERY") {
    return stopOnce(
      state, event, stateCard(state), "Please, Pause Here",
      "My recovery is still open. " + NOT_AGAIN_EN,
      "Mi recuperación sigue abierta. " + NOT_AGAIN_ES,
      "stop-recovery-continued", "stop-recovery-reported", now
    );
  }
  if (["IMPLEMENT", "VERIFY"].includes(state.phase) && !state.completion) {
    const reason = stateCard(state);
    if (!(event.stop_hook_active || state.stop_reminder_turn_hash === hashOrNull(event.turn_id))) {
      state.phase = "VERIFY";
    }
    return stopOnce(
      state, event, reason, "Please, Leave an Honest Handoff",
      "My result is still incomplete. " + NOT_AGAIN_EN,
      "Mi resultado sigue incompleto. " + NOT_AGAIN_ES,
      "stop-continued", "stop-incomplete-reported", now
    );
  }
  if (state.phase === "BLOCKED") {
    return stopOnce(
      state, event, stateCard(state), "Please, Ask Before You Rearrange",
      "I have not recorded the checkpoint for this blocked activity yet. " + NOT_AGAIN_EN,
      "Todavía no he registrado el checkpoint de esta actividad bloqueada. " + NOT_AGAIN_ES,
      "stop-blocked-continued", "stop-blocked-reported", now
    );
  }
  if (state.pending_denied && state.phase !== "AWAITING_COLLABORATOR") {
    const cursorAction = denialAction(state, state.pending_denied.effect);
    if (!cursorAction.wait) {
      const effect = state.pending_denied.effect;
      return stopOnce(
        state, event, renderAction(state, cursorAction), "Please, Guard the First Write",
        "My denied " + effect + " operation is still unresolved and I do not hand it to the collaborator. " + NOT_AGAIN_EN,
        "Mi operación " + effect + " denegada sigue sin resolverse y no se la entrego al colaborador. " + NOT_AGAIN_ES,
        "stop-denied-attempt-continued", "stop-denied-attempt-reported", now
      );
    }
  }
  if (nonImplementationOpen(state)) {
    return stopOnce(
      state, event, renderAction(state, closureAction(state)), "Please, Check Your Work",
      "My authorized effects have no closing disposition yet. " + NOT_AGAIN_EN,
      "Mis efectos autorizados aún no tienen disposición de cierre. " + NOT_AGAIN_ES,
      "stop-effects-unclosed-continued", "stop-effects-unclosed-reported", now
    );
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

function acquireLock(lockPath, waitMs = LOCK_WAIT_MS) {
  const token = String(process.pid) + ":" + crypto.randomBytes(8).toString("hex");
  const deadline = Date.now() + (Number.isFinite(waitMs) ? waitMs : LOCK_WAIT_MS);
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
      if (!error || error.code !== "EEXIST") {
        throw error;
      }
      try {
        const lock = fs.lstatSync(lockPath);
        if (lock.isFile() && !lock.isSymbolicLink() && Date.now() - lock.mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (lockError) {
        if (!lockError || lockError.code !== "ENOENT") {
          throw lockError;
        }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error("guard state is busy");
      }
      wait(LOCK_DELAY_MS + Math.floor(Math.random() * LOCK_DELAY_MS));
    }
  }
}

function releaseLock(lockPath, token) {
  try {
    if (fs.readFileSync(lockPath, "utf8") !== token) {
      return false;
    }
    fs.unlinkSync(lockPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
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
  const token = acquireLock(paths.lock, options.lockWaitMs);
  try {
    const state = readState(paths.state);
    const before = JSON.stringify(state);
    const result = processEvent(state, event, options);
    if (JSON.stringify(result.state) !== before) {
      writeState(paths.state, result.state);
    }
    return result.output;
  } finally {
    releaseLock(paths.lock, token);
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
    "I could not read my procedural state, so I keep covered writes paused and inspect /hooks and the guard status before deciding how to continue. Detail: " + detail,
    "No pude leer mi estado procedimental, así que mantengo pausadas las escrituras cubiertas y reviso /hooks y el estado del guard antes de decidir cómo continuar. Detalle: " + detail
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
  releaseLock,
  acquireLock,
  compileNextAction: nextActionFor,
  captureCurrent,
  verificationCurrent,
  hash,
  stateCard,
  validateState,
  NO_OP_COMMAND,
  MAX_EVENTS,
  SCHEMA_VERSION,
  modulePath: fileURLToPath(import.meta.url)
});
