# ADR-0016: Optional application persistence and exact shared contracts

**Status:** Accepted

**Date:** 2026-09-14

[ADR-0020](0020-application-environments.md#generation-and-precise-supersessions) adds common application-target mapping and narrowly permits related unused snapshot retirement at complete generation activation. The APP_DB, local SQL/runtime evidence, approved remote-target, migration/removal and data-recovery protections below remain; persistence is never implicit.

Current public recipe and retained-snapshot applicability follows [ADR-0020](0020-application-environments.md#early-retirement-of-unused-public-generations) and [ADR-0015](0015-vitest-five-generation.md#patched-public-generation). Earlier version tuples below describe their original decision. The early retirement changes unused executable support only; removal, data, provider and outcome safeguards remain unchanged. Current persistence uses `app@0.2.7`, `standards@0.6.1`, deployment `0.4.1` and Vitest `5.0.3`; independent email/jobs composition keeps its declared deployment/foundation variants.

## Workers-types patch successor

On 2026-10-22, the approved adapter renewal requires `@cloudflare/workers-types@5.20261006.1` for Wrangler `4.148.0`. Current generation and supported installed operations select exact `application-persistence@0.1.1`. Its only descriptor changes are the version, exact Workers-types inference pin and the current `add-application-persistence-0-1-1` / `remove-application-persistence-0-1-1` operation identifiers.

Under [ADR-0020's unused-generation exception](0020-application-environments.md#early-retirement-of-unused-public-generations), this narrowly supersedes executable retention of persistence `0.1.0`. Preserve its original descriptor, registry record, historical decisions and frozen controls; old or mixed installed tuples refuse before effects. No client upgrade, database migration, new lifecycle operation or schema-2 persistence support is introduced. Jobs-bearing addition and non-jobs removal retain their existing unsupported-operation restrictions.

The successor certification subject is `0.1.1 / sha256:2174167ad3550bda8adaf7e7d046ccf3885d43604c31e57b23cbfadbf1ea6869`, pending with empty evidence and a renewed private task plan. Every other descriptor subject remains unchanged. Independent persistence/email selection, both jobs variants, source/data/provider separation and all evidence and human-review safeguards remain.

## Context

Application persistence needs shared deployment and test changes without changing the default app or invalidating materialized repositories. The user approved local-first configuration and separate persistence-specific contract versions on 2026-09-14, following the runner and export-removal review decisions.

## Decision

This ADR supersedes only [ADR-0015](0015-vitest-five-generation.md)'s requirement that every new generation select standards `0.5.0`. Default generation remains exactly as specified there. Explicit `application-persistence@0.1.0` selection on `app@0.2.0` selects standards `0.6.0` and deployment-cloudflare `0.4.0`; app-foundation `0.1.0`, site-routing `0.4.0`, Vitest `5.0.0` and Effect `4.0.0-rc.112` remain unchanged. No profile recipe default or historical descriptor changes.

Each finite catalog view has one descriptor per identifier. Select installed views from the complete validated installed tuple; original recipe provenance alone is insufficient. Addition moves from the exact default tuple to the persistence tuple; removal returns to the exact default tuple. Other optional operations retain the installed tuple. Unsupported mixed tuples and historical Vitest 4 persistence addition refuse before mutation. Existing upgrade and profile-transition edges remain unchanged.

Descriptor admission tracks the latest exact subjects. Changed standards and deployment subjects and the new persistence subject require pending certification records with no carried-forward evidence. Retained default and historical views continue to use their exact descriptors and receipts; evidence for one subject cannot certify another. The [parallel implementation exception](../roadmaps/program-roadmap.md#one-time-2026-09-14-persistence-implementation-exception) controls P4 protection, integration order and reconciliation.

Generation and addition provide local D1 support without Cloudflare credentials or remote provisioning. Staging and production require distinct explicit database identities before any remote operation. No default remote target, placeholder provisioning, shared stateless test environment or production action follows from selecting persistence. Deployment owns shared configuration and runtime test configuration; persistence owns schema conventions, D1 specifications and migration/recovery guidance. Drizzle generates SQL and Wrangler owns the migration ledger.

Use the existing Wrangler harness from a Vitest 5 Node host for a separate binding test lane executing D1 in workerd. Preserve the existing whole-built-Worker lane. Synthetic schema and Worker fixtures remain test-only. With no business consumer, generate no database port, service, business entity, CRUD route or domain adapter.

Removal assesses supplied export/recovery evidence locally, distinguishes checked and reported facts, reports uncertainty and requires subsequent human review of the exact evidence, report and source-removal plan. Integrity failures and changed approved inputs refuse before writes. Repository removal never performs or certifies export, remote restoration or database deletion.

[ADR-0015's dependency security successors](0015-vitest-five-generation.md#dependency-security-successors) extend this same optional contract and lifecycle eligibility to the corresponding schema-1 patch recipes. Prior decisions, descriptor versions, capability settings, dependencies, removal rules and historical behavior remain unchanged; no migration or additional capability transition is introduced.

## Consequences

Persistence is independently selectable while default and historical app behavior remain exact. The finite optional tuple adds explicit generation and lifecycle compatibility coverage. Local runtime evidence does not establish deployed persistence, recovery readiness or certification; remote resources and human outcome acceptance remain separately gated.

The [capability model](../architecture/capability-model.md) owns lifecycle behavior and the [enforcement map](../architecture/enforcement-map.md) owns verification gates.
