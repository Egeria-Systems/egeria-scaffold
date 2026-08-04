# ADR-0005: Evidence-Driven Package Extraction

**Status:** Accepted

**Date:** 2026-08-04

## Context

Packages can create clear ownership and independent release boundaries, but premature extraction adds versioning, publishing, dependency, bundle, debugging, and coordinated-release costs. Public availability improves replaceability but does not eliminate those costs.

Builder inference, capability resolution, transactional planning, ownership, migrations, repository transformation, and verification form one cohesive private subsystem. The project and state schemas have no independent consumer or release lifecycle yet.

## Decision

P0.3 may create:

- thin `apps/cli` for command input/output;
- private `packages/builder-core` containing builder internals and project/state schemas;
- public ordinary dependency `@egeria-systems/standards`;
- public ordinary dependency `@egeria-systems/observability`.

No separate `project-schema` package is created initially. Static schema artifacts may be emitted without introducing another release unit.

A new public package requires all of:

1. at least two concrete consumers or a genuine runtime/security boundary;
2. a stable public API;
3. independent release or fleet-maintenance value;
4. contract tests;
5. clear API ownership;
6. a migration and versioning policy;
7. evidence that packaging costs less than keeping the code local.

Generated applications keep behavior in cohesive `apps/web` modules until the same evidence justifies local extraction. Selecting queues does not automatically justify `apps/jobs`.

## Consequences

- `builder-core` can evolve with its internal schemas during the early program.
- Public packages remain replaceable and client-owned in ordinary dependency terms.
- An editor, IDE integration, management service, or other independent schema consumer may trigger later extraction through a new accepted decision.
- Package count remains a result of evidence rather than roadmap symmetry.

## Enforcement

`INV-PACKAGE-EXTRACTION` is planned for P0.3 package API/publication checks and P10 fleet evidence. Every extraction still requires bounded architectural review even when automated release checks pass.
