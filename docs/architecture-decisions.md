# Architecture Decisions

## One portable skill, optional host enforcement

PMNM is an Agent Skill first. Its folder and working contract remain useful when no lifecycle hook or MCP service exists. The package includes a destructive-operation brake for Codex and Claude Code because both hosts let a hook stop a tool call before it runs. The brake is optional and partial.

An MCP service is not required. It would add transport, process, permission and compatibility boundaries without proving semantic correctness. External tools may strengthen an evidence channel without becoming dependencies of PMNM.

## A destructive-operation brake replaces the procedural interlock

The earlier guard enforced the flow itself: receipts for each phase, an effect declaration before every unknown command, plan-scoped writes, lifecycle gates and a shaped closing message. In recorded sessions more than a third of agent steps were declarations, approval tokens were lost when a forced step intervened, complete reads went uncredited, and the friction pushed models to work around the guard instead of with it. The flow stays in the skill; the hook now guards only what cannot be undone.

The brake has two layers. Deterministic rules place known shapes: deletions, overwrites, history rewrites, service stops and restarts, publication, datastore drops, plugin changes and credential reads, including inside wrappers, substitutions and heredocs. Anything that runs other code is classified by what it runs: local and sourced scripts by content, package scripts by their manifest entry, make targets by their recipes, and `find -exec`, `trap` and `awk` by the command they carry. Code that starts other programs goes to the judge. Test runners stay ordinary project work, because running the project's own tests is part of editing it. MCP tools are placed by name. Every tool of semantic-js-mcp, by the same authors, is known and safe, except a tool named for destruction. It is matched by the exact server names the hosts give it; a name is all the hook sees, so a server registered under one of those names would get the same trust. Any other MCP server runs without the judge only after the human sends the exact prompt `PMNM-ALLOW-MCP <server>`, which the agent cannot send; the entry is sealed, `PMNM-REVOKE-MCP <server>` removes it, and a tool named for destruction still stops. What they cannot place goes to a judge model through the host's own client, with plugins and hooks off. The model answers with a safety (safe, sensitive, destructive) and a confidence (high, medium, low).

Only a safe verdict with high confidence runs without asking. Every other operation stops until the human replies with the exact operation-bound token, or, for a deterministic sensitive operation in Claude Code, answers the host's own permission prompt. A failed classification asks; an error inside the brake blocks.

The PMNM folder keeps two brake files at its root. `models.json` holds one current agent proposal per host under `hosts.<host>`, using the official provider model ID, prices and sources; a new proposal replaces only that host's previous one. It grants nothing, because the agent writes that folder freely. Neither host's catalog states a model's size or price, and the catalog order is a menu order, not a size order, so the brake never picks the judge. As soon as no judge is confirmed, the agent proposes, before continuing its task, the cheapest model the host can run, from each provider's current published documentation with its URLs, never from local caches: the lowest sum of input and output price per million tokens, and the newest on a tie. A sum is simple to check and needs no estimate of how much the judge reads and writes. When PMNM cannot list a host's models, the agent shows the human what it found locally and asks which models they can use; the human may also name the model directly. The brake does not keep its own price table, because fixed prices go stale; the human confirms the judge with the prompt `PMNM-CONFIRM-JUDGE <host> <model>`, which the agent cannot send, and the brake keeps that confirmation sealed in its plugin data. For Codex, which keeps a model catalog for this purpose, the brake also records the models offered at that moment, uses the confirmed model while the catalog still offers it and asks for a re-evaluation once when the offer changes. Claude Code once kept an undocumented model cache that the brake read; an update removed it, and that broke every Claude judge. The brake now depends on no internal host file for Claude: the human's confirmation alone names the judge. On either host, when the model is gone or does not answer, the brake asks the human instead of trying another model. `commands.json` records model and human verdicts by a hash of the exact operation: tool, input with spacing collapsed only outside quotes and heredoc bodies, working directory, and the content of every local file its classification reads. A stored safe verdict runs without the model; a stored sensitive or destructive verdict asks directly. Deterministic rules always win over stored verdicts, an edited script, manifest or Makefile invalidates its verdict, and no command is stored.

