# Architecture

## Goal

`please-make-no-mistakes` is one portable Agent Skill packaged with an optional Codex procedural adapter. The skill encodes the provider-neutral software-engineering discipline. The adapter exposes a bounded lifecycle interlock without becoming a dependency of that discipline.

The runtime skill must remain:

- independently usable;
- useful without optional tools or persistent memory;
- precise about invariants and flexible about mechanisms;
- replaceable without deleting user-owned context;
- progressively disclosed so agents load only relevant detail.

## Repository layers

```text
please-make-no-mistakes/
├── .codex-plugin/plugin.json         # Plugin identity, skill route, and presentation
├── .agents/plugins/marketplace.json  # Repository marketplace catalog
├── .github/workflows/
│   ├── ci.yml                        # Validation on source changes
│   └── publish.yml                   # Tag-only npm Trusted Publishing
├── README.md                         # Product, setup entry point, and navigation
├── SETUP.md                          # Agent-directed setup and verification authority
├── ARCHITECTURE.md                   # Maintainer architecture
├── CHANGELOG.md                      # User-visible change history
├── CONTRIBUTING.md                   # Public contributor contract
├── SECURITY.md                       # Security and privacy boundaries
├── ROADMAP.md                        # Public direction without private state
├── LICENSE                           # MIT license for original project materials
├── docs/
│   ├── architecture-decisions.md     # Durable public design rationale
│   ├── distribution.md               # Release and supply-chain contract
│   └── getting-started.md            # Representative activation and result guidance
├── assets/pls.png                    # README mascot asset
├── package.json                      # npm payload and validation commands
├── hooks/
│   ├── hooks.json                    # Codex lifecycle event configuration
│   └── pmnm-guard.mjs                # Dependency-free procedural interlock
├── skills/
│   └── please-make-no-mistakes/      # The distributable Agent Skill
│       ├── SKILL.md                  # Core loop and reference router
│       ├── agents/openai.yaml        # Optional OpenAI client metadata
│       ├── references/               # Conditional procedures
│       ├── assets/                   # Non-operative examples
│       └── scripts/
│           ├── context_store.py      # Optional read-only inspector and planner
│           └── record_conformance.py # Optional Standard-profile checker
├── evals/                            # Activation, behavior, trace, and host-guard contracts
└── scripts/                          # Documentation, host-guard, artifact, and release checks
```

A maintainer may keep `AGENTS.md` and a `.ai/` workspace beside this tree. They are local coordination, must be excluded through `.git/info/exclude`, and must never be required to install, use, validate, or publish the plugin.

The root `assets/` directory contains presentation material referenced by the packaged README. It is not part of the runtime skill and must not be interpreted as instructions, context, evidence, or an adapter. A third-party placeholder with unresolved reuse rights blocks public release even though it is non-operative.

## Runtime responsibilities

### `SKILL.md`

Contains a compact control plane rather than the complete procedure:

- one central capability router;
- stable capability identifiers and a default composed route;
- a compact continuation record with `continueWith` and `resumeWith`;
- literal investigation, alignment, authority, reconciliation, escalation, blocked, and completion results;
- the rule that only `change.ready` may permit implementation mutation after current `READY`;
- guard evaluation before routing and after every material result;
- bootstrap context before identified-activity resolution, followed by claim-specific task context;
- one pending central continuation rather than a recursive capability stack;
- the low-freedom activity transition and durable-bootstrap route;
- the epistemic escalation boundary for model, tool, or evidence-channel limits;
- claim-driven tool routing that treats suggested continuations as options and preserves each evidence lane's limits;
- changed-artifact diagnostic coverage after implementation mutation without requiring a language, source-control system, or specific diagnostic provider;
- direct links to every conditional reference.

The kernel also preserves the portable invariants required to execute Light work:

