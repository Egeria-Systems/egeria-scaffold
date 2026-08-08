# P1 Task 8 Review Packet — Golden Fixtures, Build Harness, and User-Facing Naming

**Date:** 2026-08-08 (America/Toronto)

**Outcome:** PASS after evidence-backed repairs. Stop before Task 9.

**Implementation comparison:** `bcedd968fcc11c8a836068f939c016c0c030f352..c61b5ab1acd42f2bc77ab3c5354076b6626eae4a`

The reviewed implementation lives in isolated worktree `/private/tmp/egeria-scaffold-p1-task-8` on branch `p1-task-8-golden-fixtures`. The final gate-artifact commit adds this packet and its evidence record without changing implementation behavior. The exact handoff commit is reported when the clean review state is presented.

The primary checkout remains clean on the frozen local base. Remote refs were not refreshed; drift-prone registry, advisory, framework, and platform evidence was refreshed independently.

## Scope and result

Task 8 commits exact production-CLI golden fixtures for the P1 `portfolio` and `site` profiles, validates two new generations per profile byte-for-byte, verifies installed manifests and read-only inference/doctor/diff agreement, and adds a fixed-root isolated build harness.

The verifier rejects non-regular paths, generated artifacts, credentials, unapproved dependency sources, execution-policy drift, extra or changed overrides, tarballs, and invalid public package versions/integrities before pnpm execution. It allows exactly the approved `miniflare>undici: 7.29.0` security override and lifecycle-build allowlist. Fixture checkout bytes are scoped to LF.

The final live harness passed frozen install, peer check, moderate audit, registry-signature audit, lint, typecheck, Next build, and OpenNext build for both fixtures using exact Node `22.23.2` and pnpm `11.20.0`. It modifies only identity-recorded temporary copies and confirmed the committed source bytes remained unchanged.

Canonical documentation and root verification scripts now describe the implemented subset. The permanent semantic-naming scanner is the sole live owner after equivalent duplicate linting was removed. It scans user-facing Markdown by default while preserving the approved internal/provenance content exemptions during implementation. Root README and contribution copy now use stable implementation-status language. Permanent internal-document hardening is scheduled only at the end of the final task in the program's final part. The roadmap leaves P1 in review.

This increment does not implement Task 9, the P1 Gate 3 packet, existing-repository mutation, applied migrations, later profiles or capabilities, providers, publication, deployment, production state, or `apps/jobs`.

## Changed files

Repository attributes, canonical owners, plans, and records:

```text
.gitattributes
AGENTS.md
CONTRIBUTING.md
README.md
docs/architecture/enforcement-map.md
docs/architecture/overview.md
docs/architecture/package-ownership.md
docs/implementation-evidence/2026-08-08-golden-fixture-harness-preparation.md
docs/implementation-evidence/2026-08-08-golden-fixture-harness-verification.md
docs/review-packets/2026-08-08-p1-task-8-golden-fixture-harness.md
docs/roadmaps/program-roadmap.md
docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
docs/superpowers/specs/2026-08-08-user-facing-documentation-naming-design.md
```

Portfolio fixture, 25 regular files:

```text
fixtures/generated/portfolio/.egeria/migrations.jsonl
fixtures/generated/portfolio/.egeria/project.yaml
fixtures/generated/portfolio/.egeria/state.json
fixtures/generated/portfolio/.gitignore
fixtures/generated/portfolio/.nvmrc
fixtures/generated/portfolio/AGENTS.md
fixtures/generated/portfolio/README.md
fixtures/generated/portfolio/apps/web/AGENTS.md
fixtures/generated/portfolio/apps/web/app/globals.css
fixtures/generated/portfolio/apps/web/app/layout.tsx
fixtures/generated/portfolio/apps/web/app/page.tsx
fixtures/generated/portfolio/apps/web/content/en-CA/site.yaml
fixtures/generated/portfolio/apps/web/eslint.config.mjs
fixtures/generated/portfolio/apps/web/next.config.ts
fixtures/generated/portfolio/apps/web/open-next.config.ts
fixtures/generated/portfolio/apps/web/package.json
fixtures/generated/portfolio/apps/web/src/content/content-schema.ts
fixtures/generated/portfolio/apps/web/src/content/read-content.ts
fixtures/generated/portfolio/apps/web/src/infrastructure/observability/installed-capability.ts
fixtures/generated/portfolio/apps/web/src/presentation/content-page.tsx
fixtures/generated/portfolio/apps/web/tsconfig.json
fixtures/generated/portfolio/apps/web/wrangler.jsonc
fixtures/generated/portfolio/package.json
fixtures/generated/portfolio/pnpm-lock.yaml
fixtures/generated/portfolio/pnpm-workspace.yaml
```

Site fixture, 27 regular files:

```text
fixtures/generated/site/.egeria/migrations.jsonl
fixtures/generated/site/.egeria/project.yaml
fixtures/generated/site/.egeria/state.json
fixtures/generated/site/.gitignore
fixtures/generated/site/.nvmrc
fixtures/generated/site/AGENTS.md
fixtures/generated/site/README.md
fixtures/generated/site/apps/web/AGENTS.md
fixtures/generated/site/apps/web/app/about/page.tsx
fixtures/generated/site/apps/web/app/globals.css
fixtures/generated/site/apps/web/app/layout.tsx
fixtures/generated/site/apps/web/app/page.tsx
fixtures/generated/site/apps/web/content/en-CA/about.yaml
fixtures/generated/site/apps/web/content/en-CA/site.yaml
fixtures/generated/site/apps/web/eslint.config.mjs
fixtures/generated/site/apps/web/next.config.ts
fixtures/generated/site/apps/web/open-next.config.ts
fixtures/generated/site/apps/web/package.json
fixtures/generated/site/apps/web/src/content/content-schema.ts
fixtures/generated/site/apps/web/src/content/read-content.ts
fixtures/generated/site/apps/web/src/infrastructure/observability/installed-capability.ts
fixtures/generated/site/apps/web/src/presentation/content-page.tsx
fixtures/generated/site/apps/web/tsconfig.json
fixtures/generated/site/apps/web/wrangler.jsonc
fixtures/generated/site/package.json
fixtures/generated/site/pnpm-lock.yaml
fixtures/generated/site/pnpm-workspace.yaml
```

Executable enforcement and direct tests:

