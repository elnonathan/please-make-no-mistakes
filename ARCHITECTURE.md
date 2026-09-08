# Architecture

## Goal

Please, Make No Mistakes is one portable Agent Skill packaged with an optional Codex procedural adapter. The skill has four parts: the PMNM folder, the flow, rules born from an always or a never, and guards. The adapter enforces a small set of observable ordering rules for the lifecycle events Codex actually sends it.

The architecture keeps four claims separate:

1. The portable skill describes how an agent works.
2. The PMNM folder preserves what the agent learned, decided and verified.
3. A host adapter may enforce covered transitions.
4. Tests establish only the behavior and boundary they directly exercise.

None proves semantic truth or guarantees an error-free result. `SKILL.md` states what the product asks of the agent and what it does not promise; every change is checked against it.

## Repository layers

```text
please-make-no-mistakes/
├── .codex-plugin/plugin.json         public Codex plugin manifest
├── .agents/plugins/marketplace.json repository marketplace catalog
├── hooks/
│   ├── hooks.json                    Codex lifecycle registration
│   ├── pmnm-guard.mjs                optional Codex state and lifecycle guard
│   └── pmnm-shell.mjs                bounded shell envelope and hard-stop classifier
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
└── projects/<project>/
    ├── project-rules.md
    ├── project-knowledge.md
    └── tasks/<task>/
        ├── index.md
        ├── plan.md
        ├── verification.md
        ├── impact.md           required for Standard or High implementation with file targets
        ├── permissions.json
        ├── environment.md      optional operational preflight for persistent local resources
        ├── review.md           required for High-effort passed closure
        ├── operation.md        optional package for consequential work delegated to another actor
        ├── provenance.md       optional material attribution links
        ├── artifacts.md        optional evidence custody record
        └── artifacts/          optional deliberately retained copies
```

The host configuration contains only a pointer to this folder. Codex uses its config location. Another host must use its own supported configuration surface. Both can point to the same folder.

Startup has two explicit routes. With an active host guard, the agent starts the task and follows the guard's folder and project cards. In advisory mode, the portable skill reads only the host's documented literal pointer, stops for the missing folder or project answer, and performs the equivalent setup without emitting guard receipts. The two routes share the folder contract and never compete for ownership in one session.

Task selection belongs to a session, not to the repository. A fresh session starts task-neutral. Several sessions may work on different task folders in the same project; task-scoped Digests, permissions, counters and completion remain isolated. Shared project authority is serialized separately. If sessions intentionally share a task, its monotonic revision exposes stale state before another material write and requires explicit reload and reconciliation.

`index.json` has one runtime owner. The guard alone maintains it when active. In advisory mode the portable agent maintains the same `pmnm.projects/v1` schema, so another host does not lose repository-to-project continuity. An unindexed path already present under `projects/` is preserved and treated as occupied; a new repository receives another collision-safe path rather than silently adopting it. The guard seeds four base task files and adds canonical `impact.md` when Standard or High implementation has file targets; the agent fills them, adds whatever else the task needs and never renames them. Optional provenance and artifact records have canonical names when their responsibilities arise, but their absence does not make an unrelated task incomplete. Everything else inside the folder is the agent's to organize.

The folder asks the human exactly four things: where it goes, the project name, whether a candidate task folder is this task, and whether a new rule belongs to the project or applies generally. The task question appears only when an existing folder shares the id or a name that contains or normalizes to it.

Physical containment and secret detection remain boundaries. A path or symbolic link that escapes the folder is not an internal PMNM write. Content that looks like a secret is refused; the agent keeps a reference to where the secret lives instead. An empty folder is seeded before its pointer is written. Invalid pointer or index state is preserved under a unique recovery name and rebuilt only after the human chooses that recovery. The folder is a continuity aid, not a secret manager or access control system.

External evidence is reference-first. Copying or moving an artifact is a custody decision with an exact source, destination, purpose, privacy result, identity method, recovery and retention. Full-content digests can establish byte identity; visual or semantic similarity cannot. Provenance is relational as well: authorship, operation, observation, discovery, review, approval and causality keep independent evidence and status.

## Plan authority

