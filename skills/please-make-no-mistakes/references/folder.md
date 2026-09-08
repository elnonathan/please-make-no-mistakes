# The PMNM folder

Where you write. One folder per machine, one folder per project inside it, one folder per task inside each project. You need no permission for anything inside; you never write a secret there.

## Layout

```
<PMNM folder>/                       asked once per machine; ~/PMNM suggested
  index.json                         projects and their repository paths; one runtime owner
  general-rules.md                   rules for every project and for this human
  projects/<project>/
    project-rules.md                 human-owned always and never instructions
    project-knowledge.md             reusable claims, each with its own basis
    tasks/<task>/                    one per ticket or task; the task folder
```

The host's config directory (`.codex`, `.claude`, another host's) holds only a pointer to the PMNM folder. Any host reads the same folder. The Codex adapter uses `<CODEX_HOME>/pmnm.path`, or `~/.codex/pmnm.path` when `CODEX_HOME` is unset. Another integration must declare its one literal pointer path.

At session entry, choose one mode. With an active guard, start the task through the guard and follow its card; the guard owns pointer and project resolution. Without a guard, inspect that literal pointer file only. Never search the home directory, temporary directories, conversation history or unrelated repositories to discover it. A missing pointer means ask the first folder question and stop here; no more actions until the human answers; no repository investigation before that. It never means search for a plausible old folder or create one at a guessed path.

Without a guard, once the pointer resolves, inspect `index.json` before source. A missing index or missing canonical working-directory mapping means ask the project name, recommend the working-directory name and stop here; no more actions until the human answers. Do not inspect the repository until that later answer establishes the mapping. With a guard, follow its project card instead.

With the mapping established, load `general-rules.md`, then the mapped `project-rules.md` and the relevant claims from `project-knowledge.md`. Resolve the current task id, create its task folder when absent and seed the current understanding there before reading source. This write is automatic and cannot wait until the final summary. A session selects one task at a time, but the project does not: concurrent sessions may select different task folders without sharing task authority or transient state.

## Project index

`index.json` has one writer at a time. With a guard, the guard alone maintains `index.json`; the agent never edits it. Without a guard, the portable agent maintains the same `pmnm.projects/v1` schema after the human answers the project-name question. Never let both maintain it for the same operation.

```json
{
  "schema": "pmnm.projects/v1",
  "pointer_version": 1,
  "projects": [
    {
      "cwd": "/canonical/absolute/project/path",
      "name": "project-name",
      "folder": "projects/project-name"
    }
  ]
}
```

Preserve every valid existing mapping. Canonicalize the working directory. Give it exactly one entry and a stable, safe project-folder name. If that folder name is already mapped to another directory, or its path exists without a mapping, preserve the occupied path and choose another collision-safe name. Write the complete JSON atomically inside the PMNM folder, then create `projects/<project>/tasks/`, `project-rules.md` and `project-knowledge.md`. Do not ask another question.

## The four questions

These are the only questions you ask about the folder. Everything else you decide.

1. Where the folder goes. Once per machine. "Where should I create the PMNM folder? I suggest ~/PMNM." Ask before inspecting the repository or creating either path. On the later answer, create or seed the folder before storing its absolute path at the same literal host pointer you inspected, never inside the PMNM folder. Then ask the project name and end that turn. If the pointer exists and the folder is gone: "The PMNM folder is not at <path> any more. Did it move, or should I create it again?" If the pointer or index is invalid, preserve it under a unique recovery name and rebuild only after the human chooses that recovery.
2. The project name. Once per repository. "What is this project called? I suggest <repository name>."
3. Whether a found task is this one. Only when exact or normalized identifier evidence produces a candidate. "Are you working on <id>? I found a task folder that says <x, y, z>." An exact id resumes. A candidate answer leads to one explicit adoption path or one explicit new-folder path. Unrelated folders never trigger the question.
4. Rule level. When the human states an always or a never. "Save it as a rule of this project, or general?"

## Task folder

The task folder is what you know about what you are doing. It is the evidence behind every line you change, the record a human audits, and the way you explain the human's own process back to them. It survives a context compaction; your memory does not.

Create it before investigating. Every task folder has `index.md` as its stable retrieval surface. The guard also seeds `plan.md`, `verification.md` and `permissions.json`, plus `impact.md` for Standard and High work; fill them and never rename them. The remaining responsibility files are optional; add or drop them as the task needs. Write to the folder as things happen, before a dependent step could make them costly to reconstruct.

```
tasks/<id>/
  index.md          five lines: what the task is, current state, next step, open questions, links
  plan.md           the promise: file and non-file state objectives, plus what must remain unchanged
  verification.md   actionable plan, current file and state claims, and what each check proved
  impact.md         local rationale or transitive impact ledger, matrix and omission audit
  permissions.json  exact sensitive operations; state changes bind to task objectives
  environment.md    current operational preflight when persistent local resources may change
  preflight.md       guard-owned aggregate metadata diagnosis, created when a Digest is attempted
  context.md        the request as understood, files that matter, constraints found
  decisions.md      each decision with its evidence and what was rejected
  handoff.md        the test Digest and where to resume
  operation.md      bounded package when another actor will execute consequential work
  provenance.md     material source and attribution links, one relationship per claim
  artifacts.md      external evidence custody, identity, privacy and evidentiary limits
  artifacts/        exact copies deliberately retained with the task, when any
```

Keep these canonical names when their responsibilities exist; do not invent spelling variants. The agent fills the canonical task files; an active guard owns `preflight.md` and replaces it with the latest complete validation result. Add another file only when it has a distinct task-specific responsibility, and link its actual name from `index.md`.

