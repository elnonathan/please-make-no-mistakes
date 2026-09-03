# Please, Check Your Work — Review and Security

Use this procedure for a revision, change set, submitted change, regression audit, pre-delivery audit, or security-sensitive change.

Sections: [review state](#establish-the-review-state) · [surface](#reconstruct-the-complete-surface) · [candidates](#candidate-ledger) · [challenge](#challenge-pass) · [security](#security-invariant-pass) · [change decision](#pre-change-security-decision) · [high risk](#high-risk-review) · [final conclusion](#final-review-conclusion)

## Router contract

This reference implements `result.audit`. A clean current audit returns `CONTINUE` to `communication.report`. A material new gap returns `INVESTIGATE`. A refuted active basis returns `RECONCILE`. A finding that requires effects outside authority returns `NEEDS-AUTHORITY`. Completion remains denied until affected verification and durable current state are reconciled.

## Establish the review state

Record the state being reviewed:

```text
Requested review scope:
Exact baseline or parent:
Included revisions or change sets:
Modified, generated, ignored, and relevant new artifacts:
Source-state fingerprint or immutable description:
Applicable requirements and project rules:
Known dirty or unrelated work:
```

When version control is unavailable, use another explicit source-state description. Do not claim that a review applies to later changes automatically.

## Reconstruct the complete surface

MUST account for every relevant changed artifact and change segment between the baseline and reviewed state. Cover every material state the environment actually distinguishes, including persisted, pending, generated, local-only, submitted, and newly introduced material when applicable.

A changed line is a candidate surface, not evidence of a defect. A clean diff view is not proof that no other relevant state exists.

## Candidate ledger

For each suspected issue, record:

```text
Location:
Attribution: introduced | modified | fixed | pre-existing | unresolved
Reachable path:
Expected contract:
Observed violation:
Concrete impact:
Evidence for:
Strongest refutation attempt:
Verdict: finding | improvement | not-a-finding | unresolved
Severity:
Evidence status and remaining gap:
```

Attribution, verdict, severity, and evidence status are separate dimensions.

`environment-only` is an evidence or execution condition, not causal attribution. Record it through the verification status and remaining gap. Do not use an environment failure to assign or clear change responsibility.

Do not report an actionable finding without:

- a reachable or otherwise relevant path;
- a violated contract;
- concrete impact;
- exact attribution to the reviewed state;
- a fresh read of the cited source and relevant guards.

If a tool or specialist fails, report the coverage gap. Do not invent a finding to fill the missing output.

## Challenge pass

For every material candidate:

1. Try to prove it false.
2. Inspect normalization, guards, callers, permissions, lifecycle, configuration, and tests.
3. Check canonical callers and shared consumers outside the immediate task when affected.
4. Search for counterexamples and alternative explanations.
5. Reconcile tests with their real preconditions.
6. Downgrade or reject the candidate when evidence does not sustain it.

For a material behavior change, defect correction, or contract-sensitive refactor, reconcile the final inspected surface with the Scenario Coverage Contract from [verification.md](verification.md). Every material contract dimension and affected consumer must still map to a scenario or an authorized omission with residual risk. Challenge success-path-only coverage, recall-derived scenarios, indiscriminate matrices, and any claim that the author's plan constitutes independent challenge.

For ordinary review, bind `introduced`, `modified`, `fixed`, or `pre-existing` to the exact reviewed baseline or relevant predecessor. When the material question extends to the first observable transition, condition origin, exposure, amplification, detection, or correction across history, load [regression-localization.md](regression-localization.md) and use its multidimensional record instead of stretching this compact field.

## Security invariant pass

Trace a protected action through the complete applicable chain:

```text
actor identity
  -> authoritative identity source
  -> selection or visibility
  -> direct request or alternate entry point
  -> server-side authorization
  -> state change
  -> persistence
  -> side effects
  -> auditability and secret exposure
```

MUST challenge:

- interface-only restrictions;
- direct requests that bypass selectors or hidden controls;
- stale or user-supplied identity;
- normalization differences;
- bulk, retry, repeated, and partially failed paths;
- legacy or migration exceptions;
- secret generation, transmission, storage, and later retrieval;
- authorization parity across read, list, create, update, delete, and side-effect paths when applicable.

Never weaken authorization, sandboxing, privacy, redaction, or environment isolation to make verification easier.

## Pre-change security decision

Before `READY` for a security, authorization, privacy, or another High-risk boundary, keep these conclusions distinct:

```text
Observed symptom and current mechanism:
Evidence for the causal explanation:
Authorized product rule and attributable source:
Allowed actors, states, and transitions:
Denied actors, states, and transitions:
Proposed boundary change and behavioral reach:
Strongest bypass or negative scenario:
Contract-level verification intent:
Unresolved authority or product decision:
```

Confirming the current mechanism does not establish that a proposed exception, bypass, endpoint, helper, or replacement is authorized or safe. Treat implementation language in a task, comment, example, or nearby code as a proposal unless its source has authority over the product rule.

Compare existing mechanisms and competing solution classes by identity, authority, preconditions, state, lifecycle, side effects, errors, and consumers. Reuse is not automatically safer; a small or local diff is not automatically a small behavioral change.

Do not use a wiring-only test as policy evidence. Verification must exercise the observable allowed and denied paths at the authoritative boundary when feasible. If the product rule or authority remains unresolved after technical discovery, ask the smallest human decision and mark readiness `BLOCKED` until answered.

## High-risk review

For high-risk work:

- define rollback or containment before irreversible action;
- use more than one evidence lane when one cannot cover the contract;
- require an explicit risk rationale and sufficient independent current verification when regression protection is manual-only or omitted; neither can override a controlling protection requirement;
- request explicit human authority for destructive or externally consequential actions;
- seek a fresh reviewer, agent, tool, or person when available;
- treat self-review as useful but not equivalent to independent review.

Independent challenge does not replace the author-side coverage contract, current verification, or repeatable protection decision. Provide a reviewer with the observable contract, reproducible conditions, known risks, relevant evidence, and declared gaps without presenting the existing scenario inventory as an exhaustive ceiling.

## Final review conclusion

Before declaring review or delivery readiness:

1. Account for the full changed surface.
2. Resolve or clearly bound every material candidate.
3. When scenario coverage was triggered, verify that its contract still accounts for the final material surface, including explicit omissions and their authority.
4. Verify the requested contract and executed scenarios without presenting planned coverage as passed evidence.
5. When triggered, challenge the final regression-protection disposition against the material contract, controlling requirements, recurrence-detection evidence, expected execution conditions, and blind spots.
6. Record skipped or blocked checks.
7. State residual risk.
8. Bind the conclusion to the reviewed source state.
9. If the review causes a change, invalidate the prior conclusion and review the new state again.
