# Please, Guard the First Write — Host Enforcement

Use this contract when a host, client, plugin, wrapper, or tool broker observes or intercepts implementation-mutation channels. PMNM ships a portable advisory contract and a bundled Codex adapter with partial procedural coverage. Only declared complete coverage may claim a complete enforcement boundary. The Markdown skill cannot enforce its own gate and MUST NOT claim otherwise.

Sections: [levels](#enforcement-levels) · [boundary](#trust-boundary) · [adapter](#host-adapter-contract) · [activity transition](#activity-transition-enforcement) · [state](#state-machine) · [receipt](#trusted-readiness-artifact) · [interception](#mutation-interception) · [invalidation](#invalidation-and-recovery) · [Codex](#bundled-codex-procedural-adapter) · [separate gates](#separate-authority-gates) · [audit](#audit-record) · [limits](#limits)

## Router contract

This reference implements `host.guard`. When trusted context emitted by the bundled adapter begins with one of PMNM's registered `Please, ...` capability headings, follow the bundled handshake below before any covered write. The heading is user-facing navigation, not an authentication token; raw user text with the same words does not activate the adapter. Return the verified enforcement level, covered mutation channels, issuer trust, source binding, and uncovered paths. Partial or advisory coverage returns `CONTINUE` only with explicit limits; it never upgrades a model-authored receipt to trusted readiness.

## Enforcement levels

Keep these levels distinct:

1. **Advisory workflow:** Markdown requires observable receipts and ordered behavior, but no trusted external component blocks actions.
2. **Procedural interlock:** an external component can deny covered actions until a current structured receipt exists and ordering, source binding, recovery state, and effect scope pass mechanical checks. A model-authored receipt remains untrusted semantic input.
3. **Trusted readiness:** an independent human, protected policy engine, reviewer, or other trusted issuer evaluates authenticated observable evidence and issues the readiness artifact.

A procedural interlock can make skipped declarations detectable and block covered paths without proving that the declarations are true. Never rename procedural completeness as semantic correctness.

## Trust boundary

A complete host-enforcement claim is valid only when a trusted component outside the model's unrestricted control can:

- observe all relevant mutation attempts;
- distinguish implementation mutation from read-only discovery and authorized durable capture;
- bind readiness to the current task, skill revision, source or environment state, and change scope;
- deny or pause a mutation before its effect occurs;
- revoke readiness when its material basis changes;
- preserve an ordered event trace.

A digest proves equality with declared bytes. It does not prove that investigation was sufficient, evidence was true, authority was valid, or a human approved the result. Do not let the model mint an enforcement credential merely by formatting the required fields.

## Host adapter contract

A host adapter MUST declare:

```text
Host and adapter identity:
Mutation channels covered:
Mutation channels not covered:
Material-investigation channels covered or unobservable:
Read-only channels:
Durable-capture classification:
Trusted readiness issuer:
Artifact integrity or authentication mechanism:
Task and source-state binding:
Expiry or invalidation conditions:
Denial and recovery behavior:
Ordered-trace destination and privacy:
Context-store authority integration:
Known bypasses and residual risk:
```

If an implementation-mutation channel cannot be intercepted, label coverage partial. Partial coverage may improve observability, but it is not enforcement of the complete first-write gate.

## Adapter ownership and noninterference

Treat each host adapter as an independently verified translation boundary. Shared vocabulary, event names, environment variables, or JSON fields are candidate compatibility only. They do not prove equivalent firing order, tool identity, input shape, failure reporting, interruption semantics, persistence, trust, blocking behavior, or bypass coverage.

The bundled `hooks/hooks.json`, `hooks/pmnm-guard.mjs`, `evals/host-guard-cases.json`, and `scripts/test_host_guard.mjs` currently belong to the Codex adapter. A future Claude Code or other host implementation MUST add separate host-owned manifest, hook configuration, event mapper, runtime entry, fixtures, native validation, installation evidence, and clean-session evaluation. It MUST NOT replace the Codex default hook, weaken a Codex invariant, or treat the Codex test suite as execution evidence for another host.

If a future implementation proposes a shared engine, make that extraction a separate cross-host change. Preserve host-specific input and output adapters, run every existing Codex guard case unchanged, add equivalent and host-difference cases for the new adapter, and state which lifecycle signals have no native equivalent. A missing signal produces partial or advisory coverage. Do not emulate it by silently assigning another event a stronger meaning.

## Activity-transition enforcement

For an identified activity, a host with lifecycle hooks or a complete tool broker MAY require a trusted activity-transition artifact before permitting observable material investigation. Bind it to the activity identity, registry or locator result, evaluated and applicable gate conditions, record/delegation state, literal transition result, and current source or environment state.

`planned-and-awaiting-approval` and `blocked` deny material investigation and implementation. A newly observed durable-record trigger revokes `no-record-with-valid-reason` until reevaluation produces another trusted transition result. The host MUST still allow the bounded orientation needed to resolve identity, record existence, the gate, and the exact approval plan.

If the host cannot observe internal model reasoning, conversation-only analysis, direct filesystem reads, or another investigation channel, label transition enforcement partial. A mutation gate can still reject the first write when the readiness artifact lacks a valid transition, but it cannot prove that premature investigation did not occur.

## State machine

Use the portable transition literally:

```text
ORIENT -> INVESTIGATE -> AWAITING-COLLABORATOR
             |                    -> later turn -> COLLABORATOR-RESPONDED
             |                    -> explicit response reconciliation
             |                    -> ALIGNED -> READY -> IMPLEMENT -> VERIFY -> COMPLETE
             |
             -> BLOCKED when activity creation or another authority boundary awaits approval

missing covered result, material loss of the active direction's basis,
explicit collaborator rejection, or correction after dependent mutation
  -> RECOVERY -> explicit effect/result reconciliation when needed
  -> corrected checkpoint -> collaborator turn -> refreshed alignment and READY
```

After `ACTIVITY-READY` when that transition applies, the host MAY allow read-only investigation before change readiness. It MUST block or pause a material implementation mutation unless a current trusted readiness artifact covers it.

An attempted mutation while `INCOMPLETE` or `BLOCKED` is an observable gate failure even when the host successfully denies it. Preserve the attempt in the trace without treating it as an applied change.

## Trusted readiness artifact

Bind at least:

```text
Artifact schema version:
Skill identity and revision:
Task or activity identity:
Activity-transition result and artifact identity:
Effort and risk class:
Material contract identity:
Source or environment state:
Inspected surface summary:
Required-reference load evidence:
Required adapter and tool evidence:
Counterexample and baseline status:
Expected mutation scope:
Authorized effect classes:
Triggered observable-equivalence or asynchronous-delivery artifacts:
Decision-alignment artifact, when triggered:
Scenario Coverage Contract, mappings, and collaborator-response or delegated basis, when triggered:
Realignment or recovery state:
Verification and regression-protection intent:
Remaining bounded uncertainty:
Issued state: READY
Issuer identity:
Issued time, expiry, or one-use condition:
Integrity or authentication value:
```

The trusted issuer MAY validate observable completeness and ordering. It cannot certify hidden reasoning or semantic truth merely from field presence. High-risk hosts should require an independent policy or human decision when the underlying authority boundary demands it.

Do not expose signing material, approval secrets, or an unrestricted issuer interface to the same actor whose mutation is being gated. If the host has no trusted issuer, retain the textual readiness receipt and trace it honestly as advisory.

## Mutation interception

Before allowing an implementation mutation:

1. Canonicalize the target and effect without applying it.
2. Resolve the current task, source or environment state, and applicable adapter.
3. For an identified activity, verify that the readiness artifact binds a still-valid activity-transition result.
4. Verify the readiness artifact's integrity, issuer, expiry, and exact state binding.
5. When scenario coverage is triggered, verify that a current `SCENARIO-ALIGNED` artifact follows the latest evidence-backed understanding and carries an allowed collaborator-response or scope-specific delegated basis for Standard or High work.
6. Confirm that the requested target and effect remain within expected mutation scope.
7. Confirm that the requested effect class was authorized and that no collaborator-defined stage boundary is crossed.
8. Confirm that no transition, scenario-coverage or readiness invalidation, unresolved `REALIGNMENT` or `RECOVERY`, explicit directional rejection, or new prompt invalidation event occurred after issuance.
9. Deny the effect before execution on any mismatch or unknown channel.
10. Record allowed, denied, failed, and unavailable decisions separately.

Do not silently allow an “unchanged subset” after scope or source-state drift. Return to investigation and issue a new artifact.

## Invalidation and recovery

Revoke dependent readiness on a material correction, source-state change, newly discovered consumer, state, contract dimension, scenario, scope change, failed required tool, refuted hypothesis, changed authority rule, changed verification plan, newly required effect class, or incomplete observable bridge. Revoke affected scenario alignment as well as direction alignment and verification evidence.

After ordinary invalidation:

1. preserve which readiness fields and evidence became stale;
2. deny another material implementation mutation;
3. permit safe read-only discovery;
4. require refreshed shared understanding and affected evidence;
5. issue a new trusted artifact only after readiness is restored.

A denied attempt does not authorize rollback or cleanup. Classify any resulting external or partial state independently and use its applicable authority protocol.

When new evidence materially removes the basis for an active direction, or the collaborator explicitly rejects it, revoke readiness and decision alignment, record `REALIGNMENT` or `RECOVERY`, and deny covered dependent investigation and mutation. The artifact must bind the prior and new basis, verification status, source, affected work, canonical current understanding, one evidence-based question, and the turn boundary. A model-authored `turn_boundary` field is only a declaration unless the host independently observes turns.

After an observed collaborator response, the host may reopen covered read-only investigation. It must still require refreshed evidence-backed understanding, a new valid decision-alignment artifact and Scenario Coverage Contract when triggered, and new readiness before mutation. Neither severity authorizes restoration, deletion, or overwriting collaborator work.

## Bundled Codex procedural adapter

The plugin bundles hooks/hooks.json and hooks/pmnm-guard.mjs. When the current Codex host discovers, enables, and trusts that exact hook definition, it supplies a partial procedural interlock. Installation alone is not activation evidence. Use /hooks to inspect the source, review its current hash, trust or disable it, and confirm whether it ran. Any hook change invalidates prior trust.

The adapter intentionally does not handle PermissionRequest and cannot approve a sandbox, network, destructive, or external effect. Native host authority remains separate. It observes these lifecycle events:

- SessionStart loads compact procedural state keyed to the session and working directory; a fresh session begins with a clean orientation state.
- UserPromptSubmit records only a bounded language choice and prompt hash, binds the next window to one observed collaborator turn, invalidates stale readiness and delegated capture, and preserves consequential covered writes already in flight.
- PreToolUse classifies covered Bash and apply_patch aliases, records control transitions, and denies an out-of-order covered write.
- PostToolUse records a covered call previously allowed by the guard and makes a late result visible when it contradicts an earlier reconciliation.
- Stop requests one bounded continuation when a collaborator response still needs classification, an observed implementation lacks closure, or Recovery remains unresolved, then avoids a continuation loop.
- Interrupt invalidates a pending write window and preserves any consequential covered write in Recovery until its result is reconciled.

### Runtime handshake

Use a guard control command only after trusted bundled-hook context announces a registered `Please, ...` capability heading. Codex sends the command through PreToolUse and the adapter rewrites it to a silent harmless no-op. If the literal command reaches a shell, returns command-not-found, or no trusted hook context appears, treat the adapter as absent or broken and continue under the portable advisory contract.

At the first applicable turn, record one concrete route. Do not use examples such as `stable-id`, `unknown`, or `missing` as values:

    pmnm-guard route effort=standard activity=work-identifier transition=loaded basis=1 locator=registry-entry record=canonical-record

Allowed activity transitions are not-applicable, loaded, created, no-record-with-valid-reason, planned-and-awaiting-approval, and blocked. Use `activity=none` only with `transition=not-applicable`. `loaded` requires concrete locator and record receipts. A missing store is not a no-record exception. A `blocked` transition may carry the same `digest=` field so a later `created` transition can bind to the approved plan without another route. Receipt values may begin with a dot, such as `.ai/activities/work-1.md`; parent-directory traversal is rejected.

For a missing required record, complete storage preflight and present one outcome-complete plan before recording the blocked transition:

    pmnm-guard route effort=standard activity=work-identifier transition=planned-and-awaiting-approval basis=1 digest=lowercase-sha256

After the collaborator responds, classify that response explicitly. Acceptance is never inferred merely because another turn exists:

    pmnm-guard align result=accepted basis=1

Then apply only the approved structural operations under native authority and record the resulting concrete receipts:

    pmnm-guard route effort=standard activity=work-identifier transition=created basis=1 locator=registry-entry record=canonical-record authority=lowercase-sha256

The `authority` value must equal the approved plan digest. `created` also requires that every approved covered structural operation was observed successful: a `durable-structure` grant is accepted only with `authority` equal to the approved plan digest, its `uses` value is the exact number of approved covered operations rather than a budget, a later grant or retry can raise that number but never lower it, and `created` stays unavailable until that many successful results are observed and no covered result is pending. A late result keeps the identity of the activity and plan it belonged to; it can reopen Recovery, but it never advances another activity's plan or effect accounting. A grant is authority, not execution evidence, so the action after a grant is the pending operation itself, never the `created` declaration. A structure created through an uncovered channel cannot be labeled `created`; it may be declared `loaded` with the plan digest as authority, and the adapter records that as a model-declared retrieval receipt under partial coverage. A Standard or High `no-record-with-valid-reason` decision likewise requires a later explicit collaborator response after a blocked or planned transition, plus a concrete exception and authority receipt. Light work may remain proportional when the portable durable gate genuinely does not apply.

The adapter accepts activity routing only from initial orientation, investigation, aligned or blocked activity resolution, or a closed lifecycle. It rejects route as a reset from awaiting-collaborator, readiness, implementation, verification, recovery, or exemption. It also rejects a route while any covered write is in flight, a silent effort downgrade or backward basis inside one activity lifecycle, and a different activity after an observed implementation mutation or an observed authorized effect until the current one has an honest completed, partial, or blocked closing disposition. A route after closure starts fresh activity-local mutation accounting. This preserves attribution; it does not prove that the closing account is semantically complete.

For a loaded or created delegated activity, `capture=current` is not a free-form assertion. Before readiness, issue a bounded `durable-content` grant under the existing delegation, perform the actual record update through a covered write, and let `PostToolUse` observe its success. The guard binds that capture to the current prompt, basis, and implementation-mutation count. A later collaborator prompt invalidates prior capture freshness, and a capture call that began before that prompt remains stale when it finishes. A failed capture, missing capture, stale capture, or capture preceding a later implementation call cannot satisfy the next dependent boundary. The guard still cannot verify that the selected file or content is semantically the correct activity record.

Before a material direction for Standard or High work, show the collaborator the combined evidence-backed checkpoint, then record it and stop:

    pmnm-guard checkpoint kind=combined basis=1

The next UserPromptSubmit establishes only that a later collaborator turn occurred. Reconcile its meaning before readiness or sensitive authority use:

    pmnm-guard align result=accepted basis=1

Allowed results are accepted, changed, unclear, and rejected. Accepted preserves the current basis. Every other result requires a higher basis and returns to investigation or Recovery. A later collaborator prompt during aligned work returns the adapter to this explicit reconciliation before readiness or sensitive authority can be used again. An authority-only checkpoint cannot satisfy direction or scenario alignment. Current aligned scenarios require a combined checkpoint; prior scope-specific delegation must be declared as delegated rather than current alignment. If the basis changed, reconcile or invalidate instead of asserting alignment. When the response supports readiness, first show the ordinary Change Readiness receipt, then record:

    pmnm-guard ready basis=1 scope=bounded-scope effects=implementation,verification verification=planned-checks capture=current alignment=current scenarios=aligned constraints=current-constraints capabilities=required-capabilities

Current alignment requires the later collaborator turn. Explicit scope-specific delegation may use alignment=delegated plus delegation=short-basis. Light work may use alignment=not-required when the portable contract genuinely makes the checkpoint unnecessary. Every new user prompt expires an unused write window.

Keep other effect classes separate from implementation. After the corresponding portable authority is established, a bounded nonimplementation call can use:

    pmnm-guard grant effect=durable-content authority=delegated-record uses=1 basis=1

Supported effect classes are implementation, structure, dependencies, environment, verification, version-control, external, publication, durable-content, durable-structure, movement, and deletion. The receipt does not replace host approval. Durable content requires a loaded or created delegated activity. Sensitive classes require a later authority or combined checkpoint.

An unclassified shell command is denied with a random one-use token. Classify only the unchanged command and only when its actual effect is known:

    pmnm-guard permit token=token-from-denial effect=investigation

The token is bound to the command bytes, prompt, and one retry. Definite mutation patterns never enter this classification route. Classification is not authority. The classifier lexes top-level segments and quote boundaries first and applies mutation rules to executable positions by verified command family: quoted data of a read-only command, such as a search pattern that mentions a destructive command or a redirection character, never becomes a mutation; interpreters and evaluation-capable commands stay unknown unless their quoted code carries definite mutation vocabulary; top-level redirection, mutating subcommands, `find` execution and file-output actions, `sed` in-place editing and unequivocal `w` write commands, ripgrep preprocessors and compressed-search modes, and pipelines into mutations remain covered; `sed` script files, block scripts that mention writing or execution, and other ambiguous scripts stay unknown; escaped or unterminated quoting stays unknown; bounded host diagnostics such as a client version query or a Git ignore, variable, or read-only configuration query need no permit. This is command-shape classification, not proof of shell safety.

Only one covered write may remain in flight. If its PostToolUse result is missing, another covered write is denied until the effect is reconciled conservatively:

    pmnm-guard reconcile outcome=unknown reason=missing-post-use basis=2

Use `failed-no-effect` only when current evidence supports that literal result. `unknown` counts an unresolved implementation call as a possible mutation. A late successful result after `failed-no-effect` for any consequential effect, implementation or otherwise, records the effect, invalidates dependent state, and reopens Recovery at a higher basis instead of disappearing from the trace.

A collaborator prompt that arrives while a nonimplementation covered result is pending preserves that result, the checkpoint, the plan digest, and the still-unclassified turn, removes the active grant, and enters Recovery. The result is settled first, through its host result or `reconcile`; only then is the response classified with `align`. An accepted response after a resolved result restores the prior aligned phase and the same grant path without another human round. An unknown or contradicted result keeps Recovery open even when the response is accepted. A prompt during a pending implementation call keeps the stricter existing behavior and clears the collaborator binding.

When evidence, scope, authority, or source state invalidates the basis, advance the revision and reconcile:

    pmnm-guard invalidate reason=material-correction basis=2

Every implementation call invalidates earlier verification. A successful covered verification command can establish current procedural evidence. When verification occurs through the collaborator, an interface, or another uncovered tool, record its literal current disposition separately:

    pmnm-guard verify basis=2 result=passed source=collaborator scope=observable-scenarios

Allowed results are passed, failed, partial, and blocked. Allowed sources are collaborator, interface, and uncovered-tool. This receipt records provenance and freshness; it does not upgrade a report into trusted execution evidence. It is also admissible for an activity whose authorized nonimplementation effects were observed without any implementation call.

After an observed implementation call, finish current verification, observable disposition, protection, capture, and audit before recording closure:

    pmnm-guard complete basis=2 verification=passed observable=executed protection=added-or-updated capture=complete audit=passed

`verification=passed` requires current successful evidence after the latest implementation mutation and therefore requires `observable=executed`. A reproducible handoff is useful but remains partial rather than passed. When an activity is delegated, perform and observe its final durable-content update after the latest implementation call before this completion command. Completion is also rejected while any tracked covered write lacks its post-use result. For work with no delegated record, use `capture=not-applicable`; the adapter rejects a contradictory capture state.

Closure is progressive: the adapter names verification, then delegated capture, then the completion receipt, one requirement per output. An activity whose observed covered effects contained no implementation mutation, such as an authorized version-control or structural operation, closes from investigation or alignment with the same receipt; `verification=passed` then requires current evidence after the latest authorized effect. Work with neither implementation nor authorized covered effects closes only with `verification=not-applicable observable=not-applicable protection=not-applicable`. Stop requests one bounded continuation while such a closing disposition is missing.

Use status with no fields to request the compact current state. Use exempt only from a clean initial orientation for a genuinely non-triggering task, bound to the current prompt, and only for implementation or verification. Never use exemption to reset routed or active work, or to authorize structure, dependencies, environment, version control, external state, publication, durable state, movement, or deletion.

Ordinary hook output begins with the full friendly capability name, one short sentence in the agent's own first-person guard voice that says what is being protected, and one action marked `NEXT:`. Every phase card and denial names exactly one action justified by the observable state and its declared unknowns, carries at most one `pmnm-guard` line, never advertises a control command its own state would reject, never assumes a value the model or the collaborator still has to decide, and states that the line is sent through the shell tool where that channel could be misunderstood. The voice stays calm, blames no one, and claims no safety, correctness, or verification without evidence. A denied covered write is retained as one bounded unresolved cursor bound to the exact tool and command hash together with its effect class, phase, basis, prompt epoch, and denial count. An admitted exact retry marks the cursor in flight; only a successful matching result clears it. A failed retry, a missing result, a different operation of the same class, or a second distinct denial preserves the original obligation, and the second denial is reported as deferred behind it. Conversational age never clears the cursor. It clears, each time with a recorded cause, on observed success, on `invalidate`, on `align` with `changed`, `unclear`, or `rejected` after a real collaborator turn, on completion, or on an authorized activity change. Stop decides from the cursor's own compiled action and continues once while that action is executable by the agent; a genuine collaborator wait still stops silently. The output exposes no diagnostic code or abbreviated product label. `evals/host-guard-action-oracle.json` records the expected action for normalized sequences of these states. The adapter selects English or Spanish through a bounded best-effort prompt heuristic, persists only the selected enum, and falls back conservatively when the language is unclear. This is not universal language detection. Lifecycle event names remain the host's native identifiers, and internal `pmnm-guard` commands remain implementation receipts rather than user-facing nomenclature.

### State and privacy

The adapter stores its own bounded state beneath PLUGIN_DATA, keyed by hashes of session and working directory. It uses owner-tagged create-only locks that only their owner removes, recovers an orphaned lock after a threshold above the hook timeout, waits with bounded jitter so concurrent lifecycle deliveries serialize, skips rewriting unchanged state, and uses atomic replacement. It keeps a bounded event list and stores hashes, enums, counters, and effect classes rather than raw prompts, commands, tool results, evidence, or context. Persisted evidence written before effect accounting existed is bound to zero observed effects, so it stays current until the first newly observed effect and becomes stale afterwards; absence of a newer field never upgrades old evidence. The session and resolved working directory bind the procedural state location; the hook does not independently inspect a revision graph, file tree, environment, or external system to authenticate source state. Model-declared basis and scope remain untrusted. This state is not an Activity Record, context store, evidence archive, authority source, or recovery substitute. User-controlled durable context remains external to the installed package.

Corrupt or unverifiable adapter state denies a covered write when the runtime executes. A missing runtime, disabled hook feature, untrusted hook, host launch failure, hosted tool, specialized opt-out path, or unsupported host may bypass the adapter entirely. Those states reduce coverage to advisory and must be reported rather than described as a successful guard.

### Coverage claim

The bundled adapter can enforce declared ordering for covered local Bash and apply_patch calls. It cannot establish whether investigation was sufficient, a checkpoint was honestly summarized, a delegation was valid, a scenario set was complete, a command classifier captured every possible shell effect, or a final claim was true. It does not intercept hosted tools, all specialized tools, direct external actors, or every mutation mechanism. Treat its receipts as model-authored procedural claims unless an independent issuer validates them.

## Separate authority gates

Implementation readiness does not replace other gates:

- a context-store structure, configuration, locator, lifecycle, or out-of-delegation extension mutation still requires its exact plan, digest, and fresh approval;
- an authorized routine durable capture is not an implementation mutation and must remain limited to its active delegation;
- destructive or externally consequential operations still require their own human authority and containment;
- a regression-protection disposition is required before completion when triggered, not merely before the first write.

The host MUST classify these effects explicitly instead of routing every write through one ambiguous token.

## Audit record

Preserve a bounded ordered trace containing:

```text
Sequence and time when available:
Task, skill revision, and source state:
Required instruction and adapter loads:
Activity-transition receipts and gate-trigger invalidations:
Readiness issuance or denial:
Invalidation events:
Mutation attempts and classification:
Effect classes and authorization result:
Decision-alignment, scenario-coverage, epistemic-reconciliation, observable-equivalence, asynchronous-delivery, and recovery events when triggered:
Gate decision and reason:
Verification and final-audit events:
Coverage gaps and unavailable channels:
```

Minimize sensitive command arguments and evidence content. Prefer event identity, path class, digest, and bounded result over raw secrets, payloads, or transcripts.

## Limits

- A host adapter can enforce ordering and declared scope; it cannot guarantee correct reasoning or outcome.
- A model-visible checksum without a trusted issuer is not authorization.
- A wrapper covering one tool does not cover shell, editor, API, database, browser, or external-service mutations automatically.
- A trace validator can detect missing or misordered observable events; it cannot prove unrecorded events did not occur unless the host event source is complete.
- A procedural interlock validates declared shape, order, and scope for covered channels; it does not establish causal truth, product intent, observable equivalence, or test admissibility by field presence alone.
- A structurally valid Scenario Coverage Contract cannot prove that its declared material items are complete, its sources are truthful, or a model-labeled collaborator response actually occurred unless the event source authenticates those facts.
- A host that intercepts writes but not material investigation can enforce readiness before mutation, not the earlier transition boundary; report those coverages separately.
- When interception is unavailable, use the textual `READY` gate and report that enforcement is advisory.
