# P0.2 Next.js and Cloudflare Compatibility Proof Design

**Status:** Proposed for written-spec review

**Date:** 2026-08-04

**Approved decisions:** The proof is a long-lived private workspace under `proofs/nextjs-cloudflare`. The GitHub environment is `compatibility`. The Cloudflare Worker is `egeria-scaffold-nextjs-cloudflare-proof`. Clean sequential work continues on `main`; parallel work or materially useful isolation requires a dedicated branch and isolated worktree.

## Goal

Create the smallest executable, deployed proof that the selected Node.js, pnpm, Next.js App Router, OpenNext Cloudflare adapter, Wrangler, TypeScript, ESLint, Vitest, Playwright, and axe combination works:

1. under local `next dev` in Node.js;
2. as an OpenNext production build under local `workerd`;
3. through a Cloudflare runtime integration test exercising the production Worker build;
4. at one non-production `workers.dev` URL deployed only by GitHub Actions.

The proof remains executable after P0.2 so later upgrades can rerun the same compatibility boundary.

## Non-goals

P0.2 does not implement a production profile, generated client repository, builder CLI, builder core, public package, `.egeria` schema or state, database, queue, email, identity, payment, analytics, observability provider, CMS, contact flow, business CRUD, Tailwind design system, visual-regression service, or production deployment.

The proof page is evidence UI, not a portfolio, site, app, or authenticated app. It must not be reused as a hidden profile template.

## Approaches considered

### 1. Production-build harness plus separate Node unit tests — selected

Use ordinary Vitest in Node.js for a pure content-contract unit test. Build the Next.js application with OpenNext, then use Wrangler's `createTestHarness()` from a Vitest integration test to send HTTP requests through the configured production Worker. Use Playwright against both `next dev` and OpenNext preview; the preview run includes axe.

This follows Cloudflare's live 2026-07-27 testing guidance, exercises the production Worker artifact, and avoids making an open-beta test pool the sole runtime proof.

### 2. Cloudflare Workers Vitest pool

Install `@cloudflare/vitest-pool-workers` and run the Cloudflare test inside its workerd pool. Cloudflare recommends the pool for fast Worker unit tests, but its live known-issues page still labels it open beta and records coverage, fake-timer, module-resolution, and storage-isolation limitations. P0.2 has no binding-heavy domain unit to justify accepting that beta dependency.

### 3. Preview and browser tests only

Run Playwright against `opennextjs-cloudflare preview` without a programmatic Worker integration test. This is lean, but it cannot isolate the runtime endpoint contract from browser behavior and does not satisfy the separately required Cloudflare runtime integration layer.

## Repository boundary

The canonical P0.2 path is:

```text
proofs/
└── nextjs-cloudflare/
```

The root workspace adds `proofs/*`. The proof package is named `@egeria-systems/nextjs-cloudflare-proof` and declares `private: true`.

`apps/*` remains reserved for actual builder applications, beginning with `apps/cli` in P0.3. `packages/*` remains reserved for package boundaries approved in P0.3. Generated client repositories remain separate repositories with `apps/web`; the proof does not create or simulate that tree.

`docs/architecture/overview.md` is the canonical owner of this boundary. The program roadmap and compatibility record link to it. `proofs/nextjs-cloudflare/AGENTS.md` supplies scoped implementation rules without duplicating the full lifecycle.

## Version-selection policy

Versions are exact, committed in manifests and `pnpm-lock.yaml`, and refreshed once more immediately before the dependency lock is created. A tag moving after plan approval does not silently change the candidate.

The initial matrix from live, cache-revalidated official pages and current registry metadata on 2026-08-04 is:

| Tool | Candidate | Reason |
|---|---:|---|
| Node.js | `22.23.0` | User-approved existing pin; official June 2026 security release for Node 22 |
| pnpm | `11.20.0` | Current stable registry release; supports Node `>=22.13` |
| Next.js | `16.3.0` | Current stable release; OpenNext states all Next.js 16 minor/patch versions are supported |
| React / React DOM | `19.2.8` | Current stable matching pair accepted by Next.js 16.3 |
| `@opennextjs/cloudflare` | `1.20.2` | Current stable adapter; peer range accepts Next.js `>=16.2.11` and Wrangler `^4.86.0` |
| Wrangler | `4.118.0` | Current stable release; exports `createTestHarness()` and supports generated runtime/binding types |
| TypeScript | `6.0.3` | Latest version inside current `typescript-eslint` peer range `<6.1.0`; TypeScript 7.0.2 is intentionally not selected |
| ESLint | `9.39.5` | Current maintained ESLint 9 release; the Next.js plugin graph does not yet accept ESLint 10 |
| `eslint-config-next` | `16.3.0` | Exact match for Next.js |
| Vitest | `4.1.10` | Current stable release |
| Playwright | `1.62.1` | Current stable release; Chromium only for this proof |
| `@axe-core/playwright` | `4.12.1` | Current stable Playwright integration |
| `@types/node` | `22.20.1` | Current Node 22 type line |
| `@types/react` | `19.2.18` | Current React 19 type release |
| `@types/react-dom` | `19.2.4` | Current React DOM 19 type release |

