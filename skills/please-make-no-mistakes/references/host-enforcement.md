# Please, Guard the First Write — host enforcement

The portable skill is the contract. A host guard is an optional procedural interlock for mistakes a prompt alone cannot reliably prevent. It observes only the events its host supplies. It does not understand the product, prove that an investigation is sufficient, or make a change correct.

The bundled implementation belongs to Codex. Another host needs its own adapter, event mapping, tests, installation proof and coverage statement. It must not replace or weaken the Codex adapter merely to share code.

## Read a card

A guard card is always two lines.

```text
Blocked | Ask | Note: <what happened>
NEXT: <one exact action>
```

- **Blocked** means the attempted operation did not run.
- **Ask** means the operation waits for the human's answer: stop here; no more actions until the human answers.
- **Note** records state or directs the next agent action without asking the human.

The card itself is not a user question. Follow `NEXT:` in the same turn unless it says to ask or to stop. The host may add its own frame such as “Blocked by hook”; that frame is not PMNM output.

Cards use English or Spanish through a bounded prompt-language heuristic. `NEXT:` remains literal in either language. No card claims semantic correctness.

A first read of project source with no task open is a Note; the second is Blocked. This route depends only on an observable project-source read while no task is open. It never infers a task, ticket or identifier from prompt wording. Reads that resolve PMNM itself and requests that do not inspect a project are free.

## Receipts

The model sends receipts through the shell tool. The guard intercepts them, records the transition and substitutes a no-op; the receipt is never executed by the shell. `pmnm-guard` is a protocol marker, not a program to find, install or invoke from `PATH`. Successful interception is the only positive evidence that the adapter handled that receipt. If one reaches the shell or returns command not found, do not retry it or search for an executable. Disclose that enforcement was unavailable for that call and continue through the portable advisory path.

| Receipt | Use |
| --- | --- |
| `pmnm-guard folder path=<abs>` | After the human chose where the PMNM folder lives, or where a moved or deleted folder should live |
| `pmnm-guard project name=<name>` | After the human named this repository's project folder |
| `pmnm-guard start task=<id> effort=<light\|standard\|high>` | At task entry, resumption or task change |
| `pmnm-guard digest` | Immediately after the plan Digest was shown |
| `pmnm-guard agreed` | After a later human turn agreed to that Digest as shown |
| `pmnm-guard redo` | When evidence, scope or direction makes the Digest stale |
| `pmnm-guard allow effect=<effect>` | After the human allowed one exact sensitive command |
| `pmnm-guard declare effect=<effect> boundary=<boundary> persistence=<persistence> certainty=<certainty> capability=<id\|none>` | To declare an unknown operation's effect, or the next operation under an already agreed capability |
| `pmnm-guard result outcome=<unknown\|no-effect>` | When the host omitted the result of an admitted operation |
| `pmnm-guard verified result=<passed\|failed\|partial\|blocked> how=<command\|inspection\|human>` | After the check that evaluates the current change |
| `pmnm-guard done audit=<passed\|partial\|blocked>` | First after the final audit to request the Test Digest; again after the later human response to close |
| `pmnm-guard status` | To obtain the one current continuation |

Receipt values contain no whitespace. Percent-encode UTF-8 bytes outside letters, digits, `.`, `_`, `~`, `/` and `-` in folder and project values. The guard rejects control characters, traversal, malformed encoding, duplicate fields, shell operators, dynamic values and unknown receipts.

The human answers in ordinary language; there is no required approval word. The agent sends `agreed` or `allow` only after a clear later response. The guard observes that a later response exists and binds the receipt to the current Digest or exact operation; it cannot judge the meaning of the response.

`declare` uses `investigation`, `implementation`, `verification` or `state-change` for effect; `project`, `pmnm`, `host`, `local-environment`, `network`, `external`, `mixed` or `unknown` for boundary; `none`, `transient`, `persistent` or `unknown` for persistence; and `certain` or `uncertain` for certainty. `capability=none` makes no reusable-authority claim. Any other capability id must already exist in the human-agreed permission forecast with the same effect, boundary and persistence. A plain declaration or an already agreed, certain capability may be declared before exactly the next otherwise-unknown non-control operation in the same human turn; an exact denial remains the fallback. An unbound proactive declaration is spent by the next non-control operation even when stronger evidence makes it inapplicable, and expires on a human prompt, `SessionStart`, task start, `redo`, completion attempt, `Stop` or `Interrupt`. When it legitimately classifies that operation, it becomes exact-operation classification evidence before any separate authority decision. That exact evidence remains bound to the same operation, task and epoch while the human decides, is consumed only when the operation is admitted, and cannot authorize or classify changed input. Task or epoch replacement clears it. Mechanical evidence, hidden composition and native host authority still outrank it.

