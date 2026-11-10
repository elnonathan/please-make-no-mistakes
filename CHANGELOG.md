# Changelog

All notable user-visible changes are recorded here.

## 0.1.0 - Unreleased

First public release candidate. Epistemic integrity for software engineering with AI: one portable Agent Skill, one PMNM folder, one flow, rules born from an always or a never, and an optional destructive-operation brake for Codex and Claude Code.

Orders and rule layers

- The skill is written as orders: each block states its intent, the end state to leave and at most five numbered orders with stable ids, such as `IN-2`. PMNM sets the phases and stops; the agent chooses how to carry out each order.
- `SKILL.md` is a short core that survives compaction. It opens with a reading map naming the reference to read before each step, keeps every order that can fall due before a reference is read, and stays under 12,000 characters of body. Other orders moved to their references word for word with their ids. After compaction the agent rereads the core from the directory the host loaded it from, then only the reference its next step needs.
- Rules come in layers: PMNM orders, the human's general rules, project rules, task rules and the current instruction. A higher layer extends, narrows or replaces a lower rule by its id. Rules carry `G-`, `P-` or `T-` ids, are never renumbered, record their basis (the human's literal words or `agent-worded`) and move to a `Retired` section instead of disappearing.
- Human authority comes only from the human's own recorded words. Relayed agent text, summaries, repeated notes and one-round permissions do not become decisions or rules; `decisions.md` keeps who chose each decision and every autonomy grant with its scope and end.
- When no one else can review, the author runs a labelled author audit and reports `ready for commit` with `(author audit)`.
- New orders: names only from a listing or a read; proof that a new test can fail; results marked as own run, own reading or reported and tied to the exact tree; no weakened tests; databases discovered and accessed read-only first; nothing of the working method in publishable artifacts; a minimal decision tree that runs one scenario through every option.
- The Codex hook configuration lives in `hooks/codex/hooks.json` and is declared in `.codex-plugin/plugin.json`; the Claude Code one lives in `hooks/claude/hooks.json`. The package carries no conventional `hooks/hooks.json`, so each host loads only its own registration.

The folder

- One PMNM folder per machine, chosen by the human once; the host keeps only a pointer to it.
- One project folder per repository, named by the human once; reusable project knowledge stays separate from human-owned rules; one task folder per unit of work with `index.md`, `plan.md`, `verification.md` and `permissions.json`, plus `impact.md` for Standard and High work and `expectations.md` and `review.md` for High work.
- Task-folder writes need no per-file approval.
- Four questions only: where the folder goes, the project name, whether a candidate folder is this task, and the level of a new rule.
- Optional `provenance.md` keeps material attribution as separate evidence-bearing relationships, without treating proximity or participation as responsibility.
- Optional `artifacts.md` records reference-first custody, content identity, privacy limits, recovery and retention for external evidence; exact retained copies may live under `artifacts/`.
- Optional `operation.md` separates executor, observer, cost, stop conditions and evidence context when consequential work is delegated.

The flow

- Investigate, write `plan.md` and show the plan Digest, then stop until the human answers.
- Implement only inside the agreed plan.
- Plan material non-file state with explicit before and after values, bind its exact task operation, and keep resulting-state evidence separate from operation success.
- Plan material advisory work as a deliverable paired with its strongest relevant boundary; a reframe leaves independent reads available but requires renewed agreement before dependent effects or final delivery.
- Require an actionable verification plan before Standard or High implementation; verify with claims the human can read, complete the agent audit and any required review, then hand over a complete Test Digest at the final human acceptance boundary.
- Persistent local-environment operations require one current preflight covering command indirection, resources, ownership, health, conflicts, reuse or start-only-missing and cleanup.
- Trace a material value across producers, transformations, boundaries, consumers, variants and precedence only when that lifecycle can change the solution or its evidence.
- Standard and High implementation now records either a concise local impact rationale or a transitive ledger in `impact.md`; unresolved nodes, untouched placeholders, duplicate identities and contradictory boundary declarations block the plan Digest, while Light and state-only work avoid an empty graph ceremony.
- Final audit derives impact roots again from the actual changed surface, challenges omissions separately from plan conformance and records dynamic and non-functional dispositions against the current verification fingerprint.
- Agreeing to the implementation plan alone is not a yes to commit, push, tag or publish. An exact operation in the permission forecast may receive authority with that agreement; otherwise each needs its own yes at the time or a human-owned rule, and native host controls still apply. The brake does not read the forecast. It still stops each covered destructive or sensitive operation for the human's exact token or, in Claude Code, the host's own prompt.

Rules

- A decision stays with its task; a rule is one sentence born from an always or a never, with its origin, at the project or general level.
- A newer rule that contradicts an older one replaces it.
- A standalone approved rule write may end without an artificial implementation Digest; rule writes inside broader work do not waive its normal gates.
- Audit-time curation promotes only corroborated reusable knowledge, records task-local dispositions, reloads canonical files before writing and checks concurrency, overlap, contradiction, audience and overfitting.

Destructive-operation brake

