# Getting Started

## First Request

Once installed, ask your coding agent for the software work you actually need. PMNM is designed to activate for investigation, design, implementation, debugging, refactoring, review, verification, migration and resumption when the work can materially change a system.

```text
<what is wrong or wanted>. Show me the plan, implement the smallest supported change and verify it.
```

You may invoke the skill explicitly when the host supports it:

```text
$please-make-no-mistakes <the work you need>
```

The agent should begin with the result it is trying to establish, not a recital of PMNM rules.

## The First PMNM Folder

On first use, PMNM inspects only the literal pointer path declared by the host integration. It never searches the machine, history or unrelated work for a plausible PMNM folder. If the pointer is absent, PMNM asks where its folder should live, suggests `~/PMNM`, and stops there: no more actions until you answer, no repository inspection before that. The host stores only a pointer in its own configuration area. The folder itself stays outside repositories and installed packages.

The first repository adds one more question: its project name, with the repository name as the suggestion. The agent then creates task folders as work begins without requesting permission for each file.

The only other folder questions are whether a possibly matching task folder is the same work, and whether an always or never should become a project rule or general rule. No storage schema, per task approval or file layout decision belongs to the user.

## When The Codex Guard Is Active

The Codex plugin includes an optional lifecycle guard. After you review and trust its current definition through `/hooks`, covered events can make a skipped transition observable. In Claude Code, enabling the plugin runs its adapter without a separate trust step.

A card has two lines: what happened, and `NEXT:` with one exact action. Its first word is the level. Blocked means the action did not run. Ask means you answer next. Note means continue. A card is not a question for you: the agent reports it in one sentence and takes the `NEXT:` action; after an Ask it stops until you answer.

The guard is intentionally partial. It can enforce declared order for events Codex sends it, but it cannot establish product intent, evidence quality, complete tool coverage or semantic correctness. When it is absent, disabled, untrusted, unsupported or bypassed, PMNM continues as a portable advisory skill.

## Shared Understanding

The agent investigates before proposing a change. It follows the observable path, checks consumers, searches for an existing contractually equivalent pattern and tries to disprove its own leading explanation.

Technical facts that the repository or available tools can settle remain investigation. The agent asks the human only for product intent, priority, risk acceptance or another decision evidence cannot make.

A task folder starts with `index.md`, `plan.md`, `verification.md` and `permissions.json`, and is updated as understanding changes: what was read and what it showed, what was decided and why, what was rejected, what was verified. Reusable claims move to project knowledge with their original certainty; human-owned always-or-never instructions remain rules. After interruption, the folder outranks conversation memory.

## Before A Material Change

Before showing the Digest, the agent writes `plan.md`: one line per file the implementation will write, one per file that must stay as it is, and one per material non-file state transition or invariant. A state transition names explicit before and after values and an exact task operation in `permissions.json`. The agent also writes an actionable verification plan and lists every predictable exact sensitive operation by task or project scope. The Digest reads that combined contract aloud. The agent shows one plan Digest after investigation and before changing the project or external state:

```text
Digest — <task>
Understanding: <requested result>
Current state: <what the system does and the evidence>
Change: <bounded implementation>
Verification: <checks that can challenge the result; the wrong path and the observation that would expose it>
Permissions: <exact sensitive operations by scope, or none>
Ambiguities: <material uncertainty or none>
Trade-offs: <material cost or none>
Do you agree?
```

You answer in a later turn; the agent stops there. Agreement authorizes implementation inside that Digest. A correction, changed direction, wider surface or new evidence that breaks it requires a revised Digest and fresh agreement.

The Digest may group predictable exact sensitive operations into one decision when the host can bind them. Task permissions end with the task or a withdrawn Digest. Project permissions survive only for the same project and exact operations, and can be replaced or revoked. A changed or unlisted ordinary sensitive operation asks again. An unlisted state-changing operation requires a revised Digest because it changes the outcome contract. Native host approval remains controlling. A compound operation with an unknown part or several sensitive effects is split before authority is presented.

## When Direction Breaks

New evidence sometimes invalidates work already done. The agent should stop the dependent direction, state the corrected current understanding, preserve what remains valid, mark the rejected hypothesis as history and investigate what changed.

If the correction changes the plan, the next implementation starts only after a new Digest. A successful later test cannot retroactively validate an abandoned premise.

## Verification

Verification is selected by the changed contract, not by the name of a test layer. Every passed result needs two current claims: the request's own case and the thing that must not change. A state plan also repeats its exact state contracts there. After a material change, the agent writes them in `verification.md` after its last change, then obtains the evidence against that state. A successful state operation proves only that it ran, not that the resulting state is correct. Human verification waits for the human's later report. A check that changes the project returns the work to investigation and a revised Digest. The agent runs the strongest sufficient accessible check and says exactly what it proves and does not prove. Product failures remain separate from environment, fixture and tool failures.

After implementation, the test Digest gives the human an exact handoff:

```text
Test — <task>
Where: <screen, URL, endpoint or command>
Environment: <runtime and setup>
As: <role, account or caller characteristics>
Data: <safe fixture and provenance>
Steps: <ordered actions>
Expect: <observable result at each material point>
Evidence: <what to retain>
Cleanup: <what to restore or why none is needed>
Can run: <yes with the available capability, or no with the exact limitation>
```

Before handing the run to you, the agent checks whether the host and project expose interface automation, a real entry route, safe data access and the needed environment. When it cannot run the check, it names the missing capability instead of presenting instructions as executed evidence. The final audit requires current passed verification and walks `plan.md`: every file materially changed or excluded for its reason, every state objective supported by its exact operation and current evidence, nothing material outside it. A no-op or a file restored to baseline is not a completed target. The audit tests the completion claim and names file comparison and state evidence separately. A state-only task says no project-file comparison occurred. Under the guard it also names the fingerprint of the observed source and state boundaries.

## Resuming Work

A fresh conversation reads the task index first and only the detail needed for the next step. It should be able to state current status, decisive evidence, open uncertainty and the next action without repeating finished investigation.

General rules load before project rules. Current human instructions outrank both. Decisions stay in their task folder. Only an explicit always, never or prevention intent can become a rule, and the human chooses whether it is project or general.

## Requests That Should Stay Light

PMNM should not impose its full flow on a factual question, an isolated prose edit or a mechanical transformation.

Explicit invocation still activates the skill. A small implementation can use Light effort, but it still has a compact Digest before the write and a direct check afterward.

## Reading Evaluation Evidence

Source validators can prove that declared files resolve, package identities agree, public boundaries hold and covered guard transitions match their executable fixtures. Artifact checks can prove exact packaged and installed bytes. Neither proves that a particular model followed the skill, that a host trusted or invoked a hook, or that the implementation is correct.

Behavioral confidence requires a fresh session using the exact candidate, representative positive and negative prompts, recorded source state and explicit comparison across relevant model and host configurations. See the [evaluation guide](../evals/README.md) and [distribution boundaries](distribution.md).
