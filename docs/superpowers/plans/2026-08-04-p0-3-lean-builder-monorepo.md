# P0.3 lean builder monorepo implementation plan

Date: 2026-08-04 (America/Toronto)

Status: awaiting implementation approval

Approved source increment: P0.3 — Lean builder monorepo

Frozen implementation base: `40604eb5b8a3ade0175c16dd945a1bafee15ae04`

Preparation evidence: `docs/implementation-evidence/2026-08-04-p0-3-lean-builder-monorepo-preparation.md`

## Goal

Create the smallest builder monorepo package topology that makes API ownership and release intent explicit without implementing profile functionality or P1 schemas:

- a private thin CLI shell;
- a private builder-core shell that owns future project/state schemas and builder internals;
- a public standards package with two immediately consumed configuration APIs;
- a public observability package with an intentionally empty runtime API;
- stable Changesets configuration and accidental-publication safeguards;
- tests and canonical documentation that enforce the boundary.

Implementation is complete only when the exact diff has passed deterministic verification, independent review, and the final P0.3 review packet is ready for the user's separate verified-final-diff approval.

## Non-goals

This plan does not create:

- a project-schema package or executable `.egeria` schemas;
- CLI commands, argument parsing, generated-repository mutation, migrations, or state writes;
- profiles, capability descriptors, templates, generators, copy catalogs, or application behavior;
- a database, queue, email, identity, payments, durable submissions, jobs app, provider adapter, or invented CRUD;
- observability events, redaction, transport, provider, analytics, or Cloudflare bindings;
- formatter, test-runner, or copy-policy presets without a concrete consumer;
- an npm release, deployment, push, pull request, merge, or other external mutation.

## Execution controls

1. Work locally on `main`, as authorized, only while the tree is clean and the frozen base remains reachable without overlap.
2. Run every shell command through `rtk` and invoke pnpm as `/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm`.
3. Use test-driven development within every implementation increment: add the focused failing test, record the expected RED result, implement the minimum files, and rerun to GREEN.
4. Commit each coherent increment with the exact commit intent listed below. Do not stage unrelated files.
5. Stop for explicit user review after every increment. Approval of one increment does not approve the next increment or the final diff.
6. If the branch, base, current files, dependency graph, or official package evidence materially differs from preparation, stop and amend the evidence/plan before implementation.
7. Never run `changeset publish`, `pnpm publish`, `npm publish`, or any equivalent external release command under this plan.

After explicit plan approval, first verify that the only preparation changes are this plan and its linked evidence record, then commit those two already-approved documents as `Plan P0.3 lean builder monorepo`. If their diff has changed since approval or any other path is dirty, stop instead. This preparation commit does not contain implementation; the frozen final comparison remains the pre-P0.3 base above.

## Intended package ownership and APIs

### `@egeria-systems/cli` — private

- Owner: user-facing command dispatch in later builder stages.
- P0.3 API: none.
- P0.3 source: one empty ESM module so the TypeScript boundary is compiled and verified.
- Safeguard: `private: true`; no `bin` field; no command framework dependency.

### `@egeria-systems/builder-core` — private

- Owner: future builder orchestration, project/state schemas, inference, planning, transformation, verification, migration, and recovery internals.
- P0.3 API: none.
- P0.3 source: one empty ESM module.
- Safeguard: `private: true`; no schemas, profile data, capability data, generators, filesystem mutation, or provider dependency.

### `@egeria-systems/standards` — public ordinary dependency

- Owner: replaceable shared static standards that have concrete consumers.
- P0.3 API 1: `@egeria-systems/standards/typescript/strict.json`.
- P0.3 API 2: `@egeria-systems/standards/eslint/cloudflare-isolation`.
- Consumers: the new TypeScript packages consume the strict configuration; the P0.2 proof consumes the Cloudflare-isolation flat config.
- Safeguards: no root export; exact `exports`; exact `files`; public `publishConfig`; package tests; `prepublishOnly` verification.

### `@egeria-systems/observability` — public ordinary dependency

- Owner: future provider-neutral observability API, redaction policy, and adapters.
- P0.3 API: an importable module with no named runtime exports.
- Safeguards: exact root/package exports; exact `files`; public `publishConfig`; a test proving the empty API; `prepublishOnly` verification.

## Increment 1 — Declare ownership and private package shells

### Files

Create:

