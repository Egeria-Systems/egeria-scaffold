# Generated Browser-Testing Foundation Review Packet

**Verification date:** 2026-08-10 (America/Toronto)

**Outcome:** READY FOR VERIFIED-FINAL-DIFF APPROVAL after evidence-backed review repairs

**Implementation comparison:** `e7026bd9e8c7a7ca20b5a485ee6702d2921a7586..9d12d150d17bcf54557248a13d8ec2f42314a4ea`

**Verified implementation tree:** `9d12d150d17bcf54557248a13d8ec2f42314a4ea`

The work proceeded directly on the approved clean sequential local `main` stream. The separate final artifact commit completes the plan checklist and adds this packet and verification evidence only; its exact hash is reported at handoff. Remote refs were not refreshed because remote freshness does not alter this approved local source-bound increment.

## Scope and result

The builder generates a reusable Playwright/axe foundation for `portfolio` and `site`, with explicit Chromium installation and separate Next.js development, OpenNext/workerd preview, and HTTPS deployed configurations. The content-agnostic specification covers structured content/headings, internal navigation, response/page/console errors, bounded axe rules, keyboard and perceptible focus, 320-CSS-pixel reflow, and reduced motion on every discovered content page.

Generated CI is test-only, read-only, immutable-action-pinned, frozen-install, deterministic-one-worker, cancellation-aware, and retains failure artifacts. The deployed contract fails closed and supports an explicit HTTPS base path, but no hosted workflow or live deployment was executed.

The existing `standards` capability is `0.2.0` with hybrid delivery. Both recipes are `0.5.0`. The catalog remains exactly six capabilities. No `proofs` import, testing capability, public testing package, provider resource, credential, deployment behavior, later-stage runtime, or ordinary-generation browser receipt was added.

Automated accessibility results are bounded evidence only. This packet makes no WCAG conformance, assistive-technology, human-usability, deployment, hosted-CI, or production claim.

## Changed files

The implementation comparison changes these 84 files:

```text
CONTRIBUTING.md
README.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/overview.md
docs/architecture/package-ownership.md
docs/implementation-evidence/2026-08-10-generated-browser-testing-foundation-preparation.md
docs/roadmaps/program-roadmap.md
docs/superpowers/plans/2026-08-10-generated-browser-testing-foundation.md
docs/superpowers/specs/2026-08-10-generated-browser-testing-foundation-design.md
fixtures/generated/portfolio/.egeria/project.yaml
fixtures/generated/portfolio/.egeria/state.json
fixtures/generated/portfolio/.github/workflows/quality.yml
fixtures/generated/portfolio/.gitignore
fixtures/generated/portfolio/README.md
fixtures/generated/portfolio/apps/web/AGENTS.md
fixtures/generated/portfolio/apps/web/next.config.ts
fixtures/generated/portfolio/apps/web/package.json
fixtures/generated/portfolio/apps/web/playwright.config.shared.ts
fixtures/generated/portfolio/apps/web/playwright.deployed.config.ts
fixtures/generated/portfolio/apps/web/playwright.dev.config.ts
fixtures/generated/portfolio/apps/web/playwright.preview.config.ts
fixtures/generated/portfolio/apps/web/src/content/content-source.d.ts
fixtures/generated/portfolio/apps/web/src/content/read-content.ts
fixtures/generated/portfolio/apps/web/tests/e2e/site-quality.spec.ts
fixtures/generated/portfolio/apps/web/tsconfig.json
fixtures/generated/portfolio/pnpm-lock.yaml
fixtures/generated/site/.egeria/project.yaml
fixtures/generated/site/.egeria/state.json
fixtures/generated/site/.github/workflows/quality.yml
fixtures/generated/site/.gitignore
fixtures/generated/site/README.md
fixtures/generated/site/apps/web/AGENTS.md
fixtures/generated/site/apps/web/app/about/page.tsx
fixtures/generated/site/apps/web/next.config.ts
fixtures/generated/site/apps/web/package.json
fixtures/generated/site/apps/web/playwright.config.shared.ts
fixtures/generated/site/apps/web/playwright.deployed.config.ts
fixtures/generated/site/apps/web/playwright.dev.config.ts
fixtures/generated/site/apps/web/playwright.preview.config.ts
fixtures/generated/site/apps/web/src/content/content-source.d.ts
fixtures/generated/site/apps/web/src/content/read-content.ts
fixtures/generated/site/apps/web/tests/e2e/site-quality.spec.ts
fixtures/generated/site/apps/web/tsconfig.json
fixtures/generated/site/pnpm-lock.yaml
packages/builder-core/AGENTS.md
packages/builder-core/README.md
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/generation/render-skeleton.ts
packages/builder-core/src/generation/render-template.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/templates/common/.github/workflows/quality.yml.template
packages/builder-core/templates/common/.gitignore.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/next.config.ts
packages/builder-core/templates/common/apps/web/package.json.template
packages/builder-core/templates/common/apps/web/playwright.config.shared.ts
packages/builder-core/templates/common/apps/web/playwright.deployed.config.ts
packages/builder-core/templates/common/apps/web/playwright.dev.config.ts
packages/builder-core/templates/common/apps/web/playwright.preview.config.ts
packages/builder-core/templates/common/apps/web/src/content/content-source.d.ts
packages/builder-core/templates/common/apps/web/src/content/read-content.ts
packages/builder-core/templates/common/apps/web/tests/e2e/site-quality.spec.ts
packages/builder-core/templates/common/apps/web/tsconfig.json
packages/builder-core/templates/site/apps/web/app/about/page.tsx
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/resolution.test.mjs
scripts/verify-generated-skeletons.mjs
tests/constitution/constitution.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
tests/package-boundaries/private-packages.test.mjs
```

