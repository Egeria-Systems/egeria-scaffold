# Node 22.23.2 Compatibility Implementation Plan

> **Status:** Approved prerequisite amendment. Implement locally and stop on a material contradiction or failed proof.

**Goal:** Replace every current executable Node `22.23.0` pin with `22.23.2`, regenerate derived state schema output, prove deterministic skeleton agreement, and revalidate the full local Next.js/OpenNext/Cloudflare compatibility surface.

**Architecture:** Keep one exact runtime value across root toolchain declarations, the compatibility workflow, the builder state contract, and common generated templates. Tests consume those owners and prevent drift. Historical evidence remains immutable; current compatibility evidence distinguishes local proof from prior deployed evidence.

**Tools:** Node `22.23.2`, pnpm `11.20.0`, existing locked dependencies, Node test runner, existing compatibility-proof scripts.

**Preparation evidence:** [Node 22.23.2 compatibility preparation](../../implementation-evidence/2026-08-06-node-22-23-2-compatibility-preparation.md)

## Exact file inventory

### Tests changed first

- Modify `tests/constitution/constitution.test.mjs`
- Modify `packages/builder-core/tests/contracts.test.mjs`
- Modify `packages/builder-core/tests/state-ownership.test.mjs`
- Modify `packages/builder-core/tests/inference.test.mjs`
- Modify `packages/builder-core/tests/diagnostics.test.mjs`
- Modify `packages/builder-core/tests/render-skeleton.test.mjs`

### Runtime, generated, template, and current documentation surfaces

- Modify `.nvmrc`
- Modify `package.json`
- Modify `.github/workflows/compatibility-proof.yml`
- Modify `README.md`
- Modify `docs/compatibility/nextjs-cloudflare.md`
- Modify `proofs/nextjs-cloudflare/content/en-CA.json`
- Modify `packages/builder-core/src/contracts/state.ts`
- Regenerate `packages/builder-core/schemas/state.schema.json`
- Modify `packages/builder-core/templates/common/.nvmrc`
- Modify `packages/builder-core/templates/common/package.json.template`

### Evidence created after verification

- Create `docs/implementation-evidence/2026-08-06-node-22-23-2-compatibility-verification.md`
- Create `docs/review-packets/2026-08-06-node-22-23-2-compatibility.md`

No lockfile, dependency version, package API, capability, profile, localization structure, or generated application source is otherwise changed.

## Step 1: freeze and install the runtime

Confirm the isolated branch is clean after the planning commit and record its HEAD. Confirm pnpm resolves to the exact Volta `11.20.0` binary. Install Node `22.23.2` through Volta if it is not already present, then run all subsequent checks under that runtime.

Expected:

```text
node --version
v22.23.2

pnpm --version
11.20.0
```

Do not change the pnpm pin or use the desktop fallback.

## Step 2: RED — express exact cross-surface agreement

Change only the six listed test files so their current-runtime expectations require `22.23.2`. Preserve the existing behavioral assertions and add no generic toolchain abstraction.

Run the smallest suites that cover the changed expectations:

```bash
node --test tests/constitution/constitution.test.mjs
pnpm --filter builder-core run build
node --test \
  packages/builder-core/tests/contracts.test.mjs \
  packages/builder-core/tests/state-ownership.test.mjs \
  packages/builder-core/tests/inference.test.mjs \
  packages/builder-core/tests/diagnostics.test.mjs \
  packages/builder-core/tests/render-skeleton.test.mjs
```

Expected RED: exact-value assertions report `22.23.0` from current source, schema, or generated templates while expecting `22.23.2`. Record the failure; do not weaken assertions.

## Step 3: GREEN — update canonical owners and direct consumers

Using focused patches:

1. update root `.nvmrc`, `engines.node`, and `volta.node`;
2. update the compatibility workflow runtime, proof-page content value, README current pin, and compatibility matrix;
3. update the builder state-contract literal and both common templates; and
4. build builder-core and run its existing schema generator so `state.schema.json` is derived from the changed contract rather than hand-edited.

The compatibility record must say the new proof is local-only until a separately authorized workflow run and deployment occur. Preserve the earlier deployment SHA and historical evidence rather than implying it was recreated.

Run the focused suites from Step 2. Expected GREEN: every assertion passes, generated state/schema and rendered skeleton manifests agree on `22.23.2`, and no unrelated behavior changes.

## Step 4: complete local compatibility proof

Run once on the unchanged candidate tree:

```bash
CI=true pnpm install --frozen-lockfile
pnpm audit --audit-level=moderate
pnpm run verify:builder-packages
pnpm run verify:compatibility-proof
pnpm run check:semantic-naming
git diff --check
```

The compatibility proof may require permission to bind loopback ports. Grant only that local execution permission; do not dispatch the GitHub workflow or deploy.

Interpretation limits:

- static/build checks do not prove production safety;
- automated accessibility checks do not establish WCAG conformance;
- the local workerd proof does not replace a new deployed canary; and
- absence of a current advisory is time-bounded evidence, not a future guarantee.

## Step 5: independent review and repair

Dispatch independent read-only reviewers for:

1. requirements and exact live-surface coverage;
2. compatibility architecture, security, and anti-overengineering; and
3. RED/GREEN and final test evidence.

Validate findings against the current tree. Repair only current, evidence-backed material defects; rerun only affected checks, followed by the full relevant aggregate if tested inputs changed.

## Step 6: evidence, packet, and focused commit

Record:

- exact base and final comparison;
- changed files;
- RED failure and GREEN results;
- Node/pnpm versions;
- frozen-install, audit, builder, compatibility, semantic-naming, and diff-check results;
- reviewer findings and dispositions;
- local-versus-deployed evidence boundaries;
- remaining risks and deferred work; and
- source rollback separately from any future deployment/provider rollback.

Commit the coherent runtime update with a semantic message. The worktree must be clean before the public-package release increments begin.
