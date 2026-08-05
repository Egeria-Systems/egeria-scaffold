# P0.3 lean builder monorepo preparation evidence

Date: 2026-08-04 (America/Toronto)

Status: preparation complete; implementation not started

Approved increment: P0.3 — Lean builder monorepo

## Decision

Proceed with a boundary-first P0.3 implementation after plan approval:

- add private `apps/cli` and `packages/builder-core` shells;
- make `packages/builder-core` the declared future owner of project/state schemas without implementing those schemas in P0.3;
- add a public `packages/standards` package with only the strict TypeScript baseline and the existing Cloudflare-isolation ESLint rule as its first concrete APIs;
- add a public `packages/observability` package with an intentionally empty runtime API shell;
- use stable `@changesets/cli@2.31.1` for release intent and package versioning;
- add explicit package ownership, export, tarball-content, and private-package publication safeguards;
- keep profiles, capabilities, generators, commands, schemas, providers, analytics, observability transports, and generated-repository behavior out of this increment.

The exact implementation sequence is in `docs/superpowers/plans/2026-08-04-p0-3-lean-builder-monorepo.md`. This record does not authorize implementation.

## Frozen repository state

The preparation review used this local state:

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- `HEAD`: `40604eb5b8a3ade0175c16dd945a1bafee15ae04`;
- local relationship: `main...origin/main [ahead 1]`;
- working tree before this evidence/plan change: clean;
- worktrees: one;
- remote refs: not fetched because P0.3 planning depends on the accepted local sources and the user explicitly authorized work on local `main`;
- user-owned local commit preserved: `40604eb` (`Add mention of cloudflare plugin in plan`).

The implementation comparison must remain:

```text
base: 40604eb5b8a3ade0175c16dd945a1bafee15ae04
candidate: the reviewed P0.3 implementation HEAD
```

If the branch, base, or dirty state changes before implementation, the executor must stop, re-freeze the comparison, and revalidate overlap before editing.

## Sources inspected

The following repository-owned sources were read before selecting the design:

- root `AGENTS.md` and `/Users/CoveMB/.codex/RTK.md`;
- `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`;
- `docs/architecture/overview.md`;
- `docs/architecture/capability-model.md`;
- `docs/architecture/enforcement-map.md`;
- `docs/roadmaps/program-roadmap.md`;
- `docs/governance/review-and-contribution.md`;
- the ADR index and accepted ADRs `0001` through `0011`;
- `docs/compatibility/nextjs-cloudflare.md`;
- the P0.1 and P0.2 implementation evidence and review packets;
- root workspace, package, lockfile, TypeScript, ESLint, Vitest, and test manifests;
- `proofs/nextjs-cloudflare/AGENTS.md` and the proof's manifests, configuration, tests, and current implementation.

No nested instruction file currently exists for the planned `apps/` or `packages/` surfaces. P0.3 will add bounded `AGENTS.md` files before those surfaces acquire implementation.

No `.egeria` directory or schema exists in the current tree. No `apps/` or `packages/` directory exists. The current workspace contains only the private repository root and the private P0.2 proof package.

The approved source plan and current lockfile were fingerprinted during preparation:

```text
approved source plan sha256:
821c175a8ce8c8a46ff4ec75f855e5cc9c867e0dfa9988ee2865dadbf969829d

pnpm-lock.yaml sha256:
72fab6af3a327404e287094e99438b98f7a43007765a4a9e6255cc357dd637c7
```

## Architecture findings

Accepted repository sources establish these P0.3 constraints:

1. `apps/cli` is a thin future command surface. P0.3 must not add profile selection, generation, mutation, migration, add/remove/upgrade, doctor, or publish behavior.
2. Private `packages/builder-core` owns future builder internals and project/state schemas. The executable schemas arrive in P1, so a separate project-schema package and premature schema implementation are both prohibited.
3. `packages/standards` and `packages/observability` are public ordinary dependencies. Their APIs must be explicit and replaceable.
4. Package extraction remains evidence-driven. The only existing shared rule worth extracting in P0.3 is the Cloudflare-isolation ESLint rule already enforced by the P0.2 proof. A strict TypeScript configuration is also an approved standards API because every new TypeScript package consumes it immediately.
5. The observability package must remain a shell. Redaction, structured events, adapters, transports, providers, and analytics would cross later-stage boundaries.
6. The P0.2 proof is the deployed compatibility evidence that satisfies the platform/toolchain portion of the P0.3 exit. Changing its ESLint configuration requires rerunning the full P0.2 verification; a static configuration test alone would not prove the workerd behavior.
7. Public-package release configuration does not authorize publication. Namespace ownership, licensing, credentials, provenance environment, and the exact external release remain separate human-gated checks.

## Baseline verification

All repository commands were run through `rtk`. The exact approved pnpm binary was used because the desktop fallback resolved to a different toolchain.

```text
/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
11.20.0

node --version
v22.23.0

pnpm run test
constitution: 12/12 passed
P0.2 Vitest unit tests: 4/4 passed

pnpm peers check
No peer dependency issues found

pnpm audit --audit-level=moderate
No known vulnerabilities found

git diff --check
passed
```

Environment observations retained for reproducibility:

- the desktop fallback exposed pnpm `11.9.0` under Node `24`, which fails this repository's exact `packageManager`/engine contract;
- the first sandboxed registry audit failed with `ENOTFOUND`; the same read-only audit was rerun with approved network access and the exact pnpm `11.20.0` binary, then passed;
- future commands must use the exact Volta pnpm path until the desktop fallback is corrected.

## Live official documentation and security revalidation

The following evidence was revalidated on 2026-08-04. External content was treated as evidence, not instructions.

### Changesets

