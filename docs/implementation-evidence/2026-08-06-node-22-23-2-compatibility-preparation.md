# Node 22.23.2 Compatibility Preparation Evidence

**Date:** 2026-08-06 (America/Toronto)

**Status:** Preparation complete; implementation approved as a prerequisite amendment

**Implementation plan:** [Node 22.23.2 compatibility plan](../superpowers/plans/2026-08-06-node-22-23-2-compatibility.md)

## Scope

Update the repository, compatibility proof, builder state contract, and generated skeleton templates from Node `22.23.0` to `22.23.2`. Preserve pnpm `11.20.0` and every application, package, capability, and generated-project behavior other than the exact Node patch version.

One approved exact-file amendment was added after the full verification RED: the integrated skeleton template introduced a nested ESLint configuration that ESLint 10 tried to execute while traversing broad builder-test globs. The candidate now excludes only `packages/builder-core/templates/**` from builder ESLint and protects that boundary in `tests/package-boundaries/internal-linting.test.mjs`. The separate repository-wide semantic naming check continues to scan template paths and authored content.

This increment does not dispatch GitHub Actions, deploy, publish, change repository visibility, change a provider resource, or update historical evidence that correctly records an earlier runtime.

## Frozen implementation base

The work runs only in `/private/tmp/egeria-scaffold-public-package-release` on branch `public-package-release`. The branch was created from `8382de8f1377300d6bbeca6b67679d2c20ba6111` and now contains the approved deterministic skeleton-rendering commits plus the focused semantic-naming integration repair:

```text
3a9c1f1 Reconcile skeleton rendering integration
106024d Record skeleton rendering verification
7a6c090 Protect generation read boundaries
88f9b65 Harden skeleton rendering verification
c96a527 Align skeletons with architecture contracts
8fbb992 Render deterministic skeletons
```

The isolated worktree was clean before these planning artifacts. The primary checkout and its user-owned changes are not implementation inputs.

## Repository evidence

Fresh inspection found the current pin in these live owners and direct consumers:

- `.nvmrc`, root `package.json`, and the compatibility workflow;
- the compatibility record and proof-page content;
- the builder state contract and its generated JSON Schema;
- common generated skeleton templates;
- constitution, contract, state ownership, inference, diagnostic, and skeleton-rendering tests; and
- the root README's current-runtime statement.

Historical plans, preparation evidence, verification records, and review packets retain `22.23.0` when they describe the runtime actually used. They are not rewritten as if prior verification ran under a later version.

## Current official evidence

- The official [Node.js 22.23.2 release record](https://nodejs.org/en/blog/release/v22.23.2) identifies the 2026-07-29 build as a security release.
- The official [July 2026 security notice](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases) reports fixes affecting the Node 22 line, including three HIGH, four MEDIUM, and three LOW severity issues.
- The repository's exact pnpm `11.20.0` requires Node `>=22.13`, so Node `22.23.2` remains inside its supported engine range.
- The selected package graph, Next.js/OpenNext proof, and Cloudflare behavior still require local revalidation; version-range compatibility alone is not runtime proof.

No new dependency is introduced. A fresh frozen install, moderate-level dependency audit, builder verification, and complete local compatibility proof are mandatory on the changed tree.

## Blocking uncertainties

No choice remains unresolved. The exact target version is user approved, its affected live surfaces are identifiable, and historical records have a clear preservation rule.

The following results are stop conditions rather than choices to infer:

- Node `22.23.2` cannot be installed through the configured Volta runtime;
- generated schemas or rendered manifests disagree with the source contract;
- the frozen install or dependency audit fails;
- a compatibility-proof behavior regresses; or
- an independent reviewer identifies a current, material defect.

## Approval boundary

The user's standing approval covers this exact prerequisite amendment and local implementation. It does not authorize workflow dispatch, deployment, push, pull request, publication, visibility changes, credentials, permissions, or provider actions.