- `docs/architecture/package-ownership.md`
- `apps/cli/AGENTS.md`
- `apps/cli/README.md`
- `apps/cli/package.json`
- `apps/cli/src/index.ts`
- `packages/builder-core/AGENTS.md`
- `packages/builder-core/README.md`
- `packages/builder-core/package.json`
- `packages/builder-core/src/index.ts`
- `tests/package-boundaries/private-packages.test.mjs`

Modify:

- `pnpm-workspace.yaml`
- `.gitignore`
- `pnpm-lock.yaml`

### RED

Write `tests/package-boundaries/private-packages.test.mjs` first. It must fail because the package topology is absent. The test must assert:

- the workspace includes `apps/*` and `packages/*` in addition to the proof;
- root, proof, CLI, and builder-core packages are private;
- the CLI has no `bin` field and no dependencies;
- builder-core has no dependencies;
- the exact permitted P0.3 source set for each private package is only `src/index.ts`;
- no package named or located as `project-schema` exists;
- no `.egeria` schema, profile, capability, template, generator, migration, or state implementation is introduced by the private shells;
- both nested instruction files and the canonical package-ownership document exist.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test tests/package-boundaries/private-packages.test.mjs
```

Expected RED: missing package/workspace/ownership files, not a syntax or harness failure.

### GREEN

Implement the minimum private shells:

- the CLI manifest contains only `name: "@egeria-systems/cli"`, version `0.0.0`, `private: true`, and `type: "module"`;
- the core manifest contains only `name: "@egeria-systems/builder-core"`, version `0.0.0`, `private: true`, and `type: "module"`;
- neither private manifest has dependencies, exports, a command entry point, or lifecycle scripts yet;
- both `src/index.ts` files contain only `export {};`;
- nested `AGENTS.md` files prohibit premature commands/schemas/profile behavior and point to `docs/architecture/package-ownership.md` as canonical owner;
- `.gitignore` adds `dist/`;
- `docs/architecture/package-ownership.md` records private/public status, current API, future owner, consumer, publication guard, and stage boundary for all four new packages.

Run the focused test until GREEN, then run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --lockfile-only
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test tests/package-boundaries/private-packages.test.mjs
rtk git diff --check
```

Commit intent: `Establish private builder package boundaries`

Stop for explicit user approval.

## Increment 2 — Add the consumed standards APIs

### Files

Create:

- `packages/standards/AGENTS.md`
- `packages/standards/README.md`
- `packages/standards/package.json`
- `packages/standards/typescript/strict.json`
- `packages/standards/eslint/cloudflare-isolation.mjs`
- `packages/standards/tests/strict-config.test.mjs`
- `packages/standards/tests/cloudflare-isolation.test.mjs`
- `tests/package-boundaries/public-standards.test.mjs`
- `apps/cli/tsconfig.json`
- `packages/builder-core/tsconfig.json`

Modify:

- `apps/cli/package.json`
- `apps/cli/tsconfig.json`
- `packages/builder-core/package.json`
- `packages/builder-core/tsconfig.json`
- `proofs/nextjs-cloudflare/package.json`
- `proofs/nextjs-cloudflare/eslint.config.mjs`
- `docs/architecture/package-ownership.md`
- `pnpm-lock.yaml`

### RED

Write the three tests before the standards files.

`strict-config.test.mjs` must load the JSON and assert the exact approved compiler contract:

```json
{
  "compilerOptions": {
    "allowJs": false,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleDetection": "force",
    "moduleResolution": "NodeNext",
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "strict": true,
    "target": "ES2022",
    "verbatimModuleSyntax": true
  }
}
```

`cloudflare-isolation.test.mjs` must use ESLint `Linter` and prove both sides of the boundary:

- a source file under the protected domain/application/presentation paths gets an error for `cloudflare:workers` and relative imports of the proof's Cloudflare platform adapter;
- ordinary provider-neutral imports pass;
- the config object exposes only the existing proof file globs, ignores, and `no-restricted-imports` rule.

`public-standards.test.mjs` must assert:

- `private` is absent or false;
- the only package exports are `./typescript/strict.json`, `./eslint/cloudflare-isolation`, and `./package.json`;
- `files` includes only `typescript`, `eslint`, and `README.md`;
- `publishConfig` fixes npm registry, public access, and provenance;
- the package has no runtime dependency;
- its version is `0.0.0` before the initial Changeset;
- its test and `prepublishOnly` scripts are present.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test packages/standards/tests/*.test.mjs tests/package-boundaries/public-standards.test.mjs
```

Expected RED: missing standards package/config, not a test harness failure.

### GREEN

Implement only the two specified standards APIs:

- export the exact strict JSON contract;
- extract the current proof's Cloudflare import restriction into a named ESLint flat-config object;
- replace the duplicated proof rule with an import from the standards package without changing the protected file set, ignores, paths, patterns, messages, or enforcement semantics;
- create CLI and builder-core TypeScript configs with `extends: "@egeria-systems/standards/typescript/strict.json"` and only package-local emit/root/output settings;
- add build and typecheck scripts to both private package manifests now that their shared compiler contract exists;
- add `workspace:*` development dependencies from all three consumers to standards;
- pin ESLint peer compatibility to `>=9.39.5 <10` and development verification to exact `9.39.5`.

The standards manifest contract is:

```json
{
  "name": "@egeria-systems/standards",
  "version": "0.0.0",
  "type": "module",
  "files": ["eslint", "typescript", "README.md"],
  "exports": {
    "./eslint/cloudflare-isolation": "./eslint/cloudflare-isolation.mjs",
    "./typescript/strict.json": "./typescript/strict.json",
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "verify": "pnpm run test",
    "prepublishOnly": "pnpm run verify"
  },
  "peerDependencies": {
    "eslint": ">=9.39.5 <10"
  },
  "devDependencies": {
    "eslint": "9.39.5"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true,
    "registry": "https://registry.npmjs.org/"
  }
}
```

CLI and builder-core each gain these fields, with no other dependency:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@egeria-systems/standards": "workspace:*",
    "typescript": "6.0.3"
  }
}
```

Each private package uses this `tsconfig.json`:

```json
{
  "extends": "@egeria-systems/standards/typescript/strict.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --lockfile-only
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test packages/standards/tests/*.test.mjs tests/package-boundaries/public-standards.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/cli run typecheck
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/nextjs-cloudflare-proof run lint
rtk git diff --check
```

Commit intent: `Add consumed standards package APIs`

Stop for explicit user approval.

## Increment 3 — Add the empty observability API shell

### Files

Create:

- `packages/observability/AGENTS.md`
- `packages/observability/README.md`
- `packages/observability/package.json`
- `packages/observability/tsconfig.json`
- `packages/observability/src/index.ts`
- `packages/observability/tests/public-api.test.mjs`
- `tests/package-boundaries/public-observability.test.mjs`

Modify:

- `docs/architecture/package-ownership.md`
- `pnpm-lock.yaml`

### RED

Write both tests first.

`public-api.test.mjs` must import the built package entry and assert that the module namespace has no keys. `public-observability.test.mjs` must assert:

- the public package has only `.` and `./package.json` exports;
- the root export supplies ESM import and declaration paths under `dist/`;
- `files` includes only `dist` and `README.md`;
- `publishConfig` fixes npm registry, public access, and provenance;
- there are no runtime dependencies, provider names, event types, redaction implementation, transports, analytics, or Cloudflare bindings;
- the only source file is `src/index.ts`, and it contains only `export {};`;
- build, typecheck, test, verify, and `prepublishOnly` scripts are present.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test tests/package-boundaries/public-observability.test.mjs
```

Expected RED: missing observability package, not a syntax or harness failure.

### GREEN

Implement the package shell with the shared strict TypeScript config and package-local declaration/output settings. Build before the API test, then run:

```json
{
  "name": "@egeria-systems/observability",
  "version": "0.0.0",
  "type": "module",
  "files": ["dist", "README.md"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test tests/*.test.mjs",
    "verify": "pnpm run build && pnpm run test && pnpm run typecheck",
    "prepublishOnly": "pnpm run verify"
  },
  "devDependencies": {
    "@egeria-systems/standards": "workspace:*",
    "typescript": "6.0.3"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true,
    "registry": "https://registry.npmjs.org/"
  }
}
```

`packages/observability/tsconfig.json` uses the same exact compiler shape as the private packages: extend the standards strict config; set `declaration: true`, `outDir: "dist"`, and `rootDir: "src"` under `compilerOptions`; include only `src/**/*.ts`.

Then run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --lockfile-only
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/observability run build
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test packages/observability/tests/public-api.test.mjs tests/package-boundaries/public-observability.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/observability run typecheck
rtk git diff --check
```

