# Please, Make No Mistakes

<p align="center">
  <img src="./assets/pls.png" width="450" alt="pls">
</p>

<p align="center"><strong>Epistemic integrity for software engineering with AI</strong></p>

[![License: MIT](https://img.shields.io/badge/license-MIT-72e0a8?style=flat-square)](LICENSE)&nbsp;&nbsp;[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-D97757?style=flat-square&logo=claude&logoColor=white)](SETUP.md#install-with-claude-code)&nbsp;&nbsp;[![Codex plugin](https://img.shields.io/badge/Codex-plugin-10A37F?style=flat-square&logo=agentskills&logoColor=white)](SETUP.md#install-with-codex)

[Install](#install) · [Getting started](docs/getting-started.md) · [Setup](SETUP.md) · [Security](SECURITY.md)

Please, Make No Mistakes (PMNM) is a portable agent skill for work where context, evidence, and consequences matter. It comes as a plugin for Claude Code and for Codex. Integration with other agents is a work in progress.

> “Please, make no mistakes” is an impossible request. This project does not promise infallibility. It makes avoidable mistakes harder to miss.

Many damaging mistakes begin before code is written: an inference becomes a fact, a search miss becomes proof of absence, a nearby helper is assumed to have an equivalent contract, or one passing check becomes a claim of complete correctness.

PMNM grew out of notes I kept during months of daily work with coding agents. They began as a response to a recurring frustration: an answer could be plausible, polished, and internally coherent while still being wrong for the system around it.

Over time, I turned those notes into a way to keep context, evidence, and human judgment in the loop. PMNM helps you see why an agent is taking a particular direction, so you can question it before a mistake becomes costly.

The skill asks the agent to say the invariant, not the instance, and the end and its limits, not the method. It asks for one thing at a time, a clear next step, and no claim the agent cannot support. You review the plan before the work begins and the audit before accepting the result. The agent asks for your input whenever a decision needs your judgment.

The Claude Code and Codex plugins also include a safety brake. It pauses destructive operations, such as deleting or overwriting files and restarting services, so you can approve them first.

## Install

Share [this repository](https://github.com/elnonathan/please-make-no-mistakes) with your coding agent and ask it to follow [SETUP.md](SETUP.md). The guide covers installation and verification in Claude Code and Codex, including the skill and the brake. The brake runs on macOS and Linux. Windows support is in progress.

Both plugins use the same pinned npm package. Installing the package alone does not activate PMNM. A complete setup for another agent still needs a documented way to find the PMNM folder and testing on that host.

## What changes when it is active

1. **Investigation comes first.** The agent reads the code that matters before proposing anything, looks for the pattern the project already has, and treats its own explanation as something that could be wrong.

2. **You agree on the scope before material work begins.** The agent shows what it understood, what belongs to the work, what must stay the same, and how the result will be checked. If new evidence changes that scope, it comes back to you before acting outside it.

3. **Verification reaches the behavior that matters.** The agent checks the case your request was about and what must not break. It reports what passed, what remains untested, and any step you need to take yourself.

4. **The result is audited before you accept it.** The agent shows what changed and what the evidence supports. A plan is not permission to commit, push, tag or publish unless you approve that exact action.

5. **Every decision keeps its evidence.** The agent records what it read, decided, rejected and verified. That record survives a context reset, so an answer comes from evidence rather than memory.

6. **PMNM adapts to you and your project.** Useful lessons keep their source and limits. When you give a rule meant to last, it asks once whether that rule belongs to the current project or follows you across projects.

7. **A brake stops destructive operations.** On Claude Code and Codex, the brake pauses destructive actions before they run. In Codex it runs once you trust it in `/hooks`. When an action is unclear, only a safe verdict with high confidence from the model you chose lets it proceed without asking. Two cases skip that question: tools from an MCP server you allowed, and an action the model rated safe that you approved before.

## Use

Once installed, ask your coding agent to work on a software task as usual. No special phrasing is needed when the host activates the skill automatically.

You can also invoke the skill directly for a particular request. In Claude Code:

    /please-make-no-mistakes:please-make-no-mistakes <the work you need>

In Codex:

    $please-make-no-mistakes <the work you need>

Simple factual questions do not activate the skill by default. In Claude Code, the agent is asked to load it before it first reads or changes your project. [Getting started](docs/getting-started.md) shows an example request and what you should see as the work progresses.

## Your memory, not the agent's

Long running work should survive interruption, correction, handoff and a fresh conversation. PMNM keeps the current state and evidence for decisions in a folder you choose, outside the repository and the installed skill.

Large or sensitive evidence can stay where it belongs. The folder records what was read, what it showed and where it lives instead of copying it by default.

## Tools and integrations

PMNM works with the tools available in your environment. It asks the agent to use the strongest evidence it can reach and to say what it could not verify. It does not require a particular language, repository host, test runner or navigation tool.

### A companion project: Semantic JS MCP

For JavaScript, TypeScript, JSX, TSX and Vue projects, I also built [Semantic JS MCP](https://github.com/elnonathan/semantic-js-mcp) to help agents trace definitions and their consumers. It is an independent project that can strengthen an investigation when available. You can get it from [GitHub](https://github.com/elnonathan/semantic-js-mcp) or [npm](https://www.npmjs.com/package/semantic-js-mcp).

## Boundaries

PMNM makes mistakes easier to catch, but it cannot guarantee a correct result or replace your judgment. A passing check, a confident model answer, or an empty search is evidence with limits, not proof that the work is complete.

Approval from the brake lets a specific operation proceed. It does not prove that the investigation or result is sound.

## For contributors

[Architecture](ARCHITECTURE.md) maps the code and its trust boundaries. [Contributing](CONTRIBUTING.md) explains the workflow and checks. The [skill source](skills/please-make-no-mistakes) contains the agent's instructions. [docs/distribution.md](docs/distribution.md) covers release and package verification.

## Validation

Run the full source and package checks from the repository root:

    npm run release:verify

These checks cannot show that a running Claude Code or Codex session loaded the current version. [SETUP.md](SETUP.md) explains how to verify an installation. [CONTRIBUTING.md](CONTRIBUTING.md) lists the focused checks for contributors.

## License

Project code and documentation are released under the [MIT License](LICENSE). The mascot, [pls](assets/pls.png), was generated with an AI image model and is not covered by that license.