The plan Digest is the human checkpoint before material work. Before showing it, the agent writes `plan.md`: one line per repository file the implementation will write, one per file that must stay as it is, one per material non-file state transition or preserved state invariant, or a paired advisory `deliverable` and `boundary`. The boundary records the strongest relevant alternative, exclusion or uncertainty and its disposition. File lines name paths and reasons. State lines name stable ids and explicit before and after values. Standard or High implementation with file targets also writes `impact.md`: either a bounded local rationale or a transitive ledger whose roots were derived independently of the proposed plan. A persistent local-environment operation gets an `environment.md` preflight covering command indirection, current resources, ownership, health, conflicts, the reuse-or-start-only-missing decision and cleanup. One preflight validates the complete plan, verification contract, applicable impact contract, required environment preflight and permission forecast before agreement; the Codex adapter writes every issue and safe canonicalization to guard-owned `preflight.md`. The Digest text repeats that promise for the human: understanding, current state, change, impact, verification with the wrong result each check can expose, ambiguities, trade-offs and one question. Then the agent stops; no more actions until the human answers.

Agreement binds the canonical set of file, state and deliverable objectives, in any order, with the actionable verification plan and permission forecast. Checking a box is progress, not a change of agreement. Safe absolute and relative spellings of the same repository path share one identity. A state already complete when its Digest is shown is historical: current evidence remains necessary, but the old operation is not replayed. A material reframe is recorded immediately; unrelated read-only investigation may continue, but dependent effects and final delivery wait for renewed agreement. The first write to an absent or excluded file, the first state-changing operation not bound to its objective, or stale deliverable closure is refused before it runs.

The guard tracks ordering, freshness, target geometry and scope. A repository mutation enters the Digest path. An ordinary write contained within PMNM uses the folder authority. An external-only effect uses its own exact authority without inventing a repository plan. Lifecycle discontinuities make the session's durable basis stale until the agent reloads the canonical files that exist: general rules, project rules, project knowledge and active-task context. A covered successful read correlates through host operation identity when available and counts only when the result returns the current file bytes; naming a path is not evidence that its contents were read. Even then, the guard cannot establish comprehension. Canonical rule and knowledge curation requires that basis again immediately before writing so a concurrent revision cannot be overwritten silently. On Codex Stop events the guard inspects only the latest assistant message for the current Test Digest. If Codex omits that Stop event, the next human prompt may recover only the latest assistant message from a fixed-size tail of the literal host-provided transcript path. That transcript schema is unstable: unreadable, linked, oversized, malformed, unsupported, stale or unrelated evidence fails closed, and neither the path nor the message is retained. Both routes check only shape and freshness. They cannot establish the message's truth, judge whether the investigation was sufficient, know whether the rules were understood or know whether the human understood the plan.

Sensitive effects remain separate outside ordinary contained PMNM maintenance. Predictable exact operations and bounded reusable capabilities appear together in the plan Digest and can receive task or project scoped authority. A capability is described by effect, boundary, persistence, operation shape and constraints rather than supplied by an executable catalog. A state transition is task scoped and binds its exact operation to a planned objective. An unlisted state operation requires a revised Digest; other newly discovered sensitive effects retain the one-operation path. Native host approval remains controlling. Unknown compound segments and multiple sensitive effects are split first.

## Verification and closure

Before claiming any passed verification, the agent writes two current lines in `verification.md`: the request's own case and what was observed, and the thing that must stay the same and what was observed. A state plan repeats each agreed state contract; an advisory plan records each deliverable and boundary observation. After a material change or reframe the claims must postdate it. Those lines are claims the human can read. The guard checks identity, shape, order and freshness; it never checks that they are true. A successful state operation proves only that the operation reported success, so resulting-state evidence remains separate. A non-persistent verification follows the read path until an observed result shows a project mutation. Command verification also needs an observed successful check against the current state, and human verification needs a later human turn. A syntax, metadata or documentation check remains investigation evidence while planned objectives are open; it cannot become final verification. A check that changes the project invalidates the prior Digest and returns to investigation.

Closure always needs a current passed verification. It walks `plan.md`: every objective checked, every file target materially changed, every changing state objective supported by its exact successful operation and current evidence, every advisory deliverable tested against its boundary, every exclusion preserved and nothing material outside the plan. It separately re-derives impact roots from the actual changed surface or delivered claim, asks what material path or contract the plan omitted, completes dynamic-boundary and non-functional dispositions, and binds that omission audit to the current verification fingerprint when applicable. Plan conformance cannot validate its own completeness. A no-op or a file restored to baseline is not complete. Across revised Digests, a direct-comparison baseline retains earlier path identities and adds newly planned paths, so removing a path can neither hide nor manufacture a change. The closing card names file comparison and other evidence separately. A state- or deliverable-only task reports no project-file comparison instead of inventing one. It also names how many canonical rules or knowledge files the task wrote.

