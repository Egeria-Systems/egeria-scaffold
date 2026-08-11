# Package release fresh-checkout remediation plan

**Date:** 2026-08-11
**Status:** Approved for execution by the user's direct request to fix the failed release and push a new publication SHA
**Failed run:** `31457236804`, job `93673502739`
**Failed commit:** `8b09d1b00004cafe0bd63405b956dd7122e2cbec`

## Goal and completion criteria

Repair the cache-dependent release verification so the exact package-release candidate passes after a fresh checkout and frozen install, while preserving every publication safeguard. Completion requires:

- a focused regression assertion that fails when typed lint precedes the workspace declaration build;
- the minimum command-order correction at the canonical root verification owner;
- GREEN focused tests and the full exact release-candidate aggregate;
- a second proof in a fresh temporary clone with no prior `dist` output;
- fresh peer, audit, registry-history, semantic, documentation-link, and diff checks;
- independent requirements, architecture/anti-overengineering, and test-evidence review;
- dated incident evidence and a review packet;
- one fast-forward push of the exact repaired commit to remote `main` and direct remote-SHA verification.

The request authorizes the remediation commit and push. It does not authorize rerunning or dispatching the package-publication workflow.

## Root cause established before implementation

The GitHub job passed checkout, frozen dependency installation, release-context validation, constitution tests, and all 44 package-boundary tests. It failed when `verify:builder-packages:quality` invoked typed builder lint before `build:builder`.

`apps/cli` consumes `@egeria-systems/builder-core` through the package export `./dist/index.d.ts`. A fresh GitHub-hosted runner has no ignored `dist` output, so typed ESLint could not resolve the dependency and reported 90 `@typescript-eslint/no-unsafe-*` errors. The earlier local aggregate ran in a Git-clean but warmed worktree whose ignored `dist` output already existed. A fresh temporary clone reproduced the same 90 errors, and building only `@egeria-systems/builder-core` before lint made the unchanged lint command pass. This confirms command order, rather than the CLI source or GitHub runner image, as the causal defect.

GitHub documents that each GitHub-hosted job runs on a fresh runner instance. typescript-eslint documents that typed lint derives its type information from the TypeScript project and that missing declarations can collapse values to unsafe/error types.

## Exact file scope

Create:

```text
docs/superpowers/plans/2026-08-11-package-release-fresh-checkout-remediation.md
docs/implementation-evidence/2026-08-11-package-release-fresh-checkout-remediation.md
docs/review-packets/2026-08-11-package-release-fresh-checkout-remediation.md
```

Modify:

```text
package.json
tests/package-boundaries/release-safeguards.test.mjs
```

No workflow, package source, dependency, lockfile, package version, changelog, Changeset, or generated-project file is in scope without a documented evidence-backed amendment.

## Test-driven increment

1. Add a focused package-boundary assertion that both root public-package verification commands build the builder workspace before typed lint.
2. Run only that test and record the expected RED failure against the current `lint`-before-`build` order.
3. Reorder `build:builder` before `lint:builder` in `verify:builder-packages` and `verify:builder-packages:quality`. Change no underlying build, lint, test, typecheck, release, registry, authentication, or publication command.
4. Run the focused test GREEN.
5. Run `verify:package-release-candidate` with exact Node `22.23.2` and pnpm `11.20.0`.
6. Clone the repaired commit into a new temporary directory, run the exact frozen install, confirm no `dist` directory exists before verification, and run the full release-candidate aggregate there.

## Review and verification

- Requirements review: exact failed behavior, release safeguards, version immutability, and no unauthorized publication.
- Architecture/anti-overengineering review: canonical command owner, minimal ordering change, no package-source workaround, and no speculative hook framework.
- Test-evidence review: causal RED/GREEN evidence, fresh-clone proof, and claim calibration.
- Run peer-dependency checks, moderate full and production audits, registry signatures, the exact live registry-history/target-absence check, constitution/document-link checks, semantic naming, and `git diff --check` on the settled tree.
- Record the GitHub job evidence, local reproduction, why prior validation missed it, reviewer dispositions, changed files, commands/results, residual risks, and recovery.

## Git and recovery

The release worktree must remain clean before each repository-changing step. Local `main` currently contains unrelated untracked user planning files and must not be modified, cleaned, or used for integration. After verification, push the repaired release-worktree `HEAD` directly and non-forcibly to `origin/main`; a rejection is a stop condition. Confirm the remote ref equals the new full SHA.

Before a successful push, recovery is to abandon the remediation commits. After the push but before publication, recovery is a separately approved forward source correction. npm recovery remains irrelevant because the failed job skipped registry validation and publication, and no package version was published.
