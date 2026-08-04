# ADR-0003: Hybrid Generated-Source Ownership

**Status:** Accepted

**Date:** 2026-08-04

## Context

Generated repositories must remain client-owned and modifiable while still supporting safe upgrades. Treating every generated file as permanently generator-owned would overwrite application work; treating everything as application-owned would make managed upgrades unreliable. Hybrid capabilities also combine dependencies, generated source, configuration, and provider state.

## Decision

Every generated or managed surface declares one ownership mode and its evidence:

- `managed`: the builder owns the complete surface, records a fingerprint, and may replace it through an approved migration;
- `merge-managed`: the builder owns a bounded structure and declares a deterministic merge strategy plus fingerprinted managed regions;
- `application-owned`: the builder may create an initial surface but never overwrites later application changes;
- `ejected`: the surface has explicitly left builder management and is not changed by later operations.

Hybrid capability descriptors enumerate every package-backed and source-generated surface. State records keep managed paths, fingerprints, merge strategies, and ejections. Repository inference checks those signals before planning.

Informational extension may continue only when non-interference is proven. Reconcilable drift requires an explicit reconciliation plan. Partial installation, contradictory ownership, ambiguous evidence, or a changed managed surface blocks transformation; there is no generic force bypass.

## Consequences

- Client ownership is preserved without pretending managed upgrades are risk-free.
- The builder must keep surface boundaries small and understandable.
- Merge behavior becomes part of the capability contract and fixture matrix.
- Ejection is explicit and may reduce later automated upgrade coverage.
- A capability cannot hide generated files outside its declared ownership map.

## Enforcement

Ownership schemas, fingerprints, inference probes, merge fixtures, and drift behavior are planned for P1 and P3 under `INV-CAPABILITY-METADATA`, `INV-CLEAN-ISOLATED-MIGRATION`, and `INV-STATE-UPDATE-ORDER`.
