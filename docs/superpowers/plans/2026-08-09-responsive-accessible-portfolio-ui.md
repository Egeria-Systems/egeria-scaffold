# Responsive Accessible Portfolio UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production builder generate a polished responsive Tailwind interface with semantic design tokens, externalized skip-navigation copy, and bounded accessibility foundations for `portfolio` and `site`.

**Architecture:** Evolve the existing `section-composition` source-generated capability to own Tailwind/PostCSS package properties, PostCSS configuration, global design tokens, and responsive pure Server Components. Evolve `content-files` only for the exact externalized skip-link string, advance materialized recipes, and regenerate immutable production fixtures without adding a capability, public package, browser runtime, provider, or later automation outcome.

**Tech Stack:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, YAML `2.9.0`, React/React DOM `19.2.8`, Next.js `16.3.0`, Tailwind CSS `4.3.3`, `@tailwindcss/postcss` `4.3.3`, PostCSS `8.5.22`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, ESLint `9.39.5` in generated projects and `10.8.0` at the builder root, Node test runner.

## Global Constraints

- Work directly on the clean sequential local `main` stream frozen at planning base `e57786d`; do not touch existing separate worktrees.
- Preserve exactly six executable capabilities and the two current `portfolio`/`site` profiles.
- Keep every visible or accessibility string in validated `en-CA` YAML; TSX contains no visible fallback copy.
- Keep presentation pure and server-rendered; add no client component, state, effect, browser API, provider, or Cloudflare type.
- Use exact `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, and patched `postcss@8.5.22`; do not change the root lockfile or public Egeria package versions.
- Preserve native semantic elements, the existing ordered heading contract, safe-link parsing, 320-CSS-pixel-oriented fluid reflow, visible focus, minimum 44-CSS-pixel primary/navigation targets, and reduced-motion protection.
- Do not add Playwright, axe, visual regression, performance thresholds, CI/deployment, Calendly, observability behavior, a human checklist, a conformance claim, images, Markdown rendering, migrations, providers, or a real client repository.
- Before every commit, confirm branch/status, stage only exact intended files, inspect the cached diff, and run `git diff --cached --check`.
- No push, pull request, merge, publication, deployment, workflow dispatch, provider mutation, persistent-data action, production action, permission change, external message, or review-comment response is authorized.

---

## Exact file structure

Create one generated configuration template:

```text
packages/builder-core/templates/common/apps/web/postcss.config.mjs
```

Modify runtime contracts, capability/profile ownership, rendering, and checked schemas:

```text
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/generation/render-skeleton.ts
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
```

Modify generated application templates:

```text
packages/builder-core/templates/common/apps/web/package.json.template
packages/builder-core/templates/common/apps/web/app/globals.css
packages/builder-core/templates/common/apps/web/app/page.tsx
packages/builder-core/templates/common/apps/web/src/content/content-schema.ts
packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx
packages/builder-core/templates/common/apps/web/src/sections/section-registry.tsx
packages/builder-core/templates/portfolio/apps/web/content/en-CA/site.yaml.template
packages/builder-core/templates/site/apps/web/app/about/page.tsx
packages/builder-core/templates/site/apps/web/content/en-CA/site.yaml.template
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
```

Modify exact tests and fixed-root verification consumers:

```text
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/constitution/constitution.test.mjs
tests/generated-fixtures/determinism.test.mjs
scripts/verify-generated-skeletons.mjs
```

Modify only direct documentation/status owners:

```text
README.md
CONTRIBUTING.md
packages/builder-core/AGENTS.md
packages/builder-core/README.md
docs/architecture/overview.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/roadmaps/program-roadmap.md
docs/superpowers/plans/2026-08-09-responsive-accessible-portfolio-ui.md
```

Regenerate only derived committed files beneath:

```text
fixtures/generated/portfolio
fixtures/generated/site
```

Create final evidence only after the reviewed implementation settles:

```text
docs/implementation-evidence/2026-08-09-responsive-accessible-portfolio-ui-verification.md
docs/review-packets/2026-08-09-responsive-accessible-portfolio-ui.md
```

Expected generated counts are 25/27 in-memory template files, 47/49 ownership descriptors, 50/52 installed managed surfaces, and 29/31 committed files for portfolio/site. Discovering another direct current-contract consumer permits an appended exact-file amendment; unrelated changes stop execution.

### Task 1: Validate and commit this exact plan

**Files:**

- Create: `docs/superpowers/plans/2026-08-09-responsive-accessible-portfolio-ui.md`

**Interfaces:**

- Consumes: accepted design `docs/superpowers/specs/2026-08-09-responsive-accessible-portfolio-ui-design.md` and preparation evidence.
- Produces: exact versions, file scope, tests, commits, review roles, and recovery boundary for all later tasks.

- [ ] **Step 1: Self-review spec coverage and exact paths**

Confirm every design section maps to Tasks 2–6 and every referenced source/test path exists except the two explicitly new files.

- [ ] **Step 2: Scan for plan failures**

Run:

```bash
rtk rg -n "T[B]D|T[O]DO|F[I]XME|PLACEH[O]LDER|add appropriat[e]|write tests fo[r]|similar to T[a]sk" docs/superpowers/plans/2026-08-09-responsive-accessible-portfolio-ui.md
```

Expected: no matches.

- [ ] **Step 3: Verify planning-only contracts**

Run:

```bash
rtk node --test tests/constitution/constitution.test.mjs tests/constitution/semantic-naming.test.mjs
rtk git diff --check
```

Expected: 21/21 tests pass and no diff-check output.

- [ ] **Step 4: Commit the plan**

Stage only this plan, inspect the cached diff, and commit:

```bash
git commit -m "Plan responsive portfolio interface"
```

### Task 2: RED — specify versions, ownership, content, and responsive UI

**Files:**

- Modify: `packages/builder-core/tests/contracts.test.mjs`
- Modify: `packages/builder-core/tests/resolution.test.mjs`
- Modify: `packages/builder-core/tests/render-skeleton.test.mjs`
- Modify: `packages/builder-core/tests/generate-project.test.mjs`
- Modify: `packages/builder-core/tests/diagnostics.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