`operation.md`, `provenance.md`, `artifacts.md` and `artifacts/` are optional. Their names are canonical when those responsibilities exist; their absence does not make a task incomplete. Load the evidence-artifact reference before copying or moving external evidence.

`impact.md` is required for Standard and High implementation with repository file targets. It contains either a concise local rationale or the transitive worklist, ledger, dynamic-boundary dispositions and six-dimension review defined in [impact analysis](impact-analysis.md). Light work and tasks with no implementation file target do not need an empty impact artifact. The plan Digest binds its pre-implementation contract. Final closure adds the current verification fingerprint and an independently derived omission review without changing that bound contract.

`plan.md` is read by the guard at `digest`, at every covered material operation and at `done`. Order of lines does not matter. A file target uses `- [ ] <path> — <what changes>` and a preserved file uses `- [ ] excluded: <path> — <why>`. A material result outside repository files uses `- [ ] state: <stable-id> — <before> => <after>`; preserved state uses `- [ ] unchanged-state: <stable-id> — <invariant>`. A material advisory result uses `- [ ] deliverable: <stable-id> — <result>` and pairs with `- [ ] boundary: <same-id> — <strongest relevant alternative, exclusion or uncertainty and its disposition>`. Two lines for one path or objective id are one line; write it once. A directory is never a file target; list the files. A safe absolute path inside the repository and its repository-relative spelling have the same identity. State before and after must differ. An excluded path, unchanged-state or boundary line is a promise to preserve its contract. A changing state already marked `[x]` when the Digest is shown is historical: it needs present evidence but no invented future operation.

Every changing state objective has at least one exact task operation in `permissions.json`, identified by the host tool and its complete input. The operation is authority to attempt the transition, not evidence that its result is true. Record current state evidence in `verification.md`, keep the result checked in `plan.md`, and revise the Digest before using an unlisted or differently bound state operation.

Write the basis of each entry: observed, inferred, reported by the human, assumed. Keep the index short; detail goes in the file responsible for it.

After compaction, resume, clear or a new session, memory is not evidence. Reload `general-rules.md`, `project-rules.md`, and the active task's `index.md`, `plan.md`, `verification.md`, `impact.md` when present and `permissions.json` before material work. Load `environment.md` too when the next operation depends on local resources. A path merely named in a command is not evidence that its current contents were returned or understood. Then continue from the recorded next step instead of reinvestigating settled work. When the human asks why a line changed, quote the decision and its evidence.

Related diagnostics, environment findings and follow-up work stay in one task when they share the same bounded work id and outcome. A suffix in a folder name is not a new task by itself. Split only when the human identifies a separate deliverable or the work has an independent completion contract; link both task indexes when you split. When a different task is named within one session while current work is unfinished, record its pause or continuation once before switching. The new task never inherits the prior task's agreement, evidence counters or task-scoped permissions. A fresh session begins task-neutral. Two sessions may work on different tasks in the same project; two sessions on the same task must detect and reconcile a newer task revision before either writes from stale authority. An explicit reload never discards an operation whose host result is still pending.

## Project knowledge and rules

`project-knowledge.md` holds reusable facts and procedures learned from repository, runtime or human evidence. Keep each claim separate so one strong observation cannot raise the certainty of a neighboring inference.

```text
## <topic>
- applies: <bounded surfaces or conditions>
- current: <one reusable claim>
- basis: reported | observed | derived | inferred | assumed | unknown — <support>
- last checked: <date or revision>
- revisit when: <condition that could make it stale>
- source: <task id and recoverable evidence>
```

Split mixed-certainty statements into separate entries. “Applies to every task” widens `applies`; it does not turn a diagnosis into a rule or make an inference observed. Promotion happens during the task audit, never merely because a finding worked once. For every candidate, choose `promote` or `task-local` with a reason. Promote only corroborated reusable knowledge, preserve its basis and freshness, and link back to recoverable task evidence.

A decision belongs to the task folder. A rule is a human-owned instruction about something that must always or never happen. Rules come from the human's direction ("always", "never", "from now on"), not from the agent deciding that one observed convention should become policy. A one-time answer, diagnosis, command or repository convention is a decision or knowledge, not a rule.

Shape, one per line:

```
- <one sentence: one verb, when it applies>. (from <task id>, <date>)
```

One sentence, one verb, when it applies, then where it came from. Project rules govern this project; general rules govern work across projects. Record whether the audience is the human, a third party or both when that changes how the rule should be applied. A new rule that contradicts an old one replaces it: "Rule replaced: <old> by <new>." Before curation, reload general rules, project rules and project knowledge; check concurrent changes, contradiction, overlap and whether one example has been overfit into policy. Merge or replace instead of appending a competing entry. The human's current instruction wins over all three.

A standalone task that ends after one approved write to `general-rules.md` or `project-rules.md` needs no implementation Digest. Once `plan.md` has been materially written, or the task has a project or system effect, a rule write cannot waive its Digest, verification or audit.

Only after repository evidence establishes a stable working convention, record it in `project-knowledge.md` with its actual basis and freshness boundary. Never write an unknown, pending fact, task decision or unsupported inference as a project rule. Keep task-local material in the task folder and record why it was not promoted. Do not ask about a concrete convention the repository already proves. Do not create an alternate canonical rules or knowledge file to avoid reconciling the existing one.

## Across projects

The working directory decides the project. Read another project's folder when the human points to it ("in OOO I solved something similar"). Write only in the current project's folder.

## Privacy

No secrets, tokens, keys or passwords anywhere in the folder; record where they live instead. Third-party personal data only when the task needs it and the human knows.
