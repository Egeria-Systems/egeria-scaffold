# P0.1 Constitution Preparation Evidence

**Recorded:** 2026-08-04  
**Scope:** Read-only repository inspection, source-plan ingestion, and official-source revalidation before implementation of increment P0.1.  
**Implementation status:** Not started. This record does not prove P0.1 acceptance, runtime compatibility, deployment, or production readiness.

## Repository evidence

Working directory: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`

| Check | Command | Result |
|---|---|---|
| Current state | `git status --short --branch` | `## No commits yet on main` |
| Current branch | `git branch --show-current` | `main` |
| Local branches | `git branch -a` | None; `main` is unborn |
| Recent commits | `git log --oneline --decorate -20` | Failed as expected because `main` has no commits |
| Configured remote | `git remote -v` | `origin` points to `git@github.com:Egeria-Systems/egeria-scaffold.git` |
| Remote heads/tags | `git ls-remote --heads --tags origin` | No refs returned; the remote is also empty |
| Repository files | `find . -maxdepth 4 -print` | Only `.git/**` exists |

No fetch was performed because the read-only remote query established that there were no refs to fetch. No architecture documents, roadmap, ADRs, `.egeria` schemas, manifests, tests, nested `AGENTS.md` files, or prior review packets exist in the repository.

The active instruction block references `/Users/CoveMB/.codex/RTK.md`, but that file does not exist and a scoped filename search found no repository-local or Codex-local equivalent. The preparation pass therefore followed the complete displayed `AGENTS.md` instructions without inventing replacement RTK rules. This discrepancy is not a P0.1 architecture blocker, but it should be corrected separately if the include was intended to be normative.

The supplied approved source plan was copied byte-for-byte to:

`docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`

Source SHA-256:

`f8d3f7db149f18c28ac3c6e41781405e3661c4a5ab710ee28290b184864c1027`

## Local toolchain observation

| Tool | Local result | Interpretation |
|---|---|---|
| Node.js | `v22.21.1` | Supported release line, but below the June 2026 security release `v22.23.0` and not the requested current Active LTS line |
| pnpm | `10.32.1` | Older than current pnpm 11 and affected by the pnpm 10 audit-endpoint incompatibility described below |
| Git | `2.50.1 (Apple Git-155)` | Supports `git worktree add --orphan`, which can bootstrap an isolated worktree from an unborn repository |

These observations do not establish the P0.2 compatibility matrix. P0.1 must not claim that the local Node.js or pnpm versions are the selected production toolchain.

## Official documentation and advisory review

Reviewed on 2026-08-04. Version and advisory facts must be refreshed at the start of P0.2 before dependencies are selected or installed.

### Node.js

