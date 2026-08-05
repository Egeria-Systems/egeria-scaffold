# P0.2 Next.js and Cloudflare Compatibility Verification Evidence

**Recorded:** 2026-08-04

**Status:** Gate 3 APPROVED — the user approved exact committed comparison `c90b7c2..818874bd212d3302938074a541e5bc1d0678ca42` after the implementation candidate passed local verification, the manual Ubuntu workflow, non-production Cloudflare deployment, workflow-deployed smoke tests, and an independent deployed smoke rerun. P0.2 is complete; P0.3 preparation and planning are authorized, while implementation remains separately plan-gated.

## Scope and candidate

- Repository: private `Egeria-Systems/egeria-scaffold`
- Comparison base: `c90b7c2` (completed P0.1 Gate 3)
- Deployed implementation candidate: `160b8ef261e69ec783ad93b7bfe69d932ba84541`
- Remote state at deployment: local `main`, `origin/main`, and GitHub's default branch resolved to the deployed candidate
- Lockfile SHA-256: `72fab6af3a327404e287094e99438b98f7a43007765a4a9e6255cc357dd637c7`
- Source plan SHA-256: `821c175a8ce8c8a46ff4ec75f855e5cc9c867e0dfa9988ee2865dadbf969829d`

P0.2 adds only the private compatibility workspace under `proofs/nextjs-cloudflare`, its documentation, structural contracts, and a manual non-production workflow. It adds no production profile, builder application, P0.3 package, public package, `.egeria` state, persistence, queue, email, identity, payments, analytics, observability, CRUD, or generated client repository.

## Exact toolchain

Local verification used Node.js `v22.23.0` and pnpm `11.20.0`. The final installed direct graph is:

- runtime: `@opennextjs/cloudflare@1.20.2`, `next@16.3.0`, `react@19.2.8`, `react-dom@19.2.8`;
- development: `wrangler@4.118.0`, `typescript@6.0.3`, `eslint@9.39.5`, `eslint-config-next@16.3.0`, `typescript-eslint@8.66.0`, `vitest@4.1.10`, `@playwright/test@1.62.1`, `@axe-core/playwright@4.12.1`, `@types/node@22.20.1`, `@types/react@19.2.18`, and `@types/react-dom@19.2.4`.

The final workflow pins:

- `actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803`;
- `pnpm/setup@c9883cc79df532ad1a7b81bf9ab944ceb090d65c`.

