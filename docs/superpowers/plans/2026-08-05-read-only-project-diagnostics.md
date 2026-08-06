# Read-Only Project Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, content-safe, read-only doctor and diff APIs that compare desired, installed, and inferred P1 project state without changing a repository.

**Architecture:** One internal project-inspection boundary reads the three required `.egeria` control files through a per-operation caching `RepositoryReader`, composes the existing codecs, resolver, and inference result, and exposes no raw content. `doctorRepository` maps that inspection to stable diagnostics; `diffProject` maps it to explicit structural differences. Existing Zod schemas, inference rules, fingerprints, and filesystem containment remain canonical.

**Tech Stack:** Node.js 22.23.0, TypeScript 6.0.3, Zod 4.4.3, yaml 2.9.0, Node test runner, ESLint 10.8.0, pnpm 11.20.0.

**Preparation evidence:** [`docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-preparation.md`](../../implementation-evidence/2026-08-05-read-only-project-diagnostics-preparation.md)

## Global Constraints

- Implement only P1 Task 5. Do not add Task 6 generation, Task 7 CLI behavior, migrations, planning, transformations, providers, reports, `.egeria` writes, or later capabilities.
- Keep `packages/builder-core` private. Do not add a project-schema package or a dependency.
- Keep runtime Zod contracts and existing codecs canonical; do not hand-edit or regenerate unchanged JSON Schema artifacts.
- Read only `.egeria/project.yaml`, `.egeria/state.json`, `.egeria/migrations.jsonl`, catalog-declared probes, and valid-state managed surfaces.
- Use the existing `RepositoryReader`; no filesystem API may appear in diagnostic implementation files.
- Cache every path's `Promise<RepositoryReadResult>` once per doctor/diff operation so one operation never rereads a changing path.
- Return only stable codes, validated capability identifiers, validated paths, and fixed reason/category tokens. Never return source content, rejected values, parser prose, YAML excerpts, fingerprints, package values, secrets, or credentials.
- Sort diagnostics by severity (`error`, `warning`, `info`), code, capability, then path. Sort differences by kind, capability, then path.
- Set `healthy` and `equal` to `true` only when the corresponding output array is empty.
- Preserve qualitative inference categories. Do not add numeric confidence, majority thresholds, or a force option.
- No Node pin change belongs to this task. Node 22.23.2 security remediation requires a separately approved compatibility/security increment before P1 completion or release evidence.
- Use TDD: prove causal RED before source implementation, then run focused GREEN checks. Run the full relevant suite once after the coherent batch.
- Use `rtk` for every shell command and the exact pinned pnpm binary shown below.

---

## File Structure

### Planning and canonical boundary

- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md` — link the approved task-specific plan, list the shared internal reader/inspection files, and add the explicit invalid-control-file difference kind.
- Existing: `docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-preparation.md` — dated frozen-state and official-source evidence.
- Existing: `docs/superpowers/plans/2026-08-05-read-only-project-diagnostics.md` — this exact implementation owner.

### Runtime implementation

- Create: `packages/builder-core/src/repository/cache-reader.ts` — internal per-operation promise cache; no package-root export.
- Modify: `packages/builder-core/src/inference/infer-repository.ts` — consume the shared internal cache with no inference behavior change.
- Create: `packages/builder-core/src/diagnostics/project-inspection.ts` — fixed control-file reads, existing codec/resolver/inference composition, and internal typed evidence.
- Create: `packages/builder-core/src/diagnostics/doctor.ts` — public diagnostic types, stable policy mapping, ordering, and health result.
- Create: `packages/builder-core/src/diagnostics/diff-project.ts` — public difference types, explicit set/surface comparison, ordering, and equality result.
- Modify: `packages/builder-core/src/index.ts` — export only the approved doctor/diff public API; do not export internal cache or inspection helpers.

### Tests and direct owners

- Create: `packages/builder-core/tests/diagnostics.test.mjs` — causal API, policy, ordering, caching, content-safety, and filesystem no-write tests.
- Modify: `tests/package-boundaries/private-packages.test.mjs` — exact source allowlist and Task 5 boundary wording.
- Modify: `packages/builder-core/AGENTS.md` — make Task 5 diagnostics current and keep Task 6+ prohibited.
- Modify: `packages/builder-core/README.md` — document only the actual read-only doctor/diff API boundary and evidence limits.
- Modify: `docs/architecture/package-ownership.md` — extend the private package matrix through Task 5 without claiming CLI/generation behavior.
- Modify: `docs/architecture/enforcement-map.md` — mark only exercised read-only diagnostic agreement/drift policy actual.

### Verification and review gate

- Create: `docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-verification.md` — RED/GREEN, final checks, review dispositions, risks, and rollback.
- Create: `docs/review-packets/2026-08-05-read-only-project-diagnostics.md` — exact comparison, changed files, commands/results, reviewer dispositions, deferred work, and approval boundary.

---

## Public Interfaces and Exact Policy

```ts
export type DiagnosticSeverity = "error" | "warning" | "info";