For one 0.x compatibility release these old names map to the current action:

| Old name | Current action |
| --- | --- |
| `route` | `start` |
| `checkpoint` | `digest` |
| `align result=accepted` | `agreed` |
| `invalidate` | `redo` |
| a supported sensitive `grant` | `allow` |
| `permit` | legacy `classify` |
| `reconcile` | `result` |
| `verify` | `verified` |
| `complete` | `done` |

Extra fields from a compatible old form are ignored only where the mapping defines them. The earlier `classify effect=<effect>` receipt is also accepted for one exact retry during this compatibility release, but no current card emits it and it grants no reusable authority. The emitted continuation always uses current vocabulary. Any receipt absent from this table is rejected.

Closed rejection reasons are: `unknown receipt`, `missing field <field>`, `bad value <field>`, `no task open`, `no Digest shown`, `Digest not agreed`, `stale, before last redo`, `human answer not observed`, `folder not requested`, `project not requested`, `nothing denied to declare`, compatibility `nothing denied to classify`, `declaration contradicts shell write`, and `nothing to allow`.

## Guard hardness

Hardness follows the consequence of letting the observed mistake continue, not the task's programming language or effort label.

| Guarded condition | Level | Evidence behind the level |
| --- | --- | --- |
| Missing folder or project choice | Ask | Only the human owns these two durable names. Continuing would guess user data placement. |
| Sensitive command | Ask | The effect may be legitimate, but the human must authorize the exact operation. |
| Passed verification claimed through inspection while an executable check is available | Ask | A live trial closed over a defective change after treating inspection as if a check had run. |
| Missing task, Digest agreement, result, verification, safe path, or secret boundary | Blocked | Continuing would mutate without authority, lose effect identity, claim stale evidence, escape the folder, or persist sensitive content. |
| Missing effect declaration, hidden operation or unsafe composition | Blocked | A model claim cannot make invisible bytes reviewable or let a possible write enter the read path. |
| Task-folder reminder, accepted transition, completed check, recovery notice, or pending human answer at Stop | Note | The underlying action can continue or the turn merely needs to yield. Blocking here created repeat loops without protecting another boundary. |

These assignments are pinned by the public HG contracts. They do not show that the host delivered every event or that the guarded work is semantically correct.

## Flow enforced by the Codex adapter

The guard keeps transient flow state per Codex session, reusable authority per canonical project and implementation authority per task. A fresh session begins with no active task. Concurrent sessions may select different tasks in one project; neither task can block, authorize or close the other.

