# Protected Workflow Hardening Preparation Evidence

**Date:** 2026-08-13 (America/Toronto)

**Status:** Task 1 entry/preflight complete; RED contract changes and workflow implementation have not started

## Exact comparison and repository state

- Worktree: `.worktrees/protected-workflow-hardening`
- Branch: `protected-workflow-hardening`
- Branch base and current `HEAD`: `main@2b39979aedcf405bd73abcd57ce5d9ee33771059`
- Refreshed `origin/main`: `83d5ef1d4f1676704b5a578f0bf499d745cf01e8`
- Expected implementation comparison: `2b39979aedcf405bd73abcd57ce5d9ee33771059...<Plan-B-candidate>`

The original `main` checkout and this new branch were clean at entry. Refreshed `origin/main` is the direct parent of local `main`; the sole local descendant commit records the explicit Plan A acceptance in its canonical review packet. The new branch was therefore created from the latest local `main` without discarding that user-owned accepted state.

The worktree inventory found no uncommitted change to the four protected workflows, their two owning contract-test files, the compatibility record, or any planned Plan B evidence/review path. One separate worktree contains an unrelated dirty observability plan document; it is outside Plan B scope and was left untouched. Historical clean branches differ in some constitution or compatibility surfaces, but there is no overlapping uncommitted writer.

## Admission and predecessor evidence

The Plan B direct predecessor is the accepted Automatic CI Efficiency and Security implementation.

- Accepted Plan A base: `ee1e1df10fa2be2f09333efecd86de7f7a131d49`
- Accepted Plan A revision: `368b9491fd2f813f83f1e456823d8c7546f6762c`
- Acceptance artifact: `docs/review-packets/2026-08-12-automatic-ci-efficiency-security.md`
- Packet state at this branch: `Status: Accepted`, `Verified-final-diff approval: approved`, exact accepted revision recorded, and squash integration recorded
- Ancestry: the Plan A base is an ancestor of the accepted revision; the accepted revision is an ancestor of refreshed `origin/main` and this branch

The renewed Task 6D evidence revision `d7c63b0aaa9bebd56c075f16f1e5d86519853698` is an ancestor of integration revision `7b5324cfcffc7eb94f48cc304cbfe0ceb08c3486`, which is an ancestor of this branch. Its review packet remains a historical pre-integration handoff that records its then-pending final approval/publication boundary; the current program roadmap and architecture records own the later integrated-main status. Plan B does not modify that plan, evidence, review packet, certification record, or subject.

## Sources read

Preflight read the root and compatibility-proof `AGENTS.md` files; the approved source plan; architecture overview, capability model, package ownership, enforcement map, and program roadmap; accepted ADRs 0001 through 0011; the review/contribution and shared test-deployment policies; the compatibility record; current package-release tests and release evidence; certification evidence and receipt templates; all four workflows; and the owning constitution and package-boundary contracts.

It also read the accepted Plan A plan, preparation evidence, verification evidence, and review packet, plus the Task 6D renewal plan, preparation evidence, verification evidence, and review packet. No conversation-memory claim was used for admission or contract inventory.

## Authority and stop boundaries

Authorized by the accepted Plan B plan: bounded local workflow, test, and documentation edits; focused local commits; deterministic static verification; one later independent read-only review; and evidence-backed repair.

This entry increment is narrower: freeze and record Task 1 only. It does not authorize or begin Task 2 RED contract edits.

Not authorized: push, pull request, merge, workflow dispatch, deployment, certification, provider or secret access, publication, GitHub settings or environment changes, permission changes, production action, external messages, or review-comment responses.

## Current protected-workflow contract

| Workflow | Manual input and exact-main binding | Setup before Plan B | Timeout, environment, and concurrency |
| --- | --- | --- | --- |
| `.github/workflows/compatibility-proof.yml` | No input; job-level `refs/heads/main` guard only; no exact revision validation | checkout `d23441a48e516b6c34aea4fa41551a30e30af803` with default shallow checkout and credential persistence; pnpm setup `c9883cc79df532ad1a7b81bf9ab944ceb090d65c`; Node `22.23.2`; pnpm `11.20.0`; `cache: true`; `install: false`; frozen install | No timeout; `test-deploy`; shared `test-deploy`, non-cancelling, queue `max` |
| `.github/workflows/booking-calendly-certification.yml` | Required string inputs `expected_revision` and `calendly_url`; main guard; input equals `GITHUB_SHA`; checked-out `HEAD` equals `GITHUB_SHA` | checkout `3d3c42e5aac5ba805825da76410c181273ba90b1` at `github.sha`, full history, credentials disabled; pnpm setup `84cb39b217b10273981911c288cd62326dc7c6d2`; fixed toolchain; `cache: true`; `install: false`; frozen installs | 45 minutes; `test-deploy`; shared `test-deploy`, non-cancelling, queue `max` |
| `.github/workflows/production-observability-certification.yml` | Required string input `expected_revision`; main guard; validation checks the main ref, lowercase 40-hex input, `GITHUB_SHA` equality, and checked-out `HEAD` equality | checkout `d23441a48e516b6c34aea4fa41551a30e30af803` at `github.sha`, full history, credentials disabled; pnpm setup `c9883cc79df532ad1a7b81bf9ab944ceb090d65c`; fixed toolchain; `cache: true`; `install: false`; frozen installs | 60 minutes; `test-deploy`; shared `test-deploy`, non-cancelling, queue `max` |
| `.github/workflows/package-release.yml` | Required string input `release_commit`; main guard; checked-out `HEAD` and local `main` must equal the input before the local context checker and candidate checks | checkout `3d3c42e5aac5ba805825da76410c181273ba90b1` at `main`, full history, credentials disabled; pnpm setup `c9883cc79df532ad1a7b81bf9ab944ceb090d65c`; fixed toolchain; `cache: false`; `install: false`; frozen install | No timeout; `npm-release`; `package-release`, non-cancelling |

