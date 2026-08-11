# Production Observability Capability Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the local fresh-scaffold evidence and the exact protected-staging/provider certification path for `observability@0.2.0`, while retaining `pending` status until separately authorized live deployment, provider receipt, cleanup, review, and registry closure all succeed.

**Architecture:** Reuse one private fresh-scaffold harness for the existing Calendly and new observability wrappers, then exercise a generated `portfolio` through the compiled CLI and fixed-root verifier. Prepare one manual, exact-revision GitHub Actions workflow that creates a temporary generated project, adds one certification-only error route outside retained templates and fixtures, deploys one dedicated non-production Worker, installs the two declared Better Stack secrets, and emits content-safe receipts. Provider inspection, source/credential/data disposition, cleanup, and a later `certified` transition remain human-reviewed external outcomes.

**Tech stack:** Node.js `22.23.2`, pnpm `11.20.0`, Node test runner, Next.js `16.3.0`, `@opennextjs/cloudflare@1.20.2`, Wrangler `4.118.0`, GitHub Actions, Cloudflare Workers Logs, and Better Stack HTTP ingestion.

**Current local status (2026-08-11):** The approved Task 6 comparison remains `717c3bb0f048f4a4bc544100125ae42d818f09bc..45b57d2dc265ef6ba9ac805d7352a01db5f1081d`. The local fresh-scaffold journey passed at `ef845b1e0551d3b43e17969cc00f21960c90769b`; the manual protected-staging workflow, deployed exercise, and provider receipt path are prepared but have not been dispatched or executed. `observability@0.2.0` remains `pending`, and Tasks 6–7 plus every external action remain open.

## Global constraints

- Work only on clean branch `observability-certification` in the existing isolated worktree `.worktrees/production-observability`, based on approved Task 6 record commit `fb3af7fef7602764432f16940abff0ffc65a5b67`.
- The user preapproved exact-file plan amendments and continuation through implemented-task review. That authorizes bounded local files, tests, focused commits, and read-only reviews only.
- Do not merge, push, dispatch a workflow, create or change a GitHub environment or secret, deploy, create or change a Better Stack source, use a credential, transmit telemetry, inspect provider data, spend money, clean up a provider resource, publish a package, or change certification status without new exact authority.
- Retain `observability@0.2.0` as `pending`. Record only passed local `fresh-scaffold` evidence in this increment; `deployed-application` and `cleanup-recovery` remain absent until a separately authorized live run and affirmative evidence review.
- Keep source, deployment, GitHub secret, Cloudflare deployment secret, Cloudflare API credential, Better Stack source/token, retained Workers Logs, retained Better Stack data, and recovery/disposition decisions separate.
- Use only synthetic bounded values. Never retain or transmit real client content, URLs, request data, headers, cookies, user agents, email addresses, form values, provider responses, tokens, or secrets.
- Cloudflare platform/framework error records are provider-controlled and are not the bounded custom event schema. Inventory their actual fields and retention separately before any certification or production claim.
- `waitUntil()` is best-effort for at most the documented post-response window. Do not claim durable delivery, retries, or ongoing provider availability and do not add a queue, Tail Worker, database, analytics, rate-limit resource, WAF policy, or `apps/jobs`.
- Reuse `verifyGeneratedProject`; do not create another install/audit/signature/lint/typecheck/Next/OpenNext/browser matrix or modify retained generated fixtures.
- The staging-only error route must exist only in the certification test fixture and the workflow-created temporary project. It must not enter builder templates or committed generated fixtures and must be unreachable after selected cleanup.
- Better Stack rejection, timeout, and unreachable containment is established by the exact existing package/generated tests. Do not mutate live provider credentials to inject those failures; protected staging adds actual delivery and application-response evidence.
- Do not claim production readiness, visual approval, performance, human accessibility, WCAG conformance, analytics behavior beyond tested absence, security completeness, or compatibility beyond the exact checks run.
- Before every commit, verify branch and status, stage only named paths, inspect the cached diff, and run `git diff --cached --check`.
- No file outside the exact inventory below is in scope without a dated, evidence-backed amendment recorded in this plan before the edit.

### Preapproved execution amendment — fixed verifier identity (2026-08-11)

