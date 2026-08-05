# P0.2 Next.js and Cloudflare Compatibility Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task by task and `superpowers:test-driven-development` for every code increment. Use `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a small, private, deployed compatibility proof for the exact approved Node.js, pnpm, Next.js App Router, OpenNext Cloudflare, Wrangler, TypeScript, ESLint, Vitest, Playwright, and axe stack without implementing a builder app, profile, or production feature.

**Architecture:** Infrastructure evidence lives at `proofs/nextjs-cloudflare`, outside builder `apps/*` and future public `packages/*`. The proof has one semantic App Router page, one provider-neutral runtime-report contract, a Cloudflare adapter, an API composition root, and externalized `en-CA` copy. Ordinary Vitest protects pure parsing; a Wrangler test harness exercises the built Worker; Playwright and axe exercise Next development, workerd preview, and the deployed non-production URL. GitHub Actions is the only deployment authority.

**Tech Stack:** Node.js `22.23.0`, pnpm `11.20.0`, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, TypeScript `6.0.3`, ESLint `9.39.5`, Vitest `4.1.10`, Playwright `1.62.1`, and axe `4.12.1`.

## Approval and execution boundary

- This file is the exact-file Gate 1 plan. Writing it does not authorize implementation.
- Implementation begins only after explicit approval of this plan.
- By explicit user decision, sequential P0.2 repository development may occur directly on clean local `main`.
- Stop after every focused implementation commit for user review. Each later approval applies only to the next listed task.
- Use a branch and isolated worktree if implementation becomes parallel or isolation becomes materially useful.
- Repository-changing builder commands against generated client repositories remain isolated and transactional regardless of this development-mode decision.
- No push, GitHub environment mutation, secret write, workflow dispatch, Cloudflare deployment, Worker deletion, or other external action is authorized by plan approval. Task 7 has a separate explicit authorization gate.
- Plan approval and verified-final-diff approval remain separate.

## Global constraints

- Implement only P0.2. Do not create `apps/cli`, `packages/builder-core`, `packages/standards`, an observability package, Changesets, project/state schemas, `.egeria` state, profiles, capabilities, or generated client repositories.
- Do not implement a production profile or any database, queue, email provider, identity, payment, analytics, observability, CRUD, durable storage, or background-job behavior.
- `proofs/nextjs-cloudflare` is a private compatibility artifact, not a public package or product application.
- `apps/*` remains reserved for builder applications; `packages/*` remains reserved for P0.3 package boundaries.
- Keep Cloudflare types and imports in the infrastructure adapter, composition/configuration roots, and infrastructure test.
- Keep presentation pure and pass typed copy into it.
- Use the narrow `CompatibilityRuntimeReport` boundary; do not create `PlatformService`, `ApplicationDatabase`, or another generic port.
- Externalize all proof UI copy in `content/en-CA.json` and validate it before rendering.
- Keep semantic platform differences explicit: `next dev` is Node.js development; OpenNext preview, the test harness, and deployment exercise workerd-compatible output.
- Pin exact dependency versions and action commit SHAs. Do not use `latest`, caret, tilde, moving action tags, or peer-dependency overrides.
- Keep the one evidence-backed transitive security override scoped to `miniflare>undici: 7.29.0`; remove it when Wrangler adopts an equal or newer patched release.
- Preserve pnpm's one-day package maturity policy and a narrow install-script allowlist.
- Do not install the beta `@cloudflare/vitest-pool-workers`; use ordinary Vitest plus Wrangler `createTestHarness()`.
- Run automated accessibility gates, but make no WCAG conformance claim. Human evaluation is not added as a default release gate.
- Cloudflare Web Analytics is not installed. Better Stack UI/server observability remains later work and is not part of this compatibility proof.
- Never log secret values. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are environment-scoped GitHub secrets; `COMPATIBILITY_URL` is an environment-scoped GitHub variable.
- The non-production Worker name is exactly `egeria-scaffold-nextjs-cloudflare-proof`; the GitHub environment is exactly `compatibility`.

## Frozen candidate matrix

Refresh live registry metadata and official advisories immediately before Task 1. If any exact candidate has been withdrawn, has a new material advisory, no longer satisfies peer ranges, or no longer satisfies the one-day maturity policy, stop and amend this plan; do not silently select a different version.

| Surface | Exact version/value |
|---|---|
| Node.js | `22.23.0` |
| pnpm | `11.20.0` |
| Next.js | `16.3.0` |
| React / React DOM | `19.2.8` |
| OpenNext Cloudflare | `1.20.2` |
| Wrangler | `4.118.0` |
| TypeScript | `6.0.3` |
| ESLint | `9.39.5` |
| Next ESLint config | `16.3.0` |
| typescript-eslint | `8.66.0` |
| Vitest | `4.1.10` |
| Playwright | `1.62.1` |
| axe Playwright adapter | `4.12.1` |
| Cloudflare compatibility date | `2026-08-04` |
| GitHub environment | `compatibility` |
| Cloudflare Worker | `egeria-scaffold-nextjs-cloudflare-proof` |

## Exact file map

Preparation artifacts created before implementation:

- `docs/implementation-evidence/2026-08-04-p0-2-compatibility-preparation.md`
- `docs/superpowers/specs/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof-design.md`
- `docs/superpowers/plans/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md`

Root files modified by implementation:

- `.gitignore` — ignore Next, OpenNext, Wrangler, Playwright, and test output.
- `package.json` — exact Node/pnpm pins and root test/verification entry points.
- `pnpm-workspace.yaml` — add `proofs/*`, one-day maturity policy, and reviewed lifecycle-script allowlist.
- `pnpm-lock.yaml` — exact dependency graph and integrity data.
- `README.md` — current P0.2 status and canonical proof/document locations.
- `AGENTS.md` — current proof location and delegation to its nested instructions; no copied runtime rules.
- `tests/constitution/constitution.test.mjs` — executable proof-location, privacy, workspace, pin, and no-premature-package contracts.

Proof files created by implementation:

- `proofs/nextjs-cloudflare/AGENTS.md`
- `proofs/nextjs-cloudflare/package.json`
- `proofs/nextjs-cloudflare/tsconfig.json`
- `proofs/nextjs-cloudflare/next-env.d.ts`
- `proofs/nextjs-cloudflare/eslint.config.mjs`
- `proofs/nextjs-cloudflare/next.config.ts`
- `proofs/nextjs-cloudflare/open-next.config.ts`
- `proofs/nextjs-cloudflare/wrangler.jsonc`
- `proofs/nextjs-cloudflare/cloudflare-env.d.ts`
- `proofs/nextjs-cloudflare/vitest.config.ts`
- `proofs/nextjs-cloudflare/playwright.config.shared.ts`
- `proofs/nextjs-cloudflare/playwright.dev.config.ts`
- `proofs/nextjs-cloudflare/playwright.preview.config.ts`
- `proofs/nextjs-cloudflare/playwright.deployed.config.ts`
- `proofs/nextjs-cloudflare/content/en-CA.json`
- `proofs/nextjs-cloudflare/app/globals.css`
- `proofs/nextjs-cloudflare/app/layout.tsx`
- `proofs/nextjs-cloudflare/app/page.tsx`
- `proofs/nextjs-cloudflare/app/api/compatibility/route.ts`
- `proofs/nextjs-cloudflare/src/application/compatibility-runtime.ts`
- `proofs/nextjs-cloudflare/src/content/proof-copy.ts`
- `proofs/nextjs-cloudflare/src/content/read-proof-copy.ts`
- `proofs/nextjs-cloudflare/src/infrastructure/cloudflare/read-compatibility-runtime.ts`
- `proofs/nextjs-cloudflare/src/presentation/compatibility-page.tsx`
- `proofs/nextjs-cloudflare/tests/unit/proof-copy.test.ts`
- `proofs/nextjs-cloudflare/tests/integration/cloudflare.test.ts`
- `proofs/nextjs-cloudflare/tests/e2e/smoke.spec.ts`

Workflow and canonical documentation files:

- `.github/workflows/compatibility-proof.yml`
- `docs/architecture/overview.md`
- `docs/architecture/enforcement-map.md`
- `docs/roadmaps/program-roadmap.md`
- `docs/compatibility/nextjs-cloudflare.md`

Gate 3 evidence files created after verification:

- `docs/implementation-evidence/2026-08-04-p0-2-compatibility-verification.md`
- `docs/review-packets/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md`

No other file is in scope. `.next/**`, `.open-next/**`, `.wrangler/**`, `playwright-report/**`, `test-results/**`, and coverage output are generated and ignored, not committed.

---

### Task 0: Freeze the approved execution base

**Files:**

- Verify: all preparation artifacts and current repository state

**Completion:** Clean local `main`, expected preparation/design hashes, no concurrent writer, and fresh package/advisory facts.

- [ ] **Step 1: Verify branch, worktree, and user-owned state**

Run:

```bash
git status --short --branch
git branch --show-current
git worktree list
git log -3 --oneline --decorate
```

Expected: clean `main`; one worktree; design commit `2fa4a2a` in history. Stop if the tree is dirty or another writer is active.

- [ ] **Step 2: Verify preparation provenance**

Run:

```bash
shasum -a 256 docs/superpowers/specs/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof-design.md
shasum -a 256 docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md
node --version
volta --version
```

Expected design hash `a0fd3ea222cb7fe05d5f7d2c70f854d01b68715842af445037068481e205f4d4`, roadmap hash `821c175a8ce8c8a46ff4ec75f855e5cc9c867e0dfa9988ee2865dadbf969829d`, Node `v22.23.0`, and Volta `2.0.2` or a newer compatible release.

- [ ] **Step 3: Refresh every frozen package and advisory query**

Run the exact registry and action-resolution checks:

```bash
npm view pnpm@11.20.0 version engines time --json
npm view next@16.3.0 version engines peerDependencies --json
npm view react@19.2.8 version engines --json
npm view react-dom@19.2.8 version peerDependencies --json
npm view @opennextjs/cloudflare@1.20.2 version engines peerDependencies --json
npm view wrangler@4.118.0 version engines exports --json
npm view typescript@6.0.3 version engines --json
npm view eslint@9.39.5 version engines --json
npm view eslint-config-next@16.3.0 version peerDependencies dependencies --json
npm view typescript-eslint@8.66.0 version peerDependencies --json
npm view vitest@4.1.10 version engines peerDependencies --json
npm view @playwright/test@1.62.1 version engines --json
npm view @axe-core/playwright@4.12.1 version peerDependencies --json
npm view @types/node@22.20.1 version --json
npm view @types/react@19.2.18 version --json
npm view @types/react-dom@19.2.4 version --json
gh api repos/actions/checkout/git/ref/tags/v6 --jq '.object.sha'
gh api repos/pnpm/action-setup/git/ref/tags/v4 --jq '.object.sha'
gh api repos/actions/setup-node/git/ref/tags/v5 --jq '.object.sha'
```

Fetch current primary documentation without intermediary search caches:

```bash
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://nodejs.org/en/blog/vulnerability/june-2026-security-releases?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://pnpm.io/settings?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://nextjs.org/blog?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://opennext.js.org/cloudflare?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/index.md?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://developers.cloudflare.com/workers/testing/index.md?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://developers.cloudflare.com/workers/testing/test-harness/get-started/index.md?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/index.md?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/index.md?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://playwright.dev/docs/ci?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://www.w3.org/WAI/test-evaluate/?fresh=20260804'
curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' 'https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments?fresh=20260804'
```

Run the exact-version GitHub Advisory Database queries:

```bash
gh api --method GET /advisories -f ecosystem=npm -f affects='pnpm@11.20.0' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='next@16.3.0' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='react@19.2.8' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='react-dom@19.2.8' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='@opennextjs/cloudflare@1.20.2' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='wrangler@4.118.0' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='typescript@6.0.3' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='eslint@9.39.5' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='eslint-config-next@16.3.0' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='typescript-eslint@8.66.0' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='vitest@4.1.10' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='@playwright/test@1.62.1' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='@axe-core/playwright@4.12.1' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='@types/node@22.20.1' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='@types/react@19.2.18' --jq 'length'
gh api --method GET /advisories -f ecosystem=npm -f affects='@types/react-dom@19.2.4' --jq 'length'
```

Save each package name, version, result count, and query time in verification evidence. Stop for a plan amendment if any candidate, peer range, security floor, beta status, action SHA, or required command changed materially.

- [ ] **Step 4: Persist and commit the approved Gate 1 artifacts**

After the user approves this plan, run:

```bash
git add docs/implementation-evidence/2026-08-04-p0-2-compatibility-preparation.md docs/superpowers/plans/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md
git diff --cached --check
git diff --cached --stat
git commit -m "docs: plan P0.2 compatibility proof"
```

Stop for user review of this focused preparation commit before Task 1.

---

### Task 1: Extend the workspace and lock the exact toolchain

**Files:**

- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `tests/constitution/constitution.test.mjs`
- Create: `pnpm-lock.yaml`
- Create: `proofs/nextjs-cloudflare/package.json`
- Create: `proofs/nextjs-cloudflare/AGENTS.md`

**Interfaces:**

- Root `test` runs constitution plus the ordinary proof unit test.
- Root `verify:p0.2` delegates to the private proof's complete local verification script.
- Workspace discovery adds only `proofs/*`; `apps/*` and `packages/*` remain empty.

- [ ] **Step 1: Add the failing constitution contracts**

Extend `tests/constitution/constitution.test.mjs` with structural assertions equivalent to:

```js
test("P0.2 pins one compatible Node and pnpm toolchain", async () => {
  const manifest = JSON.parse(await readRepositoryFile("package.json"));
  const nvmVersion = (await readRepositoryFile(".nvmrc")).trim();

  assert.equal(nvmVersion, "22.23.0");
  assert.equal(manifest.packageManager, "pnpm@11.20.0");
  assert.deepEqual(manifest.engines, {
    node: "22.23.0",
    pnpm: "11.20.0",
  });
  assert.deepEqual(manifest.volta, { node: "22.23.0" });
});

test("the compatibility proof has a private non-app workspace boundary", async () => {
  const workspace = await readRepositoryFile("pnpm-workspace.yaml");
  const proofManifest = JSON.parse(
    await readRepositoryFile("proofs/nextjs-cloudflare/package.json"),
  );

  assert.match(workspace, /  - "proofs\/\*"\n/);
  assert.equal(proofManifest.name, "@egeria-systems/nextjs-cloudflare-proof");
  assert.equal(proofManifest.private, true);
  await assert.rejects(readRepositoryFile("apps/web/package.json"));
  await assert.rejects(readRepositoryFile("apps/compatibility/package.json"));
  await assert.rejects(readRepositoryFile("packages/project-schema/package.json"));
});
```

Keep the existing P0.1 contracts, updating only expectations that P0.2 intentionally supersedes: root dependency-free status, absent `packageManager`/`engines`, workspace globs, and absent lockfile/workflow/proof. Do not weaken ADR, link-integrity, or no-premature-runtime-package checks.

- [ ] **Step 2: Run RED**

```bash
node --test tests/constitution/constitution.test.mjs
```

Expected: focused failures for the missing pnpm pin, `proofs/*` workspace, and proof manifest. Record the failing test names; do not treat unrelated failures as expected.

- [ ] **Step 3: Create the exact private proof manifest and root contracts**

Update root `package.json` to retain existing metadata and use:

```json
{
  "scripts": {
    "test": "pnpm run test:constitution && pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit",
    "test:constitution": "node --test tests/constitution/constitution.test.mjs",
    "verify:p0.2": "pnpm --filter @egeria-systems/nextjs-cloudflare-proof verify"
  },
  "packageManager": "pnpm@11.20.0",
  "engines": {
    "node": "22.23.0",
    "pnpm": "11.20.0"
  },
  "volta": {
    "node": "22.23.0"
  }
}
```

Create `proofs/nextjs-cloudflare/package.json` with exact versions:

```json
{
  "name": "@egeria-systems/nextjs-cloudflare-proof",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --hostname 127.0.0.1 --port 3100",
    "build": "next build",
    "build:cloudflare": "opennextjs-cloudflare build",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101",
    "deploy": "opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts",
    "cf-typegen:check": "wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts --check",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "pnpm run test:unit",
    "test:unit": "vitest run tests/unit/proof-copy.test.ts",
    "test:integration:cloudflare": "vitest run tests/integration/cloudflare.test.ts",
    "test:e2e:dev": "playwright test --config=playwright.dev.config.ts",
    "test:e2e:preview": "playwright test --config=playwright.preview.config.ts",
    "test:e2e:deployed": "playwright test --config=playwright.deployed.config.ts",
    "verify": "pnpm run cf-typegen:check && pnpm run lint && pnpm run typecheck && pnpm run test:unit && pnpm run build && pnpm run build:cloudflare && pnpm run test:integration:cloudflare && pnpm run test:e2e:dev && pnpm run test:e2e:preview"
  },
  "dependencies": {
    "@opennextjs/cloudflare": "1.20.2",
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.12.1",
    "@playwright/test": "1.62.1",
    "@types/node": "22.20.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "eslint": "9.39.5",
    "eslint-config-next": "16.3.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.66.0",
    "vitest": "4.1.10",
    "wrangler": "4.118.0"
  }
}
```

Update `pnpm-workspace.yaml` exactly:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "proofs/*"

pmOnFail: error

minimumReleaseAge: 1440

overrides:
  "miniflare>undici": 7.29.0

allowBuilds:
  "@parcel/watcher": true
  "@swc/core": true
  esbuild: true
  unrs-resolver: true
  workerd: true
```

Create nested `AGENTS.md` with these normative rules:

```markdown
# Next.js and Cloudflare compatibility proof

This directory is infrastructure evidence, not a builder application, generated client repository, public package, profile, or reusable runtime package.

- Keep the proof minimal: one page, one API route, and tests required by P0.2.
- Externalize all visible copy in `content/en-CA.json` and validate it before rendering.
- Keep presentation components pure and Cloudflare imports in `src/infrastructure/cloudflare`, configuration/composition roots, or infrastructure tests.
- Preserve the explicit Node development versus workerd preview/deployment distinction.
- Do not add product behavior, provider integrations, analytics, observability, persistence, authentication, payments, or speculative abstractions.
- Automated accessibility results are evidence only and do not establish WCAG conformance.
- Read the root `AGENTS.md`, architecture documents, ADRs, and approved P0.2 plan before editing.
```

Extend `.gitignore` with:

```gitignore
.next/
.open-next/
.wrangler/
playwright-report/
test-results/
```

- [ ] **Step 4: Pin pnpm locally and create the exact lock**

Run:

```bash
volta install pnpm@11.20.0
pnpm --version
pnpm install
pnpm install --frozen-lockfile
pnpm ignored-builds
pnpm audit --audit-level=moderate
```

Expected: pnpm `11.20.0`; a new `pnpm-lock.yaml`; the frozen reinstall succeeds; no required lifecycle build remains ignored; peer checks and audit exit zero. The project pin is the exact `packageManager` field enforced by `pmOnFail: error`; Volta owns only the Node project pin because Volta `2.0.2` cannot project-pin pnpm. The exact `miniflare>undici: 7.29.0` override repairs the current Wrangler transitive advisory and must be proven by both audit and integration tests. If another lifecycle package is required, another advisory is present, or the maturity policy blocks a selected release, stop for evidence and a plan amendment.

- [ ] **Step 5: Run GREEN and inspect the locked graph**

```bash
node --test tests/constitution/constitution.test.mjs
pnpm list --depth 0 --recursive
git diff --check
git status --short
```

Expected: constitution contracts pass and only Task 1 files changed. Unit tests do not run yet because their file belongs to Task 2.

- [ ] **Step 6: Commit and stop**

```bash
git add .gitignore package.json pnpm-workspace.yaml pnpm-lock.yaml tests/constitution/constitution.test.mjs proofs/nextjs-cloudflare/package.json proofs/nextjs-cloudflare/AGENTS.md
git diff --cached --check
git commit -m "build: lock P0.2 compatibility toolchain"
```

Stop for user review before Task 2.

---

### Task 2: Build the typed App Router proof with externalized copy

**Files:**

- Create: proof TypeScript, ESLint, Next, content, application, presentation, page, styles, and unit-test files listed in the exact map

**Interfaces:**

```ts
export interface CompatibilityRuntimeReport {
  environment: string;
  runtime: "workerd";
}

