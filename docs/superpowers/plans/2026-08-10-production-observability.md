# Production Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the P2 production-observability capability through a reviewed public-package release, actual generated `portfolio`/`site` integration, and a separately pending certification task, without installing analytics or performing an unapproved external action.

**Architecture:** A zero-runtime-dependency public package owns immutable provider-neutral operational events, bounded context, normalized error categories, redaction, non-throwing dispatch, Better Stack protocol encoding, structured-log/browser sinks, and test assertions. Generated Next.js/Cloudflare adapters inject runtime effects and keep Cloudflare types in infrastructure/composition roots. The public registry release is a hard gate: generated integration never uses a workspace/file/tarball substitute. The deployment capability continues to own the full Wrangler file while observability infers dependency-owned JSON values. A materially changed descriptor receives an ordinary pending certification record linked to a separate plan.

**Toolchain:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, Node test runner, Changesets `2.31.1`, npm `12.0.2`, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, Playwright `1.62.1`, Cloudflare Workers Logs/version metadata/secrets, and Better Stack HTTP ingestion.

## Approval and stop boundaries

The user's 2026-08-10 instruction preapproves this exact plan and evidence-backed exact-file amendments through implemented-task review. It does not authorize version materialization, package publication, commit integration to `main`, push, workflow dispatch, deployment, provider/source creation, secret or environment mutation, spending, production action, or certification.

The first execution batch ends after the public-package source candidate has passed independent review and has a review packet. Tasks 4 onward are blocked until the user approves that exact diff and separately authorizes the necessary release integration/push/publication actions. Do not make builder templates depend on an unpublished version.

## Global constraints

- Work only in the isolated `production-observability` worktree from planning base `c6617e5192e7e3a983a82d074791e451cfbe9bd7` until the publication gate is resolved.
- Keep runtime behavior provider-neutral. The public package imports no Next.js, React, DOM, Cloudflare, Node runtime, or Better Stack SDK dependency.
- Never emit raw `Error`, message, stack, cause, URL, pathname, query, referrer, headers, cookies, form values, email, IP address, user agent, console output, response body, credential, token, or arbitrary unvalidated attributes.
- Telemetry failures never fail an application request, render, or browser interaction.
- Keep analytics absent: no Cloudflare Web Analytics, GA4, Clarity, consent state, session replay, autocapture, console interception, or browser storage.
- Do not create a generic platform or database port, a second production adapter, database, queue, identity, provider resource, rate-limit resource, WAF rule, `apps/jobs`, later profile, migration command, or invented CRUD.
- Preserve the deployment capability's full-file ownership of `apps/web/wrangler.jsonc`; do not create overlapping managed surfaces.
- Capability state, fixtures, and checked schemas update only from successfully rendered, verified, and re-inferred output.
- Before each commit, verify branch/status, stage only intended paths, inspect the cached diff, and run `git diff --cached --check`.
- Use focused commits named for the actual behavior. No push, pull request, merge, publication, workflow dispatch, deployment, provider mutation, permission change, production action, or review-comment response is authorized.

## Exact file structure

### Planning and package source candidate

Create:

```text
docs/implementation-evidence/2026-08-10-production-observability-preparation.md
docs/superpowers/specs/2026-08-10-production-observability-design.md
docs/superpowers/plans/2026-08-10-production-observability.md
.changeset/add-production-observability.md
packages/observability/src/contracts.ts
packages/observability/src/events.ts
packages/observability/src/redaction.ts
packages/observability/src/dispatch.ts
packages/observability/src/server.ts
packages/observability/src/browser.ts
packages/observability/src/testing.ts
packages/observability/tests/contracts.test.mjs
packages/observability/tests/dispatch.test.mjs
packages/observability/tests/server.test.mjs
packages/observability/tests/browser.test.mjs
packages/observability/tests/testing.test.mjs
docs/implementation-evidence/2026-08-10-production-observability-package-verification.md
docs/review-packets/2026-08-10-production-observability-package.md
```

Modify:

```text
packages/observability/src/index.ts
packages/observability/package.json
packages/observability/README.md
packages/observability/tests/public-api.test.mjs
tests/package-boundaries/public-observability.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

Delete no published-history or license file. Do not materialize package versions or modify the lockfile in this batch unless the exact no-runtime-dependency manifest export change requires a mechanical lockfile update.

### Publication checkpoint

The separately authorized release batch may modify only after focused RED tests:

```text
.changeset/add-production-observability.md
.changeset/externalize-visible-copy.md
packages/observability/package.json
packages/observability/CHANGELOG.md
packages/standards/package.json
packages/standards/CHANGELOG.md
pnpm-lock.yaml
scripts/check-package-release.mjs
tests/package-boundaries/package-release.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
.github/workflows/package-release.yml
docs/implementation-evidence/2026-08-10-production-observability-package-release.md
docs/review-packets/2026-08-10-production-observability-package-release.md
```

Any release-tool amendment must preserve manual exact-main-commit dispatch, least privilege, trusted publishing/provenance, full verification, exact-version absence, cleanup, and both-package awareness.

#### Publication checkpoint amendment — 2026-08-10

The user's preapproved plan-amendment authority adds these direct release consumers after causal failures and independent review identified them:

```text
packages/standards/README.md
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/public-observability.test.mjs
tests/package-boundaries/public-standards.test.mjs
```

The three tests own exact public-manifest fixtures that must advance with the materialized package versions. The standards README is part of the published tarball and must describe the materialized copy API without claiming that external publication already occurred. The workflow's raw `changeset status` invocation is removed because Changesets correctly returns nonzero after it consumes the release files; the release-specific checker instead enforces the exact public package set, target versions, and absence of pending Changesets. The revoked bootstrap-token configuration path is removed so the release remains OIDC-only, while unconditional authentication cleanup is retained. The registry check must validate both exact prior version histories as well as target-version absence.

#### Post-publication evidence amendment — 2026-08-11

The user's instruction to continue after publication adds one dated evidence owner:

```text
docs/implementation-evidence/2026-08-11-production-observability-package-publication.md
```

The evidence reconciles the intervening fresh-checkout CI remediation, the exact successful publication commit and workflow attempt, both immutable registry histories, tarball inventory and integrity, provenance attestations, and fresh-consumer imports. The earlier release-candidate evidence and packet remain unchanged historical records.

### Generated capability integration after verified publication

Create:

```text
packages/builder-core/templates/common/apps/web/instrumentation.ts
packages/builder-core/templates/common/apps/web/instrumentation-client.ts
packages/builder-core/templates/common/apps/web/app/api/observability/route.ts
packages/builder-core/templates/common/apps/web/src/infrastructure/cloudflare/observability-context.ts
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/browser-reporter.ts
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/server-reporter.ts
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/web-vitals-reporter.tsx
docs/superpowers/plans/2026-08-10-production-observability-certification.md
docs/implementation-evidence/2026-08-10-production-observability-verification.md
docs/review-packets/2026-08-10-production-observability.md
```

Modify:

```text
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/catalog/verified-package-versions.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/templates/common/apps/web/package.json.template
packages/builder-core/templates/common/apps/web/wrangler.jsonc.template
packages/builder-core/templates/common/apps/web/app/layout.tsx
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/inference.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/certification.test.mjs
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
certifications/capabilities.json
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
scripts/verify-generated-skeletons.mjs
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/roadmaps/program-roadmap.md
README.md
```

Regenerate the three exact fixture trees from the production CLI only after the public packages resolve:

```text
fixtures/generated/portfolio/**
fixtures/generated/portfolio-calendly/**
fixtures/generated/site/**
```

`fixtures/generated/**` includes regenerated `.egeria/project.yaml`, `.egeria/state.json`, manifests, lockfiles, Wrangler configuration, package-owned and source-generated files, and the exact generated documentation. Never hand-edit retained fixture fingerprints or state.

No other file is in scope without a documented evidence-backed amendment.

#### Generated integration amendment — 2026-08-11

The user's preapproved plan-amendment authority adds this direct template-boundary consumer after the focused generation RED test exposed its exact inventory contract:

```text
packages/builder-core/templates/common/pnpm-workspace.yaml
packages/builder-core/AGENTS.md
packages/builder-core/README.md
tests/package-boundaries/private-packages.test.mjs
tests/capability-certification/certification-runner.test.mjs
tests/constitution/constitution.test.mjs
```

The generated workspace policy must also exempt the exact verified `@egeria-systems/observability@0.2.0` release from pnpm's otherwise strict 1,440-minute cooling period: official pnpm documentation permits version-specific `minimumReleaseAgeExclude` entries, and without the narrow exclusion real production generation fails closed immediately after the authorized release. The 1,440-minute policy remains enforced for all other dependency versions. Builder-core's nested instructions and README are canonical direct consumers of its recipe, package, generated-adapter, and certification-closure boundaries. The boundary test owns their recipe assertions and the allowlisted private template inventory. The certification runner owns the repository registry's admission and closure expectations; the new ordinary `pending` observability record must make both transition and all-certified closure fail until the separate certification task succeeds. The constitution test owns exact prose and command contracts for public-package publication, certification status, Cloudflare isolation, and retained-fixture verification, so those assertions must advance atomically with their canonical owners rather than preserving the superseded release and verification boundary.

## Task 1: Freeze preparation, design, and exact plan

- [x] Record branch/base/status, canonical sources, manifests, current descriptors/recipes/certification, prior packet conclusions, exact baseline behavior, official documentation, advisories, audits, contradictions, resolutions, authority boundary, and claim limits.
- [x] Record the selected architecture and rejected alternatives.
- [x] Record this exact-file plan, including the unavoidable public-package checkpoint and separate certification task.
- [x] Run documentation links/contracts, semantic naming, and `git diff --check`.
- [x] Commit only the preparation, design, and plan with message `Plan production observability`.

## Task 2: Implement the provider-neutral public contract with TDD

**RED files:** package tests plus exact package-boundary tests named above.

- [x] Add failing literal behavior tests for event vocabulary, ISO time, context-token bounds, immutable results, attribute allowlisting, prohibited and nested-value rejection, secret-like values, normalized error categories, and absence of raw error content.
- [x] Add failing tests proving one thrown/rejected sink cannot suppress another or escape dispatch, and every failure result is content-safe.
- [x] Add failing server tests for structured-object output, Better Stack host/token/request shape, payload bounds, documented success, status/fetch failure classification, and zero response/token/payload echo.
- [x] Add failing browser tests for the exact bounded envelope, unknown-field rejection, no raw error fields, injected delivery, and failure isolation.
- [x] Add failing testing-surface tests for memory capture, immutable snapshots, positive assertions, and stable content-safe assertion failures.
- [x] Add failing package-boundary tests for exact exports, source inventory, zero runtime dependencies, pack inventory, and concrete public consumer imports.
- [x] Run each focused RED test against real package output and record the expected missing-export or old-empty-contract failure before production edits.
- [x] Implement the minimum strict TypeScript source. Keep all platform effects injected and all public values readonly/frozen.
- [x] Export root, `./server`, `./browser`, and `./testing` explicitly. Update package documentation with examples that use fictional identifiers and no secrets.
- [x] Add one observability minor Changeset. Do not version or publish.
- [x] Run package build, tests, lint, typecheck, package boundaries, pack dry run, and Changesets status GREEN.
- [x] Make a focused DRY pass only for repeated validated transformations or result construction whose extraction materially improves maintenance.
- [x] Commit with message `Add operational telemetry contracts`.

## Task 3: Review and verify the public-package source candidate

**Comparison:** `c6617e5192e7e3a983a82d074791e451cfbe9bd7..HEAD`.

- [x] Dispatch one read-only requirements reviewer for the exact public-package obligations, privacy exclusions, zero dependency, release boundary, and unsupported claims.
- [x] Dispatch one read-only architecture/anti-overengineering reviewer for package/generated ownership, provider neutrality, API size, error/redaction model, runtime isolation, replacement, and analytics separation.
- [x] Dispatch one read-only test-evidence reviewer for causal RED/GREEN evidence, realistic mutations, public consumer/pack evidence, provider protocol boundaries, and claim calibration.
- [x] Prohibit edits and recursive fan-out; wait for every reviewer; validate findings against the current tree.
- [x] Repair only evidence-backed material defects through focused RED/GREEN cycles and rerun affected checks.
- [x] Run exact pinned package verification, root package boundaries, lint/build/typecheck, moderate dependency audits, registry signatures, Changesets status, semantic naming, docs links, and `git diff --check` once on the settled tree.
- [x] Record commands/results, changed files, reviewer dispositions, risks, deferred generated/provider behavior, and rollback in the package verification evidence and review packet.
- [x] Commit final package evidence with message `Record observability package review`.
- [x] Re-run only documentation/semantic/status checks affected by the evidence commit.
- [x] Stop for exact-diff approval and separate release authority. Do not begin Task 4 on an unpublished package.

## Task 4: Materialize and publish exact public releases — external gate

- [x] Require explicit user authorization for the exact source-candidate integration, push, and trusted-publication actions. Plan approval alone is insufficient.
- [x] Add focused failing release tests that replace initial-release assumptions with the exact approved standards and observability target versions, existing package histories, absent target versions, no unexpected public package, no pending Changeset after materialization, and sanitized network failures.
- [x] Run `changeset version` once and inspect both resulting package versions, changelogs, Changeset removal, and lockfile diff. Do not hand-edit version artifacts.
- [x] Update only the release checker/workflow behavior proven necessary for a subsequent two-package release; retain exact-main-commit dispatch, full verification, OIDC/provenance, least privilege, cleanup, and fail-closed registry checks.
- [x] Independently review the exact release candidate and stop for its verified-final-diff approval before push/publication.
- [x] After explicit publication authority, integrate the exact reviewed commits to `main`, push only that branch, dispatch only the manual exact-commit release workflow, and wait for completion.
- [x] Verify both exact registry artifacts, integrity, provenance/attestations, exports, pack inventory, and fresh consumer imports. Record any absence of provenance honestly.
- [x] Stop on an existing target version, unexpected package history/version, non-exact commit, missing environment protection, permission drift, audit failure, signature failure, publish retry request, or partial release. Never republish an immutable version.

## Task 5: Admit the material capability change before generated integration

### Installed standards version boundary amendment

The verified publication produced both public `0.2.0` artifacts, but public availability does not itself authorize an installed-capability change. Advancing the generated standards pin here would change the exact frozen standards certification subject before the separately planned generated unit/component testing increment admits that capability change. This task therefore advances only the installed observability pin to `0.2.0`; generated repositories retain exact `@egeria-systems/standards@0.1.0` until the standards-owned increment changes its descriptor, registry subject, recipes, and fixtures together. Package ownership documentation records both available public versions and this deliberate installed-version distinction.

**RED files:** builder-core catalog/resolution/render/inference/diagnostics/certification tests.

- [x] Add focused failing tests for the exact installed public package pins, recipe versions, descriptor version, security metadata, managed/application ownership, Wrangler JSON probes, required source files, verification plan, and absence of analytics/browser-storage/console capture.
- [x] Add a failing certification test proving the changed observability subject cannot retain `backfill-pending` and must link an ordinary `pending` record to a present separate task plan.
- [x] Implement the descriptor/version/recipe/registry changes and exact certification plan. Keep the sibling plan execution unapproved.
- [x] Generate checked JSON Schemas through the canonical script; never hand-edit generated schema JSON.
- [x] Run contracts, catalog, resolution, inference, diagnostics, certification, schema, and admission checks GREEN before template work.
- [x] Commit with message `Admit production observability capability`.

## Task 6: Generate server, browser, and Cloudflare composition with TDD

**RED files:** render, generation, template-boundary, fixture-contract, and browser tests.

- [x] Add focused failing tests for exact template destinations, package manifests, Workers Logs configuration, head sampling, version metadata, required secret names, adapter-only Cloudflare imports, server failure isolation, Next server-error registration, bounded same-origin browser error payloads, web-vitals registration, no raw/private fields, no browser storage, and analytics absence.
- [x] Add mutation cases for cross-origin, oversized, wrong-content-type, malformed, extra-field, invalid-vocabulary, secret-bearing, and transport-failure inputs.
- [x] Implement the minimum templates and composition. Keep presentation pure; the web-vitals side effect remains infrastructure-owned.
- [x] Use Cloudflare execution-context lifetime extension for provider delivery; do not block or fail application behavior on telemetry delivery.
- [x] Render into temporary roots, infer, diagnose, diff, build, and exercise focused browser behavior before retaining any state/fixture update.
- [x] Commit with message `Generate production observability adapters`.

## Task 7: Regenerate immutable fixtures from production output

- [x] Run the production CLI twice for every fixture identifier under approved registry access and compare exact byte snapshots before changing committed fixtures.
- [x] Replace fixture trees only with successful production output. Verify state is written last, installed capability versions/recipe versions match, all managed-surface fingerprints agree, inference is unambiguous, diagnostics are healthy, and diff is empty.
- [x] Run frozen install, audits, signatures, lint, typecheck, Next build, OpenNext build, Wrangler type generation, development browser suite, and workerd-preview browser suite through the existing fixed verifier.
- [x] Do not claim deployed, Better Stack, Workers Logs UI, visual, performance, human accessibility, production, or WCAG evidence.
- [x] Commit with message `Refresh observable portfolio fixtures`.

## Task 8: Reconcile canonical documentation

- [x] Update package ownership, architecture overview, capability model, enforcement map, program roadmap, root README, and generated instructions/readmes only where they directly consume the implemented behavior.
- [x] Link canonical owners instead of copying descriptor, schema, security, or lifecycle rules.
- [x] Mark production-observability implementation as awaiting Task 6B certification. Do not mark P2 or the capability certified.
- [x] Record public-package provenance/integrity, local runtime/browser evidence, claim limits, residual unauthenticated-endpoint risk, and provider/deployment/certification deferral.
- [x] Run documentation links/contracts and semantic naming GREEN.
- [x] Commit with message `Document production observability`.

## Task 9: Independent final review and bounded repair

**Comparison:** exact post-publication implementation base through `HEAD`, recorded before dispatch.

- [ ] Dispatch one read-only requirements reviewer for every Task 6 behavior, package release, profile/capability/state agreement, privacy exclusion, external boundary, and claim limit.
- [ ] Dispatch one read-only architecture/anti-overengineering reviewer for functional-core/imperative-shell design, public/generated ownership, Cloudflare isolation, narrow ports, no overlap, no analytics, package replaceability, lifecycle, and low-churn scope.
- [ ] Dispatch one read-only test-evidence reviewer for causal TDD, package/provider contract evidence, actual production generation, inference/state/diff, fixed installs/builds, browser behavior, negative privacy cases, and unsupported claims.
- [ ] Add one security/privacy specialist because this increment handles public telemetry input and bearer credentials. Review secret placement, exfiltration, injection, origin/size/schema bounds, data minimization, error/response leakage, abuse/cost risk, and dependency/advisory evidence.
- [ ] Prohibit edits and recursive fan-out; wait for every result; validate every finding against the current tree.
- [ ] Repair only evidence-backed material defects using focused RED/GREEN cycles, rerun affected checks, and record every disposition.
- [ ] Use no more than one bounded final recheck unless a repaired material defect directly requires it.

## Task 10: Final verification and implemented-task review packet

- [ ] Run `git diff --check`, semantic naming, documentation/constitution, package boundaries, observability package verification, builder-core, CLI, certification admission, generated-fixture tests, builder lint/build/typecheck, fixed-root full generated verification, moderate root/production audits, registry signatures, and Changesets status on the settled tree.
- [ ] Do not repeat an unchanged successful expensive check. Record exact command, exit, relevant count, duration where material, and bounded claim.
- [ ] Verify branch/status, exact base/head comparison, changed-file inventory, ignored/untracked artifacts, public registry versions/integrity/provenance, registry subject/status, and no analytics/provider/deployment mutation beyond the separately authorized package release.
- [ ] Record reviewer dispositions, known risks, deferred protected-staging/provider certification, source/package/provider/credential recovery domains, and no-WCAG/no-production claim.
- [ ] Commit final verification and review packet with message `Record production observability review`.
- [ ] Re-run only final-tree identity/status and documentation/semantic checks affected by the evidence commit.
- [ ] Stop for explicit implemented-task review. Do not execute the sibling certification plan or begin the next P2 increment.
