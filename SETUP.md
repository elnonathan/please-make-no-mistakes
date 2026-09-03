# Setup

This is the single installation, update, rollback, removal, and installation-verification authority for Please, Make No Mistakes. It is written for both people and agents. The supported Codex route uses this GitHub repository as a marketplace whose catalog selects one exact npm package version containing the portable skill and an optional Codex lifecycle guard.

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

The repository's automated distribution checks currently cover Codex CLI `0.144.4` and the command shapes below. A later executable may change its grammar; current help and current official documentation outrank this historical minimum.

OpenAI's current [plugin packaging](https://developers.openai.com/plugins/build/plugins) and [complete-plugin testing](https://developers.openai.com/plugins/deploy/connect-chatgpt) documentation are the public platform references for the manifest, marketplace, fresh-conversation, positive, and negative evaluation boundaries.

The bundled Codex guard additionally requires a supported Node.js runtime on PATH. This release is validated on Node.js 22 and 24. Inspect it before installation:

```bash
node --version
```

OpenAI's current [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks) is authoritative for discovery, event coverage, trust review, plugin data, and bypass limits.

The public source is `https://github.com/elnonathan/please-make-no-mistakes`. The marketplace identity is `please-make-no-mistakes`, and it must offer an exact package version rather than a mutable selector.

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

The skill and hook have separate runtime boundaries. In Codex, open `/hooks`, locate the PMNM hook source, inspect its commands, and explicitly trust the current definition only if it matches the installed package. Installation or enablement does not trust a non-managed hook automatically. A changed hook hash returns to review-required state.

Start a new conversation after installation. Then use a bounded direct activation check:

```text
$please-make-no-mistakes explain how you would investigate a non-trivial regression; do not modify files
```

The reply should acknowledge the skill and preserve its investigation-before-mutation boundary. This proves only that the new conversation can discover and follow the skill for that prompt; it does not prove every future model will comply.

When the hook was intentionally trusted, use a second read-only check:

```text
$please-make-no-mistakes report the current procedural guard state without modifying files
```

The conversation should receive a compact message headed by the current `Please, ...` capability, without a diagnostic code, and an internal status control call should be rewritten rather than executed by the shell. The language may follow a bounded English or Spanish heuristic. This proves only that the reviewed hook ran for that session. It does not prove semantic readiness, complete tool interception, or correct future decisions.

## Install With Another Host

### 5. Use the host's own discovery contract

There is no universal command that registers an Agent Skill in every coding agent. For an identified non-Codex host:

1. Find its current, official skill or plugin installation instructions.
2. Establish whether it accepts a repository, a packaged plugin, or a skill directory.
3. Confirm the exact destination, configuration grammar, restart behavior, and update/removal mechanism.
4. Inspect the PMNM artifact before copying or registering anything. The canonical skill root inside the artifact is `skills/please-make-no-mistakes/`.
5. Present the smallest operation-specific plan and preserve unrelated host configuration.
6. Execute one authorized action at a time, or ask the user to run it and return the full result.
7. Verify discovery in a clean conversation with a positive and a negative activation prompt.

When the agent cannot inspect or operate the target host directly, the user remains the command runner. Do not ask the user to choose among speculative integrations; derive the supported route from host evidence and ask only for the missing fact or output.

The npm package can transport the exact public files to environments that understand npm artifacts, but it does not register or activate PMNM by itself. A host-specific adapter may be documented later only after its complete install, update, rollback, removal, and clean-session verification path has been tested.

## Verify The Installation

### 6. Match the claim to the evidence

Use this proof ladder. Never report a stronger state than the strongest completed step:

1. **source resolved** — the intended repository, tag, or exact package exists;
2. **artifact inspected** — the package identity, version, manifest, and skill files agree;
3. **host registered** — the host recognizes the marketplace, plugin, or skill source;
4. **installed and enabled** — the host reports the exact intended plugin version active;
5. **fresh-session discovered** — a new conversation exposes the skill;
6. **activation observed** — a direct prompt uses the skill and a negative prompt avoids unnecessary activation;
7. **hook discovered** — Codex lists the bundled lifecycle source and its review state;
8. **hook trusted** — the user reviewed and trusted the exact current definition;
9. **guard behavior observed** — a fresh session receives guard context and a read-only control call is rewritten;
10. **behavior observed** — representative prompts preserve the material behavioral contract.

Use one terminal result:

- `verified`: the strongest state requested by the user has direct evidence;
- `pending-restart`: installation or update succeeded, but clean-session discovery still requires a restart or new conversation;
- `blocked`: a required host, source, permission, network, or verification channel is unavailable.

Package installation, a successful validator, a saved marketplace entry, a hook file in the package, or a manually started process is not proof that a conversation loaded the skill or ran the hook. Report skill activation and hook activation separately. When the host cannot reveal the loaded revision or trusted hook hash, say so explicitly.

### Optional durable context onboarding

Skill installation and user-context connection are separate outcomes. A successful installation MUST NOT create a context store, locator, activity record, or personal profile automatically.

