# Generated Browser-Testing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and certify a reusable Playwright/axe foundation for both current profiles across Next.js development and OpenNext/workerd preview, while generating a validated HTTPS deployed-mode contract and minimal immutable read-only CI workflow.

**Architecture:** Advance the existing `standards` capability to hybrid ownership. It retains its public package and adds generated quality package/script properties, four Playwright configurations, one content-agnostic specification, and one generated workflow. Expand fixed-root fixture certification only; preserve the ordinary new-project verification receipt exactly.

**Toolchain:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, Next.js `16.3.0`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, Playwright `1.62.1`, axe Playwright `4.12.1`, raw-loader `4.0.2`, Chromium, Node test runner, and GitHub Actions pinned by full commit SHA.

## Global constraints

- Work on clean sequential local `main` frozen at planning base `e7026bd9e8c7a7ca20b5a485ee6702d2921a7586`; do not touch separate worktrees.
- Preserve exactly six executable capabilities and the two current materialized profiles.
- Do not import from `proofs`, extract a public package, or create a testing capability.
- Keep browser installation explicit. Use isolated HOME, temporary, XDG cache, pnpm store, Playwright browser, report, and server state for fixture certification.
- Run development and preview browser tests only in fixed-root certification and generated CI. Keep the exact ordinary generation receipt free of browser installation and execution.
- Accept deployed mode only through `PLAYWRIGHT_DEPLOYED_URL`; require HTTPS and reject credentials, malformed URLs, and fragments without echoing the input.
- Describe axe/browser results only as bounded evidence, never as WCAG conformance, assistive-technology, human-usability, hosted-CI, deployment, or production proof.
- Do not add deployment execution, hosted-CI proof, credentials, cross-browser testing, visual regression, performance budgets, release workflows, Calendly, provider state, or later-stage runtime code.
- Before each commit, verify branch/status, stage only intended paths, inspect the cached diff, and run `git diff --cached --check`.
- No push, pull request, merge, publication, deployment, workflow dispatch, provider mutation, production action, permission change, external message, or review-comment response is authorized.

## Exact file structure

Create generated templates:

```text
packages/builder-core/templates/common/.github/workflows/quality.yml.template
packages/builder-core/templates/common/apps/web/playwright.config.shared.ts
packages/builder-core/templates/common/apps/web/playwright.dev.config.ts
packages/builder-core/templates/common/apps/web/playwright.preview.config.ts
packages/builder-core/templates/common/apps/web/playwright.deployed.config.ts
packages/builder-core/templates/common/apps/web/tests/e2e/site-quality.spec.ts
```

Modify generated manifests, ignore rules, and guidance:

```text
packages/builder-core/templates/common/.gitignore.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/package.json.template
```

Modify runtime contracts, catalogs, ownership, rendering, and checked schemas:

```text
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/src/generation/render-template.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/generation/render-skeleton.ts
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
```

Modify direct tests and fixed-root certification:

```text
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/constitution/constitution.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
scripts/verify-generated-skeletons.mjs
```

Modify canonical and contributor documentation:

```text
README.md
CONTRIBUTING.md
packages/builder-core/README.md
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/roadmaps/program-roadmap.md
docs/implementation-evidence/2026-08-10-generated-browser-testing-foundation-preparation.md
docs/superpowers/specs/2026-08-10-generated-browser-testing-foundation-design.md
docs/superpowers/plans/2026-08-10-generated-browser-testing-foundation.md
```

Regenerate only derived committed files beneath:

```text
fixtures/generated/portfolio
fixtures/generated/site
```

Create settled verification and review evidence:

```text
docs/implementation-evidence/2026-08-10-generated-browser-testing-foundation-verification.md
docs/review-packets/2026-08-10-generated-browser-testing-foundation.md
```

Expected rendered template counts are 32/34, ownership descriptor counts are 68/70, installed state surface counts are 71/73, and committed fixture file counts are 36/38 for portfolio/site. Another direct current-contract consumer permits an appended exact-file plan amendment under the user's advance approval; unrelated scope stops execution.

**Exact-file amendment (2026-08-10):** The generated workflow requires GitHub's `${{ github.workflow }}` and `${{ github.ref }}` expressions, while the existing renderer deliberately rejects unapproved double-brace syntax. The workflow source therefore uses the normal `.template` suffix, and `render-template.ts` gains exactly two fixed, trusted workflow-expression tokens. They are not caller inputs and do not broaden user-controlled interpolation. The existing render-template tests in `render-skeleton.test.mjs` cover their exact output and preserve rejection of every other token.

