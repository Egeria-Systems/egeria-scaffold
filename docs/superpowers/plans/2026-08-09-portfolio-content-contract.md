# Portfolio Content Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task by task, `superpowers:test-driven-development` for each behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim.

**Goal:** Make the actual builder generate versioned, strictly validated YAML 1.2 configuration and Markdown-with-YAML-front-matter content for the first P2 portfolio increment.

**Architecture:** Extend the private source-generated `content-files` capability and explicit template catalog. A generated pure parser validates exact content shapes; a fixed-path server reader owns filesystem effects. Current profiles materialize recipe `0.2.0`, retained `0.1.0` project/state provenance remains readable, and the production CLI regenerates immutable portfolio/site fixtures whose installed state is re-inferred and built.

**Tech stack:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, Zod `4.4.3`, YAML `2.9.0`, Node test runner, Next.js `16.3.0`, React/React DOM `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, ESLint `9.39.5`.

**Design authority:** The [approved source plan](../../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), accepted ADRs `0001`–`0011`, the [program roadmap](../../roadmaps/program-roadmap.md), and [preparation evidence](../../implementation-evidence/2026-08-09-portfolio-content-contract-preparation.md).

## Approval and execution boundary

The user explicitly preapproved plan amendments and authorized continuation through review of the implemented task. That approval covers this source-only, exact-file amendment without a second planning pause. It does not authorize copy-rule publication, push, pull request, merge, package publication, workflow dispatch, deployment, provider mutation, persistent-data action, production action, permission change, external message, or response to review comments.

All work occurs in `/private/tmp/egeria-scaffold-portfolio-content-validation` on branch `portfolio-content-validation`, based on `5580da10eded51ceefa53a068c7ddaaddf2a2d50`. Before each commit, confirm the exact staged set, run `git diff --cached --check`, and preserve all unrelated work. Use `CI=true volta run --node 22.23.2 --pnpm 11.20.0` for repository pnpm commands.

If an accepted ADR, source plan, nested instruction, relevant manifest, or direct content/generation contract changes from the frozen base, amend this plan before continuing. Ordinary implementation corrections inside the exact boundary are preapproved but must be recorded in the verification evidence.

## Scope amendment and non-goals

The repository's first P2 bullet combines YAML/Markdown content with copy enforcement. This reviewable increment implements the content-format and generation contract only. The public standards package remains the canonical owner of copy enforcement. Do not add project-local JSX/attribute/metadata literal rules, missing/unused-key checks, locale parity, Changesets, public package versioning/publication, or generated adoption of an unpublished standards release.

Do not add Markdown rendering, MDX, a content framework, arbitrary caller paths, raw-HTML execution, multilingual support, bounded UI sections, visual design, Calendly, analytics, CI/deployment, accessibility automation, a retained client project, existing-repository transformation, migration execution, providers, later profiles/capabilities, `apps/jobs`, or invented CRUD.

## Exact final file set

Create:

```text
packages/builder-core/templates/common/apps/web/content/content.config.yaml
packages/builder-core/templates/portfolio/apps/web/content/en-CA/long-form/introduction.md.template
packages/builder-core/templates/site/apps/web/content/en-CA/long-form/introduction.md.template
docs/implementation-evidence/2026-08-09-portfolio-content-contract-verification.md
docs/review-packets/2026-08-09-portfolio-content-contract.md
```

Modify canonical contracts, catalog, templates, and direct documentation:

```text
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/contracts/project.ts
packages/builder-core/src/contracts/state.ts
packages/builder-core/src/resolution/resolve-capabilities.ts
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/app/layout.tsx
packages/builder-core/templates/common/apps/web/src/content/content-schema.ts
packages/builder-core/templates/common/apps/web/src/content/read-content.ts
packages/builder-core/AGENTS.md
packages/builder-core/README.md
docs/architecture/package-ownership.md
docs/architecture/enforcement-map.md
```

Modify tests, verification contracts, and checked schemas:

```text
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/package-boundaries/private-packages.test.mjs
scripts/verify-generated-skeletons.mjs
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
```

Regenerate only derived committed fixture files beneath:

```text
fixtures/generated/portfolio
fixtures/generated/site
```

Expected fixture changes are the two new content files, current recipe/capability versions, changed generated parser/reader/guidance/layout bytes, and derived state fingerprints. No manifest dependency or lockfile graph is expected to change. If generation adds, removes, or changes another path, inspect and amend the plan before copying it into the committed fixture.

This preparation record and plan are also in scope:

```text
docs/implementation-evidence/2026-08-09-portfolio-content-contract-preparation.md
docs/superpowers/plans/2026-08-09-portfolio-content-contract.md
```

## Content and version contracts

Current profile recipes use `recipeVersion: "0.2.0"`. Runtime profile, project, and state contracts accept exactly `"0.1.0"` or `"0.2.0"`; they continue rejecting other versions. `ResolvedCapabilities["recipeVersion"]` derives from `ProfileRecipe` rather than duplicating the literal union.

The `content-files` descriptor advances to `0.2.0` and owns two additional application-owned full-file surfaces and inference probes:

```text
content-files-configuration
apps/web/content/content.config.yaml

