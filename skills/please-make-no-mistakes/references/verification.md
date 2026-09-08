# Verification

Load this reference when planning checks, defining scenarios, interpreting results, handing tests to a human or deciding whether repeatable regression protection is sufficient.

## Start from the contract

Write the property the check could falsify:

```text
Under <preconditions>, when <action occurs>, <observable result> holds while <preserved behavior> remains unchanged.
```

The name of a test layer does not make it sufficient. Select evidence by proximity to this property, ability to distinguish the known defect, current-state relevance and repeatability.

Make every material branch observably distinct in the check. An identity transform, permissive stub or shared fixture that produces the same result along competing paths can hide the wrong branch. Change the fixture or assertion so the incorrect path yields a different observation; otherwise report that branch as unproven.

## Scenario set

Seed scenarios from the human's request before broad investigation. Refine them from inspected entry points, consumers, state, permissions, persistence, delivery, errors, history and risk.

Consider when relevant:

- intended success path
- negative and denied paths
- boundary and empty values
- legacy or missing data
- repeated execution and retries
- concurrency and stale responses
- shared consumers and alternate entry points
- failure and recovery behavior
- preserved behavior outside the change

Do not generate a Cartesian product without evidence. Every material scenario is either planned or excluded with a reason and residual risk.

The scenario set belongs in the plan Digest when it can change scope or solution choice. Agreement with the Digest aligns the relevant coverage. A newly discovered material consumer or state may withdraw that agreement.

## Cross-boundary values

Use transitive `impact.md` mode when a material value crosses a place where its meaning, identity or availability can change. Connect the producer or source, each transformation or partial reconstruction, each contract or transport boundary and every material consumer or variant to a planned scenario or an evidence-backed disposition.

A helper-level check cannot prove that a value survived its producer, boundaries and observable consumers. Select evidence at the boundary where the wrong value could be dropped, replaced, delayed or reinterpreted. When both an explicit value and fallback precedence matter, the fixture and assertion for the explicit value and fallback precedence must produce distinguishable observations. Newly discovered material consumers, variants or precedence rules make the affected Digest and evidence stale.

Test material combinations, not only individual mechanisms. If one path reconstructs part of an object and a later path applies a fallback, create a case where the correct explicit value and the fallback yield different observations. A passing producer check plus a passing fallback check does not prove their composition. For every transitive ledger edge, name which observation would fail if that edge dropped, overwrote or reinterpreted the value.

## Evidence lanes

Use the lanes that can answer the claim:

| Lane | Strong for | Does not prove by itself |
| --- | --- | --- |
| Static inspection | structure, types, configuration and code paths | runtime reachability or actual state |
| Semantic navigation | definitions, references, callers and symbol diagnostics | full observable behavior |
| Focused executable check | a bounded repeatable contract | unexercised scenarios |
| Integration or interface run | connected behavior in one environment | every environment or future protection |
| Logs and traces | events that occurred under recorded conditions | absence outside captured scope |
| Persisted data inspection | stored state at a point in time | how it was produced without lineage |
| Human observation | product meaning and visible behavior | an automated future detector |
| History | ordered change and comparable revisions | intent or complete causality |

Two weak lanes do not automatically become one strong lane. Combine them when each closes a different bridge.

## Delegated execution

When one actor designs an operation and another executes it, keep executor and observer separate. The execution package names the intended effect and boundary, exact scope, prerequisites, expected cost or load, stop signal, cleanup and the evidence the executor must return. It also distinguishes evidence already available, evidence visible only during execution and evidence that can be checked afterward. An executor's successful response proves only the operation they report; a later observer must verify the resulting contract through an independent observable when one exists.

“Read-only” means no intended mutation. It does not mean free, fast or safe at arbitrary scope. Bound consequential reads by target, expected work and a stop condition. Use an observable clock, source timestamp or revision for freshness; when none is available, record freshness as unknown rather than deriving a date from memory.

## Choose the strongest sufficient accessible check

Two checks come first in every task: the request's own case, and the behavior that must not change. Write them as claims with observed results before choosing any other check. When the plan contains non-file state objectives, preserve their agreed identity as `state: <id> — <before> => <after>` and `unchanged-state: <id> — <invariant>` lines in the same evidence file.

