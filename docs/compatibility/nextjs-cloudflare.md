# Next.js and Cloudflare Compatibility

## Status and evidence date

**Evidence date:** 2026-08-13

This P0.2 combination is accepted after verified-final-diff approval. The original implementation candidate passed local Node.js, Next.js, OpenNext, workerd harness, preview, Ubuntu workflow, non-production Worker, Chromium, and automated accessibility checks under Node `22.23.0`.

The initial Node `22.23.2` revalidation is local-only. On 2026-08-06, the current candidate passed the frozen install, dependency audit, Next.js and OpenNext builds, workerd integration harness, development and preview browser checks, and the selected automated accessibility checks. No workflow was dispatched and no Worker was deployed for that patch update.

On 2026-08-13, Repository quality [run `31742910235`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31742910235) passed the complete `compatibility-proof` job for exact commit `05fc743e5e24801d6e16e2ed89a8962397272238`, proof Wrangler `4.120.1`, and its frozen lockfile. The job passed frozen installation, lint, typecheck, unit behavior, Next.js build, OpenNext build, generated Cloudflare types, Cloudflare harness integration, Chromium installation, development-browser behavior, and OpenNext-preview browser behavior. It did not deploy a Worker. Historical deployed evidence remains on Node `22.23.0` at commit `160b8ef261e69ec783ad93b7bfe69d932ba84541`, whose proof used Wrangler `4.118.0`. Neither the local, hosted, nor deployed results prove a production profile, production readiness, or WCAG conformance.

The executable proof is the private workspace at [`proofs/nextjs-cloudflare`](../../proofs/nextjs-cloudflare/). Its package manifest and the root manifest own the current exact executable versions; the current workflows own their action pins and deployment contract. Preparation evidence and the approved implementation plan remain separately reviewable as private local workflow artifacts ignored by Git.

## Accepted evidence snapshot

| Surface | Exact version or value |
|---|---|
| Evidence date | `2026-08-13` |
| Repository quality run | `31742910235` |
| Implementation commit | `05fc743e5e24801d6e16e2ed89a8962397272238` |
| `pnpm-lock.yaml` SHA-256 | `71444e493ea0d4f2c2011fddcf2dd8b9b339335afafd56dd765e0c50878c126d` |
| Node.js | `22.23.2` |
| pnpm | `11.20.0` |
| Next.js | `16.3.0` |
| React / React DOM | `19.2.8` |
| OpenNext Cloudflare | `1.20.2` |
| Wrangler | `4.120.1` |
| TypeScript | `6.0.3` |
| ESLint | `9.39.5` |
| Next ESLint config | `16.3.0` |
| typescript-eslint | `8.66.0` |
| Vitest | `4.1.10` |
| Playwright | `1.62.1` |
| axe Playwright adapter | `4.12.1` |
| Cloudflare compatibility date | `2026-08-04` |
| Historical deployed GitHub environment | `compatibility` |
| Historical deployed Cloudflare Worker | `egeria-scaffold-nextjs-cloudflare-proof` |
| Accepted shared GitHub environment | `test-deploy` |
| Accepted shared Cloudflare Worker | `test-deploy` |
| Accepted manual deployment checkout action | `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` |
| Accepted manual deployment setup action | `pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2` |
| Accepted manual deployment revision binding | required `expected_revision`; `refs/heads/main`; lowercase 40-hex input; `GITHUB_SHA` and checked-out `HEAD` equality |
| Accepted manual deployment checkout | `${{ github.sha }}`; full history; persisted credentials disabled |
| Accepted manual deployment pnpm cache | disabled |
| Accepted manual deployment timeout | 45 minutes |
| Deployed Node.js | `22.23.0` |
| Deployed implementation | `160b8ef261e69ec783ad93b7bfe69d932ba84541` |
| Deployed `pnpm-lock.yaml` SHA-256 | `72fab6af3a327404e287094e99438b98f7a43007765a4a9e6255cc357dd637c7` |

The table is the immutable package, workflow, and deployment snapshot for the accepted hosted evidence named above. It does not mirror later manifest or workflow updates. A newer dependency has current compatibility evidence only from checks that ran against that exact revision until a separately approved evidence refresh replaces this snapshot.

All package versions in this snapshot are exact. Current package versions remain exact in their executable manifests. The workspace uses a one-day package maturity policy, a reviewed lifecycle-script allowlist, and the narrow `miniflare>undici: 7.29.0` security override recorded in the preparation evidence.

## What each check proves

- `pnpm run test:constitution` checks repository structure, pins, workspace privacy and boundaries, documentation links, and named architecture contracts. It does not execute Next.js or workerd.
- `test:unit` uses ordinary Vitest on Node.js to exercise copy validation and pure presentation rendering.
- `build` proves that Next.js can compile and type-check the App Router page and route and emit standalone output traced from the workspace root. It is not runtime evidence.
- `test:e2e:dev` runs the page, route, keyboard focus, 320 CSS-pixel reflow, reduced-motion, and axe smoke checks against `next dev` on Node.js.
- `build:cloudflare` remains the standalone convenience command proving that OpenNext can produce `.open-next/worker.js`. In combined verification, the preceding standalone Next output is transformed with `opennextjs-cloudflare build --skipNextBuild` so Next is not rebuilt. A successful build alone does not prove Worker execution.
- `test:integration:cloudflare` sends an HTTP request through Wrangler's production-Worker harness and verifies the provider-neutral runtime-report response under workerd.
- `test:e2e:preview` starts OpenNext preview directly from already prepared `.open-next` output and runs the same browser and automated accessibility checks under workerd.
- `test:e2e:deployed` runs the shared smoke suite against `COMPATIBILITY_URL`. It first polls the typed runtime-report condition to tolerate edge propagation, then applies the same bounded browser and accessibility checks. The final workflow and an independent rerun both passed 4/4.