The final artifact commit adds:

```text
docs/implementation-evidence/2026-08-10-generated-browser-testing-foundation-verification.md
docs/review-packets/2026-08-10-generated-browser-testing-foundation.md
```

and completes checkboxes in the existing plan. No root manifest/lockfile, public package source/version, release/deployment workflow, provider configuration, compatibility proof, or unrelated worktree changed.

## Focused commits

- `bbc171d` — `Plan generated browser quality`
- `c1b878d` — `Specify generated browser quality`
- `0003fd3` — `Generate browser quality foundation`
- `dbf104d` — `Specify browser fixture certification`
- `6bbfa52` — `Make generated preview runtime-compatible`
- `4769d72` — `Certify generated browser quality`
- `cc19b64` — `Restore builder boundary contracts`
- `a19ecd2` — `Harden generated browser quality checks`
- `98504bf` — `Strengthen browser verification contracts`
- `b6b18d8` — `Keep focus checks semantically named`
- `9d12d15` — `Prove focus shadow geometry`

The separate final artifact commit records completed checklists, final evidence, and this packet only.

## Requirement-to-evidence map

| Requirement | Evidence |
| --- | --- |
| Development and workerd support | Four final Chromium suites pass: both environments for both profiles |
| Explicit HTTPS deployed URL | Missing/invalid/valid configuration-load tests; subpath retained; no live call |
| Reusable generated foundation | Exact shared/environment configs, semantic scripts, one content-agnostic specification, docs, ignores |
| Browser/accessibility behaviors | Headings/content, navigation, response/page/console errors, axe, focus, 320 reflow, reduced motion |
| Minimal CI | Parsed exact read-only job, immutable action SHAs, frozen install, one worker, cancellation, artifacts |
| Existing standards ownership | `standards@0.2.0`, hybrid delivery, exact surfaces/probes/security/recovery; no new capability/package |
| Proof isolation | No production import/dependency from `proofs`; compatibility proof used only as documentary reference |
| State agreement | 71/73 installed surfaces; manifest/state/inference/doctor/diff and regenerated fingerprints agree |
| Deterministic fixtures | Four production CLI generations; 36/38 byte-stable files; identical generated lockfiles |
| Explicit isolated browser state | Exact child allowlist and distinct per-profile home/temp/cache/store/browser/config/server roots |
| Ordinary receipt unchanged | Exact six static/build checks; no browser install or execution in ordinary generation receipt |
| Claim boundary | Explicit non-conformance language; hosted/deployed/production/human evidence deferred |