1. Reads that resolve PMNM are free. The first project-source read without a task emits a Note; the second is Blocked until `start`.
2. The first project write needs `start`.
3. On first use, the guard asks once for the PMNM folder and once for the project name. If the human supplied either answer before the guard asked, the missing configuration may still be recorded; otherwise a new project name requires a later human turn. An existing configuration cannot be replaced silently.
4. Project creation seeds `project-rules.md` and `project-knowledge.md`. Task creation seeds `index.md`, `plan.md`, `verification.md` and `permissions.json`, plus `impact.md` for Standard and High work; `environment.md` is added only when a persistent local-environment operation needs it. The task-folder card lists only candidate folders: the same id, a name that contains or normalizes to it, or a suffix variant with the same bounded work id. Unrelated folders are not listed and do not stop creation; an exact match resumes the existing folder.
5. At task entry and after Codex startup, resume, clear or compact lifecycle discontinuities, the adapter requires a successful reload of the canonical files that currently exist: `general-rules.md`, mapped `project-rules.md`, `project-knowledge.md`, and the active task's `index.md`, `plan.md`, `verification.md`, applicable `impact.md` and `permissions.json`. The card names that exact set rather than optional paths that are absent. Covered reads correlate by host operation identity when supplied, so a normalized post-use payload does not orphan a successful read. The current complete bytes must still be returned. A command or result that merely names a path is not read evidence. This proves neither comprehension nor application of the prose.
6. `digest` parses the complete `plan.md`, `verification.md`, `permissions.json` and any required `environment.md` before it asks for agreement. It writes every defect to guard-owned `preflight.md` with source, line, rule and correction, then emits one card for the aggregate result. It needs `plan.md` written since the last `digest` or `redo`, with at least one changing file, non-file state or advisory deliverable target. File targets are individual paths. A safe absolute path inside the repository canonicalizes to the same identity as its relative spelling. State targets use a bounded stable id and different before and after values. Every deliverable uses a bounded stable id and has a boundary with the same id that records the strongest relevant alternative, exclusion or uncertainty and its disposition. A directory, duplicate identity, no-op state, orphan boundary or malformed line is reported in the preflight. Standard and High work also needs an actionable verification plan in `verification.md`. The guard validates and binds exact operations and bounded capabilities in `permissions.json` at the same transition; every changing state target needs at least one exact task-scoped operation when it remains future work. A changing state already checked at Digest time is recorded as historical and needs current evidence, not a future operation. A persistent local-environment operation additionally requires current configuration, command indirection, resources, ownership, health, decision, conflict and cleanup. This freshness boundary is the previous `digest` or `redo`, not the latest human prompt or current turn. A clarification turn does not require rewriting an otherwise unchanged plan.
7. Agreement binds canonical file path-and-reason lines, state contracts, the verification plan, the applicable rule basis, the environment preflight and the permission forecast in any order. Checking a box, reordering lines or replacing a safe absolute repository path with its relative spelling changes representation, not agreement. Changing a bound contract needs `redo`. When only direct planned-path comparison is available, a revised Digest retains the recorded identities of earlier paths and adds the new plan paths. Removing an unchanged former target does not manufacture a change; changing it remains visible as outside the revised plan.
8. A write to a path that is not a target is Blocked before it runs. A write to an excluded path is Blocked the same way. A state-changing operation is admitted only when its exact tool and canonical input match a task permission bound to the planned objective. An unlisted or differently bound state operation requires `redo`; one-off `allow` cannot widen a state plan.
9. Every `verified result=passed`, including verification-only work, needs current `example:` and `unchanged:` lines in `verification.md`. A state plan also needs exact current `state:` and `unchanged-state:` lines; an advisory plan needs matching `deliverable:` and `boundary:` lines. After a material change or reframe, the claims must have been written after it. An open planned file objective blocks final passed verification. An open deliverable objective does too, so a syntax, metadata, documentation or exploratory check cannot become final verification. A certain non-persistent verification is observed through the read route, including across a mixed read boundary, and becomes a mutation only when its result changes the project. Persistence or uncertainty remains conservative. Its user-visible card follows that observed workspace delta, never the task phase. Command verification also needs an observed successful check against the current state. Human verification needs a later human turn; the model cannot certify it for the human. The guard checks identity, shape, order and freshness, never truth.
10. A command admitted as verification that changes the project is a project mutation: it clears the prior Digest authority and returns to investigation. `done audit=blocked` records that disposition, clears any final-handoff arming and keeps the task open for corrected work and fresh verification. The first `done audit=passed` after verification audits the current work. With a plan it needs every objective checked; every file target materially changed; every changing state objective associated with a successful exact operation and current matching evidence; every excluded path unchanged; and no change outside the plan. When `impact.md` applies, it also needs the agreed impact contract plus a final omission audit bound to the current verification fingerprint. A no-op or a change later restored to baseline does not satisfy a file target. A successful operation alone does not prove external state. Large files are compared by complete streamed content identity rather than timestamps. At High effort, the audit also needs a current `review.md` bound to the plan hash and verification fingerprint. It must name the contract, changed surface, evidence, strongest concrete counterexample, a different independent check, impact roots, an omission challenge, non-functional dispositions, disagreement and residual limit. Missing, stale, repeated or unresolved review evidence blocks an unqualified passed audit. The guard checks those structural and identity facts; it does not establish reviewer independence, comprehension or semantic truth.
11. Only after that audit passes does the guard request the final Test Digest. Codex's Stop event supplies the latest assistant message; the canonical block starts with `Test — <task id>` or `Prueba — <task id>`, followed immediately by one non-empty line for each field, in this order: Where, Environment, As, Data, Steps, Expect, Evidence, Cleanup and Can run, or their bounded Spanish labels. The ASCII hyphen remains accepted as a compatibility spelling. If Codex omits that Stop event, the next `UserPromptSubmit` may recover only the latest assistant message from a fixed-size tail of the literal host-provided `transcript_path`. Transcript format is not stable. The adapter rejects links, unreadable paths, oversized records or messages, malformed or unsupported records and an older Digest followed by another assistant message. It retains no transcript path or content. A later human response and the repeated `done` close the task. The guard checks presence, shape, ordering and freshness, never semantic truth. The card reports file comparison and state evidence separately; a state-only plan reports no project-file comparison instead of inventing one.
12. The closing card reports how many rules files were written during the task. Starting the same completed task opens a fresh epoch. Starting another task in the same session cannot erase an operation in flight. When current work has observed but unfinished effects, the guard asks once whether to pause it and switch; a later human response plus the repeated `start` isolates the successor from the prior task's agreement, counters and task permissions. Another session begins task-neutral and may select a different task immediately. If another session changes the same task after it was loaded, material work is Blocked until explicit `start` reloads the newer revision and the agent reconciles any conflicting conclusion.