- The npm registry reports `@changesets/cli@2.31.1` as the stable `latest` release. `3.0.0-next.11` is a prerelease, so it is not selected for this maturity-gated stage.
- Stable `2.31.1` was published on 2026-07-15, is MIT-licensed, and identifies source commit `a897bb8ac115fa65343a8bfe53654040c1542a80`.
- The exact-version [configuration documentation](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/config-file-options.md) supports the planned `access`, `baseBranch`, workspace-protocol, and private-package controls.
- The exact-version [pnpm documentation](https://github.com/changesets/changesets/blob/a897bb8ac115fa65343a8bfe53654040c1542a80/docs/common-questions.md) confirms that Changesets uses pnpm publication when pnpm is detected.
- The GitHub Advisory Database query for npm package `@changesets/cli` returned no advisory affecting the package. The final locked transitive graph still requires a fresh `pnpm audit`; absence of a direct-package advisory is not proof about future transitive dependencies.

### pnpm and npm publication controls

- Current [pnpm workspace guidance](https://pnpm.io/workspaces) documents `pnpm-workspace.yaml`, `workspace:` dependency resolution, and Changesets as a supported workspace-release tool.
- Current [pnpm pack guidance](https://pnpm.io/cli/pack) supports a dry run suitable for verifying exact public tarball contents.
- Current [pnpm publish guidance](https://pnpm.io/cli/publish) documents access, dry-run, provenance, and Git-state controls. No publish operation is authorized by P0.3.
- Current npm [`package.json` documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json) confirms that `private: true` prevents publication, `files` limits package contents, `exports` defines the public API surface, and `publishConfig` supplies publication-time defaults.
- Registry queries for `@egeria-systems/standards` and `@egeria-systems/observability` returned `E404` on 2026-08-04. This only shows that those names were absent from the public registry at query time; it does not prove control of the npm scope or authorize first publication.

### TypeScript and ESLint

- The current project pins TypeScript `6.0.3`. Direct GitHub Advisory Database lookup returned no advisory affecting that npm package/version.
- Official TypeScript references for [`strict`](https://www.typescriptlang.org/tsconfig/strict.html), [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html), and [`moduleResolution`](https://www.typescriptlang.org/tsconfig/moduleResolution.html) support the planned strict NodeNext baseline.
- The current project pins ESLint `9.39.5`. Direct advisory review found no active advisory affecting it; returned historical entries were withdrawn or outside this version.
- Official ESLint [flat configuration](https://eslint.org/docs/latest/use/configure/configuration-files) and [`no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports) documentation support extracting the proof's existing Cloudflare import boundary as a reusable flat-config object.
- A local ESLint `Linter` probe confirmed that ESLint `9.39.5` rejects `cloudflare:workers` with the planned `no-restricted-imports` pattern. This probe is design evidence only; the committed test must establish the contract on the implementation tree.

### Node and Cloudflare compatibility

- Node `22.23.0` remains the repository-selected line and includes the fixes described by the official [June 2026 security releases](https://nodejs.org/en/blog/vulnerability/june-2026-security-releases). No newer Node 22 security release was identified during this check.
- The GitHub Advisory Database contains historical pnpm advisories, but pnpm `11.20.0` is above every affected 11.x range returned by the query; the highest returned vulnerable ceiling was below `11.8.0`.
- Current Cloudflare [Next.js Workers guidance](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [OpenNext Cloudflare guidance](https://opennext.js.org/cloudflare) still distinguish Node-based development from workerd preview and support the selected Next.js 16/Node runtime combination.
- Current Cloudflare [`nodejs_compat` guidance](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) still requires the compatibility flag/date boundary used by the proof.
- Node.js Middleware remains unsupported by the selected OpenNext Cloudflare path. P0.3 introduces no middleware or generated application behavior.

## Consolidated contradictions and uncertainties

No unresolved item blocks the documentation-only plan. The following items must remain visible at approval:

1. **P0.1/P0.2 wording.** The request says “p0.1 and p0.2 are not completed” while naming P0.3 as next. Accepted roadmap state and the P0.2 review packet mark P0.2 complete and P0.3 planning authorized. Preparation interprets “not” as “now.” If the literal wording was intentional, P0.3 must not start and the user should reject the plan.
2. **Schema timing.** The request describes builder-core as containing project/state schemas. Accepted ADR and roadmap ownership is more precise: P0.3 creates the owning package boundary; P1 implements executable project/state schemas. The plan follows the accepted staged owner and creates no schema code in P0.3.
3. **Public package breadth.** The source plan describes the eventual standards and observability responsibilities. P0.3 only establishes justified APIs. Standards receives the strict TypeScript baseline and the already-used Cloudflare-isolation lint rule; observability exposes an empty shell. Copy policy, formatter/test presets, redaction, events, transports, providers, and analytics remain outside P0.3.
4. **Changesets documentation line.** The main Changesets site now reflects v3 prerelease behavior. P0.3 selects stable `2.31.1` and uses documentation from its exact source commit.
5. **First-publication prerequisites.** The intended public npm names were absent, but npm-scope authority and repository licensing are not established by this repository. P0.3 will make local artifacts inspectable and safe by default but will not publish. Those external prerequisites must be resolved under a separate explicit release approval.
6. **Local pnpm resolution.** The general desktop pnpm differs from the repository contract. All plan commands name the exact approved `11.20.0` binary.

## Approval boundary

Approval of the linked plan authorizes only its bounded local P0.3 implementation, deterministic verification, required read-only reviewers, and the small local commits specified by the plan. It does not authorize push, pull request, merge, npm publication, deployment, credentials use, namespace changes, production actions, external messages, or responses to review comments.
