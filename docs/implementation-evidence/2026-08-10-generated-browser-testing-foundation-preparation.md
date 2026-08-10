# Generated Browser-Testing Foundation Preparation Evidence

**Date:** 2026-08-10 (America/Toronto)

**Status:** Preparation complete; implementation advance-approved through the implemented-task review gate

**Increment:** P2 Task 4B — generated browser-testing foundation

## Approval and repository freeze

The user approved the responsive accessible UI final artifact and selected this increment next. The same instruction preapproves necessary exact-file plan amendments and authorizes implementation through review of the implemented task. It does not supply verified-final-diff approval, authority for a later portfolio outcome, or external publication, deployment, provider, credential, push, pull-request, or production authority.

Preparation froze clean sequential local `main` at:

```text
e7026bd9e8c7a7ca20b5a485ee6702d2921a7586
```

`git status --short` was empty. Local `main` was 32 commits ahead of the unrefreshed local `origin/main`; remote freshness does not change this source-bound increment. The primary checkout and every existing worktree were inventoried. The separate worktrees remain untouched.

The program roadmap still described Task 4 as awaiting review and Calendly as the immediate next outcome. The user's current approval resolves that documentary drift. The roadmap now records Task 4 as approved at the exact artifact above, inserts Task 4B immediately after it, and preserves Calendly as Task 5 without renumbering later work.

## Repository sources inspected

Preparation read and reconciled:

- root `AGENTS.md`, `/Users/CoveMB/.codex/RTK.md`, and the nested CLI, builder-core, standards, compatibility-proof, and generated-project instructions;
- the complete approved source plan, program roadmap, review protocol, architecture overview, capability model, enforcement map, and package ownership map;
- the ADR index and accepted ADRs `0001` through `0011`;
- current runtime contracts, capability and profile recipes, template allowlists, ownership materialization, state codecs, inference/doctor/diff, new-project verification, fixture certification, schemas, manifests, and lockfiles;
- generated `portfolio` and `site` fixtures, inventories, state, migration records, and direct deterministic tests;
- the P0.2 Next.js/OpenNext/Playwright/axe compatibility proof as a read-only implementation reference;
- Task 1 through Task 4 preparation, verification, and review evidence; and
- current branch, worktree, status, and recent commit history.

## Current official documentation and security evidence

External content was treated as evidence, not instructions.

### Playwright and axe