**Interfaces:**

- Consumes: existing `parseSiteContent`, `ContentPage`, `sectionRegistry`, capability descriptors, profile recipes, template catalog, and ownership materialization.
- Produces: failing contracts for `SiteContent.accessibility.skipToContent`, recipe `0.4.0`, `content-files@0.3.0`, `section-composition@0.3.0`, exact Tailwind/PostCSS surfaces, and responsive class/token behavior.

- [ ] **Step 1: Write version and capability RED assertions**

Add exact acceptance for retained recipe versions through `0.4.0`, rejection of `0.5.0`, and descriptor expectations equivalent to:

```js
assert.equal(sectionComposition.version, "0.3.0");
assert.deepEqual(sectionComposition.requiredPackages, [
  "@tailwindcss/postcss",
  "postcss",
  "tailwindcss",
]);
assert.deepEqual(
  sectionComposition.managedSurfaces.map(({ path }) => path),
  [
    "apps/web/app/globals.css",
    "apps/web/app/page.tsx",
    "apps/web/package.json",
    "apps/web/package.json",
    "apps/web/package.json",
    "apps/web/postcss.config.mjs",
    "apps/web/src/presentation/content-page.tsx",
    "apps/web/src/sections/section-registry.tsx",
  ],
);
```

Assert three exact package probes, the PostCSS/global-style file probes, profile recipe `0.4.0`, content-files `0.3.0`, and 47/49 ownership descriptors. Assert `builder-global-styles` is absent so the global stylesheet has only the capability owner.

- [ ] **Step 2: Write externalized accessibility-copy RED cases**

Require exact top-level site keys `metadata`, `accessibility`, `home`, and `navigation`, returning:

```js
accessibility: { skipToContent: "Skip to sentinel content" }
```

Add rejection cases for missing/extra accessibility keys, empty/non-string labels, and forbidden decoded control characters. Require `ContentPage` callers to pass `content.accessibility.skipToContent` and require no quoted visible skip literal in TSX.

- [ ] **Step 3: Write deterministic design-token RED assertions**

