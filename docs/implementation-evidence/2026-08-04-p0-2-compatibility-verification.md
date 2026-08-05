# P0.2 Next.js and Cloudflare Compatibility Verification Evidence

**Recorded:** 2026-08-04

**Status:** Gate 3 NOT READY — local evidence and reviews are complete, but the user-controlled GitHub environment inputs are absent. No workflow run, Cloudflare Worker deployment, or deployed smoke result exists.

## Scope and candidate

- Repository: private `Egeria-Systems/egeria-scaffold`
- Comparison base: `c90b7c2` (completed P0.1 Gate 3)
- Verified implementation candidate: `236d2bace3b7513873998cbde6aee6c15bf1b2b2`
- Remote state: local `main`, `origin/main`, and GitHub's default branch all resolve to the candidate
- Lockfile SHA-256: `72fab6af3a327404e287094e99438b98f7a43007765a4a9e6255cc357dd637c7`
- Source plan SHA-256: `821c175a8ce8c8a46ff4ec75f855e5cc9c867e0dfa9988ee2865dadbf969829d`

P0.2 adds only the private compatibility workspace under `proofs/nextjs-cloudflare`, its documentation, structural contracts, and a manual non-production workflow. It adds no production profile, builder application, P0.3 package, public package, `.egeria` state, persistence, queue, email, identity, payments, analytics, observability, CRUD, or generated client repository.

## Exact toolchain

Local verification used Node.js `v22.23.0` and pnpm `11.20.0`. The final installed direct graph is:

- runtime: `@opennextjs/cloudflare@1.20.2`, `next@16.3.0`, `react@19.2.8`, `react-dom@19.2.8`;
- development: `wrangler@4.118.0`, `typescript@6.0.3`, `eslint@9.39.5`, `eslint-config-next@16.3.0`, `typescript-eslint@8.66.0`, `vitest@4.1.10`, `@playwright/test@1.62.1`, `@axe-core/playwright@4.12.1`, `@types/node@22.20.1`, `@types/react@19.2.18`, and `@types/react-dom@19.2.4`.

The workflow pins:

- `actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803`;
- `pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa`;
- `actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444`.

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

The generated Wrangler declaration was narrowed to binding types with `--include-runtime=false`. The default generator emitted a 14,711-line unrelated runtime declaration containing trailing whitespace; the proof consumes only the generated binding contract. `wrangler types --check` confirms the committed output is current.

## Final local verification

The exact pnpm binary was selected explicitly because the surrounding desktop shell exposed a different bundled pnpm/Node pair. That local shell issue does not alter committed pins; GitHub Actions installs the exact pnpm version from its SHA-pinned action.

| Command | Exit/result | What it proves |
|---|---|---|
| `pnpm install --frozen-lockfile` | `0`; already up to date under pnpm `11.20.0` | Manifest/lock agreement |
| `pnpm audit --audit-level=moderate` | `0`; no known vulnerabilities | Current registry audit for the locked graph |
| `pnpm peers check` | `0`; no peer issues | Direct/peer graph compatibility |
| `pnpm run test:constitution` | `0`; 12/12 tests | Repository, documentation, workflow, and deploy-only contracts |
| `pnpm run verify:p0.2` | `0` on repaired implementation candidate `93f3ca7`; the only later change added the constitution mutation test | Complete local proof suite |
| `wrangler types ... --check` | `0`; types current | Binding generation drift |
| `eslint . --max-warnings 0` | `0` | Flat-config lint and Cloudflare import restriction |
| `tsc --noEmit` | `0` | Strict TypeScript configuration |
| ordinary Vitest unit test | `0`; 4/4 | Copy parser and pure presentation behavior |
| `next build` | `0`; `/`, `/_not-found`, `/api/compatibility` | Next.js App Router compilation; not runtime proof |
| `opennextjs-cloudflare build` | `0`; Worker emitted | OpenNext production artifact creation |
| Wrangler `createTestHarness()` | `0`; 1/1 | HTTP execution through the built Worker under workerd |
| Playwright development config | `0`; 4/4 | Node.js `next dev` browser, endpoint, axe, keyboard, reflow, and motion evidence |
| Playwright preview config | `0`; 4/4 | OpenNext workerd preview with the same bounded checks |
| `git diff --check` / final status | `0`; clean tracked tree | Patch hygiene and preserved state |

