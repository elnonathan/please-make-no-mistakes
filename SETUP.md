# Setup

This is the single installation, update, rollback, removal, and installation-verification authority for Please, Make No Mistakes. It is written for both people and agents. The supported Codex and Claude Code routes both use this GitHub repository as a marketplace whose catalog selects the same exact npm package version, containing the portable skill and an optional destructive-operation brake registered for each host.

## Guards

### 1. Resolve authority and route before using tools

Reading this file, receiving the repository URL, or being asked how installation works is not authority to change a host. Before any terminal or filesystem action, resolve and state:

- the requested operation: `install`, `update`, `verify`, `rollback`, `remove`, or `local-checkout`;
- the target host application;
- the host-supported registration route;
- the artifact source and exact version or revision when one is requested;
- who will run commands: the agent or the user.

These are separate facts. An installed executable does not identify the application in which the current conversation runs. A GitHub repository, an npm artifact, a marketplace entry, an installed plugin, an enabled plugin, and a skill loaded by a new conversation are also separate states.

An explicit request to perform one setup operation authorizes only the effects necessary for that operation, subject to the host's approval controls. It does not authorize source-code investigation, unrelated configuration changes, global package installation, publication, account changes, or removal of another plugin.

Use the direct Codex route only when current evidence identifies Codex as the target and current Codex help or official documentation supports the commands. Otherwise use the generic-host route automatically. Ask one focused question only when the target host or command runner cannot be established safely.

### 2. Preserve the user's environment

Before changing state:

1. Inspect the exact host command grammar and current plugin or skill state.
2. Preserve unrelated configuration and existing marketplaces.
3. Show the next command and its intended effect when the user is the command runner.
4. Run one state-changing command at a time and inspect its complete result before continuing.
5. Stop when output contradicts the expected state; do not compensate with guessed flags or a different installation mechanism.

Do not use `npx`, `npm exec`, `@latest`, an unrequested global install, a manual plugin-cache edit, or a copied skill directory as a substitute for the host's supported route. For this project, npm is the immutable artifact selected by the repository marketplace; `npm install` alone is not host registration.

When the brake is active during setup, Codex and Claude plugin add, remove, install, uninstall, update, enable and disable commands, marketplace changes included, are classified as sensitive. The brake stops each one until the human approves that exact command. A plan Digest does not grant that authority.

Setup authority does not authorize analyzing the user's source repositories. A bounded post-install behavior check should use a neutral prompt or a disposable fixture.

## Prerequisites

### 3. Establish the supported path

For Codex, inspect the installed client before acting:

```bash
codex --version
```

```bash
codex plugin --help
```

```bash
codex plugin marketplace add --help
```

```bash
codex plugin add --help
```

The postpublication verifier rejects Codex CLI versions below `0.144.4`, and deterministic fixtures exercise the command shapes below with a mocked `0.144.4` response. That is a minimum and a fixture boundary, not live evidence that every `0.144.4` client behaves correctly. Current installed help and current official documentation outrank it.

OpenAI's current [plugin packaging](https://developers.openai.com/plugins/build/plugins) and [complete-plugin testing](https://developers.openai.com/plugins/deploy/connect-chatgpt) documentation are the public platform references for the manifest, marketplace, fresh-conversation, positive, and negative evaluation boundaries.

The bundled brake additionally requires a supported Node.js runtime on PATH. This release is validated on Node.js 22 and 24. Inspect it before installation:

```bash
node --version
```

OpenAI's current [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks) is authoritative for discovery, event coverage, trust review, plugin data, and bypass limits.

The public source is `https://github.com/elnonathan/please-make-no-mistakes`. The marketplace identity is `please-make-no-mistakes`, and it must offer an exact package version rather than a mutable selector.

For Claude Code, inspect the installed client the same way:

```bash
claude --version
```

```bash
claude plugin --help
```

```bash
claude plugin marketplace add --help
```

```bash
claude plugin install --help
```

Claude Code's current [plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) and [hooks](https://code.claude.com/docs/en/hooks) documentation are authoritative for marketplace sources, plugin discovery, hook events and their limits. The brake needs the same Node.js runtime in Claude Code. To classify what its rules cannot place, it runs the host's own `codex` or `claude` command-line client, so that client must be on PATH.

For another host, identify its actual skill or plugin discovery mechanism from current official documentation or installed help. If the host has no supported Agent Skill or compatible plugin route, report `blocked`; do not improvise by placing files in a guessed directory.

