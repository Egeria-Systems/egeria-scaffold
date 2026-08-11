# Package release fresh-checkout remediation evidence

- Date: 2026-08-11
- Status: implementation verified; authorized push pending at evidence time
- Failed workflow: [Package release run 31457236804, job 93673502739](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31457236804/job/93673502739)
- Failed commit: `8b09d1b00004cafe0bd63405b956dd7122e2cbec`
- Reviewed remediation implementation: `78a308a4097d64ce8d071f302b2e16c03ffde747`
- Plan: [package release fresh-checkout remediation](../superpowers/plans/2026-08-11-package-release-fresh-checkout-remediation.md)

## Outcome

The failed publication attempt did not reach the registry check or publish step. Both public `0.2.0` targets remain absent from npm with exact prior histories of `0.1.0`. No package version, package contents, workflow, dependency, lockfile, Changeset, authentication boundary, or publication command changed in this remediation.

The two root public-package verification aggregates now build the builder workspace before typed lint. A focused assertion protects that ordering, and the complete release-candidate aggregate passed in a second fresh clone that contained no pre-existing `dist` output.

## Failure and root cause

The GitHub job ran against the approved SHA and passed checkout, the frozen install, release-context validation, all 29 constitution tests, and all 44 then-current package-boundary tests. It failed in `Verify release candidate` when `lint:builder` reached `apps/cli`:

- `apps/cli` imports `@egeria-systems/builder-core` through the workspace package boundary.
- That private package exposes types from `./dist/index.d.ts`.
- The failed aggregate ran typed lint before `build:builder`.
- A fresh GitHub-hosted runner had no ignored `dist` output, so typescript-eslint could not resolve the imported types and reported 90 `no-unsafe-*` or error-typed diagnostics.

A fresh temporary clone of the failed SHA reproduced the same 90 errors after the exact frozen install. Building only `@egeria-systems/builder-core`, without changing the CLI, lint configuration, or source, made the unchanged lint command pass. This isolated missing workspace declarations as the root cause.

The earlier local release validation did run and did pass, but it ran in a warmed worktree. Previous builder commands had left ignored `dist` output in place. Git status was clean because ignored outputs are not reported, so the verification order's hidden state dependency was not visible. The validation evidence was real for that warmed tree but insufficient for a fresh checkout.

GitHub documents that each hosted job runs on a [fresh runner instance](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job?apiVersion=2022-11-28). typescript-eslint documents that typed lint uses the TypeScript project for type information and that missing declarations can become unsafe values in its [typed-lint troubleshooting guidance](https://typescript-eslint.io/troubleshooting/typed-linting/).

## Test-driven record

1. The new focused test named the causal invariant: both affected verification commands must build workspace declarations before typed lint.
2. Against the failed command order, the test failed 1/1 with `verify:builder-packages must build workspace declarations before typed lint`.
3. The only production change moved the existing `build:builder` command before the existing `lint:builder` command in `verify:builder-packages` and `verify:builder-packages:quality`.
4. The focused test passed 1/1, and the complete release-safeguard file passed 8/8.
5. No command was added, removed, renamed, or weakened.

## Fresh-clone behavioral proof

A new local clone checked out exact implementation commit `78a308a4097d64ce8d071f302b2e16c03ffde747`. Before installation and verification, it had no `dist` directory under `apps` or `packages`. The clone then ran the exact frozen install and `verify:package-release-candidate` with Node `22.23.2` and pnpm `11.20.0`.

Results:

- Constitution: 29/29 passed.
- Package boundaries: 45/45 passed.
- Builder-core, observability, and CLI build: passed before typed lint.
- Builder typed lint and copy externalization: passed.
- Standards: 33/33 passed.
- Observability: 23/23 passed.
- Builder typecheck: passed.
- Local exact package-release check: passed.

This fresh-clone run exercises the repaired behavior. The static ordering test alone does not prove GitHub execution; the fresh clone closes that gap without claiming that the external workflow has been rerun.

## Additional verification

- Peer dependencies: no issues.
- Full moderate audit: no known vulnerabilities.
- Production-only moderate audit: no known vulnerabilities.
- Registry signatures: 885 packages verified. One transient sandbox DNS warning retried successfully before the command completed.
- Live npm release check: exact histories `0.1.0` and absent `0.2.0` targets for both packages.
- Focused release safeguards: 8/8 passed.
- `git diff --check`: passed before evidence commit.

## Independent review

- Requirements: no material findings. Exact scope, public versions, workflow safeguards, registry behavior, and authorization boundaries remain intact.
- Architecture and anti-overengineering: no material findings. The root scripts are the canonical verification owner; package-source or workflow workarounds and a hook framework would add churn without addressing the cause.
- Test evidence: no material findings. The failed run, exact fresh-clone reproduction, single-variable hypothesis check, RED/GREEN assertion, and second fresh-clone aggregate form a causal evidence chain.

## Pre-commit hook assessment

A pre-commit hook invoking the previous aggregate would also have passed in the warmed worktree, so it would not have prevented this incident. Adding a hook manager in this repair would create a second execution surface without fixing the hidden state dependency.

The durable fix is that the canonical verification command is now self-preparing. A separate future increment may add an automatic pull-request or push CI job that performs a frozen install and runs the builder verification on a fresh hosted runner. A lightweight optional pre-push hook could improve developer feedback, but neither hook should replace clean-runner CI or the protected manual publication gate.

## Recovery and remaining authority

Local `main` contains unrelated untracked user planning files and was not changed or cleaned. The remediation was performed in the clean isolated release worktree. The authorized push must be a non-forced fast-forward from the repaired worktree directly to `origin/main`; any rejection is a stop condition.

This evidence does not authorize or claim a publication rerun. After the new SHA is on remote `main`, the user can provide that SHA to the separately triggered package-release workflow.
