---
name: please-make-no-mistakes
description: Use for non-trivial software investigation, design, planning, implementation, debugging, refactoring, review, verification, migration, resumption, or identified activity transitions. Routes work through evidence, human alignment, change readiness, verification, and durable continuity when applicable. Also use to inspect, design, scaffold, register, adapt, or migrate user-controlled context stores. Context-store inspection and planning do not authorize writes. Structural or configuration changes require fresh approval bound to the exact root, operations, and plan digest. Do not use for simple factual answers or isolated prose edits unless explicitly invoked.
---

# Please, Make No Mistakes

Epistemic integrity for AI-assisted software engineering.

The name is an aspiration, not a guarantee. The portable skill is advisory: it makes preventable uncertainty, unsupported certainty, human decisions, material effects, and continuity visible. The Codex plugin also bundles an optional lifecycle interlock for covered local write paths. That interlock enforces declared order, not semantic truth, complete mutation coverage, or error-free outcomes.

## Kernel

This file is the control plane. It owns invariants, trigger signatures, routing, and stop conditions. A triggered reference owns its domain procedure but cannot weaken this kernel. If instructions inside the skill conflict, take the safer stop, report the conflict as a skill defect, and do not silently choose the convenient reading.

Load only the reference required by the current route. Every capability returns to the central router. It MUST NOT silently invoke a peer, treat a suggested continuation as authority, or treat its own success as implementation readiness.

When trusted context emitted by the bundled host adapter begins with a registered `Please, ...` capability heading, route immediately through [host enforcement](references/host-enforcement.md) and follow its current one-step transition. The heading is a friendly route label, not authentication; only verified host provenance activates the handshake. Guard control commands are internal receipts for that announced adapter and MUST NOT be executed when it is absent, disabled, untrusted, or unsupported.

### Guards before route

Evaluate these guards before advancing and again after every material result:

| Guard | Trigger | Required route |
| --- | --- | --- |
| Evidence correction | New evidence contradicts or weakens the active basis | `evidence.check`; increment the activity-local basis revision and invalidate dependent state |
| Familiar failure | Bias signal, unsupported leap, missing observable bridge, or premature closure | `failure.challenge` before promoting a direction, readiness, or completion |
| Effect authority | The next effect is outside current authority | `authority.request` or the applicable host authority route |
| Durable capture | A material event exists inside a delegated record, or the durable gate changes | `record.capture` before dependent work |

Keep four axes independent:

1. **Router result:** `CONTINUE | INVESTIGATE | ALIGN | NEEDS-AUTHORITY | RECONCILE | ESCALATE | BLOCKED | DONE`.
2. **Domain state:** activity transition, direction alignment, scenario alignment, readiness, verification, or capture state.
3. **Reconciliation severity:** `REALIGNMENT` before dependent artifacts exist, or `RECOVERY` after they exist.
4. **Effect authority:** implementation, instrumentation, verification, environment, external state, durable content, durable structure, publication, movement, and deletion are separate classes.

### Central continuation

Preserve at most one current pending return target in an optional host or audit trace:

```text
Capability:
Result: CONTINUE | INVESTIGATE | ALIGN | NEEDS-AUTHORITY | RECONCILE | ESCALATE | BLOCKED | DONE
Domain state:
Basis revision:
Basis:
Conflict or gap:
continueWith:
resumeWith:
Implementation mutation: ALLOWED | DENIED
```

`continueWith` names the next central route. `resumeWith` is the one target to reconsider after an interrupt; it is not a recursive call stack. Re-evaluate every guard before resuming. A material correction, scope change, authority change, or basis-revision change invalidates a stale continuation.

Only `change.ready` may return `Implementation mutation: ALLOWED`, and only for the effect classes explicitly authorized by a current `Readiness: READY` bound to the same basis revision. Durable content capture uses its own delegation; it is not an implementation mutation.

### Default composition

