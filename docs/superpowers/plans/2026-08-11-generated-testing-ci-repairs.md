# Generated Testing CI Repair Plan

> **Execution contract:** Use `superpowers:executing-plans`, `superpowers:test-driven-development`, `superpowers:systematic-debugging` for any unexpected failure, and `superpowers:verification-before-completion`. Execute in the ignored isolated worktree `.worktrees/generated-unit-component-testing-repair` on the existing merge-request branch `agent/generated-unit-component-testing`. Commit and push one increment at a time, inspect hosted CI, and stop for explicit review before the next increment.

**Goal:** Repair the two reproduced hosted-CI defects in the generated unit/component testing candidate and make expensive repository-quality lanes run only when their owned inputs change, without changing the generated application contract, capability subject, retained fixture bytes, deployment authority, or certification state.

**Comparison:** `origin/main..agent/generated-unit-component-testing`, with repair commits added to the existing merge request.

**Architecture:** Recipe `0.7.0` receives one builder-owned, checked lockfile artifact that is materialized byte-for-byte before the existing isolated frozen-install verification. Temporary-directory cleanup retains explicit boundary-local ownership and gains creation-time identity so device/inode reuse cannot authorize deletion of a replacement path. Ordinary builder/package checks remain on every pull request; generated-project and compatibility-proof checks move to read-only workflows scoped to their actual inputs.

**Current evidence basis (2026-08-11):** The hosted failure resolves `electron-to-chromium@1.5.404` after the repository maturity window, while the reviewed fixture lockfile contains `1.5.403`; recreating the lockfile with Node `22.23.2` and pnpm `11.20.0` reproduced the hosted fingerprint. The second failure recreates an owned temporary path on Ubuntu, where device/inode reuse lets the current two-field identity accept the replacement. Current official pnpm dependency-resolution and lockfile guidance, Node `fs.Stats` bigint timestamp guidance, and GitHub Actions path-filter guidance were revalidated during MR review. No provider or deployed runtime is changed.

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

## Increment 2: Make cleanup identity resistant to inode reuse

### Files

- Create `packages/builder-core/src/generation/path-identity.ts`.
- Create `packages/builder-core/tests/path-identity.test.mjs`.
- Create `scripts/lib/path-identity.mjs`.
- Create `tests/capability-certification/path-identity.test.mjs`.
- Modify `packages/builder-core/src/generation/write-generated-project.ts`.
- Modify `packages/builder-core/src/generation/verify-generated-project.ts`.
- Modify `scripts/lib/certify-fresh-scaffold.mjs`.
- Modify `scripts/verify-generated-skeletons.mjs`.
- Modify `tests/generated-fixtures/verification-script.test.mjs`.

### RED/GREEN

- Reproduce device/inode reuse with a different creation time and require cleanup refusal.
- Compare device, inode, and creation time using bigint filesystem statistics.
- Reject unsupported or zero creation-time identity and fail closed.
- Capture identity after permission changes so setup does not invalidate its own identity.
- Preserve controls for matching identities and non-matching device/inode values.

### Verification and commit

```sh
pnpm run test:builder-core
pnpm run test:capability-certification
node --test tests/generated-fixtures/verification-script.test.mjs
```

Commit: `fix: strengthen temporary cleanup identity`

Push the existing MR branch, inspect hosted checks, and stop for increment review.

## Increment 3: Scope deep CI to relevant changes

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

## Final review, evidence, and recovery

After all three increments are separately accepted:

1. Run the complete relevant builder-kernel verification once against the settled tree.
2. Dispatch read-only requirements, architecture/anti-overengineering, and test-evidence reviewers with the exact final comparison and no recursive fan-out.
3. Reproduce and repair only validated material findings through focused RED/GREEN cycles.
4. Record the final commands, results, hosted-CI boundary, changed files, reviewer dispositions, risks, deferred work, and rollback/recovery in dated implementation evidence and a review packet.
5. Present the verified final diff and stop for explicit approval. Do not merge, deploy, publish, dispatch certification workflows, mutate providers, or respond to review comments.

Source recovery is a newest-first revert of the focused repair commits followed by regeneration and `pnpm run verify:builder-kernel`. The checked lockfile is repository source; no persistent data, provider state, deployment, credential, or production recovery is introduced by these repairs.
