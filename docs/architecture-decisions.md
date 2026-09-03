# Architecture Decisions

## One portable skill with a bundled Codex guard, no required MCP service

The distributable product is one Codex plugin containing one Agent Skill and one optional host-specific lifecycle guard. The skill remains the semantic source of truth. Its workflow needs instructions, references, examples, and optional local read-only scripts, but it does not require an MCP server or the Codex guard to route decisions, preserve its portable contract, or remain useful in another compatible host.

An MCP service would add process lifecycle, transport, permissions, compatibility, and state boundaries without making semantic readiness trustworthy by itself. PMNM therefore keeps an advisory portable core. Optional external tools may strengthen an evidence lane. The bundled Codex guard can enforce declared procedural order for covered events after explicit host trust, but it does not become a dependency of the core or prove the claims it receives.

## Progressive disclosure

`SKILL.md` owns the invariant loop and routes directly to focused references. Detailed procedures remain outside the core until their trigger applies. This keeps the initial context bounded without making critical transitions implicit.

Bootstrap context, decision alignment, observable equivalence, asynchronous delivery, and epistemic reconciliation are triggered procedures inside that loop, not additional skills or universal ceremony. The kernel resolves only instructions, discovery surfaces, identity conventions, storage constraints, and capability declarations during bootstrap. Claim-specific project adapters load later when their route actually needs them.

## Central router, not a peer capability graph

One public skill owns one central capability router. Capabilities return `result`, `basis`, `conflict_or_gap`, `continueWith`, `resumeWith`, and implementation-mutation status. They do not invoke peers directly.

This borrows the useful part of a tool continuation graph without pretending that capabilities are separate tools or nested skills. It gives a weak model a small map, preserves one bounded pending return target across model or tool escalation, and makes an orphaned authorization or evidence gap detectable. Guards for evidence correction, familiar failures, effect authority, and durable capture run before routing and after every material result. Only `change.ready` may permit implementation mutation after a current `READY` receipt.

## Procedural trust across unequal models

PMNM does not attempt to give every model the reasoning capacity of the strongest available model. It requires a lower-capability model to distinguish discoverable uncertainty, human-owned decisions, epistemic discontinuity, exact external blockage, and its own model, tool, context, or evidence-channel limit.

`ESCALATE` is successful behavior when it preserves the unresolved claim, evidence, lost coverage, safe boundary, recommended contribution, and `resumeWith`. Fabricated certainty is not a substitute for continuity.

## Stable activity responsibilities with adaptable detail

Neutrality removes project values, identifier prefixes, named tools, and storage assumptions. It does not remove the activity workflow. A new delegated file-backed Standard record uses stable recovery, understanding, timeline, and verification surfaces unless a verified project constraint requires another mapping. Compact and Extended remain evidence-selected archetypes.

An identified Standard or High activity defaults to durable continuity unless a precise exception establishes that every independent gate trigger is false and no material recovery value remains. This is intentionally stronger than waiting for a user to ask for documentation after work has already begun. Light untracked work remains a supported negative control.

Project taxonomies supply concrete classifications and relationship vocabulary. Canonical activity indexes supply current truth. Derived catalogs and search indexes make cross-activity queries possible without imposing one domain.

## Authority presentation may compose, authority itself does not

Adjacent known approval needs may be presented in one checkpoint to reduce conversational friction. Every authority item retains its own target, effect, scope, lifetime, issuer, revocation, and digest where structural. A combined presentation never merges permissions, and native hosts may still require separate prompts.

Storage recommendation precedes its authority request. The agent first resolves ownership, audience, repository relationship, access, versioning or ignore state, synchronization or publication exposure, sensitivity, retention, recovery, retrieval needs, and existing stores. Writability or proximity alone cannot select a durable location.

## Human alignment and epistemic continuity

Initial ambiguity remains discoverable: the agent may investigate safely without forcing an early human decision. A visible decision-frontier checkpoint is required only before materially disputable hypotheses or solution classes become the preferred direction, solution-shaped verification, or implementation.

