# P1 Builder Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private P1 builder kernel: executable schemas, six-capability portfolio/site resolution, installed state, hybrid ownership, read-only inference/doctor/diff, deterministic skeleton generation, a thin CLI, and build-verified fixtures.

**Architecture:** `packages/builder-core` owns all executable decisions and exposes narrow typed functions; `apps/cli` only parses arguments, calls core, and emits stable JSON. Portfolio/site recipes materialize explicit capability sets into the three accepted `.egeria` files, while generated source is rendered deterministically and new-directory creation is atomic. Existing-repository mutation, migration execution, provider work, production behavior, and later capabilities remain outside P1.

**Tech Stack:** Node.js `22.23.0`, pnpm `11.20.0`, TypeScript `6.0.3`, Zod `4.4.3`, `yaml` `2.9.0`, Node test runner, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, ESLint `9.39.5` for generated Next.js and `10.8.0` for builder source.

## Global Constraints

- Preparation evidence: `docs/implementation-evidence/2026-08-05-p1-builder-kernel-preparation.md`.
- Task 2 applicability evidence: `docs/implementation-evidence/2026-08-05-p1-task2-plan-applicability.md`. It re-freezes Task 2 at `5da4dfc8a40a4317730c08e2ef7b5cd139737aa6`, preserves the approved six-capability design, and owns the targeted file-map and validation-interface amendments below.
- Semantic naming evidence: `docs/implementation-evidence/2026-08-05-semantic-naming-preparation.md`. It inventories every live and planned phase-labelled executable name, preserves historical phase records, and assigns one atomic normalization task immediately before Task 3.
- Task 2A revalidation evidence: `docs/implementation-evidence/2026-08-05-semantic-naming-plan-revalidation.md`. It confirms the exact consumer map at `18938b0c90c629a1bb55907f922a4c49145edacf` and records that Node.js `22.23.0` is superseded by security release `22.23.2`. Task 2A remains naming-only: local compatibility verification proves command preservation only, while workflow dispatch, deployment, and current-runtime-security claims are blocked pending a separately approved pin update.
- Task 1 schema-review evidence: `docs/implementation-evidence/2026-08-05-p1-schema-contract-review-deferral.md`. The capability-version name and empty P1 capability-settings contract are assigned to the separately gated Task 1A plan; the other recorded questions remain deferred to Task 9.
- Frozen starting commit: `303ee9d35e19f9191948d994159f77c82c90a1ed` on clean sequential local `main`; re-freeze before execution if it changes.
- Run shell commands through `rtk`; use `/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm` and `CI=true` where pnpm may refresh generated dependencies.
- Each task follows RED, minimum GREEN, focused verification, one focused commit, and an explicit user stop before the next task.
- Do not change the accepted Node/Next/OpenNext/Cloudflare matrix, the proof package, public package APIs, or Changeset release intent unless a current evidence-backed defect makes the change directly necessary and the plan is amended before editing.
- Do not create `packages/project-schema`; schemas and checked artifacts remain private inside builder-core.
- Executable P1 capabilities are exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`.
- Executable P1 profiles are exactly `portfolio` and `site`. `app`, `app-foundation`, `authenticated-app`, and every later capability remain documentation-only.
- Installed capabilities become authoritative. `originProfile` and `recipeVersion` are informational provenance; `project.yaml.selectedCapabilities` contains the full materialized set.
- `.egeria` contains exactly `project.yaml`, `state.json`, `migrations.jsonl`, and an empty `reports/` directory marker only if a report is actually produced. P1 produces no report and therefore no reports directory.
- `.egeria/state.json` owns the installed capability manifest; do not add `.egeria/manifest.json`.
- Read-only inference, doctor, and diff perform no writes, Git operations, dependency installation, provider calls, or network access.
- Creation refuses an existing destination, including an existing empty directory. It never overwrites, stashes, commits, initializes Git, or mutates an existing repository.
- Creation writes a builder-owned temporary sibling, validates pre-state inference, writes state last, validates post-state inference, and renames once. Existing-repository isolated-worktree transformations remain P3 work.
- Generated repositories contain only `apps/web`; do not generate `apps/jobs` or local `packages/`.
- All generated visible/translatable copy comes from `apps/web/content/en-CA/*.json`; presentation receives typed data and callbacks only.
- No generic `PlatformService` or `ApplicationDatabase` port; no database, queue, email, forms, identity, payments, analytics, CMS, business CRUD, provider resource, or production deployment.
- Automated accessibility, visual, browser, human-usability, translation-fidelity, conformance, and production-release gates remain P2 scope. P1 must not claim them.
- Public package versioning/publication is not authorized by this plan. Local packed-tarball substitution cannot satisfy the portable lockfile or state-order contract.
- Tasks 1 through 6 are within the plan, but plan approval authorizes beginning Task 1 only; every later task still requires the preceding checkpoint approval. Task 7 is additionally a hard stop until standards and observability are separately versioned/published under explicit approval and their exact public versions pass current registry/advisory checks.
- A portable generated `pnpm-lock.yaml`, fresh public-registry install, and pre-state generated-project verification are mandatory for Tasks 7 and 8. The P1 packet must not mark them passed before they exist.
- No push, pull request, merge, deployment, npm versioning/publication, permission change, external message, or review-comment response is authorized.
- Roadmap labels remain valid in phase-subject plans, evidence, review packets, status, and gates, but executable paths, APIs, errors, scripts, workflows, schemas, CLI surfaces, generated paths, and ordinary test identifiers use semantic responsibility names. Task 2A normalizes the current exceptions before later P1 consumers are added.

## File and Interface Map

### Builder-core contracts

- `packages/builder-core/src/contracts/result.ts`: `ContractIssue`, `ValidationResult<T>`, deterministic issue sorting.
- `packages/builder-core/src/contracts/identifiers.ts`: stable identifier, semantic-version, safe-relative-path, and SHA-256 fingerprint schemas.
- `packages/builder-core/src/contracts/capability.ts`: capability metadata, typed probes, managed-surface descriptors, and inferred TypeScript types.
- `packages/builder-core/src/contracts/profile.ts`: P1 profile recipe schema.
- `packages/builder-core/src/contracts/project.ts`: desired project schema.
- `packages/builder-core/src/contracts/state.ts`: installed manifest, owned-surface, ejection, compatibility, and verification schemas.
- `packages/builder-core/src/contracts/migration.ts`: append-only successful migration/reconciliation record schema; no executor.
- `packages/builder-core/src/contracts/json-schemas.ts`: checked Draft 2020-12 artifact generation.

### Resolution and state

- `packages/builder-core/src/catalog/capability-catalog.ts`: the exact six executable descriptors.
- `packages/builder-core/src/profiles/profile-recipes.ts`: exact `portfolio` and `site` recipes.
- `packages/builder-core/src/resolution/resolve-capabilities.ts`: dependency closure and deterministic ordering.
- `packages/builder-core/src/manifest/create-installed-manifest.ts`: authoritative installed entries from resolved descriptors.
- `packages/builder-core/src/state/codecs.ts`: YAML 1.2, JSON, and JSONL parsing/serialization.
- `packages/builder-core/src/ownership/fingerprint.ts`: exact-file and canonical-JSON SHA-256 fingerprints.
- `packages/builder-core/src/ownership/materialize-surfaces.ts`: state records for full files and bounded JSON properties.

### Read-only inspection

- `packages/builder-core/src/repository/repository-reader.ts`: narrow read-only port plus filesystem and in-memory adapters.
- `packages/builder-core/src/inference/evaluate-probe.ts`: typed probe evaluation.
- `packages/builder-core/src/inference/infer-repository.ts`: qualitative capability evidence and ownership drift.
- `packages/builder-core/src/diagnostics/doctor.ts`: stable health issues.
- `packages/builder-core/src/diagnostics/diff-project.ts`: desired/installed/inferred capability and surface differences.

### Generation and CLI

- `packages/builder-core/src/generation/template-catalog.ts`: exact template-to-destination map.
- `packages/builder-core/src/generation/render-template.ts`: strict token substitution.
- `packages/builder-core/src/generation/render-skeleton.ts`: in-memory `GeneratedFile[]` plus desired state.
- `packages/builder-core/src/generation/verify-generated-project.ts`: lockfile preparation and isolated-copy generated-project verification.
- `packages/builder-core/src/generation/write-generated-project.ts`: safe temp write, inference gates, state-last finalization, and atomic rename.
- `apps/cli/src/arguments.ts`: Node `parseArgs` command contract.
- `apps/cli/src/run-cli.ts`: dependency-injected command execution and JSON output.
- `apps/cli/src/index.ts`: executable entry point only.

### Generated skeleton templates

Common destination set:

```text
.gitignore
.nvmrc
AGENTS.md
README.md
package.json
pnpm-workspace.yaml
apps/web/AGENTS.md
apps/web/package.json
apps/web/tsconfig.json
apps/web/eslint.config.mjs
apps/web/next.config.ts
apps/web/open-next.config.ts
apps/web/wrangler.jsonc
apps/web/app/globals.css
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/src/content/content-schema.ts
apps/web/src/content/read-content.ts
apps/web/src/presentation/content-page.tsx
apps/web/src/infrastructure/observability/installed-capability.ts
apps/web/content/en-CA/site.json
```

`site` adds:

```text
apps/web/app/about/page.tsx
apps/web/content/en-CA/about.json
```

Generation adds, rather than templates, these state files:

```text
.egeria/project.yaml
.egeria/state.json
.egeria/migrations.jsonl
```

## Task 1: Private Runtime Schema Contracts

**Files:**

- Create: `packages/builder-core/src/contracts/result.ts`
- Create: `packages/builder-core/src/contracts/identifiers.ts`
- Create: `packages/builder-core/src/contracts/capability.ts`
- Create: `packages/builder-core/src/contracts/profile.ts`
- Create: `packages/builder-core/src/contracts/project.ts`
- Create: `packages/builder-core/src/contracts/state.ts`
- Create: `packages/builder-core/src/contracts/migration.ts`
- Create: `packages/builder-core/src/contracts/json-schemas.ts`
- Create: `packages/builder-core/scripts/generate-json-schemas.mjs`
- Create: `packages/builder-core/schemas/capability.schema.json`
- Create: `packages/builder-core/schemas/profile.schema.json`
- Create: `packages/builder-core/schemas/project.schema.json`
- Create: `packages/builder-core/schemas/state.schema.json`
- Create: `packages/builder-core/schemas/migration-record.schema.json`
- Create: `packages/builder-core/tests/contracts.test.mjs`
- Modify: `packages/builder-core/src/index.ts`
- Modify: `packages/builder-core/package.json`
- Modify: `packages/builder-core/tsconfig.json`
- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `tests/package-boundaries/private-packages.test.mjs`
- Modify: `tests/package-boundaries/release-safeguards.test.mjs`
- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md` (execution amendment recording the discovered direct consumer)
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type ContractIssue = Readonly<{
  code: string;
  path: readonly (string | number)[];
  context: Readonly<Record<string, string>>;
}>;

export type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly ContractIssue[] }>;

export type CapabilityDeliveryMode =
  | "package-backed"
  | "source-generated"
  | "hybrid";

export type CapabilityStateClassification =
  | "stateless"
  | "repository-stateful"
  | "external-stateful"
  | "persistent-data";

export type CapabilityRemovalPolicy =
  | "automatic"
  | "reviewed"
  | "export-and-remove"
  | "eject-only"
  | "unsupported";

export type SurfaceOwnershipMode =
  | "managed"
  | "merge-managed"
  | "application-owned"
  | "ejected";

export type InferenceProbe =
  | Readonly<{ kind: "file"; path: string }>
  | Readonly<{
      kind: "json-value";
      path: string;
      pointer: string;
      expected: string | boolean | number;
    }>
  | Readonly<{
      kind: "package";
      path: string;
      section: "dependencies" | "devDependencies";
      packageName: string;
      version: string;
    }>;

export type ManagedSurfaceDescriptor = Readonly<{
  identifier: string;
  owner:
    | Readonly<{ kind: "builder-kernel" }>
    | Readonly<{ kind: "capability"; identifier: string }>;
  path: string;
  ownership: Exclude<SurfaceOwnershipMode, "ejected">;
  fingerprintTarget:
    | Readonly<{ kind: "file" }>
    | Readonly<{ kind: "json-value"; pointer: string }>;
  mergeStrategy: "replace-file" | "json-property";
}>;
```

`CapabilityDescriptor` contains every field in the canonical capability model, replaces documentation-only string probes/surfaces with the typed unions above, rejects unknown keys, requires a non-empty duplicate-free `stateClassifications`, and rejects `stateless` combined with another state classification.

`ProjectConfiguration` uses this exact top-level shape:

```ts
type ProjectConfiguration = Readonly<{
  schemaVersion: "1.0.0";
  builderCompatibility: "0.0.0";
  project: Readonly<{
    name: string;
    displayName: string;
    defaultLocale: "en-CA";
  }>;
  originProfile: "portfolio" | "site";
  recipeVersion: "0.1.0";
  platformAdapter: "cloudflare-workers";
  selectedCapabilities: readonly string[];
  capabilitySettings: Readonly<Record<string, never>>;
  ejectedAreas: readonly string[];
}>;
```

`InstalledState` uses this exact top-level shape:

```ts
type InstalledState = Readonly<{
  schemaVersion: "1.0.0";
  builderVersion: "0.0.0";
  projectSchemaVersion: "1.0.0";
  origin: Readonly<{ profile: "portfolio" | "site"; recipeVersion: "0.1.0" }>;
  installedCapabilities: readonly InstalledCapability[];
  appliedMigrations: readonly string[];
  managedSurfaces: readonly InstalledSurface[];
  ejections: readonly string[];
  compatibility: Readonly<{
    node: "22.23.0";
    pnpm: "11.20.0";
    platformAdapter: "cloudflare-workers";
  }>;
  lastSuccessfulVerification: Readonly<{
    kind: "generation";
    checks: readonly [
      "contracts",
      "pre-state-inference",
      "lockfile",
      "frozen-install",
      "lint",
      "typecheck",
      "next-build",
      "opennext-build",
      "post-state-inference",
    ];
  }>;
}>;
```

- [ ] **Step 1: Write the schema contract tests**

Test valid and invalid project/state/migration values, all enum boundaries, strict unknown-key rejection, safe relative paths, lowercase kebab identifiers, `sha256:<64 lowercase hex>` fingerprints, duplicate classifications, and `stateless` exclusivity. Read every checked JSON Schema artifact and compare it with `createJsonSchemaArtifacts()`.

- [ ] **Step 2: Run RED**

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs
```

Expected: the test fails because the contract exports and schema artifacts do not exist; the failure must not be a Node test-loader error.

- [ ] **Step 3: Add exact dependencies and schemas**

Add runtime dependencies `zod: "4.4.3"` and `yaml: "2.9.0"`, dev dependency `@types/node: "22.20.1"`, Node types in builder-core `tsconfig.json`, and root exports to built ESM/declarations. Add builder-core scripts `test: "node --test tests/*.test.mjs"`, `schema:generate: "node scripts/generate-json-schemas.mjs"`, `schema:check: "node scripts/generate-json-schemas.mjs --check"`, and `verify: "pnpm run build && pnpm run schema:check && pnpm run test && pnpm run typecheck && pnpm run lint"`. Add root `test:builder-core` and include it once in the root `test` aggregate. Use `z.strictObject`, `.meta({ id, title })`, and `z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "throw" })`.

The generator script accepts only `--check`; without it, it writes sorted, two-space JSON plus one newline. In check mode it compares bytes and exits non-zero without writing.

- [ ] **Step 4: Update the P0.3 boundary contract**

Replace the private-shell assertions with P1 assertions: builder-core remains private, exports only its root and package manifest, owns schemas internally, has only the two exact runtime dependencies, and still does not expose a separate schema package, provider, migration executor, or existing-repository mutation surface.

- [ ] **Step 5: Generate artifacts and run GREEN**

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --lockfile-only
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run schema:generate
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run schema:check
rtk node --test packages/builder-core/tests/contracts.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk git diff --check
```

Expected: all focused contracts pass; no unrelated package API or path exists.

- [ ] **Step 6: Commit and stop**

```bash
git add package.json pnpm-lock.yaml packages/builder-core tests/package-boundaries/private-packages.test.mjs tests/package-boundaries/release-safeguards.test.mjs docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
git commit -m "Add P1 schema contracts"
```

Present the exact changed-file list and focused results. Stop for explicit user approval before Task 1A.

## Task 1A: Pre-Task2 Schema Contract Clarifications

Task 1A resolves only the two contract questions whose ambiguity or permissiveness would otherwise be materialized by later P1 consumers: `CapabilityDescriptor.version` is the capability release version, and P1 requires an empty `capabilitySettings` map. Its exact files, RED/GREEN sequence, documentation reconciliation, reviewers, verification, and rollback are owned by `docs/superpowers/plans/2026-08-05-p1-pre-task2-schema-contract-clarifications.md`.

Do not treat the other recorded schema questions as authorized Task 1A work. Stop after its focused commit for explicit user approval before Task 2.

## Task 2: P1 Capability Catalog, Profiles, and Resolution

Task 2 is complete. Its phase-labelled executable names below are retained as the exact record of what was approved and committed; Task 2A immediately following owns their semantic replacement before any new consumer is added.

**Files:**

- Create: `packages/builder-core/src/catalog/p1-capabilities.ts`
- Create: `packages/builder-core/src/profiles/p1-profiles.ts`
- Create: `packages/builder-core/src/resolution/resolve-capabilities.ts`
- Create: `packages/builder-core/src/manifest/create-installed-manifest.ts`
- Create: `packages/builder-core/tests/resolution.test.mjs`
- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `packages/builder-core/src/index.ts`
- Modify: `tests/package-boundaries/private-packages.test.mjs`
- Modify: `README.md`
- Modify: `docs/architecture/capability-model.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/architecture/package-ownership.md`

**Interfaces:**

```ts
export type ResolutionRequest = Readonly<{
  profile: "portfolio" | "site";
  requestedCapabilities?: readonly string[];
}>;

export type P1PackageVersions = Readonly<{
  standards: string;
  observability: string;
}>;

export type ResolvedCapabilities = Readonly<{
  profile: "portfolio" | "site";
  recipeVersion: "0.1.0";
  capabilities: readonly CapabilityDescriptor[];
}>;

export const p1ProfileRecipes: readonly ProfileRecipe[];

export function resolveCapabilities(
  request: ResolutionRequest,
  catalog: readonly CapabilityDescriptor[],
  profiles: readonly ProfileRecipe[],
): ValidationResult<ResolvedCapabilities>;

export function createP1CapabilityCatalog(
  packageVersions: P1PackageVersions,
): ValidationResult<readonly CapabilityDescriptor[]>;

export function createInstalledManifest(
  resolved: ResolvedCapabilities,
): readonly InstalledCapability[];
```

The exact P1 catalog matrix is:

| Identifier | Version | Delivery | State | Removal | Dependencies | Profiles |
| --- | --- | --- | --- | --- | --- | --- |
| `standards` | `0.1.0` | package-backed | repository-stateful | reviewed | none | portfolio, site |
| `content-files` | `0.1.0` | source-generated | repository-stateful | reviewed | standards | portfolio, site |
| `section-composition` | `0.1.0` | source-generated | repository-stateful | reviewed | content-files | portfolio, site |
| `deployment-cloudflare` | `0.1.0` | hybrid | repository-stateful, external-stateful | reviewed | standards | portfolio, site |
| `observability` | `0.1.0` | hybrid | repository-stateful, external-stateful | reviewed | deployment-cloudflare | portfolio, site |
| `site-routing` | `0.1.0` | source-generated | repository-stateful | reviewed | content-files, section-composition | site |

Every P1 descriptor declares all metadata arrays. P1 uses no secret, browser storage, persistent data, privileged operation, migration planner, analytics domain, or provider mutation. `deployment-cloudflare` declares Cloudflare Worker/static assets as platform resources and OpenNext/Wrangler verification identifiers. `observability` declares only its ordinary package dependency and source registration marker; Better Stack transport behavior remains P2.

Every descriptor uses `threatReviewLevel: "standard"`; `optionalIntegrations`, `conflicts`, `environmentVariables`, `secrets`, `externalDomains`, `contentSecurityPolicyContributions`, `browserStorage`, `dataClassifications`, `retentionAssumptions`, `privilegedOperations`, and `migrationPlanners` are empty. The exact remaining metadata is:

| Identifier | Required packages | Platform resources | Adapter semantics | Verification plan | Documentation evidence | Removal and recovery |
| --- | --- | --- | --- | --- | --- | --- |
| `standards` | `@egeria-systems/standards` | none | none | `package-resolution`, `lint`, `typecheck` | `public-package-version-and-provenance` | `review-package-and-configuration-removal` |
| `content-files` | none | none | none | `content-contracts`, `typecheck` | `copy-externalization` | `review-content-and-source-removal` |
| `section-composition` | none | none | none | `typecheck`, `next-build` | `bounded-section-composition` | `review-route-and-presentation-removal` |
| `deployment-cloudflare` | `@opennextjs/cloudflare`, `wrangler` | `cloudflare-worker`, `cloudflare-static-assets` | `node-runtime`, `worker-static-assets` | `next-build`, `opennext-build`, `wrangler-types` | `nextjs-opennext-cloudflare-compatibility` | `review-deployment-source-and-provider-state-separately` |
| `observability` | `@egeria-systems/observability` | none | none | `package-resolution`, `typecheck`, `next-build` | `public-package-version-and-provenance`, `analytics-separation` | `review-package-and-registration-removal` |
| `site-routing` | none | none | none | `typecheck`, `next-build` | `multi-page-routing-contract` | `review-route-and-content-removal` |

The recipes are exact:

```ts
portfolio = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
];

site = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
  "site-routing",
];
```

The required P1 inference probes are exact:

| Capability | Required probes |
| --- | --- |
| `standards` | package `apps/web/package.json#/devDependencies/@egeria-systems~1standards = packageVersions.standards`; files `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs` |
| `content-files` | files `apps/web/content/en-CA/site.json`, `apps/web/src/content/content-schema.ts`, `apps/web/src/content/read-content.ts` |
| `section-composition` | files `apps/web/app/page.tsx`, `apps/web/src/presentation/content-page.tsx` |
| `deployment-cloudflare` | package `apps/web/package.json#/dependencies/@opennextjs~1cloudflare = 1.20.2`; package `apps/web/package.json#/devDependencies/wrangler = 4.118.0`; files `apps/web/next.config.ts`, `apps/web/open-next.config.ts`, `apps/web/wrangler.jsonc` |
| `observability` | package `apps/web/package.json#/dependencies/@egeria-systems~1observability = packageVersions.observability`; file `apps/web/src/infrastructure/observability/installed-capability.ts` |
| `site-routing` | files `apps/web/app/about/page.tsx`, `apps/web/content/en-CA/about.json` |

Capability-managed surfaces use those exact package JSON pointers and files. Baseline workspace files not semantically owned by one capability use `owner: { kind: "builder-kernel" }`. Configuration files are `managed`, package JSON pointers are `merge-managed` with `json-property`, and generated content/presentation/README/AGENTS surfaces are `application-owned` after creation.

The exact Task 2 surface identifiers and ownership are:

| Identifier | Owner | Path and target | Ownership and merge |
| --- | --- | --- | --- |
| `standards-package` | `standards` | `apps/web/package.json#/devDependencies/@egeria-systems~1standards` | `merge-managed`, `json-property` |
| `standards-typescript-configuration` | `standards` | `apps/web/tsconfig.json` file | `managed`, `replace-file` |
| `standards-eslint-configuration` | `standards` | `apps/web/eslint.config.mjs` file | `managed`, `replace-file` |
| `content-files-site-content` | `content-files` | `apps/web/content/en-CA/site.json` file | `application-owned`, `replace-file` |
| `content-files-schema` | `content-files` | `apps/web/src/content/content-schema.ts` file | `application-owned`, `replace-file` |
| `content-files-reader` | `content-files` | `apps/web/src/content/read-content.ts` file | `application-owned`, `replace-file` |
| `section-composition-home-route` | `section-composition` | `apps/web/app/page.tsx` file | `application-owned`, `replace-file` |
| `section-composition-presentation` | `section-composition` | `apps/web/src/presentation/content-page.tsx` file | `application-owned`, `replace-file` |
| `deployment-cloudflare-package` | `deployment-cloudflare` | `apps/web/package.json#/dependencies/@opennextjs~1cloudflare` | `merge-managed`, `json-property` |
| `deployment-cloudflare-wrangler-package` | `deployment-cloudflare` | `apps/web/package.json#/devDependencies/wrangler` | `merge-managed`, `json-property` |
| `deployment-cloudflare-next-configuration` | `deployment-cloudflare` | `apps/web/next.config.ts` file | `managed`, `replace-file` |
| `deployment-cloudflare-open-next-configuration` | `deployment-cloudflare` | `apps/web/open-next.config.ts` file | `managed`, `replace-file` |
| `deployment-cloudflare-wrangler-configuration` | `deployment-cloudflare` | `apps/web/wrangler.jsonc` file | `managed`, `replace-file` |
| `observability-package` | `observability` | `apps/web/package.json#/dependencies/@egeria-systems~1observability` | `merge-managed`, `json-property` |
| `observability-registration` | `observability` | `apps/web/src/infrastructure/observability/installed-capability.ts` file | `managed`, `replace-file` |
| `site-routing-about-route` | `site-routing` | `apps/web/app/about/page.tsx` file | `application-owned`, `replace-file` |
| `site-routing-about-content` | `site-routing` | `apps/web/content/en-CA/about.json` file | `application-owned`, `replace-file` |

- [ ] **Step 1: Write resolution and direct-boundary tests**

In `resolution.test.mjs`, cover exact recipes, dependency-before-dependant order, catalog permutation stability, duplicate requested capability collapse, unknown identifiers, unsupported profile selection, invalid/duplicate catalog and profile entries, synthetic missing dependency, cycle, conflict, exact stable package-version syntax, descriptor metadata, surface identity, and manifest fields. Reject `workspace:`, `file:`, Git, URL, range, and prerelease package values through `P1_PACKAGE_VERSION_INVALID` without echoing the value. Assert `app` and all later capability identifiers are rejected as unknown executable P1 inputs.

In `private-packages.test.mjs`, replace the exact Task 1 source list with the exact Task 2 source list and assert that the nested instructions, package README, and package-ownership matrix describe the private schema/catalog/resolver/manifest boundary while still prohibiting codecs, inference, diagnostics, generation, CLI commands, providers, and later capabilities.

- [ ] **Step 2: Run RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/resolution.test.mjs
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
```

Expected: the resolution test fails because the resolver/catalog/profile/manifest exports do not exist; the package-boundary suite fails because its approved Task 2 source and documentation boundary does not exist. Failures must not be dependency-install or test-loader errors.

- [ ] **Step 3: Implement deterministic resolution**

Validate exact stable `major.minor.patch` package values before constructing the catalog and return `P1_PACKAGE_VERSION_INVALID` issues in standards/observability field order. Validate catalog/profile contracts and unique identifiers before resolution. Walk profile defaults followed by requested capabilities in first-declared order, sort every descriptor dependency list lexically before depth-first resolution, append each capability once after its dependencies, and report stable `CAPABILITY_CATALOG_INVALID`, `CAPABILITY_DUPLICATE`, `PROFILE_CATALOG_INVALID`, `PROFILE_DUPLICATE`, `CAPABILITY_UNKNOWN`, `PROFILE_UNKNOWN`, `CAPABILITY_UNSUPPORTED`, `CAPABILITY_DEPENDENCY_MISSING`, `CAPABILITY_CYCLE`, and `CAPABILITY_CONFLICT` issues. Do not include rejected package specifications or unrelated descriptor data in issue context.

- [ ] **Step 4: Update the canonical owners and direct consumers**

Replace `managedSurfaces: readonly string[]` and `inferenceProbes: readonly string[]` in the executable capability-model example with the typed descriptor/probe shapes from Task 1. State clearly that the full table remains program visibility while P1 executes only the six listed identifiers.

Update builder-core's nested instructions and README from Task 1 to the exact Task 2 boundary. Update package ownership from the obsolete empty-shell description to the private Task 1/2 root exports and consumers. Mark `INV-CAPABILITY-METADATA` actual only for the tested six-capability P1 catalog; leave `INV-PROFILE-MATERIALIZATION` planned until inference agreement exists. Correct the root README's claim that builder-core has no executable schemas while retaining P1's in-progress and no-production-profile limits.

- [ ] **Step 5: Run GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/resolution.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run lint
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk git diff --check
```

- [ ] **Step 6: Commit and stop**

```bash
git add README.md packages/builder-core/AGENTS.md packages/builder-core/README.md packages/builder-core/src packages/builder-core/tests/resolution.test.mjs tests/package-boundaries/private-packages.test.mjs docs/architecture/capability-model.md docs/architecture/enforcement-map.md docs/architecture/package-ownership.md
git commit -m "Resolve P1 capabilities"
```

Stop for explicit user approval before Task 2A.

## Task 2A: Semantic Executable Naming Normalization

Task 2A is intentionally placed before state codecs, inference, generation, and CLI consumers multiply. It changes names only; Task 2 behavior and metadata remain byte-for-byte equivalent apart from the semantic profile-schema title and renamed stable package-version issue code.

**Preparation evidence:** `docs/implementation-evidence/2026-08-05-semantic-naming-preparation.md`

**Revalidation evidence:** `docs/implementation-evidence/2026-08-05-semantic-naming-plan-revalidation.md`

**Design:** `docs/superpowers/specs/2026-08-05-semantic-executable-naming-design.md`

**Frozen executable state:** `3d2f0042bb7993a1e745c36b81962677a9a27b43` on clean local `main`. This planning increment changes documentation only. Immediately before RED, require a clean worktree and record the then-current HEAD as Task 2A's exact implementation comparison base.

**Security boundary:** Node.js `22.23.0` is now behind security release `22.23.2`. Do not change the runtime pin inside this naming-only increment. Run the compatibility proof only locally with trusted repository inputs and loopback services, and interpret it only as evidence that the renamed command preserves the accepted proof behavior. Do not dispatch the GitHub workflow, deploy, or claim current runtime security. The pin update requires its own compatibility plan and approval.

**Files:**

Planning gate, committed after approval and before RED:

- Create: `docs/implementation-evidence/2026-08-05-semantic-naming-plan-revalidation.md`
- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`

Final verification and review gate:

- Create: `docs/implementation-evidence/2026-08-05-semantic-executable-naming-verification.md`
- Create: `docs/review-packets/2026-08-05-semantic-executable-naming.md`

Implementation:

- Rename: `packages/builder-core/src/catalog/p1-capabilities.ts` to `packages/builder-core/src/catalog/capability-catalog.ts`
- Rename: `packages/builder-core/src/profiles/p1-profiles.ts` to `packages/builder-core/src/profiles/profile-recipes.ts`
- Modify: `packages/builder-core/src/catalog/capability-catalog.ts`
- Modify: `packages/builder-core/src/profiles/profile-recipes.ts`
- Modify: `packages/builder-core/src/contracts/profile.ts`
- Modify generated artifact: `packages/builder-core/schemas/profile.schema.json`
- Modify: `packages/builder-core/src/index.ts`
- Modify: `packages/builder-core/tests/contracts.test.mjs`
- Modify: `packages/builder-core/tests/resolution.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/compatibility-proof.yml`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `tests/package-boundaries/internal-linting.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`
- Modify: `tests/package-boundaries/release-safeguards.test.mjs`

**Exact live-name mapping:**

| Current executable name | Semantic name |
| --- | --- |
| `catalog/p1-capabilities.ts` | `catalog/capability-catalog.ts` |
| `profiles/p1-profiles.ts` | `profiles/profile-recipes.ts` |
| `P1PackageVersions` | `CapabilityPackageVersions` |
| `createP1CapabilityCatalog` | `createCapabilityCatalog` |
| `p1ProfileRecipes` | `profileRecipes` |
| `P1_PACKAGE_VERSION_INVALID` | `CAPABILITY_PACKAGE_VERSION_INVALID` |
| `Egeria P1 profile recipe` | `Egeria portfolio and site profile recipe` |
| `build:p0.3` | `build:builder` |
| `lint:p0.3` | `lint:builder` |
| `typecheck:p0.3` | `typecheck:builder` |
| `verify:p0.2` | `verify:compatibility-proof` |
| `verify:p0.3` | `verify:builder-packages` |

Normalize these ordinary current-behavior test titles in the same change:

| Current test title | Semantic replacement |
| --- | --- |
| `builder-core exports the executable P1 contract boundary` | `builder-core exports the executable contract boundary` |
| `the P1 catalog declares the exact six executable capability contracts` | `the portfolio and site catalog declares the exact six executable capability contracts` |
| `P1 package versions must be exact stable releases and issues do not echo inputs` | `capability package versions must be exact stable releases and issues do not echo inputs` |
| `P1 keeps schemas private and reserves every later-stage builder surface` | `builder-core keeps schemas private and reserves every later-stage builder surface` |
| `the root workspace remains private and pins the P0.2 toolchain` | `the root workspace remains private and pins the compatibility-proof toolchain` |

Do not retain compatibility aliases. Historical plans, evidence, review packets, compatibility records, phase status, roadmap headings, and phase-specific invariants retain the labels and exact commands that were true when accepted.

- [ ] **Step 0: Commit the approved planning gate and re-freeze**

After explicit approval, commit only the dated revalidation evidence and this Task 2A plan amendment before implementation:

```bash
git add docs/implementation-evidence/2026-08-05-semantic-naming-plan-revalidation.md docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
git commit -m "Revalidate semantic naming plan"
rtk git status --short --branch
rtk git rev-parse HEAD
```

Expected: the local planning commit succeeds, the worktree is clean, and its HEAD becomes Task 2A's exact implementation comparison base. Stop if any unrelated staged, unstaged, or untracked work appears.

- [ ] **Step 1: Write semantic-name and direct-consumer tests**

Update the executable contract tests first, before renaming implementation surfaces:

- `packages/builder-core/tests/contracts.test.mjs`: rename the current-runtime export test, assert the generated profile artifact title is exactly `Egeria portfolio and site profile recipe`, and reject the old title.
- `packages/builder-core/tests/resolution.test.mjs`: call `createCapabilityCatalog`, consume `profileRecipes`, expect `CAPABILITY_PACKAGE_VERSION_INVALID`, assert the three old exports are absent, and rename the two current-runtime test titles listed above without changing their catalog, resolution, or privacy assertions.
- `tests/package-boundaries/private-packages.test.mjs`: require `catalog/capability-catalog.ts` and `profiles/profile-recipes.ts` in the exact source allowlist, reject both old paths, and apply the semantic current-boundary test title.
- `tests/package-boundaries/internal-linting.test.mjs`: require `lint:builder`, require `verify:builder-packages` to call it, and assert `lint:p0.3` is absent.
- `tests/package-boundaries/release-safeguards.test.mjs`: require the exact `build:builder`, `lint:builder`, `typecheck:builder`, and `verify:builder-packages` keys and commands; assert all four old keys are absent.
- `tests/constitution/constitution.test.mjs`: rename the current workspace test, require `verify:compatibility-proof`, require the compatibility workflow to invoke `pnpm run verify:compatibility-proof`, assert `verify:p0.2` is absent from both live surfaces, and require README/CONTRIBUTING to use only the semantic verification commands.

The RED test edits must not modify catalog metadata, profile content, resolution expectations, accepted historical phase records, or phase-specific invariant tests.

- [ ] **Step 2: Run RED**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/resolution.test.mjs
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
```

Expected: builder-core tests fail on missing semantic exports/schema title/issue code; package-boundary tests fail on old source paths and script keys; constitution fails because the compatibility workflow still calls the old root script. Failures must not be dependency-install or loader errors.

- [ ] **Step 3: Rename implementation and executable consumers atomically**

Rename the two source files, exported API symbols, stable issue code, schema title, five current root scripts, workflow command, and current documentation consumers exactly as mapped. Regenerate `profile.schema.json` through `pnpm --filter @egeria-systems/builder-core run schema:generate`; do not hand-edit it. Retain the active plan's semantic future names `verified-package-versions.ts` and `verify:builder-kernel` when those surfaces are implemented.

Do not change resolution logic, capability metadata, recipe content, dependencies, lockfile, provider behavior, generated output, or public package APIs.

After GREEN, run one repository-wide tracked/live-surface search for the old paths, exports, issue code, schema title, and five old script keys. Remaining matches must be phase-subject historical records or the Task 2A negative assertions themselves; any other match is a missed direct consumer.

- [ ] **Step 4: Run GREEN and affected compatibility verification**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:builder-packages
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:compatibility-proof
rtk git diff --check
rtk git status --short --branch
```

The compatibility proof is rerun because its GitHub workflow calls the renamed root command. It remains local verification only and performs no deployment or provider mutation.

Because the accepted `22.23.0` pin is stale against security release `22.23.2`, this proof establishes only name-preserving behavior for trusted local inputs. It is not evidence of current runtime security, and the GitHub workflow must not be dispatched.

- [ ] **Step 5: Commit the verified review candidate**

After the GREEN commands and live-name search pass against the unchanged tree, commit the coherent implementation candidate so every reviewer receives an exact immutable comparison:

```bash
git add .github/workflows/compatibility-proof.yml README.md CONTRIBUTING.md package.json packages/builder-core/src packages/builder-core/schemas/profile.schema.json packages/builder-core/tests tests/constitution/constitution.test.mjs tests/package-boundaries
git commit -m "Normalize executable names"
```

- [ ] **Step 6: Review, record evidence, and stop**

Dispatch the required independent requirements, architecture/anti-overengineering, and test-evidence reviewers with frozen base/candidate commits, the design, both Task 2A evidence records, this plan section, changed-file list, and exact RED/GREEN output. Prohibit edits, recursive delegation, GitHub comments, workflow dispatch, deployment, and other external action. Repair only validated material findings and rerun affected verification. Confirm the final diff contains no old live names or compatibility aliases, does not rewrite historical records, and does not change the Node pin or make a current-security claim.

Create the dated verification evidence and review packet. The review packet must list the exact comparison, changed files, RED/GREEN and final commands with results, reviewer dispositions, residual risks, deferred work, and rollback/recovery. Commit only these final gate artifacts after they pass documentation and diff checks:

```bash
git add docs/implementation-evidence/2026-08-05-semantic-executable-naming-verification.md docs/review-packets/2026-08-05-semantic-executable-naming.md
git commit -m "Record semantic naming verification"
```

Stop for explicit user approval before Task 3.

## Task 3: `.egeria` Codecs and Hybrid Ownership

**Files:**

- Create: `packages/builder-core/src/state/codecs.ts`
- Create: `packages/builder-core/src/ownership/fingerprint.ts`
- Create: `packages/builder-core/src/ownership/materialize-surfaces.ts`
- Create: `packages/builder-core/tests/state-ownership.test.mjs`
- Modify: `packages/builder-core/src/index.ts`

**Interfaces:**

```ts
export function parseProjectYaml(source: string): ValidationResult<ProjectConfiguration>;
export function serializeProjectYaml(value: ProjectConfiguration): string;
export function parseStateJson(source: string): ValidationResult<InstalledState>;
export function serializeStateJson(value: InstalledState): string;
export function parseMigrationLog(source: string): ValidationResult<readonly MigrationRecord[]>;
export function serializeMigrationRecord(value: MigrationRecord): string;

export function fingerprintFileContent(content: Uint8Array): `sha256:${string}`;
export function fingerprintJsonValue(value: unknown): `sha256:${string}`;

export function materializeInstalledSurfaces(input: Readonly<{
  files: ReadonlyMap<string, Uint8Array>;
  surfaces: readonly ManagedSurfaceDescriptor[];
}>): ValidationResult<readonly InstalledSurface[]>;
```

YAML parsing uses `parseDocument(source, { version: "1.2", schema: "core", resolveKnownTags: false, strict: true, stringKeys: true, uniqueKeys: true, prettyErrors: true })`, rejects document warnings, and calls `toJS({ maxAliasCount: 0, mapAsMap: false })`. Serialization uses YAML 1.2 with sorted map entries and one terminal newline.

Fingerprints are lowercase SHA-256. File targets hash exact bytes. JSON-property targets resolve an RFC 6901 pointer, recursively sort object keys, preserve array order, serialize with `JSON.stringify`, and hash UTF-8 bytes.

- [ ] **Step 1: Write codec and ownership tests**

Cover YAML 1.2 `No` remaining a string, duplicate keys, aliases, multiple documents, unknown keys, stable sorting/newline, invalid JSON, JSONL line numbers, empty migration logs, full-file hashes, canonical JSON hashes, missing JSON pointers, duplicate surface identifiers, overlapping exact targets, and no self-fingerprint of `.egeria/state.json`.

- [ ] **Step 2: Run RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/state-ownership.test.mjs
```

Expected: missing codec/ownership exports.

- [ ] **Step 3: Implement minimum codecs and ownership**

Map parser/library errors to stable `PROJECT_YAML_INVALID`, `PROJECT_SCHEMA_INVALID`, `STATE_JSON_INVALID`, `STATE_SCHEMA_INVALID`, `MIGRATION_JSON_INVALID`, `MIGRATION_SCHEMA_INVALID`, `SURFACE_SOURCE_MISSING`, `SURFACE_POINTER_MISSING`, and `SURFACE_TARGET_DUPLICATE` issues. Do not include raw file contents in issues.

- [ ] **Step 4: Run GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/state-ownership.test.mjs
rtk git diff --check
```

- [ ] **Step 5: Commit and stop**

```bash
git add packages/builder-core/src packages/builder-core/tests/state-ownership.test.mjs
git commit -m "Add Egeria state ownership"
```

Stop for explicit user approval before Task 4.

## Task 4: Read-Only Repository Inference

**Files:**

- Create: `packages/builder-core/src/repository/repository-reader.ts`
- Create: `packages/builder-core/src/inference/evaluate-probe.ts`
- Create: `packages/builder-core/src/inference/infer-repository.ts`
- Create: `packages/builder-core/tests/inference.test.mjs`
- Modify: `packages/builder-core/src/index.ts`

**Interfaces:**

```ts
export type RepositoryReadResult =
  | Readonly<{ kind: "file"; content: string }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "symlink" }>
  | Readonly<{ kind: "error"; code: string }>;

export interface RepositoryReader {
  readText(path: string): Promise<RepositoryReadResult>;
}

export function createFileSystemRepositoryReader(root: string): RepositoryReader;
export function createInMemoryRepositoryReader(
  files: Readonly<Record<string, string>>,
): RepositoryReader;

export type EvidenceCategory =
  | "confirmed"
  | "probable"
  | "partial"
  | "contradictory"
  | "ambiguous";

export async function inferRepository(input: Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
}>): Promise<RepositoryInference>;
```

Category rules are exact:

- `confirmed`: state declares the capability and every required probe is present;
- `probable`: state does not declare it and every required probe is present;
- `partial`: at least one but not all required probes is present and state does not declare it;
- `contradictory`: state declares it while at least one required probe is missing or mismatched;
- `ambiguous`: a required path is a symlink, unreadable, invalid JSON, or otherwise cannot be classified safely.

`ambiguous` takes precedence whenever required evidence is not safely classifiable. Otherwise, a state-declared deterministic mismatch is `contradictory`. A capability with no state declaration and no present probe is omitted from capability evidence rather than mislabeled `partial`. No numeric confidence, majority threshold, or force option is permitted.

- [ ] **Step 1: Write inference tests**

Use the in-memory adapter for every category, the absent-capability case, and category precedence; use the filesystem adapter for containment, symlink, unreadable-path, and no-write checks. Assert deterministic capability/probe ordering, package version matching, JSON pointer matching, ownership fingerprint drift, and secrets/content absence from issue context.

- [ ] **Step 2: Run RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/inference.test.mjs
```

Expected: missing reader/inference exports.

- [ ] **Step 3: Implement the narrow read boundary**

Resolve every requested path against the fixed root, reject absolute/parent traversal before filesystem access, use `lstat` to surface symlinks without following them, cap each read at 1 MiB, and never enumerate unrelated repository files. Evaluate only catalog-declared probes and state-declared managed surfaces.

- [ ] **Step 4: Run GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/inference.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk git diff --check
```

- [ ] **Step 5: Commit and stop**

```bash
git add packages/builder-core/src packages/builder-core/tests/inference.test.mjs
git commit -m "Infer repository capabilities"
```

Stop for explicit user approval before Task 5.

## Task 5: Read-Only Doctor and Diff

**Files:**

- Create: `packages/builder-core/src/diagnostics/doctor.ts`
- Create: `packages/builder-core/src/diagnostics/diff-project.ts`
- Create: `packages/builder-core/tests/diagnostics.test.mjs`
- Modify: `packages/builder-core/src/index.ts`

**Interfaces:**

```ts
export type DiagnosticSeverity = "error" | "warning" | "info";

export type Diagnostic = Readonly<{
  code: string;
  severity: DiagnosticSeverity;
  capability?: string;
  path?: string;
  context: Readonly<Record<string, string>>;
}>;

export async function doctorRepository(input: Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>): Promise<Readonly<{ healthy: boolean; diagnostics: readonly Diagnostic[] }>>;

export type ProjectDifference = Readonly<{
  kind:
    | "desired-only"
    | "installed-only"
    | "inferred-only"
    | "inference-mismatch"
    | "managed-surface-drift";
  capability?: string;
  path?: string;
}>;

export async function diffProject(input: Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>): Promise<Readonly<{ equal: boolean; differences: readonly ProjectDifference[] }>>;
```

Doctor codes are exact: `PROJECT_INVALID`, `STATE_INVALID`, `MIGRATION_LOG_INVALID`, `BUILDER_VERSION_INCOMPATIBLE`, `PROJECT_CAPABILITY_UNKNOWN`, `STATE_CAPABILITY_UNKNOWN`, `DESIRED_INSTALLED_MISMATCH`, `INSTALLED_INFERENCE_CONTRADICTION`, `INFERENCE_AMBIGUOUS`, and `MANAGED_SURFACE_DRIFT`.

- [ ] **Step 1: Write diagnostic tests**

Cover a healthy portfolio, each stable code, severity, sorted output, desired/installed/inferred set differences, drifted surfaces, invalid files without exceptions, and identical before/after filesystem snapshots proving no writes.

- [ ] **Step 2: Run RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/diagnostics.test.mjs
```

- [ ] **Step 3: Implement composition only**

Compose the existing parsers, resolver, inference, and fingerprint results. Do not duplicate probe logic or create a second schema owner. Sort diagnostics by severity (`error`, `warning`, `info`), code, capability, then path; sort differences by kind, capability, then path.

- [ ] **Step 4: Run GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/diagnostics.test.mjs
rtk git diff --check
```

- [ ] **Step 5: Commit and stop**

```bash
git add packages/builder-core/src packages/builder-core/tests/diagnostics.test.mjs
git commit -m "Add read-only project diagnostics"
```

Stop for explicit user approval before Task 6.

## Task 6: Deterministic Portfolio and Site Rendering

**Files:**

- Create: `packages/builder-core/src/generation/template-catalog.ts`
- Create: `packages/builder-core/src/generation/render-template.ts`
- Create: `packages/builder-core/src/generation/render-skeleton.ts`
- Create: `packages/builder-core/templates/common/.gitignore.template`
- Create: `packages/builder-core/templates/common/.nvmrc`
- Create: `packages/builder-core/templates/common/AGENTS.md.template`
- Create: `packages/builder-core/templates/common/README.md.template`
- Create: `packages/builder-core/templates/common/package.json.template`
- Create: `packages/builder-core/templates/common/pnpm-workspace.yaml`
- Create: `packages/builder-core/templates/common/apps/web/AGENTS.md.template`
- Create: `packages/builder-core/templates/common/apps/web/package.json.template`
- Create: `packages/builder-core/templates/common/apps/web/tsconfig.json`
- Create: `packages/builder-core/templates/common/apps/web/eslint.config.mjs`
- Create: `packages/builder-core/templates/common/apps/web/next.config.ts`
- Create: `packages/builder-core/templates/common/apps/web/open-next.config.ts`
- Create: `packages/builder-core/templates/common/apps/web/wrangler.jsonc.template`
- Create: `packages/builder-core/templates/common/apps/web/app/globals.css`
- Create: `packages/builder-core/templates/common/apps/web/app/layout.tsx`
- Create: `packages/builder-core/templates/common/apps/web/app/page.tsx`
- Create: `packages/builder-core/templates/common/apps/web/src/content/content-schema.ts`
- Create: `packages/builder-core/templates/common/apps/web/src/content/read-content.ts`
- Create: `packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx`
- Create: `packages/builder-core/templates/common/apps/web/src/infrastructure/observability/installed-capability.ts`
- Create: `packages/builder-core/templates/portfolio/apps/web/content/en-CA/site.json.template`
- Create: `packages/builder-core/templates/site/apps/web/content/en-CA/site.json.template`
- Create: `packages/builder-core/templates/site/apps/web/content/en-CA/about.json.template`
- Create: `packages/builder-core/templates/site/apps/web/app/about/page.tsx`
- Create: `packages/builder-core/tests/render-skeleton.test.mjs`
- Modify: `packages/builder-core/src/index.ts`

**Interfaces:**

```ts
export type GenerationRequest = Readonly<{
  profile: "portfolio" | "site";
  projectName: string;
  displayName: string;
  packageVersions: CapabilityPackageVersions;
}>;

export type GeneratedFile = Readonly<{
  path: string;
  content: Uint8Array;
}>;

export type RenderedSkeleton = Readonly<{
  project: ProjectConfiguration;
  resolved: ResolvedCapabilities;
  files: readonly GeneratedFile[];
  surfaces: readonly ManagedSurfaceDescriptor[];
}>;

export async function renderSkeleton(
  request: GenerationRequest,
): Promise<ValidationResult<RenderedSkeleton>>;
```

Allowed template tokens are exactly `projectName`, `displayNameJson`, and `workerName`. Unknown, repeated-unresolved, or malformed tokens fail with `TEMPLATE_TOKEN_INVALID`; every destination path is validated and duplicate destinations fail with `TEMPLATE_DESTINATION_DUPLICATE`.

Generated `apps/web/package.json` pins the accepted exact proof versions. It declares standards and observability as ordinary exact stable versions supplied by `CapabilityPackageVersions` and never uses `workspace:`, `file:`, a Git source, URL source, range, or prerelease. Before the separate release prerequisite is complete, render tests use explicit synthetic `0.1.0` values only as in-memory contract data and do not write or claim an installable generated repository.

Generated visible copy exists only in JSON:

- portfolio `site.json`: localized metadata title/description, one home heading, one home summary, and an empty navigation array;
- site `site.json`: the same home fields plus localized Home/About navigation labels;
- site `about.json`: localized heading and summary.

Components parse content into typed data. `ContentPage` is pure and accepts `{ heading, summary, navigation }`; route modules perform content loading. No JSX literal is user-facing.

- [ ] **Step 1: Write render tests**

Assert exact sorted file sets for portfolio and site, byte-for-byte repeatability across two renders, no absolute/parent paths, one versus two routes, no `apps/jobs`/`packages`, no later capability/provider strings, no user-visible JSX literals, exact package pins, exact externalized copy files, profile materialization in project YAML, one ownership descriptor for every generated destination/JSON region, and capability-owned descriptors that match the relevant descriptor metadata.

- [ ] **Step 2: Run RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/render-skeleton.test.mjs
```

- [ ] **Step 3: Implement strict template rendering**

Use the checked-in files as data. Resolve the template root with `new URL("../../templates/", import.meta.url)` so both `src/generation` and `dist/generation` find the package-root templates. Do not generate executable TypeScript by assembling fragments. Render tokens only in `.template` inputs, strip that suffix at the destination, normalize line endings to LF, require one final newline for text files, sort output paths, and keep state files out of this renderer.

- [ ] **Step 4: Run GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/render-skeleton.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run lint
rtk git diff --check
```

- [ ] **Step 5: Commit and stop**

```bash
git add packages/builder-core/src packages/builder-core/templates packages/builder-core/tests/render-skeleton.test.mjs
git commit -m "Render P1 skeletons"
```

Stop for explicit user approval before Task 7.

## Separate Prerequisite Gate Before Task 7

Task 7 must not start under ordinary P1 plan approval. Obtain a separate explicit request that authorizes the exact public-package versioning/publication payload and destination after verifying npm-scope authority, repository licensing, credentials, exact tarballs, provenance support, and rollback/deprecation procedure. The expected initial public versions from the accepted pending minor Changeset are:

```text
@egeria-systems/standards@0.1.0
@egeria-systems/observability@0.1.0
registry: https://registry.npmjs.org/
access: public
provenance: enabled through the approved release authority
```

After separately authorized publication, verify both exact public manifests, tarball contents, integrity, provenance, fresh install, and current audit. Record that evidence in a separately scoped release record, re-freeze the P1 branch/base/lockfile, and amend this plan if either version differs from `0.1.0`. Publication remains an external action and is not included in any command below.

## Task 7: Atomic New-Directory Generation and Thin CLI

**Files:**

- Create: `packages/builder-core/src/catalog/verified-package-versions.ts`
- Create: `packages/builder-core/src/generation/verify-generated-project.ts`
- Create: `packages/builder-core/src/generation/write-generated-project.ts`
- Create: `packages/builder-core/tests/generate-project.test.mjs`
- Create: `apps/cli/src/arguments.ts`
- Create: `apps/cli/src/run-cli.ts`
- Create: `apps/cli/tests/cli.test.mjs`
- Modify: `packages/builder-core/src/index.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/tsconfig.json`
- Modify: `apps/cli/AGENTS.md`
- Modify: `apps/cli/README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type GeneratedProjectVerification = Readonly<{
  checks: readonly [
    "lockfile",
    "frozen-install",
    "lint",
    "typecheck",
    "next-build",
    "opennext-build",
  ];
}>;

export interface GeneratedProjectVerifier {
  prepareLockfile(root: string): Promise<ValidationResult<void>>;
  verifyInIsolatedCopy(root: string): Promise<ValidationResult<GeneratedProjectVerification>>;
}

export function createPnpmGeneratedProjectVerifier(input: Readonly<{
  pnpmExecutable: string;
}>): GeneratedProjectVerifier;

export async function generateProject(input: Readonly<{
  request: GenerationRequest;
  destination: string;
  verifier: GeneratedProjectVerifier;
}>): Promise<ValidationResult<Readonly<{
  destination: string;
  state: InstalledState;
}>>>;

export type CliOutput = Readonly<{
  write(value: string): void;
  writeError(value: string): void;
}>;

export async function runCli(
  arguments_: readonly string[],
  output: CliOutput,
): Promise<0 | 1 | 2>;
```

Commands are exact:

```text
egeria create --profile portfolio|site --name <lowercase-kebab> --display-name <text> --directory <new-path>
egeria infer --directory <project-root>
egeria doctor --directory <project-root>
egeria diff --directory <project-root>
```

All stdout/stderr values are one-line JSON with stable codes and data; the CLI contains no product copy or builder decision. Exit `0` means success/healthy/equal, `1` means diagnosed unhealthy/different or generation failure, and `2` means invalid command/arguments.

Generation order is exact:

1. validate request, require the exact separately verified `0.1.0` public-package catalog, and confirm the destination does not exist;
2. render all non-state files in memory;
3. create a random builder-owned sibling temporary directory;
4. write project YAML and rendered files using exclusive file creation; do not create installed state or the migration log yet;
5. prepare the normal public-registry `pnpm-lock.yaml` in the temporary source;
6. infer without state and require every resolved capability to be `probable`;
7. copy the exact temporary source to a second builder-owned validation directory, run frozen install, lint, typecheck, Next build, and OpenNext build there, then remove only that validation directory;
8. after successful transformation, verification, and pre-state inference, write the empty migration log, materialize all ownership records including `pnpm-lock.yaml` and the migration log, then write `state.json` last in the source temporary directory;
9. infer again and require every resolved capability to be `confirmed` with no surface drift;
10. rename the source temporary directory to the requested destination;
11. on failure, remove only the exact builder-created source/validation directories and leave the destination absent.

- [ ] **Step 1: Write filesystem and CLI tests**

Cover successful portfolio/site creation, exact verifier order, refusal to write migration/state records after lock/install/lint/type/build failure, state-last agreement, lockfile and empty-migration-log fingerprinting, existing destination refusal, symlink destination refusal, injected write failure cleanup, no Git invocation, exact command parsing, JSON output, exit codes, and read-only command before/after tree equality. Use a fake verifier for failure-order unit tests and the real pnpm verifier for one published-package integration test. Spawn `node apps/cli/dist/index.js` for one end-to-end CLI test after build.

- [ ] **Step 2: Run RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core --filter @egeria-systems/cli run build
rtk node --test packages/builder-core/tests/generate-project.test.mjs apps/cli/tests/cli.test.mjs
```

- [ ] **Step 3: Implement atomic generation**

Use `mkdtemp`, `mkdir`, `open` with exclusive creation, `writeFile`, `lstat`, `cp`, `rename`, and exact-path `rm` only for builder-owned temporary directories. The verifier uses `execFile` with argument arrays for the exact pnpm commands; it never invokes a shell, Git, npm publication, provider API, or deployment. Cap `displayName` at 120 Unicode code points and reject control characters. Generated build outputs and `node_modules` exist only in the validation copy and never enter the destination.

- [ ] **Step 4: Implement the CLI adapter**

Add `verified-package-versions.ts` with exact separately verified standards/observability `0.1.0` versions. Add `bin: { "egeria": "./dist/index.js" }`, runtime dependency `@egeria-systems/builder-core: "workspace:*"`, a Node shebang on the entry point, and package test/build scripts. `arguments.ts` owns only the `parseArgs` configuration; `run-cli.ts` maps inputs/outputs without reimplementing core validation and constructs the pnpm verifier with the approved executable.

- [ ] **Step 5: Run GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --lockfile-only
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core --filter @egeria-systems/cli run build
rtk node --test packages/builder-core/tests/generate-project.test.mjs apps/cli/tests/cli.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core --filter @egeria-systems/cli run lint
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core --filter @egeria-systems/cli run typecheck
rtk git diff --check
```

- [ ] **Step 6: Commit and stop**

```bash
git add package.json pnpm-lock.yaml apps/cli packages/builder-core/src packages/builder-core/tests/generate-project.test.mjs
git commit -m "Add P1 builder commands"
```

Stop for explicit user approval before Task 8.

## Task 8: Golden Fixtures, Build Harness, Documentation, and Implementation Review

**Files:**

- Create from exact portfolio CLI output: `fixtures/generated/portfolio/.gitignore`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/.nvmrc`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/AGENTS.md`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/README.md`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/package.json`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/pnpm-workspace.yaml`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/pnpm-lock.yaml`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/.egeria/project.yaml`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/.egeria/state.json`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/.egeria/migrations.jsonl`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/AGENTS.md`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/package.json`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/tsconfig.json`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/eslint.config.mjs`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/next.config.ts`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/open-next.config.ts`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/wrangler.jsonc`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/app/globals.css`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/app/layout.tsx`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/app/page.tsx`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/content/en-CA/site.json`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/src/content/content-schema.ts`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/src/content/read-content.ts`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/src/presentation/content-page.tsx`
- Create from exact portfolio CLI output: `fixtures/generated/portfolio/apps/web/src/infrastructure/observability/installed-capability.ts`
- Create from exact site CLI output: `fixtures/generated/site/.gitignore`
- Create from exact site CLI output: `fixtures/generated/site/.nvmrc`
- Create from exact site CLI output: `fixtures/generated/site/AGENTS.md`
- Create from exact site CLI output: `fixtures/generated/site/README.md`
- Create from exact site CLI output: `fixtures/generated/site/package.json`
- Create from exact site CLI output: `fixtures/generated/site/pnpm-workspace.yaml`
- Create from exact site CLI output: `fixtures/generated/site/pnpm-lock.yaml`
- Create from exact site CLI output: `fixtures/generated/site/.egeria/project.yaml`
- Create from exact site CLI output: `fixtures/generated/site/.egeria/state.json`
- Create from exact site CLI output: `fixtures/generated/site/.egeria/migrations.jsonl`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/AGENTS.md`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/package.json`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/tsconfig.json`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/eslint.config.mjs`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/next.config.ts`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/open-next.config.ts`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/wrangler.jsonc`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/app/globals.css`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/app/layout.tsx`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/app/page.tsx`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/app/about/page.tsx`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/content/en-CA/site.json`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/content/en-CA/about.json`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/src/content/content-schema.ts`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/src/content/read-content.ts`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/src/presentation/content-page.tsx`
- Create from exact site CLI output: `fixtures/generated/site/apps/web/src/infrastructure/observability/installed-capability.ts`
- Create: `tests/generated-fixtures/determinism.test.mjs`
- Create: `scripts/verify-generated-skeletons.mjs`
- Create: `docs/implementation-evidence/2026-08-05-p1-builder-kernel-verification.md`
- Modify: `package.json`
- Modify: `eslint.config.mjs`
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/architecture/package-ownership.md`
- Modify: `docs/roadmaps/program-roadmap.md`

**Interfaces:**

Root scripts become:

```json
{
  "test:builder-core": "pnpm --filter @egeria-systems/builder-core run build && node --test packages/builder-core/tests/*.test.mjs",
  "test:cli": "pnpm --filter @egeria-systems/cli run build && node --test apps/cli/tests/*.test.mjs",
  "test:generated-fixtures": "node --test tests/generated-fixtures/*.test.mjs",
  "verify:generated-skeletons": "node scripts/verify-generated-skeletons.mjs",
  "verify:builder-kernel": "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run test:builder-core && pnpm run test:cli && pnpm run test:generated-fixtures && pnpm run lint:builder && pnpm run build:builder && pnpm run typecheck:builder && pnpm run verify:generated-skeletons && pnpm run changeset:status"
}
```

The fixture verifier:

1. copies each committed golden fixture to an isolated temporary directory;
2. verifies the committed lockfile and exact standards/observability public-registry resolutions;
3. runs frozen install, lint, typecheck, Next build, and OpenNext Cloudflare build;
4. removes the temporary directory;
5. verifies that no override, tarball, `node_modules`, build output, or test artifact entered a committed fixture.

This is fresh public-registry and build evidence for the exact published package versions. It does not publish, deploy, mutate a provider, or prove production/runtime/accessibility behavior.

- [ ] **Step 1: Add fixture contract RED**

The determinism test runs the built CLI twice per profile, compares both outputs byte-for-byte, and compares them with committed fixtures. It requires the exact portable `pnpm-lock.yaml` and rejects local overrides, tarballs, `node_modules`, `.next`, `.open-next`, `.wrangler`, `dist`, provider secrets, or later-stage surfaces.

Run:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core --filter @egeria-systems/cli run build
rtk node --test tests/generated-fixtures/determinism.test.mjs
```

Expected RED: golden fixtures are absent.

- [ ] **Step 2: Generate golden fixtures once**

Use the built CLI into new temporary paths, inspect inference/doctor/diff, then move only the exact generated source/state into `fixtures/generated/portfolio` and `fixtures/generated/site`. Do not hand-edit golden output; repair templates/core and regenerate if the contract is wrong.

- [ ] **Step 3: Add and run the build harness**

Run:

```bash
rtk node --test tests/generated-fixtures/determinism.test.mjs
rtk node scripts/verify-generated-skeletons.mjs
```

Expected: deterministic fixtures pass; both temporary copies pass public-registry frozen install, lint, typecheck, Next build, and OpenNext build. No provider/deployment operation occurs; network access is limited to registry/advisory reads required by install and audit.

- [ ] **Step 4: Update canonical owners and contracts**

Update package ownership from P0.3 shells to the exact P1 APIs/consumers. Mark `INV-PROFILE-MATERIALIZATION` and `INV-CAPABILITY-METADATA` actual for the tested P1 subset. Mark the generated-repository part of `INV-CLOUDFLARE-ISOLATION` actual only for the generated skeleton lint/build fixtures. Leave clean isolated migration/state-update-order at P3 and accessibility automation at P2. Keep roadmap P1 “in review” until Gate 3 approval; do not mark it complete in the implementation candidate.

- [ ] **Step 5: Run the full relevant deterministic suite once**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm audit --audit-level=moderate
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm peers check
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:builder-kernel
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:compatibility-proof
rtk git diff --check 303ee9d35e19f9191948d994159f77c82c90a1ed...HEAD
rtk git status --short --branch
```

Record exact versions, counts, exit results, sandbox/runtime distinctions, published-package provenance, and unproved properties. Run the expensive P0.2 proof only once after all shared-tooling/template inputs settle; it does not deploy.

- [ ] **Step 6: Commit the coherent implementation candidate and stop**

```bash
git add AGENTS.md CONTRIBUTING.md README.md eslint.config.mjs package.json apps packages fixtures scripts tests docs/architecture docs/roadmaps/program-roadmap.md
git commit -m "Verify P1 builder kernel"
```

Present the implementation comparison and stop for user approval to begin independent review. Do not create the review packet before reviewer dispositions exist.

- [ ] **Step 7: Dispatch the three required read-only reviewers**

Provide each reviewer the frozen base, candidate HEAD, approved source, preparation evidence, plan, changed-file list, and exact verification output. Prohibit edits, recursive delegation, GitHub comments, and external action.

- Requirements reviewer: approved P1 scope, six-capability/profile limits, exact-file plan, state contracts, CLI behavior, generated skeleton acceptance, non-goals.
- Architecture/anti-overengineering reviewer: materialized recipes, hybrid ownership, Cloudflare isolation, package boundaries, no generic ports, state-last generation, stage discipline, low-churn design.
- Test-evidence reviewer: credible RED/GREEN record, schema/refinement coverage, deterministic inference/generation, no-write checks, atomic-failure tests, build harness authenticity, claim limits.

Use no specialist unless the final changed scope raises a material security, platform, accessibility, or supply-chain question the required reviewers cannot responsibly evaluate.

- [ ] **Step 8: Reconcile and repair only material findings**

Validate every finding against the shared final tree. Classify each as `material-kept`, `invalid`, `duplicate`, `deferred-by-scope`, or `low-value-churn`. Repair only current material defects, add a focused regression test, rerun the affected check, and make a focused repair commit. Do not repeat all three reviews against unchanged code; request only the bounded follow-up needed to close a retained finding.

- [ ] **Step 9: Re-run settled final verification**

After the last relevant input changes, run `verify:builder-kernel`, the affected compatibility proof if shared inputs changed after its prior run, audit, peers, range diff-check, final status, changed-file list, and commit range. Do not repeat a successful expensive check against an unchanged tested tree.

- [ ] **Step 10: Write the settled implementation verification evidence**

The verification record must include:

- frozen base/candidate and branch/ref freshness;
- changed files and focused commits;
- every RED/GREEN cycle;
- exact commands, versions, counts, and results;
- generated portfolio/site file lists and build results;
- manifest/inference agreement;
- reviewer reports and dispositions;
- security/advisory evidence;
- exact published-package versions, integrity/provenance evidence, portable lockfile resolutions, and fresh-install proof;
- risks, fragile assumptions, and deferred P2/P3/later-stage work;
- source/dependency/build-output recovery;
- explicit statement that no provider, persistent data, publication, deployment, push, or pull request occurred.

If the public-package prerequisite remains open, Tasks 7 and 8 must not begin and Task 9 must not produce a P1 Gate 3 packet claiming a filesystem-generation candidate or stop-gate completion.

- [ ] **Step 11: Commit Task 8 evidence and stop**

```bash
git add docs/implementation-evidence/2026-08-05-p1-builder-kernel-verification.md
git commit -m "Record P1 implementation verification"
```

Present the exact committed comparison and stop for explicit user approval before Task 9. Do not create the P1 review packet yet.

## Task 9: Deferred Schema Contract Review and Gate 3 Packet

**Files:**

- Modify: `docs/implementation-evidence/2026-08-05-p1-schema-contract-review-deferral.md`
- Modify: `docs/implementation-evidence/2026-08-05-p1-builder-kernel-verification.md`
- Create: `docs/review-packets/2026-08-05-p1-builder-kernel.md`

This task revisits the Task 1 schema questions only after Tasks 2 through 8 have supplied their real catalog, resolver, codec, ownership, inference, diagnostics, generation, CLI, and fixture consumers. The dated deferral record preserves the original direct field-purpose audit, the bounded material-code-simplification result, their differences, and the frozen evidence hashes. Those recorded observations are review inputs, not approved findings or pre-authorized edits.

- [ ] **Step 1: Re-freeze and trace every deferred question through final P1 consumers**

Verify the current branch, status, exact Task 1-to-final-P1 comparison, and all direct consumers before judging the recorded questions. Re-evaluate:

1. whether Task 1A's capability `version` release-version contract remained correct in actual P1 consumers;
2. whether constant migration `outcome` carries necessary persisted meaning;
3. whether constant verification `kind` carries necessary persisted meaning;
4. whether Task 1A's empty P1 `capabilitySettings` contract remained correct in actual P1 consumers;
5. whether `threatReviewLevel` has a sufficiently closed vocabulary;
6. whether surface target/merge validation has one canonical owner and represents only valid combinations;
7. whether path-only ejection identity can represent every managed surface safely; and
8. whether checked JSON Schema artifacts must enforce every runtime invariant or explicitly document a narrower static contract.

For each item, identify the canonical owner, actual callers, serialized compatibility boundary, tests, generated artifacts, and counterevidence. Do not assume the original direct recommendation or simplification disposition remains correct.

- [ ] **Step 2: Repeat the two review lenses against the final P1 tree**

Run a fresh field-by-field purpose audit and a bounded behavior-preserving simplification review over the final runtime schemas, direct consumers, contract tests, and generated artifacts. Keep the lenses separate: correctness, schema parity, or product-vocabulary questions must not be relabeled as simplifications, and an accepted contract must not be retained solely because it was accepted before its consumers existed.

Classify every deferred item exactly once as `retain-as-intentional`, `clarify-contract`, `tighten-validation`, `remove-as-redundant`, or `defer-with-owner`. Record evidence, counterevidence, compatibility impact, and confidence in the deferral record.

- [ ] **Step 3: Gate any resulting implementation separately**

If no source/schema/test change is supported, record that result and continue. If any change is supported, write an exact-file amendment under `docs/superpowers/plans/`, identify characterization and migration/compatibility evidence, and stop for explicit plan approval before editing code, schemas, generated artifacts, tests, or state formats. This Task 9 review does not itself authorize those edits.

After any separately approved repair, rerun only affected focused checks during the repair, request the bounded reviewer follow-up needed to close the retained finding, then run the settled final P1 verification once against the final tree.

- [ ] **Step 4: Finalize verification evidence and the P1 review packet**

The verification record and packet must include:

- frozen base/candidate and branch/ref freshness;
- changed files and focused commits;
- every RED/GREEN cycle;
- exact commands, versions, counts, and results;
- generated portfolio/site file lists and build results;
- manifest/inference agreement;
- required reviewer reports and dispositions;
- the eight deferred schema questions and their final evidence-backed dispositions;
- security/advisory evidence;
- exact published-package versions, integrity/provenance evidence, portable lockfile resolutions, and fresh-install proof;
- risks, fragile assumptions, and deferred P2/P3/later-stage work;
- source/dependency/build-output recovery; and
- explicit statement that no provider, persistent data, publication, deployment, push, or pull request occurred.

- [ ] **Step 5: Commit Gate 3 artifacts and stop**

```bash
git add docs/implementation-evidence/2026-08-05-p1-schema-contract-review-deferral.md docs/implementation-evidence/2026-08-05-p1-builder-kernel-verification.md docs/review-packets/2026-08-05-p1-builder-kernel.md
git commit -m "Record P1 verification and review"
```

Present the exact committed comparison and stop for verified-final-diff approval. Gate 3 approval does not authorize push, pull request, merge, npm versioning/publication, deployment, provider mutation, persistent-data action, permission change, or external message.

## Recovery

- Preparation-only recovery: remove the two uncommitted P1 planning documents only with explicit authorization.
- Source recovery after implementation: revert focused P1 commits newest-first; never reset shared `main`.
- Dependency recovery: the same reverts restore manifests and `pnpm-lock.yaml`; reinstall with the exact pinned pnpm. `node_modules`, `dist`, `.next`, `.open-next`, and `.wrangler` are generated, non-authoritative outputs.
- Generation failure recovery: core removes only its exact builder-owned temporary sibling and leaves the requested destination absent. Existing destinations are never touched.
- Generated fixture recovery: regenerate from the approved templates/core; do not hand-reconcile drift.
- Publication: the separately authorized prerequisite release owns its own deprecation/recovery record and is not represented as source rollback here.
- Provider/deployment/persistent data: none is authorized or created by this plan, so no external rollback is represented as source recovery.
