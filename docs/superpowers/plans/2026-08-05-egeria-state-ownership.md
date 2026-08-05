# Egeria State Codecs and Hybrid Ownership Implementation Plan

> **Execution:** Follow this plan with `superpowers:executing-plans`, `superpowers:test-driven-development`, and `superpowers:verification-before-completion`. Use `superpowers:requesting-code-review` for the required frozen-comparison reviews.

**Goal:** Add strict deterministic `.egeria` codecs and pure hybrid-ownership fingerprint materialization inside private builder-core.

**Architecture:** Existing Zod contracts remain canonical. A narrow internal canonical JSON/RFC 6901 module is shared by state codecs, surface materialization, and the separately approved Task 4 inference implementation. All Task 3 operations are in-memory and content-safe.

**Toolchain:** TypeScript 6.0.3, Node 22.23.0 standard library, Zod 4.4.3, yaml 2.9.0, Node test runner, ESLint 10.8.0, pnpm 11.20.0.

**Approved design:** [2026-08-05-egeria-state-ownership-design.md](../specs/2026-08-05-egeria-state-ownership-design.md)

**Preparation evidence:** [2026-08-05-egeria-state-ownership-preparation.md](../../implementation-evidence/2026-08-05-egeria-state-ownership-preparation.md)

**Scope boundary:** No repository `.egeria` files, filesystem adapter, inference, diagnostics, generation, mutation, CLI behavior, dependency change, lockfile change, provider action, or Task 4+ runtime surface.

## Task 1: Freeze the planning gate

**Files:**

- Modify: `docs/implementation-evidence/2026-08-05-semantic-naming-plan-revalidation.md`
- Modify: `docs/implementation-evidence/2026-08-05-semantic-executable-naming-verification.md`
- Modify: `docs/review-packets/2026-08-05-semantic-executable-naming.md`
- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`
- Create: `docs/superpowers/specs/2026-08-05-egeria-state-ownership-design.md`
- Create: `docs/implementation-evidence/2026-08-05-egeria-state-ownership-preparation.md`
- Create: `docs/superpowers/plans/2026-08-05-egeria-state-ownership.md`
- Create: `docs/superpowers/specs/2026-08-05-repository-inference-design.md`
- Create: `docs/implementation-evidence/2026-08-05-repository-inference-preparation.md`
- Create: `docs/superpowers/plans/2026-08-05-repository-inference.md`

- [ ] Verify the current branch is clean apart from these named planning files and that the Task 2A approved comparison is exact.
- [ ] Run documentation links, package-boundary baseline, and `git diff --check`.
- [ ] Commit only the planning gate:

```bash
rtk git add docs/implementation-evidence/2026-08-05-semantic-naming-plan-revalidation.md docs/implementation-evidence/2026-08-05-semantic-executable-naming-verification.md docs/review-packets/2026-08-05-semantic-executable-naming.md docs/superpowers/plans/2026-08-05-p1-builder-kernel.md docs/superpowers/specs/2026-08-05-egeria-state-ownership-design.md docs/implementation-evidence/2026-08-05-egeria-state-ownership-preparation.md docs/superpowers/plans/2026-08-05-egeria-state-ownership.md docs/superpowers/specs/2026-08-05-repository-inference-design.md docs/implementation-evidence/2026-08-05-repository-inference-preparation.md docs/superpowers/plans/2026-08-05-repository-inference.md
rtk git commit -m "Plan Egeria state and inference"
```

After Task 2A's exact verified-final-diff comparison is explicitly approved, the user has pre-approved continuing after this commit; do not add another routine pause unless validation finds a material contradiction.

## Task 2: Write the Task 3 contract tests

**Files:**

- Create: `packages/builder-core/tests/state-ownership.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

The focused tests must cover:

- YAML 1.2 `No` remaining a string;
- duplicate keys, aliases, multiple documents, warnings/tags, unknown schema keys, and sanitized errors;
- deterministic project YAML, state JSON, and migration JSONL serialization with exact terminal newline rules;
- invalid JSON, schema-invalid JSON, one-based JSONL line paths, ignored blank lines, and empty logs;
- exact-byte and canonical-JSON SHA-256 values;
- RFC 6901 escape order, object ownership, array indices, and missing pointers;
- missing source, invalid JSON source, duplicate identifiers, self-reference, full-file overlap, pointer equality/ancestry, and permitted sibling pointers;
- installed surface order and descriptor/fingerprint projection;
- the exact new private source allowlist and direct-consumer Task 3 boundary wording.

