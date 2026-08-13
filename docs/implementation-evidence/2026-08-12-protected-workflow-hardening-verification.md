# Protected Workflow Hardening Verification Evidence

**Date:** 2026-08-13 (America/Toronto)

**Status:** Local static verification complete; independent review and verified-final-diff approval pending

## Exact comparison and subject

- Plan B base: `2b39979aedcf405bd73abcd57ce5d9ee33771059`
- Settled implementation subject verified in Task 5: `75eb92021797850c7604cc1c22dddd626183bb4b`
- Verified implementation comparison: `2b39979aedcf405bd73abcd57ce5d9ee33771059..75eb92021797850c7604cc1c22dddd626183bb4b`
- Branch: `protected-workflow-hardening`
- Worktree: `.worktrees/protected-workflow-hardening`

The verification commands ran on a clean worktree at the settled implementation subject. This evidence record is a documentary descendant and does not alter the verified workflow, test, or compatibility-record bytes.

## Focused commit sequence

| Commit | Purpose |
| --- | --- |
| `d7e1ba9d66c2cd8a2864fd54ba59c65c2719bc95` | Record entry/preflight, authority, existing contracts, predecessor ancestry, expected RED, and claim boundaries |
| `e15ed8ba5be30a2c327189b64e9f5628a2946146` | Add the focused protected-workflow contract before implementation |
| `eeff15529948dbaef1883bb9d9806fe0d547f91a` | Apply only the approved workflow pins, cache flags, revision metadata, checkout controls, and timeouts |
| `75eb92021797850c7604cc1c22dddd626183bb4b` | Reconcile the current compatibility workflow matrix and local/static claim boundary |

## Changed files at the verified subject

```text
.github/workflows/booking-calendly-certification.yml
.github/workflows/compatibility-proof.yml
.github/workflows/package-release.yml
.github/workflows/production-observability-certification.yml
docs/compatibility/nextjs-cloudflare.md
docs/implementation-evidence/2026-08-12-protected-workflow-hardening-preparation.md
tests/constitution/constitution.test.mjs
tests/package-boundaries/package-release.test.mjs
```

No package, lockfile, release script, capability descriptor, certification registry, receipt template, historical evidence, deployment command, Worker identity, provider step, secret name, environment, concurrency group, or cleanup command changed.

## TDD evidence

The untouched baseline passed `pnpm run test:constitution` with 55/55 tests and `pnpm run test:package-boundaries` with 46/46 tests.

Only the two owning static contract files changed before workflow implementation. The first constitution RED attempt exposed a test-shape error because YAML represented the current empty `workflow_dispatch:` as `null`; the assertion was corrected to compare the complete dispatch object before proceeding. The causal RED runs then produced:

- `pnpm run test:constitution`: failed 3 tests and passed 52. The failures were the missing compatibility dispatch contract plus `cache: true` in the Calendly and observability workflows.
- `pnpm run test:package-boundaries`: failed 1 test and passed 45. The failure was the missing package-release timeout.

No workflow file changed before those causal failures were observed. After the minimal workflow changes, the focused GREEN runs passed constitution 55/55 and package boundaries 46/46.

The generic live-action policy still validates the expected repository and a full lowercase 40-hex SHA rather than encoding one release-specific commit. The implementation and this evidence bind the initially reviewed exact commits.

## Final static verification

All commands used the repository-pinned Node `22.23.2` and the Volta-resolved pnpm `11.20.0` binary. The ambient Codex fallback pnpm was not used.

| Command | Result |
| --- | --- |
| `pnpm run test:constitution` | Passed; 55/55 tests |
| `pnpm run test:package-boundaries` | Passed; 46/46 tests |
| `pnpm run check:semantic-naming` | Passed |
| `pnpm run check:capability-certification` | Passed; `{"ok":true,"gate":"admission","records":7}` |
| `pnpm run changeset:status` | Passed; existing minor bump remains only for `@egeria-systems/observability`; Plan B adds no Changeset |
| `git diff --check` | Passed on the clean settled tree |
| `git diff --check 2b39979aedcf405bd73abcd57ce5d9ee33771059..75eb92021797850c7604cc1c22dddd626183bb4b` | Passed for the complete verified comparison |