```text
context.resolve bootstrap
-> work.resolve bounded orientation
-> activity.resolve when identified
-> work.resolve full understanding + context.resolve task adapters
-> scenario.plan seed/refine + change.investigate
-> direction.align + scenario.plan combined checkpoint when triggered
-> change.ready
-> change.apply
-> result.verify
-> record.capture
-> result.audit
-> record.capture if audit changed current truth
-> communication.report
```

The composition is a route with interrupting guards, not permission to run every step blindly or print a receipt for every arrow.

## Capability map

| ID | Friendly responsibility | Route and detail |
| --- | --- | --- |
| `context.resolve` | Please, Use the Right Context | Resolve bootstrap context first and claim-specific adapters later with [context layers](references/context-layers.md) |
| `work.resolve` | Please, Know the Work | Orient, establish shared understanding, and resolve contract, scope, source state, risk, and uncertainty with [workflow](references/workflow.md) |
| `activity.resolve` | Please, Don't Lose the Thread | Resolve activity identity, record, durable gate, delegation, freshness, and retrieval with [durable record protocol](references/durable-record-protocol.md) |
| `record.structure` | Please, Keep It Legible | Select logical responsibilities, archetype, and optional profile with [record schema](references/durable-record-schema.md) |
| `record.store` | Please, Store It Safely | Preflight and compare user-controlled storage without guessing from writability with [record storage](references/durable-record-storage.md) |
| `record.retrieve` | Please, Find the Thread Again | Resolve records, candidates, freshness, and bounded absence with [record retrieval](references/durable-record-retrieval.md) |
| `evidence.check` | Please, Check Before You Claim | Classify claim basis, provenance, conflicts, negative evidence, and corrections with [epistemic integrity](references/epistemic-integrity.md) |
| `change.investigate` | Please, Look Before You Change | Test falsifiable explanations, trace observable paths, and compare solution classes with [workflow](references/workflow.md) |
| `direction.align` | Please, Align Before You Choose | Expose viable directions and request the smallest collaborator-owned decision with [workflow](references/workflow.md) |
| `scenario.plan` | Please, Plan What Could Break | Seed and refine risk-bounded scenarios and align material coverage with [verification](references/verification.md) |
| `change.ready` | Change Readiness | Bind current basis, activity, capture, scenarios, scope, authority, and verification intent with [workflow](references/workflow.md) |
| `change.apply` | Please, Make the Smallest Defensible Change | Apply only the supported and authorized implementation with [workflow](references/workflow.md) |
| `result.verify` | Please, Prove It | Execute sufficient checks or leave an exact reproducible handoff with [verification](references/verification.md) |
| `result.audit` | Please, Check Your Work | Challenge the complete final state and completion claim with [review and security](references/review-and-security.md) |
| `record.capture` | Please, Write It Down | Transactionally reconcile material knowledge inside a delegated activity with [continuous capture](references/continuous-activity-capture.md) |
| `authority.request` | Please, Ask Before You Rearrange | Inspect and plan without writes, then request digest-bound structural authority with [context-store operations](references/context-store-operations.md) |
| `communication.report` | Please, Say What Matters | Report result, epistemic status, decisive evidence, limits, and one next action with [collaboration](references/collaboration.md) |
| `failure.challenge` | Please, Catch Familiar Mistakes | Select and run a root challenge from [failure patterns](references/failure-patterns.md) |
| `history.localize` | Please, Find Where It Changed | Localize historical transitions and bound attribution with [regression localization](references/regression-localization.md) |
| `host.guard` | Please, Guard the First Write | Use the bundled Codex procedural interlock when active, or describe another verified host boundary honestly, with [host enforcement](references/host-enforcement.md) |

## Materiality and effort

Something is **material** when being wrong could change scope, implementation, verification, security, data, user-visible behavior, external state, continuity, or the completion claim.

- **Light:** local, reversible, well specified, and no material shared boundary.
- **Standard:** identified, multi-surface, user-visible, stateful, or expected to benefit from recovery.
- **High:** security, privacy, destructive operations, migrations, production, public contracts, sensitive data, irreversible effects, or unknown blast radius.

