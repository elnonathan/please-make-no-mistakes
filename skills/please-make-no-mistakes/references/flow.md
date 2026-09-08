# The flow

Investigate, plan Digest, work, verify, audit, then hand over the Test Digest. Project mutations and material advisory deliverables enter through the plan Digest and reach human acceptance only after the agent's audit is current. A bounded verification-only path is described below.

## 1. Investigate

- Resolve the request: outcome, completion condition, constraints, what is ambiguous.
- Read the code that matters. Follow the path from entry point to effect; map who else consumes what you will change.
- Search for the existing pattern before asking the human. A rule you would ask for may already be in the code, the tests or the fixtures. Report what you found and where.
- Turn your explanation into a claim that can be false. Look for the strongest counterexample. A confirmed cause does not prove the fix you have in mind is permitted.
- Compare mechanisms by contract, not by proximity. A nearby helper needs the same preconditions, input, authority and failure behavior before you reuse it.
- Use the semantic tools the host offers (references, definitions, diagnostics) before text search. A tool's suggestion is evidence to check, not a step to take.
- For an observable or data-backed flow, trace the concrete bridge from stored state through transformation to the interface, response or other result. Inspect available interface automation, repository routes, fixtures and safe data-query capabilities before assuming the human must perform the test.
- For Standard and High implementation, choose local or transitive mode in `impact.md` before reading `plan.md`. Derive roots from the request and observed behavior. Local mode records why one bounded inspected surface is enough. Transitive mode follows material producers, transformations, reconstructed objects, contract or transport boundaries, observable consumers and variants, explicit value and fallback precedence, exclusions and evidence state. Use [impact analysis](impact-analysis.md); do not impose a graph on Light, state-only or unrelated work.
- Keep a baseline when you will compare before and after: a worktree or a temporary clone, never a reset of the human's working tree.
- Record coverage limits: what you did not read, what conflicted, what a tool could not do.
- When the human changes to another identified task, reconcile unfinished material work once before switching. After the switch, resolve requirements, evidence, counters and authority only against the new active task; never satisfy it with residue from the prior task.
- Stop when the next action is justified and more search would not change it in proportion to the risk.

## 2. Plan Digest

Before showing the Digest, write `plan.md`. Repository files use `- [ ] <path> — <what changes>` and preserved files use `- [ ] excluded: <path> — <why>`. Material external or system results use `- [ ] state: <stable-id> — <before> => <after>` and preserved state uses `- [ ] unchanged-state: <stable-id> — <invariant>`. A material advisory result uses `- [ ] deliverable: <stable-id> — <result>` paired with `- [ ] boundary: <same-id> — <strongest relevant alternative, exclusion or uncertainty and its disposition>`. Paths are files, not directories. A safe absolute path physically inside the repository canonicalizes to the same identity as its relative spelling; prefer the relative spelling. Objective ids are stable, lowercase and contain no spaces; state before and after must differ. A state already checked when its Digest is shown records completed history. Corroborate its present result, but do not invent or repeat the old operation. The combined list is the promise. Update the other task files with the current state, evidence, decisions, rejected paths and open questions. Write a human correction before a revised Digest. The Digest is not ready while the task folder lags behind it.

Before the Digest, `verification.md` must name the changed contract, the request case, a preserved case, entry surface, environment, actor, safe data, numbered steps, expected observations, available capability, evidence to retain and cleanup. Use `not-applicable` or `unavailable` only with a reason. Discover these from the repository and available tools; do not invent an account, URL, fixture or capability. When `impact.md` applies, its local rationale or transitive ledger, dynamic-boundary dispositions, non-functional matrix and before-plan omission check are part of the same agreement. `unresolved-blocking` prevents the Digest. `unresolved-accepted-risk` names what the human is agreeing to leave unresolved; it does not turn uncertainty into evidence.

List every predictable sensitive operation in `permissions.json`. Use `task` for authority that ends with this task. Use `project` only for an operation or bounded capability the human intends to reuse across tasks; including `project: []` explicitly revokes the previously active project set. Omit `project` to preserve it. A planned non-file transition is task scoped and names the matching `objective`. Its operation keeps a more specific effect such as `network` or `environment`; use `state-change` only when no supported effect describes the exact covered operation. The Codex adapter accepts at most 32 entries. Exact Bash operations are single-line and reviewable; a state operation may instead identify another covered host tool through its exact JSON input:

```json
{
  "schema": "pmnm.permissions/v1",
  "task": [
    {"effect": "state-change", "tool": "<host-tool>", "input": {"<field>": "<exact value>"}, "objective": "<stable-id>", "reason": "<why it is needed>"}
  ]
}
```

A reusable entry replaces tool and input with `capability`, `effect`, `boundary`, `persistence`, `shape`, `constraints` and `reason`. The id and descriptions are project vocabulary, not executable names supplied by PMNM. A task capability expires with the task. A project capability survives only for the same canonical project and is revoked by an explicit replacement. The agent still declares each exact operation and the guard still enforces observable contradictions. Matching a capability is not proof that arbitrary arguments satisfy its human-readable shape.

