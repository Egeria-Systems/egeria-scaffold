# Production observability package release-candidate evidence

- Date: 2026-08-10
- Status: release candidate prepared; push and publication not authorized
- Source candidate: `c052f0b381b4690a6cc88aab8f57406a27846a3c`
- Reviewed implementation candidate: `3ce6ab36e7e9340342caedd8cc3f5a9cb26604cf`
- Branch: `production-observability`
- Isolated worktree: `.worktrees/production-observability`

## Outcome

The release candidate materializes `@egeria-systems/observability@0.2.0` and `@egeria-systems/standards@0.2.0`. Changesets generated both versions and changelogs once, retained the published `0.1.0` history, and consumed the two pending Changesets. Private workspace packages remain at `0.0.0`, and `pnpm-lock.yaml` is unchanged.

The live npm registry check accepted only the exact existing history `["0.1.0"]` for each package and confirmed that both `0.2.0` targets were absent. No commit was integrated to `main`, no branch was pushed, no workflow was dispatched, and no package was published.

## Approved plan amendments

The user's preapproval for necessary plan amendments covered these evidence-backed changes:

- Add `packages/standards/README.md` because the packed public documentation was stale after version materialization.
- Update the direct version consumers in `tests/package-boundaries/private-packages.test.mjs`, `tests/package-boundaries/public-observability.test.mjs`, and `tests/package-boundaries/public-standards.test.mjs`.
- Remove a raw post-materialization `changeset status` workflow command because Changesets correctly exits nonzero when changed packages have no pending Changeset; the local release checker owns the intended no-pending-Changeset assertion.
- Remove the dormant bootstrap-token configuration so the workflow has a single OIDC trusted-publishing authentication path.
- Strengthen the final registry gate to require exact prior histories, valid packument version metadata, and absent target versions.

The exact-file amendment is recorded in the approved implementation plan.

## Test-driven development record

| Cycle | RED evidence | GREEN evidence |
| --- | --- | --- |
| Subsequent two-package release | The focused release suite failed 8 of 22 assertions against the initial-release assumptions and unmaterialized Changesets. | The local checker passed 15 of 15 focused assertions; after materialization the combined focused suite passed 22 of 22. |
| Post-materialization workflow behavior | `pnpm run changeset:status` exited 1 with the expected no-pending-Changesets diagnostic, and the workflow safeguard test rejected that command. | The redundant workflow command was removed; the release checker retained the no-pending-Changeset gate and the workflow suite passed 15 of 15. |
| Direct manifest consumers | The complete package-boundary suite exposed three fixtures still requiring `0.1.0`. | The direct consumers were updated to the materialized `0.2.0` versions and the package-boundary suite passed. |
| Independent-review repairs | Six added focused assertions failed for wrong, extra, empty, and invalid registry histories plus the two documented release surfaces. | The repaired focused release suite passed 24 of 24, including the real registry adapter. |

`pnpm run version-packages` was executed exactly once. The generated artifacts were inspected rather than hand-edited.

## Publish workflow and trigger

`.github/workflows/package-release.yml` is the only package-publication path in repository CI. It is manual-only (`workflow_dispatch`) and requires a `release_commit` input. The job runs only from `refs/heads/main`, checks out full history without persisted Git credentials, and requires the supplied commit to equal both checked-out `HEAD` and local `main`.

The job then uses Node `22.23.2`, pnpm `11.20.0`, and npm `12.0.2`; runs the complete release-candidate verification, peer-dependency check, moderate audit, and final live registry check; and invokes Changesets publication with `id-token: write` and provenance enabled. An unconditional cleanup step deletes npm user authentication configuration. The protected `npm-release` GitHub environment can require a reviewer before the job proceeds.

Current official evidence was revalidated on 2026-08-10:

- [GitHub manual workflow documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow?tool=cli)
- [GitHub deployment-environment approvals](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm provenance statements](https://docs.npmjs.com/generating-provenance-statements/)

The installed pnpm `11.20.0` implementation and changelog were also inspected locally to confirm its OIDC token exchange and provenance path. The installed Changesets `2.31.1` implementation identifies the pnpm workspace and delegates publication to `pnpm publish`.

## Verification

All exact-toolchain commands used `CI=true`, Node `22.23.2`, and pnpm `11.20.0` through Volta.

| Command | Result |
| --- | --- |
| `pnpm run version-packages` | Passed once; generated both `0.2.0` versions and changelogs and consumed both Changesets. |
| Focused release and safeguard tests | Passed, 24 of 24. |
| `pnpm run verify:package-release-candidate` | Passed on `3ce6ab3`; constitution 29/29, package boundaries 44/44, standards 33/33, observability 23/23, plus builder lint, build, and typecheck. |
| `pnpm peers check` | Passed with no issues. |
| `pnpm audit --audit-level=moderate` | Passed; no known vulnerabilities. |
| `pnpm audit --prod --audit-level=moderate` | Passed; no known vulnerabilities. |
| `pnpm audit signatures` | Passed; 885 packages verified. |
| `pnpm run check:package-release registry` | Passed; exact histories `["0.1.0"]`, both `0.2.0` targets absent. |
| `git diff --check` | Passed. |

An initial ambient invocation selected Node `24.14` and pnpm `11.16` and was rejected by the repository engine contract. Reconstructing dependencies under the exact toolchain then encountered sandbox DNS failure. An approved exact `pnpm install --frozen-lockfile` restored `node_modules` from the package store without changing tracked files. These failed setup attempts are not counted as verification evidence.

## Independent review

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | The registry check accepted any existing history instead of the exact prior set, and three direct version consumers were outside the documented file scope. | Repaired and re-reviewed. Exact history and fail-closed metadata tests pass; the plan records the exact-file amendment. |
| Architecture and anti-overengineering | A dormant bootstrap-token path conflicted with the OIDC-only boundary, and packed standards documentation described already-materialized changes as pending. | Repaired and re-reviewed. The workflow now has one authentication path; the public README reflects `0.2.0`. |
| Test evidence | Exact-history and malformed-packument behavior lacked causal protection. | Repaired. Wrong, extra, empty, non-semver, invalid-response, sanitized-error, and real-adapter cases pass. No material improvements were recommended on re-review. |

## Risks, gate, and recovery

- The GitHub `npm-release` environment and npm trusted-publisher configuration must be re-read immediately before dispatch. Current GitHub CLI authentication is invalid, so that live external check has not been completed.
- A registry race remains possible between approval and execution. The workflow's last pre-publication action rechecks exact history and target absence and fails closed.
- npm versions are immutable. If one package publishes and the second fails, the response is a separately approved forward recovery; never retry the already-published version.
- Source rollback, registry/package recovery, and consumer recovery are separate. Before publication, the candidate can be abandoned without external rollback because no external state changed.
- Successful automation would not by itself prove production behavior, complete supply-chain safety, or WCAG conformance. Provenance must be checked on the published artifacts before it is claimed.

This candidate stops for explicit approval of the exact final diff. Integration, push, workflow dispatch, publication, and post-publication verification remain separate external actions.
