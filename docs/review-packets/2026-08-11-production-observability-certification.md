# Production Observability Certification Preparation Review Packet

**Date:** 2026-08-11 (America/Toronto)

**Status:** Ready for explicit verified-final-diff approval; local implementation complete, live certification not executed

**Approved implementation base:** `fb3af7fef7602764432f16940abff0ffc65a5b67`

**Final implementation commit before this review record:** `2987b8f82005e98eddfe25b417e5c6c8ae5b184a`

**Implementation comparison before this review record:** `fb3af7fef7602764432f16940abff0ffc65a5b67..2987b8f82005e98eddfe25b417e5c6c8ae5b184a`

**Review-record commit:** the separate enclosing commit that adds this packet and closes the local plan checkboxes

## Current deployment-target amendment

This packet records the original dedicated-resource preparation and remains historical evidence for that reviewed comparison. The current undispatched workflow instead follows the [shared test deployment policy](../governance/shared-test-deployment.md) and the later [shared deployment review packet](2026-08-11-shared-test-deployment.md): environment `test-deploy`, variable `DEPLOY_URL`, deployed Worker `test-deploy`, cross-workflow serialized lease, and clean compatibility baseline recovery. The generated candidate remains `acme-portfolio-observability`. No completed evidence or certification status is changed by this amendment.

## Outcome

The builder can now produce causal local `fresh-scaffold` certification evidence for `observability@0.2.0`, and the repository contains a statically verified, manual, exact-revision protected-staging path for a later separately authorized journey. The local runner generated a fresh portfolio through the compiled CLI, verified installed state, inference, diagnostics, exact diff, frozen install, dependency audit and signatures, lint, Cloudflare types, typecheck, Next/OpenNext builds, and development/preview browser behavior at evidence revision `ef845b1e0551d3b43e17969cc00f21960c90769b`.

The prepared workflow is manual-only, requires exact `main`/input/checked-out SHA agreement, uses a dedicated GitHub environment and Worker name, isolates the four declared secrets to two exact step-level environment boundaries, and uploads only four bounded JSON receipts. Its certification-only Playwright fixture drives the generated browser error listener and requires no cookie or referrer header. The post-secret deployment receipt binds the checked Git revision to the unique latest Cloudflare deployment and full-traffic version identifiers without treating either provider identifier as a Git SHA. The provider template requires custom-event `release_id` to equal the captured Cloudflare version identifier.

This is preparation, not certification. `observability@0.2.0` remains `pending` with only its reviewed `fresh-scaffold` evidence. `deployed-application` and `cleanup-recovery` are absent. No workflow was dispatched, no provider or secret was mutated, no telemetry was transmitted, no cleanup was performed, and no certification registry status changed.

## Changed files

The implementation comparison modifies or adds these 24 files:

- `.github/workflows/production-observability-certification.yml`
- `README.md`
- `certifications/capabilities.json`
- `docs/architecture/capability-model.md`
- `docs/architecture/enforcement-map.md`
- `docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md`
- `docs/implementation-evidence/2026-08-11-production-observability-certification-verification.md`
- `docs/implementation-evidence/production-observability-provider-receipt-template.md`
- `docs/roadmaps/program-roadmap.md`
- `docs/superpowers/plans/2026-08-10-production-observability-certification.md`
- `package.json`
- `packages/builder-core/README.md`
- `packages/builder-core/tests/certification.test.mjs`
- `scripts/certify-booking-calendly.mjs`
- `scripts/certify-production-observability.mjs`
- `scripts/create-cloudflare-deployment-receipt.mjs`
- `scripts/exercise-production-observability.mjs`
- `scripts/lib/certify-fresh-scaffold.mjs`
- `tests/capability-certification/certification-runner.test.mjs`
- `tests/capability-certification/fixtures/observability-browser-error.spec.ts`
- `tests/capability-certification/fixtures/observability-error-route.ts`
- `tests/capability-certification/production-observability.test.mjs`
- `tests/constitution/constitution.test.mjs`
- `tests/package-boundaries/release-safeguards.test.mjs`

This enclosing review-record commit adds this packet and updates only the existing implementation plan. The tracked empty Changeset `.changeset/clarify-observability-boundary.md` predates the comparison, remains the exact eight-byte no-release marker, and was not modified.

## Commits

The implementation comparison before this enclosing review record contains 16 commits:

- `c15dd42` — Plan observability capability certification
- `2ad2709` — Verify fresh observability scaffold
- `f890a81` — Protect fresh scaffold test ownership
- `32c12a3` — Align observability verifier identity
- `ef845b1` — Align observability scaffold verification
- `fe7773c` — Record local observability evidence
- `cdff0dd` — Amend observability status ownership
- `b14acc1` — Correct observability certification status
- `2334f26` — Prepare observability staging certification
- `3ca115d` — Bound observability receipt and cleanup evidence
- `3bbe4a0` — Document observability certification path
- `3bb2a38` — Reconcile observability release evidence
- `5273cc3` — Complete observability certification safeguards
- `69deb17` — Bind observability staging evidence
- `5a3a0ad` — Reject alternate observability secret syntax
- `2987b8f` — Align observability certification fixture

