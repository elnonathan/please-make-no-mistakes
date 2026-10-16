#!/usr/bin/env python3
"""Contract tests for blind PMNM agent evaluations."""

from __future__ import annotations

import json
import unittest

from agent_evaluation import (
    ANSWER_LINE_SHAPE,
    EXPECTED,
    NEXT_STATES,
    PROMPT_INSTRUCTIONS,
    EvaluationInputError,
    evaluation_prompt,
    grade_answers,
    load_cases,
)


def correct_payload() -> dict[str, object]:
    answers = []
    for case in load_cases():
        activate, next_state, mutation_allowed = EXPECTED[case["id"]]
        answers.append(
            {
                "id": case["id"],
                "activate": activate,
                "next_state": next_state,
                "implementation_mutation_allowed": mutation_allowed,
            }
        )
    return {"answers": answers}


def correct_lines() -> str:
    lines = []
    for case in load_cases():
        activate, next_state, mutation_allowed = EXPECTED[case["id"]]
        lines.append(
            "answer id={id} activate={activate} next-state={state} mutation-allowed={mutation}".format(
                id=case["id"],
                activate="yes" if activate else "no",
                state=next_state,
                mutation="yes" if mutation_allowed else "no",
            )
        )
    return "\n".join(lines) + "\n"


def contains_expected_key(value: object) -> bool:
    if isinstance(value, dict):
        return "expected" in value or any(contains_expected_key(item) for item in value.values())
    if isinstance(value, list):
        return any(contains_expected_key(item) for item in value)
    return False