export type Diagnostic = Readonly<{
  code:
    | "PROJECT_INVALID"
    | "STATE_INVALID"
    | "MIGRATION_LOG_INVALID"
    | "BUILDER_VERSION_INCOMPATIBLE"
    | "PROJECT_CAPABILITY_UNKNOWN"
    | "STATE_CAPABILITY_UNKNOWN"
    | "DESIRED_INSTALLED_MISMATCH"
    | "INSTALLED_INFERENCE_CONTRADICTION"
    | "INFERENCE_AMBIGUOUS"
    | "MANAGED_SURFACE_DRIFT";
  severity: DiagnosticSeverity;
  capability?: string;
  path?: string;
  context: Readonly<Record<string, string>>;
}>;

export async function doctorRepository(input: Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>): Promise<Readonly<{
  healthy: boolean;
  diagnostics: readonly Diagnostic[];
}>>;

export type ProjectDifference = Readonly<{
  kind:
    | "control-file-invalid"
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
}>): Promise<Readonly<{
  equal: boolean;
  differences: readonly ProjectDifference[];
}>>;
```

The exact diagnostic mapping is:

| Evidence | Code | Severity | Fields/context |
| --- | --- | --- | --- |
| project missing, symlinked, unreadable, oversized, invalid UTF-8, invalid YAML, or schema-invalid | `PROJECT_INVALID` | `error` | `path: ".egeria/project.yaml"`; fixed `reason` |
| project validation issue begins at `builderCompatibility` | `BUILDER_VERSION_INCOMPATIBLE` | `error` | project path; `reason: "project-builder-compatibility"` |
| state missing, symlinked, unreadable, oversized, invalid UTF-8, invalid JSON, or schema-invalid | `STATE_INVALID` | `error` | `path: ".egeria/state.json"`; fixed `reason` |
| state validation issue begins at `builderVersion` | `BUILDER_VERSION_INCOMPATIBLE` | `error` | state path; `reason: "state-builder-version"` |
| migration log missing, symlinked, unreadable, oversized, invalid UTF-8, invalid JSONL, or schema-invalid | `MIGRATION_LOG_INVALID` | `error` | `path: ".egeria/migrations.jsonl"`; fixed `reason` |
| desired project resolves an unknown selected capability | `PROJECT_CAPABILITY_UNKNOWN` | `error` | validated capability; project path; empty context |
| another desired-resolution contract failure | `PROJECT_INVALID` | `error` | project path; `reason: "desired-resolution"` |
| valid state names a capability absent from the supplied catalog | `STATE_CAPABILITY_UNKNOWN` | `error` | validated capability; state path; empty context |
| desired and installed sets differ | `DESIRED_INSTALLED_MISMATCH` | `error` | capability; `relation: "desired-only"` or `"installed-only"` |
| installed evidence is `contradictory` | `INSTALLED_INFERENCE_CONTRADICTION` | `error` | capability; fixed `category: "contradictory"` |
| evidence is `probable` or `partial` while state does not install it | `INSTALLED_INFERENCE_CONTRADICTION` | `warning` | capability; exact fixed category |
| capability or surface evidence is `ambiguous`, except missing descriptor handled above | `INFERENCE_AMBIGUOUS` | `warning` | capability/path where known; fixed safe reason/category |
| managed or merge-managed surface is `missing` or `drifted` | `MANAGED_SURFACE_DRIFT` | `warning` | capability/path where known; fixed `status` |

Control-file failures are reported independently and suppress derived set, inference, and surface policy that would require invalid evidence. When all three control files and resolution are valid, diagnostic collection proceeds in the table order and then applies the canonical sort. Application-owned, ejected, and confirmed surfaces are not diagnostics.

The exact difference mapping is:

| Evidence | Difference |
| --- | --- |
| each invalid required control file, or a valid project that cannot resolve under the supplied catalog/profile contract | `control-file-invalid` with its fixed path |
| desired capability absent from installed state | `desired-only` with capability |
| installed capability absent from desired resolution | `installed-only` with capability |
| `probable` or `partial` evidence for a capability absent from installed state | `inferred-only` with capability |
| `contradictory` or capability-level `ambiguous` evidence | `inference-mismatch` with capability |
| managed/merge-managed surface `missing`, `drifted`, or `ambiguous` | `managed-surface-drift` with path and owner capability where present |

When a control file is invalid, return only sorted `control-file-invalid` entries and do not fabricate capability differences. `equal` is exactly `differences.length === 0`.

---

### Task 1: Commit the Approved Planning Gate

**Files:**

- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`
- Add: `docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-preparation.md`
- Add: `docs/superpowers/plans/2026-08-05-read-only-project-diagnostics.md`