Commit intent: `Add empty observability package shell`

Stop for explicit user approval.

## Increment 4 — Add Changesets and publication safeguards

### Files

Create:

- `.changeset/README.md`
- `.changeset/config.json`
- `.changeset/lean-builder-monorepo.md`
- `tests/package-boundaries/release-safeguards.test.mjs`

Modify:

- `package.json`
- `pnpm-lock.yaml`
- `docs/architecture/package-ownership.md`

### RED

Write `release-safeguards.test.mjs` before release configuration. It must assert:

- root, proof, CLI, and builder-core packages are all private;
- only standards and observability are locally publishable;
- both public packages have exact `exports`, `files`, `publishConfig`, and `prepublishOnly` controls;
- the Changesets dependency is exactly `2.31.1`;
- `.changeset/config.json` has `commit: false`, `access: "restricted"` as the safe default, `baseBranch: "main"`, empty fixed/linked/ignore sets, patch-level internal dependency updates, workspace-protocol-only bumps, and private-package version/tag disabled;
- the initial Changeset contains a minor release only for standards and observability;
- no release script can publish the private packages;
- no public package tarball can include source tests, repository docs, `.egeria`, proof artifacts, credentials, or builder internals.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test tests/package-boundaries/release-safeguards.test.mjs
```

Expected RED: missing Changesets configuration and root scripts.

### GREEN

Add exact `@changesets/cli@2.31.1` and these root scripts:

```json
{
  "scripts": {
    "build:p0.3": "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/observability run build",
    "changeset": "changeset",
    "changeset:status": "changeset status",
    "release-packages": "changeset publish",
    "test:package-boundaries": "node --test tests/package-boundaries/*.test.mjs",
    "test:packages": "pnpm --filter @egeria-systems/standards --filter @egeria-systems/observability run test",
    "typecheck:p0.3": "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/observability run typecheck",
    "verify:p0.3": "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run build:p0.3 && pnpm run test:packages && pnpm run typecheck:p0.3 && pnpm run changeset:status",
    "version-packages": "changeset version"
  }
}
```

Preserve the existing root scripts and extend the root `test` script to include the package-boundary and package tests while retaining the constitution and P0.2 proof unit tests.

Use the stable-v2 configuration validated in preparation:

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "bumpVersionsWithWorkspaceProtocolOnly": true,
  "privatePackages": {
    "version": false,
    "tag": false
  }
}
```

The presence of `release-packages` documents the release mechanism; the repository's explicit external-action gate remains authoritative. Do not execute it.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test tests/package-boundaries/release-safeguards.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run changeset:status
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/standards pack --dry-run --json
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/observability run build
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/observability pack --dry-run --json
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm audit --audit-level=moderate
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm peers check
rtk git diff --check
```

Expected pack contents:

```text
@egeria-systems/standards:
package.json
README.md
eslint/cloudflare-isolation.mjs
typescript/strict.json

