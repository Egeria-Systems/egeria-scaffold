# P0.1 Gate 3 Revisions Design

**Status:** Approved

**Date:** 2026-08-04

## Goal

Revise the P0.1 candidate to provide a conventional nvm-compatible Node.js pin and to permit simple sequential development directly on a clean `main` branch, without weakening the transactional isolation required for builder commands that modify generated client repositories.

## Decisions

### Node.js version managers

Create root `.nvmrc` containing exactly `22.23.0` followed by a newline. Retain `package.json` `volta.node` with the same version. The two declarations are compatibility surfaces for different local version managers and must not drift.

The constitution contract will read both files and require the versions to match. P0.2 still owns proof that Node.js `22.23.0` is compatible with the selected Next.js, OpenNext, Cloudflare, pnpm, and test-tool versions.

### Repository-development Git policy

Development of this builder repository may proceed directly on `main` when all of the following are true:

- work is one clean, sequential implementation stream;
- the exact increment or revision has been approved;
- no user-owned staged, unstaged, or relevant untracked work would be overwritten;
- branch protection or another repository rule does not require a branch;
- the change does not otherwise materially benefit from isolation.

A branch and isolated worktree become required when parallel implementation begins or when isolation is materially useful for risk containment, experimentation, conflicting changes, or preservation of another active tree.

This development policy does not alter generated-client safety. Any builder command that changes a generated client repository still requires a clean Git state, a dedicated branch and isolated worktree, plan approval, one transformation, verification and post-change inference, final state-record update and verification, and exact-final-diff approval.

### Package scope

Retain `@egeria-systems/*`. The user does not control the existing npm `@egeria` scope, so the root remains `@egeria-systems/scaffold` and the planned public packages remain `@egeria-systems/standards` and `@egeria-systems/observability`.

No publication occurs in this revision. Registry ownership and publication authority remain P0.3 gates.

### Better Stack browser observability

Make no architecture change. ADR-0010 already includes explicitly configured browser errors and Web Vitals in the observability baseline while excluding session replay, automatic behavioral capture, duplicate website analytics, and console capture by default.

## Workspace boundaries

This revision creates no `apps/*` or `packages/*` directory and does not name the P0.2 compatibility-proof path. Existing planned boundaries remain:

- `apps/cli` for thin command input/output;
- private `packages/builder-core` for future builder internals and project/state schemas;
- public `packages/standards`;
- public `packages/observability`;
- separate generated repositories with `apps/web` and conditional `apps/jobs`.

The exact location and lifetime of the P0.2 deployed compatibility proof belong in the separately approved P0.2 implementation plan.

## Documentation ownership

The canonical Git lifecycle remains `docs/governance/review-and-contribution.md`. Root `AGENTS.md` summarizes the repository-development exception and links to the canonical owner. The P0.1 execution plan, verification evidence, and review packet will record this Gate 3 revision without rewriting the historical preparation evidence.

No Better Stack ADR or package-scope architecture document needs a semantic change; those decisions already match the approved direction.

## Verification

Implementation will use a focused RED/GREEN cycle:

1. extend the constitution test to require `.nvmrc` and equality with `volta.node`;
2. confirm focused RED because `.nvmrc` is absent;
3. add `.nvmrc` with the minimum content;
4. confirm focused GREEN;
5. update the canonical Git policy and direct consumers;
6. run the complete constitution suite and comparison whitespace check;
7. obtain bounded requirements, architecture, and test-evidence review of the final delta;
8. update the review packet and stop again for Gate 3 approval.

Static tests prove file content and version equality, not nvm installation, shell integration, framework compatibility, deployment, or runtime behavior. Git-policy semantics remain subject to human review rather than brittle prose-presence assertions.

## Recovery

The revision changes configuration and documentation only. Recovery uses ordinary `git revert` of the focused revision commits after explicit authorization. It has no deployment, provider state, persistent data, publication, or external resource to reverse.

## Non-goals

- Do not change the Node.js version.
- Do not remove Volta configuration.
- Do not adopt or publish under `@egeria`.
- Do not modify Better Stack or analytics architecture.
- Do not implement P0.2, create its proof app, install dependencies, or create a lockfile.
- Do not weaken isolation or approval requirements for generated-client transformations.