`pnpm ignored-builds` exited `0` but reported `Cannot identify as no node_modules found` when invoked at the root, package directory, and filtered package. That output is not counted as proof of an empty ignored-build set. Lifecycle-script control is instead evidenced by the committed exact `allowBuilds` list, frozen install, locked graph review, and runtime checks; a clean Ubuntu workflow run remains required.

## Runtime and accessibility evidence boundaries

- `next dev` is Node.js development evidence.
- The OpenNext build alone is not runtime evidence.
- The Wrangler harness and OpenNext preview exercise workerd-compatible output.
- `/api/compatibility` reports the configured Cloudflare target boundary; it is not generic runtime introspection.
- Axe, keyboard focus, 320 CSS-pixel reflow, and reduced-motion checks are bounded automated evidence. They do not establish WCAG conformance, cross-browser support, assistive-technology compatibility, human usability, or production readiness.

## GitHub and Cloudflare external state

Verified GitHub facts:

- workflow `Compatibility proof` is active as workflow ID `327419709`;
- environment `compatibility` exists;
- its custom deployment branch policy allows only `main`;
- environment secret list is empty;
- environment variable list is empty;
- workflow run list is empty;
- no Cloudflare Worker or deployed URL has been verified.

Required user-controlled inputs are environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, plus environment variable `COMPATIBILITY_URL`. Their values must be set directly in GitHub and must not be sent in chat, committed, logged, or copied into this evidence.

The workflow deliberately has `contents: read`, manual dispatch only, `main` and environment enforcement, SHA-pinned actions, credential-free installation/build/local tests, and a deploy-only secret-bearing step. It must not be dispatched until all three inputs exist.

## Independent review reconciliation

### Requirements review

Three material documentation findings were retained and repaired in `93f3ca7`:

- stale workflow/environment status;
- the approved design still labeled proposed;
- the preparation table incorrectly implied that Volta could project-pin pnpm.

The reviewer found no implementation requirement defect and confirmed that deployed exit remained blocked.

### Architecture and anti-overengineering review

One high-confidence least-privilege finding was retained: the secret-bearing package script rebuilt before deployment. `93f3ca7` made deployment consume the already-verified artifact. A targeted follow-up found the static protection incomplete; `236d2ba` added exact invocation protection and a causal mutation test. The follow-up marked the finding resolved with no repair-caused material defect.

No other material architecture finding existed. Cloudflare isolation, pure presentation, narrow ownership, proof/app/package separation, copy externalization, runtime semantics, and P0.2 scope were accepted.

### Independent test-evidence review

The reviewer reported no material finding. The parser/presentation tests, built-Worker harness, Node/workerd separation, bounded accessibility checks, action and workflow security, and deploy-only artifact flow were considered meaningful. The reviewer independently identified the missing environment inputs and deployed smoke as the P0.2 exit blocker.

## Known limitations and non-proofs

- No clean Ubuntu GitHub Actions run exists yet.
- No credentialed deploy, Worker version, public URL response, or deployed Playwright/axe result exists.
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

## Blocker and next evidence

P0.2 cannot close Gate 3 until all three GitHub environment inputs are configured, the manual workflow succeeds for the exact final `main` commit, and an independent local deployed Playwright run passes against the recorded URL. After that run, amend this record with the workflow/run IDs, job conclusions, deployed URL approved for disclosure, Worker evidence, deployed 4/4 result, and final commit/hash state.
