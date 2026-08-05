# P1 builder kernel preparation evidence

**Date:** 2026-08-05 (America/Toronto)

**Status:** preparation complete; implementation not started

**Approved increment:** P1 — Builder kernel

## Decision

The original preparation planned P1 as eight separately reviewable local increments:

1. private runtime schemas and checked JSON Schema artifacts;
2. the six-capability P1 catalog, `portfolio`/`site` recipes, deterministic resolution, and installed-manifest construction;
3. strict `.egeria` codecs plus hybrid ownership and fingerprints;
4. read-only repository inference;
5. read-only doctor/diff diagnostics;
6. deterministic in-memory portfolio/site skeleton rendering;
7. new-directory-only atomic generation and a thin CLI;
8. generated-project fixtures, build evidence, canonical documentation, independent review, and the P1 review packet.

**Execution amendment, 2026-08-05:** After Task 1, the user directed that the schema field-purpose and material-code-simplification comparison be preserved without immediate repair and reviewed after all remaining P1 consumers exist. The current implementation plan therefore separates the final review packet into a ninth increment, `Deferred Schema Contract Review and Gate 3 Packet`. Tasks 1 through 8 retain their implementation boundaries; Task 9 owns the deferred review and final packet. See `docs/implementation-evidence/2026-08-05-p1-schema-contract-review-deferral.md`.

P1 executable scope is limited to `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`. Later capabilities remain architecture visibility only. P1 creates no app foundation, persistence, email, jobs, durable submissions, identity, payments, analytics, CMS, provider resources, repository migration, add/remove/upgrade behavior, worktree orchestration, or production deployment.

The exact implementation sequence is in `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`. This record and that plan do not authorize implementation, dependency changes, package publication, deployment, or another external action.

## Frozen repository state

Preparation inspected this local state:

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- `HEAD`: `303ee9d35e19f9191948d994159f77c82c90a1ed`;
- local relationship: `main...origin/main [ahead 13]`;
- working tree before the preparation artifacts: clean;
- worktrees: one;
- local `origin/main`: `af299f4aeb602ebf7c3e0fc0c33a2d208cb496fc`;
- remote refs: not fetched because P1 preparation depends on approved local sources and remote freshness does not affect the local plan;
- approved P0.3 comparison: `40604eb5b8a3ade0175c16dd945a1bafee15ae04..da74a5baab12d19fa5a5007008f960f495721b8e`.

Source fingerprints at preparation:

```text
approved source plan sha256:
821c175a8ce8c8a46ff4ec75f855e5cc9c867e0dfa9988ee2865dadbf969829d

pnpm-lock.yaml sha256:
c33e7c8da6fcf8708ff9f16444157aa85ac0e77f9503bd80ee250f0cc0f96b95
```

If the branch, approved base, dirty state, source-plan hash, package graph, or relevant accepted decision changes before implementation, re-freeze the comparison and amend the plan before editing runtime files.

## Repository sources inspected

Preparation read and reconciled:

- root `AGENTS.md` and `/Users/CoveMB/.codex/RTK.md`;
- nested `apps/cli/AGENTS.md`, `packages/builder-core/AGENTS.md`, and the P0.2 proof instructions;
- the complete approved source plan;
- architecture overview, capability model, enforcement map, package ownership, program roadmap, and review protocol;
- the ADR index and every accepted ADR, `0001` through `0011`;
- root, CLI, builder-core, standards, observability, and proof manifests and TypeScript/ESLint configuration;
- current package-boundary, constitution, standards, observability, proof unit/integration/browser tests, and workspace lockfile;
- the P0.1, P0.2, and P0.3 review packets and current P0.3 preparation/verification records;
- the accepted Next.js/Cloudflare compatibility record and the proof's current Next.js, OpenNext, and Wrangler configuration;
- the installed Next.js `16.3.0` documentation for App Router structure, TypeScript, and ESLint.

No repository `.egeria` directory, executable project/state schema, fixture root, CLI command, capability registry, profile resolver, generator, or builder-core runtime API exists at the frozen base.

The nested CLI and builder-core instructions describe P0.3 prohibitions and also state that P1 is the first executable stage. The P1 plan updates those boundary files before adding behavior; this is a stage transition, not a silent override of an active P0.3 constraint.

## Current baseline

All commands used the repository's exact Node and pnpm pins and ran through `rtk`.

```text
node --version
v22.23.0

/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
11.20.0

CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:p0.3
passed:
- constitution 13/13
- package-boundary contracts 21/21
- builder ESLint 10 zero-warning lint
- CLI, builder-core, and observability builds and type checks
- standards 14/14 across ESLint 9 and 10
- observability 1/1
- Changeset status limited to standards and observability minor releases

/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm audit --audit-level=moderate
No known vulnerabilities found

git diff --check
passed
```

