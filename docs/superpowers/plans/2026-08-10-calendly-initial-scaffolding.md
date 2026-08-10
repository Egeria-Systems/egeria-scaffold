# Calendly Initial-Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize the independently selectable `booking-calendly` capability during initial portfolio/site scaffolding with strict state, externalized copy, link/inline/popup presentation, lazy provider loading, accessible fallback, and retained deterministic portfolio evidence.

**Architecture:** Extend the existing requested-capability resolver boundary rather than adding a generic settings framework. Store one strict capability-owned settings object in `.egeria/project.yaml`. Conditionally overlay only the home composition root and generate capability-specific copy, reader, settings, client presentation, and browser test. Use Calendly's documented direct iframe inside the cross-origin boundary; use native `dialog` for popup presentation and keep an ordinary anchor as the no-JavaScript/unsupported-browser fallback.

**Toolchain:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, Zod `4.4.3`, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, Playwright `1.62.1`, axe Playwright `4.12.1`, Chromium, Node test runner, YAML `2.9.0`, Tailwind CSS `4.3.3`, and PostCSS `8.5.26`.

## Global constraints

- Work on clean sequential local `main` frozen at planning base `02ec5eb12741c1622beec02529c38965e7501d68`; do not touch separate worktrees.
- Keep executable profiles limited to `portfolio` and `site`; add only `booking-calendly@0.1.0` as the seventh executable capability.
- Keep portfolio/site recipe `0.5.0` defaults unchanged. Calendly is selected explicitly and becomes authoritative only when materialized.
- Accept only paired `--calendly-url` and `--calendly-mode` initial-scaffolding arguments. Do not add prompts, a generic capability-settings CLI, later-add commands, or existing-repository mutation.
- Accept only `link`, `inline`, and `popup`, and only validated bounded HTTPS Calendly destinations without query strings. Never echo rejected destinations in issues or CLI errors.
- Keep all visible/translatable booking copy in validated YAML. Keep presentation pure except for the bounded booking client component's intersection, modal, and frame lifecycle.
- Load no Calendly host-page script. Do not add a package dependency, public package, provider adapter, provider API, webhook, event listener, analytics hook, cookie/consent system, generic integration abstraction, generic platform port, or generic database port.
- Keep Cloudflare types and bindings out of domain, content, and presentation source.
- Use the retained popup fixture as representative risk evidence; cover all three modes in deterministic contract tests without multiplying expensive full fixture matrices.
- Treat Playwright/axe results as bounded local evidence. Do not claim Calendly behavior, real booking success, hosted CI, deployment, visual quality, human usability, assistive-technology compatibility, production safety, or WCAG conformance.
- Do not perform protected-staging deployment, workflow dispatch, Calendly event/account changes, synthetic bookings, provider cleanup, or any external mutation without separate explicit authority.
- Before each commit, verify branch/status, stage only intended paths, inspect the cached diff, and run `git diff --cached --check`.
- No push, pull request, merge, publication, deployment, provider mutation, production action, permission change, external message, or review-comment response is authorized.

## Exact file structure

Create capability templates:

```text
packages/builder-core/templates/booking-calendly/apps/web/app/page.tsx
packages/builder-core/templates/booking-calendly/apps/web/content/en-CA/booking-calendly.yaml
packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts
packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template
packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx
packages/builder-core/templates/booking-calendly/apps/web/tests/e2e/calendly-booking.spec.ts
```

Modify runtime contracts, generation, and CLI:

```text
packages/builder-core/src/contracts/project.ts
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/generation/render-skeleton.ts
packages/builder-core/src/generation/render-template.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/generation/write-generated-project.ts
packages/builder-core/src/index.ts
apps/cli/src/arguments.ts
apps/cli/src/run-cli.ts
```

Modify common generated composition/copy guidance and root lint coverage:

```text
packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/README.md.template
eslint.config.mjs
package.json
```

