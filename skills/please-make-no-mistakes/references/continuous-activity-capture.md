# Please, Write It Down — Continuous Activity Capture

Use this capability whenever an active durable activity has a valid delegation for routine content updates. It keeps the record synchronized with the work instead of reconstructing it at session end.

## Router contract

This reference implements `record.capture` as a material-event interrupt.

- Valid delegated write completed and verified -> return `CONTINUE` with the prior capability in `resumeWith`.
- Material capture needed but writable delegation is missing -> return `NEEDS-AUTHORITY` with `continueWith: authority.request` and preserve the exact pending update.
- Target, identity, or delegation unresolved -> return `BLOCKED`.
- Interrupted or inconsistent capture -> return `BLOCKED` with domain state `capture-incomplete`, the event identity, completed effects, pending effects, and `resumeWith: record.capture`.

Capture never grants implementation readiness. It returns to the central router rather than choosing a peer capability.

## Trigger

Classify a material event by the responsibility it changes. These are semantic patterns, not required stages or files:

- **Start and context:** purpose, authority, scope, constraints, initial state, and relevant conditions.
- **Direction:** requirements, scope, decisions, alignment state, authority, priorities, tradeoffs, rejection, and closure criteria.
- **Knowledge:** evidence, hypotheses, corrections, epistemic discontinuities, findings, risks, dependencies, limits, and blockers.
- **Execution:** work state, produced or changed artifacts, external-state effects, and observable consequences.
- **Verification:** scenario-coverage decisions, material mappings and omissions, checks, measurements, inspections, observable-verification dispositions and handoffs, protection dispositions, independent-challenge findings, evidence boundaries, and invalidation.
- **Continuity:** pause, resumption, transition, handoff, current state, open uncertainty, next action, closure, reopening, and deferred work.

Do not infer any concrete coordination, versioning, hosting, review, automation, delivery, ownership, identification, or storage mechanism from these categories. Use a mechanism only when current authoritative context establishes it.

Capture when at least one materiality condition holds:

- reconstruction would be costly or unreliable;
- forgetting it could change a collaborator's next decision;
- it invalidates prior evidence, state, or dependent work;
- it changes the next action, expected outcome, verification, or continuity state.

Do not capture casual conversation, repeated attempts that add no knowledge, raw high-volume telemetry, speculative branches with no decision value, conversation transcripts, secrets, credentials, or unnecessary sensitive data. Preserve a bounded conclusion and provenance pointer instead of bulk material when sufficient.

## Logical capture unit

Treat every material event as one logical capture unit:

```text
Event identity:
Activity identity:
Basis revision:
Material role and epistemic status:
Prior canonical state affected:
New current state or unresolved state:
Responsibility surfaces affected:
Evidence pointers and sensitivity:
Required canonical index changes:
Capture state: pending | complete | capture-incomplete | reconciled
```

Use a backend transaction when the authorized backend provides one. Otherwise preserve recoverability with the ordering below. An event identity MUST make a retry recognizable; repeated capture should be idempotent or detect a collision rather than duplicate current truth.

## Required action

1. Resolve the active activity and verify that its delegation covers the intended content update.
2. Classify the material item by role, basis, and verification status.
3. Route it to the applicable Activity Record Contract responsibility: canonical recovery index, understanding, timeline, verification, lineage, or evidence manifest.
4. Record the semantic event or history transition first when the backend is not transactional. This is the recovery anchor and MUST identify the intended canonical updates.
5. Update understanding for requirements, hypotheses, decisions, causal status, corrections, tradeoffs, or non-goals.
6. Update verification when a scenario, condition, result, observable-verification disposition or handoff, evidence boundary, invalidation, or regression-protection disposition changes.
7. Add or update an evidence manifest with provenance; preserve a pointer or minimal redacted derivative when the original is sensitive or large.
8. Materialize a typed extension only when it has a responsibility, trigger, consumer, index pointer, and valid pre-authorized boundary.
9. Update the canonical index last when the item changes what a resuming agent should believe or do, including status, conclusion, next action, basis revision, invalidated dependencies, classifications, relationships, capture state, or pointers.
10. Verify that the event, responsibility surfaces, pointers, and canonical current state agree, and that no write crossed the delegation boundary.
11. Mark the logical capture `complete` only after that verification. If any step fails, expose `capture-incomplete` instead of concealing the partial state.

Capture a material decision-frontier result when it changes what a resuming collaborator may treat as the active direction. When an epistemic discontinuity or explicit directional rejection triggers **Please, Stop and Reconcile**, capture the prior and new basis, affected work, severity, canonical current understanding, question asked, and awaiting state before the turn ends. The discarded direction remains historical and must not compete as current truth.