The PMNM folder is the agent's to write, so nothing there may grant authority by itself. Each catalog entry and each grant carries a seal made with a secret key kept in the host's plugin data; an unsealed entry, or a sealed one moved to another operation, grants nothing. An operation that reaches the brake's own state is denied before any grant is spent and gets no token, because whatever reads the key can forge every approval; only the human can run it. Approval tokens are four random characters, bound to one operation and one session, and spent by their use. They are issued and spent only under the approvals lock; when another session holds it, nothing is written and the operation is retried. An event without a session id cannot be approved in-band. The judge answers only with a safety and a confidence; no free text from it is stored or shown, because no redaction is guaranteed to recognize every secret. Reasons from the deterministic rules, which repeat the agent's own command, are redacted before they are shown. Measured on recorded sessions, at most 8% of unique commands reach the judge, and folding dates and numbers out of the key would save about 1% of those calls, so the key stays exact.

Sections below that describe guard receipts, cards, gates or guard-owned state describe the retired interlock. Its source stays in the package, unregistered, with its own test suites, so it can be restored.

## Retirement cards

Each card names one retired element: what it did, why it was retired, what may get worse and how that shows, how to detect it, and what to fix before restoring it. The elements share one engine and one state, so they come back together: follow [Restoring the interlock](#restoring-the-interlock).

### Phase receipts

- **Did:** `start`, `digest`, `agreed`, `verified`, `done` and the other receipts moved the task through its phases; a missing receipt blocked the next one.
- **Why retired:** each phase cost extra tool calls, and a receipt that reached a shell without the hook produced confusion instead of evidence.
- **May get worse:** a model skips the plan Digest or the final audit. Symptom: project edits before any Digest, or a close without verification claims.
- **Detect:** task folders without `plan.md` filled before the first project write; replies that end work with no audit.
- **Restore:** the receipts are unchanged in the engine's source; the skill must teach them again (step 4 of the restoration).

### Effect declarations

- **Did:** before an unknown command, the model declared effect, boundary, persistence, certainty and capability.
- **Why retired:** declarations were the largest share of agent steps, gave no authority, and parallel calls lost them, which produced needless approval requests.
- **May get worse:** an unknown command with a side effect runs unremarked when the brake's rules and model both rate it safe. Symptom: an unexpected change that the brake let through.
- **Detect:** an unexpected change right after an operation the model rated safe; `stats.json` in the brake's data counts how many operations the model rated safe.
- **Restore:** fix first: a declaration must survive a parallel call.

### Plan-scoped writes

- **Did:** blocked a project write to a file not listed in `plan.md`, and a state operation not bound to a plan objective.
- **Why retired:** the block depended on receipts and declarations; it misfired on renamed or generated paths and on revised plans.
- **May get worse:** scope creep. Symptom: changed files that the plan never named.
- **Detect:** compare the changed files with `plan.md` at audit, as the skill orders.
- **Restore:** fix first: revised plans must keep earlier targets and generated paths.

### Lifecycle gates

- **Did:** session start, resume, compaction and the closing step required reloading the rules and task files, and closing required a shaped Test Digest and a later human answer; tool results were tracked after each call.
- **Why retired:** the reload check did not credit complete reads, the forced closing step dropped pending approval tokens, and each gate added calls to every turn.
- **May get worse:** after compaction a model works from stale memory, or closes without the final handoff. Symptom: decisions that contradict the task folder; no final report.
- **Detect:** a reply after compaction that does not cite the task files; a task with no closing record.
- **Restore:** fix first: credit complete reads, keep pending tokens across the closing step, and resolve a working directory below the repository root to the same project instead of treating it as a new unmapped repository.

### Guard-owned task state

- **Did:** kept session flow, task authority and project authority as bounded hashes under the host's plugin data directory, and wrote the PMNM machine index.
- **Why retired:** without receipts there is nothing for that state to record; the agent writes `index.json` as the skill describes.
- **May get worse:** two sessions on the same task overwrite each other's task files. Symptom: lost task-folder edits.
- **Detect:** task files whose content goes backwards between sessions.
- **Restore:** its state layout is unchanged; nothing to fix first.

### PMNM folder containment

- **Did:** refused covered writes that escaped the PMNM folder through paths or symbolic links, and detected secret-shaped content written there.
- **Why retired:** it was part of the engine and relied on declarations for shell writes.
- **May get worse:** a secret is written into the PMNM folder. Symptom: a credential-shaped value in a task file.
- **Detect:** scan the PMNM folder for credential-shaped values.
- **Restore:** with the whole interlock, or alone by adding the same check to the brake as a deterministic rule.

### Compound command splitting

- **Did:** the interlock required the model to split a compound command that mixed an unknown segment with a sensitive effect before it would classify it.
- **Why retired:** the brake classifies every segment of a compound command and takes the most severe result, so the brake needs no split. The skill's order SE-3 still asks for the split in the permission forecast, so each sensitive effect receives its own approval.
- **May get worse:** nothing expected. Symptom if wrong: a compound command whose worst segment was missed.
- **Detect:** the brake's tests for wrappers, substitutions and heredocs.
- **Restore:** nothing to fix first.

### Shared engine and host adapter

- **Did:** one large state machine shared by both hosts, reached in Claude Code through a translating adapter.
- **Why retired:** its size and coupling made each fix slow to review; one smaller module now serves both hosts directly.
- **May get worse:** behavior differs between hosts where the hosts differ: Codex cannot ask natively, so it always uses the token. Symptom: an ask in Claude Code that is a token stop in Codex.
- **Detect:** the brake's host decision tests.
- **Restore:** nothing to fix first; the adapter is step 2 of the restoration.

### Read block before a task

- **Did:** a native read of project source with no task open was Blocked on its first attempt, and the card named `start`, so every session resolved PMNM before reading the project.
- **Why retired:** it depended on the receipts and the task state retired above.
- **May get worse:** a fresh session never loads PMNM and works without a task folder, plan Digest or audit. Symptom: the first tool calls read or list project files; the skill is never invoked. This was missed when the interlock was retired and observed later in a real session.
- **Detect:** cold sessions on a scratch repository, counting whether the first tool call loads the skill. Measured on Claude Code with Haiku 4.5 before the replacement: 0 of 5 runs loaded it first.
- **Now, partly restored:** the brake adds one line to the first prompt of each session, telling the agent to load the skill before reading the project: with the Skill tool in Claude Code, from its `SKILL.md` in Codex. The line alone was measured again after it shipped: delivered to every session, and still 0 of 5 cold Haiku sessions loaded the skill first. So in Claude Code the brake also stops the first tool call that can touch the project, in a session that has not loaded the skill, once, with no token, and the stop says to load it with the Skill tool. Once only, because the retired block could lock a session when its condition was never met. Tools that do not touch the project pass, and the human's prompt `PMNM-SKIP` turns the stop off for one session. Only Claude Code's Skill tool naming PMNM counts as a load, because the host mediates it. File reads were tried as loads and dropped: a hook cannot tell whether the agent saw the content, and each rule produced another way to read without reading (a path that only ends the same way, a command that names the file, an empty `head`, a redirect to `/dev/null`). Codex is not stopped: in practice it has loaded the skill on its own, and the failure was measured in Claude Code. No receipts or task state come back.
- **Restore fully:** the full read block returns with receipts and task state; fix the reload credit described in Lifecycle gates first.

## Restoring the interlock

The interlock replaces the brake; running both at once is untested. Do these steps in order.

1. **Codex registration.** Replace `hooks/codex/hooks.json` with the description `Please, Make No Mistakes procedural interlock for covered Codex lifecycle events.` and these six events. Each event has one `command` handler: `node "${PLUGIN_ROOT}/hooks/pmnm-guard.mjs"`, with `commandWindows` `node "${PLUGIN_ROOT}\hooks\pmnm-guard.mjs"`.

   | Event | matcher | timeout | statusMessage | additionalContextLimit |
   |---|---|---|---|---|
   | SessionStart | `startup\|resume\|clear\|compact` | 5 | `Please, Don't Lose the Thread` | 600 |
   | UserPromptSubmit | none | 5 | none | 600 |
   | PreToolUse | `Bash\|apply_patch\|Edit\|Write` | 5 | `Please, Guard the First Write` | 600 |
   | PostToolUse | `Bash\|apply_patch\|Edit\|Write` | 5 | none | none |
   | Stop | none | 5 | none | none |
   | Interrupt | none | 3 | none | none |

2. **Claude Code registration.** Replace `hooks/claude/hooks.json` with these six events and no description. Each event has one `command` handler: `node "${CLAUDE_PLUGIN_ROOT}/hooks/claude/pmnm-claude.mjs"`, timeout 30. The adapter translates Claude Code events for the engine `hooks/pmnm-guard.mjs`, which imports `hooks/pmnm-shell.mjs`. All three files stay unchanged in the package.

   | Event | matcher | statusMessage |
   |---|---|---|
   | SessionStart | `startup\|resume\|clear\|compact\|fork` | `Please, Don't Lose the Thread` |
   | UserPromptSubmit | none | none |
   | PreToolUse | none (every tool) | `Please, Guard the First Write` |
   | PostToolUse | none | none |
   | PostToolUseFailure | none | none |
   | Stop | none | none |

3. **Validators and packaging.** Make the checks expect the registrations above.
   - `scripts/validate_skill.py`: the six Codex events, their matchers, the `pmnm-guard.mjs` command, timeouts from 1 through 5, and no `additionalContextLimit` on Stop.
   - `scripts/distribution_smoke.py`: the same six Codex events and command. For Claude Code, `CLAUDE_COMMAND` is the adapter command, `CLAUDE_EVENTS` the six events above, `CLAUDE_CATCH_ALL_EVENTS` all of them except SessionStart, and `CLAUDE_NAMED_EVENTS` SessionStart and PreToolUse.
   - `scripts/test_claude_discovery.mjs`: only adapter commands.
   - The brake may stay in the package unregistered, or be removed together with its validator checks, `scripts/test_brake.mjs` and its `package.json` entries.

4. **Skill contract.** The engine blocks any task whose agent does not send its receipts. The skill must therefore teach them again: the receipt sequence, the two-line cards, effect declarations, the approval token and the lifecycle reload. That contract lives in the guard sections of `skills/please-make-no-mistakes/SKILL.md` and in `skills/please-make-no-mistakes/references/host-enforcement.md`. In this release `SKILL.md` no longer teaches it, and `host-enforcement.md` keeps it only under a retired label. Restore the `SKILL.md` guard sections from the last version that had them, and move the `host-enforcement.md` contract out of its retired label, before you register the engine.

5. **Public claims.** README, SETUP, SECURITY and CHANGELOG describe the brake. Restore their interlock descriptions, the SETUP activation check (a project read before `start` is blocked), and the pins in `scripts/documentation_contract.py` and `scripts/test_documentation_gate.py` that follow those texts.

6. **Verify.** Run `npm run test:host-guard`, `npm run test:claude-adapter`, `npm run test:claude-discovery` and `npm run release:verify`. Reinstall, review the hook in Codex `/hooks`, and in a fresh session confirm that the activation check is blocked.

Before step 1, fix the defects named in the cards above. They are what retired the interlock.

## Progressive disclosure

`SKILL.md` is a short core that opens with a reading map: for each step, the reference to read in full before it. This keeps the normal path visible to smaller models without loading every advanced procedure into every request.

The core keeps every order that can fall due before the agent could know to open a reference: the first action and the folder orders, the stops around the plan Digest and the hand-over, writing only inside the plan, the rule layers, effort, claims, the sensitive actions that stay with the human, how to read an authentic guard card, how to speak and when to stop and ask. Investigation, plan shapes, implementation, verification, audit and the remaining permission orders move to the reference the map names before their step, word for word and with their ids. References can clarify those responsibilities but cannot weaken them.

The core is sized for compaction. After compaction Claude Code re-injects the skill's body cut after about 19,900 characters, so the body stays under 12,000. The validator rejects a larger core, a missing, changed or repeated order, an essential order outside the core, a map that is not first or names a file the package lacks, and a personal or absolute skill path. When the host shows the skill cut short, the agent rereads the core from the directory the host loaded it from, not from a path it remembers, and then only the reference its next step needs. The verification-only exception stays in the core, because it decides whether a Digest is needed at all. A card comes from the registered hook; the output of a `pmnm-guard` run in a shell is never a card, and its `NEXT` is not followed.

## One PMNM folder per machine

Continuity belongs to the user, not the installed package. A host stores one pointer in its own configuration area. The selected PMNM folder stays outside repositories and installed skills, and may be shared by several hosts on the same machine.

The default shape is one general rules file, one project folder per repository and one task folder per unit of work. Each project separates human-owned instructions in `project-rules.md` from reusable claims in `project-knowledge.md`. The agent maintains the machine index. Every task folder starts with four files the agent seeds: `index.md` for retrieval, `plan.md` for agreed file and non-file state objectives, `verification.md` for the actionable plan and current claims, and `permissions.json` for predictable exact sensitive operations. The agent fills them and adds whatever else the task needs.

This keeps setup lightweight: the human chooses the folder once, then PMNM writes what it learns while working. There is no per task storage plan, hash ceremony or file authorization.

## Four bookkeeping questions only

The product asks about storage only when it needs the folder location, the project name, confirmation that a candidate folder is the same task, or the level of a new rule. Layout, filenames and routine task folder writes are agent decisions.

The task question needs evidence of identity: an existing folder with the same id resumes silently; a name that contains the id, or equals it after normalizing case and hyphens, is a candidate and is asked about; an unrelated folder is neither listed nor asked about. Similarity of meaning is never evidence.

Other questions must concern product intent, priority, risk or authority. A technical fact that code, tests, fixtures or available tools can establish remains investigation.

## Decisions, knowledge and rules are different

A task decision stays with that task. Reusable project knowledge keeps each claim's scope, basis, source and freshness boundary. A rule expresses a human-owned intention that something should always happen or never happen again. PMNM does not silently promote a correction, broad factual claim or observed convention into a rule. It asks whether a triggered rule belongs to the project or applies generally, then writes one sentence with provenance.

Current human instruction outranks stored rules. General, project and task rules have explicit scopes and stable ids; a narrower rule may specialize a broader one without silently replacing it. A rule is replaced or retired by id with its basis recorded.

## Provenance is relational and artifact custody is reference first

Material attribution is recorded as independently supportable relationships. Authorship, operation, observation, discovery, review, approval and causality may point to different sources and carry different evidence states. A likely source of context is not evidence of responsibility, and a plausible relationship remains inferred rather than becoming a special truth state.

External evidence stays in its existing authorized location when a durable reference is sufficient. `artifacts.md` records custody and evidentiary limits only when they matter. Copying or moving requires an exact source and destination, purpose, privacy result, identity method, recovery and retention; a move always needs current human authority. Full-content comparison may establish byte identity. Names, metadata and visual or semantic similarity produce candidates only.

The retired interlock enforced physical containment, detectable secret boundaries and covered external effects. The brake stops covered destructive and sensitive effects only. Neither decides semantic provenance, inspects opaque media completely or certifies evidentiary meaning.

## The plan Digest is material-work authority

Investigation ends with one plan Digest. It makes the requested result, current source state, proposed change or deliverable, verification, ambiguity and trade offs visible. A later human turn must agree before material work depends on that direction.

The Digest has three written counterparts. `plan.md` records repository files, non-file state, or a paired advisory deliverable and its strongest competing boundary. `verification.md` makes the execution surface, actor, data, steps, observable contract, evidence and cleanup actionable before work. `permissions.json` forecasts predictable exact sensitive operations by task or project scope. Agreement binds those contracts; a checked box is progress, not a new agreement. The retired interlock refused an out-of-plan effect or stale deliverable closure before it ran, because a Note afterward would have arrived too late. No hook refuses it now; the audit compares the changes with `plan.md` and reports it as a finding.

Agreement is bounded by the shown Digest. New evidence, a material correction, wider scope or a changed direction withdraws the dependent part. The agent records what changed and may continue independent read-only investigation, but presents a revised Digest before another material effect or final delivery relies on the new frame.

## Two human moments

The normal task has two human moments at every effort level:

1. agreement with the plan Digest after investigation
2. the final acceptance audit and its fingerprint

Between them, the agent performs the agreed work, verifies it and prepares the Test Digest. Those two are the floor, not the ceiling. The agent comes back sooner for a product decision only the human can make, for a sensitive action that needs its own yes, or for an uncertainty the evidence cannot settle. Protocol formatting must not create extra human work.

## Effort changes evidence, not ceremony

Every effort level keeps the same two human moments. Light makes the request case, one preserved case and the minimum direct evidence visible. Standard adds the strongest alternative or counterexample and the adjacent affected surface. High adds a non-author evidence channel and an independently derived impact challenge. When a non-author is unavailable, an adversarial self-review remains partial and cannot be renamed independent or complete.

## Verification follows the contract

PMNM does not require a unit test by name. It requires repeatable protection at the layer that can detect recurrence of the changed behavior. A unit, integration, interface, property, static or other check may be correct depending on the contract.

Current behavior verification and future regression protection are separate claims. Manual evidence can establish current behavior without automatically protecting future revisions. Every check reports its literal result, what it proves and what it does not.

Before a passed verification after a project change, the agent writes two claims in `verification.md`, after its last change: the request's own case and what was observed, and what must stay the same and what was observed. The retired interlock checked that the lines existed and postdated the change; no hook checks them now. No hook checks that they are true; that reading belongs to the human and, at High effort or on request, to a reviewer who did not write the change and adds one check the author did not run. The reviewer is evidence outside any hook, not a verdict a hook inherits.

The Test Digest translates technical verification into an exact surface, environment, actor, safe data, ordered steps, expected observations, evidence and cleanup. The agent first inspects executable interface capabilities instead of assuming the test belongs to the human. When it can run the check with an available tool, it offers to do so. Otherwise it states the exact limitation and that the handoff has not been executed. The retired Codex interlock could require that shaped message and a later human response, but it could not judge either one's meaning. No registered hook requires them now.

## Audit binds to a fingerprint

The final audit reconstructs the complete changed surface and challenges the completion claim. Its fingerprint identifies the exact source state reviewed. When version control is available it records the relevant base, current revision and changed sets. Without version control it reports a bounded file summary without pretending Git exists.

A later material change invalidates the affected audit findings. Fingerprints make that staleness visible but do not prove the review was complete.

Closure walks `plan.md`: every objective checked, every file target changed, every state transition supported by an observed exact operation and current evidence, every exclusion preserved and nothing material outside the plan. File comparison and state evidence remain distinct. A state-only task reports no project-file comparison. The retired interlock's closing card also counted the rules files the task wrote.

## The brake is partial, not semantic

The brake uses two hardness levels:

- `Blocked` means the operation did not run: a destructive operation, an operation that reaches the brake's own state, an operation the brake could not evaluate, or, in Claude Code, the first project tool call of a session that has not loaded PMNM
- `Ask` means a sensitive or unclassified operation did not run and needs a human answer

A card for a destructive, sensitive or unclassified operation names the single-use `PMNM-<code>` token, four characters without look-alikes, the human may reply with. Some cards carry no token: the stop for the brake's own state, the stop for an operation the brake could not evaluate, the Claude Code load stop, and the cards that say no token was issued because there are too many open approvals, because another session holds the approvals lock, or because the event has no session id to bind one to. In Claude Code a deterministic sensitive operation uses the host's own permission prompt instead of an `Ask` card. The retired interlock had a third level, `Note`, which meant work may continue; the brake has no `Note`.

Each card has one explanation line and one `NEXT:` line. A card does not teach the workflow. It stops one operation and directs the agent to the next valid step. The retired interlock used the same shape to make a small set of procedural invariants harder to skip.

A NEXT line is an order: one verb in the imperative, its limit, and who acts next. It names the one next action and may name what the human can do instead. It gives the model no alternatives to weigh and no explanation beyond its limit. The agent's action is never to wait; the full-approvals card names waiting for an open approval to expire only as the human's alternative to answering one. The retired interlock wrote waiting for the human as "stop here; no more actions until the human answers" and named paths absolutely, because the model may never have read the folder in this session. Hardness follows the evidence that prose was not enough, never the effort label.

No hook can prove that investigation was sufficient, a model statement was true, a human understood a plan, or every system effect was intercepted. Host trust, installation, event delivery and semantic correctness remain separate claims.

## PMNM folder writes need no plan authority

Once the human chooses the PMNM folder, ordinary contained writes, moves and deletions do not need a plan Digest or receipt. The root itself remains outside that standing authority. The brake treats an edit inside the folder like an edit inside the working directory. It honours the folder only when the folder does not hold the home directory and does not overlap the host configuration, the brake's data or the brake's code, so a pointer to such a place frees nothing, and it judges every edit, in the working directory as well, by the real path where it lands, a patch's move destination included, so a symlink cannot lead an edit out or onto a secret or configuration file. Secret and configuration files and deletions inside the folder still stop. The retired interlock blocked path or symlink escape and secret shaped content, and it alone wrote the index that maps repositories to project names. Now the agent keeps its writes inside the folder, keeps secrets out of it and writes the index. An empty folder is seeded before its pointer is written; invalid pointer or index state is preserved and rebuilt only after a human recovery decision.

Containment is not confidentiality. The folder inherits filesystem permissions, backup behavior and synchronization exposure from its chosen location. PMNM stores references to secrets, never secret values.

## Sensitive effects retain human authority

Outside ordinary contained PMNM maintenance, deletion, movement, direct external writes, version control mutation, dependency changes, publication, environment changes, network effects and planned non-file state changes retain explicit human authority. Predictable exact operations are grouped in the Digest and scoped to the task or project. State operations are task scoped and bound to a stable plan objective; an unlisted one requires a revised Digest instead of one-off authority. Task authority ends with the task or withdrawn Digest. Project authority survives only for identical operations in the same project and can be replaced or revoked by an explicitly agreed set. The brake does not read the forecast: it still stops each covered destructive or sensitive operation until the human replies with its exact single-use token or, in Claude Code, answers the host's own prompt. Native host approval still controls execution. The retired interlock first split unknown compound segments and multiple sensitive effects; the brake classifies every segment and takes the most severe result.

## Effects were declared without an executable catalog (retired)

An executable name does not establish what an operation does. In the retired interlock, unknown operations used one structured model declaration of effect, boundary, persistence and certainty; the declaration was a falsifiable claim, never permission. A capability already agreed by the human could classify the next matching unknown operation once, before a denial, so reusable authority did not require a ritual failure. It could not create its own authority, downgrade a mechanical write or hidden composition, survive an intervening operation, or replace native host review. Non-persistent verification followed the read path until an observed result demonstrated a project mutation.

The brake replaced declarations with its deterministic rules and the judge model the human confirmed. The agent declares nothing; what the rules cannot place goes to the judge.

## Rule and knowledge curation is an audit decision

One useful result does not become durable policy automatically. At audit, each candidate is either promoted with its scope, basis, source and freshness or kept task-local with a reason. Human-owned rules remain distinct from reusable factual knowledge. Before curation, the agent reloads the canonical general rules, project rules and project knowledge, detects concurrent changes and checks contradiction, overlap, overfitting and audience. It merges or replaces deliberately rather than appending a competing entry or inventing another registry.

## Delegated operations preserve evidence roles

When another actor executes consequential work, the durable package distinguishes executor from observer and records effect, boundary, exact scope, prerequisites, expected cost, stop signal, cleanup and the evidence available before, during and after execution. Read-only means no intended mutation; it does not mean unlimited cost. Freshness comes from an observable clock, source timestamp or revision and remains unknown when none exists. These roles and fields are portable patterns, not a database, shell or provider adapter.

## Authority follows target geometry

A project mutation belongs to the plan Digest. A contained PMNM write belongs to the folder's standing authority. An external-only effect belongs to its own exact human answer. The agent resolves that geometry before choosing a path, so an external operation does not invent a repository plan and a project mutation cannot escape through an external-effect label. The retired interlock resolved it in the hook before choosing a gate.

## Closure needs current evidence and material change

Every passed verification has current `example:` and `unchanged:` claims. A state plan also has exact current claims for its transitions and preserved invariants. Claims after a material change postdate that change; command evidence is observed against the same state; human evidence arrives in a later human turn. A successful state operation and evidence of its resulting state remain separate claims. A command that changes the project is not accepted as verification and invalidates prior plan authority. A passed audit requires a current passed verification, and a planned objective counts only when its file or state completion conditions are met.

## Hook state is bounded

The retired Codex interlock separated transient session state, reusable project authority and task-scoped implementation state under one canonical project identity. Different sessions could select different tasks without sharing transient flow or task authority. Sessions that selected the same task observed its monotonic revision and had to reload before stale state could authorize another material write. Each layer persisted only bounded hashes, counters and event metadata, never raw prompts, command previews, tool output or evidence.

The brake keeps less. Under the host's plugin data it keeps a secret key, pending approvals and one-time grants, the confirmed judge, the allowed MCP servers and sealed hashes of session ids for the first-prompt line and the Claude Code load stop, all sealed; decision counts and the marks of judge re-evaluation notices already shown are unsealed. In the PMNM folder it keeps sealed verdicts by operation hash. It never stores a prompt, tool output, a transcript or a command in clear.

Unknown commands are classified conservatively. Opaque wrappers are not trusted to hide their effect. Native host approval and sandbox controls remain authoritative even after a PMNM approval token.

## Compatibility aliases are temporary (retired)

The retired interlock accepted a bounded set of compatibility receipt spellings for one release. No registered hook reads receipts now. Cards and documentation use only the current vocabulary. Retired storage and readiness controls have no alias because accepting them would preserve a different workflow. Compatibility aliases are not a second public API and may be removed after the transition release.

## Host registrations stay isolated

Another host should implement the same observable contract through its own supported lifecycle surfaces. It must not copy an existing registration and assume similar event names carry identical guarantees.

Portable behavior and folder layout are shared. Codex and Claude Code register one brake module, `hooks/pmnm-brake.mjs`, selected with `--host`; where the hosts differ, its host decisions differ and are tested per host. State location, trust review and installation stay with each host. The retired interlock instead reached one shared engine through a separate adapter per host.

A guard receipt was a protocol marker of the retired interlock, not a command-line dependency. Interception is observable evidence only for the call that was intercepted. A receipt that reaches a shell now is a retired-interlock artifact. It cannot be repaired by PATH probing or repeated execution; the portable workflow continues in advisory mode.

## Evaluation layers stay separate

Static source validation, package identity, brake tests, retired interlock state tests, live hook delivery, model behavior, code correctness and user acceptance are distinct evidence layers.

Blind model fixtures omit expected answers. Deterministic expectations remain in the grader. The retired interlock's action sequences are public and executable, but they simulate lifecycle events that no registered hook receives. Live trials record the exact revision, host, model, tools, source fixture, human turns and cleanup.

Realistic trials can reveal where prose is skipped or a hook creates unnecessary friction. They do not justify copying private project language into the public skill. The reusable failure pattern becomes the product change.

## Distribution states are distinct

Repository source, npm artifact, marketplace entry, installed plugin, enabled skill, reviewed hook, trusted hook and loaded conversation revision are separate states. A successful check at one boundary does not imply the next.

The npm package has an explicit allowlist, no runtime registry dependency and no npm lifecycle script. `SETUP.md` alone owns installation, update, rollback, removal and verification commands. Public release requires deterministic gates plus live checks against the exact installed candidate.
