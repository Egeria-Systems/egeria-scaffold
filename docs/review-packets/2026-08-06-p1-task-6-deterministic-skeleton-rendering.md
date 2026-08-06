# P1 Task 6 Review Packet — Deterministic Skeleton Rendering

**Date:** 2026-08-06 (America/Toronto)

**Outcome:** PASS after evidence-backed repairs. Stop at Gate 3 before Task 7.

**Verified source comparison:** `5ed163040191d1a67052afdc08a3a9c9a379e6ab..d5f01353d5ac91b908889d41e5bf5a8c1c7e3f85`

Remote refs were not refreshed. This packet reviews the approved local P1 stream and current official upstream evidence. Implementation ran in isolated worktree `/private/tmp/egeria-scaffold-p1-task-6` on `p1-task-6-skeleton-rendering`. The primary checkout's user-owned root `AGENTS.md` edit, two semantic-naming files, and separate semantic-naming worktree are excluded and untouched.

## Scope and result

Private `builder-core` now exposes deterministic in-memory `renderSkeleton` behavior for only the approved public profiles:

- `portfolio`: one page, 21 sorted files, five materialized capabilities, 40 valid ownership descriptors;
- `site`: the common skeleton plus `/about`, 23 sorted files, six capabilities, 42 descriptors.

The renderer uses an exact template allowlist, three strict tokens, validated relative paths, LF-normalized bytes, structural exact-version manifest insertion, strict YAML 1.2 content, pure generated presentation, explicit Cloudflare boundaries, and current hybrid ownership validation. The rendered files satisfy every inference probe in their resolved recipe.

Installed state is not written. No destination, `.egeria` file, migration, generated lockfile, install, build, CLI behavior, provider, database, queue, email, identity, payment, analytics, CMS, `apps/jobs`, deployment, publication, or invented CRUD is included.

## Changed files

Canonical owners and implementation records:

```text
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/implementation-evidence/2026-08-06-deterministic-skeleton-rendering-preparation.md
docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
docs/superpowers/plans/2026-08-06-deterministic-skeleton-rendering.md
packages/builder-core/AGENTS.md
packages/builder-core/README.md
```

Executable private builder-core source:

```text
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/generation/render-skeleton.ts
packages/builder-core/src/generation/render-template.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/index.ts
```

Exact common template sources:

```text
packages/builder-core/templates/common/.gitignore.template
packages/builder-core/templates/common/.nvmrc
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/app/globals.css
packages/builder-core/templates/common/apps/web/app/layout.tsx
packages/builder-core/templates/common/apps/web/app/page.tsx
packages/builder-core/templates/common/apps/web/eslint.config.mjs
packages/builder-core/templates/common/apps/web/next.config.ts
packages/builder-core/templates/common/apps/web/open-next.config.ts
packages/builder-core/templates/common/apps/web/package.json.template
packages/builder-core/templates/common/apps/web/src/content/content-schema.ts
packages/builder-core/templates/common/apps/web/src/content/read-content.ts
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/installed-capability.ts
packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx
packages/builder-core/templates/common/apps/web/tsconfig.json
packages/builder-core/templates/common/apps/web/wrangler.jsonc.template
packages/builder-core/templates/common/package.json.template
packages/builder-core/templates/common/pnpm-workspace.yaml
```

Exact profile overlays and tests:

```text
packages/builder-core/templates/portfolio/apps/web/content/en-CA/site.yaml.template
packages/builder-core/templates/site/apps/web/app/about/page.tsx
packages/builder-core/templates/site/apps/web/content/en-CA/about.yaml.template
packages/builder-core/templates/site/apps/web/content/en-CA/site.yaml.template
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/resolution.test.mjs
tests/package-boundaries/private-packages.test.mjs
```

Gate artifacts added after the frozen source candidate:

```text
docs/implementation-evidence/2026-08-06-deterministic-skeleton-rendering-verification.md
docs/review-packets/2026-08-06-p1-task-6-deterministic-skeleton-rendering.md
```

## Focused commits

- `ed33e97` — approved preparation evidence and exact-file plan.
- `bd9e176` — initial deterministic renderer, templates, ownership, tests, and direct owners.
- `742bb4d` — YAML 1.2 canonical-contract and Cloudflare-evidence repair.
- `1ab75e5` — immutable validated package-version snapshot plus parser/inference/purity test protection.
- `d5f0135` — complete read-only guard across the three-module generation allowlist.

## Requirement-to-evidence map