**Runtime-certification amendment (2026-08-10):** The first workerd suite reached the generated server but returned HTTP 500 because `node:fs` attempted to read `/bundle/content/en-CA/site.yaml`. Next's current official Turbopack contract lists `raw-loader` as supported. Under the user's advance amendment approval, the exact scope therefore adds `packages/builder-core/templates/common/apps/web/src/content/content-source.d.ts`; modifies the existing common `next.config.ts`, `package.json.template`, `read-content.ts`, and site `about/page.tsx` templates; advances the directly changed `content-files`, `deployment-cloudflare`, and `site-routing` capability versions; and updates their exact catalog, tests, fixture state, lockfiles, architecture documentation, and evidence. No capability or public package is added, content remains externalized non-executable YAML/Markdown, and ordinary generation receipts remain unchanged.

## Task 1: Freeze preparation, roadmap, design, and exact plan

**Files:** preparation/design/plan and roadmap files listed above.

- [x] Record the unchanged complete baseline result using exact Node/pnpm versions and approved network access.
- [x] Confirm the roadmap records Task 4 approval at `e7026bd9e8c7a7ca20b5a485ee6702d2921a7586`, inserts Task 4B after it, and retains Calendly as Task 5.
- [x] Scan the three new documents for placeholder language and broken links.
- [x] Run `node --test tests/constitution/constitution.test.mjs tests/constitution/semantic-naming.test.mjs` and `git diff --check`.
- [x] Commit only preparation, design, plan, and roadmap with message `Plan generated browser quality`.

## Task 2: RED — specify capability, generated files, and unchanged receipt

**Files:** runtime/direct tests listed above, excluding generated fixtures.

- [x] Add failing profile-contract assertions accepting retained recipe `0.5.0` and rejecting a future value.
- [x] Add failing resolution assertions for `standards@0.2.0`, `deliveryMode: hybrid`, exact packages, security metadata, 13 added quality surfaces, matching probes, and expanded verification/documentation/recovery requirements.
- [x] Require exact standard packages `@playwright/test@1.62.1` and `@axe-core/playwright@4.12.1`, exact five quality script properties, four configuration files, one starter specification, and one workflow file.
- [x] Require builder ownership to replace the overlapping `/scripts` surface with exact existing script-property surfaces.
- [x] Require recipe `0.5.0`, rendered counts 31/33, descriptor counts 66/68, and installed state counts 69/71 before the runtime-certification amendment.
- [x] Add failing deployed-config tests for a valid normalized HTTPS URL and stable rejection of missing, malformed, HTTP, credential-bearing, and fragment-bearing values without source echo.
- [x] Add failing starter-specification assertions for generic headings/content, same-origin navigation, document response, page/console errors, axe tags, keyboard focus, computed visible focus, 320-pixel overflow, and reduced motion with no fixture copy.
- [x] Add failing workflow assertions for exact action SHAs, read-only permissions, disabled credential persistence, frozen install, exact toolchain, explicit Chromium installation, one-worker configuration, cancellation, static/development/preview gates, failure artifacts, and absence of secrets/deploy/release behavior.
- [x] Protect the exact six-item ordinary-generation verification receipt and assert that it contains neither browser install nor E2E checks.
- [x] Run the smallest focused Node test batch and capture failures only for the absent approved contracts.
- [x] Commit RED tests with message `Specify generated browser quality`.

## Task 3: GREEN — implement minimum generated browser foundation

**Files:** runtime, template, schema, and direct documentation files listed above, excluding fixtures/final evidence.

