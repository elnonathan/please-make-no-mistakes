# Architecture

## Goal

Please, Make No Mistakes is one portable Agent Skill packaged with an optional destructive-operation brake, registered for Claude Code and for Codex. Integration with other coding agents is possible but not officially supported. The skill has four parts: the PMNM folder, the flow, rules born from an always or a never, and guards. The brake stops covered destructive and sensitive operations in the tool calls its host actually sends it, until the human approves them.

The architecture keeps four claims separate:

1. The portable skill describes how an agent works.
2. The PMNM folder preserves what the agent learned, decided and verified.
3. The brake may stop covered destructive or sensitive operations.
4. Tests establish only the behavior and boundary they directly exercise.

None proves semantic truth or guarantees an error-free result. `SKILL.md` states what the product asks of the agent and what it does not promise; every change is checked against it.

## Repository layers

```text
please-make-no-mistakes/
├── .claude-plugin/plugin.json        public Claude Code plugin manifest
├── .claude-plugin/marketplace.json   repository marketplace catalog for Claude Code
├── .codex-plugin/plugin.json         public Codex plugin manifest
├── .agents/plugins/marketplace.json repository marketplace catalog for Codex
├── hooks/
│   ├── claude/hooks.json             Claude Code brake registration
│   ├── claude/pmnm-claude.mjs        retired interlock adapter for Claude Code, unregistered
│   ├── codex/hooks.json              Codex brake registration
│   ├── pmnm-brake.mjs                destructive-operation brake for both hosts
│   ├── pmnm-guard.mjs                retired interlock engine, unregistered
│   └── pmnm-shell.mjs                retired interlock shell classifier, unregistered
├── skills/please-make-no-mistakes/
│   ├── SKILL.md                      portable kernel and reference router
│   ├── agents/openai.yaml            Codex presentation metadata
│   └── references/                   conditionally loaded procedures
├── evals/                            activation, behavior and guard contracts
├── scripts/                          release and distribution validators
├── assets/pls.png                    README mascot
├── SETUP.md                          canonical setup procedure
└── public project documentation
```

`AGENTS.md` and `.ai/` are local coordination. They are ignored by Git, excluded by the package allowlist and forbidden from public artifacts.

## Portable skill

`SKILL.md` is intentionally small. It owns the four parts and says when, how and where to apply them:

- one PMNM folder per machine, where the agent writes freely
- the flow: investigate, show the plan Digest, work inside it, verify, audit, then hand over the Test Digest at the human acceptance boundary
- rules: one sentence each, written only after an always or a never and one question about their level
- guards: how to read a two-line card and take its `NEXT:` action

Its reference table is one level deep. A reference is loaded only when its condition applies. References add detail; they cannot weaken the kernel.

The skill has no required MCP service, programming language, version control system, repository host, test runner or delivery system. It uses the strongest evidence channels the host offers and reports what their absence leaves unresolved. Semantic navigation and other graph providers may supply definitions, references, call edges or unresolved candidates, but their output remains evidence rather than scope authority or proof of runtime reachability. Public prose carries shapes with placeholders, never worked examples.

## PMNM folder

The installed plugin is replaceable. User knowledge is not. PMNM stores task knowledge and learned rules outside repositories and outside installed packages.

```text
<PMNM folder>/
├── index.json
├── general-rules.md
├── commands.json               the brake's sealed verdicts
├── models.json                 the agent's judge proposal; grants nothing
└── projects/<project>/
    ├── project-rules.md
    ├── project-knowledge.md
    └── tasks/<task>/
        ├── index.md
        ├── plan.md
        ├── verification.md
        ├── impact.md           required for Standard or High implementation with file targets
        ├── expectations.md     required for High effort
        ├── permissions.json
        ├── environment.md      optional operational preflight for persistent local resources
        ├── review.md           required for High-effort passed closure
        ├── operation.md        optional package for consequential work delegated to another actor
        ├── provenance.md       optional material attribution links
        ├── artifacts.md        optional evidence custody record
        └── artifacts/          optional deliberately retained copies
```

The host configuration contains only a pointer to this folder. Claude Code and Codex each use their own config location. Another host, which is not officially supported, must use its own supported configuration surface. All can point to the same folder.

Startup follows one route. The agent reads only the host's documented literal pointer, stops for the missing folder or project answer, and performs the setup itself. It starts each task with an effort and a work type. The durable work type is `implementation`, `advisory` or `verification`. The retired interlock had a second route through guard receipts; it returns only if the interlock is restored.