Update deterministic tests, schema artifacts, inventories, and certification:

```text
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/schemas/project.schema.json
apps/cli/tests/cli.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/internal-linting.test.mjs
tests/package-boundaries/public-standards.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
scripts/verify-generated-skeletons.mjs
```

Create the retained representative fixture with the verifier-declared exact inventory:

```text
fixtures/generated/portfolio-calendly/.egeria/migrations.jsonl
fixtures/generated/portfolio-calendly/.egeria/project.yaml
fixtures/generated/portfolio-calendly/.egeria/state.json
fixtures/generated/portfolio-calendly/.github/workflows/quality.yml
fixtures/generated/portfolio-calendly/.gitignore
fixtures/generated/portfolio-calendly/.nvmrc
fixtures/generated/portfolio-calendly/AGENTS.md
fixtures/generated/portfolio-calendly/README.md
fixtures/generated/portfolio-calendly/apps/web/AGENTS.md
fixtures/generated/portfolio-calendly/apps/web/app/globals.css
fixtures/generated/portfolio-calendly/apps/web/app/layout.tsx
fixtures/generated/portfolio-calendly/apps/web/app/page.tsx
fixtures/generated/portfolio-calendly/apps/web/content/content.config.yaml
fixtures/generated/portfolio-calendly/apps/web/content/en-CA/booking-calendly.yaml
fixtures/generated/portfolio-calendly/apps/web/content/en-CA/long-form/introduction.md
fixtures/generated/portfolio-calendly/apps/web/content/en-CA/site.yaml
fixtures/generated/portfolio-calendly/apps/web/eslint.config.mjs
fixtures/generated/portfolio-calendly/apps/web/next.config.ts
fixtures/generated/portfolio-calendly/apps/web/open-next.config.ts
fixtures/generated/portfolio-calendly/apps/web/package.json
fixtures/generated/portfolio-calendly/apps/web/playwright.config.shared.ts
fixtures/generated/portfolio-calendly/apps/web/playwright.deployed.config.ts
fixtures/generated/portfolio-calendly/apps/web/playwright.dev.config.ts
fixtures/generated/portfolio-calendly/apps/web/playwright.preview.config.ts
fixtures/generated/portfolio-calendly/apps/web/postcss.config.mjs
fixtures/generated/portfolio-calendly/apps/web/src/content/content-schema.ts
fixtures/generated/portfolio-calendly/apps/web/src/content/content-source.d.ts
fixtures/generated/portfolio-calendly/apps/web/src/content/read-content.ts
fixtures/generated/portfolio-calendly/apps/web/src/infrastructure/observability/installed-capability.ts
fixtures/generated/portfolio-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts
fixtures/generated/portfolio-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts
fixtures/generated/portfolio-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx
fixtures/generated/portfolio-calendly/apps/web/src/presentation/content-page.tsx
fixtures/generated/portfolio-calendly/apps/web/src/sections/section-registry.tsx
fixtures/generated/portfolio-calendly/apps/web/tests/e2e/calendly-booking.spec.ts
fixtures/generated/portfolio-calendly/apps/web/tests/e2e/site-quality.spec.ts
fixtures/generated/portfolio-calendly/apps/web/tsconfig.json
fixtures/generated/portfolio-calendly/apps/web/wrangler.jsonc
fixtures/generated/portfolio-calendly/package.json
fixtures/generated/portfolio-calendly/pnpm-lock.yaml
fixtures/generated/portfolio-calendly/pnpm-workspace.yaml
```

Update only the enumerated common composition/guidance bytes and their required ownership records in the two existing retained fixtures:

```text
fixtures/generated/portfolio/README.md
fixtures/generated/portfolio/apps/web/AGENTS.md
fixtures/generated/portfolio/apps/web/src/presentation/content-page.tsx
fixtures/generated/portfolio/.egeria/state.json
fixtures/generated/site/README.md
fixtures/generated/site/apps/web/AGENTS.md
fixtures/generated/site/apps/web/src/presentation/content-page.tsx
fixtures/generated/site/.egeria/state.json
```

