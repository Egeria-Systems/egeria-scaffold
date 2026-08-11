# Booking Calendly Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the smallest reusable capability-certification foundation, exercise `booking-calendly` from actual compiled-CLI fresh output, and prepare its protected-staging/provider journey without claiming or performing unapproved external outcomes.

**Architecture:** Builder-core owns a private strict certification-registry contract and pure admission/closure decisions. A record's immutable subject combines the exact descriptor version with a canonical SHA-256 digest of the descriptor and ordered evidence requirements. The repository registry explicitly freezes six accepted pre-foundation subject tuples as `backfill-pending` and links the ordinary `booking-calendly` pending record to this separate plan. A root shell script loads the checked registry, catalog, task plan, and subject/revision/outcome-bound evidence artifacts for admission or closure. It accepts evidence only when the producing revision is an ancestor commit of the checked candidate and the machine-readable receipt is complete, has no unresolved prompt fields, and affirmatively reviews the recorded outcome. A content-safe runner generates a temporary portfolio through the compiled CLI, re-infers and diagnoses it, proves exact diff/state agreement, then reuses the existing fixed-root verifier against that actual output. A manual, pinned, exact-revision workflow uses full Git history and reuses the protected `compatibility` environment for separately authorized deployment; provider booking and cleanup remain human evidence.

**Toolchain:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, Zod `4.4.3`, YAML `2.9.0`, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, Playwright `1.62.1`, axe Playwright `4.12.1`, Chromium, Node test runner, GitHub Actions, Cloudflare Workers, and Calendly Free-compatible behavior.

## Current reusable-deployment amendment

The original plan and completed receipt retain the environment and dedicated Worker identities actually used on 2026-08-10. Any future workflow execution follows the [shared test deployment policy](../../governance/shared-test-deployment.md): protected environment `test-deploy`, public variable `DEPLOY_URL`, explicit Worker target `test-deploy`, one cross-workflow serialized lease, and clean-compatibility-baseline recovery. The capability-specific generated candidate remains `acme-portfolio-calendly` and must not be mistaken for the deployed Worker identity.

This reuse is valid only for the same stateless non-production account, protection, credential, quota, no-spend, and cleanup boundary. It does not authorize another dispatch or provider journey, does not rewrite completed Calendly evidence, and does not make the shared resource suitable for persistent, production, or differently privileged certifications. Deletion of legacy environments is a separate external checkpoint after a reference and evidence audit.

## Approved sole-developer execution amendment

**Approval date:** 2026-08-10 (America/Toronto)

The user confirmed that `CoveMB` is the repository's sole developer and sole eligible human reviewer, accepted the resulting sole-developer risk exception, and authorized this exact runbook amendment plus designation of the existing free Calendly event type without a paid upgrade. The account is currently in a free trial, but the trial grants no certification authority: the journey must use only behavior documented for Calendly Free and remain usable after the trial expires without payment. The existing public `30 Minute Meeting` one-on-one event is designated for the bounded certification journey; its URL remains a workflow input and is not committed. Designation is the only authorized event-type action; this amendment creates, changes, disables, or deletes no Calendly event type.

The independent implementation reviews required by repository governance remain read-only agent reviews. They are distinct from GitHub's human environment-approval feature. There is no independent human deployment review or approval. The protected-staging execution records `CoveMB` separately in every role actually performed: GitHub repository administrator, workflow dispatcher, deployment risk owner, Cloudflare account administrator, Calendly certification operator, and implemented-task reviewer. It must not claim that a second person reviewed or approved the deployment.

The `compatibility` environment remains manual-workflow, exact-revision, `main`-branch, least-privilege-secret, one-booking, no-spend, and explicit-checkpoint bounded. Its observed lack of a required reviewer and enabled administrator bypass are accepted limitations for this non-production certification run, not independent-review evidence. The operator must inspect the workflow and exact revision immediately before dispatch and separately authorize dispatch, booking, cancellation, and Worker rollback or deletion.

The Free-compatible provider baseline is exactly one one-on-one event type, one connected calendar, bounded availability, supported video conferencing, and ordinary scheduling. The journey must not depend on trial-only or paid workflows, routing, payments, multiple event types, multiple connected calendars, or premium branding controls. Stop at any upgrade, billing, trial-extension, or paid-feature prompt. Because the designated event type predates this certification journey, cleanup cancels and verifies the single synthetic meeting but preserves the event type. Event-type creation, change, disabling, and deletion are outside this journey.

