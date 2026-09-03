# Please, Look Before You Change — Investigation, Implementation, and Debugging

Use this procedure for material software changes. The core skill remains authoritative.

Sections: [intake](#1-bounded-orientation-intake-and-risk) · [understanding](#2-shared-understanding) · [contract](#3-contract-card) · [surface](#4-surface-map) · [investigation](#5-falsifiable-investigation) · [alignment](#please-align-before-you-choose) · [scenario coverage](#please-plan-what-could-break) · [equivalence](#please-trace-what-must-match) · [delivery](#please-follow-the-value) · [baseline](#6-baseline) · [activity alignment](#activity-and-delivery-state) · [scope](#7-scope-ledger) · [readiness](#8-change-readiness) · [reconciliation](#please-stop-and-reconcile) · [implementation](#9-implementation-discipline) · [completion](#10-completion-pass)

## Router contract

This reference implements `work.resolve`, `change.investigate`, `direction.align`, `change.ready`, and `change.apply`.

- Return missing discoverable evidence as `INVESTIGATE`.
- Return a collaborator-owned material decision as `ALIGN`.
- Return an epistemic discontinuity or explicit rejection as `RECONCILE`.
- Return a current model, tool, or evidence-channel limit as `ESCALATE`.
- Only `change.ready` may return implementation mutation `ALLOWED`, and only with current `Readiness: READY` bound to the current basis revision.
- Return `continueWith` and, after an interrupt, `resumeWith` to the central router. Do not invoke another capability directly.

## 1. Bounded orientation, intake, and risk

Before `activity.resolve`, perform only bounded orientation:

```text
Stable activity handle supplied by an authoritative source, if any:
Requested outcome:
Explicit authority and forbidden effects:
Enough scope to determine whether the work is identified:
```

Do not inspect technical implementation, construct a causal theory, or map the broader surface in this step. A branch, nearby file, inferred ticket, or guessed name is not an authoritative activity identity.

After the identified-activity transition, complete intake:

Capture:

```text
Requested outcome:
Completion condition:
Requirements and constraints:
Current source/environment state:
Identified activity and source/delivery-state consistency:
Activity transition and basis revision:
Capture freshness and pending capture:
Authorized actions:
Forbidden mutations:
Authorized effect classes:
Collaborator-defined stages and current stage, when any:
Strongest blocking uncertainty:
Effort level: light | standard | high
Reason for level:
```

Choose the highest applicable effort level. File count alone does not determine risk.

### Escalate to standard when

- behavior spans more than one component or layer;
- requirements or current behavior are ambiguous;
- user-visible behavior, shared code, persistent state, or an external integration is involved;
- the task needs more than one evidence channel;
- a correction invalidated earlier work.

### Escalate to high when

- security, authorization, privacy, secrets, payments, destructive operations, migration, production, concurrency, irreversible external state, public interfaces, or unknown blast radius is involved;
- failure could materially expose data, deny access, corrupt state, or be difficult to reverse.

### Effect-bound authority

Classify only the effects the current work may produce:

```text
read-only discovery
temporary instrumentation
verification artifacts or fixtures
production source or configuration
local environment or operational state
external systems or publication
durable-record content
durable-record structure or lifecycle
```

These are portable semantic classes, not required project terms or separate approval prompts. Map them to current instructions and existing routine authority. If the collaborator defines stages, preserve those boundaries. Authority for one target, stage, or effect class does not authorize another; a newly required material effect returns readiness to `INCOMPLETE` or `BLOCKED` before execution.

## 2. Shared understanding

Before broad material investigation, show a provisional statement and seed the smallest observable scenarios that would distinguish fulfillment from failure:

```text
Requested outcome and observable behavior:
Scope and authority:
Strongest uncertainty that could change the work:
Seed scenario identities and provisional expectations:
```

This statement confirms direction, not readiness. When the request supports materially different product interpretations, state their practical consequences. Investigate repository, system, and tool facts directly. Ask the collaborator only for an unresolved intent, priority, risk, external fact, or authority decision that evidence cannot supply.

After the investigation, replace promises and hypotheses with an evidence-backed statement of:

- what the current sources establish;
- which interpretation and contract the evidence support;
- what remains assumed, bounded, or unresolved;
- why the proposed direction is defensible.

Refresh this statement and its scenario seeds after any material correction, scope change, or new conflicting evidence. Refinement is expected; premature certainty is not.

## 3. Contract card

For standard and high-risk work, create a compact working contract. Fill only applicable fields.

```text
Accepted input and normalization:
Observable output:
State and persistence:
Identity, permissions, and authority:
Lifecycle, timing, retries, and cancellation:
Side effects and downstream consumers:
Negative, empty, partial, repeated, and concurrent cases:
Strongest counterexample:
Observable equivalence or intentional difference, when applicable:
```

A field, helper, component, or endpoint can participate in several distinct contracts. Do not merge them merely because they share implementation.

## 4. Surface map

Trace only the paths that can change the contract or its verification:

```text
entry point
  -> validation and normalization
  -> identity and authorization
  -> state transition
  -> persistence
  -> side effects
  -> downstream consumers
  -> externally observable result
```

Also inspect applicable callers, shared consumers, configuration, tests, schemas, generated artifacts, and current documentation.

When semantic navigation is available, use it for symbol identity and candidate relationships. Corroborate broad coverage with text search and runtime behavior with execution or direct inspection. When semantic tools are unavailable, use the best accessible combination of text search, definitions, callers, tests, build configuration, and runtime evidence; report the coverage limit.

Do not promote a static or semantic relationship to an affected observable consumer merely because a reference is reported. Inspect the material candidate far enough to establish its role, reachability, contract, and path to the observable result. Keep rejected, unresolved, generated, test-only, type-only, configuration-only, and unreachable candidates distinguishable when they can change scope or verification.

Resolve applicable project and tool adapters before using their requirements or claiming coverage. Complete the tool preflight in `context-layers.md` for every required or preferred capability that can materially affect readiness.

Route each material tool call through the claim-driven record in `context-layers.md`. Tool suggestions and pagination are optional evidence operations. Continue only for a named material gap and stop when another call cannot change a decision.

## 5. Falsifiable investigation

For each material theory, record:

```text
Claim:
Known evidence:
Missing bridge:
Strongest counterexample:
Next check:
Result:
```

MUST search for disconfirming evidence, not only confirming examples.

Before designing new behavior or changing a material boundary, search for mechanisms that already handle the same observable event and compare materially plausible solution classes. Record:

```text
Candidate or solution class:
Contract dimensions compared:
Equivalent dimensions:
Material differences:
Decision: reuse | extend | separate | create | reject
Evidence and remaining gap:
```

Compare identity, authority, preconditions, state, lifecycle, side effects, errors, and consumers when applicable. Existing code is a hypothesis, not an automatic preference. A suggested helper, endpoint, exception, or layer is an implementation proposal unless an authoritative source makes that mechanism part of the requirement.

For security, authorization, privacy, or another High-risk boundary, keep two evidence records separate:

```text
Current mechanism and cause of the symptom:
Authorized product rule and source:
Allowed actors and states:
Denied actors and states:
Boundary preserved by the proposed change:
Negative or bypass scenarios:
Evidence and unresolved decisions:
```

Do not infer the authorized rule from the defect mechanism. Measure change size by contract and behavioral reach, not by files or lines.

Do not begin a material implementation while an uncertainty remains blocking and unbounded. An unresolved uncertainty is bounded only when:

- the user explicitly accepts the named assumption; or
- the selected fallback is declared before dependent work and is narrow, safe, and reversible.

Otherwise stop and request the smallest decision that can unblock the work.

Stop opening exploratory branches once the available evidence supports a decision and additional branches cannot reasonably change it.

When the material question is when a property changed or what role a prior change played, use [regression-localization.md](regression-localization.md). Do not equate the first revision where an oracle changes with the origin of the underlying condition without separate evidence.

### Please, Align Before You Choose

The agent may form and test hypotheses during read-only investigation. Before promoting one into a preferred material solution, designing solution-shaped verification artifacts, or beginning implementation, emit a visible decision-frontier checkpoint when any condition applies:

- the affected observable surface or contract remains materially disputable;
- more than one causal hypothesis or solution class remains viable;
- causal status is `unknown` or `candidate` and the proposed direction depends on it;
- alternatives have materially different observable, authority, lifecycle, persistence, security, risk, or maintenance consequences;
- product intent, priority, risk acceptance, scope, or authorization must come from the collaborator;
- the collaborator requested staged or joint decision-making.

When scenario alignment also applies, use the combined checkpoint below instead of presenting two user-facing artifacts. Otherwise use this compact direction artifact:

```text
Current observable contract and affected surface:
Material observations — basis, verification status, and source:
Active hypotheses — status and missing bridge:
Strongest counterevidence and refuted alternatives:
Material unknowns:
Viable solution classes and practical consequences:
Decision criteria and their authority:
Recommended next direction and evidence basis:
Collaborator decision required: yes | no
Exact decision requested, or delegated basis for proceeding:
Result: CONTINUE-INVESTIGATION | AWAITING-COLLABORATOR | DIRECTION-ALIGNED
```

This checkpoint is not automatically a hard stop.

- `CONTINUE-INVESTIGATION` permits safe read-only discovery and already authorized bounded instrumentation; it does not authorize solution-shaped artifacts or mutation.
- `AWAITING-COLLABORATOR` ends the turn only because a collaborator-owned decision is currently blocking.
- `DIRECTION-ALIGNED` requires current authoritative evidence plus previously explicit delegated criteria, or a current collaborator response that resolves the material choice. The agent's own preference cannot manufacture alignment.

Do not require the collaborator to certify a root cause prematurely. Preserve causal status as `unknown`, `candidate`, `verified-within-scope`, or `refuted`; align on what is known, what remains open, and which decision actually belongs to the collaborator.

### Please, Plan What Could Break

For every material behavior change, defect correction, or contract-sensitive refactor, read [verification.md](verification.md). Seed scenarios from the provisional observable contract before broad investigation, then refine them from inspected reachability and risk before solution-shaped verification artifacts or implementation.

The artifact MUST connect current intent and authority, the inspected system surface, and applicable risk or history to a bounded set of scenarios. Map every material contract dimension and affected consumer to a scenario or `excluded-with-reason` with authority and residual risk. Unknown blast radius that can change this mapping keeps the result at `CONTINUE-INVESTIGATION` or `AWAITING-COLLABORATOR` and readiness below `READY`.

For Standard and High defect or material behavior work, one current collaborator response addressing the checkpoint is required before `SCENARIO-ALIGNED` unless prior explicit scope-specific delegation already covers the material scenario decisions. A generic implementation request is neither that response nor that delegation. Light work MAY compress the artifact and proceed from evidence when its stricter conditions remain true.

When direction alignment is also required, combine both artifacts in one user-facing checkpoint and ask at most one focused question:

```text
Observable contract and affected surface:
In scope, non-goals, and behavior that must remain unchanged:
Material observations, basis, status, and strongest counterevidence:
Active hypotheses and missing bridges:
Material scenario groups, mappings, and explicit omissions:
Viable solution classes and practical consequences:
Tool or evidence limits and residual risk:
Recommended direction and evidence basis:
Exact collaborator decision or prior delegated basis:
Direction result: CONTINUE-INVESTIGATION | AWAITING-COLLABORATOR | DIRECTION-ALIGNED
Scenario result: CONTINUE-INVESTIGATION | AWAITING-COLLABORATOR | SCENARIO-ALIGNED
```

Keep the two domain results distinct in the ordered trace because either may be invalidated independently. This is one conversational frontier, not permission composition.

### Please, Trace What Must Match

Trigger this gate when the requested contract says or materially implies that two outputs, views, reports, interfaces, states, or actions should agree, correspond, reconcile, or lead to the same underlying set or property.

Before `READY`, record:

```text
Observable property:
Authority establishing whether the surfaces should agree:
Surface A — entry -> source -> transformations -> output -> interaction:
Surface B — entry -> source -> transformations -> output -> interaction:
Comparison dimensions:
  identity, scope, filters, permissions, lifecycle, timing,
  deletion, pagination, error behavior, and empty state
Equivalence: verified | refuted | unknown
Chosen source of truth and authority:
Causal hypothesis:
Evidence supporting the hypothesis:
Missing bridge to the observable contract:
Action permitted: investigate | instrument | implement | stop
```

Trace only applicable dimensions, but do not omit a dimension that could change the conclusion. A matching value, shared field, nearby helper, or plausible mechanism does not establish the bridge. `unknown` equivalence or a material missing bridge keeps readiness `INCOMPLETE` and permits only further tracing or bounded authorized instrumentation.

Use an intentional-difference negative control. If authoritative evidence establishes that the surfaces represent different contracts, set equivalence to `refuted`, reject forced parity, and either stop or redefine the requested contract through current authority. Do not convert a causal hypothesis into an implementation contract.

### Please, Follow the Value

Trigger this trace for intermittent, late, stale, duplicated, missing, or order-dependent observable behavior involving asynchronous work or a notification boundary. Inspect this delivery chain in order when applicable:

```text
trigger and normalized inputs
  -> request, operation, or task identity
  -> response, result, or error
  -> transformation and computed value
  -> state write or cache update
  -> notification, identity, subscription, or invalidation boundary
  -> derived consumer
  -> visible or terminal side-effect condition
  -> cleanup, cancellation, retry, stale-result, and duplicate-result behavior
```

For each stage, record `observed`, `not-applicable`, `blocked`, or `unknown` and preserve the evidence boundary. When a correct upstream value is observed while the downstream outcome remains stale or missing, investigate propagation, identity, subscription, invalidation, and terminal visibility before replacing the source mechanism. This ordering does not assume an interface framework, queue, cache, or delivery technology.

## 6. Baseline

Preserve a baseline when comparison matters. Depending on the task, this may be:

- an existing focused test result;
- observed runtime or interface behavior;
- an API or data response;
- an exact source state or version-control parent;
- a minimal characterization of current behavior.

If work starts from a dirty or partially implemented state, distinguish:

```text
clean or parent state
initial working state
final state
```

A dirty working state is not a clean baseline.

When historical attribution matters, establish comparable known earlier and later states rather than treating the current parent, oldest available revision, or first observed failure as an automatically valid boundary. Use [regression-localization.md](regression-localization.md) for oracle stability, history traversal, and bounded candidate sets.

### Activity and delivery state

For identified work, compare the resolved activity with the state that will receive, contain, or deliver the change. Depending on the project, evidence may include a branch or checkout, a workspace, a patch queue, a submitted change, a package, a deployment unit, an operational target, or another current delivery state.

Record:

```text
Activity identity:
Current source or delivery state:
Expected relationship:
Consistency result: aligned | mismatch-resolved | mismatch-accepted | blocked
Evidence and authority:
Residual risk or next action:
```

Do not require a version-control system or infer activity identity from a nearby name. A mismatch keeps readiness below `READY` until it is corrected or the collaborator explicitly accepts the exact mismatch and consequence. Recheck after a source-state, workspace, activity, or delivery-target change.

## 7. Scope ledger

Before editing, list the expected change categories rather than guessing exact files:

```text
Requested behavior:
Implementation surfaces:
Required tests or verification artifacts:
Scenario Coverage Contract, material mappings, and explicit omissions:
Regression-protection intent, or expected N/A or omission reason:
Required schema, generated, configuration, or documentation changes:
Authorized effect classes and stage boundaries:
Explicitly authorized cleanup:
Out of scope:
```

During implementation, every changed artifact MUST map to one ledger item. New evidence may expand the ledger only when the expansion is necessary and made explicit.

## 8. Change readiness

Show the Change Readiness Receipt from `SKILL.md` immediately before the first material implementation mutation. The receipt is observable process evidence; it is not hidden reasoning and does not need to become a durable file unless an active delegation and materiality require capture.

Before issuing it, reconcile the latest continuation result. `ALIGN`, `NEEDS-AUTHORITY`, `RECONCILE`, `ESCALATE`, or `BLOCKED` cannot be converted to `READY` by omitting that route from the receipt.

Decision rules:

- `READY`: every applicable field has an evidence-backed answer and no blocking uncertainty remains unbounded;
- `INCOMPLETE`: additional safe read-only work can resolve the missing evidence;
- `BLOCKED`: an exact unavailable evidence source, authority, fixture, environment, capability, or human decision prevents readiness.

Missing fields produce `INCOMPLETE`; they do not pass by implication. An instruction to implement does not waive the gate. A tool announcement, large search volume, plausible cause, small diff, or passing wiring test does not satisfy it.

For every material behavior change, defect correction, or contract-sensitive refactor, the receipt MUST include the intended regression-protection disposition and expected scope. It MUST also identify the strongest accessible authorized observable check and who can execute it. This is a plan, not a final result. If either decision or its controlling requirement remains unresolved, readiness is `INCOMPLETE` while safe discovery can resolve it and `BLOCKED` when the exact evidence, authority, mechanism, or scope decision is unavailable.

For the same triggered work, the receipt MUST include the current Scenario Coverage Contract result and its collaborator-response or delegated basis. `READY` requires `SCENARIO-ALIGNED` after the latest evidence-backed understanding. `CONTINUE-INVESTIGATION` and `AWAITING-COLLABORATOR` do not satisfy readiness. The scenario contract is a plan for coverage, not proof that any scenario passed or has repeatable protection.

For identified work, the receipt MUST include a current literal activity-transition result and activity/source or delivery-state consistency result. Only `loaded`, `created`, or a still-valid `no-record-with-valid-reason` can support `READY`; `planned-and-awaiting-approval` and `blocked` cannot. Only `aligned`, `mismatch-resolved`, or collaborator-authorized `mismatch-accepted` can support `READY`.

When a delegated record is active, the receipt MUST bind to the current activity-local basis revision and include the last completed material capture, any pending material event, any `capture-incomplete` state, and canonical-current-state consistency. A stale record, pending required capture, incomplete transaction, or basis-revision mismatch keeps readiness below `READY`.

The receipt MUST appear before the first material implementation mutation to source, configuration, product data, or operational/external state. Routine capture inside an already valid bounded durable-record delegation MAY occur during investigation; it neither requires a new receipt nor satisfies implementation readiness. Context-store structure, configuration, location, and lifecycle remain governed by their separate exact-plan approval protocol. If the host supports an ordered trace, record the receipt and first implementation-mutation event so their order can be checked.

Invalidate readiness when its material basis changes, including a correction, newly discovered consumer, state, contract dimension, scenario, scope or source-state change, failed required tool, refuted hypothesis, changed authority rule, or incomplete required capture. Increment the activity-local basis revision, invalidate affected scenario coverage and direction alignment plus dependent verification and protection evidence, and invalidate any pending continuation based on the prior revision. Name the affected receipt fields, return to `INCOMPLETE` or `BLOCKED`, refresh shared understanding, and issue a new receipt before continuing mutation.

When an observable-equivalence or asynchronous-delivery trigger applies, include its current result in the receipt. A comparative contract cannot reach `READY` with equivalence `unknown`, an incomplete material bridge, or forced parity after intentional non-equivalence was established. An asynchronous trace cannot reach `READY` while an applicable blocked or unknown stage could change the implementation direction.

When **Please, Align Before You Choose** triggers, `READY` requires a current `DIRECTION-ALIGNED` result after the latest evidence-backed understanding. `CONTINUE-INVESTIGATION` and `AWAITING-COLLABORATOR` do not satisfy readiness. A material invalidation, epistemic discontinuity, or explicit directional rejection invalidates the alignment result as well as readiness.

### Please, Stop and Reconcile

This hard stop protects continuity after a direction has been established or relied upon. Ordinary initial ambiguity is an investigation condition, not a reason to stop the conversation.

Trigger immediately when either condition applies:

1. **Epistemic discontinuity:** new evidence materially overturns, invalidates, or narrows a claim, source, baseline, verification result, observable surface, causal hypothesis, or decision criterion supporting the active direction or dependent work.
2. **Explicit directional rejection:** the collaborator makes clear that they reject the current interpretation, contract, affected surface, causal framing, recommendation, or conversational direction—not merely a minor detail or presentation preference.

A new source or verification-status change does not trigger the hard stop merely because its label changed. It must alter what the agent should believe, recommend, verify, or do next. Evidence that only adds detail, strengthens the same direction, or resolves an open question consistently is captured and may proceed normally.

Use one severity:

- `REALIGNMENT`: the active understanding or proposed direction lost its basis before dependent material artifacts or effects require recovery;
- `RECOVERY`: dependent plans, solution-shaped tests, code, configuration, environment, product data, external state, or verification evidence already exist and must be classified or invalidated.

A correction after dependent mutation or a second material correction in the same unresolved direction is always at least `RECOVERY`. Both severities invalidate readiness and freeze dependent investigation, solution selection, verification-artifact adaptation, implementation, environment mutation, and external-state mutation. Bounded read-only reconstruction may occur only to establish the receipt below. Routine capture inside an existing delegation remains allowed.

Emit:

```text
Severity: REALIGNMENT | RECOVERY
Trigger: epistemic discontinuity | explicit directional rejection
Prior material claim or direction:
Prior basis, verification status, source, and scope:
New evidence or collaborator rejection:
New basis, verification status, source, and scope:
Material change in belief, recommendation, verification, or next action:
Affected conclusions, plans, checks, artifacts, and next actions:
Artifact classification, when applicable:
  retain | experimental | invalid | collaborator-owned | unrelated | unknown
Canonical current understanding:
Safe options and evidence-backed recommendation:
One evidence-based question:
Result: AWAITING-DECISION | BLOCKED
```

The question must isolate the disputed contract, interpretation, authority, consequence, or choice without transferring discoverable technical work to the collaborator. State the evidence boundary and recommendation first, ask one focused question, end the turn, and wait. Do not argue with explicit rejection, silently substitute a new direction, or continue because the replacement seems obvious.

After the collaborator responds, update the canonical understanding and use **Please, Align Before You Choose** again. A resolved `REALIGNMENT` may reopen read-only investigation. A resolved `RECOVERY` additionally requires complete artifact classification and safe state reconstruction. Neither authorizes rollback, deletion, overwriting collaborator work, or mutation. Refresh the affected protocol artifacts, source binding, scope ledger, verification intent, and readiness receipt before another implementation mutation.

## 9. Implementation discipline

- Implement the smallest change supported by the contract and evidence.
- Interpret “smallest” as the narrowest contract and behavioral reach that satisfies the outcome, not merely the fewest lines or files.
- Preserve local conventions only when they satisfy the same contract.
- Prefer explicit invariants and narrow guards over broad fallbacks that hide invalid state.
- Do not hardcode unknown organization, locale, role, environment, provider, or external-state-transition semantics.
- Do not change tests merely to make the implementation pass. First classify the expectation as existing contract, characterization, regression protection, new contract, or obsolete behavior.
- Do not add or update a verification artifact merely to satisfy a disposition. It must be stable enough for its declared use, falsify the material contract at an appropriate boundary, and have bounded expected execution conditions.
- Make temporary instrumentation searchable, minimally scoped, safe for data, and paired with a cleanup condition.
- Keep every effect within its authorized class and current collaborator-defined stage; verification convenience does not authorize environment or operational changes.
- Remove rejected experiments and unrelated cleanup before completion.
- Recompute affected scope when the diff reveals new callers, consumers, lifecycles, or side effects.

## 10. Completion pass

1. When scenario coverage was triggered, reconcile its contract with the final inspected surface; account for every material dimension and consumer through a scenario or authorized omission.
2. Verify each material contract dimension through the necessary evidence lanes.
3. Resolve the observable-verification disposition as `executed`, `collaborative`, `reproducible-handoff`, `blocked`, or `not-applicable`; a handoff must include exact evidence-backed execution details, and it must not be reported as a passed runtime check.
4. Resolve the final regression-protection disposition when triggered and audit it against the implemented state, controlling requirements, expected execution conditions, and residual risk.
5. Keep independent challenge distinct from the author-derived scenario plan and capture any new material scenario it reveals.
6. Inspect the complete final change set, including relevant generated and new artifacts.
7. Confirm every change belongs to the scope ledger.
8. Resolve changed-artifact diagnostic coverage from `verification.md`, including unsupported artifacts, untrusted results, current errors, fallbacks, and lost coverage.
9. Re-check direct, negative, repeated, partial-failure, and concurrent cases when applicable.
10. Reconcile the canonical current state after a correction, implementation, verification disposition, recovery, handoff, or closure when an explicitly delegated durable record permits it; preserving history without updating status, conclusion, next action, basis revision, capture state, invalidated dependencies, and pointers is incomplete capture.
11. Update other durable context after material decisions or multi-session work when the delegated workflow permits it; otherwise propose the update. Structural or configuration changes still require the context-store operation protocol.
12. If the audit changes current truth, capture that correction before reporting.
13. Report completion only within the explicitly declared contract, inspected surface, evidence coverage, and residual limits. Include the result, checks, exact handoff when any, and residual risk without implying unperformed work.
