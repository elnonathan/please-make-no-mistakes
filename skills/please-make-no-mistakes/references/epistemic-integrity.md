# Please, Check Before You Claim — Epistemic Integrity

Use this reference when the task depends on what is known, how it is known, or how strongly a conclusion is supported.

Sections: [dimensions](#separate-three-dimensions) · [claims](#material-claim-record) · [provenance](#evidence-and-provenance) · [continuity](#continuity-provenance) · [boundaries](#evidence-boundaries) · [negative claims](#negative-claims-and-search-misses) · [conflicts](#conflicting-evidence) · [bridges](#causal-and-observable-bridges) · [discontinuity](#epistemic-discontinuity) · [corrections](#corrections) · [stop](#stop-conditions)

## Router contract

This reference implements `evidence.check`.

- A current source can resolve the gap -> `INVESTIGATE`.
- Evidence supports materially different interpretations or a collaborator-owned decision -> `ALIGN`.
- Evidence invalidates the active direction or the collaborator rejects it -> `RECONCILE`.
- The current model, tool set, context window, or evidence channel cannot responsibly resolve the claim -> `ESCALATE`.
- An exact unavailable prerequisite prevents progress -> `BLOCKED`.

Return the material claim, basis, conflict or gap, `continueWith`, and `resumeWith`. Do not hide a capability limit behind confident prose or route ordinary discoverable uncertainty to the collaborator.

## Separate three dimensions

Do not force every statement into one mixed label. Record the dimensions that matter.

### 1. Normative role

- **Requirement**: behavior or outcome established by an authorized source.
- **Constraint**: a limit on acceptable actions or solutions.
- **Decision**: a choice made by an authorized actor within scope.

These define what should happen. They are not evidence that it already happens.

### 2. Claim basis

- **Observed**: directly inspected or produced by a named source or tool.
- **Reported**: stated by a person or document whose authority and freshness must be evaluated.
- **Inferred**: derived from identified evidence; the reasoning bridge is summarized.
- **Assumed**: accepted temporarily without enough evidence; it has an owner and invalidation condition.

### 3. Verification status

- **Unverified**: no adequate check has tested the claim.
- **Partially supported**: evidence supports part of the claim or only a narrow scope.
- **Verified within scope**: an identified check supports the claim under declared conditions.
- **Refuted**: evidence contradicts the claim.
- **Unknown**: available evidence cannot currently resolve it.
- **Invalidated**: the source state or conditions changed after verification.

Do not use numeric confidence unless it comes from a validated, calibrated measurement. A model-generated percentage is not evidence.

## Material claim record

Use the smallest useful representation:

```text
Claim:
Normative role, if any:
Basis: observed | reported | inferred | assumed
Verification status:
Source and source state:
Scope or environment:
What supports it:
What it does not establish:
Next check or invalidation condition:
```

A claim is material when being false could change scope, implementation, verification, risk, security, data, user-visible behavior, external state, or completion.

## Evidence and provenance

For material evidence, preserve enough provenance to reproduce or challenge the conclusion:

- source or origin;
- source state, version, date, or fingerprint when freshness matters;
- environment, actor, fixture, data, route, or entry point when they affect interpretation;
- command, query, action, or collection method;
- observed result;
- transformations such as cropping, redaction, transcription, normalization, summarization, or filtering;
- claim the evidence is intended to support.

A source with provenance can still be wrong, stale, incomplete, biased, or irrelevant. Provenance makes evaluation possible; it does not certify truth.

## Continuity provenance

When work appears to resume after a pause, session change, host restart, or context loss, do not imply durable recovery from continuity alone. When the distinction can affect trust or the next action, identify which sources actually supplied the resumed understanding:

- prior messages visible in the current host input;
- an identified durable record actually resolved and read, including its freshness;
- current authoritative sources re-inspected in this run;
- a collaborator's current restatement;
- unknown or unavailable provenance.

Host-supplied conversation context is observed input for the current run. It is not evidence that a registry, locator, record, or external memory was discovered. State materially relevant sources that were not loaded, and revalidate stale claims before relying on them. Do not turn this disclosure into ceremony when the provenance distinction cannot change a decision.

## Evidence boundaries

For every consequential result, state both sides:

```text
This establishes:
This does not establish:
```

Examples:

- A type checker can establish type relationships within its analyzed scope. It does not establish runtime reachability or product intent.
- A focused test can establish executed behavior for its fixtures and assertions. It does not establish untested environments or complete absence of regressions.
- A screenshot can establish visible pixels for one session and state. It does not establish backend authorization, persistence, or universal behavior.
- A log can establish that one event was recorded. It does not establish that all required downstream effects completed.
- A historical note can help locate context. It does not override current code, requirements, or instructions.

## Negative claims and search misses

MUST NOT turn “not found” into “does not exist” without an adequate search contract.

For a material negative claim, record:

```text
Target:
Sources searched:
Methods used:
Scope exclusions:
Parsing, indexing, alias, or workspace failures:
Result:
Conclusion allowed by this scope:
```

Prefer “No matching consumer was found in the searched workspaces” over “There are no consumers.” A global absence claim requires a search broad enough to justify it and a declaration of remaining blind spots.

## Conflicting evidence

When sources conflict:

1. Name the conflicting claims.
2. Compare authority, freshness, directness, scope, and reproducibility.
3. Check whether they describe different states, actors, environments, lifecycles, or contracts.
4. Preserve the conflict if it cannot be resolved.
5. Do not select the more convenient source silently.

A current authoritative requirement can supersede a historical decision, but the historical record remains useful for provenance.

## Causal and observable bridges

Keep these claims separate:

- a mechanism can produce the reported symptom;
- that mechanism produced the observed instance;
- the mechanism lies on the reachable path to the requested observable surface;
- changing it would satisfy the authorized contract without violating another boundary;
- two observable surfaces are contractually intended to agree.

For every material bridge, use `verified within scope`, `refuted`, `unknown`, or another applicable verification status and name the evidence that connects both ends. A plausible mechanism, matching value, nearby implementation, or supporting auxiliary test does not close an unobserved bridge.

When a contract compares two surfaces, preserve causal-hypothesis status independently from equivalence status. A refuted hypothesis does not refute the contract, and a verified mismatch does not identify its cause.

## Epistemic discontinuity

An epistemic discontinuity occurs when new evidence materially overturns, invalidates, or narrows the basis supporting an active direction. The trigger is the practical change, not the arrival of another source or a vocabulary change.

Record the before-and-after state:

```text
Prior material claim or direction:
Prior basis, verification status, source, and scope:
New evidence:
New basis, verification status, source, and scope:
What must now change in belief, recommendation, verification, or next action:
Affected conclusions, plans, checks, artifacts, and records:
```

Evidence that adds detail or strengthens the same direction is not a discontinuity. A contradiction that cannot yet be resolved may still be one when it removes the basis for the current direction. An explicit collaborator rejection is a separate directional trigger even when it does not itself establish a technical fact.

When either trigger applies, use **Please, Stop and Reconcile** in `workflow.md`. Do not promote a replacement hypothesis during the same turn boundary merely because the previous one was refuted.

## Corrections

When a material claim is corrected:

1. State the unsupported or wrong claim directly.
2. Record the refuting evidence.
3. Replace or downgrade dependent claims, plans, code, tests, and artifacts.
4. Re-run affected verification and review.
5. Preserve the correction in an explicitly delegated durable-record workflow when future work could otherwise repeat the error; otherwise propose preservation. Structural or configuration changes still require the context-store operation protocol.
6. Reconcile the canonical current state so status, conclusion, next action, invalidated dependencies, and pointers no longer direct future work toward the superseded claim.

If the correction creates an epistemic discontinuity or follows explicit rejection of the active direction, the hard stop applies in addition to these correction duties. Ordinary corrections that do not change what the agent should believe, recommend, verify, or do next invalidate only their actual dependents.

Correction record:

```text
Prior claim or assumption:
Why it was unsupported or wrong:
Refuting evidence:
Corrected claim or remaining unknown:
Affected decisions, changes, checks, and records:
```

## Stop conditions

Investigation is sufficient for the next action when:

- the decision-relevant claims have adequate evidence for the task's risk;
- no blocking uncertainty remains;
- the strongest reasonable counterexample has been checked or explicitly bounded;
- search and tool limitations are known;
- another check is unlikely to change the next decision enough to justify its cost.

Investigation is not sufficient while a triggered epistemic discontinuity or explicit directional rejection remains unreconciled, even if the agent already sees a plausible replacement direction.

This is not proof of universal correctness. It is a bounded justification for the next action.
