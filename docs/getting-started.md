# Getting Started

Please, Make No Mistakes is designed to activate for non-trivial software work without requiring a ceremonial prompt. Explicit invocation is useful when you want to make the contract unmistakable.

## First Request

A direct request can be short:

```text
$please-make-no-mistakes investigate this regression and implement the smallest defensible fix
```

An indirect request should work as well:

```text
This behavior changed recently. Find out what is actually happening, confirm the affected paths with me, and fix it without widening the scope.
```

The agent should not answer either request with a long recital of rules. It should make the next meaningful state observable: authority, current understanding, missing evidence, activity-record state when applicable, and the smallest question or investigation step that advances the work.

PMNM uses a compact central router internally. You should see the consequence, not a verbose router transcript: safe investigation continues, a human decision is requested only when it belongs to you, an authorization boundary is explicit, and a material capability limit is escalated with a resume point.

## When The Codex Guard Is Active

The Codex package includes a procedural lifecycle guard. After you inspect and trust it through `/hooks`, the agent receives short transitions headed by the relevant `Please, ...` capability and covered local write attempts can be denied until the current route, alignment, readiness, and effect authority have been declared. Internal control receipts stay internal; the user should see one calm next action rather than codes or a second conversation to manage. The bundled adapter currently selects English or Spanish on a bounded best-effort basis and falls back when language is unclear.

The hook should reduce skipped gates, not create duplicate approval prompts. One collaborator checkpoint may align direction, scenario coverage, and an outcome-complete activity-record plan while preserving each authority scope independently. After a response, the agent must classify it as accepted, changed, unclear, or rejected; the existence of another user turn is not agreement. After approved structure is created and the activity transition is recorded, the guard carries the applicable decision forward instead of asking for it again. Approval of authority alone is not silently promoted into agreement with a direction or scenario set.

The guard is intentionally partial. A trusted hook receipt proves only the procedural event and covered state transition it represents. It does not prove that the evidence is correct, that the system was fully understood, or that every mutation path was intercepted. If the hook is absent, disabled, untrusted, unsupported, or cannot run, PMNM continues as a portable advisory skill and the lost enforcement coverage should remain visible.

## Shared Understanding

For material behavior work, expect the agent to distinguish:

- what you reported from what it observed;
- the observable contract from a possible cause;
- confirmed scope from inferred blast radius;
- requirements from implementation suggestions;
- current understanding from hypotheses already refuted.

When materially different directions remain, the agent should expose the decision frontier before promoting one into a solution. Standard- and High-risk behavior changes also require current human alignment on scenario coverage unless a prior, scope-specific delegation already covers those decisions.

This is collaboration, not a request for the human to rediscover facts available from the codebase or tools. The agent investigates those facts and asks only questions whose answers can change product meaning, authority, scope, risk, or the next material decision.

## Before A Material Change

The visible readiness result is one of:

- `READY`: the current contract, investigation, required checkpoints, scenario coverage, authority, and planned effects support implementation;
- `INCOMPLETE`: a required bridge or decision is missing and the agent remains in investigation;
- `BLOCKED`: progress requires unavailable evidence, authority, environment, or collaborator input.

An instruction to implement does not erase this gate. If later evidence changes the basis of the direction, affected readiness and verification become stale.

The guard also refuses to use another route or exemption as a reset for active work, to lower effort silently inside one activity lifecycle, or to close while a covered result is still in flight. It permits only one covered write to await a result. A missing result must be reconciled as unknown or failed-with-no-effect before another covered write, and a contradictory late result reopens Recovery. An unresolved Recovery receives one bounded continuation before the host permits an incomplete stop, so the interlock remains visible without creating a loop.

With the trusted Codex guard, Standard and High work cannot create a usable first-write token in the same turn that first presents its collaborator checkpoint unless an earlier explicit scope-specific delegation already supplies that decision. A later collaborator response plus explicit reconciliation is the observable boundary. Light work remains proportional.

## When Direction Breaks

Ordinary uncertainty does not require a stop. A real turn boundary is required when:

- new evidence materially removes the basis for the active direction; or
- the collaborator explicitly rejects that direction.

The agent should show the prior basis, the new evidence or rejection, affected artifacts, one canonical current understanding, and one evidence-based question. It then waits. `REALIGNMENT` applies before dependent artifacts exist; `RECOVERY` applies after plans, tests, code, or effects already depend on the displaced basis.

## Verification

Expect verification claims to say:

- what was executed or inspected;
- the literal result;
- which contract or scenario it can falsify;
- what it does not prove;
- any environmental failure, skipped scenario, or residual risk.

A unit test is not automatically the right evidence, and manual evidence is not automatically sufficient. The selected guard should observe the material contract, fail for a real recurrence, fit the repository, and remain proportional to risk.

For a material runtime or user-visible contract, expect the agent to attempt the strongest accessible authorized check. Every later implementation mutation makes earlier verification stale. If an account, device, environment, or human judgment keeps execution with you, the result should identify the exact entry surface or URL when known, starting state, data, actions, expected observations, evidence to retain, cleanup, and limits. `reproducible-handoff` means the procedure is usable; it does not mean the behavior passed.

## Durable Activities

When work has an identifier or is likely to outlive the current exchange, PMNM resolves the activity record before material investigation and compares it with the current source or delivery state. It may load an existing delegated record, plan a missing record and wait for exact approval, establish a complete reason not to create one, or remain blocked.

After a bounded delegation exists, material findings, corrections, decisions, evidence, verification, pauses, and handoffs are captured automatically. Creating another activity or changing record structure, location, visibility, lifecycle, or publication still requires fresh authority.

When the Codex guard is active, a delegated record cannot become current merely because the agent writes `capture=current`. The guard requires a successful covered durable-content update under the current collaborator prompt and basis before readiness, and another after the latest implementation mutation before closure. A later prompt makes the prior capture stale, including a write that was still in flight. This is evidence that a classified write occurred, not proof that the record's claims are true or complete.

If you choose a new context location, the plan should establish a recoverable activity, its locator or registry connection, update delegation, privacy boundary, and retrieval check in the smallest useful transaction. An empty folder alone is not successful onboarding.

For a new file-backed Standard activity, expect stable index, understanding, timeline, and verification responsibilities. Optional records and evidence appear only when a demonstrated consumer needs them. Existing viable layouts are mapped rather than renamed for aesthetics.

## When Current Capacity Is Not Enough

If the current model or connected tools cannot responsibly reconcile material evidence, the correct result is not a polished guess. Expect the agent to preserve the unresolved claim, evidence already gathered, lost coverage, safe stopping point, recommended model, tool, or human contribution, and where the work should resume. A later model can continue from that handoff without pretending the earlier gap never existed.

## Requests That Should Stay Light

These normally should not activate the complete workflow:

```text
What does this error message mean?
```

```text
Rewrite this paragraph for clarity.
```

```text
Where is the configuration file documented?
```

A factual question can become non-trivial when the user asks for investigation, a code change, security judgment, regression attribution, or a claim that depends on the current repository.

## Reading Evaluation Evidence

Source validators can prove that the packaged references resolve, declared event ordering is internally consistent, covered invalid traces are rejected, and the host guard follows its deterministic fixtures. Artifact checks can prove exact packaged and installed bytes. Neither proves that a particular model followed the skill, that Codex trusted or invoked the hook, or that uncovered effects were prevented in a real conversation.

Behavioral confidence requires a fresh host session using the exact candidate, representative positive and negative prompts, recorded outcomes, and comparison across relevant model or host configurations. See [the evaluation guide](../evals/README.md) and [distribution boundaries](distribution.md).