- normative language;
- materiality and risk classification;
- non-negotiable invariants;
- provisional and evidence-backed shared-understanding checkpoints plus decision-frontier alignment;
- a provisional scenario seed before broad investigation, followed by a risk-bounded Scenario Coverage Contract and the required Standard/High collaborator or delegated basis before material behavior implementation;
- investigation, observable change readiness, implementation, verification, audit, and reporting loop;
- triggered decision-alignment, observable-equivalence, asynchronous-delivery, and epistemic-reconciliation protocols inside that loop;
- effect-bound authority across implementation, instrumentation, verification, environment, external, and durable-context effects;
- current-state verification separated from an explicit repeatable regression-protection disposition;
- strongest-accessible observable verification, reproducible collaborator handoff, and one explicit final verification disposition;
- identified-activity consistency with the current source or delivery state without requiring a version-control mechanism;
- the distinction between an observable historical boundary and condition origin, reachability, impact, detection, correction, or intent;
- neutral communication baseline;
- explicit context-store mutation boundary;
- durable-record creation gate;
- identified-activity transition receipt before material investigation, with a disjunctive creation gate and trigger-based re-evaluation;
- continuous material-capture behavior for delegated activities, with idempotent event identities, ordered responsibility updates, recoverable partial state, and capture freshness before dependent work;
- canonical current-state reconciliation after correction, recovery, handoff, and closure;
- canonical recovery, archetype selection, and bounded typed-extension authority;
- explicit triggers for every reference.

An agent must be able to perform Light work from `SKILL.md` alone. Standard and High work load references only through the active capability route.

### `references/`

References add detail only when a trigger applies. `SKILL.md` links to every reference directly; references do not require deep chains to discover required behavior.

- `epistemic-integrity.md` — **Please, Check Before You Claim**: claim basis, verification status, provenance, conflicts, causal and observable bridges, epistemic discontinuity, negative claims, and corrections.
- `workflow.md` — **Please, Check Our Understanding**, **Please, Look Before You Change**, and **Please, Make the Smallest Defensible Change**: risk escalation, contracts, surface mapping, candidate comparison, decision-frontier alignment, effect authority, activity/source consistency, observable-equivalence and asynchronous-delivery traces, `REALIGNMENT` and `RECOVERY`, baselines, scope, readiness, and implementation.
- `verification.md` — **Please, Prove It**, including **Please, Plan What Could Break** and **Please, Keep It Verifiable**: scenario derivation and human alignment, coverage mappings, strongest-accessible execution, reproducible handoffs, explicit verification dispositions, environment non-interference, evidence lanes, current proof versus repeatable regression protection, independent challenge, artifact admissibility, observable equivalence, scenario status, parity, absence, and readiness invalidation.
- `verification.md` also owns the changed-artifact diagnostic gate: current coverage for every supported changed artifact, literal errors, bounded fallbacks, and honest residuals.
- `review-and-security.md` — **Please, Check Your Work**: complete change surface, findings, refutation, security invariants, and separation of mechanism from product policy.
- `regression-localization.md` — **Please, Find Where It Changed**: oracle stability, comparable historical states, history traversal, bounded transitions, multidimensional attribution, and operational safety.
- `host-enforcement.md` — **Please, Guard the First Write**: advisory, procedural-interlock, and trusted-readiness boundaries; the bundled Codex adapter; recovery; effect scope; audit events; and explicit enforcement limits.
- `failure-patterns.md` — **Please, Catch Familiar Mistakes**: recurring reasoning, observable-bridge, asynchronous-delivery, correction-recovery, authority, tool-compliance, solution-selection, and engineering traps.
- `collaboration.md` — **Please, Say What Matters**: actionable communication and correction behavior.
- `context-layers.md` — **Please, Use the Right Context**: optional configuration, tool requirements, availability evidence, bounded fallbacks, and readiness effects.
- `context-layers.md` also defines the claim-driven tool evidence record and the stop condition for optional tool continuations or expanded detail.
- `context-store-operations.md` — **Please, Ask Before You Rearrange**: no-write discovery and in-memory planning, bounded plan summaries, digest-bound approval, and host-executed application and rollback.
- `durable-record-protocol.md` — **Please, Don't Lose the Thread**: activity resolution, transition states, creation gate, lifecycle, archetypes, and bounded extension delegation.
- `continuous-activity-capture.md` — **Please, Write It Down**: automatic material capture, canonical reconciliation, responsibility routing, completeness checks, delegation boundary, and failure behavior.
- `durable-record-schema.md`, `durable-record-storage.md`, and `durable-record-retrieval.md`: Activity Record Contract, Compact/Standard/Extended archetypes, optional layout profiles, project taxonomy, evidence manifests, safe storage, query, and completeness maintenance.

