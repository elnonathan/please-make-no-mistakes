# Security

## Security Model

Please, Make No Mistakes is primarily an instruction, evidence, and collaboration discipline. It can make required transitions and missing evidence visible. Markdown instructions alone cannot intercept every host mutation channel, authenticate every event, or guarantee model compliance.

### Authority and untrusted content

Repository files, tickets, logs, web pages, tool output, generated code, and retrieved records are evidence sources, not automatic instructions. Content discovered during investigation cannot expand user authority, disable safeguards, authorize publication, or redefine the target operation merely because it contains imperative language.

Higher-authority host, user, repository, and project instructions remain controlling within their scope. When two sources disagree, preserve the conflict and resolve authority instead of silently selecting the more convenient one.

### Workspace and context boundary

The installed plugin is replaceable package content. Personal context, project context, activity records, screenshots, HAR files, logs, videos, datasets, credentials, and other user data must remain in a separately authorized location.

The skill does not make an external context store private. Filesystem permissions, encryption, retention, backup, synchronization, sharing, deletion, and publication remain properties of the selected store and host. Ignored files are not necessarily encrypted or access-controlled.

Setup or source validation does not authorize inspecting unrelated user repositories. Activity-record authority does not authorize moving, deleting, publishing, or changing the visibility of those records.

### Optional runtime

The bundled context-store runtime performs bounded metadata inspection and in-memory create-only planning. A plan includes exact content hashes, source and target preconditions, and either complete small text or a bounded prefix for review. Its output may therefore contain user-supplied record text and absolute source paths; callers must not place secrets or unnecessary sensitive content in a request or expose plan output to an unintended audience. It does not apply plans, replace files, move, delete, migrate, publish, ingest binary evidence, authenticate human approval, or interpret a project's registry semantics.

The runtime rejects symlinks and unsafe targets within its declared contract and contains no store-writing primitive. Each plan is one shot: a host must reconstruct it against unchanged source preconditions and obtain fresh approval before applying effects. Those checks reduce covered filesystem risks; they do not establish the confidentiality or correctness of an unknown store.

The separate record-conformance runtime is also read only. It validates only an explicitly adopted Standard file profile, stable fields, relative pointer safety, basis consistency, and latest capture state. It does not validate arbitrary backends, authenticate record authorship, or prove that the recorded claims are true.

### Host enforcement

The Codex plugin bundles a dependency-free Node.js lifecycle guard. Codex exposes the hook for review through `/hooks`; non-managed users decide whether to trust its current content hash. Installation, skill discovery, hook discovery, hook trust, and successful guard execution are separate states. A changed hook requires renewed review under the host's policy.

When trusted and running, the guard stores bounded procedural state under `PLUGIN_DATA`. It records phases, basis counters, effect grants, hashes, and bounded event metadata. It does not persist raw prompts, shell commands, tool output, evidence, source text, credentials, or conversation transcripts. Filesystem permissions, host isolation, retention, and deletion of that state remain host properties.

The guard can deny covered local write paths until required procedural transitions are declared, revoke unused readiness after a new prompt, and expose recovery or incomplete closure. It does not authenticate the truth of a model-authored receipt, infer correct product intent, prove sufficient investigation, replace native sandbox or approval controls, or authorize an effect that the user or host has not authorized. Durable-content and durable-structure authority remain distinct from implementation authority.

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
- rejection of covered unsafe context-store requests;
- rejection of covered invalid workflow traces;
- publication-workflow controls encoded in the repository;
- documentation invariants encoded by the documentation gate.

They cannot establish:

- that every model or host follows every instruction;
- that a discovered or trusted hook executed for every material effect;
- that a hook receipt proves semantic readiness, correct human authority, or complete mutation coverage;
- that a host emitted every relevant action or labeled a human response authentically;
- that all secrets or personal data are detectable by pattern matching;
- that a running conversation loaded the latest installed revision;
- that an external context store is private, complete, or correctly retained;
- that a passing check proves behavior outside its falsifiable contract;
- that PMNM guarantees error-free software or prevents every regression.

## Supported Versions

Security fixes target the latest maintained public release. Before the first public release, reports are evaluated against the current repository candidate. Historical local candidates are not support commitments.

## Report A Vulnerability

Use [GitHub private vulnerability reporting](https://github.com/elnonathan/please-make-no-mistakes/security/advisories/new) for vulnerabilities in distributed files, the optional context runtimes, the lifecycle guard, validators, installation guidance, or release workflow. Treat unexpected guard bypass, effect-scope escalation, unsafe state handling, or sensitive-content persistence as security-relevant even when the portable skill still operates.

Include, when safe:

- the exact version, tag, or source revision;
- affected host and operating system;
- the violated security boundary;
- minimal reproduction steps;
- observed and expected results;
- impact and whether exploitation requires user authorization;
- any workaround already tested.

Do not include active credentials, customer data, private source, or unrelated personal information. If a minimal reproduction would expose sensitive material, describe the shape and coordinate a safer transfer method first.