An exact project-declared read or verification command may run without an implementation Digest when it has no project mutation. The agent must still report its exact scope and limitation. Any project write returns to steps 5–9.

Starting the same open task is idempotent. Effort may rise but cannot fall silently. A later prompt does not by itself invalidate an agreed Digest. New evidence that changes it requires `redo`; this is an agent obligation, not something the guard can infer from prose.

## PMNM folder boundary

The host pointer is `<CODEX_HOME>/pmnm.path`, or `~/.codex/pmnm.path` when `CODEX_HOME` is not set. It contains one absolute path and nothing else. The PMNM folder begins as:

```text
<PMNM folder>/
  index.json
  general-rules.md
  projects/<project>/
    project-rules.md
    project-knowledge.md
    tasks/<task>/
```

`index.json` belongs to the guard. It maps canonical repository paths to stable project folders. The model writes the rules and task contents.

An existing path under `projects/` that is absent from `index.json` is occupied, not evidence that it belongs to a new repository. The guard preserves it and selects an unused collision-safe folder for the new mapping.

The human's first folder answer authorizes ordinary work anywhere strictly inside the PMNM folder. There are no per-task schema approvals or per-file permission receipts. The guard still checks:

- the destination resolves physically inside the folder;
- neither the destination nor an internal component is a symbolic link or special file;
- a mixed operation does not cross the folder boundary;
- the operation does not write `index.json`;
- added content and copied sources do not look like secrets.

The PMNM folder cannot be the repository, the host configuration directory, the filesystem root, or an ancestor of either. Ordinary maintenance strictly inside it, including moving or deleting an internal task artifact, remains inside the free-write boundary. Moving, deleting or replacing the PMNM root itself does not. Evidence may be copied from elsewhere into a task folder, but linked sources, linked destinations and secret-like sources fail closed.

An existing empty folder is seeded before its pointer is written. If the pointer or `index.json` is invalid, the guard asks for one explicit recovery decision, preserves the invalid artifact under a unique recovery name and only then rebuilds it. It never overwrites unreadable state merely because the intended replacement looks obvious.

The secret scan recognizes common private-key, token, credential and password shapes. It never echoes a detected value. It is a bounded heuristic, not a complete secret scanner; host sandboxing and repository review remain necessary.

## Commands and effects

The guard classifies the observable command, not the project's language or toolchain. Its effect classes are:

- investigation;
- implementation;
- verification;
- deletion;
- movement;
- version-control change;
- dependency change;
- publication;
- environment change;
- network access;
- a direct write outside both the repository and the PMNM folder.
- a planned non-file state change.

The adapter has no positive executable catalog. An executable name, familiar flag or remembered convention is not evidence that an operation reads, writes or verifies. Apart from literal shell structure, every operation without trusted host effect metadata starts on the same dynamic declaration route.

The shell envelope still recognizes narrow mechanical contradictions and high-consequence signals: hidden or dynamic composition, output redirection, deletion, movement, version-control mutation, dependency mutation, publication, environment lifecycle, network access and direct filesystem writes. These rules prevent a model declaration from downgrading an observable hazard; they do not make other commands safe. A literal ordinary write outside both the repository and PMNM folder counts as sensitive, including when it appears beside an otherwise admissible command. A literal `cd <directory> && <command>` prefix preserves the nested operation and target base. Any other compound or hidden operation must be split until one complete effect is reviewable; more than one independently sensitive effect must also be split. A declared outer wrapper does not reveal its nested behavior. Dynamic or opaque inner commands remain unknown.

