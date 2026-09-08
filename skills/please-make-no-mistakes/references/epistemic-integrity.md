# Epistemic integrity

Load this reference when a material claim, conflict, correction, negative search or causal explanation affects the plan Digest, implementation, verification or completion claim.

## Three separate questions

For every material statement, keep these independent:

1. **Who or what says it?** Human, ticket, code, test, runtime, external source, model or task file.
2. **What is its basis?** Reported, observed, derived from code, inferred, assumed or unknown.
3. **What is its current status?** Unchecked, corroborated, verified, contradicted, refuted, invalidated or blocked.

Do not compress those into “true” merely because the statement is plausible or repeated.

## Evidence strength

Prefer the evidence closest to the contract being decided:

- runtime observation for current runtime behavior
- an executable check for a repeatable behavioral claim
- the reachable code path for an implementation mechanism
- an authoritative specification for intended policy
- history for when an observable property changed
- human confirmation for product intent or risk acceptance

One lane does not replace another. Code can show a mechanism without proving that users reach it. A screenshot can show one outcome without proving why it occurred. A ticket can state intent without proving current implementation. A passing test proves only the scenario and environment it exercised.

Record enough provenance to recover the source: file and symbol, command and result, interface surface, revision, external link or human turn. Do not copy unnecessary private content into the PMNM folder.

## Provenance and attribution links

When a decision, review or handoff materially depends on who or what produced, changed, exposed, detected, reviewed, approved or fixed something, create `provenance.md` in the task folder and link it from `index.md`. Treat each material provenance relationship as its own claim.

Authorship, operation, observation, discovery, review, approval and causality are independent relationships. Proving one does not establish another. A person or role who may provide context is a lead, not evidence and not responsibility.

Use a decomposable shape rather than a biography or a combined attribution:

```text
Claim:
Origin:
Relationship:
Target:
Evidence and locator:
Basis: reported | observed | derived | inferred | assumed | unknown
Status: unchecked | corroborated | verified | contradicted | refuted | invalidated | blocked
Time or revision:
Missing discriminator:
```

Keep historical role separate from basis and status. `introduced`, `exposed`, `amplified`, `detected`, `fixed`, `pre-existing` and `unresolved` answer different historical questions; they do not replace the claim's evidence state. “Plausible” means an inferred relationship whose status is still unchecked or corroborated, not a terminal classification.

Do not infer responsibility from a nearby revision, task ownership, record creation, review participation, temporal proximity or the first report. Record a recoverable source and the bridge that supports each relationship. When the bridge is missing, leave that relationship unresolved and state what would distinguish it. Provenance is context for a defensible decision, not an accusation.

## Claims from code

Structural navigation identifies candidates. Establish the missing bridge before claiming behavior:

```text
entry -> preconditions -> transformation -> effect -> consumer -> observable result
```

A definition does not prove a caller is reachable. A reference does not prove it runs in the relevant mode. A type does not prove persisted data conforms. A shared helper does not prove two consumers have equivalent contracts.

When a material bridge remains unobserved, label the conclusion inferred and state what would verify it.

## Search misses and absence

An empty search result means only that the query found nothing inside its literal scope. Before promoting absence, record:

- roots and file types searched
- textual, semantic, generated or runtime surfaces included
- aliases, indirection and configuration considered
- truncation, ignored paths and tool failures
- the strongest plausible place the missing item could still exist

Use `absent within searched scope`, not `does not exist`, unless the search space is complete for that claim.

## Conflicting evidence

When sources disagree:

1. preserve both statements and their provenance
2. identify whether they concern intent, current behavior, history or environment
3. check freshness and authority
4. find a discriminating observation
5. ask the human only when evidence cannot decide the product choice

Do not average conflicting sources or select the one nearest the proposed fix.

## Hypotheses

Write a hypothesis so it can fail:

```text
If <cause> explains <observable failure>, then <discriminating observation> should occur under <conditions>.
```

Search for the strongest counterexample before the hypothesis becomes the plan. A mechanism that can produce the symptom is not yet the mechanism that did.

Keep these claims separate:

- the defect exists
- a mechanism can cause it
- that mechanism caused this occurrence
- the proposed change removes the cause
- the change preserves adjacent contracts

Do not attribute ownership, introduction or causality while a decisive bridge is still pending. If an available compiler mode, runtime trace, historical comparison or A/B check could distinguish “introduced”, “exposed”, “amplified” and “pre-existing”, run it or keep attribution unresolved. Proximity in time, authorship of a nearby change and the first report of a defect are different facts.

## Corrections and discontinuity

A correction is material when it changes scope, direction, security, data, verification, a shared consumer, the next action or the completion claim.

When it occurs:

1. state the earlier claim and its former basis
2. state the new evidence
3. mark the earlier claim contradicted, refuted or invalidated
4. update current truth and history in the task folder
5. identify decisions, code and checks that depended on it
6. preserve, revise or discard each dependent artifact explicitly
7. withdraw the plan Digest when its change or verification no longer holds

This is an epistemic discontinuity when the next justified action is no longer continuous with the active plan. Stop dependent mutation. Do not treat a later success as retroactive support for the old reasoning.

## Continuity provenance

Conversation history is input visible to the current run. It is not proof that the PMNM task folder was found, read or remains current. After a fresh session or compaction:

- resolve the pointer and current project
- read the task index and the detail required for the next step
- compare material source state with what the task folder describes
- state any stale or missing evidence before relying on it

The filesystem is evidence. Memory is a navigation hint.

## Stop conditions

Stop and expose the gap when:

- two material explanations remain live and lead to different changes
- the strongest evidence channel required by project rules is unavailable with no sufficient fallback
- a security or data claim rests only on inference
- a correction invalidates the agreed Digest
- verification cannot distinguish the requested behavior from the known defect
- current model or context capacity cannot reconcile material evidence responsibly

Ask the smallest question the human can answer. When the gap is technical and discoverable, continue investigating instead.

## Reusable project knowledge

Promoting a task finding changes where it can be found, not how certain it is. Preserve each claim's basis, scope, source and freshness boundary in `project-knowledge.md`. Split a sentence when one clause is observed and another inferred. A human statement that something affects every task widens scope; it does not make the mechanism verified or turn the statement into an always-or-never rule.