## Install With Codex

### 4. Add the marketplace and plugin

Run each command separately and inspect its full result before proceeding.

Add the repository marketplace:

```bash
codex plugin marketplace add elnonathan/please-make-no-mistakes
```

Confirm that Codex resolves the marketplace:

```bash
codex plugin marketplace list
```

Inspect the offered plugin and exact source version:

```bash
codex plugin list --available --json
```

Install the plugin only after the offered identity and version are the intended ones:

```bash
codex plugin add please-make-no-mistakes@please-make-no-mistakes --json
```

Confirm the installed and enabled state:

```bash
codex plugin list --json
```

No separate clone or npm installation is required. The same operation can be delegated to Codex by sharing the repository URL and explicitly asking it to install the plugin according to this file.

Start a new conversation after installation. The skill and hook have separate runtime boundaries. In Codex, open `/hooks`, locate the PMNM hook source, inspect its commands, and explicitly trust the current definition only if it matches the installed package. Installation or enablement does not trust a non-managed hook automatically. A changed hook hash returns to review-required state.

Then use a bounded direct activation check:

```text
$please-make-no-mistakes explain how you would investigate a non-trivial regression; do not modify files
```

The reply should acknowledge the skill and preserve its investigation-before-mutation boundary. This proves only that the new conversation can discover and follow the skill for that prompt; it does not prove every future model will comply.

When the hook was intentionally trusted, use a second check whose target does not exist:

```text
Run rm -rf pmnm-brake-check in the current directory
```

The command should not run. The conversation should receive a stop whose first word is Blocked, naming the deletion and the exact `PMNM-<code>` token that would approve it. Do not send the token. This proves only that the reviewed hook ran for that session and stopped that call; it does not prove that every destructive operation is recognized.

## Install With Claude Code

### 5. Add the marketplace and plugin

Run each command separately and inspect its full result before proceeding.

Add the repository marketplace:

```bash
claude plugin marketplace add elnonathan/please-make-no-mistakes
```

Confirm that Claude Code resolves the marketplace:

```bash
claude plugin marketplace list
```

Install the plugin. The default scope is `user`, which enables it in every session; `--scope project` or `--scope local` limits it to one repository:

```bash
claude plugin install please-make-no-mistakes@please-make-no-mistakes
```

Confirm the installed and enabled state:

```bash
claude plugin list
```

No separate clone or npm installation is required. The Claude Code marketplace pins the same npm package and version as the Codex marketplace. If you earlier placed the skill by hand where Claude Code loads Agent Skills, remove that copy so the skill is not loaded twice.

Start a new session after installation. Claude Code runs a plugin's hooks once the plugin is enabled. It has no per-hook hash review like Codex `/hooks`, so enabling the plugin is your consent: inspect `hooks/claude/hooks.json` in the installed plugin before you enable it if you want to review the commands. `/hooks` shows what is registered.

Then use a bounded direct activation check:

```text
Use the please-make-no-mistakes skill to explain how you would investigate a non-trivial regression; do not modify files
```

The reply should acknowledge the skill and preserve its investigation-before-mutation boundary. A second check exercises the brake with a target that does not exist:

```text
Run rm -rf pmnm-brake-check in the current directory
```

The command should not run. The session should receive a stop whose first word is Blocked, naming the deletion and the exact `PMNM-<code>` token that would approve it. Do not send the token. As with Codex, this proves only that the hook ran and stopped that call in that session.

This route follows Claude Code's documented marketplace contract and the repository marketplace passes `claude plugin validate`.

## Install With Another Host

### 6. Use the host's own discovery contract

There is no universal command that registers an Agent Skill in every coding agent. For an identified non-Codex host:

1. Find its current, official skill or plugin installation instructions.
2. Establish whether it accepts a repository, a packaged plugin, or a skill directory.
3. Confirm the exact destination, configuration grammar, restart behavior, and update/removal mechanism.
4. Inspect the PMNM artifact before copying or registering anything. The canonical skill root inside the artifact is `skills/please-make-no-mistakes/`.
5. Present the smallest operation-specific plan and preserve unrelated host configuration.
6. Execute one authorized action at a time, or ask the user to run it and return the full result.
7. Verify discovery in a clean conversation with a positive and a negative activation prompt.

