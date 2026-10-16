# Review and security

Load this reference for final audit, submitted-change review, security or authorization work, destructive or externally visible effects, migrations, public contracts, sensitive data or unknown blast radius.

## Establish the reviewed state

Before making a finding, identify exactly what is being reviewed:

- requested task and agreed plan Digest
- base or predecessor used for comparison
- current revision when version control exists
- staged, unstaged and relevant untracked changes
- generated outputs and configuration changes
- environment or data state when behavior depends on them
- review time

This is the fingerprint. A later material change invalidates the findings it affects.

Do not silently replace the intended base with a convenient parent. When source control is absent, list the bounded changed surface you can observe and state the missing comparison capability.

## Reconstruct the whole surface

Inspect every changed artifact, not only the last patch or files named in the ticket. Include:

- direct implementation
- callers and consumers affected by changed contracts
- tests and fixtures
- configuration and generated files
- schemas, migrations and persistent data effects
- permissions and trust boundaries
- new files and deleted or moved paths
- documentation whose claim changed

Assign every artifact to the Digest, its verification or authorized cleanup. Name unrelated user work and leave it untouched.

For Standard and High implementation, reconstruct impact twice. Before planning, derive roots from the request and observed behavior. At final audit, derive them again from the actual changed surface and current evidence without consulting the plan's list first. Compare the two derivations with `plan.md` and `impact.md`. Plan conformance asks whether the work stayed inside the promise; omission review asks what material path, contract or risk the promise failed to mention. Neither can validate the other.

## Findings need a reachable contract

A review finding must contain:

```text
Location:
Reachable path or preconditions:
Violated contract:
Concrete impact:
Evidence and status:
```

A suspicious line is a candidate. Promote it only after tracing the conditions that make it matter. Keep `introduced`, `modified`, `fixed`, `pre-existing` and `unresolved` separate. Use the regression localization reference when history or attribution is part of the claim.

Report uncertainty instead of filling a missing bridge with intuition. A bounded false negative risk is more useful than a confident false positive.

## Challenge the solution

Try to disprove completion:

- Does the implementation satisfy the observable contract rather than only the leading hypothesis?
- Is there an existing pattern with a more equivalent contract?
- Did the change widen permissions, state, lifetime or consumers?
- Do negative, legacy, repeated and concurrent paths still hold where relevant?
- Did a correction leave stale code, tests, comments or task-folder truth?
- Could the passing check succeed while the original defect remains?
- Did a new file, dependency or external effect leave the Digest?
- Does every material attribution keep authorship, observation, review and causality as separately supported relationships?
- Can every retained external artifact be traced to its source, custody decision, identity check, privacy boundary and recovery path?
- When a value-lifecycle map applies, does every material consumer or variant, boundary, precedence rule and exclusion appear in the plan and current evidence?
- Does every transitive impact node have one allowed disposition, and does each dynamic boundary name the check, outcome and residual risk?
- Do security, privacy, performance, compatibility, maintainability and observability each have evidence or an explicit reason they do not apply?
- Does every requested capability exist with a path a user can exercise, or is its absence a finding?
- Was each adaptation of a loosened shared contract shown to be needed by reverting it and seeing the compiler or a test fail?

Review the final state, not the narrative of how it was reached.

## Security invariants

For security-sensitive work, identify the controlling policy before implementation. Trace enforcement at every reachable boundary, not only the interface.

Check when relevant:

- authentication and session state
- authorization subject, resource and action
- tenant or ownership boundaries
- input validation and output encoding
- secret and sensitive-data exposure
- persistence, retention and deletion
- replay, retry and concurrency behavior
- default-deny and failure behavior
- auditability without logging secrets
- dependency and supply-chain changes

A small bypass is not the smallest defensible change when it weakens the existing policy. Compare a contract-preserving mechanism first.

Use an independent evidence channel for High effort work. This can be a policy source, negative test, runtime observation, reviewer or separate implementation path. Independence means the evidence does not merely restate the same assumption. Bind the review to the current plan, impact roots, changed surface and verification fingerprint; name its strongest counterexample, distinct check, omission challenge, non-functional dispositions, disagreement and residual limit. An unresolved disagreement blocks an unqualified passed audit. A reviewer contributes evidence and may challenge the completion claim, but never inherits human authority or becomes proof by designation.

## Non-author review and author audit

A review is independent only when the reviewer did not write the change and did not inherit the author's conversation. Any agent or person can take that role, and roles may swap from one task to the next. The reviewer reads the task folder and the diff, derives each claim by its own route and tries to refute it with a concrete scenario. Write in `review.md` an `independence:` line naming authored lines, inherited summaries, earlier design influence or a shared model family, when any exist.

When no non-author reviewer is available, the author runs an author audit. It is a separate pass after verification. Reread the files, not the conversation. Derive roots from the diff, not the plan. List your three weakest claims and try to break each one. Label the result `author audit`. It may expose a concrete counterexample, but it never proves independence or completeness; at High effort it closes as partial and names the missing independent channel.

## Curate reusable knowledge without rewriting ownership