This amendment adds no workflow behavior and changes no capability, schema, registry, generated source, fixture, dependency, or application runtime. It authorizes only these repository files:

```text
docs/superpowers/plans/2026-08-10-booking-calendly-certification.md
docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md
docs/implementation-evidence/booking-calendly-provider-receipt-template.md
tests/constitution/constitution.test.mjs
docs/review-packets/2026-08-10-booking-calendly-sole-developer-exception.md
```

Implementation uses one focused RED/GREEN contract: first require the preparation, plan, and receipt to declare the truthful sole-operator role assignment, lack of independent human deployment approval, accepted bypass limitation, compensating controls, Free-after-trial baseline, and preservation of a pre-existing designated event; then make only the minimum documentation changes. After focused and full relevant verification, dispatch the required read-only requirements, architecture/anti-overengineering, and test-evidence reviews, record dispositions in the new review packet, and stop for exact-diff approval. Workflow dispatch, deployment, GitHub variable or environment mutation, provider booking, cancellation, and Worker cleanup remain separately gated external actions.

## Live workflow-validation repair amendment

**Approval basis:** The user's preapproved exact-file amendment authority remains in force for evidence-backed defects found before the implemented-task review completes. The user separately authorized creating one dedicated Cloudflare token and replacing the `compatibility` environment's `CLOUDFLARE_API_TOKEN`, while explicitly prohibiting workflow dispatch.

After the approved commits reached remote `main` at `bbfc15a429bd460f6b32a0df39492926232b9963`, GitHub rejected the workflow definition before creating any job. Run `31441374064` reported `.github/workflows/booking-calendly-certification.yml` line 31: `Unrecognized named-value: 'runner'` for the job-level `${{ runner.temp }}` expression. The workflow therefore did not expose credentials, deploy, test, book, or mutate a provider. The root cause is the workflow's use of the step-scoped `runner` context in a job-level `env` expression, which the existing static contract incorrectly required.

This repair is limited to these exact files:

```text
.github/workflows/booking-calendly-certification.yml
tests/constitution/constitution.test.mjs
docs/superpowers/plans/2026-08-10-booking-calendly-certification.md
docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md
docs/review-packets/2026-08-10-booking-calendly-workflow-validation-repair.md
```

Use focused RED/GREEN cycles. First change the real parsed-workflow contract to reject any job-level environment value containing `${{ runner.` and to require the certification root only on the steps that consume it. Verify that the focused test fails against the current invalid workflow. Then remove the job-level environment and set the same `${{ runner.temp }}/booking-calendly-certification/project` value on `Create deployment candidate`, `Prepare deployment candidate`, `Deploy certification Worker`, and `Test deployed application behavior`. Do not change the generated path, command sequence, secret boundary, action versions, deployment URL, capability state, or any provider behavior.

Run the focused constitution test, the full constitution and semantic-naming tests, semantic naming, capability admission, the expected rejecting closure, YAML parsing, and `git diff --check`. Dispatch the required independent read-only requirements, architecture/anti-overengineering, and test-evidence reviews; repair only material findings; create the named repair review packet; and stop for a new exact-diff approval. Do not push or dispatch the workflow.

## Live provider-certification closure amendment

**Approval date:** 2026-08-10 (America/Toronto)

The user separately authorized the live workflow, completed the single synthetic booking as the Calendly certification operator, confirmed provider delivery and the matching meeting, cancelled the meeting, preserved the pre-existing event type, removed the dedicated certification Worker, confirmed cleanup, and explicitly approved changing `booking-calendly` from `pending` to `certified`. The successful hosted evidence is GitHub Actions run `31443784009`, attempt 2, at exact deployed revision `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558`. GitHub reports the retained seven-day artifact digest as `sha256:aafab7d79e3791b90d269fee515ef3d3e6feb9ce09922a538a224d08d731b26e`. A fresh read-only origin check after the user's deletion returned HTTP `404` for the dedicated staging URL. No further provider action is authorized or required by this amendment.

The user preapproved necessary exact-file plan amendments and authorized continuous local implementation through review of the implemented task. This closure amendment therefore proceeds through focused TDD, deterministic verification, independent read-only requirements, architecture/anti-overengineering, and test-evidence review, content-safe evidence, focused commits, and a new final review packet. It still stops for verified-final-diff approval and does not authorize push, pull request, merge, publication, another workflow run, another booking, credential mutation, launch-scope approval, or a later task.

This amendment is limited to these exact files:

```text
certifications/capabilities.json
tests/constitution/constitution.test.mjs
tests/capability-certification/certification-runner.test.mjs
README.md
CONTRIBUTING.md
packages/builder-core/AGENTS.md
packages/builder-core/README.md
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/roadmaps/program-roadmap.md
docs/implementation-evidence/2026-08-10-booking-calendly-certification-verification.md
docs/implementation-evidence/2026-08-10-booking-calendly-provider-receipt.md
docs/superpowers/plans/2026-08-10-booking-calendly-certification.md
docs/review-packets/2026-08-10-booking-calendly-provider-certification.md
```

Use one focused RED/GREEN contract. First update the constitution test to require a complete, privacy-safe, subject/revision/outcome-bound provider receipt; four sorted evidence entries for the certified record; consistent current-status consumers; the successful transition closure; retained six-subject backfill boundary; no WCAG or ongoing-provider claim; and no secret, invitee address, meeting link, or private provider content. Verify the focused test fails against the pending tree. Then add the receipt, change only the actual `booking-calendly` record to `certified`, add the three external evidence outcomes against the deployed revision, and update only current canonical/status consumers. Historical preparation and earlier review packets retain their dated pre-execution claims unchanged.

The first complete-gate run must also exercise the existing command-level closure expectation. If it still encodes the formerly pending registry state, treat that stale expectation as the focused RED state and update it to require successful `legacy-backfill-exempt` closure plus rejection of exactly the six frozen records under `all-certified`; do not change certification runtime behavior.

Run the focused constitution test; builder-core certification tests; full constitution and semantic-naming tests; semantic naming; capability admission; `legacy-backfill-exempt` closure, which must now pass; `all-certified` closure, which must still reject only the six frozen backfill records; exact pinned builder-kernel verification; moderate dependency audit; registry-signature audit; and `git diff --check`. Do not rerun the unchanged live workflow, make another provider booking, or recreate the deleted Worker. Record provider, deployment, source, credential, and persistent-data recovery as separate domains.

## Global constraints

- Work on clean sequential local `main` frozen at planning base `542660b5a3d25709ade6d8536c8c65bd1e6b6038`; do not touch separate worktrees.
- Keep exactly seven executable descriptors. Do not change any descriptor, profile recipe, generated fixture byte, generated client contract, `.egeria` project/state schema, or capability version unless a focused TDD result proves it is directly required.
- Keep certification data private to builder-core and the repository. Do not extract a public package or add a third-party dependency.
- Bind subjects to both the descriptor and required-evidence contract. Do not let registry presence, a task link, local output, or `backfill-pending` imply certification.
- Restrict `backfill-pending` to the six exact descriptor-version/digest subjects accepted before this foundation. New or materially changed subjects require ordinary task-linked pending records.
- Keep descriptor admission and phase/release closure distinct. Admission remains part of the builder candidate. Under the live closure amendment, `legacy-backfill-exempt` closure must pass with certified Calendly while `all-certified` must reject only the six frozen backfill records.
- Exercise only initial scaffolding. Do not add existing-repository add/remove/migrate/recover CLI behavior; that belongs to P3.
- Reuse the exact generated-project verifier. Do not create a second install/build/browser command matrix or infer transitive runtime evidence from static tests.
- Emit only content-safe certification output. Never print Calendly invitee data, provider confirmations, GitHub secrets, Cloudflare tokens, cookies, private URLs, or temporary environment contents.
- Treat browser/axe automation as bounded application evidence. Do not claim Calendly provider behavior, visual quality, human accessibility, production readiness, or WCAG conformance.
- Do not dispatch a workflow, deploy, create/change a GitHub environment or secret, create/change a Calendly event, book/cancel a meeting, delete a Worker, spend money, or perform another external mutation without a new explicit authorization.
- Bind any later external execution to these exact roles: GitHub repository administrator, workflow dispatcher with write access, deployment risk owner, Cloudflare account administrator, Calendly certification operator, and implemented-task reviewer. Under the approved sole-developer exception, `CoveMB` holds each human role and the receipt states that no independent human deployment reviewer exists. The Cloudflare token requires only `Workers Scripts Write` in the non-production account. The Worker preflight target is exactly `acme-portfolio-calendly`.
- Permit exactly one synthetic booking, no API polling, and manual Meetings checks every 30 seconds for at most 5 minutes. No paid upgrade or incremental spend is authorized. Retain the content-safe workflow artifact for seven days; record credential disposition to revoke a task token, rotate an exposed or over-scoped token, or leave the shared token unchanged under its rotation plan; and stop on every rerun trigger listed in the preparation runbook.
- Require every recorded evidence outcome to bind the capability, descriptor subject, evidence-producing ancestor revision, explicit `passed` outcome, affirmative per-outcome review, completed receipt status, and zero unresolved prompt fields. A relabeled or incomplete local document cannot satisfy deployed, provider, cleanup, or recovery evidence.
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
- [ ] Implement pure subject, artifact, admission, and closure validation. Hash canonical `{ descriptor, requiredEvidence }`; freeze the six accepted transitional subject tuples; require repository-present task/evidence artifacts with capability, subject, revision, and passed-outcome metadata; return stable value-free issue codes and paths.
- [ ] Export the boundary, add the checked Draft 2020-12 registry schema, and update exact private source/schema inventories.
- [ ] Create `certifications/capabilities.json` with all seven exact catalog identifiers. Give each record its current descriptor version/digest. Mark the six frozen accepted subjects `backfill-pending`; mark `booking-calendly` `pending`, require fresh-scaffold/deployed-application/provider-confirmed/cleanup-recovery evidence, and link this exact plan.
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