Task selection belongs to a session, not to the repository. A fresh session starts task-neutral. Several sessions may work on different task folders in the same project; each task keeps its own Digest, permissions and completion. No hook serializes two sessions that share a task, so each reloads the task files before writing to them.

`index.json` has one writer: the agent, using the `pmnm.projects/v1` schema, so another host does not lose repository-to-project continuity. An unindexed path already present under `projects/` is preserved and treated as occupied; a new repository receives another collision-safe path rather than silently adopting it. The agent seeds four base task files and adds canonical `impact.md` when Standard or High implementation has file targets; it fills them, adds whatever else the task needs and never renames them. Optional provenance and artifact records have canonical names when their responsibilities arise, but their absence does not make an unrelated task incomplete. Everything else inside the folder is the agent's to organize, except the brake's `commands.json`.

The folder asks the human exactly four things: where it goes, the project name, whether a candidate task folder is this task, and whether a new rule belongs to the project or applies generally. The task question appears only when an existing folder shares the id or a name that contains or normalizes to it.

Containment and secrets are agent obligations first. A path or symbolic link that escapes the folder is not an internal PMNM write. The brake adds one check: it judges every edit by the real path where it lands, so a symbolic link cannot carry an edit out of the folder or onto a secret or configuration file, and it still stops deletions, moves and secret or configuration edits inside the folder. It does not scan content for secrets. The agent never writes a secret there; it keeps a reference to where the secret lives instead. An empty folder is seeded before its pointer is written. Invalid pointer or index state is preserved under a unique recovery name and rebuilt only after the human chooses that recovery. The folder is a continuity aid, not a secret manager or access control system.

External evidence is reference-first. Copying or moving an artifact is a custody decision with an exact source, destination, purpose, privacy result, identity method, recovery and retention. Full-content digests can establish byte identity; visual or semantic similarity cannot. Provenance is relational as well: authorship, operation, observation, discovery, review, approval and causality keep independent evidence and status.

## Plan authority

The plan Digest is the human checkpoint before material work. Before showing it, the agent writes `plan.md`: one line per repository file the implementation will write, one per file that must stay as it is, one per material non-file state transition or preserved state invariant, or a paired advisory `deliverable` and `boundary`. The boundary records the strongest relevant alternative, exclusion or uncertainty and its disposition. File lines name paths and reasons. State lines name stable ids and explicit before and after values. Advisory work accepts only paired deliverables and boundaries. Standard or High implementation with file targets also writes `impact.md`: either a bounded local rationale or a transitive ledger whose roots were derived independently of the proposed plan. A persistent local-environment operation gets an `environment.md` preflight covering command indirection, current resources, ownership, health, conflicts, the reuse-or-start-only-missing decision and cleanup. One preflight validates the work type, complete plan, verification contract, applicable impact contract, required environment preflight and permission forecast before agreement. The agent reports every defect it finds together. The Digest text repeats that promise for the human: understanding, current state, change, impact, verification with the wrong result each check can expose, ambiguities, trade-offs and one question. Then the agent stops. No more actions until the human answers.

Agreement binds the canonical set of file, state and deliverable objectives, in any order, with the actionable verification plan and permission forecast. Checking a box is progress, not a change of agreement. Safe absolute and relative spellings of the same repository path share one identity. A state already complete when its Digest is shown is historical: current evidence remains necessary, but the old operation is not replayed. A material reframe is recorded immediately; unrelated read-only investigation may continue, but dependent effects and final delivery wait for renewed agreement. No hook refuses a write to an absent or excluded file, a state-changing operation not bound to its objective, or stale deliverable closure. The agent must not make them, and the audit compares the actual changes with `plan.md`.

A repository mutation enters the Digest path. An ordinary write inside the PMNM folder needs no approval. An external-only effect uses its own exact authority without inventing a repository plan. After startup, resume, clear or compaction, the agent reloads the canonical files that exist before material work on an active task: general rules, project rules, project knowledge and active-task context. It reloads canonical rules and project knowledge again immediately before curating them, so a concurrent revision is not overwritten silently. No hook checks that reload, the order of the steps or the shape of the Test Digest.

