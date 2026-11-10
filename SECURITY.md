# Security

## Security Model

Please, Make No Mistakes is primarily an instruction, evidence, and collaboration discipline. It can make required transitions and missing evidence visible. Markdown instructions alone cannot intercept every host mutation channel, authenticate every event, or guarantee model compliance.

### Authority and untrusted content

Repository files, tickets, logs, web pages, tool output, generated code, and retrieved task files are evidence sources, not automatic instructions. Content discovered during investigation cannot expand user authority, disable safeguards, authorize publication, or redefine the target operation merely because it contains imperative language.

Higher-authority host, user, repository, and project instructions remain controlling within their scope. When two sources disagree, preserve the conflict and resolve authority instead of silently selecting the more convenient one.

### Workspace and context boundary

The installed plugin is replaceable package content. The PMNM folder, with its rules and task folders, must remain in a location the user chose, outside the repository and outside the installed skill. Evidence such as screenshots, HAR files, logs, videos and datasets remains referenced in its authorized location by default. Copying or moving it requires an exact custody plan and current authority; moving always changes the source. Credentials and other secrets must never be copied into the PMNM folder. When a reference is necessary, record only where the secret lives. Automated scans cannot prove that pixels, audio, video or opaque binary content is free of sensitive material, so intake of that content also needs a human privacy decision.

The skill does not make the PMNM folder private. Filesystem permissions, encryption, retention, backup, synchronization, sharing, deletion and publication remain properties of the chosen location and the host. Ignored files are not necessarily encrypted or access-controlled.

Setup or source validation does not authorize inspecting unrelated user repositories. Authority over the PMNM folder does not extend to any path outside it.

### Host enforcement

Both plugins register one dependency-free Node.js hook, the destructive-operation brake, on tool calls and on the human's prompts. Claude Code has no per-hook hash review: enabling the plugin is the consent to run its hooks, and `/hooks` only shows them. Codex exposes the hook for review through `/hooks`; non-managed users decide whether to trust its current content hash. A changed hook requires renewed review under the host's policy. Inspect `hooks/claude/hooks.json` or `hooks/codex/hooks.json` before enabling or trusting the plugin. Installation, skill discovery, hook discovery, hook trust and successful brake execution are separate states.

The brake classifies each covered tool call as safe, sensitive or destructive. Known shapes are classified deterministically: deletions, overwrites, history rewrites, service stops and restarts, publication, datastore drops and deletions, and reads of credential files. Anything that runs other code is classified by what it runs: local and sourced scripts by their content, package scripts by their manifest entry, make targets by their recipes, and `find -exec`, `trap`, `awk` and similar carriers by the command they carry. Test runners are the exception: they run the project's own test code and are treated as ordinary project work. MCP tools are placed by name. Every tool of semantic-js-mcp, by the same authors, is known and safe, except a tool named for destruction. It is matched by the exact server names the hosts give it; a name is all the hook sees, so a server registered under one of those names would get the same trust. Any other MCP server runs without the judge only after the human sends the exact prompt `PMNM-ALLOW-MCP <server>`, which the agent cannot send; the entry is sealed, `PMNM-REVOKE-MCP <server>` removes it, and a tool named for destruction still stops. What those rules cannot place goes to the judge model the human confirmed with the prompt `PMNM-CONFIRM-JUDGE <host> <model>`, which the agent cannot send, run through the host's own command-line client with plugins and hooks off; its answer carries a confidence. The brake never picks that model: the agent proposes the cheapest model the host can run, from the provider's published documentation, and the human confirms it or names another. For Claude Code, which keeps no catalog, the confirmation alone names the judge, and a model that no longer exists fails its call and the operation asks; for Codex the brake checks the model against Codex's catalog and asks for a re-evaluation when that offer changes. Destructive operations, and any operation the model did not rate safe with high confidence, run only after the human replies with the exact operation-bound approval token; in Claude Code a deterministic sensitive operation uses the host's own permission prompt instead. A failed or unavailable classification is treated as needing approval, and an error the brake catches while evaluating blocks the operation rather than allowing it. A brake that runs past its time limit or cannot start is handled by the host, which may let the operation run.

