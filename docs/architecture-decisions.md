# Architecture Decisions

## One portable skill, optional host enforcement

PMNM is an Agent Skill first. Its folder and working contract remain useful when no lifecycle hook or MCP service exists. The package includes a Codex guard because Codex exposes events that can make some skipped transitions observable. The guard is optional, partial and specific to that host.

An MCP service is not required. It would add transport, process, permission and compatibility boundaries without proving semantic correctness. External tools may strengthen an evidence channel without becoming dependencies of PMNM.

## Progressive disclosure

`SKILL.md` contains the smallest useful kernel and a one level reference table. A reference loads only when its condition applies. This keeps the normal path visible to smaller models without loading every advanced procedure into every request.

The kernel owns precedence, the PMNM folder, the plan and test Digests, effort, claims, sensitive effects, guard interpretation, communication and stop conditions. References can clarify those responsibilities but cannot weaken them.

## One PMNM folder per machine

Continuity belongs to the user, not the installed package. A host stores one pointer in its own configuration area. The selected PMNM folder stays outside repositories and installed skills, and may be shared by several hosts on the same machine.

The default shape is one general rules file, one project folder per repository and one task folder per unit of work. Each project separates human-owned instructions in `project-rules.md` from reusable claims in `project-knowledge.md`. The guard maintains the machine index. Every task folder starts with four seeded files: `index.md` for retrieval, `plan.md` for agreed file and non-file state objectives, `verification.md` for the actionable plan and current claims, and `permissions.json` for predictable exact sensitive operations. The agent fills them and adds whatever else the task needs.

This keeps setup lightweight: the human chooses the folder once, then PMNM writes what it learns while working. There is no per task storage plan, hash ceremony or file authorization.

## Four bookkeeping questions only

The product asks about storage only when it needs the folder location, the project name, confirmation that a candidate folder is the same task, or the level of a new rule. Layout, filenames and routine task folder writes are agent decisions.

The task question needs evidence of identity: an existing folder with the same id resumes silently; a name that contains the id, or equals it after normalizing case and hyphens, is a candidate and is asked about; an unrelated folder is neither listed nor asked about. Similarity of meaning is never evidence.

Other questions must concern product intent, priority, risk or authority. A technical fact that code, tests, fixtures or available tools can establish remains investigation.

## Decisions, knowledge and rules are different

A task decision stays with that task. Reusable project knowledge keeps each claim's scope, basis, source and freshness boundary. A rule expresses a human-owned intention that something should always happen or never happen again. PMNM does not silently promote a correction, broad factual claim or observed convention into a rule. It asks whether a triggered rule belongs to the project or applies generally, then writes one sentence with provenance.

Current human instruction outranks project rules. Project rules outrank general rules when they are more specific and do not conflict with current authority.

## Provenance is relational and artifact custody is reference first

Material attribution is recorded as independently supportable relationships. Authorship, operation, observation, discovery, review, approval and causality may point to different sources and carry different evidence states. A likely source of context is not evidence of responsibility, and a plausible relationship remains inferred rather than becoming a special truth state.

External evidence stays in its existing authorized location when a durable reference is sufficient. `artifacts.md` records custody and evidentiary limits only when they matter. Copying or moving requires an exact source and destination, purpose, privacy result, identity method, recovery and retention; a move always needs current human authority. Full-content comparison may establish byte identity. Names, metadata and visual or semantic similarity produce candidates only.

The Codex guard continues to enforce physical containment, detectable secret boundaries and covered external effects. It does not decide semantic provenance, inspect opaque media completely or certify evidentiary meaning.

## The plan Digest is material-work authority

Investigation ends with one plan Digest. It makes the requested result, current source state, proposed change or deliverable, verification, ambiguity and trade offs visible. A later human turn must agree before material work depends on that direction.

The Digest has three written counterparts. `plan.md` records repository files, non-file state, or a paired advisory deliverable and its strongest competing boundary. `verification.md` makes the execution surface, actor, data, steps, observable contract, evidence and cleanup actionable before work. `permissions.json` forecasts predictable exact sensitive operations by task or project scope. Agreement binds those contracts; a checked box is progress, not a new agreement. An out-of-plan effect or stale deliverable closure is refused before it can be accepted. A Note afterward would arrive too late.

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