Read rendered `globals.css` and require `@import "tailwindcss"`, exact semantic token values, `@theme inline`, `overflow-wrap: anywhere`, `:focus-visible`, forced-colours, and reduced-motion rules. Calculate palette contrast using the WCAG relative-luminance formula:

```js
function contrastRatio(foreground, background) {
  const relativeLuminance = (hex) => {
    const channels = hex.match(/[0-9a-f]{2}/giu).map((value) =>
      Number.parseInt(value, 16) / 255,
    );
    const [red, green, blue] = channels.map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [relativeLuminance(foreground), relativeLuminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}
```

Require at least 4.5 for ink/canvas, muted/canvas, accent/canvas, accent-contrast/accent, focus/canvas, ink/surface, and muted/surface.

- [ ] **Step 4: Write pure responsive-component RED assertions**

Extend the deterministic JSX runtime assertions to require:

```js
assert.equal(pageTree.type, Symbol.for("react.fragment"));
assert.equal(skipLink.props.href, "#main-content");
assert.equal(main.props.id, "main-content");
assert.equal(main.props.tabIndex, -1);
assert.match(navigationLink.props.className, /min-h-11/u);
assert.match(projectList.props.className, /md:grid-cols-2/u);
assert.match(callToActionLink.props.className, /min-h-12/u);
```

Require the skip link only when navigation is non-empty, stable semantic IDs/ARIA associations, one `main`, native `nav`, existing heading/list/article structure, and no client/effect/browser/platform imports.

- [ ] **Step 5: Write template/package/inventory RED assertions**

Require `postcss.config.mjs` in the exact template allowlist and rendered inventories; exact generated dev dependencies:

```json
{
  "@tailwindcss/postcss": "4.3.3",
  "postcss": "8.5.22",
  "tailwindcss": "4.3.3"
}
```

Require 25/27 in-memory files, 50/52 installed surfaces, and current capability/recipe versions.

- [ ] **Step 6: Run the focused RED batch**

Run:

```bash
rtk pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/resolution.test.mjs packages/builder-core/tests/render-skeleton.test.mjs packages/builder-core/tests/generate-project.test.mjs packages/builder-core/tests/diagnostics.test.mjs tests/package-boundaries/private-packages.test.mjs
```

Expected: failures only for absent `0.4.0`, new capability/package/surface contracts, accessibility copy, PostCSS file, design tokens/classes, and new counts.

### Task 3: GREEN — implement the minimum responsive accessible interface

**Files:** all runtime/template/schema/documentation files in the exact structure above, excluding fixtures and final evidence.

**Interfaces:**

- Consumes: Task 2 failing tests and current safe content/section contracts.
- Produces: parsed `SiteContent.accessibility`, `ContentPage({ sections, navigation, skipToContent })`, responsive Tailwind components, exact generated package/configuration surfaces, and current recipe/capability metadata.

- [ ] **Step 1: Implement version and ownership contracts**

Add `"0.4.0"` to `profileRecipeVersionSchema`, advance both recipes, advance only content-files and section-composition capability versions, and add the exact package/file surfaces and probes. Remove only this builder surface:

```ts
createFileSurface(
  "builder-global-styles",
  "apps/web/app/globals.css",
  "application-owned",
)
```

Regenerate the three checked schemas with `pnpm --filter @egeria-systems/builder-core run schema:generate`; never hand-edit them.

- [ ] **Step 2: Implement the exact Tailwind/PostCSS templates**

Create:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

Add the exact three dev dependencies, catalog the configuration, and replace global CSS with the accepted token/theme/focus/wrapping/motion contract. Keep all colour literals confined to the global token owner.

- [ ] **Step 3: Implement externalized skip-navigation content**

Add the exact readonly type:

```ts
accessibility: Readonly<{ skipToContent: string }>;
```

Parse it through `isNonEmptyString`, add `Skip to content` to both site-content templates, and pass it through the home and about routes. Invalid input must still throw only `TypeError("CONTENT_INVALID")`.

- [ ] **Step 4: Implement responsive pure presentation**

