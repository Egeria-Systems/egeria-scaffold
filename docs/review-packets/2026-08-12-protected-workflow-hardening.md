# Protected Workflow Hardening Review Packet

**Date:** 2026-08-13 (America/Toronto)

**Status:** Approved. Plan B received explicit verified-final-diff approval; integration and external actions remain separately gated.

**Verified-final-diff approval:** `approved`

**Plan B base:** `2b39979aedcf405bd73abcd57ce5d9ee33771059`

**Approved Plan B candidate:** `bac82110549ba3237f9c5a163a523630c9254fce`

**Reviewed implementation candidate before this packet:** `fe1de0083d45b8153442c1ecc09645a86339082d`

**Branch:** `protected-workflow-hardening`

**Isolated worktree:** `.worktrees/protected-workflow-hardening`

**Approved exact comparison:** `2b39979aedcf405bd73abcd57ce5d9ee33771059..bac82110549ba3237f9c5a163a523630c9254fce`. The focused commit containing this approval record is a documentary descendant and changes no approved workflow, test, compatibility-record, preparation-evidence, or verification-evidence byte.

## Outcome

Plan B hardens the four existing manual protected workflows without changing deployment, certification, provider, or publication behavior.

- All four use `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`, `pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2`, fixed Node `22.23.2`, fixed pnpm `11.20.0`, frozen installation, `cache: false`, full history, and persisted checkout credentials disabled.
- Compatibility deployment now requires `expected_revision`, checks out `${{ github.sha }}`, validates `refs/heads/main`, lowercase 40-hex input, `GITHUB_SHA` equality, and checked-out `HEAD` equality before installation, and has a 45-minute timeout.
- Calendly keeps its 45-minute timeout and existing revision/input evidence flow. Observability keeps its 60-minute timeout and existing full exact-revision validation. Package release adds a 30-minute timeout and retains its existing exact release-commit validation before candidate checks.
- Permissions remain `contents: read`, with package release's sole additional `id-token: write`. Existing environments, non-cancelling concurrency, secret paths, receipts, retention, cleanup, registry/advisory checks, npm OIDC provenance, deployment commands, publication command, and Worker identity are unchanged.

No protected workflow was dispatched and no external system was changed.

## Exact changed files

Workflows:

- `.github/workflows/compatibility-proof.yml`
- `.github/workflows/booking-calendly-certification.yml`
- `.github/workflows/production-observability-certification.yml`
- `.github/workflows/package-release.yml`

Owning static contracts:

- `tests/constitution/constitution.test.mjs`
- `tests/package-boundaries/package-release.test.mjs`

Current documentation and Plan B evidence:

- `docs/compatibility/nextjs-cloudflare.md`
- `docs/implementation-evidence/2026-08-12-protected-workflow-hardening-preparation.md`
- `docs/implementation-evidence/2026-08-12-protected-workflow-hardening-verification.md`
- `docs/review-packets/2026-08-12-protected-workflow-hardening.md`

No other file is part of the Plan B comparison.

## Commit sequence

- `d7e1ba9d66c2cd8a2864fd54ba59c65c2719bc95` — `docs: record protected workflow preflight`
- `e15ed8ba5be30a2c327189b64e9f5628a2946146` — `test: require protected workflow hardening`
- `eeff15529948dbaef1883bb9d9806fe0d547f91a` — `ci: harden protected workflows`
- `75eb92021797850c7604cc1c22dddd626183bb4b` — `docs: record protected workflow controls`
- `fe1de0083d45b8153442c1ecc09645a86339082d` — `docs: record protected workflow verification`

The final focused review-packet commit is reported in the handoff.

## Admission and authority

The accepted Plan A revision `368b9491fd2f813f83f1e456823d8c7546f6762c` is an ancestor of refreshed `origin/main` and this branch. Its canonical packet records explicit verified-final-diff approval and the exact accepted revision. The renewed Task 6D evidence revision `d7c63b0aaa9bebd56c075f16f1e5d86519853698` is ancestral to integrated revision `7b5324cfcffc7eb94f48cc304cbfe0ceb08c3486`, which is ancestral to this branch. No overlapping uncommitted protected-workflow writer was present at entry.

Implementation authorization covered local exact-scope edits, focused commits, deterministic static verification, one bounded independent read-only reviewer, and any evidence-backed repair. It did not authorize push, pull request, merge, workflow dispatch, deployment, certification, provider or secret access, publication, GitHub settings or environment changes, permission changes, external messages, or production action.

## TDD record

The untouched baseline passed constitution 55/55 and package boundaries 46/46.

The static contracts were committed before workflow implementation. An initial compatibility assertion dereferenced the current YAML `null` dispatch value; systematic debugging identified that test-shape cause, and the assertion was corrected to compare the complete dispatch object before proceeding. The causal RED state then passed 52 and failed 3 constitution tests for the absent compatibility dispatch contract plus the Calendly and observability cache flags. Package boundaries passed 45 and failed 1 for the absent package-release timeout.

