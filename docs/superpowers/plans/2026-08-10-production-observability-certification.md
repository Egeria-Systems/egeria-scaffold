# Production Observability Capability Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the local fresh-scaffold evidence and the exact protected-staging/provider certification path for `observability@0.2.0`, while retaining `pending` status until separately authorized live deployment, provider receipt, cleanup, review, and registry closure all succeed.

**Architecture:** Reuse one private fresh-scaffold harness for the existing Calendly and new observability wrappers, then exercise a generated `portfolio` through the compiled CLI and fixed-root verifier. Prepare one manual, exact-revision GitHub Actions workflow that creates a temporary generated project, adds one certification-only error route outside retained templates and fixtures, deploys one dedicated non-production Worker, installs the two declared Better Stack secrets, and emits content-safe receipts. Provider inspection, source/credential/data disposition, cleanup, and a later `certified` transition remain human-reviewed external outcomes.

**Tech stack:** Node.js `22.23.2`, pnpm `11.20.0`, Node test runner, Next.js `16.3.0`, `@opennextjs/cloudflare@1.20.2`, Wrangler `4.118.0`, GitHub Actions, Cloudflare Workers Logs, and Better Stack HTTP ingestion.

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

- [ ] Record repository/worktree/branch identity, local and remote refs without fetching, recent commits, manifests, exact toolchain, accepted architecture owners, `.egeria`/certification contracts, prior packets, and baseline results.
- [ ] Record current official Cloudflare, OpenNext, Next.js, GitHub Actions, Better Stack, Node, pnpm, npm, and GitHub Advisory evidence with dated primary-source links and claim limits.
- [ ] Consolidate the live-run blockers and human decisions: exact integration/push SHA, dedicated GitHub environment, owners/roles, Cloudflare account/Worker/token scope, Better Stack account/team/region/source/plan/retention/spend, source token storage, staging origin, provider inspection, credential disposition, Worker/source/data cleanup, and registry-transition authority.
- [ ] State that no unresolved contradiction blocks local implementation and that the workflow cannot be dispatched until it is on the default branch at an explicitly approved revision.
- [ ] Run `node --test tests/constitution/constitution.test.mjs`, `node scripts/check-semantic-naming.mjs`, and `git diff --check` with the exact toolchain.
- [ ] Commit only these two documents with message `Plan observability capability certification`.

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

- [ ] RED: add tests whose production mutation is a missing/wrong project identity, capability/version, CLI order, environment scrub, generated verifier identifier, cleanup, receipt, argument rejection, or preserved Calendly behavior. Use literal expected CLI arrays and receipts; mock only command execution and the expensive fixed verifier.
- [ ] Run `node --test tests/capability-certification/production-observability.test.mjs tests/capability-certification/certification-runner.test.mjs`; capture the expected missing-module/export failure.
- [ ] GREEN: extract only the identity-owned temporary root, sanitized compiled-CLI `create`/`infer`/`doctor`/`diff`, installed/confirmed capability validation, fixed verifier invocation, bounded receipt, and identity-checked cleanup into the private helper.
- [ ] Keep the Calendly wrapper API, arguments, error type/codes, receipt, and tests byte-behavior compatible. Add the observability wrapper with the canonical fixed-verifier project `acme-portfolio`, display name `Acme Portfolio`, base `portfolio`, exact default capability list, `observability@0.2.0`, verifier identifier `portfolio`, and no provider value or secret input. The later staging workflow retains dedicated Worker identity `acme-portfolio-observability`.
- [ ] Add `verify:production-observability-certification` as `pnpm run build:builder && node scripts/certify-production-observability.mjs`.
- [ ] Run the focused tests GREEN, then the complete capability-certification and generated-verifier tests.
- [ ] Commit implementation and tests with message `Verify fresh observability scaffold`.
- [ ] From that clean source commit, run the real `verify:production-observability-certification` once with exact Node/pnpm and registry access. Retain only its bounded JSON receipt and command result; the identity-owned generated project must be removed.

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

- [ ] RED: add a repository-level test requiring exactly one sorted observability evidence entry of kind `fresh-scaffold`, the unchanged subject and task plan, `pending` status, and continued rejection by both closure policies.
- [ ] Run the focused test and capture its expected empty-evidence failure.
- [ ] GREEN: write the verification receipt with exact capability/version/digest/revision/outcome/review/completion metadata and bounded command result. Add the matching registry entry without changing the subject, required-evidence list, task plan, or status.
- [ ] Reconcile only direct current-status documentation to distinguish passed local fresh-scaffold evidence from absent protected-staging/provider/cleanup evidence.
- [ ] Run focused tests, admission, both expected-rejecting closure commands, documentation links, and semantic naming.
- [ ] Commit with message `Record local observability evidence`.

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

