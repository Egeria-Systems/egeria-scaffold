# Semantic Executable Naming Plan Revalidation Evidence

**Evidence date:** 2026-08-05 (America/Toronto)

**Scope:** Gate 1 revalidation of the existing P1 Task 2A semantic executable naming plan. This record does not authorize implementation.

## Frozen repository state

- Repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`
- Branch: clean sequential local `main`
- HEAD: `18938b0c90c629a1bb55907f922a4c49145edacf` (`Plan semantic executable naming`)
- Local relationship: `main...origin/main [ahead 21]`
- Worktrees: one
- Remote refs: not fetched because Task 2A is a repository-local rename against the accepted local P1 sequence; remote freshness does not affect its consumer inventory or design
- P1 plan SHA-256: `e4a83d1bb228f3f7e2853fd34550b080308e018e640cd67839f9110442f3464b`
- Lockfile SHA-256: `f454284272a7ee9932d9470f288b72ac1479b3c806807dfdff3591fe9dea8fc0`
- Local tools: Node.js `22.23.0`, pnpm `11.20.0`, Git `2.50.1 (Apple Git-155)`

## Repository sources rechecked

This pass re-read the root and applicable nested instructions, `/Users/CoveMB/.codex/RTK.md`, the complete approved source plan, concise program roadmap, architecture overview, capability model, enforcement map, package ownership, review protocol, every accepted ADR, current P1 evidence and plans, all prior review packets, root and workspace manifests, package manifests, the compatibility workflow, private builder-core runtime contracts and checked Draft 2020-12 artifacts, the six-capability catalog, profile recipes, resolver, installed-manifest projection, and every direct test or documentation consumer named by Task 2A.

The worktree has no repository `.egeria/` directory. Its future `project.yaml`, `state.json`, and `migrations.jsonl` contracts remain private under `packages/builder-core/src/contracts/` with checked artifacts under `packages/builder-core/schemas/`. Task 2A changes only the profile schema title; it does not change a schema identifier, property, validation rule, or serialized state value.

## Plan applicability and exact consumer inventory

The existing Task 2A section in `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md` remains the single implementation-plan owner. The current tree still contains exactly the planned live names and direct consumers:

- two builder-core source paths;
- three exported catalog/profile identifiers;
- one stable package-version issue code;
- one generated profile-schema title;
- five root script keys and their internal references;
- one compatibility-workflow invocation;
- root README and contributing command examples; and
- builder-core, constitution, internal-linting, private-package, and release-safeguard tests.

The exact source-file allowlist, package-script contracts, workflow contract, generated-schema currency test, and module exports provide deterministic enforcement. No public package API, CLI command, generated repository, persisted `.egeria` document, dependency, lockfile entry, provider resource, or deployed Worker consumes the catalog/profile names.

Phase labels in accepted plans, evidence, review packets, compatibility records, roadmap/status prose, nested boundary documents describing their historical stage, and phase-specific invariant tests remain valid provenance. Rewriting those records would be incorrect and remains outside Task 2A.

## Current official documentation

Reviewed on 2026-08-05:

- [pnpm `run`](https://pnpm.io/cli/run) confirms that a plain argument selects the exact manifest script name. Renaming a script therefore requires migrating every direct caller atomically.
- [npm scripts](https://docs.npmjs.com/cli/using-npm/scripts/) confirms that package manifests own arbitrary script names; no npm lifecycle rule requires roadmap-phase keys.
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun) confirms that each `run` entry executes its configured command in a runner shell. The workflow invocation and root script key must change together.
- [Zod JSON Schema](https://zod.dev/json-schema) continues to support `z.toJSONSchema()` with Draft 2020-12 and throwing on unrepresentable constructs. The checked artifact must be regenerated from the runtime schema rather than edited by hand.
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare) still directs Next.js applications to the Node.js runtime, supports Next.js 16 minor/patch releases, and transforms builds for local Wrangler execution and Cloudflare deployment.
- [Cloudflare's Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) still directs Next.js on Workers through the OpenNext adapter.
- [GitHub secure use guidance](https://docs.github.com/en/actions/reference/security/secure-use) continues to recommend full-length commit SHA pins for immutable third-party action references. Task 2A leaves the existing action SHAs unchanged.

No current official source changes the semantic naming design or justifies a compatibility alias.

## Security and advisory evidence

`CI=true pnpm audit --audit-level moderate` queried the current npm registry advisory endpoint and returned `No known vulnerabilities found` for the locked package graph. This does not audit the Node.js runtime or prove future dependency safety.

**2026-08-05 correction after official-source revalidation:** the linked July notice and `22.23.2` release do not exist in the official Node release record. [Node.js 22.23.0](https://nodejs.org/en/blog/release/v22.23.0) is the June 2026 security release; [Node.js 22.23.1](https://nodejs.org/en/blog/release/v22.23.1/) is a later regression-fix patch. The repository and compatibility workflow remain pinned to `22.23.0`.

That stale runtime pin is material but does not belong inside Task 2A:

- Task 2A is an atomic private-source and repository-command rename with no runtime, dependency, lockfile, provider, deployment, or generated-output behavior change.
- Task 2A verification may run only locally against trusted repository inputs and loopback services. Its compatibility-proof result establishes command-rename preservation only; it cannot establish current runtime security.
- Do not dispatch the compatibility workflow, deploy, or make a current-security claim under the `22.23.0` pin.
- Updating Node to `22.23.1` or another later patch requires a separate exact-file compatibility plan and fresh proof because the accepted matrix, generated-state compatibility literals, action runtime, documentation, tests, and lockfile/install evidence are cross-cutting consumers.

## Consolidated contradiction and uncertainty batch

1. **Accepted compatibility pin versus current Node advisory:** `22.23.0` is no longer the current security-patched Node 22 release. Resolution: keep Task 2A naming-only, limit its proof to trusted local regression evidence, block workflow dispatch/deployment/current-security claims, and plan the pin update separately.
2. **Historical phase labels versus semantic executable names:** accepted historical records must retain phase labels while live executable surfaces must not. Resolution: migrate only the exact live and already-planned executable names listed in Task 2A; do not rewrite historical evidence or add aliases.

No other blocking uncertainty remains. The naming implementation can proceed after explicit plan approval, subject to the Node security boundary above.

## Approval boundary

Approval authorizes only the planning-evidence commit described in Task 2A, the exact implementation file set, RED/GREEN rename checks, three required read-only reviewers, evidence-backed repair, one focused implementation commit, and the stop before Task 3. It does not authorize the Node pin update, dependency changes, push, pull request, workflow dispatch, deployment, publication, provider mutation, permission change, production action, external message, or response to review comments.
