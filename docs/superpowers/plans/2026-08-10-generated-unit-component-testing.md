# Generated Unit and Component Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver P2 Task 6C by generating a complete Vitest Node and React Testing Library/jsdom component-testing foundation, executing every repository and generated-project test boundary in appropriate CI, and recording later `fast-check` and Workers Vitest placement without implementing those later runtimes.

**Architecture:** Advance the existing hybrid `standards` capability rather than creating a testing capability or package. Generate one Vitest configuration with named Node and jsdom projects, real starter specifications, explicit scripts, root/scoped guidance, and quality-workflow steps. Expand ordinary generated-project verification with fast unit/component checks while retaining browser checks only in fixed-root certification. Add a read-only repository-quality workflow that executes builder, CLI, packages, capability, generated-project, and compatibility-proof lanes. Admit the material standards change against a separate pending Task 6D certification plan.

**Toolchain:** Node.js `22.23.2`, pnpm `11.20.0`, Vitest `4.1.10`, `@vitejs/plugin-react@6.0.5`, jsdom `30.0.1`, `@testing-library/react@16.3.2`, `@testing-library/dom@10.4.1`, `@testing-library/user-event@14.6.3`, and `@testing-library/jest-dom@7.0.1`, together with Vite 8's native `resolve.tsconfigPaths` support and the settled exact Next.js, React, TypeScript, OpenNext, Wrangler, Playwright, and axe pins already present at the frozen base. CI uses `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`, `pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2`, and `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` where applicable.

## Approval and prerequisite boundary

The user approved this design on 2026-08-10 with two explicit additions:

1. appropriate CI steps must execute every test type for the builder, CLI, packages, compatibility proof, generated fixtures, and scaffolded projects; and
2. every authored `AGENTS.md` that owns requirements for a different code context must state the correct test tool, command, and evidence boundary.

On 2026-08-11, the user explicitly authorized Task 6C to start in its own worktree from current `main` while Task 6B remains under certification, and preapproved evidence-backed amendments through presentation of the implemented Task 6C review. This is a narrow independent-work exception to the previously documented Task 6B sequencing dependency; it does not approve, complete, certify, mutate, or import Task 6B work.

Under that explicit exception, Task 6C must not begin until:

- production-observability Task 6 is implemented, reviewed, approved, and integrated;
- local `main` is clean and contains the accepted Task 6 implementation;
- a dedicated Task 6C branch and ignored isolated worktree are created from that exact `main`;
- no separate worktree is modifying the Task 6C exact-file scope; and
- the user explicitly selects Task 6C for implementation.

**Direct predecessor under the approved independent-work exception:** P2 Task 6 production-observability implementation.

Before RED work, require its review packet to record the approved exact committed comparison and verify accepted revision `45b57d2dc265ef6ba9ac805d7352a01db5f1081d` is an ancestor of `HEAD`. Run `pnpm run check:capability-certification`; require the exact `observability@0.2.0` record to remain the admitted `pending` subject present at the frozen base. Any unexpected observability status, subject, evidence, descriptor, workflow, or separate-worktree mutation is a hard stop.

Implementation proceeds only on branch `generated-unit-component-testing` in `.worktrees/generated-unit-component-testing` from `main@f4f682d4c711dc86a0158ab7f05393d5c33f0160`. Do not rebase, merge, push, publish, deploy, dispatch a workflow, mutate a provider, alter another worktree, or reconcile later Task 6B changes without separate authority. Focused local commits are required by the approved increment method.

