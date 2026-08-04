# ADR-0002: Capability Delivery, State, and Removal

**Status:** Accepted

**Date:** 2026-08-04

## Context

Capabilities span ordinary dependencies, generated source, provider configuration, repository state, and persistent data. Composite labels in the source catalog mixed different concerns—for example state plus privilege or removal plus operational cleanup—and could not satisfy a stable schema.

## Decision

Every capability declares exactly one delivery mode:

- `package-backed`;
- `source-generated`;
- `hybrid`.

Public/private ownership and publication status are separate facts, not delivery modes.

Every capability declares `stateClassifications` as a non-empty set using only:

- `stateless`;
- `repository-stateful`;
- `external-stateful`;
- `persistent-data`.

`stateless` cannot be combined with another classification. Privileged operations, data classifications, retention, secrets, and threat-review level remain separate security metadata.

Every capability declares exactly one source-removal policy:

- `automatic`;
- `reviewed`;
- `export-and-remove`;
- `eject-only`;
- `unsupported`.

Provider cleanup, subscription cancellation, refunds, data export, retention, and recovery are separate `removalAndRecoveryRequirements`; removing source never implies completion of those operations.

Descriptors also declare dependencies, optional integrations, conflicts, supported profiles, packages, environment variables, secrets, resources, domains, CSP, browser storage, managed surfaces, inference probes, migration planners, verification, and documentation evidence.

## Consequences

- Descriptor schemas remain finite and machine-checkable.
- Capabilities can truthfully express multiple state effects without inventing composite enum values.
- Security and operational reversal remain visible instead of being compressed into misleading labels.
- Optional integration contracts do not become hidden mandatory dependencies.
- Migrations and removals can select verification and recovery proportional to actual state.

## Enforcement

`INV-CAPABILITY-METADATA` is planned for P1 builder-core schema and catalog contract tests. P0.1 checks only the canonical vocabulary and architecture coverage.