Modify canonical/current documentation and create final evidence:

```text
README.md
CONTRIBUTING.md
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/roadmaps/program-roadmap.md
packages/builder-core/AGENTS.md
packages/builder-core/README.md
apps/cli/README.md
tests/constitution/constitution.test.mjs
docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-preparation.md
docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-verification.md
docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-review-packet.md
docs/superpowers/specs/2026-08-10-calendly-initial-scaffolding-design.md
docs/superpowers/plans/2026-08-10-calendly-initial-scaffolding.md
```

Do not touch any other existing `fixtures/generated/portfolio` or `fixtures/generated/site` byte. The listed common output files may change only for the typed composition child and generated booking guidance; the two listed state files may change only for those exact fingerprints and the home-route ownership transfer. All other bytes must reproduce exactly. No other file is in scope without a documented preapproved plan amendment.

## Task 1: Freeze preparation, design, and plan

- [x] Record dated preparation evidence, source/provider review, clean base, exact baseline, consolidated uncertainty, claim limits, and selected design.
- [x] Record the strict selection/state contract, direct-iframe/native-dialog design, ownership decision, browser contract, and external certification handoff.
- [x] Update the program roadmap to record the browser-testing approval implied by selecting Task 5 and mark Calendly implementation in progress.
- [x] Update the constitution's canonical-roadmap assertion for the approved browser-testing artifact and current Calendly preparation state.
- [x] Run documentation/semantic checks and commit with message `Plan Calendly initial scaffolding`.

## Task 2: Add strict selection, state, and capability contracts

**RED files:** contract/resolution/generation/CLI tests listed above.

- [x] Add focused failing tests for the seventh descriptor; dependency-first optional resolution; unchanged default recipes; strict settings/capability parity; all three modes; URL hostname/protocol/path/credentials/query/fragment/whitespace/length rejection; sanitized failures; paired CLI arguments; exact generated request keys; and no-selection compatibility.
- [x] Run the smallest targeted tests and record the expected assertion failures before production edits.
- [x] Implement `CalendlyBookingSettings`, the strict optional project settings object, `booking-calendly@0.1.0`, optional request resolution, CLI parsing/forwarding, and generated JSON Schema.
- [x] Keep project schema version and profile recipe version at `1.0.0` and `0.5.0`; add no package version.
- [x] Run contract, resolution, generation, CLI, schema, semantic-naming, and package-boundary checks GREEN.
- [x] Commit with message `Add Calendly scaffold contracts`.

## Task 3: Generate bounded link, inline, and popup presentation

**RED files:** rendering, copy, inventory, and browser contract tests listed above.

- [x] Add focused failing tests for conditional template selection, exact generated settings bytes, JSON-safe token insertion, strict externalized copy parsing, all three presentation modes, unchanged unselected file sets, home-root ownership transfer, capability surfaces/probes, copy-lint coverage, and Cloudflare-boundary purity.
- [x] Run the smallest targeted tests and record the expected assertion failures before template edits.
- [x] Add the six capability template files. Keep booking content application-owned, settings managed, and all visible strings in YAML.
- [x] Add typed React children to `ContentPage`; keep it pure. Keep observer/dialog/frame lifecycle inside `CalendlyBooking`.
- [x] Implement normal link fallback, intersection-activated inline iframe, activation-bound native popup dialog, cross-origin referrer policy, close cleanup, focus/reflow styling, and unsupported-API fallback.
- [x] Extend both the root copy-lint command glob and ESLint configuration scope to integration TSX templates, and update generated guidance.
- [x] Run builder rendering tests, copy lint, source lint, typecheck, semantic naming, and package-boundary inventory GREEN.
- [x] Commit with message `Generate Calendly booking presentation`.