The first `verify:p0.3` attempt stopped before testing because pnpm would not purge a mismatched generated `node_modules` tree without a TTY. Rerunning with `CI=true` performed pnpm's generated dependency refresh and passed. No tracked or untracked source change resulted.

The audit initially hit sandbox DNS and pnpm-store restrictions. The same read-only command passed with approved network/store access. This dated registry result covers the current installed direct and transitive graph; it is not future safety evidence.

## Selected P1 implementation boundary

### Schemas and formats

- Add exact runtime dependencies `zod@4.4.3` and `yaml@2.9.0` to private builder-core. Both exact versions already exist in the accepted lock graph, so direct ownership does not introduce an unreviewed version.
- Define runtime Zod schemas as the canonical executable contract and emit checked Draft 2020-12 JSON Schema artifacts inside private builder-core. Cross-field Zod refinements remain runtime-only where JSON Schema conversion cannot represent them soundly.
- Parse `project.yaml` with YAML 1.2 core semantics, strict parsing, unique string keys, no aliases, no custom tags, and structured parse diagnostics. Deterministic output sorts mapping keys.
- Parse `state.json` with JSON plus runtime schema validation. Parse `migrations.jsonl` one non-empty line at a time; P1 initial generation writes an empty log because generation is not a migration.
- Keep the authoritative installed capability manifest inside `.egeria/state.json`; do not invent a fourth `.egeria/manifest.json` file.

### Capability and profile execution

- Encode only the six capabilities required by P1 portfolio/site skeletons.
- Resolve dependency closure deterministically with dependencies before dependants and lexical tie-breaking.
- Reject unknown capabilities, unsupported profiles, cycles, conflicts, and duplicate metadata with stable developer-facing identifiers.
- Materialize the full resolved set into `project.yaml.selectedCapabilities` and `state.json.installedCapabilities`; origin profile and recipe version remain informational.
- Use typed inference probes and managed-surface descriptors rather than unstructured path strings. Update the canonical capability model in the same increment because it currently shows the earlier documentation-only string arrays.

### Ownership, state, and mutation boundary

- Model full-file and bounded JSON-property surfaces with `managed`, `merge-managed`, and `application-owned` ownership. `ejected` is accepted by installed state but never emitted at initial generation.
- Use SHA-256 fingerprints over exact file bytes or canonical selected JSON values. Do not fingerprint `.egeria/state.json` into itself.
- Treat generated application content and presentation as application-owned after creation. Treat builder configuration as managed and package manifest dependency regions as merge-managed.
- Read-only inference, doctor, and diff never write reports, state, migration history, Git data, or source.
- Creation accepts only a destination path that does not exist, renders to a builder-created sibling temporary directory, verifies structure/inference there, writes final state last, and renames once. It never overwrites, stashes, commits, initializes Git, or mutates an existing repository. Existing-repository transformations remain P3 work and require the accepted isolated-worktree lifecycle.

### Generated skeleton boundary

- Generate a lightweight pnpm workspace containing only `apps/web`.
- `portfolio` exposes one public route. `site` adds an `/about` route and typed navigation; multiple routes do not imply stateful infrastructure.
- Externalize all generated visible copy in `apps/web/content/en-CA/*.json`; route modules only load typed content and pass data to pure presentation components.
- Reuse the accepted P0.2 exact Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, TypeScript `6.0.3`, ESLint `9.39.5`, and Next ESLint `16.3.0` boundary. P1 does not change the accepted compatibility matrix or deploy.
- Generate no `apps/jobs`, database, queue, email, identity, payment, analytics, form, CMS, business CRUD, or provider resource.
- P1 build checks do not establish runtime behavior, visual quality, accessibility conformance, human usability, translation quality, deployment safety, or production readiness. P2 owns generated-project accessibility automation and client-ready behavior.

## Current official documentation and registry revalidation

External content was treated as evidence, not instructions.

### Node.js