**Interfaces:**

- Consumes: user approval of this exact plan and the clean frozen Task 4 state.
- Produces: one committed, canonical Task 5 planning gate; no runtime behavior.

- [ ] **Step 1: Re-freeze the approved planning comparison**

Run:

```bash
rtk git branch --show-current
rtk git status --short --branch
rtk git rev-parse HEAD
rtk shasum -a 256 docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md docs/superpowers/plans/2026-08-05-p1-builder-kernel.md pnpm-lock.yaml
```

Expected: `main`; the two approved Task 5 planning files are untracked and the separately disclosed user-owned source-plan edit remains unstaged/excluded; `HEAD` and hashes either match the preparation record or are revalidated before proceeding. Stop if another change overlaps a Task 5 file.

- [ ] **Step 2: Amend only the umbrella Task 5 contract**

In `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`:

1. add `cache-reader.ts` and `project-inspection.ts` to Task 5's exact files;
2. narrow `Diagnostic.code` from `string` to the exact ten-code union already named by the umbrella plan;
3. add `control-file-invalid` to `ProjectDifference.kind`;
4. add `tests/package-boundaries/private-packages.test.mjs`, the four direct boundary-owner documents, verification evidence, and the Task 5 packet to Task 5's file list;
5. link this task-specific plan as the exact execution owner;
6. retain the stop before Task 6 and every external-action exclusion.

- [ ] **Step 3: Validate planning documents**

Run:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk git diff --check
rtk git diff -- docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-preparation.md docs/superpowers/plans/2026-08-05-read-only-project-diagnostics.md docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
```

Expected: constitution 13/13 passes; no whitespace errors; diff contains planning/evidence only.

- [ ] **Step 4: Commit the planning gate**

```bash
rtk git add docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-preparation.md docs/superpowers/plans/2026-08-05-read-only-project-diagnostics.md docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
rtk git commit -m "Plan read-only project diagnostics"
```

Expected: one focused documentation commit. The disclosed source-plan edit remains unstaged and absent from the commit; no Task 5 path remains dirty.

---

### Task 2: Write Causal Doctor and Diff Contract Tests

**Files:**

- Create: `packages/builder-core/tests/diagnostics.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

**Interfaces:**

- Consumes: current builder-core root exports, `createInMemoryRepositoryReader`, `createFileSystemRepositoryReader`, codecs, resolver, manifest projection, inference types, and the exact public interfaces above.
- Produces: failing executable contracts for the absent Task 5 exports/source files and exact Task 5 private boundary.