- The [official release table](https://nodejs.org/en/about/previous-releases) lists Node.js 24 as LTS and Node.js 26 as Current. It recommends Active LTS or Maintenance LTS for production.
- The [June 2026 security release](https://nodejs.org/en/blog/vulnerability/june-2026-security-releases) fixed issues up to HIGH severity in the supported 22, 24, and 26 lines, with patched releases `22.23.0`, `24.17.0`, and `26.3.1`.
- Consequence for this increment: use only dependency-free document-contract tests. Before P0.2 executes third-party toolchains, switch to a currently patched Node.js 24 release and record the exact selected version.

### pnpm

- The [workspace documentation](https://pnpm.io/workspaces) requires `pnpm-workspace.yaml` at the workspace root and recommends the `workspace:` protocol for strict local-package resolution.
- The [package manifest documentation](https://pnpm.io/package_json) documents `engines`, `devEngines.runtime`, and `devEngines.packageManager`; pnpm 11 moves pnpm settings out of `package.json` and into `pnpm-workspace.yaml`.
- The [pnpm releases](https://github.com/pnpm/pnpm/releases) show pnpm 11 as the current stable major and pnpm 12 as prerelease on the evidence date. Recent pnpm 11 releases include supply-chain hardening; exact version selection belongs to P0.2 compatibility proof.
- The pnpm maintainers documented that [pnpm 10 audit used retired registry endpoints](https://github.com/pnpm/pnpm/issues/11265), while pnpm 11 uses the bulk advisory endpoint. Therefore local `pnpm audit` output from pnpm `10.32.1` would not be reliable evidence.

### Next.js, OpenNext, and Cloudflare

- The [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) supports the App Router through the OpenNext Cloudflare adapter, distinguishes `next dev` from production-like Wrangler preview, requires `nodejs_compat`, and documents generated binding types.
- The [OpenNext Cloudflare compatibility page](https://opennext.js.org/cloudflare) supports Next.js 16 and identifies current limitations, including lack of Node.js Middleware support and limited Windows support.
- The [Next.js July 2026 security release](https://nextjs.org/blog) establishes a security floor of `16.2.11` for the Active LTS 16.2 line; Next.js 16.3 was released on 2026-08-03. P0.2 must test the exact Next.js/OpenNext pair rather than assuming newest versions compose correctly.
- No Next.js, OpenNext, Wrangler, or Cloudflare package is installed in P0.1. Package-level advisory scanning is therefore impossible and would produce no meaningful dependency result. P0.2 must refresh official advisories after producing an exact lockfile.

### Accessibility claims

- W3C's [evaluation overview](https://www.w3.org/WAI/test-evaluate/) states that no tool alone can determine conformance and that knowledgeable human evaluation is required.
- W3C's [WCAG conformance explanation](https://www.w3.org/WAI/WCAG21/Understanding/conformance.html) describes conformance testing as a combination of automated testing and human evaluation.
- Consequence: the constitution may require automated gates and a human-review checklist, but it must prohibit a WCAG conformance claim based only on automation. Human evaluation is a release gate only when separately required by contract, procurement, risk decision, or a conformance claim.

### Deployment authority

- GitHub's [deployment environments documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) supports branch restrictions, required reviewers, prevention of self-review, and delayed access to environment secrets.
- Availability of some protection rules depends on repository visibility and GitHub plan. The repository visibility and organization plan were not inspected and must not be assumed.
- Consequence: ADR-0011 can establish GitHub Actions as the sole deployment authority, but P0.2 must verify the actual non-production environment controls. Production deployment remains outside P0.1 and P0.2 execution authority.

## Reconciled contradictions and uncertainties

The following items must be explicit in the P0.1 plan and approved with it:

1. **Composite capability state labels:** The source plan defines a singular `CapabilityStateClassification` union but its catalog uses composite values such as `Persistent/external` and mixes state with security concerns such as `privileged`. Resolve this as a non-empty `stateClassifications` set using only the declared state enum. Keep privileged operations in security metadata.
2. **Composite removal labels:** The catalog uses combinations such as `Eject-only/reviewed` that are not members of the declared removal enum. Keep exactly one `removalPolicy` enum value and describe provider/data cleanup in separate removal and recovery metadata.
3. **Pull-request authority:** The source plan says agents may create pull requests, while the active repository instruction requires an explicit request. The repository constitution must preserve the stricter rule: plan approval, commits, final-diff approval, pull-request creation, merge, and deployment are distinct gates.
4. **Bootstrap isolation:** There is no base commit. The approved preparation artifacts must receive a one-time bootstrap commit before normal branch-from-base worktree isolation is possible, or the user must explicitly choose an orphan-worktree alternative. The implementation plan recommends the bootstrap commit because it leaves one auditable source of truth.
5. **Toolchain mismatch:** Local Node.js and pnpm are not the current candidates and the Node.js patch is below the reviewed security floor. P0.1 documentation can be authored, but dependency installation and P0.2 compatibility claims are blocked until a patched toolchain is selected and recorded.
6. **Accessibility review wording:** “Accessibility review complete” means the automated evidence and policy-required review for the selected scope. It does not silently make human evaluation a default release gate and does not authorize a conformance claim.

No other direct contradiction blocks planning P0.1. Package versions, Cloudflare account identifiers, GitHub environment configuration, and deployed proof remain deliberately deferred to P0.2.
