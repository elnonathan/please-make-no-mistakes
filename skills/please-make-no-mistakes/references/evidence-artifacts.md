# Evidence artifacts

Load this reference when a screenshot, recording, trace, archive, document, dataset, log or other external artifact may support a material claim, and its location or custody may change.

## Start with a reference

Reference is the default custody choice. Do not copy an artifact merely because it is useful. Keep it where its owner already controls access, retention and deletion when a durable locator is enough for the task.

Create `artifacts.md` in the task folder only when artifact custody, identity, privacy or evidentiary limits matter. Link it from `index.md`. Create an `artifacts/` directory only for exact copies deliberately retained with the task.

Before copying or moving anything, show the human the exact source, destination, custody action, purpose, privacy result, identity method, recovery and retention. A copy needs current authority when its destination is outside ordinary contained PMNM maintenance or when policy requires it. A move changes the source and always needs explicit current authority, even when the destination is inside PMNM.

## Record what the artifact can support

Keep one entry per artifact or independently identified set:

```text
Artifact id:
Claim or decision it supports:
Source locator and owner:
Custody: referenced | copied | moved
Current locator:
Media type and size:
Identity method and result:
Privacy inspection, result and limits:
Observed or acquired at:
Authority for the custody action:
Retention and recovery:
Related or duplicate candidates:
What it demonstrates:
What it does not demonstrate:
```

A locator does not prove the referenced bytes still exist or are unchanged. State freshness, access and retention limits when they affect later reconstruction.

## Identity and duplicate candidates

Byte identity requires a complete content digest over the same bytes. Record the algorithm and value when exact identity matters. Matching names, sizes, timestamps, excerpts or metadata are not substitutes.

Visual or semantic similarity is a candidate relationship, never proof of identity. Preserve candidate relationships until a full-content comparison or another adequate discriminator resolves them. Do not discard either artifact merely because two previews look alike.

## Privacy boundary

Never place a credential or secret value in the PMNM folder. Keep only a reference to its approved location when the task needs to know that it exists.

Inspect text and machine-readable content for secrets and unnecessary personal or third-party data before intake. Pixels, audio, video and opaque binary content require a human privacy decision because an agent or automated scan cannot establish that they contain no sensitive material. Record what was inspected and what remained opaque.

Redaction creates a new artifact. Give it its own identity and retain the relationship to the source without implying byte equality.

## Custody lifecycle

- A reference leaves custody unchanged. Record how another session can resolve it.
- A copy creates another retained object. Verify the destination and content identity, then record both locations and which one is authoritative.
- A move changes both source and destination. Define recovery before acting and verify both sides afterward.
- A broken reference is an evidence limit. Repair it only with current authority and a recoverable source.
- Never delete evidence merely because PMNM no longer needs it. Deletion follows the owner's retention policy and separate authority.

Report failed, partial or interrupted custody actions literally. Do not claim an artifact was preserved until its intended locator, identity and access have been checked.