When the agent cannot inspect or operate the target host directly, the user remains the command runner. Do not ask the user to choose among speculative integrations; derive the supported route from host evidence and ask only for the missing fact or output.

Claude Code is not an "other host": use its route above.

The npm package can transport the exact public files to environments that understand npm artifacts, but it does not register or activate PMNM by itself. A host-specific adapter may be documented later only after its complete install, update, rollback, removal, and clean-session verification path has been tested.

## Verify The Installation

### 7. Match the claim to the evidence

Use this proof ladder. Never report a stronger state than the strongest completed step:

1. **source resolved** — the intended repository, tag, or exact package exists;
2. **artifact inspected** — the package identity, version, manifest, and skill files agree;
3. **host registered** — the host recognizes the marketplace, plugin, or skill source;
4. **installed and enabled** — the host reports the exact intended plugin version active;
5. **fresh-session discovered** — a new conversation exposes the skill;
6. **activation observed** — a direct prompt uses the skill and a negative prompt avoids unnecessary activation;
7. **hook discovered** — the host lists the bundled lifecycle source (Codex or Claude Code `/hooks`) and, in Codex, its review state;
8. **hook trusted** — in Codex, the user reviewed and trusted the exact current definition; Claude Code has no hash review, so this step is the plugin's enabled state;
9. **brake behavior observed** — in a fresh session a deletion of a nonexistent path is stopped with its approval token;
10. **behavior observed** — representative prompts preserve the material behavioral contract.

Use one terminal result:

- `verified`: the strongest state requested by the user has direct evidence;
- `pending-restart`: installation or update succeeded, but clean-session discovery still requires a restart or new conversation;
- `blocked`: a required host, source, permission, network, or verification channel is unavailable.

Package installation, a successful validator, a saved marketplace entry, a hook file in the package, or a manually started process is not proof that a conversation loaded the skill or ran the hook. Report skill activation and hook activation separately. When the host cannot reveal the loaded revision or trusted hook hash, say so explicitly.

### The PMNM folder

Skill installation and the PMNM folder are separate outcomes. Installation does not create the folder, its pointer, a project folder or a personal profile.

The first task after installation asks two questions, in this order, before the agent reads your repository: where to create the PMNM folder, suggesting `~/PMNM`; then the project name, suggesting the repository name. The agent inspects only the one literal pointer path declared by the host integration. In Codex that path is `<CODEX_HOME>/pmnm.path`, or `~/.codex/pmnm.path` when `CODEX_HOME` is unset. In Claude Code it is `<CLAUDE_CONFIG_DIR>/pmnm.path`, or `~/.claude/pmnm.path` when `CLAUDE_CONFIG_DIR` is unset. Another host must document its own single pointer path. Never search the home directory, temporary directories, conversation history or unrelated repositories to discover it.

Choose a location outside your repositories and outside the host's config directory. The host's config directory receives only the pointer, one line with the folder's absolute path, so another host on the same machine can read the same memory once its own pointer is configured. If you later move or delete the folder, the agent asks once more where it is or where it should be. An existing empty folder is seeded before the pointer is written. An invalid pointer or index is preserved under a unique recovery name and rebuilt only after your explicit recovery answer.

The folder has this shape:

```text
<PMNM folder>/
  index.json                      projects and their repository paths; one writer at a time
  general-rules.md                rules for every project
  models.json                     the agent's judge proposal, with prices and sources
  commands.json                   the brake's stored verdicts, sealed, without command text
  projects/<project>/
    project-rules.md              human-owned rules for this project
    project-knowledge.md          reusable claims with basis and freshness
    tasks/<id>/                   one per task: index.md, plan.md, verification.md, permissions.json
```

A fresh `index.json` holds the schema `pmnm.projects/v1`, `pointer_version` 1 and an empty `projects` list. One writer at a time: the agent. The brake writes only its own `commands.json` at the folder root; `models.json` holds the agent's judge proposal, and the human confirms the judge with a prompt. Inside the folder the agent needs no further permission: it creates the project and task folders, keeps reusable evidence-backed knowledge separate from human-owned rules, fills the task plan, verification and permission forecast, and records evidence as it appears. The skill can be discovered before this folder exists, but material project work does not proceed without the literal pointer, project mapping and task record that preserve its decisions and evidence.

### The brake after installation

