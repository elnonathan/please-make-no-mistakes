# Changelog

All notable user-visible changes are recorded here.

## 0.1.0 - Unreleased

First public release candidate. Epistemic integrity for software engineering with AI: one portable Agent Skill, one PMNM folder, one flow, rules born from an always or a never, and an optional lifecycle guard for Codex and Claude Code.

Orders and rule layers

- The skill is written as orders: each block states its intent, the end state to leave and at most five numbered orders with stable ids, such as `IN-2`. PMNM sets the phases and stops; the agent chooses how to carry out each order.
- Rules come in layers: PMNM orders, the human's general rules, project rules, task rules and the current instruction. A higher layer extends, narrows or replaces a lower rule by its id. Rules carry `G-`, `P-` or `T-` ids, are never renumbered, record their basis (the human's literal words or `agent-worded`) and move to a `Retired` section instead of disappearing.
- Human authority comes only from the human's own recorded words. Relayed agent text, summaries, repeated notes and one-round permissions do not become decisions or rules; `decisions.md` keeps who chose each decision and every autonomy grant with its scope and end.
- When no one else can review, the author runs a labelled author audit and reports `ready for commit` with `(author audit)`.
- New orders: names only from a listing or a read; proof that a new test can fail; results marked as own run, own reading or reported and tied to the exact tree; no weakened tests; databases discovered and accessed read-only first; nothing of the working method in publishable artifacts; a minimal decision tree that runs one scenario through every option.
- The Codex hook configuration moved to `hooks/codex/hooks.json` with identical content and is declared in `.codex-plugin/plugin.json`. The package no longer carries a conventional `hooks/hooks.json`, so the Claude Code plugin root in the package carries only the Claude adapter's hook configuration. The Claude adapter also runs when its plugin directory is a symbolic link, including under `--preserve-symlinks-main`.
- The guard reference now matches the engine: the exact approval token applies to `allow`, a project read before `start` is blocked on its first attempt, and each host reaches one shared engine through its own adapter.

The folder

- One PMNM folder per machine, chosen by the human once; the host keeps only a pointer to it.
- One project folder per repository, named by the human once; reusable project knowledge stays separate from human-owned rules; one task folder per unit of work with `index.md`, `plan.md`, `verification.md` and `permissions.json`, plus `impact.md` for Standard and High work and `expectations.md` and `review.md` for High work.
- Task-folder writes need no per-file approval. When the Codex guard is active, covered paths that escape the folder, symbolic links, machine-index writes and detected secret-shaped content are refused.
- Four questions only: where the folder goes, the project name, whether a candidate folder is this task, and the level of a new rule.
- Optional `provenance.md` keeps material attribution as separate evidence-bearing relationships, without treating proximity or participation as responsibility.
- Optional `artifacts.md` records reference-first custody, content identity, privacy limits, recovery and retention for external evidence; exact retained copies may live under `artifacts/`.
- Optional `operation.md` separates executor, observer, cost, stop conditions and evidence context when consequential work is delegated.

The flow

- Investigate, write `plan.md` and show the plan Digest, then stop until the human answers.
- Implement only inside the agreed plan; a write outside it is refused before it runs.
- Plan material non-file state with explicit before and after values, bind its exact task operation, and keep resulting-state evidence separate from operation success.
- Plan material advisory work as a deliverable paired with its strongest relevant boundary; a reframe leaves independent reads available but requires renewed agreement before dependent effects or final delivery.
- Require an actionable verification plan before Standard or High implementation; verify with claims the human can read, complete the agent audit and any required review, then hand over a complete Test Digest at the final human acceptance boundary.
- Persistent local-environment operations require one current preflight covering command indirection, resources, ownership, health, conflicts, reuse or start-only-missing and cleanup.
- Trace a material value across producers, transformations, boundaries, consumers, variants and precedence only when that lifecycle can change the solution or its evidence.
- Standard and High implementation now records either a concise local impact rationale or a transitive ledger in `impact.md`; unresolved nodes, untouched placeholders, duplicate identities and contradictory boundary declarations block the plan Digest, while Light and state-only work avoid an empty graph ceremony.
- Final audit derives impact roots again from the actual changed surface, challenges omissions separately from plan conformance and records dynamic and non-functional dispositions against the current verification fingerprint.
- Agreeing to the implementation plan alone is not a yes to commit, push, tag or publish. An exact operation in the permission forecast may receive authority with that agreement; otherwise each needs its own yes at the time or a human-owned rule, and native host controls still apply.

Rules

- A decision stays with its task; a rule is one sentence born from an always or a never, with its origin, at the project or general level.
- A newer rule that contradicts an older one replaces it.
- A standalone approved rule write may end without an artificial implementation Digest; rule writes inside broader work do not waive its normal gates.
- Audit-time curation promotes only corroborated reusable knowledge, records task-local dispositions, reloads canonical files before writing and checks concurrency, overlap, contradiction, audience and overfitting.

Guards