Keep the components as Server Components. Use semantic Tailwind classes for fluid shell spacing, wrapped navigation, readable measure, responsive project grid, high-contrast CTA, and large link targets. `ContentPage` renders the skip link conditionally before `<main id="main-content" tabIndex={-1}>` and never embeds visible copy.

- [ ] **Step 5: Update direct guidance and canonical owners**

Record current recipe/capability versions, Tailwind/PostCSS ownership, externalized accessibility copy, responsive source evidence, and claim limits. Advance the roadmap status through Task 4 while naming Calendly as the next separately gated outcome. Update README/CONTRIBUTING and their exact constitution consumers together.

- [ ] **Step 6: Run focused GREEN and package boundaries**

Run:

```bash
rtk pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/resolution.test.mjs packages/builder-core/tests/render-skeleton.test.mjs packages/builder-core/tests/generate-project.test.mjs packages/builder-core/tests/diagnostics.test.mjs
rtk node --test tests/package-boundaries/*.test.mjs
rtk pnpm run check:copy-externalization
rtk node --test tests/constitution/*.test.mjs
```

Expected: all focused tests pass; full builder-core generation/fixture assertions may remain RED only where old committed fixtures are the direct cause.

- [ ] **Step 7: Commit the coherent source batch**

Commit exact source, tests, schemas, and direct documentation with:

```bash
git commit -m "Add responsive portfolio interface"
```

### Task 4: RED/GREEN — refresh production generation evidence

**Files:**

- Modify: `scripts/verify-generated-skeletons.mjs`
- Modify: `tests/generated-fixtures/determinism.test.mjs`
- Regenerate: `fixtures/generated/portfolio/**`
- Regenerate: `fixtures/generated/site/**`

**Interfaces:**

- Consumes: production CLI at Task 3 HEAD.
- Produces: exact 29/31-file committed fixtures, patched dependency locks, 50/52 installed surfaces, and byte/state/inference agreement.

- [ ] **Step 1: Update expected fixture contracts before replacement**

Add `apps/web/postcss.config.mjs`; require recipe `0.4.0`, content-files `0.3.0`, section-composition `0.3.0`, surfaces 50/52, and the exact three manifest versions in the fixed-root verifier.

- [ ] **Step 2: Run fixture assertions against old bytes and record RED**

Run:

```bash
rtk pnpm run build:builder
rtk node --test tests/generated-fixtures/determinism.test.mjs
```

Expected: failure caused by committed old inventory/package/version/content/style/fingerprint bytes.

- [ ] **Step 3: Generate each profile twice with the production CLI**

Use identity-bounded temporary parents and exact commands:

```bash
node apps/cli/dist/index.js create --profile portfolio --name acme-portfolio --display-name "Acme Portfolio" --directory <absent-temp-destination>
node apps/cli/dist/index.js create --profile site --name acme-site --display-name "Acme Site" --directory <absent-temp-destination>
```

Require each command's one-line success JSON, two byte-identical snapshots per profile, exact inventories, exact manifest versions, patched PostCSS resolution, and state/inference agreement.

- [ ] **Step 4: Replace only the committed fixture roots**

Use the identity-matched generated outputs; do not edit generated files by hand. Confirm the root `pnpm-lock.yaml`, public package versions, compatibility proof, workflows, and unrelated worktrees remain unchanged.

- [ ] **Step 5: Run fixture and fixed-root GREEN**

Run:

```bash
rtk pnpm run test:generated-fixtures
rtk pnpm run verify:generated-skeletons
```

Expected: deterministic regeneration passes and both isolated fixture copies pass pnpm version, frozen install, peers, moderate audit, registry signatures, lint, typecheck, Next build, and OpenNext build.

- [ ] **Step 6: Commit fixture evidence**

Commit exact fixture, fixture-test, and verifier changes with:

```bash
git commit -m "Refresh responsive portfolio fixtures"
```

### Task 5: Independent reviews and evidence-backed repair

**Files:** only files required by verified material findings; append each amendment below this plan before editing.

**Interfaces:**

- Consumes: frozen planning-base-to-implementation-HEAD comparison and fresh verification output.
- Produces: requirements, architecture/anti-overengineering, test-evidence, and accessibility dispositions with no unresolved material defect.

