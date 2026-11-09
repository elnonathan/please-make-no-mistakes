# Impact analysis

Use this reference for Standard or High implementation work. The purpose is not to draw the largest graph. It is to keep a plausible local fix from hiding a material downstream contract.

The canonical `impact.md` places `Mode:` and `Reason:` before the first `##` heading. These are the literal transitive sections:

```text
# Impact
Mode: transitive
Reason: <reason>

## Roots
- root: <stable name> — <direct evidence or falsifiable contract>

## Ledger
| Node | Relationship | Evidence | Disposition | Follow-up |
|---|---|---|---|---|
| <stable node> | <relationship> | <evidence> | <disposition> | <follow-up> |

## Dynamic boundaries
- none: <reason no material dynamic edge participates>

## Non-functional dispositions
- security: <evidence and disposition>
- privacy: <evidence and disposition>
- performance: <evidence and disposition>
- compatibility: <evidence and disposition>
- maintainability: <evidence and disposition>
- observability: <evidence and disposition>

## Omission audit
- before-plan: <independent root derivation>
- final-fingerprint: <current verification fingerprint>
- final: <roots re-derived from the actual changed surface>
```

For local mode, use this shorter shape:

```text
# Impact
Mode: local
Reason: <bounded surface and direct evidence>

## Non-functional dispositions
- security: <evidence and disposition>
- privacy: <evidence and disposition>
- performance: <evidence and disposition>
- compatibility: <evidence and disposition>
- maintainability: <evidence and disposition>
- observability: <evidence and disposition>

## Omission audit
- before-plan: <independent root derivation>
- final-fingerprint: <current verification fingerprint>
- final: <roots re-derived from the actual changed surface>
```

Fill every field with evidence. Local mode must not contain `root:` lines, ledger rows, `boundary:` lines or `none:` lines. Omit those three transitive sections, or leave their headings empty. Transitive mode requires their material rows. The final fingerprint and final audit are completed after verification.

## Choose one mode

Write the choice in the task's canonical `impact.md`.

- `Mode: local` is enough when one directly inspected surface contains the behavior, no material value crosses a reconstruction or contract boundary, and no independent consumer can reinterpret it. Record the concrete reason. Do not create an empty graph to make a small change look rigorous.
- `Mode: transitive` applies when a material value, decision or state crosses producers, transformations, reconstructed objects, storage, transport, configuration, dynamic dispatch or several observable consumers. Follow reachable edges until each material node has a disposition.

Uncertain reach raises the mode to transitive. Tool availability never decides the mode.

## Derive roots before reading the plan

Start from the request, observed failure and current system behavior. Name each root as:

Place these lines under the literal `## Roots` heading in `impact.md`.

`- root: <stable name> — <direct evidence or falsifiable contract>`

Replace every `<...>` template marker with current evidence before the Digest. Do not derive the root list from `plan.md`. The plan is one proposed answer and cannot prove its own completeness. After implementation, derive the roots again from the actual changed surface and current evidence. Reconcile anything the final derivation adds, removes or contradicts.

## Ledger

Use one row per material node:

| Node | Relationship | Evidence | Disposition | Follow-up |
|---|---|---|---|---|
| `<stable node>` | `<producer, transformation, boundary, consumer or precedence edge>` | `<locator and basis>` | `<disposition>` | `<check, change or residual action>` |

Allowed dispositions are:

- `verified-unchanged`: direct evidence shows the existing contract remains true.
- `changed-and-covered`: the implementation changes this node and current evidence exercises it.
- `excluded-with-evidence`: evidence shows it is outside this task's contract.
- `dynamic-boundary-manually-checked`: static reach ended and a concrete runtime, configuration, data or human check covered the boundary.
- `unresolved-blocking`: the missing evidence can change the implementation, verification or release decision. The Digest is not ready.
- `unresolved-accepted-risk`: the human accepted a named residual risk in the current Digest. This is not proof that the edge is safe.

A text match, a semantic reference or a closed parent never advances a child. Each node holds its own evidence, and depth is where a completeness claim fails, so every level of it needs its own disposition. Every root has a ledger row. Each root name and material node appears once, with one unambiguous disposition. A search miss is not `verified-unchanged`. A nearby implementation, one-hop reference list or passing focused test does not close an untraced consumer.

## Dynamic boundaries

Static tools cannot settle every edge. Record each material dynamic boundary as one line:

`- boundary: <name> | check: <concrete check> | outcome: <observed result> | residual: <remaining risk or none with reason>`

When none participates, use exactly one `- none: <why the inspected path has no material dynamic edge>`. Use boundary lines or that one `none` reason, never both. Do not write bare `none`, `unknown` or `not applicable`.

Examples of evidence channels include source and configuration inspection, runtime observation, persisted data, interface behavior, history and human validation. These are patterns, not required tools. A semantic navigator can provide exact definitions, references, call edges and unresolved candidates when available. Its output is evidence, not scope approval or proof of complete runtime reachability. A code graph index shows reach across many hops, but it may miss symbols it could not resolve and files version control does not track yet, and it is only as current as its last refresh. Refresh it before relying on it, and confirm every unresolved, missing or untracked symbol with an exact-reference tool.

## Non-functional dispositions

Record every dimension, even when the result is preservation rather than change:

- `security`: authority, trust, validation and misuse boundaries.
- `privacy`: collection, exposure, retention and sensitive-data boundaries.
- `performance`: work, frequency, scale and resource behavior.
- `compatibility`: callers, stored data, protocols, versions and fallback behavior.
- `maintainability`: duplication, ownership, conventions and future change cost.
- `observability`: whether failure and correctness can be distinguished in operation.

A bare `N/A`, `none`, `unknown` or `unavailable` is not a disposition. State why the dimension does not apply or what evidence remains unavailable. The matrix is a prompt to look, not a claim that every risk was found.

## Omission audit

`impact.md` ends with:

- `before-plan`: how roots were derived independently before the plan.
- `final-fingerprint`: the current verification fingerprint after the final project change.
- `final`: how the actual changed surface was used to derive roots again, what the plan omitted and how that difference was resolved.

The final audit asks a different question from plan conformance: **what material path, contract or risk did the plan fail to mention?** Plan conformance and omission review are both required. Neither substitutes for the other.

At High effort, the non-author review also records `impact-roots`, `impact-omission-check` and `non-functional-dispositions`. The reviewer must challenge at least one root or omitted branch using evidence distinct from the author's main check.

When a review finds a material branch the audit missed, reopen the closure rather than patching the branch alone. Record which node or edge was absent and why the process allowed it, and update the reusable rule when the mechanism is general.

## Epistemic boundary

No hook validates `impact.md`. Check its shape, freshness, dispositions and binding to the current verification fingerprint yourself. No check proves that a model understood the bytes it read, that the graph is complete, that a reviewer is independent or that a disposition is true. Keep those limits explicit in the final claim.