- Twelve receipts; two-line cards in English or Spanish with one literal `NEXT:` action; three levels: Blocked, Ask, Note.
- Predictable exact sensitive operations may be approved together with task or project scope; changed and unlisted operations still ask, and one-off authority remains exact and single-use.
- Ordinary commands now use one structured effect-declaration path rather than positive executable catalogs. Declarations name effect, boundary, persistence, certainty and capability, but never grant their own authority or override mechanical hard stops.
- A plain same-turn declaration or already agreed capability may classify exactly the next otherwise-unknown operation before a deliberate first denial. Unused intent is spent by that operation or expires at the existing boundaries; once applied, its exact classification remains independent from human authority until that same operation is admitted. Changed input cannot borrow either classification or authority, and native host review remains controlling.
- Non-persistent verification cards now report a project mutation only when the observed workspace delta shows one, rather than inferring it from task phase.
- Non-persistent verification follows the read path and becomes a project mutation only when its observed result changes the project.
- Human-approved task or project capabilities can cover bounded recurring operation families without tying PMNM to a runtime, language or provider; task capability expires with the task and an explicit project replacement revokes reusable authority.
- The verification plan and permission forecast remain bound after agreement; changing either requires `redo` before implementation or forecast use continues.
- A missing project mapping records the name only after the human supplies it; the guard cannot answer its own question.
- Project, contained PMNM and external-only targets take distinct authority paths; external-only work does not invent a repository plan.
- Compound commands with an unknown segment or several sensitive effects are split before authority is requested.
- Passed closure requires current `example:` and `unchanged:` claims plus current passed verification; no-op and restored writes do not satisfy a plan.
- High-effort passed closure requires a current semantic review packet bound to the plan and verification fingerprint, with a concrete counterexample, distinct independent check, impact challenge, disagreement and residual limit. Its seed names every required field, and only a literal `none` resolves disagreement; the guard rejects stale or unresolved packets without treating the reviewer as truth.
- Revised plans preserve the direct-comparison baseline for earlier paths while adding newly planned paths.
- Existing unindexed project folders are preserved instead of being silently adopted by a new repository mapping.
- Compound commands cannot hide an ordinary external write beside another sensitive effect.
- Guard state separates session-local flow, canonical project authority and canonical task authority. Concurrent sessions may work on different tasks; a fresh session inherits none, and same-task revision drift blocks stale material work.
- Restarting the same task cannot discard an in-flight host result; it remains pending until reconciled before task runtime is reloaded.
- Startup, resume, clear and compact lifecycle discontinuities require reloading general, project and active-task context before material work; changed applicable rules invalidate the prior basis.
- Lifecycle reload names only existing canonical files, includes project knowledge and applicable `impact.md`, and correlates successful returned bytes by host operation identity; a path mention is not evidence of a read, and a read is not proof of comprehension.
- Earlier receipt names are accepted for one compatibility release.
- Complete streamed content identity prevents a byte-identical rewrite of a large planned file from appearing as a material change.
- Related suffix tasks with the same bounded work id are reconciled instead of silently fragmenting one activity.
- After current verification, required review and final audit, Codex Stop requires one actionable Test Digest in the latest assistant message and a later human response before closure.
- Test Digest validation now requires its exact task title plus contiguous, ordered, non-empty fields in English or Spanish, and the rejection card exposes that grammar.
- If Codex omits the final Stop event, the next prompt can recover only the latest shaped Test Digest from a bounded, unlinked, host-provided transcript tail; unsupported evidence fails closed and is never retained.
- Pending host results now outrank new declarations, blocked audits remain open without arming acceptance, and task cards distinguish observed paths, internal work counters and current verification without inventing file or verification claims.
- Certain non-persistent verification remains on the read path across a mixed boundary; persistence, uncertainty and mechanical or sensitive effects still fail closed.
- A receipt that reaches the shell switches explicitly to portable advisory behavior instead of triggering PATH searches or retries.
- State-only and mixed plans close against their own objectives without invented file targets or version-control evidence; unlisted state operations require a revised Digest.
- Digest preflight now reports all plan, verification, permission and required operational-environment defects together in guard-owned `preflight.md`, including safe path canonicalizations.
- Safe absolute repository paths and their relative spellings share one contract identity; representation-only normalization does not withdraw unchanged agreement.
- A state objective already complete at Digest time keeps its historical operation while still requiring current evidence.
- Switching away from unfinished work asks once and isolates the successor from the prior task's agreement, counters and task permissions.
- Literal container exec commands are classified by their visible inner operation; opaque inner commands remain unknown.
- Investigation and administrative checks cannot activate final passed verification while planned file objectives remain open.
- Sensitive-operation cards print an operation-bound approval token. Only an exact later human reply arms the single-use `allow` receipt for those command bytes.
- Task start records `work=implementation`, `work=advisory` or `work=verification`. Advisory plans reject file and changing state objectives before agreement.
- Native project reads still route to `start` before execution. Opaque operations declare their boundary first, and only a declared project read then routes to `start`.
- The Codex adapter is split into a bounded state-machine entrypoint and an independently reviewable shell classifier, with an exact packaged module graph and aggregate size budget.

Package

- Exact-version npm artifact and repository marketplace, with no runtime dependency and no lifecycle script; package installation is not host activation.
- Claude Code marketplace `.claude-plugin/marketplace.json` pinning the same npm version as the Codex marketplace, with its SETUP route, update, rollback and removal steps and the pointer `<CLAUDE_CONFIG_DIR>/pmnm.path`. The marketplace is validated but not packaged.
- MIT license for original project materials and a separately disclosed AI-generated mascot.
