# Generated Testing CI Repair Plan

> **Execution contract:** Use `superpowers:executing-plans`, `superpowers:test-driven-development`, `superpowers:systematic-debugging` for any unexpected failure, and `superpowers:verification-before-completion`. Execute in the ignored isolated worktree `.worktrees/generated-unit-component-testing-repair` on the existing merge-request branch `agent/generated-unit-component-testing`. Commit one locally verified increment at a time and stop for explicit review before the next increment. Push and hosted-CI inspection require a separate explicit request; the later authority granted for this run is recorded below.

**Goal:** Repair the reproduced generated-project hosted-CI defect and make expensive repository-quality lanes run only when their owned inputs change, without changing the generated application contract, capability subject, retained fixture bytes, deployment authority, or certification state.

**Comparison:** `origin/main..agent/generated-unit-component-testing`, with repair commits added to the existing merge request.

**Architecture:** Recipe `0.7.0` receives one builder-owned, checked lockfile artifact that is materialized byte-for-byte before the existing isolated frozen-install verification. Ordinary builder/package checks remain on every pull request; generated-project and compatibility-proof checks move to read-only workflows scoped to their actual inputs.

**Current evidence basis (2026-08-11):** The hosted generated-project failure resolves `electron-to-chromium@1.5.404` after the repository maturity window, while the reviewed fixture lockfile contains `1.5.403`; recreating the lockfile with Node `22.23.2` and pnpm `11.20.0` reproduced the hosted fingerprint. Current official pnpm dependency-resolution and lockfile guidance and GitHub Actions path-filter guidance were revalidated during MR review. No provider or deployed runtime is changed.

**Excluded concurrent scope:** The active observability-certification task owns observability certification, cleanup/recovery behavior and evidence, capability-registry transition, and any defect discovered by its certification checks. This repair plan must not modify those surfaces or treat their hosted status as an acceptance criterion.

**Current external-action authority:** The original plan separated local implementation from push and hosted-CI inspection. The user subsequently authorized pushing this repair branch, inspecting its hosted checks, and merging the merge request only after accurate applicable CI passes and repository review rules are satisfied.

## Increment 1: Materialize the checked recipe lockfile

### Files

- Create `packages/builder-core/lockfiles/web-recipe-0.7.0/pnpm-lock.yaml` from the reviewed retained-project lockfile bytes. The canonical lockfile basename is required so the semantic-naming gate treats generated integrity data as lockfile content rather than authored prose.
- Modify `packages/builder-core/src/generation/verify-generated-project.ts`.
- Modify `packages/builder-core/tests/generate-project.test.mjs`.
- Modify `packages/builder-core/AGENTS.md`.
- Modify `docs/superpowers/plans/2026-08-10-generated-unit-component-testing.md`.

### RED

- Require production lockfile preparation to write the reviewed recipe bytes exactly.
- Require lockfile preparation to invoke no package-manager or registry process.
- Preserve focused failures for pre-existing or non-regular lockfile targets and preserve content-safe verification failure mapping.

### GREEN

- Read the builder-owned `0.7.0` recipe lockfile from the private builder-core package boundary.
- Create `pnpm-lock.yaml` exclusively in the generated source and retain the existing before/after inventory guard.
- Keep the existing isolated `pnpm --version`, frozen install, lint, typecheck, unit/component, Next, and OpenNext verification unchanged.
- Do not alter templates, manifests, fixtures, fingerprints, schemas, capabilities, recipes, or state receipts.

### Verification and commit

```sh
pnpm run build:builder
pnpm run test:builder-core
pnpm run test:generated-fixtures
```

Commit: `fix: materialize recipe lockfile deterministically`

Push the existing MR branch, inspect hosted checks, and stop for increment review.

## Increment 2: Scope deep CI to relevant changes

### Files

- Create `.github/workflows/generated-project-quality.yml`.
- Create `.github/workflows/compatibility-proof-quality.yml`.
- Modify `.github/workflows/repository-quality.yml`.
- Modify `tests/constitution/constitution.test.mjs`.
- Modify the generated-testing design, implementation plan, enforcement map, and verification/review evidence that directly describe ordinary repository CI.

### RED/GREEN

