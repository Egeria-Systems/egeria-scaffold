# Generated Browser-Testing Foundation Design

**Status:** Advance-approved for implementation through the implemented-task review gate

**Date:** 2026-08-10

## Goal

Make the actual builder generate one reusable Playwright and axe foundation for both current materialized profiles. The foundation must distinguish Next.js development, OpenNext/workerd preview, and an explicitly supplied HTTPS deployed URL; exercise the accepted content and accessibility behaviors without depending on fixture copy; and provide a minimal immutable, least-privilege quality workflow. The fixed-root fixture verifier must certify both local server modes while ordinary new-project generation retains its current static/build-only receipt.

## Selected capability boundary

Evolve the existing `standards` capability from package-backed delivery to hybrid delivery. It already owns generated TypeScript, ESLint, and visible-copy quality policy. It therefore gains cohesive ownership of generated browser-quality package properties, scripts, configurations, starter specification, and CI workflow while retaining `@egeria-systems/standards@0.1.0` as its ordinary replaceable package-backed portion.

The capability version advances to `0.2.0`. Both profile recipes advance to `0.5.0`. No capability is added, and no public browser-testing package is extracted. The proof remains a non-product reference and is never imported, copied at runtime, or added as a dependency.

## Alternatives considered

### Selected: hybrid `standards`

This gives one current owner to quality policy spanning package code and generated repository files. Exact package and script properties remain merge-managed; configuration, specification, and workflow files remain managed or application-owned according to their expected evolution.

### Rejected: a `testing` capability

Browser testing is mandatory for both current recipes and has no demonstrated independent selection, removal, or migration lifecycle. A seventh executable capability would be speculative and would violate the current bounded catalog.

### Rejected: a public testing package

The profile-specific server commands, project paths, content behavior, and workflow are generated repository concerns. There is no second independent consumer or evidence gate supporting extraction.

### Rejected: importing the compatibility proof

The proof is deliberately outside product architecture. Importing it would turn historical evidence into a production dependency and couple generated projects to repository-only paths.

## Generated file and script contract

Every generated repository gains:

```text
.github/workflows/quality.yml
apps/web/playwright.config.shared.ts
apps/web/playwright.dev.config.ts
apps/web/playwright.preview.config.ts
apps/web/playwright.deployed.config.ts
apps/web/tests/e2e/site-quality.spec.ts
```

`apps/web/package.json` gains exact development dependencies `@playwright/test@1.62.1` and `@axe-core/playwright@4.12.1`, plus semantic scripts for:

- installing Chromium explicitly for local use;
- installing Chromium plus operating-system dependencies in CI;
- running development-mode tests;
- running OpenNext/workerd preview tests; and
- running deployed-mode tests.

The root manifest remains builder-owned and unchanged. Generated documentation invokes the web-workspace scripts with `pnpm --dir apps/web`, avoiding duplicate command ownership. Existing builder ownership of `/scripts` in the web manifest is decomposed into exact builder-owned script properties so the standards capability can own only the new quality script properties without overlapping JSON Pointer targets.

`.gitignore` gains `playwright-report/` and `test-results/`. Those lines remain part of the builder-owned generated ignore file; capability ownership does not need to fragment a text file merely to claim every line.

## Environment-specific configuration

One shared factory owns the test directory, output and HTML report directories, a single Chromium project using Playwright's desktop Chrome device profile, non-parallel file execution, `forbidOnly` in CI, one retry in CI, exactly one CI worker, and retained trace, screenshot, and video evidence on failure.

Development configuration uses `http://127.0.0.1:3100` and starts `next dev` through the generated script with an explicit loopback hostname and port. Preview configuration uses `http://127.0.0.1:3101` and starts the generated OpenNext preview script, which builds first and then runs Wrangler/workerd on the distinct loopback port. Both set `reuseExistingServer: false`, preventing ambient processes from satisfying certification.

Deployed configuration reads only `PLAYWRIGHT_DEPLOYED_URL`. It fails closed with stable, content-free errors when the value is missing, unparsable, non-HTTPS, contains credentials, or contains a fragment. It starts no local server. The configuration is imported and tested statically during builder verification, but no live deployed target is called in this increment.

## Content-agnostic starter specification

The single semantic starter specification does not assert fixture names, headings, paragraphs, or URLs. It discovers same-origin navigable paths from rendered anchors and applies a bounded set of checks to the landing page and discovered internal pages.

It verifies:

- a visible `main`, exactly one visible level-one heading, non-empty visible heading text, and visible content;
- internal navigation where links are present, with successful navigation and retained main content;
- no failed main document response, uncaught page error, or console error during each checked page load;
- no axe violations in the selected WCAG 2.0 A/AA, 2.1 A/AA, and 2.2 AA tags;
- keyboard Tab reaches a visible focusable element;
- the focused element has a computed visible outline or box shadow rather than merely existing in the focus order;
- no document-level horizontal overflow at a 320 CSS-pixel viewport; and
- reduced-motion media matches and leaves no nonzero animation or transition duration in the main content tree.

