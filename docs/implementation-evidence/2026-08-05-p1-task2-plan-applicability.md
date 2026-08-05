# P1 Task 2 plan applicability evidence

**Date:** 2026-08-05 (America/Toronto)

**Status:** the approved Task 2 design remains applicable with the exact-file and validation-interface amendments below; implementation has not started

**Approved increment:** P1 Task 2 — P1 Capability Catalog, Profiles, and Resolution

## Applicability decision

The controlling Task 2 section in `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md` remains the correct implementation boundary:

- executable capabilities remain exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`;
- executable profiles remain exactly `portfolio` and `site`;
- recipes materialize explicit capabilities, dependencies precede dependants, and installed capabilities become authoritative;
- the resolver remains deterministic under catalog permutation and rejects unknown, unsupported, incomplete, cyclic, or conflicting graphs;
- the installed manifest remains a projection of resolved descriptor metadata inside future `.egeria/state.json` rather than a separate manifest file; and
- Task 2 adds no codecs, filesystem writes, inference, diagnostics, templates, generated repositories, CLI behavior, provider mutation, deployment, persistence, later profile, or later capability.

Following the unchanged Task 2 file list literally would leave a failing direct-consumer contract and knowingly stale boundary documentation. The controlling plan therefore needs a targeted amendment before implementation. No architecture decision or roadmap scope changes.

## Frozen repository evidence

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: clean sequential local `main`;
- frozen `HEAD`: `5da4dfc8a40a4317730c08e2ef7b5cd139737aa6`;
- local relationship: `main...origin/main [ahead 18]`;
- recent committed sequence: Task 1 schema contracts at `d6892c0`, Task 1A plan at `468558d`, and Task 1A contract clarification at `5da4dfc`;
- worktrees: one;
- approved source-plan SHA-256: `179b7da931fac02eb048c8874b7c70aa4ac8a5ecc6d7dc533e0a0979522b79bc`;
- lockfile SHA-256: `f454284272a7ee9932d9470f288b72ac1479b3c806807dfdff3591fe9dea8fc0`.

Remote refs were not fetched because Task 2 depends on the approved local P1 stream, current repository contracts, and current public documentation. Remote branch freshness does not alter this local applicability decision.

## Repository sources rechecked

This pass re-read the root and relevant nested instructions, `/Users/CoveMB/.codex/RTK.md`, the complete approved source plan, architecture overview, capability model, enforcement map, package ownership, program roadmap, governance protocol, all accepted ADRs, current P1 evidence and plans, all three prior review packets, root and builder-core manifests, the workspace lockfile, all current builder-core contract sources and checked Draft 2020-12 schema artifacts, current builder-core tests, package-boundary tests, and constitution tests.

The executable schema artifacts remain private under `packages/builder-core/schemas/`; a repository `.egeria/` directory correctly does not exist. Task 2 consumes the current `CapabilityDescriptor`, `ProfileRecipe`, `InstalledCapability`, `ValidationResult`, semantic-version, probe, and managed-surface contracts without changing their checked JSON Schema artifacts.

## Current baseline and advisory evidence

All successful repository commands used Node.js `22.23.0`, pnpm `11.20.0`, and `rtk`.

| Check | Result |
| --- | --- |
| builder-core `verify` | passed: build, schema currency, 11/11 tests, typecheck, and zero-warning lint |
| package-boundary suite under `CI=true` | 21/21 passed |
| constitution suite under `CI=true` | 13/13 passed |
| peer dependency check | no issues |
| current lockfile audit at moderate threshold | `No known vulnerabilities found` |
| `git diff --check` | passed |

The first package-boundary and constitution invocations stopped before tests because pnpm would not refresh the generated modules directory without a TTY. The exact commands passed under the repository's already-recorded `CI=true` non-interactive boundary. The first audit attempt could not resolve the npm registry inside the sandbox; the same read-only command passed with approved registry access. These were environment preconditions, not source failures.

Current official evidence continues to support the plan:

- [Zod basic usage](https://zod.dev/basics) documents `safeParse()` as a discriminated success/failure result, matching the repository's non-throwing validation boundary.
- [Zod schema APIs](https://zod.dev/api) continue to document `z.strictObject()` unknown-key rejection and readonly object/array inference.
- [Zod JSON Schema](https://zod.dev/json-schema) continues to support Draft 2020-12 and throwing on unrepresentable schema constructs; Task 2 does not alter the checked schema artifacts.
- [pnpm workspaces](https://pnpm.io/workspaces) confirms that `workspace:` resolves only local workspace packages and is rewritten only during pack/publish. Task 2 should therefore accept only exact stable registry-version syntax for the future standalone standards and observability dependencies; actual registry publication remains the separate pre-Task-7 gate.
- [npm package dependency documentation](https://docs.npmjs.com/cli/configuring-npm/package-json/) distinguishes exact versions from ranges, tags, aliases, local paths, and Git/URL sources. No package-spec parsing dependency is needed because P1 accepts only the repository's existing strict `major.minor.patch` contract.
- [OpenNext Cloudflare documentation](https://opennext.js.org/cloudflare) still supports Next.js 16 minor/patch releases, uses the Node.js runtime, and routes local/Cloudflare builds through Wrangler.
- [Cloudflare's Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) still directs Workers-hosted Next.js projects through the OpenNext adapter. Task 2 records descriptor metadata only and performs no build, provider call, binding change, or deployment.

No Task 2 dependency or provider version changes. The accepted P0.2 compatibility matrix remains the source of the exact OpenNext/Cloudflare versions; current documentation revalidation does not expand Task 2 into a compatibility proof.

## Consolidated plan corrections

### 1. Stale direct consumers omitted from the Task 2 file map

`packages/builder-core/AGENTS.md` and `packages/builder-core/README.md` still describe Task 1 and prohibit or defer the exact catalog/profile resolution behavior Task 2 introduces. `docs/architecture/package-ownership.md` still describes builder-core as an empty P0.3 shell even though Task 1 contracts now exist. `README.md` also still says builder-core has no executable schema contract. These are stale direct consumers, not an architecture conflict: the accepted ADRs, roadmap, preparation evidence, and approved P1 plan all assign Task 2 to private builder-core.

`tests/package-boundaries/private-packages.test.mjs` asserts the exact Task 1 source-file list. Adding the approved Task 2 files without updating that test would make the repository suite fail. The test is a direct executable consumer and must change in the same focused increment.

`docs/architecture/enforcement-map.md` says the `INV-CAPABILITY-METADATA` automated owner is the builder-core schema and catalog contract tests. Task 2 completes that owner for the six-capability P1 subset, so the map must record that bounded actual gate in the same increment. `INV-PROFILE-MATERIALIZATION` remains planned until the later inference agreement tests exist.

### 2. Package-version rejection needs a non-throwing result

The current plan requires `createP1CapabilityCatalog()` to reject `workspace:`, `file:`, Git, URL, range, and prerelease values but gives it an unconditional array return type. An undocumented thrown exception would conflict with the established `ValidationResult` boundary and make later `renderSkeleton()` composition less explicit.

The amended interface returns `ValidationResult<readonly CapabilityDescriptor[]>` and reports `P1_PACKAGE_VERSION_INVALID` at `packageVersions.standards` or `packageVersions.observability` without echoing the rejected value. This is a pre-consumer correction: no current caller or persisted format exists, and the later renderer already returns `ValidationResult`.

This check proves only exact stable semantic-version syntax. Actual npm availability, integrity, provenance, and fresh standalone installation remain the separate Task 7/8 release and fixture evidence.

### 3. Descriptor metadata and managed-surface identity need to be frozen before code

The existing plan correctly freezes the capability matrix, probes, paths, ownership modes, and merge strategies but does not name every surface identifier or the non-empty verification/evidence/recovery metadata. The amended Task 2 section now provides those exact values. Metadata arrays not listed there remain explicitly empty; no setting, secret, browser storage, persistent data, privileged operation, migration planner, analytics domain, or provider mutation is invented.

The current OpenNext setup guidance requires Wrangler as a separate installed package, while the original Task 2 probe table checked only `@opennextjs/cloudflare`. The amended table adds exact `wrangler@4.118.0` dev-dependency probe and merge-managed surface. Otherwise, future inference could call `deployment-cloudflare` confirmed while a declared required package was absent.

## Approaches considered

1. **Follow the Task 2 section unchanged.** Rejected because it would violate the nested boundary, fail the exact source-list contract, leave canonical API ownership stale, and require an unspecified error path for bad package versions.
2. **Re-plan or refactor the wider P1 kernel.** Rejected because the accepted Task 2 architecture remains sound and broader changes would increase churn and risk later-stage implementation.
3. **Apply a targeted Task 2 amendment.** Selected. It preserves the six-capability design and DFS resolver while adding only current direct consumers, exact metadata, and a non-throwing package-version result.

## Remaining limits and approval boundary

No blocking uncertainty remains after the controlling-plan amendment. Task 2 can run on clean sequential `main`; no isolated worktree adds material protection for this single local stream. If the branch, status, source contracts, relevant decisions, package graph, or Task 2 plan changes before execution, re-freeze again.

This evidence and plan amendment do not authorize Task 2 implementation by themselves. Explicit approval authorizes only the amended Task 2 files, RED/GREEN checks, focused local commit, and review checkpoint. It does not authorize Task 3, push, pull request, merge, publication, deployment, provider mutation, permission change, external message, or review-comment response.