Capture a material Scenario Coverage Contract result when it changes what behavior, consumer, state, or omission governs implementation or verification. Preserve its collaborator-response or delegated basis, coverage mappings, explicit omissions, tool limits, and residual risk. When a later discovery invalidates a scenario or adds a material item, update current coverage before dependent work and preserve the superseded mapping as history rather than silently rewriting it.

After every material alignment, correction, realignment, recovery, handoff, or closure, reconcile the canonical recovery surface as well as preserving history. Before the next dependent action or handoff, confirm that:

- status, current conclusion, and activity/source or delivery-state consistency reflect the latest supported state;
- the next action has not already occurred and does not depend on an invalidated claim;
- invalidated plans, changes, tests, and evidence are named or pointed to;
- detail and evidence pointers resolve to the current sources they claim;
- the historical event remains preserved without competing as current truth.

Appending a correction while leaving stale canonical metadata is `capture-incomplete`, not success. Preserve which surfaces landed and which remain pending so a later recovery can finish or safely supersede the event.

Capture before the next dependent action when losing the item could repeat an error. Otherwise capture at the nearest material milestone. Do not defer all recording until the final response.

The first material event after a record becomes `loaded` or `created` is itself a capture trigger. Do not wait for implementation, a commit-like milestone, a user reminder, or session end.

After verification, capture its result before final audit. If the audit changes a material conclusion, scenario, risk, next action, or completion claim, capture that correction before final reporting. Audit and report are not exemptions from continuous capture.

## Completeness audit

At a material milestone, ask:

- Does current state contradict the latest captured material event?
- Is the latest material event marked complete, or does a recoverable `capture-incomplete` state name every pending effect?
- Has the recorded next action already occurred or changed?
- Does a current conclusion depend on invalidated evidence?
- Did an alignment, correction, realignment, recovery, handoff, or closure update canonical status, conclusion, next action, invalidated dependencies, and pointers?
- Is a material decision, risk, verification result, continuity change, or handoff missing?
- Does the record state whether observable verification was executed, collaborative, handed off reproducibly, blocked, or not applicable, without presenting a handoff as a pass?
- Does every current material contract dimension and affected consumer map to a scenario or an authorized omission, and did an independent challenge add an uncaptured scenario?
- Does every material extension have a canonical index pointer and current state?
- Are any pointers broken, stale, ambiguous, or outside the delegated activity?
- Are required project classifications missing, ambiguous, or inconsistent with canonical aliases?
- Does a project catalog disagree with the canonical activity index from which it should be derived?

Repair content within the active delegation. A repair that crosses its authority boundary requires a separate plan and approval.

## Epistemic form

Preserve the dimensions that matter:

```text
Item:
Role: requirement | constraint | decision | finding | correction | open question | future improvement
Basis: reported | observed | inferred | assumed
Verification: unverified | partially supported | verified within scope | refuted | unknown | invalidated
Source and source state:
Effect on current understanding or next action:
What it does not establish:
```

A correction MUST name the prior claim, refuting evidence, corrected claim or remaining unknown, and affected decisions, changes, checks, and records. Update current state without erasing the historical mistake.

When **Please, Stop and Reconcile** enters `REALIGNMENT` or `RECOVERY`, record the trigger, before-and-after epistemic state, question, awaiting result, and any artifact classifications without treating them as authority to roll back, delete, overwrite, or continue. Reconcile again after the collaborator response and the new readiness epoch establish a supported direction.

## Authority boundary

Routine capture MAY edit existing activity content declared by the delegation. It MAY create a typed extension or evidence entry only under an initially approved records or evidence boundary whose operation types, naming policy, material volume or review threshold, privacy scope, retention rule, and index-pointer update are still satisfied. It MUST NOT use that authority to:

- create or register another activity;
- create an untyped, empty, arbitrary, or unindexed directory or responsibility record;
- change the activity root, schema, layout profile, backend, registry, locator, or ignore rules;
- alter visibility, audience, retention, publication, movement, or deletion;
- preserve secrets or unnecessary sensitive data.

Use `context-store-operations.md` for any crossed boundary.

## Failure behavior

If the activity cannot be resolved, the delegation is absent or stale, the target is inaccessible, or the write fails:

1. do not claim that capture succeeded;
2. state the exact pending update and failed boundary;
3. preserve it in the current response until authorized storage is available;
4. do not continue a dependent action when loss would create a blocking continuity risk.

For a partial write, also preserve the event identity, exact completed effects, exact pending effects, last known canonical state, retry or reconciliation boundary, and whether another attempt would be idempotent. Completion remains blocked until current truth and history are reconciled.

When the active transition is `no-record-with-valid-reason`, apply the re-evaluation triggers in `durable-record-protocol.md`. A material correction, additional traceability burden, scope or risk increase, High-risk boundary, or expected continuity can invalidate that result even in the same session. Report the pending material update and resolve the new transition before the next dependent material activity step.
