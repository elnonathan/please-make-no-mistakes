# Contributing

Please, Make No Mistakes keeps one portable Agent Skill as its semantic source of truth. The Codex package also bundles a small dependency-free lifecycle guard, progressively loaded references, non-operative examples, an optional read-only context-store inspector and planner, and an optional read-only checker for its explicitly adopted Standard file profile.

## Requirements

- Node.js 22 or 24 for the release envelope and bundled Codex guard.
- Python 3.9 through 3.13 for bundled validators. The optional context-store runtime additionally requires its documented POSIX filesystem primitives.
- npm with lifecycle scripts disabled for isolated artifact checks.
- Codex only when testing the current host-specific plugin route.

The core skill is host- and operating-system-neutral Markdown. Runtime and distribution portability are separate claims and must be established by their own checks.

## Before Changing Behavior

1. State the observable outcome and affected contract.
2. Inspect the relevant skill route, references, evaluations, validators, and public documentation owner.
3. Search for counterexamples, existing mechanisms, incompatible hosts, and unintended consumers.
4. Keep universal rules separate from project, tool, host, or person adapters.
5. Preserve the public/private and package/user-data boundaries.
6. Add positive and adversarial evidence capable of falsifying the changed contract.

Do not add a named capability merely to hold a new paragraph. Prefer the smallest existing responsibility or triggered protocol that preserves coherent routing.

## Source Of Truth

- `skills/please-make-no-mistakes/SKILL.md` owns runtime invariants and reference routing.
- `skills/please-make-no-mistakes/references/` owns detailed runtime procedures.
- `evals/trace.schema.json` owns the portable ordered-trace shape.
- `scripts/validate_trace.py` owns executable trace semantics.
- `evals/behavior-cases.md` owns readable behavior expectations.
- `evals/agent-evaluation-cases.json` owns model-facing blind evaluation inputs.
- `skills/please-make-no-mistakes/scripts/context_store.py` owns the inspect-and-plan schema and review output.
- `skills/please-make-no-mistakes/scripts/record_conformance.py` owns checks for `pmnm.standard-file/v1` only.
- `hooks/hooks.json` owns the Codex event surface and matcher boundary.
- `hooks/pmnm-guard.mjs` owns the bounded procedural state machine for covered events.
- `evals/host-guard-cases.json` and `scripts/test_host_guard.mjs` own deterministic guard expectations.
- `SETUP.md` owns every detailed setup, update, rollback, removal, and installation-verification procedure.
- `scripts/documentation_contract.py` owns machine-checked documentation structure.
- `package.json` owns the exact public npm allowlist and release script surface.

When two owners disagree, fix the disagreement instead of documenting both as valid alternatives.

## Host Adapter Isolation

The shipped hook is a Codex adapter. Treat `.codex-plugin/plugin.json`, `hooks/hooks.json`, `hooks/pmnm-guard.mjs`, `evals/host-guard-cases.json`, and `scripts/test_host_guard.mjs` as one protected compatibility surface.

Support for another host must add its own manifest, hook configuration, native event mapper, runtime entry, fixtures, validator, installation proof, and clean-session evidence. Do not point another host at the Codex hook merely because some lifecycle names or JSON fields resemble its own. Do not modify the Codex adapter as part of another host's implementation unless the proposal explicitly extracts a shared neutral engine and proves both adapters independently afterward.

Every host adapter must document native tool names and inputs, success and failure events, missing lifecycle signals, persistent-data semantics, trust and disablement behavior, update behavior, covered and uncovered mutation paths, and the strongest decision it can actually enforce. A host without a pre-mutation blocking channel remains advisory or partial.

## Focused Checks

Use the narrowest check while iterating:

```bash
npm run check:documentation
```

```bash
npm run test:documentation
```

```bash
npm run test:host-guard
```

```bash
npm run smoke:evaluation
```

```bash
npm run ci:portable
```

```bash
npm run validate:trace -- <trace.json>
```

Before proposing a release-ready change, run:

```bash
npm run release:verify
```

The release verifier runs every configured check and reports an aggregate result rather than stopping after the first failure. A passing source gate is not a clean-session behavior claim.

## Documentation Ownership

- `README.md` explains the product, points to setup, summarizes capabilities, and states boundaries.
- `SETUP.md` is the only detailed installation authority.
- `docs/getting-started.md` contains representative use and interpretation guidance.
- `CHANGELOG.md` records user-visible changes by release.
- `SECURITY.md` owns threat, privacy, supply-chain, and supported-claim boundaries.
- `ROADMAP.md` contains public direction, not private execution state.
- `docs/architecture-decisions.md` records durable public design boundaries.
- `docs/distribution.md` owns release identity, Trusted Publishing, and postpublication verification.

Do not duplicate setup commands outside `SETUP.md`. Do not publish local paths, private activity records, raw internal evaluations, credentials, customer data, internal identifiers, or maintainer handoffs.

## Evaluation Changes

Behavioral changes should include:

- a representative positive case;
- a negative or adversarial case;
- an explanation of the violated observable contract;
- an ordered-trace check when ordering is material;
- a clean-session evaluation plan when compliance depends on a real model or host.

Changes to the Codex guard must also include a positive transition, a denied or recovery transition, a privacy or bounds assertion when state changes, and the exact covered and uncovered host paths. Keep the runtime dependency-free, do not inspect conversation transcripts, do not persist raw prompts, commands, evidence, source, or tool output, and do not treat a procedural receipt as semantic truth or human authority. A hook-content change also changes the trust hash users review.

Blind evaluation inputs must not contain their expected decision. Deterministic graders may live in the repository, but the prompt supplied to the model must include only the case and allowed context. Model execution remains external to package validation.

## Pull Requests

Describe the contract changed, evidence collected, checks run, checks not run, compatibility impact, and residual risk. Include the aggregate release summary when applicable. A passing check is evidence only for the claim it was designed to falsify.

Do not combine a behavior change, distribution redesign, and unrelated documentation cleanup merely because they share a version. Keep review boundaries recoverable.
