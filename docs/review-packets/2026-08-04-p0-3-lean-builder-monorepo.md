# P0.3 Lean Builder Monorepo Review Packet

**Recorded:** 2026-08-05

**Gate 3 outcome:** APPROVED — the user approved exact committed comparison `40604eb5b8a3ade0175c16dd945a1bafee15ae04..da74a5baab12d19fa5a5007008f960f495721b8e` after all verification and reviewer repairs passed. P1 preparation and exact-file planning are authorized; P1 implementation remains separately plan-gated.

## Goal and frozen comparison

Create the lean builder workspace boundaries without implementing profile or capability behavior: private `apps/cli` and `packages/builder-core` shells; public, replaceable standards and observability packages; Changesets; explicit package ownership; and accidental-publication safeguards. Builder-core is the future owner of project/state schemas, but P1 remains the first executable schema stage and no separate project-schema package exists.

- Base: `40604eb5b8a3ade0175c16dd945a1bafee15ae04`
- Committed implementation candidate: `b6472d2bbe3c7149e14947faa4e13b0a22690ab2`
- Comparison: `40604eb5b8a3ade0175c16dd945a1bafee15ae04..b6472d2bbe3c7149e14947faa4e13b0a22690ab2`
- Approved comparison including Gate 3 artifacts: `40604eb5b8a3ade0175c16dd945a1bafee15ae04..da74a5baab12d19fa5a5007008f960f495721b8e`
- Branch at approval: sequential local `main`, twelve commits ahead of the unrefreshed local `origin/main`
- Gate 3 artifacts were committed in `da74a5b` after the frozen implementation candidate and are included in the approved comparison.
- Lockfile SHA-256: `c33e7c8da6fcf8708ff9f16444157aa85ac0e77f9503bd80ee250f0cc0f96b95`

Remote refs were not refreshed because remote freshness does not affect this local stage gate. No push, pull request, publication, or deployment is authorized.

## Changed files by boundary

### Workspace and contribution controls

- `.gitignore`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `README.md`
- `eslint.config.mjs`
- `package.json`
- `pnpm-lock.yaml`

### Changesets and publication intent

- `.changeset/README.md`
- `.changeset/config.json`
- `.changeset/lean-builder-monorepo.md`

### Private builder application and internals

- `apps/cli/AGENTS.md`
- `apps/cli/README.md`
- `apps/cli/package.json`
- `apps/cli/src/index.ts`
- `apps/cli/tsconfig.json`
- `packages/builder-core/AGENTS.md`
- `packages/builder-core/README.md`
- `packages/builder-core/package.json`
- `packages/builder-core/src/index.ts`
- `packages/builder-core/tsconfig.json`

### Public standards package

- `packages/standards/AGENTS.md`
- `packages/standards/README.md`
- `packages/standards/package.json`
- `packages/standards/typescript/strict.json`
- `packages/standards/eslint/cloudflare-isolation.mjs`
- `packages/standards/eslint/typescript-strict.mjs`
- `packages/standards/tests/cloudflare-isolation.test.mjs`
- `packages/standards/tests/strict-config.test.mjs`
- `packages/standards/tests/typescript-strict.test.mjs`
- `packages/standards/tests/fixtures/typescript-strict/invalid.ts`
- `packages/standards/tests/fixtures/typescript-strict/tsconfig.json`
- `packages/standards/tests/fixtures/typescript-strict/valid.ts`

### Public observability shell

- `packages/observability/AGENTS.md`
- `packages/observability/README.md`
- `packages/observability/package.json`
- `packages/observability/src/index.ts`
- `packages/observability/tests/public-api.test.mjs`
- `packages/observability/tsconfig.json`

### Canonical architecture, roadmap, plan, and preparation evidence

