# Read-Only Project Diagnostics Preparation Evidence

**Date:** 2026-08-05 (America/Toronto)

**Status:** planning complete; implementation not started

**Approved increment:** P1 Task 5 — read-only doctor and diff

## Decision

Task 5 will add deterministic read-only policy over the existing private builder-core contracts. It will read the three required `.egeria` control files through the existing bounded `RepositoryReader`, resolve desired capabilities through the existing resolver, reuse the existing repository inference result, and return content-free diagnostics and project differences.

The task creates no `.egeria` file, report, transformation, migration execution, generated skeleton, CLI behavior, provider action, dependency, package publication, deployment, or later-stage capability runtime. It does not change the runtime Zod schemas or checked JSON Schema artifacts.

The exact implementation sequence is in [`docs/superpowers/plans/2026-08-05-read-only-project-diagnostics.md`](../superpowers/plans/2026-08-05-read-only-project-diagnostics.md). This preparation record and that plan do not authorize runtime implementation.

## Frozen repository state

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- `HEAD`: `49b016c489004416fbab75d03975d118651da6a7` (`Record repository inference verification`);
- local relationship: `main...origin/main [ahead 32]`;
- local `origin/main`: `af299f4aeb602ebf7c3e0fc0c33a2d208cb496fc`;
- working tree before these planning artifacts: clean;
- worktrees: one, the primary `main` checkout;
- remote refs: not fetched because Task 5 depends on the approved local P1 sequence and current official tool/advisory sources, not remote branch freshness.

Frozen source fingerprints:

```text
approved source plan:
179b7da931fac02eb048c8874b7c70aa4ac8a5ecc6d7dc533e0a0979522b79bc

active P1 umbrella plan:
7f24e4bceb61a0cf644d0461ffcb4b2ba3a8d30e0fb46d2e27cb3e0d14919865

pnpm-lock.yaml:
f454284272a7ee9932d9470f288b72ac1479b3c806807dfdff3591fe9dea8fc0
```

### Concurrent user-owned source-plan edit

After the clean freeze and while these two planning artifacts were being written, the working tree acquired an unstaged user-owned edit to `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`. Its working-file SHA-256 is now `5b9be7720db225e5f7bfd0fb16794e648e6370f470c5fa055f079be8c5d3dc21`.

The edit adds bounded compiled-CLI lifecycle end-to-end coverage to the program testing strategy, pull-request gates, and P3 summary. It does not alter P1 Task 5, the diagnostic contracts, state/inference semantics, builder-core ownership, or this plan. It remains unstaged and excluded from Task 5. It must not be overwritten or included in a Task 5 commit. Before runtime implementation, re-freeze its status and either keep it explicitly excluded or let the user commit/disposition it separately.

Re-freeze this state before implementation. A changed Task 4 API, schema, resolver, catalog, profile recipe, root toolchain pin, lockfile, or canonical decision requires plan revalidation before runtime edits.

## Repository sources inspected

Preparation read and reconciled:

- root `AGENTS.md`, `packages/builder-core/AGENTS.md`, and `/Users/CoveMB/.codex/RTK.md`;
- the complete approved source plan and active P1 umbrella plan;
- architecture overview, capability model, enforcement map, package ownership, program roadmap, and review/contribution protocol;
- the ADR index and accepted ADRs 0001 through 0011;
- root workspace, builder-core, standards, observability, CLI, and proof manifests plus the lockfile and strict TypeScript configuration;
- canonical project, state, profile, capability, and migration runtime schemas plus checked Draft 2020-12 artifacts;
- builder-core codecs, resolver, installed-manifest projection, ownership materialization, repository reader, inference implementation, root exports, and all current tests;
- exact private-package boundary tests;
- all prior review packets, with direct emphasis on Task 3 state/ownership and Task 4 inference evidence;
- the recent Task 3 and Task 4 commit sequence and current branch/worktree inventory.

No more-specific nested instruction applies to the two planning documents. Runtime work is confined to `packages/builder-core`, whose nested instruction remains mandatory.

## Current executable baseline

All local commands used `rtk` and the repository's exact pnpm binary.