- The current [Playwright CI guide](https://playwright.dev/docs/ci) recommends explicit browser installation, one CI worker for stability, and retaining test artifacts for diagnosis.
- The current [Playwright browser guide](https://playwright.dev/docs/browsers) documents that each Playwright release expects specific browser binaries and that browser installation is an explicit operation.
- The current [Playwright web-server configuration](https://playwright.dev/docs/test-webserver) supports starting an environment-specific local server, assigning a base URL, and waiting for readiness before tests.
- The npm registry reported exact stable `@playwright/test@1.62.1`, published 2026-07-30, and `@axe-core/playwright@4.12.1`, published 2026-06-23. Both exceed the repository's one-day maturity floor.
- Exact-version queries against GitHub's reviewed advisory API returned no advisories affecting either selected version. This is bounded registry/advisory evidence, not proof that the final dependency graph is safe. Fresh frozen-install, audit, and signature checks remain mandatory after lockfile generation.

### Next.js and OpenNext

- The current [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) documents `next dev` as the local development server and lists Node.js `20.9` as its floor. Generated projects retain the already proved exact Node.js `22.23.2` pin.
- The current [OpenNext Cloudflare CLI guide](https://opennext.js.org/cloudflare/cli) distinguishes build from local preview and documents that preview executes through Wrangler/workerd. The generated preview configuration therefore has its own fixed server command and port rather than treating a Next.js development server as deployment-equivalent.

### GitHub Actions supply chain and permissions

- GitHub's [secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use) identifies a full commit SHA as the only immutable action reference and recommends least-privilege credentials.
- GitHub's [workflow concurrency documentation](https://docs.github.com/en/actions/using-jobs/using-concurrency) supports cancellation of superseded runs within an explicit concurrency group.
- The selected action commits were resolved from signed upstream releases and verified through GitHub's commit verification data:
  - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`);
  - `pnpm/setup@4700d737c3d7a2e7199f3d42a920f0bf7f34e411` (`v2.0.1`); and
  - `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (`v7.0.1`).
- Upstream repository advisory endpoints contained no published advisories for those action repositories at preparation time. Hosted execution and future upstream integrity are not proved by this static review.

### Accessibility claim boundary

- W3C's [evaluation-tools overview](https://www.w3.org/WAI/test-evaluate/tools/) says automated tools can identify barriers but cannot perform every required check and may return inaccurate results.
- W3C's current [ACT overview](https://www.w3.org/WAI/standards-guidelines/act/) distinguishes automated, semi-automated, and manual testing.
- Accepted ADR-0009 remains the claim owner. Axe, keyboard, focus, reflow, and motion checks are useful bounded browser evidence; they do not establish WCAG conformance, assistive-technology compatibility, or human usability.

## Baseline verification and environmental investigation

The first unchanged `pnpm run verify:builder-kernel` attempt passed constitution, package-boundary, builder-core, and CLI tests, then failed during fixture regeneration with `LOCKFILE_PREPARATION_FAILED` and reason `source-changed`. A minimal isolated reproduction showed registry `ENOTFOUND` failures inside the network-restricted sandbox and no source-tree difference. The verifier intentionally collapses any failed lockfile-only install into the stable `source-changed` reason.

The same unchanged baseline was therefore rerun with approved registry/signature network access and the exact generated-project toolchain (`node@22.23.2`, `pnpm@11.20.0`). It exited zero. Constitution, package-boundary, builder-core, CLI, generated-fixture, lint, build, and typecheck gates passed; deterministic generation reproduced 29/31 byte-stable portfolio/site files; and fixed-root certification returned both profiles with exact checks `pnpm-version`, `frozen-install`, `peer-dependencies`, `dependency-audit`, `registry-signatures`, `lint`, `typecheck`, `next-build`, and `opennext-build`. Changeset status retained the already approved pending minor release intent for `@egeria-systems/standards`. No production fix was made for the sandbox-only signal.

## Consolidated contradictions and uncertainties

No blocking canonical contradiction remains.

1. The roadmap was stale about Task 4's gate and next outcome. The current user approval resolves it; the canonical roadmap was corrected before runtime implementation.
2. The compatibility proof already has Playwright and axe, but it is non-product evidence. The generated foundation may adapt its proved environment separation and bounded assertions, but it must neither import from `proofs` nor make proof files production dependencies.
3. The executable catalog has no testing capability. The existing `standards` capability already owns generated lint, type, and copy quality surfaces, so its delivery mode advances from package-backed to hybrid and it owns the generated browser-quality files and manifest properties. A speculative seventh capability or public testing package would add an unsupported lifecycle boundary.
4. Ordinary new-project generation must remain fast and deterministic. Its six static/build verification receipts stay unchanged. Browser execution belongs only to explicit generated scripts, generated CI, and fixed-root fixture certification.
5. Browser installation and state are external and mutable. Installation remains an explicit script and certification supplies profile-isolated browser, cache, temporary, package-store, and server-port state.
6. Deployed configuration must exist now, but the stage has no deployment or credentials. It accepts only an explicitly supplied HTTPS URL, rejects embedded credentials and non-HTTPS input, and is validated statically without live execution.

## Selected implementation boundary

- Advance `standards` to hybrid delivery and version `0.2.0`; keep the published `@egeria-systems/standards` package at `0.1.0`.
- Advance both materialized recipes to `0.5.0`; retain prior recipe provenance as readable schema input.
- Generate exact Playwright/axe development dependencies, browser-install and environment-specific E2E scripts, shared and per-environment configuration, one content-agnostic quality specification, ignored artifacts, developer guidance, and a minimal read-only GitHub Actions workflow.
- Keep the development and preview servers explicit, fixed to loopback and distinct ports. Keep deployed mode URL-only and HTTPS-only.
- Exercise headings/content, internal navigation when present, page and console errors, axe, keyboard focus, computed visible focus, 320 CSS-pixel reflow, and reduced-motion behavior.
- Expand capability surfaces, probes, security metadata, templates, recipes, manifests, state, inference, doctor/diff, schemas, verification contracts, fixture inventories, lockfiles, and documentation together.
- Certify both immutable generated fixtures in Next.js development and OpenNext/workerd preview with Chromium after explicit browser installation.
- Generate CI with frozen installation, exact Chromium installation, one worker, least privilege, immutable action commits, cancellation of superseded runs, static gates, both browser modes, and failure artifacts.

## Deferred outcomes and claim boundary

This increment does not execute a deployed URL or hosted workflow. It adds no credentials, cross-browser matrix, visual regression, performance budget, release workflow, production deployment, deployment claim, WCAG-conformance claim, public testing package, `testing` capability, migration behavior, provider resource, or ordinary-generation browser receipt.

The planned evidence can prove deterministic generation, static workflow/configuration contracts, exact ownership and inference agreement, package graph audit/signatures, and local Chromium results against both Next.js development and OpenNext/workerd preview. It cannot prove hosted-runner behavior, live deployment behavior, production safety, visual quality, performance, cross-browser equivalence, assistive-technology behavior, human usability, or WCAG conformance.