The first registry-enabled real local journey reached `verifyGeneratedProject(root, "portfolio")` and failed with `GENERATED_PROJECT_VERIFICATION_FAILED`. Root-cause tracing confirmed that the fixed verifier's canonical `portfolio` contract requires project `acme-portfolio` and display name `Acme Portfolio`, while the original Task 2 text also required the staging-only identity `acme-portfolio-observability`. Broadening the verifier would weaken the immutable fixture contract and creating another check matrix is prohibited.

Under the user's preapproved plan-amendment authority, the local runner uses the exact canonical `portfolio` identity `acme-portfolio` / `Acme Portfolio`. The manual protected-staging candidate remains the separately named dedicated Worker `acme-portfolio-observability`. A focused test must fail against the old local identity before production configuration changes. No generated template, fixture, verifier contract, provider surface, registry evidence, or external state changes under this amendment.

### Preapproved review amendment — current authorization status (2026-08-11)

Task 3 review found that `docs/roadmaps/program-roadmap.md` and its direct constitution assertion still called Task 6B an unapproved plan after bounded local execution was authorized and reviewed fresh-scaffold evidence was recorded. That current-status wording is false even though the protected-staging/provider/external limits remain correct.

The repair modifies already inventoried `tests/constitution/constitution.test.mjs` first so its current-status expectation fails against the stale roadmap, then updates only the roadmap's Task 6B status sentences. Local Task 6B is authorized and in progress; protected-staging deployment, provider/source and credential mutations, telemetry transmission, cleanup, registry transition, merge, and push remain separately unauthorized. No runtime, registry, evidence subject, external state, or later task changes under this amendment.

### Preapproved review repair — release-evidence reconciliation (2026-08-11)

Task 5 review found two documentation overclaims and one inherited release-gate mismatch. The checked Task 4 wording described the configured protected-staging exercise as though it had executed, and Task 5 did not record that the full package-boundary gate finished 44/45 because its stale release safeguard required zero Changeset Markdown files. The dedicated workflow remains configured but undispatched and unexecuted; no browser, upload, provider, credential, telemetry, cleanup, publication, or registry-status action occurred.

The official Changesets command-line documentation supports `add --empty` when no package is being bumped and shows an empty Changeset with only YAML delimiters. The intentional release-evidence marker is exactly `.changeset/clarify-observability-boundary.md`, with the exact 8-byte content `---\n---\n`. The marker predates this repair and must not be modified or deleted. The direct consumer `tests/package-boundaries/release-safeguards.test.mjs` must require exactly that one filename and exact content, continuing to reject every extra Changeset and every package-bump Changeset.

This dated amendment adds the existing preparation-evidence owner and that direct test consumer to the repair inventory before the consumer edit. The unchanged baseline full package-boundary run exited 1 with 44/45 tests passing because the consumer expected `[]` but found `clarify-observability-boundary.md`. After the direct consumer repair, the focused release safeguard passed 1/1 and the full package-boundary suite reached final GREEN at 45/45; constitution passed 34/34, semantic naming and capability admission exited 0, both closure policies rejected exactly the still-pending records as expected, documentation links passed 1/1, and `git diff --check` exited 0. No other plan, test, release, registry, workflow, provider, or external-state surface is authorized.

### User-preapproved Task 6 review-repair amendment — certification safeguards (2026-08-11)

The independent requirements, test-evidence, and security/privacy reviewers retained four material findings. The architecture and anti-overengineering reviewer reported no material findings.