class AgentEvaluationTests(unittest.TestCase):
    def test_prompt_hides_expected_answers(self) -> None:
        prompt = evaluation_prompt()
        self.assertEqual(len(prompt["cases"]), len(EXPECTED))
        self.assertEqual(prompt["instructions"], PROMPT_INSTRUCTIONS)
        self.assertIn("controlling PMNM transition or boundary", prompt["instructions"])
        self.assertIn("do not invent missing setup", prompt["instructions"])
        self.assertFalse(contains_expected_key(prompt))
        self.assertTrue(all(set(case) == {"id", "scenario", "question"} for case in prompt["cases"]))

    def test_specialized_evidence_and_fallbacks_have_explicit_boundaries(self) -> None:
        self.assertIn("record-provenance", NEXT_STATES)
        self.assertIn("propose-artifact-intake", NEXT_STATES)
        self.assertIn("continue-advisory", NEXT_STATES)
        self.assertIn("map-value-coverage", NEXT_STATES)
        self.assertIn("material-provenance-unresolved", EXPECTED)
        self.assertIn("external-artifact-intake-unplanned", EXPECTED)
        self.assertIn("guard-receipt-reaches-shell", EXPECTED)
        self.assertIn("cross-boundary-value-coverage-missing", EXPECTED)
        self.assertIn("non-file-state-objective-missing", EXPECTED)

    def test_correct_decisions_pass_deterministically(self) -> None:
        result = grade_answers(correct_payload())
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["correct_cases"], len(EXPECTED))

    def test_incorrect_mutation_boundary_fails(self) -> None:
        payload = correct_payload()
        first = payload["answers"][0]
        first["implementation_mutation_allowed"] = not first[
            "implementation_mutation_allowed"
        ]
        result = grade_answers(payload)
        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["correct_cases"], len(EXPECTED) - 1)

    def test_missing_answer_fails_without_inference(self) -> None:
        payload = correct_payload()
        payload["answers"].pop()
        result = grade_answers(payload)
        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["answers_supplied"], len(EXPECTED) - 1)

    def test_duplicate_line_does_not_explain_a_different_missing_case(self) -> None:
        lines = correct_lines().splitlines()
        result = grade_answers("\n".join(lines[:-1] + [lines[0]]) + "\n")
        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["reason"], "decisions-incorrect-or-missing")

    def test_duplicate_or_unknown_answers_are_invalid(self) -> None:
        duplicate = correct_payload()
        duplicate["answers"].append(dict(duplicate["answers"][0]))
        with self.assertRaises(EvaluationInputError):
            grade_answers(duplicate)

        unknown = correct_payload()
        unknown["answers"][0]["id"] = "unknown-case"
        with self.assertRaises(EvaluationInputError):
            grade_answers(unknown)

    def test_prompt_shows_a_placeholder_line_not_a_data_shape(self) -> None:
        prompt = evaluation_prompt()
        self.assertNotIn("answer_format", prompt)
        self.assertEqual(prompt["answer_line"], ANSWER_LINE_SHAPE)
        self.assertIn("<case-id>", prompt["answer_line"])
        self.assertIn("<yes|no>", prompt["answer_line"])
        self.assertEqual(prompt["next_states"], sorted(NEXT_STATES))
        self.assertTrue(all(isinstance(state, str) for state in prompt["next_states"]))
        self.assertNotIn("enum", json.dumps(prompt))
        self.assertFalse(contains_expected_key(prompt))

    def test_line_answers_grade_like_json(self) -> None:
        result = grade_answers(correct_lines())
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["transport"], "lines")
        self.assertEqual(result["correct_cases"], len(EXPECTED))
        self.assertEqual(result["unscorable_cases"], 0)

    def test_one_malformed_line_loses_only_its_own_case(self) -> None:
        lines = correct_lines().splitlines()
        lines[3] = "answer id=" + load_cases()[3]["id"] + " activate=yes next-state="
        result = grade_answers("\n".join(lines) + "\n")
        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["correct_cases"], len(EXPECTED) - 1)
        self.assertEqual(result["unscorable_cases"], 1)
        self.assertEqual(result["unscorable"][0]["line"], 4)
        self.assertTrue(result["unscorable"][0]["reason"])

    def test_prose_and_fences_around_the_answers_are_ignored(self) -> None:
        body = correct_lines()
        decorated = "Here are my answers.\n\n```\n" + body + "```\n\nLet me know if anything is unclear.\n"
        result = grade_answers(decorated)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["unscorable_cases"], 0)

    def test_prose_that_starts_with_a_state_name_is_ignored(self) -> None:
        # a model that reasons in its reply wrote bullets such as
        # "- answer-directly fits ...". The prefix read them as answer lines, and the resulting
        # unscorable entry failed an otherwise complete, correct run.
        decorated = "- answer-directly fits the factual case\nanswer-directly is not material\n" + correct_lines()
        result = grade_answers(decorated)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["unscorable_cases"], 0)

    def test_a_preamble_that_starts_with_answer_is_ignored(self) -> None:
        # the prompt says other prose is ignored, yet this preamble
        # was read as an answer line and failed a complete, correct response as answers-unscorable.
        result = grade_answers("Answer: the requested lines follow\n" + correct_lines())
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["correct_cases"], len(EXPECTED))
        self.assertEqual(result["unscorable_cases"], 0)

    def test_a_malformed_line_that_leads_into_the_id_is_still_unscorable(self) -> None:
        lines = correct_lines().splitlines()
        case_id = load_cases()[0]["id"]
        for malformed in (f"answer id={case_id} activate=yes next-state=",
                          f"Answer: id={case_id} activate=perhaps next-state=investigate mutation-allowed=no"):
            with self.subTest(line=malformed):
                result = grade_answers("\n".join([malformed] + lines[1:]) + "\n")
                self.assertEqual(result["status"], "fail")
                self.assertEqual(result["unscorable_cases"], 1)
                self.assertEqual(result["correct_cases"], len(EXPECTED) - 1)

    def test_unknown_and_duplicate_line_ids_are_reported_not_fatal(self) -> None:
        body = correct_lines()
        extra = "answer id=unknown-case activate=yes next-state=investigate mutation-allowed=no\n"
        duplicate = body.splitlines()[0] + "\n"
        result = grade_answers(body + extra + duplicate)
        self.assertEqual(result["correct_cases"], len(EXPECTED))
        self.assertEqual(result["unscorable_cases"], 2)
        reasons = " ".join(entry["reason"] for entry in result["unscorable"])
        self.assertIn("unknown", reasons)
        self.assertIn("duplicate", reasons)

    def test_transport_failure_is_counted_apart_from_a_wrong_decision(self) -> None:
        lines = correct_lines().splitlines()
        lines[0] = lines[0].replace("next-state=", "next-state=not-a-state-", 1)
        lines[1] = "answer id=" + load_cases()[1]["id"] + " activate=maybe"
        result = grade_answers("\n".join(lines) + "\n")
        self.assertEqual(result["incorrect_cases"], 1)
        self.assertEqual(result["unscorable_cases"], 1)

    def test_the_two_observed_schema_copy_shapes_are_invalid_not_wrong(self) -> None:
        nested = {"answers": [{"answer": dict(correct_payload()["answers"][0])}]}
        with self.assertRaises(EvaluationInputError):
            grade_answers(nested)

        copied_enum = correct_payload()
        copied_enum["answers"][0]["next_state"] = {"enum": "investigate"}
        with self.assertRaises(EvaluationInputError):
            grade_answers(copied_enum)

        self.assertNotIn("enum", json.dumps(evaluation_prompt()))

    def test_repaired_high_miss_cases_keep_their_discriminator(self) -> None:
        by_id = {case["id"]: case for case in load_cases()}

        container = by_id["literal-container-read"]
        self.assertIn("fully visible", container["scenario"])
        self.assertNotIn("classification", container["question"])

        administrative = by_id["administrative-check-before-implementation"]
        self.assertIn("open implementation files", administrative["scenario"])
        self.assertIn("final task verification", administrative["question"])

        transitive = by_id["transitive-impact-node-unresolved"]
        self.assertIn("ledger is otherwise complete", transitive["scenario"])
        self.assertIn("no row for one of those consumers", transitive["scenario"])

    def test_json_answers_still_grade_and_report_their_transport(self) -> None:
        result = grade_answers(correct_payload())
        self.assertEqual(result["transport"], "json")
        self.assertEqual(result["unscorable_cases"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