Sensitive effects remain separate outside ordinary contained PMNM maintenance. Predictable exact operations and bounded reusable capabilities appear together in the plan Digest and can receive task or project scoped authority. A capability is described by effect, boundary, persistence, operation shape and constraints rather than supplied by an executable catalog. A state transition is task scoped and binds its exact operation to a planned objective. An unlisted state operation requires a revised Digest; other newly discovered sensitive effects need their own yes. The brake does not read the forecast: it still stops each covered destructive or sensitive operation until the human replies with its exact single-use token or, in Claude Code, answers the host's own prompt. Native host approval remains controlling.

## Verification and closure

Before claiming any passed verification, the agent writes two current lines in `verification.md`: the request's own case and what was observed, and the thing that must stay the same and what was observed. A state plan repeats each agreed state contract; an advisory plan records each deliverable and boundary observation. After a material change or reframe the claims must postdate it. Those lines are claims the human can read. No hook checks them, and nothing checks that they are true. A successful state operation proves only that the operation reported success, so resulting-state evidence remains separate. Command verification also needs an observed successful check against the current state, and human verification needs a later human turn. A syntax, metadata or documentation check remains investigation evidence while planned objectives are open; it cannot become final verification. A check that changes the project invalidates the prior Digest and returns to investigation.

Closure always needs a current passed verification. It walks `plan.md`: every objective checked, every file target materially changed, every changing state objective supported by its exact successful operation and current evidence, every advisory deliverable tested against its boundary, every exclusion preserved and nothing material outside the plan. It separately re-derives impact roots from the actual changed surface or delivered claim, asks what material path or contract the plan omitted, completes dynamic-boundary and non-functional dispositions, and binds that omission audit to the current verification fingerprint when applicable. Plan conformance cannot validate its own completeness. A no-op or a file restored to baseline is not complete. Across revised Digests, a direct-comparison baseline retains earlier path identities and adds newly planned paths, so removing a path can neither hide nor manufacture a change. The final audit names file comparison and other evidence separately. A state- or deliverable-only task reports no project-file comparison instead of inventing one. It also names how many canonical rules or knowledge files the task wrote.

A reviewer who did not write the change is a source of evidence at High effort or on request. The review packet binds the contract, changed surface and impact roots to the current plan hash and verification fingerprint, then records a concrete counterexample, a distinct check, an omission challenge, non-functional dispositions, disagreement and residual limit. Passed closure rejects a stale packet, repeated evidence or unresolved disagreement. No hook validates the packet. It cannot prove reviewer independence or semantic correctness, and the agent does not inherit the reviewer's verdict. If no non-author is available, an adversarial self-review remains explicitly partial and cannot claim independence or completeness.

The Test Digest follows current verification, required review and the agent's final audit. It is the final human acceptance handoff, normally immediately before commit, submit or close. A passed or partial final audit can request that handoff; a blocked audit keeps the task open and does not arm acceptance. The later human response closes the task. Intermediate verification never triggers it.

## Brake

`hooks/claude/hooks.json`, declared by `.claude-plugin/plugin.json`, and `hooks/codex/hooks.json`, declared by `.codex-plugin/plugin.json`, register one module, `hooks/pmnm-brake.mjs`, with `--host claude` or `--host codex`. Both register it on `PreToolUse` and `UserPromptSubmit`. In Claude Code it covers every tool; in Codex the tool matcher is `Bash|apply_patch|Edit|Write|mcp__.*`. The package carries no conventional `hooks/hooks.json`, because Claude Code would merge that file into the Claude plugin. The brake knows nothing about tasks, plans or Digests.

The brake imports only Node.js built-in modules and runs no program except the host's own command-line client as its judge. Package validation enforces that boundary and an inspectable size budget.

For each covered tool call it decides in two layers:

1. Deterministic rules place known shapes as safe, sensitive or destructive, including commands inside wrappers, substitutions and heredocs. A compound command takes its most severe segment. Code that runs other code is classified by what it runs.
2. What the rules cannot place goes first to a sealed stored verdict, then to the judge model the human confirmed. Only a safe verdict with high confidence runs without asking.

A stop prints a two-line card: `Blocked:` or `Ask:` with what happened, and one `NEXT:` line with one exact action. `Blocked:` covers a destructive operation, an operation that reaches the brake's own state, an operation the brake could not evaluate, and the Claude Code load stop. `Ask:` covers any other stop. For a destructive or sensitive operation, the `NEXT:` line tells the agent to show the human the exact operation; it runs only if the human replies with its exact `PMNM-<code>` token, or runs it themselves. Some cards carry no token: the brake's own state, an evaluation error, the load stop, full or busy approvals, and an event without a session id. In Claude Code a deterministic sensitive operation uses the host's own permission prompt instead of a card. A failed or unavailable classification asks. An error the brake catches while evaluating blocks. A brake that runs past its time limit or cannot start is handled by the host, which may let the operation run.

