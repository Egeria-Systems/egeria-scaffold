# Booking Calendly Certification Review Packet

**Date:** 2026-08-10 (America/Toronto)

**Status:** Implemented task ready for explicit user review; capability and P2 remain open

**Frozen planning base:** `542660b5a3d25709ade6d8536c8c65bd1e6b6038`

**Reviewed implementation tip:** `60d51cd1da28eb53c1eae7c7c12ee3dc3637bb24`

**Implementation comparison:** `542660b5a3d25709ade6d8536c8c65bd1e6b6038..60d51cd1da28eb53c1eae7c7c12ee3dc3637bb24`

**Remote-freshness boundary:** Local `origin/main` remained at the frozen planning base. No fetch or external Git action was required for this local implementation review.

## Outcome

P2 Task 5B now has a private capability-certification registry and gate, an actual compiled-CLI fresh-scaffold journey, a prepared manual protected-staging workflow, a content-safe provider receipt contract, and canonical lifecycle documentation. The gate fails closed for stale subjects, unauthorized legacy status, missing or relabeled evidence, evidence revisions outside the checked candidate's ancestry, incomplete receipts, unresolved prompt fields, negative overall review, and missing per-outcome affirmative review.

The actual local `booking-calendly@0.1.0` journey passed on the settled tree. It created a temporary `portfolio` project through the compiled CLI, re-inferred it, required healthy diagnostics and an empty exact diff, then reused the fixed generated-project verifier for installation, audit, registry signatures, builds, and local Chromium behavior. The identity-bound temporary project was removed.

This does not certify the capability. `booking-calendly` remains `pending` with only `fresh-scaffold` evidence. The protected workflow was not dispatched; no Worker, Calendly record, credential, secret, provider resource, cost, or persistent client state was created, read, changed, or deleted.

## Commits

- `08d6c93` — Plan Calendly capability certification
- `51c6505` — Add capability certification gates
- `636df53` — Verify fresh Calendly scaffold
- `47ba782` — Prepare Calendly staging certification
- `d102921` — Document capability certification foundation
- `c43973e` — Bind capability certification evidence
- `0331699` — Correct Calendly certification preflight
- `60d51cd` — Verify certification receipt identity

## Changed files

Added:

- `.github/workflows/booking-calendly-certification.yml`
- `certifications/capabilities.json`
- `docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md`
- `docs/implementation-evidence/2026-08-10-booking-calendly-certification-verification.md`
- `docs/implementation-evidence/booking-calendly-provider-receipt-template.md`
- `docs/superpowers/plans/2026-08-10-booking-calendly-certification.md`
- `packages/builder-core/schemas/certification-registry.schema.json`
- `packages/builder-core/src/certification/capability-certification.ts`
- `packages/builder-core/src/contracts/certification.ts`
- `packages/builder-core/tests/certification.test.mjs`
- `scripts/certify-booking-calendly.mjs`
- `scripts/check-capability-certification.mjs`
- `tests/capability-certification/certification-runner.test.mjs`

Modified:

- `docs/architecture/capability-model.md`
- `docs/architecture/enforcement-map.md`
- `docs/architecture/overview.md`
- `docs/governance/review-and-contribution.md`
- `docs/roadmaps/program-roadmap.md`
- `package.json`
- `packages/builder-core/AGENTS.md`
- `packages/builder-core/README.md`
- `packages/builder-core/src/contracts/json-schemas.ts`
- `packages/builder-core/src/index.ts`
- `packages/builder-core/tests/contracts.test.mjs`
- `scripts/verify-generated-skeletons.mjs`
- `tests/constitution/constitution.test.mjs`
- `tests/generated-fixtures/verification-script.test.mjs`
- `tests/package-boundaries/private-packages.test.mjs`

No capability descriptor, profile recipe, generated template, retained fixture byte, `.egeria` project/state contract, dependency manifest, lockfile, action pin, application source, CLI command, or capability version changed.

## Verification

All commands used Node.js `22.23.2` and pnpm `11.20.0` through Volta.

- Focused TDD RED: builder-core mutation tests initially accepted a nonexistent 40-character revision and incomplete/rejected/unresolved receipts; the manual workflow test initially rejected the missing full-history checkout. These were the expected failures.
- `pnpm run test:builder-core`: passed 129/129 after repair.
- `pnpm run test:constitution`: passed 27/27 after repair.
- `pnpm run test:capability-certification`: passed 5/5 after repair.
- `pnpm run check:capability-certification`: passed admission with seven records.
- `pnpm run verify:builder-kernel`: constitution, package-boundary, builder-core, CLI, certification, admission, and earlier generated-fixture contract checks passed. Its first registry-dependent generated lockfile preparation stopped with the stable wrapper `LOCKFILE_PREPARATION_FAILED/source-changed` because the default sandbox could not complete the public-registry request; the repository remained clean.
- `pnpm run test:generated-fixtures`, rerun with public-registry access on the unchanged tree: passed 8/8 in 330 seconds, including 36 portfolio, 41 portfolio-with-Calendly, and 38 site byte-stable files. This isolated rerun established that the preceding stop was environmental rather than source drift.
- The unexecuted remainder of the candidate command was resumed without repeating successful checks: `lint:builder`, `build:builder`, `typecheck:builder`, `verify:generated-skeletons`, and `changeset:status` all passed.
- `verify:generated-skeletons` passed for `portfolio`, `portfolio-calendly`, and `site` with `pnpm-version`, frozen install, peer compatibility, dependency audit, registry signatures, lint, typecheck, Next build, OpenNext build, Chromium installation, development browser behavior, and OpenNext/workerd preview browser behavior.
- `changeset:status` preserved the pre-existing minor intent for `@egeria-systems/standards`; this task added no changeset or public-package change.
- `pnpm run verify:booking-calendly-certification`: passed with compiled CLI create, state inference, healthy diagnostics, exact diff, and the same fixed generated-project checks.
- `git diff --check`: passed before the repair commit.