For one isolated operation, the agent declares expected effect, boundary, persistence, certainty and an applicable capability id or `none`. This is a falsifiable claim, not permission. Before the operation appears, it can classify only the one same-turn operation described above; after a denial it binds to that exact tool input for one retry. When proactive intent legitimately classifies the operation, the guard binds the same claim to that exact tool input before evaluating separate authority. A sensitive Ask does not discard that classification, and an allowance does not recreate it; admission consumes both independently. Proactive intent has no operation hash before it is applied, so it can classify but never pre-authorize a sensitive effect. The concrete operation must appear before an exact sensitive allowance can be bound. Uncertain declarations and boundaries outside the project or PMNM folder retain a sensitive authority path. A declaration that contradicts an observed write is rejected. If command bytes are hidden, declaration is unavailable because the human and guard cannot review the operation.

Predictable exact sensitive operations may be listed in `permissions.json` and approved with the plan Digest. The same file may declare a bounded capability when the human intends to reuse an operation family. A capability names its provider-neutral effect, boundary, persistence, operation shape, constraints and reason. Task capabilities expire with the task and Digest. Project capabilities remain bound to the same canonical project until an explicit replacement revokes them; `project: []` revokes every earlier project capability. The agent may cite only an already agreed capability whose effect, boundary and persistence match; the declaration cannot create one. Shape and constraints remain human-readable semantic boundaries: the guard cannot prove that arbitrary command arguments satisfy them, so mechanical hard stops and native host controls remain authoritative.

A planned state transition is always task scoped, names its plan objective and uses an exact operation rather than a reusable capability. Trusted host metadata or a mechanical signal keeps a more specific classified effect when one exists; `state-change` is the conservative fallback for an exact covered operation with no other supported effect. Such an operation may bind another covered host tool by its exact canonical JSON input. Forecast entries are bounded, secret-scanned and bound to the current agreement; the guard persists hashes rather than raw input in its private state. This optimization covers only tools named by the Codex hook and never bypasses native host approval.

After a clear later human answer to an unforecast command, the agent sends `allow`; the guard admits only the identical operation once. The Ask shows the complete bounded one-line command, or a small direct-file write; if the operation cannot be shown in full, the guard requires it to be split or shortened before asking. A permission for one effect, task, epoch or command cannot be spent on another. PMNM does not commit, push, tag or publish by itself.

An ordinary write strictly inside the PMNM folder is free even before the plan Digest. A sensitive command remains sensitive when its output happens to land there.

Geometry is evaluated before authority. A repository mutation enters the plan-Digest path. A contained PMNM write enters the folder path. An external-only effect asks for its own exact authority and does not invent a repository plan. When the host or shell envelope exposes literal targets, the guard checks them; a familiar tool name never substitutes for target evidence.

Shell actions generated by the adapter quote every literal path accepted by PMNM; the displayed command is the command the guard evaluates.

## Host results and recovery

Pre-use admission is not evidence that the operation ran. The adapter binds each admitted effect to its tool, host operation identity when available, full operation identity, task and epoch. A matching successful post-use event records the effect. A reported failure records no mutation. Non-persistent verification is tracked as a check without presuming it wrote; an observed changed target still promotes it to a project mutation and invalidates dependent authority.

When no result arrives, another write cannot overtake it. Reads remain available for diagnosis. `result outcome=no-effect` records the current belief while retaining enough identity to recognize a contradictory late success. `result outcome=unknown` preserves the possible effect and enters recovery, but does not count as a successful state operation. An Interrupt with a write in flight also enters recovery.

A late successful result is counted once, invalidates dependent verification when necessary and tells the model to inspect the current state. Conversation age never turns an unknown result into success. A successful state-operation mark is bound to the task epoch, plan identity and permission-forecast identity; a revised contract cannot reuse it.

Stop may block once in a turn for a missing result, missing verification or unfinished audit. A successful external or system effect enters the same verification and audit path even when no project file changed, and it blocks transition to another task until that path is complete. When a folder, project, Digest, inspection exception or sensitive-command answer is already pending, Stop emits a Note and yields; it does not compete with the earlier Ask. Repeated blocking Stop in the same turn becomes a Note with the same continuation so the host does not loop.

