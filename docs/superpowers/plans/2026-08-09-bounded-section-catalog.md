# Bounded Section Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production builder generate and verify a source-owned four-type section registry whose validated YAML can safely compose portfolio and site pages without injecting executable behavior.

**Architecture:** The existing `content-files` parser owns raw discriminated YAML validation. The dependent source-generated `section-composition` capability owns one registry that associates each parser with approved variants, a pure typed component, profile support, accessibility requirements, analytics declarations, and migration hooks. Routes pass typed section arrays through a pure page shell; no client component, package, dependency, provider, or generic plugin framework is added.

**Tech Stack:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, YAML `2.9.0`, React/React DOM `19.2.8`, Next.js `16.3.0`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, ESLint `9.39.5` in generated projects and `10.8.0` at the builder root, Node test runner.

**Design authority:** The [approved source plan](../../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), accepted ADRs `0001`–`0011`, the [program roadmap](../../roadmaps/program-roadmap.md), the [accepted design](../specs/2026-08-09-bounded-section-catalog-design.md), and [preparation evidence](../../implementation-evidence/2026-08-09-bounded-section-catalog-preparation.md).

## Approval and execution boundary

The user preapproved plan amendments and authorized continuation through review of the implemented task. This plan therefore receives a focused self-review and proceeds without a second planning pause. Amendments remain limited to direct consumers discovered by focused RED/GREEN or review and must be appended to this plan. No amendment may authorize the next P2 outcome or an external action.

Work directly on clean local `main` at frozen base `83fe0e667a62701de881497d9293fc2355ef7654`, provided it remains one sequential stream. Use exact Node `22.23.2` and pnpm `11.20.0`. Before each commit, confirm branch/status, stage only exact intended files, inspect the cached diff, and run `git diff --cached --check`.

No push, pull request, merge, publication, deployment, workflow dispatch, provider mutation, persistent-data action, production action, permission change, external message, or response to review comments is authorized.

## Non-goals

Do not add responsive/visual CSS, image/media models, Markdown rendering, Calendly, analytics behavior, observability behavior, CI/deployment, browser/visual/performance/accessibility automation, a conformance claim, retained client project, existing-repository mutation, migration execution, new packages/dependencies, new profiles/capabilities, databases, queues, email, identity, payments, `apps/jobs`, or generic plugin/component/schema engines.

## Exact final file set

Create implementation, preparation, verification, and review artifacts:

```text
packages/builder-core/templates/common/apps/web/src/sections/section-registry.tsx
docs/implementation-evidence/2026-08-09-bounded-section-catalog-preparation.md
docs/implementation-evidence/2026-08-09-bounded-section-catalog-verification.md
docs/review-packets/2026-08-09-bounded-section-catalog.md
docs/superpowers/specs/2026-08-09-bounded-section-catalog-design.md
docs/superpowers/plans/2026-08-09-bounded-section-catalog.md
```

Modify runtime contracts, capability/profile owners, template catalog, and generated sources:

```text
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/templates/common/apps/web/app/page.tsx
packages/builder-core/templates/site/apps/web/app/about/page.tsx
packages/builder-core/templates/common/apps/web/src/content/content-schema.ts
packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx
packages/builder-core/templates/portfolio/apps/web/content/en-CA/site.yaml.template
packages/builder-core/templates/site/apps/web/content/en-CA/site.yaml.template
packages/builder-core/templates/site/apps/web/content/en-CA/about.yaml.template
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
```

Modify tests, verification contracts, root copy coverage, and checked schemas:

```text
package.json
eslint.config.mjs
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/internal-linting.test.mjs
tests/package-boundaries/public-standards.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
tests/generated-fixtures/determinism.test.mjs
scripts/verify-generated-skeletons.mjs
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
```

Modify only direct canonical documentation consumers:

```text
packages/builder-core/AGENTS.md
packages/builder-core/README.md
docs/architecture/overview.md
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/roadmaps/program-roadmap.md
```

Regenerate only derived committed fixture files beneath:

```text
fixtures/generated/portfolio
fixtures/generated/site
```

Expected generated inventory changes are exactly one added file per profile plus changed content/parser/route/presentation/guidance/project/state bytes and derived fingerprints. Manifests, lockfile dependency graphs, styles, deployment configuration, observability source, long-form Markdown, and public-package versions must remain unchanged. Discovering another direct current-contract consumer permits an appended exact-file amendment; unrelated changes stop execution.

## Exact behavior contract

`content-schema.ts` exports the exact discriminated `PageSection` union and frozen `sectionContentSchemas` association described in the design. `PageContent` contains only `sections`. `parsePageContent` requires:

- an exact `sections` key and non-empty array;
- exact section keys `id`, `type`, `variant`, `enabled`, and `content`;
- semantic unique instance IDs;
- type in `hero`, `text`, `project-list`, `call-to-action`;
- exact variant `default`;
- a boolean `enabled` flag;
- exact type-specific content, including non-empty project lists; and
- exactly one enabled hero, first among enabled sections.