The minimum workflow implementation made both focused suites GREEN: constitution 55/55 and package boundaries 46/46. No implementation file preceded the causal RED evidence. The generic action-pin policy remains Dependabot-compatible by requiring the expected repository and a full lowercase 40-hex SHA without embedding one release-specific commit in the generic matcher.

## Verification

Node `22.23.2` and Volta-resolved pnpm `11.20.0` were used. The settled implementation subject was clean before the final static batch.

| Command or boundary | Result |
| --- | --- |
| `pnpm run test:constitution` | Passed; 55/55 |
| `pnpm run test:package-boundaries` | Passed; 46/46 |
| `pnpm run check:semantic-naming` | Passed |
| `pnpm run check:capability-certification` | Passed admission; 7 records |
| `pnpm run changeset:status` | Passed; existing minor bump only for `@egeria-systems/observability`; Plan B adds no Changeset |
| `git diff --check` | Passed on the clean settled tree |
| Complete `2b39979aedcf405bd73abcd57ce5d9ee33771059..75eb92021797850c7604cc1c22dddd626183bb4b` comparison | Passed `git diff --check` |
| Post-verification-evidence semantic naming | Passed |
| Post-verification-evidence constitution | Passed; 55/55 |

The public GitHub commit API returned `verification.verified: true` and `reason: valid` for the exact official `actions/checkout`, `pnpm/setup`, and unchanged `actions/upload-artifact` commits recorded above and in verification evidence.

## Independent review dispositions

One bounded independent read-only reviewer inspected exact comparison `2b39979aedcf405bd73abcd57ce5d9ee33771059..fe1de0083d45b8153442c1ecc09645a86339082d`. It did not edit, dispatch, delegate, or access any external system.

### Requirements report

**Verdict:** PASS

No material findings. The reviewer confirmed exact scope, revision binding, pins, permissions, cache removal, timeouts, protected boundaries, receipts, cleanup, release controls, documentation, recovery, and authority limits comply with the plan.

### Architecture and anti-overengineering report

**Verdict:** PASS

No material findings. The reviewer confirmed the changes are surgical, preserve canonical deployment/publication semantics, and introduce no shell/ref injection path or speculative abstraction.

### Test-evidence report

**Verdict:** PASS

No material findings. The reviewer confirmed commit-supported causal TDD, independently reran constitution 55/55 and package boundaries 46/46 with pnpm `11.20.0`, observed a clean worktree, and confirmed the evidence limits claims to local/static behavior.

### Overall assessment

Ready for the plan-required review packet and fresh exact-final-diff verification, then verified-final-diff approval. This does not establish hosted workflow, deployment, provider, certification, publication, or production readiness.

Controller validation confirmed the reviewer inspected the exact clean base/candidate range and that its factual dispositions match the current workflow, test, documentation, evidence, and Git state. No repair was warranted, so no post-review behavior change or second reviewer was introduced.

## Claims, residual risks, and deferred work

- Static parsing and local Node tests do not prove GitHub-hosted event delivery or execution, live repository/environment settings, environment protection, deployment, provider behavior, certification, publication, registry mutation, cleanup execution, OIDC exchange, or production safety.
- Public commit-signature metadata confirms the queried action commits at that point in time; it does not certify all future dependency, runner, action, or supply-chain behavior.
- No performance, visual, browser, human-usability, assistive-technology, translation, or WCAG claim is made.
- The existing observability minor Changeset is outside Plan B and remains untouched.
- Future action updates require ordinary review and hosted validation. The generic policy intentionally permits a different valid full SHA from the expected repository.
- Integration, hosted execution, deployment, certification, provider cleanup, and publication remain separately gated work.

## Recovery

Use focused newest-first reverts after base `2b39979aedcf405bd73abcd57ce5d9ee33771059`. Restore only the previous action pins, cache flags, checkout/revision metadata, timeouts, and their direct tests/docs. Preserve unrelated user work and all historical deployment, certification, provider, release, and receipt evidence.

Source recovery grants no authority to dispatch, deploy, publish, mutate an environment or credential, change provider state, execute cleanup, alter certification, or perform a production action. No external recovery applies because Plan B changed no external system.

## Approval outcome

Explicit verified-final-diff approval was received on 2026-08-13 for exact comparison `2b39979aedcf405bd73abcd57ce5d9ee33771059..bac82110549ba3237f9c5a163a523630c9254fce` after the final packet-integrity and Git checks. This approval closes the Plan B local review gate only.

Keep the branch and worktree intact pending a separate integration choice. Do not push, create a pull request, merge, dispatch a workflow, deploy, certify, publish, access providers or secrets, mutate GitHub settings or environments, reply to review comments, or perform a production action without explicit authorization.