On `UserPromptSubmit` the brake recognizes the human's exact prompts: an approval token grants one rerun of that operation in that session, and the judge confirmation and MCP allowlist prompts change sealed state. The agent cannot send a prompt. When the judge needs a confirmation or a re-evaluation, the brake adds one notice to the agent's context, once per change, and the agent relays it to the human.

On the first prompt of each session the brake adds one line asking the agent to load PMNM. In Claude Code, when the agent has not loaded the skill with the Skill tool, the brake stops the first tool call that can touch the project once per session, with a card that asks the agent to load it. The next call runs whether or not the agent did. The human's exact prompt `PMNM-SKIP` turns that stop off for the session. Codex has no load stop.

An operation that reaches the brake's own state is blocked on both hosts, before any grant is spent and with no token, so only the human can run it.

Under the host's plugin data directory, in `brake/`, the brake keeps a secret key, pending approvals and one-time grants, the confirmed judge, the MCP allowlist, hashes of the sessions that received the load line and of the sessions that loaded the skill, the notices already shown, and decision counts. Every entry carries a seal made with that key, except the notices and the decision counts, which grant nothing. In the PMNM folder it writes only `commands.json`. Nothing in the PMNM folder grants authority by itself.

It cannot:

- understand product intent or check the flow
- prove a model statement true
- prove that a safe verdict makes an operation harmless
- catch every obfuscated command
- intercept an event the host does not deliver
- replace the host sandbox, operating system permissions or native approval controls

Disabled, untrusted, unsupported, failed, or bypassed paths leave the portable skill in advisory mode. This is a disclosed reduction in enforcement, not permission to claim the brake ran.

## Host port contract

Another host may run the brake through its own lifecycle API. Such a port is not officially supported. It must be designed, tested, installed and documented independently. Similar event names do not establish equivalent semantics.

A port must preserve:

- deterministic rules that take precedence over stored verdicts
- two card levels, `Blocked` and `Ask`, each with one `NEXT:` action, or the host's own permission prompt where it has one
- the human's exact operation-bound, session-bound and single-use approval token, which the agent cannot send
- sealed state outside the PMNM folder
- a failed classification that asks and an evaluation error that blocks
- one PMNM folder and a host-local pointer
- disclosure of uncovered paths

Both hosts register one brake module, `hooks/pmnm-brake.mjs`, selected by `--host`. The module owns each host's output shape and has host decision tests for both. Codex has no native ask, so it always uses the token. Portable behavior lives in the skill and the PMNM folder.

## Retired interlock