Before implementation, state:

- the changed contract
- the scenarios that matter
- the intended repeatable protection
- the strongest observable check available
- any required capability and whether it is executable
- what remains for a human or unavailable environment

Write those decisions in `verification.md` before a Standard or High plan Digest using these fields: `contract`, `request-case`, `preserved-case`, `entry`, `environment`, `actor`, `data`, `steps`, `expect`, `capability`, `evidence` and `cleanup`. Each field needs an actionable value. `Not applicable` and `unavailable` need the reason that keeps the limitation honest.

For interface behavior, inspect the capabilities actually exposed by the host and project before assigning the run to the human. Look for an executable interface driver, documented local entry points, safe fixture creation, data-query tools and authenticated-session constraints. The pattern is capability discovery, not dependence on one browser framework. If data chooses a branch, connect the safe record to the persisted field, transformation and observable result; a plausible record name is not evidence that it exercises the code path.

When verification depends on starting or restarting local resources, preflight the environment before requesting authority or running the service. Resolve command indirection recursively, inspect current configuration and resources, identify ownership, check health, reuse what is healthy and start only what is missing. If a manager reports one state while the actual process or resource reports another, the environment is unknown until rediscovered. Record this in task-local `environment.md`; do not turn a repository-specific command into a global rule.

After implementation, attempt the strongest sufficient check that is accessible and authorized. Convenience is not a reason to substitute lint for behavior. For non-file state, separate evidence that the exact operation succeeded from evidence that the resulting state matches the agreed contract. A receipt or successful tool response establishes only the first. A declared non-persistent verification follows the read path until observed evidence shows a mutation; its name does not manufacture one. A check that rewrites source, snapshots, generated output or build state is a project mutation. Record the resulting state, invalidate prior plan authority and verify again against the new state.

Syntax, metadata, documentation and exploratory checks may support investigation or validate a tool, but they do not become final task verification merely because they pass. Keep their literal results as evidence. Do not issue a passed verification receipt or move to the Test Digest while planned file objectives are open.

Inspection is not an executed check. If code changed and project evidence exposes an executable check, do not report passed verification from inspection alone without asking the human to accept that weaker evidence. Human verification is not passed until the human reports the observation in a later turn. When the human declares the check is theirs, no other passing check substitutes for it: record `how=human` after their report, not `how=command` for something else that ran. A failed or unavailable check remains failed, blocked or partial; inspection does not erase it.

When a check is too broad, flaky or expensive, use a focused discriminator first and then the widest proportional check that can still change confidence. Record the cost and limitation rather than silently skipping it.

## Adjudicate semantic evidence when risk requires it

At High effort, or when the human asks, use a non-author review to challenge what the current evidence can support. Bind `review.md` to the current plan hash, verification fingerprint and changed surface. Record the contract, author evidence, strongest concrete counterexample, one genuinely different independent check, any disagreement and the residual limit. When `impact.md` applies, the reviewer also derives impact roots independently, asks what the plan omitted and checks the six non-functional dispositions.

The review is evidence, not a verdict. Its job is to expose a non-discriminating check, a substitute that exercises another contract, stale evidence, a missing precondition or a branch where correct and incorrect behavior look identical. If the independent check repeats the author's evidence, the counterexample is unavailable, or disagreement remains, do not make an unqualified passed claim. Reconcile the evidence with the human or close as partial or blocked.

The Codex guard can verify that the packet is present, current, distinct in text and free of an explicitly unresolved disagreement. It cannot prove that the reviewer is independent, that a counterexample is strongest or that either interpretation is correct. Other hosts apply the same reasoning without claiming this structural enforcement.

## Interpret every result literally

For each material check record:

```text
Claim:
Method or command:
Environment and relevant fixture:
Literal result:
What it proves:
What it does not prove:
Status: passed | failed | partial | blocked
```

For a planned state transition, also retain its stable objective id, agreed before and after values, exact operation identity, literal operation result and the observation that tests the resulting state. For preserved state, retain the invariant and how it was checked. Never turn a successful command into a claim that external state changed when no result observation supports it.

