# Please, Keep It Legible — Activity Record Contract

A durable activity record is a logical recovery and retrieval surface. It may use one file, several files, an issue, a database record, or another authorized backend. The contract below defines responsibilities, not mandatory filenames or storage mechanics.

Use a layout profile only when the user delegates structure design. When a viable scheme already exists, map the contract onto its vocabulary and preserve useful names, identifiers, nesting, and medium.

Sections: [terms](#terms) · [contract](#activity-record-contract) · [archetypes](#record-archetypes) · [layout](#optional-file-backed-layout-profile) · [index](#canonical-recovery-index) · [responsibilities](#responsibility-surfaces) · [taxonomy](#project-taxonomy) · [extensions](#extension-records) · [evidence](#evidence-manifest) · [entries](#epistemic-entries) · [adoption](#adoption-rules) · [updates](#update-rules)

## Router contract

This reference implements `record.structure`. It returns the selected archetype, responsibility mapping, verified gaps, optional profile, and `resumeWith: activity.resolve` to the central router. It never creates structure or grants authority.

## Terms

- **Activity Record Contract:** information, authority, recovery, and retrieval responsibilities a useful durable record satisfies.
- **Record Archetype:** a Compact, Standard, or Extended composition of those responsibilities according to current scale and risk.
- **Layout Profile:** an optional physical mapping for one backend. A profile is not the contract.
- **Project Taxonomy:** project-owned query dimensions, canonical values, aliases, relationships, and normalization rules.
- **Extension Record:** typed detail materialized only when it has a responsibility, trigger, consumer, and index pointer.
- **Evidence Manifest:** metadata that relates an artifact to a claim or scenario without prescribing its media or file format.

The current logical contract identifier is `pmnm.activity-record/v1`. It versions the responsibilities in this document, not a mandatory directory layout. A record also preserves the strongest available skill-source binding: immutable package identity plus runtime-tree digest when available, otherwise a current content-tree digest or explicit host-provided source identity. Do not invent a revision or add unsupported skill frontmatter.

## Activity Record Contract

Every activity record MUST make these logical responsibilities recoverable in proportion to the work:

| Responsibility | Required outcome |
| --- | --- |
| Identity and authority | Resolve the stable activity, source, owner or authority, scope, privacy, and applicable delegation without guessing |
| Current recovery state | Expose the as-of status, current conclusion, blocking unknowns, residual risk, and next action or closure |
| Understanding | Preserve material requirements, constraints, claims, hypotheses, causal status, decisions, tradeoffs, corrections, and non-goals |
| Timeline | Preserve semantic material events when order, correction, attribution, or handoff matters |
| Verification | Preserve scenarios, conditions, results, evidence boundaries, invalidation, and what each result proves or does not prove |
| Retrieval | Expose structured classifications, typed relationships, aliases, and pointers sufficient for bounded project queries |
| Evidence provenance | Relate material artifacts to their source, source state, collection conditions, transformations, sensitivity, and claim |
| Continuity | Preserve freshness, unresolved work, handoff state, closure, reopening, and deferred work |

One physical record MAY implement several responsibilities. One responsibility MAY span several records. The canonical recovery index MUST declare non-obvious mappings.

Do not invent data to fill the contract. A missing value remains `unknown`, `not established`, or another explicit project equivalent.

## Record archetypes

Choose the smallest archetype that remains recoverable and queryable:

### Compact

One current-state record implements all applicable responsibilities. Use it when the activity remains easy to scan, evidence is limited, and separate consumers do not need independent detail.

### Standard

Use stable root surfaces for:

- current recovery and query index;
- understanding;
- timeline;
- verification.

The physical backend may combine them, but each responsibility must remain addressable without guessing.

### Extended

Use Standard plus typed extension records or evidence manifests when complexity, risk, artifact volume, independent consumers, or retrieval needs justify separation.

Use these deterministic selectors when a collaborator delegates a new design:

- Choose Compact only when one surface remains easy to scan, all applicable responsibilities are addressable, material evidence is limited, and no independent query or handoff consumer needs separate detail.
- Choose Standard when identified work crosses sessions, carries several material decisions or evidence channels, changes observable behavior, requires independently addressable verification, or would make one recovery surface ambiguous.
- Choose Extended only when a typed detail or evidence consumer is already demonstrated.

Promote an archetype only when the current one creates a concrete retrieval, provenance, verification, correction, or handoff problem. Consolidate or demote detail when separation no longer has a consumer. Never create empty placeholders merely because another activity used a larger archetype.

## Optional file-backed layout profile

For a newly delegated file-backed store that selects Standard, this is the default profile unless a verified project constraint requires another mapping:

```text
<activity-id>/
├── index.md
├── understanding.md
├── timeline.md
├── verification.md
├── records/       optional, typed extensions only
└── evidence/      optional, manifests or authorized artifacts only
```

A Compact profile may use only `index.md`. An Extended profile adds only the extension records and evidence that are actually triggered.

When the collaborator explicitly adopts this exact Standard file profile, identify it as `pmnm.standard-file/v1`. Its `index.md` uses one current value for each of these stable labels so a read-only checker can validate continuity without interpreting prose:

```text
Logical record contract: pmnm.activity-record/v1
Layout profile: pmnm.standard-file/v1
Activity ID:
Status:
As of:
Current conclusion:
Current basis revision:
Next action:
Last completed capture:
Capture state: complete | reconciled
```

`understanding.md` and `verification.md` may each declare `Current basis revision:` and, when present, it must agree with `index.md`. Every semantic event in `timeline.md` uses `Event identity:` and `Capture state:`. The latest complete or reconciled event identity agrees with `Last completed capture:`. These labels are a conformance surface for this one profile, not mandatory vocabulary for another authorized backend or mapped existing layout.

A project-level file-backed store may additionally provide a small activity catalog or search index, typed relationship index, taxonomy, and stable project context. It MUST derive activity summaries and relationships from canonical activity indexes rather than maintain duplicate current truth.

This profile is not authorization to create directories or files. Follow `context-store-operations.md`; preserve an existing viable layout by mapping responsibilities onto it.

After adopting the exact profile, the optional runtime can check its stable fields, responsibility files, current basis, latest capture, and relative pointers without writing:

```text
python3 scripts/record_conformance.py --activity-root /absolute/activity/root
```

Run it from the installed skill directory or use the absolute script path supplied by the host. A conformant result proves only the checks reported by that invocation; it does not establish the semantic truth of record content, privacy, or freshness outside the inspected state.

## Canonical recovery index

Every archetype needs one canonical recovery and query surface containing or pointing to:

```text
Schema or layout-profile version:
Logical record contract: pmnm.activity-record/v1
Skill revision or source identity:
Stable activity ID and title:
Status and as-of state:
Objective, source, and authority:
Current source or delivery state and activity consistency:
Scope and non-goals:
Current conclusion:
Current basis revision:
Blocking unknowns and residual risk:
Next action or closure:
Structured classifications:
Useful free-form tags:
Typed relationships:
Responsibility and evidence pointers:
Recent material-event pulse:
Last completed capture and any capture-incomplete event:
```

The recent pulse contains only enough terse events to recover what changed most recently. Detailed chronology belongs in the timeline. A pulse entry should identify an ordered event or time when available, its semantic role, a short result, and a pointer when detail exists.

Keep the index small enough for first-pass recovery and project-level aggregation. Do not turn it into a transcript or duplicate every responsibility record.

## Responsibility surfaces

### Understanding

Preserve requirements, constraints, reports, observations, hypotheses, questions, causal model, decisions, tradeoffs, corrections, and relevant rejected alternatives.

Represent causal and solution status explicitly:

```text
Root-cause status: unknown | candidate | verified-within-scope
Solution status: not-selected | proposed | implemented | verified-within-scope
```

Do not fill either status from task wording, proximity, or implementation success.

### Timeline

Record semantic events, not every file edit or tool call. Include an event when it changes current understanding, direction, execution state, verification, risk, continuity, or a later decision.

```text
Event identity or time:
Basis revision:
Role:
Terse change:
Basis and status:
Affected current state:
Detail or evidence pointer:
```

### Verification

```text
Requirement or claim:
Evidence lane:
Conditions and source state:
Action or procedure:
Expected result:
Observed result:
Status:
Coverage disposition: planned | excluded-with-reason
Execution result: not-run | passed | failed-product | failed-environment | blocked | partial | invalidated
Verification disposition: executed | collaborative | reproducible-handoff | blocked | not-applicable
Execution owner and strongest accessible check:
What it proves:
What it does not prove:
Residual gap:
Reproducible handoff or blocker, when applicable:
Cleanup or restored state:
Artifact pointer:
Capture event identity and state:
```

### Lineage

Lineage is optional. Separate source, code, record, or artifact evolution only when historical attribution, audit, migration, or recovery needs it. Do not create a lineage record for ordinary chronology.

## Project taxonomy

The public skill defines the taxonomy contract, not universal category values. A project adapter MAY define:

```text
Query dimensions:
Canonical values:
Aliases and normalization:
Typed relationship kinds:
Required and optional classifications:
Aggregation rules:
Unknown or unclassified handling:
```

Use stable activity identity and status for basic discovery. Add classifications only when they answer a real retrieval question. Free-form tags MAY supplement canonical dimensions but MUST NOT silently become equivalent canonical values.

Normalize aliases at query or index-update time while preserving the source wording when provenance matters. Report ambiguous mappings instead of guessing. Keep people, vendors, technologies, tracking conventions, hosting, source mechanisms, and organization-specific vocabulary scoped to the applicable adapter.

Typed relationships SHOULD distinguish their meaning when relevant, such as dependency, supersession, duplication, follow-up, shared cause, or evidence lineage. Do not flatten materially different relationships into an undifferentiated related-items list.

## Extension records

Materialize a separate extension only when all are known:

```text
Responsibility:
Trigger:
Expected consumer or query:
Type and state:
Canonical index pointer:
Authority and privacy boundary:
Retention or consolidation condition:
```

Register every extension by role and current state in the canonical index. Consolidate overlapping records. Do not create empty requirement, history, implementation, audit, evidence, or other files in anticipation of possible use.

An initial activity plan MAY request bounded authority for later typed extensions, evidence entries, or manifests under declared `records` or `evidence` boundaries. That delegation is valid only for the approved roles, operation types, naming policy, volume or review threshold when material, privacy scope, retention rule, and index-pointer update. It never authorizes another activity, arbitrary paths, root or schema changes, registry or locator changes, publication, movement, or deletion.

## Evidence manifest

Use the same logical manifest for any material artifact. Do not prescribe a media type or require copying the artifact into the record store.

```text
Artifact identity and content identity, when reliable:
Source and source state:
Collection conditions and method:
Size and storage pointer:
Transformations and redactions:
Related claim or scenario:
What it proves:
What it does not prove:
State: current | candidate | invalidated | historical
Sensitivity, audience, and retention:
```

Inventory metadata first for large or sensitive artifacts. Inspect content only when needed and authorized. Prefer a pointer or minimal redacted derivative over duplication. Do not call a transformed artifact original, and do not create an empty evidence location merely because the profile supports one.

## Epistemic entries

Use these shapes inside the applicable responsibility surface; they are not required separate files.

### Claim

```text
Claim:
Normative role, if any:
Basis: observed | reported | inferred | assumed
Verification status: unverified | partially-supported | verified-within-scope | refuted | unknown | invalidated
Source and source state:
Scope or environment:
What supports it:
What it does not establish:
Next check or invalidation condition:
```

### Decision

```text
Decision:
Authority:
Requirements addressed:
Evidence used:
Alternatives considered:
Tradeoffs and assumptions:
Invalidation condition:
Affected surfaces:
```

### Correction

```text
Prior claim or assumption:
Why it was unsupported or wrong:
Refuting evidence:
Corrected claim or remaining unknown:
Affected decisions, changes, checks, evidence, and records:
Reverification required:
```

### Lesson

```text
Original failure or friction:
Causal mechanism:
Why the prior process missed it:
Protective rule:
Counterexample or boundary:
Scope: activity | project | tool | person | portable-candidate
Supporting activities:
Cost or friction introduced:
Status: candidate | experimental | stable | superseded | retired
```

A lesson's origin does not prove portability. Promotion requires evidence that the causal mechanism recurs outside the original context.

## Adoption rules

1. Inspect the existing scheme and authoritative locator first.
2. Map `contract responsibility -> existing location -> verified gap`.
3. Preserve useful vocabulary, identifiers, nesting, backend, and history.
4. Select the smallest archetype that resolves demonstrated gaps.
5. Add only missing responsibilities, metadata, relationships, or pointers.
6. Keep any migration incremental and reversible; retain old-to-new retrieval links until cutover is verified.
7. Do not reconstruct missing intent or normalize names for aesthetics.
8. Apply structural effects only through the exact plan and approval protocol.

## Update rules

- Update the canonical index whenever status, conclusion, next action, classifications, relationships, or pointers materially change.
- Preserve prior states instead of silently overwriting a material correction.
- Mark stale, superseded, refuted, and invalidated entries.
- Make repeated updates idempotent where practical.
- Detect duplicate artifacts by reliable content identity, not filename alone.
- Give unknown or unclassified material an owner or review condition; it is not permanent storage by default.
- Derive project catalogs from activity indexes instead of maintaining duplicate current-state truth.