- `docs/architecture/enforcement-map.md`
- `docs/architecture/overview.md`
- `docs/architecture/package-ownership.md`
- `docs/roadmaps/program-roadmap.md`
- `docs/superpowers/plans/2026-08-04-p0-3-lean-builder-monorepo.md`
- `docs/implementation-evidence/2026-08-04-p0-3-lean-builder-monorepo-preparation.md`
- `docs/implementation-evidence/2026-08-04-p0-3-strict-builder-lint-preparation.md`
- `docs/implementation-evidence/2026-08-05-p0-3-eslint-compatibility-boundary.md`

### Proof configuration consumer

- `proofs/nextjs-cloudflare/eslint.config.mjs`
- `proofs/nextjs-cloudflare/package.json`

The proof consumes the extracted Cloudflare-isolation standard but retains exact ESLint `9.39.5`, `eslint-config-next@16.3.0`, its Next configuration, and its package-local lint command. The accepted P0.2 proof has not migrated to ESLint 10. Future generated Next.js projects remain on ESLint 9 while their selected Next plugin graph requires it and must revalidate before changing majors.

### Constitution and package-boundary tests

- `tests/constitution/constitution.test.mjs`
- `tests/package-boundaries/internal-linting.test.mjs`
- `tests/package-boundaries/private-packages.test.mjs`
- `tests/package-boundaries/public-observability.test.mjs`
- `tests/package-boundaries/public-standards.test.mjs`
- `tests/package-boundaries/release-safeguards.test.mjs`

### Gate 3 artifacts

- `docs/implementation-evidence/2026-08-04-p0-3-lean-builder-monorepo-verification.md`
- `docs/review-packets/2026-08-04-p0-3-lean-builder-monorepo.md`

## Commits

- `a6d0f0c` — plan P0.3 lean builder monorepo
- `7437582` — establish private builder package boundaries
- `f520754` — add consumed standards package APIs
- `aec46c3` — add empty observability package shell
- `aa4b421` — configure package release safeguards
- `af9ce57` — add strict builder lint standard
- `097865b` — document lean monorepo ownership
- `c752c15` — complete ESLint compatibility boundary
- `0145dfa` — enforce Cloudflare adapter isolation
- `b6472d2` — strengthen P0.3 boundary tests

## Verification summary

| Evidence | Result |
| --- | --- |
| Frozen install | pass under Node `22.23.0` and pnpm `11.20.0` |
| Peer graph | no issues |
| Registry audit at moderate threshold | no known vulnerabilities on 2026-08-05 |
| Constitution | 13/13 pass |
| Package and publication boundaries | 21/21 pass, including exact six-workspace topology |
| Builder lint | ESLint `10.8.0`, zero warnings for CLI and all `packages/*` source |
| Standards compatibility | 14/14 pass against real ESLint `9.39.5` and `10.8.0` APIs |
| Builder package builds | CLI, builder-core, and observability pass |
| Builder type checks | CLI, builder-core, and observability pass |
| Observability API | empty-root contract 1/1 pass |
| Changesets | only standards and observability have planned minor releases |
| Public-package dry runs | exact allowlists pass; no tarballs published or uploaded |
| Complete P0.2 proof rerun | ESLint 9 lint, typecheck, unit 4/4, Next build, OpenNext build, binding check, workerd 1/1, dev browser/axe 4/4, preview browser/axe 4/4 |
| Range whitespace check | pass |

The full commands, RED/GREEN record, output boundaries, exact versions, package contents, and evidence limits are in the [verification record](../implementation-evidence/2026-08-04-p0-3-lean-builder-monorepo-verification.md).

The complete P0.2 proof rerun required approved local loopback-port access after the sandbox rejected Next's bind with `listen EPERM: operation not permitted 127.0.0.1`. The outside-sandbox rerun passed. It did not deploy. Automated axe evidence does not establish WCAG conformance.

## Review outcomes and dispositions

### Requirements

One medium finding was retained: the shared Cloudflare-isolation config did not reject relative imports of the proof's Cloudflare adapter from protected code. Commit `0145dfa` added the missing restriction and regression coverage under both ESLint majors while preserving the route composition root. No other material requirement defect was reported.