- [ ] **Step 1: Freeze review scope**

Record exact base/head hashes, `git diff --name-status`, commit list, and commands/results. Prohibit reviewer edits, recursive fan-out, external mutation, review-comment responses, and scope expansion.

- [ ] **Step 2: Dispatch independent read-only reviewers**

Requirements checks accepted scope and exact version/content/ownership behavior. Architecture checks cohesion, six-capability preservation, pure presentation, no abstraction/package/provider drift, and single ownership. Test evidence checks RED causality, deterministic fixture/state evidence, audits/builds, and claim limits. Accessibility checks semantics, skip behavior, focus, colour calculations, target sizing, wrapping/reflow source contract, reduced motion, and conformance language.

- [ ] **Step 3: Validate every finding**

Reproduce or disconfirm each finding against current source and the smallest deterministic command. Do not implement preferences or speculative hardening.

- [ ] **Step 4: Repair only material defects through TDD**

For each accepted defect, add a focused causal RED, make the minimum correction, rerun the affected checks, append its exact files/rationale to this plan, and commit with a short message naming the repair.

- [ ] **Step 5: Recheck material repairs once**

Use at most one bounded read-only reviewer for the combined repair set. Do not repeat unchanged reviews.

### Task 6: Final verification, evidence, and review packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-09-responsive-accessible-portfolio-ui-verification.md`
- Create: `docs/review-packets/2026-08-09-responsive-accessible-portfolio-ui.md`
- Modify: `docs/superpowers/plans/2026-08-09-responsive-accessible-portfolio-ui.md`

**Interfaces:**

- Consumes: settled reviewed HEAD and every fresh command receipt.
- Produces: final comparison, change inventory, review dispositions, risks, deferrals, recovery, and explicit implemented-task approval request.

- [ ] **Step 1: Run the complete builder candidate once**

Run against the unchanged settled tree:

```bash
rtk pnpm run verify:builder-kernel
```

Expected: constitution, semantic naming, package boundaries, builder-core, CLI, generated fixtures, copy lint, builds, typechecks, fixed-root generated verification, and changeset status all pass.

- [ ] **Step 2: Run fresh proportional security and diff checks**

Run:

```bash
rtk pnpm audit --audit-level moderate
rtk pnpm audit --config.auditLevel=moderate --prod=false
rtk pnpm exec npm audit signatures
rtk git diff --check <planning-base>..HEAD
rtk git status --short
```

Record exact results without treating point-in-time audit/signature evidence as provenance or general security proof. Do not repeat the unchanged expensive generated build harness.

- [ ] **Step 3: Write verification evidence and review packet**

Record exact commits/comparison, changed files, RED/GREEN evidence, current official sources/advisories, final commands/results, dependency/lock versions, generated counts/hashes, reviewer dispositions, risks, deferred browser/visual/performance/human checks, no-conformance language, and source/dependency recovery.

- [ ] **Step 4: Confirm authorization boundaries**

State that no unauthorized push, pull request, merge, publication, deployment, workflow/provider/persistent-data/production mutation, permission change, external message, or review-comment response occurred.

- [ ] **Step 5: Commit final artifacts and stop**

Commit only the completed plan checklist, final evidence, and packet with:

```bash
git commit -m "Record responsive portfolio verification"
```

Stop for explicit implemented-task and verified-final-diff approval. Do not begin Calendly.

## Rollback and recovery

Use focused newest-first `git revert` commits, never reset or history rewriting. Revert final evidence, fixture evidence, implementation, plan, and design/preparation in reverse order as needed. After any implementation revert, regenerate both fixtures from the restored production CLI and rerun `verify:builder-kernel`; never leave template, lockfile, state fingerprint, and committed fixture bytes out of agreement.

Dependency rollback removes exact Tailwind/PostCSS manifest entries and regenerated lock resolutions with the source revert. There is no deployment, provider, persistent-data, analytics, booking, publication, or external-system recovery. Temporary generation, store, install, build, and test directories are non-authoritative and identity-bounded.
