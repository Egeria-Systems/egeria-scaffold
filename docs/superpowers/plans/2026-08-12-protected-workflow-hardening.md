# Protected Workflow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for contract changes, `superpowers:requesting-code-review` for the mandatory review, and `superpowers:verification-before-completion` before any completion claim. Track every checkbox and stop at every stated gate.

**Goal:** Harden all four manual protected workflows with current verified action pins, disabled reusable caches, exact revision binding, disabled checkout credentials, and bounded timeouts without changing deployment, certification, provider, or publication behavior.

**Architecture:** Keep each workflow manual, single-job, exact-main, protected by its existing environment and non-cancelling concurrency. Change only setup/revision/timeout metadata and the direct static contracts that own it. Preserve step-scoped secrets, deployment leases, cleanup, receipts, npm OIDC provenance, and deploy/publish-only credential-bearing steps.

**Toolchain:** GitHub Actions YAML; Node.js `22.23.2`; pnpm `11.20.0`; Node test runner; `actions/checkout`; `pnpm/setup`; existing compatibility, Calendly, observability, and package-release contract tests.

## Approval and authority boundary

This plan follows the automatic CI plan because compatibility deployment consumes the proof verification path established there. Revalidate the actual integrated `main` before implementation. Plan A approval does not authorize Plan B, and Plan B approval does not authorize any workflow dispatch or external action.

**Direct predecessor:** the accepted Automatic CI Efficiency and Security implementation.

**Acceptance artifact:** `docs/review-packets/2026-08-12-automatic-ci-efficiency-security.md`. Before implementation, require that packet to record explicit verified-final-diff approval and an exact accepted revision, require that revision to be integrated into refreshed clean `main`, and prove it is an ancestor of `HEAD`. A missing, pending, unapproved, ambiguous, or non-ancestor predecessor is a hard stop.

Implementation authorization permits local workflow/test/documentation edits, focused commits, deterministic local static checks, one independent read-only review, and review-backed repairs. It does not authorize push, pull request, merge, workflow dispatch, deployment, certification, provider access, secret access, publication, GitHub settings changes, environment changes, permission changes, or production action.

## Exact file scope

Create during implementation:

```text
docs/implementation-evidence/2026-08-12-protected-workflow-hardening-preparation.md
docs/implementation-evidence/2026-08-12-protected-workflow-hardening-verification.md
docs/review-packets/2026-08-12-protected-workflow-hardening.md
```

Modify:

```text
.github/workflows/compatibility-proof.yml
.github/workflows/booking-calendly-certification.yml
.github/workflows/production-observability-certification.yml
.github/workflows/package-release.yml
tests/constitution/constitution.test.mjs
tests/package-boundaries/package-release.test.mjs
docs/compatibility/nextjs-cloudflare.md
```

Do not change deployment commands, Worker identity, concurrency groups, environments, secrets, receipt formats, provider steps, cleanup, package contents, release scripts, capability descriptors, certification status, or historical evidence.

## Task 1: Freeze the protected-workflow contract

- [ ] Verify clean branch, status, worktrees, exact `main`/`origin/main`, the named Plan A acceptance artifact, its explicit approval and exact accepted revision, that revision's integration/ancestry, and absence of overlapping protected-workflow edits.
- [ ] Read root instructions, compatibility-proof instructions/record, deployment policy, package-release tests/docs, certification evidence/templates, and all four current workflows.
- [ ] Record current pins, inputs, timeouts, caches, permissions, environments, concurrency, secret boundaries, receipts, cleanup, deploy/publish commands, and exact-main validation.
- [ ] Reconfirm verified commits: checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`, pnpm setup `84cb39b217b10273981911c288cd62326dc7c6d2`, and existing artifact upload `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.
- [ ] Run `pnpm run test:constitution` and `pnpm run test:package-boundaries` to establish the current GREEN baseline.
- [ ] Write preparation evidence with exact comparison, authority boundary, expected RED failures, security invariants, recovery, and claim limits.

## Task 2: RED — require the hardened metadata

**Files:** `tests/constitution/constitution.test.mjs`, `tests/package-boundaries/package-release.test.mjs`