content-files-long-form-introduction
apps/web/content/en-CA/long-form/introduction.md
```

The content configuration bytes are exactly:

```yaml
schemaVersion: 1.0.0
defaultLocale: en-CA
locales:
  - en-CA
```

The parser exposes:

```ts
export type ContentConfiguration = Readonly<{
  schemaVersion: "1.0.0";
  defaultLocale: "en-CA";
  locales: readonly ["en-CA"];
}>;

export type LongFormDocument = Readonly<{
  frontMatter: Readonly<{
    title: string;
    summary: string;
  }>;
  body: string;
}>;

export function parseContentConfiguration(value: unknown): ContentConfiguration;
export function parseMarkdownContent(source: string): LongFormDocument;
```

`parseContentConfiguration` requires the exact three keys and exact values above. `parseMarkdownContent` normalizes CRLF and lone CR to LF, rejects disallowed C0/DEL controls, requires an opening delimiter on the first line and one later closing delimiter line, parses the intervening YAML with the existing strict YAML 1.2 function, requires exactly `title` and `summary` as non-empty strings, and returns a trimmed non-empty body. Every invalid input throws `TypeError("CONTENT_INVALID")` without echoing source content.

The reader exports fixed-path `readContentConfiguration()` and `readIntroductionContent()` functions. It never accepts a caller path. The layout sources its `lang` from `readContentConfiguration().defaultLocale`. The introduction body remains opaque data and is not rendered in this increment.

Both profile Markdown templates use the existing `displayNameJson` token for `title`, an externalized profile-appropriate summary, and one externalized plain Markdown paragraph. Generated TypeScript/TSX must contain none of those visible strings.

## Expected output contracts

The in-memory renderer emits 23 files for `portfolio` and 25 for `site`. New exact paths for both profiles are:

```text
apps/web/content/content.config.yaml
apps/web/content/en-CA/long-form/introduction.md
```

Renderer ownership counts advance from 40/42 to 42/44. Generated repository managed-surface counts advance from 43/45 to 45/47. Delivered committed fixture counts advance from 25/27 to 27/29.

The generated project desired and installed state records recipe `0.2.0`; installed `content-files` records version `0.2.0`. Every other executable capability and public package remains at its current exact version.

## Task 1: Record preparation and exact plan

**Files:**

- Create: `docs/implementation-evidence/2026-08-09-portfolio-content-contract-preparation.md`
- Create: `docs/superpowers/plans/2026-08-09-portfolio-content-contract.md`

- [x] Verify both documents contain no unresolved placeholders, broken local links, or trailing whitespace.
- [x] Run constitution and semantic-naming checks plus `git diff --check`.
- [x] Commit exactly the two planning artifacts with message `Plan portfolio content validation`.

## Task 2: RED — specify recipe evolution and generated content behavior

**Files:**

- Modify: `packages/builder-core/tests/contracts.test.mjs`
- Modify: `packages/builder-core/tests/resolution.test.mjs`
- Modify: `packages/builder-core/tests/render-skeleton.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