- [ ] **Step 1: Add deterministic fixture helpers**

Use a strict minimal valid `standards` descriptor and a `portfolio` recipe so policy tests are small. Keep one integration test that uses `createCapabilityCatalog({ standards: "1.2.3", observability: "4.5.6" })` and `profileRecipes` to protect real catalog composition.

The helper must build exact valid values with these shapes:

```js
function project(selectedCapabilities = ["standards"]) {
  return {
    schemaVersion: "1.0.0",
    builderCompatibility: "0.0.0",
    project: {
      name: "diagnostic-fixture",
      displayName: "Diagnostic Fixture",
      defaultLocale: "en-CA",
    },
    originProfile: "portfolio",
    recipeVersion: "0.1.0",
    platformAdapter: "cloudflare-workers",
    selectedCapabilities,
    capabilitySettings: {},
    ejectedAreas: [],
  };
}

function state(installedCapabilities, managedSurfaces = []) {
  return {
    schemaVersion: "1.0.0",
    builderVersion: "0.0.0",
    projectSchemaVersion: "1.0.0",
    origin: { profile: "portfolio", recipeVersion: "0.1.0" },
    installedCapabilities,
    appliedMigrations: [],
    managedSurfaces,
    ejections: [],
    compatibility: {
      node: "22.23.0",
      pnpm: "11.20.0",
      platformAdapter: "cloudflare-workers",
    },
    lastSuccessfulVerification: {
      kind: "generation",
      checks: [
        "contracts",
        "pre-state-inference",
        "lockfile",
        "frozen-install",
        "lint",
        "typecheck",
        "next-build",
        "opennext-build",
        "post-state-inference",
      ],
    },
  };
}

function controlFiles(projectValue, stateValue, migrationSource = "") {
  return {
    ".egeria/project.yaml": core.serializeProjectYaml(projectValue),
    ".egeria/state.json": core.serializeStateJson(stateValue),
    ".egeria/migrations.jsonl": migrationSource,
  };
}
```

The minimal descriptor copies the complete valid descriptor shape already exercised by `createDescriptor` in `packages/builder-core/tests/inference.test.mjs`, changes only the identifier/probes required by each diagnostic scenario, and uses one healthy file probe at `managed.txt`. Its healthy state installs the descriptor's exact manifest metadata and contains no managed surface; `managed.txt` is present. Separate surface tests add one valid managed `InstalledSurface` with a fingerprint from `fingerprintFileContent`.

The canonical portfolio integration fixture uses this exact probe/source map:

```js
const canonicalFiles = {
  "apps/web/package.json": `${JSON.stringify({
    dependencies: {
      "@egeria-systems/observability": "4.5.6",
      "@opennextjs/cloudflare": "1.20.2",
    },
    devDependencies: {
      "@egeria-systems/standards": "1.2.3",
      wrangler: "4.118.0",
    },
  }, null, 2)}\n`,
  "apps/web/tsconfig.json": "{}\n",
  "apps/web/eslint.config.mjs": "export default [];\n",
  "apps/web/content/en-CA/site.json": "{}\n",
  "apps/web/src/content/content-schema.ts": "export {};\n",
  "apps/web/src/content/read-content.ts": "export {};\n",
  "apps/web/app/page.tsx": "export default function Page() {}\n",
  "apps/web/src/presentation/content-page.tsx": "export {};\n",
  "apps/web/next.config.ts": "export default {};\n",
  "apps/web/open-next.config.ts": "export default {};\n",
  "apps/web/wrangler.jsonc": "{}\n",
  "apps/web/src/infrastructure/observability/installed-capability.ts":
    "export {};\n",
};
```

Resolve `portfolio`, create its installed manifest, flatten its managed-surface descriptors, and call `materializeInstalledSurfaces` with UTF-8 bytes from this same map before serializing state. This protects agreement across the real catalog, resolver, manifest, ownership, codecs, and inference without reproducing their algorithms in the diagnostic test.

