# Please, Make No Mistakes

<p align="center">
  <img src="./assets/pls.png" width="450" alt="pls">
</p>

<p align="center"><strong>Epistemic integrity for software engineering with AI</strong></p>

[![License: MIT](https://img.shields.io/badge/license-MIT-72e0a8?style=flat-square)](LICENSE) [![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-111827?style=flat-square)](SETUP.md#install-with-claude-code) [![OpenAI Codex plugin](https://img.shields.io/badge/OpenAI%20Codex-plugin-111827?style=flat-square)](SETUP.md#install-with-codex)

[Install](#install) · [Getting started](docs/getting-started.md) · [Setup](SETUP.md) · [Security](SECURITY.md)

Please, Make No Mistakes (PMNM) is a portable agent skill for work where context, evidence, and consequences matter. It supports Claude Code and Codex. Integration with other coding agents is possible but not officially supported, and is work in progress.

The Claude Code and Codex plugins also include an optional lifecycle guard: a destructive-operation brake that stops deletions, overwrites, service restarts and other irreversible operations until you approve them, and asks a judge model you confirmed only about what its rules cannot place.

> “Please, make no mistakes” is an impossible request. This project does not promise infallibility. It makes avoidable mistakes harder to miss.

## Install

Share [this repository](https://github.com/elnonathan/please-make-no-mistakes) with your coding agent and ask it to install PMNM by following [SETUP.md](SETUP.md). The setup guide identifies the host that is actually running, selects a supported registration route, preserves existing configuration, and verifies the installed skill and any host hook separately.

This repository is a plugin marketplace for Claude Code and for Codex, and both marketplaces select the same exact npm version. Another host is not officially supported. It can use its own documented skill or plugin mechanism. npm can carry the exact artifact, but installing the package alone does not make a host load it.

The Agent Skill is the portable part of PMNM. The bundled lifecycle guard is one brake, implemented and tested for Claude Code and for Codex, each host registering it through its own hook file. Other hosts may discover the portable skill through their own supported mechanisms, but this repository does not yet claim their complete PMNM folder workflow. That workflow needs one documented literal pointer, and any host guard needs its own implementation and verification. Similar hook names do not establish compatibility, and a host adapter must not replace another host's hook or weaken its tested behavior.

## Status by host

| Capability | Claude Code | Codex |
| --- | --- | --- |
| Portable skill | Included in the plugin and covered by source, marketplace and plugin validation checks | Included in the plugin and covered by source and installation checks |
| PMNM folder pointer | `<CLAUDE_CONFIG_DIR>/pmnm.path`, or `~/.claude/pmnm.path`, remembers the folder | `<CODEX_HOME>/pmnm.path`, or `~/.codex/pmnm.path`, remembers the folder |
| Lifecycle guard | Destructive-operation brake (`hooks/claude/hooks.json`) on every tool call | The same brake (`hooks/codex/hooks.json`) on shell, file edit, patch and MCP tool calls |
| Hook trust | Enabling the plugin runs the brake | You review and trust the hook in `/hooks`, and again after each change to it |
| Approval | Claude Code's own permission prompt for operations the rules mark sensitive; the exact `PMNM-<code>` token for the rest | The exact `PMNM-<code>` token |
| Judge model | The Claude model you confirmed. Claude Code keeps no model catalog, so your confirmation alone names it | The Codex model you confirmed, checked against the Codex model catalog |
| Safe judge verdict | Runs with a notice that names the judge model | Runs without a notice |
| Skill loading | A line on the first prompt asks the agent to load PMNM. If the agent has not loaded it, the first project call of the session is stopped once with a card that asks it to. `PMNM-SKIP` turns the stop off for the session | A line on the first prompt asks the agent to load PMNM |
| Hook time limit | 30 seconds | 45 seconds for a tool call, 10 seconds for a prompt |
| Evidence in this repository | Release gate, brake and hook discovery suites cover the current revision. Installed-host behavior remains a separate check | Release gate and brake suite cover the current revision, and `verify:published` checks a published version. Installed-host behavior remains a separate check |
| Install route | Plugin from this repository's marketplace | Plugin from this repository's marketplace |

On both hosts, the brake blocks an operation when it fails while evaluating it. A brake that runs past its time limit or cannot start is handled by the host, which may let the operation run. The repository checks also run on Windows, but no live session there has exercised the brake on either host.

The sections below describe portable PMNM. Host enforcement, the brake for Claude Code and Codex, is named explicitly.

The public package contains the same runtime artifact under [skills/please-make-no-mistakes](skills/please-make-no-mistakes). Detailed installation, update, rollback, removal, and verification procedures live in SETUP so neither the user nor the agent has to invent missing steps.

## Why it exists

Many damaging mistakes begin before code is written: an inference becomes a fact, a search miss becomes proof of absence, a nearby helper is assumed to have an equivalent contract, or one passing check becomes a claim of complete correctness.

PMNM grew out of notes I kept during months of daily work with coding agents. They began as a response to a recurring frustration: an answer could be plausible, polished, and internally coherent while still being wrong for the system around it.

Over time, those notes became a working discipline for keeping context, evidence, and human judgment in the loop. The skill turns that accumulated experience into a process where a collaborator can question the direction and an agent can show what supports its reasoning before the cost of being wrong grows.

PMNM asks the agent for four things: say the invariant, not the instance; say the end and the limits, not the method; say one thing at a time and the next one; and claim nothing it cannot show. It costs two moments of your attention per task, one to agree the plan and one to read the audit, plus the questions only you can answer.

## What changes when it is active

1. **Investigation comes first.** The agent reads the code that matters before proposing anything, looks for the pattern the project already has, and treats its own explanation as something that could be wrong.

2. **You see the scope before material work begins.** The agent shows what it understood, which files, states or advisory result belong to the work, what must stay the same, how the result will be checked, which predictable sensitive operations need permission, and what is still ambiguous. Nothing material depends on that direction until you agree, however small the task looks.

3. **The work stays inside what you agreed.** Intended files, material state transitions and decision-ready deliverables are written down before work starts. If evidence changes that boundary, the agent records the correction and comes back with a revised scope before acting on it.

4. **Verification reaches the behavior that matters.** The agent names the case the request was about and the behavior that must not change, runs the check that tests them, and says what that check proves. Then it gives you an actionable Test Digest: where to enter, the environment and safe data, who acts, the steps, expected observations, evidence, cleanup, and whether the agent can run it.

5. **The result is audited before you accept it.** The agent accounts for every file, state or deliverable objective and reports whether the evidence supports the result. When a commit applies, agreeing to the plan is not a yes to commit, push, tag or publish. An exact operation named in the permission forecast may receive that authority with your agreement. Otherwise, each needs its own yes at the time or a human-owned rule, and the host still controls execution. The brake does not read the forecast. It still stops each covered destructive or sensitive operation for your exact token or, in Claude Code, the host's own prompt.

6. **Every decision keeps its evidence.** What the agent read, decided, rejected and verified lives in a task folder outside the repository. It survives a context reset, and when you challenge a decision the answer comes from there rather than from memory.

7. **PMNM adapts to you and your project.** Reusable project knowledge keeps its source, scope, certainty and freshness. At audit, the agent decides what is genuinely reusable and leaves one-off findings with their task. When you give an always-or-never instruction, it asks once whether that rule belongs to this project or applies generally.

8. **A brake stops irreversible operations.** On Claude Code and Codex an optional hook stops deletions, history rewrites, service restarts, publication and datastore drops before they run. It asks you for the exact approval token. In Claude Code, an operation its rules mark sensitive goes to Claude Code's own permission prompt instead. Ordinary reads and project edits pass without asking. When its rules cannot place an operation, a judge model classifies it once. The agent proposes the cheapest model the host offers and you confirm it; until you do, those operations stop for your token, and only a safe, high-confidence verdict runs without you. An approval covers one run of that exact operation. The model's rating of it is kept, so the same operation is not judged again: a safe rating runs and any other rating asks you directly. In Claude Code the brake also stops the first project call of each session once when the agent has not loaded PMNM, and asks it to load it; `PMNM-SKIP` turns that stop off for the session. Guards, not jailers.

## How it works

PMNM has four parts.

1. **The PMNM folder.** Its location is asked once per machine (`~/PMNM` is suggested) and remembered by the host, so setup does not become a recurring conversation. Inside live the general rules, one folder per project with human-owned rules and evidence-backed knowledge, and one folder per task with its plan, verification, permission forecast and evidence. The agent writes there without asking, and never writes a secret there. The brake still stops a deletion, a move, or an edit to a secret or configuration file there.

2. **The flow.** Investigate, agree the files, states or deliverable and its limits, work inside them, verify, then audit before acceptance. You enter at the plan and at the audit at every effort level, and sooner when only you can decide or a new action needs a yes of its own.

3. **Rules.** One sentence each, born from an always or a never, with the task and date they came from. A new rule replaces one it contradicts.

4. **Guards.** Where an operation is destructive or sensitive, a host hook stops it (Blocked) or asks (Ask, or Claude Code's own prompt). Every Blocked or Ask card names the next valid action. Two levels, no more.

The agent asks four kinds of questions about its folder, and no more: where the folder goes, the project name, whether a task folder it found is the current task, and whether an always/never is a project or general rule. Other questions are reserved for product intent, priority, risk, or authority that evidence cannot settle.

The runtime contract, in the agent's own language, is one file that routes to supporting references by condition: [runtime skill](skills/please-make-no-mistakes/SKILL.md).

## Use

Once installed, work with your coding agent as usual. Ask it to investigate, design, implement, debug, refactor, review, verify, or resume software work. No special phrasing is required when the host supports implicit activation.

When the host supports direct skill invocation, you can require it for a particular request. In Claude Code:

    /please-make-no-mistakes:please-make-no-mistakes <the work you need>

In Codex:

    $please-make-no-mistakes <the work you need>

Simple factual questions and isolated prose edits remain outside the default activation boundary. [Getting started](docs/getting-started.md) shows the shape of a request, the checkpoints you should see, and the difference between source validation and behavior observed in a fresh conversation.

## Your memory, not the agent's

Long running work should survive interruption, correction, handoff and a fresh conversation. The task folder keeps the current state distinct from ideas that were later rejected, with the evidence for each decision. After a context reset the agent reads the folder instead of reinvestigating.

The PMNM folder lives where you choose, outside the repository and outside the installed skill. Large or sensitive evidence can stay in its authorized location. The folder records what was read, what it showed and where it lives instead of copying it by default. When attribution matters, it also keeps authorship, observation, review and causality as separate links so one does not quietly stand in for another.

## Tools and integrations

The skill does not depend on one programming language, version control system, repository host, test runner, delivery process, or navigation tool. It asks the agent to use the strongest evidence channels available in the current environment and to state what could not be established when a stronger channel is missing.

Projects can add their own adapters for semantic navigation, runtime checks, interface traces, history inspection, data queries, or other domain specific evidence. A tool description is not proof that the tool can actually run, so availability must be established before its coverage is claimed.

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

5. Force a unit test layer when another repeatable check better observes the material contract.

6. Turn scenario planning into an exhaustive input matrix or claim that it guarantees regression free software.

7. Skip the plan Digest because a change looks small.

8. Store personal or project context inside the installed skill.

9. Ask where its folder goes more than once, or ask permission for ordinary writes inside it.

10. Turn a brake approval or a judge verdict into proof of sufficient investigation, correct product intent, complete coverage, or valid human authority.

## Repository map

1. [.claude-plugin/plugin.json](.claude-plugin/plugin.json): Claude Code plugin identity; its hooks are `hooks/claude/hooks.json`.

2. [.claude-plugin/marketplace.json](https://github.com/elnonathan/please-make-no-mistakes/blob/main/.claude-plugin/marketplace.json): GitHub marketplace catalog for Claude Code that pins the same exact npm plugin version.

3. [.codex-plugin/plugin.json](.codex-plugin/plugin.json): Plugin identity, skill route, presentation metadata, and the declared Codex hook file `hooks/codex/hooks.json`. No conventional `hooks/hooks.json` ships, so a Claude Code root does not merge the Codex hooks.

4. [.agents/plugins/marketplace.json](https://github.com/elnonathan/please-make-no-mistakes/blob/main/.agents/plugins/marketplace.json): GitHub marketplace catalog for Codex that pins the exact npm plugin version.

5. [.github/workflows/publish.yml](https://github.com/elnonathan/please-make-no-mistakes/blob/main/.github/workflows/publish.yml): Tag only npm Trusted Publishing workflow.

6. [hooks](hooks): The destructive-operation brake (`pmnm-brake.mjs`) and the Claude Code and Codex hook files that register it. The retired interlock engine and Claude adapter stay alongside, unregistered, for rollback.

7. [skills/please-make-no-mistakes/SKILL.md](skills/please-make-no-mistakes/SKILL.md): The kernel: the four parts of PMNM and the reference table.

8. [skills/please-make-no-mistakes/references](skills/please-make-no-mistakes/references): Procedures loaded only when their trigger applies.

9. [evals](evals): Activation cases, behavior cases, the retired interlock's host guard cases and action oracle, and evaluation guidance.

10. [scripts](scripts): Release validation, brake tests, the retired interlock's guard tests, install comparison, and executable checks.

11. [SETUP.md](SETUP.md): Installation, source marketplace testing, hook trust review, updates, removal, and verification.

12. [ARCHITECTURE.md](ARCHITECTURE.md): Maintainer architecture and trust boundaries.

13. [docs/architecture-decisions.md](docs/architecture-decisions.md): Durable public design boundaries and rationale.

14. [docs/distribution.md](docs/distribution.md): Release identity, Trusted Publishing, and postpublication verification.

15. [docs/getting-started.md](docs/getting-started.md): Representative prompts and guidance for reading the skill's observable behavior.

16. [CONTRIBUTING.md](CONTRIBUTING.md): Contribution workflow and documentation ownership.

17. [SECURITY.md](SECURITY.md): Trust boundaries, supported claims, and vulnerability reporting.

## Validation

From the package root:

    npm run check:documentation
    npm run smoke:evaluation
    npm test
    npm run test:brake
    npm run validate
    npm run smoke:distribution

The complete release candidate gate is available through npm run release:verify.

After publishing an exact version, npm run verify:published checks the package and its tag pinned Codex installation. It covers Codex only. For Claude Code, the verification steps in SETUP.md check the installation. The install comparison and the retired interlock's action oracle, kept for rollback, remain available for maintainers who need to inspect a specific installed copy or an interlock transition sequence. These checks can detect the omissions and ordering failures they cover. They cannot establish semantic truth or guarantee that a running client loaded the current revision.

## Distribution boundary

The tested distribution routes are a Claude Code plugin and a Codex plugin through this GitHub repository's marketplaces. Each marketplace pins the same exact npm artifact containing the portable skill and the bundled brake. npm install alone does not register the plugin, enable its skill, or trust its hook in Claude Code, Codex or another host. Another coding agent may use the portable skill only through its own verified skill or plugin mechanism, and that integration is not officially supported.

This route does not depend on an OpenAI Plugins Directory listing. Installation and update procedures live in [SETUP.md](SETUP.md). Release and supply chain controls live in [docs/distribution.md](docs/distribution.md).

The PMNM folder, its rules and task folders, and any evidence stay outside both the package and the installed skill directory.

## The mascot

pls was generated specifically for Please, Make No Mistakes using an AI image model. It is included as the project's mascot and is not covered by the MIT License that applies to the software and documentation.

## License

Project code and documentation are released under the [MIT License](LICENSE).