- Both plugins register one dependency-free Node.js hook, on tool calls and on the human's prompts. It classifies each covered operation as safe, sensitive or destructive.
- Deterministic rules recognize deletions, overwrites, history rewrites, service stops and restarts, publication, datastore drops and deletions, plugin changes, reads of credential files and commands that print secrets, such as environment dumps, keychain reads and token printers, including when they are hidden in wrappers, substitutions, heredocs or local scripts.
- The brake reads a shell command through bash's whole quoting layer: backslashes, single, double, `$'…'` and `$"…"` quotes, and line continuations. It does not resolve expansions: a variable, a command substitution or brace expansion inside a path, an alias or a function.
- Anything that runs other code is classified by what it runs: local and sourced scripts by content, package scripts by their manifest entry, make targets by their recipes, `find -exec`, `trap` and `awk` by the command they carry, and a literal container exec by its visible inner operation. Test runners stay ordinary project work.
- MCP tools are placed by name. Every tool of semantic-js-mcp, by the same authors, is known and safe, except a tool named for destruction. It is matched by the exact server names the hosts give it; a name is all the hook sees, so a server registered under one of those names would get the same trust. Any other MCP server runs without the judge only after the human sends the exact prompt `PMNM-ALLOW-MCP <server>`, which the agent cannot send; the entry is sealed, `PMNM-REVOKE-MCP <server>` removes it, and a tool named for destruction still stops.
- Approval tokens are `PMNM-` and four random characters without look-alikes, such as `PMNM-7K2Q`, printed alone on the card's last line so they can be copied whole, accepted in any letter case and with surrounding spaces, bound to one operation and session, and spent by their use. An open token lasts 60 minutes; the human's reply turns it into a grant that the next run of the same operation spends within 10 minutes. A reply that matches no open token says it expired, was used or belongs to another session. Approvals are re-read under a lock before each write, so concurrent sessions do not erase each other's tokens, and an open token or grant is never evicted: past 8 open tokens in a session, or 128 across sessions, the operation stops with no token and says so, and past 128 unused grants the reply is not applied and says to send it again after one is used or expires. When another session holds the lock, the operation stops with no token and says to retry, and a reply says to send it again. An event without a session id cannot be approved in-band.
- An operation that reaches the brake's own state is blocked on both hosts with no token, before any grant is spent, so only the human can run it: by any spelling of its path, by a glob that can match it, or through a hardlink or symlink to one of its files.
- What the rules cannot place goes to the judge model the human confirmed with the prompt `PMNM-CONFIRM-JUDGE <host> <model>`, through the host's own command-line client with plugins and hooks off. Its answer carries a safety and a confidence.
- A `PMNM_JUDGE_MODEL` set in the human's own environment pins the judge for that environment. A command that sets it, or the judge's recursion guard `PMNM_JUDGE_ACTIVE`, is destructive.
- The brake never picks the judge model. As soon as no judge is confirmed the agent proposes, before continuing its task, the cheapest model the host can run, from each provider's current published documentation with its URLs and never from local caches; when PMNM cannot list a host's models, it asks the human which ones they can use. The human confirms the proposal or names another model with that prompt, and the brake keeps the confirmation sealed. For Codex the brake checks the model against Codex's catalog and asks for a re-evaluation when the offer changes. For Claude Code, which keeps no catalog, the confirmation alone names the judge. `models.json` holds the agent's proposal and grants nothing. Without a confirmed model, or when it stops answering, what the rules cannot place needs approval; no other model is tried in its place.
- Only a safe verdict with high confidence runs without asking. Every other operation stops until the human replies with the exact operation-bound `PMNM-<code>` token; in Claude Code a deterministic sensitive operation uses the host's own permission prompt.
- `commands.json` keeps model and human verdicts by a hash of the exact operation, with a seal made with a key kept in the host's plugin data; it never stores the command or any free text from the judge, which answers only with a safety and a confidence. An unsealed or copied entry grants nothing. A stored safe verdict runs without the model; a stored sensitive or destructive one asks directly. Deterministic rules always win over stored verdicts, and an edited script invalidates its verdict.
- A failed or unavailable classification asks; an error inside the brake blocks.
- On the first prompt of each session the brake adds one line asking the agent to load the PMNM skill before reading the project: with the Skill tool in Claude Code, from its `SKILL.md` in Codex. In Claude Code, when the agent has not loaded it with the Skill tool, the first tool call that can touch the project is stopped once, with no token, and the stop says how to load the skill. The human's prompt `PMNM-SKIP` turns the stop off for one session. Codex is not stopped. Sessions are remembered only as hashes.
- Edits inside the PMNM folder are ordinary editing, like edits inside the working directory. A folder that holds the home directory or overlaps the host configuration, the brake's data or its code frees nothing, and secret files, configuration files and deletions there still stop. Every edit is judged by the real path where it lands, a patch's move destination included, so a symlink cannot lead it out of the working directory or the folder or onto a secret or configuration file. Secret and configuration names match in any letter case, and paths are compared in the letter case stored on disk.

Retired procedural interlock

The interlock below is no longer registered by either plugin. Its source stays in the package for rollback, and [architecture decisions](docs/architecture-decisions.md) records why each part was retired, what may get worse and how to restore it.

- Twelve receipts; two-line cards in English or Spanish with one literal `NEXT:` action; three levels: Blocked, Ask, Note.
- The output of a `pmnm-guard` run in a shell was never a guard card.
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
- The guard reference matches the engine: the exact approval token applies to `allow`, a project read before `start` is blocked on its first attempt, and each host reaches one shared engine through its own adapter. The Claude adapter also runs when its plugin directory is a symbolic link, including under `--preserve-symlinks-main`.

Package

- Exact-version npm artifact and repository marketplace, with no runtime dependency and no lifecycle script; package installation is not host activation.
- Claude Code marketplace `.claude-plugin/marketplace.json` pinning the same npm version as the Codex marketplace, with its SETUP route, update, rollback and removal steps and the pointer `<CLAUDE_CONFIG_DIR>/pmnm.path`. The marketplace is validated but not packaged.
- MIT license for original project materials and a separately disclosed AI-generated mascot.
