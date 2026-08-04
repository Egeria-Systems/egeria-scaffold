# ADR-0001: Materialized Profile Recipes

**Status:** Accepted

**Date:** 2026-08-04

## Context

The builder needs named starting points without creating permanent architecture families. Live inheritance would allow a later profile edit to change existing projects implicitly, obscure what is actually installed, and make inference and migrations depend on historical recipe behavior.

The program distinguishes one-page `portfolio`, multi-page `site`, backend-ready `app`, and individual-account `authenticated-app`. Their names must not imply undeclared infrastructure.

## Decision

Profiles are versioned starting recipes. At generation time, the selected recipe resolves to an explicit capability set and settings. That installed capability manifest becomes authoritative immediately; origin profile and recipe version remain informational provenance only.

There is no live profile inheritance after materialization. A later recipe change does not mutate an existing repository. Changes arrive through explicit capability additions, removals, upgrades, and migrations against inferred installed state.

The public profiles mean:

- `portfolio`: principally one-page, static-first public presence;
- `site`: multi-page public website that is not stateful merely because it has multiple routes;
- `app`: `app-foundation` only by default;
- `authenticated-app`: `app-foundation`, application persistence, Resend transactional email, Better Auth verified email/password, Google sign-in, protected routes, account profile, and narrow support console.

TOTP, passkeys, payments, durable contact submissions, jobs, and CMS remain independent selections.

## Consequences

- Generated repositories can be understood from installed capabilities without replaying profile history.
- Recipe evolution does not silently change client repositories.
- Profile transitions are explicit migrations over a capability graph.
- Manifests, inference, migration fixtures, and documentation must use stable capability identifiers.
- A recipe may add convenience, but it cannot create hidden dependencies.

## Enforcement

`INV-PROFILE-MATERIALIZATION` is planned for P1 in builder-core resolver, manifest, and inference tests. Until then, the constitution contract verifies the recorded rule but does not claim runtime enforcement.