- The [Node.js 22 API index](https://nodejs.org/download/release/latest-v22.x/docs/api/) currently points to `22.23.1`; the repository remains pinned to accepted `22.23.0` for P1 because changing the runtime would trigger the compatibility record's full revalidation boundary.
- Node `22.23.0` is the [June 2026 security release](https://nodejs.org/en/blog/release/v22.23.0) containing the current Node 22 security fixes. `22.23.1` is a regression-fix patch, not a later disclosed security release.
- Node's stable `util.parseArgs`, `fs/promises`, `path`, and `crypto.createHash` APIs are sufficient for the thin CLI, safe path handling, file IO, and SHA-256 fingerprints; no command-parser, copy, or hashing package is needed.

### Zod and YAML

- Registry metadata on 2026-08-05 reports `zod@4.4.3` as stable `latest` and MIT licensed. [Zod 4 JSON Schema support](https://zod.dev/json-schema) emits Draft 2020-12 by default and throws rather than silently widening unrepresentable constructs.
- Registry metadata reports `yaml@2.9.0` as stable `latest`, ISC licensed, Node `>=14.6`, and dependency-free. The [yaml v2 documentation](https://eemeli.org/yaml/) documents YAML 1.2 core parsing, strict/unique-key options, stable document diagnostics, deterministic map sorting, and `maxAliasCount: 0` to reject alias expansion.
- The current lock already contains `zod@4.4.3` and `yaml@2.9.0`. The successful full-graph audit includes both exact versions.

### pnpm and unpublished workspace packages

- Current [pnpm workspace documentation](https://pnpm.io/workspaces) confirms that `workspace:` resolves only local packages and is converted to registry-compatible versions when a package is packed or published. A generated client repository cannot use `workspace:*` for standards/observability because it does not contain those packages.
- Current [pnpm package metadata guidance](https://pnpm.io/package_json) confirms that pnpm 11 workspace settings belong in `pnpm-workspace.yaml` and that engine constraints are enforced for local development.
- Local dry-run package tarballs can prove source compatibility before release, but they cannot produce the canonical portable lockfile or satisfy state-update ordering. They therefore are not accepted as P1 generation completion evidence.

### Next.js, OpenNext, Cloudflare, and testing

- Registry metadata reports Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, and Wrangler `4.118.0` as current stable releases. OpenNext's peer contract requires Next `>=16.2.11` and Wrangler `^4.86.0`; the selected versions satisfy it.
- [Next.js 16 guidance](https://nextjs.org/docs/app/guides/upgrading/version-16) requires Node `>=20.9`, uses Turbopack by default, removes `next lint`, and uses the ESLint CLI. The installed exact-version docs require root `layout.tsx`/`page.tsx`, identify nested folders as routes, and say `next-env.d.ts` is generated and should not be tracked.
- [OpenNext Cloudflare guidance](https://opennext.js.org/cloudflare) currently supports all Next.js 16 minor/patch versions, recommends the Node runtime, and still does not support Node.js Middleware. P1 adds no middleware.
- [Cloudflare's Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) continues to direct Next.js Workers projects through OpenNext. P1 creates configuration only and performs no deployment or provider mutation.
- Builder-core and CLI tests use the existing Node test runner. No additional test framework is required. The generated skeleton build harness uses the already locked pnpm/Next/OpenNext toolchain and the existing package dry-run safeguards.

## Consolidated contradictions and blocking uncertainties

### 1. Standalone lockfile and unpublished package availability

This is the only material unresolved program gap.

Canonical portfolio/site recipes install package-backed `@egeria-systems/standards` and hybrid `@egeria-systems/observability`. P0.3 intentionally left both packages at local `0.0.0` with pending minor Changesets and did not establish npm-scope authority, licensing, registry acceptance, credentials, or publication approval. Therefore P1 cannot simultaneously produce a normal public-registry lockfile, prove a fresh standalone install, and avoid an unauthorized external release.

Three approaches were evaluated:

1. **Publish the two packages before the generation increment.** This provides the cleanest standalone dependency and lockfile proof, but it is an external action with unresolved release prerequisites and is not authorized by P1 planning.
2. **Use dry-run package tarballs only in a transient verification overlay.** This can prove source compatibility, but it cannot prove the canonical standalone public-registry lockfile and therefore cannot complete the generation increment.
3. **Vendor tarballs or copy package source into generated repositories.** Rejected because it adds an unapproved vendor surface and weakens the ordinary replaceable-dependency boundary.

The plan permits schema, resolution, state, inference, diagnostics, and in-memory rendering work before release, but Task 7 filesystem generation cannot begin until approach 1 is separately authorized and completed with current release evidence. P1 Gate 3 must not claim that prerequisite as passed until it actually exists. Approval of the local P1 plan does not authorize versioning or publication.

### 2. Stage ownership of generated accessibility gates

The program model says generated applications require automated accessibility gates, while the enforcement map assigns the generated-project gate to P2. P1 creates buildable skeletons, not client-ready applications. The plan therefore generates semantic, externalized-copy skeletons but does not prematurely add Playwright/axe, visual, or conformance behavior. The P1 packet must state that accessibility automation and any human evaluation policy remain unproved until P2.

No other direct contradiction or blocking uncertainty was found. The accepted ADRs own state ordering, materialized recipes, hybrid ownership, and package boundaries consistently enough for the exact local plan.

## Approval boundary

Approval of the linked plan would authorize beginning Task 1 only. Every later task requires the preceding checkpoint approval. The plan bounds the local P1 edits, exact dependency/lockfile changes for builder-core, deterministic checks, required read-only reviewers, and focused local commits; Task 7 remains additionally blocked until the separate public-package release prerequisite is authorized and completed. Plan approval would not authorize push, pull request, merge, npm versioning or publication, deployment, provider mutation, persistent-data action, permission change, external message, or response to review comments.