The brake needs a judge model the human confirms for each host. The brake never picks one. Until the human confirms it, every operation the brake's rules cannot place stops with a `PMNM-<code>` token, and the next human prompt adds one notice to the agent's context. Before continuing its task, the agent proposes a judge and asks the human to confirm it.

How the agent chooses the model it proposes, on any host:

1. It takes the models the host itself says it offers. Codex keeps a catalog. Claude Code keeps no documented one, and PMNM reads none of its internal files.
2. When PMNM cannot list them, for example in OpenCode, Ollama or Hermes, it shows the human what it found locally, if anything, and asks which models the human can use.
3. Among those, it proposes the cheapest: the lowest sum of input and output price per million tokens in each provider's current published documentation, such as its `llms.txt` index and pricing page, never in local caches, and the newest on a tie. It shows each price with its URL and records the proposal in `models.json`.
4. Or it uses the model the human names.

The published price is a criterion for the proposal. It does not prove that this account can run the model, since managed settings may restrict models, nor what a session will cost. The human's confirmation and the judge's first real call settle that, and a call that fails stops the operation for the human.

Confirm the judge in a session where the plugin is enabled:

1. Send this prompt alone, exactly: `PMNM-CONFIRM-JUDGE <host> <model> [reasoning=<level>]`. `<host>` is `codex` or `claude`. `reasoning=<level>` is optional; a small judge works well with `reasoning=low`.
2. Read the brake's answer, which the agent relays.

What the brake checks when it confirms and runs a judge:

- Codex: its catalog, `<CODEX_HOME>/models_cache.json`, or `~/.codex/models_cache.json` when `CODEX_HOME` is unset. A model the catalog does not offer is not confirmed. When the catalog cannot be read, no judge is confirmed and a confirmed judge does not run. When the catalog no longer offers the confirmed model, that model does not run and no other replaces it. When the catalog changes and still offers it, the judge keeps running and one notice asks for a re-evaluation. Without a confirmed reasoning level, a model the catalog lists with low effort runs at low effort.
- Claude Code: no catalog, so the human's confirmation alone names the judge, and the brake says it was not checked against one. A model that no longer exists fails its call, and the operation stops for a token.

The judge runs through the host's own `codex` or `claude` client, on the user's own model account and usage, with a 20-second limit. No answer is not a yes: the operation stops for a token. A safe rating with high confidence runs and is stored in `commands.json`; in Claude Code the session shows `PMNM: safe operation with high confidence, classified by <model>.` Any other rating stops for a token. The human's approval stores that rating, so the same operation asks again without the judge.

Two more prompts belong to the human, each sent alone and exactly:

- `PMNM-ALLOW-MCP <server>` lets every tool of that MCP server run without a stop, except an operation the rules rate destructive, such as a tool named for destruction. `<server>` is the id the brake's card names. The allowance has no expiry.
- `PMNM-REVOKE-MCP <server>` removes that allowance.

Tokens and approvals:

- A token stays valid for 1 hour from the operation's first stop.
- After the exact reply, the approval runs the identical operation once within 10 minutes.
- A token is `PMNM-` and four characters, accepted in any letter case.
- An open token or approval is never dropped to make room. A session can hold 8 open tokens, and all sessions together 128. When either limit is full, the operation stops with no token and says so; answer an open token or let one expire, then retry.
- A reply that matches no open token says it expired, was used or belongs to another session. Rerun the operation for a new token.

At the start of each session the agent is asked to load PMNM. In Claude Code, if its first tool call that can touch the project comes before it loads the skill with the Skill tool, that call is stopped once with `Blocked: load PMNM before working on the project.`, and the agent loads the skill and retries. Send `PMNM-SKIP` alone to turn this stop off for the current session. Codex is not stopped.

The brake finds `commands.json` through the same `pmnm.path` pointer as the agent. Without a pointer that holds an absolute path, it stores no verdicts: the judge is asked every time, and an approval stores no rating.

The brake keeps its state in `<plugin data>/brake/`, where `<plugin data>` is the data directory the host gives the plugin. When the host gives none, the state is in `<system temp>/pmnm-brake/brake/`. The files are:

- `catalog.key`, the secret that seals every entry;
- `approvals.json`, pending tokens and approvals;
- `judge.json`, the confirmed judge per host;
- `mcp-allow.json`, the allowed MCP servers;
- `notices.json`, which re-evaluation notices were shown;
- `sessions.json`, hashes of the last 256 sessions that already received the line asking the agent to load PMNM;
- `loaded.json`, hashes of the last 256 sessions that loaded the skill, were already stopped once for not loading it, or received `PMNM-SKIP`;
- `stats.json`, decision counts (`judge_calls`, `judge_safe_high`, `judge_unanswered`, `judge_unavailable`, `catalog_hits`, `mcp_allowed`), never what was decided.

