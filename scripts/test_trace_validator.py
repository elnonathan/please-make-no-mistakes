#!/usr/bin/env python3
"""Tests for the portable ordered-trace validator."""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any


sys.dont_write_bytecode = True

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
TOOL = PACKAGE_ROOT / "scripts" / "validate_trace.py"


def load_tool_module() -> Any:
    spec = importlib.util.spec_from_file_location("pmnm_trace_validator", TOOL)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load trace validator.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


TRACE_TOOL = load_tool_module()


def event(event_type: str, status: str, evidence: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = dict(data or {})
    if event_type == "readiness-invalidation":
        payload.setdefault("prior_basis_revision", 1)
        payload.setdefault("new_basis_revision", 2)
    return {
        "seq": 0,
        "type": event_type,
        "status": status,
        "evidence": evidence,
        "data": payload,
    }


def capability_route_event(
    capability_id: str,
    *,
    result: str = "CONTINUE",
    continue_with: str,
    resume_with: str = "none",
    implementation_mutation: str = "DENIED",
) -> dict[str, Any]:
    return event(
        "capability-route",
        "allowed" if implementation_mutation == "ALLOWED" else "observed",
        "observable capability continuation",
        {
            "capability_id": capability_id,
            "result": result,
            "basis": "current fixture evidence",
            "conflict_or_gap": "",
            "continue_with": continue_with,
            "resume_with": resume_with,
            "implementation_mutation": implementation_mutation,
        },
    )


def tool_evidence_data(
    *,
    result_status: str = "usable",
    continuation: str = "stop",
    remaining_gap: str = "",
    detail_level: str = "summary",
    detail_reason: str = "",
) -> dict[str, Any]:
    return {
        "tool": "semantic-navigation",
        "claim": "identify candidate consumers of the changed symbol",
        "evidence_lane": "static-or-semantic",
        "can_establish": ["symbol identity", "candidate relationships"],
        "cannot_establish": ["runtime reachability", "observable impact"],
        "result_status": result_status,
        "remaining_gap": remaining_gap,
        "continuation": continuation,
        "continuation_reason": (
            "the bounded structural claim is resolved"
            if continuation == "stop"
            else "the named gap can change the affected surface"
        ),
        "detail_level": detail_level,
        "detail_reason": detail_reason,
    }


def diagnostic_coverage_event(
    *,
    result: str = "clean",
    current_errors: list[dict[str, Any]] | None = None,
    untrusted_artifacts: list[str] | None = None,
    fallback_checks: list[str] | None = None,
    coverage_lost: str = "",
) -> dict[str, Any]:
    untrusted_artifacts = untrusted_artifacts or []
    checked = [] if untrusted_artifacts else ["src/example.ts"]
    status = {
        "clean": "passed",
        "bounded-residual": "partial",
        "blocked": "blocked",
        "not-applicable": "observed",
    }[result]
    if result == "not-applicable":
        applicable: list[str] = []
        checked = []
        unsupported = ["src/example.ts", "README.md"]
    else:
        applicable = ["src/example.ts"]
        unsupported = ["README.md"]
    return event(
        "diagnostic-coverage",
        status,
        "current changed-artifact diagnostic coverage",
        {
            "changed_artifacts": ["src/example.ts", "README.md"],
            "applicable_artifacts": applicable,
            "checked_artifacts": checked,
            "unsupported_artifacts": unsupported,
            "untrusted_artifacts": untrusted_artifacts,
            "current_errors": current_errors or [],
            "fallback_checks": fallback_checks or [],
            "coverage_lost": coverage_lost,
            "result": result,
        },
    )


def resequence(events: list[dict[str, Any]]) -> None:
    for index, item in enumerate(events, start=1):
        item["seq"] = index


def activity_transition_event(
    result: str,
    *,
    applicable: set[str] | None = None,
    reason: str = "gate evaluated from current evidence",
    effort_level: str = "standard",
) -> dict[str, Any]:
    applicable = applicable or set()
    if result == "loaded":
        record_state = "existing-delegated"
        evaluated: set[str] = set()
        status = "passed"
    elif result == "created":
        record_state = "newly-created"
        evaluated = set(TRACE_TOOL.DURABLE_GATE_CONDITIONS)
        status = "passed"
    else:
        record_state = "missing"
        evaluated = set(TRACE_TOOL.DURABLE_GATE_CONDITIONS)
        status = (
            "blocked"
            if result in {"planned-and-awaiting-approval", "blocked"}
            else "passed"
        )
    data: dict[str, Any] = {
        "activity_id": "work-4821",
        "record_state": record_state,
        "result": result,
        "effort_level": effort_level,
        "basis_revision": 1,
        "last_capture_event": (
            "preexisting-capture" if result == "loaded" else "bootstrap-capture"
            if result == "created"
            else ""
        ),
        "pending_capture": False,
        "pending_capture_event": "",
        "source_state": "fixture source state",
        "delivery_context": "fixture delivery context for work-4821",
        "consistency_result": "aligned",
        "consistency_evidence": "activity and fixture delivery state identify work-4821",
        "evaluated_gate_conditions": sorted(evaluated),
        "applicable_gate_conditions": sorted(applicable),
        "reason": reason,
        "next_permitted_action": "bounded next action",
    }
    if result in {"created", "planned-and-awaiting-approval"}:
        data["plan_digest"] = "plan-digest"
        data["planned_postconditions"] = sorted(
            TRACE_TOOL.ACTIVITY_BOOTSTRAP_POSTCONDITIONS
        )
        data["storage_preflight"] = {
            "owner_and_subject": "fixture owner and identified activity",
            "audience": "private fixture",
            "repository_relationship": "outside the delivery source",
            "backend_access": "authorized fixture access",
            "versioning_or_ignore_state": "not versioned",
            "synchronization_or_publication_exposure": "not synchronized or published",
            "sensitivity": "bounded non-secret fixture data",
            "retention_and_deletion": "fixture lifetime",
            "recovery_and_discovery": "verified fixture locator",
            "retrieval_needs": "current and cross-session fixture recovery",
            "existing_store_result": "no existing authorized store",
            "recommendation_basis": "private recoverable fixture boundary",
        }
    if result == "created":
        data["approval_reference"] = "opaque-approval-reference"
        data["canonical_record"] = "authorized activity recovery surface"
        data["locator_or_registry"] = "verified fixture locator"
        data["delegation_scope"] = "routine content updates for work-4821"
        data["retrieval_verified"] = True
    if result == "no-record-with-valid-reason" and effort_level in {"standard", "high"}:
        data["durable_exception_basis"] = (
            "all independent triggers are false and no recovery value remains in this fixture"
        )
    return event("activity-transition", status, "activity transition receipt", data)


def context_bootstrap_event() -> dict[str, Any]:
    return event(
        "context-bootstrap",
        "observed",
        "authoritative bootstrap context inspected",
        {
            "discovery_surfaces": ["host instructions", "project instructions", "context locators"],
            "verified_matches": ["fixture project instructions"],
            "residual_discovery_limit": "undiscoverable adapters cannot be evaluated",
            "result": "resolved",
        },
    )


def verification_disposition_event(
    disposition: str = "executed",
    *,
    coverage: str = "direct",
    result: str = "passed",
) -> dict[str, Any]:
    status = {
        "passed": "passed",
        "failed-product": "failed",
        "failed-environment": "failed",
        "partial": "partial",
        "not-run": "not-run",
        "blocked": "blocked",
        "not-applicable": "observed",
    }[result]
    owner = {
        "executed": "agent",
        "collaborative": "shared",
        "reproducible-handoff": "collaborator",
        "blocked": "agent",
        "not-applicable": "none",
    }[disposition]
    access = {
        "executed": "available-authorized",
        "collaborative": "available-authorized",
        "reproducible-handoff": "collaborator-controlled",
        "blocked": "unavailable",
        "not-applicable": "not-applicable",
    }[disposition]
    attempted = disposition in {"executed", "collaborative", "blocked"}
    return event(
        "verification-disposition",
        status,
        "observable verification disposition",
        {
            "observable_contract": "declared material behavior",
            "entry_surface": (
                "fixture entry surface" if disposition != "not-applicable" else ""
            ),
            "actor_state_and_authority": (
                "authorized fixture actor and state"
                if disposition != "not-applicable"
                else ""
            ),
            "data_and_environment": (
                "self-owned fixture environment"
                if disposition != "not-applicable"
                else ""
            ),
            "steps": (
                ["exercise the declared fixture behavior"]
                if disposition != "not-applicable"
                else []
            ),
            "expected_observations": (
                ["material contract is observable"]
                if disposition != "not-applicable"
                else []
            ),
            "evidence_to_retain": (
                ["focused fixture result"]
                if disposition != "not-applicable"
                else []
            ),
            "cleanup_or_restoration": "no persistent fixture state remains",
            "execution_owner": owner,
            "execution_access": access,
            "strongest_accessible_check": "direct focused fixture execution",
            "attempted_by_agent": attempted,
            "reason_not_attempted": (
                "collaborator-controlled boundary"
                if not attempted and disposition != "not-applicable"
                else "not applicable to this contract"
                if disposition == "not-applicable"
                else ""
            ),
            "disposition": disposition,
            "coverage": coverage,
            "result": result,
            "evidence": (
                "literal fixture result captured"
                if attempted
                else "procedure derived from current fixture evidence"
                if disposition != "not-applicable"
                else "no observable execution boundary is material"
            ),
            "limitations": "only the declared fixture contract",
        },
    )


def valid_trace() -> dict[str, Any]:
    events = [
        event("skill-activation", "observed", "host activation event"),
        event("skill-load", "observed", "SKILL.md read", {"path": "SKILL.md"}),
        event(
            "reference-load",
            "observed",
            "workflow reference read",
            {"reference": "workflow.md"},
        ),
        event(
            "reference-load",
            "observed",
            "verification reference read",
            {"reference": "verification.md"},
        ),
        event(
            "tool-invocation",
            "passed",
            "required navigator called",
            {"tool": "semantic-navigation"},
        ),
        event(
            "provisional-understanding",
            "reported",
            "outcome and strongest uncertainty were shown",
        ),
        event(
            "evidence-backed-understanding",
            "reported",
            "current evidence selected the direction",
        ),
        event(
            "readiness",
            "passed",
            "complete receipt shown before mutation",
            {
                "result": "READY",
                "receipt_fields": sorted(TRACE_TOOL.REQUIRED_RECEIPT_FIELDS),
                "basis_revision": 1,
                "activity_transition_result": "not-applicable",
                "capture_state": "not-applicable",
                "last_capture_event": "",
            },
        ),
        event(
            "implementation-mutation",
            "applied",
            "first implementation mutation",
            {"scope": "declared fixture"},
        ),
        event(
            "verification",
            "passed",
            "contract-level scenario passed",
            {"claim": "material contract"},
        ),
        verification_disposition_event(),
        event(
            "regression-protection",
            "passed",
            "repeatable guard demonstrated",
            {
                "status": "added-or-updated",
                "artifact": {
                    "observable_contract": "declared material behavior",
                    "pre_change_state": "known failing fixture",
                    "post_change_state": "corrected fixture behavior",
                    "discriminating_behavior": "fails only when the contract regresses",
                    "classification": "regression-guard",
                    "non_coverage": "other contracts and environments",
                    "execution_conditions": "focused fixture command",
                    "recurrence_evidence": "controlled failing state was distinguished",
                },
            },
        ),
        event("final-audit", "passed", "final source state audited"),
        event("report", "reported", "bounded final result delivered"),
    ]
    resequence(events)
    return {
        "schema_version": 1,
        "skill_revision": "example-revision",
        "case_id": "example-case",
        "client": {
            "name": "example-client",
            "model": "example-model",
            "effort": "medium",
            "tool_access": ["semantic-navigation"],
        },
        "session": {"clean": True, "source_state": "fixture-state"},
        "requirements": {
            "material_change": True,
            "required_references": ["workflow.md", "verification.md"],
            "required_tools": ["semantic-navigation"],
            "regression_protection": True,
        },
        "events": events,
        "outcome": {
            "status": "completed",
            "summary": "fixture completed",
            "residual_risk": "bounded fixture risk",
        },
        "violations": [],
    }


def valid_identified_trace(
    transition_result: str = "loaded",
    *,
    applicable: set[str] | None = None,
    reason: str = "gate evaluated from current evidence",
) -> dict[str, Any]:
    trace = valid_trace()
    trace["requirements"]["identified_activity"] = True
    trace["requirements"]["required_references"].append("durable-record-protocol.md")
    skill_load_index = next(
        index for index, item in enumerate(trace["events"]) if item["type"] == "skill-load"
    )
    transition_prefix = [
        context_bootstrap_event(),
        event(
            "reference-load",
            "observed",
            "durable record protocol read",
            {"reference": "durable-record-protocol.md"},
        ),
    ]
    if transition_result in {"loaded", "created"}:
        trace["requirements"]["required_references"].append(
            "continuous-activity-capture.md"
        )
        transition_prefix.append(
            event(
                "reference-load",
                "observed",
                "continuous capture reference read",
                {"reference": "continuous-activity-capture.md"},
            )
        )
    transition_prefix.append(
        activity_transition_event(
            transition_result,
            applicable=applicable,
            reason=reason,
        )
    )
    trace["events"][skill_load_index + 1 : skill_load_index + 1] = transition_prefix
    provisional_index = next(
        index
        for index, item in enumerate(trace["events"])
        if item["type"] == "provisional-understanding"
    )
    trace["events"].insert(
        provisional_index + 1,
        event(
            "material-investigation",
            "observed",
            "task-specific evidence inspected",
        ),
    )
    readiness = next(
        item for item in trace["events"] if item["type"] == "readiness"
    )
    readiness["data"]["receipt_fields"].append(
        TRACE_TOOL.ACTIVITY_SOURCE_RECEIPT_FIELD
    )
    readiness["data"]["receipt_fields"].extend(
        [
            TRACE_TOOL.ACTIVITY_TRANSITION_RECEIPT_FIELD,
            TRACE_TOOL.CAPTURE_FRESHNESS_RECEIPT_FIELD,
        ]
    )
    readiness["data"]["activity_transition_result"] = transition_result
    readiness["data"]["capture_state"] = (
        "complete" if transition_result in {"loaded", "created"} else "not-applicable"
    )
    readiness["data"]["last_capture_event"] = (
        "capture-investigation" if transition_result in {"loaded", "created"} else ""
    )
    if transition_result in {"loaded", "created"}:
        first_investigation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "material-investigation"
        )
        trace["events"].insert(
            first_investigation_index,
            canonical_capture_event(
                "capture-intake", reason="provisional intake before investigation"
            ),
        )
        readiness_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "readiness"
        )
        trace["events"].insert(
            readiness_index,
            canonical_capture_event(
                "capture-investigation", reason="investigation and current understanding"
            ),
        )
        readiness_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "readiness"
        )
        trace["events"].insert(
            readiness_index + 1,
            canonical_capture_event(
                "capture-readiness", reason="current readiness decision"
            ),
        )
        audit_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "final-audit"
        )
        trace["events"][audit_index]["data"]["canonical_state_reconciled"] = True
        trace["events"].insert(
            audit_index,
            canonical_capture_event(
                "capture-final", reason="implementation and verification changed current state"
            ),
        )
    resequence(trace["events"])
    return trace