- [x] Add contract assertions that retained `0.1.0` and current `0.2.0` recipe provenance are accepted while `0.3.0` is rejected.
- [x] Update current catalog/recipe expectations to `content-files@0.2.0` and recipes `0.2.0`.
- [x] Add exact common/profile template inventory and rendered-path expectations.
- [x] Add executable parser tests for valid content configuration and Markdown, CRLF normalization, exact front-matter keys, required delimiters/body, unsafe controls, unsafe YAML features, and stable content-free failure.
- [x] Add externalized-copy, fixed-reader-path, deterministic-byte, profile-output, and 42/44 ownership assertions.
- [x] Build builder-core and run the focused named tests. Record the expected failures caused only by missing new behavior and changed versions.

## Task 3: GREEN — implement the minimum content contract

**Files:**

- Modify the exact runtime, catalog, template, schema, and direct-owner files listed above.
- Create the three exact template files listed above.

- [x] Accept exact retained/current recipe versions and derive the resolved recipe type from the profile schema.
- [x] Advance current recipes and `content-files` versions without changing other capabilities or dependencies.
- [x] Add explicit managed surfaces, probes, and allowlisted templates for the configuration and Markdown document.
- [x] Implement only the strict pure parser functions and fixed-path reader functions specified above.
- [x] Source layout locale from validated configuration and keep Markdown opaque.
- [x] Update generated guidance and direct owner documentation without duplicating canonical architecture rules.
- [x] Regenerate checked schemas with the repository schema generator.
- [x] Rerun the focused tests until GREEN, then run the full builder-core and package-boundary checks once for this coherent batch.
- [x] Commit the exact source/test/schema/doc batch with message `Add validated portfolio content contracts`.

## Task 4: RED/GREEN — update production fixture contracts

**Files:**

- Modify: `packages/builder-core/tests/generate-project.test.mjs`
- Modify: `scripts/verify-generated-skeletons.mjs`
- Regenerate: `fixtures/generated/portfolio/**`
- Regenerate: `fixtures/generated/site/**`

- [x] First update expected rendered paths, delivered paths, recipe/capability versions, and 45/47 surface counts.
- [x] Run focused generation and fixture checks against the old fixtures and record the expected inventory/state mismatch.
- [x] Build the production CLI, generate each profile twice in fresh temporary roots, and require byte-identical output before changing committed fixtures.
- [x] Inspect the exact generated inventory and copy only the identity-matched generated roots into their corresponding fixture directories. No path removal is expected.
- [x] Confirm the root and fixture lockfile dependency graphs did not change unexpectedly.
- [x] Run focused generation tests, fixture determinism, read-only inference agreement, and fixed-root generated project verification until GREEN.
- [x] Commit exact fixture/test/harness changes with message `Refresh generated content fixtures`.

## Task 5: Independent reviews and evidence-backed repair

- [x] Freeze the exact base/head comparison and changed-file list.
- [x] Dispatch one read-only requirements reviewer, one read-only architecture/anti-overengineering reviewer, and one read-only test-evidence reviewer. Give each the exact comparison and prohibit edits, recursive fan-out, external mutation, and scope expansion.
- [x] Validate every reported finding against the current tree.
- [x] For each material defect, add a focused failing test where applicable, make the minimum repair, rerun affected checks, and record the disposition. Do not implement preferences or speculative improvements.
- [x] Ask the relevant reviewer to verify any material repair. Do not repeat unchanged reviews.
- [x] Commit evidence-backed repairs in focused commits named for the actual change.