1. Task 1 and Gate 1 were marked complete even though the preparation record contained only an unresolved decision checklist, not the step-by-step human-prerequisite runbook required by the review protocol. Repair increment A must add the current account/eligibility, least-privilege resource, secret-store, credential-lifecycle, origin, synthetic-data, readiness, bounded-polling, quota/spend/retention, action-owner/approval, ordered cleanup, rollback/recovery, and rerun instructions while keeping every external action separately unauthorized and every placeholder content-safe.
2. The deployed exercise handcrafts Node requests for `browser.window.error` and `browser.web.vital`, while the generic deployed Playwright suite emits no intentional browser error. This bypasses the generated `instrumentation-client.ts` browser reporter's privacy and delivery path. Repair increment B must add one certification-only Playwright fixture that dispatches an actual browser error event with a synthetic same-origin cookie, observes the generated request with no `Cookie` or `Referer` and an exact `202`, and writes only a bounded UUID receipt. Direct Node posts remain route-envelope evidence rather than browser-reporter evidence.
3. The constitution test inspects secret expressions only within workflow step objects. A secret expression at workflow, job, defaults, container, matrix, or run-string scope could escape the approved two step-level environment boundaries. Repair increment A must recursively enumerate every parsed `${{ secrets.* }}` expression and accept only the exact current secret names at their approved step `env` paths; focused mutations must prove disallowed top-level, job-level, defaults, container, matrix, and run-string references fail.
4. The provider receipt asks for the Git revision through event `release_id`, but the generated runtime obtains `release_id` from `CF_VERSION_METADATA.id`, which is a Cloudflare version identifier. The bulk secret installation also creates the final version/deployment without capturing that identity. Repair increment B must capture `wrangler deployments list --json` after secret installation into a runner-temporary raw file, sanitize it through a tested repository script into a bounded Git revision plus Cloudflare deployment/version receipt, delete the raw file, upload only the bounded receipt, and require provider `release_id` to equal the captured Cloudflare version identifier rather than the Git revision.