@egeria-systems/observability:
package.json
README.md
dist/index.js
dist/index.d.ts
```

Any additional file is a failed safeguard and must be explained or removed before commit.

Commit intent: `Configure package release safeguards`

Stop for explicit user approval.

## Increment 5 — Add the dual-major strict TypeScript lint standard

The user approved this forward-only amendment after Increment 4 and authorized continuing directly into the following documentation increment without a separate review stop.

### Files

Create:

- `docs/implementation-evidence/2026-08-04-p0-3-strict-builder-lint-preparation.md`
- `eslint.config.mjs`
- `packages/standards/eslint/typescript-strict.mjs`
- `packages/standards/tests/typescript-strict.test.mjs`
- `packages/standards/tests/fixtures/typescript-strict/invalid.ts`
- `packages/standards/tests/fixtures/typescript-strict/tsconfig.json`
- `packages/standards/tests/fixtures/typescript-strict/valid.ts`
- `tests/package-boundaries/internal-linting.test.mjs`

Modify:

- `.changeset/lean-builder-monorepo.md`
- `apps/cli/package.json`
- `docs/architecture/package-ownership.md`
- `docs/superpowers/plans/2026-08-04-p0-3-lean-builder-monorepo.md`
- `package.json`
- `packages/builder-core/package.json`
- `packages/observability/package.json`
- `packages/standards/AGENTS.md`
- `packages/standards/README.md`
- `packages/standards/package.json`
- `packages/standards/tests/cloudflare-isolation.test.mjs`
- `pnpm-lock.yaml`
- `tests/constitution/constitution.test.mjs`
- `tests/package-boundaries/private-packages.test.mjs`
- `tests/package-boundaries/public-observability.test.mjs`
- `tests/package-boundaries/public-standards.test.mjs`
- `tests/package-boundaries/release-safeguards.test.mjs`

### RED

Write the standards and internal-linting tests and update every exact manifest/API consumer before implementation. The tests must prove:

- the public factory rejects a relative `tsconfigRootDir`, preserves an absolute supplied root, defaults to TypeScript source files, composes only `strictTypeChecked` and `stylisticTypeChecked`, and enables `projectService: true`;
- real ESLint `9.39.5` and `10.8.0` executions both accept representative valid TypeScript and report a typed floating-promise defect;
- the valid fixture is intentionally not Prettier-formatted yet receives no ESLint formatting diagnostic, and a rule exclusive to the `all` preset is not enabled;
- both majors continue to enforce the Cloudflare-isolation config;
- the builder root and the three immediate package consumers use ESLint `10.8.0`, zero warnings, and the shared public factory;
- the proof manifest's ESLint 9, Next config, typescript-eslint, and lint command remain exact and unchanged;
- the standards export, peer range, package allowlist, Changeset summary, and dry-run tarball contract include the new public API.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test packages/standards/tests/cloudflare-isolation.test.mjs packages/standards/tests/typescript-strict.test.mjs tests/package-boundaries/internal-linting.test.mjs tests/package-boundaries/private-packages.test.mjs tests/package-boundaries/public-observability.test.mjs tests/package-boundaries/public-standards.test.mjs tests/package-boundaries/release-safeguards.test.mjs
```

Expected RED: missing strict-config API, root config/scripts, exact pins, and consumer manifest updates, not syntax or harness failures.

### GREEN

Add `createTypeScriptStrictConfig({ tsconfigRootDir, files? })`. It requires an absolute root, defaults to TypeScript source extensions, composes exact `typescript-eslint@8.66.0` `strictTypeChecked` and `stylisticTypeChecked`, sets `projectService: true`, returns ordinary flat configs, and adds no formatter, framework, provider, or `all` preset.

The root config supplies matching `@eslint/js@10.0.1`, scopes ESLint `10.8.0` to CLI, builder-core, and observability sources, and excludes `proofs/**`. Package-local lint scripts delegate to that root context with `--max-warnings 0`. Keep the proof manifest and local lint configuration byte-for-byte unchanged.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --lockfile-only
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/standards run test
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run lint:p0.3
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/nextjs-cloudflare-proof run lint
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/standards pack --dry-run --json
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm audit --audit-level=moderate
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm peers check
rtk git diff --check
```

Expected standards pack contents add only `eslint/typescript-strict.mjs` to the previously approved four files.

Commit intent: `Add strict builder lint standard`

Continue directly to Increment 6 under the user's combined-review authorization.

## Increment 6 — Update canonical architecture and contributor surfaces

### Files

Modify:

- `AGENTS.md`
- `README.md`
- `CONTRIBUTING.md`
- `docs/architecture/overview.md`
- `docs/architecture/enforcement-map.md`
- `docs/architecture/package-ownership.md`
- `docs/roadmaps/program-roadmap.md`
- `tests/constitution/architecture-contracts.test.mjs`

### RED

Extend `tests/constitution/architecture-contracts.test.mjs` first. It must assert:

- root instructions link directly to each new nested instruction boundary and to the canonical package-ownership document;
- architecture overview points to package ownership instead of duplicating its normative matrix;
- the enforcement map records the initial package boundary/publication checks as actual;
- the Cloudflare-isolation invariant names the standards API and the proof as its current actual consumer, while generated-repository enforcement remains planned;
- the roadmap identifies P0.3 implementation as review-pending, not accepted/completed;
- README and CONTRIBUTING accurately describe the current package topology, Changeset workflow, and the separate publication approval boundary;
- P1 remains the first executable project/state schema stage.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm exec node --test tests/constitution/architecture-contracts.test.mjs
```

Expected RED: missing canonical links/status, not a test harness failure.

### GREEN

