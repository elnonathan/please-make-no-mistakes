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
    "await-record-approval",
    "await-context-location",
    "await-scenario-alignment",
    "await-reconciliation",
    "await-recovery",
    "escalate-capability",
    "blocked-required-evidence",
    "resolve-context-storage",
    "seed-scenarios",
    "capture-durable-state",
    "implement-within-authority",
}
EXPECTED = {
    "direct-regression-investigation": (True, "investigate", False),
    "simple-factual-question": (False, "answer-directly", False),
    "identified-activity-missing-record": (True, "await-record-approval", False),
    "scenario-alignment-pending": (True, "await-scenario-alignment", False),
    "epistemic-break-after-dependent-work": (True, "await-recovery", False),
    "required-tool-unavailable": (True, "blocked-required-evidence", False),
    "ready-with-bounded-authority": (True, "implement-within-authority", True),
    "resumption-source-not-established": (True, "investigate", False),
    "historical-contract-lineage-unresolved": (True, "investigate", False),
    "missing-context-location-before-record": (True, "await-context-location", False),
    "epistemic-break-before-dependent-work": (True, "await-reconciliation", False),
    "current-capacity-cannot-resolve-conflict": (True, "escalate-capability", False),
    "static-candidates-without-observable-bridge": (True, "investigate", False),
    "tool-suggestions-after-material-gap-is-closed": (
        True,
        "implement-within-authority",
        True,
    ),
    "current-diagnostic-error-after-mutation": (True, "investigate", False),
    "identified-standard-defaults-to-durable": (
        True,
        "await-record-approval",
        False,
    ),
    "storage-preflight-before-location-choice": (
        True,
        "resolve-context-storage",
        False,
    ),
    "material-event-awaits-capture": (True, "capture-durable-state", False),
    "scenario-seed-precedes-broad-investigation": (True, "seed-scenarios", False),
    "audit-correction-awaits-capture": (True, "capture-durable-state", False),
    "capture-incomplete-awaits-reconciliation": (
        True,
        "capture-durable-state",
        False,
    ),
    "light-local-work-stays-light": (True, "implement-within-authority", True),
    "harmless-corroboration-keeps-readiness": (
        True,
        "implement-within-authority",
        True,
    ),
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
        "instructions": (
            "For each case, decide whether PMNM should activate, choose one exact next_state from "
            "the declared enum, and state whether implementation mutation is currently allowed."
        ),
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