- [ ] Require all four workflows to use the exact expected checkout and pnpm action repositories plus immutable full lowercase 40-hex SHAs through the shared `isPinnedGitHubActionReference` policy, `persist-credentials: false`, `fetch-depth: 0` where exact revision validation needs repository history, fixed Node/pnpm, frozen installation, and `cache: false`. Do not encode one release-specific SHA in live-workflow policy tests; Task 1 and the workflow implementation still bind the initially reviewed commits exactly.
- [ ] Require compatibility workflow dispatch input `expected_revision` as a required string with the same exact-main purpose used by the certification workflows.
- [ ] Require compatibility checkout at `${{ github.sha }}`, job timeout `45`, and a pre-install validation step that checks `refs/heads/main`, lowercase 40-hex input, `GITHUB_SHA` equality, and checked-out `HEAD` equality.
- [ ] Require package release timeout `30`, preserve its required `release_commit` input, and require exact release-commit validation before candidate checks.
- [ ] Preserve Calendly timeout `45`, observability timeout `60`, and their existing exact-revision equality checks without broadening their inputs or evidence flow.
- [ ] Preserve `contents: read`; preserve package release's sole additional `id-token: write`; reject any new token permission.
- [ ] Require deployment/release concurrency to remain non-cancelling and environments to remain `test-deploy` or `npm-release` exactly.
- [ ] Preserve secret-minimal deploy/provider blocks, artifact retention, cleanup, registry-absence, advisory, provenance, and no-build/no-test credential-bearing contracts.
- [ ] Run the two focused commands and confirm RED only for obsolete pins/cache flags, missing compatibility binding/timeout, and missing package timeout.
- [ ] Commit the focused RED contract as `test: require protected workflow hardening`.

## Task 3: GREEN — harden the four workflows surgically

- [ ] In compatibility deployment, add the required input, `timeout-minutes: 45`, exact checkout configuration, and a revision-validation step before install. Use `EXPECTED_REVISION` through `env`; do not interpolate it into shell source.
- [ ] In all four workflows, use the verified checkout/pnpm commits and `cache: false`; retain `install: false` and frozen install.
- [ ] Add `timeout-minutes: 30` to package release.
- [ ] Do not reorder credential boundaries or change commands beyond the exact setup/revision/timeout changes.
- [ ] Run `pnpm run test:constitution` and `pnpm run test:package-boundaries`; require GREEN.
- [ ] Run `git diff --check` and inspect the four workflow diffs for accidental authority, event, environment, secret, concurrency, receipt, cleanup, deployment, or publication changes.
- [ ] Commit the implementation as `ci: harden protected workflows`.

## Task 4: Reconcile current documentation

- [ ] Update the compatibility record's current workflow setup/revision/timeout/cache matrix without rewriting historical run evidence or claiming a new deployment.
- [ ] State explicitly that local static validation does not prove GitHub-hosted execution, deployment, provider behavior, certification, publication, cleanup execution, or production safety.
- [ ] Run `pnpm run check:semantic-naming`, `pnpm run test:constitution`, `pnpm run test:package-boundaries`, and `git diff --check`.
- [ ] Commit the documentation/evidence reconciliation as `docs: record protected workflow controls`.

## Task 5: Final static verification once

- [ ] Run the owning focused tests once on the settled tree: `pnpm run test:constitution` and `pnpm run test:package-boundaries`.
- [ ] Run `pnpm run check:semantic-naming`, `pnpm run check:capability-certification`, `pnpm run changeset:status`, and `git diff --check`.
- [ ] Do not run or dispatch any protected workflow. Do not supply revisions, URLs, secrets, provider credentials, environment approvals, registry credentials, or OIDC publication authority.
- [ ] Record exact commands, results, changed files, action commit verification, security invariants, and unexercised external boundaries in verification evidence.

## Task 6: Independent review, bounded repair, and stop gate

- [ ] Dispatch one bounded independent read-only reviewer over the exact Plan B base-to-candidate comparison. Require three separately labeled, non-overlapping reports: requirements; architecture and anti-overengineering; and test evidence. Across those reports cover exact revision binding, ref/shell injection, pins, permissions, cache removal, timeouts, non-cancellation, environments, secret scoping, no-build credential blocks, receipts, cleanup, OIDC/provenance, tests, documentation, claims, and recovery. Prohibit edits and recursive fan-out.
- [ ] Validate each finding against the current tree. Add a focused failing regression test before repairing any material defect and rerun only affected checks.
- [ ] Create the review packet with comparison, changed files, commits, commands/results, reviewer dispositions, remaining risks, unexercised external boundaries, and recovery.
- [ ] Verify status, untracked files, worktrees, history, and exact diff. Stop for verified-final-diff approval.

Do not push, open a pull request, dispatch a workflow, deploy, certify, publish, access providers/secrets, mutate GitHub settings, or perform production actions.

## Completion criteria

- All four manual workflows use current verified action commits, credential-free checkout, fixed/frozen setup, `cache: false`, and bounded timeouts.
- Compatibility deployment is bound to an explicitly approved exact lowercase 40-hex `main` revision before install or deployment.
- Existing deployment/release environments, non-cancelling concurrency, Worker identity, secret boundaries, receipts, cleanup, registry checks, OIDC provenance, and deploy/publish-only credential commands remain intact.
- Focused static tests pass and no external outcome is claimed or exercised.
- One independent reviewer has completed all three required review tracks with no unresolved material finding, and the exact diff awaits final approval.

## Recovery

Use one focused revert of the protected-workflow hardening comparison. Restore only prior action pins, cache flags, checkout/revision metadata, and timeouts together with their direct tests/docs. Never use recovery as authority to dispatch, deploy, publish, change an environment, rotate credentials, alter provider state, or rewrite historical receipts.