### `assets/`

Assets are non-operative examples. They demonstrate shape without being registered or loaded as current context. Public packages must not contain a real person's profile, real project context, credentials, private paths, or live registry.

### `skills/please-make-no-mistakes/scripts/context_store.py`

The optional skill runtime implements only `inspect` and `plan`. The core does not depend on it and follows the same protocol with available tools when the CLI is unavailable.

`inspect` and `plan` perform no write operation and do not change store content, directory entries, configuration, locators, or lifecycle. Reads can update access-time metadata under the host filesystem's policy. Request and plan schema v2 make each operation's purpose, source and target preconditions, intended mode, exact content hash, bounded content review, source-state identity, and one-shot digest visible. `plan --stdin` avoids requiring a temporary request file. The plan describes an explicit absent-root creation effect, local filesystem `mkdir`, and create-only UTF-8 `write-file`. The optional CLI requires Python 3.9+ and POSIX `dir_fd` plus `O_NOFOLLOW`; the core protocol does not. The runtime does not persist or execute plans, auto-adopt a store, choose storage without the semantic preflight, replace/move/delete/migrate, implement registry semantics, ingest binary evidence, use remote backends, or write user data into the installed skill.

Requests may contain new text. A file request must be a single-link regular file with current ownership and owner-only POSIX mode bits, but this does not establish effective privacy under richer ACL or sharing policy. The review output deliberately exposes direct content hashes and either complete small text or a bounded prefix, size, and line count. `content_file` also exposes its source identity and absolute path. Request input, plan output, privacy, retention, and later deletion remain caller-owned responsibilities; neither should contain secrets or be shared beyond the intended audience.

All structural, configuration, locator, and lifecycle mutation belongs to host tools under the protocol. If such a host effect is not represented by the create-only machine plan, the host must produce a new complete plan and deterministic digest before requesting approval. This does not supersede a still-valid bounded delegation for routine record content updates.

### `skills/please-make-no-mistakes/scripts/record_conformance.py`

This optional read-only runtime validates only an explicitly adopted `pmnm.standard-file/v1` activity. It checks the four Standard responsibility files, stable index labels, the `pmnm.activity-record/v1` contract identity, current basis agreement, the latest complete capture identity, and local relative pointer safety. It neither creates the profile nor validates semantic truth, authorship, privacy, arbitrary mapped layouts, or non-file backends.

## Core versus adapters

The portable core defines capabilities and invariants. Adapters assign local values.

```text
portable core
+ zero or more verified optional adapters
+ current authorized task context
= effective behavior
```

Examples of portable rules:

- do not present inference as verified fact;
- state what evidence proves and does not prove;
- verify a material change before completion;
- preserve a correction when future work could repeat the error.

Examples of adapter values:

- repository commands and resource limits;
- project-specific identifiers;
- environment safety rules;
- an optional language-aware navigation tool for a compatible codebase;
- explicit communication preferences;
- durable-record location and retention.

An absent adapter inherits core behavior and never disables the skill.

### Host adapter ownership

The current procedural adapter is owned by Codex-specific surfaces: `.codex-plugin/plugin.json`, `hooks/hooks.json`, `hooks/pmnm-guard.mjs`, `evals/host-guard-cases.json`, and `scripts/test_host_guard.mjs`. Their event names, tool inputs, output decisions, state location, trust flow, interruption behavior, and coverage claims are one tested contract. A superficially similar host API is not evidence that this contract can be reused unchanged.