## Task 4: Retain and certify the representative generated project

- [x] Add the `portfolio-calendly` fixture contract with the exact paired CLI arguments, capabilities, settings, files, versions, ownership count, and unique verification roots/artifact state.
- [x] Add RED tests proving the three-fixture harness stays deterministic, identity-bounded, source-immutable, and content-safe, and that verifier output distinguishes unique fixture identifiers while retaining unique profile reporting.
- [x] Generate the fixture twice through the compiled CLI in absent temporary destinations, require byte identity, inspect the exact diff, and replace only the declared committed fixture root.
- [x] In the capability-owned Playwright spec, intercept Calendly, prove no eager request, prove popup activation/close and 320-pixel containment, prove the anchor fallback with JavaScript disabled, and run the selected axe rules with the dialog open.
- [x] Run deterministic fixtures, read-only infer/doctor/diff, frozen install, audits/signatures, lint, typecheck, Next/OpenNext builds, and development/preview Chromium suites for all three fixture contracts.
- [x] Commit with message `Certify generated Calendly booking`.

## Task 5: Reconcile canonical documentation

- [x] Update the executable count, capability/settings behavior, ownership, inference, verification, security/privacy boundary, iframe/dialog design, fixture role, claim limits, rollback separation, and current P2 status in every listed canonical/current document.
- [x] State explicitly that provider configuration/data are not managed and protected-staging/provider-confirmed certification remains unexecuted and separately authorized.
- [x] Run documentation links/contracts, semantic naming, and targeted package-boundary assertions GREEN.
- [x] Commit with message `Document Calendly scaffold boundaries`.

## Task 6: Independent review and bounded repair

**Comparison:** planning base `02ec5eb12741c1622beec02529c38965e7501d68..HEAD` plus current uncommitted final evidence.

- [x] Dispatch one read-only requirements reviewer for exact acceptance criteria, initial-scaffolding scope, fallback/lazy modes, state/settings agreement, certification boundary, exclusions, and claim language.
- [x] Dispatch one read-only architecture/anti-overengineering reviewer for capability cohesion, managed/application ownership, URL/token safety, provider/privacy isolation, home composition, package non-extraction, and later-stage exclusion.
- [x] Dispatch one read-only test-evidence reviewer for causal RED/GREEN evidence, all-mode contract coverage, representative browser behavior, third-party stubbing, fixed-root isolation, deterministic fixture/state evidence, and claim support.
- [x] Give each reviewer an exact non-overlapping role and scope, prohibit edits and recursive fan-out, wait for every result, and validate every finding against the current tree.
- [x] For each material validated defect, add a focused failing regression test, implement the minimum repair, rerun affected checks, and record disposition. Do not change code for unsupported or preference-only findings.
- [x] Commit evidence-backed repairs, if any, with a message naming the actual correction.

## Task 7: Final verification, packet, and stop gate

- [x] Run `git diff --check`, semantic naming, constitution, package boundaries, builder-core, CLI, generated-fixture tests, builder lint/build/typecheck, root audit/signatures, fixed-root full certification, and changeset status on the settled tree.
- [x] Do not repeat an unchanged successful expensive check. Record exact command, exit, relevant count, and bounded claim for each result.
- [x] Verify branch/status, exact comparison, changed-file inventory, ignored/untracked artifacts, and no changes in separate worktrees.
- [x] Record exact capability/settings/fixture evidence, dependency/advisory results, reviewer dispositions, risks, deferred protected-staging/provider proof, source rollback, and separate provider cleanup.
- [x] Create the review packet for exact committed comparison `02ec5eb12741c1622beec02529c38965e7501d68..HEAD`.
- [x] Commit final evidence with message `Record Calendly scaffold verification`.
- [ ] Re-run only final-tree identity/status and documentation/semantic checks affected by the evidence commit.
- [ ] Stop and request explicit verified-final-diff approval. Do not begin a later P2 outcome.
