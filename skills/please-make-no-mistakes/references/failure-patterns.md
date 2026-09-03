# Please, Catch Familiar Mistakes — Root Challenges

Use this capability when a bias signal, unsupported leap, missing observable bridge, or premature closure appears. This is a compact router, not a second copy of every procedure.

## Router contract

This reference implements `failure.challenge`.

- Challenge resolves the named signal without changing direction -> return `CONTINUE` with the prior capability in `resumeWith`.
- Accessible evidence can resolve it -> return `INVESTIGATE` and name the canonical procedure.
- A collaborator-owned decision controls it -> return `ALIGN`.
- It invalidates the active basis or the collaborator rejects the direction -> return `RECONCILE`.
- Current capacity cannot responsibly resolve it -> return `ESCALATE`.
- An exact prerequisite is unavailable -> return `BLOCKED`.

Challenge never grants implementation authority. Keep one pending return target, re-evaluate all kernel guards, and discard the continuation if its basis revision becomes stale.

Run a challenge at three boundaries when triggered: before promoting a preferred direction, before `Readiness: READY`, and before completion. Do not run every challenge mechanically.

## Compact challenge record

```text
Signal:
Material claim or decision at risk:
Canonical owner and selected challenge:
Evidence already considered:
Strongest counterexample attempted:
Literal result and remaining gap:
Effect on basis revision, direction, scenarios, readiness, or completion:
Result and resumeWith:
```

Stop counterexample search when the named material counterexample has been attempted and another accessible check cannot change the next decision. If risk still requires unavailable evidence, escalate or block rather than manufacture closure.

An **independent challenge** differs from the author's work along at least one declared dimension: evidence source, search strategy, participant, model context, or oracle. If it shares the framing and evidence, call it additional challenge rather than independent.

## Root challenge procedures

### 1. Claim and state challenge

Canonical owner: `epistemic-integrity.md`.

Check the claim's exact wording, basis, source state, verification status, missing bridge, strongest counterevidence, and dependent claims. A search miss requires bounded scope and collection limits. A material correction increments the basis revision and invalidates dependent state.

### 2. Contract and observable-path challenge

Canonical owners: `workflow.md` and `review-and-security.md`.

Trace input, normalization, identity, authorization, state, persistence, delivery, side effects, consumers, and observable result only where applicable. Shared implementation, proximity, configuration presence, interface state, or initiation does not prove equivalent contract, authorization, runtime propagation, or completion.

### 3. Direction and solution challenge

Canonical owner: `workflow.md`.

Separate observable outcome from causal hypothesis and implementation suggestion. Search for existing mechanisms that handle the same event, compare viable solution classes by contract, and identify the decision criterion's authority. A small diff is not a small behavioral change. Do not promote a direction before the combined collaborator frontier when it is required.

### 4. Tool and evidence-lane challenge

Canonical owner: `context-layers.md`.

Name the claim, verify actual capability availability, use the smallest sufficient operation, preserve literal collection limits, and stop following suggestions when they cannot change the decision. Structural reach is candidate evidence, not executed behavior or complete blast radius. A fallback must state lost coverage. An announcement is not execution.

### 5. Scenario and verification challenge

Canonical owner: `verification.md`.

Confirm scenarios come from intent, inspected reachability, and risk rather than recall or matrix size. Keep coverage disposition, execution result, current evidence, repeatable protection, and independent challenge separate. A wiring, characterization, or auxiliary artifact is not a regression guard unless it can discriminate the observable violation. Environment failure is not product evidence. Passing tools prove only their declared scope.

### 6. Continuity, capture, and authority challenge

Canonical owners: `durable-record-protocol.md`, `continuous-activity-capture.md`, `durable-record-storage.md`, and `context-store-operations.md`.

Check activity identity, source consistency, durable-gate triggers, storage preflight, exact effect authority, capture freshness, canonical-current-state agreement, and retrieval. A conversation, empty root, append-only history, writable path, or repeated permission request does not establish durable continuity. An incomplete capture blocks dependent completion claims.

### 7. Asynchronous and historical challenge

Canonical owners: `workflow.md` and `regression-localization.md`.

For delayed or intermittent behavior, follow the value through operation identity, result, transformation, state, notification, derived consumer, terminal visibility, retry, stale-result, duplication, cancellation, and cleanup before replacing the source. For history, separate first observable failure, condition origin, exposure, amplification, detection, repair, authorship, and intent.

### 8. Final-state and artifact challenge

Canonical owners: `review-and-security.md`, `verification.md`, and `collaboration.md`.

Inspect the complete current change, scope ledger, diagnostics, material scenarios, verification disposition, regression-protection disposition, residual risk, and delegated record. Remove process artifacts with no consumer or decision value. Internal checks do not close a stronger accessible observable contract. A manual handoff must be reproducible without guessing.

## Signal index

| Observed signal | Root challenge |
| --- | --- |
| Assumption promotion, search miss as absence, stale evidence, dirty baseline confusion | Claim and state |
| Contract collapse, nearby pattern as equivalence, presence/content/visibility/persistence collapse, interface control as authorization, configuration as runtime behavior, initiation as completion | Contract and observable path |
| Premature solution closure, unilateral direction promotion, implementation hint as requirement, causal-to-policy leap, small code delta as small behavior, existing mechanism as automatic preference | Direction and solution |
| Rhetorical compliance, search-volume substitution, suggested-continuation chaining, structural reach as impact, silent fallback equivalence, unverified capability failure, unused applicable diagnostics | Tool and evidence lane |
| Happy-path closure, scenario by recollection, matrix size as completeness, author plan as independent challenge, clean output as correctness, one-time proof as protection, artifact existence as future execution, wiring-test substitution, auxiliary-test promotion | Scenario and verification |
| Orphaned capability result, repeated blocking request, effect-authority leakage, empty-root bootstrap, activity-source drift, deferred capture, append-only current-state drift | Continuity, capture, and authority |
| Async or concurrency blindness, premature async source replacement, temporal proximity as causality, observable boundary as causal origin | Asynchronous and historical |
| Changed line as finding, process theater, internal-check closure, vague verification handoff, environment replacement by convenience | Final state and artifact |
| Capacity concealment | Return `ESCALATE` with evidence, lost coverage, safe boundary, and resume point |
| Epistemic inertia or correction-churn continuation | Return `RECONCILE`; use `REALIGNMENT` or `RECOVERY` and end the turn |

## Forbidden shortcuts

Never infer that plausible means true, shared means equivalent, hidden means forbidden, declared means active, started means completed, nearby means compatible, not found means absent, passing means complete, existing means future protection, large means comprehensive, structural means observable, small means low risk, recent means causal, appended means current, or announced means performed.