When a forecast includes a persistent local-environment operation, create `environment.md` before agreement. Resolve aliases, task runners, package scripts or other command indirection until the actual operation is understood. Record `configuration`, `indirection`, `resources`, `ownership`, `health`, `decision`, `conflict` and `cleanup`. The decision follows discover → check health → reuse healthy resources → start only what is missing. If a control plane and the observed process state disagree, record the environment as unknown and rediscover before another operation. These are behavioral fields, not a catalog of commands or one ecosystem's service model.

This file forecasts authority; it does not bypass native host approval or prove the state after the operation. Other hosts may bind the same human-visible list through their own adapter. Unsupported tools and operations that cannot be shown exactly stay outside the batch and ask when reached. A changed or unlisted state operation requires `redo`, a revised plan and a revised forecast; one-off authority cannot widen that contract. An unknown operation result preserves uncertainty but does not satisfy the required successful operation.

When another actor will execute a consequential operation, prepare a bounded execution package instead of treating prose as proof. Name the executor, observer, intended effect and boundary, exact scope, prerequisites, cost or load expectation, stop signal, evidence to return, cleanup and the environment or revision against which the instructions were derived. “Read-only” describes mutation, not cost: an expensive scan, query or inspection still needs a bounded scope and stop condition. Distinguish evidence available before execution, evidence only the executor can observe and evidence that can be checked afterward. Dates and freshness come from an observable clock, revision or source timestamp; otherwise record them as unknown. The package is provider-neutral and does not grant authority to its executor.

Preflight the complete `plan.md`, `verification.md`, applicable `impact.md`, `permissions.json` and any required `environment.md` before asking for agreement. Collect every defect first and report each source, line, violated rule and concrete correction together. Under the Codex guard, `digest` writes the full result to guard-owned `preflight.md`; fix that one report before retrying. Safe canonicalization may change representation without changing the contract. Never treat a normalization as permission to move an external helper, reinterpret prose as a state objective or grant an operation.

The Digest's Change field is `plan.md` read aloud: the same paths, the same reasons, plus one line, `Existing mechanism compared: <name> — reused | not reused because <reason>`. Its Impact field states the mode, roots, unresolved boundaries and accepted residual risks without reproducing the whole ledger.

Show it in this shape, then ask. End your turn.

```
Digest — <task id>
Understanding: <what was asked, in your words>
Current state: <what the code does now; the files that matter>
Change: <what you will do, in order>
Impact: <local rationale, or transitive roots, boundaries and unresolved dispositions>
Verification: <how you will check it; for each material branch, the wrong path and the observation that would expose it>
Permissions: <all exact sensitive operations, grouped by task or project scope, or "none">
Ambiguities: <what is unclear or contradictory, or "none">
Trade-offs: <what is given up, or "none">
Do you agree?
```

Light effort: one line per field, the request case, one preserved case and the minimum direct evidence. Standard adds the strongest alternative or counterexample and the adjacent affected surface. High adds policy basis, containment, a non-author evidence channel and an independently derived impact challenge.

When the human agrees as shown, continue. When they change anything, show a revised Digest; do not merge the change silently. When they ask a question, answer it in one or two sentences and ask again.

The checkbox is progress, not evidence. Reordering lines, checking boxes or replacing a safe absolute repository path with its canonical relative spelling does not change the agreement. Changing a target, reason, state contract, verification contract or permission does. Update `plan.md`, show the revised Digest and use `pmnm-guard redo` before continuing.

For a question that needs the human's decision during investigation, use this shape:

```
What I need from you: <one decision, with my recommendation>
What I can continue without you: <the work that does not depend on it>
```

## 3. Work inside the plan

- Stay inside `plan.md`. A path that is absent or excluded stops the write. A state transition uses only an exact operation bound to that objective. Under a guard, use `pmnm-guard redo` first; then add or revise the file or state contract and show a new Digest.
- Produce an advisory deliverable only inside its paired boundary. If the human or evidence materially reframes the deliverable, record the new framing immediately. Independent read-only investigation may continue, but no material effect or final delivery may rely on the changed framing until a revised Digest is agreed.
- Smallest change the evidence supports. Remove probes and experiments before you finish.
- Keep a ledger of every changed artifact and why it belongs to the task.
- A planned file target is complete only when its final state differs materially from the recorded baseline. A changing state objective needs an observed successful bound operation plus current evidence for the agreed before and after contract. Neither an attempted operation nor a model-authored claim proves the external result.
- When new evidence refutes the Digest, stop, record it, investigate, show a new Digest.

## 4. Verify

The plan Digest is the agreement before implementation. Final verification establishes the evidence the agent will audit; it does not itself trigger the human Test Digest.

