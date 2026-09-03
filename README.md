# Please, Make No Mistakes

<p align="center">
  <img src="./assets/pls.png" width="280" alt="The Please, Make No Mistakes mascot">
</p>

<p align="center"><em>pls</em></p>

<p align="center">
  <a href="https://github.com/elnonathan/please-make-no-mistakes/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/elnonathan/please-make-no-mistakes/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/please-make-no-mistakes"><img alt="npm version" src="https://img.shields.io/npm/v/please-make-no-mistakes?style=flat-square"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-72e0a8?style=flat-square"></a>
  <a href="https://developers.openai.com/codex/skills"><img alt="Format: Agent Skill" src="https://img.shields.io/badge/format-Agent%20Skill-8b5cf6?style=flat-square"></a>
</p>

<p align="center"><strong>Epistemic integrity for software engineering with AI.</strong></p>

Please, Make No Mistakes (PMNM) is a portable agent skill for work where context, evidence, and consequences matter. Its Codex plugin also includes an optional lifecycle guard that makes skipped transitions observable on covered local write paths.

> “Please, make no mistakes” is an impossible request. This project does not promise infallibility. It makes avoidable mistakes harder to miss.

## Install

Share [this repository](https://github.com/elnonathan/please-make-no-mistakes) with your coding agent and ask it to install PMNM by following [SETUP.md](SETUP.md). The setup guide identifies the host that is actually running, selects a supported registration route, preserves existing configuration, and verifies the installed skill and any host adapter separately.

Codex is currently the host with a complete tested marketplace path in this repository. Another host should use its own documented skill or plugin mechanism. npm can carry the exact artifact, but installing the package alone does not make a host load it.

The Agent Skill is the portable part of PMNM. The bundled lifecycle guard is currently implemented and tested only for Codex. Claude Code and other hosts remain in advisory mode until they have a separately implemented and verified adapter. Similar hook names do not establish compatibility, and a future host adapter must not replace the Codex hook or weaken its tested behavior.

The public package contains the same runtime artifact under [skills/please-make-no-mistakes](skills/please-make-no-mistakes). Detailed installation, update, rollback, removal, and verification procedures live in SETUP so neither the user nor the agent has to invent missing steps.

## Why it exists

Many damaging mistakes begin before code is written: an inference becomes a fact, a search miss becomes proof of absence, a nearby helper is assumed to have an equivalent contract, or one passing check becomes a claim of complete correctness.

PMNM grew out of notes I kept during months of daily work with coding agents. They began as a response to a recurring frustration: an answer could be plausible, polished, and internally coherent while still being wrong for the system around it.

Over time, those notes became a working discipline for keeping context, evidence, and human judgment in the loop. The skill turns that accumulated experience into a process where a collaborator can question the direction and an agent can show what supports its reasoning before the cost of being wrong grows.

## What changes when it is active

1. **Shared understanding comes first.** Applicable instructions and context are resolved before an identified activity, and the objective, scope, authority, constraints, unknowns, and success conditions become visible before a material direction hardens.

2. **Evidence precedes implementation.** Relevant paths, consumers, existing mechanisms, risks, and counterevidence are inspected before a solution is treated as defensible. Tools are selected for a named claim, and their suggested next calls are followed only when they can resolve a material gap.

3. **The human remains in the decision loop.** When materially different directions remain, the agent presents what it knows, what it does not know, and what decision is needed.

4. **Potential regressions are planned before code.** A provisional scenario seed guides investigation, then expected behavior, affected consumers, preserved invariants, negative paths, boundary cases, and residual risk become a shared scenario contract.

5. **Readiness is explicit.** The agent shows whether the work is ready, incomplete, or blocked before the first material implementation step. When the bundled Codex guard is enabled and trusted, an omitted transition can block covered local writes without pretending to prove the underlying reasoning.

6. **Verification reaches the observable contract.** The agent attempts the strongest accessible authorized check. When execution must remain with the collaborator, the handoff includes the exact surface, state, data, actions, expected observations, evidence, and cleanup instead of a vague request to test manually.

7. **The final state is audited.** The completed change is read again as a whole, including its scope, current diagnostics for supported changed artifacts, evidence, and unresolved risk.

8. **Material knowledge survives the conversation.** Authorized activity records capture corrections, decisions, evidence, implementation state, verification, pauses, handoffs, and recovery before dependent work can make that knowledge stale. On covered Codex paths, declared delegated capture must also have an observed successful write under the current prompt and basis before readiness and after the latest implementation mutation before closure.

9. **Capacity limits become visible.** If the current model, tool set, or evidence channel cannot resolve a material conflict responsibly, the agent preserves the evidence and a resume point instead of covering the gap with a plausible answer.

## How it works

The named capabilities fit into four movements.

1. **Understand the work.** Establish the contract and its evidence.

   * **Please, Know the Work**
   * **Please, Check Our Understanding**
   * **Please, Check Before You Claim**
   * **Please, Look Before You Change**

2. **Choose a defensible direction.** Expose alternatives, observable paths, and scenario coverage before implementation.

   * **Please, Align Before You Choose**
   * **Please, Trace What Must Match**
   * **Please, Follow the Value**
   * **Please, Plan What Could Break**

3. **Change and verify.** Connect the implementation to proportional evidence and a complete final audit.

   * **Please, Make the Smallest Defensible Change**
   * **Please, Prove It**
   * **Please, Check Your Work**

4. **Preserve continuity.** Keep durable work useful without taking control of the user's information.

   * **Please, Don't Lose the Thread**
   * **Please, Write It Down**
   * **Please, Ask Before You Rearrange**
   * **Please, Use the Right Context**

Please, Catch Familiar Mistakes applies across the whole process. The complete capability map and its conditional protocols live in the [runtime skill](skills/please-make-no-mistakes/SKILL.md).

Internally, stable capability identifiers return compact continuations to one central router. The router loads only the reference needed for the next material state. This keeps the initial instruction load smaller and makes unresolved evidence, authority, reconciliation, or escalation visible before implementation.

The core operating loop is:

    authority and bootstrap context
      → bounded orientation
      → activity transition when work is identified
      → provisional understanding and scenario seed
      → material capture when delegated
      → investigation and counterevidence
      → evidence backed understanding
      → combined direction and scenario alignment when triggered
      → READY | INCOMPLETE | BLOCKED
      → ESCALATE → preserve evidence and resume point when current capacity is insufficient
      → capture current readiness when delegated
      → authorized change
      → REALIGNMENT | RECOVERY → question → wait when the direction loses its basis or is explicitly rejected
      → collaborator response → reinvestigation → renewed direction alignment → new READY
      → observable verification or reproducible handoff
      → repeatable protection decision
      → transactional durable reconciliation when delegated
      → final state audit
      → capture any audit correction
      → concise report

## Use

Once installed, work with your coding agent as usual. Ask it to investigate, design, implement, debug, refactor, review, verify, or resume software work. No special phrasing is required when the host supports implicit activation.

When the host supports direct skill invocation, you can require it for a particular request:

    $please-make-no-mistakes investigate this regression and implement the smallest defensible fix

Simple factual questions and isolated prose edits remain outside the default activation boundary. [Getting started](docs/getting-started.md) shows representative requests, the checkpoints you should see, and the difference between source validation and behavior observed in a fresh conversation.

## Durable work without lock in

Long running work should survive interruption, correction, handoff, and a fresh conversation. PMNM can maintain an activity record that keeps the current state distinct from historical ideas that were later rejected.

The record lives somewhere the user controls. It may be a Markdown file, a directory, an issue, a database entry, or another suitable system. It never has to live inside the installed skill. Once the user authorizes a record, material knowledge can be captured there automatically. When continuity begins from an empty state, PMNM plans the smallest recoverable activity, its locator or registry connection, bounded update delegation, privacy boundary, and retrieval proof together. It does not mistake an empty directory for a working context system. A new location, structural change, move, deletion, visibility change, or publication always requires fresh authority.

When the user delegates a new file-backed structure, PMNM selects Compact, Standard, or Extended from demonstrated retrieval needs. Standard activities keep stable index, understanding, timeline, and verification responsibilities while optional typed records and evidence remain activity-specific. This consistency supports search, tags, typed relationships, follow-ups, regressions, and handoffs without forcing project vocabulary into the public skill.

Screenshots, HAR files, JSON, logs, videos, spreadsheets, and other evidence can remain in their original authorized location. The record keeps useful metadata and pointers instead of copying sensitive or high volume material without need.

## Tools and integrations

The skill does not depend on one programming language, version control system, repository host, test runner, delivery process, or navigation tool. It asks the agent to use the strongest evidence channels available in the current environment and to state what could not be established when a stronger channel is missing.

Projects can add their own adapters for semantic navigation, runtime checks, interface traces, history inspection, data queries, or other domain specific evidence. A tool description is not proof that the tool can actually run, so availability must be established before its coverage is claimed.

The included [context store helper](skills/please-make-no-mistakes/scripts/context_store.py) can inspect an existing store and prepare a reviewable, digest bound, create only plan. It cannot apply the plan or silently reorganize user data. A separate [record conformance helper](skills/please-make-no-mistakes/scripts/record_conformance.py) checks the exact Standard file profile only when a user has adopted that profile. The Codex plugin bundles [a first write guard](skills/please-make-no-mistakes/references/host-enforcement.md). It can enforce declared order for covered local paths after explicit trust review, but it cannot prove that the reasoning itself is correct. Other hosts retain the portable advisory behavior unless they provide a compatible verified adapter.

### A companion project: Semantic JS MCP

PMNM asks an agent to trace relevant definitions, consumers, observable paths, and blast radius before acting. The quality of that investigation still depends on the evidence available in the environment.

For JavaScript, TypeScript, JSX, TSX, and Vue projects, I also built [Semantic JS MCP](https://github.com/elnonathan/semantic-js-mcp) to give coding agents language aware navigation and named symbol tracing. The projects are independent. PMNM provides the working discipline, while Semantic JS MCP strengthens one of its evidence channels.

Semantic JS MCP is available from [GitHub](https://github.com/elnonathan/semantic-js-mcp) and [npm](https://www.npmjs.com/package/semantic-js-mcp).

## Boundaries

The skill does not:

1. Guarantee correct or error free output.

2. Replace human judgment or higher authority project instructions.

3. Treat model confidence, clean diagnostics, or an empty search as proof.

4. Require one language, framework, provider, repository layout, version control system, review mechanism, test runner, or semantic tool.

5. Force a unit test layer when another repeatable guard better observes the material contract.

6. Turn scenario planning into an exhaustive input matrix or claim that it guarantees regression free software.

7. Force durable records or heavy ceremony onto trivial work.

8. Store personal or project context inside the installed skill.

9. Adopt or reorganize a context store without exact authorization.

10. Turn a hook receipt into proof of sufficient investigation, correct product intent, complete coverage, or valid human authority.

## Repository map

1. [.codex-plugin/plugin.json](.codex-plugin/plugin.json): Plugin identity, skill route, and presentation metadata. Codex discovers the bundled default hook separately at `hooks/hooks.json`.

2. [.agents/plugins/marketplace.json](https://github.com/elnonathan/please-make-no-mistakes/blob/main/.agents/plugins/marketplace.json): GitHub marketplace catalog that pins the exact npm plugin version.

3. [.github/workflows/publish.yml](https://github.com/elnonathan/please-make-no-mistakes/blob/main/.github/workflows/publish.yml): Tag only npm Trusted Publishing workflow.

4. [hooks](hooks): Optional Codex lifecycle interlock and its declarative configuration.

5. [skills/please-make-no-mistakes/SKILL.md](skills/please-make-no-mistakes/SKILL.md): Portable runtime entry point, invariants, capability map, and reference router.

6. [skills/please-make-no-mistakes/references](skills/please-make-no-mistakes/references): Procedures loaded only when their trigger applies.

7. [skills/please-make-no-mistakes/assets](skills/please-make-no-mistakes/assets): Non operative, identity neutral configuration examples.

8. [evals](evals): Activation cases, behavior cases, host guard cases, portable trace schema, and evaluation guidance.

9. [scripts](scripts): Release validation, host guard tests, install comparison, trace validation, and executable checks.

10. [SETUP.md](SETUP.md): Installation, source marketplace testing, hook trust review, updates, removal, and verification.

11. [ARCHITECTURE.md](ARCHITECTURE.md): Maintainer architecture and trust boundaries.

12. [docs/architecture-decisions.md](docs/architecture-decisions.md): Durable public design boundaries and rationale.

13. [docs/distribution.md](docs/distribution.md): Release identity, Trusted Publishing, and postpublication verification.

14. [docs/getting-started.md](docs/getting-started.md): Representative prompts and guidance for reading the skill's observable behavior.

15. [CONTRIBUTING.md](CONTRIBUTING.md): Contribution workflow and documentation ownership.

16. [SECURITY.md](SECURITY.md): Trust boundaries, supported claims, and vulnerability reporting.

## Validation

From the package root:

    npm run check:documentation
    npm run smoke:evaluation
    npm test
    npm run validate
    npm run smoke:distribution

The complete release candidate gate is available through npm run release:verify.

After publishing an exact version, npm run verify:published checks the package and its tag pinned Codex installation. The install comparison and trace validators remain available for maintainers who need to inspect a specific installed copy or captured execution. These checks can detect the omissions and ordering failures they cover. They cannot establish semantic truth or guarantee that a running client loaded the current revision.

## Distribution boundary

The currently tested distribution route is a Codex plugin through this GitHub repository's marketplace. The marketplace pins an exact npm artifact containing the portable skill and bundled Codex hook. npm install alone does not register the plugin, enable its skill, or trust its hook in Codex or another host. Another coding agent may use the portable skill only through its own verified skill or plugin mechanism.

This route does not depend on an OpenAI Plugins Directory listing. Installation and update procedures live in [SETUP.md](SETUP.md). Release and supply chain controls live in [docs/distribution.md](docs/distribution.md).

Real registries, activity records, evidence, and personal or project adapters stay outside both the package and the installed skill directory.

## The mascot

pls was generated specifically for Please, Make No Mistakes using an AI image model. It is included as the project's mascot and is not covered by the MIT License that applies to the software and documentation.

## License

Project code and documentation are released under the [MIT License](LICENSE).
