# Failure patterns

Mistakes with names. Recognize the pattern in the code in front of you; do not look for a remembered instance of it. Run through the relevant ones before you promote a direction, before the plan Digest, and before the audit. Do not run all of them mechanically.

## How a bad decision looks correct

- The first working example becomes the mental model for the whole feature.
- A helper removes duplication and quietly merges two contracts.
- A field looks right in the browser, so it is assumed to be the saved value.
- A library returns a convenient shape, so its fields are trusted without asking which are display, editable, persisted or authoritative.
- A proof of concept shows the API can work and is kept as proof the product works.
- The fix removes the symptom and the investigation stops before edit, save, reload, retry, navigation and stale responses.

## Code patterns

| Pattern | What it is |
| --- | --- |
| **Contract collapse** | one variable, helper or event carries several meanings: label, input text, selected object, persisted value, validation input |
| **Example overreach** | behavior inferred from one sample, one report, one provider response, one tested path |
| **Display/value confusion** | text made for humans reused as data for saving, matching, permissions or routing |
| **Summary/detail confusion** | a preview, search result, cache or optimistic state treated as final data |
| **Authority confusion** | frontend required fields, backend minimums, provider validation and persisted truth treated as interchangeable |
| **Lifecycle blindness** | correct on the first happy path only; wrong on edit, clear, reload, unmount, retry, concurrent or stale responses |
| **PoC promotion** | exploratory code kept after the question changed from "can it work" to "is it correct" |
| **Convenience inheritance** | a helper reused because it is nearby, not because it owns the same rule |
| **Presence/content confusion** | not `null` treated as present; empty string, empty array, whitespace pass the check |
| **Async state drift** | live state read after `await`, or a result written without checking the starting context still holds |
| **Predicate optimism** | `isValid`, `canSave`, `hasTranslation` named as domain truths but implemented as weak technical checks |
| **Fallback overtrust** | fallback treated as harmless while it hides the real failure or restores the bug |
| **Selector/mutator drift** | the list excludes records a direct mutation still accepts, or the reverse |
| **Partial contract review** | only the failing example and the changed function are checked, not every caller or every shape the helper accepts |
| **Review surface gap** | app behavior checked; tests, build config, worker path, import resolution or background execution missed |

## Process patterns

| Pattern | What it is |
| --- | --- |
| **Search miss as absence** | "not found" reported as "does not exist" without stating what was searched and how |
| **Assumption promotion** | an assumption stated once, then used as a fact two steps later |
| **Suggested-continuation chaining** | following a tool's or a card's suggestion as if it were the next required step |
| **Structural reach as impact** | a reference graph read as blast radius without confirming observable reachability |
| **One-hop impact** | direct callers or references checked while a later reconstruction, overwrite, fallback or consumer remains untraced |
| **Self-validating plan** | final review asks only whether the implementation matches the plan, so anything omitted by the plan is invisible |
| **Static closure overclaim** | static reach or a search result treated as proof across runtime, configuration, data or dynamic-dispatch boundaries |
| **Clean output as correctness** | a passing tool, empty diagnostic or clean diff read as proof beyond its declared scope |
| **Non-discriminating check** | a neutral stub, identity transform or shared fixture gives the same observation when either the correct or incorrect branch runs |
| **Happy-path closure** | verification of the requested path only; negative, repeated and concurrent paths untested |
| **Internal-check closure** | "I ran the unit tests" when a stronger observable check was reachable |
| **Administrative-check promotion** | a syntax, metadata or documentation check used as if it verified the unfinished task contract |
| **Serial preflight loop** | one metadata defect revealed per approval attempt instead of validating the complete task contract first |
| **Cross-task residue** | a prior task's plan, evidence, counters or authority used to block or satisfy the newly active task |
| **Session-global task** | one repository-wide active-task slot makes independent conversations block, authorize or close each other's work |
| **Stale-rule continuation** | work resumes after compaction or session discontinuity from remembered rules instead of reloading the durable rule basis |
| **Premature handoff** | a Test Digest interrupts work after a check but before required review and final audit are complete |
| **Blind environment start** | a generic start command runs before resolving indirection, ownership, health and whether the required resource already exists |
| **Patch chain** | a task producing follow-up fixes one by one instead of stopping to ask whether the contract is wrong |
| **Announced, not performed** | describing a run, a read or a check that did not happen |
| **Silent scope widening** | a new file, dependency or surface added without a new Digest |
| **Rule from a decision** | a one-time answer written as an always/never rule |
| **Authority inflation** | an agent's proposal, a relayed message, a hedged answer, an approval of a whole Digest read as approval of each line, or a one-round permission recorded later as the human's decision or rule |
| **Pending resurrection** | a settled decision presented again as pending because nobody checked the decision record |
| **Self-certified condition** | the agent declares that the human's condition for an approval is met |
| **Guessed identifier** | a path, type, enum, collection or name written from memory instead of a listing or a read |
| **Instrument as subject** | a broken checker, harness, sandbox or environment read as a product or model result |
| **Test weakening** | an assertion, case or fixture relaxed after it failed, so the test stops covering what it found |
| **Characterization creep** | tests written to pin current behavior, then used to justify repairing defects the request never asked for |
| **Defensive inflation** | retries, guards, fallbacks or abstractions added "to be safe" with no requirement behind them |
| **Process leakage** | working vocabulary, agent names, task ids or diagnostic scaffolding left in code, tests, comments or public text |
| **State stacking** | a new "current" section written above the old one until the current truth cannot be found |
| **Template saturation** | a record with many fixed fields filled by rote; the judgment that matters is missing from all of them |
| **Rule without a lever** | a failure recurs while a rule already covers it, and the response is to reword the rule again |

## Ask before coding

1. What exactly am I proving: API feasibility, UI behavior, saved shape, validation truth or workflow completion?
2. Which values are display-only, and which may cross a persistence, validation, backend or integration boundary?
3. What did I assume because one example passed? What felt off and I did not check?
4. What existing code am I copying, and what contract was it written for?
5. After every `await`, timeout, debounce or callback, is the starting context still current? If the fallback runs, can it reintroduce the defect?

## When a pattern is found

Write in the task folder: the decision that looked reasonable, the assumption behind it, the evidence that was available and underweighted, the boundary that should have stopped it, and the test or question that would have caught it. If it should never happen again, ask whether to save it as a rule.

## Forbidden shortcuts

Never infer that plausible means true, shared means equivalent, nearby means compatible, not found means absent, passing means complete, existing means protected, structural means observable, small means low risk, recent means causal, or announced means performed.
