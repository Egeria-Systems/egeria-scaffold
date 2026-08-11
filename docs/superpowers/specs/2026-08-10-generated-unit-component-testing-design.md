# Generated Unit and Component Testing Design

**Status:** Implementation candidate awaiting verified-final-diff review under the approved 2026-08-11 independent-work exception; Task 6D certification remains separate

**Date:** 2026-08-10

## Goal

Make every generated project start with a fast, explicit unit and React component testing foundation while preserving the repository's existing boundary-specific evidence model. Add continuous-integration execution for the builder, CLI, public packages, compatibility proof, generated fixtures, and generated projects. Place property-based and Workers-runtime testing only where the roadmap first creates the behavior that justifies them.

## Selected staged design

Testing tools are selected by the runtime and claim boundary, not by a desire to standardize every repository surface on one runner.

| Code or behavior under test | Required tool | First owner or phase |
|---|---|---|
| Builder schemas, resolution, inference, generation, certification, and package contracts | Existing Node.js test runner | Current builder repository |
| CLI parsing and in-process/subprocess behavior | Existing Node.js test runner | Current private CLI |
| Builder state combinations and migration invariants | `fast-check` with the Node.js test runner | P3 lifecycle hardening |
| Generated pure TypeScript policies, parsers, transformations, and state transitions | Vitest Node project | P2 Task 6C |
| Generated synchronous React components, props, callbacks, and user-visible states | Vitest jsdom project with React Testing Library | P2 Task 6C |
| CSS layout, computed focus visibility, browser APIs, dialogs, iframes, async Server Components, routes, and complete user journeys | Existing Playwright development and OpenNext/workerd suites | Current generated browser foundation |
| Provider-neutral app use cases, ports, errors, and in-memory adapters | Generated Vitest Node project | P4 app-foundation |
| Direct D1, KV, R2, Queue, Durable Object, and Workers-runtime behavior | Workers Vitest integration | P5C application persistence, then later binding capabilities |
| Whole built Worker routes and cross-boundary composition | Wrangler `createTestHarness()` under a Node runner | P4 onward where a whole-Worker contract exists |
| Hosted, persistent-data, privileged, and provider-confirmed outcomes | Capability-specific certification | Existing certification lifecycle |

The builder, CLI, standards package, and observability package are not migrated from `node:test`. The private compatibility proof keeps ordinary Vitest and its existing built-Worker integration harness because it remains infrastructure evidence rather than generated product architecture.

## P2 Task 6C boundary

Task 6C normally follows production-observability Task 6 and its separate Task 6B certification. The user explicitly approved a narrow 2026-08-11 independent-work exception from clean `main@f4f682d4c711dc86a0158ab7f05393d5c33f0160`: Task 6 is the accepted direct predecessor, Task 6C uses its own isolated branch/worktree, Task 6B remains pending and unchanged, and later reconciliation requires separate review. Existing later task numbers remain unchanged.

Task 6C advances the existing hybrid `standards` capability because that capability already owns generated lint, type, Playwright, axe, and quality-workflow surfaces. It adds no selectable testing capability and no public testing runtime package. The capability gains exact ownership of:

- generated Vitest, Vite React, path-resolution, jsdom, and Testing Library development-dependency properties;
- exact unit, component, combined run, and watch script properties;
- one managed Vitest configuration with named Node and jsdom projects;
- one managed component setup file;
- application-owned starter unit and component specifications;
- generated root and scoped testing guidance; and
- explicit unit and component steps in the generated quality workflow.

Because the descriptor, evidence contract, managed surfaces, and generated behavior change materially, Task 6C replaces the old frozen `standards` certification subject with an ordinary pending subject linked to separate Task 6D. The standards capability and P2 cannot be accepted on Task 6C implementation evidence alone.

The independently frozen successor versions are `standards@0.3.0` and recipe `0.7.0`. Project/state schema remains `1.0.0`, public `@egeria-systems/standards@0.1.0` remains unchanged, and the final pending certification subject digest is recomputed only after the complete Task 6C behavior contract settles.

## Generated Vitest and Testing Library contract

The current validated Vitest reference is `4.1.10`, matching the compatibility proof. At Task 6C entry, all exact versions, peer requirements, Node engine requirements, registry signatures, and current advisories are revalidated together against the settled Node.js, pnpm, Next.js, React, TypeScript, and Playwright matrix. Generated manifests use exact versions, never `latest`, ranges, workspace links, local tarballs, or proof imports.

The generated development dependency set is:

- `vitest`;
- `@vitejs/plugin-react`;
- Vite 8 native `resolve.tsconfigPaths` configuration;
- `jsdom`;
- `@testing-library/react`;
- `@testing-library/dom`;
- `@testing-library/user-event`; and
- `@testing-library/jest-dom`.