A reviewer who did not write the change is a source of evidence at High effort or on request. The review packet binds the contract, changed surface and impact roots to the current plan hash and verification fingerprint, then records a concrete counterexample, a distinct check, an omission challenge, non-functional dispositions, disagreement and residual limit. Passed closure rejects a stale packet, repeated evidence or unresolved disagreement. The guard validates those observable properties only; it cannot prove reviewer independence or semantic correctness and does not inherit the reviewer's verdict. If no non-author is available, an adversarial self-review remains explicitly partial and cannot claim independence or completeness.

The Test Digest follows current verification, required review and the agent's final audit. It is the final human acceptance handoff, normally immediately before commit, submit or close. A passed or partial final audit can request that handoff; a blocked audit keeps the task open and does not arm acceptance. The later human response and repeated `done` close the task. Intermediate verification never triggers it.

## Codex adapter

`hooks/hooks.json` registers the supported Codex lifecycle events. `hooks/pmnm-guard.mjs` owns bounded host-provided state and imports one local pure module, `hooks/pmnm-shell.mjs`, for shell structure, target evidence and narrow hard stops. The module contains no positive executable catalog. Operation admission keeps classification evidence, human authority and host execution or result as independent stages. Ordinary operations use a structured model declaration, then a separate human-agreed capability or exact authority when needed; satisfying one stage does not erase or manufacture another. Neither module has a registry dependency. Distribution validation accepts exactly this two-file local graph, rejects links and escaping or unlisted modules, and enforces explicit per-file and aggregate inspectability budgets. Its cards have two lines: `Blocked`, `Ask` or `Note` with what happened, and one exact `NEXT:` action. A NEXT line is an order: one verb, its limit, and who acts next.

The adapter may:

- establish a PMNM folder pointer and project mapping
- note the first project read without a task and block the second
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

It cannot:

- understand product intent
- prove a model statement true
- decide that investigation or test coverage is sufficient
- prove the meaning, correctness or completeness of human or model prose
- intercept an event the host does not deliver
- replace the host sandbox, operating system permissions or native approval controls

Disabled, untrusted, unsupported, failed, or bypassed paths leave the portable skill in advisory mode. This is a disclosed reduction in enforcement, not permission to claim the adapter ran.

## Host adapter contract

Another host may implement the same portable transitions through its own lifecycle API. It must be designed, tested, installed and documented independently. Similar event names do not establish equivalent semantics.

A host adapter must preserve:

- the twelve public receipt meanings and the three card levels
- two-line cards with one `NEXT:` action
- one PMNM folder and a host-local pointer
- free contained task-folder writes without per-file approval
- `plan.md` agreement before file or state implementation and refusal of out-of-plan effects
- the human's yes for each sensitive effect
- current verification claims, a passed verification and a complete audit before closure
- disclosure of uncovered paths

The Codex implementation is not a shared hook library for another host. Portable behavior lives in the skill and the PMNM folder. Host enforcement stays isolated.

## Evidence and evaluation

Evaluation is layered:

1. Activation cases test whether the skill is selected for the right requests.
2. Blind decision cases test routing without exposing expected answers to the model.
3. Behavior cases test observable collaboration, investigation, verification and continuity.
4. Guard cases and the action oracle test deterministic Codex lifecycle transitions.
5. Install smoke compares exact source and installed skill bytes.
6. Live trials test discovery, trust, model behavior and real host delivery.

Passing a lower layer does not prove a higher one. A syntax validator does not prove behavior. A synthetic lifecycle event does not prove Codex delivered it. A passing test does not prove the entire product contract.

The release gate runs every deterministic package check and reports all failures. Live acceptance follows against the exact installed candidate. Any material change invalidates the checks whose subject changed.

## Distribution boundary

The npm artifact contains the portable skill, the optional Codex guard, public documentation, reusable evaluations and deterministic validators. It declares no runtime registry dependency and no npm lifecycle script.

The package excludes repository automation, marketplace source metadata, private coordination, user PMNM folders, generated test output and credentials. npm transports exact bytes; it does not register a plugin, activate a skill, trust a hook or prove a conversation loaded that revision.

Repository source, packed artifact, marketplace entry, installed plugin, enabled plugin, trusted hook and loaded conversation are distinct states. `SETUP.md` owns their installation, update, rollback, removal and verification sequence.