```text
eslint.config.mjs
package.json
scripts/check-semantic-naming.mjs
scripts/eslint/no-sequencing-labels.mjs (deleted)
scripts/verify-generated-skeletons.mjs
tests/constitution/constitution.test.mjs
tests/constitution/semantic-naming.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
tests/package-boundaries/internal-linting.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

## Focused commits

- `b044709` — Task 8 preparation evidence and exact-file plan.
- `8238e0e` — exact production-CLI portfolio and site fixtures.
- `79735f2` — deterministic fixture tests and fixed-root isolated verifier.
- `db8ff9d` — aggregate scripts, permanent semantic enforcement, and canonical documentation.
- `4ec29b8` — reviewer-proven LF and exact dependency/execution policy repairs.
- `08bca41` — reviewer-proven snapshot lockfile source-locator repair.
- `f81cd7a` — original settled verification evidence and Task 8 packet.
- `3391e6e` — approved staged user-facing naming design.
- `2ceefe9` — end-of-program timing clarification.
- `57cd737` — exact-file repair plan and preparation evidence.
- `19ca160` — user-facing Markdown classifier, tests, cleanup, and canonical-owner updates.
- `c61b5ab` — stable direct documentation-status contracts.

The separate gate-artifact commit records final verification and this packet only.

## Requirement-to-evidence map

| Requirement | Evidence |
| --- | --- |
| Exact production fixtures | Committed 25/27-file trees from the production CLI, exact inventory contracts, and two fresh byte comparisons per profile |
| Manifest/state/inference agreement | Exact 5/6 installed capabilities, 43/45 managed surfaces, valid state, confirmed inference, healthy doctor, equal diff, and read-only snapshots |
| Portable deterministic bytes | Scoped LF Git attribute, `check-attr` regression, path/byte equality, lock SHA-256, and deterministic diagnostic tree hashes |
| Public dependency boundary | Exact manifests, workspace policy, sole approved override, lifecycle allowlist, lockfile source-policy checks, exact Egeria versions/integrities, and mutation tests |
| Isolated live builds | Identity-bounded temporary copies, private home/config/store, minimal environment, no-shell bounded commands, source-byte recheck, and cleanup tests |
| Supply-chain checks | Frozen install, peer check, moderate audit, registry-signature audit, exact versions/integrities, and explicit no-provenance claim |
| Canonical enforcement | Root aggregate script, architecture/enforcement/package owners, roadmap status, permanent semantic scanner, and constitution/package-boundary tests |
| User-facing semantic naming | Default `.md` scanning, exact staged exemptions, root/nested/future-document and case-insensitive tests, live repository scan, stable README/contribution copy, direct constitution consumers, and final-program hardening deferral |
| No later-stage behavior | Exact profiles/paths/commands, fixture inventories, deferred-work documentation, no Task 9 packet, and no external action |

## Verification summary

- Exact toolchain: Node `v22.23.2`, pnpm `11.20.0`.
- Constitution and repository-local links: 21/21.
- Package boundaries: 39/39.
- Builder-core: build plus 103/103 tests.
- CLI: build plus 9/9 tests.
- Generated fixtures: 7/7; two fresh generations per profile; 25/27 byte-stable files.
- Builder lint, build, and typecheck: PASS.
- Fixed-root live harness: PASS for both profiles and all nine checks.
- Root moderate audit: no known vulnerabilities.
- Root peer check: no peer dependency issues.
- Changesets status: no package bump.
- Semantic naming and comparison diff check: PASS.
- User-facing naming repair: semantic suite 7/7; settled builder-package quality gate passed constitution 21/21, package boundaries 39/39, standards 14/14, observability 1/1, zero-warning lint, builds, and typechecks.
- Compatibility proof on unchanged relevant inputs: lint/typecheck, unit 4/4, Next/OpenNext builds, Cloudflare type generation, local workerd integration 1/1, development Playwright 4/4, preview Playwright 4/4.

The generated-project harness and compatibility proof were not repeated after the user-facing naming repair because no generator, package, dependency, template, fixture, lockfile, or proof input changed.

Both fixtures use lockfile SHA-256 `f8299e645d89fc42865b7b70fdec368c7ce0dc67d4a32ad40100645dd7fe47a2`.

Exact commands, RED/GREEN observations, diagnostic tree-fingerprint algorithm and outputs, current-source evidence, reviewer closures, environment corrections, and claim limits are in the [verification evidence](../implementation-evidence/2026-08-08-golden-fixture-harness-verification.md).

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Intentional security override was neither exactly allowlisted nor mutation-tested | Accepted; exact workspace/lock policy and tests in `4ec29b8`; closure: CLOSED |
| Architecture and anti-overengineering | Golden bytes could vary under Git EOL conversion | Accepted; LF attribute and contract test in `4ec29b8`; closure: CLOSED |
| Architecture and anti-overengineering | Pre-install policy did not validate exact manifests/workspace and missed some lockfile source locators | Accepted; exact policy in `4ec29b8`, mapping-value bypass in `08bca41`; closure: CLOSED |
| Test evidence | Override-policy tests were incomplete | Accepted as the same requirements defect; regression coverage in `4ec29b8`; closure: CLOSED |
| Requirements repair review | No material finding in approved enforcement boundary, public cleanup, canonical owners, timing, or non-goals | CLOSED at `c61b5ab` |
| Architecture and anti-overengineering repair review | No material finding; staged classifier is cohesive and introduces no duplicate machinery or later-stage runtime | CLOSED at `c61b5ab` |
| Test-evidence repair review | No material finding; RED/GREEN causality, final coverage, proportional commands, and claim limits are credible | CLOSED at `c61b5ab` |

All relevant reviewers completed read-only. Every material finding was verified against the current tree, repaired, and rechecked by its finding owner. No material finding remains.

## Risks and deferred work

- Determinism is proved for the exact current CLI, fixtures, and toolchain; it is not cross-platform implementation corroboration.
- Audits, peers, signatures, integrity, registry metadata, installs, and builds are point-in-time evidence. Registry signatures do not establish source provenance, and the two bootstrap Egeria packages have no attestations.
- Generated Next/OpenNext builds passed. The generated fixtures were not previewed under workerd or deployed.
- Semantic scanning proves only the canonical label grammar across classified paths. It does not prove documentation quality, completeness, conceptual-synonym coverage, or cleanliness of intentionally exempt internal/provenance documents.
- No production, visual, translation, human-usability, WCAG-conformance, penetration, or general-security claim is made.
- Task 9, final P1 Gate 3 review, existing-repository mutation, migration execution, later profiles/capabilities, persistence, email, jobs, identity, payments, analytics, CMS, forms, and `apps/jobs` remain deferred.
- Remote refs were not refreshed; the comparison uses the explicitly frozen local base.

## Rollback and recovery

For full Task 8 recovery, revert `c61b5ab`, `19ca160`, `57cd737`, `2ceefe9`, `3391e6e`, `f81cd7a`, `08bca41`, `4ec29b8`, `db8ff9d`, `79735f2`, `8238e0e`, and `b044709` newest-first with focused revert commits, then rerun `verify:builder-kernel`. Revert the final gate-artifact commit separately if this packet/evidence must be withdrawn. To withdraw only the user-facing naming repair, revert `c61b5ab`, `19ca160`, `57cd737`, `2ceefe9`, and `3391e6e` newest-first, then rerun semantic naming and the builder-package quality gate.

Task 8 changed no persistent data, deployment, package publication, provider resource, Git remote, or production system. Temporary generation/build outputs are isolated or ignored and cleanup is identity-bounded; no external recovery is required.

## Approval boundary

Requested decision: approve the exact P1 Task 8 final diff reported at handoff, or request a bounded repair.

Approval closes Task 8 only. It does not authorize Task 9, push, pull request, merge, workflow dispatch, deployment, publication, provider mutation, permission change, production action, external message, or review-comment response.
