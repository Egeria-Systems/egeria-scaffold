# P0.2 Next.js and Cloudflare Compatibility Proof Review Packet

**Recorded:** 2026-08-04

**Gate 3 outcome:** NOT READY — one external prerequisite group remains. Local implementation, local verification, and the three required reviews are complete, but GitHub environment inputs, the workflow run, Cloudflare deployment, and deployed smoke evidence are absent.

This is a durable pre-deployment packet, not a request for verified-final-diff approval and not authorization to begin P0.3.

## Goal and approved scope

Create the smallest private proof of the exact Node.js, pnpm, Next.js App Router, OpenNext Cloudflare, Wrangler, TypeScript, ESLint, Vitest, Playwright, and axe combination. The proof must distinguish Node development from workerd execution, deploy only to non-production through GitHub Actions, and avoid implementing a builder app, package boundary, profile, capability, or production behavior.

- Base: `c90b7c2`
- Verified implementation candidate: `236d2bace3b7513873998cbde6aee6c15bf1b2b2`
- Comparison: `c90b7c2..236d2ba`
- Lockfile SHA-256: `72fab6af3a327404e287094e99438b98f7a43007765a4a9e6255cc357dd637c7`
- Branch: clean sequential `main`, pushed to `origin/main`

## Changed files by boundary

### Root workspace and governance

- `.github/workflows/compatibility-proof.yml`
- `.gitignore`
- `AGENTS.md`
- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tests/constitution/constitution.test.mjs`

### Architecture, planning, compatibility, and preparation evidence

- `docs/architecture/enforcement-map.md`
- `docs/architecture/overview.md`
- `docs/compatibility/nextjs-cloudflare.md`
- `docs/implementation-evidence/2026-08-04-p0-2-compatibility-preparation.md`
- `docs/roadmaps/program-roadmap.md`
- `docs/superpowers/plans/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md`
- `docs/superpowers/specs/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof-design.md`

### Gate 3 evidence

- `docs/implementation-evidence/2026-08-04-p0-2-compatibility-verification.md`
- `docs/review-packets/2026-08-04-p0-2-nextjs-cloudflare-compatibility-proof.md`

### Private compatibility proof configuration

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

### Proof application, content, and boundaries

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

### Proof tests

- `proofs/nextjs-cloudflare/tests/unit/proof-copy.test.ts`
- `proofs/nextjs-cloudflare/tests/integration/cloudflare.test.ts`
- `proofs/nextjs-cloudflare/tests/e2e/smoke.spec.ts`

## Commits

- `2fa4a2a` — design P0.2 compatibility proof
- `67cac42` — plan P0.2 compatibility proof
- `c45a7f0` — lock P0.2 compatibility toolchain
- `6e2fc29` — add typed compatibility proof page
- `2699321` — prove OpenNext workerd integration
- `dcef3f6` — add browser compatibility smoke gates
- `7039c6b` — define P0.2 compatibility evidence boundary
- `ea61c78` — add compatibility proof deployment workflow
- `93f3ca7` — minimize compatibility deployment credentials and repair canonical status
- `236d2ba` — protect the deploy-only credential boundary

## Verification summary

| Evidence | Result |
|---|---|
| Frozen install | pass under pnpm `11.20.0` |
| Peer graph | no issues |
| Registry audit at moderate threshold | no known vulnerabilities |
| Constitution | 12/12 pass |
| Generated bindings | current |
| ESLint flat config | pass with zero warnings |
| Strict TypeScript | pass |
| Ordinary Vitest | 4/4 pass |
| Next.js build | pass |
| OpenNext Cloudflare build | pass; Worker emitted |
| Wrangler production-Worker harness | 1/1 pass |
| Next development browser/axe suite | 4/4 pass |
| Workerd preview browser/axe suite | 4/4 pass |
| GitHub workflow structure/security | pass |
| Deployed browser/axe suite | BLOCKED — no environment inputs or deployment |

The full command history, RED/GREEN sequence, exact versions, action SHAs, environment facts, and evidence boundaries are in the [verification record](../implementation-evidence/2026-08-04-p0-2-compatibility-verification.md).

## Review outcomes and dispositions

### Requirements

Retained documentation findings: stale remote/environment status, ambiguous design approval status, and contradictory Volta/pnpm wording. All were repaired in `93f3ca7`. No implementation requirement defect remained.

### Architecture and anti-overengineering

Retained high-impact finding: the secret-bearing deployment script rebuilt before deployment. `93f3ca7` changed it to deploy the already-verified artifact. A targeted follow-up required stronger static protection; `236d2ba` added an exact deploy invocation check and a mutation test that rejects build work under credentials. The reviewer marked the finding resolved and found no other material architecture or scope defect.

### Independent test evidence

No material finding. The reviewer accepted the pure tests, authentic built-Worker harness, Node/workerd/deployed separation, bounded accessibility claims, workflow ordering, action pins, secret isolation, and deploy-only artifact contract. The absent credentialed deployment and deployed smoke remain an explicit blocker.

## Security and remaining dependency risk

- All direct versions and action references are exact.
- The final audit reports no known vulnerability at or above the selected threshold.
- The `miniflare>undici: 7.29.0` override is intentionally narrow and must be removed when upstream no longer needs it.
- Lifecycle scripts are restricted to five reviewed package names in `allowBuilds`.
- The workflow is manual, `main`-only, environment-bound, `contents: read`, and exposes Cloudflare credentials only to deploy-only publication of the verified artifact.
- GitHub environment reviewers/self-review controls were not configured; the available branch-policy control is active. This is a remaining external governance limitation, not proof of production safety.

## Risks, limitations, and deferred work

- No clean Ubuntu workflow result exists; local macOS success cannot substitute for it.
- No Worker, public proof URL, or deployed browser/axe evidence exists.
- Chromium-only smoke does not prove cross-browser support.
- Automated accessibility evidence does not establish WCAG conformance or human usability.
- Node.js Middleware is unsupported by the selected OpenNext adapter and is not used.
- Windows support is not guaranteed or tested.
- Cloudflare Worker size limits remain applicable.
- The open-beta Workers Vitest pool is excluded.
- P0.3 builder apps/packages, project/state schemas, profiles, capabilities, and production functionality remain deferred.

## Rollback and recovery

- **Source rollback:** revert the relevant commits; never reset shared `main`.
- **Deployment rollback:** after deployment exists, redeploy a previously verified commit through the same workflow or use separately authorized Worker version rollback.
- **Worker deletion/custom-domain removal:** separate Cloudflare action requiring explicit approval.
- **GitHub cleanup:** environment, branch policy, secret, and variable removal are separate actions.
- **Credential recovery:** rotate or revoke the provider token separately from GitHub secret replacement/removal.
- **Persistent data:** none exists.

## Blocking next action

Configure these names directly in GitHub environment `compatibility`, without sending values in chat:

- secret `CLOUDFLARE_API_TOKEN`, narrowly scoped to Workers Scripts edit for the target account;
- secret `CLOUDFLARE_ACCOUNT_ID`;
- variable `COMPATIBILITY_URL` for the expected non-production Worker URL.

Then dispatch `.github/workflows/compatibility-proof.yml` from exact `main`, monitor the run, and independently rerun the deployed Playwright suite. Until those checks pass and this packet is amended, P0.2 is not complete and no verified-final-diff approval is requested.
