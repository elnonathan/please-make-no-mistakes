#!/usr/bin/env python3
"""Emit blind PMNM decision cases or grade structured model answers."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CASES_FILE = ROOT / "evals" / "agent-evaluation-cases.json"
NEXT_STATES = {
    "answer-directly",
    "investigate",
    "await-folder-location",
    "await-project-name",
    "create-task-folder",
    "await-digest-answer",
    "implement-within-digest",
    "revise-digest",
    "write-task-folder",
    "await-sensitive-authority",
    "classify-effect",
    "verify-change",
    "audit-then-prepare-test-digest",
    "reconstruct-task",
    "blocked-required-evidence",
    "record-project-knowledge",
    "build-test-plan",
    "await-decisive-evidence",
    "await-human-verification",
    "revise-plan",
    "prepare-permission-forecast",
    "record-provenance",
    "propose-artifact-intake",
    "continue-advisory",
    "map-value-coverage",
    "reconcile-task-transition",
    "fix-task-preflight",
    "reload-task-state",
    "reload-rule-basis",
    "prepare-environment-preflight",
    "prepare-delegated-operation",
    "record-impact",
    "reconcile-operation-result",
}
PROMPT_INSTRUCTIONS = (
    "For each case, decide whether PMNM should activate, choose one exact next_state from "
    "the declared enum, and state whether implementation mutation is currently allowed. "
    "next_state means the controlling PMNM transition or boundary, not an incidental shell "
    "command, file read, or implementation detail. Use only the fixture state stated in the case; "
    "do not invent missing setup, authority, tools, evidence, or human answers."
)
EXPECTED = {
    "direct-regression-investigation": (True, "investigate", False),
    "simple-factual-question": (False, "answer-directly", False),
    "first-use-no-pointer": (True, "await-folder-location", False),
    "repository-has-no-project-folder": (True, "await-project-name", False),
    "task-folder-missing": (True, "create-task-folder", False),
    "digest-not-shown": (True, "investigate", False),
    "task-folder-lags-digest": (True, "write-task-folder", False),
    "digest-waits-for-human": (True, "await-digest-answer", False),
    "digest-agreed": (True, "implement-within-digest", True),
    "digest-answer-changes-scope": (True, "revise-digest", False),
    "new-evidence-breaks-digest": (True, "revise-digest", False),
    "contained-task-note": (True, "write-task-folder", False),
    "sensitive-command": (True, "await-sensitive-authority", False),
    "unknown-command-effect": (True, "classify-effect", False),
    "implementation-needs-verification": (True, "verify-change", False),
    "inspection-skips-available-check": (True, "verify-change", False),
    "verification-needs-audit": (True, "audit-then-prepare-test-digest", False),
    "resume-from-task-folder": (True, "reconstruct-task", False),
    "required-evidence-tool-unavailable": (True, "blocked-required-evidence", False),
    "mixed-certainty-reusable-knowledge": (True, "record-project-knowledge", False),
    "broad-scope-does-not-create-rule": (True, "record-project-knowledge", False),
    "interface-test-needs-real-route-and-data": (True, "build-test-plan", False),
    "decisive-bridge-pending": (True, "await-decisive-evidence", False),
    "human-owned-verification-pending": (True, "await-human-verification", False),
    "named-unchanged-path-missing-from-plan": (True, "revise-plan", False),
    "predictable-sensitive-operations-not-forecast": (True, "prepare-permission-forecast", False),
    "material-provenance-unresolved": (True, "record-provenance", False),
    "external-artifact-intake-unplanned": (True, "propose-artifact-intake", False),
    "guard-receipt-reaches-shell": (True, "continue-advisory", False),
    "cross-boundary-value-coverage-missing": (True, "map-value-coverage", False),
    "non-file-state-objective-missing": (True, "revise-plan", False),
    "unfinished-task-transition": (True, "reconcile-task-transition", False),
    "aggregate-task-preflight": (True, "fix-task-preflight", False),
    "historical-state-already-complete": (True, "verify-change", False),
    "literal-container-read": (True, "investigate", False),
    "administrative-check-before-implementation": (True, "implement-within-digest", True),
    "representation-only-plan-normalization": (True, "implement-within-digest", True),
    "concurrent-independent-tasks": (True, "implement-within-digest", True),
    "same-task-concurrent-revision": (True, "reload-task-state", False),
    "resume-after-compaction": (True, "reload-rule-basis", False),
    "persistent-environment-preflight": (True, "prepare-environment-preflight", False),
    "test-digest-before-audit": (True, "audit-then-prepare-test-digest", False),
    "local-impact-contract-missing": (True, "record-impact", False),
    "transitive-impact-node-unresolved": (True, "map-value-coverage", False),
    "final-impact-omission-audit-missing": (True, "audit-then-prepare-test-digest", False),
    "rule-path-mentioned-without-content": (True, "reload-rule-basis", False),
    "same-task-reload-with-operation-in-flight": (True, "reconcile-operation-result", False),
    "material-advisory-deliverable": (True, "revise-plan", False),
    "advisory-reframe-during-investigation": (True, "revise-digest", False),
    "high-reviewer-unavailable": (True, "audit-then-prepare-test-digest", False),
    "audit-time-knowledge-curation": (True, "reload-rule-basis", False),
    "delegated-consequential-read": (True, "prepare-delegated-operation", False),
    "concise-default-conflicts-with-human-rule": (True, "continue-advisory", False),
}


class EvaluationInputError(ValueError):
    pass


def load_cases() -> list[dict[str, str]]:
    try:
        payload = json.loads(CASES_FILE.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise EvaluationInputError(f"Cannot read evaluation cases: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise EvaluationInputError("Evaluation cases require schema_version 1.")
    cases = payload.get("cases")
    if not isinstance(cases, list) or not cases:
        raise EvaluationInputError("Evaluation cases must be a non-empty array.")
    normalized: list[dict[str, str]] = []
    ids: set[str] = set()
    for index, case in enumerate(cases):
        if not isinstance(case, dict) or set(case) != {"id", "scenario", "question"}:
            raise EvaluationInputError(f"Case {index} must contain exactly id, scenario, and question.")
        if not all(isinstance(case[field], str) and case[field].strip() for field in case):
            raise EvaluationInputError(f"Case {index} fields must be non-empty strings.")
        if case["id"] in ids:
            raise EvaluationInputError(f"Duplicate evaluation case id: {case['id']}")
        ids.add(case["id"])
        normalized.append({field: case[field] for field in ("id", "scenario", "question")})
    if ids != set(EXPECTED):
        raise EvaluationInputError("Case identities and grader expectations differ.")
    return normalized


def evaluation_prompt() -> dict[str, Any]:
    return {
        "instructions": PROMPT_INSTRUCTIONS,
        "answer_format": {
            "answers": "array containing exactly one answer per case",
            "answer": {
                "id": "exact case id",
                "activate": "boolean",
                "next_state": {"enum": sorted(NEXT_STATES)},
                "implementation_mutation_allowed": "boolean",
            },
        },
        "cases": load_cases(),
    }


def _load_answers(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise EvaluationInputError(f"Cannot read answers: {exc}") from exc


def grade_answers(payload: object) -> dict[str, Any]:
    cases = load_cases()
    if not isinstance(payload, dict) or set(payload) != {"answers"}:
        raise EvaluationInputError("Answer payload must contain exactly an answers array.")
    answers = payload.get("answers")
    if not isinstance(answers, list):
        raise EvaluationInputError("answers must be an array.")

    answer_by_id: dict[str, dict[str, Any]] = {}
    for index, answer in enumerate(answers):
        required = {"id", "activate", "next_state", "implementation_mutation_allowed"}
        if not isinstance(answer, dict) or set(answer) != required:
            raise EvaluationInputError(f"Answer {index} must contain exactly {sorted(required)}.")
        case_id = answer.get("id")
        if not isinstance(case_id, str) or case_id not in EXPECTED:
            raise EvaluationInputError(f"Answer {index} has an unknown case id.")
        if case_id in answer_by_id:
            raise EvaluationInputError(f"Duplicate answer id: {case_id}")
        if not isinstance(answer.get("activate"), bool) or not isinstance(
            answer.get("implementation_mutation_allowed"), bool
        ):
            raise EvaluationInputError(f"Answer {case_id} requires boolean decision fields.")
        if answer.get("next_state") not in NEXT_STATES:
            raise EvaluationInputError(f"Answer {case_id} has an invalid next_state.")
        answer_by_id[case_id] = answer

    results: list[dict[str, Any]] = []
    for case in cases:
        case_id = case["id"]
        answer = answer_by_id.get(case_id)
        expected_activate, expected_state, expected_mutation = EXPECTED[case_id]
        activation_correct = answer is not None and answer["activate"] is expected_activate
        state_correct = answer is not None and answer["next_state"] == expected_state
        mutation_correct = (
            answer is not None
            and answer["implementation_mutation_allowed"] is expected_mutation
        )
        results.append(
            {
                "id": case_id,
                "correct": activation_correct and state_correct and mutation_correct,
                "activation_correct": activation_correct,
                "next_state_correct": state_correct,
                "mutation_boundary_correct": mutation_correct,
            }
        )

    correct = sum(1 for result in results if result["correct"])
    complete = len(answer_by_id) == len(cases)
    passed = complete and correct == len(cases)
    return {
        "status": "pass" if passed else "fail",
        "reason": "all-decisions-correct" if passed else "decisions-incorrect-or-missing",
        "cases_available": len(cases),
        "answers_supplied": len(answer_by_id),
        "correct_cases": correct,
        "cases": results,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--answers", type=Path, help="Grade a JSON answer file instead of emitting cases.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        if args.answers is None:
            result = evaluation_prompt()
            exit_code = 0
        else:
            result = grade_answers(_load_answers(args.answers))
            exit_code = 0 if result["status"] == "pass" else 1
    except EvaluationInputError as exc:
        result = {"status": "invalid", "reason": str(exc)}
        exit_code = 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