## Runtime distinctions

`next dev` runs the Next.js development path on Node.js. OpenNext build output is exercised by the Wrangler harness and preview under workerd-compatible execution. The deployed check separately exercises the non-production Cloudflare Worker.

The current automatic root workflow consolidates ordinary proof quality with repository and generated-project quality while preserving a stable `compatibility-proof` job. Reusable pnpm caches are disabled. Validated job-level scoping may skip the proof only when neither proof nor shared inputs changed; invalid revision or diff state runs it. This local/static workflow contract does not claim a hosted run, required-check configuration, or deployed result. The historical workflow and deployment evidence below remains unchanged.

The `/api/compatibility` response is a target-boundary report. It reads the configured `PROOF_ENVIRONMENT` binding through the Cloudflare adapter and returns the declared target runtime. It is not general-purpose runtime introspection and must not be used to imply that `next dev` itself runs under workerd.

## Known limitations

- OpenNext documents Node.js Middleware as unsupported for this adapter. The proof adds no middleware.
- Windows support is not guaranteed by OpenNext and has not been tested here.
- Cloudflare Worker bundle-size limits still apply; this small proof does not establish capacity for a production application.
- Cloudflare's Workers Vitest pool remains open beta and has known coverage, timer, module, and storage limitations. P0.2 deliberately uses ordinary Vitest plus Wrangler's production-Worker harness instead.
- The deployment log warned that Workers preview URLs defaulted on because `preview_urls` is not explicit in `wrangler.jsonc`; P0.2 did not require or verify a separate preview-URL policy.
- Browser smoke coverage is Chromium-only. It does not establish cross-browser compatibility.
- The proof contains one page and one API route. It implements no production profile, builder application, data store, queue, email, identity, payments, analytics, observability, or CRUD behavior.

## Accessibility evidence and claim boundary

The shared Playwright suite checks a selected axe ruleset, keyboard focus, 320 CSS-pixel reflow, and reduced-motion behavior against development, preview, and the deployed URL. These automated results are bounded evidence only. They do not establish WCAG conformance, human usability, assistive-technology compatibility, or a default human evaluation gate.

## Deployment boundary

Deployment is manual GitHub Actions work. GitHub Actions is the sole deployment authority. The current workflow uses the non-production `test-deploy` environment, public `DEPLOY_URL` variable, and exact `test-deploy` Worker under the eligibility, protection, serialization, lease, cleanup, and recovery rules in the [shared test deployment policy](../governance/shared-test-deployment.md).

The current manual workflow requires an explicitly approved exact lowercase 40-hex `main` revision, checks out `${{ github.sha }}` with full history and persisted credentials disabled, validates the ref, dispatch input, `GITHUB_SHA`, and checked-out `HEAD` before installation, disables the reusable pnpm cache, and bounds the job to 45 minutes. Local static validation of these controls does not prove GitHub-hosted execution, deployment, provider behavior, certification, publication, cleanup execution, or production safety.

The historical deployment evidence is unchanged: the manual workflow at [`.github/workflows/compatibility-proof.yml`](../../.github/workflows/compatibility-proof.yml) ran from `main` through the earlier `compatibility` environment. [Run `30966212691`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/30966212691) completed successfully for exact commit `160b8ef261e69ec783ad93b7bfe69d932ba84541`, whose proof used Wrangler `4.118.0`; it deployed Worker version `fddba63e-c0e9-497e-98c4-4942461fb753` at the historical proof Worker and passed the deployed smoke suite 4/4. An independent deployed rerun also passed 4/4. These historical identities are evidence facts, not the current deployment target.

For a current run, the workflow references only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, restricts them to the deploy-only step, publishes the previously verified OpenNext artifact to the explicit `test-deploy` target without rebuilding it under credentials, and maps `DEPLOY_URL` only to the post-deployment test interface. The shared environment may also hold the two source-specific Better Stack names allowed by the shared policy, but the compatibility workflow must not reference them. Values must never be committed or copied into logs or evidence. A run is blocked until the live environment's `main` restriction, available protection rules, bypass decision, URL-to-Worker match, credential scope and expiry, quota, and owners pass a fresh read-only preflight.

Source recovery uses a revert commit. Cloudflare rollback, clean-baseline deployment, credential disposition, legacy-environment deletion, and any Worker deletion are separate external actions and require explicit authorization. The current cleanup target is a clean compatibility baseline on the retained shared Worker, not deletion of that reusable Worker. P0.2 has no persistent data to recover.

## Revalidation triggers

Revalidate the current executable subject and current official documentation when any of these changes:

- Node.js, pnpm, Next.js, React, OpenNext, Wrangler, TypeScript, ESLint, Vitest, Playwright, or axe version;
- the Cloudflare compatibility date or a documented OpenNext/Workers limitation;
- a pinned GitHub Actions commit SHA or deployment environment contract;
- the lockfile, lifecycle-script allowlist, or transitive security override;
- a new material security advisory affecting any selected or transitive dependency.

These triggers require exact-revision executable evidence; they do not rewrite or extend the accepted snapshot automatically. Replacing the snapshot requires a separately approved record that binds one evidence date, exact commit, hosted run, and lockfile identity to the replacement matrix.

Retain this private proof as the compatibility regression canary for those changes. Retire it only when an equivalent maintained surface replaces its Node development, built-Worker, workerd preview, deployed Worker, browser, and bounded accessibility evidence. Update this record plus the architecture owners in the same approved change whenever the accepted snapshot or its ownership changes.