- [ ] **Step 2: Add exact public API and type-declaration tests**

Assert that `doctorRepository` and `diffProject` are root functions. Compile a temporary TypeScript consumer against `dist/index.d.ts` that constructs every diagnostic severity and every difference kind, including `control-file-invalid`, and rejects an invented diagnostic code and difference kind under `@ts-expect-error`.

- [ ] **Step 3: Add doctor policy tests**

Add named tests for:

1. healthy minimal and canonical portfolio fixtures returning `{ healthy: true, diagnostics: [] }`;
2. each exact diagnostic code and severity from the mapping table;
3. project/state builder-version path mapping without echoing the incompatible value;
4. missing, symlink, read-error, and parser-invalid control files without exceptions;
5. desired-only and installed-only diagnostics;
6. probable, partial, contradictory, and ambiguous inference categories;
7. missing, drifted, ambiguous, application-owned, and ejected surfaces;
8. exact sorting independent of catalog, profile, state, and file insertion order;
9. no raw marker such as `private-token`, source excerpt, fingerprint, or rejected package value anywhere in `JSON.stringify(result)`.

- [ ] **Step 4: Add diff policy tests**

Cover each exact difference kind, invalid control-file short-circuiting, desired/installed/inferred set combinations, contradictory and ambiguous evidence, surface status mapping, duplicate suppression, sorted output, and `equal === (differences.length === 0)`.

- [ ] **Step 5: Add read-once and no-write tests**

Wrap an in-memory reader so `readText(path)` increments a per-path counter before delegation. Assert each path is read at most once in one doctor call and at most once in one diff call, including `.egeria/state.json` shared with inference.

Create a temporary filesystem fixture, recursively record path/type/content bytes before each API call, invoke through `createFileSystemRepositoryReader`, then record the same snapshot afterward and assert byte-for-byte equality. Clean only the exact test-created temporary root in test teardown.

- [ ] **Step 6: Update the exact private-package negative boundary**

Change the existing Task 4 source allowlist test to expect exactly:

```text
diagnostics/diff-project.ts
diagnostics/doctor.ts
diagnostics/project-inspection.ts
repository/cache-reader.ts
```

in addition to the current files. Rename the Task 4-specific test descriptions to Task 5 and assert direct owners describe read-only diagnostics while still forbidding generation, mutation, CLI, and provider behavior.

- [ ] **Step 7: Run RED and verify causality**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/diagnostics.test.mjs
rtk node --test tests/package-boundaries/private-packages.test.mjs
```

Expected: failures are limited to missing Task 5 exports, type declarations, source files, and boundary wording. Stop if existing Task 1–4 behavior fails.

---

### Task 3: Add One-Operation Cached Project Inspection

**Files:**

- Create: `packages/builder-core/src/repository/cache-reader.ts`
- Modify: `packages/builder-core/src/inference/infer-repository.ts`
- Create: `packages/builder-core/src/diagnostics/project-inspection.ts`

**Interfaces:**

- Consumes: `RepositoryReader`, `RepositoryReadResult`, existing codecs, `resolveCapabilities`, and `inferRepository`.
- Produces: internal `createCachingRepositoryReader` and `inspectProject`; neither is exported from the package root.

```ts
export function createCachingRepositoryReader(
  reader: RepositoryReader,
): RepositoryReader;

export type ControlFileEvidence<T> =
  | Readonly<{ kind: "valid"; value: T }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "invalid"; issues: readonly ContractIssue[] }>
  | Readonly<{ kind: "ambiguous"; code: string }>;

export type ProjectInspection = Readonly<{
  project: ControlFileEvidence<ProjectConfiguration>;
  migrations: ControlFileEvidence<readonly MigrationRecord[]>;
  inference: RepositoryInference;
  resolution?: ValidationResult<ResolvedCapabilities>;
}>;