[`pnpm/setup@v2.0.0`](https://github.com/pnpm/setup/releases/tag/v2.0.0) was released on 2026-08-04 while deployment evidence was being gathered. Its upstream documentation makes it the successor for pnpm 11 and newer, installs the exact pnpm and JavaScript runtime versions, verifies the pnpm release checksum, and runs as a Node 24 action. The workflow therefore replaced the deprecated Node 20 `pnpm/action-setup` runtime and separate `actions/setup-node` step without changing the approved Node `22.23.0` or pnpm `11.20.0` matrix.

The [preparation evidence](2026-08-04-p0-2-compatibility-preparation.md) owns the dated official-documentation, registry, action-resolution, exact-version advisory, beta-status, and compatibility-limit revalidation. The final registry audit returned `No known vulnerabilities found`, and `pnpm peers check` returned `No peer dependency issues found`.

One narrow transitive override remains: `miniflare>undici: 7.29.0`. Wrangler's locked Miniflare dependency otherwise selected advisory-affected `undici@7.28.0`. The override must be reconsidered when Wrangler selects an equal or newer patched release.

## TDD and RED/GREEN history

| Increment | RED evidence | GREEN evidence |
|---|---|---|
| Workspace/toolchain | Constitution contracts failed for the absent pnpm pin, proof workspace, and private manifest | Frozen install succeeded; the then-current constitution suite passed |
| Typed copy/page | Vitest first failed on the missing copy parser, then on the missing pure presentation component | Four ordinary Vitest tests pass for valid copy, duplicate IDs, blank copy, and semantic rendering |
| Workerd boundary | Wrangler harness failed because `wrangler.jsonc` and the built Worker were absent | OpenNext produced `.open-next/worker.js`; one harness test passed through the production Worker |
| Browser/accessibility | Playwright first failed because configs were absent; the first dev run then found three animated Next development-overlay elements | The motion assertion was correctly scoped to application-owned `main`; four checks pass separately in Node development and workerd preview |
| Canonical docs | Three constitution contracts failed for the absent compatibility record, navigation, and proof boundary | The documentation/link suite passed |
| Workflow security | Constitution failed because the workflow was absent | Manual/main-only/minimum-permission/action-pin/secret-boundary checks passed |
| Deploy-only repair | The contract exposed `build && deploy` under Cloudflare credentials | The script deploys only the verified artifact; a mutation test rejects build work in the secret-bearing block |
| Clean-checkout binding order | Workflow run `30963809028` failed because `wrangler types --check` ran before `.open-next/worker.js` existed; a clean archived snapshot reproduced the mismatch | `668bec5` moved the type drift check after the OpenNext build; the clean snapshot and later Ubuntu workflows passed |
| Current setup action | Run `30963809028` warned that the old pnpm setup action's Node 20 runtime was deprecated and forced to Node 24; the updated constitution expectation failed against the old workflow | `8f0c38d` migrated to fully pinned `pnpm/setup@v2.0.0`; 12/12 constitution tests and the final workflow passed without the warning |
| pnpm deploy command collision | Run `30965223422` reached deployment but bare `pnpm --filter … deploy` invoked pnpm's built-in deploy command and failed with `ERR_PNPM_INVALID_DEPLOY_TARGET` | `6323292` invokes the package script explicitly with `run deploy`; the contract and mutation test pass, and later deployments succeeded |
| Edge propagation readiness | The first independent check immediately after run `30965456416` reached the prior edge version and received `Hello World!` instead of the runtime JSON | `160b8ef` polls the typed runtime-report condition for up to 60 seconds before browser assertions; the final workflow and independent rerun passed 4/4 |

The generated Wrangler declaration was narrowed to binding types with `--include-runtime=false`. The default generator emitted a 14,711-line unrelated runtime declaration containing trailing whitespace; the proof consumes only the generated binding contract. `wrangler types --check` confirms the committed output is current.

## Final local verification

The exact pnpm binary was selected explicitly because the surrounding desktop shell exposed a different bundled pnpm/Node pair. That local shell issue does not alter committed pins; GitHub Actions installs the exact pnpm version from its SHA-pinned action.

| Command | Exit/result | What it proves |
|---|---|---|
| `pnpm install --frozen-lockfile` | `0`; already up to date under pnpm `11.20.0` | Manifest/lock agreement |
| `pnpm audit --audit-level=moderate` | `0`; no known vulnerabilities | Current registry audit for the locked graph |
| `pnpm peers check` | `0`; no peer issues | Direct/peer graph compatibility |
| `pnpm run test:constitution` | `0`; 12/12 tests | Repository, documentation, workflow, and deploy-only contracts |
| `pnpm run verify:p0.2` | `0` on deployed candidate `160b8ef`; unit 4/4, harness 1/1, development 4/4, preview 4/4 | Complete local proof suite |
| `wrangler types ... --check` | `0`; types current | Binding generation drift |
| `eslint . --max-warnings 0` | `0` | Flat-config lint and Cloudflare import restriction |
| `tsc --noEmit` | `0` | Strict TypeScript configuration |
| ordinary Vitest unit test | `0`; 4/4 | Copy parser and pure presentation behavior |
| `next build` | `0`; `/`, `/_not-found`, `/api/compatibility` | Next.js App Router compilation; not runtime proof |
| `opennextjs-cloudflare build` | `0`; Worker emitted | OpenNext production artifact creation |
| Wrangler `createTestHarness()` | `0`; 1/1 | HTTP execution through the built Worker under workerd |
| Playwright development config | `0`; 4/4 | Node.js `next dev` browser, endpoint, axe, keyboard, reflow, and motion evidence |
| Playwright preview config | `0`; 4/4 | OpenNext workerd preview with the same bounded checks |
| Playwright deployed config | `0`; 4/4 in workflow run `30966212691`, then 4/4 in an independent local rerun | Public Worker response, bounded browser, and automated accessibility evidence |
| `git diff --check c90b7c2..160b8ef` | `0` | Committed implementation patch hygiene |

`pnpm ignored-builds` exited `0` but reported `Cannot identify as no node_modules found` when invoked at the root, package directory, and filtered package. That output is not counted as proof of an empty ignored-build set. Lifecycle-script control is instead evidenced by the committed exact `allowBuilds` list, frozen install, locked graph review, and successful clean Ubuntu workflow.

## Runtime and accessibility evidence boundaries

- `next dev` is Node.js development evidence.
- The OpenNext build alone is not runtime evidence.
- The Wrangler harness and OpenNext preview exercise workerd-compatible output.
- `/api/compatibility` reports the configured Cloudflare target boundary; it is not generic runtime introspection.
- Axe, keyboard focus, 320 CSS-pixel reflow, and reduced-motion checks are bounded automated evidence. They do not establish WCAG conformance, cross-browser support, assistive-technology compatibility, human usability, or production readiness.

## GitHub and Cloudflare external state

Verified external state after the user corrected the URL classification:

- workflow `Compatibility proof` is active as workflow ID `327419709`;
- environment `compatibility` exists and its custom deployment branch policy allows only `main`;
- its environment secrets are named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`;
- its sole environment variable is named `COMPATIBILITY_URL`; it is not retained as a secret;
- secret and variable values were not read, logged, committed, or copied into this evidence;
- [workflow run `30966212691`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/30966212691), job `92180621200`, completed successfully for exact commit `160b8ef261e69ec783ad93b7bfe69d932ba84541`;
- the run passed frozen installation, the complete Ubuntu verification suite, deployment, and the deployed Playwright/axe suite;
- the deployed non-production URL is `https://egeria-scaffold-nextjs-cloudflare-proof.bmarquiscom.workers.dev`;
- the resulting Cloudflare Worker version is `fddba63e-c0e9-497e-98c4-4942461fb753`;
- the workflow-deployed smoke suite passed 4/4, and a separate local rerun against the recorded URL passed 4/4.

The workflow has `contents: read`, manual dispatch only, `main` and environment enforcement, SHA-pinned actions, credential-free installation/build/local tests, and a deploy-only secret-bearing step. `COMPATIBILITY_URL` is exposed only to the post-deployment test step. The repository's current GitHub plan did not expose environment reviewer or prevent-self-review controls; that governance limitation does not weaken the verified branch and credential boundaries and does not establish production safety.

## Independent review reconciliation

### Requirements review

Three material documentation findings were retained and repaired in `93f3ca7`:

- stale workflow/environment status;
- the approved design still labeled proposed;
- the preparation table incorrectly implied that Volta could project-pin pnpm.

The reviewer found no implementation requirement defect. Its then-current deployed-evidence blocker was subsequently resolved by workflow run `30966212691` and the independent deployed smoke rerun.

### Architecture and anti-overengineering review

One high-confidence least-privilege finding was retained: the secret-bearing package script rebuilt before deployment. `93f3ca7` made deployment consume the already-verified artifact. A targeted follow-up found the static protection incomplete; `236d2ba` added exact invocation protection and a causal mutation test. The follow-up marked the finding resolved with no repair-caused material defect.

No other material architecture finding existed. Cloudflare isolation, pure presentation, narrow ownership, proof/app/package separation, copy externalization, runtime semantics, and P0.2 scope were accepted.

### Independent test-evidence review

The reviewer reported no material finding. The parser/presentation tests, built-Worker harness, Node/workerd separation, bounded accessibility checks, action and workflow security, and deploy-only artifact flow were considered meaningful. Its then-current missing-input and deployed-smoke blocker was subsequently resolved by the successful final workflow and independent deployed rerun.

## Known limitations and non-proofs

- The deployed Worker is a non-production compatibility proof. It does not establish a production profile, production readiness, production authorization, or a custom-domain deployment.
- The deployment log warned that Workers preview URLs defaulted on because `preview_urls` is not explicit in `wrangler.jsonc`; P0.2 did not require or verify a separate preview-URL policy.
- OpenNext does not support Node.js Middleware for this adapter; the proof adds none.
- Windows is not guaranteed or tested.
- Cloudflare Worker size limits still apply.
- The Workers Vitest pool remains beta and is intentionally excluded.
- Browser coverage is Chromium-only.
- No human accessibility evaluation was performed or required for this increment.

## Recovery boundaries

- **Source:** use revert commits and redeploy a previously verified commit through the same workflow; do not reset shared `main`.
- **Worker:** version rollback, redeployment, or deletion is a separate Cloudflare action requiring explicit authorization.
- **GitHub environment:** removal of the environment, branch policy, secrets, or variable is separate from source rollback.
- **Credentials:** revoke or rotate the Cloudflare token at the provider and replace/remove the GitHub environment secret separately.
- **Persistent data:** none exists in this stateless proof.

## Gate 3 disposition

The P0.2 technical exit evidence is complete for deployed implementation candidate `160b8ef261e69ec783ad93b7bfe69d932ba84541`. The user approved final committed comparison `c90b7c2..818874bd212d3302938074a541e5bc1d0678ca42`, closing P0.2 and authorizing P0.3 preparation and planning. P0.3 implementation still requires its exact-file plan approval.

Retain the private proof as a dependency, configuration, action, and Cloudflare compatibility regression canary. Retire it only when an equivalent maintained test surface replaces its Node development, built-Worker, workerd preview, deployed Worker, browser, and bounded accessibility evidence, with the canonical compatibility and architecture documents updated in the same approved change.
