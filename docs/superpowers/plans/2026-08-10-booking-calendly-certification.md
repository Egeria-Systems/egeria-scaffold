# Booking Calendly Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the smallest reusable capability-certification foundation, exercise `booking-calendly` from actual compiled-CLI fresh output, and prepare its protected-staging/provider journey without claiming or performing unapproved external outcomes.

**Architecture:** Builder-core owns a private strict certification-registry contract and pure admission/closure decisions. A record's immutable subject combines the exact descriptor version with a canonical SHA-256 digest of the descriptor and ordered evidence requirements. The repository registry explicitly freezes six accepted pre-foundation descriptors as `backfill-pending` and links the ordinary `booking-calendly` pending record to this separate plan. A root shell script loads the checked registry and catalog for admission or closure. A content-safe runner generates a temporary portfolio through the compiled CLI, re-infers and diagnoses it, proves exact diff/state agreement, then reuses the existing fixed-root verifier against that actual output. A manual, pinned, exact-revision workflow reuses the protected `compatibility` environment for separately authorized deployment; provider booking and cleanup remain human evidence.

**Toolchain:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, Zod `4.4.3`, YAML `2.9.0`, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, Playwright `1.62.1`, axe Playwright `4.12.1`, Chromium, Node test runner, GitHub Actions, Cloudflare Workers, and Calendly Free or higher.

## Global constraints

- Work on clean sequential local `main` frozen at planning base `542660b5a3d25709ade6d8536c8c65bd1e6b6038`; do not touch separate worktrees.
- Keep exactly seven executable descriptors. Do not change any descriptor, profile recipe, generated fixture byte, generated client contract, `.egeria` project/state schema, or capability version unless a focused TDD result proves it is directly required.
- Keep certification data private to builder-core and the repository. Do not extract a public package or add a third-party dependency.
- Bind subjects to both the descriptor and required-evidence contract. Do not let registry presence, a task link, local output, or `backfill-pending` imply certification.
- Restrict `backfill-pending` to the six exact descriptors accepted before this foundation. New/materially changed descriptors require ordinary task-linked pending records.
- Keep descriptor admission and phase/release closure as distinct rejecting gates. Admission becomes part of the builder candidate; closure remains explicit and is expected to reject while Calendly is pending.
- Exercise only initial scaffolding. Do not add existing-repository add/remove/migrate/recover CLI behavior; that belongs to P3.
- Reuse the exact generated-project verifier. Do not create a second install/build/browser command matrix or infer transitive runtime evidence from static tests.
- Emit only content-safe certification output. Never print Calendly invitee data, provider confirmations, GitHub secrets, Cloudflare tokens, cookies, private URLs, or temporary environment contents.
- Treat browser/axe automation as bounded application evidence. Do not claim Calendly provider behavior, visual quality, human accessibility, production readiness, or WCAG conformance.
- Do not dispatch a workflow, deploy, create/change a GitHub environment or secret, create/change a Calendly event, book/cancel a meeting, delete a Worker, spend money, or perform another external mutation without a new explicit authorization.
- Before each commit, verify branch/status, stage only intended paths, inspect the cached diff, and run `git diff --cached --check`.
- No push, pull request, merge, publication, external message, review-comment response, permission change, production action, or verified-final-diff approval is authorized.

## Exact file structure

Create certification contracts, registry, commands, workflow, tests, and evidence:

```text
packages/builder-core/src/contracts/certification.ts
packages/builder-core/src/certification/capability-certification.ts
packages/builder-core/schemas/certification-registry.schema.json
certifications/capabilities.json
scripts/check-capability-certification.mjs
scripts/certify-booking-calendly.mjs
tests/capability-certification/certification-runner.test.mjs
.github/workflows/booking-calendly-certification.yml
docs/implementation-evidence/booking-calendly-provider-receipt-template.md
docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md
docs/implementation-evidence/2026-08-10-booking-calendly-certification-verification.md
docs/implementation-evidence/2026-08-10-booking-calendly-certification-review-packet.md
docs/superpowers/plans/2026-08-10-booking-calendly-certification.md
```

Modify the private contract boundary, fixed-root verifier, test inventories, scripts, and direct canonical consumers:

```text
packages/builder-core/src/contracts/json-schemas.ts
packages/builder-core/src/index.ts
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/certification.test.mjs
packages/builder-core/AGENTS.md
packages/builder-core/README.md
scripts/verify-generated-skeletons.mjs
tests/generated-fixtures/verification-script.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/constitution/constitution.test.mjs
package.json
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/governance/review-and-contribution.md
docs/roadmaps/program-roadmap.md
```

No other file is in scope without a documented preapproved amendment. In particular, do not modify generated templates, retained generated fixtures, application code, CLI arguments/commands, profile recipes, capability descriptors, action versions, dependency manifests, lockfiles, changesets, or prior evidence packets.

