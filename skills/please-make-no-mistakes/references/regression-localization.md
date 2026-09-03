# Please, Find Where It Changed — Regression Localization and Attribution

Use this subworkflow only when locating a historical transition or assigning a change role would materially affect implementation, verification, risk, review, or communication. It composes **Please, Look Before You Change**, **Please, Prove It**, **Please, Check Before You Claim**, and **Please, Check Your Work**; it is not a separate top-level capability.

Sections: [trigger](#trigger-and-contract) · [oracle](#oracle-and-comparable-conditions) · [history](#history-model-and-narrowing) · [classifications](#revision-classifications) · [attribution](#multidimensional-attribution) · [lineage](#current-contract-lineage) · [safety](#operational-safety) · [adapters](#adapter-boundary) · [reporting](#stop-and-report)

## Router contract

This reference implements `history.localize`. Return the bounded observable transition, attribution dimensions, oracle limits, and `resumeWith` to the central router. Unsafe workspace mutation returns `NEEDS-AUTHORITY`. An unstable oracle or missing comparable states returns `INVESTIGATE`, `ESCALATE`, or `BLOCKED` rather than causal certainty.

## Trigger and contract

Run this subworkflow for a material question such as:

- when an observable property changed;
- which revision first satisfies or violates a reproducible oracle;
- whether work introduced a condition, exposed it, amplified it, detected it, or fixed it;
- whether a suspected defect was already present;
- whether the transition boundary changes the defensible solution or review conclusion;
- whether a historical requirement, decision, test, or work artifact still represents the current contract or materially supports a review recommendation.

Do not run it merely because a request uses the word “regression.” Use ordinary debugging when historical attribution has no decision value.

Triggering the subworkflow authorizes proportional read-only investigation, not an automatic expensive or workspace-mutating history traversal. Establish the oracle, endpoints, decision value, safety boundary, and applicable authority before executing a traversal.

Record:

```text
Historical question and decision it affects:
Observable contract or property:
Declared revision set or history graph:
Known earlier state and evidence:
Known later state and evidence:
Required precision: exact transition | bounded candidate set | directional evidence
Historical contract or review question, when applicable:
Authority and safety limits:
```

## Oracle and comparable conditions

Build the narrowest reproducible oracle that distinguishes the two sides of the property.

```text
Oracle identity and source:
Actor and permissions:
Input, fixture, and data:
Environment, configuration, and dependencies:
Action and timing:
Old-side expected observable:
New-side expected observable:
Repeat or flake policy:
Side effects and containment:
What the oracle establishes:
What it cannot establish:
```

Before narrowing history:

1. Reproduce at least one known earlier state and one known later state when possible.
2. Repeat the oracle enough to challenge instability in proportion to cost and risk.
3. Keep material conditions equivalent across revisions or explain and bound every difference.
4. Separate product-property results from build, dependency, setup, fixture, authentication, environment, or tool failure.
5. Preserve the oracle independently from revisions when the history mechanism could overwrite or reinterpret it.

An unstable oracle cannot support a unique transition. A stable oracle localizes only its declared observable property; it does not by itself establish the underlying cause, complete impact, or intent.

## History model and narrowing

Declare the revision relation before selecting a search method:

```text
Revision identity:
History shape: ordered sequence | graph | snapshots | other
Traversal strategy:
Relevant predecessors or parents:
Assumption that permits narrowing:
Excluded branches, paths, states, or unavailable history:
```

Use binary narrowing only when the property is expected to divide the declared revision set consistently into an old side and a new side. Challenge that assumption with known points. If behavior changes more than once, conditions are incomparable, or the graph traversal answers a different question, change strategies or return a bounded candidate set.

There is no universal “first change”:

- a history graph may have several valid traversal orders;
- a merge-like revision may need comparison with more than one predecessor;
- a mainline-only traversal and a full-graph traversal answer different questions;
- skipped adjacent revisions may prevent a unique boundary;
- older revisions may not execute under equivalent conditions;
- the observable property, underlying condition, reachability, impact, detection, and correction may change at different revisions.

When a boundary is found, compare the boundary revision with every predecessor relevant to the declared traversal under equivalent conditions. Then trace the reachable path, preconditions, authority, state transitions, side effects, and consumers. Search earlier history for the condition, reachability, and impact separately.

## Revision classifications

Classify every attempted revision without forcing unknown states into a binary result:

- **old/good:** reproducibly on the declared earlier side of the oracle;
- **new/bad:** reproducibly on the declared later side of the oracle;
- **skip:** deliberately not tested because a known non-property condition makes it unsuitable;
- **inconclusive:** attempted, but available evidence cannot classify it reliably.

The labels describe sides of a declared property, not moral quality. Preserve:

```text
Revision identity:
Relevant predecessor identities:
Conditions and source state:
Oracle attempts and observed results:
Classification:
Environment or comparability failure:
Evidence pointer:
```

Do not convert `skip` or `inconclusive` into old/good or new/bad merely to complete a search. Record the tested set, skipped set, and remaining candidates.

## Multidimensional attribution

Do not use one mutually exclusive label for several different historical questions. Record:

```text
Observable boundary:
  known earlier state:
  known later state:
  result: localized transition | candidate set | unresolved

Condition origin:
  introduced | pre-existing | unresolved

Reachability effect:
  exposed | unchanged | reduced | unresolved

Impact effect:
  amplified | unchanged | mitigated | unresolved

Activity or artifact role:
  detected | fixed | neither | unresolved

Human motivation:
  reported from an attributable source | unknown
```

Apply these invariants:

- `introduced` requires evidence that the defective condition is absent from an equivalent predecessor and present after the attributed change.
- `pre-existing` describes condition origin and may coexist with later `exposed`, `amplified`, `detected`, or `fixed` roles.
- `exposed` requires evidence that a pre-existing condition became reachable, triggered, or observable through the attributed change.
- `amplified` requires a comparative measure of increased frequency, scope, or severity; changed-line count is not impact evidence.
- `detected` describes discovery or observability and does not establish technical causality.
- `fixed` means the declared contract was restored within tested scope; it does not prove every underlying condition was removed.
- `unresolved` applies per dimension. Do not erase established dimensions because another remains unknown.
- authorship, temporal proximity, activity ownership, revision text, and discovery date do not establish causal responsibility or human intent.

Identify revisions separately when evidence supports them:

```text
First observed oracle failure:
Condition-origin revision:
Exposure revision:
Amplification revision:
Detection activity or artifact:
Fixing revision:
```

These identities may all differ.

## Current contract lineage

Historical evidence is not automatically current authority. When an older requirement, decision, test, work artifact, or implementation expectation will shape current behavior, regression protection, review routing, or communication, inspect successor evidence only far enough to classify its material expectation:

- **current:** current authoritative sources preserve the same material expectation;
- **refined:** a successor narrows, extends, conditions, or otherwise changes the expectation without wholly replacing it;
- **superseded:** later authority replaces or rejects the expectation for the current decision;
- **unknown:** available or comparable successor evidence cannot establish current status.

Preserve the historical statement and its source separately from this classification. Age, recency, a surviving test, or an unchanged implementation does not establish current authority. Do not use a historical artifact as the sole current regression oracle unless its material expectation is `current` or its `refined` form has been reconstructed from current evidence.

When an old condition conflicts with a recently observed symptom, search proportionally for a later reachability or exposure transition. Compare materially equivalent earlier and later conditions and inspect changes to applicable entry points, gates, callers, consumers, configuration, migrations, or data production. If no candidate closes the before-and-after bridge, preserve exposure as `unresolved`; do not convert condition age into evidence of continuous visible failure.

When history is used to recommend a reviewer, treat authorship and prior ownership only as provenance signals. Recommend a person or review role only when current evidence connects it to relevant contract knowledge, reachable surface, operational context, or decision authority, and state that basis without implying blame or intent.

## Operational safety

Before any traversal that can change workspace or external state:

1. Inspect the primary workspace, pending changes, generated state, active operations, and project instructions.
2. Do not automatically stash, reset, clean, overwrite, or discard user work.
3. Prefer an isolated workspace when testing revisions requires source-state transitions.
4. Identify dependencies, generated artifacts, subprojects, fixtures, caches, credentials, services, databases, queues, and other shared state the isolation does not contain.
5. Obtain any authority required for material filesystem or external-state effects.
6. Define lifecycle, cleanup, restoration, or intentional retention before execution.
7. Preserve the oracle, revision identities, classifications, skips, failures, and candidate set outside any state that traversal may replace.
8. Verify the final primary and isolated workspace states before reporting completion.

An isolated source workspace does not isolate external systems. Abort or redesign an oracle whose side effects cannot be safely contained.

## Adapter boundary

The public workflow assumes no version-control system, hosting provider, review system, or history command. A verified project or tool adapter may provide:

```text
Revision and predecessor identity rules:
History graph and traversal semantics:
Read-only inspection commands:
Isolated-workspace mechanism:
Automated oracle result mapping:
Skip and inconclusive mapping:
Generated, dependency, and subproject handling:
Restoration and cleanup procedure:
Known history or environment limits:
```

Use adapter commands only after their applicability and availability are established under `context-layers.md`. Consult the adapter's declared authoritative documentation for traversal, result classifications, ambiguity, isolation, and restoration mechanics. Do not copy those mechanics into the portable core or assume another system shares them.

## Stop and report

Stop narrowing and report the strongest bounded result when:

- no reproducible earlier or later state exists;
- the oracle remains unstable;
- material conditions cannot be made comparable;
- the declared history is incomplete or has unresolved traversal ambiguity;
- skips or inconclusive adjacent revisions prevent a unique transition;
- the property is non-monotonic over the selected search set;
- required execution would endanger user work or uncontained external state;
- further localization is disproportionate to the decision it would change.

Use this conclusion boundary:

> When an oracle is stable, conditions are equivalent, earlier and later states are reproducible, and the property behaves consistently over the declared revision set, an ordered search can reproducibly localize an observable boundary or bounded candidate set. This does not establish by itself the condition's origin, complete causal mechanism, full impact, or human intent.

Report:

```text
Historical question:
Oracle and comparable conditions:
Declared history and traversal:
Tested revisions, skips, and inconclusive states:
Observable boundary or candidate set:
Attribution dimensions and evidence:
Historical contract lineage, when applicable:
Reachable mechanism and consumers:
Review recommendation and evidence basis, when requested:
Coverage limits and unresolved dimensions:
Workspace and external-state final status:
Decision affected and next evidence step, if any:
```
