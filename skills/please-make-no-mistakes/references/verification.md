# Please, Prove It — Verification

Use the smallest evidence set that can falsify the material contract. More checks are not automatically better; each check needs a claim, scope, and interpretation.

Sections: [lanes](#evidence-lanes) · [coverage](#please-plan-what-could-break) · [scenario](#scenario-record) · [statuses](#status-vocabulary) · [selection](#selecting-checks) · [readiness](#verification-intent-before-readiness) · [verifiable handoff](#please-keep-it-verifiable) · [diagnostics](#changed-artifact-diagnostic-gate) · [protection](#repeatable-regression-protection) · [admissibility](#regression-artifact-admissibility) · [equivalence](#observable-equivalence-verification) · [parity](#evidence-parity) · [historical oracle](#historical-oracle-stability) · [negative evidence](#absence-and-negative-behavior) · [manual evidence](#manual-and-automated-evidence) · [invalidation](#invalidation)

## Router contract

This reference implements `scenario.plan` and `result.verify`. Scenario gaps return `INVESTIGATE` or `ALIGN`. An executable current check returns its literal result to the router. A collaborator-controlled boundary returns a reproducible handoff, never a pass. A missing required environment, fixture, or evidence channel returns `BLOCKED` or `ESCALATE` with `resumeWith`.

## Evidence lanes

| Lane | Can establish | Cannot establish alone |
| --- | --- | --- |
| Static or semantic | Structure, symbol identity, candidate relationships, types, configuration shape | Runtime reachability, complete reference coverage, data state, product intent, global absence |
| Focused tests | Executed behavior for specified fixtures and assertions | Production wiring, untested scenarios, complete regression absence |
| Build, lint, or diagnostics | Conformance to the executed tool and configuration | Product correctness, runtime behavior, or semantic intent outside that scope |
| Runtime or logs | Executed path and observed state in one environment | Universal correctness, complete side effects, or user-visible rendering |
| Interface or browser | Visible behavior for one route, actor, data set, viewport, and session | Backend authorization, persistence, or all environments |
| API or data | Request, response, or stored state for one setup | Interface visibility, complete product intent, or all consumers |
| History | Prior changes, decisions, and likely context | Current authority, current source state, or current correctness |
| Manual observation | Human-observed behavior under declared conditions | Automated reproducibility unless the steps and result are captured |

## Please, Plan What Could Break

Use this responsibility for every material behavior change, defect correction, or contract-sensitive refactor. It creates a **Scenario Coverage Contract** before solution-shaped verification artifacts or implementation. It is not a required file, a testing framework, or proof that any scenario was executed.

Standard and High work require an explicit artifact. Light work MAY compress it when the behavior is genuinely local, reversible, well specified, and free of a material shared boundary. Escalate instead of compressing when investigation reveals another consumer, state, permission, persistence, delivery, configuration, or lifecycle dimension.

### Seed, then refine coverage

Before broad investigation, create a small seed set from the provisional observable contract: requested success, explicitly preserved behavior, and any immediately known denied or boundary state. Mark its source and uncertainty. Seeds are navigation hypotheses, not a claim of complete coverage.

Refine the same stable scenario identities as investigation establishes entry points, consumers, state, permissions, persistence, delivery, error behavior, history, and risk. Split or retire a seed only with an explicit mapping so the coverage trail remains understandable. Do not wait until after a solution is selected to ask what could break.

Use every applicable source class:

Use every applicable source class:

1. **Intent and authority:** requested behavior, acceptance criteria, domain rules, collaborator knowledge, non-goals, consequence, and risk acceptance.
2. **Inspected system surface:** entry points, normalization, identity and permission boundaries, state transitions, persistence, side effects, shared consumers, delivery paths, error behavior, configuration, and existing protection.
3. **Risk and history:** prior failures, adjacent invariants, known fragile boundaries, refuted hypotheses, change type, and consequence of omission.

Preserve source, basis, and verification status for material scenario claims. A task description does not establish complete technical reachability. Code does not establish product intent. Human recollection does not establish the full system surface.

Use a compatible semantic navigator for symbol identity and candidate relationships when a verified adapter makes it available and applicable, then corroborate material coverage through other evidence lanes. Otherwise use the safest sufficient combination of definitions, callers, text search, configuration, tests, direct inspection, and runtime evidence. State lost coverage. A remaining blast-radius uncertainty that can change the scenario contract keeps readiness below `READY`.

### Scenario Coverage Contract

Use one compact record per material scenario:

```text
Scenario identity and reason:
Contract dimension or affected consumer:
Source, basis, and verification status:
Preconditions — actor, state, data, environment, configuration:
Trigger or action:
Expected observable and preserved invariant:
Forbidden or failure outcome:
Evidence lane and candidate repeatable guard:
Coverage disposition: planned | excluded-with-reason
Execution result when planned:
  not-run | passed | failed-product | failed-environment | blocked |
  partial | invalidated
Coverage limit and residual risk:
```

Use these as omission prompts only when applicable:

- requested success behavior;
- preserved adjacent behavior and shared consumers;
- denied, invalid, empty, partial, or boundary conditions;
- state transitions, persistence, reopening, cancellation, or cleanup;
- repeated execution, retry, stale result, ordering, idempotence, or concurrency;
- failure and recovery behavior;
- identity, permission, configuration, compatibility, or lifecycle variants;
- relationships between surfaces when agreement is part of the contract.

Avoid a Cartesian product. Prefer evidence-backed partitions, boundary values, state transitions, decision combinations, and interaction pairs only where a material interaction exists. A large matrix is not evidence of completeness.

Create a coverage mapping from every material contract dimension and affected consumer to at least one scenario. If a material item will not be exercised, use mapping disposition `excluded-with-reason` and preserve the exclusion authority, reason, consequence, and residual risk. It may point to a corresponding scenario whose coverage disposition is also `excluded-with-reason`; that scenario has no execution result. Do not silently treat all adjacent behavior as in scope.

### Human scope-and-scenario checkpoint

After sufficient read-only investigation, show:

```text
Observable fix contract:
In scope:
Behavior that must remain unchanged:
Out of scope and non-goals:
Blast-radius evidence and tool limits:
Material scenario groups:
Explicit omissions and residual risk:
Product or domain uncertainty the system cannot answer:
Agent recommendation:
Exact collaborator decision or prior delegated basis:
Result: CONTINUE-INVESTIGATION | AWAITING-COLLABORATOR | SCENARIO-ALIGNED
```

Use the results literally:

- `CONTINUE-INVESTIGATION` permits safe read-only discovery and already authorized bounded instrumentation; it does not permit solution-shaped artifacts or implementation.
- `AWAITING-COLLABORATOR` ends the turn because the required human response or collaborator-owned decision is absent.
- `SCENARIO-ALIGNED` means the current coverage contract may be considered by change readiness. It is not implementation authority and does not authorize another effect class.

For Standard and High defect or material behavior work, `SCENARIO-ALIGNED` requires one current collaborator response to this evidence-backed checkpoint or a prior explicit scope-specific delegation covering the material scenario decisions. A generic request to implement is not such a response or delegation. Light work MAY use a compressed evidence-backed result without another response when no collaborator-owned product, scope, consequence, or risk decision remains.

Do not ask the collaborator to inspect code, enumerate callers, select routine test mechanics, or invent technical edge cases available from current sources. Ask only the smallest evidence-based product, scope, priority, operational, consequence, or risk question. When **Please, Align Before You Choose** also triggers, merge the user-facing presentation and ask at most one focused question; preserve separate direction and scenario results in the audit trail.

### Keep four claims separate

1. **Scenario coverage contract:** behavior that must be exercised or explicitly omitted.
2. **Current verification:** scenarios actually checked in the final state and what the evidence establishes.
3. **Repeatable regression protection:** scenarios with a discriminating guard expected to recur under declared conditions.
4. **Independent challenge:** additional exploration that did not treat the author's scenario inventory as complete.

A planned scenario is not current evidence. A one-time pass is not automatically a repeatable guard. An author-derived plan is not independent challenge. When an independent reviewer, tool, or validation function exists, provide the observable contract, reproducible conditions, known risks, evidence, and gaps without prescribing its complete exploration. Its material discoveries update and may invalidate the scenario contract. The first three responsibilities remain required when no independent challenge is available.

## Scenario record

Use one record per material scenario:

```text
Requirement or claim:
Evidence lane:
Pre-state and source:
Post-state and source:
Route or entry point:
Actor and permissions:
Fixture, data, and environment:
Action:
Expected observable:
Observed result:
Coverage disposition:
Execution result:
What this proves:
What this does not prove:
Residual gap:
```

Keep pre-state and post-state inputs equivalent. If they differ, explain why the comparison remains valid.

## Status vocabulary

Coverage and execution are independent axes:

- **planned**: the scenario belongs to the current coverage contract and requires an execution disposition before the applicable completion claim.
- **excluded-with-reason**: current authority intentionally omits the scenario and preserves the reason, consequence, and residual risk. It is not a pass or `not-run` execution.

For a planned scenario, use exactly one execution result:

- **passed**: the executed check matched the declared expectation within scope.
- **failed-product**: the intended product path executed and contradicted the contract.
- **failed-environment**: setup, infrastructure, authentication, dependency, or tool failure prevented a product conclusion.
- **blocked**: required authority, fixture, credential, environment, or external state remains unavailable after reasonable non-destructive discovery.
- **not-run**: no execution occurred.
- **partial**: evidence supports only part of the claim.
- **invalidated**: source or material conditions changed after collection.

`absent-within-scope` belongs to claim evidence in `epistemic-integrity.md`; it is not scenario execution. Migrate an older `out-of-scope` value to coverage disposition `excluded-with-reason` plus its authority, consequence, and residual risk.

Do not collapse these into a generic “verified” or “failed.”

## Selecting checks

Before running a material check:

1. Name the claim or requirement it can falsify.
2. Rank applicable checks by contract coverage, directness, current-state relevance, and ability to discriminate product failure from environment failure or a competing explanation.
3. Establish the minimum sufficient combination for current risk.
4. Only then minimize cost, scope, and operational burden.
5. Widen when risk, failure, shared contracts, or a coverage gap requires it.
6. Obey project commands, authority, and resource limits.

There is no universal priority among tests, runtime observation, interfaces, requests, data inspection, static analysis, or human validation. The contract and accessible evidence determine the order.

When a preferred tool is unavailable, use the safest accessible alternative. State the lost coverage instead of simulating a successful check.

## Verification intent before readiness

For Standard or High work, define before `READY`:

```text
Material contract or policy claim:
Check that can falsify it:
Required actor, state, fixture, environment, or tool:
Negative or bypass case when applicable:
Expected evidence lane:
Known limitation:
```

This is a verification plan, not a result. A test that proves only route, middleware, callback, helper, component, or handler invocation does not prove the behavior or policy that component must enforce. For a security, authorization, privacy, or other High-risk boundary, target observable allowed and denied behavior and the authoritative state transition.

An environment or tooling failure can block execution, but it cannot confirm product behavior or solution safety. Keep the intended check `not-run` or `blocked` and preserve the exact cause separately.

## Please, Keep It Verifiable

For every material behavior change, resolve how the observable contract will be exercised. Do not stop after tests, diagnostics, source inspection, or an implementation summary when a stronger authorized runtime or collaborator-observable check is accessible.

### Resolve the execution surface

Derive the applicable fields from current project evidence rather than generic examples:

```text
Observable contract:
Entry surface — route, command, request, event, job, device, or equivalent:
Actor, identity, permissions, and starting state:
Required data, fixture, configuration, environment, and services:
Exact actions:
Expected observations for success, negative, boundary, and repeated scenarios:
Evidence to retain and where it may be stored:
Cleanup or state restoration:
Execution owner: agent | collaborator | shared | none
Execution access: available-authorized | collaborator-controlled | unavailable | not-applicable
Strongest accessible authorized check:
```

Use only fields that apply, but leave no material precondition implicit. Resolve URLs, identifiers, data, accounts, commands, and navigation from authoritative current sources when available. Never invent them. If a value cannot be established, name the missing source and its effect on execution.

### Execute before delegating

The agent MUST attempt the strongest accessible authorized check whose effects remain within current authority. It MAY use a running environment, interface tool, request surface, command, fixture, or other mechanism already established by the project. It MUST NOT create, reset, replace, restart, duplicate, or reconfigure an environment merely to avoid a handoff unless that effect is authorized.

Before starting or changing local runtime state:

1. inspect the existing execution surface and its health;
2. reuse a healthy existing environment when it satisfies the check;
3. record every process, service, fixture, configuration, or temporary state started or changed by the agent;
4. stop or restore only state the agent owns and is authorized to change;
5. when ownership is uncertain, preserve the state and report the uncertainty.

These rules do not assume a browser, container, port convention, process manager, test framework, or deployment model.

### Leave a reproducible handoff

When an inaccessible account, device, environment, credential, human judgment, or other collaborator-controlled boundary prevents direct execution, provide a compact handoff containing the resolved entry surface, preconditions, exact actions, expected observations, evidence to return, cleanup, and the reason the agent could not perform it. The collaborator should not have to reconstruct routine mechanics or ask where, with what data, or what to observe.

A handoff is `reproducible` only when another authorized actor can perform it without guessing a material value. If the missing value cannot be discovered or safely supplied, the result is `blocked`, not a vague handoff.

### Final verification disposition

Resolve exactly one disposition before the final audit:

- `executed`: the agent performed the strongest required accessible check and captured its literal result;
- `collaborative`: the agent and collaborator completed the check together, with conditions and observations captured;
- `reproducible-handoff`: execution remains with the collaborator, but the complete evidence-backed procedure was delivered;
- `blocked`: a named authority, environment, data, identity, capability, or safety boundary prevents execution or a reproducible handoff;
- `not-applicable`: no runtime or collaborator-observable check is material to the changed contract, with the boundary stated.

For `executed` and `collaborative`, preserve the result, evidence, conditions, non-coverage, and cleanup state. `reproducible-handoff` establishes continuity, not successful execution. When actual observation is part of the completion condition, a handoff or blocked check leaves the overall outcome `partial` or `blocked` even if implementation and internal checks are complete.

Internal checks remain valuable supporting evidence. They may satisfy the observable contract when their boundary directly or representatively exercises it. Otherwise label them `supporting-only`; do not use them to close a runtime or user-visible claim.

## Changed-artifact diagnostic gate

After implementation mutation, inventory the exact changed artifacts from the current source or delivery state without assuming a version-control system. For every changed artifact, classify current diagnostic applicability as `applicable`, `unsupported`, or `unavailable`. When an executable current language-aware or project-native diagnostic capability applies, inspect every supported changed artifact before completion.

Record one current coverage result:

```text
Changed artifacts:
Applicable artifacts:
Current trusted checks:
Unsupported artifacts and reason:
Untrusted or unavailable artifacts:
Current errors and attribution:
Fallback checks:
Coverage lost:
Result: clean | bounded-residual | blocked | not-applicable
```

Use the results literally:

- `clean` requires trusted current coverage for every applicable artifact and no current diagnostic error;
- `bounded-residual` permits a verified pre-existing error under current project or collaborator authority, or an explicitly bounded coverage loss with a sufficient fallback under current requirements and risk; it never means diagnostics are clean;
- `blocked` applies when a current error was introduced or modified by the work, remains unattributed, or when missing coverage can change the completion claim and no sufficient fallback exists;
- `not-applicable` requires evidence that none of the changed artifacts has an applicable executable diagnostic capability. It is not a synonym for unavailable.

An untrusted diagnostic result is lost coverage, not a pass. Use the strongest sufficient project-native fallback, state what it can and cannot establish, and keep completion partial or blocked when the residual gap remains material. A verified pre-existing error may remain only when its attribution and the authority accepting that residual are current and explicit.

Diagnostics are a conformance lane. They do not replace contract tests, runtime observation, interface checks, or another stronger material lane. Any mutation after this gate invalidates affected diagnostic coverage.

## Repeatable regression protection

Keep two questions explicit:

1. **Current verification:** does the final state satisfy the material contract under the declared conditions?
2. **Regression protection:** what repeatable mechanism, if any, can detect a future violation of that contract?

One artifact may answer both, but evidence for the current state does not automatically establish future detection. A manual observation, recording, successful request, or stored value may be valid current evidence without being a repeatable guard. A repeatable guard may be automatically executed or intentionally performed by a person; preserve that distinction and the expected execution conditions.

For every material behavior change, defect correction, or contract-sensitive refactor, record the intended disposition before `READY` and resolve the final disposition before completion:

```text
Regression-protection status:
  existing-sufficient | added-or-updated | not-applicable | omitted-with-reason | blocked
Material contract protected:
Repeatable guard and expected execution conditions:
Evidence that it can detect the relevant recurrence:
Coverage and blind spots:
Authoritative requirement or omission reason:
Residual risk:
```

Use the statuses literally:

- `existing-sufficient`: an existing repeatable guard is demonstrated to cover the changed contract and its expected execution conditions are established within scope;
- `added-or-updated`: the final state includes a stable, proportionate guard and evidence shows that it can detect the relevant recurrence;
- `not-applicable`: the change does not alter a material behavior or contract for which recurrence protection has meaning; state that boundary;
- `omitted-with-reason`: protection is relevant, but no defensible guard was added because of a bounded reason such as no stable oracle, a wrong available layer, or disproportionate new infrastructure; state the consequence and residual risk;
- `blocked`: a controlling protection requirement or evidence needed to justify the disposition cannot be satisfied, so completion remains blocked or incomplete.

Select the layer and mechanism by the observable contract it can falsify. Do not default to a unit-level artifact, a particular runner, or an automatic delivery mechanism. Prefer an established, stable, proportionate project mechanism when it materially reduces recurrence risk. An existing artifact is sufficient only when its assertions, conditions, and behavioral boundary can detect the relevant failure; existence, naming, or a passing result alone is insufficient.

Establish recurrence-detection ability through proportionate evidence such as a known failing state, a controlled counterexample, a test-first failure, or direct inspection of a discriminating oracle. Do not introduce unsafe or destructive faults merely to prove the guard.

Obey the applicable instruction hierarchy. A lower-authority preference cannot waive a controlling requirement for a test or repeatable guard. If no controlling requirement applies, omission may be defensible, but convenience alone is not a reason. Do not create a brittle, nondiscriminating, wrong-layer, or assertion-free artifact merely to avoid an honest omission.

For High-risk work, manual-only protection or `omitted-with-reason` requires an explicit risk rationale and sufficient independent current verification. Neither overrides a controlling protection requirement.

## Regression artifact admissibility

Before treating an artifact as the activity's regression protection, record:

```text
Observable contract it can falsify:
Represented pre-change state:
Represented post-change state:
Expected discriminating behavior:
Classification:
  characterization | scope-guard | regression-guard | auxiliary
Explicit non-coverage:
```

Use the classifications literally:

- **characterization** preserves an observed state without necessarily deciding whether it is desired;
- **`scope-guard`** protects an adjacent invariant or prevents expansion beyond the requested boundary;
- **`regression-guard`** can distinguish recurrence of the material contract violation under declared execution conditions;
- **auxiliary** demonstrates a mechanism, helper, route, transformation, or supporting property without falsifying the complete observable contract.

Only a demonstrated `regression-guard` can support `existing-sufficient` or `added-or-updated` for the activity's material contract. Characterization, scope, and auxiliary artifacts may still be valuable, but their value and non-coverage must remain explicit. Do not reinterpret a passing auxiliary artifact as a regression guard because its subject appears in the final implementation.

## Observable-equivalence verification

When **Please, Trace What Must Match** is active, verify the relationship rather than only each surface in isolation:

```text
Observable property:
Authority for agreement or intentional difference:
Surface A conditions and result:
Surface B conditions and result:
Comparable identity, scope, filters, permissions, lifecycle, timing,
deletion, pagination, error, and empty-state dimensions:
Equivalence result: verified | refuted | unknown
Bridge evidence:
Negative control:
What remains outside this comparison:
```

`verified` requires evidence that the compared property and relevant populations or states are contractually equivalent, not merely equal in one fixture. `refuted` may be the correct result when the surfaces intentionally differ; it blocks a forced-parity implementation rather than becoming a failed test. `unknown` or a missing material bridge keeps dependent readiness `INCOMPLETE`.

A regression guard for an equivalence defect must be capable of failing when the relationship is violated. Separate tests for two internal mechanisms are not equivalent to testing the relationship unless their combined oracle discriminates the observable mismatch.

## Evidence parity

For before/after comparisons, keep these stable when applicable:

- source state;
- route or entry point;
- actor and permissions;
- fixture and data;
- environment and configuration;
- action and timing;
- viewport or interface conditions.

If the initial state already contains partial work, record the clean base, initial working state, and final state separately.

## Historical oracle stability

When historical localization is material, keep verification status separate from revision classification. Use [regression-localization.md](regression-localization.md) and record:

```text
Observable property:
Revision identity and relevant predecessors:
Comparable conditions:
Attempts and observed results:
Stability result:
Verification status:
Revision classification: old/good | new/bad | skip | inconclusive
What this classification establishes:
Remaining candidate or causal gap:
```

`old/good` and `new/bad` describe the two sides of the declared property. `skip` means deliberately untested for a known reason; `inconclusive` means attempted evidence could not classify the revision reliably. Neither is evidence for the opposite side. An unstable oracle, material condition drift, or adjacent unclassifiable revisions prevents a unique transition claim.

## Absence and negative behavior

An empty result is evidence only for the operation that produced it.

Before a material absence claim, record search scope, attempts, aliases, excluded stores, parsing or indexing failures, and the strongest remaining blind spot. Prefer `absent-within-scope` over a universal negative claim.

For interface absence, verify the correct route, actor, fixture, data, search/filter state, and relevant navigation or scrolling. A login page, error page, wrong route, missing fixture, or unauthorized state is not product verification.

## Manual and automated evidence

Keep one-time manual evidence, a repeatable human procedure, and automatically executable protection distinct. Identify who or what performed a check and under which conditions it is expected to recur. An unexecuted test may be design evidence if labeled `not-run`; it is not runtime confirmation. The existence of an executable artifact does not establish that a relevant future workflow will execute it.

## Invalidation

A material source or condition change invalidates dependent evidence and any Change Readiness Receipt that relied on it. A newly discovered material consumer, state, contract dimension, scenario, omission consequence, or tool-coverage loss also invalidates affected scenario coverage and its human-alignment result. Re-run the check or downgrade the claim. When a route, fixture, actor, assumption, required-tool result, or hypothesis is refuted, find and reclassify dependent artifacts rather than leaving them presented as current evidence.

After invalidation, identify the affected scenario mappings, direction alignment when dependent, readiness fields, verification, and regression-protection claims; then return to `INCOMPLETE` or `BLOCKED`. A corrected implementation, changed fixture, new consumer, or replacement tool needs refreshed scenario alignment, a new readiness result, and affected verification evidence before completion can be claimed.

A change from one verification status to another does not by itself require a conversational hard stop. Trigger **Please, Stop and Reconcile** only when the new status or evidence materially changes what the agent should believe, recommend, verify, or do next, or when the collaborator explicitly rejects the direction built on that evidence. Preserve the prior result as history with its new invalidated or refuted status; do not erase it or leave it competing as current proof.

When correction drift triggers `RECOVERY`, classify every dependent verification artifact as `retain`, `experimental`, `invalid`, `collaborator-owned`, `unrelated`, or `unknown`. Do not adapt or delete an artifact merely to fit the corrected direction. A new readiness epoch requires a fresh admissibility decision for any artifact later presented as regression protection.
