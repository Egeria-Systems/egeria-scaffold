# Accepted Baseline Reconciliation

**Date:** 2026-08-09 (America/Toronto)

**Status:** Local integration complete; remote integration not requested

## Approval and scope

The user approved:

- the complete P1 final comparison `303ee9d35e19f9191948d994159f77c82c90a1ed..5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- the first bounded P2 content comparison `5580da10eded51ceefa53a068c7ddaaddf2a2d50..e0886fb776f5cd80c34a6ab5c28e355cc1abd7b9`;
- local integration of the approved work into `main`; and
- direct development on clean local `main` for the next sequential builder-repository increment.

The approved P2 branch was `portfolio-content-validation` at `e0886fb776f5cd80c34a6ab5c28e355cc1abd7b9`. Other registered worktree branches were not merged: accepted later history already contains or supersedes their relevant work, and they were not part of the approved integration comparison.

## Pre-integration state

- primary checkout: clean `main` at `5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- local `origin/main`: `5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- source branch: clean `portfolio-content-validation` at `e0886fb776f5cd80c34a6ab5c28e355cc1abd7b9`;
- ancestry: the old `main` commit was the merge base and direct ancestor of the source branch;
- remote refs were not fetched because the authorized operation was an exact local fast-forward from the already approved base, and no push or remote integration was requested.

## Verification and integration

The sandboxed aggregate reached the known restricted-registry boundary during fresh generated-project lockfile preparation and returned sanitized `LOCKFILE_PREPARATION_FAILED` with `source-changed`. It changed no repository file. The identical network-authorized command then passed on the exact source commit:

```text
CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:builder-kernel

passed:
- constitution: 21/21
- package boundaries: 39/39
- builder-core: build and 104/104 tests
- CLI: build and 9/9 tests
- generated fixtures: 7/7, with 27/29 byte-stable files
- builder lint, build, and typecheck
- portfolio and site fixed-root install, peer, audit, signature, lint, typecheck, Next, and OpenNext checks
- Changesets status with no package bump
```

Clean local `main` was then advanced with:

```text
git merge --ff-only portfolio-content-validation
```

The result created no merge commit and preserved the reviewed commit identities.

## Status-contract reconciliation

The program roadmap is the canonical sequencing/status owner, while the architecture overview, package-ownership status, root README, contribution guidance, completed content plan, and constitution contracts consume that status. They were updated together to record:

- P1 final-diff approval;
- the approved and locally integrated first P2 content increment;
- standards-owned copy enforcement as Task 2; and
- clean local `main` as the next sequential builder-repository development baseline under the existing governance owner.

The first constitution RED passed 20/21 and rejected the roadmap change because its generated-fixture contract still required the old P1 `In review` marker. Updating that direct assertion exposed a second stale status assertion in the same contract plus sequencing labels in user-facing README/contribution prose and executable test source. The repair changed user-facing prose to semantic stage language and constructed required historical roadmap labels from neutral fragments. A transient malformed regex escape was rejected by `node --check` and the focused test before commit; replacing it with ordinary string composition produced the final GREEN.

Final documentary checks passed:

```text
node --check tests/constitution/constitution.test.mjs
git diff --check
CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run test:constitution
21/21 passed

CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run check:semantic-naming
passed
```

## Resulting boundary

Local `main` now contains the approved P1 baseline and first P2 content increment at `e0886fb776f5cd80c34a6ab5c28e355cc1abd7b9`. Local `origin/main` remains at `5580da10eded51ceefa53a068c7ddaaddf2a2d50`; no push, pull request, publication, deployment, provider mutation, generated-client transformation, production action, permission change, or external message occurred.

The next P2 task is the separately reviewed standards-owned copy-enforcement increment. Its preparation must revalidate the current checkout and write its own exact-file plan. Direct development on `main` applies only while the builder-repository stream remains clean and sequential under the canonical review protocol; it does not relax generated-client transformation isolation or any external-action gate.