- [ ] RED: add behavior tests for HTTPS/root-only staging URL validation, 40-character revision validation, successful home and certification-error responses, valid browser-error/web-vital acceptance, cross-origin/media-type/oversize/malformed/extra-field/vocabulary/secret-bearing rejection, bounded markers, timeouts/fetch failures, and output that omits the origin and response bodies.
- [ ] RED: add parsed workflow tests for manual-only dispatch, exact `main`/SHA checks, protected `observability-certification` environment, pinned actions, exact runtime, compiled fresh generation, temporary fixture copy, credential-free build, secret-minimal deploy, separate two-provider-secret installation, deployed exercise/browser checks without secrets, bounded artifact retention, and absence of push/pull-request/schedule/provider-source API/delete paths.
- [ ] Run focused tests and capture the missing exercise/workflow/template failures.
- [ ] GREEN: implement the exercise as fixed HTTPS requests with 10-second request timeouts, no body reads, fixed revision-derived synthetic correlation identifiers, exact expected statuses, and stable content-safe errors.
- [ ] Add one route fixture that throws only `Error("synthetic observability certification error")`; the workflow copies it into the temporary generated project before build.
- [ ] Add a manual workflow requiring only `expected_revision`, using project/Worker `acme-portfolio-observability`, environment `observability-certification`, `contents: read`, non-cancelling concurrency, full-history checkout, exact revision checks, local runner, temporary fresh generation, OpenNext build/deploy, then Wrangler bulk installation of only `BETTER_STACK_INGESTING_HOST` and `BETTER_STACK_SOURCE_TOKEN`. Secret values may exist only in the single secret-install step and its mode-0600 runner-temporary file, removed by an exit trap.
- [ ] Run the deployed exercise and existing generated deployed Playwright suite only after secret installation. Upload only the local/deployed JSON receipts for seven days. Do not create/query/delete a Better Stack source or delete/rollback the Worker in automation.
- [ ] Add a human provider template that separately records app/custom-event evidence, Workers Logs platform/framework fields and retention, Better Stack source/region/tier/quota/retention and exact event-field receipt, provider-failure containment test basis, unauthenticated-route abuse/cost decision, GitHub/Cloudflare/Better Stack credential disposition, Worker/source/data cleanup, and claim limits. Prompts must forbid secrets, hosts, private URLs, raw logs, stacks, request metadata, and client data.
- [ ] Run focused behavior/constitution tests, YAML parse, action-pin checks, docs links, semantic naming, and `git diff --check`.
- [ ] Commit with message `Prepare observability staging certification`.

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

- [ ] Update direct status owners with the new local runner/workflow/receipt path and no broader claim. Keep the Task 6 approved comparison and Task 6B external blockers explicit.
- [ ] Record official-source claim limits: `waitUntil()` is not durable, platform logs are separate/provider-controlled, retention and quotas are plan-dependent, and OpenNext/Next compatibility still requires the actual pinned build/deploy evidence.
- [ ] Mark Tasks 1–5 complete in this plan only after their commits and checks exist; do not mark live certification or the capability complete.
- [ ] Run constitution, semantic naming, package boundaries, capability admission, and both expected-rejecting closure policies.
- [ ] Commit with message `Document observability certification path`.

### Task 6: Independent review and bounded repair

**Files:**
- Modify only files already named above when an evidence-backed material finding requires repair.

**Interfaces:**
- Consumes: exact Task 6B implementation base through current `HEAD`.
- Produces: reconciled read-only requirements, architecture/anti-overengineering, test-evidence, and security/privacy review dispositions.

- [ ] Dispatch independent read-only reviewers for requirements, architecture/anti-overengineering, and test evidence. Add one security/privacy specialist because the workflow handles deployment credentials and external telemetry. Prohibit edits and recursive fan-out; give each the exact range and current clean worktree.
- [ ] Validate every finding against the current tree. For each material defect, write or amend a focused test to show RED, implement the minimum repair, rerun the affected check, and obtain one bounded re-review. Record unsupported/preference-only findings without code churn.
- [ ] Commit evidence-backed repairs with a message naming the actual correction.

### Task 7: Final verification and implemented-task review packet

**Files:**
- Create: `docs/review-packets/2026-08-11-production-observability-certification.md`
- Modify: `docs/superpowers/plans/2026-08-10-production-observability-certification.md`

**Interfaces:**
- Consumes: settled exact local Task 6B diff and every review disposition.
- Produces: one implemented-task review packet and explicit external stop gate.

- [ ] Run the settled focused suites, constitution/docs links, semantic naming, package boundaries, builder-core/CLI/public-package tests, admission, both closure policies, lint/build/typecheck, audit, signatures, fixed-root generated verification, changeset status, `git diff --check`, and exact branch/status/inventory checks. Do not repeat the unchanged real local journey.
- [ ] Record exact commands, exits, counts/durations where material, bounded claims, changed files, commits, reviewer dispositions, risks, deferred external work, and source/deployment/credential/provider/data rollback and recovery separately.
- [ ] State prominently that no workflow was dispatched, no provider or secret was mutated, no telemetry was transmitted, no cleanup was performed, no registry status changed, Task 6 remains unmerged/unpushed, and Task 6B is not certified.
- [ ] Commit final evidence with message `Record observability certification review`.
- [ ] Re-run only checks whose inputs changed in the evidence commit, then stop for explicit verified-final-diff approval. Do not merge, push, deploy, mutate providers, transition the registry, or begin a later task.
