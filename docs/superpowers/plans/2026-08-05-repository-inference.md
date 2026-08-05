# Read-Only Repository Inference Implementation Plan

> **Execution:** Follow this plan with `superpowers:executing-plans`, `superpowers:test-driven-development`, and `superpowers:verification-before-completion`. Use `superpowers:requesting-code-review` for the required frozen-comparison reviews.

**Goal:** Add bounded read-only repository access and deterministic capability/surface inference to private builder-core.

**Architecture:** A fixed-root reader returns content-free discriminated read results. Probe evaluation reuses Task 3 canonical JSON and RFC 6901 behavior. Aggregate inference reads only state, declared probes, and valid-state surfaces and emits structured evidence rather than Task 5 diagnostics.

**Toolchain:** TypeScript 6.0.3, Node 22.23.0 standard library, Zod 4.4.3, Node test runner, ESLint 10.8.0, pnpm 11.20.0.

**Approved design:** [2026-08-05-repository-inference-design.md](../specs/2026-08-05-repository-inference-design.md)

**Preparation evidence:** [2026-08-05-repository-inference-preparation.md](../../implementation-evidence/2026-08-05-repository-inference-preparation.md)

**Prerequisite:** Task 3 final verification and review packet are committed. Re-freeze the clean branch and use that Task 3 gate commit as the exact Task 4 base.

**Scope boundary:** No doctor, diff, user-facing diagnostic, report file, repository write, `.egeria` update, migration, planner, transformation, CLI behavior, dependency/lockfile change, provider action, or Task 5 surface.

## Task 1: Write the Task 4 contract tests

**Files:**

- Create: `packages/builder-core/tests/inference.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

The focused tests must cover:

- safe in-memory reads plus absolute, traversal, control-character, and missing paths;
- filesystem missing paths, root/ancestor/leaf symlinks, non-file leaves, invalid UTF-8, more than 1 MiB, and read errors;
- an unchanged temporary-directory snapshot after every filesystem scenario;
- file, JSON-value, and package probes, including RFC 6901 escapes, missing members, exact package version matches, mismatches, and invalid JSON;
- stable probe ordering without actual values or source content;
- `confirmed`, `probable`, `partial`, `contradictory`, and `ambiguous` precedence;
- omitted absent capability, state metadata mismatch, invalid/unreadable state, and installed capability without a descriptor;
- managed and merge-managed `confirmed`, `missing`, `drifted`, and `ambiguous` surfaces;
- application-owned and ejected surfaces without drift reads;
- lexical capability/surface ordering and absence of secret/content leakage;
- the exact new private source allowlist and direct-consumer Task 4 boundary wording.

- [ ] Build the unchanged Task 3 package and capture expected RED failures from missing inference exports/source entries:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/inference.test.mjs
rtk node --test tests/package-boundaries/private-packages.test.mjs
```

Do not implement until failures are attributable to Task 4 absence rather than loader, dependency, platform, or test-fixture errors.

## Task 2: Implement the fixed-root readers

**Files:**

- Create: `packages/builder-core/src/repository/repository-reader.ts`
- Modify: `packages/builder-core/src/index.ts`

- [ ] Export the approved read result/error types, reader port, filesystem factory, and in-memory factory.
- [ ] Validate every path before access. Resolve against one fixed non-symlink directory root.
- [ ] `lstat` every segment, open read-only, compare leaf identity, recheck ancestors, cap reads at 1 MiB plus one byte, decode fatal UTF-8, and close every handle.
- [ ] Map expected filesystem cases to stable results; do not leak OS paths or messages.
- [ ] Run reader-focused tests until GREEN.

## Task 3: Implement probe evaluation

**Files:**

- Create: `packages/builder-core/src/inference/evaluate-probe.ts`

- [ ] Sort probes by a stable declared-metadata key.
- [ ] Evaluate file, JSON-value, and package probes through `RepositoryReader` only.
- [ ] Use internal canonical JSON/pointer functions for exact JSON equality and pointer resolution.
- [ ] Return only kind, declared path, status, and safe code. Never return content or actual values.
- [ ] Run probe-focused tests until GREEN.

## Task 4: Implement aggregate inference

**Files:**

- Create: `packages/builder-core/src/inference/infer-repository.ts`
- Modify: `packages/builder-core/src/index.ts`

- [ ] Parse `.egeria/state.json` with the Task 3 codec and materialize exact state evidence.
- [ ] Classify catalog capabilities with the approved precedence, metadata comparison, omission rule, and unknown-descriptor behavior.
- [ ] Evaluate valid-state surfaces according to ownership mode. Recompute fingerprints only for managed and merge-managed surfaces.
- [ ] Sort capability and surface evidence deterministically.
- [ ] Run the complete Task 4 test file:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/inference.test.mjs
```

## Task 5: Update direct boundary owners

**Files:**

- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/package-ownership.md`
- Modify: `docs/architecture/enforcement-map.md`

- [ ] Describe Task 4 reader/inference behavior and content/access limits.
- [ ] Mark only implemented read-only inference gates actual. Keep diagnostics, generation, transformation, CLI, and later catalog work planned.
- [ ] Run the package-boundary test to complete GREEN:

```bash
rtk node --test tests/package-boundaries/private-packages.test.mjs
```

## Task 6: Verify and commit the immutable Task 4 candidate

- [ ] Run the focused and aggregate checks against the unchanged final source tree:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk git diff --check
```

- [ ] Inspect `git status`, the exact diff, changed-file list, no-write API, and no-Task-5 search.
- [ ] Commit the coherent Task 4 candidate:

```bash
rtk git add packages/builder-core/src packages/builder-core/tests/inference.test.mjs packages/builder-core/AGENTS.md packages/builder-core/README.md docs/architecture/package-ownership.md docs/architecture/enforcement-map.md tests/package-boundaries/private-packages.test.mjs
rtk git commit -m "Infer repository capabilities"
```

## Task 7: Independent review, repairs, and Task 4 packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-05-repository-inference-verification.md`
- Create: `docs/review-packets/2026-08-05-repository-inference.md`

- [ ] Freeze the Task 3 gate base and Task 4 candidate hashes.
- [ ] Dispatch independent read-only reviewers for requirements, architecture/anti-overengineering, test evidence, and filesystem/security. Give each the exact comparison, design, plan, preparation evidence, changed files, and RED/GREEN output. Prohibit edits, recursive delegation, external actions, and review-comment responses.
- [ ] Validate each finding against the current tree. Repair only evidence-backed material defects in focused commits and rerun affected verification. Do not repeat reviews on an unchanged candidate.
- [ ] Run final builder-core verification, package-boundary tests, constitution tests, and `git diff --check` after the last repair.
- [ ] Record exact comparison, changed files, commands/results, reviewer dispositions, evidence limits, risks, deferred Task 5+, and source/dependency/persistent-data/provider rollback domains.
- [ ] Commit the gate artifacts:

```bash
rtk git add docs/implementation-evidence/2026-08-05-repository-inference-verification.md docs/review-packets/2026-08-05-repository-inference.md
rtk git commit -m "Record repository inference verification"
```

Stop before Task 5. The advance authorization ends after this Task 4 implementation and review checkpoint.