**Comparison:** the original local-foundation review used planning base `542660b5a3d25709ade6d8536c8c65bd1e6b6038..HEAD`; the live provider-closure review uses `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558` plus the exact certification-only working-tree diff.

- [ ] Dispatch one read-only requirements reviewer for exact certification acceptance, local/protected/provider separation, prerequisite completeness, registry/gate semantics, external authority, and claim boundaries.
- [ ] Dispatch one read-only architecture/anti-overengineering reviewer for canonical ownership, digest design, transition allowlist, managed/application boundaries, runner reuse, content safety, least privilege, and exclusion of P3/general deployment work.
- [ ] Dispatch one read-only test-evidence reviewer for causal RED/GREEN evidence, admission/closure rejection, actual compiled-CLI fresh output, `.egeria`/inference/diff proof, fixed-root runtime/browser reuse, workflow static evidence, and unsupported claims.
- [ ] Give each reviewer an exact non-overlapping role and scope, prohibit edits and recursive fan-out, wait for every result, and validate every finding against the current tree.
- [ ] For each material validated defect, add a focused failing regression test, implement the minimum repair, rerun affected checks, and record disposition. Do not change code for unsupported or preference-only findings.
- [ ] Commit evidence-backed repairs, if any, with a message naming the actual correction.

The preapproved amendment for the final test-evidence finding modifies only files already named above: `packages/builder-core/src/certification/capability-certification.ts`, its focused test, the root certification adapter, manual workflow, provider receipt template, local verification evidence, and direct canonical documentation consumers. It adds Git ancestor validation, full-history checkout, machine-readable receipt completion/review/prompt metadata, and mutation tests for unreachable revisions and incomplete, rejected, or outcome-mismatched receipts. It does not execute an external action or change the capability descriptor, generated project, fixture, dependency, or certification status.

## Task 7: Final verification, review packet, and external stop gate

- [ ] Run certification-scoped `git diff --check`, semantic naming, documentation/constitution, package boundaries, builder-core, CLI, certification static tests, admission, generated-fixture tests, builder lint/build/typecheck, root audit/signatures, fixed-root full generated verification, and changeset status on the settled tree. Reuse the unchanged accepted local Calendly receipt instead of rerunning its expensive journey.
- [ ] Do not repeat an unchanged successful expensive check. Record exact command, exit, relevant count, duration where material, and bounded claim for each result.
- [ ] Run both closure policies: record the successful `legacy-backfill-exempt` exit and the `all-certified` rejection of exactly the six frozen backfill records.
- [ ] Verify branch/status, exact comparison, changed-file inventory, ignored/untracked artifacts, and no changes in separate worktrees.
- [ ] Record exact registry subjects/statuses, the unchanged local receipt, successful exact-revision workflow and artifact, provider-confirmed booking, cancellation, Worker deletion and `404`, credential disposition, reviewer dispositions, risks, source/provider/credential/persistent-data recovery separation, and the no-conformance boundary.
- [ ] Create the provider-closure review packet for the exact certification-only comparison from `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558`, excluding and preserving any concurrent user-owned work.
- [ ] Commit final evidence with message `Record Calendly certification review`.
- [ ] Re-run only final-tree identity/status and documentation/semantic checks affected by the evidence commit.
- [ ] Stop for the user's explicit implemented-task review. Do not dispatch another workflow, make another booking, recreate the Worker, or begin a later increment.