def add_required_reference(trace: dict[str, Any], reference: str) -> None:
    if reference not in trace["requirements"]["required_references"]:
        trace["requirements"]["required_references"].append(reference)
    insert_at = max(
        index
        for index, item in enumerate(trace["events"])
        if item["type"] in {"skill-load", "reference-load"}
    )
    trace["events"].insert(
        insert_at + 1,
        event(
            "reference-load",
            "observed",
            f"{reference} read",
            {"reference": reference},
        ),
    )
    resequence(trace["events"])


def observable_equivalence_artifact(
    *,
    equivalence: str = "verified",
    bridge_complete: bool = True,
    action: str = "implement",
) -> dict[str, Any]:
    return {
        "observable_property": "summary and opened collection represent one set",
        "authority": "current fixture contract",
        "surface_a": "entry -> source A -> transformation -> summary -> interaction",
        "surface_b": "entry -> source B -> transformation -> collection -> interaction",
        "comparison_dimensions": ["identity", "scope", "permissions", "timing"],
        "equivalence": equivalence,
        "source_of_truth_and_authority": "authorized collection contract",
        "causal_hypothesis": "one propagation boundary may be stale",
        "supporting_evidence": "both paths were traced in the fixture",
        "missing_bridge": "none within declared scope" if bridge_complete else "consumer identity",
        "bridge_complete": bridge_complete,
        "action_permitted": action,
    }


def asynchronous_delivery_artifact() -> dict[str, Any]:
    return {
        "stages": {
            stage: "observed" for stage in sorted(TRACE_TOOL.ASYNC_DELIVERY_STAGES)
        },
        "upstream_value": "correct",
        "downstream_outcome": "stale",
        "source_mechanism_decision": "retained",
        "propagation_checked_before_source_replacement": True,
        "coverage_limit": "one declared fixture and lifecycle",
    }


def decision_alignment_event(
    result: str = "DIRECTION-ALIGNED",
    *,
    after_hard_stop: bool = False,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "current_contract_and_surface": "declared observable contract and surface",
        "material_observations": "current fixture evidence and provenance",
        "active_hypotheses": "one bounded candidate; alternatives compared",
        "strongest_counterevidence": "strongest fixture counterexample checked",
        "material_unknowns": "none blocking within the declared scope",
        "solution_classes_and_consequences": "reuse and extension compared by contract",
        "decision_criteria_and_authority": "current fixture authority and delegated criteria",
        "recommended_direction_and_basis": "narrow direction supported by current evidence",
        "collaborator_decision_required": result == "AWAITING-COLLABORATOR",
        "decision_or_delegated_basis": "current collaborator response or delegated criteria",
        "result": result,
    }
    if after_hard_stop:
        data["after_hard_stop"] = True
        data["collaborator_response"] = "current response resolves the turn boundary"
    return event(
        "decision-alignment",
        "blocked" if result == "AWAITING-COLLABORATOR" else "reported",
        "decision frontier checkpoint",
        data,
    )


def scenario_coverage_event(
    result: str = "SCENARIO-ALIGNED",
    *,
    effort_level: str = "standard",
    alignment_basis_type: str | None = None,
) -> dict[str, Any]:
    if alignment_basis_type is None:
        if result == "SCENARIO-ALIGNED" and effort_level == "light":
            alignment_basis_type = "light-evidence-basis"
        elif result == "SCENARIO-ALIGNED":
            alignment_basis_type = "current-collaborator-response"
        else:
            alignment_basis_type = "none"
    data: dict[str, Any] = {
        "effort_level": effort_level,
        "observable_contract": "the changed behavior and preserved adjacent contract",
        "in_scope": "one requested behavior and its reachable shared consumer",
        "preserved_behavior": "the adjacent consumer remains unchanged",
        "out_of_scope": "unrelated contracts and environments",
        "blast_radius_evidence": "entry, state, consumer, and guard inspected",
        "tool_limits": "fixture navigator covers only the declared source state",
        "source_classes": {
            "intent-and-authority": "current fixture contract and collaborator scope",
            "inspected-system-surface": "entry, state transition, and consumers traced",
            "risk-and-history": "adjacent invariant and prior recurrence considered",
        },
        "scenario_groups": ["requested success", "preserved shared consumer"],
        "material_items": ["requested behavior", "adjacent consumer"],
        "scenarios": [
            {
                "id": "requested-success",
                "reason": "exercise the requested observable change",
                "contract_dimension_or_consumer": "requested behavior",
                "source_and_status": "fixture contract; reported and inspected",
                "preconditions": "declared actor, state, data, and configuration",
                "trigger": "perform the requested action",
                "expected_observable_and_invariant": "new behavior occurs within scope",
                "forbidden_outcome": "the original defect remains",
                "evidence_lane_and_candidate_guard": "focused behavioral fixture",
                "coverage_disposition": "planned",
                "execution_result": "not-run",
                "coverage_limit_and_residual_risk": "one declared fixture",
            },
            {
                "id": "preserved-consumer",
                "reason": "protect a reachable adjacent invariant",
                "contract_dimension_or_consumer": "adjacent consumer",
                "source_and_status": "surface trace; observed within fixture",
                "preconditions": "shared consumer receives equivalent input",
                "trigger": "exercise the adjacent path",
                "expected_observable_and_invariant": "existing behavior remains unchanged",
                "forbidden_outcome": "shared consumer changes unexpectedly",
                "evidence_lane_and_candidate_guard": "focused scope guard",
                "coverage_disposition": "planned",
                "execution_result": "not-run",
                "coverage_limit_and_residual_risk": "other consumers remain outside fixture",
            },
        ],
        "coverage_mappings": [
            {
                "material_item": "requested behavior",
                "disposition": "scenario",
                "scenario_ids": ["requested-success"],
                "exclusion_reason": "",
                "authority": "",
                "residual_risk": "",
            },
            {
                "material_item": "adjacent consumer",
                "disposition": "scenario",
                "scenario_ids": ["preserved-consumer"],
                "exclusion_reason": "",
                "authority": "",
                "residual_risk": "",
            },
        ],
        "explicit_omissions": [],
        "residual_risk": "undeclared consumers cannot be proven absent",
        "product_uncertainty": "none blocking within the declared fixture",
        "recommendation": "proceed with the bounded scenario inventory",
        "alignment_basis_type": alignment_basis_type,
        "alignment_basis": (
            "current scope-and-scenario response or delegated fixture basis"
            if alignment_basis_type != "none"
            else "awaiting a current scope-and-scenario response"
        ),
        "result": result,
    }
    return event(
        "scenario-coverage",
        "blocked" if result == "AWAITING-COLLABORATOR" else "reported",
        "scenario coverage checkpoint",
        data,
    )


