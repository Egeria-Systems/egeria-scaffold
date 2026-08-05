# P1 pre-Task2 schema contract decision evidence

**Date:** 2026-08-05 (America/Toronto)

**Status:** preparation complete; exact-file plan awaiting approval; runtime implementation not started

**Approved program stage:** P1 builder kernel, between Task 1 and Task 2

## Decision

Address two Task 1 contract questions before downstream P1 consumers exist:

1. rename capability descriptor `schemaVersion` to `version`; and
2. retain `project.yaml.capabilitySettings` but require an empty map throughout P1.

Do not address the other six recorded questions in this increment. Migration `outcome` and verification `kind` remain explicit; threat-review vocabulary, surface target/merge structure, ejection identity, and runtime/static schema parity remain Task 9 review inputs.

## Why these two belong before Task 2

The capability descriptor currently stores `0.1.0` in `schemaVersion`, while the approved Task 2 catalog calls the value a capability version and installed state stores it as `InstalledCapability.version`. Task 2 would otherwise have to translate between semantically contradictory names. The descriptor contract's own format version is already expressed by its `urn:egeria-systems:schema:capability:1.0.0` metadata and generated artifact.

The project schema currently accepts arbitrary nested `capabilitySettings`, although P1 defines no settings. That permissiveness adds unsupported desired states before a typed owner exists and cannot prevent secret-like values despite ADR-0006's no-secrets boundary. Keeping the field as an explicit empty map preserves the accepted desired-state shape and allows a later schema version to add typed capability settings deliberately.

Both corrections are cheapest and safest before the Task 2 catalog, Task 3 codecs, Task 5 diagnostics, Task 6 renderer, and Task 8 golden fixtures become direct consumers or persisted examples.

## Why the other questions remain deferred

- `outcome: "succeeded"` makes a raw successful-only migration record self-describing and has no demonstrated current maintenance cost.
- verification `kind: "generation"` identifies the receipt operation and has no demonstrated current maintenance cost.
- `threatReviewLevel` needs an accepted security vocabulary; inventing levels is outside this increment.
- target/merge validation works at runtime today; the final P1 ownership and inference consumers are needed before choosing consolidation or a different representation.
- P1 emits no ejections, so changing their identity now would be speculative.
- preparation explicitly accepted runtime-only custom refinements where generated JSON Schema cannot represent them soundly. Task 9 must assess actual static-schema consumers and claim wording before changing that policy.

## Frozen repository evidence

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- frozen `HEAD`: `e18d23b6b5419e32bf01b66a8ca8b6aacfb2087a`;
- working tree before this evidence and plan update: clean;
- local relationship: `main...origin/main [ahead 16]`;
- remote refs were not fetched because the decision depends on approved local contracts and current official Zod behavior, not remote branch freshness.

Direct source evidence:

- `packages/builder-core/src/contracts/capability.ts` declares `schemaVersion: semanticVersionSchema`;
- the valid contract fixture assigns `schemaVersion: "0.1.0"`;
- the approved Task 2 matrix calls `0.1.0` the capability `Version`;
- `InstalledCapability` already names the same semantic value `version`;
- `packages/builder-core/src/contracts/project.ts` accepts arbitrary nested unknown settings; and
- every executable P1 capability is documented as having no setting mode.

## Current official documentation and advisory evidence

The current official [Zod JSON Schema documentation](https://zod.dev/json-schema) confirms that `z.toJSONSchema()` derives Draft 2020-12 output from runtime schemas and copies schema metadata into generated output. No custom JSON Schema override is needed for the two selected corrections: renaming a required property and making an object empty are directly representable.

A local read-only experiment with installed `zod@4.4.3` confirmed that `z.record(keySchema, z.never())` accepts `{}`, rejects populated maps, infers a no-values record boundary, and emits a Draft 2020-12 object whose additional properties are impossible. This experiment wrote no repository file.

The first `pnpm audit --audit-level=moderate` attempt failed because sandbox DNS could not reach the npm registry. The same command then ran with approved registry access and reported `No known vulnerabilities found` for the exact current lock graph. This is dated advisory evidence, not a future safety guarantee.

## Contradictions and blockers

The capability version name is a direct contradiction between the canonical descriptor example and the approved Task 2/installed-state terminology. It must be reconciled in the capability model, approved source plan, runtime schema, tests, and generated artifact together.

No blocking uncertainty remains for the empty settings decision because P1 exposes no capability setting. A later stage that introduces one must version and type it explicitly.

No source, test, generated schema, manifest, lockfile, state file, or runtime behavior changed during this preparation. The exact implementation is in `docs/superpowers/plans/2026-08-05-p1-pre-task2-schema-contract-clarifications.md` and remains approval-gated.
