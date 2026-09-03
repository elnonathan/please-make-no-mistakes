# Please, Use the Right Context — Optional Context and Tool Adapters

The skill is complete without configuration layers. Load a layer only when its scope is verified and its values materially affect the current task.

Sections: [modes](#two-resolution-modes) · [policy and state](#separate-policy-from-work-state) · [scopes](#supported-scopes) · [storage](#storage-boundary) · [registry](#registry-entry) · [resolution](#resolution-algorithm) · [taxonomy](#project-taxonomy-adapter) · [consent](#creation-and-consent) · [tools](#tool-adapter-contract) · [tool evidence](#claim-driven-tool-evidence) · [examples](#bundled-examples)

## Router contract

This reference implements `context.resolve` in bootstrap and task modes. Verified applicable context and sufficient executable tools return `CONTINUE`. Discoverable availability or scope returns `INVESTIGATE`. A required unavailable capability with a safe model or tool handoff returns `ESCALATE`; without a responsible handoff or sufficient fallback it returns `BLOCKED`. Reading a skill or configuration never proves executability.

## Two resolution modes

Run **bootstrap mode** before bounded work orientation. It inspects only:

- current authoritative host and project instructions;
- configured registry, locator, or backend-native discovery surfaces;
- activity-identity conventions and storage constraints;
- declared required capabilities and any trusted host enforcement.

Its result records the authoritative discovery surfaces actually inspected, any verified matches, and the residual discovery limit. An adapter that cannot be discovered through an authoritative surface cannot silently impose an obligation. Bootstrap mode does not load every adapter, inspect task code, or begin technical investigation.

Run **task mode** after the activity transition when a named material claim identifies the context or capability needed. Load only applicable adapters and establish actual tool availability. A bootstrap result may point to candidates, but task mode still verifies scope, currency, precedence, and executability before relying on them.

## Separate policy from work state

- **Context or adapter**: relatively stable values such as project commands, tool mappings, environment safety rules, explicit communication preferences, or identifier conventions.
- **Durable work record**: current and historical state for a unit of work, including claims, evidence, decisions, checks, and residual risk.

Do not place changing task state in a stable adapter or treat an old work record as current policy.

## Supported scopes

A configuration layer may describe:

- project or codebase;
- environment;
- activity or recurring workflow;
- team or organization;
- person, limited to explicit relevant preferences and constraints;
- tool or language integration.

Do not create a person or project profile merely because the schema supports it.

## Storage boundary

MUST keep user-owned context outside the installed skill directory. The skill directory is replaceable package content.

Authorized storage may be:

- an external user-controlled store;
- a project-local private location;
- shared reviewed project documentation;
- another registered system chosen by the user.

Do not move or normalize an existing store without demonstrated need and fresh explicit user approval for the exact mutation plan.

## Registry entry

A registry is optional. When used, each entry should contain:

```text
id:
kind: project | environment | activity | team | organization | person | tool | other
location:
match conditions:
capabilities supplied:
precedence within those capabilities:
enabled: true | false
privacy: private | shared | publishable
owner or authority:
source and last verified state:
retention or deletion rule:
notes:
```

The registry stores pointers and activation metadata, not duplicated context.

## Resolution algorithm

1. Start with the public skill and identify the current resolution mode.
2. In bootstrap mode, inspect each authoritative discovery surface that is accessible without material task investigation; absence of a registry is valid and must not fail activation.
3. Match entries only against verified current facts such as canonical project root, stable activity ID, environment, or an explicitly established user.
4. In task mode, load only capabilities that can resolve a named material claim or required effect boundary.
5. Verify applicability, currency, precedence, and tool executability before applying a value.
6. Apply values only within their declared scope. More specific verified scope may refine broader scope only for the same capability.
7. Report incomparable or same-precedence conflicts instead of merging silently.
8. Preserve the inspected discovery surfaces and residual limits. A search miss over only one surface is not global absence.
9. Inherit public behavior for every missing value.

A person preference can change presentation but cannot weaken project correctness, security, privacy, or verification rules. Historical context cannot override current authoritative instructions.

## Project taxonomy adapter

A project MAY supply canonical query semantics for its activity records. The adapter should declare only dimensions that improve real retrieval:

```text
Applies when:
Query dimensions:
Canonical values and definitions:
Aliases and normalization rules:
Typed relationship kinds:
Required and optional classifications:
Unknown or unclassified handling:
Catalog aggregation source and refresh rule:
Authority and last verified state:
```

The public skill does not supply default modules, components, technologies, vendors, roles, identifier prefixes, or lifecycle values. Preserve source wording for provenance, normalize only through a verified rule, and report ambiguous mappings instead of guessing. A taxonomy adapter improves consistency; its absence does not disable durable records.

## Creation and consent

MAY inspect existing layers and draft a proposed layer without mutation when that discovery is in scope. Create, register, or update a layer only after:

- the relevant values and authority have been supplied or verified;
- a plan identifies the canonical root and exact normalized operations;
- the plan has a digest; and
- the user gives a fresh explicit response approving that root, operation set, and digest.

An existing workflow, prior request, inferred preference, or permission to inspect does not substitute for this approval. Follow `context-store-operations.md` for planning, application, status, and rollback. A changed plan requires a new digest and approval.

MUST minimize stored information. Do not infer identity, biography, project membership, sensitive traits, credentials, or permissions to fill a schema. The owner must be able to inspect, correct, move, and delete the context.

## Tool adapter contract

A tool-specific rule MUST declare:

```text
Applies when:
Capability provided:
Requirement: required | preferred | optional
Preferred tool:
What it can establish:
What it cannot establish alone:
Availability evidence:
Tool actually used:
Fallback when unavailable:
Coverage lost with fallback:
Effect on change readiness:
Safety or mutation limits:
```

A project adapter may require a concrete capability or tool; the public core must not make that project choice universal. Resolve the adapter before the readiness decision and apply these rules:

- establish availability from the actual host tool catalog, a real invocation, or a literal host error;
- do not treat reading a tool's skill, another client's configuration, or recollection as proof that its executable capability is connected or absent;
- do not treat announcing a tool as evidence that it was used;
- preserve the exact failure or `unknown` state when availability cannot be established;
- declare the fallback, the material coverage it loses, and the effect on readiness;
- do not present text search, structural navigation, semantic identity, runtime execution, or another evidence lane as equivalent when their coverage differs;
- if a required capability is unavailable and the lost coverage affects a material conclusion, that conclusion cannot be `READY`;
- if a preferred capability is unavailable, use the safest sufficient fallback when one exists and keep unsupported conclusions bounded.

An adapter may select a compatible language-aware navigator for symbol identity and candidate relationships. Its output remains evidence with limits; a fallback may combine text search, definitions and callers, build configuration, focused checks, and direct inspection only with its lost coverage stated.

## Claim-driven tool evidence

Choose tools from the claim that needs evidence, not from a tool's suggested next calls. For every material tool route, preserve:

```text
Claim or gap:
Evidence lane:
Smallest applicable executable capability:
Literal result and trust status:
What it establishes:
What it does not establish:
Remaining material gap:
Continuation: stop | follow-up | fallback | escalate
Why that continuation can change the decision, or why the route stops:
Detail needed: summary | exact locations
Reason exact locations can change a material decision, when requested:
```

A `continueWith`, page token, related operation, suggested query, or other tool-provided next step is a menu of available evidence operations. It is never authority, a mandatory sequence, or proof that more evidence is needed. Follow it only when it can resolve the named remaining gap. Stop when the current evidence is sufficient for the bounded claim and another call cannot reasonably change scope, readiness, verification, or next action.

Prefer the least detailed result that can decide the claim. Counts and compact summaries may establish bounded coverage. Request exact locations, expanded pages, or another channel only when the added detail is material. Do not trade completeness of the material bridge for smaller output, and do not retrieve detail merely because it is available.

Keep evidence lanes literal. Static or semantic navigation can establish symbol identity, structure, candidate relationships, types, and configuration shape within reported scope. Treat those relationships as candidates until direct inspection, execution, or another applicable lane establishes reachability and the path to an observable consumer. No single lane establishes complete blast radius by default.

## Bundled examples

Files under `assets/` demonstrate structure only. They are not registered, active, authoritative, or evidence about the current environment. Copy and adapt them only after the real values are supplied or verified and the mutation is approved through the context-store operation protocol.