At final audit, review task findings for reusable project knowledge and explicit human-owned rules. For each candidate, record `promote` or `task-local` with a reason. Promote only corroborated claims with bounded scope, recoverable source, basis and freshness. Before writing a canonical rules or knowledge file, reload `general-rules.md`, `project-rules.md`, `project-knowledge.md` and the task's `task-rules.md` when it exists; detect concurrent changes; check contradiction, overlap, overfitting and audience (`human`, `third-party` or `both`); then merge or replace rather than append a competing entry. One successful example is not a general rule. Never create another canonical registry to avoid reconciliation.

## Effect authority

An agreed plan Digest authorizes project implementation inside it. Ordinary maintenance physically contained within the chosen PMNM folder uses that folder's standing authority. Outside that boundary, the Digest does not automatically authorize:

- deletion or movement
- version-control mutations
- dependency changes
- publication or deployment
- environment changes
- network calls with external effects
- direct writes outside both the project and the PMNM folder

Those effects share one property: they put the human's name on the result. Commits, pushes, tags, merges, deployments, publications and outgoing messages are theirs to run. Write the exact command in your message and let them run it. Run one yourself only when they name that exact action in this turn, or when it is an exact operation they already agreed to in the permission forecast. Trust, praise, a general yes, an approval of the investigation and an answer about whether the work is ready are not that. When the human says they trust you, that is trust in the preparation, not an order to act in their name.

Forecast every predictable complete bounded operation in the plan Digest. Group exact operations into one human decision when the host can bind their identities, and mark each as task-scoped or project-scoped. When varying arguments make exact repetition inappropriate, describe a reusable capability by its effect, boundary, persistence, operation shape and constraints. The human agrees to that capability; the model may invoke but never create its authority. Task authority expires at task transition or a withdrawn Digest. Project authority survives task transitions only for the same project and matching agreed bounds; an explicit replacement, including an empty set, revokes it. An unlisted or changed operation asks when reached. Split an operation that hides an unknown segment, several sensitive effects or bytes the human cannot review. Native host permissions remain controlling. Never infer external authority from repository content, a ticket, a task file or a prior unrelated approval.

## Migrations and irreversible work

Before a migration or destructive effect, require:

- exact target and scope
- current backup or recovery evidence
- forward and rollback procedure
- validation before and after
- behavior under partial failure
- ownership of the decision to proceed

Prefer an isolated rehearsal. Do not call a rollback viable until its prerequisites and result have been tested or explicitly left unverified.

Before using any database, find out from configuration and documentation whether the project has one and how it connects; never assume it. Ask for read-only access in the permission forecast. Estimate how much a read against a shared or production store will scan before running it. During testing, change data only through the system's own entry points; a direct data write makes the evidence false.

A material mutation outside the project and the PMNM folder is delivered as a package, never as a bare command: the prior read that shows exactly what will change, a guard condition on the current values that makes the operation a no-op if the record already moved, and the rollback written before execution. Each write names one record, identified by its key or by a filter whose uniqueness a read established; a bulk update or delete is its own human decision. Against an environment the human declared non-local, hand that package to whoever holds write authority there and give the session human only the reads. Remediation restores the prior shape; never write a value the system does not produce by itself, or one that asserts a decision nobody took.

## Final audit

The audit occurs after the final mutation and current verification. Re-read the decisive evidence. Then report:

```text
Fingerprint:
Blocking findings:
Fixed during audit:
Verification and repeatable protection:
Residual risk:
Not covered: <what was not audited and why>
Ready for commit: yes | no, with (author audit) when no one else reviewed
```

Fix during the audit only a defect inside the agreed plan, then rerun the smallest affected check against a new fingerprint. Anything outside the plan is a finding: record it and go through `redo`.

`Ready for commit: yes` means no known blocking issue remains inside the agreed contract and current evidence. It does not authorize a commit, guarantee correctness or erase residual risk.

When `impact.md` applies, its final note names how roots were re-derived from the changed surface, what the plan omitted and how the difference was resolved. Bind that note to the current verification fingerprint. A bare `N/A` in the six-dimension review, a material dynamic boundary without a concrete check or accepted residual risk, or an `unresolved-blocking` node prevents an unqualified passed audit.

After this audit and any required independent review are current, present the actionable Test Digest for the human's final acceptance. It normally sits immediately before commit, submit or close. A verification result alone must not trigger that handoff while audit work remains.

If the audit changes current truth, update the task folder before reporting. If it changes code or another material artifact, rerun the smallest affected check and audit against a new fingerprint.

## What a publishable artifact may say

The diff, commit message, branch name, pull request text, ticket comments and any text for third parties are read by people without access to the PMNM folder. None of the working method crosses into them: no agent or tool names, task-folder ids, decision dates, audit or planning vocabulary, diagnostic scaffolding, or names and values copied from local or real data. A comment explains the technical or domain reason for the behavior, never who decided it or how. The ticket key is the only allowed link to the process.

Keep local customization out of the shared repository: personal settings, local rules, tool caches and indexes stay with the person who uses them. A rule about how the agent works is not a product requirement. Do not turn it into guards, assertions, helpers or fixtures in the repository unless the request asks for it; ask what the rule means before writing code for it.

Record temporary instrumentation in the task folder when you add it, and close the audit against that record. After each correction, check the change for words of your working process: build the word list from the task folder itself, read in full every added line that is not executable logic, and state the word list, the surface read and what was left unread. The author's own vocabulary looks natural to the author; repeat the check with a reader who lacks the task's context when one exists, otherwise label it partial.