A future Claude Code or other host adapter must begin on separate manifest, hook configuration, event-normalization, runtime-entry, evaluation, installation, and verification surfaces. It must not repurpose `hooks/hooks.json`, edit Codex behavior to satisfy another host, or describe the Codex suite as evidence for another runtime. If sharing the state-machine implementation becomes worthwhile, extract a provider-neutral engine only as an explicit cross-host refactor. That change must retain both adapters as thin owners, run each native validator and behavior suite, and preserve every Codex invariant or document an intentional contract change.

The portable [host adapter contract](skills/please-make-no-mistakes/references/host-enforcement.md#host-adapter-contract) defines what another integration must declare. It does not make a generic executable adapter exist. Missing lifecycle or interception signals become literal partial or advisory coverage rather than guessed equivalents.

Historical localization follows the same boundary. The portable reference defines oracle, comparability, attribution, and safety contracts; a verified adapter supplies revision identities, graph semantics, traversal commands, isolated-workspace behavior, automated result mapping, and restoration mechanics. No source-control or hosting mechanism is universal.

## Context and storage boundary

User context and durable work records must live outside the installed skill directory. Package updates may replace the runtime skill, references, assets, and metadata without touching user data.

Optional context is loaded only when:

1. a registry or authoritative instruction identifies it;
2. its match conditions are verified;
3. its capabilities are relevant to the current task;
4. its values do not conflict with higher authority.

Bundled examples never activate by existing.

Inspection and planning may discover and describe an existing store without mutation. Creating or changing a store, registry, locator, ignore rule, or adoption record requires a concrete immutable plan and fresh explicit user approval for its canonical root, operations, and digest. A standing workflow cannot provide that approval.

An explicitly delegated activity may update its declared record content without a new digest for every material capture. Its initial approved plan may also authorize later typed extensions or evidence entries only inside declared boundaries with bounded roles, operations, naming, material volume or review thresholds, index maintenance, privacy, and retention. Neither authority permits another activity, arbitrary paths, root or schema changes, location, registry, visibility, publication, movement, or deletion. Identified activity transitions must resolve before material activity investigation to an existing delegated record, a freshly approved new record, an explicit `no-record-with-valid-reason` decision, or a visible awaiting-approval or blocked state. A new-store bootstrap is outcome-complete only when the smallest canonical activity, required locator or registry connection, routine-update delegation, privacy boundary, and retrieval proof are established; an empty root is not an activity. For a missing record, every creation-gate condition is evaluated independently and one true condition is sufficient. A provisional no-record result is invalidated when a later material correction, traceability burden, risk or scope change, continuity need, direct capture request, or other gate condition appears.

The canonical activity index is current recovery truth and the source for derived project catalogs. Project adapters own taxonomy values and aliases; the public core owns only the query and ambiguity-handling contract. This prevents a rigid public blueprint while keeping activities consistently searchable.

## Model capability portability

The core is written so a lower-capability or quantized model can follow explicit conditions and actions without reconstructing hidden rules. Procedural trust does not require equal technical performance. It requires the model to expose evidence gaps, conflicts, and capacity limits before it crosses a material boundary. A stronger model may choose tools and depth, but it may not waive invariants silently.

Capabilities do not call peers. Each returns a compact continuation to the central router. This keeps routing inspectable, prevents a successful local step from becoming implicit global authority, and provides a resume point when work moves to another model, tool, or collaborator.

Tools follow the same principle. A tool's `continueWith`, page token, related call, or suggested query describes available operations, not the PMNM route. The router selects another operation only when it can resolve a named material gap. Static or semantic relationships remain candidate structure until another applicable evidence lane establishes observable reachability or impact.

Each critical behavior therefore has:

- a trigger;
- a required action;
- an observable result;
- a stop, escalation, or fallback condition;
- a forbidden inference where useful.

For material implementation work, the observable transition is:

```text
BOOTSTRAP-CONTEXT -> ORIENT -> ACTIVITY-READY -> SEED-SCENARIOS -> INVESTIGATE -> [COMBINED ALIGNMENT] -> READY -> IMPLEMENT -> VERIFY -> CAPTURE -> AUDIT -> REPORT
                              |                                                                    | INCOMPLETE -> continue safe discovery
                              |                                                                    | BLOCKED -> wait for exact missing evidence, authority, capability, environment, fixture, or decision
             -> AWAITING-APPROVAL | BLOCKED

material loss of the active direction's evidentiary basis,
or explicit collaborator rejection of that direction
  -> REALIGNMENT | RECOVERY -> one evidence-based question -> turn boundary
  -> collaborator response -> INVESTIGATE -> DIRECTION-ALIGNED -> SCENARIO-ALIGNED when triggered -> new READY

correction after dependent mutation,
or repeated correction in one unresolved direction
  -> RECOVERY branch of the same hard stop
```

`ACTIVITY-READY` applies when the work has an identified activity. It means a current Activity Transition Receipt resolved record state or validly established that no record is needed; it does not mean implementation readiness. `planned-and-awaiting-approval` and `blocked` stop material investigation. `no-record-with-valid-reason` continues provisionally and is re-evaluated when a trigger appears. Routine durable capture inside an already valid bounded delegation may occur during investigation. It is not an implementation mutation, does not satisfy readiness, and cannot expand context-store authority.

For a material behavior change, defect correction, or contract-sensitive refactor, the readiness receipt includes the aligned Scenario Coverage Contract, strongest accessible observable check, and intended regression-protection disposition. The coverage contract derives material scenarios from intent, inspected reachability, and risk, maps every material item to a scenario or authorized omission, and requires a current collaborator response for Standard/High work unless prior scope-specific delegation applies. Verification attempts the strongest authorized accessible contract check and resolves `executed`, `collaborative`, `reproducible-handoff`, `blocked`, or `not-applicable`; a handoff never becomes execution evidence. The completion pass resolves the final protection status and the final audit challenges coverage, observable verification, recurrence oracle, expected execution conditions, blind spots, controlling requirements, and residual risk. These responsibilities stay inside **Please, Prove It** rather than adding another top-level skill or reference.

After the final implementation mutation, PMNM inventories changed artifacts through the current delivery-state mechanism and checks every artifact supported by an executable current diagnostic capability. This is a conformance gate, not a replacement for contract verification. Unsupported artifacts, untrusted output, pre-existing residuals, and introduced or unattributed errors keep distinct completion effects.

Host enforcement is an adapter boundary, not a core guarantee. The Codex package bundles a procedural interlock for covered lifecycle and local mutation paths. It runs only after the host exposes and trusts it. Advisory instructions, that procedural interlock, and independently trusted readiness remain different claims. The hook can enforce declared order, prompt invalidation, and effect scope for events it receives, but a model-authored receipt does not become semantically trusted merely because the hook accepts its shape. Disabled, untrusted, unsupported, failed, or bypassed paths leave the portable skill advisory or the coverage partial and must be reported literally.

The Codex adapter does not infer acceptance from the presence of a later collaborator turn. It records the response boundary, requires explicit classification, and invalidates dependent state when the response changes, leaves unclear, or rejects the active basis. It also serializes covered writes while a result is outstanding, provides a conservative reconciliation path for missing results, makes contradictory late results visible, and requires current successful verification after the latest implementation mutation before a passed closure.

Every card and denial the adapter emits is compiled from the current state into one action justified by that state, spoken in the agent's own first-person guard voice with at most one control line; the suite proves that each emitted line is accepted by the state that emitted it and an action oracle fixes the expected action per output class. A denied covered write becomes one cursor bound to its exact tool and command that later prompts and Stop keep visible until its own observed success, invalidation, collaborator redirection, completion, or an authorized activity change. A grant is authority, not execution: `created` follows observed structural operations, and a pending nonimplementation result is settled before a collaborator turn that arrived meanwhile is classified. Closure is progressive, and an activity whose authorized effects contained no implementation mutation has its own honest terminal path. Concurrent lifecycle deliveries serialize through owner-tagged locks with orphan recovery bounded to the hook timeout.

User-visible adapter output begins with the full `Please, ...` capability name and one concise next action. Diagnostic codes and the internal `pmnm-guard` grammar remain implementation details. The current English and Spanish selection stores only a bounded enum and is not presented as universal language detection; host lifecycle identifiers remain unchanged.

The package-level installation smoke tool compares a trusted runtime tree with an installed tree and statically inspects both bundled runtime interfaces without executing either copy. The portable trace validator checks observable order from imported JSON traces, including bootstrap context, identified-activity transition and activity/source consistency, outcome-complete record bootstrap, scenario seeding before material investigation, decision and scenario alignment, basis revisions, epistemic reconciliation, claim-driven tool evidence, observable bridges, asynchronous delivery, effect scope, gate-trigger invalidation, correction recovery, readiness, implementation mutation, observable-verification disposition, changed-artifact diagnostics, executable handoff shape, regression-artifact admissibility, capture transactions, recoverable `capture-incomplete`, audit corrections, and canonical reconciliation for delegated records. It does not launch model clients, authenticate the event source, infer an unreported trigger, tool-evidence need, diagnostic applicability, or consumer, prove that a declared check was really accessible, prove a real turn boundary or human response from model-authored fields, or establish semantic truth from field presence. Provider-specific client execution and interception remain outside the model-neutral package.

## Distribution boundary

The currently tested end-user adapter is a Codex plugin containing the portable skill and a bundled optional lifecycle guard, installed from the `elnonathan/please-make-no-mistakes` GitHub marketplace. That repository catalog pins one exact public npm artifact. The same artifact may support another coding agent through that host's verified registration contract, but the Codex hook is not assumed to operate there. A listing in the OpenAI Plugins Directory is not part of this distribution contract. Success in GitHub, npm, marketplace installation, enablement, skill discovery, hook trust, guard execution, and loaded-revision identity remain separate claims.

The npm artifact contains `.codex-plugin/plugin.json`, the `skills/` tree, `hooks/`, human documentation, static validation, executable tests, and reusable eval definitions. `npm install` alone must not be presented as Codex installation, skill activation, or hook trust. The bundled context-store CLI and Codex guard are not required for the portable skill's advisory behavior. The payload excludes:

- source inventories and private provenance notes;
- local registries;
- real contexts and snapshots;
- evaluation run outputs;
- caches and operating-system metadata.

`SETUP.md` is the sole detailed procedure for installation, repository-marketplace testing, updates, rollback, removal, and source verification. It resolves the actual host and command runner before state changes. `docs/distribution.md` owns release identity, Trusted Publishing, and postpublication verification. Local machine locators and symlinks remain private maintainer state rather than public installation guidance.

The documentation contract rejects duplicated setup commands, missing authority guards, collapsed host/source states, and overstated verification. Blind decision cases keep expected routing outside the model-facing prompt. The aggregate release verifier runs every configured check before reporting the complete failure set; none of these source checks substitutes for clean-session behavior evidence.

CI validates source changes but never publishes. After npm's required one-time, interactively authenticated package bootstrap, a separate workflow can publish only a matching `v<version>` tag from the canonical repository through npm Trusted Publishing with OIDC and the protected `npm-publish` environment. Tagging, pushing, bootstrap publication, trusted-publisher configuration, environment approval, package publication, GitHub release creation, and any future directory submission remain separately authorized external actions.

Original project code and documentation use the MIT License. Before public release, every third-party visual asset must have verified reuse permission or be replaced, registry-name availability must be rechecked, and the selected clean-session evaluation matrix should be run against the exact release artifact.
