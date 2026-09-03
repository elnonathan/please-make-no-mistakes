# Durable work record example

```text
Identifier and title: 2026-08-14-address-validation
Schema or layout-profile version: example-1
Status and as-of state: active at source state example-1234
Purpose: determine why saved addresses bypass normalization and implement the narrow supported fix
Scope: save path and its direct consumers
Non-goals: redesigning the address model
Source state: revision example-1234 with two unrelated local files excluded
Root-cause status: candidate
Solution status: not-selected

Material claim:
  Claim: normalization runs only on the draft path
  Basis: observed
  Verification status: partially supported
  Source: save handler and two known callers at revision example-1234
  Limitation: background imports have not yet been traced

Blocking uncertainty:
  Do background imports call the same persistence service?

Decision:
  No implementation until the import path is checked because the answer could change the shared contract.

Next action:
  Trace all persistence-service callers and record search scope and unresolved aliases.

Structured classifications and typed relationships:
  Project-defined values only; none established in this example.

Pointers:
  All applicable responsibilities are combined in this Compact record.

Recent material-event pulse:
  example-event-1 — investigation — candidate narrowed; caller coverage remains incomplete.
```

This is an example of a compact record, not a required template.