export interface ProofFact {
  identifier: string;
  label: string;
  value: string;
}

export interface ProofPageCopy {
  eyebrow: string;
  heading: string;
  summary: string;
  facts: readonly ProofFact[];
  runtimeReportLink: string;
}
```

- [ ] **Step 1: Write the failing copy-parser unit tests**

Create `tests/unit/proof-copy.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseProofCopy } from "../../src/content/proof-copy";

const validCopy = {
  metadata: { title: "Proof", description: "Compatibility evidence" },
  page: {
    eyebrow: "Compatibility proof",
    heading: "Next.js and Cloudflare compatibility proof",
    summary: "A small executable check.",
    facts: [{ identifier: "runtime", label: "Target runtime", value: "workerd" }],
    runtimeReportLink: "View runtime report",
  },
};

describe("parseProofCopy", () => {
  test("returns typed non-empty copy", () => {
    expect(parseProofCopy(validCopy)).toEqual(validCopy);
  });

  test("rejects duplicate fact identifiers", () => {
    expect(() =>
      parseProofCopy({
        ...validCopy,
        page: {
          ...validCopy.page,
          facts: [validCopy.page.facts[0], validCopy.page.facts[0]],
        },
      }),
    ).toThrow(/duplicate fact identifier: runtime/);
  });

  test("rejects blank user-visible copy", () => {
    expect(() =>
      parseProofCopy({
        ...validCopy,
        page: { ...validCopy.page, heading: " " },
      }),
    ).toThrow(/page.heading/);
  });
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

Run:

```bash
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit
```

Expected RED: module `src/content/proof-copy` does not exist.

- [ ] **Step 2: Implement the smallest strict parser**

Create `src/content/proof-copy.ts`:

```ts
type UnknownRecord = Record<string, unknown>;

export interface ProofFact {
  identifier: string;
  label: string;
  value: string;
}

export interface ProofPageCopy {
  eyebrow: string;
  heading: string;
  summary: string;
  facts: readonly ProofFact[];
  runtimeReportLink: string;
}

export interface ProofCopy {
  metadata: {
    title: string;
    description: string;
  };
  page: ProofPageCopy;
}

function readRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as UnknownRecord;
}

function readNonEmptyString(
  record: UnknownRecord,
  key: string,
  path: string,
): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}.${key} must be a non-empty string`);
  }

  return value;
}

function readFacts(value: unknown): readonly ProofFact[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("page.facts must be a non-empty array");
  }

  const identifiers = new Set<string>();

  return value.map((candidate, index) => {
    const path = `page.facts[${index}]`;
    const fact = readRecord(candidate, path);
    const identifier = readNonEmptyString(fact, "identifier", path);

    if (identifiers.has(identifier)) {
      throw new Error(`duplicate fact identifier: ${identifier}`);
    }

    identifiers.add(identifier);

    return {
      identifier,
      label: readNonEmptyString(fact, "label", path),
      value: readNonEmptyString(fact, "value", path),
    };
  });
}

export function parseProofCopy(input: unknown): ProofCopy {
  const root = readRecord(input, "copy");
  const metadata = readRecord(root.metadata, "metadata");
  const page = readRecord(root.page, "page");

  return {
    metadata: {
      title: readNonEmptyString(metadata, "title", "metadata"),
      description: readNonEmptyString(metadata, "description", "metadata"),
    },
    page: {
      eyebrow: readNonEmptyString(page, "eyebrow", "page"),
      heading: readNonEmptyString(page, "heading", "page"),
      summary: readNonEmptyString(page, "summary", "page"),
      facts: readFacts(page.facts),
      runtimeReportLink: readNonEmptyString(
        page,
        "runtimeReportLink",
        "page",
      ),
    },
  };
}
```

Do not add a general schema library for this one fixed proof document.

- [ ] **Step 3: Add externalized copy and its single typed loader**

Create `content/en-CA.json`:

```json
{
  "metadata": {
    "title": "Next.js and Cloudflare compatibility proof",
    "description": "Executable compatibility evidence for the Egeria Systems scaffold toolchain."
  },
  "page": {
    "eyebrow": "Compatibility proof",
    "heading": "Next.js and Cloudflare compatibility proof",
    "summary": "This non-production page verifies the selected development, workerd preview, and deployment toolchain.",
    "facts": [
      { "identifier": "node", "label": "Node.js", "value": "22.23.0" },
      { "identifier": "package-manager", "label": "Package manager", "value": "pnpm 11.20.0" },
      { "identifier": "framework", "label": "Framework", "value": "Next.js 16.3.0 App Router" },
      { "identifier": "adapter", "label": "Cloudflare adapter", "value": "OpenNext 1.20.2" },
      { "identifier": "target-runtime", "label": "Target runtime", "value": "workerd" }
    ],
    "runtimeReportLink": "View runtime report"
  }
}
```

Create `src/content/read-proof-copy.ts`:

```ts
import copySource from "../../content/en-CA.json";
import { parseProofCopy } from "./proof-copy";