All raw and decoded strings reject the existing forbidden control set. Navigation, project, and call-to-action `href` values accept only root-relative, non-empty hash, credential-free HTTPS, and non-empty mailto destinations. Invalid content always throws `TypeError("CONTENT_INVALID")` without source values.

`sectionRegistry` has exactly four entries. Every entry declares `contentSchemaVersion: "1.0.0"`, its parser, `approvedVariants: ["default"]`, its pure component, support for `portfolio` and `site`, exact semantic accessibility requirement identifiers, empty analytics declarations, and empty migration hooks. `SectionComposition` preserves enabled source order, uses stable IDs, and renders through an exhaustive discriminated switch.

`section-composition` advances to `0.2.0`; recipes advance to `0.3.0`; contract provenance accepts exactly `0.1.0`, `0.2.0`, or `0.3.0`. Expected counts are 24/26 in-memory files, 43/45 ownership descriptors, 46/48 generated managed surfaces, and 28/30 committed fixture files for portfolio/site.

## Task 1: Validate and commit design, preparation, and exact plan

**Files:** the three dated preparation/design/plan files above.

- [x] Search the artifacts for unresolved placeholders, broken local references, scope drift, and inaccurate counts.
- [x] Run constitution, semantic-naming, and `git diff --check` against the planning-only tree.
- [x] Verify branch/status and commit exactly the three files with message `Plan bounded section composition`.

## Task 2: RED — specify versions, catalog, content, registry, and copy coverage

**Files:**

- Modify: `packages/builder-core/tests/contracts.test.mjs`
- Modify: `packages/builder-core/tests/resolution.test.mjs`
- Modify: `packages/builder-core/tests/render-skeleton.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`
- Modify: `tests/package-boundaries/internal-linting.test.mjs`
- Modify: `package.json`

- [x] Add runtime contract tests accepting retained `0.1.0`/`0.2.0` and current `0.3.0` while rejecting `0.4.0`.
- [x] Specify `section-composition@0.2.0`, its exact new application-owned registry surface/probe, unchanged dependency/security/provider declarations, and recipe `0.3.0`.
- [x] Add the registry source to exact template, rendered-path, ownership-count, and private-package allowlist assertions.
- [x] Add parser cases for all valid section types; source ordering; disabled omission; exact keys/types/variants; duplicate or invalid IDs; missing/multiple/disabled heroes; empty projects; control characters; and safe/unsafe link destinations.
- [x] Add executable registry assertions for exact metadata, parser associations, pure semantic component structure, enabled ordering, stable IDs, and exhaustive four-type rendering. Transpile only the generated modules and use a deterministic test JSX runtime; also retain real generated Next/OpenNext build verification.
- [x] Expand the root copy command to `src/sections/**/*.tsx` and require the exact new file to be linted with zero messages.
- [x] Build builder-core, run the focused tests, and record RED caused only by absent `0.3.0`, new registry/template, parser behavior, and copy path.

## Task 3: GREEN — implement the minimum bounded registry

**Files:** the exact runtime/template/schema/documentation files listed above.

- [x] Add current recipe provenance and regenerate, never hand-edit, all three checked schema artifacts.
- [x] Advance only `section-composition` and current profile recipe versions; add one exact registry surface/probe; leave every package/provider/dependency contract unchanged.
- [x] Implement pure exact section parsers and shared safe-link validation in the existing generated content schema.
- [x] Implement one cohesive four-entry registry and pure server-rendered components with semantic heading/list/link structure.
- [x] Update home and site-about routes, pure page shell, and all structured YAML to consume typed ordered sections with externalized fictional copy.
- [x] Update direct generated guidance and canonical owners without copying the full source-plan contract.
- [x] Run focused parser/registry/render/resolution/copy tests until GREEN and the full package-boundary suite for this coherent source batch; defer the full builder-core suite until its generation/fixture consumers are updated in Task 4.
- [x] Inspect changed files and commit the exact source/test/schema/doc batch with message `Add bounded section composition`.

## Task 4: RED/GREEN — refresh production generation evidence

**Files:**

- Modify: `packages/builder-core/tests/generate-project.test.mjs`
- Modify: `packages/builder-core/tests/diagnostics.test.mjs`
- Modify: `scripts/verify-generated-skeletons.mjs`
- Modify: `tests/generated-fixtures/determinism.test.mjs`
- Regenerate: `fixtures/generated/portfolio/**`
- Regenerate: `fixtures/generated/site/**`

- [x] Update expected generated paths, recipe/section capability versions, and exact 46/48 surface counts before fixture replacement.
- [x] Run focused generation/fixture assertions against old fixtures and record the expected path/version/state/fingerprint mismatch.
- [x] Build the production CLI and generate portfolio/site twice in fresh identity-bounded temporary roots. Require byte-identical pairs and exact expected inventories.
- [x] Inspect the generated trees, confirm lockfile dependency graphs and manifest versions are unchanged, and replace only the two committed fixture roots with their identity-matched outputs.
- [x] Run production generation, fixture determinism, inference/state agreement, copy lint, generated lint/typecheck/Next/OpenNext checks until GREEN.
- [x] Commit exact fixture/test/harness changes with message `Refresh generated section fixtures`.

