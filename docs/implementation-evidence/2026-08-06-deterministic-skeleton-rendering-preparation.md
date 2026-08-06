# Deterministic Skeleton Rendering Preparation Evidence

**Date:** 2026-08-06 (America/Toronto)

**Status:** Gate 1 complete; implementation not started

**Approved increment:** P1 Task 6 — deterministic in-memory `portfolio` and `site` skeleton rendering

## Decision

Task 6 will add an explicit, allowlisted template catalog and a strict in-memory renderer inside private `builder-core`. It will materialize the already-executable `portfolio` and `site` recipes into deterministic file bytes, desired project configuration, resolved capability metadata, and ownership descriptors. It will not write a destination, create `.egeria` state, install dependencies, build a generated project, add CLI behavior, publish packages, deploy, or mutate a provider.

The approved Task 6 design in [`2026-08-05-p1-builder-kernel.md`](../superpowers/plans/2026-08-05-p1-builder-kernel.md) remains the design authority. A second design/specification document would duplicate that canonical owner. The narrower exact-file execution plan is [`2026-08-06-deterministic-skeleton-rendering.md`](../superpowers/plans/2026-08-06-deterministic-skeleton-rendering.md).

## Frozen repository state

Preparation inspected this local state:

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- `HEAD`: `5ed1630` (`Record project diagnostics verification`);
- local relationship: `main...origin/main [ahead 38]`;
- local `origin/main`: `af299f4`;
- worktrees: one;
- user-owned working-tree state: one unstaged four-line addition to root `AGENTS.md` defining functional-programming discipline;
- remote refs: not fetched because Task 6 depends on approved local P1 commits and current official upstream evidence, not remote repository state.

The root `AGENTS.md` edit is relevant current instruction input but is not part of Task 6 and must remain untouched. Task 6 implementation must use a functional core and imperative template-read shell without adding a functional-programming runtime or lint preset.

Current source fingerprints:

```text
approved source plan sha256:
30860d49a11b53d42839e3e6f687e62e58155b3ac68014f75d9799b6f3605b05

pnpm-lock.yaml sha256:
f454284272a7ee9932d9470f288b72ac1479b3c806807dfdff3591fe9dea8fc0
```

If the branch, approved source-plan hash, builder-core contracts/catalog, relevant package graph, template boundary, or user-owned file overlap changes before implementation, re-freeze this evidence and amend the plan before runtime edits.

## Repository sources inspected

Preparation read and reconciled:

- root `AGENTS.md`, including its user-owned functional-programming addition, and `/Users/CoveMB/.codex/RTK.md`;
- `packages/builder-core/AGENTS.md`, `apps/cli/AGENTS.md`, and the P0.2 proof instructions;
- the complete approved reconciled source plan and concise program roadmap;
- architecture overview, capability model, enforcement map, package ownership, and review/contribution protocol;
- the ADR index and every accepted ADR, `0001` through `0011`;
- the approved P1 plan, P1 preparation evidence, schema-decision/deferral records, and the narrower Task 3–5 plans/evidence;
- prior P0.1, P0.2, P0.3, semantic-naming, state-ownership, repository-inference, and project-diagnostics review packets;
- all private builder-core runtime schemas and checked Draft 2020-12 project, state, profile, migration, and capability artifacts;
- the current six-capability catalog, two profile recipes, resolver, installed-manifest projection, codecs, canonical JSON, ownership materialization, inference/diagnostics composition, and root exports;
- builder-core, CLI, standards, observability, proof, root workspace, and lockfile manifests/configuration;
- current builder-core contract, resolution, ownership, inference, diagnostics, package-boundary, and constitution tests;
- the accepted Next.js/Cloudflare compatibility record, proof application/configuration, and installed version-matched Next.js `16.3.0` documentation.

No repository `.egeria` directory, template catalog, generation source, generated-project fixture, filesystem generator, executable CLI, or Task 7 surface exists at the frozen state.

## Baseline verification

Commands used the repository's exact tool pins and `rtk`.