- Keep builder/package governance, tests, lint, build, and typecheck on every pull request.
- Move generated-project and compatibility-proof commands without weakening them into separate read-only workflows with exact path filters for their owned inputs.
- Retain pinned actions, minimal permissions, bounded timeouts, no credentials, no deployment, no publication, and no provider mutation.
- Keep manual certification and deployment workflows unchanged.
- Record that current repository rules do not require skipped path-scoped checks; path filters must be revisited before any such status becomes required.

### Verification and commit

```sh
pnpm run test:constitution
pnpm run check:semantic-naming
git diff --check
```

Commit: `ci: scope deep verification to relevant changes`

Push the existing MR branch, inspect hosted checks, and stop for increment review.

## Increment 3: Repair review-confirmed data-integrity defects

### Files

- Modify `packages/builder-core/src/contracts/json-schemas.ts`.
- Regenerate `packages/builder-core/schemas/state.schema.json` through the canonical schema generator.
- Modify `packages/builder-core/src/generation/verify-generated-project.ts`.
- Modify `packages/builder-core/tests/contracts.test.mjs`.
- Modify `packages/builder-core/tests/generate-project.test.mjs`.
- Correct the three exact preparation, verification, and review-packet evidence inconsistencies identified during merge-request review.

### RED/GREEN

- Require every fixed JSON Schema tuple to emit `minItems` and `maxItems` equal to its `prefixItems` length.
- Add tuple cardinality in the canonical JSON Schema artifact transformation and regenerate the committed artifact; do not hand-edit it.
- Require a failed exclusive write or close never to unlink a path that could have been replaced concurrently.
- Report post-creation failure as a source mutation through the content-safe lockfile-preparation failure reason, then let the generation transaction clean only its identity-owned staging directory.
- Preserve the no-overwrite guarantee for every pre-existing or replacement target and keep all failure output path- and content-safe.

### Verification and commit

```sh
pnpm run build:builder
pnpm run test:builder-core
pnpm run check:semantic-naming
git diff --check
```

Commit: `fix: preserve generated contract integrity`

Push the existing MR branch and inspect hosted checks before final review.

## Main-reconciliation amendment: make the incoming identity test portable

**Approval:** The user preapproved plan amendments and directed this branch to merge current `main`, resolve the resulting fingerprint conflicts, repair accurate CI, push, and merge only after CI passes. This amendment was activated only after merging `main` commit `2a315aa0e7dce1bf1048b9a2c07e318add9241de` and observing the exact merged head on hosted CI.

### File

- Modify `tests/capability-certification/production-observability.test.mjs` only.

### RED and cause

- Hosted repository-quality run `31582711142` failed the incoming identity-replacement cleanup test because deleting and immediately recreating one pathname can reuse the original inode on Linux.
- The same test passed locally on macOS, confirming that its inode-change assumption was filesystem-dependent rather than evidence of a production behavior difference.

### GREEN

- Create the replacement directory while the original still exists, record its distinct identity, remove the original, and rename the replacement into the retained path.
- Assert the retained directory has the replacement identity. Keep the existing cleanup-failure expectation and change no production, provider, certification-state, or generated-project behavior.

### Verification and commit

```sh
node --test --test-name-pattern='observability production mutation refuses identity-replacement cleanup' tests/capability-certification/production-observability.test.mjs
pnpm run test:capability-certification
pnpm exec eslint tests/capability-certification/production-observability.test.mjs --max-warnings 0
git diff --check
```

Commit: `test: make cleanup identity check portable`

## Final review, evidence, and recovery

After the three increments are separately accepted:

1. Run the complete relevant builder-kernel verification once against the settled tree.
2. Dispatch read-only requirements, architecture/anti-overengineering, and test-evidence reviewers with the exact final comparison and no recursive fan-out.
3. Reproduce and repair only validated material findings through focused RED/GREEN cycles.
4. Record the final commands, results, hosted-CI boundary, changed files, reviewer dispositions, risks, deferred work, and rollback/recovery in dated implementation evidence and a review packet.
5. Present the verified final diff for the user-authorized merge-request integration. Merge only when the exact head has accurate applicable green CI and satisfies repository review rules. Do not deploy, publish, dispatch certification workflows, mutate providers, or respond to review comments.

Source recovery is a newest-first revert of the focused repair commits followed by regeneration and `pnpm run verify:builder-kernel`. The checked lockfile is repository source; no persistent data, provider state, deployment, credential, or production recovery is introduced by these repairs.