The latest package is not selected when its consumers do not currently accept it. That is why TypeScript 7 is excluded. If the live pre-lock refresh changes a version or peer range, implementation stops for a plan amendment instead of silently upgrading or downgrading.

The root manifest adds exact `packageManager: pnpm@11.20.0`; `.nvmrc` and Volta continue to agree on Node `22.23.0`. `pnpm-workspace.yaml` explicitly retains pnpm 11's one-day package maturity policy and records the narrow reviewed dependency-build allowlist needed by the locked graph. Unreviewed install scripts remain blocked.

Implementation revalidation corrected two preparation assumptions without changing the design: Volta `2.0.2` cannot project-pin pnpm, so pnpm is pinned by `packageManager` plus pnpm 11 `pmOnFail: error`; and `pnpm peers check` showed that the plugins shipped by `eslint-config-next@16.3.0` accept ESLint 9 but not ESLint 10, so the exact compatible candidate is ESLint `9.39.5`. The first transitive audit also found Wrangler's exact Miniflare dependency pinned vulnerable `undici@7.28.0`; the workspace therefore owns one narrow `miniflare>undici` override to the advisory-cleared, same-major `7.29.0` security release, protected by audit and runtime integration tests.

## Proof application

The App Router proof has only two behaviors:

- `/` renders a semantic evidence page from validated `en-CA` content;
- `/api/compatibility` returns a small JSON runtime report obtained through a Cloudflare-only adapter.

All visible text, metadata, accessibility names, and state labels originate in `content/en-CA.json`. A small parser validates the content shape. The page and layout remain presentation-only consumers of typed content.

The route handler contains no Cloudflare type. It calls `src/infrastructure/cloudflare/read-compatibility-runtime.ts`, the only application source allowed to import `getCloudflareContext` or refer to `CloudflareEnv`. The adapter reads the non-secret `PROOF_ENVIRONMENT` binding and returns provider-neutral data:

```ts
interface CompatibilityRuntimeReport {
  environment: string;
  runtime: "workerd";
}
```

The Wrangler configuration uses:

- Worker name `egeria-scaffold-nextjs-cloudflare-proof`;
- compatibility date `2026-08-04`;
- `nodejs_compat`;
- `.open-next/worker.js` as the Worker entry;
- `.open-next/assets` through the `ASSETS` binding;
- non-secret `PROOF_ENVIRONMENT: "compatibility"`.

`wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts` generates the binding declarations. CI runs the same command with `--check` to detect drift. P0.2 excludes the unrelated full runtime declaration bundle: the installed Wrangler generator emitted trailing whitespace in that generated surface, while this proof consumes only the binding contract.

## Local and runtime verification

The proof defines distinct commands because each supplies different evidence:

1. `test:unit` runs the content parser with ordinary Vitest in Node.js.
2. `typecheck` runs strict TypeScript without emitting output.
3. `lint` runs ESLint flat config with zero warnings and restricts Cloudflare imports to the adapter, generated configuration, integration tests, and composition/configuration entry points.
4. `build:next` runs the ordinary Next.js production build.
5. `build:cloudflare` runs the OpenNext Cloudflare build.
6. `test:integration:cloudflare` builds once, starts `createTestHarness()` from Wrangler, and asserts `/api/compatibility` through the production Worker artifact.
7. `test:e2e:dev` starts `next dev` through Playwright's web-server control and verifies the evidence page and endpoint.
8. `test:e2e:preview` starts OpenNext preview under workerd and verifies the page, endpoint, keyboard focus, reduced-motion rendering, reflow viewport, and an axe scan.
9. `test:e2e:deployed` runs the same smoke and axe contract against the configured non-production URL without starting a local server.

