# Non-operative durable-record configuration example

```text
project id: example-web-service
store: /example/user-data/project-records/example-web-service
privacy: private
activity identifier rule: use an external issue ID when present; otherwise use date and subject
creation gate: cross-session work, handoff, material correction, multiple evidence lanes, or high risk
routine update authority: only within an explicitly delegated store and durable-record workflow
archetype selection: smallest of Compact, Standard, or Extended that remains recoverable and queryable
project taxonomy: supplied by a separately verified project adapter when canonical classifications are needed
optional extension authority: only typed records, evidence entries, or manifests under explicitly approved boundaries, operations, naming, material volume or review thresholds, privacy, retention, and index-pointer rules
structural mutation gate: fresh user approval for the canonical root, normalized operations, and exact plan digest
required contract: canonical recovery index, understanding, material timeline, verification, retrieval metadata, evidence provenance, and continuity
retention: owner-managed
```

Example activity shape:

```text
2026-08-14-address-validation/
├── index.md
├── understanding.md
├── timeline.md
├── verification.md
├── records/       optional and created only when triggered
└── evidence/      optional and created only when triggered
```

A real user may choose one file, another directory shape, an issue tracker, a database, or a note system. The Activity Record Contract matters more than the filenames; do not create the optional locations empty.