export async function inspectProject(input: Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>): Promise<ProjectInspection>;
```

- [ ] **Step 1: Extract the existing promise cache without behavior change**

Move Task 4's `Map<string, Promise<RepositoryReadResult>>` behavior from `infer-repository.ts` to `repository/cache-reader.ts`. Import it back into inference. Do not root-export it and do not change inference ordering, categories, codes, or content.

- [ ] **Step 2: Read the two additional control files through the same cache**

`inspectProject` creates one cached reader, reads only `.egeria/project.yaml` and `.egeria/migrations.jsonl`, and passes that same cached reader to `inferRepository`. Map reader results as follows:

```text
file + successful codec -> valid
file + codec issues     -> invalid
missing                 -> missing
symlink                 -> ambiguous/PATH_SYMLINK
error                   -> ambiguous/existing stable reader code
```

If project evidence is valid, call `resolveCapabilities` with its `originProfile` and complete `selectedCapabilities`; otherwise leave `resolution` absent. Do not catch and normalize programming errors from trusted internal functions; repository input failures already use explicit results.

- [ ] **Step 3: Run the inspection/caching subset GREEN**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test --test-name-pattern='read-once|control file' packages/builder-core/tests/diagnostics.test.mjs
rtk node --test packages/builder-core/tests/inference.test.mjs
```

Expected: inspection/caching tests pass; all 17 current inference tests remain green.

---

### Task 4: Implement Stable Doctor Policy

**Files:**

- Create: `packages/builder-core/src/diagnostics/doctor.ts`
- Modify: `packages/builder-core/src/index.ts`

**Interfaces:**

- Consumes: `inspectProject` and the exact mapping table in this plan.
- Produces: `DiagnosticSeverity`, `Diagnostic`, and `doctorRepository` at the package root.

- [ ] **Step 1: Implement fixed control-file diagnostics**

Use fixed path constants and fixed reason tokens. For invalid codec issues, inspect only `issue.code` and the first structural path segment. Emit one deduplicated `BUILDER_VERSION_INCOMPATIBLE` when any issue begins at `builderCompatibility` or `builderVersion`. Emit one deduplicated `PROJECT_INVALID` or `STATE_INVALID` as well when the same file has any non-version issue. Never include a rejected value or full issue context.

- [ ] **Step 2: Implement desired/installed/inferred policy**

Proceed only when project, state, migration, and resolution evidence are valid. Build lexical identifier sets from resolved capabilities and installed state, map every mismatch/category using the exact table, and map a surface owner to `capability` only when `owner.kind === "capability"`.

For `CAPABILITY_DESCRIPTOR_MISSING`, emit only `STATE_CAPABILITY_UNKNOWN`: suppress a second ambiguity, desired/installed-mismatch, or contradiction diagnostic for that same unknown identifier. For ambiguous surface evidence emit only `INFERENCE_AMBIGUOUS`, not a speculative drift diagnostic.

- [ ] **Step 3: Sort, deduplicate, and derive health**

Use an explicit severity rank object, lexical comparison without locale dependence, and an exact composite key over severity/code/capability/path/context. Return immutable arrays by type and compute:

```ts
return {
  healthy: diagnostics.length === 0,
  diagnostics,
};
```

- [ ] **Step 4: Run doctor GREEN**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test --test-name-pattern='doctor|public API' packages/builder-core/tests/diagnostics.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
```

Expected: every doctor code/severity, sorting, type declaration, content-safety, and health assertion passes.

---

### Task 5: Implement Explicit Project Diff Policy

**Files:**

- Create: `packages/builder-core/src/diagnostics/diff-project.ts`
- Modify: `packages/builder-core/src/index.ts`

**Interfaces:**

- Consumes: `inspectProject` and the exact difference mapping table.
- Produces: `ProjectDifference` and `diffProject` at the package root.

- [ ] **Step 1: Implement invalid-control-file short-circuiting**

Collect one `control-file-invalid` entry for each non-valid project, state, or migration result. Treat unsuccessful project resolution as an invalid project control contract. Sort and return those entries without capability/surface derivation.

- [ ] **Step 2: Implement the three capability comparisons**

Compute desired and installed lexical sets. Add `desired-only` and `installed-only` by set subtraction. Add `inferred-only` only for `probable` or `partial` evidence absent from installed state. Add `inference-mismatch` for `contradictory` or capability-level `ambiguous` evidence.

- [ ] **Step 3: Implement managed-surface differences**

Ignore `confirmed`, `application-owned`, and `ejected`. Map `missing`, `drifted`, and `ambiguous` to `managed-surface-drift`; look up the valid installed surface by identifier/path to attach its capability owner without exposing fingerprints.

- [ ] **Step 4: Sort, deduplicate, and derive equality**

Use lexical kind/capability/path ordering and an exact composite key. Return:

```ts
return {
  equal: differences.length === 0,
  differences,
};
```

- [ ] **Step 5: Run complete focused GREEN**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/diagnostics.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk git diff --check
```