Playwright installs only its pinned Chromium build. Passing axe and the scripted checks is automated accessibility evidence, not a WCAG conformance claim or proof of overall usability.

## Deployment authority and external prerequisites

`.github/workflows/compatibility-proof.yml` is the only deployment path. It is manual (`workflow_dispatch`), accepts only `refs/heads/main`, grants `contents: read`, runs one deployment at a time through concurrency group `compatibility`, verifies the locked tree before deployment, deploys with the OpenNext CLI, and runs deployed Playwright/axe smoke afterward.

The workflow uses GitHub environment `compatibility` and Cloudflare Worker `egeria-scaffold-nextjs-cloudflare-proof`. It needs these externally configured values:

- secret `CLOUDFLARE_API_TOKEN`, scoped to the selected account and only the Worker permissions required by the exact deployment;
- secret `CLOUDFLARE_ACCOUNT_ID`;
- variable `COMPATIBILITY_URL`, the exact `https://egeria-scaffold-nextjs-cloudflare-proof.<account-subdomain>.workers.dev` URL.

No value is committed, logged, or copied into evidence. GitHub environment creation, secret/variable mutation, pushing `main`, triggering the workflow, and Cloudflare deployment are separate external actions. The implementation plan must stop for explicit authorization before any of them.

The repository is currently private, Actions is enabled, no GitHub environment exists, no default remote branch exists, and repository settings do not require action SHA pinning. The workflow nevertheless pins every referenced action to a reviewed full commit SHA and declares least-privilege workflow permissions. Actual environment branch restrictions and reviewer controls must be queried and recorded; unavailable private-repository protection features are documented rather than claimed.

## Evidence and documentation

`docs/compatibility/nextjs-cloudflare.md` becomes the durable compatibility record for:

- the exact locked matrix;
- source URLs and live retrieval timestamps;
- Next dev versus workerd preview distinctions;
- OpenNext and Cloudflare limitations;
- the excluded open-beta Workers Vitest pool;
- Windows support limitations;
- generated binding-type ownership;
- local, integration, preview, and deployment commands;
- deployed URL and workflow-run evidence after authorized deployment;
- properties not proved by this narrow application.

`docs/implementation-evidence/2026-08-04-p0-2-compatibility-preparation.md` records Gate 1 repository, live-documentation, registry, advisory, GitHub, and Cloudflare-environment evidence. A later verification record and review packet capture implementation and deployment results.

README, architecture overview, enforcement map, and roadmap are updated in the same increment so later agents discover the proof through canonical links rather than inferring a product app.

## Security and advisory verification

Before locking, query the current GitHub Advisory Database for every direct package candidate and run the package manager's current audit/signature checks after the exact lockfile exists. Direct-package queries returning no advisory do not clear transitive dependencies; the locked graph must be scanned.

The deployment workflow uses no pull-request secrets, no production environment, no broad `GITHUB_TOKEN` write permission, and no Cloudflare dashboard deployment path. The API token is an environment secret and is scoped to one account. Logs and evidence must be reviewed for accidental secret or account-data disclosure before the packet is committed.

## Failure and recovery

Compatibility is an all-layer result. A failed install, peer resolution, type generation, lint, typecheck, Next dev smoke, OpenNext build, workerd integration, preview browser check, axe check, workflow, deployment, or deployed smoke blocks P0.2. The controller records the failure and amends the approved matrix or plan; it does not weaken a gate or substitute local evidence for deployed proof.

Source recovery uses ordinary revert commits. Deployment recovery is separate: the prior deployed Worker version is retained according to Cloudflare's available version history, and Worker deletion or rollback requires separate external authorization. There is no persistent data or provider resource beyond the non-production Worker in P0.2.

## Completion criteria

P0.2 reaches Gate 3 only when:

- the exact lockfile and package-manager pin are committed;
- all local deterministic checks pass;
- `next dev` and OpenNext workerd preview are both exercised and distinguished;
- generated binding types are current;
- the production Worker build passes the Cloudflare harness test;
- Chromium Playwright and axe pass locally against preview;
- GitHub Actions alone deploys the proof to the approved non-production Worker;
- deployed Playwright/axe smoke passes at `COMPATIBILITY_URL`;
- current limitations and evidence boundaries are documented;
- required independent reviewers return no unresolved material finding;
- the review packet records source and deployment recovery separately;
- no production profile or P0.3 package boundary has been implemented.