- [x] Add `0.5.0` to the profile recipe contract and advance both recipes.
- [x] Advance `standards` to `0.2.0` hybrid delivery with exact packages, metadata, managed surfaces, probes, verification, documentation, and recovery declarations.
- [x] Split only builder web-script ownership into exact existing script properties.
- [x] Add exact package dependencies and five semantic scripts to the generated web manifest; add ignored report/result paths.
- [x] Implement the shared one-Chromium deterministic configuration and distinct fixed-loopback development/preview configurations.
- [x] Implement deployed URL parsing as an exported pure function and fail closed at configuration loading.
- [x] Implement the content-agnostic site-quality specification and its bounded axe, error, navigation, focus, reflow, and motion checks.
- [x] Implement the immutable read-only test-only workflow with frozen installation, explicit Chromium installation, static/development/preview checks, cancellation, and failure artifacts.
- [x] Update generated README/instructions and canonical documentation with explicit installation, environment distinctions, isolation, and non-conformance language.
- [x] Regenerate checked schemas from runtime owners; never hand-edit generated schema output.
- [x] Run focused tests to GREEN, then lint/build/typecheck the modified builder boundaries.
- [x] Perform one bounded DRY/scope pass and remove only implementation duplication that provides clear maintenance benefit.
- [x] Commit implementation with message `Generate browser quality foundation`.

## Task 4: RED/GREEN — expand deterministic fixture certification

**Files:** generated fixture tests, verifier, and derived fixtures listed above.

- [x] Add RED assertions for exact fixture inventories, recipe/capability versions, state surfaces, package versions, scripts, workflow, configuration/specification files, and lockfile entries.
- [x] Add RED assertions that certification invokes exact Node/pnpm, explicit Chromium installation, development E2E, and preview E2E commands in order.
- [x] Require per-profile isolated HOME, temporary, XDG cache, pnpm store, Playwright browser path, Playwright artifacts, and fixed server state; forbid inherited cache/browser/server variables.
- [x] Preserve peer checks, advisory audit, registry signature checks, lint, typecheck, Next build, and OpenNext build.
- [x] Regenerate each profile twice through the compiled production CLI in absent temporary destinations and require byte-identical outputs before updating committed fixtures.
- [x] Update committed fixture roots mechanically from validated outputs, including generated lockfiles and `.egeria` fingerprints/state.
- [x] Run deterministic fixture tests, read-only infer/doctor/diff, and fixed-root certification for both profiles.
- [x] Confirm both development and OpenNext/workerd preview suites pass for both profiles with Chromium.
- [x] Commit derived fixtures and certification with message `Certify generated browser quality`.

## Task 5: Independent review and bounded repair

**Comparison:** planning base `e7026bd9e8c7a7ca20b5a485ee6702d2921a7586..HEAD` plus any current uncommitted final evidence.

- [x] Dispatch one read-only requirements reviewer for exact user acceptance criteria, exclusions, roadmap ordering, ownership/state agreement, and claim language.
- [x] Dispatch one read-only architecture/anti-overengineering reviewer for capability cohesion, proof isolation, package non-extraction, security boundaries, and ordinary-generation separation.
- [x] Dispatch one read-only test-evidence reviewer for causal RED/GREEN coverage, workflow static contracts, fixture isolation, and whether local evidence supports each claim.
- [x] Give reviewers exact scope/non-goals, prohibit edits and recursive fan-out, wait for every result, and validate every finding against the current tree.
- [x] For each material validated defect, add a focused failing regression test, implement the minimum repair, rerun affected checks, and record disposition. Do not change code for unsupported or preference-only findings.
- [x] Commit evidence-backed repairs, if any, with a message naming the actual correction.

## Task 6: Final verification, packet, and stop gate

**Files:** verification evidence and review packet listed above; plan checkbox updates if useful.

- [x] Run `git diff --check`, semantic naming, constitution, package boundaries, builder-core, CLI, generated fixture tests, builder lint/build/typecheck, fixed-root full certification, and changeset status on the settled tree.
- [x] Do not repeat unchanged successful expensive checks. Record exact command, exit, relevant count, and bounded claim for each result.
- [x] Verify clean branch scope, comparison, changed-file inventory, ignored/untracked artifacts, and no changes in separate worktrees.
- [x] Record dependency versions, audit/signature result, exact browser modes/profile matrix, workflow/deployed static validation, reviewer dispositions, risks, deferred work, and recovery.
- [x] Create the review packet for exact committed comparison `e7026bd9e8c7a7ca20b5a485ee6702d2921a7586..HEAD`.
- [x] Commit final evidence with message `Record generated browser quality verification`.
- [x] Re-run only final-tree identity/status and documentation/semantic checks affected by the evidence commit.
- [x] Stop and request explicit verified-final-diff approval. Do not begin Calendly or any later outcome.