One `apps/web/vitest.config.ts` defines two named projects:

1. `unit` uses the Node environment and includes only `tests/unit/**/*.test.ts`;
2. `component` uses jsdom, includes only `tests/component/**/*.test.tsx`, and loads the component setup file.

Tests import Vitest APIs explicitly. Global test APIs remain disabled. The component setup extends Vitest with `@testing-library/jest-dom/vitest` and performs explicit React Testing Library cleanup after each test. TypeScript includes both `.ts` and `.tsx` test sources.

The generated web manifest provides semantic commands for:

- all Vitest projects in deterministic run mode;
- the Node unit project only;
- the jsdom component project only;
- all projects in watch mode;
- the Node project in watch mode; and
- the component project in watch mode.

The generated root manifest delegates to those commands without copying their implementation. CI always uses explicit run-mode commands and never relies on Vitest's environment-sensitive default watch behavior.

## Starter specifications

Every generated project contains at least one real specification in each Vitest project, so a missing or incorrectly discovered test suite fails rather than passing through `passWithNoTests`.

The unit starter specification exercises the actual generated content parser with representative valid and invalid data. It asserts stable behavior and stable internal error identifiers without copying fixture-specific portfolio prose.

The component starter specification renders the actual synchronous `ContentPage` presentation with minimal typed test data and asserts semantic roles, the main target, navigation, and rendered section content. It uses React Testing Library queries that reflect user-observable semantics and no broad snapshot.

`@testing-library/user-event` is available for the first stateful generated component and is required instead of raw event dispatch where it supports the interaction. The initial starter test need not invent a production callback or refactor a pure component merely to consume the helper.

Calendly's native dialog, IntersectionObserver behavior, direct cross-origin iframe, activation-bounded loading, computed focus, and fallback remain Playwright responsibilities. jsdom does not become evidence for layout, CSS, focus visibility, iframe behavior, browser API support, async Server Components, routing, or OpenNext behavior.

## Generated project verification

Fast generated tests become part of ordinary generated-project verification. The ordered receipt expands from:

```text
lockfile
frozen-install
lint
typecheck
next-build
opennext-build
```

to:

```text
lockfile
frozen-install
lint
typecheck
unit-tests
component-tests
next-build
opennext-build
```

The state schema, codecs, tests, evidence, and generated state all advance atomically. Unit and component execution remains distinct from browser installation and browser execution. The ordinary creation receipt still contains no Playwright installation or E2E step.

The fixed-root verifier runs both Vitest projects for every retained generated fixture, then retains its separate Next.js development and OpenNext/workerd Playwright suites. It verifies exact commands, isolated environment state, deterministic files, lockfile portability, state/inference agreement, and bounded output without inheriting unrelated test or cache variables.

## Continuous integration

### Generated repositories

The generated read-only workflow exposes each evidence boundary as its own named step:

1. frozen dependency installation;
2. lint;
3. strict typecheck;
4. Vitest Node unit tests;
5. Vitest jsdom component tests;
6. Next.js build;
7. OpenNext build;
8. explicit Chromium installation;
9. Playwright against Next.js development;
10. Playwright against OpenNext/workerd preview; and
11. failure-only browser artifact upload.

The workflow keeps read-only permissions, pinned action SHAs, disabled credential persistence, cancellation, timeouts, fixed tool versions, and no deployment, secret, provider, release, or production behavior.

### Builder repository

A new ordinary repository-quality workflow covers pull requests and pushes to `main`. It has separate, inspectable jobs or steps for:

- constitution and semantic-governance tests;
- package-boundary and release-safeguard tests;
- builder-core tests;
- CLI tests;
- standards and observability package tests;
- capability-certification tests and admission checks;
- builder lint, build, and typecheck;
- deterministic generated-fixture tests;
- full fixed-root generated-project verification, including both Vitest projects and both Playwright environments; and
- local compatibility-proof unit, Cloudflare harness integration, build/type checks, and development/workerd browser tests.

The workflow uses no deployment environment, credentials, publication command, provider operation, or production action. Existing manual package-release, compatibility deployment, and Calendly certification workflows keep their distinct external authority. Package release continues to run package-specific tests. Calendly certification additionally executes the generated unit and component projects against its hosted fresh-scaffold candidate before deployment.

## `AGENTS.md` ownership and instructions

The repository root `AGENTS.md` becomes the canonical testing-selection owner for authored builder-repository code. Each applicable nested file links to that decision and adds only its boundary-specific commands and claim limits:

- `apps/cli/AGENTS.md`: Node unit/integration/subprocess testing and no Vitest migration;
- `packages/builder-core/AGENTS.md`: Node contract/generation testing, generated Vitest ownership, receipt ordering, and P3-only fast-check introduction;
- `packages/standards/AGENTS.md`: Node behavioral tests for public standards and no public Vitest runtime/config export without a separate extraction gate;
- `packages/observability/AGENTS.md`: Node contract tests for provider-neutral exports, redaction, sinks, and dispatch behavior;
- `proofs/nextjs-cloudflare/AGENTS.md`: ordinary Vitest unit tests, `createTestHarness()` integration, and Playwright environment boundaries; and
- generated root and `apps/web` `AGENTS.md` templates: the generated-project tool-selection contract.

The generated root `AGENTS.md` owns the project-level testing matrix. The generated `apps/web/AGENTS.md` references it and adds React/web rules: role and label queries, `user-event`, no broad snapshots, no jsdom browser claims, Playwright/browser responsibilities, focused accessibility assertions, and the requirement to run the smallest relevant RED/GREEN test followed by the full relevant project verification once.

Derived fixture `AGENTS.md` files are regenerated from those templates and never hand-edited. Historical review copies under `.git`, dependency-owned files under `node_modules`, and separate worktrees are not modified.

Generated guidance must not instruct users to run a command that is absent. Before a binding capability installs Workers Vitest, it says not to use Workers Vitest unless the installed capability provides the Workers-runtime configuration and script.

## Property-based testing placement

The canonical testing strategy already requires property-based tests but does not name a library or delivery phase. P3 selects `fast-check` for materially combinatorial builder behavior while retaining `node:test` as the runner.

Initial candidates are capability-resolution invariants, state codec round trips, migration planning and re-inference agreement, supported-version graph behavior, failure-point recovery, and command-model sequences. Example-based tests remain responsible for named regressions and stable errors. Every property failure records its counterexample, seed, path, and, for model-based commands, replay path. CI uses bounded deterministic limits and retains enough failure output for exact replay.

`fast-check` is not a default generated-project dependency. A later capability may add `fast-check` and the official Vitest connector only when its own domain exposes a material combinatorial invariant and it owns the resulting dependency, test, state, migration, and removal behavior.

## Workers Vitest placement

P4 app-foundation creates provider-neutral backend contracts, typed errors, request context, in-memory adapters, and backend test conventions. Those use the generated Vitest Node project. Whole built-Worker route behavior may use Wrangler `createTestHarness()`. P4 adds no D1, KV, R2, Queue, Durable Object, or other stateful binding and therefore does not install Workers Vitest.

P5C application persistence is the first planned binding-heavy capability and introduces the Workers Vitest integration for direct D1/runtime assertions. The shared Workers-runtime configuration belongs to the `deployment-cloudflare` boundary; `application-persistence` owns its D1-specific specifications and fixtures. Any material change to both executable descriptors receives the required separate certification subjects and sibling certification tasks.

P5E background-job delivery reuses that configuration for Queue-specific tests and owns its specifications. P6 CMS reuses it for D1/R2 behavior. P7 identity reuses the persistence lane. `authenticated-app` receives Workers Vitest because it materializes persistence, not because of its profile name.

At P5C entry, revalidate the current Workers Vitest package, Vitest peer range, compatibility date/flags, storage isolation, Node compatibility injection, coverage limitations, timers, concurrency, module loading, and open-beta status. Workers Vitest never replaces provider-neutral unit/contract tests, built-Worker harness tests, OpenNext/browser tests, or deployed capability certification.

## Deliberate exclusions

Task 6C does not add:

- a mass Vitest migration for builder or package tests;
- Workers Vitest or Miniflare to current generated profiles;
- Vitest Browser Mode or a second component-browser lane;
- Cypress;
- MSW before a generated network client requires it;
- a component-level axe wrapper duplicating the existing real-browser axe lane;
- a coverage dependency, coverage artifact, or arbitrary coverage threshold;
- broad snapshots;
- a public testing package or public Vitest preset;
- a selectable testing capability;
- hosted-CI success claims from static workflow inspection;
- a WCAG conformance, human usability, production safety, or provider-availability claim; or
- deployment, publication, provider configuration, credentials, or external mutation.

Coverage can be added later only with a named decision about what code is measurable, which provider is valid for each runtime, what exclusions are justified, and what evidence supports a threshold. A percentage is not used as a substitute for behavioral coverage.

## Recovery

Task 6C recovery removes the generated dependency/script/configuration/test/guidance/workflow surfaces, restores the previous generated verification tuple, regenerates schemas and fixtures from the reverted owners, and reruns complete builder-kernel verification. Task 6D certification-state recovery is separate and restores the prior accepted certification record only if its exact frozen subject remains valid. No deployment, provider, persistent-data, credential, or production recovery applies.