A hard stop has a narrower trigger. It occurs when new evidence materially changes the basis supporting an active direction, or when the collaborator explicitly rejects that direction. `REALIGNMENT` applies before dependent material artifacts require recovery; `RECOVERY` applies after they exist. Both expose the before-and-after epistemic state, ask one focused evidence-based question, and create a turn boundary. Stronger evidence that preserves the direction and minor presentation disagreement are negative controls.

## Scenario coverage remains inside verification

**Please, Plan What Could Break** is a responsibility inside **Please, Prove It**, not another skill, required file, or testing framework. A provisional scenario seed follows initial understanding and precedes broad investigation. Investigation then refines the seed into a Scenario Coverage Contract from actual reachability and risk before material behavior implementation.

Coverage is derived from intent and authority, the inspected system surface, and applicable risk or history. Every material contract dimension and affected consumer maps to a scenario or an authorized omission with residual risk. Standard and High work requires one current collaborator response unless prior explicit scope-specific delegation already covers those decisions; a generic implementation request does not. Light work may compress the artifact under its stricter proportionality boundary.

Scenario design, current verification, repeatable regression protection, and independent challenge remain four separate claims. This avoids both happy-path closure and the opposite overcorrection of mandatory exhaustive matrices, test layers, tools, or organizational roles.

## External user context

Installed plugin files are replaceable. Personal context, project adapters, durable activity records, and evidence therefore remain in user-controlled storage. The plugin may describe and inspect such stores, but structural, locator, visibility, and lifecycle changes require an exact plan and fresh authority.

Inside a valid routine-update delegation, material capture is a logical transaction. A non-transactional file profile records the event anchor first, updates responsibility surfaces, updates the canonical index last, and verifies agreement. Stable event identity makes retry detectable. Partial application becomes `capture-incomplete` with exact completed and pending effects; it never masquerades as continuity.

## Advisory core, bundled procedural adapter

The public skill makes investigation and readiness observable but cannot block every mutation through Markdown. The Codex package bundles a dependency-free hook as a procedural interlock for explicitly covered lifecycle and local write events. It is distributed with the plugin yet remains inactive until the host exposes it for review and the user trusts its current hash.

The adapter stores only bounded procedural state in the host-provided plugin-data location. It can enforce declared order, explicit collaborator-response reconciliation, prompt-bound readiness, one-use command permits, one-covered-write result accounting, prompt invalidation, effect-specific grants, current verification after the latest mutation, recovery, and bounded closure for events it receives. It cannot authenticate a model's factual claims, infer product intent, prove sufficient investigation, replace native authority, or cover events the host does not send. Installation, skill discovery, hook discovery, trust, execution, and semantic correctness therefore remain distinct evidence states.

Ordinary hook output uses the full `Please, ...` capability name and one concise next action rather than diagnostic codes. English and Spanish selection is a bounded convenience, not universal language detection. Internal control commands and host-native lifecycle names remain technical implementation surfaces so friendly output does not obscure the actual enforcement boundary.

The portable skill continues in advisory mode when the hook is absent, disabled, untrusted, unsupported, failed, or bypassed. Trusted semantic readiness would still require an independent issuer and authenticated observable evidence rather than a model-authored control command.

## Isolate host adapters before sharing implementation

The bundled procedural adapter is a Codex contract, not a generic hook that happens to run under Codex first. Its manifest, default hook path, event mapping, state semantics, output decisions, tests, trust review, and coverage statement move together.

Another host may implement PMNM's portable host-adapter contract, but it owns separate manifest, hook configuration, event normalization, runtime entry, fixtures, native validation, installation, and clean-session evidence. Similar lifecycle names or JSON shapes do not authorize reuse of the Codex configuration. A host-specific implementation must not replace `hooks/hooks.json` or change Codex behavior as a side effect.

A shared executable kernel is a possible later refactor, not a current generic adapter. It may be extracted only when at least two concrete host contracts make the common boundary observable and both adapters retain independent conformance and behavioral tests. Until then, unsupported hosts use the portable skill in advisory mode and report missing enforcement literally.