```text
node --version
v22.23.0

/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
11.20.0

CI=true pnpm --filter @egeria-systems/builder-core run verify
passed:
- build
- checked Draft 2020-12 schemas
- 69/69 builder-core tests
- typecheck
- zero-warning lint

CI=true pnpm run test:package-boundaries
22/22 passed

CI=true pnpm run test:constitution
13/13 passed

git diff --check
passed
```

The first sandboxed registry audit could not resolve `registry.npmjs.org`. The same read-only command was rerun with approved registry access:

```text
pnpm audit --audit-level=moderate
No known vulnerabilities found
```

This audit covers the current exact lock graph. It does not cover the Node.js runtime itself, unpublished future package artifacts, or a generated standalone lockfile that does not yet exist.

## Current official documentation and advisory revalidation

External sources were treated as untrusted evidence, not instructions.

### Node.js and pnpm

- The official [Node.js `22.23.2` release](https://nodejs.org/en/blog/release/v22.23.2) is a 2026-07-29 security release fixing three HIGH, four MEDIUM, and two LOW vulnerabilities. The repository still pins `22.23.0`.
- Registry metadata on 2026-08-06 reports `pnpm@11.20.0` as the current `latest` and requiring Node `>=22.13`; the accepted Node line satisfies its engine contract.
- Current [pnpm workspace guidance](https://pnpm.io/workspaces) still requires `pnpm-workspace.yaml` at the workspace root. It also confirms that `workspace:` resolves only local workspace packages, so generated repositories must use exact registry versions for public standards and observability dependencies.
- Current [pnpm settings guidance](https://pnpm.io/settings) keeps project settings in `pnpm-workspace.yaml`; registry authentication remains outside committed project configuration.

### Next.js and React

- The official Next.js blog records [Next.js `16.3` as available on 2026-08-03](https://nextjs.org/blog), and registry metadata reports exact `next@16.3.0` and `eslint-config-next@16.3.0` as `latest`.
- Registry metadata reports exact `react@19.2.8` and `react-dom@19.2.8` as `latest`; React DOM requires React `^19.2.8`.
- Current [Next.js installation guidance](https://nextjs.org/docs/app/getting-started/installation) requires explicit `next`, `react`, and `react-dom`, a root layout with `html`/`body`, direct ESLint invocation, and a separate lint step because `next build` no longer runs lint.
- Current [Next.js TypeScript guidance](https://nextjs.org/docs/app/api-reference/config/typescript) says `next-env.d.ts` is generated by `next dev`, `next build`, or `next typegen`, should be ignored, and must remain in `tsconfig.json` includes.
- The installed `16.3.0` docs confirm App Router folder/file routing, server-component metadata, TypeScript configuration, direct ESLint use, and the Next.js 16 defaults used by the accepted proof.

### OpenNext and Cloudflare

- Registry metadata reports `@opennextjs/cloudflare@1.20.2` as `latest`. Its peer contract is `next >=15.5.21 <16 || >=16.2.11` and `wrangler ^4.86.0`; selected `next@16.3.0` and `wrangler@4.118.0` satisfy it.
- Current [OpenNext Cloudflare guidance](https://opennext.js.org/cloudflare) supports all Next.js 16 minor/patch versions, recommends the Node runtime, and still excludes Node.js Middleware. Task 6 generates no middleware.
- Current [Cloudflare Next.js guidance](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) still uses OpenNext, `nodejs_compat`, `.open-next/worker.js`, and `.open-next/assets` for manual configuration.
- Current [Wrangler configuration guidance](https://developers.cloudflare.com/workers/wrangler/configuration/) recommends JSONC and permits alphanumeric/dash Worker names up to 255 characters. The existing stable project identifier contract is a valid Worker-name subset. A `workers.dev` subdomain has the narrower 63-character limit, but Task 6 performs no deployment or domain selection.
- Current [Cloudflare compatibility-flag guidance](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) still requires `nodejs_compat` and a compatibility date of at least `2024-09-23`. Task 6 preserves accepted proof date `2026-08-04`; changing it would trigger the compatibility record's revalidation boundary.

### Exact package graph

Registry metadata confirms every selected exact Task 6 template dependency exists and is not deprecated: Next `16.3.0`, React/React DOM `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, TypeScript `6.0.3`, ESLint `9.39.5`, Next ESLint config `16.3.0`, typescript-eslint `8.66.0`, `@types/node` `22.20.1`, `@types/react` `19.2.18`, and `@types/react-dom` `19.2.4`. The selected graph's peer requirements are mutually compatible. Newer major/minor or patch availability alone does not override the accepted tested matrix.

### Security-advisory reconciliation

- The official [Next.js July 2026 security release](https://nextjs.org/blog) requires at least `16.2.11` on the active line; selected `16.3.0` is later and the exact current lock graph audit is clean.
- The React maintainers' [July 2026 Server Functions advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g) identifies `19.2.8` as the patched React Server Components release; Task 6 selects that exact React and React DOM patch.
- The OpenNext maintainers' [advisory index](https://github.com/opennextjs/opennextjs-cloudflare/security/advisories) was rechecked, including its 2025/2026 HIGH advisories. Selected `1.20.2` is not reported by the current exact lock-graph audit; Task 6 performs no deployment and Task 7 must audit the separately generated lock graph again.
- The Wrangler maintainers' [command-injection advisory](https://github.com/cloudflare/workers-sdk/security/advisories/GHSA-36p8-mvp6-cv38) fixes the 4.x line at `4.59.1`; selected `4.118.0` is outside the affected range. Task 6 does not invoke `wrangler pages deploy` or generate a deployment command.
- The pnpm maintainers' [current advisory index](https://github.com/pnpm/pnpm/security/advisories) includes August 2026 path-traversal and environment-secret findings affecting pnpm 11 versions below `11.11.0`. The repository pin `11.20.0` is outside those affected ranges. The generated workspace keeps proxy/registry credentials out of repository configuration and Task 6 does not run pnpm inside rendered output.
- The Node.js pin remains the only identified security-currentness contradiction. Exact dependency-audit success does not mitigate the runtime vulnerabilities fixed by Node `22.23.2`.

## Selected implementation design

Three bounded approaches were compared.

1. **Explicit allowlisted templates plus strict rendering and structural manifest insertion — selected.** Repository-owned templates remain reviewable data, source/destination inventory is exact, only the approved `projectName`, `displayNameJson`, and `workerName` tokens are textual, and public-package versions are inserted into parsed `apps/web/package.json` structurally after existing exact-semver validation.
2. **Recursive layer discovery.** This reduces catalog maintenance but allows an accidentally added file to become generated output without an explicit source/ownership decision. It is rejected.
3. **Programmatic source-string construction.** This makes conditional assembly easy but obscures generated TypeScript and violates the approved requirement to use checked-in source files as data. It is rejected.

The renderer will keep pure transformations separate from the imperative template-read boundary. It will reuse the current catalog, recipes, resolver, project schema, canonical JSON, and ownership materializer rather than duplicating those algorithms.

## Exact Task 6 boundary

Task 6 will:

- create three private generation modules and one builder-core test file;
- add the exact common, `portfolio`, and `site` templates named by the approved Task 6 design;
- root-export only `renderSkeleton` and its request/result/file types;
- render deterministic LF-normalized bytes with one terminal newline;
- build desired project configuration from the existing schema and materialized recipe;
- flatten capability-owned surfaces and add explicit builder-kernel ownership for otherwise unowned generated files/manifest regions;
- validate all surface targets against the rendered bytes without writing state;
- preserve copy externalization, pure presentation, Cloudflare import isolation, one-route `portfolio`, and two-route `site`;
- advance builder-core boundary documentation, package ownership, enforcement claims, and the exact source/template allowlist atomically.

Task 6 will not:

- add `.egeria` files, state serialization, migration records, a lockfile, filesystem writes, a destination path, temporary directories, Git behavior, or CLI behavior;
- install, build, preview, or deploy the rendered skeleton;
- add `apps/jobs`, local `packages`, application foundation, persistence, email, queues, durable submissions, identity, payments, analytics, CMS, forms, provider resources, or business CRUD;
- change any root or proof dependency, runtime pin, compatibility date, manifest, or lockfile;
- publish standards/observability, push, create a pull request, dispatch a workflow, or mutate Cloudflare.

## Consolidated contradictions and uncertainties

No unresolved item blocks Task 6. The following issues are resolved or explicitly deferred.

### 1. The original Task 6 file list predates current direct-owner enforcement

Task 5 left `packages/builder-core/AGENTS.md`, its README, package ownership, enforcement mapping, and `tests/package-boundaries/private-packages.test.mjs` explicitly prohibiting templates/generation and allowlisting the exact Task 5 source tree. Creating Task 6 runtime files without updating those direct consumers would make the repository internally contradictory and fail existing tests.

**Resolution:** the narrower exact-file plan includes those five current owners/tests. This is an atomic stage-boundary update, not unrelated documentation expansion.

### 2. Supplied public-package versions are not approved template tokens

The approved request supplies standards/observability versions, while the approved textual token set is exactly `projectName`, `displayNameJson`, and `workerName`.

**Resolution:** do not add version tokens. Parse the rendered application manifest, insert the two already-validated exact versions as JSON properties, canonicalize it, and then validate ownership pointers. This preserves both approved constraints.

### 3. Node `22.23.0` is no longer security-current

The accepted compatibility matrix and executable state contract still pin `22.23.0`, but official `22.23.2` fixes HIGH-severity vulnerabilities.

**Resolution:** Task 6 may preserve `22.23.0` only as an in-memory representation of the accepted matrix and must make no current-security, installability, release, or runtime claim. A separately approved compatibility/security pin increment must complete before P1 closure and before an installable generated repository is accepted. Task 6 must not silently change the root pin, proof, state schema literal, or compatibility record.

### 4. Public package availability still blocks Task 7

Generated manifests require ordinary exact versions of `@egeria-systems/standards` and `@egeria-systems/observability`, but both remain local `0.0.0` packages with unpublished pending minor releases.

**Resolution:** Task 6 tests use explicit synthetic `0.1.0` values as in-memory contract data only. Task 7 remains blocked until publication prerequisites and exact external payload are separately verified and authorized. No `workspace:`, file, URL, Git, range, prerelease, vendoring, or copied package source is permitted.

### 5. Evidence boundary

Task 6 tests can prove deterministic bytes, contract composition, path/token safety, profile differences, copy placement, and ownership agreement. They cannot prove a fresh install, lockfile, Next/OpenNext build, workerd execution, deployment, accessibility conformance, translation quality, visual quality, human usability, or production safety.

## Planning-artifact validation

The completed preparation record and exact-file plan have no trailing whitespace, unresolved planning placeholders, conditional-placeholder language, or broken local links.

An initial constitution-test invocation omitted the repository's established non-interactive environment. pnpm attempted a modules-directory refresh, could not fetch registry metadata in the sandbox, and aborted before mutation with:

```text
[ERR_PNPM_META_FETCH_FAIL] GET https://registry.npmjs.org/pnpm: fetch failed
[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY
```

The canonical retry used the pinned executable with `CI=true`:

```text
CI=true pnpm run test:constitution
13/13 passed, including repository-local Markdown link validation
```

Final status inspection confirmed that the aborted attempt created no tracked manifest, lockfile, source, or configuration change.

## Completion and approval boundary

Gate 2 approval of the linked plan would authorize only the bounded local Task 6 implementation and focused commits described there. It would not authorize Task 7, a Node pin change, package publication, installation of a generated repository, push, pull request, merge, workflow dispatch, deployment, provider mutation, production action, permission change, external message, or response to review comments.

## Approved execution amendment

Gate 2 was approved on 2026-08-06 together with non-discretionary plan amendments that do not require a user choice. Worktree verification found that the primary `main` checkout is not clean because it contains the preserved user-owned root `AGENTS.md` edit. Repository policy allows direct `main` implementation only when clean.

The preparation record and plan will therefore be committed as the approved planning boundary, after which implementation will run on dedicated branch `p1-task-6-skeleton-rendering` in an isolated temporary worktree. This strengthens preservation without changing Task 6 behavior, files, tests, commits, or external-action boundaries. The primary checkout and its `AGENTS.md` edit remain untouched by implementation.