| Requirement | Evidence |
| --- | --- |
| Deterministic portfolio/site skeletons | Exact 21/23 path assertions, repeated byte equality, and fixed hashes in the verification record |
| Materialized recipes and authoritative capabilities | Desired project equals resolution; both rendered profiles infer every capability as `probable` with every probe `present` |
| Hybrid ownership | Exact 40/42 descriptors, one owner per generated surface/manifest region, and `materializeInstalledSurfaces` success |
| Copy externalization | Runtime UI/metadata copy exists only in generated YAML; emitted strict parser and typed shape validators run against valid and hostile fixtures |
| Cloudflare and presentation boundaries | Rendered-source Cloudflare import/type gate plus single type-only presentation import and side-effect-global exclusions |
| Safe package sources | Exact-semver catalog validation, structural insertion, and in-flight mutation regression using an immutable validated snapshot |
| No later capabilities or write/state behavior | Exact path/content negatives, template snapshots, exact three-module read-only guard, no `.egeria`/CLI/destination API |
| Private replaceable package boundaries | Root export allowlist, generated ordinary exact dependencies, package-boundary and constitution suites |

## Verification summary

- Builder-core: build, checked JSON schemas, 85/85 tests, no-emit typecheck, and zero-warning lint passed.
- Package boundaries: 22/22 passed.
- Constitution and repository-local links: 13/13 passed.
- Renderer suite: 16/16 passed after review repairs.
- Source comparison and working-tree diff checks: passed.
- Approved source-plan and lockfile hashes remained `30860d49…5b05` and `f4542842…fc0`.
- Fixed deterministic hashes: portfolio `f1ed2e32…4825`; site `97c52116…7e91`.
- The isolated source candidate was clean before these gate artifacts were created.

Exact commands, RED/GREEN observations, hashes, full results, official-source links, and command corrections are in the [verification evidence](../implementation-evidence/2026-08-06-deterministic-skeleton-rendering-verification.md).

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Initial JSON content contradicted accepted ADR-0008 and the source roadmap's YAML 1.2 contract | Accepted; all direct catalog/template/parser/reader/ownership/test/plan consumers aligned in `742bb4d`; closure review found no blocker or migration need |
| Architecture and anti-overengineering | Enforcement claimed actual generated Cloudflare isolation without a rendered-source assertion | Accepted; bounded assertion added in `742bb4d`; closure review found no architecture regression |
| Template/input security | Caller could mutate validated package versions during async reads and inject `file:`/URL sources into the manifest | Accepted with causal RED; versions snapshot before validation/await in `1ab75e5`; specialist reproduction and re-review closed the high finding |
| Test evidence | Emitted parser, output/inference composition, no-write breadth, and Cloudflare/presentation purity lacked material protection | Accepted; bounded tests added in `1ab75e5` and `d5f0135`; final re-review closed all four |

No material finding remains. Reviewers were read-only and made no repository or external change.

## Risks and deferred work

- Generated content loading uses fixed file URLs, but a standalone generated install/build has not proved Next/OpenNext file tracing or runtime inclusion.
- The emitted parser test uses in-memory TypeScript transpilation and the builder's exact `yaml` dependency; standalone generated package integration remains Task 7 evidence.
- No-write protection is source-level across the exact generation allowlist plus byte snapshots, not system-call instrumentation.
- Standards and observability `0.1.0` values are synthetic contract inputs until the separately authorized public-package publication prerequisite is satisfied.
- Node `22.23.0` remains the accepted compatibility pin but is behind the official `22.23.2` security release. A separate pin/compatibility increment is required before P1 closure or a current-security/release claim.
- No generated install, lockfile, Next/OpenNext build, workerd execution, deployment, visual, translation, human-usability, accessibility-conformance, production-safety, or general security-audit claim is made.

## Rollback and recovery

Revert `d5f0135`, `1ab75e5`, `742bb4d`, and `bd9e176` in reverse order with focused revert commits; rebuild private builder-core afterward. Revert `ed33e97` separately only if the approved preparation and plan must be withdrawn. Revert the gate-artifact commit separately if this packet/evidence must be withdrawn.

No builder dependency or lockfile rollback is needed. No `.egeria` state, migration record, generated repository, persistent data, deployment, public package, provider resource, or external system exists to recover.

## Approval boundary

Requested decision: approve the verified P1 Task 6 final diff or request a bounded repair.

Approval closes Task 6 only. It does not authorize Task 7, public-package publication, the Node pin increment, push, pull request, merge, workflow dispatch, deployment, provider mutation, permission change, production action, external message, or review-comment response.