## Test-driven and repair evidence

- The fresh-scaffold runner began with missing-runner RED tests, then reached GREEN through the shared private harness. The first real journey exposed a canonical portfolio identity mismatch; a pre-recorded amendment added the wrong-identity RED case, and the corrected journey passed at `ef845b1` without changing the fixed verifier.
- Registry evidence began with an expected missing-evidence RED result. The minimum subject-bound `fresh-scaffold` receipt and pending record then passed admission while both closure policies continued to reject.
- The staging exercise, workflow, route fixture, and receipt template began as missing-artifact RED contracts. Their implementation kept direct Node posts as route-envelope evidence and later added a deployed browser-instrumentation fixture as separate evidence.
- Reviewer repairs were TDD-bounded: the human prerequisite runbook, recursive secret-scope mutations, browser instrumentation, Cloudflare deployment receipt, complete custom-event inventory, and post-cleanup route unreachability each failed a focused contract before repair.
- The final test recheck found that valid bracket, bare, and dynamic `secrets` context expressions bypassed the dot-only matcher. The focused RED run passed the prior six scope mutations and failed all three alternate-syntax mutations. After the fail-closed repair, all nine mutation subtests passed; the same reviewer approved the exact repair.
- The first settled builder-kernel run exposed one stale builder-core expected fixture at 135/136: it expected no observability evidence despite the earlier reviewed registry entry. The already-failing test was the RED case; reconciling only its literal expected record produced focused 1/1 and full builder-core 136/136 GREEN without changing registry state.

## Final verification

Every Node/pnpm command below used `rtk env CI=true PATH=/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin:/Users/CoveMB/.volta/tools/image/node/22.23.2/bin:$PATH` followed by the shown command.

- `pnpm run verify:builder-kernel`: passed on the clean `2987b8f` tree with read-only registry access. Constitution passed 47/47 including nine secret-scope mutations and documentation links; package boundaries 45/45; builder-core 136/136; CLI 10/10; capability certification 20/20; admission accepted seven records; generated fixtures 8/8 with 43/48/45 byte-stable files; builder lint/build/typecheck passed; fixed-root `portfolio`, `portfolio-calendly`, and `site` verification passed frozen install, peer checks, moderate audit, registry signatures, lint, Cloudflare types, typecheck, Next/OpenNext builds, browser installation, development browser tests, and preview browser tests. Changeset status reported no package bump.
- `pnpm run test:packages`: passed standards 33/33 and observability 23/23.
- `pnpm run check:semantic-naming`: passed with no findings.
- `node scripts/check-capability-certification.mjs --closure legacy-backfill-exempt`: exited 1 and rejected only observability as `pending`, the required stop.
- `node scripts/check-capability-certification.mjs --closure all-certified`: exited 1 and rejected observability as `pending` plus the five unchanged legacy records as `backfill-pending`, the required full-closure stop.
- `pnpm audit --audit-level=moderate`: exited 0 with no known vulnerabilities for the exact locked graph. This is point-in-time advisory evidence only.
- `pnpm audit signatures`: exited 0 with 885 installed packages having verified registry signatures.
- `git diff --check fb3af7fef7602764432f16940abff0ffc65a5b67..2987b8f82005e98eddfe25b417e5c6c8ae5b184a`: passed.
- Exact Git checks confirmed branch `observability-certification`, clean status, base merge point `fb3af7fef7602764432f16940abff0ffc65a5b67`, and final `0 17` divergence including this review record. Neither the current HEAD nor any Task 6B commit is contained by a local remote-tracking branch.

The first sandboxed aggregate attempt was setup-invalid in generated-fixture lockfile preparation: its isolated registry lookup failed with `ENOTFOUND` and surfaced the intentionally sanitized `LOCKFILE_PREPARATION_FAILED/source-changed`. A direct sandboxed read-only package lookup reproduced `ENOTFOUND`; the permitted registry lookup returned published version `0.2.0`. The identical full aggregate then passed with registry access. No source repair was made for the sandbox DNS failure.

The unchanged real local fresh-scaffold journey was not repeated, as required by the plan. No live workflow, deployed browser, provider UI/API, telemetry, retention, quota, spend, or cleanup check ran.

## Reviewer dispositions

