# Dependency Update CI Cost Implementation Plan

**Goal:** Reduce Dependabot action-update churn and skip unnecessary deep CI jobs for unrelated manual-workflow changes without weakening immutable pins, stable checks, or fail-safe scope handling.

**Approved scope:** Bounded local implementation of the approved dependency-update CI cost design. The user's implementation request is the Gate 2 approval for this exact plan. Stop before staging, commit, push, pull-request creation, workflow dispatch, merge, settings, deployment, publication, certification, provider access, or external messaging.

**Direct predecessor:** Accepted automatic CI efficiency and security implementation at `368b9491fd2f813f83f1e456823d8c7546f6762c`.

**Acceptance artifact:** `docs/review-packets/2026-08-12-automatic-ci-efficiency-security.md`; the accepted revision is an ancestor of entry `HEAD@7401d05b987e36e6d9fa547e78fcf9862fb51b80`.

## Exact file scope

Modify:

- `.github/dependabot.yml`
- `.github/workflows/repository-quality.yml`
- `tests/constitution/constitution.test.mjs`
- `docs/architecture/overview.md`
- `docs/architecture/enforcement-map.md`

Create:

- `docs/superpowers/specs/2026-08-13-dependency-update-ci-cost-design.md`
- `docs/superpowers/plans/2026-08-13-dependency-update-ci-cost.md`
- `docs/implementation-evidence/2026-08-13-dependency-update-ci-cost-preparation.md`
- `docs/review-packets/2026-08-13-dependency-update-ci-cost.md`

No other file is in scope. If another file is required, stop and amend the plan before editing it.

## Task 1: Group GitHub Actions version updates

1. Add a focused constitution test that parses `.github/dependabot.yml` and requires one weekly `github-actions` entry with an `action-updates` group, explicit `applies-to: version-updates`, and `patterns: ["*"]`.
2. Run only that test with Node `22.23.2`; confirm RED because the group is absent.
3. Add the minimum group configuration under the existing GitHub Actions ecosystem. Leave npm scheduling and every action reference unchanged.
4. Rerun the focused test and confirm GREEN.

## Task 2: Narrow manual-workflow deep scope

1. Change the expected generated and compatibility path inventories in the constitution contract from `.github/workflows/**` to `.github/workflows/repository-quality.yml`.
2. Extend the actual-shell test with separate synthetic commits for a manual package-release workflow and the repository-quality workflow. Require the manual-only diff to disable both deep lanes and the repository-quality diff to enable both.
3. Run only the two repository-quality scope tests; confirm RED from the broad current pathspec and the missing narrow behavior.
4. Replace `.github/workflows/**` with `.github/workflows/repository-quality.yml` in both workflow path arrays. Do not change revision validation, error fallbacks, job conditions, commands, identities, or permissions.
5. Rerun the focused tests and confirm GREEN.

## Task 3: Reconcile canonical current-state documentation

1. Amend the architecture overview to state that the repository-quality workflow is the only workflow path that activates both deep lanes; unrelated manual workflow changes remain covered by the always-on builder/package policy checks.
2. Amend the generated-testing enforcement-map row with the same bounded gate ownership.
3. Do not rewrite the accepted historical CI design. The new dated design owns the superseding decision.

## Task 4: Verify and review

1. Run the complete constitution suite with Node `22.23.2`.
2. Run `pnpm run check:semantic-naming` and the full relevant `pnpm run verify:builder-packages:quality` once with pnpm `11.20.0` on the settled tree.
3. Run `git diff --check`, inspect status, changed files, and the exact diff, and confirm no generated, package, runtime, deployment, or unrelated surface changed.
4. Dispatch three non-overlapping read-only reviewers: requirements; architecture and anti-overengineering; test evidence. Prohibit edits, recursive delegation, GitHub comments, and external actions.
5. Validate every finding against the current tree. Repair only material evidence-backed defects and rerun affected checks.
6. Create `docs/review-packets/2026-08-13-dependency-update-ci-cost.md` with comparison, changed files, RED/GREEN evidence, final verification, reviewer dispositions, limitations, deferred work, and recovery.
7. Rerun only checks affected by the review packet or repairs, inspect the final diff, and stop for verified-final-diff approval.

## Commit boundary

If separately authorized later, the implementation, causal contracts, canonical documentation, and review evidence form one focused commit. This plan does not authorize staging or committing.

## Recovery

Before commit, restore the exact pre-change bytes only through an approved focused patch. After any separately authorized commit, use a focused revert. Remove the Dependabot group to restore per-action PRs; restore `.github/workflows/**` in both arrays to restore the prior scope; revert the matching tests and documentation. No external recovery applies to the authorized local scope.
