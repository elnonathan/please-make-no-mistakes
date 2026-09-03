#!/usr/bin/env python3
"""Contract tests for blind PMNM agent evaluations."""

from __future__ import annotations

import unittest

from agent_evaluation import EXPECTED, EvaluationInputError, evaluation_prompt, grade_answers, load_cases


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
        self.assertFalse(contains_expected_key(prompt))
        self.assertTrue(all(set(case) == {"id", "scenario", "question"} for case in prompt["cases"]))

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

    def test_duplicate_or_unknown_answers_are_invalid(self) -> None:
        duplicate = correct_payload()
        duplicate["answers"].append(dict(duplicate["answers"][0]))
        with self.assertRaises(EvaluationInputError):
            grade_answers(duplicate)

        unknown = correct_payload()
        unknown["answers"][0]["id"] = "unknown-case"
        with self.assertRaises(EvaluationInputError):
            grade_answers(unknown)


if __name__ == "__main__":
    unittest.main(verbosity=2)