When `catalog.key` cannot be read or created, the brake stores nothing and no reply approves anything: only the human can run a stopped operation. Never edit these files. An operation that names the state directory or `catalog.key` is sensitive.

## Troubleshooting

### 8. Diagnose the failed boundary

Classify the first unproven boundary before changing anything:

- **source failure** — repository, tag, registry, or network cannot be resolved;
- **artifact failure** — identity, version, manifest, or packaged files disagree;
- **registration failure** — the host rejects or cannot find the marketplace or skill source;
- **installation failure** — the plugin is not installed or enabled at the intended version;
- **discovery failure** — a fresh conversation does not expose the skill;
- **hook-review failure** — the hook is installed but absent, disabled, changed, or still requires trust;
- **brake-runtime failure** — the trusted hook cannot start Node.js, persist its state, run the host's client for classification, or return a valid decision;
- **behavior failure** — discovery succeeds but representative prompts do not follow the contract.

Do not convert a command failure into `pending-restart`. Do not use similarly named local files, a readable `SKILL.md`, or an executable on `PATH` as evidence for a different boundary. If a `pmnm-guard` receipt reaches the shell or returns command not found, do not search for, install or retry it. Report that this call was not intercepted and continue through the portable advisory path. Report the literal failure, the evidence collected, and the smallest next action.

## Update

### 9. Refresh and verify an existing installation

Resolve current state and exact target version first. Then run each command separately:

```bash
codex plugin marketplace upgrade please-make-no-mistakes
```

```bash
codex plugin list --available --json
```

Install only when the available entry's `source.version` matches the intended release:

Repeat the plugin-add step from section 4 and inspect its complete result.

```bash
codex plugin list --json
```

Adding the plugin replaces the installed cache, and that replacement is the session's terminal material operation. The conversation that performed it may still report and verify what it did, and it does no further work. Replacing the cache can also remove the hook path the running conversation loaded, so a later tool call may run without the brake; that is the known lifecycle boundary and not evidence about the new revision.

Review `/hooks` after every update. A changed bundled hook requires fresh trust for its new hash. Start a new conversation and repeat both bounded checks. Until then, report `pending-restart`; an existing conversation does not prove that it reloaded an updated skill or hook.

For Claude Code, refresh the marketplace and update the plugin, each separately:

```bash
claude plugin marketplace update please-make-no-mistakes
```

```bash
claude plugin update please-make-no-mistakes@please-make-no-mistakes
```

Claude Code applies a plugin update after a restart; report `pending-restart` until a new session repeats both bounded checks.

For any other host, use only its documented update mechanism. Do not assume reinstall, cache replacement, or marketplace refresh semantics are equivalent.

## Rollback

### 10. Restore an exact known release

Rollback is a state-changing operation and requires an explicit target revision. Confirm that the immutable Git tag and matching artifact exist before removing the current installation.

For Codex, inspect the current removal and marketplace-add grammar. Then remove only this plugin and its project-specific marketplace, add the repository pinned to the requested `vX.Y.Z` ref, reinstall the plugin, and verify the exact version. Execute and inspect each step separately; do not use a mutable branch as a rollback target.

For Claude Code, uninstall the plugin, remove the marketplace, add the repository pinned to the requested `vX.Y.Z` ref, install again and verify the exact version, one step at a time.

If the requested artifact or host rollback route cannot be verified, stop with `blocked` and leave the current installation intact.

## Removal

### 11. Remove only PMNM-owned state

Confirm current identifiers and the removal command grammar, then run separately:

```bash
codex plugin remove please-make-no-mistakes@please-make-no-mistakes
```

Remove the project-specific marketplace only when the user also authorizes that effect and no remaining installation depends on it:

```bash
codex plugin marketplace remove please-make-no-mistakes
```

Removing a marketplace source is distinct from removing an installed plugin. Neither operation authorizes deleting the external PMNM folder. Its pointer, project folders, task folders and user data are deliberately outside the installed plugin.

For Claude Code, run separately:

```bash
claude plugin uninstall please-make-no-mistakes@please-make-no-mistakes
```

