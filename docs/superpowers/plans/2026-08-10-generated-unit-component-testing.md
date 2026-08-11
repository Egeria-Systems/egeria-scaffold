# Generated Unit and Component Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver P2 Task 6C by generating a complete Vitest Node and React Testing Library/jsdom component-testing foundation, executing every repository and generated-project test boundary in appropriate CI, and recording later `fast-check` and Workers Vitest placement without implementing those later runtimes.

**Architecture:** Advance the existing hybrid `standards` capability rather than creating a testing capability or package. Generate one Vitest configuration with named Node and jsdom projects, real starter specifications, explicit scripts, root/scoped guidance, and quality-workflow steps. Expand ordinary generated-project verification with fast unit/component checks while retaining browser checks only in fixed-root certification. Add a read-only repository-quality workflow that executes builder, CLI, packages, capability, generated-project, and compatibility-proof lanes. Admit the material standards change against a separate pending Task 6D certification plan.

**Toolchain:** Settled post-Task-6B Node.js, pnpm, TypeScript, Next.js, React, OpenNext, Wrangler, Playwright, and axe pins; current reference Vitest `4.1.10`; exact current compatible `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, and `@testing-library/jest-dom` pins selected only after fresh registry, peer, engine, signature, and advisory checks.

## Approval and prerequisite boundary

The user approved this design on 2026-08-10 with two explicit additions:

1. appropriate CI steps must execute every test type for the builder, CLI, packages, compatibility proof, generated fixtures, and scaffolded projects; and
2. every authored `AGENTS.md` that owns requirements for a different code context must state the correct test tool, command, and evidence boundary.

This plan creation does not authorize implementation. Task 6C must not begin until:

- production-observability Task 6 is implemented, reviewed, approved, and integrated;
- its separate Task 6B certification is completed, reviewed, approved, and integrated;
- local `main` is clean, sequential, and contains those accepted commits;
- no separate worktree is modifying the Task 6C exact-file scope; and
- the user explicitly selects Task 6C for implementation.

Do not rebase, merge, commit, push, publish, deploy, dispatch a workflow, mutate a provider, or alter another worktree under this planning approval.

## Global constraints

- Freeze the exact integrated base, current branch, status, capability subjects, recipe versions, package versions, generated fixture inventory, workflows, and AGENT hierarchy before RED tests.
- Preserve Node's test runner for root governance, CLI, builder-core, standards, and observability tests.
- Keep generated unit and component projects distinct and explicit. Never use jsdom evidence for CSS layout, focus visibility, iframe behavior, browser APIs, routing, async Server Components, or OpenNext behavior.
- Keep Playwright/axe development and preview suites unchanged except where test command ordering, documentation, or CI wiring must reference the new faster lanes.
- Add no Workers Vitest implementation before P5C and no `fast-check` dependency before P3.
- Keep test descriptions semantic; no sequencing labels in executable, configuration, workflow, template, fixture, or generated user-facing surfaces.
- Preserve exact versions, portable public lockfiles, frozen installation, content-safe child-process output, isolated environment/cache roots, deterministic generation, state-last writes, and post-state inference agreement.
- Do not add broad snapshots, `passWithNoTests`, coverage thresholds, MSW, Vitest Browser Mode, Cypress, a testing capability, a public testing package, or an unconsumed public standards API.
- Do not claim hosted-CI success, deployment, provider behavior, production safety, visual quality, accessibility conformance, assistive-technology compatibility, or human usability from local/static evidence.
- Before each commit in a separately approved implementation run, verify branch/status, stage only intended paths, inspect the cached diff, and run `git diff --cached --check`.

## Exact planned file scope

### Already approved planning artifacts

```text
docs/superpowers/specs/2026-08-10-generated-unit-component-testing-design.md
docs/superpowers/plans/2026-08-10-generated-unit-component-testing.md
docs/superpowers/plans/2026-08-10-generated-unit-component-testing-certification.md
```

### Create during Task 6C

```text
.github/workflows/repository-quality.yml
docs/implementation-evidence/2026-08-10-generated-unit-component-testing-preparation.md
packages/builder-core/templates/common/apps/web/vitest.config.ts
packages/builder-core/templates/common/apps/web/tests/setup/component.ts
packages/builder-core/templates/common/apps/web/tests/unit/content-schema.test.ts
packages/builder-core/templates/common/apps/web/tests/component/content-page.test.tsx
docs/implementation-evidence/2026-08-10-generated-unit-component-testing-verification.md
docs/review-packets/2026-08-10-generated-unit-component-testing.md
```

If implementation occurs on a later date, retain these semantic subjects but use one consistent actual implementation date for newly created evidence and packet filenames. Amend this exact-file plan before creating differently dated files.

### Modify authored instructions

```text
AGENTS.md
apps/cli/AGENTS.md
packages/builder-core/AGENTS.md
packages/standards/AGENTS.md
packages/observability/AGENTS.md
proofs/nextjs-cloudflare/AGENTS.md
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
```

Derived fixture instruction files are regenerated, not directly edited:

```text
fixtures/generated/portfolio/AGENTS.md
fixtures/generated/portfolio/apps/web/AGENTS.md
fixtures/generated/site/AGENTS.md
fixtures/generated/site/apps/web/AGENTS.md
fixtures/generated/portfolio-calendly/AGENTS.md
fixtures/generated/portfolio-calendly/apps/web/AGENTS.md
```

Do not touch historical review sources under `.git`, dependency-owned `node_modules/**/AGENTS.md`, or any separate worktree.

### Modify generated templates and CI

```text
packages/builder-core/templates/common/package.json.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/.github/workflows/quality.yml.template
packages/builder-core/templates/common/apps/web/package.json.template
packages/builder-core/templates/common/apps/web/tsconfig.json
.github/workflows/booking-calendly-certification.yml
package.json
```

Modify `package-release.yml` or `compatibility-proof.yml` only if a focused RED contract proves their current aggregate commands fail to execute an applicable lane. Do not rewrite a passing scoped workflow merely to duplicate the new ordinary repository-quality workflow.

### Modify standards capability, rendering, state, and checked schemas

```text
certifications/capabilities.json
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/contracts/state.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/generation/verify-generated-project.ts
packages/builder-core/src/generation/write-generated-project.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
scripts/verify-generated-skeletons.mjs
```

The exact source list may contract after RED tests. Expanding it requires an evidence-backed plan amendment before editing.

### Modify direct tests and policy contracts

```text
tests/constitution/constitution.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/inference.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/state-ownership.test.mjs
packages/builder-core/tests/certification.test.mjs
tests/capability-certification/certification-runner.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
```

### Regenerate immutable generated projects

Regenerate the complete owned contents, state, and lockfiles beneath:

```text
fixtures/generated/portfolio
fixtures/generated/site
fixtures/generated/portfolio-calendly
```

### Reconcile canonical documentation after the active observability stream is settled

```text
README.md
CONTRIBUTING.md
packages/builder-core/README.md
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/package-ownership.md
docs/architecture/enforcement-map.md
docs/roadmaps/program-roadmap.md
docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md
```

These amendments record Task 6C/6D, the actual standards subject/version, generated test ownership, CI gates, P3 `fast-check` placement, P4 Node/harness behavior, and P5C Workers Vitest introduction. They must describe later work as planned, not actual.

## Task 1: Revalidate the integrated baseline and freeze exact pins

**Read:** Root and applicable nested AGENTS, accepted ADRs, canonical source plan, program roadmap, package ownership, capability model, enforcement map, review protocol, compatibility record, current generated browser plan/evidence, settled observability Task 6/6B packets, current manifests/lockfiles/workflows, and all current test aggregates.

- [ ] Verify clean local `main`, exact HEAD, `origin/main` relationship, status, worktree inventory, and no overlapping writer.
- [ ] Confirm Tasks 6 and 6B are approved and integrated. Stop if either is absent or pending.
- [ ] Record current profile recipes, standards descriptor/version/digest/certification record, public package versions, managed surfaces, inference probes, verification tuple, and retained fixture inventory.
- [ ] Recheck official Next.js Vitest, Vitest projects/environments, Testing Library setup/user-event, Cloudflare testing, and fast-check documentation.
- [ ] Query exact registry metadata for all eight generated development dependencies. Check peer/engine compatibility, signatures, tarball identity, license, and current advisories.
- [ ] Revalidate Node, pnpm, Next.js, React, TypeScript, OpenNext, Wrangler, Playwright, and axe compatibility. Never copy a stale exact version from this plan if current evidence contradicts it.
- [ ] Record the selected exact pins, accepted limitations, no-coverage decision, no-Workers-pool decision, and claim boundaries in preparation evidence.
- [ ] Amend this plan before implementation if the settled source tree changes any exact owner or required file.

**Focused checks:**

```sh
git status --short --branch
git worktree list --porcelain
pnpm run check:semantic-naming
pnpm run test:constitution
pnpm run test:package-boundaries
pnpm run test:builder-core
pnpm run test:cli
pnpm run test:packages
pnpm run test:capability-certification
pnpm run check:capability-certification
```

Expected: current integrated baseline passes before Task 6C RED work. Do not rerun unchanged expensive browser or compatibility checks merely to populate preparation prose; use the settled Task 6B receipts unless compatibility-sensitive inputs changed.

## Task 2: RED — specify capability ownership, generated inventory, and verification state

**Tests first:** builder-core contract/resolution/render/generation/inference/diagnostic/state/certification tests and generated fixture contracts.

- [ ] Require a successor standards descriptor and profile recipe without guessing the version before Task 1 freezes it.
- [ ] Require exact package/script/file managed surfaces and one matching inference probe for every managed generated test surface.
- [ ] Require exact security metadata for test child processes and no new secret, external provider, persistent data, storage, or deployment authority.
- [ ] Require an ordinary pending standards certification record linked to the present Task 6D plan; reject inheritance of the frozen backfill subject.
- [ ] Require the four new common template paths, updated manifests, TypeScript `.tsx` test inclusion, instructions, README commands, and exact workflow step names.
- [ ] Require the ordered generated verification tuple to contain `unit-tests` and `component-tests` between typecheck and builds.
- [ ] Require no browser installation/E2E, Workers Vitest, fast-check, coverage, MSW, Browser Mode, Cypress, or `passWithNoTests` in ordinary generated-project verification.
- [ ] Require every retained fixture contract to include both starter specifications, setup, config, exact manifest/lockfile entries, updated state, and derived guidance.
- [ ] Run the smallest focused Node test batches and verify failure only for the absent approved contracts.
- [ ] In an authorized implementation run, commit the RED tests with a message naming generated unit/component testing behavior.

## Task 3: GREEN — implement generated manifests, Vitest projects, and starter tests

**Templates and owners:** web manifest, root manifest, Vitest config, component setup, unit/component specifications, TypeScript config, template catalog, capability descriptor, recipe/state owners, and checked schemas.

- [ ] Add exact compatible development-dependency properties selected in Task 1.
- [ ] Add `test`, `test:unit`, `test:component`, and explicit watch commands at the web boundary; add only delegating root commands.
- [ ] Define named `unit` and `component` projects with disjoint includes, Node/jsdom environments, explicit imports, and no global APIs.
- [ ] Add jest-dom matchers and explicit cleanup only to component tests.
- [ ] Add a content-parser unit specification with representative valid and invalid inputs and stable error assertions.
- [ ] Add a synchronous `ContentPage` component specification using semantic Testing Library queries and minimal typed content.
- [ ] Add `.tsx` test inclusion to TypeScript without broadening source ownership.
- [ ] Advance standards capability and recipes exactly as frozen, add all surfaces/probes, update the state verification tuple, and generate schemas from runtime owners.
- [ ] Keep all visible test fixture copy test-owned and non-product; do not weaken copy externalization.
- [ ] Run focused builder-core tests, schema check, template lint, builder build, and typecheck to GREEN.
- [ ] Run the generated Vitest projects directly in one isolated temporary rendered project before fixture regeneration.

Expected generated commands:

```sh
pnpm --dir apps/web run test:unit
pnpm --dir apps/web run test:component
pnpm --dir apps/web run test
```

Expected: both named projects discover at least one test, pass in run mode, and remain independently invokable.

## Task 4: RED/GREEN — make test selection explicit in every applicable AGENT context

**Canonical instruction owner:** root `AGENTS.md` for authored repository code; generated root `AGENTS.md` for scaffolded code.

- [ ] Add constitution tests that enumerate every authored applicable AGENT file and reject a missing testing-boundary reference.
- [ ] Add generated-template and fixture assertions for the complete project-level selection matrix and scoped web additions.
- [ ] Update root instructions with Node runner, generated Vitest, Playwright, proof harness, later fast-check, later Workers Vitest, certification, and claim boundaries.
- [ ] Update CLI instructions with Node unit/integration/subprocess requirements and no Vitest migration.
- [ ] Update builder-core instructions with Node contracts, generated Vitest ownership, exact verification ordering, fixture certification, and P3-only fast-check.
- [ ] Update standards instructions with Node public-API behavior tests and no public Vitest preset without a separate extraction/release gate.
- [ ] Update observability instructions against the settled post-Task-6 API with Node contract, privacy/redaction, sink, adapter, and failure-behavior tests.
- [ ] Update proof instructions with Vitest unit, `createTestHarness()` integration, Playwright environments, and no reuse as product architecture.
- [ ] Update generated root instructions with the tool-selection table and exact commands.
- [ ] Update generated web instructions with role/label queries, `user-event`, cleanup, no broad snapshots, jsdom limitations, Playwright/browser ownership, accessibility claim limits, and conditional Workers guidance.
- [ ] Ensure nested files link to their canonical parent rather than copying every normative paragraph.
- [ ] Regenerate fixture AGENT files only through production generation.

Expected: every authored code context tells an agent which runner to use, when to escalate to a broader layer, which command to run, and what the result cannot prove.

## Task 5: RED/GREEN — add explicit generated and repository CI coverage

### Generated workflow

- [ ] Add static workflow contracts requiring separate named lint, typecheck, unit, component, Next build, OpenNext build, Chromium install, development E2E, preview E2E, and failure-artifact steps.
- [ ] Require unit/component steps before browser installation and prohibit watch mode, deployment, secrets, releases, write permissions, and ambient servers.
- [ ] Preserve exact action SHAs, frozen install, read-only permissions, disabled credential persistence, concurrency cancellation, timeout, fixed Node/pnpm, and seven-day failure artifacts.
- [ ] Make root `verify` include unit/component testing for local completeness while allowing CI to call distinct semantic commands without duplicate execution.

### Builder repository workflow

- [ ] Add RED constitution tests for a new ordinary pull-request/push workflow with read-only permissions, pinned actions, no environment, no credentials, no deployment/publication/provider commands, cancellation, and bounded timeouts.
- [ ] Add a builder/packages lane covering constitution, semantic naming, package boundaries, builder-core, CLI, standards, observability, capability certification/admission, lint, build, and typecheck.
- [ ] Add a generated-project lane covering deterministic fixture tests and the full fixed-root verifier, which now runs both Vitest projects and both Playwright environments for every retained fixture.
- [ ] Add a compatibility-proof local lane covering proof lint/typecheck, Vitest unit, builds/type generation, `createTestHarness()` Cloudflare integration, and Playwright development/preview tests without deployment.
- [ ] Use explicit commands/step names so a future missing lane cannot hide behind an ambiguous aggregate.
- [ ] Strengthen `verify:builder-kernel` to include public package tests if the settled command still omits them.
- [ ] Preserve package-release's package-specific verification and manual authority.
- [ ] Add explicit generated unit/component execution to the Calendly fresh deployment candidate before its separately authorized deploy step.
- [ ] Change compatibility or package-release workflows only if their actual scoped aggregate fails an applicable contract.

Expected: CI covers every current test-owning component, but external workflows remain separately manual and authority-bounded.

## Task 6: RED/GREEN — expand generated-project receipts and fixed-root certification

- [ ] Update the runtime state schema and generated JSON Schema with exact `unit-tests` and `component-tests` positions.
- [ ] Add verifier commands using argument arrays and the generated semantic scripts; retain bounded output, timeout, empty home/config, disabled telemetry, fixed registry, and no shell.
- [ ] Assert exact failure normalization for either test lane without returning source, test data, child stdout/stderr, environment, or paths beyond existing content-safe policy.
- [ ] Update write/state tests to reject missing, duplicate, reordered, or extra receipt entries.
- [ ] Add both commands to fixed-root verification before builds and browser installation.
- [ ] Preserve separate per-profile HOME, temporary, XDG cache, pnpm store, browser cache, reports, server state, and fixed ports.
- [ ] Ensure unit/component cache/environment values are not inherited from the operator.
- [ ] Update fixture verification tests with exact per-fixture command ordering and no duplicate successful run against an unchanged copy.
- [ ] Run focused verifier/generation/state tests to GREEN.

## Task 7: Regenerate and certify immutable fixtures

- [ ] Build the production CLI and render each portfolio, site, and portfolio-with-Calendly project twice in absent temporary destinations.
- [ ] Require byte equality, exact file inventories, exact dependency/script/config/test/guidance/workflow contents, portable lockfiles, state/manifest/inference agreement, and an empty exact diff.
- [ ] Replace committed fixture roots only from the validated production output. Never hand-edit derived fixture files.
- [ ] Run unit and component tests for all three fixtures.
- [ ] Run lint, typecheck, Next build, OpenNext build, development Playwright/axe, and preview Playwright/axe for all three fixtures through the fixed verifier.
- [ ] Record exact test counts and environment boundaries without claiming hosted CI, deployment, visual quality, human usability, or WCAG conformance.
- [ ] Run deterministic fixture tests and read-only infer/doctor/diff against the settled fixtures.

## Task 8: Reconcile canonical owners and later-phase testing decisions

- [ ] Update the source plan testing section with the exact runner matrix and CI coverage.
- [ ] Add Task 6C implementation and Task 6D standards certification without renumbering later work.
- [ ] Record that P3 introduces `fast-check` with `node:test` for material state/migration invariants, including seed/path replay evidence.
- [ ] Record that P4 uses generated Vitest Node tests and `createTestHarness()` but does not install Workers Vitest without bindings.
- [ ] Record that P5C introduces the shared deployment-cloudflare-owned Workers Vitest configuration and application-persistence-owned D1 specs; P5E/P6/P7 reuse it for their own bindings.
- [ ] Update capability model and package ownership with actual standards-generated test surfaces and no public test API.
- [ ] Update the enforcement map with actual unit/component and CI gates, leaving Workers Vitest/property-based runtime status planned until their phases.
- [ ] Update overview, README, contribution guide, and builder-core README with current commands and bounded claims.
- [ ] Run documentation, constitution, semantic-naming, and link/path assertions.

## Task 9: Prepare the separate Task 6D certification subject

- [ ] Recompute the canonical standards descriptor/evidence digest after every Task 6C behavior-contract change.
- [ ] Replace the stale frozen/backfill record with an ordinary `pending` record linked to the present Task 6D plan.
- [ ] Keep implementation admission and certification closure distinct.
- [ ] Require repository-present Task 6D plan, fresh-scaffold/local test outcomes, subject-bound evidence, complete review receipt, and no unresolved prompts.
- [ ] Run admission GREEN and expected P2/all-certified closure RED while standards remains pending.
- [ ] Do not mark standards or P2 certified in Task 6C.

## Task 10: Independent review and bounded repair

**Comparison:** exact integrated Task 6C base through settled Task 6C candidate; exclude separate worktrees and Task 6D execution.

- [ ] Dispatch one read-only requirements reviewer for the approved UI testing, all-component CI, all-context AGENT instructions, task sequencing, exclusions, and certification separation.
- [ ] Dispatch one read-only architecture/anti-overengineering reviewer for standards ownership, no testing capability/package, Node/Vitest separation, no premature Workers pool, state/version changes, and future P3/P4/P5 placement.
- [ ] Dispatch one read-only test-evidence reviewer for causal RED/GREEN proof, test discovery, receipt ordering, every CI lane, all retained fixtures, environment isolation, and claim limits.
- [ ] Add one Cloudflare/platform specialist only if Task 6C changes proof/harness behavior beyond CI invocation.
- [ ] Prohibit reviewer edits and recursive fan-out; wait for every result and validate each finding against the current tree.
- [ ] For each material validated defect, add a focused failing regression test, implement the minimum repair, rerun only affected checks, and record disposition.
- [ ] Reject unsupported, preference-only, duplicated, future-only, or churn-heavy findings.

## Task 11: Final verification, packet, and stop gate

- [ ] Run `git diff --check`, semantic naming, constitution, package boundaries, builder-core, CLI, standards, observability, capability certification/admission, generated fixture tests, builder lint/build/typecheck, and the full fixed-root generated verifier.
- [ ] Run the complete compatibility-proof local matrix only if Task 6C or its CI contract changed relevant proof inputs; otherwise cite the unchanged settled receipt and run its static workflow contract.
- [ ] Validate the new repository workflow structurally and, if a separately authorized hosted run exists, record it separately from local evidence. Never imply a hosted run occurred from source inspection.
- [ ] Verify exact generated unit/component test counts for portfolio, site, and Calendly portfolio, plus unchanged development/preview browser outcomes.
- [ ] Verify clean branch scope, changed-file inventory, ignored/untracked artifacts, current worktree identities, and no mutation in separate worktrees.
- [ ] Record dependency versions and provenance, commands/results, CI matrix, AGENT coverage, reviewer dispositions, risks, deferred P3/P5 work, claim limits, and recovery.
- [ ] Create the Task 6C review packet and final verification evidence.
- [ ] In an authorized implementation run, commit focused evidence and present the exact committed comparison.
- [ ] Stop for explicit verified-final-diff approval. Do not execute Task 6D, begin later P2 work, add fast-check, add Workers Vitest, push, create a pull request, deploy, publish, or mutate an external system.

## Expected completion boundary

Task 6C is complete only when:

- every generated project has working, independently invokable Node unit and jsdom component projects;
- all retained fixtures run those tests under ordinary generation, fixed-root verification, and generated CI contracts;
- repository CI covers builder-core, CLI, standards, observability, capability contracts, generated projects, and the local compatibility proof at their appropriate layers;
- every applicable authored and generated AGENT context names the correct tool, command, escalation boundary, and claim limit;
- the standards capability/state/inference/certification subject agrees exactly; and
- the implementation packet is approved.

Task 6C completion does not certify the changed standards subject. Task 6D remains mandatory and separately approved.