- [ ] Build the unchanged package, then run the new tests and capture the expected missing-export/source-list RED failures:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/state-ownership.test.mjs
rtk node --test tests/package-boundaries/private-packages.test.mjs
```

Do not implement until the RED failures are attributable to the missing Task 3 behavior, not a loader, dependency, or environment error.

## Task 3: Implement the minimum codecs and shared canonical JSON

**Files:**

- Create: `packages/builder-core/src/serialization/canonical-json.ts`
- Create: `packages/builder-core/src/state/codecs.ts`
- Modify: `packages/builder-core/src/index.ts`

- [ ] Implement `JsonValue`, canonicalization/stringification, JSON equality, and RFC 6901 resolution as internal functions. Do not export the internal module from the package root.
- [ ] Implement project YAML, state JSON, and migration JSONL parsers with stable sanitized `ValidationResult` failures.
- [ ] Implement deterministic serializers with runtime input validation and stable `TypeError` codes.
- [ ] Export only the approved codec functions from the root.
- [ ] Run the codec subset of `state-ownership.test.mjs` during the GREEN cycle.

## Task 4: Implement fingerprint and surface materialization

**Files:**

- Create: `packages/builder-core/src/ownership/fingerprint.ts`
- Create: `packages/builder-core/src/ownership/materialize-surfaces.ts`
- Modify: `packages/builder-core/src/index.ts`

- [ ] Hash exact file bytes and compact canonical JSON UTF-8 bytes with lowercase SHA-256.
- [ ] Reject duplicate, self-referential, full-file-overlap, and equal/ancestor pointer targets before source resolution while allowing sibling pointers.
- [ ] Materialize descriptors in caller order and return only safe issue context.
- [ ] Run the complete Task 3 test file:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/state-ownership.test.mjs
```

## Task 5: Update direct boundary owners

**Files:**

- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/package-ownership.md`
- Modify: `docs/architecture/enforcement-map.md`

- [ ] Describe Task 3 as codec/materialization behavior only, reserve Task 4 inference, and retain every later-stage prohibition.
- [ ] Mark only the actually implemented hybrid-ownership fingerprint/materialization gate as actual. Do not claim filesystem or inference enforcement.
- [ ] Run the package-boundary test to complete GREEN:

```bash
rtk node --test tests/package-boundaries/private-packages.test.mjs
```

## Task 6: Verify and commit the immutable Task 3 candidate

- [ ] Run the focused and aggregate checks against the unchanged final source tree:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk git diff --check
```

- [ ] Inspect `git status`, the exact diff, changed-file list, and no-Task-4 search.
- [ ] Commit the coherent Task 3 candidate:

```bash
rtk git add packages/builder-core/src packages/builder-core/tests/state-ownership.test.mjs packages/builder-core/AGENTS.md packages/builder-core/README.md docs/architecture/package-ownership.md docs/architecture/enforcement-map.md tests/package-boundaries/private-packages.test.mjs
rtk git commit -m "Add Egeria state ownership"
```

## Task 7: Independent review, repairs, and Task 3 packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-05-egeria-state-ownership-verification.md`
- Create: `docs/review-packets/2026-08-05-egeria-state-ownership.md`

- [ ] Freeze the planning-gate base and candidate commit hashes.
- [ ] Dispatch independent read-only reviewers for requirements, architecture/anti-overengineering, test evidence, and input-format/security. Give each the exact comparison, design, plan, preparation evidence, changed files, and RED/GREEN output. Prohibit edits, recursive delegation, external actions, and review-comment responses.
- [ ] Validate every finding against the current tree. Repair only evidence-backed material defects in focused commits and rerun affected checks. Do not repeat reviews on an unchanged candidate.
- [ ] Run final builder-core verification, package-boundary tests, constitution tests, and `git diff --check` after the last repair.
- [ ] Record exact comparison, changed files, commands/results, reviewer dispositions, evidence limits, risks, deferred Task 4+, and source/dependency/persistent-data/provider rollback domains.
- [ ] Commit the gate artifacts:

```bash
rtk git add docs/implementation-evidence/2026-08-05-egeria-state-ownership-verification.md docs/review-packets/2026-08-05-egeria-state-ownership.md
rtk git commit -m "Record state ownership verification"
```

The user's advance authorization permits beginning Task 4 after this verified checkpoint. It does not authorize Task 5 or external action.