Increment B directly touches two APIs not covered by the original execution plan. The official [Wrangler Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) and [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) documentation were revalidated on 2026-08-11 against pinned Wrangler `4.118.0`; the official [Playwright APIRequest](https://playwright.dev/docs/api/class-request) documentation was revalidated on the same date against pinned Playwright `1.62.1`. `deployments list --json` may identify the latest deployment and its percentage-assigned version after the secret-install step, but this sequencing binds the checked Git SHA only to the captured Cloudflare deployment/version identifiers; it does not make either provider identifier a Git revision or prove telemetry receipt, durability, retention, provider availability, or production readiness. Playwright `request.allHeaders()` can confirm that the generated browser request omitted `cookie` and `referer`, while the matched `202` confirms route acceptance only; request/header values are sensitive and must never be written or emitted. The final settled-tree verification must include a fresh `pnpm audit --audit-level=moderate` for the exact locked graph; its result is point-in-time advisory evidence only and is not authorization for any workflow, provider, credential, deployment, or telemetry action.

The repair is split into two sequential exact-file increments. Increment A owns only:

- `docs/superpowers/plans/2026-08-10-production-observability-certification.md`;
- `docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md`; and
- `tests/constitution/constitution.test.mjs`.

Increment B owns only:

- `docs/superpowers/plans/2026-08-10-production-observability-certification.md`;
- `docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md`;
- `.github/workflows/production-observability-certification.yml`;
- `docs/implementation-evidence/production-observability-provider-receipt-template.md`;
- `scripts/exercise-production-observability.mjs`;
- new `scripts/create-cloudflare-deployment-receipt.mjs`;
- new `tests/capability-certification/fixtures/observability-browser-error.spec.ts`; and
- `tests/capability-certification/production-observability.test.mjs`; and
- `tests/constitution/constitution.test.mjs`.

No other file is authorized. Increment A must finish before increment B begins and must not modify the prepared workflow. Neither repair increment authorizes integration, push, workflow dispatch, provider/source or credential access, secret use, deployment, telemetry transmission, cleanup, registry mutation, publication, or another external action.

## Exact file structure

Create local runner, deployed exercise, certification fixture, workflow, and tests:

```text
scripts/lib/certify-fresh-scaffold.mjs
scripts/certify-production-observability.mjs
scripts/exercise-production-observability.mjs
tests/capability-certification/production-observability.test.mjs
tests/capability-certification/fixtures/observability-error-route.ts
.github/workflows/production-observability-certification.yml
```

Create dated evidence and the unexecuted provider receipt template:

```text
docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md
docs/implementation-evidence/2026-08-11-production-observability-certification-verification.md
docs/implementation-evidence/production-observability-provider-receipt-template.md
docs/review-packets/2026-08-11-production-observability-certification.md
```

Modify the existing wrapper, registry, scripts, tests, plan, and direct current-status owners:

```text
scripts/certify-booking-calendly.mjs
tests/capability-certification/certification-runner.test.mjs
tests/constitution/constitution.test.mjs
package.json
certifications/capabilities.json
README.md
packages/builder-core/README.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/roadmaps/program-roadmap.md
docs/superpowers/plans/2026-08-10-production-observability-certification.md
tests/package-boundaries/release-safeguards.test.mjs
```

Do not modify capability descriptors, certification schemas/runtime policy, public package source or version, Changesets, CLI arguments, profile recipes, generated templates, generated fixtures, lockfiles, deployment compatibility proof, analytics, or prior evidence/review packets.

---

### Task 1: Freeze preparation and execution boundaries

**Files:**
- Create: `docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md`
- Modify: `docs/superpowers/plans/2026-08-10-production-observability-certification.md`

**Interfaces:**
- Consumes: approved Task 6 comparison `717c3bb0f048f4a4bc544100125ae42d818f09bc..45b57d2dc265ef6ba9ac805d7352a01db5f1081d`, approval record `fb3af7fef7602764432f16940abff0ffc65a5b67`, registry subject `observability@0.2.0` / `sha256:a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97`.
- Produces: one exact-file plan and one dated source/provider/security/prerequisite record that later tasks must obey.

- [x] Record repository/worktree/branch identity, local and remote refs without fetching, recent commits, manifests, exact toolchain, accepted architecture owners, `.egeria`/certification contracts, prior packets, and baseline results.
- [x] Record current official Cloudflare, OpenNext, Next.js, GitHub Actions, Better Stack, Node, pnpm, npm, and GitHub Advisory evidence with dated primary-source links and claim limits.
- [x] Add the governance-required step-by-step human-prerequisite runbook covering the exact integration/push SHA, dedicated GitHub environment and secret storage, action owners and approval checkpoints, Cloudflare account/Worker/token scope and lifecycle, Better Stack account/team/region/source/plan/retention/spend and source-token storage, staging origin, synthetic data, readiness, bounded provider polling, credential disposition, ordered route/Worker/source/data/environment-secret cleanup, rollback/recovery, and rerun triggers. Retain the existing live-run blocker and human-decision record.
- [x] State that no unresolved contradiction blocks local implementation and that the workflow cannot be dispatched until it is on the default branch at an explicitly approved revision.
- [x] Run `node --test tests/constitution/constitution.test.mjs`, `node scripts/check-semantic-naming.mjs`, and `git diff --check` with the exact toolchain.
- [x] Commit only these two documents with message `Plan observability capability certification`.

### Task 2: Reuse the fresh-scaffold harness and certify actual local output

**Files:**
- Create: `scripts/lib/certify-fresh-scaffold.mjs`
- Create: `scripts/certify-production-observability.mjs`
- Create: `tests/capability-certification/production-observability.test.mjs`
- Modify: `scripts/certify-booking-calendly.mjs`
- Modify: `tests/capability-certification/certification-runner.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: compiled `apps/cli/dist/index.js` and `verifyGeneratedProject(root, "portfolio")`.
- Produces: `certifyFreshScaffoldForTesting(configuration, adapters)`, unchanged `certifyBookingCalendlyForTesting(input, adapters)`, `certifyProductionObservabilityForTesting(adapters)`, and root script `verify:production-observability-certification`.

- [x] RED: add tests whose production mutation is a missing/wrong project identity, capability/version, CLI order, environment scrub, generated verifier identifier, cleanup, receipt, argument rejection, or preserved Calendly behavior. Use literal expected CLI arrays and receipts; mock only command execution and the expensive fixed verifier.
- [x] Run `node --test tests/capability-certification/production-observability.test.mjs tests/capability-certification/certification-runner.test.mjs`; capture the expected missing-module/export failure.
- [x] GREEN: extract only the identity-owned temporary root, sanitized compiled-CLI `create`/`infer`/`doctor`/`diff`, installed/confirmed capability validation, fixed verifier invocation, bounded receipt, and identity-checked cleanup into the private helper.
- [x] Keep the Calendly wrapper API, arguments, error type/codes, receipt, and tests byte-behavior compatible. Add the observability wrapper with the canonical fixed-verifier project `acme-portfolio`, display name `Acme Portfolio`, base `portfolio`, exact default capability list, `observability@0.2.0`, verifier identifier `portfolio`, and no provider value or secret input. The later staging workflow retains dedicated Worker identity `acme-portfolio-observability`.
- [x] Add `verify:production-observability-certification` as `pnpm run build:builder && node scripts/certify-production-observability.mjs`.
- [x] Run the focused tests GREEN, then the complete capability-certification and generated-verifier tests.
- [x] Commit implementation and tests with message `Verify fresh observability scaffold`.
- [x] From that clean source commit, run the real `verify:production-observability-certification` once with exact Node/pnpm and registry access. Retain only its bounded JSON receipt and command result; the identity-owned generated project must be removed.

### Task 3: Bind passed local evidence without closing certification

**Files:**
- Create: `docs/implementation-evidence/2026-08-11-production-observability-certification-verification.md`
- Modify: `certifications/capabilities.json`
- Modify: `tests/capability-certification/production-observability.test.mjs`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/roadmaps/program-roadmap.md`

**Interfaces:**
- Consumes: Task 2's clean source commit and exact bounded local receipt.
- Produces: one passed/reviewed/complete `fresh-scaffold` evidence entry whose revision is Task 2's ancestor commit; status remains `pending` with no deployed or cleanup evidence.

- [x] RED: add a repository-level test requiring exactly one sorted observability evidence entry of kind `fresh-scaffold`, the unchanged subject and task plan, `pending` status, and continued rejection by both closure policies.
- [x] Run the focused test and capture its expected empty-evidence failure.
- [x] GREEN: write the verification receipt with exact capability/version/digest/revision/outcome/review/completion metadata and bounded command result. Add the matching registry entry without changing the subject, required-evidence list, task plan, or status.
- [x] Reconcile only direct current-status documentation to distinguish passed local fresh-scaffold evidence from absent protected-staging/provider/cleanup evidence.
- [x] Run focused tests, admission, both expected-rejecting closure commands, documentation links, and semantic naming.
- [x] Commit with message `Record local observability evidence`.

### Task 4: Prepare the protected-staging exercise and provider receipt

**Files:**
- Create: `scripts/exercise-production-observability.mjs`
- Create: `tests/capability-certification/fixtures/observability-error-route.ts`
- Create: `.github/workflows/production-observability-certification.yml`
- Create: `docs/implementation-evidence/production-observability-provider-receipt-template.md`
- Modify: `tests/capability-certification/production-observability.test.mjs`
- Modify: `tests/constitution/constitution.test.mjs`

**Interfaces:**
- Consumes: `exerciseProductionObservabilityForTesting({ baseUrl, revision }, adapters)` and the generated route `/api/observability`.
- Produces: a bounded deployed-exercise JSON receipt; one manual exact-revision workflow; and a human receipt template for `deployed-application` plus `cleanup-recovery` evidence.

- [x] RED: add behavior tests for HTTPS/root-only staging URL validation, 40-character revision validation, successful home and certification-error responses, valid browser-error/web-vital acceptance, cross-origin/media-type/oversize/malformed/extra-field/vocabulary/secret-bearing rejection, bounded markers, timeouts/fetch failures, and output that omits the origin and response bodies.
- [x] RED: add parsed workflow tests for manual-only dispatch, exact `main`/SHA checks, protected `observability-certification` environment, pinned actions, exact runtime, compiled fresh generation, temporary fixture copy, credential-free build, secret-minimal deploy, separate two-provider-secret installation, deployed exercise/browser checks without secrets, bounded artifact retention, and absence of push/pull-request/schedule/provider-source API/delete paths.
- [x] Run focused tests and capture the missing exercise/workflow/template failures.
- [x] GREEN: implement the exercise as fixed HTTPS requests with 10-second request timeouts, no body reads, fixed revision-derived synthetic correlation identifiers, exact expected statuses, and stable content-safe errors.
- [x] Add one route fixture that throws only `Error("synthetic observability certification error")`; the workflow copies it into the temporary generated project before build.
- [x] Add a manual workflow requiring only `expected_revision`, using project/Worker `acme-portfolio-observability`, environment `observability-certification`, `contents: read`, non-cancelling concurrency, full-history checkout, exact revision checks, local runner, temporary fresh generation, OpenNext build/deploy, then Wrangler bulk installation of only `BETTER_STACK_INGESTING_HOST` and `BETTER_STACK_SOURCE_TOKEN`. Secret values may exist only in the single secret-install step and its mode-0600 runner-temporary file, removed by an exit trap.
- [x] Configure the workflow to run the deployed exercise and existing generated deployed Playwright suite only after secret installation, and to upload only the local/deployed JSON receipts for seven days. Do not create/query/delete a Better Stack source or delete/rollback the Worker in automation.
- [x] Add a human provider template that separately records app/custom-event evidence, Workers Logs platform/framework fields and retention, Better Stack source/region/tier/quota/retention and exact event-field receipt, provider-failure containment test basis, unauthenticated-route abuse/cost decision, GitHub/Cloudflare/Better Stack credential disposition, Worker/source/data cleanup, and claim limits. Prompts must forbid secrets, hosts, private URLs, raw logs, stacks, request metadata, and client data.
- [x] Run focused behavior/constitution tests, YAML parse, action-pin checks, docs links, semantic naming, and `git diff --check`.
- [x] Commit with message `Prepare observability staging certification`.

### Task 5: Reconcile current documentation and external stop gate

**Files:**
- Modify: `README.md`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/capability-model.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/roadmaps/program-roadmap.md`
- Modify: `docs/superpowers/plans/2026-08-10-production-observability-certification.md`

**Interfaces:**
- Consumes: Tasks 2–4 local artifacts.
- Produces: one truthful current status: local fresh-scaffold passed, protected-staging/provider path prepared but not executed, status still `pending`.

- [x] Update direct status owners with the new local runner/workflow/receipt path and no broader claim. Keep the Task 6 approved comparison and Task 6B external blockers explicit.
- [x] Record official-source claim limits: `waitUntil()` is not durable, platform logs are separate/provider-controlled, retention and quotas are plan-dependent, and OpenNext/Next compatibility still requires the actual pinned build/deploy evidence.
- [x] Mark Tasks 1–5 complete in this plan only after their commits and checks exist; do not mark live certification or the capability complete.
- [x] Run constitution, semantic naming, package boundaries, capability admission, and both expected-rejecting closure policies.
- [x] Commit with message `Document observability certification path`.

### Task 6: Independent review and bounded repair

**Files:**
- Modify only files already named above when an evidence-backed material finding requires repair.

**Interfaces:**
- Consumes: exact Task 6B implementation base through current `HEAD`.
- Produces: reconciled read-only requirements, architecture/anti-overengineering, test-evidence, and security/privacy review dispositions.

- [x] Dispatch independent read-only reviewers for requirements, architecture/anti-overengineering, and test evidence. Add one security/privacy specialist because the workflow handles deployment credentials and external telemetry. Prohibit edits and recursive fan-out; give each the exact range and current clean worktree. Requirements, test-evidence, and security/privacy review retained the four findings in the dated amendment above; architecture/anti-overengineering reported no material findings.
- [ ] Validate every finding against the current tree. For each material defect, write or amend a focused test to show RED, implement the minimum repair, rerun the affected check, and obtain one bounded re-review. Record unsupported/preference-only findings without code churn.
- [ ] Commit evidence-backed repairs with a message naming the actual correction.

### Task 7: Final verification and implemented-task review packet

**Files:**
- Create: `docs/review-packets/2026-08-11-production-observability-certification.md`
- Modify: `docs/superpowers/plans/2026-08-10-production-observability-certification.md`

**Interfaces:**
- Consumes: settled exact local Task 6B diff and every review disposition.
- Produces: one implemented-task review packet and explicit external stop gate.

- [ ] Run the settled focused suites, constitution/docs links, semantic naming, package boundaries, builder-core/CLI/public-package tests, admission, both closure policies, lint/build/typecheck, fresh `pnpm audit --audit-level=moderate`, signatures, fixed-root generated verification, changeset status, `git diff --check`, and exact branch/status/inventory checks. Do not repeat the unchanged real local journey.
- [ ] Record exact commands, exits, counts/durations where material, bounded claims, changed files, commits, reviewer dispositions, risks, deferred external work, and source/deployment/credential/provider/data rollback and recovery separately.
- [ ] State prominently that no workflow was dispatched, no provider or secret was mutated, no telemetry was transmitted, no cleanup was performed, no registry status changed, Task 6 remains unmerged/unpushed, and Task 6B is not certified.
- [ ] Commit final evidence with message `Record observability certification review`.
- [ ] Re-run only checks whose inputs changed in the evidence commit, then stop for explicit verified-final-diff approval. Do not merge, push, deploy, mutate providers, transition the registry, or begin a later task.
