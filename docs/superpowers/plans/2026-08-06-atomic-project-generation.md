# Atomic Project Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create verified `portfolio` and `site` repositories in new directories, persist authoritative `.egeria` state only after successful verification/inference, and expose the four approved commands through a thin private CLI.

**Architecture:** Private `builder-core` composes the existing renderer, state codecs, ownership materializer, repository inference, and diagnostics. A narrow filesystem shell owns a builder-created sibling source directory and a second validation copy; a no-shell pnpm adapter produces the public lockfile and runs the exact generated checks. The CLI parses command-specific arguments and maps core values to stable one-line JSON without owning product or builder decisions.

**Tech Stack:** Node.js `22.23.2`, pnpm `11.20.0`, TypeScript `6.0.3`, Zod `4.4.3`, YAML `2.9.0`, Node test runner, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, ESLint `9.39.5` in generated applications and ESLint `10.8.0` for builder source.

## Global Constraints

- Design authority: [`2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`](../../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), accepted ADRs 0001 through 0011, and Task 7 in [`2026-08-05-p1-builder-kernel.md`](2026-08-05-p1-builder-kernel.md).
- Preparation and current-source evidence: [`2026-08-06-atomic-project-generation-preparation.md`](../../implementation-evidence/2026-08-06-atomic-project-generation-preparation.md).
- The exact Task 7 base is integrated `origin/main@ae8c2687ba1d21cc8b5aa16003edc8255409e75a`, checked out on `p1-task-7-atomic-generation` in `/private/tmp/egeria-scaffold-p1-task-7`.
- Preserve the primary checkout's user-owned unstaged root `AGENTS.md` edit and untracked planning artifacts. Do not edit, stage, commit, or overwrite them from this worktree.
- The four pre-execution gates below were revalidated as resolved on 2026-08-08. The user's Task 7 request preapproves non-blocking plan amendments and continuous execution through the implemented-task review packet.
- Runtime Zod contracts remain canonical; checked Draft 2020-12 artifacts are regenerated, never hand-edited.
- Executable profiles remain exactly `portfolio` and `site`; executable capabilities remain exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`.
- Generated repositories remain lightweight pnpm workspaces with only `apps/web`. Do not create `apps/jobs`, local `packages`, later profiles/capabilities, providers, databases, queues, email, forms, identity, payments, analytics, CMS, or invented CRUD.
- `generateProject` injects the exact separately released standards/observability versions. No CLI flag or caller value may select package sources or versions.
- All generated visible/translatable copy remains in validated `apps/web/content/en-CA/*.yaml`; presentation remains pure.
- Generated-project verification performs a public-registry lock, frozen install, lint, typecheck, Next build, and OpenNext build only. It never previews, invokes workerd, deploys, publishes, calls Git, or calls a provider.
- Every child process uses `execFile` with argument arrays and no shell. Child stdout/stderr, repository contents, environment secrets, package-manager credentials, and user-supplied values never enter contract issues or CLI failure output.
- State is written after successful transformation, generated verification, and pre-state inference; post-state inference runs after state; final destination materialization is last.
- `.egeria` contains exactly `project.yaml`, `state.json`, and an empty `migrations.jsonl`. Task 7 creates no report directory.
- Creation changes only a new destination. Existing-repository mutation, clean-Git enforcement, isolated client worktrees, migration execution, dry-run transformation planning, and recovery automation remain P3.
- Use the existing dedicated Task 7 branch and isolated worktree because the primary tree contains user-owned work and remains 19 commits behind the integrated remote-tracking base.
- Each task uses focused RED, minimum GREEN, proportional checks, and one focused commit. Continue through Tasks 1–5 under the user's preapproval, then stop at the Task 7 verified-final-diff review packet.
- No push, pull request, merge, publication, deployment, provider mutation, permission change, production action, external message, or review-comment response is authorized by plan approval.

## Pre-Execution Gates

The preparation record's 2026-08-08 revalidation resolves each gate for this execution:

1. **Task 6 and base — resolved:** integrated `origin/main@ae8c2687ba1d21cc8b5aa16003edc8255409e75a` contains the independently reviewed Task 6 result, semantic naming, Node update, and public-release source. The current explicit Task 7 request resolves stale historical packet wording that still said final approval was pending.
2. **Public release — resolved with approved exception:** `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.1.0` are public, signed, and integrity-bearing with the recorded Apache-2.0/repository metadata. The exact immutable bootstrap versions have the explicitly approved no-provenance exception; Task 7 must record that exception rather than claim provenance. The 24-hour `minimumReleaseAge` gate elapsed before this execution.
3. **Runtime security — resolved:** the integrated base and current runtime use Node `22.23.2`; current schemas, templates, manifests, proof records, and the compatibility packet agree.
4. **Destination race model — resolved:** the user's amendment preapproval accepts the documented cooperative-filesystem boundary. Initial and immediate pre-rename destination checks are enforced, but portable Node `rename` cannot prove atomic no-replace against a hostile actor creating the destination after the final check.

The execution controller re-ran `rtk git status --short --branch`, `rtk git log -8 --oneline --decorate`, `rtk git worktree list`, the exact public package/version checks, the current exact-version advisory queries, the frozen install, the builder-quality aggregate, and all 85 builder-core tests before Task 1. A newly failed gate stops execution; it is not bypassed with local tarballs, a `file:`/workspace source, a false provenance claim, an insecure Node pin, `--force`, or destination cleanup outside builder-owned identities.

## Exact File Map

### Private builder-core contracts and generation

- Create `packages/builder-core/src/catalog/verified-package-versions.ts` — immutable released package versions and validated catalog constructor.
- Create `packages/builder-core/src/generation/verify-generated-project.ts` — verifier contract and real no-shell pnpm/isolated-copy adapter.
- Create `packages/builder-core/src/generation/write-generated-project.ts` — new-destination orchestration, state materialization, inference gates, cleanup, and final rename.
- Create `packages/builder-core/tests/generate-project.test.mjs` — deterministic schema/catalog/filesystem/order/failure tests with a fake verifier.
- Create `packages/builder-core/tests/generate-project.integration.mjs` — explicit live public-registry generated install/build/advisory test; excluded from ordinary offline glob tests.
- Modify `packages/builder-core/src/contracts/project.ts` — exact 1–120 Unicode-code-point, non-control display-name contract.
- Regenerate `packages/builder-core/schemas/project.schema.json` — checked static contract from the runtime owner.
- Modify `packages/builder-core/tests/contracts.test.mjs` — runtime/static Unicode and control-character coverage.
- Modify `packages/builder-core/tests/resolution.test.mjs` — verified package catalog/version projection coverage.
- Modify `packages/builder-core/src/index.ts` — root-export only the approved Task 7 core interfaces/functions.
- Modify `packages/builder-core/package.json` — add the explicit live integration script without adding dependencies.
- Modify `packages/builder-core/AGENTS.md` and `packages/builder-core/README.md` — advance the private boundary through new-directory generation only.

### Thin private CLI

- Create `apps/cli/src/arguments.ts` — strict command-specific `parseArgs` contract.
- Create `apps/cli/src/run-cli.ts` — dependency construction and stable JSON/exit mapping.
- Replace `apps/cli/src/index.ts` — shebang entry point only.
- Create `apps/cli/tests/cli.test.mjs` — parser, JSON, exit, read-only, and built-entry tests.
- Modify `apps/cli/package.json` — private `bin`, runtime builder-core dependency, Node types, test script, and test-inclusive lint.
- Modify `apps/cli/tsconfig.json` — include Node types for the executable adapter.
- Modify `apps/cli/AGENTS.md` and `apps/cli/README.md` — advance the private command boundary through the four approved commands.

### Direct owners, manifests, and evidence

- Modify `package.json` — include deterministic CLI tests and one separately invoked live generated-project verification script.
- Modify `pnpm-lock.yaml` — record only the CLI workspace runtime dependency/Node type importer changes from the approved post-release base.
- Modify `tests/package-boundaries/private-packages.test.mjs` — exact private manifests/source allowlists/current boundary.
- Modify `tests/package-boundaries/internal-linting.test.mjs` — exact CLI source/test lint command.
- Modify `tests/package-boundaries/release-safeguards.test.mjs` — exact deterministic root test/verification aggregates.
- Modify `docs/architecture/package-ownership.md` — current CLI/builder-core APIs, dependencies, and publication boundary.
- Modify `docs/architecture/enforcement-map.md` — actual new-generation state/inference/build gates while preserving planned P3 transformation gates.
- Modify `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md` — name this file as Task 7 execution owner and record the approved interface/file-map corrections.
- Create `docs/implementation-evidence/2026-08-06-atomic-project-generation-verification.md` — settled RED/GREEN, live public graph, review, and final command evidence.
- Create `docs/review-packets/2026-08-06-p1-task-7-atomic-project-generation.md` — exact comparison, changed files, dispositions, risks, deferred work, and recovery.

Do not edit templates, the six-capability descriptor matrix, profile recipes, proof source, public package contents, Changesets, publication workflow, root `AGENTS.md`, or any `.egeria` directory in this builder repository unless a causal Task 7 test demonstrates a current contradiction and the plan is amended before the edit.

---

### Task 1: Verified package catalog and generation input contract

**Files:**

- Create: `packages/builder-core/src/catalog/verified-package-versions.ts`
- Modify: `packages/builder-core/src/contracts/project.ts`
- Regenerate: `packages/builder-core/schemas/project.schema.json`
- Modify: `packages/builder-core/src/index.ts`
- Modify: `packages/builder-core/tests/contracts.test.mjs`
- Modify: `packages/builder-core/tests/resolution.test.mjs`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

**Interfaces:**

```ts
export const verifiedCapabilityPackageVersions: Readonly<{
  standards: "0.1.0";
  observability: "0.1.0";
}>;

export function createVerifiedCapabilityCatalog(): ValidationResult<
  readonly CapabilityDescriptor[]
>;
```

- [ ] **Step 1: Write the Unicode/display-name RED tests**

Add one focused contract test that validates a complete project object with these exact cases:

```js
const acceptedDisplayNames = [
  "Sample Portfolio",
  "Égeria Studio",
  "👩‍💻 Studio",
  "😀".repeat(120),
];

const rejectedDisplayNames = [
  "",
  " ".repeat(4),
  "😀".repeat(121),
  "Line one\nLine two",
  "unsafe\u0000name",
  "next\u0085line",
];
```

For every accepted value, assert runtime validation succeeds. For every rejected value, assert failure at `project.displayName` with no input value in serialized issues. Assert the regenerated project JSON Schema carries the same regular-expression source as the runtime schema, construct `new RegExp(artifactPattern, "u")`, and apply the same vectors. Do not add a JSON Schema validator dependency for this bounded parity check.

- [ ] **Step 2: Write the verified catalog RED tests**

In `resolution.test.mjs`, assert the new root exports exist, the versions object is frozen, both values are exact `0.1.0`, mutation does not change them, and `createVerifiedCapabilityCatalog()` returns the existing six descriptors with exact standards/observability package probes. Assert no `workspace:`, `file:`, Git, URL, range, tag, or prerelease value appears.

- [ ] **Step 3: Run RED**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/resolution.test.mjs
```

Expected RED: 120 astral code points are rejected by the current UTF-16-unit `.max(120)` contract, embedded controls are accepted, and the verified package catalog exports do not exist. Existing unrelated tests remain green.

- [ ] **Step 4: Implement the minimum runtime/static contract**

Replace the current `min/max/\S` display-name chain with one Unicode-mode regular expression whose quantifier counts code points and whose character class rejects Unicode `Cc` control values. Do not reject `Cf` format characters wholesale: zero-width joiners are valid parts of common emoji sequences, and Task 7 approves control rejection rather than a broader Unicode-format policy.

```ts
const displayNameSchema = z.string().regex(
  /^(?=.{1,120}$)(?=.*\S)[^\p{Cc}]+$/u,
);
```

Use this schema only at `project.displayName`. Do not normalize, transliterate, truncate, or echo the supplied name. Regenerate artifacts with the canonical generator:

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run schema:generate
```

Create the verified catalog module as an immutable exact-value adapter over `createCapabilityCatalog`; do not duplicate descriptors or resolver rules:

```ts
export const verifiedCapabilityPackageVersions = Object.freeze({
  standards: "0.1.0",
  observability: "0.1.0",
} as const);

export function createVerifiedCapabilityCatalog() {
  return createCapabilityCatalog(verifiedCapabilityPackageVersions);
}
```

Root-export the constant/function. Update only the exact private source allowlist and manifest expectation needed for this new module.

- [ ] **Step 5: Run GREEN and schema currency**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/resolution.test.mjs
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run schema:check
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run check:semantic-naming
rtk git diff --check
```

Expected GREEN: runtime and checked static schema accept 120 Unicode code points and a zero-width-joiner emoji name, reject 121/control input, preserve exact immutable public versions, leave the six descriptors unchanged, and pass semantic naming.

- [ ] **Step 6: Commit and stop**

Stage only the seven Task 1 files, inspect `git diff --cached --check` and `git diff --cached --name-status`, then commit:

```bash
git commit -m "Bind verified generation package versions"
```

Proceed to Task 2 under the user's current Task 7 plan-amendment preapproval.

---

### Task 2: State-last new-directory generation with an injected verifier

**Files:**

- Create: `packages/builder-core/src/generation/verify-generated-project.ts` (contract/types only in this task)
- Create: `packages/builder-core/src/generation/write-generated-project.ts`
- Create: `packages/builder-core/tests/generate-project.test.mjs`
- Modify: `packages/builder-core/src/index.ts`
- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/package-ownership.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

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
  verifyInIsolatedCopy(
    root: string,
  ): Promise<ValidationResult<GeneratedProjectVerification>>;
}

export type ProjectGenerationRequest = Omit<
  GenerationRequest,
  "packageVersions"
>;

export type GeneratedProject = Readonly<{
  destination: string;
  state: InstalledState;
}>;

export async function generateProject(input: Readonly<{
  request: ProjectGenerationRequest;
  destination: string;
  verifier: GeneratedProjectVerifier;
}>): Promise<ValidationResult<GeneratedProject>>;
```

`GeneratedProjectVerifier` is effectful but contains no catalog/state decisions. `generateProject` is the sole orchestration owner and injects `verifiedCapabilityPackageVersions` into `renderSkeleton`.

- [ ] **Step 1: Write the filesystem/order RED suite with a fake verifier**

Create builder-owned test roots with `mkdtemp(join(tmpdir(), "egeria-generation-test-"))` and clean only that exact root in `finally`. The fake verifier must record calls and assert source state at each boundary:

```js
const calls = [];
const verifier = {
  async prepareLockfile(root) {
    calls.push("prepare-lockfile");
    assert.equal(await exists(join(root, ".egeria/state.json")), false);
    assert.equal(await exists(join(root, ".egeria/migrations.jsonl")), false);
    await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    return { ok: true, value: undefined };
  },
  async verifyInIsolatedCopy(root) {
    calls.push("verify-isolated-copy");
    assert.equal(await exists(join(root, ".egeria/state.json")), false);
    assert.equal(await exists(join(root, ".egeria/migrations.jsonl")), false);
    return {
      ok: true,
      value: {
        checks: [
          "lockfile",
          "frozen-install",
          "lint",
          "typecheck",
          "next-build",
          "opennext-build",
        ],
      },
    };
  },
};
```

Cover all of these exact behaviors:

- successful portfolio and site output, exact 25/27 final paths (21/23 rendered files plus project YAML, lockfile, empty migration log, and state);
- request versions cannot be supplied and exact public versions appear in manifest probes/state;
- calls are exactly `prepare-lockfile`, then `verify-isolated-copy`;
- pre-state inference sees every resolved capability as `probable` and no installed state;
- state contains exact installed manifest, three new builder-owned surfaces, exact 43/45 total installed surfaces, empty migrations/ejections, and the complete nine-check receipt;
- `project.yaml`, `pnpm-lock.yaml`, and the zero-byte migration log fingerprints agree with final bytes;
- post-state inference has valid state, every resolved capability `confirmed`, and only `confirmed` or `application-owned` surfaces;
- destination contains no `node_modules`, `.next`, `.open-next`, `.wrangler`, `.pnpm-store`, or validation directory;
- existing file, existing empty/non-empty directory, and existing symlink destinations return `DESTINATION_EXISTS` without mutation;
- missing/non-directory destination parent returns `DESTINATION_PARENT_INVALID`;
- a fake verifier failure at lockfile preparation or generated verification leaves migration/state unwritten and destination absent;
- a fake verifier that creates `.egeria/state.json` before the real exclusive state write causes `STATE_WRITE_FAILED` and cleans only the source temp;
- a fake verifier that creates the requested destination during verification causes `DESTINATION_EXISTS`, preserves the independently created destination, and cleans only the source temp;
- a fake verifier that deletes/replaces the source temporary directory causes `TEMPORARY_DIRECTORY_AMBIGUOUS` and no broad cleanup;
- source code imports no shell/Git/deployment/provider API and never accepts `force`/overwrite behavior.

- [ ] **Step 2: Run RED**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/generate-project.test.mjs
```

Expected RED: the verifier contract, `generateProject`, new error codes, filesystem behavior, installed state, and root exports are absent. Task 1 tests stay green.

- [ ] **Step 3: Implement safe source-temporary writes**

Resolve the requested destination to an absolute leaf under an existing canonical parent. Reject root/empty leaf and any destination for which `lstat` does not return `ENOENT`. Create the source with:

```ts
const sourceRoot = await mkdtemp(
  join(canonicalParent, ".egeria-create-"),
);
```

Record its `dev`/`ino` identity. Before any recursive cleanup, `lstat` the exact path and require that identity; if it differs, return `TEMPORARY_DIRECTORY_AMBIGUOUS` and do not delete. The directory is builder-owned and mode-protected; create only directory parents derived from already validated rendered destinations.

Write every file with `open(path, "wx")`, `FileHandle.writeFile`, and an explicit `close` in `finally`. Never use access-then-write, `writeFile` truncation, a shell, or a caller-supplied path below the source root.

- [ ] **Step 4: Implement exact orchestration and state construction**

The function body must preserve this observable order:

```text
validate request and exact verified catalog
require destination absent
renderSkeleton in memory
create source temp
write .egeria/project.yaml and all rendered files exclusively
verifier.prepareLockfile
require exactly one new regular pnpm-lock.yaml and no source mutation
infer without state; require exact resolved set probable
verifier.verifyInIsolatedCopy
write zero-byte .egeria/migrations.jsonl exclusively
materialize rendered + project + lockfile + migration surfaces
validate and serialize InstalledState
write .egeria/state.json exclusively and last
infer with state; require exact resolved set confirmed and no managed drift
recheck source identity and destination absence
rename source temp once to destination
```

Use these new semantic builder-owned descriptors:

```ts
[
  {
    identifier: "builder-project-configuration",
    path: ".egeria/project.yaml",
    ownership: "managed",
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  },
  {
    identifier: "builder-dependency-lockfile",
    path: "pnpm-lock.yaml",
    ownership: "managed",
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  },
  {
    identifier: "builder-migration-log",
    path: ".egeria/migrations.jsonl",
    ownership: "managed",
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  },
]
```

Each owner is `{ kind: "builder-kernel" }`. Construct state through existing manifest/validation owners with exact post-pin compatibility values, empty `appliedMigrations`/`ejections`, and the nine-check tuple. Do not create a self-referential state surface.

Return stable content-free issues only. If the operation fails and identity-checked cleanup also fails, preserve the original issue and append one `CLEANUP_FAILED` issue; never replace the original cause or remove an unowned path.

- [ ] **Step 5: Update direct owners and Task 7 source map**

Advance builder-core instructions/README and package ownership to describe only new-directory generation, verified public versions, state-last behavior, and the injected verifier. Update the enforcement map from planned to actual only for new-generation manifest/inference/build agreement; retain P3 clean-Git, existing-repository transformation, migration, recovery, and final-diff automation as planned.

Amend the master P1 Task 7 section to link this plan and record:

- `ProjectGenerationRequest` excludes caller package versions;
- project display names use Unicode code points/control rejection;
- the three direct-owner/test files added by current enforcement;
- the live integration test is explicit, not part of the offline glob; and
- the portable `rename` race claim limit.

- [ ] **Step 6: Run GREEN**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/generate-project.test.mjs
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run lint
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run check:semantic-naming
rtk git diff --check
```

Expected GREEN: all fake-verifier success/failure/order/state/cleanup cases pass; exact direct owners accept the new boundary; no live registry/build command has run yet.

- [ ] **Step 7: Commit and stop**

Stage only Task 2 files, inspect the staged name/status and whitespace diff, then commit:

```bash
git commit -m "Generate verified project state"
```

Proceed to Task 3 under the user's current Task 7 plan-amendment preapproval.

---

### Task 3: Real pnpm verifier and public generated-project integration

**Live-build amendment (2026-08-08):** The first authorized public integration run reached the generated Next build and failed with `NEXT_BUILD_FAILED`. A disposable reproduction established that Next 16.3/Turbopack transforms the module-relative content `URL` into a value rejected by both Node `readFileSync` and `fileURLToPath`. This task therefore also modifies `packages/builder-core/templates/common/apps/web/src/content/read-content.ts`, `packages/builder-core/templates/site/apps/web/app/about/page.tsx`, and `packages/builder-core/tests/render-skeleton.test.mjs` to use and enforce web-workspace string paths. The same live Next and OpenNext gate must pass after this evidence-backed repair.

**Files:**

- Modify: `packages/builder-core/src/generation/verify-generated-project.ts`
- Create: `packages/builder-core/tests/generate-project.integration.mjs`
- Modify: `packages/builder-core/package.json`
- Modify: `package.json`
- Modify: `tests/package-boundaries/private-packages.test.mjs`

**Additional interface:**

```ts
export function createPnpmGeneratedProjectVerifier(input: Readonly<{
  pnpmExecutable: string;
}>): GeneratedProjectVerifier;
```

The constructor accepts an executable path/name, validates that its reported version is exactly `11.20.0`, and never invokes Corepack, npm publication, Git, preview, Wrangler deploy, or a shell.

- [ ] **Step 1: Write fake-executable verifier RED tests**

Extend `generate-project.test.mjs` with a builder-owned executable fixture that records argument arrays and current working directories without executing pnpm. Cover:

- exact version check before each operation;
- lock preparation command uses `install --lockfile-only --ignore-scripts`, exact public registry, and a builder-owned external store/home;
- lock preparation accepts exactly one new `pnpm-lock.yaml`, rejects modifications to either manifest or any rendered byte, and rejects symlink/non-regular lockfiles;
- validation uses a second unique copy and runs exact order `install --frozen-lockfile`, `run lint`, `run typecheck`, `run build`, `run build:cloudflare`;
- no command contains `preview`, `deploy`, `upload`, `wrangler`, `git`, `npm publish`, `--force`, `--update-checksums`, a shell metacharacter, or user text;
- child environment contains only the explicit platform/process allowlist, a temporary empty home/user config, `CI=true`, and public registry; sentinel `TOKEN`, `SECRET`, `PASSWORD`, `NPM_TOKEN`, and arbitrary inherited keys are absent;
- nonzero/timeout/output-overflow failures map to `PNPM_VERSION_INVALID`, `LOCKFILE_PREPARATION_FAILED`, `FROZEN_INSTALL_FAILED`, `LINT_FAILED`, `TYPECHECK_FAILED`, `NEXT_BUILD_FAILED`, or `OPENNEXT_BUILD_FAILED` without stdout/stderr;
- validation/support directories are identity-checked and removed on every success/failure; source and destination are never removed by the verifier.

- [ ] **Step 2: Run verifier RED**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/generate-project.test.mjs
```

Expected RED: the real constructor and command/security/cleanup behavior are absent while Task 2 fake-verifier cases remain green.

- [ ] **Step 3: Implement the real verifier**

Use `promisify(execFile)` with `shell: false`, `maxBuffer: 1024 * 1024`, `windowsHide: true`, a 30-second version timeout, and a 15-minute timeout for lock/install/check commands. Do not return or log child output. Use a purpose-specific helper that maps each check to one stable code.

Construct child environments from an empty object. Copy only the current case-insensitive `PATH` value into canonical `PATH` plus `SystemRoot`, `ComSpec`, `PATHEXT`, and `LANG` when present. Set `CI=true`; set `HOME`, `USERPROFILE`, `TMPDIR`, `TMP`, and `TEMP` to builder-owned support paths; and set only `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/` plus `NPM_CONFIG_USERCONFIG` to `join(supportRoot, ".npmrc")`. Create that user-config file empty and exclusively. Do not inherit `NODE_OPTIONS`, proxy variables, npm tokens/config, arbitrary process variables, or any key whose name contains token/secret/key/password/auth/credential.

For lock preparation, create an identity-recorded sibling support directory containing an empty home, empty npm user config, and pnpm store. Run in the source root:

```text
pnpm --version
pnpm install --lockfile-only --ignore-scripts --store-dir supportStorePath
```

Pass the final argument as the absolute value of `supportStorePath`; the text above names the variable and is not a literal command line. After success, compare exact file hashes/inventory against the pre-command snapshot and accept only a new regular `pnpm-lock.yaml`. Clean the support root before returning.

For validation, create an identity-recorded sibling directory, recursively copy the source with `force: false`, `errorOnExist: true`, and no symlink dereference, then create the temporary home/store inside that validation owner. Run:

```text
pnpm --version
pnpm install --frozen-lockfile --store-dir validationStorePath
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run build:cloudflare
```

Pass `validationStorePath` as its absolute value, not as the literal text shown. Return the exact six-check tuple and clean the complete validation owner in `finally`. If cleanup fails, return `VALIDATION_CLEANUP_FAILED` even after successful commands; generated state must not be written from an unclosed verification boundary.

- [ ] **Step 4: Add the explicit live public integration test**

The integration test is named `generate-project.integration.mjs` so ordinary `tests/*.test.mjs` remains deterministic/offline. It must:

1. query the exact public standards/observability manifests and assert `0.1.0`, integrity, repository/license, and provenance evidence match the separate release record;
2. create one portfolio and one site under a builder-owned temporary parent with the real verifier and exact pnpm executable;
3. assert the delivered repositories have public integrity-bearing lockfiles, exact file/state counts, no install/build outputs, and confirmed post-state inference;
4. run a fresh frozen install plus `pnpm audit --audit-level moderate` against the public generated graph in a test-owned validation copy;
5. assert no moderate-or-higher advisory and no package-signature/provenance mismatch for the two released Egeria packages; and
6. remove only the test-owned temporary parent in `finally`.

The test does not deploy, preview, use workerd, initialize Git, or keep a fixture; Task 8 owns golden fixtures.

Add explicit scripts:

```json
{
  "packages/builder-core/package.json": {
    "scripts": {
      "test:generated-project": "node --test tests/generate-project.integration.mjs"
    }
  },
  "package.json": {
    "scripts": {
      "test:generated-project": "pnpm --filter @egeria-systems/builder-core run build && pnpm --filter @egeria-systems/builder-core run test:generated-project"
    }
  }
}
```

- [ ] **Step 5: Run deterministic GREEN, then one authorized live GREEN**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/generate-project.test.mjs
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run lint
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:generated-project
rtk git diff --check
```

The final command is explicit public npm/advisory/signature egress and may run only after approval and the release gate. Expected GREEN: both generated profiles install/build from public packages, the generated public graph has no moderate-or-higher known advisory at execution time, state/inference agree, and no generated build output enters either delivered destination.

- [ ] **Step 6: Commit and stop**

Stage only Task 3 files, inspect the staged diff, then commit:

```bash
git commit -m "Verify generated projects"
```

Record the live command timestamp, exact package integrities, lockfile hashes, and result immediately. Proceed to Task 4 under the user's current Task 7 plan-amendment preapproval.

---

### Task 4: Thin four-command CLI

**Files:**

- Create: `apps/cli/src/arguments.ts`
- Create: `apps/cli/src/run-cli.ts`
- Replace: `apps/cli/src/index.ts`
- Create: `apps/cli/tests/cli.test.mjs`
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/tsconfig.json`
- Modify: `apps/cli/AGENTS.md`
- Modify: `apps/cli/README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tests/package-boundaries/private-packages.test.mjs`
- Modify: `tests/package-boundaries/internal-linting.test.mjs`
- Modify: `tests/package-boundaries/release-safeguards.test.mjs`
- Modify: `docs/architecture/package-ownership.md`

**Interfaces:**

```ts
export type CliCommand =
  | Readonly<{
      kind: "create";
      profile: "portfolio" | "site";
      projectName: string;
      displayName: string;
      directory: string;
    }>
  | Readonly<{ kind: "infer" | "doctor" | "diff"; directory: string }>;

export function parseCliArguments(
  arguments_: readonly string[],
): ValidationResult<CliCommand>;

export type CliOutput = Readonly<{
  write(value: string): void;
  writeError(value: string): void;
}>;

export async function runCli(
  arguments_: readonly string[],
  output: CliOutput,
): Promise<0 | 1 | 2>;
```

The executable commands remain exact:

```text
egeria create --profile portfolio|site --name <lowercase-kebab> --display-name <text> --directory <new-path>
egeria infer --directory <project-root>
egeria doctor --directory <project-root>
egeria diff --directory <project-root>
```

- [ ] **Step 1: Write parser/output/exit RED tests**

Test command parsing with strict per-command options, no abbreviations, no unknown/repeated options, no extra positionals, and no cross-command flags. Invalid input returns only `CLI_ARGUMENT_INVALID` at exit `2`; it never includes Node parser exception text or the rejected argument.

Test exact one-line JSON shapes:

```json
{"ok":true,"command":"create","destination":"/private/tmp/acme-portfolio","profile":"portfolio","capabilities":["standards","content-files","section-composition","deployment-cloudflare","observability"]}
{"ok":true,"command":"infer","result":{"state":{"kind":"missing"},"capabilities":[],"surfaces":[]}}
{"ok":true,"command":"doctor","result":{"healthy":true,"diagnostics":[]}}
{"ok":true,"command":"diff","result":{"equal":true,"differences":[]}}
{"ok":false,"code":"CLI_ARGUMENT_INVALID"}
```

The infer example above is shape-only; fixture assertions use the complete actual content-safe inference result. Create/core failure writes stable issues to stderr and exits `1`. Infer exits `0` after a successful read even when evidence is partial/contradictory; doctor exits `0/1` for healthy/unhealthy; diff exits `0/1` for equal/different.

Build one temporary valid fixture through `generateProject` with a fake verifier, snapshot every byte/path, run infer/doctor/diff through the CLI runner, and assert the tree is byte-for-byte unchanged after each command.

After building the CLI, spawn `node apps/cli/dist/index.js` for one healthy `doctor` fixture and one invalid-command case. Assert exactly one JSON line, no product copy, and exact process exits.

- [ ] **Step 2: Run RED**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core run build
rtk node --test apps/cli/tests/cli.test.mjs
```

Expected RED: parser/runner/tests/bin/runtime dependency do not exist and the entry remains an empty module. Builder-core Task 3 tests remain green.

- [ ] **Step 3: Implement strict parsing and thin mapping**

`arguments.ts` first selects one of four exact command names, then invokes `parseArgs({ strict: true, allowPositionals: false })` with only that command's long options. Catch parser errors and return one sanitized issue.

`run-cli.ts`:

- constructs the verified catalog once and fails content-safely if it is invalid;
- uses `createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" })` only for create;
- uses `createFileSystemRepositoryReader(directory)` plus existing core inference/doctor/diff for read-only commands;
- catches reader-construction/read failures and maps them to `REPOSITORY_OPEN_FAILED` without returning the directory or exception text;
- serializes through `JSON.stringify` exactly once per output;
- never localizes, prompts, discovers Git, installs on read-only commands, or duplicates schema/resolution/inference policy.

Keep any test dependency injection in a CLI-private `createCliRunner` helper in `run-cli.ts`; `runCli(arguments_, output)` remains the public adapter and the entry point contains only:

```ts
#!/usr/bin/env node

import { runCli } from "./run-cli.js";

process.exitCode = await runCli(process.argv.slice(2), {
  write: (value) => process.stdout.write(`${value}\n`),
  writeError: (value) => process.stderr.write(`${value}\n`),
});
```

- [ ] **Step 4: Update private manifests and direct owners**

Set the CLI manifest boundary exactly:

```json
{
  "private": true,
  "bin": { "egeria": "./dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "pnpm --dir ../.. exec eslint apps/cli/src apps/cli/tests --max-warnings 0",
    "test": "node --test tests/*.test.mjs",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@egeria-systems/builder-core": "workspace:*"
  },
  "devDependencies": {
    "@egeria-systems/standards": "workspace:*",
    "@types/node": "22.20.1",
    "typescript": "6.0.3"
  }
}
```

Add `types: ["node"]` to CLI `compilerOptions`. Add these exact root scripts/aggregate changes while keeping the live `test:generated-project` separate:

```json
{
  "test:cli": "pnpm --filter @egeria-systems/cli run build && pnpm --filter @egeria-systems/cli run test",
  "test": "pnpm run test:constitution && pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit && pnpm run test:package-boundaries && pnpm run test:builder-core && pnpm run test:cli && pnpm run test:packages",
  "verify:builder-packages": "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run lint:builder && pnpm run build:builder && pnpm run test:cli && pnpm run test:packages && pnpm run typecheck:builder && pnpm run changeset:status"
}
```

Update `tests/package-boundaries/release-safeguards.test.mjs` for those exact deterministic aggregates, plus only the exact manifest/source/lint expectations and package ownership already listed. Regenerate the workspace lockfile with the pinned pnpm command; verify proof and public-package importer resolutions are unchanged.

- [ ] **Step 5: Run GREEN**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --lockfile-only
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core run build
rtk node --test apps/cli/tests/cli.test.mjs
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/cli run lint
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/cli run typecheck
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run check:semantic-naming
rtk git diff --check
```

Expected GREEN: all four commands parse/map correctly, read-only commands preserve bytes, built entry exit/JSON behavior passes, private/package boundaries reflect only Task 7, and the lockfile change is limited to approved workspace importer edges.

- [ ] **Step 6: Commit and stop**

Stage only Task 4 files, inspect the full staged diff and exact lockfile importer change, then commit:

```bash
git commit -m "Add builder project commands"
```

Proceed to independent review and final verification under the user's current Task 7 plan-amendment preapproval.

---

### Task 5: Independent review, repairs, settled verification, and Task 7 packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-06-atomic-project-generation-verification.md`
- Create: `docs/review-packets/2026-08-06-p1-task-7-atomic-project-generation.md`
- Modify only evidence-backed Task 7 files if a material reviewer finding is retained.

- [ ] **Step 1: Freeze the review candidate**

Record the actual integrated base, `HEAD`, comparison, branch/worktree, status, changed-file list, commits, package integrities, generated lock hashes, and every command receipt. Confirm the primary checkout's user-owned root `AGENTS.md` edit remains outside the Task 7 comparison.

Use a commit comparison, not the dirty primary worktree. Confirm no Task 8 fixture/golden file, P3 mutation behavior, later capability, package release change, runtime-pin change, deployment, or provider surface entered the candidate.

- [ ] **Step 2: Dispatch the required independent read-only reviewers**

Give every reviewer a self-contained packet with the exact base/candidate comparison, approved source/plan, changed files, tests, command results, claim limits, and non-goals. Prohibit edits, recursive delegation, GitHub comments, publication, network mutation, and external action.

Dispatch:

1. **Requirements reviewer:** Task 7 source requirements, four resolved pre-gates, exact-file plan, installed manifest/state order, CLI contract, non-goals, and generated output.
2. **Architecture/anti-overengineering reviewer:** canonical ownership, functional core/imperative shell, Task 6 reuse, narrow filesystem/process boundary, no premature abstraction/capability, and change churn.
3. **Test-evidence reviewer:** causal RED/GREEN receipts, failure injection, exact assertions, live public integration, final-tree coverage, and evidence/claim boundaries.
4. **Filesystem/process/supply-chain specialist:** path/symlink/identity/cleanup behavior, residual rename race wording, exclusive writes, child command/environment isolation, registry integrity/provenance, and absence of deploy/publish/Git behavior.

- [ ] **Step 3: Reconcile findings against the current tree**

Wait for all reports. Classify each item as material-kept, invalid, duplicate, deferred-by-scope, or low-value churn. Reproduce every retained defect with a focused failing test before repair. Make one focused repair commit per coherent material defect, rerun only affected checks, and request bounded re-review of each repair.

Do not implement preferences, speculative hardening, a native exclusive-rename layer, P3 behavior, Task 8 fixtures, runtime pinning, or publication changes under review-repair authority.

- [ ] **Step 4: Run final deterministic verification once on the settled tree**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:cli
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:packages
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run lint:builder
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run typecheck:builder
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run check:semantic-naming
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run changeset:status
rtk git diff --check ae8c268..HEAD
```

The fixed `ae8c268` reference is the exact integrated Task 7 base. Task 6, runtime, semantic-naming, and public-release integration are prerequisites already present in that base and remain outside the Task 7 comparison.

Do not repeat the expensive public generated-project integration if Task 3 already passed and no renderer, templates, verified versions, verifier, generation orchestration, state contract, generated dependency, or Node/pnpm input changed. If any relevant input changed during review repair, rerun `pnpm run test:generated-project` exactly once after it settles. Do not rerun the deployed P0.2 proof: Task 7 does not change its source or deploy.

- [ ] **Step 5: Write verification evidence and the review packet**

The evidence must record:

- exact branch/base/candidate/comparison and clean worktree result;
- RED/GREEN and focused commit sequence;
- all deterministic and live commands with versions, dates, exits, and exact results;
- standards/observability manifests, tarball integrities, provenance/signature evidence, and generated lock hashes;
- state/inference agreement and exact portfolio/site file/surface/capability counts;
- reviewer findings, controller validation, repairs, and re-review dispositions;
- the accepted cooperative-filesystem race boundary;
- Node security pin evidence and the completed separate compatibility record;
- current advisory evidence and the distinction between direct-package queries and public generated-lock audit;
- no-write/no-deploy/no-publish/no-Git evidence;
- risks, deferred Task 8/P3/later-stage work, and unproven runtime/visual/accessibility/production properties.

The packet must list every changed file, focused commit, command result, reviewer disposition, residual risk, deferred item, and recovery domain. Request only approval of the exact Task 7 comparison.

- [ ] **Step 6: Commit gate artifacts and stop at Gate 3**

After `git diff --check` and link/semantic-name checks pass for the two records, commit only them:

```bash
git commit -m "Record project generation verification"
```

Present the packet and stop. Do not begin Task 8, merge to another branch, push, create a pull request, publish/deprecate a package, deploy, or mutate a provider.

## Completion Criteria

Task 7 is complete only when:

- all four pre-execution gates are resolved with dated evidence;
- a clean approved integrated base exists and the user-owned primary-tree edit is preserved;
- exact released package versions are injected internally and installed from the public registry;
- project display-name runtime/static contracts agree on 1–120 Unicode code points and reject Unicode control characters without banning valid format characters wholesale;
- portfolio/site new-directory generation passes all order, failure, cleanup, state, ownership, and inference tests;
- the real verifier produces a portable lockfile and passes frozen install, lint, typecheck, Next build, and OpenNext build in an isolated copy;
- delivered repositories contain no validation/install/build output;
- CLI create/infer/doctor/diff JSON and exits are exact, and read-only commands preserve repository bytes;
- required independent reviews and specialist review are reconciled with no material finding remaining;
- final deterministic verification passes on the settled tree and live public integration evidence is current for every changed relevant input;
- the review packet accurately limits atomic no-clobber, security, runtime, deployment, visual, translation, accessibility, and production claims; and
- the implementation stops for explicit Task 7 Gate 3 approval before Task 8.

## Rollback and Recovery

- **Builder source:** revert focused Task 7 commits in reverse order; do not reset or discard shared/user work. Rebuild builder-core/CLI and rerun affected deterministic checks.
- **Builder lockfile:** restore through the same focused CLI-manifest revert and run the pinned frozen install.
- **Generated test repositories:** test-owned temporary roots are non-authoritative and removed after evidence. A successful user-requested destination is not automatically deleted; recovery is a separately confirmed filesystem action.
- **Published standards/observability:** publication precedes Task 7 and is not undone by source revert. Deprecation or corrective release follows the separately approved release record; unpublish is not assumed.
- **Runtime pin:** the separate compatibility increment has its own rollback. Task 7 does not silently reverse it.
- **Deployment/providers/persistent data:** Task 7 creates none, so no deployment/provider/data rollback exists.
