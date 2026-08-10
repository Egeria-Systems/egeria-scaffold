# Bounded Section Catalog Review Packet

**Date:** 2026-08-09 (America/Toronto)

**Outcome:** READY FOR IMPLEMENTED-TASK AND VERIFIED-FINAL-DIFF APPROVAL after evidence-backed review repairs.

**Implementation comparison:** `83fe0e667a62701de881497d9293fc2355ef7654..f4cb864de31ca6cc7e7e5817ca468f6d21d34d4a`

**Verified implementation tree:** `29bd1e286733c217be68bbcb9b1bacb40d681f3f`

The work developed directly on the approved clean sequential local `main` stream. The separate final artifact commit completes the plan checklist and adds this packet and verification evidence only; its exact hash is reported at handoff.

Remote refs were not refreshed because the approved work is a local source-bound increment and remote freshness does not alter its accepted architecture or generated contract. Current primary documentation, advisories, registry audit/signature state, production generation, and builds were refreshed independently.

## Scope and result

The actual builder now generates a strict four-type section catalog for `portfolio` and `site`. Ordered validated YAML selects `hero`, `text`, `project-list`, and `call-to-action` sections. Each source value has exact keys, one approved variant, stable unique IDs, typed content, and one hero first among enabled sections. Disabled sections are validated and omitted without reordering enabled content.

The shared link boundary accepts reviewed root-relative, non-empty hash, credential-free HTTPS, and non-empty mailto destinations and rejects protocol-relative, executable, unknown, credential-bearing, backslash, normalization-whitespace, empty, and relative-path values. It applies to navigation, projects, and calls to action.

The source-owned registry associates every type with its content parser, schema version, profile support, pure Server Component, semantic accessibility requirements, and empty current analytics/migration declarations. Rendering uses stable keys and an exhaustive discriminated switch. Semantic output uses one `h1`, section `h2` headings, project `h3` headings, list/article structure, ordinary anchors, content-backed labels/destinations, and a collision-free heading-ID namespace.

Current profile recipes are `0.3.0`; `section-composition` is `0.2.0`; retained recipe provenance remains readable. The production fixtures have exact 28/30 inventories and 46/48 installed managed surfaces. No dependency graph, lockfile, public package version/API, provider, workflow, deployment, persistent data, or later capability was added.

## Changed files

Planning, architecture, status, and final evidence:

```text
docs/architecture/enforcement-map.md
docs/architecture/overview.md
docs/architecture/package-ownership.md
docs/implementation-evidence/2026-08-09-bounded-section-catalog-preparation.md
docs/implementation-evidence/2026-08-09-bounded-section-catalog-verification.md
docs/review-packets/2026-08-09-bounded-section-catalog.md
docs/roadmaps/program-roadmap.md
docs/superpowers/plans/2026-08-09-bounded-section-catalog.md
docs/superpowers/specs/2026-08-09-bounded-section-catalog-design.md
packages/builder-core/AGENTS.md
packages/builder-core/README.md
```

Contracts, catalog, recipes, templates, configuration, and checked schemas:

```text
eslint.config.mjs
package.json
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/app/page.tsx
packages/builder-core/templates/common/apps/web/src/content/content-schema.ts
packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx
packages/builder-core/templates/common/apps/web/src/sections/section-registry.tsx
packages/builder-core/templates/portfolio/apps/web/content/en-CA/site.yaml.template
packages/builder-core/templates/site/apps/web/app/about/page.tsx
packages/builder-core/templates/site/apps/web/content/en-CA/about.yaml.template
packages/builder-core/templates/site/apps/web/content/en-CA/site.yaml.template
```

Tests and verification consumers:

```text
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/resolution.test.mjs
scripts/verify-generated-skeletons.mjs
tests/constitution/constitution.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/package-boundaries/internal-linting.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/public-standards.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

Generated portfolio fixture:

```text
fixtures/generated/portfolio/.egeria/project.yaml
fixtures/generated/portfolio/.egeria/state.json
fixtures/generated/portfolio/AGENTS.md
fixtures/generated/portfolio/apps/web/AGENTS.md
fixtures/generated/portfolio/apps/web/app/page.tsx
fixtures/generated/portfolio/apps/web/content/en-CA/site.yaml
fixtures/generated/portfolio/apps/web/src/content/content-schema.ts
fixtures/generated/portfolio/apps/web/src/presentation/content-page.tsx
fixtures/generated/portfolio/apps/web/src/sections/section-registry.tsx
```

Generated site fixture:

```text
fixtures/generated/site/.egeria/project.yaml
fixtures/generated/site/.egeria/state.json
fixtures/generated/site/AGENTS.md
fixtures/generated/site/apps/web/AGENTS.md
fixtures/generated/site/apps/web/app/about/page.tsx
fixtures/generated/site/apps/web/app/page.tsx
fixtures/generated/site/apps/web/content/en-CA/about.yaml
fixtures/generated/site/apps/web/content/en-CA/site.yaml
fixtures/generated/site/apps/web/src/content/content-schema.ts
fixtures/generated/site/apps/web/src/presentation/content-page.tsx
fixtures/generated/site/apps/web/src/sections/section-registry.tsx
```

No root/generated lockfile, Changeset, public package source/version, workflow, provider configuration, deployment surface, or application dependency changed.

## Focused commits

- `612dc67` — `Plan bounded section composition`
- `0cd6285` — `Add bounded section composition`
- `ac9c38a` — `Refresh generated section fixtures`
- `820698a` — `Harden generated section identifiers and links`
- `e4e20db` — `Refresh hardened section fixtures`
- `1496689` — `Enforce generated page heading order`
- `17e176b` — `Refresh ordered section fixtures`
- `f4cb864` — `Align roadmap constitution status`

The separate final artifact commit records completed checklists, final evidence, and this packet only.

## Requirement-to-evidence map

| Requirement | Evidence |
| --- | --- |
| Versioned materialized recipes | Current recipe `0.3.0`; retained `0.1.0`/`0.2.0`; `section-composition@0.2.0`; desired/installed/inferred state agrees |
| Bounded section vocabulary | Exact four-type union, exact variants/keys/content, unknown values fail with content-free `CONTENT_INVALID` |
| Ordered accessible heading structure | Exactly one hero first among enabled sections; disabled leading sections allowed and omitted; recursive JSX asserts `h1` then section headings |
| Stable semantic identity | Unique source IDs, stable React keys, reserved `--heading` namespace, exact ARIA target checks |
| Pure presentation | Server Components consume typed data only; no effects, browser APIs, events, raw HTML, Cloudflare types, providers, or platform port |
| Project/list/action semantics | Exact recursive `ul/li/article/h3/a` and CTA assertions with unique content/link sentinels |
| Link safety | Shared fail-closed validation across navigation/project/CTA, including credentials, schemes, backslashes, and normalization whitespace |
| Externalized copy | Visible fixture copy originates in locale YAML; root standards copy command/config includes section templates and passes |
| Capability ownership/state | Exact registry managed surface/probe, 43/45 ownership descriptors, 46/48 installed managed surfaces, current fingerprints |
| Actual production generation | Production CLI generation/builds, state-last receipts, repeated byte equality, committed 28/30-file fixtures, inference/doctor/diff agreement |
| No premature later work | Exact catalog/profile/dependency/file tests; no styling, Calendly, analytics behavior, providers, later capabilities, or `apps/jobs` |

## Verification summary

Final aggregate at implementation HEAD `f4cb864de31ca6cc7e7e5817ca468f6d21d34d4a`:

| Gate | Result |
| --- | --- |
| Constitution and semantic naming | PASS; 21/21 |
| Package boundaries | PASS; 40/40 |
| Private builder-core | PASS; build and 106/106 |
| Thin CLI | PASS; build and 9/9 |
| Generated fixtures | PASS; 7/7; 28/30 byte-stable files |
| Builder lint, copy externalization, build, typecheck | PASS |
| Fixed-root portfolio/site verification | PASS; pnpm, frozen install, peers, audit, signatures, lint, typecheck, Next, OpenNext |
| Changesets status | PASS; existing standards minor intent unchanged; no new bump |
| Final root moderate audit | PASS; no known vulnerabilities |
| Final root registry signatures | PASS; 885/885 |

Fixed-root result:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

Both fixture lockfiles have SHA-256 `028d52c01ccdc8f76b3beb1e764aa5ccb420981efbe45df28478bf680ce2bb11`. Canonical/generated content schemas have SHA-256 `ceb4ed2ea57de6d84c247959006febe8f01cf4f2610bac928604fa9aaf24a172`; canonical/generated section registries have SHA-256 `7440ee450925da589589e6e0174c152e091124973dc5d36832d57eae9747b848`.

Detailed preparation, official-source/advisory evidence, RED/GREEN observations, environment corrections, review dispositions, claim limits, and recovery are in the [preparation evidence](../implementation-evidence/2026-08-09-bounded-section-catalog-preparation.md) and [verification evidence](../implementation-evidence/2026-08-09-bounded-section-catalog-verification.md).

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | URL-normalization whitespace bypass | CLOSED; causal three-consumer regressions, minimum validator repair, regenerated fixtures |
| Requirements and architecture | Derived DOM-ID collision | CLOSED; reserved namespace, global uniqueness/ARIA tests, regenerated fixtures |
| Accessibility | Enabled `h2` could precede page `h1` | CLOSED; first-enabled-hero rule and disabled-leading positive case |
| Accessibility | Nested semantics lacked exact protection | CLOSED; recursive heading/list/article/h3/link/CTA contract |
| Test evidence | Content-backed text/destinations lacked end-to-end assertions | CLOSED; unique sentinel leaves and links |
| Single bounded repair recheck | All five repair areas and generated evidence | PASS; “No material improvements recommended.” |

No material finding remains open. Reviewers were read-only and performed no repository or external mutation.

## Risks and deferred work

- Evidence is static/unit/build evidence. No browser accessibility tree, axe, keyboard/focus, screen-reader, reflow, reduced-motion, visual, performance, or human-usability result exists.
- No WCAG conformance claim is made. Descriptive quality of authored content remains human judgment.
- The UI remains intentionally unstyled. Responsive accessible UI is the next separately gated outcome.
- Calendly, production observability, CI/deployment, retained real-client evidence, and launch-scope approval remain later P2 gates.
- No workerd preview, deployment, provider mutation, or production action ran.
- Audits/signatures and official advisory checks are point-in-time evidence; signatures do not prove upstream source provenance.
- Determinism is exact-toolchain/profile evidence, not independent cross-platform proof.
- Existing-repository changes, migrations, persistent-data/provider recovery, later capabilities/profiles, and `apps/jobs` remain out of scope.
- Remote refs were not refreshed; this packet uses the approved local base and stream.

## Rollback and recovery

Source recovery is a focused newest-first revert of `f4cb864`, `17e176b`, `1496689`, `e4e20db`, `820698a`, `ac9c38a`, `0cd6285`, and `612dc67`, followed by production fixture regeneration and `verify:builder-kernel`. Revert the separate final artifact commit if this packet and verification evidence must also be withdrawn. Do not reset or rewrite shared history.

To withdraw only heading-order enforcement, revert `17e176b` and `1496689`, regenerate both fixtures, and rerun verification. To withdraw only link/DOM-ID hardening, first restore the later pair, then revert `e4e20db` and `820698a`, regenerate, and verify. Never leave current templates paired with stale fixture/state fingerprints.

No persistent-data or provider rollback applies. Temporary package stores, build roots, verifier copies, and disposable generated repositories are non-authoritative and reproducible from the pinned toolchain.

## Approval boundary

Requested decision: approve the exact final committed diff reported at handoff, or request one bounded repair.

Approval closes only P2 Task 3. It does not authorize responsive accessible UI, the next P2 increment, push, pull request, merge, package publication, workflow dispatch, deployment, provider mutation, persistent-data action, production action, permission change, external message, or response to review comments.