| Check | Result |
| --- | --- |
| `node --version` | `v22.23.0` |
| pinned pnpm `--version` | `11.20.0` |
| builder-core `verify` | exit `0`; build, schema currency, 47/47 tests, no-emit typecheck, and zero-warning lint passed |
| package-boundary tests | exit `0`; 22/22 passed |
| constitution tests | exit `0`; 13/13 passed |
| `git diff --check` | exit `0` |
| final pre-plan status | clean `main...origin/main [ahead 32]` |

These checks establish only the unchanged Task 4 baseline. They do not establish Task 5 behavior.

## Current official documentation and advisory evidence

Task 5 adds no dependency and touches no Cloudflare or external provider API. Its tool surface is the pinned Node/TypeScript test and build toolchain plus the already-installed Zod and YAML parsers.

- The [Node.js 22 test-runner documentation](https://nodejs.org/download/release/v22.23.2/docs/api/test.html) continues to support the repository's `node --test` contract. Task 5 uses ordinary assertions and temporary filesystem fixtures; it does not adopt snapshot-update behavior.
- The [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) confirm the relevant explicit Node types, `NodeNext` module resolution, strict typing, and root-directory behavior already present in builder-core configuration. Task 5 changes no compiler option.
- The [Zod 4 documentation](https://zod.dev/basics) confirms `safeParse` as a non-throwing validation result. Task 5 consumes the existing normalized codec issues instead of parsing repository values through a second schema path.
- The [`yaml` v2 documentation](https://eemeli.org/yaml/) confirms `parseDocument`, strict/unique string-key parsing, YAML 1.2 core semantics, and alias limits already enforced by `parseProjectYaml`. Task 5 reuses that codec and never exposes parser messages or excerpts.
- The [pnpm audit documentation](https://pnpm.io/cli/audit) states that pnpm 11 queries the registry bulk advisory endpoint and that `--audit-level=moderate` reports moderate-or-higher known package advisories. The exact current lock graph returned `No known vulnerabilities found` on 2026-08-05. This is dated registry evidence, not a future guarantee.

### Node security pin finding

The official [July 29, 2026 Node.js security release](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases) states that Node `22.23.2` fixes multiple HIGH-severity issues affecting the Node 22 line, including HTTP/2 memory safety/resource exhaustion and Permission Model path over-granting. The [22.23.2 release record](https://nodejs.org/en/blog/release/v22.23.2) identifies it as a security release. The repository remains pinned to `22.23.0`.

This finding does not justify silently adding a Node upgrade to Task 5. The diagnostic library does not start an HTTP/2 or HTTPS server, use DNS/zlib, or rely on the experimental Node Permission Model as its repository-containment boundary. Therefore the pin does not block the bounded local Task 5 source/test cycle. It does block any claim that `22.23.0` is the current secure Node 22 patch and must be handled by a separate compatibility/security increment before P1 completion, publication, generated-client release, or deployment evidence relies on the pin.

## Contract gaps resolved by the plan

### Closed diagnostic-code type

The umbrella interface declares `Diagnostic.code` as an open `string` while immediately stating that ten codes are exact. That permits callers and implementations to compile invented Task 5 codes despite the stated stable contract.

The task-specific plan narrows `Diagnostic.code` to the exact ten-literal union and adds declaration-level negative controls. This changes no runtime schema or user-visible copy; it makes the approved closed vocabulary executable.

### Reachable builder-compatibility diagnostic

`projectConfigurationSchema.builderCompatibility` and `installedStateSchema.builderVersion` are exact literals. The existing codecs therefore reject incompatible values before doctor policy can inspect a typed project or state. The approved `BUILDER_VERSION_INCOMPATIBLE` doctor code would otherwise be unreachable.

Task 5 will keep the schemas canonical and map normalized project/state validation issues whose first structural path segment is `builderCompatibility` or `builderVersion` to `BUILDER_VERSION_INCOMPATIBLE`. Other read/parse/schema failures remain `PROJECT_INVALID` or `STATE_INVALID`. This adds no permissive compatibility parser and echoes no rejected value.

### Honest invalid-control-file diff

The umbrella `ProjectDifference.kind` union has only capability, inference, and managed-surface variants, while the same task requires invalid control files to fail without exceptions. Representing an invalid `project.yaml` or `migrations.jsonl` as `inference-mismatch` would misstate the failure and violate the architecture rule that semantic differences remain explicit.

The task-specific plan adds the narrow `control-file-invalid` difference kind, with only the fixed control-file path. It amends the umbrella Task 5 interface in the planning-gate commit after approval. It adds no generic issue or prose field.

### One-operation read coherence

Doctor and diff must read project and migration files while inference reads state, probes, and valid-state surfaces. Independent reads could observe different bytes if a caller supplies a changing reader. The plan extracts Task 4's existing promise cache into one internal, non-root-exported caching-reader module and wraps each doctor/diff operation once. Every path is read at most once per operation; the existing reader remains the only filesystem authority.

## Exact policy boundary

- Required control files are `.egeria/project.yaml`, `.egeria/state.json`, and `.egeria/migrations.jsonl`. Missing, symlinked, unreadable, oversized, invalid-UTF-8, or parse-invalid control files are invalid.
- Desired capabilities come only from `resolveCapabilities({ profile: project.originProfile, requestedCapabilities: project.selectedCapabilities }, catalog, profiles)`.
- Installed capabilities come only from valid state.
- Inferred capability and surface evidence comes only from `inferRepository`.
- Diagnostics sort by severity (`error`, `warning`, `info`), code, capability, then path. Differences sort by kind, capability, then path.
- `healthy` and `equal` are true only when their respective output arrays are empty. Warnings therefore remain visible and make doctor unhealthy without being mislabeled as errors.
- Diagnostic context contains only fixed reason/category tokens. Raw repository content, parser prose, rejected values, secrets, fingerprints, package values, and source excerpts never cross the API.
- No generic force option, numeric confidence, report write, repository enumeration, command execution, Git access, or provider/network action is introduced.

## Contradictions and blockers

No canonical ADR, architecture document, schema owner, or current implementation contradicts the bounded Task 5 design after the two interface clarifications above.

The Node `22.23.0` security-pin finding is material but separable: it does not block local Task 5 implementation, and Task 5 approval does not approve or defer the required compatibility/security increment for the pin. It remains a blocker to a current-security claim and to P1 completion/release evidence that depends on the old pin.

No other blocking uncertainty remains. Ordinary diagnostic mapping, sorting, severity, read-coherence, and invalid-input behavior are fixed explicitly in the task-specific plan.

## Verification and review boundary

Implementation must use TDD, then run builder-core verification, package-boundary tests, constitution tests, deterministic no-write checks, and diff hygiene once against the settled tree. The frozen candidate must receive independent read-only requirements, architecture/anti-overengineering, test-evidence, and input-format/security reviews. Only current-tree, evidence-backed material findings may be repaired.

Static and unit checks will prove only the exercised read-only composition, stable policy mapping, ordering, content-safety, and no-write behavior. They will not prove hostile-kernel atomic snapshots, network-filesystem semantics, Node Permission Model safety, deployment behavior, generated skeleton correctness, accessibility, translation, visual quality, provider safety, or production security.

## Rollback and recovery

- Planning-only recovery: remove the two uncommitted Task 5 planning artifacts only with explicit authorization.
- Implemented source recovery: revert focused Task 5 commits with new revert commits; never reset shared `main`.
- Rebuild builder-core after source recovery. Ignored `dist` output is reproducible and non-authoritative.
- No dependency or lockfile rollback is planned because Task 5 changes neither.
- No `.egeria` state, migration record, generated repository, persistent data, deployment, provider resource, or external system is created or changed.

## Approval boundary

Approval of this preparation and exact-file plan authorizes only the bounded local Task 5 implementation, verification, independent review, evidence-backed repair, focused commits, verification record, and Task 5 review packet. It does not authorize Task 6, the separate Node pin increment, push, pull request, workflow dispatch, publication, deployment, provider mutation, production action, permission change, external message, or response to review comments.