def scenario_seed_event() -> dict[str, Any]:
    return event(
        "scenario-seed",
        "reported",
        "provisional observable scenarios seeded before broad investigation",
        {
            "basis_revision": 1,
            "provisional_contract": "requested success and preserved adjacent behavior",
            "scenario_ids": ["requested-success", "preserved-consumer"],
            "source_and_uncertainty": "reported intent; reachability still provisional",
        },
    )


def enable_scenario_coverage(
    trace: dict[str, Any],
    *,
    result: str = "SCENARIO-ALIGNED",
    effort_level: str = "standard",
    alignment_basis_type: str | None = None,
) -> None:
    trace["requirements"]["scenario_coverage"] = True
    provisional_index = next(
        index
        for index, item in enumerate(trace["events"])
        if item["type"] == "provisional-understanding"
    )
    trace["events"].insert(provisional_index + 1, scenario_seed_event())
    provisional_index += 1
    if not any(item["type"] == "material-investigation" for item in trace["events"]):
        trace["events"].insert(
            provisional_index + 1,
            event(
                "material-investigation",
                "observed",
                "surface and scenario evidence inspected",
            ),
        )
    readiness = next(item for item in trace["events"] if item["type"] == "readiness")
    receipt_fields = set(readiness["data"]["receipt_fields"])
    receipt_fields.update(
        {
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD,
            TRACE_TOOL.SCENARIO_COVERAGE_RECEIPT_FIELD,
        }
    )
    readiness["data"]["receipt_fields"] = sorted(receipt_fields)
    readiness_index = trace["events"].index(readiness)
    trace["events"].insert(
        readiness_index,
        scenario_coverage_event(
            result,
            effort_level=effort_level,
            alignment_basis_type=alignment_basis_type,
        ),
    )
    resequence(trace["events"])


def enable_decision_alignment(trace: dict[str, Any]) -> None:
    trace["requirements"]["decision_alignment"] = True
    readiness = next(
        item for item in trace["events"] if item["type"] == "readiness"
    )
    receipt_fields = set(readiness["data"]["receipt_fields"])
    receipt_fields.add(TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD)
    readiness["data"]["receipt_fields"] = sorted(receipt_fields)
    readiness_index = trace["events"].index(readiness)
    trace["events"].insert(readiness_index, decision_alignment_event())
    resequence(trace["events"])


def recovery_event(result: str = "AWAITING-DECISION") -> dict[str, Any]:
    return event(
        "recovery",
        "blocked",
        "correction recovery receipt",
        {
            "current_contract": "preserve the declared observable behavior",
            "corrected_or_unsupported_claims": ["prior source assumption"],
            "invalidated_dependencies": ["prior implementation direction"],
            "current_source_and_external_state": "fixture state after correction",
            "artifact_classifications": ["prior change: experimental"],
            "safe_options_and_recommendation": "reconstruct before another change",
            "authority_still_required": "none for read-only reinvestigation",
            "result": result,
        },
    )


def epistemic_hard_stop_event(
    *,
    trigger: str = "epistemic-discontinuity",
    dependent_artifacts: bool = False,
    severity: str | None = None,
    result: str = "AWAITING-DECISION",
) -> dict[str, Any]:
    severity = severity or ("RECOVERY" if dependent_artifacts else "REALIGNMENT")
    return event(
        "recovery",
        "blocked",
        "epistemic reconciliation hard-stop receipt",
        {
            "current_contract": "preserve only the currently supported contract",
            "corrected_or_unsupported_claims": ["prior active direction"],
            "invalidated_dependencies": ["dependent recommendation"],
            "current_source_and_external_state": "fixture state after discontinuity",
            "artifact_classifications": ["prior direction: invalid"],
            "safe_options_and_recommendation": "pause and realign from current evidence",
            "authority_still_required": "collaborator response to the focused question",
            "result": result,
            "severity": severity,
            "trigger": trigger,
            "prior_material_claim": "the prior direction satisfies the contract",
            "prior_basis": "inferred",
            "prior_verification_status": "verified-within-scope",
            "prior_source": "earlier fixture evidence",
            "new_evidence_or_rejection": "current evidence removes the prior basis",
            "new_basis": "observed" if trigger == "epistemic-discontinuity" else "reported",
            "new_verification_status": "refuted" if trigger == "epistemic-discontinuity" else "unknown",
            "new_source": "current fixture evidence or collaborator response",
            "change_in_belief_or_action": "the prior direction cannot continue",
            "canonical_current_understanding": "the replacement direction remains unresolved",
            "dependent_artifacts_exist": dependent_artifacts,
            "evidence_based_question": "Which bounded contract should govern the next investigation?",
            "turn_boundary": True,
        },
    )


def epistemic_invalidation_event(
    *,
    trigger: str = "epistemic-discontinuity",
    dependent_artifacts: bool = False,
) -> dict[str, Any]:
    return event(
        "readiness-invalidation",
        "invalidated",
        "active direction lost its material basis",
        {
            "affected_fields": [
                "falsifiable-claim-and-result",
                "existing-mechanisms-or-solution-classes",
            ],
            "cause": trigger,
            "dependent_artifacts_exist": dependent_artifacts,
        },
    )


def canonical_capture_event(
    event_id: str = "capture-closure", *, basis_revision: int = 1, reason: str = "closure"
) -> dict[str, Any]:
    return event(
        "durable-capture",
        "applied",
        "canonical recovery state reconciled",
        {
            "event_id": event_id,
            "basis_revision": basis_revision,
            "capture_state": "complete",
            "transaction_order": [
                "event-history",
                "responsibility-surfaces",
                "canonical-index",
                "consistency-check",
            ],
            "completed_effects": ["event, responsibility surfaces, and index agree"],
            "pending_effects": [],
            "canonical_reconciliation": True,
            "reasons": [reason],
            "canonical_surface": "authorized activity index",
            "status": "completed within fixture",
            "current_conclusion": "declared contract verified within scope",
            "next_action": "closed",
            "invalidated_dependencies": [],
            "pointers": ["verification result"],
            "history_preserved": True,
            "delegation_current": True,
            "effect_class": "durable-record-content",
        },
    )


def incomplete_capture_event(
    event_id: str = "capture-incomplete", *, basis_revision: int = 1
) -> dict[str, Any]:
    capture = canonical_capture_event(event_id, basis_revision=basis_revision)
    capture["status"] = "partial"
    capture["evidence"] = "recoverable partial durable capture"
    capture["data"]["capture_state"] = "capture-incomplete"
    capture["data"]["canonical_reconciliation"] = False
    capture["data"]["completed_effects"] = ["event-history"]
    capture["data"]["pending_effects"] = [
        "responsibility-surfaces",
        "canonical-index",
        "consistency-check",
    ]
    capture["data"]["status"] = "partial capture awaiting reconciliation"
    return capture


class TraceValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="pmnm-trace-test-")
        self.base = Path(self.temp.name).resolve()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_trace(self, name: str, value: dict[str, Any]) -> Path:
        path = self.base / name
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        return path

    def run_tool(self, *paths: Path) -> tuple[int, dict[str, Any]]:
        environment = dict(os.environ)
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        completed = subprocess.run(
            [sys.executable, os.fspath(TOOL), *(os.fspath(path) for path in paths)],
            cwd=PACKAGE_ROOT,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        return completed.returncode, json.loads(completed.stdout)

    def test_runtime_surface_has_no_filesystem_write_primitives(self) -> None:
        source = TOOL.read_text(encoding="utf-8")
        tree = ast.parse(source)
        forbidden = {
            "chmod",
            "chown",
            "link",
            "mkdir",
            "remove",
            "rename",
            "replace",
            "rmdir",
            "symlink",
            "touch",
            "truncate",
            "unlink",
            "write",
            "write_bytes",
            "write_text",
        }
        violations = [
            f"{node.func.attr} at line {node.lineno}"
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in forbidden
        ]
        self.assertEqual(violations, [])

    def test_complete_ordered_trace_passes_without_writes(self) -> None:
        path = self.write_trace("valid.json", valid_trace())
        before = hashlib.sha256(path.read_bytes()).hexdigest()
        returncode, payload = self.run_tool(path)
        after = hashlib.sha256(path.read_bytes()).hexdigest()
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        self.assertFalse(payload["writes_performed"])
        self.assertIn("access-time metadata", " ".join(payload["limitations"]))
        self.assertEqual(payload["results"][0]["summary"]["mutation_count"], 1)
        self.assertEqual(before, after)

    def test_ready_before_required_reference_is_invalid(self) -> None:
        trace = valid_trace()
        trace["events"] = [
            item
            for item in trace["events"]
            if not (
                item["type"] == "reference-load"
                and item["data"].get("reference") == "verification.md"
            )
        ]
        resequence(trace["events"])
        path = self.write_trace("missing-reference.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("precedes required references", " ".join(payload["results"][0]["errors"]))

    def test_failed_reference_load_does_not_satisfy_readiness(self) -> None:
        trace = valid_trace()
        target = next(
            item
            for item in trace["events"]
            if item["type"] == "reference-load"
            and item["data"].get("reference") == "verification.md"
        )
        target["status"] = "failed"
        path = self.write_trace("failed-reference.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("precedes required references", " ".join(payload["results"][0]["errors"]))

    def test_failed_skill_load_does_not_satisfy_readiness(self) -> None:
        trace = valid_trace()
        target = next(item for item in trace["events"] if item["type"] == "skill-load")
        target["status"] = "failed"
        path = self.write_trace("failed-skill-load.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("successful SKILL.md load", " ".join(payload["results"][0]["errors"]))

    def test_early_denied_mutation_attempt_is_still_a_trace_violation(self) -> None:
        trace = valid_trace()
        trace["events"].insert(
            5,
            event(
                "implementation-mutation-attempt",
                "denied",
                "host denied early write",
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("early-attempt.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("without current READY", " ".join(payload["results"][0]["errors"]))

    def test_invalidation_requires_new_ready_before_mutation(self) -> None:
        trace = valid_trace()
        readiness_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "readiness"
        )
        trace["events"].insert(
            readiness_index + 1,
            event(
                "readiness-invalidation",
                "invalidated",
                "source state changed",
                {"affected_fields": ["source-or-environment-state"]},
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("invalidated.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("without current READY", " ".join(payload["results"][0]["errors"]))

    def test_refreshed_ready_after_invalidation_passes(self) -> None:
        trace = valid_trace()
        readiness_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "readiness"
        )
        refreshed = event(
            "readiness",
            "passed",
            "receipt refreshed after source change",
            {
                "result": "READY",
                "receipt_fields": sorted(TRACE_TOOL.REQUIRED_RECEIPT_FIELDS),
                "basis_revision": 2,
                "activity_transition_result": "not-applicable",
                "capture_state": "not-applicable",
                "last_capture_event": "",
            },
        )
        trace["events"][readiness_index + 1 : readiness_index + 1] = [
            event(
                "readiness-invalidation",
                "invalidated",
                "source state changed",
                {"affected_fields": ["source-or-environment-state"]},
            ),
            event(
                "evidence-backed-understanding",
                "reported",
                "understanding refreshed after source change",
            ),
            refreshed,
        ]
        resequence(trace["events"])
        path = self.write_trace("refreshed.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_identified_activity_with_resolved_transition_passes(self) -> None:
        trace = valid_identified_trace()
        path = self.write_trace("identified-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        summary = payload["results"][0]["summary"]
        self.assertEqual(summary["transition_count"], 1)
        self.assertEqual(summary["investigation_count"], 1)

    def test_identified_activity_without_transition_is_invalid(self) -> None:
        trace = valid_identified_trace()
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "activity-transition"
        ]
        resequence(trace["events"])
        path = self.write_trace("identified-missing-transition.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("without a current activity transition", errors)
        self.assertIn("missing an activity-transition event", errors)

    def test_identified_activity_requires_durable_protocol_reference(self) -> None:
        trace = valid_identified_trace()
        trace["requirements"]["required_references"].remove(
            "durable-record-protocol.md"
        )
        path = self.write_trace("identified-missing-protocol.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "must include durable-record-protocol.md",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_transition_before_durable_protocol_load_is_invalid(self) -> None:
        trace = valid_identified_trace()
        events = trace["events"]
        reference_index = next(
            index
            for index, item in enumerate(events)
            if item["type"] == "reference-load"
            and item["data"].get("reference") == "durable-record-protocol.md"
        )
        transition_index = next(
            index for index, item in enumerate(events) if item["type"] == "activity-transition"
        )
        events[reference_index], events[transition_index] = (
            events[transition_index],
            events[reference_index],
        )
        resequence(events)
        path = self.write_trace("transition-before-protocol.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "activity transition precedes durable-record-protocol.md",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_identified_material_trace_requires_investigation_event(self) -> None:
        trace = valid_identified_trace()
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "material-investigation"
        ]
        resequence(trace["events"])
        path = self.write_trace("identified-missing-investigation.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "missing a material-investigation event",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_material_investigation_before_transition_is_invalid(self) -> None:
        trace = valid_identified_trace()
        events = trace["events"]
        investigation = next(
            item for item in events if item["type"] == "material-investigation"
        )
        events.remove(investigation)
        transition_index = next(
            index for index, item in enumerate(events) if item["type"] == "activity-transition"
        )
        events.insert(transition_index, investigation)
        resequence(events)
        path = self.write_trace("investigation-before-transition.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "material investigation occurs without a current activity transition",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_planned_transition_blocks_material_investigation(self) -> None:
        trace = valid_identified_trace(
            "planned-and-awaiting-approval",
            applicable={"risk-ambiguity-or-high-risk-boundary"},
        )
        path = self.write_trace("planned-transition.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("without a current activity transition", errors)
        self.assertIn("resolved activity transition", errors)

    def test_same_session_cannot_veto_an_applicable_gate_condition(self) -> None:
        trace = valid_identified_trace(
            "no-record-with-valid-reason",
            applicable={"risk-ambiguity-or-high-risk-boundary"},
            reason="same session",
        )
        path = self.write_trace("same-session-veto.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "no-record result has applicable gate conditions",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_created_transition_must_name_its_gate_condition(self) -> None:
        trace = valid_identified_trace("created")
        path = self.write_trace("created-without-trigger.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "created transition must name an applicable gate condition",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_unknown_gate_trigger_is_invalid(self) -> None:
        trace = valid_identified_trace("no-record-with-valid-reason")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"].insert(
            mutation_index,
            event(
                "durable-gate-trigger",
                "observed",
                "unrecognized trigger",
                {"trigger": "same-session"},
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("unknown-gate-trigger.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "not a recognized durable gate condition",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_missing_record_must_evaluate_every_gate_condition(self) -> None:
        trace = valid_identified_trace("no-record-with-valid-reason")
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["evaluated_gate_conditions"].remove("material-correction")
        path = self.write_trace("incomplete-gate-evaluation.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "does not evaluate all durable gate conditions",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_new_gate_trigger_invalidates_transition_and_readiness(self) -> None:
        trace = valid_identified_trace("no-record-with-valid-reason")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index:mutation_index] = [
            event(
                "durable-gate-trigger",
                "observed",
                "material correction changed continuity need",
                {"trigger": "material-correction"},
            ),
            event(
                "material-investigation",
                "observed",
                "dependent evidence inspection attempted",
            ),
        ]
        resequence(trace["events"])
        path = self.write_trace("gate-trigger-invalidates.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("without a current activity transition", errors)
        self.assertIn("mutation occurs without current READY", errors)

    def test_refreshed_transition_and_ready_after_gate_trigger_pass(self) -> None:
        trace = valid_identified_trace("no-record-with-valid-reason")
        add_required_reference(trace, "continuous-activity-capture.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index:mutation_index] = [
            event(
                "durable-gate-trigger",
                "observed",
                "material correction changed continuity need",
                {"trigger": "material-correction"},
            ),
            activity_transition_event(
                "created",
                applicable={"material-correction"},
                reason="approved durable record now covers the correction",
            ),
            event(
                "evidence-backed-understanding",
                "reported",
                "understanding refreshed after durable transition",
            ),
            canonical_capture_event(
                "capture-transition",
                reason="new transition and refreshed understanding",
            ),
            event(
                "readiness",
                "passed",
                "receipt refreshed after activity transition",
                {
                    "result": "READY",
                    "receipt_fields": sorted(
                        {
                            *TRACE_TOOL.REQUIRED_RECEIPT_FIELDS,
                            TRACE_TOOL.ACTIVITY_SOURCE_RECEIPT_FIELD,
                            TRACE_TOOL.ACTIVITY_TRANSITION_RECEIPT_FIELD,
                            TRACE_TOOL.CAPTURE_FRESHNESS_RECEIPT_FIELD,
                        }
                    ),
                    "basis_revision": 1,
                    "activity_transition_result": "created",
                    "capture_state": "complete",
                    "last_capture_event": "capture-transition",
                },
            ),
            canonical_capture_event(
                "capture-refreshed-readiness",
                reason="refreshed readiness decision",
            ),
        ]
        audit_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "final-audit"
        )
        trace["events"][audit_index]["data"]["canonical_state_reconciled"] = True
        trace["events"].insert(
            audit_index,
            canonical_capture_event(
                "capture-created-final",
                reason="implementation and verification changed current state",
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("gate-trigger-refreshed.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_observed_gate_trigger_cannot_be_erased_by_another_no_record_result(self) -> None:
        trace = valid_identified_trace("no-record-with-valid-reason")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index:mutation_index] = [
            event(
                "durable-gate-trigger",
                "observed",
                "material correction changed continuity need",
                {"trigger": "material-correction"},
            ),
            activity_transition_event(
                "no-record-with-valid-reason",
                reason="same session still in progress",
            ),
            event(
                "readiness",
                "passed",
                "attempted receipt refresh",
                {
                    "result": "READY",
                    "receipt_fields": sorted(TRACE_TOOL.REQUIRED_RECEIPT_FIELDS),
                },
            ),
        ]
        resequence(trace["events"])
        path = self.write_trace("gate-trigger-erased.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("leaves observed gate triggers unresolved", errors)
        self.assertIn("resolved activity transition", errors)

    def test_verified_observable_bridge_passes(self) -> None:
        trace = valid_trace()
        trace["requirements"]["observable_equivalence"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].append(
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD
        )
        readiness["data"]["observable_equivalence"] = (
            observable_equivalence_artifact()
        )
        path = self.write_trace("observable-equivalence-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_unknown_observable_bridge_cannot_be_ready(self) -> None:
        trace = valid_trace()
        trace["requirements"]["observable_equivalence"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].append(
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD
        )
        readiness["data"]["observable_equivalence"] = (
            observable_equivalence_artifact(
                equivalence="unknown",
                bridge_complete=False,
                action="investigate",
            )
        )
        path = self.write_trace("observable-equivalence-unknown.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "cannot support READY",
            " ".join(payload["results"][0]["errors"]),
        )
        self.assertIn(
            "mutation occurs without current READY",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_refuted_equivalence_cannot_authorize_forced_parity(self) -> None:
        trace = valid_trace()
        trace["requirements"]["observable_equivalence"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].append(
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD
        )
        readiness["data"]["observable_equivalence"] = (
            observable_equivalence_artifact(
                equivalence="refuted",
                bridge_complete=True,
                action="stop",
            )
        )
        path = self.write_trace("observable-equivalence-refuted.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "cannot support READY",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_complete_asynchronous_delivery_trace_passes(self) -> None:
        trace = valid_trace()
        trace["requirements"]["asynchronous_delivery"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].append(
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD
        )
        readiness["data"]["asynchronous_delivery"] = (
            asynchronous_delivery_artifact()
        )
        path = self.write_trace("async-delivery-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_unknown_asynchronous_stage_cannot_be_ready(self) -> None:
        trace = valid_trace()
        trace["requirements"]["asynchronous_delivery"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].append(
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD
        )
        artifact = asynchronous_delivery_artifact()
        artifact["stages"]["notification-or-invalidation-boundary"] = "unknown"
        readiness["data"]["asynchronous_delivery"] = artifact
        path = self.write_trace("async-delivery-unknown.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "blocked or unknown stages",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_source_replacement_requires_propagation_check(self) -> None:
        trace = valid_trace()
        trace["requirements"]["asynchronous_delivery"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].append(
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD
        )
        artifact = asynchronous_delivery_artifact()
        artifact["source_mechanism_decision"] = "replacement-supported"
        artifact["propagation_checked_before_source_replacement"] = False
        readiness["data"]["asynchronous_delivery"] = artifact
        path = self.write_trace("async-source-replacement.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "before checking downstream propagation",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_authorized_effect_scope_passes(self) -> None:
        trace = valid_trace()
        trace["requirements"]["effect_scope"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["authorized_effect_classes"] = [
            "production-source-or-configuration",
            "read-only-discovery",
        ]
        mutation = next(
            item
            for item in trace["events"]
            if item["type"] == "implementation-mutation"
        )
        mutation["data"]["effect_class"] = "production-source-or-configuration"
        verification = next(
            item for item in trace["events"] if item["type"] == "verification"
        )
        verification["data"]["effect_classes"] = ["read-only-discovery"]
        path = self.write_trace("effect-scope-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_unauthorized_implementation_effect_is_invalid(self) -> None:
        trace = valid_trace()
        trace["requirements"]["effect_scope"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["authorized_effect_classes"] = [
            "production-source-or-configuration",
            "read-only-discovery",
        ]
        mutation = next(
            item
            for item in trace["events"]
            if item["type"] == "implementation-mutation"
        )
        mutation["data"]["effect_class"] = (
            "local-environment-or-operational-state"
        )
        verification = next(
            item for item in trace["events"] if item["type"] == "verification"
        )
        verification["data"]["effect_classes"] = ["read-only-discovery"]
        path = self.write_trace("effect-scope-unauthorized-mutation.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "uses unauthorized effect class",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_verification_cannot_hide_environment_effect(self) -> None:
        trace = valid_trace()
        trace["requirements"]["effect_scope"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["authorized_effect_classes"] = [
            "production-source-or-configuration",
            "read-only-discovery",
        ]
        mutation = next(
            item
            for item in trace["events"]
            if item["type"] == "implementation-mutation"
        )
        mutation["data"]["effect_class"] = "production-source-or-configuration"
        verification = next(
            item for item in trace["events"] if item["type"] == "verification"
        )
        verification["data"]["effect_classes"] = [
            "local-environment-or-operational-state"
        ]
        path = self.write_trace("effect-scope-verification.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "verification uses unauthorized effect classes",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_auxiliary_artifact_cannot_be_regression_guard(self) -> None:
        trace = valid_trace()
        protection = next(
            item
            for item in trace["events"]
            if item["type"] == "regression-protection"
        )
        protection["data"]["artifact"]["classification"] = "auxiliary"
        path = self.write_trace("auxiliary-protection.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "cannot use 'auxiliary' as contract regression protection",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_decision_alignment_before_readiness_passes(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        path = self.write_trace("decision-alignment-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        self.assertEqual(
            payload["results"][0]["summary"]["decision_alignment_count"],
            1,
        )

    def test_ready_without_declared_direction_alignment_is_invalid(self) -> None:
        trace = valid_trace()
        trace["requirements"]["decision_alignment"] = True
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].append(
            TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD
        )
        path = self.write_trace("decision-alignment-missing.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("DIRECTION-ALIGNED", errors)
        self.assertIn("no decision-alignment event", errors)

    def test_initial_ambiguity_can_continue_before_later_alignment(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        evidence_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "evidence-backed-understanding"
        )
        trace["events"].insert(
            evidence_index,
            decision_alignment_event("CONTINUE-INVESTIGATION"),
        )
        resequence(trace["events"])
        path = self.write_trace("decision-alignment-continue.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        self.assertEqual(
            payload["results"][0]["summary"]["decision_alignment_count"],
            2,
        )

    def test_scenario_coverage_with_current_collaborator_response_passes(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        path = self.write_trace("scenario-coverage-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        self.assertEqual(
            payload["results"][0]["summary"]["scenario_coverage_count"],
            1,
        )

    def test_scenario_coverage_with_prior_specific_delegation_passes(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(
            trace,
            alignment_basis_type="prior-scope-specific-delegation",
        )
        path = self.write_trace("scenario-coverage-delegated.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_light_scenario_coverage_can_use_evidence_basis(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace, effort_level="light")
        path = self.write_trace("scenario-coverage-light.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_generic_implementation_request_cannot_align_standard_scenarios(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace, alignment_basis_type="none")
        scenario = next(
            item for item in trace["events"] if item["type"] == "scenario-coverage"
        )
        scenario["data"]["alignment_basis"] = "generic request to implement"
        path = self.write_trace("scenario-coverage-generic-request.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "requires a current collaborator response or prior scope-specific delegation",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_ready_without_scenario_coverage_event_is_invalid(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "scenario-coverage"
        ]
        resequence(trace["events"])
        path = self.write_trace("scenario-coverage-missing.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("SCENARIO-ALIGNED", errors)
        self.assertIn("no scenario-coverage event", errors)

    def test_scenario_coverage_requires_every_material_item_mapping(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        scenario = next(
            item for item in trace["events"] if item["type"] == "scenario-coverage"
        )
        scenario["data"]["material_items"].append("unmapped lifecycle state")
        path = self.write_trace("scenario-coverage-unmapped.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "leaves material items unmapped",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_scenario_coverage_rejects_unknown_scenario_reference(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        scenario = next(
            item for item in trace["events"] if item["type"] == "scenario-coverage"
        )
        scenario["data"]["coverage_mappings"][0]["scenario_ids"] = ["missing"]
        path = self.write_trace("scenario-coverage-unknown-scenario.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "references unknown scenarios",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_scenario_coverage_rejects_invalidated_mapped_scenario(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        scenario = next(
            item for item in trace["events"] if item["type"] == "scenario-coverage"
        )
        scenario["data"]["scenarios"][0]["execution_result"] = "invalidated"
        path = self.write_trace("scenario-coverage-invalidated-mapping.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "references invalidated scenarios",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_authorized_scenario_omission_passes(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        scenario = next(
            item for item in trace["events"] if item["type"] == "scenario-coverage"
        )
        scenario["data"]["material_items"].append("legacy environment")
        scenario["data"]["coverage_mappings"].append(
            {
                "material_item": "legacy environment",
                "disposition": "excluded-with-reason",
                "scenario_ids": [],
                "exclusion_reason": "outside the authorized product scope",
                "authority": "current collaborator scope response",
                "residual_risk": "behavior remains unverified there",
            }
        )
        scenario["data"]["explicit_omissions"] = ["legacy environment"]
        path = self.write_trace("scenario-coverage-omission.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_excluded_scenario_has_no_execution_result_and_can_be_mapped(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        coverage = next(
            item for item in trace["events"] if item["type"] == "scenario-coverage"
        )["data"]
        excluded = coverage["scenarios"][1]
        excluded["coverage_disposition"] = "excluded-with-reason"
        excluded.pop("execution_result")
        mapping = coverage["coverage_mappings"][1]
        mapping.update(
            {
                "disposition": "excluded-with-reason",
                "scenario_ids": [excluded["id"]],
                "exclusion_reason": "outside the authorized fixture scope",
                "authority": "current collaborator scope response",
                "residual_risk": "the adjacent consumer remains unexecuted",
            }
        )
        coverage["explicit_omissions"] = ["adjacent consumer"]
        path = self.write_trace("scenario-coverage-excluded-scenario.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)
        self.assertEqual(payload["status"], "valid")

    def test_scenario_alignment_must_follow_current_evidence(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        events = trace["events"]
        scenario = next(item for item in events if item["type"] == "scenario-coverage")
        events.remove(scenario)
        evidence_index = next(
            index
            for index, item in enumerate(events)
            if item["type"] == "evidence-backed-understanding"
        )
        events.insert(evidence_index, scenario)
        resequence(events)
        path = self.write_trace("scenario-coverage-before-evidence.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "precedes current evidence-backed understanding",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_scenario_alignment_requires_material_investigation(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "material-investigation"
        ]
        resequence(trace["events"])
        path = self.write_trace("scenario-coverage-no-investigation.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("precedes material investigation", errors)
        self.assertIn("missing a material-investigation event", errors)

    def test_scenario_coverage_requires_verification_reference(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        trace["requirements"]["required_references"].remove("verification.md")
        path = self.write_trace("scenario-coverage-no-reference.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "scenario_coverage requirements must include references",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_scenario_coverage_requires_its_readiness_receipt_field(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["receipt_fields"].remove(
            TRACE_TOOL.SCENARIO_COVERAGE_RECEIPT_FIELD
        )
        path = self.write_trace("scenario-coverage-missing-receipt.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            TRACE_TOOL.SCENARIO_COVERAGE_RECEIPT_FIELD,
            " ".join(payload["results"][0]["errors"]),
        )

    def test_awaiting_scenario_alignment_cannot_reach_ready(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace, result="AWAITING-COLLABORATOR")
        path = self.write_trace("scenario-coverage-awaiting.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "SCENARIO-ALIGNED coverage contract",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_direction_and_scenario_alignment_can_share_one_flow(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        enable_scenario_coverage(trace)
        path = self.write_trace("combined-alignment.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_new_material_consumer_invalidates_scenario_alignment(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        readiness_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "readiness"
        )
        trace["events"].insert(
            readiness_index + 1,
            event(
                "readiness-invalidation",
                "invalidated",
                "new material consumer discovered",
                {
                    "affected_fields": ["scenario-coverage-contract"],
                    "cause": "new-consumer",
                    "affected_scenario_items": ["new shared consumer"],
                },
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("scenario-coverage-invalidated.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("mutation occurs without current READY", errors)
        self.assertIn("no current SCENARIO-ALIGNED contract", errors)

    def test_refreshed_scenario_alignment_and_readiness_after_discovery_pass(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        readiness_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "readiness"
        )
        refreshed_readiness = event(
            "readiness",
            "passed",
            "receipt refreshed after scenario discovery",
            {
                "result": "READY",
                "receipt_fields": sorted(
                    {
                        *TRACE_TOOL.REQUIRED_RECEIPT_FIELDS,
                        TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD,
                        TRACE_TOOL.SCENARIO_COVERAGE_RECEIPT_FIELD,
                    }
                ),
                "basis_revision": 2,
                "activity_transition_result": "not-applicable",
                "capture_state": "not-applicable",
                "last_capture_event": "",
            },
        )
        trace["events"][readiness_index + 1 : readiness_index + 1] = [
            event(
                "readiness-invalidation",
                "invalidated",
                "new material consumer discovered",
                {
                    "affected_fields": ["scenario-coverage-contract"],
                    "cause": "new-consumer",
                    "affected_scenario_items": ["new shared consumer"],
                },
            ),
            event(
                "evidence-backed-understanding",
                "reported",
                "understanding refreshed after consumer discovery",
            ),
            scenario_coverage_event(),
            refreshed_readiness,
        ]
        resequence(trace["events"])
        path = self.write_trace("scenario-coverage-refreshed.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_epistemic_realignment_hard_stop_can_end_blocked(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["epistemic_reconciliation"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        audit = next(item for item in trace["events"] if item["type"] == "final-audit")
        report = next(item for item in trace["events"] if item["type"] == "report")
        trace["events"] = [
            *trace["events"][:mutation_index],
            epistemic_invalidation_event(),
            epistemic_hard_stop_event(),
            audit,
            report,
        ]
        trace["outcome"]["status"] = "blocked"
        trace["outcome"]["summary"] = "awaiting collaborator after realignment stop"
        resequence(trace["events"])
        path = self.write_trace("epistemic-hard-stop-blocked.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        self.assertEqual(
            payload["results"][0]["summary"]["epistemic_hard_stop_count"],
            1,
        )

    def test_epistemic_hard_stop_receipt_can_report_blocked(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["epistemic_reconciliation"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        audit = next(item for item in trace["events"] if item["type"] == "final-audit")
        report = next(item for item in trace["events"] if item["type"] == "report")
        trace["events"] = [
            *trace["events"][:mutation_index],
            epistemic_invalidation_event(),
            epistemic_hard_stop_event(result="BLOCKED"),
            audit,
            report,
        ]
        trace["outcome"]["status"] = "blocked"
        trace["outcome"]["summary"] = "blocked after epistemic realignment stop"
        resequence(trace["events"])
        path = self.write_trace("epistemic-hard-stop-result-blocked.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_epistemic_hard_stop_requires_reconciliation_receipt(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["epistemic_reconciliation"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        audit = next(item for item in trace["events"] if item["type"] == "final-audit")
        report = next(item for item in trace["events"] if item["type"] == "report")
        trace["events"] = [
            *trace["events"][:mutation_index],
            epistemic_invalidation_event(),
            audit,
            report,
        ]
        trace["outcome"]["status"] = "blocked"
        resequence(trace["events"])
        path = self.write_trace("epistemic-hard-stop-missing-receipt.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "no hard-stop receipt",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_mutation_after_unresolved_epistemic_hard_stop_is_invalid(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["epistemic_reconciliation"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index:mutation_index] = [
            epistemic_invalidation_event(),
            epistemic_hard_stop_event(),
        ]
        resequence(trace["events"])
        path = self.write_trace("epistemic-hard-stop-mutation.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("mutation occurs without current READY", errors)
        self.assertIn("mutation occurs with unresolved RECOVERY", errors)

    def test_dependent_artifacts_require_recovery_severity(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["epistemic_reconciliation"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index + 1 : mutation_index + 1] = [
            epistemic_invalidation_event(dependent_artifacts=True),
            epistemic_hard_stop_event(
                dependent_artifacts=True,
                severity="REALIGNMENT",
            ),
        ]
        resequence(trace["events"])
        path = self.write_trace("epistemic-recovery-severity.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "with dependent artifacts must use RECOVERY severity",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_explicit_directional_rejection_uses_the_same_hard_stop(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["epistemic_reconciliation"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        audit = next(item for item in trace["events"] if item["type"] == "final-audit")
        report = next(item for item in trace["events"] if item["type"] == "report")
        trigger = "explicit-directional-rejection"
        trace["events"] = [
            *trace["events"][:mutation_index],
            epistemic_invalidation_event(trigger=trigger),
            epistemic_hard_stop_event(trigger=trigger),
            audit,
            report,
        ]
        trace["outcome"]["status"] = "blocked"
        resequence(trace["events"])
        path = self.write_trace("directional-rejection-stop.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_collaborator_response_can_reopen_investigation_and_readiness(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["epistemic_reconciliation"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        refreshed_readiness = event(
            "readiness",
            "passed",
            "new readiness after collaborator response and reinvestigation",
            {
                "result": "READY",
                "receipt_fields": sorted(
                    {
                        *TRACE_TOOL.REQUIRED_RECEIPT_FIELDS,
                        TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD,
                    }
                ),
                "basis_revision": 2,
                "activity_transition_result": "not-applicable",
                "capture_state": "not-applicable",
                "last_capture_event": "",
            },
        )
        trace["events"][mutation_index:mutation_index] = [
            epistemic_invalidation_event(),
            epistemic_hard_stop_event(),
            decision_alignment_event(
                "CONTINUE-INVESTIGATION",
                after_hard_stop=True,
            ),
            event(
                "material-investigation",
                "observed",
                "bounded investigation after collaborator response",
            ),
            event(
                "evidence-backed-understanding",
                "reported",
                "new evidence-backed understanding after the hard stop",
            ),
            decision_alignment_event(),
            refreshed_readiness,
        ]
        resequence(trace["events"])
        path = self.write_trace("epistemic-hard-stop-resolved.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_correction_after_mutation_requires_recovery(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["correction_recovery"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["direction"] = "direction-a"
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index]["data"]["direction"] = "direction-a"
        trace["events"].insert(
            mutation_index + 1,
            event(
                "readiness-invalidation",
                "invalidated",
                "material correction after mutation",
                {
                    "affected_fields": ["falsifiable-claim-and-result"],
                    "cause": "material-correction",
                    "direction": "direction-a",
                    "dependent_mutation": True,
                },
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("correction-requires-recovery.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "completed outcome has unresolved recovery or durable capture",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_valid_recovery_requires_turn_boundary_and_fresh_readiness(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["correction_recovery"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["direction"] = "direction-a"
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index]["data"]["direction"] = "direction-a"
        refreshed = event(
            "readiness",
            "passed",
            "new readiness epoch after recovery",
            {
                "result": "READY",
                "receipt_fields": sorted(
                    {
                        *TRACE_TOOL.REQUIRED_RECEIPT_FIELDS,
                        TRACE_TOOL.TRIGGERED_PROTOCOL_RECEIPT_FIELD,
                    }
                ),
                "direction": "direction-a",
                "basis_revision": 2,
                "activity_transition_result": "not-applicable",
                "capture_state": "not-applicable",
                "last_capture_event": "",
            },
        )
        trace["events"][mutation_index + 1 : mutation_index + 1] = [
            event(
                "readiness-invalidation",
                "invalidated",
                "material correction after mutation",
                {
                    "affected_fields": ["falsifiable-claim-and-result"],
                    "cause": "material-correction",
                    "direction": "direction-a",
                    "dependent_mutation": True,
                },
            ),
            epistemic_hard_stop_event(dependent_artifacts=True),
            decision_alignment_event(
                "CONTINUE-INVESTIGATION",
                after_hard_stop=True,
            ),
            event(
                "material-investigation",
                "observed",
                "bounded reconstruction after collaborator response",
            ),
            event(
                "evidence-backed-understanding",
                "reported",
                "direction reconstructed after recovery",
            ),
            decision_alignment_event(),
            refreshed,
        ]
        resequence(trace["events"])
        path = self.write_trace("correction-recovery-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        self.assertEqual(
            payload["results"][0]["summary"]["recovery_count"],
            1,
        )

    def test_recovery_without_active_trigger_is_invalid(self) -> None:
        trace = valid_trace()
        trace["requirements"]["correction_recovery"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        readiness = next(
            item for item in trace["events"] if item["type"] == "readiness"
        )
        readiness["data"]["direction"] = "direction-a"
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"][mutation_index]["data"]["direction"] = "direction-a"
        trace["events"].insert(mutation_index, recovery_event())
        resequence(trace["events"])
        path = self.write_trace("recovery-without-trigger.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "recovery event has no active recovery trigger",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_second_correction_in_same_direction_requires_recovery(self) -> None:
        trace = valid_trace()
        enable_decision_alignment(trace)
        trace["requirements"]["correction_recovery"] = True
        add_required_reference(trace, "epistemic-integrity.md")
        readiness_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "readiness"
        )
        trace["events"][readiness_index]["data"]["direction"] = "direction-a"
        mutation = next(
            item
            for item in trace["events"]
            if item["type"] == "implementation-mutation"
        )
        mutation["data"]["direction"] = "direction-a"
        corrections = [
            event(
                "readiness-invalidation",
                "invalidated",
                f"material correction {number}",
                {
                    "affected_fields": ["falsifiable-claim-and-result"],
                    "cause": "material-correction",
                    "direction": "direction-a",
                    "dependent_mutation": False,
                },
            )
            for number in (1, 2)
        ]
        trace["events"][readiness_index + 1 : readiness_index + 1] = corrections
        resequence(trace["events"])
        path = self.write_trace("second-correction-recovery.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "unresolved RECOVERY",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_final_canonical_reconciliation_passes(self) -> None:
        trace = valid_trace()
        trace["requirements"]["canonical_reconciliation"] = True
        add_required_reference(trace, "continuous-activity-capture.md")
        audit_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "final-audit"
        )
        trace["events"][audit_index]["data"]["canonical_state_reconciled"] = True
        trace["events"].insert(audit_index, canonical_capture_event())
        resequence(trace["events"])
        path = self.write_trace("canonical-reconciliation-valid.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")
        self.assertEqual(
            payload["results"][0]["summary"]["canonical_reconciliation_count"],
            1,
        )

    def test_stale_canonical_capture_cannot_complete(self) -> None:
        trace = valid_trace()
        trace["requirements"]["canonical_reconciliation"] = True
        add_required_reference(trace, "continuous-activity-capture.md")
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"].insert(mutation_index, canonical_capture_event())
        audit = next(
            item for item in trace["events"] if item["type"] == "final-audit"
        )
        audit["data"]["canonical_state_reconciled"] = True
        resequence(trace["events"])
        path = self.write_trace("canonical-reconciliation-stale.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "lacks a final canonical reconciliation",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_missing_regression_protection_is_invalid(self) -> None:
        trace = valid_trace()
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "regression-protection"
        ]
        resequence(trace["events"])
        path = self.write_trace("missing-protection.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("no final regression-protection", " ".join(payload["results"][0]["errors"]))

    def test_completed_mutation_requires_passed_verification(self) -> None:
        trace = valid_trace()
        target = next(item for item in trace["events"] if item["type"] == "verification")
        target["status"] = "failed"
        path = self.write_trace("failed-verification.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("no later passed verification", " ".join(payload["results"][0]["errors"]))

    def test_completed_outcome_requires_passed_final_audit(self) -> None:
        trace = valid_trace()
        target = next(item for item in trace["events"] if item["type"] == "final-audit")
        target["status"] = "failed"
        path = self.write_trace("failed-final-audit.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("no passed final audit", " ".join(payload["results"][0]["errors"]))

    def test_extra_field_and_noncontiguous_sequence_are_invalid(self) -> None:
        trace = valid_trace()
        trace["unexpected"] = True
        trace["events"][0]["seq"] = 4
        path = self.write_trace("shape-errors.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("unsupported fields", errors)
        self.assertIn("seq must equal 1", errors)

    def test_declared_behavioral_violation_makes_compliance_invalid(self) -> None:
        trace = valid_trace()
        trace["violations"] = ["first mutation preceded READY"]
        path = self.write_trace("declared-violation.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn("declares behavioral violations", " ".join(payload["results"][0]["errors"]))

    def test_malformed_event_fails_cleanly(self) -> None:
        trace = valid_trace()
        trace["events"].insert(2, "not-an-event")
        path = self.write_trace("malformed-event.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("event #3 must be an object", errors)
        self.assertNotIn("unexpected failure", errors)

    def test_malformed_scalar_types_fail_cleanly(self) -> None:
        trace = valid_trace()
        trace["outcome"]["status"] = []
        trace["requirements"]["required_references"] = [{}]
        trace["events"][0]["type"] = []
        trace["events"][1]["status"] = []
        path = self.write_trace("malformed-scalars.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("outcome.status is invalid", errors)
        self.assertIn("event #1.type is invalid", errors)
        self.assertIn("event #2.status is invalid", errors)
        self.assertNotIn("unexpected failure", errors)

    def test_ready_before_evidence_backed_understanding_is_invalid(self) -> None:
        trace = valid_trace()
        events = trace["events"]
        ready_index = next(index for index, item in enumerate(events) if item["type"] == "readiness")
        evidence_index = next(
            index for index, item in enumerate(events) if item["type"] == "evidence-backed-understanding"
        )
        events[ready_index], events[evidence_index] = events[evidence_index], events[ready_index]
        resequence(events)
        path = self.write_trace("misordered-understanding.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "evidence-backed understanding",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_one_invalid_trace_makes_batch_invalid(self) -> None:
        valid_path = self.write_trace("valid.json", valid_trace())
        invalid = valid_trace()
        invalid["events"] = [item for item in invalid["events"] if item["type"] != "final-audit"]
        resequence(invalid["events"])
        invalid_path = self.write_trace("invalid.json", invalid)
        returncode, payload = self.run_tool(valid_path, invalid_path)
        self.assertEqual(returncode, 1)
        self.assertEqual(payload["status"], "invalid")
        self.assertEqual([item["status"] for item in payload["results"]], ["valid", "invalid"])

    def test_completed_material_change_requires_verification_disposition(self) -> None:
        trace = valid_trace()
        trace["events"] = [
            item
            for item in trace["events"]
            if item["type"] != "verification-disposition"
        ]
        resequence(trace["events"])
        path = self.write_trace("missing-verification-disposition.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "missing a verification-disposition event",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_direct_observable_verification_can_complete(self) -> None:
        trace = valid_trace()
        trace["requirements"]["observable_verification"] = True
        path = self.write_trace("direct-observable-verification.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_reproducible_handoff_does_not_complete_observable_contract(self) -> None:
        trace = valid_trace()
        trace["requirements"]["observable_verification"] = True
        position = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "verification-disposition"
        )
        trace["events"][position] = verification_disposition_event(
            "reproducible-handoff",
            coverage="direct",
            result="not-run",
        )
        path = self.write_trace("handoff-is-not-completion.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("cannot rely on a handoff", errors)
        self.assertIn("requires a passed direct", errors)

    def test_vague_handoff_is_invalid_even_for_partial_outcome(self) -> None:
        trace = valid_trace()
        trace["outcome"]["status"] = "partial"
        position = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "verification-disposition"
        )
        handoff = verification_disposition_event(
            "reproducible-handoff",
            coverage="direct",
            result="not-run",
        )
        handoff["data"]["entry_surface"] = ""
        handoff["data"]["steps"] = []
        trace["events"][position] = handoff
        path = self.write_trace("vague-handoff.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "handoff is missing executable details",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_available_authorized_observable_check_cannot_be_handed_off_unattempted(self) -> None:
        trace = valid_trace()
        trace["outcome"]["status"] = "partial"
        position = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "verification-disposition"
        )
        handoff = verification_disposition_event(
            "reproducible-handoff",
            coverage="direct",
            result="not-run",
        )
        handoff["data"]["execution_access"] = "available-authorized"
        trace["events"][position] = handoff
        path = self.write_trace("available-check-unattempted.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "available authorized observable check unattempted",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_activity_source_mismatch_blocks_readiness(self) -> None:
        trace = valid_identified_trace()
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["consistency_result"] = "blocked"
        transition["data"]["consistency_evidence"] = (
            "activity and delivery state identify different work"
        )
        path = self.write_trace("activity-source-mismatch.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "source/delivery-state consistency",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_explicitly_accepted_activity_source_mismatch_can_pass(self) -> None:
        trace = valid_identified_trace()
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["consistency_result"] = "mismatch-accepted"
        transition["data"]["consistency_evidence"] = (
            "collaborator kept the current delivery state intentionally"
        )
        transition["data"]["consistency_authority"] = (
            "current collaborator response accepting the exact mismatch"
        )
        path = self.write_trace("activity-source-mismatch-accepted.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0)
        self.assertEqual(payload["status"], "valid")

    def test_root_only_activity_bootstrap_plan_is_invalid(self) -> None:
        trace = valid_identified_trace(
            "planned-and-awaiting-approval",
            applicable={"cross-session-continuity"},
        )
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["planned_postconditions"] = ["privacy-boundary"]
        path = self.write_trace("root-only-bootstrap.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "planned transition is not outcome-complete",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_created_activity_requires_retrieval_proof(self) -> None:
        trace = valid_identified_trace(
            "created",
            applicable={"cross-session-continuity"},
        )
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["retrieval_verified"] = False
        path = self.write_trace("created-without-retrieval.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "retrieval_verified must be true",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_delegated_record_must_be_reconciled_before_completion(self) -> None:
        trace = valid_identified_trace()
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "durable-capture"
        ]
        resequence(trace["events"])
        path = self.write_trace("delegated-record-not-updated.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("final audit precedes canonical reconciliation", errors)
        self.assertIn("has no valid durable-capture event", errors)

    def test_capability_routed_mutation_passes(self) -> None:
        trace = valid_trace()
        trace["requirements"]["capability_routing"] = True
        skill_load_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "skill-load"
        )
        trace["events"].insert(
            skill_load_index + 1,
            capability_route_event(
                "work.resolve",
                continue_with="change.investigate",
            ),
        )
        readiness_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "readiness"
        )
        trace["events"].insert(
            readiness_index + 1,
            capability_route_event(
                "change.ready",
                continue_with="change.apply",
                implementation_mutation="ALLOWED",
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("capability-routed-mutation.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)
        self.assertEqual(payload["status"], "valid")

    def test_capability_routing_rejects_mutation_without_ready_route(self) -> None:
        trace = valid_trace()
        trace["requirements"]["capability_routing"] = True
        skill_load_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "skill-load"
        )
        trace["events"].insert(
            skill_load_index + 1,
            capability_route_event(
                "work.resolve",
                continue_with="change.investigate",
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("missing-ready-capability-route.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("lacks a current allowed change.ready capability route", errors)
        self.assertIn("has no change.ready result", errors)

    def test_non_readiness_capability_cannot_allow_mutation(self) -> None:
        trace = valid_trace()
        trace["requirements"]["capability_routing"] = True
        skill_load_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "skill-load"
        )
        trace["events"].insert(
            skill_load_index + 1,
            capability_route_event(
                "work.resolve",
                continue_with="change.investigate",
            ),
        )
        readiness_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "readiness"
        )
        trace["events"].insert(
            readiness_index + 1,
            capability_route_event(
                "change.investigate",
                continue_with="change.apply",
                implementation_mutation="ALLOWED",
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("non-ready-capability-allows.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "only change.ready CONTINUE may allow mutation",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_claim_driven_tool_evidence_passes(self) -> None:
        trace = valid_trace()
        trace["requirements"]["tool_evidence_routing"] = True
        add_required_reference(trace, "context-layers.md")
        target = next(item for item in trace["events"] if item["type"] == "tool-invocation")
        target["data"] = tool_evidence_data()
        path = self.write_trace("claim-driven-tool.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)
        self.assertEqual(payload["results"][0]["summary"]["tool_evidence_count"], 1)

    def test_tool_follow_up_requires_named_material_gap(self) -> None:
        trace = valid_trace()
        trace["requirements"]["tool_evidence_routing"] = True
        add_required_reference(trace, "context-layers.md")
        target = next(item for item in trace["events"] if item["type"] == "tool-invocation")
        target["data"] = tool_evidence_data(continuation="follow-up")
        path = self.write_trace("tool-follow-up-without-gap.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "continuing route must name a remaining material gap",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_exact_tool_locations_require_decision_reason(self) -> None:
        trace = valid_trace()
        trace["requirements"]["tool_evidence_routing"] = True
        add_required_reference(trace, "context-layers.md")
        target = next(item for item in trace["events"] if item["type"] == "tool-invocation")
        target["data"] = tool_evidence_data(detail_level="exact-locations")
        path = self.write_trace("exact-locations-without-reason.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "exact-locations detail must name the material decision",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_untrusted_tool_result_does_not_satisfy_required_tool(self) -> None:
        trace = valid_trace()
        trace["requirements"]["tool_evidence_routing"] = True
        add_required_reference(trace, "context-layers.md")
        target = next(item for item in trace["events"] if item["type"] == "tool-invocation")
        target["status"] = "partial"
        target["data"] = tool_evidence_data(
            result_status="untrusted",
            continuation="fallback",
            remaining_gap="current symbol identity remains untrusted",
        )
        path = self.write_trace("untrusted-required-tool.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "READY precedes required tools or sufficient fallbacks",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_claim_driven_sufficient_fallback_satisfies_required_tool(self) -> None:
        trace = valid_trace()
        trace["requirements"]["tool_evidence_routing"] = True
        add_required_reference(trace, "context-layers.md")
        target_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "tool-invocation"
        )
        fallback_data = tool_evidence_data()
        fallback_data.update(
            {
                "coverage_lost": "runtime reachability still needs another lane",
                "effect_on_readiness": "sufficient for the bounded structural claim",
                "sufficient": True,
            }
        )
        trace["events"][target_index] = event(
            "tool-fallback",
            "passed",
            "bounded fallback established the required structural claim",
            fallback_data,
        )
        resequence(trace["events"])
        path = self.write_trace("claim-driven-sufficient-fallback.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)
        self.assertEqual(payload["results"][0]["summary"]["tool_evidence_count"], 1)

    def test_clean_changed_artifact_diagnostics_pass(self) -> None:
        trace = valid_trace()
        trace["requirements"]["changed_artifact_diagnostics"] = True
        audit_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "final-audit"
        )
        trace["events"].insert(audit_index, diagnostic_coverage_event())
        resequence(trace["events"])
        path = self.write_trace("clean-changed-artifact-diagnostics.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)
        self.assertEqual(payload["results"][0]["summary"]["diagnostic_coverage_count"], 1)

    def test_missing_changed_artifact_diagnostics_is_invalid(self) -> None:
        trace = valid_trace()
        trace["requirements"]["changed_artifact_diagnostics"] = True
        path = self.write_trace("missing-changed-artifact-diagnostics.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "has no diagnostic-coverage event",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_diagnostics_before_last_mutation_are_stale(self) -> None:
        trace = valid_trace()
        trace["requirements"]["changed_artifact_diagnostics"] = True
        mutation_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["type"] == "implementation-mutation"
        )
        trace["events"].insert(mutation_index, diagnostic_coverage_event())
        resequence(trace["events"])
        path = self.write_trace("stale-changed-artifact-diagnostics.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "applied mutation has no later changed-artifact diagnostic coverage",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_current_changed_error_blocks_completed_outcome(self) -> None:
        trace = valid_trace()
        trace["requirements"]["changed_artifact_diagnostics"] = True
        current_error = {
            "artifact": "src/example.ts",
            "diagnostic": "missing identifier",
            "attribution": "introduced",
            "evidence": "current diagnostic reports the changed line",
            "disposition": "blocks-completion",
            "authority": "",
        }
        audit_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "final-audit"
        )
        trace["events"].insert(
            audit_index,
            diagnostic_coverage_event(result="blocked", current_errors=[current_error]),
        )
        resequence(trace["events"])
        path = self.write_trace("current-changed-error.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "completed outcome has unresolved changed-artifact diagnostic coverage",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_authorized_pre_existing_diagnostic_residual_can_complete(self) -> None:
        trace = valid_trace()
        trace["requirements"]["changed_artifact_diagnostics"] = True
        current_error = {
            "artifact": "src/example.ts",
            "diagnostic": "known legacy diagnostic",
            "attribution": "pre-existing",
            "evidence": "the same diagnostic is reproduced in the comparable baseline",
            "disposition": "accepted-residual",
            "authority": "current project policy permits this bounded residual",
        }
        audit_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "final-audit"
        )
        trace["events"].insert(
            audit_index,
            diagnostic_coverage_event(
                result="bounded-residual",
                current_errors=[current_error],
                coverage_lost="the changed artifact is not diagnostically clean",
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("authorized-pre-existing-residual.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)

    def test_untrusted_diagnostics_require_fallback_and_lost_coverage(self) -> None:
        trace = valid_trace()
        trace["requirements"]["changed_artifact_diagnostics"] = True
        audit_index = next(
            index for index, item in enumerate(trace["events"]) if item["type"] == "final-audit"
        )
        trace["events"].insert(
            audit_index,
            diagnostic_coverage_event(
                result="bounded-residual",
                untrusted_artifacts=["src/example.ts"],
                coverage_lost="the current-document diagnostic could not be trusted",
            ),
        )
        resequence(trace["events"])
        path = self.write_trace("untrusted-diagnostics-without-fallback.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "untrusted diagnostics require fallback and lost coverage",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_identified_activity_requires_bootstrap_context(self) -> None:
        trace = valid_identified_trace()
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "context-bootstrap"
        ]
        resequence(trace["events"])
        path = self.write_trace("missing-bootstrap-context.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("activity transition precedes bootstrap context", errors)
        self.assertIn("missing bootstrap context resolution", errors)

    def test_scenario_coverage_requires_seed_before_investigation(self) -> None:
        trace = valid_trace()
        enable_scenario_coverage(trace)
        trace["events"] = [
            item for item in trace["events"] if item["type"] != "scenario-seed"
        ]
        resequence(trace["events"])
        path = self.write_trace("missing-scenario-seed.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "has no scenario-seed event",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_material_investigation_waits_for_pending_capture(self) -> None:
        trace = valid_identified_trace()
        trace["events"] = [
            item
            for item in trace["events"]
            if item["data"].get("event_id") != "capture-intake"
        ]
        resequence(trace["events"])
        path = self.write_trace("investigation-before-capture.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "material investigation occurs before required durable capture",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_loaded_pending_capture_can_reconcile_before_investigation(self) -> None:
        trace = valid_identified_trace()
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["pending_capture"] = True
        transition["data"]["pending_capture_event"] = "capture-intake"
        path = self.write_trace("loaded-pending-capture-reconciled.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)
        self.assertEqual(payload["status"], "valid")

    def test_loaded_pending_capture_rejects_replacement_identity(self) -> None:
        trace = valid_identified_trace()
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["pending_capture"] = True
        transition["data"]["pending_capture_event"] = "interrupted-event"
        path = self.write_trace("loaded-pending-capture-replaced.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "does not reconcile the pending capture identity",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_implementation_mutation_waits_for_readiness_capture(self) -> None:
        trace = valid_identified_trace()
        trace["events"] = [
            item
            for item in trace["events"]
            if item["data"].get("event_id") != "capture-readiness"
        ]
        resequence(trace["events"])
        path = self.write_trace("mutation-before-capture.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "mutation occurs before required durable capture",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_capture_incomplete_blocks_completion(self) -> None:
        trace = valid_identified_trace()
        final_capture_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["data"].get("event_id") == "capture-final"
        )
        trace["events"][final_capture_index] = incomplete_capture_event("capture-final")
        resequence(trace["events"])
        path = self.write_trace("capture-incomplete.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("final audit precedes required durable capture", errors)
        self.assertIn("completed outcome has unresolved recovery or durable capture", errors)
        self.assertEqual(payload["results"][0]["summary"]["capture_incomplete_count"], 1)

    def test_capture_incomplete_can_be_reconciled_with_same_event_identity(self) -> None:
        trace = valid_identified_trace()
        final_capture_index = next(
            index
            for index, item in enumerate(trace["events"])
            if item["data"].get("event_id") == "capture-final"
        )
        trace["events"][final_capture_index:final_capture_index] = [
            incomplete_capture_event("capture-final")
        ]
        resequence(trace["events"])
        path = self.write_trace("capture-reconciled.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)
        self.assertEqual(payload["results"][0]["summary"]["capture_incomplete_count"], 1)

    def test_stale_capture_basis_does_not_clear_pending_state(self) -> None:
        trace = valid_identified_trace()
        final_capture = next(
            item
            for item in trace["events"]
            if item["data"].get("event_id") == "capture-final"
        )
        final_capture["data"]["basis_revision"] = 2
        path = self.write_trace("stale-capture-basis.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "does not match the current activity basis",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_audit_correction_requires_capture_before_reporting(self) -> None:
        trace = valid_identified_trace()
        audit = next(item for item in trace["events"] if item["type"] == "final-audit")
        audit["data"]["material_correction"] = True
        path = self.write_trace("audit-correction-not-captured.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        errors = " ".join(payload["results"][0]["errors"])
        self.assertIn("report occurs before required durable capture", errors)
        self.assertIn("lacks a final canonical reconciliation", errors)

    def test_standard_no_record_result_requires_explicit_exception_basis(self) -> None:
        trace = valid_identified_trace("no-record-with-valid-reason")
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        del transition["data"]["durable_exception_basis"]
        path = self.write_trace("standard-no-record-no-exception.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "durable_exception_basis must be a non-empty string",
            " ".join(payload["results"][0]["errors"]),
        )

    def test_light_no_record_result_can_continue_without_durable_exception(self) -> None:
        trace = valid_identified_trace("no-record-with-valid-reason")
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        transition["data"]["effort_level"] = "light"
        del transition["data"]["durable_exception_basis"]
        path = self.write_trace("light-no-record.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 0, payload)

    def test_created_record_requires_storage_preflight(self) -> None:
        trace = valid_identified_trace(
            "created",
            applicable={"cross-session-continuity"},
        )
        transition = next(
            item for item in trace["events"] if item["type"] == "activity-transition"
        )
        del transition["data"]["storage_preflight"]
        path = self.write_trace("created-without-storage-preflight.json", trace)
        returncode, payload = self.run_tool(path)
        self.assertEqual(returncode, 1)
        self.assertIn(
            "storage_preflight must be an object",
            " ".join(payload["results"][0]["errors"]),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
