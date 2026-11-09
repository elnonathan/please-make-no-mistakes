# Contributing

Please, Make No Mistakes keeps one portable Agent Skill and one optional destructive-operation brake for Codex and Claude Code. `skills/please-make-no-mistakes/SKILL.md` is the contract every change serves; a change that cannot name the kernel sentence it improves is not ready. Contributions should make a demonstrated failure less likely without turning one person's project, toolchain or preferences into a universal rule.

## Requirements

- Node.js 22 or 24 for the brake and JavaScript tests
- Python 3.9 through 3.13 for dependency free release validators
- no runtime registry dependencies

## Before Changing Behavior

Start from an observable failure, an accepted design decision or a bounded compatibility requirement. Record what currently happens and which check would distinguish the desired behavior. Add the smallest failing evaluation before changing the runtime when a deterministic surface exists.

Do not solve a model communication problem only by adding another guard. Improve the shortest portable instruction first. A guard is justified when a real trial shows that prose alone is skipped and the host exposes a reliable event boundary.

## Writing Rules For Models

- State the pattern, never a worked example. Public prose and cards use shapes with placeholders; an example teaches the instance, not the rule.
- A card's `NEXT:` line is an order: one verb in the imperative or a short sequence joined by "then", its limit, and who acts next. It names the one next action and may name what the human can do instead. No explanation beyond its limit, no alternatives the model must weigh, no "wait", no "turn". Stopping is written as: stop here; no more actions until the human answers.
- A claim the hook cannot observe is not written on a card. The hook states what it recorded, not what the model meant.
- A small model must be able to read the sentence and act on it. When it cannot, the sentence is wrong, not the reader.

## Source Of Truth

- `skills/please-make-no-mistakes/SKILL.md` owns the portable kernel and reference routing.
- `skills/please-make-no-mistakes/references/` owns condition specific procedures.
- `hooks/pmnm-brake.mjs` owns classification, approval tokens, sealed state and cards for both hosts; `scripts/test_brake.mjs` owns its tests.
- `hooks/pmnm-guard.mjs`, `hooks/pmnm-shell.mjs` and `hooks/claude/pmnm-claude.mjs` are the retired interlock, unregistered and kept for rollback.
- `evals/host-guard-cases.json` owns the retired interlock's stable guard claims, kept for rollback.
- `evals/host-guard-action-oracle.json` owns the retired interlock's normalized Codex event sequences and expected actions, kept for rollback.
- `evals/activation-cases.json` and `evals/agent-evaluation-cases.json` own model selection and blind routing fixtures.
- `evals/behavior-cases.md` owns observable portable behavior cases.
- `scripts/documentation_contract.py` owns public documentation invariants.
- `SETUP.md` alone owns detailed installation, update, rollback, removal and verification commands.

Private coordination under `.ai/` can explain intent and preserve evidence. It never changes public behavior by itself.

## Host Isolation

Do not extend the brake to a host by resemblance. Preserve the brake's behavioral outcomes, then implement each host's input and output against its documented native events and test them independently.

Changes to the brake must not silently redefine the portable skill. Changes to the portable skill must not claim enforcement that no host provides.

## Focused Checks

Run the narrow check while iterating:

```text
npm run test:brake
```

For the retired interlock source:

```text
npm run test:host-guard
npm run test:claude-adapter
```

For the Claude Code hook registration:

```text
npm run test:claude-discovery
```

For documentation changes:

```text
npm run test:documentation
```

For blind decision fixtures:

```text
npm run smoke:evaluation
```

Before a release readiness claim:

```text
npm run release:verify
```

Each check must state what it can falsify. A validator pass is not behavioral evidence from a live model or host.

## Documentation Ownership

- `README.md` explains the product and routes setup elsewhere.
- `SETUP.md` is the single detailed setup procedure.
- `ARCHITECTURE.md` describes component and trust boundaries.
- `docs/architecture-decisions.md` records durable public rationale.
- `docs/distribution.md` owns release identity and supply chain procedure.
- `docs/getting-started.md` explains expected use.
- `SECURITY.md` owns supported security claims and reporting.
- `CHANGELOG.md` records user visible release changes.
- `ROADMAP.md` records deferred public work without promising dates.

Do not duplicate setup commands outside `SETUP.md`. Do not publish local paths, private task folders, raw internal evaluations, credentials, customer data, internal identifiers or maintainer handoffs.

## Evaluation Changes

A behavior change needs:

1. a case that failed before the change
2. the smallest implementation that closes it
3. a negative or adversarial case where overreach would be harmful
4. exact test results and remaining limits

Blind evaluation inputs must not contain their expected decision. Deterministic graders may keep expected outcomes in code, separate from the prompt sent to a model.

Model trials must record the exact skill and guard identity, host, model, effort, available tools, prompt, source fixture, human turns, writes, verification and cleanup. Sanitize private source and personal data before publishing any result.

## Pull Requests

Describe the observed problem, contract change, evidence, affected public surfaces, tests run and residual risk. Keep unrelated cleanup separate. Do not claim installation, hook trust or live behavior from package validation alone.
