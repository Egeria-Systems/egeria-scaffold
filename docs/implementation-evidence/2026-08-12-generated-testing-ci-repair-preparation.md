# Generated Testing CI Repair Preparation Evidence

**Date:** 2026-08-12 (America/Toronto)

## Scope and authority

This record prepares the approved repair comparison `origin/main..agent/generated-unit-component-testing` in the isolated worktree `.worktrees/generated-unit-component-testing-repair`. The branch was clean at `bfba450ced072bbf353bef7711327ca366e607b2`, matched its remote ref, and contained current `origin/main` at `2c7533edf96de6d95f45406abe65ba4432c43d4e` as its merge base before RED work.

The repair has two bounded outcomes:

1. materialize the checked recipe `0.7.0` lockfile without registry-dependent lockfile preparation; and
2. keep ordinary builder/package CI on every pull request while moving unchanged generated-project and compatibility-proof deep checks to separate read-only workflows scoped to their actual repository inputs.

The active observability-certification task owns observability certification, cleanup/recovery behavior and evidence, capability-registry transition, and defects discovered by its certification checks. This repair does not modify or accept those surfaces.

The user explicitly authorized implementation, push, and merge of merge request 2 after accurate hosted checks pass. Merge remains conditional on the exact head, current repository rules, required review state, and green applicable checks.

## Repository and architecture review

Preparation re-read the root constitution; the compatibility-proof nested instructions and compatibility record; the approved source plan and program roadmap; architecture overview, capability model, enforcement map, and review protocol; ADR-0011; the current workflow and constitution contract; root/proof manifests; the generated-testing design, implementation plan, verification evidence, and review packet; and the approved repair plan.

No architecture contradiction was found. The generated-project and compatibility-proof commands, pins, runtime versions, permissions, timeouts, and evidence boundaries remain unchanged. Only workflow ownership and triggers change. Manual certification, deployment, package release, provider, credential, and production workflows remain unchanged.

## Hosted failure and cost evidence

Hosted run `31561846621` at repair commit `6f2e558f5beeb968416c15cce1b92c870ae7d758` established:

- generated-project fixture determinism and retained-project verification passed in the `generated-projects` job in 13 minutes 7 seconds;
- the complete unchanged `compatibility-proof` job passed in 2 minutes 1 second; and
- the always-on builder/package job failed only in an observability certification cleanup contract owned by the concurrent excluded task.

A later documentation-only push triggered the same complete generated-project and compatibility-proof jobs again. The workflows were therefore accurate in commands but overly broad in triggers.

## Current GitHub contract

The active repository ruleset `Default` applies to the default branch and requires pull requests, one approving review, resolved review threads, signed commits, linear history, and deletion/non-fast-forward protection. It defines no required status-check contexts. The legacy branch-protection endpoint reports no separate protection object. GitHub Actions is enabled with all actions allowed; repository policy does not itself require SHA pinning.

Because no path-scoped workflow is currently required, a legitimately skipped deep workflow will not create a required pending check. GitHub documents that path-filtered workflows remain pending when their checks are required, so the ruleset must be revalidated before any generated-project or compatibility-proof status becomes required.

## Official documentation and action security revalidation

Current GitHub documentation was revalidated for [workflow path filters](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) and [secure workflow use](https://docs.github.com/en/actions/reference/security/secure-use). Path patterns are order-sensitive, pull requests use a three-dot change comparison, and full-length action SHAs plus least-privilege permissions remain the supported immutable/read-only boundary.

The retained action commits were resolved directly in their official repositories:

- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` is the verified `v7.0.1` release commit; and
- `pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2` is a verified official commit that preserves the requested installed runtime against context-aware shims.

Both official repositories returned empty public repository-security-advisory lists on 2026-08-12. This bounded lookup is not a general security-completeness claim.

## Planned contract and claim boundary

The constitution test must execute parsed workflow objects and fail when:

- ordinary builder/package checks stop running on every pull request;
- a deep workflow is recombined into the always-on workflow;
- an owned input path is omitted;
- any current command is weakened or removed;
- permissions, immutable action pins, credential persistence, timeouts, or runner pins drift; or
- deployment, publication, secret, environment, provider, or write authority appears.

Static parsing proves workflow structure only. Hosted runs after the push must separately prove that every applicable workflow starts, runs its real commands, and passes. No result establishes deployment, provider behavior, production readiness, visual quality, human accessibility, or WCAG conformance.

Source recovery is a focused revert of the CI-scoping commit. It restores the single broad ordinary workflow but requires no provider, deployment, credential, persistent-data, or production recovery.
