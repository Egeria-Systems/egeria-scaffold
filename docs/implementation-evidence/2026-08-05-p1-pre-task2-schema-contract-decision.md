# P1 pre-Task2 schema contract decision evidence

**Date:** 2026-08-05 (America/Toronto)

**Status:** Task 1A implemented, verified, and independently reviewed; final-diff approval pending

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

## Task 1A implementation evidence

The user approved the exact-file Task 1A plan on 2026-08-05. The implementation comparison starts at clean local `main` commit `468558d4248665d1d99ac2e971dfc8771e488715`, which adds the approved plan without changing the frozen Task 1 contracts.

The RED cycle rebuilt builder-core successfully, then ran the focused runtime and constitution tests against the unchanged implementation. Result: 21 of 24 tests passed and exactly three failed:

- the valid descriptor's new `version` field was rejected while missing `schemaVersion` was reported;
- the populated `capabilitySettings: { standards: {} }` negative control was still accepted; and
- the canonical capability descriptor example did not contain `version: string`.

The minimum implementation then:

- renamed only `CapabilityDescriptor.schemaVersion` to `CapabilityDescriptor.version`;
- kept profile, project, installed-state, and migration schema-format fields unchanged;
- retained required top-level `capabilitySettings` and constrained it to an empty record with `z.record(stableIdentifierSchema, z.never()).readonly()`;
- regenerated only the capability and project JSON Schema artifacts; and
- reconciled the capability model, approved source plan, and P1 plan terminology.

The first artifact-generation invocation stopped before generation because pnpm required a non-interactive module-directory refresh and `CI` was not set. Rerunning the same command with `CI=true`, as required by the error and repository instructions for dependency refresh, succeeded. No dependency manifest or lockfile changed.

Initial GREEN results on the implementation tree:

- builder-core build: passed;
- checked-schema generation and currency check: passed;
- focused runtime and constitution tests: 24 of 24 passed;
- builder-core typecheck: passed;
- builder-core zero-warning lint: passed;
- package-boundary tests: 21 of 21 passed; and
- `git diff --check`: passed.

These checks establish the two selected runtime/static contract changes, artifact currency, documentation terminology, type safety, linting, and unchanged package boundaries. They do not establish Task 2 catalog behavior, persisted-state migration compatibility, deployed behavior, accessibility conformance, or the correctness of the six questions deferred to Task 9.

## Independent review dispositions

- Requirements: no material findings. The reviewer confirmed that the 11 changed paths implement exactly the two approved behaviors while preserving the other schema-format fields, non-goals, and six deferred questions.
- Architecture and anti-overengineering: no material findings. The reviewer confirmed private Zod ownership, generated artifact ownership, one capability release-version concept, no compatibility alias or settings framework, and unchanged stage boundaries.
- Test evidence: one material gap was validated. The obsolete-only descriptor fixture could be rejected because required `version` was missing, so it did not independently prove that an otherwise-valid descriptor rejects `schemaVersion`. A second negative control now supplies valid `version` and the obsolete key together. The focused suite remained 24 of 24 passing, and bounded follow-up closed the finding with no remaining material test-evidence findings.

## Task 1A review packet

**Comparison:** committed base `468558d4248665d1d99ac2e971dfc8771e488715` to the settled Task 1A working tree on local `main`. Remote refs were not refreshed because the approved work depends on the frozen local contracts and current official evidence, not remote branch freshness.

**Changed files:**

- `packages/builder-core/src/contracts/capability.ts`;
- `packages/builder-core/src/contracts/project.ts`;
- `packages/builder-core/tests/contracts.test.mjs`;
- `packages/builder-core/schemas/capability.schema.json`;
- `packages/builder-core/schemas/project.schema.json`;
- `tests/constitution/constitution.test.mjs`;
- `docs/architecture/capability-model.md`;
- `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`;
- `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`;
- `docs/implementation-evidence/2026-08-05-p1-schema-contract-review-deferral.md`; and
- this decision and review evidence.

**Commands and results:**

- builder-core build under `CI=true`: passed;
- focused runtime and constitution RED run: 21 of 24 passed, with exactly the three intended failures;
- schema generation: the first invocation stopped before generation because `CI` was absent; the same invocation under `CI=true` passed;
- schema currency check: passed;
- focused runtime and constitution GREEN run: 24 of 24 passed initially and again after the review repair;
- builder-core typecheck and zero-warning lint: passed;
- package-boundary suite: 21 of 21 passed; and
- diff whitespace validation: passed initially and after the review repair.

**Risks and claim limits:** No persisted `.egeria` document or downstream catalog exists yet, so no compatibility bridge is required or demonstrated. The generated empty-object representation uses an impossible additional-property schema derived from canonical Zod. These checks do not establish Task 2 behavior, deployed behavior, accessibility conformance, or resolution of the six deferred schema questions.

**Deferred work:** Task 9 revalidates all eight original field-purpose and simplification questions against actual P1 consumers. Migration `outcome`, verification `kind`, threat-review vocabulary, surface target/merge structure, ejection identity, and runtime/static parity are unchanged in Task 1A. Any future capability setting requires a separately approved, versioned, typed contract.

**Rollback and recovery:** Before commit, restore only these 11 files to the comparison base. After commit, revert the focused Task 1A commit and regenerate checked artifacts from the runtime Zod owners; do not reset shared `main` or hand-edit generated JSON. No dependency, generated client, provider, deployment, persistent-data, or migration-history rollback exists for this increment.