```bash
claude plugin marketplace remove please-make-no-mistakes
```

Removing the plugin is not evidence that the brake's state is gone. Inspect its state directory, described in [The brake after installation](#the-brake-after-installation), and delete it only when the user authorizes that effect. `commands.json` and `models.json` stay at the PMNM folder root; they belong to the folder, which removal does not authorize deleting.

For another host, use its documented removal mechanism and preserve unrelated configuration and user context.

## Local Checkout

### 12. Test a source tree without publishing it

The repository marketplaces at `.agents/plugins/marketplace.json` (Codex) and `.claude-plugin/marketplace.json` (Claude Code) select the exact published npm artifact. Adding the checkout directory itself as a marketplace therefore installs nothing from source, and before the first publication it installs nothing at all; that result is expected, not a broken checkout.

To exercise unpublished source in Codex, choose the `local-checkout` operation explicitly and build a disposable local marketplace outside the repository. Codex local marketplace entries use a `local` source whose `path` starts with `./` and stays inside the marketplace root:

1. From the repository root, run `npm pack --pack-destination <tmp>` and extract the archive's `package/` directory to `<tmp-marketplace>/plugins/please-make-no-mistakes`.
2. Write `<tmp-marketplace>/.agents/plugins/marketplace.json` with the same `name`, `interface`, and `plugins` shape as the repository marketplace, a distinct marketplace name such as `please-make-no-mistakes-local`, and the plugin source replaced by `{"source": "local", "path": "./plugins/please-make-no-mistakes"}`.
3. Register the disposable marketplace, then install from it and inspect each result separately:

```bash
codex plugin marketplace add /absolute/path/to/tmp-marketplace
```

```bash
codex plugin add please-make-no-mistakes@please-make-no-mistakes-local --json
```

4. Review the bundled hook in `/hooks` and start a new conversation before judging behavior.

To exercise the same unpublished artifact in Claude Code, reuse the extracted `plugins/please-make-no-mistakes` directory. Write `<tmp-marketplace>/.claude-plugin/marketplace.json` with the same shape as the repository's Claude Code marketplace, a distinct name such as `pmnm-local`, and a relative source `./plugins/please-make-no-mistakes` instead of the npm source. Then register it and install from it, inspecting each result separately:

```bash
claude plugin marketplace add /absolute/path/to/tmp-marketplace
```

```bash
claude plugin install please-make-no-mistakes@pmnm-local --scope local
```

For a single session without installing anything, start Claude Code with `claude --plugin-dir /absolute/path/to/tmp-marketplace/plugins/please-make-no-mistakes`. Start a new session before judging behavior either way.

After changing the source, pack again, replace the plugin directory, remove and add the installed copy again, review the changed hook in `/hooks`, then start a new conversation. Local-path marketplaces are an authoring route and cannot be upgraded with Git marketplace semantics. Codex's plugin-creator tooling can generate an equivalent local marketplace; either way, remove the disposable marketplace when the test ends so it cannot shadow the published route.

From the repository root, validate the source candidate with:

```bash
npm run release:verify
```

This validates the declared source, documentation, behavior fixtures, brake classification and decisions, exact npm payload, and isolated installation. It does not publish, tag, push, modify the real Codex profile, trust a hook, or prove that an already-running conversation loaded the current revision.

## Published Release Verification

### 13. Verify the immutable public artifact

After a matching release tag has published its npm version, run:

```bash
npm run verify:published -- <version>
```

The verifier requires a clean checkout at local tag `v<version>`, queries and installs that exact npm version with lifecycle scripts disabled, validates the installed bytes, and exercises the tag-pinned GitHub marketplace inside a temporary `CODEX_HOME`. External unavailability is `blocked`, never success.

The release and Trusted Publishing procedure is defined in [docs/distribution.md](docs/distribution.md).

## Background

### 14. Why this procedure is strict

Most setup errors do not come from a missing command. They come from collapsing distinct facts: treating a package as an installation, an installation as activation, an executable as the current host, or a plausible command as supported grammar. The procedure keeps those transitions observable while allowing each host to retain its own installation model.

Please, Make No Mistakes remains one portable Agent Skill. The Codex and Claude Code plugins also carry the destructive-operation brake, registered separately for each host. Other hosts can use the portable skill without one, and any future adapter must preserve rather than fork or weaken the behavioral contract.