Separate:

- `failed`: the product violates the tested contract
- `blocked`: the check did not reach the product assertion
- `partial`: only part of the intended contract ran
- environment failure: setup, resources or tooling prevented a valid result

A check that never started is not a failed product test. A clean diagnostic is not a user-visible pass. A manual handoff is not executed evidence.

## Changed artifacts

Every changed artifact supported by a current executable diagnostic should receive coverage before closure. This includes new files and generated or configuration surfaces that are part of the Digest.

For each changed artifact, record one of:

- covered by a named current check
- covered indirectly through a named contract and why
- unsupported by the available diagnostic channel
- intentionally excluded with reason and risk

Do not call the result clean when a relevant diagnostic was truncated, stale, unavailable or run against a different source state.

## Repeatable regression protection

Current behavior and future detection are independent:

1. **Current verification:** evidence that the intended behavior occurs now.
2. **Repeatable protection:** an executable check likely to fail if the material defect returns.

For a behavior correction or contract-sensitive refactor, add or identify repeatable protection unless it is not applicable or a stronger existing check already covers the recurrence. State which.

Do not require a unit test merely by category. Prefer the narrowest layer that can observe the failure without mocking away its cause. A unit test is useful when the contract is local. An integration or interface check is necessary when the defect exists only across a bridge. A static rule may be strongest for a structural invariant.

A proposed regression check is admissible only when:

- it can fail for a real violation of the task contract
- it passed or failed against the intended source state as reported
- its fixtures represent material preconditions
- it does not merely restate the implementation
- its result is not explained by an unrelated environment failure
- its fixture makes the relevant incorrect path observably fail

## Negative and repeated behavior

Verify denial, absence and repeated behavior directly when material. Useful questions include:

- Does the forbidden action remain forbidden through every reachable entry point?
- Does an empty or missing value preserve the intended fallback?
- Does retry duplicate state, spend authority twice or apply a stale response?
- Does a repeated action retain identity and ordering?
- Does the change expose an existing defect to a new consumer?

Negative search evidence is not an execution result. To claim an effect does not occur, observe the boundary that would reveal it under controlled conditions.

## Test Digest

The plan Digest belongs before implementation and asks whether the proposed work is acceptable. The Test Digest belongs after implementation, current verification, any required independent review and the agent's final audit. It is the human acceptance handoff, normally immediately before commit, submit or close. Never present it as an intermediate progress report or in place of the plan Digest.

After implementation, translate the remaining observable verification into this exact ordered shape. Each field has a non-empty value on the same line:

```text
Test — <task id>
Where: <URL, screen, command or endpoint>
Environment: <runtime and required setup>
As: <user, role, account or caller characteristics>
Data: <safe fixture or record and its provenance>
Steps: 1. … 2. … 3. …
Expect: <what should be seen at each material step>
Evidence: <what to retain>
Cleanup: <what must be restored, or why none is needed>
Can run: <yes with the available capability | no with the exact limitation>
```

Investigate the real execution surface before asking the human. Supply known URL or entry point, environment, safe fixture characteristics, input values, expected observations, evidence to retain and cleanup. Never invent credentials, names or data. A repository route, runtime query or interface inspection may establish these details; a ticket description alone usually cannot.

When an available interface tool can run the Digest safely, offer to execute it. When it cannot, say which capability or authority is missing and that the check has not run. Show the Digest only after the final audit is current, then wait for a later human response.

## Corrections and stale evidence

Evidence is bound to its source, environment, fixture and conditions. Invalidate the affected result when any of those materially changes.

A new consumer, changed contract, corrected assumption, failed required capability, modified fixture or post-check source edit requires the smallest affected verification to run again. Preserve the former result as historical evidence, not current proof.

## Final disposition

Before the audit, summarize:

- planned scenarios and their literal results
- repeatable protection status
- diagnostics on changed artifacts
- human-only or unavailable checks
- remaining uncertainty and risk

Completion is bounded by that evidence. A passed audit requires a current passed verification even when no implementation was needed. Do not use “all tests pass” unless every test in the declared set ran and passed on the current source state.