These checks are deterministic local/static evidence. No protected workflow was run or dispatched.

## Action commit verification

The public GitHub commit API returned the requested SHA with `verification.verified: true` and `reason: valid` for each official repository commit on 2026-08-13:

| Action | Verified commit |
| --- | --- |
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `pnpm/setup` | `84cb39b217b10273981911c288cd62326dc7c6d2` |
| `actions/upload-artifact` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |

The two certification workflows retain the existing artifact-upload commit and seven-day receipt retention. No artifact action was added to compatibility deployment or package release.

## Verified static contract

| Workflow | Revision and checkout | Setup and timeout | Protected boundary |
| --- | --- | --- | --- |
| Compatibility proof | Required `expected_revision`; main ref, lowercase 40-hex input, `GITHUB_SHA`, and checked-out `HEAD` equality; `${{ github.sha }}`; full history; persisted credentials disabled | reviewed checkout/setup commits; fixed Node/pnpm; frozen install; `cache: false`; 45 minutes | `contents: read`; `test-deploy`; shared non-cancelling `test-deploy` concurrency |
| Booking Calendly certification | Existing required `expected_revision` and `calendly_url`; existing `GITHUB_SHA` and checked-out `HEAD` equality; `${{ github.sha }}`; full history; persisted credentials disabled | reviewed checkout/setup commits; fixed Node/pnpm; frozen installs; `cache: false`; existing 45 minutes | `contents: read`; `test-deploy`; shared non-cancelling `test-deploy` concurrency |
| Production observability certification | Existing required `expected_revision`; existing main ref, lowercase 40-hex input, `GITHUB_SHA`, and checked-out `HEAD` equality; `${{ github.sha }}`; full history; persisted credentials disabled | reviewed checkout/setup commits; fixed Node/pnpm; frozen installs; `cache: false`; existing 60 minutes | `contents: read`; `test-deploy`; shared non-cancelling `test-deploy` concurrency |
| Package release | Existing required `release_commit`; checked-out `HEAD` and local `main` equality before candidate checks; `main`; full history; persisted credentials disabled | reviewed checkout/setup commits; fixed Node/pnpm; frozen install; existing `cache: false`; 30 minutes | `contents: read` plus sole `id-token: write`; `npm-release`; non-cancelling `package-release` concurrency |

## Preserved security and operational invariants

- Every workflow remains manual, single-job, exact-main, and fixed to `ubuntu-24.04`.
- Compatibility and Calendly continue to expose only the two Cloudflare credentials to their deploy-only steps. Build and tests remain outside those credential-bearing steps.
- Observability retains its distinct deploy and provider-secret steps, exact Cloudflare and Better Stack secret paths, restrictive temporary files, exit trap, bounded receipts, seven-day artifact retention, and separate provider/Worker cleanup authority.
- Package release retains the exact context checker, candidate/peer/advisory verification, final registry-absence check, OIDC trusted publication, explicit npm provenance, publish-only mutation step, and unconditional npm-authentication cleanup.
- Deployment and publication commands, Worker name `test-deploy`, environments, non-cancelling concurrency, public URL variables, receipt formats, cleanup behavior, and provider flow are byte-for-byte unchanged.
- No new permission, secret, event, job, cache action, package, dependency, artifact, provider, or external authority was added.

## Recovery

Before integration, recover with one focused newest-first revert of the Plan B commits after `2b39979aedcf405bd73abcd57ce5d9ee33771059`. Restore only the prior action pins, cache flags, checkout/revision metadata, timeouts, and their direct tests/docs. Do not use another worktree, reset/clean user state, rewrite historical evidence, or treat source recovery as authority for dispatch, deployment, publication, environment or credential mutation, provider cleanup, or production action.

## Claim and authority limits

Local static tests and public commit metadata do not prove GitHub-hosted execution, live repository or environment settings, deployment, provider behavior, certification, publication, registry mutation, cleanup execution, OIDC exchange, production safety, performance, visual quality, human usability, assistive-technology compatibility, or WCAG conformance.

No revision input, URL, secret, credential, provider account, environment approval, registry token, or OIDC publication authority was supplied. No workflow was dispatched; no Worker, provider, environment, registry, package, certification status, GitHub setting, or production state was read or mutated.