Update only direct consumers of the new package-ownership and enforcement facts. Do not copy the full lifecycle protocol into package instructions, README, or CONTRIBUTING. Mark P0.3 as review-pending; final acceptance remains the user's Gate 3 decision after the review packet.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk git diff --check
```

Commit intent: `Document lean monorepo ownership`

Stop for explicit user approval.

## Increment 7 — Final verification, independent review, and Gate 3 packet

### Files

Create:

- `docs/implementation-evidence/2026-08-04-p0-3-lean-builder-monorepo-verification.md`
- `docs/review-packets/2026-08-04-p0-3-lean-builder-monorepo.md`

Modify only if a reviewer identifies a current, evidence-backed material defect:

- the smallest affected P0.3 file;
- its focused regression test;
- the verification evidence and reviewer disposition in the review packet.

### Final deterministic verification

Run once on the coherent final candidate:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm audit --audit-level=moderate
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm peers check
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:p0.3
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:p0.2
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/standards pack --dry-run --json
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/observability pack --dry-run --json
rtk git diff --check 40604eb5b8a3ade0175c16dd945a1bafee15ae04..HEAD
rtk git status --short --branch
rtk git diff --name-status 40604eb5b8a3ade0175c16dd945a1bafee15ae04..HEAD
rtk git log --oneline --decorate 40604eb5b8a3ade0175c16dd945a1bafee15ae04..HEAD
```

`verify:p0.2` is mandatory because the proof becomes a consumer of the standards package. Its workerd/deployed-compatibility claims must not be inferred from the new unit tests.

### Independent read-only review

After deterministic verification passes, dispatch bounded read-only reviewers with the same frozen base/candidate and no recursive fan-out:

1. **Requirements reviewer:** map every P0.3 requirement, exit criterion, non-goal, and approval gate to current diff evidence.
2. **Architecture and anti-overengineering reviewer:** check package ownership, dependency direction, replaceability, stage discipline, duplication removal, and absence of premature profiles/schemas/runtime frameworks.
3. **Test-evidence reviewer:** verify RED/GREEN records, test relevance, command results, proof rerun, pack manifests, peer/audit evidence, and claim boundaries.
4. **Package-release and supply-chain specialist:** inspect public/private manifests, exports, files allowlists, lifecycle scripts, Changesets configuration, exact locked dependency graph, advisories, and dry-run package contents. This reviewer must not publish or contact an external service beyond read-only advisory/registry checks already authorized for verification.

Treat reviewer output as fallible work product. Reproduce every alleged defect against the current tree. Repair only material findings whose benefit exceeds churn and regression risk. Record every finding as fixed, rejected with evidence, or deferred with an explicit boundary. If any repair changes a tested input, rerun its focused test and the affected final verification; rerun the full suites once on the final changed tree.

### Evidence and packet contents

The verification evidence must record:

- final base/candidate SHAs and branch/status;
- exact Node/pnpm versions and command environment;
- each RED and GREEN result;
- full final command results;
- installed Changesets/config versions and lockfile checksum;
- direct and transitive advisory results with query date;
- exact standards and observability dry-run tarball manifests;
- explicit limits: no npm publication, no new deployed runtime, no WCAG, runtime, provider, production, or security-completeness claims beyond exercised evidence.

The review packet must list:

- frozen comparison and commits;
- every changed file grouped by ownership;
- requirements-to-evidence mapping;
- commands and results;
- all reviewer findings and controller-verified dispositions;
- risks and likely-fragile points;
- deferred P1+ work;
- source rollback through focused commit reversion;
- separate note that package unpublication, persistent-data rollback, provider rollback, and production recovery are not exercised because no release, data, provider, or production mutation occurred;
- the exact Gate 3 approval question.

Commit intent: `Record P0.3 verification and review`

Stop for explicit verified-final-diff approval. Do not mark P0.3 accepted, push, open a pull request, publish packages, or begin P1.

## Completion criteria

P0.3 is ready for Gate 3 only when all of the following are true:

- the package topology and ownership document match the approved increment;
- private packages cannot be published and public packages expose only intended files/APIs;
- standards APIs have concrete consumers and observability remains empty;
- no separate project-schema package or executable schema/profile/capability behavior exists;
- stable Changesets configuration and initial release intent are inspectable;
- the final lock graph passes peer and vulnerability checks;
- public-package dry-run contents exactly match the allowlists;
- P0.3 and affected P0.2 verification pass on the final tree;
- all required read-only reviews are complete and every material finding has a controller-verified disposition;
- the review packet is complete;
- no external release or production action has occurred.