Discovery may raise but never silently lower effort. For an identified Standard or High activity, durable continuity is required unless a precise exception shows every independent gate trigger false and no material recovery value. Light work remains light unless a trigger appears.

## Non-negotiable invariants

1. Follow the host instruction hierarchy. Current explicit authority and project instructions override historical context and examples.
2. MUST NOT present recollection, inference, assumption, a search miss, an unexecuted check, or a model-authored field as verified fact.
3. A discoverable technical uncertainty routes to `INVESTIGATE`; ask the collaborator only for product intent, priority, risk acceptance, authority, or another decision evidence cannot make.
4. Bootstrap context precedes identified-activity resolution. An identified activity MUST reach one literal transition result before material activity investigation.
5. `planned-and-awaiting-approval` and `blocked` stop material investigation. `no-record-with-valid-reason` permits it provisionally and MUST be re-evaluated when a trigger appears.
6. MUST NOT perform a material implementation mutation before current `Readiness: READY` for the current basis revision.
7. A shared observable property MUST trace both surfaces and their bridge or intentional non-equivalence before readiness.
8. Standard and High material behavior work requires a current combined contract, direction, and scenario checkpoint or prior explicit scope-specific delegation.
9. Authority follows effects. Authority for one effect class does not authorize another.
10. MUST attempt the strongest sufficient accessible authorized observable check. A handoff is not execution evidence.
11. A correction, new consumer, changed contract, failed required capability, refuted hypothesis, changed scope, changed authority, or stale capture invalidates dependent readiness and evidence.
12. A material epistemic discontinuity or explicit rejection of the active direction routes to `RECONCILE`, freezes dependent mutation, and creates a collaborator turn boundary.
13. A delegated record MUST capture material knowledge before dependent work when loss could change a decision or repeat an error. Current truth and history must agree.
14. Structural, configuration, locator, visibility, movement, deletion, retention, or lifecycle changes require a fresh exact plan and digest. Routine durable content remains bounded by its active delegation.
15. MUST audit the complete final state and re-read material evidence before claiming completion within the declared contract and evidence limits.
16. MUST minimize durable sensitive data and MUST NOT store secrets or unnecessary sensitive content.
17. Structural or semantic relationships identify candidates, not complete observable reachability or blast radius, until the bridge is corroborated.
18. Every changed artifact supported by an executable current diagnostic capability receives current coverage before completion. Missing or untrusted coverage is not a pass.
19. A host receipt makes a transition observable; it does not prove the model's declarations, evidence, understanding, authority, or conclusion true.

## Bootstrap, activity, and capture

`context.resolve` first runs in **bootstrap mode**. Inspect only authoritative host or project instructions, configured context discovery surfaces, activity-identity conventions, storage constraints, and required capability declarations. Record what was inspected and the residual discovery limit. An undiscoverable adapter cannot silently impose obligations.

`work.resolve` then performs **bounded orientation**: stable activity handle if supplied, requested outcome, explicit authority, and enough scope to decide whether the work is identified. This is not technical investigation. A branch, nearby file, guessed ticket, or inferred name does not identify an activity by itself.

For identified work, `activity.resolve` returns exactly `loaded`, `created`, `planned-and-awaiting-approval`, `no-record-with-valid-reason`, or `blocked`. A direct canonical record path may identify the current activity when its identity and authority are verified. Automatic cross-session discovery needs a durable locator, registry, or backend-native canonical key. Cross-activity queries need an indexed discovery surface.

When a durable gate applies and no store is configured, run `record.store` preflight before recommending a location: owner and subject, audience, repository relationship, filesystem access, versioning or ignore state, synchronization or publication exposure, sensitivity, retention, recovery, retrieval, and existing stores. Then present one compact authority checkpoint for adjacent known effects while keeping every scope and digest independent. Recommend an outcome-complete activity bootstrap, never only an empty directory.

Inside a valid delegation, `record.capture` runs at the first material event and every material correction, decision, scope change, implementation milestone, verification result, pause, handoff, closure, and audit correction. If capture cannot complete, expose `capture-incomplete` plus the exact pending material item and stop any dependent completion claim.