## Task 1: Freeze Gate 1 evidence and exact Gate 2 plan

- [ ] Record repository identity, canonical sources, current provider/tool documentation, security/advisory checks, exact baseline, existing environment boundary, human prerequisites, consolidated uncertainty, and claim limits.
- [ ] Record this exact-file plan and self-review it against the source plan, semantic-naming contract, approved stage, and external-action boundary.
- [ ] Run documentation links/contracts, semantic naming, and `git diff --check`.
- [ ] Commit only preparation and plan with message `Plan Calendly capability certification`.

## Task 2: Add the strict registry and two rejecting gates

**RED files:** `packages/builder-core/tests/contracts.test.mjs`, new `packages/builder-core/tests/certification.test.mjs`, and exact inventory assertions in `tests/package-boundaries/private-packages.test.mjs`.

- [ ] Read `superpowers:test-driven-development/writing-good-tests.md` before the first cycle.
- [ ] Add focused failing tests for strict registry parsing; duplicate/extra/missing records; descriptor version drift; evidence-requirement drift; digest drift; absent/invalid task links; bounded legacy identifiers; pending/certified evidence semantics; content-safe deterministic issues; and distinct admission/closure outcomes.
- [ ] Run only the focused tests and capture the expected missing exports/schema/source inventory failures before production edits.
- [ ] Implement strict Zod schemas and types in `contracts/certification.ts`. Use semantic identifiers, safe relative evidence/plan paths, lowercase `sha256:` fingerprints, unique sorted evidence requirements, unique records, and no unknown keys.
- [ ] Implement pure `createCertificationSubject`, `validateCertificationAdmission`, and `validateCertificationClosure` functions. Hash canonical `{ descriptor, requiredEvidence }`; retain the exact six transitional identifiers in a frozen allowlist; return stable value-free issue codes and paths.
- [ ] Export the boundary, add the checked Draft 2020-12 registry schema, and update exact private source/schema inventories.
- [ ] Create `certifications/capabilities.json` with all seven exact catalog identifiers. Give each record its current descriptor version/digest. Mark the six frozen identifiers `backfill-pending`; mark `booking-calendly` `pending`, require fresh-scaffold/deployed-application/provider-confirmed/cleanup-recovery evidence, and link this exact plan.
- [ ] Add `check-capability-certification.mjs`: default admission mode must pass the committed registry; `--closure legacy-backfill-exempt` must reject the pending Calendly record; `--closure all-certified` must reject every non-certified record. Keep output bounded JSON and distinguish contract/admission/closure failure.
- [ ] Add root scripts and wire only admission plus static certification tests into `verify:builder-kernel`.
- [ ] Run contract, certification, schema, package-boundary, semantic-naming, and admission checks GREEN; run both closure modes and record their expected rejecting exits.
- [ ] Commit with message `Add capability certification gates`.

## Task 3: Certify an actual fresh scaffold locally

**RED files:** new `tests/capability-certification/certification-runner.test.mjs` and `tests/generated-fixtures/verification-script.test.mjs`.

- [ ] Add focused failing adapter tests proving exact compiled-CLI create/infer/doctor/diff order; fixed `portfolio`/`popup` synthetic selection; absent mode-0700 destination; installed/inferred `booking-calendly@0.1.0`; healthy diagnostics; empty exact diff; `.egeria` agreement; content-safe output; bounded failures; source immutability; identity-checked cleanup; and reuse of the existing check list against the actual generated root.
- [ ] Add failing verifier tests for one caller-supplied generated root and exact known fixture contract, including invalid identifiers/roots and unchanged source snapshots.
- [ ] Run the focused tests and capture the expected missing runner/single-root verifier failures.
- [ ] Refactor `scripts/verify-generated-skeletons.mjs` only enough to share its source-validation/copy/check/cleanup path between the three committed fixtures and one caller-supplied generated root. Preserve every existing check name, command, environment allowlist, timeout, source-identity check, and aggregate output.
- [ ] Implement `certify-booking-calendly.mjs` with injected adapters for unit tests and real defaults for execution. Create one identity-bound mode-0700 owner; call the built CLI with fixed semantic project identity and supplied or default synthetic Calendly URL; validate each one-line JSON result without echoing the URL; run single-root verification; emit a bounded JSON receipt containing only capability/version/profile/mode/check names; and remove the owner on success or failure.
- [ ] Add `verify:booking-calendly-certification` to build the private CLI/core first and execute the real runner. Do not retain the generated temporary project as migration evidence; P2's later real-client retention gate is separate.
- [ ] Run focused runner/verifier tests GREEN, then run the real local certification once with approved registry access. Add its content-safe `fresh-scaffold` evidence path to the pending registry record without changing its subject or status.
- [ ] Commit with message `Verify fresh Calendly scaffold`.

## Task 4: Prepare protected staging and provider evidence without executing it

**RED files:** `tests/constitution/constitution.test.mjs` and `tests/capability-certification/certification-runner.test.mjs`.