Before a passed verification after a project change, the agent writes two claims in `verification.md`, after its last change: the request's own case and what was observed, and what must stay the same and what was observed. The guard checks that the lines exist and postdate the change. It never checks that they are true; that reading belongs to the human and, at High effort or on request, to a reviewer who did not write the change and adds one check the author did not run. The reviewer is evidence outside the guard, not a verdict the guard inherits.

The Test Digest translates technical verification into an exact surface, environment, actor, safe data, ordered steps, expected observations, evidence and cleanup. The agent first inspects executable interface capabilities instead of assuming the test belongs to the human. When it can run the check with an available tool, it offers to do so. Otherwise it states the exact limitation and that the handoff has not been executed. The Codex guard can require that shaped message and a later human response, but it cannot judge either one's meaning.

## Audit binds to a fingerprint

The final audit reconstructs the complete changed surface and challenges the completion claim. Its fingerprint identifies the exact source state reviewed. When version control is available it records the relevant base, current revision and changed sets. Without version control it reports a bounded file summary without pretending Git exists.

A later material change invalidates the affected audit findings. Fingerprints make that staleness visible but do not prove the review was complete.

Closure walks `plan.md`: every objective checked, every file target changed, every state transition supported by an observed exact operation and current evidence, every exclusion preserved and nothing material outside the plan. File comparison and state evidence remain distinct. A state-only task reports no project-file comparison. The closing card also counts the rules files the task wrote.

## Guards are procedural, not semantic

The Codex guard uses three hardness levels:

- `Blocked` means the covered action did not run
- `Ask` means a human answer is required
- `Note` means work may continue

Each card has one explanation line and one `NEXT:` line. The guard does not teach the complete workflow. It makes a small set of invariants harder to skip and directs the agent to the next valid step.

A NEXT line is an order: one verb in the imperative, its limit, and who acts next; no explanation on that line, no alternatives for the model to weigh, and never the word wait. Waiting for the human is written as "stop here; no more actions until the human answers". Cards name paths absolutely, because the model may never have read the folder in this session. Hardness follows the evidence that prose was not enough, never the effort label.

The guard cannot prove that investigation was sufficient, a model statement was true, a human understood a plan, or every system effect was intercepted. Host trust, installation, event delivery and semantic correctness remain separate claims.

## Covered PMNM folder writes are free

Once the human chooses the PMNM folder, ordinary contained writes, moves and deletions do not need another approval or plan receipt. The root itself remains outside that standing authority. The guard blocks path or symlink escape and secret shaped content. It alone writes the index that maps repositories to project names. An empty folder is seeded before its pointer is written; invalid pointer or index state is preserved and rebuilt only after a human recovery decision.

Containment is not confidentiality. The folder inherits filesystem permissions, backup behavior and synchronization exposure from its chosen location. PMNM stores references to secrets, never secret values.

## Sensitive effects retain human authority

Outside ordinary contained PMNM maintenance, deletion, movement, direct external writes, version control mutation, dependency changes, publication, environment changes, network effects and planned non-file state changes retain explicit human authority. Predictable exact operations are grouped in the Digest and scoped to the task or project. State operations are task scoped and bound to a stable plan objective; an unlisted one requires a revised Digest instead of one-off authority. Other new or changed operations ask once and receive one matching use after the human says yes. Task authority ends with the task or withdrawn Digest. Project authority survives only for identical operations in the same project and can be replaced or revoked by an explicitly agreed set. Native host approval still controls execution. The guard first splits unknown compound segments and multiple sensitive effects.

## Effects are declared without an executable catalog

An executable name does not establish what an operation does. Unknown operations use one structured model declaration of effect, boundary, persistence and certainty; the declaration is a falsifiable claim, never permission. A capability already agreed by the human may classify the next matching unknown operation once, before a denial, so reusable authority does not require a ritual failure. It cannot create its own authority, downgrade a mechanical write or hidden composition, survive an intervening operation, or replace native host review. Non-persistent verification follows the read path until an observed result demonstrates a project mutation.