## Shared understanding and scenarios

Before broad investigation, seed scenarios from the provisional observable contract. Refine them as entry points, consumers, states, permissions, persistence, delivery, errors, history, and risk become known. A scenario has two independent states:

```text
Coverage disposition: planned | excluded-with-reason
Execution result when planned: not-run | passed | failed-product | failed-environment | blocked | partial | invalidated
```

Negative search evidence such as `absent-within-scope` is a claim status, not a scenario result.

Before a preferred material solution or solution-shaped artifact, combine the user-visible direction and scenario checkpoint when both apply: observable contract, scope and non-goals, preserved behavior, material scenario groups, explicit omissions, viable solution classes, recommendation, tradeoffs, tool limits, and one smallest collaborator-owned question. A generic prior request to implement is not acceptance of this evidence-backed frontier.

Choose checks by contract coverage, directness, current-state relevance, and ability to discriminate first. Minimize cost only after sufficiency. No evidence lane, tool, language, source-control system, hosting provider, test framework, or delivery process is universal.

## Change readiness

Immediately before the first material implementation mutation, show one combined checkpoint:

```text
Readiness: READY | INCOMPLETE | BLOCKED
Effort and reason:
Outcome, observable contract, scope, and preserved behavior:
Current source or environment state:
Activity transition and activity/source consistency when identified:
Basis revision and invalidated dependencies:
Capture freshness, pending capture, and canonical-record consistency:
Relevant surface and observable bridges inspected:
Falsifiable claim, result, and strongest counterexample:
Viable directions, human basis, and scenario coverage when triggered:
Expected implementation scope and authorized effect classes:
Required capabilities used and coverage lost:
Verification and repeatable-protection intent:
Remaining blocking uncertainty:
```

`READY` needs an evidence-backed answer for every applicable field. `INCOMPLETE` routes to safe discovery. `BLOCKED` names the exact unavailable prerequisite. Any basis-revision change invalidates the receipt.

## Verification, audit, and reporting

For each material check, state the claim it can falsify, literal result, what it proves, and what it does not. When the strongest observable check belongs to the collaborator, investigate discoverable setup first and provide the exact entry surface or URL when known, environment, fixture characteristics without secrets, actions, expected observations for material scenarios, evidence to retain, cleanup, and limits. Call it collaborative, reproducible-handoff, blocked, or partial rather than executed.

Before completion, inspect the full changed surface, shared consumers, negative and repeated paths, permissions, persistence, concurrency, scenario mappings, regression protection, current diagnostics, verification disposition, and delegated record. Capture any audit correction before reporting.

Ordinary user-visible communication uses at most three envelopes: activity and authority when triggered; combined understanding, direction, scenarios, and readiness before implementation; verification, audit, durable reconciliation, and handoff at the end. Internal continuations belong in an optional audit trace. Durable records contain material events and current recovery truth, not process theater.

Report the result first, immediately attach its epistemic status and decisive basis, then material evidence, limits, residual risk, and one primary next action. Additional actions appear only when independently necessary. Do not provide hidden chain-of-thought.

## Reference router

The capability map supplies normal routing. These triggers are mandatory:

- Historical transition or regression attribution -> [regression localization](references/regression-localization.md)
- Security, authorization, privacy, review, or unknown blast radius -> [review and security](references/review-and-security.md)
- Trusted bundled-hook context announces a registered `Please, ...` capability heading, mutation interception is active, or a trusted-readiness claim appears -> [host enforcement](references/host-enforcement.md)
- Activity contract, archetype, taxonomy, extensions, or evidence manifests -> [record schema](references/durable-record-schema.md)
- Storage choice, safety, privacy, retention, or exposure -> [record storage](references/durable-record-storage.md)
- Search, catalogs, relationships, freshness, or completeness -> [record retrieval](references/durable-record-retrieval.md)

Bundled files under `assets/` are non-operative examples. Never activate their values unless the collaborator explicitly adopts and configures them.