- [ ] Add focused failing static tests for a manual-only workflow; exact `main` and expected-revision checks; `contents: read`; non-cancelling concurrency; existing `compatibility` environment; pinned checkout/pnpm actions; exact Node/pnpm versions; absent secret interpolation in command arguments; fresh compiled-CLI generation; local certification; dedicated Worker deployment; environment-variable deployed URL; deployed Playwright; bounded artifact retention; and no pull-request/schedule/provider API/delete path.
- [ ] Add a failing contract test for the provider receipt template's required content-safe fields, synthetic-data prohibition, causal provider/app/cleanup assertions, and explicit non-conformance language.
- [ ] Implement `.github/workflows/booking-calendly-certification.yml` as manual dispatch only. Require `expected_revision` and `calendly_url`; validate the revision before credentials are exposed; generate a constant dedicated project in the runner temporary directory; run admission and local certification; deploy through OpenNext/Wrangler using environment secrets; and run deployed browser checks against an environment URL variable. Do not automate provider booking or cleanup.
- [ ] Add the human receipt template with exact workflow/Git/provider/app/cancellation/event-type/Worker-cleanup fields and prohibited private content. Link the preparation runbook rather than duplicating setup rules.
- [ ] Run workflow/constitution/certification static tests, action-pin checks, semantic naming, and documentation contracts GREEN. Do not dispatch.
- [ ] Commit with message `Prepare Calendly staging certification`.

## Task 5: Reconcile direct canonical documentation

- [ ] Update builder-core ownership documentation for the private registry/schema/gates and runner boundary.
- [ ] Update architecture overview/capability model/enforcement map with actual descriptor admission, pending current closure, bounded backfill transition, actual local fresh-scaffold runner, and still-unexecuted protected-staging/provider outcome.
- [ ] Update the review protocol only with precise links/commands needed to consume the now-actual registry and gates; do not duplicate schemas or the whole workflow.
- [ ] Update the program roadmap to mark the local foundation implemented and `booking-calendly` still pending external certification. Do not mark Task 5B or P2 complete.
- [ ] Run documentation, semantic naming, contract, and package-boundary checks GREEN.
- [ ] Commit with message `Document capability certification foundation`.

## Task 6: Independent review and bounded repair

**Comparison:** planning base `542660b5a3d25709ade6d8536c8c65bd1e6b6038..HEAD` plus current uncommitted final evidence.

- [ ] Dispatch one read-only requirements reviewer for exact certification acceptance, local/protected/provider separation, prerequisite completeness, registry/gate semantics, external authority, and claim boundaries.
- [ ] Dispatch one read-only architecture/anti-overengineering reviewer for canonical ownership, digest design, transition allowlist, managed/application boundaries, runner reuse, content safety, least privilege, and exclusion of P3/general deployment work.
- [ ] Dispatch one read-only test-evidence reviewer for causal RED/GREEN evidence, admission/closure rejection, actual compiled-CLI fresh output, `.egeria`/inference/diff proof, fixed-root runtime/browser reuse, workflow static evidence, and unsupported claims.
- [ ] Give each reviewer an exact non-overlapping role and scope, prohibit edits and recursive fan-out, wait for every result, and validate every finding against the current tree.
- [ ] For each material validated defect, add a focused failing regression test, implement the minimum repair, rerun affected checks, and record disposition. Do not change code for unsupported or preference-only findings.
- [ ] Commit evidence-backed repairs, if any, with a message naming the actual correction.

## Task 7: Final verification, review packet, and external stop gate

- [ ] Run `git diff --check`, semantic naming, documentation/constitution, package boundaries, builder-core, CLI, certification static tests, admission, generated-fixture tests, builder lint/build/typecheck, root audit/signatures, real local Calendly certification, fixed-root full generated verification, and changeset status on the settled tree.
- [ ] Do not repeat an unchanged successful expensive check. Record exact command, exit, relevant count, duration where material, and bounded claim for each result.
- [ ] Run both closure policies and record their expected rejecting exits while Calendly/backfill records remain non-certified.
- [ ] Verify branch/status, exact comparison, changed-file inventory, ignored/untracked artifacts, and no changes in separate worktrees.
- [ ] Record exact registry subjects/statuses, local receipt, workflow non-execution, provider prerequisites, reviewer dispositions, risks, deferred provider proof, source rollback, Worker rollback/deletion, provider cancellation/event cleanup, and no-conformance boundary.
- [ ] Create the review packet for exact committed comparison `542660b5a3d25709ade6d8536c8c65bd1e6b6038..HEAD`.
- [ ] Commit final evidence with message `Record Calendly certification review`.
- [ ] Re-run only final-tree identity/status and documentation/semantic checks affected by the evidence commit.
- [ ] Stop for the user's explicit implemented-task review. Do not dispatch the workflow or begin a later P2 outcome.