export const proofCopy = parseProofCopy(copySource);
```

- [ ] **Step 4: Add strict TypeScript and flat ESLint configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "cloudflare-env.d.ts",
    "app/**/*.ts",
    "app/**/*.tsx",
    "src/**/*.ts",
    "src/**/*.tsx",
    "tests/**/*.ts",
    "*.config.ts",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

`skipLibCheck: true` is limited to third-party declaration compatibility; strict application code remains enabled.

Create `eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    ignores: ["src/infrastructure/cloudflare/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@opennextjs/cloudflare",
              message: "Cloudflare imports belong in the infrastructure adapter or configuration root.",
            },
          ],
          patterns: [
            {
              group: ["cloudflare:*"],
              message: "Cloudflare imports belong in the infrastructure adapter.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "cloudflare-env.d.ts",
    "next-env.d.ts",
  ]),
]);
```

Create `next-env.d.ts` using the exact file generated by Next.js `16.3.0`; do not hand-edit it after generation.

- [ ] **Step 5: Implement the pure presentation and App Router composition**

Create `src/presentation/compatibility-page.tsx`:

```tsx
import type { ProofPageCopy } from "../content/proof-copy";

export interface CompatibilityPageProps {
  copy: ProofPageCopy;
}

export function CompatibilityPage({ copy }: CompatibilityPageProps) {
  return (
    <main>
      <article aria-labelledby="proof-heading">
        <header>
          <p>{copy.eyebrow}</p>
          <h1 id="proof-heading">{copy.heading}</h1>
          <p>{copy.summary}</p>
        </header>
        <dl>
          {copy.facts.map((fact) => (
            <div key={fact.identifier}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <a href="/api/compatibility">{copy.runtimeReportLink}</a>
      </article>
    </main>
  );
}
```

Create `app/page.tsx`:

```tsx
import { proofCopy } from "../src/content/read-proof-copy";
import { CompatibilityPage } from "../src/presentation/compatibility-page";

export default function Page() {
  return <CompatibilityPage copy={proofCopy.page} />;
}
```

Create `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { proofCopy } from "../src/content/read-proof-copy";
import "./globals.css";

export const metadata: Metadata = proofCopy.metadata;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/globals.css`:

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

main {
  min-block-size: 100vh;
  padding: clamp(1rem, 5vw, 4rem);
}

article {
  max-inline-size: 48rem;
  margin-inline: auto;
}

h1,
p {
  max-inline-size: 65ch;
}

dl {
  display: grid;
  gap: 1rem;
  margin-block: 2rem;
}

dl div {
  border-inline-start: 0.25rem solid currentColor;
  padding-inline-start: 1rem;
}

dt {
  font-weight: 700;
}

dd {
  margin-inline-start: 0;
}

a:focus-visible {
  outline: 0.2rem solid currentColor;
  outline-offset: 0.2rem;
}
```

Create `next.config.ts`:

```ts
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

This configuration supplies Cloudflare-compatible bindings during `next dev`; it does not change the fact that Next development executes on Node.js.

- [ ] **Step 6: Run GREEN for the Node development slice**

```bash
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit
pnpm --filter @egeria-systems/nextjs-cloudflare-proof lint
pnpm --filter @egeria-systems/nextjs-cloudflare-proof typecheck
pnpm --filter @egeria-systems/nextjs-cloudflare-proof build
```

Expected: all pass. Inspect the generated `next-env.d.ts` and commit it only if it matches Next's generated contract.

- [ ] **Step 7: Commit and stop**

```bash
git add proofs/nextjs-cloudflare
git diff --cached --check
git commit -m "feat: add typed compatibility proof page"
```

Stop for user review before Task 3.

---

### Task 3: Add the OpenNext workerd boundary and integration test

**Files:**

- Create: `open-next.config.ts`, `wrangler.jsonc`, generated `cloudflare-env.d.ts`
- Create: application report, Cloudflare adapter, API route, and integration test
- Modify only if generated typing requires it: `tsconfig.json`, `.gitignore`

**Interfaces:**

```ts
export interface CompatibilityRuntimeReport {
  environment: string;
  runtime: "workerd";
}

export function readCompatibilityRuntime(): CompatibilityRuntimeReport;
```

- [ ] **Step 1: Write the failing built-Worker integration test**

Create `tests/integration/cloudflare.test.ts` from the current Cloudflare harness contract:

```ts
import { createTestHarness } from "wrangler";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

const server = createTestHarness({
  workers: [{ configPath: "./wrangler.jsonc" }],
});

beforeAll(async () => {
  await server.listen();
});

afterEach(async () => {
  await server.reset();
});

afterAll(async () => {
  await server.close();
});

test("the built Worker returns the provider-neutral runtime report", async () => {
  const response = await server.fetch("/api/compatibility");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  await expect(response.json()).resolves.toEqual({
    environment: "compatibility",
    runtime: "workerd",
  });
});
```

Run:

```bash
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:integration:cloudflare
```

Expected RED: missing Wrangler/OpenNext configuration or built Worker entry.

- [ ] **Step 2: Configure OpenNext and Wrangler exactly**

Create `open-next.config.ts`:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

Create `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "egeria-scaffold-nextjs-cloudflare-proof",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-08-04",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "vars": {
    "PROOF_ENVIRONMENT": "compatibility"
  }
}
```

Do not add production routes, domains, analytics, queues, databases, object storage, service bindings, or observability configuration.

- [ ] **Step 3: Generate and verify Cloudflare binding types**

```bash
pnpm --filter @egeria-systems/nextjs-cloudflare-proof cf-typegen
pnpm --filter @egeria-systems/nextjs-cloudflare-proof cf-typegen:check
```

Commit the generated `cloudflare-env.d.ts`. Do not manually duplicate its binding declarations.

- [ ] **Step 4: Implement the narrow report boundary and Cloudflare adapter**

Create `src/application/compatibility-runtime.ts`:

```ts
export interface CompatibilityRuntimeReport {
  environment: string;
  runtime: "workerd";
}
```

Create `src/infrastructure/cloudflare/read-compatibility-runtime.ts`:

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CompatibilityRuntimeReport } from "../../application/compatibility-runtime";

export function readCompatibilityRuntime(): CompatibilityRuntimeReport {
  const { env } = getCloudflareContext();

  return {
    environment: env.PROOF_ENVIRONMENT,
    runtime: "workerd",
  };
}
```

Create `app/api/compatibility/route.ts`:

```ts
import { readCompatibilityRuntime } from "../../../src/infrastructure/cloudflare/read-compatibility-runtime";

export const runtime = "nodejs";

export function GET(): Response {
  return Response.json(readCompatibilityRuntime());
}
```

The route is a composition root; it does not import Cloudflare types. The response describes the configured Cloudflare target boundary. Documentation must still state that `next dev` itself runs on Node.js.

- [ ] **Step 5: Build and run GREEN under the production Worker harness**

```bash
pnpm --filter @egeria-systems/nextjs-cloudflare-proof lint
pnpm --filter @egeria-systems/nextjs-cloudflare-proof typecheck
pnpm --filter @egeria-systems/nextjs-cloudflare-proof build:cloudflare
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:integration:cloudflare
```

Expected: OpenNext creates `.open-next/worker.js`; the harness starts the built Worker and the integration test passes. A Node-only route test is not accepted as Cloudflare runtime evidence.

- [ ] **Step 6: Commit and stop**

```bash
git add proofs/nextjs-cloudflare
git diff --cached --check
git commit -m "feat: prove OpenNext workerd integration"
```

Stop for user review before Task 4.

---

### Task 4: Add browser and automated accessibility smoke gates

**Files:**

- Create: `playwright.config.shared.ts`
- Create: `playwright.dev.config.ts`
- Create: `playwright.preview.config.ts`
- Create: `playwright.deployed.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

**Interfaces:** One shared test suite runs unchanged against three base URLs; local configs own their web-server commands, while the deployed config requires `COMPATIBILITY_URL`.

- [ ] **Step 1: Write the failing shared browser suite**

Create `tests/e2e/smoke.spec.ts` with four bounded checks:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the proof and returns its runtime report", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Next.js and Cloudflare compatibility proof",
    }),
  ).toBeVisible();

  const response = await page.request.get("/api/compatibility");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({
    environment: "compatibility",
    runtime: "workerd",
  });
});

test("has no detected axe violations in the selected rule set", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("supports keyboard focus and 320 CSS pixel reflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "View runtime report" })).toBeFocused();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("does not animate when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animatedElementCount = await page.locator("*").evaluateAll((elements) =>
    elements.filter((element) => {
      const style = getComputedStyle(element);
      return style.animationName !== "none" || style.transitionDuration !== "0s";
    }).length,
  );
  expect(animatedElementCount).toBe(0);
});
```

Run the test before adding configs. Expected RED: Playwright cannot find the requested configuration.

- [ ] **Step 2: Implement the shared Chromium configuration**

Create `playwright.config.shared.ts` exporting:

```ts
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

interface ProofPlaywrightOptions {
  baseURL: string;
  webServer?: PlaywrightTestConfig["webServer"];
}

export function createProofPlaywrightConfig({
  baseURL,
  webServer,
}: ProofPlaywrightOptions): PlaywrightTestConfig {
  return defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: "list",
    use: {
      ...devices["Desktop Chrome"],
      baseURL,
      trace: "retain-on-failure",
    },
    ...(webServer === undefined ? {} : { webServer }),
  });
}
```

Create `playwright.dev.config.ts`:

```ts
import { createProofPlaywrightConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3100";

export default createProofPlaywrightConfig({
  baseURL,
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Create `playwright.preview.config.ts`:

```ts
import { createProofPlaywrightConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3101";

export default createProofPlaywrightConfig({
  baseURL,
  webServer: {
    command: "pnpm preview",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Create `playwright.deployed.config.ts`:

```ts
import { createProofPlaywrightConfig } from "./playwright.config.shared";

const baseURL = process.env.COMPATIBILITY_URL?.replace(/\/+$/, "");

if (!baseURL) {
  throw new Error("COMPATIBILITY_URL is required for deployed proof tests");
}

export default createProofPlaywrightConfig({ baseURL });
```

- [ ] **Step 3: Install only the pinned Chromium browser**

```bash
pnpm --filter @egeria-systems/nextjs-cloudflare-proof exec playwright install chromium
```

Do not install or claim coverage for browsers outside this P0.2 smoke scope.

- [ ] **Step 4: Run the development and preview gates separately**

```bash
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:e2e:dev
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:e2e:preview
```

Expected: both suites pass. Record them separately because Node development success does not prove workerd preview, and preview does not prove deployment or WCAG conformance.

- [ ] **Step 5: Commit and stop**

```bash
git add proofs/nextjs-cloudflare
git diff --cached --check
git commit -m "test: add browser compatibility smoke gates"
```

Stop for user review before Task 5.

---

### Task 5: Document the canonical compatibility boundary and known limitations

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/roadmaps/program-roadmap.md`
- Create: `docs/compatibility/nextjs-cloudflare.md`
- Modify: `tests/constitution/constitution.test.mjs`

**Completion:** Future agents can find the proof without interpreting it as an app or public package; documentation labels evidence by runtime and states limitations without a conformance claim.

- [ ] **Step 1: Add failing structural documentation contracts**

Add constitution assertions that:

- `README.md`, `AGENTS.md`, architecture overview, enforcement map, and roadmap link to `docs/compatibility/nextjs-cloudflare.md` or `proofs/nextjs-cloudflare` as appropriate;
- every new local Markdown link resolves inside the repository;
- `apps/*` remains reserved for builder apps and `proofs/*` is explicitly non-product evidence;
- the compatibility document exists and the already-approved no-premature-package assertions still pass.

Run:

```bash
node --test tests/constitution/constitution.test.mjs
```

Expected RED: missing compatibility document and canonical links.

- [ ] **Step 2: Write the canonical compatibility record**

Create `docs/compatibility/nextjs-cloudflare.md` with these exact sections:

1. **Status and evidence date** — candidate until deployed Gate 3 evidence is complete.
2. **Exact matrix** — every version/value in the frozen candidate matrix and lockfile hash.
3. **What each check proves** — Node unit, Next build/dev, OpenNext build, Wrangler harness, workerd preview, deployed smoke.
4. **Runtime distinctions** — `next dev` on Node; preview/harness/deploy on workerd-compatible output; target report is not runtime introspection.
5. **Known limitations** — no Node.js Middleware, Windows not guaranteed, Worker size limits, Workers Vitest pool beta and excluded, Chromium-only smoke, no production profile.
6. **Accessibility evidence and claim boundary** — axe/keyboard/reflow/reduced-motion are automated evidence; no WCAG conformance claim or default human gate.
7. **Deployment boundary** — manual GitHub Actions, environment `compatibility`, Worker name, secrets/variable names without values.
8. **Revalidation triggers** — Node/Next/OpenNext/Wrangler/pnpm upgrade, compatibility-date change, Cloudflare limitation change, action SHA update, or security advisory.

- [ ] **Step 3: Update canonical navigation without duplicating rules**

- README: identify P0.2 as current and link to the proof, compatibility record, evidence, and plan.
- Root AGENTS: add one short “current proof” pointer to nested `proofs/nextjs-cloudflare/AGENTS.md`; keep normative runtime details nested/canonical.
- Architecture overview: state that `proofs/*` contains disposable infrastructure evidence, `apps/*` contains builder applications, `packages/*` contains deliberately owned packages, and generated repositories remain separate products with `apps/web`.
- Enforcement map: mark the applicable Cloudflare isolation, copy, accessibility-claim, deployment-authority, and package-boundary checks as implemented by named P0.2 commands/tests; leave unrelated future gates planned.
- Roadmap: mark local P0.2 portions complete only after their evidence passes; do not mark the deployed exit complete until Task 7.

- [ ] **Step 4: Run GREEN and inspect for drift**

```bash
pnpm run test:constitution
rg -n "WCAG conform|production profile|apps/compatibility|apps/web" README.md AGENTS.md docs proofs/nextjs-cloudflare
git diff --check
```

Expected: constitution passes; no WCAG conformance claim, no proof under `apps/*`, and no claim that a production profile exists.

- [ ] **Step 5: Commit and stop**

```bash
git add README.md AGENTS.md docs/architecture docs/compatibility docs/roadmaps/program-roadmap.md tests/constitution/constitution.test.mjs
git diff --cached --check
git commit -m "docs: define P0.2 compatibility evidence boundary"
```

Stop for user review before Task 6.

---

### Task 6: Add the non-production deployment workflow

**Files:**

- Create: `.github/workflows/compatibility-proof.yml`
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `docs/compatibility/nextjs-cloudflare.md`

**Completion:** A statically verified, manually dispatched, main-only, minimum-permission workflow is ready for an explicitly authorized external setup and run.

- [ ] **Step 1: Add a failing workflow contract test**

Add a constitution test that parses the workflow as text only for stable security/deployment properties:

- event is `workflow_dispatch` and contains no `push`, `pull_request`, or schedule trigger;
- permissions are exactly `contents: read` at workflow level;
- job requires `refs/heads/main` and environment `compatibility`;
- concurrency group is `compatibility-proof` with `cancel-in-progress: false`;
- actions use the three recorded full 40-character SHAs;
- install uses `--frozen-lockfile`;
- verification occurs before deployment;
- only the deploy step receives Cloudflare secrets;
- deployed smoke receives `COMPATIBILITY_URL` and no Cloudflare credential;
- no production environment/name appears.

Run RED before the workflow exists.

- [ ] **Step 2: Create the exact manual workflow**

Create `.github/workflows/compatibility-proof.yml`:

```yaml
name: Compatibility proof

on:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: compatibility-proof
  cancel-in-progress: false

jobs:
  verify-and-deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    environment:
      name: compatibility
    steps:
      - name: Check out repository
        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803

      - name: Install pnpm
        uses: pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa
        with:
          version: 11.20.0
          run_install: false

      - name: Set up Node.js
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Chromium
        run: pnpm --filter @egeria-systems/nextjs-cloudflare-proof exec playwright install --with-deps chromium

      - name: Verify compatibility proof
        run: pnpm run verify:p0.2

      - name: Deploy compatibility Worker
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          test -n "$CLOUDFLARE_ACCOUNT_ID"
          test -n "$CLOUDFLARE_API_TOKEN"
          pnpm --filter @egeria-systems/nextjs-cloudflare-proof deploy

      - name: Test deployed compatibility proof
        env:
          COMPATIBILITY_URL: ${{ vars.COMPATIBILITY_URL }}
        run: pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:e2e:deployed
```

The environment gates access to credentials. No Cloudflare credential is available to checkout, install, build, local tests, or deployed browser testing.

- [ ] **Step 3: Validate the workflow locally without dispatching it**

```bash
node --test tests/constitution/constitution.test.mjs
pnpm run verify:p0.2
git diff --check
```

If a repository-owned YAML/workflow validator already exists by execution time, run it. Do not add a new general workflow framework solely for this one file.

- [ ] **Step 4: Document the external prerequisites accurately**

Update the compatibility record to say “workflow ready; not yet deployed.” List only names, scopes, and protection expectations, never values. Record that environment-review protection is conditional on what GitHub exposes for the private repository's current plan.

- [ ] **Step 5: Commit and stop before all external actions**

```bash
git add .github/workflows/compatibility-proof.yml tests/constitution/constitution.test.mjs docs/compatibility/nextjs-cloudflare.md
git diff --cached --check
git commit -m "ci: add compatibility proof deployment workflow"
```

Stop and request explicit authorization for Task 7. Do not push or create/configure GitHub/Cloudflare resources yet.

---

### Task 7: Establish and run the authorized non-production deployment

**External mutations — separately authorized:** push local `main`; create/configure GitHub environment `compatibility`; set two environment secrets and one variable; dispatch the workflow; create/update the named Cloudflare Worker.

**Required user-controlled inputs:** a narrow Cloudflare API token, account ID, and the expected non-production Worker URL. Never request their values in chat if the user can set them directly in GitHub.

**Optional local tooling:** The installed Cloudflare plugin may support current-documentation lookup and, only after explicit authorization, read-only inspection of the named account and Worker. It is not a deployment path or evidence by itself; do not use its skills or API MCP to create, update, deploy, roll back, or delete Cloudflare resources.

- [ ] **Step 1: Obtain exact external-action approval**

Present the proposed actions, destination repository, environment name, Worker name, credential names/scopes, workflow ref, recovery path, and the fact that the private repository currently has no remote default branch. Proceed only after explicit approval.

- [ ] **Step 2: Push the approved local commits**

Recheck clean `main`, exact commit range, and remote identity. Push only after approval:

```bash
git status --short --branch
git log --oneline --decorate --reverse
git push -u origin main
```

Confirm that GitHub now reports `main` as the intended default branch. Do not create a pull request unless separately asked.

- [ ] **Step 3: Configure the GitHub environment**

Create `compatibility`, restrict deployment to `main` where available, prevent self-review where available, and record actual protection availability. The user supplies:

- secret `CLOUDFLARE_API_TOKEN` with only the account/Worker permissions needed to deploy the named proof;
- secret `CLOUDFLARE_ACCOUNT_ID`;
- variable `COMPATIBILITY_URL` containing the expected non-production URL.

Do not read back or log secret values.

- [ ] **Step 4: Dispatch and monitor one workflow run**

Dispatch `.github/workflows/compatibility-proof.yml` on `main`. Record workflow/run identifiers, commit SHA, job conclusions, and deployment URL. If the job fails, use systematic debugging; do not weaken permissions, protections, tests, or the compatibility matrix to force green.

- [ ] **Step 5: Independently verify the deployed endpoint**

After the workflow passes, rerun the deployed Playwright suite against the recorded URL from a clean local tree:

```bash
test -n "$COMPATIBILITY_URL"
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:e2e:deployed
```

Use an environment variable without committing or echoing private values. Record only the non-secret public proof URL if the user approves it for the review packet.

- [ ] **Step 6: Record deployment recovery**

Source rollback: redeploy a previously verified commit through the same workflow. Persistent/provider rollback: this stateless proof has no persistent data; Worker deletion or custom-domain removal is a distinct Cloudflare action requiring separate approval. GitHub environment/secret deletion is also separate and is not implied by source rollback.

Stop for user review before Task 8.

---

### Task 8: Run independent reviews, repair material findings, and close Gate 3

**Files:**

- Create: `docs/implementation-evidence/2026-08-04-p0-2-compatibility-verification.md`
- Create: `docs/review-packets/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md`
- Modify only if evidence-backed material findings require it: files in the approved P0.2 map

**Optional-tool evidence:** If the Cloudflare plugin materially contributes to verification, record its exact version, granted OAuth scope names, read-only operations and results, and limitations without recording credentials or unrelated private account data. Plugin availability alone is neither repository evidence nor a repository dependency.

- [ ] **Step 1: Freeze the candidate and run the full relevant suite once**

```bash
git status --short --branch
git rev-parse HEAD
pnpm --version
node --version
pnpm install --frozen-lockfile
pnpm audit --audit-level=moderate
pnpm run test:constitution
pnpm run verify:p0.2
test -n "$COMPATIBILITY_URL"
pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:e2e:deployed
git diff --check
```

Record exact commands, exit codes, test counts, runtime labels, commit SHA, lockfile hash, and deployed workflow evidence. Do not repeat a successful expensive check unless relevant inputs change.

- [ ] **Step 2: Dispatch the required read-only reviewers**

Run three independent bounded reviewers against the same frozen candidate:

1. **Requirements reviewer:** approved P0.2 goal, acceptance, user decisions, no premature P0.3/profile work.
2. **Architecture/anti-overengineering reviewer:** proof placement, pure presentation, Cloudflare isolation, narrow boundary, package ownership, runtime distinctions, least complexity.
3. **Test-evidence reviewer:** meaningful RED/GREEN protection, harness authenticity, dev/preview/deployed separation, workflow/security evidence, accessibility claim boundary.

Reviewers may read but must not edit. No recursive fan-out. Treat their reports as fallible evidence and verify every material finding against the current tree.

- [ ] **Step 3: Repair only kept material findings**

For each finding, record severity, evidence, disposition, changed files, and focused verification. Use TDD for behavior changes. Commit repairs in small focused commits and stop for user review after each commit. Do not act on style preferences or speculative future architecture.

- [ ] **Step 4: Rerun only affected checks, then one coherent final verification**

If repairs changed relevant inputs, rerun affected focused checks and then the complete Task 8 Step 1 suite once against the final tree. If no repair changed the tree, do not repeat the already successful full suite.

- [ ] **Step 5: Write verification evidence**

The verification record must include:

- exact commit and lockfile hashes;
- final package/action versions and live-source revalidation date;
- local Node/pnpm versions;
- RED/GREEN history for each implemented behavior;
- install, ignored-build, audit, constitution, lint, typecheck, Next build, OpenNext build, harness, dev, preview, and deployed commands/results;
- GitHub workflow/run/environment facts and Cloudflare Worker/URL evidence approved for disclosure;
- reviewer identities/scopes/results and repair dispositions;
- known limitations and explicit non-proofs;
- statement that automation does not establish WCAG conformance or production readiness.

- [ ] **Step 6: Write the review packet**

The review packet must list:

- goal and approved scope;
- base/candidate/final commit identifiers;
- every changed file grouped by boundary;
- commands and results;
- deployed proof evidence;
- security/advisory evidence and remaining dependency risk;
- architecture and test review outcomes;
- risks, known limitations, deferred work, and P0.3 non-goals;
- source rollback, Worker rollback/deletion, GitHub environment cleanup, and secret rotation/revocation as separate procedures;
- exact final-diff approval request.

- [ ] **Step 7: Commit evidence and stop at Gate 3**

```bash
git add docs/implementation-evidence/2026-08-04-p0-2-compatibility-verification.md docs/review-packets/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md docs/compatibility/nextjs-cloudflare.md docs/roadmaps/program-roadmap.md
git diff --cached --check
git commit -m "docs: record P0.2 compatibility evidence"
git status --short --branch
```

Stop for explicit verified-final-diff approval. Do not begin P0.3, create a pull request, merge, publish a package, or deploy production behavior.

## Exit criteria

P0.2 is complete only when all of the following are true:

- exact Node/pnpm/framework/adapter/tool versions are committed and the frozen install succeeds;
- `next dev` behavior is verified and labeled as Node development;
- OpenNext produces a Worker and workerd preview passes;
- generated Cloudflare bindings are committed and `wrangler types --check` passes;
- strict TypeScript and ESLint flat config pass;
- an ordinary Vitest unit test protects nontrivial pure behavior;
- Wrangler's harness exercises the built Worker successfully;
- Playwright and axe pass against Next development, workerd preview, and the deployed non-production URL;
- the manual GitHub Actions workflow deploys the exact `main` commit to environment `compatibility` and Worker `egeria-scaffold-nextjs-cloudflare-proof`;
- official documentation, advisories, beta status, known limitations, and runtime distinctions are dated and recorded;
- all three required reviews are reconciled and material findings are repaired;
- the review packet states risks, deferred work, and separate source/provider recovery;
- no production profile, P0.3 package boundary, public package, `.egeria` state, or unrelated capability is implemented;
- the user explicitly approves the verified final diff.

## Plan self-review

- Every P0.2 acceptance item maps to an exact file, command, and exit criterion.
- All frozen versions and action SHAs are concrete; there are no `TODO`, `TBD`, “latest,” or unspecified dependency ranges.
- The TypeScript interfaces used by the adapter, route, tests, and presentation agree.
- The proof is outside `apps/*` and no speculative runtime/public package is created.
- Unit, built-Worker integration, Node development, workerd preview, and deployed checks are distinct.
- External-action authorization is separate from plan approval and local implementation.
- Accessibility automation is mandatory but its claim boundary is explicit.
- Source rollback, Worker rollback/deletion, and secret/environment cleanup are separate.
- Each focused implementation commit has a user stop gate, and final-diff approval remains separate.
