#!/usr/bin/env python3
"""Validate portable ordered evaluation traces without executing model clients."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_FILE = PACKAGE_ROOT / "evals" / "trace.schema.json"
MAX_TRACE_BYTES = 5_000_000
PROTECTION_STATUSES = {
    "existing-sufficient",
    "added-or-updated",
    "not-applicable",
    "omitted-with-reason",
    "blocked",
}
REGRESSION_ARTIFACT_CLASSIFICATIONS = {
    "characterization",
    "scope-guard",
    "regression-guard",
    "auxiliary",
}
EFFECT_CLASSES = {
    "read-only-discovery",
    "temporary-instrumentation",
    "verification-artifacts-or-fixtures",
    "production-source-or-configuration",
    "local-environment-or-operational-state",
    "external-systems-or-publication",
    "durable-record-content",
    "durable-record-structure-or-lifecycle",
}
ASYNC_DELIVERY_STAGES = {
    "trigger-and-inputs",
    "operation-identity",
    "result-or-error",
    "transformation",
    "state-or-cache-update",
    "notification-or-invalidation-boundary",
    "derived-consumer",
    "terminal-observable",
    "cleanup-retry-stale-or-duplicate",
}
ASYNC_STAGE_STATUSES = {"observed", "not-applicable", "blocked", "unknown"}
RECOVERY_RESULTS = {
    "BLOCKED",
    "AWAITING-DECISION",
}
DECISION_ALIGNMENT_RESULTS = {
    "CONTINUE-INVESTIGATION",
    "AWAITING-COLLABORATOR",
    "DIRECTION-ALIGNED",
}
SCENARIO_COVERAGE_RESULTS = {
    "CONTINUE-INVESTIGATION",
    "AWAITING-COLLABORATOR",
    "SCENARIO-ALIGNED",
}
SCENARIO_EFFORT_LEVELS = {"light", "standard", "high"}
SCENARIO_SOURCE_CLASSES = {
    "intent-and-authority",
    "inspected-system-surface",
    "risk-and-history",
}
SCENARIO_COVERAGE_DISPOSITIONS = {
    "planned",
    "excluded-with-reason",
}
SCENARIO_EXECUTION_RESULTS = {
    "passed",
    "failed-product",
    "failed-environment",
    "blocked",
    "not-run",
    "partial",
    "invalidated",
}
SCENARIO_ALIGNMENT_BASIS_TYPES = {
    "current-collaborator-response",
    "prior-scope-specific-delegation",
    "light-evidence-basis",
    "none",
}
CLAIM_BASES = {"observed", "reported", "inferred", "assumed"}
VERIFICATION_STATUSES = {
    "unverified",
    "partially-supported",
    "verified-within-scope",
    "refuted",
    "unknown",
    "invalidated",
}
OBSERVABLE_VERIFICATION_DISPOSITIONS = {
    "executed",
    "collaborative",
    "reproducible-handoff",
    "blocked",
    "not-applicable",
}
OBSERVABLE_VERIFICATION_COVERAGE = {
    "direct",
    "representative",
    "supporting-only",
    "not-applicable",
}
OBSERVABLE_VERIFICATION_RESULTS = {
    "passed",
    "failed-product",
    "failed-environment",
    "partial",
    "not-run",
    "blocked",
    "not-applicable",
}
OBSERVABLE_VERIFICATION_OWNERS = {"agent", "collaborator", "shared", "none"}
OBSERVABLE_VERIFICATION_ACCESS = {
    "available-authorized",
    "collaborator-controlled",
    "unavailable",
    "not-applicable",
}
ACTIVITY_SOURCE_CONSISTENCY_RESULTS = {
    "aligned",
    "mismatch-resolved",
    "mismatch-accepted",
    "blocked",
}
ACTIVITY_BOOTSTRAP_POSTCONDITIONS = {
    "canonical-activity",
    "locator-or-registry",
    "routine-update-delegation",
    "privacy-boundary",
    "retrieval-validation",
}
EPISTEMIC_RECONCILIATION_TRIGGERS = {
    "epistemic-discontinuity",
    "explicit-directional-rejection",
}
RECONCILIATION_SEVERITIES = {"REALIGNMENT", "RECOVERY"}
CAPABILITY_IDS = {
    "work.resolve",
    "activity.resolve",
    "context.resolve",
    "evidence.check",
    "change.investigate",
    "direction.align",
    "scenario.plan",
    "change.ready",
    "change.apply",
    "result.verify",
    "result.audit",
    "record.capture",
    "record.structure",
    "record.store",
    "record.retrieve",
    "authority.request",
    "communication.report",
    "failure.challenge",
    "history.localize",
    "host.guard",
}
CAPABILITY_RESULTS = {
    "CONTINUE",
    "INVESTIGATE",
    "ALIGN",
    "NEEDS-AUTHORITY",
    "RECONCILE",
    "ESCALATE",
    "BLOCKED",
    "DONE",
}
CAPABILITY_MUTATION_RESULTS = {"ALLOWED", "DENIED"}
TOOL_EVIDENCE_LANES = {
    "static-or-semantic",
    "focused-execution",
    "build-lint-or-diagnostics",
    "runtime-or-logs",
    "interface",
    "api-or-data",
    "history",
    "manual",
    "other",
}
TOOL_RESULT_STATUSES = {"usable", "partial", "untrusted", "failed", "blocked"}
TOOL_CONTINUATIONS = {"stop", "follow-up", "fallback", "escalate"}
TOOL_DETAIL_LEVELS = {"summary", "exact-locations"}
DIAGNOSTIC_RESULTS = {"clean", "bounded-residual", "blocked", "not-applicable"}
DIAGNOSTIC_ATTRIBUTIONS = {"introduced", "modified", "pre-existing", "unknown"}
DIAGNOSTIC_DISPOSITIONS = {"blocks-completion", "accepted-residual"}
READINESS_INVALIDATION_CAUSES = {
    "material-correction",
    "source-state-change",
    "new-consumer",
    "scope-change",
    "required-tool-failure",
    "refuted-hypothesis",
    "authority-change",
    "verification-plan-change",
    "effect-scope-change",
    "observable-bridge-change",
    "new-state",
    "new-contract-dimension",
    "new-scenario",
    "scenario-coverage-change",
    "epistemic-discontinuity",
    "explicit-directional-rejection",
    "activity-source-mismatch",
    "other",
}
LOAD_SUCCESS_STATUSES = {"observed", "passed"}
UNDERSTANDING_SUCCESS_STATUSES = {"observed", "passed", "reported"}
ACTIVITY_TRANSITION_RESULTS = {
    "loaded",
    "created",
    "planned-and-awaiting-approval",
    "no-record-with-valid-reason",
    "blocked",
}
ACTIVITY_RECORD_STATES = {
    "existing-delegated",
    "newly-created",
    "missing",
    "unresolved",
}
DURABLE_GATE_CONDITIONS = {
    "cross-session-continuity",
    "handoff-or-resumption",
    "material-correction",
    "traceability-load",
    "risk-ambiguity-or-high-risk-boundary",
    "user-or-authorized-workflow",
}
REQUIRED_RECEIPT_FIELDS = {
    "effort-and-reason",
    "outcome-and-material-contract",
    "source-or-environment-state",
    "inspected-surface",
    "falsifiable-claim-and-result",
    "strongest-counterexample",
    "baseline",
    "expected-change-scope",
    "authorized-effect-classes",
    "required-adapters-and-tools",
    "existing-mechanisms-or-solution-classes",
    "verification-and-regression-protection-intent",
    "remaining-blocking-uncertainty",
    "basis-revision-and-invalidations",
}
TRIGGERED_PROTOCOL_RECEIPT_FIELD = "triggered-protocol-results"
SCENARIO_COVERAGE_RECEIPT_FIELD = "scenario-coverage-contract"
ACTIVITY_SOURCE_RECEIPT_FIELD = "activity-source-consistency"
ACTIVITY_TRANSITION_RECEIPT_FIELD = "activity-transition"
CAPTURE_FRESHNESS_RECEIPT_FIELD = "capture-freshness-and-consistency"
OPTIONAL_REQUIREMENT_FLAGS = {
    "identified_activity",
    "observable_equivalence",
    "asynchronous_delivery",
    "effect_scope",
    "correction_recovery",
    "decision_alignment",
    "scenario_coverage",
    "observable_verification",
    "epistemic_reconciliation",
    "canonical_reconciliation",
    "capability_routing",
    "tool_evidence_routing",
    "changed_artifact_diagnostics",
}


def validate_tool_evidence(
    data: dict[str, Any],
    *,
    label: str,
    event_status: Any,
    errors: list[str],
) -> tuple[str | None, str | None]:
    required_data_fields(
        data,
        {
            "tool",
            "claim",
            "evidence_lane",
            "can_establish",
            "cannot_establish",
            "result_status",
            "remaining_gap",
            "continuation",
            "continuation_reason",
            "detail_level",
            "detail_reason",
        },
        label,
        errors,
    )
    tool = data.get("tool")
    nonempty_string(tool, f"{label}.tool", errors)
    nonempty_string(data.get("claim"), f"{label}.claim", errors)
    lane = data.get("evidence_lane")
    if lane not in TOOL_EVIDENCE_LANES:
        errors.append(f"{label}.evidence_lane is invalid")
    if not string_list(data.get("can_establish"), f"{label}.can_establish", errors):
        errors.append(f"{label}.can_establish must not be empty")
    if not string_list(
        data.get("cannot_establish"),
        f"{label}.cannot_establish",
        errors,
    ):
        errors.append(f"{label}.cannot_establish must not be empty")
    result_status = data.get("result_status")
    if result_status not in TOOL_RESULT_STATUSES:
        errors.append(f"{label}.result_status is invalid")
        result_status = None
    remaining_gap = data.get("remaining_gap")
    if not isinstance(remaining_gap, str):
        errors.append(f"{label}.remaining_gap must be a string")
        remaining_gap = ""
    continuation = data.get("continuation")
    if continuation not in TOOL_CONTINUATIONS:
        errors.append(f"{label}.continuation is invalid")
    nonempty_string(
        data.get("continuation_reason"),
        f"{label}.continuation_reason",
        errors,
    )
    if continuation != "stop" and not remaining_gap.strip():
        errors.append(f"{label} continuing route must name a remaining material gap")
    detail_level = data.get("detail_level")
    detail_reason = data.get("detail_reason")
    if detail_level not in TOOL_DETAIL_LEVELS:
        errors.append(f"{label}.detail_level is invalid")
    if not isinstance(detail_reason, str):
        errors.append(f"{label}.detail_reason must be a string")
    elif detail_level == "exact-locations" and not detail_reason.strip():
        errors.append(
            f"{label} exact-locations detail must name the material decision it can change"
        )
    expected_statuses = {
        "usable": {"passed", "observed"},
        "partial": {"partial"},
        "untrusted": {"partial", "unavailable"},
        "failed": {"failed"},
        "blocked": {"blocked", "unavailable"},
    }
    if (
        result_status in expected_statuses
        and event_status not in expected_statuses[result_status]
    ):
        errors.append(f"{label} event status is inconsistent with result_status")
    return tool if isinstance(tool, str) else None, result_status


def validate_diagnostic_coverage(
    data: dict[str, Any],
    *,
    label: str,
    event_status: Any,
    errors: list[str],
) -> str | None:
    required_data_fields(
        data,
        {
            "changed_artifacts",
            "applicable_artifacts",
            "checked_artifacts",
            "unsupported_artifacts",
            "untrusted_artifacts",
            "current_errors",
            "fallback_checks",
            "coverage_lost",
            "result",
        },
        label,
        errors,
    )
    changed = set(
        string_list(
            data.get("changed_artifacts"),
            f"{label}.changed_artifacts",
            errors,
        )
    )
    applicable = set(
        string_list(
            data.get("applicable_artifacts"),
            f"{label}.applicable_artifacts",
            errors,
        )
    )
    checked = set(
        string_list(
            data.get("checked_artifacts"),
            f"{label}.checked_artifacts",
            errors,
        )
    )
    unsupported = set(
        string_list(
            data.get("unsupported_artifacts"),
            f"{label}.unsupported_artifacts",
            errors,
        )
    )
    untrusted = set(
        string_list(
            data.get("untrusted_artifacts"),
            f"{label}.untrusted_artifacts",
            errors,
        )
    )
    fallbacks = string_list(
        data.get("fallback_checks"),
        f"{label}.fallback_checks",
        errors,
    )
    coverage_lost = data.get("coverage_lost")
    if not isinstance(coverage_lost, str):
        errors.append(f"{label}.coverage_lost must be a string")
        coverage_lost = ""
    if not changed:
        errors.append(f"{label}.changed_artifacts must not be empty")
    if applicable & unsupported:
        errors.append(f"{label} applicable and unsupported artifacts must be disjoint")
    if changed != applicable | unsupported:
        errors.append(
            f"{label} changed artifacts must be partitioned into applicable and unsupported"
        )
    if not checked <= applicable:
        errors.append(f"{label}.checked_artifacts must be applicable artifacts")
    if not untrusted <= applicable:
        errors.append(f"{label}.untrusted_artifacts must be applicable artifacts")
    if checked & untrusted:
        errors.append(f"{label} checked and untrusted artifacts must be disjoint")

    current_errors = data.get("current_errors")
    if not isinstance(current_errors, list):
        errors.append(f"{label}.current_errors must be an array")
        current_errors = []
    blocking_error = False
    accepted_residual = False
    for index, item in enumerate(current_errors):
        item_label = f"{label}.current_errors[{index}]"
        if not exact_keys(
            item,
            label=item_label,
            required={
                "artifact",
                "diagnostic",
                "attribution",
                "evidence",
                "disposition",
                "authority",
            },
            errors=errors,
        ):
            continue
        artifact = item.get("artifact")
        for field in {"artifact", "diagnostic", "evidence"}:
            nonempty_string(item.get(field), f"{item_label}.{field}", errors)
        if artifact not in applicable:
            errors.append(f"{item_label}.artifact must be applicable")
        attribution = item.get("attribution")
        disposition = item.get("disposition")
        if attribution not in DIAGNOSTIC_ATTRIBUTIONS:
            errors.append(f"{item_label}.attribution is invalid")
        if disposition not in DIAGNOSTIC_DISPOSITIONS:
            errors.append(f"{item_label}.disposition is invalid")
        if not isinstance(item.get("authority"), str):
            errors.append(f"{item_label}.authority must be a string")
        if disposition == "accepted-residual":
            accepted_residual = True
            if attribution != "pre-existing":
                errors.append(
                    f"{item_label} only a verified pre-existing error may be accepted"
                )
            nonempty_string(item.get("authority"), f"{item_label}.authority", errors)
        if attribution in {"introduced", "modified", "unknown"}:
            blocking_error = True
            if disposition != "blocks-completion":
                errors.append(
                    f"{item_label} unattributed or changed error must block completion"
                )
        if disposition == "blocks-completion":
            blocking_error = True

    result = data.get("result")
    if result not in DIAGNOSTIC_RESULTS:
        errors.append(f"{label}.result is invalid")
        return None
    if result == "clean":
        if event_status != "passed":
            errors.append(f"{label} clean result requires passed event status")
        if checked != applicable or untrusted or current_errors:
            errors.append(
                f"{label} clean result requires trusted coverage and no current errors"
            )
    elif result == "not-applicable":
        if event_status != "observed":
            errors.append(f"{label} not-applicable result requires observed event status")
        if applicable or checked or untrusted or current_errors:
            errors.append(
                f"{label} not-applicable result cannot contain applicable diagnostics"
            )
        if not coverage_lost.strip():
            errors.append(f"{label} not-applicable result must state its boundary")
    elif result == "bounded-residual":
        if event_status != "partial":
            errors.append(f"{label} bounded-residual result requires partial event status")
        if blocking_error:
            errors.append(f"{label} blocking current errors cannot be a bounded residual")
        if checked | untrusted != applicable:
            errors.append(
                f"{label} bounded residual must account for every applicable artifact"
            )
        if not (accepted_residual or untrusted):
            errors.append(f"{label} bounded residual must identify an actual residual")
        if untrusted and (not fallbacks or not coverage_lost.strip()):
            errors.append(
                f"{label} untrusted diagnostics require fallback and lost coverage"
            )
    elif result == "blocked":
        if event_status not in {"blocked", "failed", "partial"}:
            errors.append(f"{label} blocked result has invalid event status")
        if not (blocking_error or untrusted or checked != applicable):
            errors.append(f"{label} blocked result must identify an unresolved diagnostic gap")
    return result


def validate_verification_disposition(
    data: dict[str, Any],
    *,
    label: str,
    event_status: Any,
    errors: list[str],
) -> tuple[str | None, str | None, str | None]:
    required_data_fields(
        data,
        {
            "observable_contract",
            "entry_surface",
            "actor_state_and_authority",
            "data_and_environment",
            "steps",
            "expected_observations",
            "evidence_to_retain",
            "cleanup_or_restoration",
            "execution_owner",
            "execution_access",
            "strongest_accessible_check",
            "attempted_by_agent",
            "reason_not_attempted",
            "disposition",
            "coverage",
            "result",
            "evidence",
            "limitations",
        },
        label,
        errors,
    )
    for field in {
        "observable_contract",
        "strongest_accessible_check",
        "cleanup_or_restoration",
        "limitations",
    }:
        nonempty_string(data.get(field), f"{label}.{field}", errors)
    for field in {
        "entry_surface",
        "actor_state_and_authority",
        "data_and_environment",
        "reason_not_attempted",
        "evidence",
    }:
        if not isinstance(data.get(field), str):
            errors.append(f"{label}.{field} must be a string")

    steps = string_list(data.get("steps"), f"{label}.steps", errors)
    expected = string_list(
        data.get("expected_observations"),
        f"{label}.expected_observations",
        errors,
    )
    evidence_to_retain = string_list(
        data.get("evidence_to_retain"),
        f"{label}.evidence_to_retain",
        errors,
    )
    owner = data.get("execution_owner")
    if owner not in OBSERVABLE_VERIFICATION_OWNERS:
        errors.append(f"{label}.execution_owner is invalid")
    execution_access = data.get("execution_access")
    if execution_access not in OBSERVABLE_VERIFICATION_ACCESS:
        errors.append(f"{label}.execution_access is invalid")
    attempted = data.get("attempted_by_agent")
    if not isinstance(attempted, bool):
        errors.append(f"{label}.attempted_by_agent must be boolean")
    if attempted is False:
        nonempty_string(
            data.get("reason_not_attempted"),
            f"{label}.reason_not_attempted",
            errors,
        )

    disposition = data.get("disposition")
    coverage = data.get("coverage")
    result = data.get("result")
    if disposition not in OBSERVABLE_VERIFICATION_DISPOSITIONS:
        errors.append(f"{label}.disposition is invalid")
        disposition = None
    if coverage not in OBSERVABLE_VERIFICATION_COVERAGE:
        errors.append(f"{label}.coverage is invalid")
        coverage = None
    if result not in OBSERVABLE_VERIFICATION_RESULTS:
        errors.append(f"{label}.result is invalid")
        result = None

    complete_handoff = all(
        (
            isinstance(data.get(field), str) and bool(data[field].strip())
            for field in {
                "entry_surface",
                "actor_state_and_authority",
                "data_and_environment",
            }
        )
    ) and bool(steps) and bool(expected) and bool(evidence_to_retain)

    if disposition == "executed":
        if attempted is not True or owner not in {"agent", "shared"}:
            errors.append(f"{label} executed disposition requires an agent attempt")
        if result not in {"passed", "failed-product", "failed-environment", "partial"}:
            errors.append(f"{label} executed disposition has an unexecuted result")
        if not complete_handoff:
            errors.append(f"{label} executed disposition lacks reproducible conditions")
    elif disposition == "collaborative":
        if owner not in {"collaborator", "shared"}:
            errors.append(f"{label} collaborative disposition has invalid owner")
        if result not in {"passed", "failed-product", "failed-environment", "partial"}:
            errors.append(f"{label} collaborative disposition has an unexecuted result")
        if not complete_handoff:
            errors.append(f"{label} collaborative disposition lacks reproducible conditions")
    elif disposition == "reproducible-handoff":
        if owner not in {"collaborator", "shared"}:
            errors.append(f"{label} handoff requires collaborator or shared ownership")
        if result not in {"not-run", "partial"}:
            errors.append(f"{label} handoff must remain not-run or partial")
        if event_status not in {"not-run", "partial"}:
            errors.append(f"{label} handoff event status must be not-run or partial")
        if not complete_handoff:
            errors.append(f"{label} handoff is missing executable details")
    elif disposition == "blocked":
        if result not in {"blocked", "failed-environment"}:
            errors.append(f"{label} blocked disposition has invalid result")
        if event_status not in {"blocked", "failed", "unavailable"}:
            errors.append(f"{label} blocked disposition has invalid event status")
        nonempty_string(data.get("evidence"), f"{label}.evidence", errors)
    elif disposition == "not-applicable":
        if owner != "none" or result != "not-applicable" or coverage != "not-applicable":
            errors.append(f"{label} not-applicable disposition is inconsistent")
        if event_status != "observed":
            errors.append(f"{label} not-applicable event status must be observed")

    if execution_access == "available-authorized" and (
        attempted is not True or disposition not in {"executed", "collaborative"}
    ):
        errors.append(
            f"{label} leaves an available authorized observable check unattempted"
        )
    elif execution_access == "collaborator-controlled" and disposition not in {
        "collaborative",
        "reproducible-handoff",
    }:
        errors.append(
            f"{label} collaborator-controlled access has an inconsistent disposition"
        )
    elif execution_access == "unavailable" and disposition != "blocked":
        errors.append(f"{label} unavailable access must remain blocked")
    elif execution_access == "not-applicable" and disposition != "not-applicable":
        errors.append(f"{label} not-applicable access has an inconsistent disposition")

    if disposition in {"executed", "collaborative"}:
        expected_status = {
            "passed": "passed",
            "failed-product": "failed",
            "failed-environment": "failed",
            "partial": "partial",
        }.get(result)
        if expected_status is not None and event_status != expected_status:
            errors.append(f"{label} event status is inconsistent with result")

    return disposition, result, coverage


def load_json(path: Path, *, bounded: bool = True) -> Any:
    if bounded:
        with path.open("rb") as stream:
            raw = stream.read(MAX_TRACE_BYTES + 1)
        if len(raw) > MAX_TRACE_BYTES:
            raise ValueError(f"trace exceeds {MAX_TRACE_BYTES} bytes")
        return json.loads(raw.decode("utf-8"))
    return json.loads(path.read_text(encoding="utf-8"))


def schema_values() -> tuple[set[str], set[str]]:
    schema = load_json(SCHEMA_FILE, bounded=False)
    event_properties = schema["$defs"]["event"]["properties"]
    return set(event_properties["type"]["enum"]), set(event_properties["status"]["enum"])


def exact_keys(
    value: Any,
    *,
    label: str,
    required: set[str],
    optional: set[str] | None = None,
    errors: list[str],
) -> bool:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object")
        return False
    optional = optional or set()
    keys = set(value)
    missing = sorted(required - keys)
    extra = sorted(keys - required - optional)
    if missing:
        errors.append(f"{label} is missing fields: {missing}")
    if extra:
        errors.append(f"{label} has unsupported fields: {extra}")
    return not missing and not extra


def nonempty_string(value: Any, label: str, errors: list[str]) -> bool:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label} must be a non-empty string")
        return False
    return True


def string_list(value: Any, label: str, errors: list[str]) -> list[str]:
    if not isinstance(value, list) or any(
        not isinstance(item, str) or not item.strip() for item in value
    ):
        errors.append(f"{label} must be an array of non-empty strings")
        return []
    if len(value) != len(set(value)):
        errors.append(f"{label} must not contain duplicates")
    return value


def required_data_fields(
    value: Any,
    fields: set[str],
    label: str,
    errors: list[str],
) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object")
        return {}
    missing = sorted(fields - set(value))
    if missing:
        errors.append(f"{label} is missing fields: {missing}")
    return value


def validate_effect_list(value: Any, label: str, errors: list[str]) -> set[str]:
    effects = set(string_list(value, label, errors))
    unknown = sorted(effects - EFFECT_CLASSES)
    if unknown:
        errors.append(f"{label} contains unknown effect classes: {unknown}")
    return effects


def validate_observable_equivalence(
    value: Any,
    *,
    label: str,
    ready: bool,
    errors: list[str],
) -> None:
    artifact = required_data_fields(
        value,
        {
            "observable_property",
            "authority",
            "surface_a",
            "surface_b",
            "comparison_dimensions",
            "equivalence",
            "source_of_truth_and_authority",
            "causal_hypothesis",
            "supporting_evidence",
            "missing_bridge",
            "bridge_complete",
            "action_permitted",
        },
        label,
        errors,
    )
    for field in {
        "observable_property",
        "authority",
        "surface_a",
        "surface_b",
        "source_of_truth_and_authority",
        "causal_hypothesis",
        "supporting_evidence",
        "missing_bridge",
    }:
        nonempty_string(artifact.get(field), f"{label}.{field}", errors)
    dimensions = string_list(
        artifact.get("comparison_dimensions"),
        f"{label}.comparison_dimensions",
        errors,
    )
    if not dimensions:
        errors.append(f"{label}.comparison_dimensions must not be empty")
    equivalence = artifact.get("equivalence")
    if equivalence not in {"verified", "refuted", "unknown"}:
        errors.append(f"{label}.equivalence is invalid")
    if not isinstance(artifact.get("bridge_complete"), bool):
        errors.append(f"{label}.bridge_complete must be boolean")
    action = artifact.get("action_permitted")
    if action not in {"investigate", "instrument", "implement", "stop"}:
        errors.append(f"{label}.action_permitted is invalid")
    if ready and (
        equivalence != "verified"
        or artifact.get("bridge_complete") is not True
        or action != "implement"
    ):
        errors.append(
            f"{label} cannot support READY without verified equivalence, "
            "a complete bridge, and implementation authority"
        )


def validate_async_delivery(
    value: Any,
    *,
    label: str,
    ready: bool,
    errors: list[str],
) -> None:
    artifact = required_data_fields(
        value,
        {
            "stages",
            "upstream_value",
            "downstream_outcome",
            "source_mechanism_decision",
            "propagation_checked_before_source_replacement",
            "coverage_limit",
        },
        label,
        errors,
    )
    stages = artifact.get("stages")
    if not isinstance(stages, dict):
        errors.append(f"{label}.stages must be an object")
        stages = {}
    missing_stages = sorted(ASYNC_DELIVERY_STAGES - set(stages))
    extra_stages = sorted(set(stages) - ASYNC_DELIVERY_STAGES)
    if missing_stages:
        errors.append(f"{label}.stages is missing stages: {missing_stages}")
    if extra_stages:
        errors.append(f"{label}.stages has unsupported stages: {extra_stages}")
    for stage, status in stages.items():
        if status not in ASYNC_STAGE_STATUSES:
            errors.append(f"{label}.stages.{stage} has invalid status")
    upstream = artifact.get("upstream_value")
    if upstream not in {"correct", "incorrect", "unknown", "not-observed"}:
        errors.append(f"{label}.upstream_value is invalid")
    downstream = artifact.get("downstream_outcome")
    if downstream not in {
        "current",
        "stale",
        "missing",
        "duplicated",
        "wrong",
        "unknown",
        "not-observed",
    }:
        errors.append(f"{label}.downstream_outcome is invalid")
    source_decision = artifact.get("source_mechanism_decision")
    if source_decision not in {"retained", "replacement-supported", "not-applicable"}:
        errors.append(f"{label}.source_mechanism_decision is invalid")
    propagation_checked = artifact.get(
        "propagation_checked_before_source_replacement"
    )
    if not isinstance(propagation_checked, bool):
        errors.append(
            f"{label}.propagation_checked_before_source_replacement must be boolean"
        )
    nonempty_string(artifact.get("coverage_limit"), f"{label}.coverage_limit", errors)
    if ready and any(
        stages.get(stage) in {"blocked", "unknown"} for stage in ASYNC_DELIVERY_STAGES
    ):
        errors.append(f"{label} cannot support READY with blocked or unknown stages")
    if (
        upstream == "correct"
        and downstream in {"stale", "missing", "duplicated", "wrong"}
        and source_decision == "replacement-supported"
        and propagation_checked is not True
    ):
        errors.append(
            f"{label} replaces an upstream source before checking downstream propagation"
        )


def validate_decision_alignment(
    data: dict[str, Any],
    *,
    label: str,
    errors: list[str],
) -> str | None:
    required_data_fields(
        data,
        {
            "current_contract_and_surface",
            "material_observations",
            "active_hypotheses",
            "strongest_counterevidence",
            "material_unknowns",
            "solution_classes_and_consequences",
            "decision_criteria_and_authority",
            "recommended_direction_and_basis",
            "collaborator_decision_required",
            "decision_or_delegated_basis",
            "result",
        },
        label,
        errors,
    )
    for field in {
        "current_contract_and_surface",
        "material_observations",
        "active_hypotheses",
        "strongest_counterevidence",
        "material_unknowns",
        "solution_classes_and_consequences",
        "decision_criteria_and_authority",
        "recommended_direction_and_basis",
        "decision_or_delegated_basis",
    }:
        nonempty_string(data.get(field), f"{label}.{field}", errors)
    collaborator_required = data.get("collaborator_decision_required")
    if not isinstance(collaborator_required, bool):
        errors.append(f"{label}.collaborator_decision_required must be boolean")
    result = data.get("result")
    if result not in DECISION_ALIGNMENT_RESULTS:
        errors.append(f"{label}.result is invalid")
        return None
    if result == "AWAITING-COLLABORATOR" and collaborator_required is not True:
        errors.append(
            f"{label} AWAITING-COLLABORATOR requires a collaborator-owned decision"
        )
    if result == "DIRECTION-ALIGNED" and not data.get(
        "decision_or_delegated_basis"
    ):
        errors.append(f"{label} DIRECTION-ALIGNED requires an authority basis")
    return result


def validate_scenario_coverage(
    data: dict[str, Any],
    *,
    label: str,
    errors: list[str],
) -> str | None:
    required_data_fields(
        data,
        {
            "effort_level",
            "observable_contract",
            "in_scope",
            "preserved_behavior",
            "out_of_scope",
            "blast_radius_evidence",
            "tool_limits",
            "source_classes",
            "scenario_groups",
            "material_items",
            "scenarios",
            "coverage_mappings",
            "explicit_omissions",
            "residual_risk",
            "product_uncertainty",
            "recommendation",
            "alignment_basis_type",
            "alignment_basis",
            "result",
        },
        label,
        errors,
    )
    for field in {
        "observable_contract",
        "in_scope",
        "preserved_behavior",
        "out_of_scope",
        "blast_radius_evidence",
        "tool_limits",
        "residual_risk",
        "product_uncertainty",
        "recommendation",
        "alignment_basis",
    }:
        nonempty_string(data.get(field), f"{label}.{field}", errors)

    effort = data.get("effort_level")
    if effort not in SCENARIO_EFFORT_LEVELS:
        errors.append(f"{label}.effort_level is invalid")

    sources = data.get("source_classes")
    if exact_keys(
        sources,
        label=f"{label}.source_classes",
        required=SCENARIO_SOURCE_CLASSES,
        errors=errors,
    ):
        for source_class in sorted(SCENARIO_SOURCE_CLASSES):
            nonempty_string(
                sources[source_class],
                f"{label}.source_classes.{source_class}",
                errors,
            )

    scenario_groups = string_list(
        data.get("scenario_groups"),
        f"{label}.scenario_groups",
        errors,
    )
    material_items = string_list(
        data.get("material_items"),
        f"{label}.material_items",
        errors,
    )

    scenarios = data.get("scenarios")
    scenario_ids: set[str] = set()
    scenario_coverage_dispositions: dict[str, str] = {}
    scenario_execution_results: dict[str, str] = {}
    if not isinstance(scenarios, list):
        errors.append(f"{label}.scenarios must be an array")
        scenarios = []
    scenario_fields = {
        "id",
        "reason",
        "contract_dimension_or_consumer",
        "source_and_status",
        "preconditions",
        "trigger",
        "expected_observable_and_invariant",
        "forbidden_outcome",
        "evidence_lane_and_candidate_guard",
        "coverage_disposition",
        "execution_result",
        "coverage_limit_and_residual_risk",
    }
    scenario_required_fields = scenario_fields - {"execution_result"}
    for scenario_index, scenario in enumerate(scenarios, start=1):
        scenario_label = f"{label}.scenarios[{scenario_index - 1}]"
        if not exact_keys(
            scenario,
            label=scenario_label,
            required=scenario_required_fields,
            optional={"execution_result"},
            errors=errors,
        ):
            continue
        assert isinstance(scenario, dict)
        for field in scenario_fields - {"coverage_disposition", "execution_result"}:
            nonempty_string(
                scenario.get(field),
                f"{scenario_label}.{field}",
                errors,
            )
        scenario_id = scenario.get("id")
        if isinstance(scenario_id, str) and scenario_id.strip():
            if scenario_id in scenario_ids:
                errors.append(f"{label}.scenarios has duplicate id {scenario_id!r}")
            scenario_ids.add(scenario_id)
            if isinstance(scenario.get("coverage_disposition"), str):
                scenario_coverage_dispositions[scenario_id] = scenario[
                    "coverage_disposition"
                ]
            if isinstance(scenario.get("execution_result"), str):
                scenario_execution_results[scenario_id] = scenario["execution_result"]
        coverage_disposition = scenario.get("coverage_disposition")
        if coverage_disposition not in SCENARIO_COVERAGE_DISPOSITIONS:
            errors.append(f"{scenario_label}.coverage_disposition is invalid")
        elif coverage_disposition == "planned":
            if scenario.get("execution_result") not in SCENARIO_EXECUTION_RESULTS:
                errors.append(f"{scenario_label}.execution_result is invalid")
        elif "execution_result" in scenario:
            errors.append(
                f"{scenario_label} excluded scenario must not have an execution_result"
            )

    mappings = data.get("coverage_mappings")
    if not isinstance(mappings, list):
        errors.append(f"{label}.coverage_mappings must be an array")
        mappings = []
    mapped_items: list[str] = []
    excluded_items: set[str] = set()
    mapping_fields = {
        "material_item",
        "disposition",
        "scenario_ids",
        "exclusion_reason",
        "authority",
        "residual_risk",
    }
    for mapping_index, mapping in enumerate(mappings, start=1):
        mapping_label = f"{label}.coverage_mappings[{mapping_index - 1}]"
        if not exact_keys(
            mapping,
            label=mapping_label,
            required=mapping_fields,
            errors=errors,
        ):
            continue
        assert isinstance(mapping, dict)
        item = mapping.get("material_item")
        if nonempty_string(item, f"{mapping_label}.material_item", errors):
            mapped_items.append(item)
            if item not in material_items:
                errors.append(
                    f"{mapping_label}.material_item is not declared in material_items"
                )
        linked_scenarios = string_list(
            mapping.get("scenario_ids"),
            f"{mapping_label}.scenario_ids",
            errors,
        )
        unknown_scenarios = sorted(set(linked_scenarios) - scenario_ids)
        if unknown_scenarios:
            errors.append(
                f"{mapping_label}.scenario_ids references unknown scenarios: "
                f"{unknown_scenarios}"
            )
        for field in {"exclusion_reason", "authority", "residual_risk"}:
            if not isinstance(mapping.get(field), str):
                errors.append(f"{mapping_label}.{field} must be a string")
        disposition = mapping.get("disposition")
        if disposition == "scenario":
            if not linked_scenarios:
                errors.append(
                    f"{mapping_label} scenario disposition requires scenario_ids"
                )
            unusable_scenarios = sorted(
                scenario_id
                for scenario_id in linked_scenarios
                if scenario_coverage_dispositions.get(scenario_id) != "planned"
                or scenario_execution_results.get(scenario_id) == "invalidated"
            )
            if unusable_scenarios:
                errors.append(
                    f"{mapping_label} references invalidated scenarios: "
                    f"{unusable_scenarios}"
                )
        elif disposition == "excluded-with-reason":
            nonexcluded_scenarios = sorted(
                scenario_id
                for scenario_id in linked_scenarios
                if scenario_coverage_dispositions.get(scenario_id)
                != "excluded-with-reason"
            )
            if nonexcluded_scenarios:
                errors.append(
                    f"{mapping_label} excluded disposition references nonexcluded "
                    f"scenarios: {nonexcluded_scenarios}"
                )
            for field in {"exclusion_reason", "authority", "residual_risk"}:
                nonempty_string(
                    mapping.get(field),
                    f"{mapping_label}.{field}",
                    errors,
                )
            if isinstance(item, str) and item.strip():
                excluded_items.add(item)
        else:
            errors.append(f"{mapping_label}.disposition is invalid")

    duplicate_mappings = sorted(
        {item for item in mapped_items if mapped_items.count(item) > 1}
    )
    if duplicate_mappings:
        errors.append(
            f"{label}.coverage_mappings maps material items more than once: "
            f"{duplicate_mappings}"
        )

    explicit_omissions = set(
        string_list(
            data.get("explicit_omissions"),
            f"{label}.explicit_omissions",
            errors,
        )
    )
    if explicit_omissions != excluded_items:
        errors.append(
            f"{label}.explicit_omissions must equal excluded material items"
        )

    result = data.get("result")
    if result not in SCENARIO_COVERAGE_RESULTS:
        errors.append(f"{label}.result is invalid")
        return None

    basis_type = data.get("alignment_basis_type")
    if basis_type not in SCENARIO_ALIGNMENT_BASIS_TYPES:
        errors.append(f"{label}.alignment_basis_type is invalid")
    if result == "SCENARIO-ALIGNED":
        if not scenario_groups:
            errors.append(f"{label}.scenario_groups must not be empty when aligned")
        if not material_items:
            errors.append(f"{label}.material_items must not be empty when aligned")
        if not scenarios:
            errors.append(f"{label}.scenarios must not be empty when aligned")
        missing_mappings = sorted(set(material_items) - set(mapped_items))
        if missing_mappings:
            errors.append(
                f"{label} aligned coverage leaves material items unmapped: "
                f"{missing_mappings}"
            )
        if effort in {"standard", "high"} and basis_type not in {
            "current-collaborator-response",
            "prior-scope-specific-delegation",
        }:
            errors.append(
                f"{label} {effort} alignment requires a current collaborator "
                "response or prior scope-specific delegation"
            )
        if effort == "light" and basis_type not in {
            "current-collaborator-response",
            "prior-scope-specific-delegation",
            "light-evidence-basis",
        }:
            errors.append(f"{label} light alignment has no valid basis")
    elif result == "AWAITING-COLLABORATOR" and basis_type != "none":
        errors.append(
            f"{label} AWAITING-COLLABORATOR must not claim an alignment basis"
        )
    return result


def validate_scenario_seed(
    data: dict[str, Any], *, label: str, errors: list[str]
) -> bool:
    required_data_fields(
        data,
        {
            "basis_revision",
            "provisional_contract",
            "scenario_ids",
            "source_and_uncertainty",
        },
        label,
        errors,
    )
    revision = data.get("basis_revision")
    if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
        errors.append(f"{label}.basis_revision must be a positive integer")
    nonempty_string(
        data.get("provisional_contract"), f"{label}.provisional_contract", errors
    )
    scenarios = string_list(data.get("scenario_ids"), f"{label}.scenario_ids", errors)
    if not scenarios:
        errors.append(f"{label}.scenario_ids must not be empty")
    nonempty_string(
        data.get("source_and_uncertainty"),
        f"{label}.source_and_uncertainty",
        errors,
    )
    return bool(scenarios) and isinstance(revision, int) and revision >= 1


def validate_storage_preflight(
    value: Any, *, label: str, errors: list[str]
) -> bool:
    fields = {
        "owner_and_subject",
        "audience",
        "repository_relationship",
        "backend_access",
        "versioning_or_ignore_state",
        "synchronization_or_publication_exposure",
        "sensitivity",
        "retention_and_deletion",
        "recovery_and_discovery",
        "retrieval_needs",
        "existing_store_result",
        "recommendation_basis",
    }
    if not exact_keys(value, label=label, required=fields, errors=errors):
        return False
    assert isinstance(value, dict)
    valid = True
    for field in fields:
        valid = nonempty_string(value.get(field), f"{label}.{field}", errors) and valid
    return valid


def validate_regression_artifact(
    data: dict[str, Any],
    *,
    label: str,
    protection_status: str,
    errors: list[str],
) -> None:
    if protection_status not in {"existing-sufficient", "added-or-updated"}:
        return
    artifact = required_data_fields(
        data.get("artifact"),
        {
            "observable_contract",
            "pre_change_state",
            "post_change_state",
            "discriminating_behavior",
            "classification",
            "non_coverage",
            "execution_conditions",
            "recurrence_evidence",
        },
        f"{label}.artifact",
        errors,
    )
    for field in {
        "observable_contract",
        "pre_change_state",
        "post_change_state",
        "discriminating_behavior",
        "non_coverage",
        "execution_conditions",
        "recurrence_evidence",
    }:
        nonempty_string(
            artifact.get(field),
            f"{label}.artifact.{field}",
            errors,
        )
    classification = artifact.get("classification")
    if classification not in REGRESSION_ARTIFACT_CLASSIFICATIONS:
        errors.append(f"{label}.artifact.classification is invalid")
    elif classification != "regression-guard":
        errors.append(
            f"{label} cannot use {classification!r} as contract regression protection"
        )


def validate_recovery_event(
    data: dict[str, Any],
    *,
    label: str,
    epistemic_hard_stop: bool = False,
    errors: list[str],
) -> str | None:
    required_data_fields(
        data,
        {
            "current_contract",
            "corrected_or_unsupported_claims",
            "invalidated_dependencies",
            "current_source_and_external_state",
            "artifact_classifications",
            "safe_options_and_recommendation",
            "authority_still_required",
            "result",
        },
        label,
        errors,
    )
    for field in {
        "current_contract",
        "current_source_and_external_state",
        "safe_options_and_recommendation",
        "authority_still_required",
    }:
        nonempty_string(data.get(field), f"{label}.{field}", errors)
    for field in {
        "corrected_or_unsupported_claims",
        "invalidated_dependencies",
        "artifact_classifications",
    }:
        values = string_list(data.get(field), f"{label}.{field}", errors)
        if not values:
            errors.append(f"{label}.{field} must not be empty")
    result = data.get("result")
    if result not in RECOVERY_RESULTS:
        errors.append(f"{label}.result is invalid")
        return None
    if epistemic_hard_stop:
        required_data_fields(
            data,
            {
                "severity",
                "trigger",
                "prior_material_claim",
                "prior_basis",
                "prior_verification_status",
                "prior_source",
                "new_evidence_or_rejection",
                "new_basis",
                "new_verification_status",
                "new_source",
                "change_in_belief_or_action",
                "canonical_current_understanding",
                "dependent_artifacts_exist",
                "evidence_based_question",
                "turn_boundary",
            },
            label,
            errors,
        )
        for field in {
            "prior_material_claim",
            "prior_source",
            "new_evidence_or_rejection",
            "new_source",
            "change_in_belief_or_action",
            "canonical_current_understanding",
            "evidence_based_question",
        }:
            nonempty_string(data.get(field), f"{label}.{field}", errors)
        if data.get("prior_basis") not in CLAIM_BASES:
            errors.append(f"{label}.prior_basis is invalid")
        if data.get("new_basis") not in CLAIM_BASES:
            errors.append(f"{label}.new_basis is invalid")
        if data.get("prior_verification_status") not in VERIFICATION_STATUSES:
            errors.append(f"{label}.prior_verification_status is invalid")
        if data.get("new_verification_status") not in VERIFICATION_STATUSES:
            errors.append(f"{label}.new_verification_status is invalid")
        if data.get("trigger") not in EPISTEMIC_RECONCILIATION_TRIGGERS:
            errors.append(f"{label}.trigger is invalid")
        severity = data.get("severity")
        if severity not in RECONCILIATION_SEVERITIES:
            errors.append(f"{label}.severity is invalid")
        dependent_artifacts = data.get("dependent_artifacts_exist")
        if not isinstance(dependent_artifacts, bool):
            errors.append(f"{label}.dependent_artifacts_exist must be boolean")
        elif dependent_artifacts and severity != "RECOVERY":
            errors.append(
                f"{label} with dependent artifacts must use RECOVERY severity"
            )
        elif not dependent_artifacts and severity != "REALIGNMENT":
            errors.append(
                f"{label} without dependent artifacts must use REALIGNMENT severity"
            )
        if data.get("turn_boundary") is not True:
            errors.append(f"{label}.turn_boundary must be true")
    return result


def validate_canonical_reconciliation(
    data: dict[str, Any],
    *,
    label: str,
    errors: list[str],
) -> bool:
    required_data_fields(
        data,
        {
            "event_id",
            "basis_revision",
            "capture_state",
            "transaction_order",
            "completed_effects",
            "pending_effects",
            "canonical_reconciliation",
            "reasons",
            "canonical_surface",
            "status",
            "current_conclusion",
            "next_action",
            "invalidated_dependencies",
            "pointers",
            "history_preserved",
            "delegation_current",
            "effect_class",
        },
        label,
        errors,
    )
    capture_state = data.get("capture_state")
    capture_complete = capture_state in {"complete", "reconciled"}
    capture_incomplete = capture_state == "capture-incomplete"
    if not capture_complete and not capture_incomplete:
        errors.append(
            f"{label}.capture_state must be complete, reconciled, or capture-incomplete"
        )
    if capture_complete and data.get("canonical_reconciliation") is not True:
        errors.append(f"{label}.canonical_reconciliation must be true")
    if capture_incomplete and data.get("canonical_reconciliation") is not False:
        errors.append(
            f"{label}.canonical_reconciliation must be false for capture-incomplete"
        )
    nonempty_string(data.get("event_id"), f"{label}.event_id", errors)
    revision = data.get("basis_revision")
    if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
        errors.append(f"{label}.basis_revision must be a positive integer")
    order = string_list(data.get("transaction_order"), f"{label}.transaction_order", errors)
    if order != ["event-history", "responsibility-surfaces", "canonical-index", "consistency-check"]:
        errors.append(f"{label}.transaction_order is invalid")
    completed_effects = data.get("completed_effects")
    if not isinstance(completed_effects, list) or not all(
        isinstance(item, str) and item.strip() for item in completed_effects
    ):
        errors.append(f"{label}.completed_effects must be an array of non-empty strings")
    elif capture_complete and not completed_effects:
        errors.append(f"{label}.completed_effects must not be empty after complete capture")
    pending_effects = data.get("pending_effects")
    if not isinstance(pending_effects, list) or not all(
        isinstance(item, str) and item.strip() for item in pending_effects
    ):
        errors.append(f"{label}.pending_effects must be an array of non-empty strings")
    elif capture_complete and pending_effects:
        errors.append(f"{label}.pending_effects must be empty after complete capture")
    elif capture_incomplete and not pending_effects:
        errors.append(f"{label}.pending_effects must name unfinished capture effects")
    reasons = string_list(data.get("reasons"), f"{label}.reasons", errors)
    if not reasons:
        errors.append(f"{label}.reasons must not be empty")
    for field in {
        "canonical_surface",
        "status",
        "current_conclusion",
        "next_action",
    }:
        nonempty_string(data.get(field), f"{label}.{field}", errors)
    string_list(
        data.get("invalidated_dependencies"),
        f"{label}.invalidated_dependencies",
        errors,
    )
    string_list(data.get("pointers"), f"{label}.pointers", errors)
    if not isinstance(data.get("history_preserved"), bool):
        errors.append(f"{label}.history_preserved must be boolean")
    if data.get("delegation_current") is not True:
        errors.append(f"{label}.delegation_current must be true")
    if data.get("effect_class") != "durable-record-content":
        errors.append(f"{label}.effect_class must be durable-record-content")
    return (
        capture_complete
        and data.get("canonical_reconciliation") is True
        and data.get("history_preserved") is True
        and data.get("delegation_current") is True
        and data.get("effect_class") == "durable-record-content"
    )


def validate_shape(trace: Any, errors: list[str]) -> dict[str, Any] | None:
    top_required = {
        "schema_version",
        "skill_revision",
        "case_id",
        "client",
        "session",
        "requirements",
        "events",
        "outcome",
        "violations",
    }
    if not exact_keys(trace, label="trace", required=top_required, errors=errors):
        return trace if isinstance(trace, dict) else None
    assert isinstance(trace, dict)
    if trace["schema_version"] != 1:
        errors.append("schema_version must equal 1")
    nonempty_string(trace["skill_revision"], "skill_revision", errors)
    nonempty_string(trace["case_id"], "case_id", errors)

    if exact_keys(
        trace["client"],
        label="client",
        required={"name", "model", "effort", "tool_access"},
        errors=errors,
    ):
        client = trace["client"]
        for field in ("name", "model", "effort"):
            nonempty_string(client[field], f"client.{field}", errors)
        string_list(client["tool_access"], "client.tool_access", errors)

    if exact_keys(
        trace["session"],
        label="session",
        required={"clean", "source_state"},
        optional={"loaded_skill_digest"},
        errors=errors,
    ):
        session = trace["session"]
        if not isinstance(session["clean"], bool):
            errors.append("session.clean must be boolean")
        nonempty_string(session["source_state"], "session.source_state", errors)
        if "loaded_skill_digest" in session:
            nonempty_string(
                session["loaded_skill_digest"],
                "session.loaded_skill_digest",
                errors,
            )

    if exact_keys(
        trace["requirements"],
        label="requirements",
        required={
            "material_change",
            "required_references",
            "required_tools",
            "regression_protection",
        },
        optional=OPTIONAL_REQUIREMENT_FLAGS,
        errors=errors,
    ):
        requirements = trace["requirements"]
        for field in ("material_change", "regression_protection"):
            if not isinstance(requirements[field], bool):
                errors.append(f"requirements.{field} must be boolean")
        string_list(
            requirements["required_references"],
            "requirements.required_references",
            errors,
        )
        string_list(requirements["required_tools"], "requirements.required_tools", errors)
        for field in sorted(OPTIONAL_REQUIREMENT_FLAGS):
            if field in requirements and not isinstance(requirements[field], bool):
                errors.append(f"requirements.{field} must be boolean")

    if exact_keys(
        trace["outcome"],
        label="outcome",
        required={"status", "summary", "residual_risk"},
        errors=errors,
    ):
        outcome = trace["outcome"]
        if not isinstance(outcome["status"], str) or outcome["status"] not in {
            "completed",
            "partial",
            "blocked",
            "failed",
        }:
            errors.append("outcome.status is invalid")
        nonempty_string(outcome["summary"], "outcome.summary", errors)
        if not isinstance(outcome["residual_risk"], str):
            errors.append("outcome.residual_risk must be a string")

    violations = string_list(trace["violations"], "violations", errors)
    if violations:
        errors.append(f"trace declares behavioral violations: {violations}")
    if not isinstance(trace["events"], list) or not trace["events"]:
        errors.append("events must be a non-empty array")
    return trace


def validate_events(trace: dict[str, Any], errors: list[str]) -> dict[str, Any]:
    allowed_types, allowed_statuses = schema_values()
    events = trace.get("events")
    if not isinstance(events, list):
        return {}

    normalized: list[dict[str, Any]] = []
    for index, event in enumerate(events, start=1):
        label = f"event #{index}"
        if not exact_keys(
            event,
            label=label,
            required={"seq", "type", "status", "evidence", "data"},
            errors=errors,
        ):
            continue
        assert isinstance(event, dict)
        usable = True
        if event["seq"] != index:
            errors.append(f"{label}.seq must equal {index}")
        if not isinstance(event["type"], str) or event["type"] not in allowed_types:
            errors.append(f"{label}.type is invalid: {event['type']!r}")
            usable = False
        if not isinstance(event["status"], str) or event["status"] not in allowed_statuses:
            errors.append(f"{label}.status is invalid: {event['status']!r}")
            usable = False
        nonempty_string(event["evidence"], f"{label}.evidence", errors)
        if not isinstance(event["data"], dict):
            errors.append(f"{label}.data must be an object")
            usable = False
        if usable:
            normalized.append(event)

    return {"events": normalized, "allowed_types": allowed_types}


def event_positions(events: list[dict[str, Any]], event_type: str) -> list[int]:
    return [index for index, event in enumerate(events) if event.get("type") == event_type]


def validate_semantics(trace: dict[str, Any], errors: list[str]) -> dict[str, Any]:
    requirements = trace.get("requirements")
    events = trace.get("events")
    if not isinstance(requirements, dict) or not isinstance(events, list):
        return {}

    outcome = trace.get("outcome")
    outcome_status = outcome.get("status") if isinstance(outcome, dict) else None
    material_change = requirements.get("material_change") is True
    identified_activity = requirements.get("identified_activity") is True
    protection_required = requirements.get("regression_protection") is True
    observable_equivalence_required = (
        requirements.get("observable_equivalence") is True
    )
    asynchronous_delivery_required = (
        requirements.get("asynchronous_delivery") is True
    )
    effect_scope_required = requirements.get("effect_scope") is True
    correction_recovery_required = (
        requirements.get("correction_recovery") is True
    )
    decision_alignment_required = (
        requirements.get("decision_alignment") is True
    )
    scenario_coverage_required = requirements.get("scenario_coverage") is True
    observable_verification_required = (
        requirements.get("observable_verification") is True
    )
    epistemic_reconciliation_required = (
        requirements.get("epistemic_reconciliation") is True
    )
    canonical_reconciliation_required = (
        requirements.get("canonical_reconciliation") is True
    )
    capability_routing_required = requirements.get("capability_routing") is True
    tool_evidence_routing_required = (
        requirements.get("tool_evidence_routing") is True
    )
    changed_artifact_diagnostics_required = (
        requirements.get("changed_artifact_diagnostics") is True
    )
    reference_values = requirements.get("required_references")
    tool_values = requirements.get("required_tools")
    required_references = (
        {item for item in reference_values if isinstance(item, str)}
        if isinstance(reference_values, list)
        else set()
    )
    if identified_activity and "durable-record-protocol.md" not in required_references:
        errors.append(
            "identified activity requirements must include durable-record-protocol.md"
        )
    protocol_reference_requirements: dict[str, set[str]] = {
        "observable_equivalence": {"workflow.md", "verification.md"},
        "asynchronous_delivery": {"workflow.md"},
        "effect_scope": {"workflow.md"},
        "correction_recovery": {"workflow.md", "epistemic-integrity.md"},
        "decision_alignment": {"workflow.md"},
        "scenario_coverage": {"verification.md"},
        "observable_verification": {"verification.md"},
        "epistemic_reconciliation": {"workflow.md", "epistemic-integrity.md"},
        "canonical_reconciliation": {"continuous-activity-capture.md"},
        "tool_evidence_routing": {"context-layers.md"},
        "changed_artifact_diagnostics": {"verification.md"},
    }
    for requirement, references in protocol_reference_requirements.items():
        if requirements.get(requirement) is True:
            missing = sorted(references - required_references)
            if missing:
                errors.append(
                    f"{requirement} requirements must include references: {missing}"
                )
    if protection_required and "verification.md" not in required_references:
        errors.append(
            "regression protection requirements must include verification.md"
        )
    required_tools = (
        {item for item in tool_values if isinstance(item, str)}
        if isinstance(tool_values, list)
        else set()
    )

    loaded_references: set[str] = set()
    satisfied_tools: set[str] = set()
    active_ready = False
    ready_positions: list[int] = []
    transition_positions: list[int] = []
    context_bootstrap_positions: list[int] = []
    gate_trigger_positions: list[int] = []
    investigation_positions: list[int] = []
    mutation_positions: list[int] = []
    verification_positions: list[int] = []
    verification_disposition_positions: list[int] = []
    protection_positions: list[int] = []
    audit_positions: list[int] = []
    decision_alignment_positions: list[int] = []
    scenario_coverage_positions: list[int] = []
    scenario_seed_positions: list[int] = []
    recovery_positions: list[int] = []
    hard_stop_invalidation_positions: list[int] = []
    hard_stop_receipt_positions: list[int] = []
    canonical_reconciliation_positions: list[int] = []
    capture_incomplete_positions: list[int] = []
    audit_correction_positions: list[int] = []
    capability_route_positions: list[int] = []
    tool_evidence_positions: list[int] = []
    diagnostic_coverage_positions: list[int] = []
    correction_invalidation_positions: list[int] = []
    successful_verification_positions: list[int] = []
    successful_audit_positions: list[int] = []
    activation_seen = False
    skill_load_seen = False
    provisional_seen = False
    evidence_backed_seen = False
    evidence_backed_fresh = False
    latest_evidence_backed_position = -1
    activity_transition_valid = not identified_activity
    context_bootstrap_valid = not identified_activity
    latest_activity_transition_result = "not-applicable"
    current_basis_revision = 1
    capture_pending = False
    pending_capture_event_id = ""
    last_capture_event = ""
    capture_event_states: dict[str, str] = {}
    pending_gate_conditions: set[str] = set()
    authorized_effect_classes: set[str] = set()
    recovery_required = False
    recovery_waits_for_new_readiness = False
    latest_recovery_position = -1
    decision_alignment_current = not decision_alignment_required
    latest_decision_alignment_position = -1
    scenario_coverage_current = not scenario_coverage_required
    latest_scenario_coverage_position = -1
    epistemic_hard_stop_pending = False
    epistemic_hard_stop_receipt_seen = False
    epistemic_hard_stop_trigger: str | None = None
    epistemic_hard_stop_dependent_artifacts = False
    corrections_by_direction: dict[str, int] = {}
    canonical_reconciliation_pending = False
    delegated_record_active = False
    delegated_capture_required = False
    latest_mutation_route_position = -1
    latest_mutation_route_allowed = False
    activity_source_consistency_current = not identified_activity
    latest_verification_disposition: tuple[str | None, str | None, str | None] = (
        None,
        None,
        None,
    )
    latest_diagnostic_result: str | None = None

    for index, event in enumerate(events):
        event_type = event.get("type")
        data = event.get("data") if isinstance(event.get("data"), dict) else {}
        if event_type == "skill-activation":
            activation_seen = event.get("status") in LOAD_SUCCESS_STATUSES
        elif event_type == "skill-load":
            skill_load_seen = event.get("status") in LOAD_SUCCESS_STATUSES
        elif event_type == "context-bootstrap":
            required_data_fields(
                data,
                {
                    "discovery_surfaces",
                    "verified_matches",
                    "residual_discovery_limit",
                    "result",
                },
                f"event #{index + 1}.data",
                errors,
            )
            surfaces = string_list(
                data.get("discovery_surfaces"),
                f"event #{index + 1}.data.discovery_surfaces",
                errors,
            )
            if not surfaces:
                errors.append(
                    f"event #{index + 1}.data.discovery_surfaces must not be empty"
                )
            string_list(
                data.get("verified_matches"),
                f"event #{index + 1}.data.verified_matches",
                errors,
            )
            nonempty_string(
                data.get("residual_discovery_limit"),
                f"event #{index + 1}.data.residual_discovery_limit",
                errors,
            )
            if data.get("result") not in {"resolved", "partial", "blocked"}:
                errors.append(f"event #{index + 1}.data.result is invalid")
            context_bootstrap_valid = (
                event.get("status") in UNDERSTANDING_SUCCESS_STATUSES
                and data.get("result") in {"resolved", "partial"}
                and bool(surfaces)
            )
            context_bootstrap_positions.append(index)
        elif event_type == "capability-route":
            route = required_data_fields(
                data,
                {
                    "capability_id",
                    "result",
                    "basis",
                    "conflict_or_gap",
                    "continue_with",
                    "resume_with",
                    "implementation_mutation",
                },
                f"event #{index + 1}.data",
                errors,
            )
            capability_id = route.get("capability_id")
            result = route.get("result")
            continue_with = route.get("continue_with")
            resume_with = route.get("resume_with")
            mutation_result = route.get("implementation_mutation")
            capability_route_positions.append(index)
            nonempty_string(route.get("basis"), f"event #{index + 1}.data.basis", errors)
            if not isinstance(route.get("conflict_or_gap"), str):
                errors.append(
                    f"event #{index + 1}.data.conflict_or_gap must be a string"
                )
            if capability_id not in CAPABILITY_IDS:
                errors.append(
                    f"event #{index + 1}.data.capability_id is invalid: "
                    f"{capability_id!r}"
                )
            if result not in CAPABILITY_RESULTS:
                errors.append(
                    f"event #{index + 1}.data.result is invalid: {result!r}"
                )
            for field, value in {
                "continue_with": continue_with,
                "resume_with": resume_with,
            }.items():
                if value != "none" and value not in CAPABILITY_IDS:
                    errors.append(
                        f"event #{index + 1}.data.{field} is invalid: {value!r}"
                    )
            if result not in {"BLOCKED", "DONE"} and continue_with == "none":
                errors.append(
                    f"event #{index + 1} nonterminal capability route lacks continue_with"
                )
            if result in {"NEEDS-AUTHORITY", "RECONCILE", "ESCALATE"} and (
                resume_with == "none"
            ):
                errors.append(
                    f"event #{index + 1} interrupting capability route lacks resume_with"
                )
            if mutation_result not in CAPABILITY_MUTATION_RESULTS:
                errors.append(
                    f"event #{index + 1}.data.implementation_mutation is invalid: "
                    f"{mutation_result!r}"
                )
            allowed_route = (
                capability_id == "change.ready"
                and result == "CONTINUE"
                and mutation_result == "ALLOWED"
                and event.get("status") == "allowed"
            )
            if mutation_result == "ALLOWED" and not allowed_route:
                errors.append(
                    f"event #{index + 1} only change.ready CONTINUE may allow mutation"
                )
            latest_mutation_route_position = index if allowed_route else -1
            latest_mutation_route_allowed = allowed_route
        elif event_type == "activity-transition":
            activity_id = data.get("activity_id")
            record_state = data.get("record_state")
            result = data.get("result")
            effort_level = data.get("effort_level")
            basis_revision = data.get("basis_revision")
            pending_capture = data.get("pending_capture")
            pending_capture_event = data.get("pending_capture_event")
            transition_last_capture = data.get("last_capture_event")
            reason = data.get("reason")
            next_action = data.get("next_permitted_action")
            source_state = data.get("source_state")
            delivery_context = data.get("delivery_context")
            consistency_result = data.get("consistency_result")
            consistency_evidence = data.get("consistency_evidence")
            evaluated = set(
                string_list(
                    data.get("evaluated_gate_conditions"),
                    f"event #{index + 1}.data.evaluated_gate_conditions",
                    errors,
                )
            )
            applicable = set(
                string_list(
                    data.get("applicable_gate_conditions"),
                    f"event #{index + 1}.data.applicable_gate_conditions",
                    errors,
                )
            )
            nonempty_string(activity_id, f"event #{index + 1}.data.activity_id", errors)
            if effort_level not in SCENARIO_EFFORT_LEVELS:
                errors.append(f"event #{index + 1}.data.effort_level is invalid")
            if (
                not isinstance(basis_revision, int)
                or isinstance(basis_revision, bool)
                or basis_revision < 1
            ):
                errors.append(
                    f"event #{index + 1}.data.basis_revision must be a positive integer"
                )
            else:
                current_basis_revision = basis_revision
            if not isinstance(pending_capture, bool):
                errors.append(f"event #{index + 1}.data.pending_capture must be boolean")
            if not isinstance(pending_capture_event, str):
                errors.append(
                    f"event #{index + 1}.data.pending_capture_event must be a string"
                )
            elif pending_capture and not pending_capture_event.strip():
                errors.append(
                    f"event #{index + 1} pending capture must name its event identity"
                )
            elif pending_capture is False and pending_capture_event:
                errors.append(
                    f"event #{index + 1} has a pending capture identity without pending capture"
                )
            if not isinstance(transition_last_capture, str):
                errors.append(
                    f"event #{index + 1}.data.last_capture_event must be a string"
                )
            nonempty_string(record_state, f"event #{index + 1}.data.record_state", errors)
            nonempty_string(reason, f"event #{index + 1}.data.reason", errors)
            nonempty_string(
                next_action,
                f"event #{index + 1}.data.next_permitted_action",
                errors,
            )
            nonempty_string(
                source_state,
                f"event #{index + 1}.data.source_state",
                errors,
            )
            nonempty_string(
                delivery_context,
                f"event #{index + 1}.data.delivery_context",
                errors,
            )
            nonempty_string(
                consistency_evidence,
                f"event #{index + 1}.data.consistency_evidence",
                errors,
            )
            if consistency_result not in ACTIVITY_SOURCE_CONSISTENCY_RESULTS:
                errors.append(
                    f"event #{index + 1}.data.consistency_result is invalid"
                )
                activity_source_consistency_current = False
            else:
                activity_source_consistency_current = consistency_result in {
                    "aligned",
                    "mismatch-resolved",
                    "mismatch-accepted",
                }
                if consistency_result == "mismatch-accepted":
                    nonempty_string(
                        data.get("consistency_authority"),
                        f"event #{index + 1}.data.consistency_authority",
                        errors,
                    )
            if not isinstance(result, str) or result not in ACTIVITY_TRANSITION_RESULTS:
                errors.append(f"event #{index + 1}.data.result is invalid")
                activity_transition_valid = False
            else:
                if record_state not in ACTIVITY_RECORD_STATES:
                    errors.append(
                        f"event #{index + 1}.data.record_state is invalid"
                    )
                if not activation_seen or not skill_load_seen:
                    errors.append(
                        f"event #{index + 1} activity transition precedes skill activation or load"
                    )
                if not context_bootstrap_valid or not context_bootstrap_positions:
                    errors.append(
                        f"event #{index + 1} activity transition precedes bootstrap context"
                    )
                if (
                    "durable-record-protocol.md" in required_references
                    and "durable-record-protocol.md" not in loaded_references
                ):
                    errors.append(
                        f"event #{index + 1} activity transition precedes durable-record-protocol.md"
                    )
                unknown_conditions = (evaluated | applicable) - DURABLE_GATE_CONDITIONS
                if unknown_conditions:
                    errors.append(
                        f"event #{index + 1} uses unknown durable gate conditions: "
                        f"{sorted(unknown_conditions)}"
                    )
                if applicable - evaluated:
                    errors.append(
                        f"event #{index + 1} applicable gate conditions were not evaluated: "
                        f"{sorted(applicable - evaluated)}"
                    )
                if record_state == "missing" and not DURABLE_GATE_CONDITIONS.issubset(
                    evaluated
                ):
                    errors.append(
                        f"event #{index + 1} missing-record transition does not evaluate "
                        f"all durable gate conditions: "
                        f"{sorted(DURABLE_GATE_CONDITIONS - evaluated)}"
                    )
                if result == "no-record-with-valid-reason" and applicable:
                    errors.append(
                        f"event #{index + 1} no-record result has applicable gate conditions: "
                        f"{sorted(applicable)}"
                    )
                if result == "no-record-with-valid-reason" and effort_level in {
                    "standard",
                    "high",
                }:
                    nonempty_string(
                        data.get("durable_exception_basis"),
                        f"event #{index + 1}.data.durable_exception_basis",
                        errors,
                    )
                if result == "no-record-with-valid-reason" and pending_gate_conditions:
                    errors.append(
                        f"event #{index + 1} no-record result leaves observed gate triggers unresolved: "
                        f"{sorted(pending_gate_conditions)}"
                    )
                if result in {
                    "no-record-with-valid-reason",
                    "planned-and-awaiting-approval",
                } and record_state != "missing":
                    errors.append(
                        f"event #{index + 1} {result} requires record_state 'missing'"
                    )
                if result == "loaded" and record_state != "existing-delegated":
                    errors.append(
                        f"event #{index + 1} loaded requires record_state 'existing-delegated'"
                    )
                if result == "planned-and-awaiting-approval":
                    validate_storage_preflight(
                        data.get("storage_preflight"),
                        label=f"event #{index + 1}.data.storage_preflight",
                        errors=errors,
                    )
                    if not applicable:
                        errors.append(
                            f"event #{index + 1} planned transition must name an applicable gate condition"
                        )
                    if pending_gate_conditions - applicable:
                        errors.append(
                            f"event #{index + 1} planned transition omits observed gate triggers: "
                            f"{sorted(pending_gate_conditions - applicable)}"
                        )
                    nonempty_string(
                        data.get("plan_digest"),
                        f"event #{index + 1}.data.plan_digest",
                        errors,
                    )
                    planned_postconditions = set(
                        string_list(
                            data.get("planned_postconditions"),
                            f"event #{index + 1}.data.planned_postconditions",
                            errors,
                        )
                    )
                    missing_postconditions = sorted(
                        ACTIVITY_BOOTSTRAP_POSTCONDITIONS - planned_postconditions
                    )
                    if missing_postconditions:
                        errors.append(
                            f"event #{index + 1} planned transition is not outcome-complete: "
                            f"{missing_postconditions}"
                        )
                if result == "created":
                    validate_storage_preflight(
                        data.get("storage_preflight"),
                        label=f"event #{index + 1}.data.storage_preflight",
                        errors=errors,
                    )
                    if record_state != "newly-created":
                        errors.append(
                            f"event #{index + 1} created requires record_state 'newly-created'"
                        )
                    if not DURABLE_GATE_CONDITIONS.issubset(evaluated):
                        errors.append(
                            f"event #{index + 1} created transition does not evaluate all durable gate conditions: "
                            f"{sorted(DURABLE_GATE_CONDITIONS - evaluated)}"
                        )
                    if not applicable:
                        errors.append(
                            f"event #{index + 1} created transition must name an applicable gate condition"
                        )
                    if pending_gate_conditions - applicable:
                        errors.append(
                            f"event #{index + 1} created transition omits observed gate triggers: "
                            f"{sorted(pending_gate_conditions - applicable)}"
                        )
                    nonempty_string(
                        data.get("plan_digest"),
                        f"event #{index + 1}.data.plan_digest",
                        errors,
                    )
                    nonempty_string(
                        data.get("approval_reference"),
                        f"event #{index + 1}.data.approval_reference",
                        errors,
                    )
                    planned_postconditions = set(
                        string_list(
                            data.get("planned_postconditions"),
                            f"event #{index + 1}.data.planned_postconditions",
                            errors,
                        )
                    )
                    missing_postconditions = sorted(
                        ACTIVITY_BOOTSTRAP_POSTCONDITIONS - planned_postconditions
                    )
                    if missing_postconditions:
                        errors.append(
                            f"event #{index + 1} created transition lacks bootstrap postconditions: "
                            f"{missing_postconditions}"
                        )
                    for field in {
                        "canonical_record",
                        "locator_or_registry",
                        "delegation_scope",
                    }:
                        nonempty_string(
                            data.get(field),
                            f"event #{index + 1}.data.{field}",
                            errors,
                        )
                    if data.get("retrieval_verified") is not True:
                        errors.append(
                            f"event #{index + 1}.data.retrieval_verified must be true"
                        )
                resolved = result in {
                    "loaded",
                    "created",
                    "no-record-with-valid-reason",
                }
                expected_statuses = LOAD_SUCCESS_STATUSES if resolved else {"blocked"}
                if event.get("status") not in expected_statuses:
                    errors.append(
                        f"event #{index + 1} transition status is inconsistent with {result}"
                    )
                activity_transition_valid = resolved and not (
                    (applicable or pending_gate_conditions)
                    if result == "no-record-with-valid-reason"
                    else False
                )
                if result in {"loaded", "created"}:
                    if not isinstance(transition_last_capture, str) or not transition_last_capture.strip():
                        errors.append(
                            f"event #{index + 1} delegated transition requires last_capture_event"
                        )
                    if result == "created" and pending_capture is not False:
                        errors.append(
                            f"event #{index + 1} created transition cannot begin with pending capture"
                        )
                    pending_gate_conditions.clear()
                    delegated_record_active = True
                    delegated_capture_required = True
                    last_capture_event = transition_last_capture
                    capture_pending = pending_capture is True
                    pending_capture_event_id = (
                        pending_capture_event
                        if capture_pending
                        and isinstance(pending_capture_event, str)
                        else ""
                    )
                    canonical_reconciliation_pending = capture_pending
                    if "continuous-activity-capture.md" not in required_references:
                        errors.append(
                            f"event #{index + 1} delegated record requires "
                            "continuous-activity-capture.md"
                        )
                else:
                    delegated_record_active = False
                    pending_capture_event_id = ""
                    last_capture_event = ""
                    capture_pending = False
                latest_activity_transition_result = result
            transition_positions.append(index)
        elif event_type == "durable-gate-trigger":
            trigger = data.get("trigger")
            nonempty_string(
                trigger,
                f"event #{index + 1}.data.trigger",
                errors,
            )
            if trigger not in DURABLE_GATE_CONDITIONS:
                errors.append(
                    f"event #{index + 1}.data.trigger is not a recognized durable gate condition"
                )
            else:
                pending_gate_conditions.add(trigger)
            if not identified_activity:
                errors.append(
                    f"event #{index + 1} durable gate trigger has no identified activity"
                )
            if event.get("status") not in {"observed", "reported"}:
                errors.append(f"event #{index + 1} durable gate trigger has invalid status")
            activity_transition_valid = False
            active_ready = False
            evidence_backed_fresh = False
            if delegated_record_active:
                capture_pending = True
                canonical_reconciliation_pending = True
            gate_trigger_positions.append(index)
        elif event_type == "provisional-understanding":
            provisional_seen = event.get("status") in UNDERSTANDING_SUCCESS_STATUSES
            if delegated_record_active and provisional_seen:
                capture_pending = True
        elif event_type == "scenario-seed":
            if not scenario_coverage_required:
                errors.append(
                    f"event #{index + 1} scenario seed has no declared scenario-coverage requirement"
                )
            if validate_scenario_seed(
                data,
                label=f"event #{index + 1}.data",
                errors=errors,
            ) and data.get("basis_revision") != current_basis_revision:
                errors.append(
                    f"event #{index + 1} scenario seed uses stale basis revision"
                )
            if event.get("status") not in UNDERSTANDING_SUCCESS_STATUSES:
                errors.append(f"event #{index + 1} scenario seed has invalid status")
            scenario_seed_positions.append(index)
        elif event_type == "evidence-backed-understanding":
            evidence_backed_seen = event.get("status") in UNDERSTANDING_SUCCESS_STATUSES
            if evidence_backed_seen:
                evidence_backed_fresh = True
                latest_evidence_backed_position = index
                if delegated_record_active:
                    capture_pending = True
        elif event_type == "material-investigation":
            if identified_activity and not activity_transition_valid:
                errors.append(
                    f"event #{index + 1} material investigation occurs without a current activity transition"
                )
            if identified_activity and not context_bootstrap_valid:
                errors.append(
                    f"event #{index + 1} material investigation occurs without bootstrap context"
                )
            if delegated_record_active and capture_pending:
                errors.append(
                    f"event #{index + 1} material investigation occurs before required durable capture"
                )
            if epistemic_hard_stop_pending:
                errors.append(
                    f"event #{index + 1} material investigation occurs before epistemic reconciliation"
                )
            investigation_positions.append(index)
            if delegated_record_active:
                capture_pending = True
        elif event_type == "reference-load":
            reference = data.get("reference")
            if nonempty_string(reference, f"event #{index + 1}.data.reference", errors):
                if event.get("status") in LOAD_SUCCESS_STATUSES:
                    loaded_references.add(reference)
        elif event_type == "tool-invocation":
            tool = data.get("tool")
            result_status: str | None = None
            if tool_evidence_routing_required:
                tool, result_status = validate_tool_evidence(
                    data,
                    label=f"event #{index + 1}.data",
                    event_status=event.get("status"),
                    errors=errors,
                )
                tool_evidence_positions.append(index)
            elif not nonempty_string(tool, f"event #{index + 1}.data.tool", errors):
                tool = None
            if isinstance(tool, str) and (
                event.get("status") in {"passed", "observed"}
                and (not tool_evidence_routing_required or result_status == "usable")
            ):
                satisfied_tools.add(tool)
        elif event_type == "tool-fallback":
            tool = data.get("tool")
            result_status: str | None = None
            if tool_evidence_routing_required:
                tool, result_status = validate_tool_evidence(
                    data,
                    label=f"event #{index + 1}.data",
                    event_status=event.get("status"),
                    errors=errors,
                )
                tool_evidence_positions.append(index)
            elif not nonempty_string(tool, f"event #{index + 1}.data.tool", errors):
                tool = None
            if isinstance(tool, str):
                nonempty_string(
                    data.get("coverage_lost"),
                    f"event #{index + 1}.data.coverage_lost",
                    errors,
                )
                nonempty_string(
                    data.get("effect_on_readiness"),
                    f"event #{index + 1}.data.effect_on_readiness",
                    errors,
                )
                if (
                    data.get("sufficient") is True
                    and event.get("status") in LOAD_SUCCESS_STATUSES
                    and (
                        not tool_evidence_routing_required
                        or result_status == "usable"
                    )
                ):
                    satisfied_tools.add(tool)
                elif data.get("sufficient") is not False:
                    errors.append(f"event #{index + 1}.data.sufficient must be boolean")
        elif event_type == "decision-alignment":
            if not decision_alignment_required:
                errors.append(
                    f"event #{index + 1} decision alignment has no declared requirement"
                )
            result = validate_decision_alignment(
                data,
                label=f"event #{index + 1}.data",
                errors=errors,
            )
            if result == "AWAITING-COLLABORATOR":
                if event.get("status") != "blocked":
                    errors.append(
                        f"event #{index + 1} awaiting alignment status must be blocked"
                    )
                decision_alignment_current = False
            elif result in {"CONTINUE-INVESTIGATION", "DIRECTION-ALIGNED"}:
                if event.get("status") not in UNDERSTANDING_SUCCESS_STATUSES:
                    errors.append(
                        f"event #{index + 1} resolved alignment has invalid status"
                    )
                decision_alignment_current = result == "DIRECTION-ALIGNED"
            else:
                decision_alignment_current = False
            if result == "DIRECTION-ALIGNED" and (
                latest_evidence_backed_position < 0
                or index <= latest_evidence_backed_position
            ):
                errors.append(
                    f"event #{index + 1} DIRECTION-ALIGNED precedes current evidence-backed understanding"
                )
                decision_alignment_current = False
            if epistemic_hard_stop_pending and result in {
                "CONTINUE-INVESTIGATION",
                "DIRECTION-ALIGNED",
            }:
                if not epistemic_hard_stop_receipt_seen:
                    errors.append(
                        f"event #{index + 1} resolves a hard stop before its reconciliation receipt"
                    )
                if data.get("after_hard_stop") is not True:
                    errors.append(
                        f"event #{index + 1}.data.after_hard_stop must be true"
                    )
                nonempty_string(
                    data.get("collaborator_response"),
                    f"event #{index + 1}.data.collaborator_response",
                    errors,
                )
                epistemic_hard_stop_pending = False
                epistemic_hard_stop_receipt_seen = False
                epistemic_hard_stop_trigger = None
                recovery_required = False
                recovery_waits_for_new_readiness = True
            latest_decision_alignment_position = index
            decision_alignment_positions.append(index)
            if delegated_record_active:
                capture_pending = True
        elif event_type == "scenario-coverage":
            if not scenario_coverage_required:
                errors.append(
                    f"event #{index + 1} scenario coverage has no declared requirement"
                )
            result = validate_scenario_coverage(
                data,
                label=f"event #{index + 1}.data",
                errors=errors,
            )
            if result == "AWAITING-COLLABORATOR":
                if event.get("status") != "blocked":
                    errors.append(
                        f"event #{index + 1} awaiting scenario alignment status must be blocked"
                    )
                scenario_coverage_current = False
            elif result in {"CONTINUE-INVESTIGATION", "SCENARIO-ALIGNED"}:
                if event.get("status") not in UNDERSTANDING_SUCCESS_STATUSES:
                    errors.append(
                        f"event #{index + 1} scenario coverage has invalid status"
                    )
                scenario_coverage_current = result == "SCENARIO-ALIGNED"
            else:
                scenario_coverage_current = False
            if result == "SCENARIO-ALIGNED":
                if (
                    latest_evidence_backed_position < 0
                    or index <= latest_evidence_backed_position
                ):
                    errors.append(
                        f"event #{index + 1} SCENARIO-ALIGNED precedes current evidence-backed understanding"
                    )
                    scenario_coverage_current = False
                if not any(position < index for position in investigation_positions):
                    errors.append(
                        f"event #{index + 1} SCENARIO-ALIGNED precedes material investigation"
                    )
                    scenario_coverage_current = False
            latest_scenario_coverage_position = index
            scenario_coverage_positions.append(index)
            if delegated_record_active:
                capture_pending = True
        elif event_type == "readiness":
            readiness_error_count = len(errors)
            result = data.get("result")
            if not isinstance(result, str) or result not in {"READY", "INCOMPLETE", "BLOCKED"}:
                errors.append(f"event #{index + 1}.data.result is invalid")
                active_ready = False
                continue
            if result == "READY":
                missing_transitions = []
                readiness_revision = data.get("basis_revision")
                if (
                    not isinstance(readiness_revision, int)
                    or isinstance(readiness_revision, bool)
                    or readiness_revision != current_basis_revision
                ):
                    missing_transitions.append("current activity-local basis revision")
                if not activation_seen:
                    missing_transitions.append("successful skill activation")
                if not skill_load_seen:
                    missing_transitions.append("successful SKILL.md load")
                if not provisional_seen:
                    missing_transitions.append("provisional understanding")
                if not evidence_backed_seen:
                    missing_transitions.append("evidence-backed understanding")
                elif not evidence_backed_fresh:
                    missing_transitions.append(
                        "refreshed evidence-backed understanding after invalidation"
                    )
                if decision_alignment_required:
                    if not decision_alignment_current:
                        missing_transitions.append("DIRECTION-ALIGNED decision frontier")
                    elif latest_decision_alignment_position <= latest_evidence_backed_position:
                        missing_transitions.append(
                            "decision alignment after current evidence-backed understanding"
                        )
                if scenario_coverage_required:
                    if not scenario_coverage_current:
                        missing_transitions.append("SCENARIO-ALIGNED coverage contract")
                    elif latest_scenario_coverage_position <= latest_evidence_backed_position:
                        missing_transitions.append(
                            "scenario alignment after current evidence-backed understanding"
                        )
                if identified_activity and not activity_transition_valid:
                    missing_transitions.append("resolved activity transition")
                if identified_activity and data.get(
                    "activity_transition_result"
                ) != latest_activity_transition_result:
                    missing_transitions.append("current literal activity-transition result")
                if identified_activity and not activity_source_consistency_current:
                    missing_transitions.append(
                        "resolved activity and source/delivery-state consistency"
                    )
                if delegated_record_active and (
                    "continuous-activity-capture.md" not in loaded_references
                ):
                    missing_transitions.append(
                        "continuous-activity-capture.md for the delegated record"
                    )
                if delegated_record_active:
                    if capture_pending:
                        missing_transitions.append("capture of current material knowledge")
                    if data.get("capture_state") not in {"complete", "reconciled"}:
                        missing_transitions.append("complete durable capture state")
                    if data.get("last_capture_event") != last_capture_event:
                        missing_transitions.append("current last-capture identity")
                elif data.get("capture_state") != "not-applicable":
                    missing_transitions.append("not-applicable capture state")
                if recovery_required:
                    missing_transitions.append("resolved correction recovery")
                if epistemic_hard_stop_pending:
                    missing_transitions.append("resolved epistemic reconciliation")
                if (
                    recovery_waits_for_new_readiness
                    and latest_evidence_backed_position <= latest_recovery_position
                ):
                    missing_transitions.append(
                        "evidence-backed understanding after recovery"
                    )
                if event.get("status") != "passed":
                    missing_transitions.append("passed readiness decision")
                receipt_fields = set(
                    string_list(
                        data.get("receipt_fields"),
                        f"event #{index + 1}.data.receipt_fields",
                        errors,
                    )
                )
                missing_fields = sorted(REQUIRED_RECEIPT_FIELDS - receipt_fields)
                if (
                    observable_equivalence_required
                    or asynchronous_delivery_required
                    or decision_alignment_required
                    or scenario_coverage_required
                ) and TRIGGERED_PROTOCOL_RECEIPT_FIELD not in receipt_fields:
                    missing_fields.append(TRIGGERED_PROTOCOL_RECEIPT_FIELD)
                if (
                    scenario_coverage_required
                    and SCENARIO_COVERAGE_RECEIPT_FIELD not in receipt_fields
                ):
                    missing_fields.append(SCENARIO_COVERAGE_RECEIPT_FIELD)
                if (
                    identified_activity
                    and ACTIVITY_SOURCE_RECEIPT_FIELD not in receipt_fields
                ):
                    missing_fields.append(ACTIVITY_SOURCE_RECEIPT_FIELD)
                if (
                    identified_activity
                    and ACTIVITY_TRANSITION_RECEIPT_FIELD not in receipt_fields
                ):
                    missing_fields.append(ACTIVITY_TRANSITION_RECEIPT_FIELD)
                if (
                    delegated_record_active
                    and CAPTURE_FRESHNESS_RECEIPT_FIELD not in receipt_fields
                ):
                    missing_fields.append(CAPTURE_FRESHNESS_RECEIPT_FIELD)
                if missing_fields:
                    errors.append(
                        f"event #{index + 1} READY is missing receipt fields: {missing_fields}"
                    )
                if observable_equivalence_required:
                    validate_observable_equivalence(
                        data.get("observable_equivalence"),
                        label=f"event #{index + 1}.data.observable_equivalence",
                        ready=True,
                        errors=errors,
                    )
                if asynchronous_delivery_required:
                    validate_async_delivery(
                        data.get("asynchronous_delivery"),
                        label=f"event #{index + 1}.data.asynchronous_delivery",
                        ready=True,
                        errors=errors,
                    )
                if effect_scope_required:
                    authorized_effect_classes = validate_effect_list(
                        data.get("authorized_effect_classes"),
                        f"event #{index + 1}.data.authorized_effect_classes",
                        errors,
                    )
                    if not authorized_effect_classes:
                        errors.append(
                            f"event #{index + 1}.data.authorized_effect_classes "
                            "must not be empty"
                        )
                if correction_recovery_required:
                    nonempty_string(
                        data.get("direction"),
                        f"event #{index + 1}.data.direction",
                        errors,
                    )
                missing_references = sorted(required_references - loaded_references)
                if missing_references:
                    errors.append(
                        f"event #{index + 1} READY precedes required references: {missing_references}"
                    )
                missing_tools = sorted(required_tools - satisfied_tools)
                if missing_tools:
                    errors.append(
                        f"event #{index + 1} READY precedes required tools or sufficient fallbacks: {missing_tools}"
                    )
                if missing_transitions:
                    errors.append(
                        f"event #{index + 1} READY precedes required transitions: "
                        f"{missing_transitions}"
                    )
                active_ready = not (
                    missing_fields
                    or missing_references
                    or missing_tools
                    or missing_transitions
                    or len(errors) > readiness_error_count
                )
                if active_ready:
                    ready_positions.append(index)
                    recovery_waits_for_new_readiness = False
                    corrections_by_direction.clear()
                    if delegated_record_active:
                        capture_pending = True
            else:
                missing = data.get("missing")
                if not isinstance(missing, list) or not missing:
                    errors.append(f"event #{index + 1} {result} must name missing inputs")
                active_ready = False
        elif event_type == "readiness-invalidation":
            prior_revision = data.get("prior_basis_revision")
            new_revision = data.get("new_basis_revision")
            if prior_revision != current_basis_revision:
                errors.append(
                    f"event #{index + 1}.data.prior_basis_revision does not match current basis"
                )
            if (
                not isinstance(new_revision, int)
                or isinstance(new_revision, bool)
                or new_revision != current_basis_revision + 1
            ):
                errors.append(
                    f"event #{index + 1}.data.new_basis_revision must increment current basis by one"
                )
            else:
                current_basis_revision = new_revision
            affected = data.get("affected_fields")
            if not isinstance(affected, list) or not affected:
                errors.append(
                    f"event #{index + 1} invalidation must name affected_fields"
                )
            if event.get("status") != "invalidated":
                errors.append(f"event #{index + 1} invalidation status must be invalidated")
            active_ready = False
            evidence_backed_fresh = False
            latest_mutation_route_allowed = False
            latest_mutation_route_position = -1
            if delegated_record_active:
                capture_pending = True
            if decision_alignment_required:
                decision_alignment_current = False
            if scenario_coverage_required:
                scenario_coverage_current = False
            cause = data.get("cause")
            if cause == "activity-source-mismatch":
                activity_source_consistency_current = False
            if scenario_coverage_required:
                if cause not in READINESS_INVALIDATION_CAUSES:
                    errors.append(f"event #{index + 1}.data.cause is invalid")
                affected_scenarios = string_list(
                    data.get("affected_scenario_items"),
                    f"event #{index + 1}.data.affected_scenario_items",
                    errors,
                )
                if not affected_scenarios:
                    errors.append(
                        f"event #{index + 1}.data.affected_scenario_items "
                        "must not be empty"
                    )
            if epistemic_reconciliation_required:
                if cause not in READINESS_INVALIDATION_CAUSES:
                    errors.append(f"event #{index + 1}.data.cause is invalid")
                if cause in EPISTEMIC_RECONCILIATION_TRIGGERS:
                    dependent_artifacts = data.get("dependent_artifacts_exist")
                    if not isinstance(dependent_artifacts, bool):
                        errors.append(
                            f"event #{index + 1}.data.dependent_artifacts_exist must be boolean"
                        )
                        dependent_artifacts = False
                    applied_before = any(
                        prior.get("type") == "implementation-mutation"
                        and prior.get("status") == "applied"
                        for prior in events[:index]
                    )
                    if applied_before and dependent_artifacts is not True:
                        errors.append(
                            f"event #{index + 1} cannot deny dependent artifacts after applied mutation"
                        )
                    epistemic_hard_stop_pending = True
                    epistemic_hard_stop_receipt_seen = False
                    epistemic_hard_stop_trigger = cause
                    epistemic_hard_stop_dependent_artifacts = dependent_artifacts is True
                    recovery_required = True
                    hard_stop_invalidation_positions.append(index)
            if correction_recovery_required:
                if cause not in READINESS_INVALIDATION_CAUSES:
                    errors.append(f"event #{index + 1}.data.cause is invalid")
                if cause == "material-correction":
                    direction = data.get("direction")
                    nonempty_string(
                        direction,
                        f"event #{index + 1}.data.direction",
                        errors,
                    )
                    dependent_mutation = data.get("dependent_mutation")
                    if not isinstance(dependent_mutation, bool):
                        errors.append(
                            f"event #{index + 1}.data.dependent_mutation must be boolean"
                        )
                    if isinstance(direction, str) and direction.strip():
                        corrections_by_direction[direction] = (
                            corrections_by_direction.get(direction, 0) + 1
                        )
                        if dependent_mutation is True or (
                            corrections_by_direction[direction] >= 2
                        ):
                            recovery_required = True
                            epistemic_hard_stop_pending = True
                            epistemic_hard_stop_receipt_seen = False
                            epistemic_hard_stop_trigger = "epistemic-discontinuity"
                            epistemic_hard_stop_dependent_artifacts = True
                            hard_stop_invalidation_positions.append(index)
                            if not decision_alignment_required:
                                errors.append(
                                    f"event #{index + 1} correction hard stop requires decision_alignment"
                                )
                    correction_invalidation_positions.append(index)
                    if canonical_reconciliation_required:
                        canonical_reconciliation_pending = True
        elif event_type == "recovery":
            if not correction_recovery_required and not epistemic_reconciliation_required:
                errors.append(
                    f"event #{index + 1} recovery event has no reconciliation requirement"
                )
            result = validate_recovery_event(
                data,
                label=f"event #{index + 1}.data",
                epistemic_hard_stop=epistemic_hard_stop_pending,
                errors=errors,
            )
            if not recovery_required:
                errors.append(
                    f"event #{index + 1} recovery event has no active recovery trigger"
                )
            if epistemic_hard_stop_pending:
                if data.get("trigger") != epistemic_hard_stop_trigger:
                    errors.append(
                        f"event #{index + 1}.data.trigger does not match the active hard stop"
                    )
                if (
                    data.get("dependent_artifacts_exist")
                    is not epistemic_hard_stop_dependent_artifacts
                ):
                    errors.append(
                        f"event #{index + 1}.data.dependent_artifacts_exist does not match invalidation"
                    )
                epistemic_hard_stop_receipt_seen = True
                hard_stop_receipt_positions.append(index)
            if result in {"BLOCKED", "AWAITING-DECISION"}:
                if event.get("status") != "blocked":
                    errors.append(
                        f"event #{index + 1} unresolved recovery status must be blocked"
                    )
                recovery_required = True
                latest_recovery_position = index
                evidence_backed_fresh = False
                if canonical_reconciliation_required:
                    canonical_reconciliation_pending = True
                if delegated_record_active:
                    capture_pending = True
                    canonical_reconciliation_pending = True
            active_ready = False
            recovery_positions.append(index)
        elif event_type == "durable-capture":
            if not (canonical_reconciliation_required or delegated_record_active):
                errors.append(
                    f"event #{index + 1} durable capture has no delegated record "
                    "or declared canonical reconciliation requirement"
                )
            else:
                capture_error_count = len(errors)
                reconciled = validate_canonical_reconciliation(
                    data,
                    label=f"event #{index + 1}.data",
                    errors=errors,
                )
                capture_state = data.get("capture_state")
                capture_event_id = data.get("event_id")
                basis_revision = data.get("basis_revision")
                prior_capture_state = (
                    capture_event_states.get(capture_event_id)
                    if isinstance(capture_event_id, str)
                    else None
                )
                if prior_capture_state is not None and not (
                    prior_capture_state == "capture-incomplete"
                    and capture_state in {"complete", "reconciled"}
                ):
                    errors.append(
                        f"event #{index + 1}.data.event_id reuses a completed or "
                        "incompatible capture identity"
                    )
                if isinstance(capture_event_id, str) and capture_event_id.strip():
                    capture_event_states[capture_event_id] = str(capture_state)
                if (
                    pending_capture_event_id
                    and capture_event_id != pending_capture_event_id
                ):
                    errors.append(
                        f"event #{index + 1}.data.event_id does not reconcile the "
                        "pending capture identity"
                    )
                if basis_revision != current_basis_revision:
                    errors.append(
                        f"event #{index + 1}.data.basis_revision does not match "
                        "the current activity basis"
                    )
                if capture_state in {"complete", "reconciled"}:
                    if event.get("status") not in {"applied", "passed"}:
                        errors.append(
                            f"event #{index + 1} complete canonical reconciliation "
                            "must have applied or passed status"
                        )
                        reconciled = False
                elif capture_state == "capture-incomplete":
                    if event.get("status") not in {"partial", "failed", "blocked"}:
                        errors.append(
                            f"event #{index + 1} capture-incomplete must have "
                            "partial, failed, or blocked status"
                        )
                    reconciled = False
                    capture_pending = True
                    canonical_reconciliation_pending = True
                    capture_incomplete_positions.append(index)
                if reconciled and len(errors) == capture_error_count:
                    canonical_reconciliation_pending = False
                    canonical_reconciliation_positions.append(index)
                    capture_pending = False
                    pending_capture_event_id = ""
                    last_capture_event = str(capture_event_id)
        elif event_type in {"implementation-mutation-attempt", "implementation-mutation"}:
            if identified_activity and not activity_transition_valid:
                errors.append(
                    f"event #{index + 1} mutation occurs without a current activity transition"
                )
            if not active_ready:
                errors.append(f"event #{index + 1} mutation occurs without current READY")
            if capability_routing_required and not (
                latest_mutation_route_allowed
                and ready_positions
                and latest_mutation_route_position > ready_positions[-1]
            ):
                errors.append(
                    f"event #{index + 1} mutation lacks a current allowed "
                    "change.ready capability route after READY"
                )
            if recovery_required or recovery_waits_for_new_readiness:
                errors.append(
                    f"event #{index + 1} mutation occurs with unresolved RECOVERY"
                )
            if canonical_reconciliation_pending:
                errors.append(
                    f"event #{index + 1} mutation occurs before canonical reconciliation"
                )
            if delegated_record_active and capture_pending:
                errors.append(
                    f"event #{index + 1} mutation occurs before required durable capture"
                )
            if effect_scope_required:
                effect_class = data.get("effect_class")
                if effect_class not in EFFECT_CLASSES:
                    errors.append(
                        f"event #{index + 1}.data.effect_class is invalid"
                    )
                elif effect_class not in authorized_effect_classes:
                    errors.append(
                        f"event #{index + 1} uses unauthorized effect class "
                        f"{effect_class!r}"
                    )
            if correction_recovery_required:
                nonempty_string(
                    data.get("direction"),
                    f"event #{index + 1}.data.direction",
                    errors,
                )
            if event_type == "implementation-mutation" and event.get("status") not in {
                "applied",
                "failed",
                "partial",
            }:
                errors.append(
                    f"event #{index + 1} implementation mutation has invalid status"
                )
            if event_type == "implementation-mutation-attempt" and event.get("status") not in {
                "allowed",
                "denied",
                "failed",
            }:
                errors.append(f"event #{index + 1} mutation attempt has invalid status")
            mutation_positions.append(index)
            if (
                event_type == "implementation-mutation"
                and event.get("status") == "applied"
                and delegated_capture_required
            ):
                canonical_reconciliation_pending = True
                capture_pending = True
        elif event_type == "verification":
            if effect_scope_required:
                verification_effects = validate_effect_list(
                    data.get("effect_classes"),
                    f"event #{index + 1}.data.effect_classes",
                    errors,
                )
                if not verification_effects:
                    errors.append(
                        f"event #{index + 1}.data.effect_classes must not be empty"
                    )
                unauthorized = sorted(
                    verification_effects - authorized_effect_classes
                )
                if unauthorized:
                    errors.append(
                        f"event #{index + 1} verification uses unauthorized "
                        f"effect classes: {unauthorized}"
                    )
            verification_positions.append(index)
            if event.get("status") == "passed":
                successful_verification_positions.append(index)
            if delegated_capture_required:
                canonical_reconciliation_pending = True
                capture_pending = True
        elif event_type == "diagnostic-coverage":
            if not changed_artifact_diagnostics_required:
                errors.append(
                    f"event #{index + 1} diagnostic coverage has no declared requirement"
                )
            latest_diagnostic_result = validate_diagnostic_coverage(
                data,
                label=f"event #{index + 1}.data",
                event_status=event.get("status"),
                errors=errors,
            )
            diagnostic_coverage_positions.append(index)
            if delegated_capture_required:
                canonical_reconciliation_pending = True
                capture_pending = True
        elif event_type == "verification-disposition":
            disposition = validate_verification_disposition(
                data,
                label=f"event #{index + 1}.data",
                event_status=event.get("status"),
                errors=errors,
            )
            latest_verification_disposition = disposition
            verification_disposition_positions.append(index)
            if delegated_capture_required:
                canonical_reconciliation_pending = True
                capture_pending = True
        elif event_type == "regression-protection":
            status = data.get("status")
            if not isinstance(status, str) or status not in PROTECTION_STATUSES:
                errors.append(f"event #{index + 1}.data.status is invalid")
            elif protection_required:
                validate_regression_artifact(
                    data,
                    label=f"event #{index + 1}.data",
                    protection_status=status,
                    errors=errors,
                )
            protection_positions.append(index)
            if delegated_capture_required:
                canonical_reconciliation_pending = True
                capture_pending = True
        elif event_type == "final-audit":
            if canonical_reconciliation_required or delegated_capture_required:
                if data.get("canonical_state_reconciled") is not True:
                    errors.append(
                        f"event #{index + 1}.data.canonical_state_reconciled "
                        "must be true"
                    )
                if canonical_reconciliation_pending:
                    errors.append(
                        f"event #{index + 1} final audit precedes canonical reconciliation"
                    )
                if delegated_record_active and capture_pending:
                    errors.append(
                        f"event #{index + 1} final audit precedes required durable capture"
                    )
            audit_positions.append(index)
            if event.get("status") == "passed":
                successful_audit_positions.append(index)
            material_correction = data.get("material_correction", False)
            if not isinstance(material_correction, bool):
                errors.append(
                    f"event #{index + 1}.data.material_correction must be boolean"
                )
            elif material_correction and delegated_record_active:
                capture_pending = True
                canonical_reconciliation_pending = True
                audit_correction_positions.append(index)
        elif event_type == "report":
            if delegated_record_active and capture_pending:
                errors.append(
                    f"event #{index + 1} report occurs before required durable capture"
                )

    if material_change:
        required_types = {
            "skill-activation",
            "skill-load",
            "provisional-understanding",
            "evidence-backed-understanding",
            "readiness",
            "final-audit",
            "report",
        }
        present_types = {event.get("type") for event in events}
        missing_types = sorted(required_types - present_types)
        if missing_types:
            errors.append(f"material trace is missing event types: {missing_types}")
    if capability_routing_required:
        routed_capabilities = {
            event.get("data", {}).get("capability_id")
            for event in events
            if event.get("type") == "capability-route"
            and isinstance(event.get("data"), dict)
        }
        if not capability_route_positions:
            errors.append("capability routing requirement has no capability-route event")
        if "work.resolve" not in routed_capabilities:
            errors.append("capability routing requirement has no work.resolve route")
        if material_change and "change.ready" not in routed_capabilities:
            errors.append("material capability route has no change.ready result")
    if tool_evidence_routing_required and not tool_evidence_positions:
        errors.append("tool evidence routing requirement has no routed tool evidence event")
    if changed_artifact_diagnostics_required and not diagnostic_coverage_positions:
        errors.append(
            "changed artifact diagnostics requirement has no diagnostic-coverage event"
        )
    if identified_activity and not transition_positions:
        errors.append("identified activity trace is missing an activity-transition event")
    if identified_activity and not context_bootstrap_positions:
        errors.append("identified activity trace is missing bootstrap context resolution")
    if context_bootstrap_positions and transition_positions:
        if context_bootstrap_positions[0] > transition_positions[0]:
            errors.append("activity transition occurs before bootstrap context resolution")
    if decision_alignment_required and not decision_alignment_positions:
        errors.append("decision alignment requirement has no decision-alignment event")
    if scenario_coverage_required and not scenario_coverage_positions:
        errors.append("scenario coverage requirement has no scenario-coverage event")
    if scenario_coverage_required and not scenario_seed_positions:
        errors.append("scenario coverage requirement has no scenario-seed event")
    if scenario_seed_positions and investigation_positions:
        if scenario_seed_positions[0] > investigation_positions[0]:
            errors.append("first scenario seed occurs after material investigation")
    if epistemic_reconciliation_required:
        if not hard_stop_invalidation_positions:
            errors.append(
                "epistemic reconciliation requirement has no hard-stop invalidation"
            )
        if not hard_stop_receipt_positions:
            errors.append(
                "epistemic reconciliation requirement has no hard-stop receipt"
            )
    if hard_stop_invalidation_positions and not hard_stop_receipt_positions:
        errors.append("triggered hard stop has no reconciliation receipt")
    if material_change and identified_activity and not investigation_positions:
        errors.append("identified material trace is missing a material-investigation event")
    if material_change and scenario_coverage_required and not investigation_positions:
        errors.append("scenario coverage trace is missing a material-investigation event")
    if outcome_status == "completed" and (
        recovery_required
        or recovery_waits_for_new_readiness
        or epistemic_hard_stop_pending
        or (delegated_record_active and capture_pending)
    ):
        errors.append("completed outcome has unresolved recovery or durable capture")
    if (
        outcome_status == "completed"
        and scenario_coverage_required
        and not scenario_coverage_current
    ):
        errors.append("completed outcome has no current SCENARIO-ALIGNED contract")
    disposition_required = outcome_status == "completed" or any(
        event.get("type") == "implementation-mutation"
        and event.get("status") == "applied"
        for event in events
    )
    if material_change and disposition_required and not verification_disposition_positions:
        errors.append("material trace is missing a verification-disposition event")
    if outcome_status == "completed" and verification_disposition_positions:
        disposition, result, coverage = latest_verification_disposition
        if disposition in {"reproducible-handoff", "blocked"}:
            errors.append(
                "completed outcome cannot rely on a handoff or blocked observable check"
            )
        if observable_verification_required and not (
            disposition in {"executed", "collaborative"}
            and result == "passed"
            and coverage == "direct"
        ):
            errors.append(
                "completed observable-verification outcome requires a passed direct "
                "executed or collaborative disposition"
            )
    if outcome_status == "completed" and changed_artifact_diagnostics_required:
        if latest_diagnostic_result not in {"clean", "bounded-residual", "not-applicable"}:
            errors.append(
                "completed outcome has unresolved changed-artifact diagnostic coverage"
            )
        if latest_diagnostic_result == "bounded-residual":
            residual_risk = outcome.get("residual_risk") if isinstance(outcome, dict) else None
            if not isinstance(residual_risk, str) or not residual_risk.strip():
                errors.append(
                    "completed bounded diagnostic residual requires stated residual risk"
                )

    activation = event_positions(events, "skill-activation")
    skill_load = event_positions(events, "skill-load")
    provisional = event_positions(events, "provisional-understanding")
    evidence_backed = event_positions(events, "evidence-backed-understanding")
    if activation and skill_load and activation[0] > skill_load[0]:
        errors.append("skill-load occurs before skill-activation")
    if skill_load and provisional and skill_load[0] > provisional[0]:
        errors.append("provisional understanding occurs before SKILL.md load")
    if provisional and evidence_backed and provisional[0] > evidence_backed[0]:
        errors.append("evidence-backed understanding occurs before provisional understanding")
    if ready_positions and evidence_backed and ready_positions[0] < evidence_backed[0]:
        errors.append("READY occurs before evidence-backed understanding")

    applied_mutations = [
        index
        for index, event in enumerate(events)
        if event.get("type") == "implementation-mutation"
        and event.get("status") == "applied"
    ]
    if mutation_positions and not ready_positions:
        errors.append("mutation trace has no valid READY event")
    if applied_mutations:
        last_mutation = applied_mutations[-1]
        later_verification = [position for position in verification_positions if position > last_mutation]
        if not later_verification:
            errors.append("applied mutation has no later verification event")
        if outcome_status == "completed" and not any(
            position > last_mutation for position in successful_verification_positions
        ):
            errors.append("completed mutation has no later passed verification event")
        if not any(
            position > last_mutation for position in verification_disposition_positions
        ):
            errors.append("applied mutation has no later verification disposition")
        if protection_required:
            later_protection = [position for position in protection_positions if position > last_mutation]
            if not later_protection:
                errors.append("triggered mutation has no final regression-protection event")
        if changed_artifact_diagnostics_required and not any(
            position > last_mutation for position in diagnostic_coverage_positions
        ):
            errors.append(
                "applied mutation has no later changed-artifact diagnostic coverage"
            )
        required_before_audit = [
            last_mutation,
            *later_verification,
            *(
                position
                for position in verification_disposition_positions
                if position > last_mutation
            ),
        ]
        if protection_required:
            required_before_audit.extend(
                position for position in protection_positions if position > last_mutation
            )
        if changed_artifact_diagnostics_required:
            required_before_audit.extend(
                position
                for position in diagnostic_coverage_positions
                if position > last_mutation
            )
        latest_required = max(required_before_audit)
        if not any(position > latest_required for position in audit_positions):
            errors.append(
                "final audit does not follow mutation, verification, diagnostics, "
                "and protection"
            )

    reports = event_positions(events, "report")
    if audit_positions:
        prior_required = [
            *evidence_backed,
            *ready_positions,
            *mutation_positions,
            *verification_positions,
            *verification_disposition_positions,
            *protection_positions,
            *diagnostic_coverage_positions,
        ]
        if prior_required and audit_positions[-1] < max(prior_required):
            errors.append("final audit occurs before a required prior event")
    if audit_positions and reports and reports[-1] < audit_positions[-1]:
        errors.append("final report occurs before the final audit")
    if outcome_status == "completed" and not successful_audit_positions:
        errors.append("completed outcome has no passed final audit")

    if canonical_reconciliation_required or delegated_capture_required:
        if not canonical_reconciliation_positions:
            errors.append(
                "canonical reconciliation requirement has no valid durable-capture event"
            )
        elif outcome_status == "completed":
            relevant_state_positions = [
                *applied_mutations,
                *verification_positions,
                *verification_disposition_positions,
                *protection_positions,
                *recovery_positions,
                *correction_invalidation_positions,
                *audit_correction_positions,
            ]
            latest_state = max(relevant_state_positions, default=-1)
            final_audit = audit_positions[-1] if audit_positions else len(events)
            if not any(
                latest_state < position < final_audit
                for position in canonical_reconciliation_positions
            ):
                errors.append(
                    "completed outcome lacks a final canonical reconciliation "
                    "after material state and before final audit"
                )

    return {
        "event_count": len(events),
        "transition_count": len(transition_positions),
        "gate_trigger_count": len(gate_trigger_positions),
        "investigation_count": len(investigation_positions),
        "ready_count": len(ready_positions),
        "mutation_count": len(mutation_positions),
        "verification_count": len(verification_positions),
        "verification_disposition_count": len(
            verification_disposition_positions
        ),
        "protection_count": len(protection_positions),
        "decision_alignment_count": len(decision_alignment_positions),
        "scenario_coverage_count": len(scenario_coverage_positions),
        "recovery_count": len(recovery_positions),
        "epistemic_hard_stop_count": len(hard_stop_receipt_positions),
        "canonical_reconciliation_count": len(
            canonical_reconciliation_positions
        ),
        "capture_incomplete_count": len(capture_incomplete_positions),
        "tool_evidence_count": len(tool_evidence_positions),
        "diagnostic_coverage_count": len(diagnostic_coverage_positions),
        "audit_count": len(audit_positions),
    }


def validate_trace(path: Path) -> dict[str, Any]:
    errors: list[str] = []
    result: dict[str, Any] = {
        "path": os.fspath(path),
        "status": "invalid",
        "writes_performed": False,
        "errors": errors,
    }
    try:
        trace = load_json(path)
        shaped = validate_shape(trace, errors)
        if shaped is not None:
            event_result = validate_events(shaped, errors)
            semantic_trace = dict(shaped)
            semantic_trace["events"] = event_result.get("events", [])
            result["summary"] = validate_semantics(semantic_trace, errors)
        if not errors:
            result["status"] = "valid"
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        errors.append(f"cannot load trace: {exc}")
    except Exception as exc:  # pragma: no cover - fail closed on unexpected input
        errors.append(f"unexpected failure: {type(exc).__name__}: {exc}")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate one or more please-make-no-mistakes ordered trace JSON files. "
            "The tool does not launch clients or modify traces."
        )
    )
    parser.add_argument("traces", nargs="+")
    return parser


def main(argv: list[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    results = [validate_trace(Path(value)) for value in arguments.traces]
    payload = {
        "schema_version": 1,
        "status": "valid" if all(item["status"] == "valid" for item in results) else "invalid",
        "writes_performed": False,
        "limitations": [
            "Reads may update access-time metadata under the host filesystem and mount policy.",
            "Validation does not authenticate the event source or prove omitted events absent.",
            "Validation cannot determine whether an unreported durable gate condition existed.",
            "Validation cannot prove that every material scenario was declared or that a model-labeled collaborator response occurred.",
            "Structured bridge, scenario, recovery, effect, test, and reconciliation fields do not prove semantic truth.",
        ],
        "results": results,
    }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0 if payload["status"] == "valid" else 1


if __name__ == "__main__":
    raise SystemExit(main())
