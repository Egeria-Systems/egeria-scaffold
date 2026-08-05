# Next.js and Cloudflare Compatibility

## Status and evidence date

**Evidence date:** 2026-08-04

This P0.2 combination is accepted after verified-final-diff approval. The exact deployed implementation candidate passed local Node.js, Next.js, OpenNext, workerd harness, preview, Ubuntu workflow, non-production Worker, Chromium, and automated accessibility checks. Neither those results nor this document prove a production profile or production readiness.

The executable proof is the private workspace at [`proofs/nextjs-cloudflare`](../../proofs/nextjs-cloudflare/). Preparation evidence and the approved implementation plan remain separately reviewable in [implementation evidence](../implementation-evidence/2026-08-04-p0-2-compatibility-preparation.md) and the [P0.2 plan](../superpowers/plans/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md).

## Exact matrix

| Surface | Exact version or value |
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
| GitHub setup action | `pnpm/setup@c9883cc79df532ad1a7b81bf9ab944ceb090d65c` |
| Deployed implementation | `160b8ef261e69ec783ad93b7bfe69d932ba84541` |
| `pnpm-lock.yaml` SHA-256 | `72fab6af3a327404e287094e99438b98f7a43007765a4a9e6255cc357dd637c7` |

All package versions are exact. The workspace uses a one-day package maturity policy, a reviewed lifecycle-script allowlist, and the narrow `miniflare>undici: 7.29.0` security override recorded in the preparation evidence.

## What each check proves

- `pnpm run test:constitution` checks repository structure, pins, workspace privacy and boundaries, documentation links, and named architecture contracts. It does not execute Next.js or workerd.
- `test:unit` uses ordinary Vitest on Node.js to exercise copy validation and pure presentation rendering.
- `build` proves that Next.js can compile and type-check the App Router page and route. It is not runtime evidence.
- `test:e2e:dev` runs the page, route, keyboard focus, 320 CSS-pixel reflow, reduced-motion, and axe smoke checks against `next dev` on Node.js.
- `build:cloudflare` proves that OpenNext can produce `.open-next/worker.js`. A successful build alone does not prove Worker execution.
- `test:integration:cloudflare` sends an HTTP request through Wrangler's production-Worker harness and verifies the provider-neutral runtime-report response under workerd.
- `test:e2e:preview` runs the same browser and automated accessibility checks against the OpenNext workerd preview.
- `test:e2e:deployed` runs the shared smoke suite against `COMPATIBILITY_URL`. It first polls the typed runtime-report condition to tolerate edge propagation, then applies the same bounded browser and accessibility checks. The final workflow and an independent rerun both passed 4/4.

## Runtime distinctions

`next dev` runs the Next.js development path on Node.js. OpenNext build output is exercised by the Wrangler harness and preview under workerd-compatible execution. The deployed check separately exercises the non-production Cloudflare Worker.

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

Deployment is manual GitHub Actions work against the non-production GitHub environment `compatibility` and Worker `egeria-scaffold-nextjs-cloudflare-proof`. GitHub Actions is the sole deployment authority.

The manual workflow at [`.github/workflows/compatibility-proof.yml`](../../.github/workflows/compatibility-proof.yml) is pushed on `main` and recognized by GitHub Actions. The `compatibility` environment has an explicit `main`-only deployment policy. [Run `30966212691`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/30966212691) completed successfully for exact commit `160b8ef261e69ec783ad93b7bfe69d932ba84541`, deployed Worker version `fddba63e-c0e9-497e-98c4-4942461fb753` at `https://egeria-scaffold-nextjs-cloudflare-proof.bmarquiscom.workers.dev`, and passed the deployed smoke suite 4/4. An independent deployed rerun also passed 4/4.

The environment contains `CLOUDFLARE_API_TOKEN` as an environment secret with the narrow Workers Scripts edit permission for the target account, `CLOUDFLARE_ACCOUNT_ID` as an environment secret, and `COMPATIBILITY_URL` as its sole environment variable. Values must never be committed or copied into logs or evidence. Secret access is restricted to the deploy-only step, which publishes the previously verified OpenNext artifact without rebuilding it; the URL variable is exposed only to the post-deployment test step. The workflow runs only from `main`, and environment reviewers or other protection rules should be enabled when the private repository's current GitHub plan exposes them.

Source recovery uses a revert commit. Cloudflare rollback or Worker deletion is a separate external action and requires explicit authorization. P0.2 has no persistent data to recover.

## Revalidation triggers

Revalidate the full matrix and current official documentation when any of these changes:

- Node.js, pnpm, Next.js, React, OpenNext, Wrangler, TypeScript, ESLint, Vitest, Playwright, or axe version;
- the Cloudflare compatibility date or a documented OpenNext/Workers limitation;
- a pinned GitHub Actions commit SHA or deployment environment contract;
- the lockfile, lifecycle-script allowlist, or transitive security override;
- a new material security advisory affecting any selected or transitive dependency.

Retain this private proof as the compatibility regression canary for those changes. Retire it only when an equivalent maintained surface replaces its Node development, built-Worker, workerd preview, deployed Worker, browser, and bounded accessibility evidence, and update this record plus the architecture owners in the same approved change.