## Task 6: Final verification, evidence, and review packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-09-portfolio-content-contract-verification.md`
- Create: `docs/review-packets/2026-08-09-portfolio-content-contract.md`

- [x] Run `CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:builder-kernel` once against the final executable/template/fixture tree.
- [x] Run fresh `pnpm audit --audit-level moderate`, `pnpm audit signatures`, constitution, semantic naming, and `git diff --check` as proportionate final checks.
- [x] Record exact commits, comparison, changed files, TDD RED/GREEN evidence, commands/results, reviewer dispositions, version behavior, fixture counts, hashes where useful, risks, deferrals, claim limits, and rollback/recovery.
- [x] Confirm no unauthorized Changeset, package bump/publication, push, pull request, merge, deployment, provider mutation, persistent-data action, permission change, external message, or review-comment response occurred.
- [x] Commit the two final artifacts and any direct documentary cross-link corrections with message `Record portfolio content verification`.
- [x] Stop for explicit verified-final-diff review. Do not integrate the branch or begin the next P2 increment.

## Rollback and recovery

Use focused newest-first `git revert` commits rather than reset or history rewriting. Reverting the fixture commit restores the prior generated project evidence; reverting the content-contract commit restores recipe/capability `0.1.0`, templates, parser behavior, and checked schemas; reverting the planning commit withdraws only the plan/evidence record. After a source revert, regenerate fixtures from the restored production CLI and rerun `verify:builder-kernel`.

This increment has no persistent-data or provider rollback. Temporary install, build, and generated-project directories are non-authoritative and can be recreated with the exact pinned toolchain.

## Execution amendment — canonical diagnostic repository

The first full builder-core GREEN attempt exposed one direct current-catalog consumer in `packages/builder-core/tests/diagnostics.test.mjs`. Its canonical in-memory portfolio materializes every current capability surface and therefore became incomplete when the two content-files probes/surfaces were added. The preapproved exact-file plan amendment adds that test file to the coherent source batch and adds only the two new source entries to its existing canonical file map. It does not change diagnostic policy, production code, stable output, or synthetic retained-`0.1.0` provenance. The original failure and repaired result must be recorded in verification evidence.

The fixture contract exported by `scripts/verify-generated-skeletons.mjs` is consumed directly by `tests/generated-fixtures/determinism.test.mjs`. Advancing recipe/capability versions and surface counts therefore requires that test to assert the new contract. The exact-file plan now records this direct consumer; the omission did not authorize a broader fixture or test change.

## Requirements-review repair — decoded control characters

Requirements review reproduced escaped YAML NUL and DEL values that pass the raw Markdown source check and decode into front-matter strings. The repair adds RED regressions for encoded forbidden controls, applies the existing disallowed-control predicate to decoded non-empty content strings, regenerates the affected parser fixtures and installed-state fingerprints, and reruns the content parser plus fixture/build gates. It does not add a renderer, sanitizer, dependency, content shape, or new failure identifier.

## Post-approval integration and next baseline

On 2026-08-09, the user approved the P1 final comparison `303ee9d35e19f9191948d994159f77c82c90a1ed..5580da10eded51ceefa53a068c7ddaaddf2a2d50`, approved this increment's exact final comparison `5580da10eded51ceefa53a068c7ddaaddf2a2d50..e0886fb776f5cd80c34a6ab5c28e355cc1abd7b9`, and authorized local integration. Clean local `main` was fast-forwarded to `e0886fb776f5cd80c34a6ab5c28e355cc1abd7b9` without a merge commit.

The isolated execution boundary above remains the factual record for this completed increment. Task 2 is the separately reviewed standards-owned copy-enforcement increment. Its preparation and exact-file plan use clean local `main` when preflight confirms one sequential builder-repository stream under the [review and contribution protocol](../../governance/review-and-contribution.md). This development-mode decision does not authorize npm publication, push, pull request, deployment, provider mutation, or a builder transformation of a generated client repository.