- **Requirements:** retained missing human-prerequisite/cleanup instructions and browser-reporter bypass. The ordered 11-step runbook and deployed instrumentation fixture repaired both. Recheck approved both repairs with 51/51 focused contracts passing.
- **Architecture and anti-overengineering:** reported no material findings on the exact reviewed range. The prepared path retains explicit Cloudflare composition boundaries, the existing narrow provider-neutral package API, and no new product abstraction or provider resource.
- **Test evidence:** retained the browser-reporter bypass and incomplete secret-scope enumeration. It approved the browser repair, then found alternate GitHub bracket/bare/dynamic secret syntax still bypassed the guard. The final fail-closed repair passed 11/11 focused checks and the reviewer approved it with no Critical or Important regression.
- **Security and privacy:** retained the missing security runbook, incorrect Git-SHA interpretation of `release_id`, absent final Cloudflare deployment/version binding, and browser privacy-path bypass. The final workflow, bounded sanitizer/receipt, provider template, runbook, and browser fixture repaired them. Recheck approved all three finding groups; focused capability, constitution, and browser-fixture checks passed.
- Earlier bounded Task 4 and Task 5 reviews found incomplete custom-event inventory, missing route-unreachability cleanup evidence, stale execution wording, and the intentional empty Changeset mismatch. Each was repaired and rechecked before the final independent review.

No unsupported or preference-only finding caused code churn. No Critical finding remained.

## Risks, deferred work, and claim limits

- The prepared GitHub workflow has never run. Actual GitHub environment protection, secret availability, OpenNext deployment, Wrangler deployment-list JSON, deployed Playwright behavior, Cloudflare version identity, provider delivery, retention, quota, cost, and cleanup remain unexecuted.
- The workflow is not available on the default branch because Task 6 and Task 6B remain local and unpushed. Local `main` and the unrefreshed `origin/main` tracking ref remain at `717c3bb0f048f4a4bc544100125ae42d818f09bc`; remote freshness was not required for this local-only increment.
- A later external journey needs separate approvals for integration, push, environment/variable setup, provider source selection, each credential, dispatch, deployment, telemetry, provider inspection, cleanup, evidence acceptance, and any registry transition. One approval never authorizes the next.
- Cloudflare platform/framework error and exception records are separate from the bounded custom schema. Live inspection must inventory them independently and stop on unexpected private or real content.
- `waitUntil()` delivery remains best-effort and non-durable. No queue, Tail Worker, database, analytics, identity, payment, or jobs application was added.
- The fresh root audit and signatures are point-in-time supply-chain evidence, not proof against unknown or future vulnerabilities.
- Automated tests do not establish production readiness, performance, visual approval, human or assistive-technology usability, accessibility conformance, security completeness, ongoing provider availability, or WCAG conformance.
- P2 launch-scope approval, retained real-client migration evidence, and Task 6B live certification remain separate later gates.

## Rollback and recovery

**Source and evidence:** revert the Task 6B commits newest-first with focused revert commits, then rerun constitution, package boundaries, builder-core, CLI, certification/admission/closure, semantic naming, public-package, and builder-kernel verification. Revert the enclosing review-record commit separately if this packet and plan closure must be withdrawn. Do not reset or rewrite shared history.

**Deployment:** no deployment occurred, so there is no current deployment rollback. A later authorized run must separately delete the dedicated Worker or deploy a reviewed clean replacement and verify the certification-only route is unreachable; source rollback alone cannot do this.

**Credentials and GitHub configuration:** no credential was created, read, stored, or used and no environment, variable, or secret was configured in this increment. After a later run, environment-secret removal and Cloudflare/Better Stack token revocation or rotation require separate explicit authority and evidence; reverting source cannot revoke them.

**Provider and retained data:** no Better Stack source or Cloudflare provider record was created or changed, and no telemetry was transmitted, so there is no current provider/data cleanup. A later run must separately record source disposition, retained-data deletion or approved retention, platform-log disposition, quota/cost final state, and final owner. Source rollback cannot delete provider data.

**Certification registry:** the record remains `pending` with one reviewed local `fresh-scaffold` entry. No rollback is needed to preserve the current truthful status. Removing that local evidence later requires a separately reviewed source/evidence revert and fresh admission/closure verification; it must not be conflated with provider cleanup.

## Current official-document basis

The dated preparation evidence retains the exact primary links and claim limits for Cloudflare Workers Logs, Context, secrets, Wrangler deployments, GitHub Actions/environments/contexts, OpenNext, Next.js instrumentation, Playwright request inspection, Better Stack ingestion/source/pricing/deletion, Node, pnpm audit/signatures, Changesets, and current security advisories. External documentation supported the design and review; it did not authorize or prove execution.

## Stop gate

Stop for explicit user approval of the exact final Task 6B diff and this review record. Approval accepts only the verified local diff. It does not authorize merge, push, pull-request creation, workflow dispatch, GitHub environment or secret mutation, Cloudflare or Better Stack access, deployment, telemetry transmission, provider inspection, spending, cleanup, certification-state transition, package publication, production action, launch, or a later roadmap task.