The frozen successor contract is `standards@0.3.0` and profile recipe `0.7.0`. Project/state schema version remains `1.0.0`; the ordinary generated dependency remains exact public `@egeria-systems/standards@0.1.0`; and `observability@0.2.0` plus exact public `@egeria-systems/observability@0.2.0` remain unchanged. Task 6C creates an ordinary pending `standards@0.3.0` certification subject for Task 6D and does not mark it certified.

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
docs/implementation-evidence/2026-08-11-generated-unit-component-testing-preparation.md
packages/builder-core/templates/common/apps/web/vitest.config.ts
packages/builder-core/templates/common/apps/web/tests/setup/component.ts
packages/builder-core/templates/common/apps/web/tests/unit/content-schema.test.ts
packages/builder-core/templates/common/apps/web/tests/component/content-page.test.tsx
docs/implementation-evidence/2026-08-11-generated-unit-component-testing-verification.md
docs/review-packets/2026-08-11-generated-unit-component-testing.md
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
apps/cli/tests/cli.test.mjs
tests/capability-certification/certification-runner.test.mjs
tests/capability-certification/production-observability.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
```

**2026-08-11 evidence-backed exact-file amendment:** `apps/cli/tests/cli.test.mjs`
and `tests/capability-certification/production-observability.test.mjs` are direct
consumers of the generation-verification receipt. Their existing assertions had
to move atomically with the tuple extension so CLI output and the independently
pending observability runner continue to recognize current generated state.
Independent review also required a compatibility repair within the already
listed state schema/tests and a parent-link plus exact-command repair within the
already listed generated web guidance. These corrections add no capability,
provider action, deployment behavior, or later-stage runtime scope.

**2026-08-11 hosted-CI repair amendment:** MR review reproduced time-dependent
lockfile resolution: the generator's registry-backed `--lockfile-only` step
selected a newly mature transitive release and changed the installed-state
fingerprint without any recipe change. The separately approved
[`2026-08-11-generated-testing-ci-repairs.md`](2026-08-11-generated-testing-ci-repairs.md)
plan adds `packages/builder-core/lockfiles/web-recipe-0.7.0/pnpm-lock.yaml`, changes
`packages/builder-core/src/generation/verify-generated-project.ts` to materialize
those reviewed bytes before the existing frozen-install verification, updates
`packages/builder-core/tests/generate-project.test.mjs`, and records the invariant
in `packages/builder-core/AGENTS.md`. It intentionally leaves templates,
manifests, fixtures, fingerprints, schemas, capabilities, recipes, and state
receipts unchanged.

### Regenerate immutable generated projects

Regenerate the complete owned contents, state, and lockfiles beneath:

```text
fixtures/generated/portfolio
fixtures/generated/site
fixtures/generated/portfolio-calendly
```

### Reconcile canonical documentation while preserving the independent observability stream

```text
README.md
CONTRIBUTING.md
packages/builder-core/README.md
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/package-ownership.md
docs/architecture/enforcement-map.md
docs/governance/review-and-contribution.md
docs/roadmaps/program-roadmap.md
docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md
docs/superpowers/specs/2026-08-10-generated-unit-component-testing-design.md
```

These amendments record the approved Task 6C independent-work exception, Task 6C/6D, the actual standards subject/version, generated test ownership, CI gates, P3 `fast-check` placement, P4 Node/harness behavior, and P5C Workers Vitest introduction. They must describe later work as planned, not actual and must preserve Task 6B's separate pending state.

## Task 1: Revalidate the integrated baseline and freeze exact pins

**Read:** Root and applicable nested AGENTS, accepted ADRs, canonical source plan, program roadmap, package ownership, capability model, enforcement map, review protocol, compatibility record, current generated browser plan/evidence, settled observability Task 6/6B packets, current manifests/lockfiles/workflows, and all current test aggregates.

- [x] Verify clean local `main`, exact HEAD, `origin/main` relationship, status, worktree inventory, and no overlapping writer.
- [x] Confirm Task 6 is approved and integrated. Record the user's narrow exception allowing Task 6C while Task 6B remains pending; stop on any unapproved observability mutation.
- [x] Record current profile recipes, standards descriptor/version/digest/certification record, public package versions, managed surfaces, inference probes, verification tuple, and retained fixture inventory.
- [x] Recheck official Next.js Vitest, Vitest projects/environments, Testing Library setup/user-event, Cloudflare testing, and later-phase property-testing placement.
- [x] Query exact registry metadata for all seven generated development dependencies. Check peer/engine compatibility, signatures, tarball identity, license, and current advisories.
- [x] Revalidate Node, pnpm, Next.js, React, TypeScript, OpenNext, Wrangler, Playwright, and axe compatibility. Never copy a stale exact version from this plan if current evidence contradicts it.
- [x] Record the selected exact pins, accepted limitations, no-coverage decision, no-Workers-pool decision, and claim boundaries in preparation evidence.
- [x] Amend this plan before implementation for the approved sequencing exception, actual evidence date, exact successor versions, exact dependency pins, and current action SHAs.

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

Expected: current integrated baseline passes before Task 6C RED work. Do not rerun unchanged expensive browser or compatibility checks merely to populate preparation prose; use the settled base receipts and the reviewed Task 6B local receipt only for unchanged behavior it actually exercised. Do not describe Task 6B as certified.

## Task 2: RED — specify capability ownership, generated inventory, and verification state

**Tests first:** builder-core contract/resolution/render/generation/inference/diagnostic/state/certification tests and generated fixture contracts.

- [x] Require a successor standards descriptor and profile recipe without guessing the version before Task 1 freezes it.
- [x] Require exact package/script/file managed surfaces and one matching inference probe for every managed generated test surface.
- [x] Require exact security metadata for test child processes and no new secret, external provider, persistent data, storage, or deployment authority.
- [x] Require an ordinary pending standards certification record linked to the present Task 6D plan; reject inheritance of the frozen backfill subject.
- [x] Require the four new common template paths, updated manifests, TypeScript `.tsx` test inclusion, instructions, README commands, and exact workflow step names.
- [x] Require the ordered generated verification tuple to contain `unit-tests` and `component-tests` between typecheck and builds.
- [x] Require no browser installation/E2E, Workers Vitest, fast-check, coverage, MSW, Browser Mode, Cypress, or `passWithNoTests` in ordinary generated-project verification.
- [x] Require every retained fixture contract to include both starter specifications, setup, config, exact manifest/lockfile entries, updated state, and derived guidance.
- [x] Run the smallest focused Node test batches and verify failure only for the absent approved contracts.
- [x] In an authorized implementation run, commit the RED tests with a message naming generated unit/component testing behavior.

## Task 3: GREEN — implement generated manifests, Vitest projects, and starter tests

**Templates and owners:** web manifest, root manifest, Vitest config, component setup, unit/component specifications, TypeScript config, template catalog, capability descriptor, recipe/state owners, and checked schemas.

- [x] Add exact compatible development-dependency properties selected in Task 1.
- [x] Add `test`, `test:unit`, `test:component`, and explicit watch commands at the web boundary; add only delegating root commands.
- [x] Define named `unit` and `component` projects with disjoint includes, Node/jsdom environments, explicit imports, and no global APIs.
- [x] Add jest-dom matchers and explicit cleanup only to component tests.
- [x] Add a content-parser unit specification with representative valid and invalid inputs and stable error assertions.
- [x] Add a synchronous `ContentPage` component specification using semantic Testing Library queries and minimal typed content.
- [x] Add `.tsx` test inclusion to TypeScript without broadening source ownership.
- [x] Advance standards capability and recipes exactly as frozen, add all surfaces/probes, update the state verification tuple, and generate schemas from runtime owners.
- [x] Keep all visible test fixture copy test-owned and non-product; do not weaken copy externalization.
- [x] Run focused builder-core tests, schema check, template lint, builder build, and typecheck to GREEN.
- [x] Run the generated Vitest projects directly in one isolated temporary rendered project before fixture regeneration.

Expected generated commands:

```sh
pnpm --dir apps/web run test:unit
pnpm --dir apps/web run test:component
pnpm --dir apps/web run test
```

Expected: both named projects discover at least one test, pass in run mode, and remain independently invokable.

## Task 4: RED/GREEN — make test selection explicit in every applicable AGENT context

**Canonical instruction owner:** root `AGENTS.md` for authored repository code; generated root `AGENTS.md` for scaffolded code.

- [x] Add constitution tests that enumerate every authored applicable AGENT file and reject a missing testing-boundary reference.
- [x] Add generated-template and fixture assertions for the complete project-level selection matrix and scoped web additions.
- [x] Update root instructions with Node runner, generated Vitest, Playwright, proof harness, later fast-check, later Workers Vitest, certification, and claim boundaries.
- [x] Update CLI instructions with Node unit/integration/subprocess requirements and no Vitest migration.
- [x] Update builder-core instructions with Node contracts, generated Vitest ownership, exact verification ordering, fixture certification, and P3-only fast-check.
- [x] Update standards instructions with Node public-API behavior tests and no public Vitest preset without a separate extraction/release gate.
- [x] Update observability instructions against the settled post-Task-6 API with Node contract, privacy/redaction, sink, adapter, and failure-behavior tests.
- [x] Update proof instructions with Vitest unit, `createTestHarness()` integration, Playwright environments, and no reuse as product architecture.
- [x] Update generated root instructions with the tool-selection table and exact commands.
- [x] Update generated web instructions with role/label queries, `user-event`, cleanup, no broad snapshots, jsdom limitations, Playwright/browser ownership, accessibility claim limits, and conditional Workers guidance.
- [x] Ensure nested files link to their canonical parent rather than copying every normative paragraph.
- [x] Regenerate fixture AGENT files only through production generation.

Expected: every authored code context tells an agent which runner to use, when to escalate to a broader layer, which command to run, and what the result cannot prove.

## Task 5: RED/GREEN — add explicit generated and repository CI coverage

### Generated workflow

- [x] Add static workflow contracts requiring separate named lint, typecheck, unit, component, Next build, OpenNext build, Chromium install, development E2E, preview E2E, and failure-artifact steps.
- [x] Require unit/component steps before browser installation and prohibit watch mode, deployment, secrets, releases, write permissions, and ambient servers.
- [x] Preserve exact action SHAs, frozen install, read-only permissions, disabled credential persistence, concurrency cancellation, timeout, fixed Node/pnpm, and seven-day failure artifacts.
- [x] Make root `verify` include unit/component testing for local completeness while allowing CI to call distinct semantic commands without duplicate execution.

### Builder repository workflow

- [x] Add RED constitution tests for a new ordinary pull-request/push workflow with read-only permissions, pinned actions, no environment, no credentials, no deployment/publication/provider commands, cancellation, and bounded timeouts.
- [x] Add a builder/packages lane covering constitution, semantic naming, package boundaries, builder-core, CLI, standards, observability, capability certification/admission, lint, build, and typecheck.
- [x] Add a generated-project lane covering deterministic fixture tests and the full fixed-root verifier, which now runs both Vitest projects and both Playwright environments for every retained fixture.
- [x] Add a compatibility-proof local lane covering proof lint/typecheck, Vitest unit, builds/type generation, `createTestHarness()` Cloudflare integration, and Playwright development/preview tests without deployment.
- [x] Use explicit commands/step names so a future missing lane cannot hide behind an ambiguous aggregate.
- [x] Strengthen `verify:builder-kernel` to include public package tests if the settled command still omits them.
- [x] Preserve package-release's package-specific verification and manual authority.
- [x] Add explicit generated unit/component execution to the Calendly fresh deployment candidate before its separately authorized deploy step.
- [x] Change compatibility or package-release workflows only if their actual scoped aggregate fails an applicable contract.

Expected: CI covers every current test-owning component, but external workflows remain separately manual and authority-bounded.

## Task 6: RED/GREEN — expand generated-project receipts and fixed-root certification

- [x] Update the runtime state schema and generated JSON Schema with exact `unit-tests` and `component-tests` positions.
- [x] Add verifier commands using argument arrays and the generated semantic scripts; retain bounded output, timeout, empty home/config, disabled telemetry, fixed registry, and no shell.
- [x] Assert exact failure normalization for either test lane without returning source, test data, child stdout/stderr, environment, or paths beyond existing content-safe policy.
- [x] Update write/state tests to reject missing, duplicate, reordered, or extra receipt entries.
- [x] Add both commands to fixed-root verification before builds and browser installation.
- [x] Preserve separate per-profile HOME, temporary, XDG cache, pnpm store, browser cache, reports, server state, and fixed ports.
- [x] Ensure unit/component cache/environment values are not inherited from the operator.
- [x] Update fixture verification tests with exact per-fixture command ordering and no duplicate successful run against an unchanged copy.
- [x] Run focused verifier/generation/state tests to GREEN.

## Task 7: Regenerate and certify immutable fixtures

- [x] Build the production CLI and render each portfolio, site, and portfolio-with-Calendly project twice in absent temporary destinations.
- [x] Require byte equality, exact file inventories, exact dependency/script/config/test/guidance/workflow contents, portable lockfiles, state/manifest/inference agreement, and an empty exact diff.
- [x] Replace committed fixture roots only from the validated production output. Never hand-edit derived fixture files.
- [x] Run unit and component tests for all three fixtures.
- [x] Run lint, typecheck, Next build, OpenNext build, development Playwright/axe, and preview Playwright/axe for all three fixtures through the fixed verifier.
- [x] Record exact test counts and environment boundaries without claiming hosted CI, deployment, visual quality, human usability, or WCAG conformance.
- [x] Run deterministic fixture tests and read-only infer/doctor/diff against the settled fixtures.

## Task 8: Reconcile canonical owners and later-phase testing decisions

- [x] Update the source plan testing section with the exact runner matrix and CI coverage.
- [x] Add Task 6C implementation and Task 6D standards certification without renumbering later work.
- [x] Record that P3 introduces `fast-check` with `node:test` for material state/migration invariants, including seed/path replay evidence.
- [x] Record that P4 uses generated Vitest Node tests and `createTestHarness()` but does not install Workers Vitest without bindings.
- [x] Record that P5C introduces the shared deployment-cloudflare-owned Workers Vitest configuration and application-persistence-owned D1 specs; P5E/P6/P7 reuse it for their own bindings.
- [x] Update capability model and package ownership with actual standards-generated test surfaces and no public test API.
- [x] Update the enforcement map with actual unit/component and CI gates, leaving Workers Vitest/property-based runtime status planned until their phases.
- [x] Update overview, README, contribution guide, and builder-core README with current commands and bounded claims.
- [x] Run documentation, constitution, semantic-naming, and link/path assertions.

## Task 9: Prepare the separate Task 6D certification subject

- [x] Recompute the canonical standards descriptor/evidence digest after every Task 6C behavior-contract change.
- [x] Replace the stale frozen/backfill record with an ordinary `pending` record linked to the present Task 6D plan.
- [x] Keep implementation admission and certification closure distinct.
- [x] Require repository-present Task 6D plan, fresh-scaffold/local test outcomes, subject-bound evidence, complete review receipt, and no unresolved prompts.
- [x] Run admission GREEN and expected P2/all-certified closure RED while standards remains pending.
- [x] Do not mark standards or P2 certified in Task 6C.

## Task 10: Independent review and bounded repair

**Comparison:** exact integrated Task 6C base through settled Task 6C candidate; exclude separate worktrees and Task 6D execution.

- [x] Dispatch one read-only requirements reviewer for the approved UI testing, all-component CI, all-context AGENT instructions, task sequencing, exclusions, and certification separation.
- [x] Dispatch one read-only architecture/anti-overengineering reviewer for standards ownership, no testing capability/package, Node/Vitest separation, no premature Workers pool, state/version changes, and future P3/P4/P5 placement.
- [x] Dispatch one read-only test-evidence reviewer for causal RED/GREEN proof, test discovery, receipt ordering, every CI lane, all retained fixtures, environment isolation, and claim limits.
- [x] Add one Cloudflare/platform specialist only if Task 6C changes proof/harness behavior beyond CI invocation; no specialist was needed because the proof harness was invoked but not changed.
- [x] Prohibit reviewer edits and recursive fan-out; wait for every result and validate each finding against the current tree.
- [x] For each material validated defect, add a focused failing regression test, implement the minimum repair, rerun only affected checks, and record disposition.
- [x] Reject unsupported, preference-only, duplicated, future-only, or churn-heavy findings.

## Task 11: Final verification, packet, and stop gate

- [x] Run `git diff --check`, semantic naming, constitution, package boundaries, builder-core, CLI, standards, observability, capability certification/admission, generated fixture tests, builder lint/build/typecheck, and the full fixed-root generated verifier.
- [x] Run the complete compatibility-proof local matrix only if Task 6C or its CI contract changed relevant proof inputs; otherwise cite the unchanged settled receipt and run its static workflow contract.
- [x] Validate the new repository workflow structurally and, if a separately authorized hosted run exists, record it separately from local evidence. Never imply a hosted run occurred from source inspection.
- [x] Verify exact generated unit/component test counts for portfolio, site, and Calendly portfolio, plus unchanged development/preview browser outcomes.
- [x] Verify clean branch scope, changed-file inventory, ignored/untracked artifacts, current worktree identities, and no mutation in separate worktrees.
- [x] Record dependency versions and provenance, commands/results, CI matrix, AGENT coverage, reviewer dispositions, risks, deferred P3/P5 work, claim limits, and recovery.
- [x] Create the Task 6C review packet and final verification evidence.
- [x] In an authorized implementation run, commit focused evidence and present the exact committed comparison.
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