## Rule and knowledge curation is an audit decision

One useful result does not become durable policy automatically. At audit, each candidate is either promoted with its scope, basis, source and freshness or kept task-local with a reason. Human-owned rules remain distinct from reusable factual knowledge. Before curation, the agent reloads the canonical general rules, project rules and project knowledge, detects concurrent changes and checks contradiction, overlap, overfitting and audience. It merges or replaces deliberately rather than appending a competing entry or inventing another registry.

## Delegated operations preserve evidence roles

When another actor executes consequential work, the durable package distinguishes executor from observer and records effect, boundary, exact scope, prerequisites, expected cost, stop signal, cleanup and the evidence available before, during and after execution. Read-only means no intended mutation; it does not mean unlimited cost. Freshness comes from an observable clock, source timestamp or revision and remains unknown when none exists. These roles and fields are portable patterns, not a database, shell or provider adapter.

## Authority follows target geometry

A project mutation belongs to the plan Digest. A contained PMNM write belongs to the folder's standing authority. An external-only effect belongs to its own exact human answer. The guard resolves that geometry before choosing a gate, so an external operation does not invent a repository plan and a project mutation cannot escape through an external-effect label.

## Closure needs current evidence and material change

Every passed verification has current `example:` and `unchanged:` claims. A state plan also has exact current claims for its transitions and preserved invariants. Claims after a material change postdate that change; command evidence is observed against the same state; human evidence arrives in a later human turn. A successful state operation and evidence of its resulting state remain separate claims. A command that changes the project is not accepted as verification and invalidates prior plan authority. A passed audit requires a current passed verification, and a planned objective counts only when its file or state completion conditions are met.

## Procedural state is canonical and bounded

The Codex guard separates transient session state, reusable project authority and task-scoped implementation state under one canonical project identity. Different sessions may select different tasks without sharing transient flow or task authority. Sessions that select the same task observe its monotonic revision and must reload before stale state can authorize another material write. Each layer persists only bounded hashes, counters and event metadata, never raw prompts, command previews, tool output or evidence.

Unknown commands are classified conservatively. Opaque wrappers are not trusted to hide their effect. Native host approval and sandbox controls remain authoritative even after a PMNM receipt.

## Compatibility aliases are temporary

The guard accepts a bounded set of compatibility receipt spellings for one release. Cards and documentation use only the current vocabulary. Retired storage and readiness controls have no alias because accepting them would preserve a different workflow. Compatibility aliases are not a second public API and may be removed after the transition release.

## Host adapters stay isolated

Another host should implement the same observable contract through its own supported lifecycle surfaces. It must not copy the Codex hook and assume similar event names carry identical guarantees.

Portable behavior, folder layout and receipt meaning are shared. Hook code, state location, event parsing, trust review, installation and tests belong to each host adapter.

A guard receipt is an adapter protocol marker, not a command-line dependency. Interception is observable evidence only for the call that was intercepted. A receipt that reaches a shell cannot be repaired by PATH probing or repeated execution; the portable workflow continues in advisory mode while the missing enforcement is disclosed.

## Evaluation layers stay separate

Static source validation, package identity, guard state tests, live hook delivery, model behavior, code correctness and user acceptance are distinct evidence layers.

Blind model fixtures omit expected answers. Deterministic expectations remain in the grader. Guard action sequences are public and executable, but they simulate lifecycle events. Live trials record the exact revision, host, model, tools, source fixture, human turns and cleanup.

Realistic trials can reveal where prose is skipped or a guard creates unnecessary friction. They do not justify copying private project language into the public skill. The reusable failure pattern becomes the product change.

## Distribution states are distinct

Repository source, npm artifact, marketplace entry, installed plugin, enabled skill, reviewed hook, trusted hook and loaded conversation revision are separate states. A successful check at one boundary does not imply the next.

The npm package has an explicit allowlist, no runtime registry dependency and no npm lifecycle script. `SETUP.md` alone owns installation, update, rollback, removal and verification commands. Public release requires deterministic gates plus live checks against the exact installed candidate.