All four workflows are manual, use one protected job on `ubuntu-24.04`, and grant `contents: read`. Package release alone additionally grants `id-token: write` for npm trusted publication. No Plan B change may add an event, job, permission, environment, concurrency group, cancellation, or credential path.

## Security, deployment, receipt, and cleanup invariants

- Compatibility deployment exposes only `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to the deploy step. Its deploy command remains `pnpm --filter @egeria-systems/nextjs-cloudflare-proof run deploy -- --name test-deploy`; the public deployed test remains a separate secret-free step.
- Calendly certification exposes the two Cloudflare secrets only to `opennextjs-cloudflare deploy --name test-deploy`. Its local one-line JSON receipt is uploaded with seven-day retention. Candidate creation, install, unit/component tests, build, browser install, and deployed testing remain outside the secret-bearing step.
- Observability certification exposes the two Cloudflare secrets only to deployment and provider-secret installation, and exposes `BETTER_STACK_INGESTING_HOST` and `BETTER_STACK_SOURCE_TOKEN` only to provider-secret installation. Its temporary secret and deployment-list files use restrictive creation and an exit trap; bounded local, route, browser, and Cloudflare receipts are uploaded with seven-day retention. Provider/Worker cleanup remains governed by the separate certification runbook and receipt, not by Plan B.
- Package release retains the exact-main context check, candidate/peer/advisory checks, final registry-absence check, npm OIDC provenance, publish-only mutation command `pnpm run release-packages`, and unconditional temporary npm-authentication cleanup. Build and test commands remain outside the publication step.
- Credential-bearing deployment and publication steps remain deploy/publish-only. Plan B must not reorder them, move secrets, rebuild under credentials, alter Worker identity, alter receipt formats or retention, or change cleanup behavior.

## Reconfirmed action commits

The public GitHub commit API was queried on 2026-08-13 for each exact official-repository commit. It returned the requested SHA with `verification.verified: true` and `reason: valid` for:

- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`
- `pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2`
- `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`

The artifact-upload pin is already used only by the two certification workflows and remains unchanged. The shared repository policy continues to require the expected action repository plus an immutable full lowercase 40-hex SHA without encoding a release-specific SHA in the generic matcher.

## Toolchain and GREEN baseline

The repository pins Node `22.23.2` and pnpm `11.20.0`. The ambient Codex fallback exposed pnpm `11.19.0`; Volta already owned the required pnpm `11.20.0`, so installation and all baseline commands used that exact resolved binary. Frozen installation completed without changing the lockfile.

| Command | Result |
| --- | --- |
| `pnpm run test:constitution` | Passed; 55/55 tests |
| `pnpm run test:package-boundaries` | Passed; 46/46 tests |

These are the untouched pre-change contracts. They establish a GREEN local baseline only.

## Expected RED evidence for the next authorized task

Task 2, if separately continued, must first change only the owning static contracts and then produce RED for the following current gaps:

- compatibility: missing required `expected_revision`, full exact-main validation, full-history `github.sha` checkout, disabled checkout credentials, 45-minute timeout, reviewed checkout/setup pins, and disabled reusable pnpm cache;
- Calendly certification: reusable pnpm cache still enabled;
- observability certification: obsolete checkout/setup pins and reusable pnpm cache still enabled;
- package release: obsolete pnpm setup pin and missing 30-minute timeout.

The RED run must not fail for a new trigger, job, permission, environment, concurrency, secret, receipt, cleanup, deploy/publish command, provider flow, package content, certification status, or unrelated predecessor drift. Contract changes and their RED run have not started in this entry increment.

## Recovery and claim limits

Before Task 2, the only Plan B working-tree artifact is this preparation record. Later implementation recovery remains the plan's one focused revert of setup pins, cache flags, checkout/revision metadata, timeouts, and their direct tests/docs. Recovery does not authorize dispatch, deployment, publication, environment or credential mutation, provider cleanup, historical receipt rewrites, or use of another worktree's state.

Local Git ancestry, static Node tests, and public commit metadata do not prove GitHub-hosted workflow execution, environment protection, deployment, provider behavior, certification, publication, cleanup execution, production safety, or current repository settings. No protected workflow, provider, registry publication, secret, environment approval, or production path was exercised.
