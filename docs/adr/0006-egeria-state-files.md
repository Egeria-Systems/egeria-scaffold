# ADR-0006: Egeria State Files

**Status:** Accepted

**Date:** 2026-08-04

## Context

Safe generation and upgrades require a human-reviewable desired state, a generator-owned record of what was successfully installed, and an append-only operational history. Combining these concerns would either expose generator internals to casual edits or make desired state opaque. Storing secrets would make the repository an unsafe authority.

## Decision

Generated repositories use three state files under `.egeria/`:

### `project.yaml`

Human-reviewable desired state in YAML 1.2:

- schema version and builder compatibility;
- origin profile and recipe version as informational provenance;
- platform adapter;
- selected capabilities and settings;
- default locale;
- ejected areas.

It contains no secrets. After generation, installed capabilities—not the origin profile—are authoritative.

### `state.json`

Generator-owned resolved installed state:

- resolved capability versions and delivery modes;
- applied migrations;
- managed paths, fingerprints, ownership, and merge strategies;
- ejections;
- compatibility information;
- last successful verification.

Users review it through diffs and builder diagnostics rather than editing it as desired state.

### `migrations.jsonl`

Append-only records of successful migrations, reconciliations, persistent-data authorizations, and known remaining drift. Failed or merely planned transformations do not appear as successful records.

State and migration records update only after transformation, verification, and post-change inference succeed. State/inference verification then runs again, and the records are included in the exact diff submitted for verified-final-diff approval. A failure before the successful record update leaves the previous authoritative state intact and produces recovery evidence separately.

Inference uses manifest, packages, registration, environment schema, routes, composition roots, bindings, data/content schemas, CI/deployment configuration, migration history, and managed-surface fingerprints. Results use `confirmed`, `probable`, `partial`, `contradictory`, or `ambiguous`; no fabricated numeric confidence is used.

No `.egeria` file or schema is created in P0.1. Initial schemas remain private inside future `builder-core` in P1.

## Consequences

- Desired and installed state have clear owners.
- Secrets must remain in approved environment/provider stores.
- Drift and partial installation can be compared against both declared and inferred evidence.
- State history is auditable without claiming that source rollback reverses persistent data or providers.
- Manual edits to generator-owned state are contradictory evidence and require reconciliation.

## Enforcement

`INV-CAPABILITY-METADATA` and `INV-STATE-UPDATE-ORDER` are planned for P1 schema/inference tests and P3 transactional failure/recovery fixtures.
