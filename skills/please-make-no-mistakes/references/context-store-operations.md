# Please, Ask Before You Rearrange — Context Store Operations

Use this protocol to inspect, design, scaffold, register, adjust, modify, adapt, move, migrate, or roll back a user-controlled context store. The store may use files, issues, a database, or another authorized backend. Do not assume a particular directory layout.

Sections: [safety](#safety-boundary) · [CLI](#runtime-cli) · [inspect](#1-inspect-without-mutation) · [plan](#2-produce-a-reviewable-plan) · [approval](#3-obtain-explicit-approval) · [apply](#4-apply-and-verify) · [adoption](#5-record-adoption-only-when-justified) · [routine and extensions](#routine-content-and-bounded-extensions) · [store types](#existing-and-new-stores)

## Router contract

This reference implements `authority.request` for context structure and configuration.

- Read-only inspection or planning -> return `CONTINUE` or `INVESTIGATE`, never mutation authority.
- Complete immutable plan awaiting a current response -> return `NEEDS-AUTHORITY`.
- Approved plan with unchanged root, operations, preconditions, and digest -> return to the router with the prior `resumeWith`.
- Drift or ambiguous ownership -> return `BLOCKED` or `INVESTIGATE` according to whether current evidence can resolve it.

The capability does not call `activity.resolve` or `record.capture` directly. Its continuation identifies which one the router should resume.

## Safety boundary

- The installed skill directory is replaceable package content and MUST NOT hold user context.
- Inspection, validation, and the bundled planning CLI perform no write operation and do not change store content, structure, configuration, locators, or lifecycle. Reads may update access-time metadata according to filesystem policy. If another host persists planning material, that external write needs an authorized location, verified privacy boundary, and retention rule.
- Every structural, configuration, locator, or lifecycle mutation not already covered by a valid bounded extension delegation requires a fresh explicit response from the user after a concrete plan exists. The only reusable mutation authority is an active delegation that the approved initial activity plan explicitly bounded to typed extension or evidence operations, naming, location, volume or review thresholds when material, privacy, retention, and canonical-index maintenance.
- Approval MUST be bound to the canonical root, normalized operations, and exact plan digest.
- An earlier request, standing workflow, inferred preference, or approval for another digest does not authorize a structural or configuration mutation.
- Any change to the root, operations, preconditions, or digest invalidates approval.
- Rollback is a new mutation. Build it from the exact current state as a separately reviewed host plan, derive a fresh digest, and require fresh approval.

Never auto-adopt a store, infer missing intent, normalize names for aesthetics, or activate example values. A recommended layout profile is opt-in and applies only when the user delegates structure design.

## Runtime CLI

When the runtime is available, inspect its actual interface from the installed skill root with:

```text
python3 scripts/context_store.py --help
```

From the npm package root, the same runtime is under `skills/please-make-no-mistakes/scripts/context_store.py`.

The bundled runtime supplies two non-store-mutating operations:

| Operation | Mutation | Required outcome |
| --- | --- | --- |
| `inspect` | No write operations | Bounded metadata inventory, canonical root, filesystem-native ordering, truncation state, and coverage limits; it does not open file content or infer a capability map, though reads may update access-time metadata |
| `plan` | No write operations | Intent, canonical root, normalized create-only operation review, source identity, captured preconditions, direct content hashes, bounded content review, and deterministic plan digest; the canonical plan remains in process memory, though reads may update access-time metadata |

Do not invent flags. Use `--help` for the installed version. The optional CLI requires Python 3.9+ and POSIX `dir_fd` plus `O_NOFOLLOW` support so traversal can fail closed; the skill protocol itself does not. The v2 machine-plan vocabulary is deliberately narrow: an explicit absent-root creation effect, local filesystem `mkdir`, and create-only UTF-8 `write-file`. It does not apply plans, replace files, move, delete, migrate, ingest binary evidence, understand registry semantics, or operate on remote backends. Use authorized host mechanisms under the same plan-and-approval protocol for structural, configuration, locator, lifecycle, and otherwise unsupported mutations. Routine record updates remain governed by their bounded delegation below. If the CLI is unavailable, follow the protocol with accessible tools and state that CLI validation was not performed.

The request may contain complete new text. Prefer `plan --stdin` when the host can supply bounded JSON without creating an intermediate file. When a request file is used, keep it outside the store and installed skill as a single-link regular file, with current ownership, owner-only POSIX mode bits, and an explicit retention decision. Link-count and mode checks do not establish effective privacy on filesystems with richer ACL or sharing policy; verify that boundary separately when material. The runtime keeps the normalized plan in process memory and emits each operation's purpose, precondition, octal result mode, direct content hash, and either complete small text or a bounded prefix plus exact size and line count. It does not create, retain, or delete request or plan files. Deleting a caller-owned request is a separate lifecycle mutation with its own reviewed scope and authority.

`content_file` is only an input source. It requires caller authority to read an absolute non-symlink regular UTF-8 file; the runtime binds its identity and content hash into the plan. It does not require owner-private mode merely because the source may legitimately be public or project-owned. A private source still needs a separately verified privacy boundary. Changing the source after planning invalidates the plan.

CLI output is bounded evidence, not authority. Directly verify material paths and postconditions before claiming success.

## 1. Inspect without mutation

Resolve the exact target from current evidence. Then:

1. Canonicalize the root without creating it or following an unverified redirection into another store.
2. Inventory the existing vocabulary, identifiers, indexes, records, evidence locations, privacy boundary, and authoritative locators.
3. Map `required capability -> existing location -> verified gap`.
4. Identify symlinks, publication or synchronization exposure, permission limits, inaccessible content, and ambiguous ownership when material.
5. Report uncertainty and stop before planning a mutation whose target or ownership remains ambiguous.

Inspection uses filesystem-native enumeration order. A truncated subset is neither stable across runs nor evidence that an omitted path is absent. An untruncated inventory is complete only within its declared root, depth, access, and object-type limits.

Do not classify unknown content by guessing. Preserve it as unclassified only when the user authorizes that capability.

## 2. Produce a reviewable plan

Prefer the existing scheme when it is safe, discoverable, and understandable. Add only missing capabilities or explicitly requested changes.

The plan MUST include:

```text
Intent:
Canonical root:
Current source-state identity:
Normalized ordered operations:
Per-operation target, operation, purpose, effect, direct content hash or N/A, byte count, octal result mode, and precondition:
Reviewable content or exact bounded content review:
Preconditions and expected no-ops:
Privacy or publication impact:
Delegated future extension operations, if any:
Rollback or containment:
Validation after apply:
Outcome postconditions and retrieval proof:
Plan digest:
```

Treat scaffolding, creating or editing a registry or locator, changing ignore rules, moving content, deleting content, and writing an adoption record as separate operations. Expand “adjust,” “modify,” and “adapt” into concrete targets and effects; do not hide them inside a broad label such as “organize the store.”

The digest MUST represent the canonical root, intent, ordered operations, targets, purposes, exact content, material preconditions, source state, and result modes. A plan is immutable once presented for approval. Show the reviewable operation details before requesting approval; a digest alone is not a review.

The plan MUST be complete enough to achieve the requested durable outcome. When the user has selected a store for an identified activity whose creation gate applies, plan the smallest recoverable transaction rather than only an empty container. Include the canonical activity recovery surface, any required locator or registry connection, routine update delegation, privacy boundary, and retrieval validation when applicable. A root-only plan is valid only when the user requested only a root and no activity or recovery outcome is currently in scope.

The bundled machine plan covers only its declared create-only vocabulary. If a host will replace, move, delete, migrate, semantically register, change visibility, or cause another structural, configuration, locator, or lifecycle effect not represented there, the host MUST produce a new complete plan and deterministic digest covering that effect. This requirement does not replace a still-valid bounded delegation for routine record content updates. Never treat the narrower CLI digest as authority for a broader host mutation.

## 3. Obtain explicit approval

After the plan exists, ask the user to approve the exact canonical root, reviewable operations, source-state identity, and digest. The approval must be a fresh explicit response to that plan.

The digest is a one-shot binding, not a persisted plan, authority credential, or proof that the displayed purpose is true. The applying host must still possess or reconstruct the complete canonical plan. If the plan bytes are unavailable, do not infer them from the digest; plan again and request fresh approval.

Do not treat any of these as approval:

- permission to inspect or plan;
- a request made before the digest existed;
- silence, inactivity, or an inferred preference;
- a project convention or automated workflow;
- approval for a different root, operation set, or digest.

If the user narrows or changes the plan, generate a new digest and request approval again.

### Combined authority checkpoint

When several already-known effects would otherwise create adjacent approval rounds, MAY present one compact checkpoint. Each request remains an independent authority item:

```text
Authority item:
Target and effect:
Scope and lifetime:
Issuer and revocation:
Plan or request identity:
Digest when structural:
Permitted continuation:
```

This is presentation composition, not permission composition. Approval of one item does not approve another. A tool adapter contributes only its own verified requirement, and the host may enforce separate native prompts. Do not make a named tool, authorization mechanism, filesystem, or host universal.

## 4. Apply and verify

Immediately before mutation:

1. Reconstruct the complete plan and recompute the canonical root, source state, preconditions, operations, exact contents, and digest.
2. Confirm that they exactly match the freshly approved plan.
3. Stop on lost plan state, drift, target ambiguity, symlink escape, permission mismatch, or a broader effect than approved.

Apply operations with authorized host tools in the declared order. Keep repeated execution idempotent where practical. Do not silently continue after a partial failure when later operations depend on the failed state.

Afterward, verify created or changed paths, content identity where material, active pointers, privacy boundary, outcome postconditions, retrieval, and rollback state. Report applied, no-op, failed, skipped, and rolled-back operations separately. Do not report an activity transition as `created` until its canonical recovery surface and required locator are retrievable.

## 5. Record adoption only when justified

An adoption or migration record is optional. Create it only when the durable-record gate applies and the plan explicitly includes it. Preserve the intent, approved digest, prior and final source state, operations, validation, rollback information, limitations, and residual risk. Do not create ceremony for a small scaffold.

## Routine content and bounded extensions

An explicitly delegated durable-record workflow may append or update record content without a new structural plan and digest for every write. Before doing so, verify that the delegation still identifies the store, activity, permitted record operations, and privacy scope.

The initial approved activity plan MAY also delegate later creation of typed records, evidence entries, or manifests without a new digest for each item. That delegation MUST identify:

```text
Canonical activity root and records or evidence boundary:
Allowed extension roles and operation types:
Naming and collision policy:
Volume, size, or review threshold when material:
Required canonical-index pointer update:
Privacy and audience:
Retention or consolidation rule:
Forbidden effects:
```

Before each extension, verify that it has a declared responsibility, trigger, consumer, current state, and index pointer and that every target and effect remains within the delegation. Repeated creation must be idempotent or fail closed on a collision.

Routine or extension authority does not permit another activity, arbitrary paths, root or schema changes, layout-profile changes, registry, locator, backend, visibility, publication, movement, deletion, ignore-rule changes, or retention-policy changes. Crossing one of those boundaries requires a new context-store plan and fresh digest-bound approval.

## Existing and new stores

- **Existing store:** preserve useful names, nesting, identifiers, history, and storage medium. Link old and new locations while retrieval still depends on both.
- **New store:** offer the smallest Activity Record Contract archetype that meets the request. Use a recommended layout profile only after the user opts into structure design.
- **Registry or locator:** store pointers and activation metadata, not duplicated context. Editing an authoritative instruction file is a separately declared mutation.
- **No persistent store requested:** do not create one merely because the skill supports it.