## Effect-bound authority

Authority follows the material effect, not proximity to requested work. Source changes, instrumentation, verification artifacts, environment state, external systems, durable content, and durable structure remain separate semantic classes refined by current project vocabulary and instructions. This prevents verification or debugging convenience from silently expanding scope without imposing a provider, tool, or project stage model.

## One setup authority

The README is a short setup entry point and contains no detailed installation commands. `SETUP.md` owns installation, source testing, updates, rollback, removal, and verification so procedures do not drift across documents.

Setup is agent-directed and host-neutral at its decision boundary. It resolves operation, actual host, registration route, artifact source, and command runner before using tools. Codex has a tested direct adapter; another host must derive its route from current host evidence and stop rather than inherit guessed Codex or npm semantics.

## Documentation is an executable contract

Safety-critical documentation structure and boundaries have a dependency-free semantic validator plus adversarial mutations. Exact literals are reserved for commands and boundaries where drift changes behavior; broader prose remains free to improve while preserving its required meaning.

The README, setup, security, getting-started, contribution, and distribution documents have distinct owners. A public checkout must validate without private maintainer coordination.

## Source checks and behavioral evaluations remain separate

Static validators, ordered traces, package-byte comparison, host installation state, fresh-session discovery, activation, and behavioral compliance are distinct claims. Model-facing decision cases exclude their expected answers; deterministic grading remains local, while actual model execution stays external and records the host, model, revision, and raw outcome.

## Separate distribution layers

The GitHub repository is both source and the Codex marketplace users add. Its marketplace entry pins one immutable npm plugin version. npm is the canonical artifact channel, while a verified host adapter performs registration and enablement; `npm install` alone is not a host installation. An OpenAI Plugins Directory listing is optional future work rather than a dependency of the public route. Success in one layer is not evidence of publication, installation, activation, or loaded-revision identity in another.

## Tag-bound Trusted Publishing

The release workflow runs only for `v*` tags in the canonical repository, verifies that the tag equals the package version, executes the complete release gate, and uses npm Trusted Publishing with OIDC. Package, plugin, and marketplace versions move together. Long-lived npm tokens are outside the workflow contract.

## Narrow optional context runtime

The bundled context-store command remains inspect-and-plan only. Request and plan schema v2 bind operation purpose, source and target preconditions, modes, content identity, bounded content review, and a one-shot digest. Store mutation belongs to an authorized host that reconstructs the plan against unchanged state and obtains fresh approval. This avoids presenting an incomplete transaction engine as safe infrastructure.

The separate record-conformance command is also read only. It checks `pmnm.standard-file/v1` only when that exact profile was adopted. It does not turn the optional profile into a universal layout or claim semantic truth from valid fields.

## Tool continuations are evidence options

PMNM routes tools from a named material claim. A tool-provided continuation, page token, related operation, or suggested query exposes an available evidence operation but does not choose the workflow, grant authority, or establish that more evidence is necessary.

The agent preserves what the literal result can and cannot establish, the remaining gap, and why another operation can change a material decision. Compact results are preferred when they decide the claim. Exact locations or expanded detail are requested only when they can change scope, readiness, verification, or next action. This preserves the useful continuation graph without allowing it to become an automatic token-consuming pipeline.

Static and semantic evidence establishes structure and candidate relationships within scope. Observable reachability, product behavior, and complete blast radius require corroboration through the applicable evidence lane. This boundary is portable even when no semantic tool exists.

## Changed-artifact diagnostics are a completion gate

After implementation mutation, PMNM inventories changed artifacts using the current delivery-state mechanism rather than assuming Git. Every artifact supported by an executable current diagnostic capability receives current coverage before completion.

The result distinguishes clean coverage, unsupported artifacts, untrusted output, verified pre-existing residuals, and blocking introduced, modified, or unattributed errors. Project-native fallbacks may bound lost coverage but cannot silently become equivalent evidence. Diagnostics remain a conformance lane and do not replace behavior, runtime, interface, or policy verification.