Expected: the entire diagnostics suite passes with no TypeScript or whitespace failure.

---

### Task 6: Update Direct Boundary Owners and Complete GREEN

**Files:**

- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/package-ownership.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

**Interfaces:**

- Consumes: settled Task 5 runtime API and exact file inventory.
- Produces: one coherent package/documentation boundary with no duplicated normative lifecycle.

- [ ] **Step 1: Advance the nested package boundary to Task 5**

State that Task 5 composes existing codecs, resolution, and inference into content-safe read-only diagnostics and differences. Preserve exact reader bounds and state that diagnostics neither authorize nor perform a repository change. Continue to prohibit planning, migration execution, transformation, generation, templates, CLI behavior, providers, recovery automation, and later capabilities.

- [ ] **Step 2: Update package ownership and enforcement claims narrowly**

Package ownership must list the two public functions/types and current direct consumers. Enforcement may mark desired/installed/inferred diagnostic agreement and drift reporting actual only for tested P1 read-only behavior. Keep clean isolated migrations/state-update ordering planned for P3 and generated-repository/build claims planned for Task 6+.

- [ ] **Step 3: Run direct-owner GREEN**

```bash
rtk node --test tests/package-boundaries/private-packages.test.mjs
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
```

Expected: package boundaries 22/22 and constitution 13/13 pass.

---

### Task 7: Verify and Commit the Immutable Task 5 Candidate

**Files:**

- All runtime, test, boundary, and architecture files named in Tasks 2–6.

**Interfaces:**

- Consumes: coherent unchanged GREEN tree.
- Produces: one frozen implementation candidate commit for independent review.

- [ ] **Step 1: Make the focused simplicity and DRY pass**

Confirm that:

1. no parser, resolver, inference, fingerprint, or filesystem logic was duplicated;
2. only the internal cache and inspection are shared abstractions;
3. every public field is exercised;
4. no warning/info prose or generic error hierarchy was added;
5. no source file or branch label uses a roadmap phase name;
6. every changed line traces to Task 5 or its direct owner/test.

- [ ] **Step 2: Run final deterministic verification once**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk git diff --check
rtk git status --short --branch
rtk git diff --name-status HEAD
```

Expected: builder-core build/schema check/all tests/typecheck/lint pass; package boundaries 22/22; constitution 13/13; only planned files changed.

Do not rerun the compatibility proof: Task 5 changes no root runtime pin, lockfile, Next/OpenNext/Cloudflare surface, generated application, workflow, or deployed behavior.

- [ ] **Step 3: Run explicit negative-scope searches**

```bash
rtk rg -n "writeFile|mkdir|rename|rm\(|execFile|spawn|child_process|PlatformService|ApplicationDatabase|apps/jobs|analytics|identity|payments" packages/builder-core/src/diagnostics packages/builder-core/src/repository/cache-reader.ts
rtk rg -n "private-token|source excerpt|fingerprint" packages/builder-core/tests/diagnostics.test.mjs
```

Expected: no write/process/generic-port/later-capability runtime match; sensitive markers appear only in negative assertions/fixtures.

- [ ] **Step 4: Commit the candidate**

```bash
rtk git add packages/builder-core/src/diagnostics packages/builder-core/src/repository/cache-reader.ts packages/builder-core/src/inference/infer-repository.ts packages/builder-core/src/index.ts packages/builder-core/tests/diagnostics.test.mjs packages/builder-core/AGENTS.md packages/builder-core/README.md docs/architecture/package-ownership.md docs/architecture/enforcement-map.md tests/package-boundaries/private-packages.test.mjs
rtk git commit -m "Add read-only project diagnostics"
```

Record the planning-gate base and candidate hashes immediately. Do not change the candidate before reviewer findings are validated.

---

### Task 8: Independent Review, Evidence-Backed Repair, and Task 5 Packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-verification.md`
- Create: `docs/review-packets/2026-08-05-read-only-project-diagnostics.md`
- Modify only if a validated finding requires it: files in the frozen Task 5 candidate.

