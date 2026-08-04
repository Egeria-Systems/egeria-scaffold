# P0.2 Next.js and Cloudflare Compatibility Preparation Evidence

**Recorded:** 2026-08-04

**Scope:** Read-only repository inspection and live official-source revalidation before implementation of P0.2.

**Implementation status:** Not started. This record does not prove installation, local runtime behavior, workerd behavior, accessibility, deployment, or production readiness.

## Approved increment

P0.2 will create the smallest executable and deployed compatibility proof for the selected Node.js, pnpm, Next.js App Router, OpenNext Cloudflare adapter, Wrangler, TypeScript, ESLint, Vitest, Playwright, and axe combination. The proof is infrastructure evidence, not a builder application or production profile, and will live at `proofs/nextjs-cloudflare` rather than under `apps/*`.

The approved design is:

`docs/superpowers/specs/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof-design.md`

Approved design SHA-256 before implementation revalidation amendments:

`a0fd3ea222cb7fe05d5f7d2c70f854d01b68715842af445037068481e205f4d4`

Current amended design SHA-256 after recording the Volta/pnpm, ESLint, and transitive Undici findings:

`713892ed50fd39a2dc7e265fefa4e30b8844d8a9ba91c6cbe5c39536c241807b`

## Repository and Git evidence

Working directory: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`

| Check | Command | Result |
|---|---|---|
| Current branch and state | `git status --short --branch` | Clean local `main` |
| Current commit | `git log -1 --oneline --decorate` | `2fa4a2a docs: design P0.2 compatibility proof` |
| Recent approved phase | `git log -5 --oneline --decorate` | P0.1 Gate 3 is closed at `c90b7c2`; later commit `2fa4a2a` contains only the approved P0.2 design |
| Local branches/worktrees | `git branch --all`; `git worktree list` | One local branch and one worktree; no parallel implementation exists |
| Repository visibility | `gh repo view Egeria-Systems/egeria-scaffold` | Private repository |
| Remote default branch | GitHub GraphQL repository query | No remote default branch is currently reported because local commits have not been pushed |
| GitHub environments | GitHub deployments/environments API | None currently configured |
| Actions policy | GitHub Actions permissions API | Actions enabled; repository policy does not require action SHA pinning |

No fetch was required for the local implementation base: this increment is explicitly approved for sequential development on clean local `main`, and the GitHub API established the current remote repository state. No push, environment creation, secret write, workflow dispatch, Cloudflare mutation, or deployment was performed.

Repository inspection covered:

- root and relevant `AGENTS.md` instructions;
- root manifests and constitution tests;
- the architecture overview, capability model, enforcement map, and program roadmap;
- ADR-0001 through ADR-0011 and the ADR index;
- the contribution/review protocol;
- P0.1 preparation, verification, plans, and review packet;
- the persisted source plan and approved P0.2 design;
- absence of `.egeria` state, runtime packages, application workspaces, workflows, and a dependency lockfile.

The current persisted source-plan SHA-256 is:

`821c175a8ce8c8a46ff4ec75f855e5cc9c867e0dfa9988ee2865dadbf969829d`

The original supplied file remains available at `/Users/CoveMB/Downloads/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan (1).md` with SHA-256 `f8d3f7db149f18c28ac3c6e41781405e3661c4a5ab710ee28290b184864c1027`. The difference is expected: approved P0.1 Gate 3 governance amendments were persisted in the repository copy and recorded in P0.1 verification evidence.

## Local toolchain observation

| Tool | Observed result | Interpretation |
|---|---|---|
| Node.js | `v22.23.0` | Matches `.nvmrc` and `volta.node`; includes the reviewed June 2026 fixes for Node 22 |
| Volta | `2.0.2` | Resolves the repository Node pin; project-level pnpm pinning is unsupported |
| pnpm | `10.32.1` | Existing global/default tool; not the P0.2 candidate |
| Corepack | command not found | The local Volta-managed Node distribution does not expose Corepack; the plan must not assume it exists |

P0.2 pins pnpm `11.20.0` through the standard root `packageManager` field and pnpm 11's `pmOnFail: error` workspace policy. The implementation originally planned `volta.pnpm`, but Volta `2.0.2` rejected `volta pin pnpm@11.20.0` with `Only node and yarn can be pinned in a project`. Current Volta documentation still describes pnpm support as experimental and lists limitations, while current pnpm 11 documentation replaces the removed `packageManagerStrictVersion` setting with `pmOnFail: error`. The corrected local bootstrap uses `volta install pnpm@11.20.0` only to install the approved CLI on this machine; Volta remains the project pin owner only for Node. CI uses the fully SHA-pinned `pnpm/action-setup` action rather than depending on Corepack.

## Live-source freshness method

Documentation was re-fetched on 2026-08-04 from authoritative endpoints with direct HTTPS requests using `Cache-Control: no-cache`, `Pragma: no-cache`, and a `fresh=20260804` query marker where accepted. Package data came from live npm registry metadata. GitHub repository, action-tag, and advisory data came from the live GitHub API. These results did not rely on a cached search-result excerpt.

Version tags are not treated as immutable inputs. The workflow plan resolves and records full action commit SHAs, and package versions are exact in the manifest and lockfile.

The approved-plan refresh completed at `2026-08-04T22:57:50Z`. Every exact npm candidate still existed with the recorded engine and peer ranges; pnpm `11.20.0` had been published for more than the required 24 hours; all 16 exact-version GitHub Advisory Database queries still returned zero records; and the three action tags still resolved to the SHAs recorded below. Direct no-cache downloads again confirmed the current Cloudflare guide dates and runtime distinction, the `2026-08-04` compatibility date, the July 2026 Next.js security floor, the OpenNext limitations, the Workers Vitest open-beta status, the test-harness API, the Node.js `22.23.0` security release, GitHub environment controls, W3C's evaluation boundary, and Cloudflare's CI credential guidance. The GitHub repository remained private with no remote default branch or environment; Actions remained enabled without a repository-level SHA-pinning requirement. No material source change required a plan amendment.

## Official documentation and security review

### Node.js and pnpm

- The [Node.js June 2026 security release](https://nodejs.org/en/blog/vulnerability/june-2026-security-releases) identifies `22.23.0` as the patched Node 22 release for issues up to HIGH severity, including CVE-2026-48933. The live page reported a 2026-06-18 update.
- Live npm metadata reports pnpm `11.20.0` as the current stable release and an engine floor of Node `>=22.13`, which is compatible with Node `22.23.0`.
- Current pnpm 11 documentation places workspace settings in `pnpm-workspace.yaml`, supports a one-day `minimumReleaseAge`, and uses `allowBuilds` to permit only reviewed dependency lifecycle scripts.
- The selected pnpm release and any newly published dependency must satisfy the committed one-day maturity policy when the lock is generated. A maturity-policy failure is a stop condition, not a reason to bypass the policy silently.

### Next.js, OpenNext, and Cloudflare

- The live [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) reported a 2026-06-05 update. It supports App Router through OpenNext, requires `nodejs_compat`, documents `wrangler types`, and distinguishes `next dev` on Node.js from production-like preview under workerd.
- The live guide used `2026-08-04` as the current `compatibility_date`. P0.2 freezes that exact date in the proof rather than letting a future date change behavior implicitly.
- The live [OpenNext Cloudflare documentation](https://opennext.js.org/cloudflare) supports all minor and patch releases of Next.js 16, with a current security floor of `16.2.11`; it recommends the Node runtime and still lists Node.js Middleware as unsupported. Windows support is not guaranteed and Worker size limits remain applicable.
- The live Next.js release page showed Next.js `16.3.0` as current stable. The July 2026 security release identifies `16.2.11` as the Active LTS security floor. `16.3.0` is above that floor.
- Live npm peer metadata for `@opennextjs/cloudflare@1.20.2` accepts Next.js `>=15.5.21 <16 || >=16.2.11` and Wrangler `^4.86.0`, so the selected Next.js `16.3.0` and Wrangler `4.118.0` satisfy the declared peer ranges.
- The live [Cloudflare testing overview](https://developers.cloudflare.com/workers/testing/) reported a 2026-07-27 update and now recommends Wrangler's `createTestHarness()` for whole-Worker integration against production Worker builds.
- The live [test-harness guide](https://developers.cloudflare.com/workers/testing/test-harness/get-started/) also reported a 2026-07-27 update and demonstrates `createTestHarness` imported from `wrangler`, a built Worker, and a Vitest runner.
- The live Workers Vitest integration [known-issues page](https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/) reported a 2026-04-29 update and still labels the Workers Vitest pool open beta. It lists unsupported V8 native coverage and limitations around fake timers, storage, and module behavior.

Consequence: P0.2 uses ordinary Node Vitest for the unit test and Wrangler `createTestHarness()` for the production-Worker integration test. It deliberately does not add `@cloudflare/vitest-pool-workers` merely to satisfy the word “integration.”

### TypeScript, ESLint, browser testing, and accessibility

- Live npm metadata reports TypeScript `7.0.2` as latest, but `typescript-eslint@8.66.0` declares TypeScript `>=4.8.4 <6.1.0`. P0.2 therefore selects TypeScript `6.0.3`, the newest candidate inside the current supported peer range, rather than forcing TypeScript 7.
- `eslint-config-next` is selected at `16.3.0` to match Next.js. Initial direct metadata suggested ESLint `10.8.0` satisfied its top-level peer range, but the first locked-graph `pnpm peers check` showed that `eslint-plugin-import@2.32.0`, `eslint-plugin-jsx-a11y@6.10.2`, and `eslint-plugin-react@7.37.5` accept ESLint 9 but not ESLint 10. Live metadata and an exact-version advisory query then selected ESLint `9.39.5`, the newest maintained ESLint 9 release, with zero advisory records on the evidence date.
- The live [Playwright CI documentation](https://playwright.dev/docs/ci) supports a managed web server, exact browser installation, retries/workers suitable for CI, and Chromium smoke testing.
- The live [W3C evaluation overview](https://www.w3.org/WAI/test-evaluate/) continues to state that tools support evaluation but do not replace knowledgeable human evaluation.

Consequence: Playwright and axe provide mandatory automated smoke evidence for local Next development, workerd preview, and the deployed URL. They do not establish WCAG conformance. Keyboard, reflow, and reduced-motion checks remain bounded automated checks, not human usability or accessibility proof.

### GitHub Actions and Cloudflare deployment

- The live [GitHub deployment environment documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) confirms environment-scoped secrets/variables, deployment branch restrictions, required reviewers, and self-review prevention. Availability of some protections depends on repository visibility and GitHub plan.
- The live GitHub repository state has no `compatibility` environment. The user approved that exact non-production environment name, but environment creation and protection configuration remain external actions requiring separate authorization.
- The live [Cloudflare GitHub Actions deployment guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) requires an account identifier and API token and recommends a narrowly scoped token. It does not document a Cloudflare OIDC replacement for this flow.
- Current action tag resolutions recorded through the live GitHub API are:
  - `actions/checkout@v6` -> `d23441a48e516b6c34aea4fa41551a30e30af803`
  - `pnpm/action-setup@v4` -> `f40ffcd9367d9f12939873eb1018b921a783ffaa`
  - `actions/setup-node@v5` -> `a0853c24544627f65ddf259abe73b1d18a591444`

The repository does not enforce action SHA pinning, but P0.2 will pin these full SHAs in the workflow. Workflow permissions are limited to `contents: read`. Deployment uses the approved Worker name `egeria-scaffold-nextjs-cloudflare-proof` and environment `compatibility`.

## Exact package candidates

The following versions were selected from live registry and peer metadata on 2026-08-04. They are candidates until the exact locked graph passes installation, audit, type, build, runtime, browser, and deployed checks.

| Package/tool | Exact candidate |
|---|---:|
| Node.js | `22.23.0` |
| pnpm | `11.20.0` |
| `next` | `16.3.0` |
| `react` / `react-dom` | `19.2.8` |
| `@opennextjs/cloudflare` | `1.20.2` |
| `wrangler` | `4.118.0` |
| `typescript` | `6.0.3` |
| `eslint` | `9.39.5` |
| `eslint-config-next` | `16.3.0` |
| `typescript-eslint` | `8.66.0` |
| `vitest` | `4.1.10` |
| `@playwright/test` | `1.62.1` |
| `@axe-core/playwright` | `4.12.1` |
| `@types/node` | `22.20.1` |
| `@types/react` | `19.2.18` |
| `@types/react-dom` | `19.2.4` |

Exact-version GitHub Advisory Database queries for the direct package candidates returned no advisories on the evidence date. That is narrow registry evidence only. It does not clear the transitive graph, prove exploitability status, or replace the post-lock `pnpm audit` and dependency review.

Expected install-script packages in the candidate graph are `@parcel/watcher`, `@swc/core`, `esbuild`, `unrs-resolver`, and `workerd`. The implementation plan permits only those exact package names through pnpm `allowBuilds`. If the locked graph requires another lifecycle script, implementation stops for evidence and a plan amendment instead of broadening the allowlist silently. The optional `rclone.js` peer is not selected.

The first full-graph audit found five new advisories—one HIGH and four MODERATE—on `undici@7.28.0`, reached only through Wrangler's exact `miniflare@5.20260730.0-alpha` dependency. All five list `7.29.0` as patched. Wrangler `4.118.0` is current and its Miniflare dependency pins `7.28.0`, so ordinary resolution cannot select the patch. Live registry metadata confirms `undici@7.29.0` supports Node `>=20.18.1`, was published on 2026-07-24, and has no exact-version GitHub advisory records on the evidence date. P0.2 therefore owns one narrow `miniflare>undici: 7.29.0` override. The post-override audit and real Wrangler/OpenNext integration tests must both pass; the override is removed when upstream adopts an equal or newer patched release.

## Reconciled contradictions and blocking uncertainties

1. **Proof placement:** An executable compatibility proof under `apps/*` would blur builder-product boundaries. The approved location is `proofs/nextjs-cloudflare`; `apps/*` remains reserved for builder applications beginning with `apps/cli` in P0.3.
2. **Cloudflare integration mechanism:** Earlier material referenced the Workers Vitest pool, but current Cloudflare documentation recommends `createTestHarness()` for a whole built Worker while the pool remains beta. The approved proof uses ordinary Vitest plus the harness and documents the beta limitation without installing the beta pool.
3. **TypeScript latest-version conflict:** TypeScript 7 is newer but outside the current `typescript-eslint` peer range. Select `6.0.3`; do not use peer overrides or ignore warnings.
4. **Package-manager pinning:** Corepack is absent locally and Volta cannot project-pin pnpm. The repository uses `packageManager: pnpm@11.20.0` plus `pmOnFail: error`; local setup installs that exact CLI with Volta, while CI uses a SHA-pinned pnpm setup action.
5. **Remote deployment prerequisites:** The private GitHub repository currently has no remote default branch or environment, and local commits have not been pushed. Push, creation/configuration of `compatibility`, setting `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `COMPATIBILITY_URL`, workflow dispatch, and Cloudflare deployment each require explicit external-action authorization. Local implementation is not blocked; deployed P0.2 exit evidence is blocked until those actions are approved and configured.
6. **Environment protection availability:** Some GitHub environment protection rules vary by repository plan. The implementation must record what is actually available and must not claim reviewer protection if GitHub does not expose it for this private repository.
7. **Runtime distinction:** `next dev` proves the Node.js development path; only OpenNext preview, the harness, and deployed checks exercise the workerd path. Results must remain separately labeled.
8. **Accessibility claim:** Passing axe and bounded Playwright checks is automated evidence only and cannot be described as WCAG conformance.
9. **ESLint major:** ESLint 10 satisfies `eslint-config-next`'s direct peer range but not three plugins in its actual dependency graph. The compatibility proof uses ESLint `9.39.5`; no peer override or warning suppression is allowed.
10. **Transitive Undici security floor:** Current Wrangler pins Miniflare to vulnerable `undici@7.28.0`. Apply only the exact same-major `miniflare>undici: 7.29.0` security override, then require clean audit and runtime integration evidence.

No other contradiction blocks the exact-file implementation plan. The external deployment prerequisites block only the deployed-proof exit, not local implementation and review of the workflow.

## Plan consequences

- Work remains sequential on clean local `main`; no implementation subagent receives a write scope.
- The proof is private and non-publishable and creates no P0.3 package boundary.
- All proof UI copy originates in `content/en-CA.json` and is parsed into typed data before pure presentation receives it.
- Cloudflare imports and generated bindings remain in the adapter, composition, and infrastructure-test surfaces.
- The workflow is manual and non-production, pins all actions by full commit SHA, uses minimum permissions, and binds to the approved GitHub environment.
- The implementation stops after each focused commit for user review.
- The final candidate receives independent requirements, architecture/anti-overengineering, and test-evidence reviews; only evidence-backed material findings are repaired.
- A review packet and verification record are required before P0.2 Gate 3 approval. No profile, builder CLI, public package, database, queue, email, identity, payment, CRUD, analytics, or observability implementation is in scope.