Earlier releases shipped one portable Agent Skill packaged with an optional Codex procedural adapter and an optional Claude Code procedural adapter instead of the brake. Each adapter enforced a small set of observable ordering rules for the lifecycle events its host sent it. Their source stays in the package, unregistered: the engine `hooks/pmnm-guard.mjs`, its shell module `hooks/pmnm-shell.mjs` and the Claude Code adapter `hooks/claude/pmnm-claude.mjs`. None of it runs now. This section describes how the interlock works once restored; [Restoring the interlock](docs/architecture-decisions.md#restoring-the-interlock) lists the steps and the defects to fix first.

`hooks/pmnm-guard.mjs` owns bounded host-provided state and imports one local pure module, `hooks/pmnm-shell.mjs`, for shell structure, target evidence and narrow hard stops. The module contains no positive executable catalog. Operation admission keeps classification evidence, human authority and host execution or result as independent stages. Ordinary operations use a structured model declaration, then a separate human-agreed capability or exact authority when needed; satisfying one stage does not erase or manufacture another. Neither module has a registry dependency. For the interlock, distribution validation accepts exactly this two-file local graph beside the brake, rejects links and escaping or unlisted modules, and enforces explicit per-file and aggregate inspectability budgets. Its cards have two lines: `Blocked`, `Ask` or `Note` with what happened, and one exact `NEXT:` action. A NEXT line is an order: one verb, its limit, and who acts next.

The guard tracks ordering, freshness, target geometry and scope. It owns `index.json`, seeds the task files and writes every preflight issue and safe canonicalization to guard-owned `preflight.md`. Lifecycle discontinuities make the session's durable basis stale until the agent reloads the canonical files that exist. A covered successful read correlates through host operation identity when available and counts only when the result returns the current file bytes. On Codex Stop events the guard inspects only the latest assistant message for the current Test Digest. If Codex omits that Stop event, the next human prompt may recover only the latest assistant message from a fixed-size tail of the literal host-provided transcript path. That transcript schema is unstable: unreadable, linked, oversized, malformed, unsupported, stale or unrelated evidence fails closed, and neither the path nor the message is retained. Both routes check only shape and freshness. They cannot establish the message's truth, judge whether the investigation was sufficient, know whether the rules were understood or know whether the human understood the plan.

The interlock adapter may:

- establish a PMNM folder pointer and project mapping
- block the first project read without an open task
- require a task before a covered write and a fresh `plan.md` before a Digest
- aggregate plan, verification, impact and permission defects before asking for agreement
- block a project write until the Digest is agreed, a write outside the plan before it runs, and an unbound state-changing operation
- allow writes inside the PMNM folder while containing inspected paths and refusing detected secret-shaped content on covered write channels
- bind a reviewed permission forecast to exact operations or bounded task and project capabilities, while binding state changes only to task objectives
- distinguish project, contained PMNM and external-only targets before choosing an authority path
- split unknown compound commands and commands with several sensitive effects
- require an exact structured effect declaration when host metadata is absent, without trusting an executable name
- let one plain same-turn declaration or already agreed capability classify exactly the next otherwise-unknown operation; discard unused intent at the existing boundaries, but retain a legitimately applied exact classification across its separate authority decision until that same operation is admitted
- observe non-persistent verification without presuming a project write, and render its card from the observed workspace delta rather than task phase
- account for missing, failed and late results
- require fresh verification claims, a current impact omission audit, a complete audit and a current semantic review packet for High-effort passed closure
- reconcile unfinished task transitions once and isolate the successor's task-scoped state
- keep transient state per session, reusable authority per project and implementation authority per task, with revision checks when sessions share a task
- require durable rule reload after startup, resume, clear or compact before material work on an active task
- require fresh canonical rule and project-knowledge context before a curation write
- require a complete operational preflight before persistent local-environment authority enters a Digest
- print a bounded source fingerprint and name file comparison and state evidence separately

A host adapter for the interlock must preserve:

- the twelve public receipt meanings and the three card levels
- two-line cards with one `NEXT:` action
- one PMNM folder and a host-local pointer
- free contained task-folder writes without per-file approval
- `plan.md` agreement before file or state implementation and refusal of out-of-plan effects
- the human's exact operation-bound approval token for each unforecast sensitive effect
- current verification claims, a passed verification and a complete audit before closure
- disclosure of uncovered paths

The Codex and Claude Code adapters call one shared transition engine. Each adapter owns host event parsing, output shape and its own conformance tests.

## Evidence and evaluation

Evaluation is layered:

1. Activation cases test whether the skill is selected for the right requests.
2. Blind decision cases test routing without exposing expected answers to the model.
3. Behavior cases test observable collaboration, investigation, verification and continuity.
4. Brake tests cover classification, approval tokens, sealed state and host decisions. The retired interlock keeps its guard cases, action oracle and adapter tests for rollback.
5. Install smoke compares exact source and installed skill bytes.
6. Live trials test discovery, trust, model behavior and real host delivery.

Passing a lower layer does not prove a higher one. A syntax validator does not prove behavior. A synthetic hook event does not prove the host delivered it. A passing test does not prove the entire product contract.

The release gate runs every deterministic package check and reports all failures. Live acceptance follows against the exact installed candidate. Any material change invalidates the checks whose subject changed.

## Distribution boundary

The npm artifact contains the portable skill, the optional destructive-operation brake for Claude Code and Codex, the retired interlock source (unregistered), public documentation, reusable evaluations and deterministic validators. It declares no runtime registry dependency and no npm lifecycle script.

The package excludes repository automation, marketplace source metadata, private coordination, user PMNM folders, generated test output and credentials. npm transports exact bytes; it does not register a plugin, activate a skill, trust a hook or prove a conversation loaded that revision.

Repository source, packed artifact, marketplace entry, installed plugin, enabled plugin, trusted hook and loaded conversation are distinct states. `SETUP.md` owns their installation, update, rollback, removal and verification sequence.