## Task 5: Independent reviews and evidence-backed repair

- [ ] Freeze the exact base/head comparison and changed-file list.
- [ ] Dispatch independent read-only requirements, architecture/anti-overengineering, and test-evidence reviewers. Dispatch a read-only accessibility specialist because the registry declares and renders semantic requirements. Give every reviewer the exact comparison and prohibit edits, recursive fan-out, external mutation, review-comment responses, and scope expansion.
- [ ] Wait for every reviewer, reconcile conflicts, and validate each finding against current source and fresh commands.
- [ ] For each material defect, add a focused RED regression where applicable, make the minimum repair, rerun affected checks, record the disposition, and commit with a message naming the actual repair.
- [ ] Ask at most one relevant bounded reviewer to recheck material repairs. Do not repeat unchanged reviews or implement preferences/speculation.

## Task 6: Final verification, evidence, and review packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-09-bounded-section-catalog-verification.md`
- Create: `docs/review-packets/2026-08-09-bounded-section-catalog.md`

- [ ] Run `pnpm run verify:builder-kernel` once against the final executable/template/fixture tree with the exact toolchain and required public-registry access.
- [ ] Run fresh constitution, semantic-naming, copy-externalization, lockfile advisory, and `git diff --check` checks proportionately; do not rerun unchanged expensive checks.
- [ ] Record exact commits, comparison, changed files, RED/GREEN evidence, commands/results, reviewer dispositions, generated inventories/counts/hashes where useful, security/advisory evidence, risks, deferrals, claim limits, and recovery.
- [ ] Confirm no unauthorized dependency, package version/publication, push, pull request, merge, deployment, workflow/provider/production mutation, permission change, external message, or review-comment response occurred.
- [ ] Commit final evidence and review packet with message `Record bounded section verification`.
- [ ] Stop for explicit implemented-task and verified-final-diff review. Do not begin responsive accessible UI.

## Rollback and recovery

Use focused newest-first `git revert` commits, never reset or history rewriting. Reverting fixture/evidence commits restores prior generated evidence; reverting implementation restores recipe `0.2.0`, `section-composition@0.1.0`, the prior simple page shape, and checked schemas; reverting planning withdraws only dated design records. After any source revert, regenerate both fixtures from the restored production CLI and rerun `verify:builder-kernel`.

There is no dependency, deployment, provider, persistent-data, analytics, or booking rollback. Temporary generation, install, build, and test-runtime directories are non-authoritative and recreatable from the pinned toolchain.

## Execution amendment — root copy-config consumer

The first focused GREEN run proved that the root command glob alone is not the complete canonical copy-lint consumer: `eslint.config.mjs` independently passes the accepted template patterns into the standards factory. The plan therefore adds that exact file to the copy-coverage batch and adds only `packages/builder-core/templates/**/src/sections/**/*.tsx` to the existing factory configuration. The full package-boundary run then identified two literal command-contract consumers, `tests/package-boundaries/public-standards.test.mjs` and `tests/package-boundaries/release-safeguards.test.mjs`; both are added only to expect the same widened exact command. No lint rule, standards API, generated dependency, release behavior, or other path is added.

## Execution amendment — review repairs

Independent review identified two material boundary defects. WHATWG URL parsing removes tab, line-feed, and carriage-return characters before interpreting a destination, so a root-relative prefix check alone could admit a credential-bearing network destination after normalization. Generated link validation therefore rejects URL-normalization ASCII whitespace before classifying navigation, project, or call-to-action destinations. Review also identified that `${section.id}-heading` could collide with another valid section ID. Generated heading IDs therefore use `${section.id}--heading`; the identifier grammar prohibits consecutive hyphens, reserving that namespace without changing source section IDs. Focused regressions cover all three link consumers, exact rendered references, and global ID uniqueness.

Accessibility and test-evidence review then identified that the one-enabled-hero rule still allowed an enabled section heading to render before the page heading, and that the deterministic JSX test inspected only immediate child tags. The parser and generated web guidance therefore require the hero to be first among enabled sections while continuing to allow disabled sections before it. The registry test now recursively asserts exact heading targets, project list/article/heading/link structure, content-backed text and destinations, and call-to-action semantics using unique sentinel values. This adds the design, web-guidance template, and its generated fixture/state consumers to the repair batch without adding styling, browser tooling, or a conformance claim.

The first final aggregate stopped at the constitution gate because `tests/constitution/constitution.test.mjs` still required the roadmap's prior “Task 2 is” status sentence after this increment advanced that canonical status to completed Task 2 and current Task 3. The plan adds only that direct roadmap-contract consumer and updates its sequencing-label-safe expression to require the exact current copy-enforcement and section-catalog status. No constitution rule or roadmap behavior changes.
