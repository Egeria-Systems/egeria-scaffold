# ADR-0013: Convergent app profile

**Status:** Accepted

**Date:** 2026-09-05

[ADR-0015](0015-vitest-five-generation.md) extends only this decision's exact current recipe and incoming-edge limitation. The first app recipe and its historical edges remain unchanged.

## Context

The first public `app` profile must add backend-ready application boundaries without discarding the production-site experience already owned by `site`. Treating `app` as only `app-foundation` would omit the established content, navigation, contact, accessibility, responsive, and visual contracts. Making website capabilities implicit inside `app-foundation` would instead blur ownership and prevent independent lifecycle behavior.

Existing generated repositories also need bounded transitions into `app`. Those transitions must preserve compatible application-owned work and optional selections, refuse unproved rewrites before mutation, and retain builder-kernel ownership of lockfile and state surfaces.

This ADR supersedes only [ADR-0001](0001-materialized-profile-recipes.md)'s future default-app recipe sentence. ADR-0001's materialization, installed-manifest authority, provenance, and other profile decisions remain unchanged.

## Decision

The exact public recipe is:

```text
app@0.1.0 = app-foundation@0.1.0 + site-routing@0.4.0
```

The recipe retains the complete production-site experience: multi-page content, navigation, metadata, contact behavior, localization readiness, accessibility behavior, responsive presentation, and the visual contract remain supplied by their existing canonical capabilities. `app-foundation` adds the backend-ready application boundary and does not absorb those owners.

`booking-calendly`, `multilingual`, and `analytics` remain independent optional capabilities. Fresh generation and both supported incoming transitions must cover all eight valid subsets:

```text
none
booking-calendly
multilingual
analytics
booking-calendly + multilingual
booking-calendly + analytics
multilingual + analytics
booking-calendly + multilingual + analytics
```

No optional capability becomes an implicit dependency of `app-foundation`.

The only supported incoming edges are:

```text
portfolio@0.10.0 -> app@0.1.0
site@0.11.0 -> app@0.1.0
```

Each transition classifies relevant paths as preserve, create, replace, migrate structurally, or refuse. It preserves compatible application-owned content and UI, applies only fingerprint-proven transformations, and refuses any unproved rewrite or ownership, state, identity, collision, or visual disagreement before the first write. No transition action deletes a UI or content file. Unrelated application-owned paths remain byte-identical.

The recipe selects exact lockfile bytes for its resolved graph, but `builder-kernel` remains the sole owner of root `pnpm-lock.yaml`, `.egeria/project.yaml`, `.egeria/state.json`, and `.egeria/migrations.jsonl`. State and migration records remain state-last lifecycle effects, and the resulting exact diff still requires verified-final-diff approval.

The profile adds no database, queue, email provider, durable contact submission, identity, payments, file storage, real-time infrastructure, CMS, or invented CRUD. Those remain independently selectable capabilities subject to their own dependencies and evidence.

## Rejected alternatives

- `app-foundation` alone is rejected because it would discard the production-site experience.
- Moving site routing, content, presentation, or optional integrations into `app-foundation` is rejected because it would duplicate or blur current capability ownership.
- Automatically adding persistence or another stateful backend is rejected because backend-ready composition does not require unused infrastructure.
- Broad historical transition support, best-effort rewriting, or deletion of existing UI/content is rejected because each would exceed the proven migration boundary.

## Consequences

- A generated app starts as the complete production site plus a backend-ready application boundary rather than a reduced demonstration.
- Website concerns retain their existing capability owners and independent optional lifecycle.
- Only the two named current source versions may transition into the first app recipe; historical, unknown, later, same-profile, and skipped versions remain unsupported.
- Content preservation, exact package and lockfile replacement, inference, verification, recovery, and final-diff review are mandatory transition properties.
- No app recipe, descriptor, generated runtime, lockfile, fixture, transition executor, or certification record is created by accepting this architecture decision.

## Enforcement

This ADR owns the exact app recipe and transition decisions. ADR-0001 continues to own materialization and installed-manifest authority. The enforcement map owns the actual and planned gate mapping for `INV-PROFILE-MATERIALIZATION` and the app recipe, optional-subset, incoming-transition, path-disposition, lockfile/state ownership, lifecycle, visual, and claim boundaries in its [canonical mapping](../architecture/enforcement-map.md). The [capability model](../architecture/capability-model.md) owns delivery, dependencies, state, inference, transitions, removal, and recovery. Until those planned gates are implemented, this ADR and its constitution contract establish architecture only and do not prove executable behavior.