The complete local certification receipt was:

```json
{"ok":true,"capability":"booking-calendly","version":"0.1.0","profile":"portfolio","mode":"popup","checks":["compiled-cli-create","state-inference","healthy-diagnostics","exact-diff","pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

The transition closure command rejected only `booking-calendly` as `pending`. The all-certified command rejected `booking-calendly` as `pending` and the six accepted legacy records as `backfill-pending`. Those rejecting exits are the required stop behavior, not failed implementation verification.

## Registry state

- `booking-calendly@0.1.0`: `pending`; subject digest `sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab`; only `fresh-scaffold` passed and reviewed at producing revision `636df53958c0e3421b7f493d83493724b67b41f3`.
- `content-files`, `deployment-cloudflare`, `observability`, `section-composition`, `site-routing`, and `standards`: `backfill-pending` only for their frozen accepted identifier/version/digest subjects.
- No record is `certified`.

## Independent review dispositions

Requirements review found three material gaps: the prepared preflight named a Worker different from the generated deployment target; the same local evidence document could be relabeled for external outcomes; and the human prerequisite runbook lacked exact roles, permission, polling, quota/spend, retention, credential-disposition, and rerun controls. The generated target is now causally fixed to `acme-portfolio-calendly`; artifact metadata prevents outcome relabeling; and the preparation, plan, workflow, and receipt now carry the bounded human controls. Focused checks passed.

Architecture and anti-overengineering review found that the legacy transition was frozen only by identifier and confirmed the Worker-name mismatch. The transition now accepts only the six exact identifier/version/digest subjects, and the Worker binding is corrected without changing templates or adding a deployment framework. Focused checks passed.

Test-evidence review found that a syntactically valid but nonexistent revision and an incomplete or negatively reviewed receipt could still pass artifact validation. TDD repair added commit/ancestor validation, full-history checkout, completed/no-prompt/accepted/per-outcome metadata, and mutation tests. The same reviewer then rechecked the settled repair read-only, ran 33 focused checks plus live admission, and reported: “No material improvements recommended.”

No specialist review was needed: the provider workflow was not executed, no credential was used, and no new runtime/provider integration behavior was introduced.

## Risks and unsupported claims

- Hosted runner behavior, protected-environment approval, real deployment, deployed-browser behavior, Worker rollback/deletion, real Calendly rendering, provider-side booking confirmation, cancellation, and cleanup remain unexecuted.
- The manual workflow and provider receipt are static prepared paths. They require separate external authorization and the exact human roles and controls in the preparation runbook.
- The local browser suites stub and fail-close the provider origin. They do not prove Calendly availability or provider behavior.
- Automated axe checks do not establish visual quality, human usability, assistive-technology compatibility, accessibility conformance, production readiness, or WCAG conformance.
- The official documentation and advisory evidence is dated 2026-08-10. It must be refreshed if an external execution occurs later or if a named tool/provider contract changes.
- The local remote-tracking ref was not refreshed. This packet certifies the exact local comparison only.

## Deferred work and recovery

The separately authorized external journey must perform the exact preflight, protected deployment, one synthetic booking, bounded provider confirmation, cancellation, Worker rollback/removal, provider cleanup, credential disposition, and implemented-task review in the preparation runbook. Only a completed content-safe receipt whose evidence revision belongs to the checked candidate history may support the three missing outcomes and a separately reviewed registry change from `pending` to `certified`.

Source rollback is ordinary Git reversion of the eight focused implementation commits in reverse order, subject to a separately reviewed rollback diff. No generated client repository or `.egeria` state requires recovery because the local generated roots were temporary and removed. No provider or Worker recovery is currently required because nothing external was executed. If a later authorized journey runs, source rollback remains separate from Worker rollback/deletion and Calendly cancellation/event-type/calendar cleanup.

All listed secondary worktrees were rechecked read-only and remained clean. The primary worktree was clean at the reviewed implementation tip. No push, pull request, merge, publication, deployment, provider mutation, external message, review-comment response, production action, permission change, or approval on the user's behalf occurred.

## Stop gate

Stop for the user's explicit review of implemented P2 Task 5B. Approval of this implementation would not dispatch the workflow, certify `booking-calendly`, approve the missing external journey, close P2, authorize launch scope, or begin another increment.
