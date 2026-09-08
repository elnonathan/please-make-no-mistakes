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

The Codex plugin bundles a dependency-free Node.js lifecycle guard. Codex exposes the hook for review through `/hooks`; non-managed users decide whether to trust its current content hash. Installation, skill discovery, hook discovery, hook trust, and successful guard execution are separate states. A changed hook requires renewed review under the host's policy.

When trusted and running, the guard stores bounded procedural state under `PLUGIN_DATA/host-guard/v3` in three layers. Session state contains the selected task and transient flow. Project state contains reusable project-scoped authority. Task state contains that task's Digest, permissions, counters, verification and completion. Each layer has its own lock and monotonic revision, so different sessions can work on different tasks while concurrent use of one task exposes stale state before another material write. It does not persist raw prompts, shell commands or previews, tool output, evidence, source text, credentials, or conversation transcripts. Filesystem permissions, host isolation, retention and deletion of that state remain host properties.

The guard can block a project write until a task is started and its plan Digest is agreed, and block the first write to a path outside the agreed plan before it runs; isolate each session's selected task while serializing project authority and detecting stale same-task revisions; require applicable rule files to be reloaded after startup, resume, clear or compact; require material non-file state transitions to appear in the plan and bind them to exact task operations; require a complete operational preflight before persistent local-environment authority enters a Digest; distinguish a project target, contained PMNM target and external-only target before selecting authority; bind a secret-scanned forecast of exact sensitive operations or bounded capabilities to task or project scope; ask before a new sensitive command or direct external write and admit the identical reviewable operation once after the human's yes is recorded; require a revised Digest instead of one-off authority for an unlisted state change; split commands with an unknown segment or several sensitive effects; require an explicit effect declaration when host metadata and mechanical evidence are insufficient; block a write under the PMNM folder that leaves the folder through a path or symbolic link, or that carries what looks like a secret, and direct the agent to keep a reference to where the secret lives instead; preserve invalid pointer or index artifacts before human-authorized recovery; and refuse to close a task until current passed verification, any required review and the final audit are complete, a shaped Test Digest has then been shown to the human and a later response has been received. Path containment and result type are checked when a write or covered result is inspected; a path changed between check and use, and effects outside covered events, remain outside the guard's reach. The guard never claims semantic correctness: it does not authenticate the truth of a model-authored receipt or verification claim, infer correct product intent, prove sufficient investigation, prove external state from a successful operation, replace native sandbox or approval controls, or authorize an effect that the user or host has not authorized. A declaration is a claim, not authority. Native host approval remains controlling. Agreeing to the implementation plan alone is not a yes to commit, push, tag or publish. An exact operation or bounded capability named in the permission forecast may receive authority with that agreement; otherwise each needs its own yes at the time or a human-owned rule. The secret check is pattern based and conservative; it is not a guarantee.

Coverage is deliberately partial. The adapter can act only on lifecycle and tool events Codex sends to it. Disabled or untrusted hooks, unsupported hosts, host launch failures, specialized paths that do not emit covered events, and effects outside the matcher can bypass the interlock. The portable skill remains usable in advisory mode, and any material loss of expected guard coverage must be stated rather than converted into a successful enforcement claim.

### Supply chain

The npm artifact declares no runtime registry dependency and no lifecycle script. The repository marketplace selects an exact npm version rather than a mutable range. Package validation checks the explicit public allowlist and scans for configured private or credential-like material.

After npm's required one-time package bootstrap with interactive 2FA, the intended publication route is the canonical repository's tag-only workflow, a protected `npm-publish` environment, and npm Trusted Publishing with OIDC. The workflow reads no long-lived npm token.

GitHub source, a local checkout, npm bootstrap, trusted-publisher configuration, an OIDC publication, marketplace registration, installed and enabled state, fresh-session discovery, loaded revision, and any public directory listing are separate trust boundaries.

## Supported Security Claims

The repository checks can establish, for the exact files and events they inspect:

- package, plugin, marketplace, and version consistency;
- the declared payload boundary and absence of configured private patterns;
- exact source, packed, and isolated-installed skill bytes;
- the declared hook configuration, dependency-free runtime boundary, bounded host-guard fixtures, and exact packaged hook bytes;
- rejection of covered writes that leave the PMNM folder, carry a detectable secret, or fall outside the agreed plan;
- separation of covered project, contained PMNM and external-only targets before authority is selected;
- binding of covered non-file state transitions to exact task operations and separate current evidence;
- rejection of covered compound commands that conceal unknown or independently sensitive effects;
- current-verification and material-change requirements before covered task closure;
- rejection of covered invalid guard transitions;
- publication-workflow controls encoded in the repository;
- documentation invariants encoded by the documentation gate.

They cannot establish:

- that every model or host follows every instruction;
- that a discovered or trusted hook executed for every material effect;
- that a hook receipt proves semantic readiness, correct human authority, or complete mutation coverage;
- that a host emitted every relevant action or labeled a human response authentically;
- that all secrets or personal data are detectable by pattern matching;
- that a running conversation loaded the latest installed revision;
- that the PMNM folder is private, complete, or correctly retained;
- that a passing check proves behavior outside its falsifiable contract;
- that PMNM guarantees error-free software or prevents every regression.

## Supported Versions

Security fixes target the latest maintained public release. Before the first public release, reports are evaluated against the current repository candidate. Historical local candidates are not support commitments.

## Report A Vulnerability

Use [GitHub private vulnerability reporting](https://github.com/elnonathan/please-make-no-mistakes/security/advisories/new) for vulnerabilities in distributed files, the lifecycle guard, validators, installation guidance, or release workflow. Treat unexpected guard bypass, effect-scope escalation, unsafe state handling, or sensitive-content persistence as security-relevant even when the portable skill still operates.

Include, when safe:

- the exact version, tag, or source revision;
- affected host and operating system;
- the violated security boundary;
- minimal reproduction steps;
- observed and expected results;
- impact and whether exploitation requires user authorization;
- any workaround already tested.

Do not include active credentials, customer data, private source, or unrelated personal information. If a minimal reproduction would expose sensitive material, describe the shape and coordinate a safer transfer method first.