### Architecture and anti-overengineering

The reviewer independently identified the same medium defect. The repair follow-up found no material finding and marked the architecture scope READY. The private/public ownership, dependency direction, stage discipline, and ESLint split remain coherent.

### Independent test evidence

Two medium test-protection findings were retained. First, the workspace tests checked all intended packages but did not reject an arbitrary additional private package. Second, the strict factory was behaviorally tested but its root ESLint 10 integration was not. Commit `b6472d2` adds an exact normalized six-workspace assertion and an actual-root-config test that rejects a floating promise and accepts the awaited control. The follow-up found no material findings and marked the test-evidence scope READY.

### Release and supply chain

No material findings. The specialist marked P0.3 READY for Gate 3 and explicitly not ready for npm publication. Exact manifests, packs, Changeset intent, compatibility ranges, and the absence of premature behavior were accepted. npm-scope authority, licensing, registry acceptance, credentials, and provenance issuance remain separate release prerequisites.

## Package APIs and publication boundary

- Root, CLI, builder-core, and the compatibility proof are private.
- Standards exposes only strict TypeScript JSON, strict typed ESLint, Cloudflare isolation, and its package manifest. It supports and behaviorally tests ESLint 9 and 10; `typescript-eslint@8.66.0` is exact because its strict presets are not semver-stable.
- Observability exposes an empty compiled root plus its package manifest. It contains no event, transport, provider, analytics, or Cloudflare behavior.
- Both public manifests use exact export/file allowlists, `prepublishOnly` verification, npm public-access/provenance defaults, and an initial Changeset. These are local safeguards, not publication authorization.
- No project-schema package, executable schema/state, CLI command, profile, capability, generator, repository mutation, provider integration, database, queue, email, identity, payment, analytics, or invented CRUD was added.

## Risks, limitations, and deferred work

- The npm scope, repository licensing, registry acceptance, credentials, and issued provenance are not established. No package was published, installed from npm, or claimed in the registry.
- The proof remains on ESLint 9 because the selected Next plugin graph contains peers that stop at ESLint 9. That graph must be revalidated before a future major migration.
- The existing P0.2 non-production deployment demonstrates the selected Next/OpenNext/Cloudflare toolchain. This P0.3 candidate reran locally in Node, workerd, and Chromium but was not deployed and does not supersede the accepted P0.2 deployment record.
- Exact pins reduce unexpected drift but require deliberate security and compatibility updates. The dated audit cannot establish future dependency safety.
- Chromium-only automation does not establish cross-browser support, visual quality, translation quality, human usability, or WCAG conformance.
- P1 project/state schemas and builder kernel; later profiles, capabilities, mutations, migrations, recovery, observability behavior, providers, and generated repositories remain deferred.

## Rollback and recovery

- **Source:** revert the relevant focused commits on shared `main`; do not reset the branch.
- **Dependencies/build outputs:** restore the prior lockfile through the same source revert and run the frozen install. Generated build outputs and `node_modules` are reproducible and not authoritative source.
- **Packages:** none were published. If publication later occurs, registry deprecation/version recovery is a separate explicitly approved action; source rollback does not remove a published version.
- **P0.2 proof deployment:** unchanged by P0.3. Any Worker redeploy, version rollback, deletion, custom-domain change, or credential action remains separate and requires explicit approval.
- **Persistent data and providers:** none were created or mutated by P0.3, so no persistent-data rollback exists.

## Approval disposition

The user approved exact committed comparison `40604eb5b8a3ade0175c16dd945a1bafee15ae04..da74a5baab12d19fa5a5007008f960f495721b8e` after confirming that `lint:p0.3` is the intentional stage-scoped builder lint aggregate. P0.3 is complete. P1 preparation and exact-file planning may begin, but P1 implementation, push, pull request, publication, deployment, and provider actions remain separately gated.