The first two checks are always the request's own case and the thing that must not change. Every passed verification, including verification-only work, needs current `example:` and `unchanged:` claims. A state plan also needs one exact `state: <id> — <before> => <after>` or `unchanged-state: <id> — <invariant>` claim per objective. An advisory plan needs `deliverable: <id> — <observed result>` and `boundary: <id> — <observed disposition>` for each pair. After a material change or reframe, write the applicable claims in `verification.md` after it, obtain evidence against that state, then run the rest. A claim written before the effect it verifies is stale, and its text is not proof. Human verification is current only after the human reports it in a later turn. When the human owns that check, no passing command substitutes for it. A syntax, metadata, documentation or exploratory check may remain valuable evidence, but do not record it as final passed verification while planned objectives are open.

Run the check that tests the changed contract, not the check that is convenient. Say what it proves and what it does not. Distinguish product failure from environment failure. Keep before and after comparable when you compare. If a supposed check changes the project, it is implementation evidence, not current verification: withdraw the prior Digest, record the new state and return to investigation.

## 5. Audit before the human commits

1. Reconstruct the full changed surface: versioned changes, unversioned additions and generated artifacts. Use the repository's version-control vocabulary only when that provider is present.
2. Confirm every file change belongs to the task, its verification or authorized cleanup. Confirm planned file targets still differ from baseline and every state objective has a successful bound operation plus current evidence. Name anything else before recommending a commit command.
3. Re-read the exact evidence for every conclusion. Try to refute your own completion claim.
4. Check negative paths, repeated execution, shared consumers, permissions, persistence, concurrency when relevant.
5. State regression protection: existing, added, not applicable, or omitted with the reason.

Bind the audit to its fingerprint. With version control, name the provider's base, current source state, relevant change classes and time. Without it, name the recorded baseline, current file identities, changed and added artifacts, time and the absence of provider evidence. Under a guard the card prints its observed fingerprint. Re-derive impact roots from the actual final surface rather than `plan.md`; ask what material path, contract or risk the plan omitted, reconcile the difference and bind the final omission note in `impact.md` to the same fingerprint. Any change after the audit invalidates the findings it touched; rerun the smallest affected audit. Report: blocking findings, fixed during audit, residual risk, ready for commit yes or no. You do not commit.

Name what the audit could compare: version control, planned paths against their recorded baseline, or no project files. Report state evidence separately. A state-only task says that no project-file comparison occurred; it does not invent a file or version-control fingerprint. Without version control, say so; do not describe a comparison that did not happen.

## 6. Independent review

At High effort, or when the human asks, a reviewer who did not write the change reads the current contract, `plan.md`, `impact.md`, `verification.md` and changed surface, then runs or performs at least one check the author did not use. `review.md` records `contract`, `plan-digest`, `fingerprint`, `changed-surface`, `evidence`, `strongest-counterexample`, `independent-check`, `disagreement` and `residual-limit`. When impact analysis applies, it also records `impact-roots`, `impact-omission-check` and `non-functional-dispositions`. The reviewer derives a root or omitted branch independently rather than confirming the plan's list. The plan hash and verification fingerprint bind the packet to the state reviewed. The counterexample must be concrete, and the independent check cannot merely repeat the author's evidence. Use `disagreement: none` only when no unresolved contradiction remains; otherwise reconcile with the human or close as partial or blocked. The reviewer may be a human or another model. The guard checks shape, identity, freshness and an explicitly unresolved disagreement. It cannot prove reviewer independence, interpret arbitrary test semantics or turn the packet into truth or command authority.

If no non-author reviewer is available, perform an adversarial self-review that tries one concrete counterexample not used during implementation. Label the result partial, record the missing independent channel and never present it as equivalent evidence or a completeness proof.

## 7. Test Digest handoff

After current verification, the required review and the agent's final audit, show the Test Digest and stop for the human. It belongs at the final acceptance boundary, normally immediately before a commit, submit or close. Do not emit it after an intermediate check or while implementation, review or audit remains. It must be actionable without reconstructing the investigation:

```
Test — <task id>
Where: <URL, screen, command or endpoint>
Environment: <runtime and required setup>
As: <user, role, account or caller characteristics>
Data: <safe fixture or record and its provenance>
Steps: 1. … 2. … 3. …
Expect: <what should be seen at each step>
Evidence: <what to retain>
Cleanup: <what must be restored, or why none is needed>
Can run: <yes with the available capability | no with the exact limitation>
```

Investigate executable interface capabilities before declaring `Can run: no`. When no tool can run it, say exactly what remains human-owned and that it has not run. Never describe a run you did not do. Under the Codex guard, the first `done` after a current audit requests this handoff. The Test Digest must then appear in the assistant's current message and receive a later human response before `done` can close; the guard checks its shape and freshness, never its truth.

## Verification-only path

An exact read or project-declared check requested by the human may run without a plan Digest when it cannot mutate anything outside the PMNM folder. Record current `example:` and `unchanged:` claims, the literal result, exact scope and limitation, then audit it. If the check or task writes the project, return to the full plan Digest flow before relying on that state.

## A chain of small fixes

When one task keeps producing small follow-up fixes, stop and ask whether they share a contract boundary. Patch chains hide a wrong contract.