## Verification summary

Final aggregate at implementation tree `9d12d150d17bcf54557248a13d8ec2f42314a4ea`:

| Gate | Result |
| --- | --- |
| Constitution and semantic naming | PASS; 21/21 |
| Package boundaries | PASS; 40/40 |
| Builder-core | PASS; build and 110/110 |
| CLI | PASS; build and 9/9 |
| Generated fixtures | PASS; 7/7; 36/38 byte-stable files |
| Builder lint, copy externalization, build, typecheck | PASS |
| Portfolio development/browser | PASS; Chromium, six specifications |
| Portfolio OpenNext/workerd/browser | PASS; Chromium, six specifications |
| Site development/browser | PASS; Chromium, six specifications |
| Site OpenNext/workerd/browser | PASS; Chromium, six specifications |
| Generated audit/signatures | PASS for both fixed-root profiles |
| Changesets | PASS; existing standards minor intent retained |

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

The detailed commands, TDD/runtime observations, deterministic hashes, reviewer dispositions, claim limits, and recovery are in the [preparation evidence](../implementation-evidence/2026-08-10-generated-browser-testing-foundation-preparation.md) and [verification evidence](../implementation-evidence/2026-08-10-generated-browser-testing-foundation-verification.md).

## Independent review dispositions

| Review | Disposition |
| --- | --- |
| Architecture and anti-overengineering | Two exact-boundary/ownership regressions reproduced and closed in `cc19b64`; no other material architecture issue |
| Requirements | Four deployed/focus/download/per-route defects reproduced and closed in `a19ecd2` |
| Test evidence | Workflow, deployed-load, and verifier-isolation protection closed in `98504bf` |
| Aggregate and bounded recheck | Semantic parser repair plus causal shadow-only controls closed in `b6b18d8` and `9d12d15` |
| Final bounded recheck | PASS; “No material improvements recommended.” |

No material finding remains open. Reviewers were read-only and performed no repository or external mutation.

## Risks and deferred work

- Automated accessibility checks are bounded evidence, not WCAG conformance or a substitute for assistive-technology/human evaluation.
- The generated workflow was validated structurally but not on a hosted runner.
- The deployed configuration was loaded locally with explicit HTTPS input but no live deployed site was contacted.
- Credentials, cross-browser expansion, visual regression, performance budgets, release workflows, deployment, and production claims remain deferred.
- Browser/package installation and audit/signature results are mutable point-in-time external evidence.
- Client-specific content, localization, visual quality, and launch readiness still require their appropriate later evidence and judgment.
- Existing-repository transformation, migrations, persistent-data/provider recovery, later capabilities, and `apps/jobs` remain out of scope.
- Remote refs were not refreshed; this packet is bound to the approved local base and sequential stream.

## Rollback and recovery

Source recovery is a focused newest-first revert of `9d12d15`, `b6b18d8`, `98504bf`, `a19ecd2`, `cc19b64`, `4769d72`, `6bbfa52`, `dbf104d`, `0003fd3`, `c1b878d`, and `bbc171d`, followed by production regeneration of both fixtures and `pnpm run verify:builder-kernel`. Revert the separate final artifact commit to withdraw the checklist, packet, and verification evidence. Do not reset or rewrite history.

Dependency rollback must remove the exact browser/raw-loader manifest and lockfile entries with their owning source changes. Never leave current templates paired with stale fixture bytes, recipe/capability versions, schemas, fingerprints, state, or lockfiles.

There is no persistent-data, provider, deployment, hosted-workflow, package-publication, remote-Git, permission, production, credential, or external-message action to reverse. Temporary package stores, browsers, caches, servers, generated projects, and build roots are non-authoritative and reproducible.

## Authorization boundary

No push, pull request, merge, publication, deployment, workflow dispatch, provider mutation, persistent-data action, production action, permission change, credential use, external message, or review-comment response occurred.

Requested decision: approve the exact final committed diff reported at handoff, or request one bounded repair.

Approval closes only this generated browser-testing increment. It does not authorize Calendly, any later program outcome, push, pull request, merge, publication, deployment, provider mutation, persistent-data action, production action, permission change, external message, or response to review comments.