**Interfaces:**

- Consumes: exact planning-gate base, immutable candidate hash, complete commands/results, this plan, and preparation evidence.
- Produces: independently reviewed settled comparison, verification evidence, and Task 5 approval packet.

- [ ] **Step 1: Dispatch four bounded read-only reviewers**

Use one reviewer for each non-overlapping scope:

1. requirements and exact Task 5 code/difference mapping;
2. architecture, canonical ownership, and anti-overengineering;
3. test evidence, RED causality, negative controls, and claim calibration;
4. input-format/security, content leakage, invalid-file behavior, caching coherence, and no-write proof.

Give every reviewer the exact base/candidate comparison, changed files, preparation evidence, this plan, relevant accepted ADRs, and command output. Prohibit edits, recursive delegation, external review, network/provider actions, GitHub comments, and conclusions outside the assigned lens.

- [ ] **Step 2: Validate and disposition every finding**

Check each finding against the current tree and canonical owners. Repair only still-valid material defects whose benefit exceeds churn. Convert a behavior defect to a focused failing regression test before changing implementation. Use a focused repair commit named for the actual fix, then request only the bounded follow-up needed to close that finding.

- [ ] **Step 3: Run affected checks after each repair, then one settled final suite**

During repair, run only the affected focused test/build/typecheck. After the final repair and without further source changes, run once:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk git diff --check
rtk git status --short --branch
```

- [ ] **Step 4: Write verification evidence and the review packet**

Record:

- exact planning base, initial candidate, repair commits, and settled comparison;
- changed files and why each changed;
- causal RED and focused/full GREEN commands with exit status/test counts;
- current advisory evidence and the separate Node 22.23.2 security-pin finding;
- every reviewer finding, current-tree validation, repair/skip reason, and follow-up result;
- no-write/content-safety evidence and its limits;
- risks, fragile assumptions, Task 6+ deferred work, and source/dependency/state/provider recovery domains;
- the exact approval boundary: Task 5 only, no Node pin update or external action.

- [ ] **Step 5: Commit gate artifacts and stop**

```bash
rtk git add docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-verification.md docs/review-packets/2026-08-05-read-only-project-diagnostics.md
rtk git commit -m "Record project diagnostics verification"
```

Present the exact committed comparison and stop for explicit verified-final-diff approval before Task 6. Do not push, create a pull request, publish, deploy, dispatch a workflow, mutate a provider, update the Node pin, or respond to review comments.

---

## Final Acceptance Checklist

- [ ] Healthy canonical and minimal portfolio fixtures return no diagnostics/differences.
- [ ] Every exact doctor code and difference kind has a causal positive and relevant negative control.
- [ ] Invalid required files return stable results without exceptions or raw content.
- [ ] Desired, installed, inferred, and managed-surface policy matches this plan exactly.
- [ ] Diagnostics/differences are deduplicated and deterministic across input order.
- [ ] Each path is read at most once per operation and filesystem snapshots prove no writes.
- [ ] Task 4 inference behavior remains unchanged.
- [ ] Private source inventory and direct boundary owners match Task 5 exactly.
- [ ] No dependency, manifest, lockfile, schema artifact, CLI, generator, provider, or later capability changed.
- [ ] Required independent reviewers have no unresolved material finding.
- [ ] Verification evidence and review packet state evidence limits and the separate Node security-pin risk.
- [ ] Work stops for explicit final-diff approval before Task 6.
