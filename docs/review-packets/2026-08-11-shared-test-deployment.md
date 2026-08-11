# Shared Test Deployment Review Packet

**Date:** 2026-08-11 (America/Toronto)

**Status:** Repository correction prepared; live certification remains blocked at preflight

**Base revision:** `8c923c25f0fd98f42bb8a91599ca3d79369b5be5`

**Comparison:** base revision to the final reviewed `main` working-tree correction and this packet

## Outcome

The repository now gives the compatible stateless manual workflows one explicit non-production deployment boundary: GitHub environment `test-deploy`, public variable `DEPLOY_URL`, Cloudflare Worker `test-deploy`, and cross-workflow concurrency group `test-deploy`. Compatibility, Calendly certification, and observability certification deploy commands override their project-local Worker names with the exact shared target. Generated candidate names remain capability-specific evidence identities.

The new [shared deployment policy](../governance/shared-test-deployment.md) limits reuse to stateless workflows in the same non-production account and protection boundary. It excludes production, persistent data, differently privileged integrations, and journeys that cannot restore the clean compatibility baseline. It also owns the exclusive lease, account-scoped Cloudflare permission boundary, provider-secret residue, cleanup, recovery, and legacy-environment deletion gate.

`observability@0.2.0` remains `pending`. No workflow was dispatched, no credential was used, no deployment or telemetry was sent, no provider event or raw log was inspected, no cleanup occurred, and no certification registry transition was made.

## Changed files

- `.github/workflows/booking-calendly-certification.yml`
- `.github/workflows/compatibility-proof.yml`
- `.github/workflows/production-observability-certification.yml`
- `docs/compatibility/nextjs-cloudflare.md`
- `docs/governance/review-and-contribution.md`
- `docs/governance/shared-test-deployment.md`
- `docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md`
- `docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md`
- `docs/implementation-evidence/booking-calendly-provider-receipt-template.md`
- `docs/implementation-evidence/production-observability-provider-receipt-template.md`
- `docs/review-packets/2026-08-11-production-observability-certification.md`
- `docs/review-packets/2026-08-11-shared-test-deployment.md`
- `docs/superpowers/plans/2026-08-10-booking-calendly-certification.md`
- `docs/superpowers/plans/2026-08-10-production-observability-certification.md`
- `scripts/create-cloudflare-deployment-receipt.mjs`
- `tests/capability-certification/production-observability.test.mjs`
- `tests/constitution/constitution.test.mjs`

No capability descriptor, generated application source, package version, lockfile, registry status, retained historical provider receipt, or later roadmap implementation changed.

## Workflow contract

- All three workflows remain manual-only, `contents: read`, `main`-bounded deployment jobs with the repository-pinned Node, pnpm, actions, OpenNext, Wrangler, and Playwright versions.
- `queue: max` is the current GitHub-supported opt-in for retaining multiple pending runs. Combined with the same `test-deploy` group and `cancel-in-progress: false`, it serializes the shared Worker across these workflows rather than replacing an earlier pending run.
- Compatibility maps `DEPLOY_URL` into its existing `COMPATIBILITY_URL` test interface and deploys the already verified artifact through its deploy-only script.
- Calendly maps `DEPLOY_URL` into its existing Playwright interface and keeps its provider booking and cancellation entirely outside the workflow.
- Observability maps `DEPLOY_URL` into its bounded route and Playwright interfaces. OpenNext deploy, Wrangler secret bulk, Wrangler deployment listing, and the sanitized receipt all name Worker `test-deploy` explicitly.
- The observability receipt sanitizer accepts only the exact shared Worker name while retaining the unique-latest-deployment and single-version-at-100-percent checks.
- The four-name environment-secret allowlist is unchanged. Compatibility and Calendly reference only the two Cloudflare names; observability references the Better Stack names only inside its existing isolated secret-install step.

## Test-driven evidence

The focused contract was changed before production sources. The test-only RED command was:

```text
CI=true node --test tests/constitution/constitution.test.mjs tests/capability-certification/production-observability.test.mjs
```

It reported 46 passes and 10 failures on the absent shared policy, old concurrency groups, inconsistent URL variables, old Worker targets, and old receipt identity. It also exposed stale compiled builder output as a separate setup condition; rebuilding the pinned packages restored the canonical registry behavior without a source repair.

After independent review identified an end-of-line command-regex gap, the exact mutation check was run RED before its matcher was corrected:

```text
CI=true node --test --test-reporter=spec --test-name-pattern='credential-bearing steps reject package build or test commands at the end of a line' tests/constitution/constitution.test.mjs
```

It reported 0 passes and 1 expected failure because `pnpm run build` at end of input was not matched. The subsequent repair adds the end-of-input alternative and applies one exact parsed secret-reference boundary to all three shared workflows.

The final focused workflow, runbook, cleanup, and Cloudflare receipt checks pass. The complete final verification results are recorded below after the settled tree and review packet are present.

## Current official-document basis

Primary documentation was revalidated on 2026-08-11:

- [GitHub environment deployments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments) for environment protection and gated secrets;
- [GitHub workflow concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency) for cross-workflow groups and `queue: max`;
- [OpenNext Cloudflare CLI](https://opennext.js.org/cloudflare/cli) for Wrangler-option forwarding to deploy;
- [Wrangler Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) for explicit `--name`, secret-bulk, and deployment-list targets;
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/) for secret deployment behavior and the fact that ordinary code deployment preserves existing Worker secrets;
- [Cloudflare API token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/) for the Account resource granularity of `Workers Scripts Write`;
- [Better Stack pricing](https://betterstack.com/pricing) and [source creation](https://betterstack.com/docs/logs/api/create-a-source/) for current tier, quota, retention, region, and source-specific ingest metadata boundaries;
- [Playwright request inspection](https://playwright.dev/docs/api/class-request) for the already prepared bounded browser receipt path; and
- the current Node, pnpm audit/signature, Next.js, OpenNext, Wrangler, and GitHub security/advisory sources already enumerated in the [observability preparation record](../implementation-evidence/2026-08-11-production-observability-certification-preparation.md).

These sources support the configuration design. They do not prove hosted execution, provider delivery, security completeness, production readiness, performance, human accessibility, or WCAG conformance.

## Read-only live preflight

The controller performed only content-safe read-only checks and recorded no secret value, ingestion host, private URL, raw log, event, request metadata, or stack.

- Git and remote: local `main`, `origin/main`, and the fetched remote were aligned at the base revision before this correction.
- Cloudflare Worker: `test-deploy` exists, its public route returned `200`, and the dashboard showed no bindings on the current manual baseline.
- GitHub URL: the initial `DEPLOY_URL` targeted another Worker route and returned `404`. The user changed it; refreshed GitHub configuration now names the exact public `test-deploy` root, and that route returns `200`.
- GitHub protection: `test-deploy` still has no required reviewer, no wait timer, no deployment branch or tag restriction, and administrator bypass enabled.
- GitHub names: the environment contains only `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; the two required Better Stack names are absent.
- Cloudflare credential metadata: the single active account-owned token has only `Workers Scripts Write`, which is the provider's documented Account-scoped permission for these Worker operations. It has no expiration, no IP restriction, and no prior-use timestamp. No value was viewed. The account's non-production-only boundary and the token expiry/rotation/revocation decision remain unapproved.
- Better Stack: the authenticated account is on Free and displayed 3 GB of logs per month with three-day retention. The Sources page contains only the onboarding sample source. No event or raw log was opened. There is no designated approved non-production observability source or confirmed region, quota acceptance, retention, data-residency, owner, or source-credential lifecycle.
- Owners and cost: GitHub, dispatch, deployment risk, Cloudflare, Better Stack, privacy and cost, cleanup, and evidence-review owners plus no-upgrade and no-incremental-spend decisions remain unrecorded for this run.

The URL mismatch is resolved. Every other missing item above is a preflight stop, not authority to change external settings.

## Independent review dispositions

Requirements review and architecture/anti-overengineering review found no material improvements. Test-evidence review found three material gaps: two credential-step regexes missed build/test commands at end of input, compatibility and Calendly did not enumerate every allowed secret reference, and the packet did not record the exact original RED result. All three findings were accepted and repaired with the end-of-input mutation check, shared exact-reference enumeration, and the command/count evidence above. Review output is evidence, not authorization for an external certification checkpoint.

## Final verification

The directly affected settled-tree verification used pinned Node.js `22.23.2` and pnpm `11.20.0`:

- `CI=true node --test --test-reporter=spec tests/constitution/constitution.test.mjs tests/capability-certification/production-observability.test.mjs` — 57 passed, 0 failed;
- `pnpm run lint:builder` — passed;
- `pnpm run build:builder` — passed;
- `pnpm run typecheck:builder` — passed;
- `pnpm run changeset:status` — passed with no package bump; and
- `pnpm audit --audit-level=moderate` — passed with no known vulnerabilities; `pnpm audit signatures` exited zero with 885 verified registry signatures after one transient registry lookup warning.

The complete `pnpm run verify:builder-kernel` run passed constitution (50 tests), package-boundary (45), builder-core (136), CLI (10), capability-certification (20), and admission checks before stopping in generated-fixture determinism. That check reported 7 passes and 1 failure because the current generated lockfile and its recorded fingerprint no longer match the committed fixture. An approved network-enabled rerun of only that exact test resolved the sandboxed registry timeout but reproduced the committed-versus-current lockfile drift. None of this correction's changed files participates in generated project dependency resolution or committed fixture content, so fixture regeneration was not added to this scope. `pnpm run verify:generated-skeletons` was separately inconclusive and was interrupted with exit 130 after more than seven minutes without output in the restricted environment; it is not recorded as a pass.

Admission remains valid. The `legacy-backfill-exempt` closure rejects only `observability` as `pending`; `all-certified` rejects `observability` plus the existing backfill-pending records. These expected closure failures confirm that this repository correction did not change certification status.

## Residual risk and stop conditions

- A shared Worker increases blast radius if an out-of-band deploy bypasses the GitHub concurrency group. The exclusive lease requires a manual preflight for other active deployments.
- Cloudflare preserves Worker secrets on later code deployments. The two Better Stack Worker secrets must be removed or explicitly retained under owner, expiry, privacy, cost, and recovery decisions before the lease is released.
- `queue: max` preserves additional explicitly dispatched pending runs. It prevents silent replacement; it does not authorize more than the single approved run or any automatic rerun.
- The shared Worker policy does not extend to production, persistent state, database, identity, payments, CMS, durable queue/storage, client domain, or differently privileged provider journeys.
- Better Stack source activation, GitHub protection changes, secret creation/storage, credential use, workflow dispatch, deployment, synthetic telemetry, provider inspection, cleanup, evidence acceptance, and registry transition remain separate explicit checkpoints.
- Legacy environment deletion is not part of this change. It requires a separately approved reference/evidence audit and deletion action.

Stop immediately on missing protection, concurrent use, revision drift, unexpected events or private content, authentication or authorization failure, quota or spend change, provider mismatch, or incomplete evidence.

## Recovery

Source recovery is a focused revert of this correction; it does not change any external system. No external mutation by the controller requires rollback from this repository phase.

After a later authorized observability run, deployment recovery restores the clean compatibility baseline on retained Worker `test-deploy`, verifies the certification-only route is unreachable, and separately resolves Worker secrets, Better Stack source/data, GitHub environment names, API credentials, and temporary files. Provider recovery, credential recovery, environment deletion, and registry transition remain distinct actions.

`observability@0.2.0` remains `pending` unless both deployed-application and cleanup-recovery evidence are complete and affirmatively reviewed. Any pending-to-certified change is a separate local tested diff requiring verified-final-diff approval before merge or push.