When the user wants cross-session continuity, first inspect whether an authorized store and locator already exist. If none exists, complete the storage preflight: ownership and subject, audience, repository relationship, access, versioning or ignore state, synchronization or publication exposure, sensitivity, retention, recovery, retrieval needs, and existing stores. Recommend the smallest supported location from that evidence. Ask one focused location question only when a user-owned choice remains material; do not make the user invent the storage design or offer conversation-only continuity as the default.

Then prepare one outcome-complete reviewed plan for the smallest canonical activity, required locator or registry connection, bounded routine-update delegation, privacy and retention boundary, and retrieval validation. Present adjacent known authority needs once while preserving each target, scope, and digest independently. Keep every structural and configuration effect explicit in the digest and obtain fresh approval before applying it. Creating only an empty root does not prove that a fresh conversation can recover the activity.

Verify context connection separately by starting from the authoritative locator, resolving the canonical activity, and reporting the exact recovery boundary. Missing optional context does not invalidate the installed public skill.

## Troubleshooting

### 7. Diagnose the failed boundary

Classify the first unproven boundary before changing anything:

- **source failure** — repository, tag, registry, or network cannot be resolved;
- **artifact failure** — identity, version, manifest, or packaged files disagree;
- **registration failure** — the host rejects or cannot find the marketplace or skill source;
- **installation failure** — the plugin is not installed or enabled at the intended version;
- **discovery failure** — a fresh conversation does not expose the skill;
- **hook-review failure** — the hook is installed but absent, disabled, changed, or still requires trust;
- **guard-runtime failure** — the trusted hook cannot start Node.js, persist bounded state, or return a valid lifecycle decision;
- **behavior failure** — discovery succeeds but representative prompts do not follow the contract.

Do not convert a command failure into `pending-restart`. Do not use similarly named local files, a readable `SKILL.md`, or an executable on `PATH` as evidence for a different boundary. Report the literal failure, the evidence collected, and the smallest next action.

## Update

### 8. Refresh and verify an existing Codex installation

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

Review `/hooks` after every update. A changed bundled hook requires fresh trust for its new hash. Start a new conversation and repeat both bounded checks. Until then, report `pending-restart`; an existing conversation does not prove that it reloaded an updated skill or hook.

For a non-Codex host, use only its documented update mechanism. Do not assume reinstall, cache replacement, or marketplace refresh semantics are equivalent.

## Rollback

### 9. Restore an exact known release

Rollback is a state-changing operation and requires an explicit target revision. Confirm that the immutable Git tag and matching artifact exist before removing the current installation.

For Codex, inspect the current removal and marketplace-add grammar. Then remove only this plugin and its project-specific marketplace, add the repository pinned to the requested `vX.Y.Z` ref, reinstall the plugin, and verify the exact version. Execute and inspect each step separately; do not use a mutable branch as a rollback target.

If the requested artifact or host rollback route cannot be verified, stop with `blocked` and leave the current installation intact.

## Removal

### 10. Remove only PMNM-owned state

Confirm current identifiers and the removal command grammar, then run separately:

```bash
codex plugin remove please-make-no-mistakes@please-make-no-mistakes
```

Remove the project-specific marketplace only when the user also authorizes that effect and no remaining installation depends on it:

```bash
codex plugin marketplace remove please-make-no-mistakes
```

Removing a marketplace source is distinct from removing an installed plugin. Neither operation authorizes deleting an external context store, activity records, project adapters, or user data; those are deliberately outside the installed plugin.

For another host, use its documented removal mechanism and preserve unrelated configuration and user context.

## Local Checkout

### 11. Test a source tree without publishing it

Maintainers and contributors may add an absolute checkout path after explicitly choosing the `local-checkout` operation:

```bash
codex plugin marketplace add /absolute/path/to/please-make-no-mistakes
```

Then use the plugin-add step from section 4.

After changing the local plugin, remove and add its installed copy again, review the changed hook in `/hooks`, then start a new conversation. Local-path marketplaces are an authoring route and cannot be upgraded with Git marketplace semantics.

From the repository root, validate the source candidate with:

```bash
npm run release:verify
```

This validates the declared source, documentation, behavior fixtures, host-guard transitions, exact npm payload, and isolated installation. It does not publish, tag, push, modify the real Codex profile, trust a hook, or prove that an already-running conversation loaded the current revision.

## Published Release Verification

### 12. Verify the immutable public artifact

After a matching release tag has published its npm version, run:

```bash
npm run verify:published -- <version>
```

The verifier requires a clean checkout at local tag `v<version>`, queries and installs that exact npm version with lifecycle scripts disabled, validates the installed bytes, and exercises the tag-pinned GitHub marketplace inside a temporary `CODEX_HOME`. External unavailability is `blocked`, never success.

The release and Trusted Publishing procedure is defined in [docs/distribution.md](docs/distribution.md).

## Background

### 13. Why this procedure is strict

Most setup errors do not come from a missing command. They come from collapsing distinct facts: treating a package as an installation, an installation as activation, an executable as the current host, or a plausible command as supported grammar. The procedure keeps those transitions observable while allowing each host to retain its own installation model.

Please, Make No Mistakes remains one portable Agent Skill. The Codex package also carries a host-specific procedural adapter. Other hosts can use the portable skill without it, and any future adapter must preserve rather than fork or weaken the behavioral contract.