A successful standalone curation write to `general-rules.md`, `project-rules.md` or `project-knowledge.md` may stop without the generic missing-Digest reminder only when `plan.md` was not materially written and no project or system effect exists. Before such a write, the guard requires a current reload of all three canonical files and detects a concurrent revision; this is freshness evidence, not semantic approval of the promoted claim. A curation write inside broader work never waives its Digest, verification or audit.

## Verification and fingerprint

`verified` records result, method, epoch, current mutation/effect counters and the current claim identity. Every passed result needs current `example:` and `unchanged:` claims; state plans also require exact state claims matching the agreed contract. Planned file objectives must be marked complete before final passed verification. `how=command` with `result=passed` requires a successful observed verification command after the latest material change. `how=human` requires an actual later human response. When project evidence exposes an executable check, `result=passed how=inspection` asks the human to accept that weaker evidence or directs the agent to run the check. Other inspection remains an explicit weaker channel; the guard does not turn an administrative check, model-authored claim or successful state operation into truth.

The guard prints a timestamped fingerprint. When a compatible version-control provider is present, it reports the exact available base, current revision and counts for staged, unstaged and untracked paths. An unavailable parent or upstream is reported as unavailable, never replaced with the current revision. Without a provider, it reports only distinct project targets observed by PMNM. At closure, file comparison and the count of observed planned state objectives are reported separately. The fallback never invents version-control state or turns those counts into semantic proof.

The fingerprint is an audit binding, not proof that the diff is correct or complete. Tools outside the covered host events can change files without the guard seeing them. The final audit must reconstruct the whole surface independently.

## State and privacy

Codex adapter state lives under `PLUGIN_DATA/host-guard/v3` in three layers. A session file holds the selected task, pending operations, questions and other transient flow. A project file holds only reusable project-scoped permissions and capabilities. A task file holds that task's Digest authority, plan and evidence counters, verification and completion state. Canonical working-directory and task hashes keep aliases on the same durable identities, while the session id keeps simultaneous conversations independent. Each layer uses its own bounded lock and monotonic revision. State contains hashes, enums, counters, bounded event metadata and fingerprints; it does not persist raw prompts, command previews, tool output, evidence or secrets. It also retains no transcript paths or transcript content.

A fresh session does not read a “latest task” pointer. It remains task-neutral until an explicit `start`. Different sessions may advance different tasks under one project. When two sessions select the same task, a newer task revision is observable: reads remain available, but material work waits until explicit reload and reconciliation. This is conflict detection, not automatic merging.

State files and locks are real local files with bounded size. Writes are atomic. A corrupt current state, corrupt resumable state, unsafe pointer, unsafe index or unresolved physical path fails closed for mutation. Reads remain available when their effect and boundary are established.

## Coverage

The bundled hook listens to Codex `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop` and `Interrupt`. `SessionStart` distinguishes startup, resume, clear and compact sources when the host supplies them; an active task then enters rule-basis reload before material work. Its write coverage is limited to the host tool names declared in `hooks/hooks.json`. A tool not emitted through those events is outside the adapter's evidence. The entry runtime is `pmnm-guard.mjs`; its only local runtime dependency is the independently reviewable `pmnm-shell.mjs` classifier. Packaging accepts exactly that local module graph, regular in-package files only, with per-file and aggregate inspectability budgets.

`evals/host-guard-cases.json` lists the stable synthetic claims. `evals/host-guard-action-oracle.json` contains executable normalized sequences. `scripts/test_host_guard.mjs` runs both the direct adversarial cases and the public oracle.

Those tests establish behavior for supplied events. They do not establish host discovery, hook trust, live client execution, semantic understanding, complete filesystem mediation or another host's compatibility. Verify discovery, review, trust and observed interception separately after installation.

## Host adapter contract

Keep the portable skill and PMNM folder unchanged. Add a host-owned adapter with:

1. a separate adapter declaration and lifecycle mapping;
2. a private state location owned by that host;
3. the same observable receipt meanings and two-line card contract;
4. native tests for admission, result matching, interruption and resumption;
5. an explicit tool-coverage boundary;
6. an installation test in the real host.

Do not make a generic adapter by taking the weakest intersection of host APIs. Share a pure engine only after both adapters have independent passing evidence and the extraction preserves each host's stronger guarantees.