Navigation discovery excludes external origins, hash-only destinations, downloads, non-HTTP schemes, and duplicate paths. The suite remains intentionally small and serial. It is a starter contract for current generated content, not a crawler, visual test, performance harness, or conformance evaluator.

## Generated GitHub Actions workflow

The generated workflow is test-only. It runs for pull requests and pushes to `main`, uses `permissions: contents: read`, disables checkout credential persistence, groups by workflow and ref, cancels superseded runs, uses `ubuntu-24.04`, and has a bounded job timeout.

All third-party actions use exact verified commit SHAs. pnpm setup supplies exact `pnpm@11.20.0` and `node@22.23.2` without an implicit install. The workflow then performs:

1. `pnpm install --frozen-lockfile`;
2. explicit Chromium plus operating-system dependency installation;
3. current static/build gates through `pnpm run verify`;
4. development browser tests;
5. OpenNext/workerd preview browser tests; and
6. failure-only upload of Playwright reports and test results with a seven-day retention period.

The browser steps use the configuration's deterministic single CI worker. No secrets, environments, write permissions, deployment, release, production URL, cache mutation, or hosted proof claim are added.

## Security metadata and state

`standards` declares `PLAYWRIGHT_DEPLOYED_URL` as an environment variable, the Playwright browser distribution endpoint as an external domain, explicit browser-binary installation and browser-process execution as privileged operations, seven-day CI failure-artifact retention, and elevated threat review. It declares no secret, browser storage, application data classification, provider resource, or CSP contribution.

New merge-managed surfaces cover exact development dependency and script properties. File surfaces cover all four configurations, the starter specification, and the generated workflow. Each new surface has a matching package, JSON-property, or file inference probe. Fingerprints flow through existing state materialization, canonical state serialization, and inference/doctor/diff without a new schema concept.

The profile schema adds retained recipe version `0.5.0`; checked project/state schemas are regenerated from runtime owners. Generated state, migration records, manifests, inventories, and lockfiles update atomically with the recipe/capability contracts.

## Builder verification split

The ordinary `create` command still prepares a lockfile and verifies the exact existing ordered receipt:

```text
lockfile
frozen-install
lint
typecheck
next-build
opennext-build
```

Tests explicitly protect that receipt from browser checks. This keeps browser installation and server execution outside normal project-generation receipts.

The fixed-root `verify-generated-skeletons.mjs` certification expands its exact command contract to install Chromium explicitly and then run both development and preview Playwright suites for each immutable fixture copy. Each profile gets distinct HOME, temporary, XDG cache, pnpm store, Playwright browser, Playwright artifact, and server state. Profiles are certified sequentially with fixed ports, so no server or browser process can be reused across copies.

The fixture verifier still installs, audits, checks registry signatures, lints, typechecks, and performs Next/OpenNext builds. Browser installation is not hidden in `pnpm install`, package lifecycle scripts, or ordinary fixture inspection.

## Documentation and claim language

Generated README and web instructions explain:

- the explicit browser-install prerequisite;
- development, preview, and HTTPS deployed commands;
- the difference between Next.js development and OpenNext/workerd preview;
- the required deployed URL validation;
- ignored reports and failure artifacts; and
- the bounded nature of axe and browser automation.

They state that automation can identify regressions and selected barriers but cannot establish WCAG conformance, assistive-technology compatibility, or human usability.

## Verification design

TDD starts with focused failures for exact versions, hybrid ownership, security metadata, packages/scripts/configuration/workflow files, deployed URL validation, content-agnostic specification behavior, workflow supply-chain controls, fixture inventories, state/inference agreement, isolated certification state, and the unchanged ordinary-generation receipt.

GREEN requires focused builder-core and boundary tests, schema generation, exact fixture regeneration twice per profile, byte equality, read-only inference/doctor/diff, frozen installs, audit and signature checks, lint, typecheck, Next/OpenNext builds, explicit Chromium installation, and development plus preview browser suites for both profiles. The complete builder-kernel aggregate runs once on the settled tree.

Independent requirements, architecture/anti-overengineering, and test-evidence reviewers inspect the exact implementation comparison. Evidence-backed material findings receive a focused failing test and bounded repair before final verification and packet preparation.

## Non-goals

Do not add Calendly, deployment execution, hosted-CI proof, credentials, provider resources, cross-browser expansion, visual regression, performance budgets, release workflows, production claims, a human-review release gate, a WCAG claim, a testing capability, a testing package, proof imports, ordinary-generation browser receipts, an existing-repository migration, persistence, email, jobs, identity, payments, analytics, or `apps/jobs`.

## Recovery

Rollback uses focused newest-first reverts followed by schema and fixture regeneration and complete builder-kernel verification. Source rollback removes the new package and script properties, configuration/specification/workflow files, ignore/documentation additions, standards metadata/version changes, recipe versions, and derived fixture state/lockfiles together. The published standards package remains unchanged. No deployed environment, credentials, provider state, persistent data, hosted workflow, or production recovery applies.