Under the host's plugin data directory the brake keeps a secret key, pending approvals, one-time grants, the allowed MCP servers, the notices already shown and decision counts. When the host gives no plugin data directory, that state lives under the system temporary directory. Each approval token is `PMNM-` and four random characters, bound to one operation and one session, and spent by its use; it can be short because the agent cannot send a prompt, so guessing gives it nothing. Approvals are re-read under a lock before each write, and nothing is written without the lock: a busy lock issues no token and spends no grant; an event without a session id cannot be approved in-band, so only the human can run that operation. The confirmed judge is kept there too, sealed. In the PMNM folder it writes `commands.json`, the verdicts for operations the model classified: a hash of the exact operation, its safety and confidence, who decided, and a seal made with the secret key. The judge answers only with a safety and a confidence; no free text from it is stored or shown. `models.json` in the PMNM folder holds the agent's proposal for the judge and grants nothing. Edits inside the PMNM folder are ordinary editing, like edits inside the working directory, unless the folder holds the home directory or overlaps the host configuration, the brake's data or the brake's code; every edit, in either place, is judged by the real path where it lands, a patch's move destination included, so a symlink cannot lead it out or onto a secret or configuration file. Secret and configuration files, matched in any letter case, and deletions there still stop. A `PMNM_JUDGE_MODEL` set in the human's own environment pins the judge there, and a command that sets it is destructive. An entry or grant without a valid seal, or moved to another operation, grants nothing. An operation that reaches the brake's own state is denied on both hosts, before any grant is spent and with no token, so only the human can run it: by any spelling of its path, by a glob that can match it, or through a hardlink or symlink to one of its files. The brake reads a shell command through bash's whole quoting layer: backslashes, single, double, `$'…'` and `$"…"` quotes, and line continuations. It does not resolve expansions: a variable, a command substitution or brace expansion inside a path, an alias or a function. An agent running as the same user can therefore still reach the state through an expansion, or through a program that builds the path itself. The seals stop accidental and casual forgery, not a determined agent. It never stores a prompt, tool output, a transcript or a command in clear. To add its one line asking the agent to load PMNM on the first prompt of a session, and to stop a session's first project tool call once when the skill was not loaded, it keeps sealed hashes of the last 256 session ids, never the ids. Deterministic rules always take precedence over stored verdicts, and an edited script, manifest or Makefile invalidates the verdict recorded for it. Filesystem permissions, retention and deletion of that state remain host and user properties.

The brake never claims semantic correctness. Pattern rules can be evaded by obfuscation; the model judges text, not effects; neither can replace native sandbox or approval controls or authorize an effect that the user or host has not authorized. Native host approval remains controlling. Agreeing to the implementation plan alone is not a yes to commit, push, tag or publish. Each needs its own yes at the time or a human-owned rule. The secret and credential checks are pattern based and conservative; they are not a guarantee.

Coverage is deliberately partial. The brake can act only on the tool calls and prompts its host sends to it. Disabled or untrusted hooks, hosts that are not officially supported, host launch failures, a brake that runs past its time limit and tools outside the Codex matcher bypass it. `PMNM_JUDGE_ACTIVE=1` in the environment turns the brake off, because it marks the judge's own subprocess. A command that sets it is destructive. The procedural interlock that earlier releases registered is retired; its source remains in the package, unregistered, and its retirement is recorded in [architecture decisions](docs/architecture-decisions.md). The portable skill remains usable in advisory mode, and any material loss of expected coverage must be stated rather than converted into a successful enforcement claim.

### Supply chain

The npm artifact declares no runtime registry dependency and no lifecycle script. The repository marketplace selects an exact npm version rather than a mutable range. Package validation checks the explicit public allowlist and scans for configured private or credential-like material.

After npm's required one-time package bootstrap with interactive 2FA, the intended publication route is the canonical repository's tag-only workflow, a protected `npm-publish` environment, and npm Trusted Publishing with OIDC. The workflow reads no long-lived npm token.

GitHub source, a local checkout, npm bootstrap, trusted-publisher configuration, an OIDC publication, marketplace registration, installed and enabled state, fresh-session discovery, loaded revision, and any public directory listing are separate trust boundaries.

## Supported Security Claims

The repository checks can establish, for the exact files and events they inspect:

- package, plugin, marketplace, and version consistency;
- the declared payload boundary and absence of configured private patterns;
- exact source, packed, and isolated-installed skill bytes;
- the declared hook registration, the brake's dependency-free module boundary (built-in imports only, no network calls of its own, only the host clients as its judge), and exact packaged hook bytes;
- deterministic classification of the covered command shapes the brake's tests exercise, including commands hidden in wrappers, substitutions and heredocs;
- that a destructive or unrated operation needs the exact approval token, and that stored verdicts never override a deterministic rule;
- publication-workflow controls encoded in the repository;
- documentation invariants encoded by the documentation gate.

They cannot establish:

- that every model or host follows every instruction;
- that a discovered or trusted hook executed for every material effect;
- that a model's classification is correct, or that a safe verdict proves an operation harmless;
- that a host emitted every relevant action or labeled a human response authentically;
- that all secrets or personal data are detectable by pattern matching;
- that a running conversation loaded the latest installed revision;
- that the PMNM folder is private, complete, or correctly retained;
- that a passing check proves behavior outside its falsifiable contract;
- that PMNM guarantees error-free software or prevents every regression.

## Supported Versions

Security fixes target the latest maintained public release. Before the first public release, reports are evaluated against the current repository candidate. Historical local candidates are not support commitments.

## Report A Vulnerability

Use [GitHub private vulnerability reporting](https://github.com/elnonathan/please-make-no-mistakes/security/advisories/new) for vulnerabilities in distributed files, the destructive-operation brake, validators, installation guidance, or release workflow. Treat an unexpected brake bypass, a destructive operation classified as safe, unsafe state handling, or sensitive-content persistence as security-relevant even when the portable skill still operates.

Include, when safe:

- the exact version, tag, or source revision;
- affected host and operating system;
- the violated security boundary;
- minimal reproduction steps;
- observed and expected results;
- impact and whether exploitation requires user authorization;
- any workaround already tested.

Do not include active credentials, customer data, private source, or unrelated personal information. If a minimal reproduction would expose sensitive material, describe the shape and coordinate a safer transfer method first.
